import "server-only";
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { PoolClient } from "pg";
import { database, transaction } from "@/lib/newsletterDb";
import type { CustomerInfo, OrderRecord, ProductInfo } from "@/lib/orderTypes";
import { getShippingMethodById } from "@/lib/shipping";
import {
  getAdminEmail,
  getEmailFrom,
  sendEmailOrThrow,
} from "@/lib/email";
import { addFrenchBusinessDays } from "@/lib/businessDays";

type CheckoutInput = {
  product: ProductInfo;
  items?: ProductInfo[];
  customer: CustomerInfo;
  shippingMethodId?: string;
  shipping?: { id?: string };
  relayPoint?: OrderRecord["shipping"]["relayPoint"];
  customValues?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    contentType: string;
    base64: string;
  }>;
  promotionCode?: string;
  acceptTerms: boolean;
  cgvVersion: string;
};

type CanonicalItem = ProductInfo & { unitPriceCents: number };
type CheckoutSnapshot = {
  order: CheckoutInput;
  items: ProductInfo[];
  subtotalCents: number;
  discountCents: number;
  promotionCode: string | null;
  shippingCents: number;
  totalCents: number;
  expiresAt: number;
  requestDigest: string;
  relayPoint?: CheckoutInput["relayPoint"];
  preparationDays: number;
  legalAcceptance: {
    version: string;
    acceptedAt: string;
  };
};
type CommerceQueryResult = {
  rows: Array<Record<string, unknown>>;
  rowCount?: number | null;
};
type Reservation = {
  reservation_id: string;
  paypal_order_id: string | null;
  status: string;
  order_snapshot: CheckoutSnapshot;
  total_cents: number;
  expires_at: Date | string;
  order_id: string | null;
};

