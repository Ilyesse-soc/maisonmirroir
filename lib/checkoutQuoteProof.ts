import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { canonicalItems } from "@/lib/commerceSecurity";
import { verifyMondialRelayPointProof } from "@/lib/mondialRelayPointProof";
import { MONDIAL_RELAY_POINT_RELAIS_ID } from "@/lib/shipping";
import type { OrderPayload, ProductInfo } from "@/lib/orderTypes";
import type { RelayPoint } from "@/lib/mondialRelayTypes";

type CheckoutOrder = Omit<OrderPayload, "shippingMethodId"> & {
  shippingMethodId?: string;
  shipping?: { id?: string };
};

type QuoteSnapshot = {
  version: 1;
  paypalOrderId: string;
  expiresAt: number;
  orderDigest: string;
  itemDigest: string;
  relayPointId: string;
  relayLocation: string;
  serviceCode: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
};

export class CheckoutQuoteProofError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "CheckoutQuoteProofError";
  }
}

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new CheckoutQuoteProofError("CHECKOUT_PROOF_NOT_CONFIGURED");
  return value;
}

export function assertCheckoutQuoteProofConfigured() {
  secret();
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function canonicalOrderItems(order: CheckoutOrder) {
  const submitted =
    Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [order.product];
  try {
    return canonicalItems(submitted as ProductInfo[]);
  } catch {
    throw new CheckoutQuoteProofError("INVALID_CATALOG_ITEM");
  }
}

function orderDigest(order: CheckoutOrder) {
  return digest({
    product: order.product,
    items: order.items || [],
    customer: order.customer,
    customValues: order.customValues || {},
    attachments: (order.attachments || []).map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      contentDigest: digest(attachment.base64),
    })),
    shippingMethodId:
      order.shippingMethodId || order.shipping?.id || "",
    relayPoint: order.relayPoint || null,
  });
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest();
}

export function createCheckoutQuoteProof(
  paypalOrderId: string,
  order: CheckoutOrder,
  quote: {
    subtotalCents: number;
    shippingCents: number;
    totalCents: number;
  },
) {
  const point = order.relayPoint as RelayPoint | undefined;
  if (
    !point ||
    point.source !== "production" ||
    !verifyMondialRelayPointProof(point)
  )
    throw new CheckoutQuoteProofError("RELAY_POINT_INVALID_OR_EXPIRED");
  const items = canonicalOrderItems(order);
  const payload: QuoteSnapshot = {
    version: 1,
    paypalOrderId,
    expiresAt: Date.now() + 60 * 60 * 1000,
    orderDigest: orderDigest(order),
    itemDigest: digest(items),
    relayPointId: point.id,
    relayLocation: point.location,
    serviceCode: point.serviceCode,
    subtotalCents: quote.subtotalCents,
    shippingCents: quote.shippingCents,
    totalCents: quote.totalCents,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded).toString("base64url");
  return `${encoded}.${signature}`;
}

export function verifyCheckoutQuoteProof(
  proof: string,
  paypalOrderId: string,
  order: CheckoutOrder,
) {
  if (proof.length > 8192) throw new CheckoutQuoteProofError("PROOF_INVALID");
  const [encoded, suppliedSignature, extra] = proof.split(".");
  if (!encoded || !suppliedSignature || extra)
    throw new CheckoutQuoteProofError("PROOF_INVALID");
  const expectedSignature = sign(encoded);
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    throw new CheckoutQuoteProofError("PROOF_INVALID");
  }
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  )
    throw new CheckoutQuoteProofError("PROOF_INVALID");

  let snapshot: QuoteSnapshot;
  try {
    snapshot = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as QuoteSnapshot;
  } catch {
    throw new CheckoutQuoteProofError("PROOF_INVALID");
  }
  const point = order.relayPoint as RelayPoint | undefined;
  const items = canonicalOrderItems(order);
  const subtotalCents = items.reduce(
    (sum, item) =>
      sum + Math.round(item.unitPrice * 100) * item.quantity,
    0,
  );
  if (
    snapshot.version !== 1 ||
    snapshot.paypalOrderId !== paypalOrderId ||
    !Number.isSafeInteger(snapshot.expiresAt) ||
    snapshot.expiresAt < Date.now() ||
    snapshot.orderDigest !== orderDigest(order) ||
    snapshot.itemDigest !== digest(items) ||
    !point ||
    point.source !== "production" ||
    point.id !== snapshot.relayPointId ||
    point.location !== snapshot.relayLocation ||
    point.serviceCode !== snapshot.serviceCode ||
    !verifyMondialRelayPointProof(point) ||
    (order.shippingMethodId || order.shipping?.id) !==
      MONDIAL_RELAY_POINT_RELAIS_ID ||
    !Number.isSafeInteger(snapshot.shippingCents) ||
    snapshot.shippingCents <= 0 ||
    snapshot.subtotalCents !== subtotalCents ||
    snapshot.totalCents !== snapshot.subtotalCents + snapshot.shippingCents
  )
    throw new CheckoutQuoteProofError("CHECKOUT_PROOF_MISMATCH_OR_EXPIRED");
  return {
    items,
    relayPoint: {
      id: point.id,
      location: point.location,
      label: point.label,
      address: point.address,
      postalCode: point.postalCode,
      city: point.city,
      ...(point.distanceKm === undefined
        ? {}
        : { distanceKm: point.distanceKm }),
      source: point.source,
      serviceCode: point.serviceCode,
    } satisfies RelayPoint,
    subtotalCents: snapshot.subtotalCents,
    shippingCents: snapshot.shippingCents,
    totalCents: snapshot.totalCents,
  };
}
