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
    source: z.enum(["simulation", "sandbox"]),
    serviceCode: z.enum(["24R", "24L"]),
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
const order = z
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
  })
  .strict();
export const incomingOrderSchema = z
  .object({
    paymentMethod: z.enum(["PAYPAL", "CARD"]),
    paypalOrderId: z.string().regex(/^[A-Z0-9]{10,32}$/),
    paypalCapture: z.unknown().optional(),
    order: order.optional(),
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
  .refine((v) => Boolean(v.order || v.product));
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
      name: p.name + (choice.label ? " ? " + choice.label : ""),
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
  if (environment === "sandbox") return "https://api-m.sandbox.paypal.com";
  if (environment === "production") return "https://api-m.paypal.com";
  throw Error("PAYMENT_ENV_NOT_CONFIGURED");
}

async function paypalAccessToken(base: string) {
  const client =
      process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
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

export async function verifiedPayPalOrder(id: string, total: number) {
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
    }
  }
  if (captured !== Math.round(total * 100))
    throw Error("PAYMENT_AMOUNT_MISMATCH");
  return true;
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