export class CommerceError extends Error {
  constructor(
    readonly code: string,
    readonly status = 409,
  ) {
    super(code);
    this.name = "CommerceError";
  }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map((key) =>
        `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function checkoutRequestDigest(value: unknown) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function proofSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new CommerceError("CHECKOUT_PROOF_NOT_CONFIGURED", 503);
  return secret;
}

function signProof(value: string) {
  return createHmac("sha256", proofSecret()).update(value).digest();
}

export function createCommerceCheckoutProof(
  reservationId: string,
  paypalOrderId: string,
  expiresAt: number,
) {
  const payload = Buffer.from(
    JSON.stringify({ reservationId, paypalOrderId, expiresAt }),
  ).toString("base64url");
  return `${payload}.${signProof(payload).toString("base64url")}`;
}

export function verifyCommerceCheckoutProof(
  proof: string,
  reservationId: string,
  paypalOrderId: string,
  expiresAt: number,
) {
  if (proof.length > 2048) throw new CommerceError("PROOF_INVALID", 400);
  const [payload, signature, extra] = proof.split(".");
  if (!payload || !signature || extra)
    throw new CommerceError("PROOF_INVALID", 400);
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    throw new CommerceError("PROOF_INVALID", 400);
  }
  const expected = signProof(payload);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new CommerceError("PROOF_INVALID", 400);
  let claims: { reservationId?: unknown; paypalOrderId?: unknown; expiresAt?: unknown };
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new CommerceError("PROOF_INVALID", 400);
  }
  if (
    claims.reservationId !== reservationId ||
    claims.paypalOrderId !== paypalOrderId ||
    claims.expiresAt !== expiresAt ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Date.now()
  )
    throw new CommerceError("CHECKOUT_PROOF_MISMATCH_OR_EXPIRED", 409);
}

async function expireReservations(client: PoolClient) {
  const expired = await client.query<{
    reservation_id: string;
    items: Array<{ id: string; quantity: number }>;
    promotion_code: string | null;
  }>(
    `SELECT reservation_id, items, promotion_code
       FROM mm_commerce_reservations
      WHERE status = 'reserved' AND expires_at <= now()
      ORDER BY expires_at
      FOR UPDATE`,
  );
  for (const reservation of expired.rows) {
    const items = reservation.items as Array<{ id: string; quantity: number }>;
    for (const item of items) {
      await client.query(
        `UPDATE mm_commerce_products
            SET reserved_quantity = GREATEST(0, reserved_quantity - $2),
                updated_at = now()
          WHERE product_id = $1`,
        [item.id, item.quantity],
      );
    }
    if (reservation.promotion_code) {
      await client.query(
        `UPDATE mm_promotions
            SET reserved_count = GREATEST(0, reserved_count - 1),
                updated_at = now()
          WHERE code = $1`,
        [reservation.promotion_code],
      );
    }
    await client.query(
      `UPDATE mm_commerce_reservations
          SET status = 'expired', release_reason = 'expired', updated_at = now()
        WHERE reservation_id = $1 AND status = 'reserved'`,
      [reservation.reservation_id],
    );
  }
}

function normalizeQuantities(items: ProductInfo[]) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 30)
    throw new CommerceError("INVALID_CATALOG_ITEM", 400);
  const quantities = new Map<string, number>();
  for (const item of items) {
    const id = typeof item?.id === "string" ? item.id.trim().toLowerCase() : "";
    if (!/^(modest-era|paradise-way)$/.test(id))
      throw new CommerceError("INVALID_CATALOG_ITEM", 400);
    const quantity = item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 44)
      throw new CommerceError("INVALID_CATALOG_ITEM", 400);
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }
  if ([...quantities.values()].some((quantity) => quantity > 44))
    throw new CommerceError("INVALID_CATALOG_ITEM", 400);
  return [...quantities.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, quantity]) => ({ id, quantity }));
}

async function readCanonicalItems(
  query: (
    sql: string,
    values?: unknown[],
  ) => Promise<CommerceQueryResult>,
  quantities: Array<{ id: string; quantity: number }>,
  lock = false,
) {
  const ids = quantities.map((item) => item.id);
  const result = await query(
    `SELECT product_id, name, color, price_cents, active
       FROM mm_commerce_products
      WHERE product_id = ANY($1::text[])
      ORDER BY product_id${lock ? " FOR UPDATE" : ""}`,
    [ids],
  );
  if (result.rows.length !== ids.length)
    throw new CommerceError("INVALID_CATALOG_ITEM", 400);
  const byId = new Map<string, Record<string, unknown>>(
    result.rows.map((row) => [String(row.product_id), row]),
  );
  return quantities.map(({ id, quantity }) => {
    const row = byId.get(id);
    if (!row || row.active !== true)
      throw new CommerceError("INVALID_CATALOG_ITEM", 400);
    const priceCents = Number(row.price_cents);
    if (!Number.isSafeInteger(priceCents) || priceCents <= 0)
      throw new CommerceError("INVALID_CATALOG_PRICE", 400);
    return {
      id,
      name: String(row.name),
      category: "Collection",
      categoryLabel: String(row.color),
      unitPrice: priceCents / 100,
      unitPriceCents: priceCents,
      quantity,
    } satisfies CanonicalItem;
  });
}

export async function canonicalCommerceItems(items: ProductInfo[]) {
  const quantities = normalizeQuantities(items);
  return readCanonicalItems(database().query.bind(database()), quantities);
}

export async function getPublicCommerceCatalog() {
  return transaction(async (client) => {
    await expireReservations(client);
    const result = await client.query(
      `SELECT product_id, price_cents,
              (active AND quantity_on_hand > reserved_quantity) AS available
         FROM mm_commerce_products
        ORDER BY product_id`,
    );
    return result.rows.map((row) => ({
      id: row.product_id as string,
      price: Number(row.price_cents) / 100,
      available: row.available === true,
    }));
  });
}

export async function getPublicCommerceAvailability() {
  return (await getPublicCommerceCatalog()).map(({ id, available }) => ({
    id,
    available,
  }));
}

async function promotionQuote(
  query: (
    sql: string,
    values?: unknown[],
  ) => Promise<CommerceQueryResult>,
  code: string | undefined,
  items: CanonicalItem[],
) {
  if (!code?.trim())
    return { code: null as string | null, discountCents: 0 };
  const normalized = code.trim().toUpperCase();
  const result = await query(
    `SELECT code, discount_type, discount_value, max_redemptions,
            redeemed_count, reserved_count, starts_at, ends_at, product_ids,
            minimum_order_cents, active
       FROM mm_promotions WHERE code = $1`,
    [normalized],
  );
  const promotion = result.rows[0];
  if (!promotion || promotion.active !== true)
    throw new CommerceError("FIRSTPRINCESS1_INVALID", 400);
  if (
    (promotion.starts_at &&
      new Date(String(promotion.starts_at)).getTime() > Date.now()) ||
    (promotion.ends_at &&
      new Date(String(promotion.ends_at)).getTime() <= Date.now())
  )
    throw new CommerceError("FIRSTPRINCESS1_INVALID", 400);
  if (
    promotion.max_redemptions !== null &&
    Number(promotion.redeemed_count) + Number(promotion.reserved_count) >=
      Number(promotion.max_redemptions)
  )
    throw new CommerceError("FIRSTPRINCESS1_EXHAUSTED", 409);
  const allowedIds = Array.isArray(promotion.product_ids)
    ? promotion.product_ids
    : [];
  const eligibleSubtotal = items
    .filter((item) => !allowedIds.length || allowedIds.includes(item.id))
    .reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  if (eligibleSubtotal < Number(promotion.minimum_order_cents))
    throw new CommerceError("FIRSTPRINCESS1_INVALID", 400);
  const discountCents =
    promotion.discount_type === "percent"
      ? Math.floor((eligibleSubtotal * Number(promotion.discount_value)) / 100)
      : Math.min(eligibleSubtotal, Number(promotion.discount_value));
  if (discountCents <= 0)
    throw new CommerceError("FIRSTPRINCESS1_INVALID", 400);
  return { code: normalized, discountCents };
}

export async function validatePromotion(code: string, items: ProductInfo[]) {
  return transaction(async (client) => {
    await expireReservations(client);
    const canonical = await readCanonicalItems(
      client.query.bind(client),
      normalizeQuantities(items),
    );
    const subtotalCents = canonical.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );
    const promotion = await promotionQuote(
      client.query.bind(client),
      code,
      canonical,
    );
    return {
      code: promotion.code,
      subtotalCents,
      discountCents: promotion.discountCents,
      totalCents: subtotalCents - promotion.discountCents,
    };
  });
}

export async function reserveCommerceCheckout(input: {
  order: CheckoutInput;
  shippingCents: number;
  orderSnapshot: Record<string, unknown>;
}) {
  return transaction(async (client) => {
    await expireReservations(client);
    const preparationDays = input.orderSnapshot.preparationDays;
    if (
      input.order.acceptTerms !== true ||
      typeof input.orderSnapshot.cgvVersion !== "string" ||
      input.order.cgvVersion !== input.orderSnapshot.cgvVersion ||
      typeof preparationDays !== "number" ||
      !Number.isInteger(preparationDays) ||
      preparationDays < 1 ||
      preparationDays > 30
    )
      throw new CommerceError("CGV_ACCEPTANCE_REQUIRED", 400);
    const submitted =
      input.order.items?.length ? input.order.items : [input.order.product];
    const quantities = normalizeQuantities(submitted);
    const items = await readCanonicalItems(
      client.query.bind(client),
      quantities,
      true,
    );
    for (const item of items) {
      const reserved = await client.query(
        `UPDATE mm_commerce_products
            SET reserved_quantity = reserved_quantity + $2, updated_at = now()
          WHERE product_id = $1
            AND active = true
            AND quantity_on_hand - reserved_quantity >= $2
          RETURNING product_id`,
        [item.id, item.quantity],
      );
      if (reserved.rowCount !== 1)
        throw new CommerceError("INVENTORY_UNAVAILABLE", 409);
    }
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );
    const promo = await promotionQuote(
      client.query.bind(client),
      input.order.promotionCode,
      items,
    );
    if (
      !Number.isSafeInteger(input.shippingCents) ||
      input.shippingCents < 0
    )
      throw new CommerceError("SHIPPING_METHOD_UNAVAILABLE", 409);
    const totalCents =
      subtotalCents - promo.discountCents + input.shippingCents;
    const reservationId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const normalizedOrder = {
      ...input.order,
      product: items[0],
      items,
      promotionCode: promo.code || undefined,
    };
    const legalAcceptance = {
      version: input.order.cgvVersion,
      acceptedAt: new Date().toISOString(),
    };
    const snapshot = {
      ...input.orderSnapshot,
      order: normalizedOrder,
      items,
      subtotalCents,
      discountCents: promo.discountCents,
      promotionCode: promo.code,
      shippingCents: input.shippingCents,
      totalCents,
      expiresAt: expiresAt.getTime(),
      requestDigest: checkoutRequestDigest(input.order),
      preparationDays,
      legalAcceptance,
    } as CheckoutSnapshot;
    await client.query(
      `INSERT INTO mm_commerce_reservations
        (reservation_id, status, items, order_snapshot, subtotal_cents,
         promotion_code, discount_cents, shipping_cents, total_cents, expires_at)
       VALUES ($1, 'reserved', $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8, $9)`,
      [
        reservationId,
        JSON.stringify(items.map(({ id, quantity }) => ({ id, quantity }))),
        JSON.stringify(snapshot),
        subtotalCents,
        promo.code,
        promo.discountCents,
        input.shippingCents,
        totalCents,
        expiresAt.toISOString(),
      ],
    );
    if (promo.code) {
      const updated = await client.query(
        `UPDATE mm_promotions
            SET reserved_count = reserved_count + 1, updated_at = now()
          WHERE code = $1
            AND active = true
            AND (max_redemptions IS NULL OR
                 redeemed_count + reserved_count < max_redemptions)
          RETURNING code`,
        [promo.code],
      );
      if (updated.rowCount !== 1)
        throw new CommerceError("FIRSTPRINCESS1_EXHAUSTED", 409);
    }
    return {
      reservationId,
      expiresAt: expiresAt.getTime(),
      items,
      subtotalCents,
      discountCents: promo.discountCents,
      promotionCode: promo.code,
      shippingCents: input.shippingCents,
      totalCents,
      snapshot,
    };
  });
}

export async function bindPayPalOrder(
  reservationId: string,
  paypalOrderId: string,
) {
  const result = await database().query(
    `UPDATE mm_commerce_reservations
        SET paypal_order_id = $2, updated_at = now()
      WHERE reservation_id = $1 AND status = 'reserved'
        AND expires_at > now() AND paypal_order_id IS NULL
      RETURNING reservation_id`,
    [reservationId, paypalOrderId],
  );
  if (result.rowCount !== 1)
    throw new CommerceError("RESERVATION_EXPIRED", 409);
}

export async function getCommerceReservation(paypalOrderId: string) {
  const result = await database().query<Reservation>(
    `SELECT reservation_id, paypal_order_id, status, order_snapshot,
            total_cents, expires_at, order_id
       FROM mm_commerce_reservations WHERE paypal_order_id = $1`,
    [paypalOrderId],
  );
  return result.rows[0] || null;
}

async function releaseLockedReservation(
  client: PoolClient,
  reservation: Reservation & { items: Array<{ id: string; quantity: number }>; promotion_code?: string | null },
  reason: string,
) {
  for (const item of reservation.items) {
    await client.query(
      `UPDATE mm_commerce_products
          SET reserved_quantity = GREATEST(0, reserved_quantity - $2),
              updated_at = now()
        WHERE product_id = $1`,
      [item.id, item.quantity],
    );
  }
  if (reservation.promotion_code) {
    await client.query(
      `UPDATE mm_promotions
          SET reserved_count = GREATEST(0, reserved_count - 1),
              updated_at = now()
        WHERE code = $1`,
      [reservation.promotion_code],
    );
  }
  await client.query(
    `UPDATE mm_commerce_reservations
        SET status = $2, release_reason = $3, updated_at = now()
      WHERE reservation_id = $1 AND status = 'reserved'`,
    [
    reservation.reservation_id,
    reason === "expired"
      ? "expired"
      : reason === "payment_failed"
        ? "payment_failed"
        : "released",
    reason,
    ],
  );
}

export async function releaseCommerceReservation(
  reservationId: string,
  reason = "provider_failure",
) {
  await transaction(async (client) => {
    const result = await client.query<Reservation & {
      items: Array<{ id: string; quantity: number }>;
      promotion_code: string | null;
    }>(
      `SELECT reservation_id, items, promotion_code
         FROM mm_commerce_reservations
        WHERE reservation_id = $1 AND status = 'reserved'
        FOR UPDATE`,
      [reservationId],
    );
    if (result.rows[0])
      await releaseLockedReservation(client, result.rows[0], reason);
  });
}

function makeOrderRecord(
  orderId: string,
  paypalOrderId: string,
  snapshot: CheckoutSnapshot,
): OrderRecord {
  const order = snapshot.order;
  const shipping = getShippingMethodById(
    order.shippingMethodId || order.shipping?.id || "",
  );
  const items = snapshot.items as ProductInfo[];
  const paidAt = new Date().toISOString();
  return {
    orderId,
    orderDate: paidAt,
    paidAt,
    preparationDeadline: addFrenchBusinessDays(
      new Date(paidAt),
      snapshot.preparationDays,
    ),
    legalAcceptance: snapshot.legalAcceptance,
    paymentMethod: "PAYPAL",
    paypalOrderId,
    customer: order.customer,
    items,
    customValues: order.customValues || {},
    shipping: {
      id:
        shipping?.id ||
        order.shippingMethodId ||
        order.shipping?.id ||
        "",
      label: shipping?.label || "",
      shortLabel: shipping?.shortLabel || "",
      carrier: shipping?.carrier || "Mondial Relay",
      price: snapshot.shippingCents / 100,
      estimatedDelay: shipping?.estimatedDelay || "",
      trackingBaseUrl: shipping?.trackingBaseUrl || "",
      ...(snapshot.relayPoint ? { relayPoint: snapshot.relayPoint } : {}),
    },
    subtotal: snapshot.subtotalCents / 100,
    total: snapshot.totalCents / 100,
    status: "Payee",
  };
}

export async function finalizeCommercePayment(
  paypalOrderId: string,
  captureId: string,
) {
  return transaction(async (client) => {
    const found = await client.query<Reservation & {
      items: Array<{ id: string; quantity: number }>;
      promotion_code: string | null;
      discount_cents: number;
      subtotal_cents: number;
      shipping_cents: number;
      total_cents: number;
    }>(
      `SELECT reservation_id, paypal_order_id, status, items, order_snapshot,
              promotion_code, discount_cents, subtotal_cents, shipping_cents,
              total_cents, expires_at, order_id
         FROM mm_commerce_reservations
        WHERE paypal_order_id = $1
        FOR UPDATE`,
      [paypalOrderId],
    );
    const reservation = found.rows[0];
    if (!reservation) throw new CommerceError("RESERVATION_NOT_FOUND", 404);
    if (reservation.status === "completed" && reservation.order_id) {
      const existing = await client.query(
        `SELECT record FROM mm_orders WHERE order_id = $1`,
        [reservation.order_id],
      );
      return {
        orderId: reservation.order_id,
        orderRecord: existing.rows[0]?.record || null,
        snapshot: reservation.order_snapshot,
        alreadyFinalized: true,
      };
    }
    if (reservation.status !== "reserved")
      throw new CommerceError("RESERVATION_NOT_ACTIVE", 409);
    if (new Date(reservation.expires_at).getTime() <= Date.now()) {
      await releaseLockedReservation(client, reservation, "expired");
      return { expired: true as const };
    }
    const items = reservation.items;
    const stockResult = await client.query<{
      product_id: string;
      quantity_on_hand: number | string;
    }>(
      `SELECT product_id, quantity_on_hand
         FROM mm_commerce_products
        WHERE product_id = ANY($1::text[])
        ORDER BY product_id FOR UPDATE`,
      [items.map((item) => item.id)],
    );
    const stock = new Map<string, number>(
      stockResult.rows.map((row) => [
        row.product_id,
        Number(row.quantity_on_hand),
      ]),
    );
    const orderId = `MM-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    for (const item of items) {
      const before = stock.get(item.id);
      if (before === undefined || before < item.quantity)
        throw new CommerceError("INVENTORY_FINALIZATION_FAILED", 409);
      const after = before - item.quantity;
      const updated = await client.query(
        `UPDATE mm_commerce_products
            SET quantity_on_hand = quantity_on_hand - $2,
                reserved_quantity = reserved_quantity - $2,
                sold_quantity = sold_quantity + $2, updated_at = now()
          WHERE product_id = $1 AND reserved_quantity >= $2
            AND quantity_on_hand >= $2`,
        [item.id, item.quantity],
      );
      if (updated.rowCount !== 1)
        throw new CommerceError("INVENTORY_FINALIZATION_FAILED", 409);
      await client.query(
        `INSERT INTO mm_stock_movements
          (idempotency_key, product_id, movement_type, quantity_delta,
           quantity_before, quantity_after, reason, order_id)
         VALUES ($1, $2, 'sale', $3, $4, $5, 'PayPal paid order', $6)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          `sale:${paypalOrderId}:${item.id}`,
          item.id,
          -item.quantity,
          before,
          after,
          orderId,
        ],
      );
    }
    const orderRecord = makeOrderRecord(
      orderId,
      paypalOrderId,
      reservation.order_snapshot,
    );
    const inserted = await client.query(
      `INSERT INTO mm_orders(order_id, paypal_order_id, record)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (paypal_order_id) DO NOTHING
       RETURNING order_id`,
      [orderId, paypalOrderId, JSON.stringify(orderRecord)],
    );
    if (inserted.rowCount !== 1)
      throw new CommerceError("DUPLICATE_PAYMENT", 409);
    if (reservation.promotion_code) {
      const promoUpdated = await client.query(
        `UPDATE mm_promotions
            SET reserved_count = reserved_count - 1,
                redeemed_count = redeemed_count + 1, updated_at = now()
          WHERE code = $1 AND reserved_count > 0`,
        [reservation.promotion_code],
      );
      if (promoUpdated.rowCount !== 1)
        throw new CommerceError("PROMOTION_FINALIZATION_FAILED", 409);
      await client.query(
        `INSERT INTO mm_promotion_redemptions
          (order_id, paypal_order_id, code, discount_cents)
         VALUES ($1, $2, $3, $4)`,
        [
          orderId,
          paypalOrderId,
          reservation.promotion_code,
          reservation.discount_cents,
        ],
      );
    }
    await client.query(
      `INSERT INTO mm_commerce_order_financials
        (order_id, paypal_order_id, paypal_capture_id, payment_status,
         subtotal_cents, promotion_code, discount_cents, shipping_cents,
         total_cents, paid_at, preparation_deadline, cgv_version,
         cgv_accepted_at)
       VALUES ($1, $2, $3, 'paid', $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        orderId,
        paypalOrderId,
        captureId,
        reservation.subtotal_cents,
        reservation.promotion_code,
        reservation.discount_cents,
        reservation.shipping_cents,
        reservation.total_cents,
        orderRecord.paidAt,
        orderRecord.preparationDeadline,
        orderRecord.legalAcceptance?.version,
        orderRecord.legalAcceptance?.acceptedAt,
      ],
    );
    await client.query(
      `UPDATE mm_commerce_reservations
          SET status = 'completed', order_id = $2, updated_at = now()
        WHERE reservation_id = $1`,
      [reservation.reservation_id, orderId],
    );
    return {
      orderId,
      orderRecord,
      snapshot: reservation.order_snapshot,
      alreadyFinalized: false,
    };
  });
}

