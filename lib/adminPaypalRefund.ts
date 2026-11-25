import "server-only";
import { getPayPalProductionStatus } from "@/lib/commerceSecurity";

const PAYPAL_LIVE_API = "https://api-m.paypal.com";

export type PayPalRefundResult = {
  refundId: string;
  status: "COMPLETED" | "PENDING" | "FAILED" | "CANCELLED";
  amountCents: number;
};

export function paypalRefundConfigured() {
  return getPayPalProductionStatus().configured;
}

export async function refundPayPalCapture(input: {
  captureId: string;
  amountCents: number;
  requestId: string;
}): Promise<PayPalRefundResult> {
  if (!paypalRefundConfigured())
    throw new Error("PAYMENT_VERIFICATION_NOT_CONFIGURED");
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(input.captureId) ||
      !Number.isSafeInteger(input.amountCents) || input.amountCents < 1 ||
      !/^[0-9a-f-]{36}$/i.test(input.requestId))
    throw new Error("INVALID_REFUND_REQUEST");

  const client = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!client || !secret) throw new Error("PAYMENT_VERIFICATION_NOT_CONFIGURED");

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(`${PAYPAL_LIVE_API}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${client}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error("PAYPAL_REFUND_UNKNOWN");
  }
  if (!tokenResponse.ok) throw new Error("PAYMENT_VERIFICATION_UNAVAILABLE");
  let tokenData: unknown;
  try { tokenData = await tokenResponse.json(); } catch { throw new Error("PAYMENT_VERIFICATION_INVALID_RESPONSE"); }
  if (!tokenData || typeof tokenData !== "object" || !("access_token" in tokenData) || typeof tokenData.access_token !== "string")
    throw new Error("PAYMENT_VERIFICATION_INVALID_RESPONSE");

  let response: Response;
  try {
    response = await fetch(
      `${PAYPAL_LIVE_API}/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": input.requestId,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          amount: { value: (input.amountCents / 100).toFixed(2), currency_code: "EUR" },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch {
    throw new Error("PAYPAL_REFUND_UNKNOWN");
  }
  if (!response.ok)
    throw new Error(response.status === 422 ? "PAYPAL_REFUND_REJECTED" : "PAYPAL_REFUND_UNKNOWN");

  let data: unknown;
  try { data = await response.json(); } catch { throw new Error("PAYPAL_REFUND_UNKNOWN"); }
  if (!data || typeof data !== "object") throw new Error("PAYPAL_REFUND_UNKNOWN");
  const value = data as Record<string, unknown>;
  const amount = value.amount as Record<string, unknown> | undefined;
  const amountCents = amount && typeof amount.value === "string" ? Math.round(Number(amount.value) * 100) : NaN;
  if (
    typeof value.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(value.id) ||
    !["COMPLETED", "PENDING", "FAILED", "CANCELLED"].includes(String(value.status)) ||
    amount?.currency_code !== "EUR" || amountCents !== input.amountCents
  ) throw new Error("PAYPAL_REFUND_UNKNOWN");
  return {
    refundId: value.id,
    status: value.status as PayPalRefundResult["status"],
    amountCents,
  };
}

export async function getPayPalRefundStatus(input: {
  refundId: string;
  amountCents: number;
}): Promise<PayPalRefundResult> {
  if (!paypalRefundConfigured() ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(input.refundId) ||
      !Number.isSafeInteger(input.amountCents) || input.amountCents < 1)
    throw new Error("INVALID_REFUND_REQUEST");
  const client = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!client || !secret) throw new Error("PAYMENT_VERIFICATION_NOT_CONFIGURED");
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(`${PAYPAL_LIVE_API}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${client}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error("PAYPAL_REFUND_UNKNOWN");
  }
  if (!tokenResponse.ok) throw new Error("PAYMENT_VERIFICATION_UNAVAILABLE");
  let tokenData: unknown;
  try { tokenData = await tokenResponse.json(); } catch { throw new Error("PAYMENT_VERIFICATION_INVALID_RESPONSE"); }
  if (!tokenData || typeof tokenData !== "object" || !("access_token" in tokenData) || typeof tokenData.access_token !== "string")
    throw new Error("PAYMENT_VERIFICATION_INVALID_RESPONSE");
  let response: Response;
  try {
    response = await fetch(
      `${PAYPAL_LIVE_API}/v2/payments/refunds/${encodeURIComponent(input.refundId)}`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch {
    throw new Error("PAYPAL_REFUND_UNKNOWN");
  }
  if (!response.ok) throw new Error("PAYPAL_REFUND_UNKNOWN");
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error("PAYPAL_REFUND_UNKNOWN"); }
  if (!data || typeof data !== "object") throw new Error("PAYPAL_REFUND_UNKNOWN");
  const value = data as Record<string, unknown>;
  const amount = value.amount as Record<string, unknown> | undefined;
  const amountCents = amount && typeof amount.value === "string" ? Math.round(Number(amount.value) * 100) : NaN;
  if (
    value.id !== input.refundId ||
    !["COMPLETED", "PENDING", "FAILED", "CANCELLED"].includes(String(value.status)) ||
    amount?.currency_code !== "EUR" || amountCents !== input.amountCents
  ) throw new Error("PAYPAL_REFUND_UNKNOWN");
  return {
    refundId: input.refundId,
    status: value.status as PayPalRefundResult["status"],
    amountCents,
  };
}
