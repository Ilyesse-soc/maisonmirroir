import "server-only";
import { z } from "zod";
import { products } from "./products";
import type { ProductInfo } from "./orderTypes";
import type { RelayPoint } from "./mondialRelayTypes";
const short = z.string().max(300);
const item = z
  .object({
    id: short,
    name: short,
    category: short,
    categoryLabel: short.optional(),
    unitPrice: z.number().positive().max(100000),
    quantity: z.number().int().min(1).max(1000),
    message: z.string().max(3000).optional(),
    image: z.string().max(2048).optional(),
    variantLabel: short.optional(),
  })
  .strict();
const customer = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().max(100),
    email: z.string().email().max(254),
    phone: z.string().max(30),
    street: z.string().max(300),
    city: z.string().max(100),
    zip: z.string().max(20),
    country: z.string().max(80).optional(),
  })
  .strict();
const shipping = z
  .object({
    id: short,
    label: short.optional(),
    shortLabel: short.optional(),
    carrier: short.optional(),
    price: z.number().optional(),
    estimatedDelay: short.optional(),
    trackingBaseUrl: z.string().optional(),
  })
  .strict();
const relayPoint = z
  .object({
    id: short,
    location: short,
    label: short,
    address: z.array(short).max(8),
    postalCode: short,
    city: short,
    distanceKm: z.number().finite().nonnegative().optional(),
    source: z.literal("production"),
    serviceCode: z.enum(["24R/MED", "24R/APM", "24R", "24L"]),
    proof: z.string().max(4096).optional(),
  })
  .strict() satisfies z.ZodType<RelayPoint>;
const attachment = z
  .object({
    filename: z
      .string()
      .max(200)
      .regex(/^[^\\/\x00-\x1f]+$/),
    contentType: z.enum(["application/pdf", "image/png"]),
    base64: z.string().max(2800000),
  })
  .strict();
export const orderPayloadSchema = z
  .object({
    product: item,
    items: z.array(item).min(1).max(30).optional(),
    customer,
    customValues: z
      .record(z.string().max(120), z.string().max(3000))
      .refine((v) => Object.keys(v).length <= 100)
      .optional(),
    attachments: z.array(attachment).max(2).optional(),
    shippingMethodId: short.optional(),
    shipping: shipping.optional(),
    relayPoint: relayPoint.optional(),
    promotionCode: z.string().trim().max(80).optional(),
  })
  .strict();
export const incomingOrderSchema = z
  .object({
    paymentMethod: z.enum(["PAYPAL", "CARD"]),
    paypalOrderId: z.string().regex(/^[A-Z0-9]{10,32}$/),
    checkoutProof: z.string().min(1).max(8192),
    order: orderPayloadSchema.optional(),
    name: short.optional(),
    email: z.string().email().max(254).optional(),
    phone: short.optional(),
    product: short.optional(),
    quantity: z.number().int().min(1).max(1000).optional(),
    price: z.number().positive().max(100000).optional(),
    address: short.optional(),
    city: short.optional(),
    postalCode: short.optional(),
    message: z.string().max(3000).optional(),
    shippingMethodId: short.optional(),
  })
  .strict()
  .refine((v) => Boolean(v.order));
export function canonicalItems(items: ProductInfo[]) {
  return items.map((item) => {
    const p = products.find(
      (p) => p.id === item.id || (item.id === "custom" && p.name === item.name),
    );
    if (
      !p ||
      p.publiclyListed !== true ||
      p.availableForSale !== true ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 1000
    )
      throw Error("INVALID_CATALOG_ITEM");
    const choices = Object.values(p.options || {})
      .flat()
      .filter((v) => typeof v !== "string");
    const allowed = [
      { price: p.price, label: "" },
      ...choices.map((v) => ({
        price: v.priceOverride ?? p.price + (v.priceDelta || 0),
        label: v.label,
      })),
    ];
    const choice = allowed.find(
      (v) => Math.round(v.price * 100) === Math.round(item.unitPrice * 100),
    );
    if (!choice) throw Error("INVALID_CATALOG_PRICE");
    return {
      id: p.id,
      name: p.name + (choice.label ? " - " + choice.label : ""),
      category: p.category,
      categoryLabel: p.categoryLabel,
      unitPrice: choice.price,
      quantity: item.quantity,
      ...(item.message ? { message: item.message } : {}),
    };
  });
}

function paypalApiBase() {
  const environment = process.env.PAYPAL_ENV;
  if (environment === "production") return "https://api-m.paypal.com";
  throw Error("PAYMENT_ENV_NOT_CONFIGURED");
}

export function getPayPalProductionStatus() {
  return {
    configured:
      process.env.PAYPAL_ENV === "production" &&
      Boolean(process.env.PAYPAL_CLIENT_ID?.trim()) &&
      Boolean(process.env.PAYPAL_CLIENT_SECRET?.trim()) &&
      Boolean(process.env.PAYPAL_MERCHANT_ID?.trim()) &&
      Boolean(process.env.PAYPAL_WEBHOOK_ID?.trim()),
    clientId:
      process.env.PAYPAL_ENV === "production"
        ? process.env.PAYPAL_CLIENT_ID?.trim() || ""
        : "",
  };
}

async function paypalAccessToken(base: string) {
  const client = process.env.PAYPAL_CLIENT_ID,
    secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!client || !secret) throw Error("PAYMENT_VERIFICATION_NOT_CONFIGURED");
  const response = await fetch(base + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(client + ":" + secret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("PAYMENT_VERIFICATION_UNAVAILABLE");
  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    !("access_token" in payload) ||
    typeof payload.access_token !== "string"
  )
    throw Error("PAYMENT_VERIFICATION_INVALID_RESPONSE");
  return payload.access_token;
}