export async function sendCommerceEmailOnce(input: {
  orderId: string;
  type:
    | "order_confirmation"
    | "new_order_admin"
    | "withdrawal_confirmation";
  recipient: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: string;
  }>;
}) {
  const eventKey = `${input.orderId}:${input.type}`;
  const claimed = await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO mm_commerce_email_events
        (event_key, order_id, recipient, event_type, status, attempts)
       VALUES ($1, $2, $3, $4, 'pending', 0)
       ON CONFLICT (event_key) DO NOTHING
       RETURNING event_key`,
      [eventKey, input.orderId, input.recipient, input.type],
    );
    const row = await client.query(
      `SELECT status, updated_at, created_at FROM mm_commerce_email_events
        WHERE event_key = $1 FOR UPDATE`,
      [eventKey],
    );
    if (row.rows[0]?.status === "sent") return false;
    const createdAt = row.rows[0]?.created_at
      ? new Date(row.rows[0].created_at).getTime()
      : Date.now();
    if (Date.now() - createdAt >= 24 * 60 * 60 * 1000) {
      await client.query(
        `UPDATE mm_commerce_email_events
            SET status = 'failed',
                last_error = 'RESEND_IDEMPOTENCY_WINDOW_EXPIRED',
                updated_at = now()
          WHERE event_key = $1 AND status <> 'sent'`,
        [eventKey],
      );
      return false;
    }
    const lastAttempt = row.rows[0]?.updated_at
      ? new Date(row.rows[0].updated_at).getTime()
      : 0;
    if (
      inserted.rowCount === 0 &&
      Date.now() - lastAttempt < 5 * 60 * 1000
    )
      return false;
    await client.query(
      `UPDATE mm_commerce_email_events
          SET status = 'pending', attempts = attempts + 1,
              last_error = NULL, updated_at = now()
        WHERE event_key = $1`,
      [eventKey],
    );
    return true;
  });
  if (!claimed) return { sent: false, skipped: true };
  try {
    await sendEmailOrThrow({
      from: getEmailFrom(),
      to: input.recipient,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
      idempotencyKey: eventKey,
    });
    await database().query(
      `UPDATE mm_commerce_email_events
          SET status = 'sent', sent_at = now(), last_error = NULL,
              updated_at = now()
        WHERE event_key = $1`,
      [eventKey],
    );
    return { sent: true, skipped: false };
  } catch (error) {
    await database().query(
      `UPDATE mm_commerce_email_events
          SET status = 'failed', last_error = $2, updated_at = now()
        WHERE event_key = $1`,
      [
        eventKey,
        error instanceof Error ? error.message.slice(0, 500) : "EMAIL_FAILED",
      ],
    );
    throw error;
  }
}

export async function sendFinalizedCommerceEmails(
  orderRecord: OrderRecord,
  snapshot: CheckoutSnapshot,
) {
  const escape = (value: unknown) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  const rows = orderRecord.items
    .map(
      (item) =>
        `<li>${escape(item.name)} × ${item.quantity} - ${(item.unitPrice * item.quantity).toFixed(2)} EUR</li>`,
    )
    .join("");
  const summary = `<p>Commande ${escape(orderRecord.orderId)} payée.</p><ul>${rows}</ul><p>Sous-total : ${orderRecord.subtotal.toFixed(2)} EUR<br>Réduction : ${(Number(snapshot.discountCents || 0) / 100).toFixed(2)} EUR<br>Livraison : ${orderRecord.shipping.price.toFixed(2)} EUR<br>Total : ${orderRecord.total.toFixed(2)} EUR</p>`;
  const results: string[] = [];
  for (const [type, recipient, subject, replyTo] of [
    [
      "order_confirmation",
      orderRecord.customer.email,
      `Confirmation de votre commande - #${orderRecord.orderId}`,
      getAdminEmail(),
    ],
    [
      "new_order_admin",
      getAdminEmail(),
      `Nouvelle commande reçue - #${orderRecord.orderId}`,
      orderRecord.customer.email,
    ],
  ] as const) {
    if (!recipient) {
      results.push(`${type}:EMAIL_RECIPIENT_MISSING`);
      continue;
    }
    try {
      await sendCommerceEmailOnce({
        orderId: orderRecord.orderId,
        type,
        recipient,
        subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto">${summary}<p>${escape(orderRecord.customer.firstName)} ${escape(orderRecord.customer.lastName)}</p></div>`,
        replyTo: replyTo || undefined,
      });
    } catch {
      results.push(`${type}:EMAIL_REQUEST_FAILED`);
    }
  }
  return results;
}