export async function createPayPalCheckoutOrder(input: {
  totalCents: number;
  subtotalCents: number;
  discountCents?: number;
  shippingCents: number;
  reservationId?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  customer: {
    firstName: string;
    lastName: string;
    street: string;
    city: string;
    zip: string;
    country?: string;
  };
}) {
  if (!getPayPalProductionStatus().configured)
    throw Error("PAYMENT_VERIFICATION_NOT_CONFIGURED");
  const base = paypalApiBase();
  const token = await paypalAccessToken(base);
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        ...(input.reservationId
          ? {
              custom_id: input.reservationId,
              invoice_id: input.reservationId,
            }
          : {}),
        amount: {
          currency_code: "EUR",
          value: (input.totalCents / 100).toFixed(2),
          breakdown: {
            item_total: {
              currency_code: "EUR",
              value: (input.subtotalCents / 100).toFixed(2),
            },
            shipping: {
              currency_code: "EUR",
              value: (input.shippingCents / 100).toFixed(2),
            },
            ...(input.discountCents
              ? {
                  discount: {
                    currency_code: "EUR",
                    value: (input.discountCents / 100).toFixed(2),
                  },
                }
              : {}),
          },
        },
        shipping: {
          name: {
            full_name: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
          },
          address: {
            address_line_1: input.customer.street,
            admin_area_2: input.customer.city,
            postal_code: input.customer.zip,
            country_code: "FR",
          },
        },
        items: input.items.map((item) => ({
          name: item.name.slice(0, 127),
          unit_amount: {
            currency_code: "EUR",
            value: (item.unitPriceCents / 100).toFixed(2),
          },
          quantity: String(item.quantity),
          category: "PHYSICAL_GOODS",
        })),
      },
    ],
    application_context: {
      shipping_preference: "SET_PROVIDED_ADDRESS",
      user_action: "PAY_NOW",
    },
  };
  const response = await fetch(base + "/v2/checkout/orders", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("PAYMENT_ORDER_CREATION_FAILED");
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("id" in result) ||
    typeof result.id !== "string" ||
    !/^[A-Z0-9]{10,32}$/.test(result.id)
  )
    throw Error("PAYMENT_ORDER_CREATION_INVALID_RESPONSE");
  return result.id;
}

export async function verifiedPayPalOrderDetails(id: string, totalCents: number) {
  const merchant = process.env.PAYPAL_MERCHANT_ID;
  if (!merchant)
    throw Error("PAYMENT_VERIFICATION_NOT_CONFIGURED");
  const base = paypalApiBase();
  const token = await paypalAccessToken(base);
  const response = await fetch(
    base + "/v2/checkout/orders/" + encodeURIComponent(id),
    {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw Error("PAYMENT_VERIFICATION_FAILED");
  const data = await response.json();
  const units = data.purchase_units;
  if (
    data.id !== id ||
    data.status !== "COMPLETED" ||
    !Array.isArray(units) ||
    !units.length
  )
    throw Error("PAYMENT_NOT_COMPLETED");
  let captured = 0;
  const captureIds: string[] = [];
  for (const unit of units) {
    if (unit.payee?.merchant_id !== merchant)
      throw Error("PAYMENT_MERCHANT_MISMATCH");
    const captures = unit.payments?.captures;
    if (!Array.isArray(captures) || !captures.length)
      throw Error("PAYMENT_CAPTURE_MISSING");
    for (const capture of captures) {
      if (
        capture.status !== "COMPLETED" ||
        capture.amount?.currency_code !== "EUR"
      )
        throw Error("PAYMENT_NOT_COMPLETED");
      const amount = Number(capture.amount.value);
      if (!Number.isFinite(amount) || amount <= 0)
        throw Error("PAYMENT_INVALID_AMOUNT");
      captured += Math.round(amount * 100);
      if (typeof capture.id === "string") captureIds.push(capture.id);
    }
  }
  if (captured !== totalCents)
    throw Error("PAYMENT_AMOUNT_MISMATCH");
  if (captureIds.length !== 1)
    throw Error("PAYMENT_CAPTURE_COUNT_INVALID");
  return { captureId: captureIds[0] };
}

export async function verifiedPayPalOrder(id: string, total: number) {
  try {
    await verifiedPayPalOrderDetails(id, Math.round(total * 100));
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== "PAYMENT_CAPTURE_COUNT_INVALID"
    )
      throw error;
  }
  return true;
}

export async function captureAndVerifyPayPalOrder(
  id: string,
  totalCents: number,
) {
  const base = paypalApiBase();
  const token = await paypalAccessToken(base);
  const response = await fetch(
    `${base}/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) {
    try {
      const completed = await verifiedPayPalOrderDetails(id, totalCents);
      return completed;
    } catch {
      throw Error("PAYMENT_CAPTURE_FAILED");
    }
  }
  return verifiedPayPalOrderDetails(id, totalCents);
}

export async function verifyPayPalWebhook(
  headers: {
    authAlgo: string;
    certUrl: string;
    transmissionId: string;
    transmissionSignature: string;
    transmissionTime: string;
  },
  event: Record<string, unknown>,
) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw Error("PAYPAL_WEBHOOK_NOT_CONFIGURED");
  const base = paypalApiBase();
  const token = await paypalAccessToken(base);
  const response = await fetch(
    base + "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: headers.authAlgo,
        cert_url: headers.certUrl,
        transmission_id: headers.transmissionId,
        transmission_sig: headers.transmissionSignature,
        transmission_time: headers.transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw Error("PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("verification_status" in result))
    throw Error("PAYPAL_WEBHOOK_VERIFICATION_INVALID_RESPONSE");
  if (result.verification_status !== "SUCCESS")
    throw Error("PAYPAL_WEBHOOK_SIGNATURE_INVALID");
  return true;
}
