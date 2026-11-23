import { NextRequest, NextResponse } from "next/server";
import { verifyPayPalWebhook } from "@/lib/commerceSecurity";
import { database } from "@/lib/newsletterDb";
import { readBoundedText } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";

type PayPalEvent = {
  id?: unknown;
  event_type?: unknown;
  create_time?: unknown;
  resource?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await readBoundedText(request, 65536);
  } catch {
    securityEvent("PAYPAL_WEBHOOK_BODY_REJECTED", "warn");
    return new NextResponse(null, { status: 400 });
  }

  let event: PayPalEvent;
  try {
    event = JSON.parse(rawBody) as PayPalEvent;
  } catch {
    securityEvent("PAYPAL_WEBHOOK_BODY_REJECTED", "warn");
    return new NextResponse(null, { status: 400 });
  }

  const webhookHeaders = {
    authAlgo: request.headers.get("paypal-auth-algo") || "",
    certUrl: request.headers.get("paypal-cert-url") || "",
    transmissionId: request.headers.get("paypal-transmission-id") || "",
    transmissionSignature:
      request.headers.get("paypal-transmission-sig") || "",
    transmissionTime: request.headers.get("paypal-transmission-time") || "",
  };
  if (
    !webhookHeaders.authAlgo ||
    !webhookHeaders.certUrl ||
    !webhookHeaders.transmissionId ||
    !webhookHeaders.transmissionSignature ||
    !webhookHeaders.transmissionTime ||
    webhookHeaders.certUrl.length > 2000 ||
    !isRecord(event) ||
    typeof event.id !== "string" ||
    event.id.length < 1 ||
    event.id.length > 200 ||
    typeof event.event_type !== "string" ||
    event.event_type.length > 100 ||
    typeof event.create_time !== "string" ||
    !isRecord(event.resource)
  ) {
    securityEvent("PAYPAL_WEBHOOK_BODY_REJECTED", "warn");
    return new NextResponse(null, { status: 400 });
  }

  try {
    await verifyPayPalWebhook(
      webhookHeaders,
      event as Record<string, unknown>,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "PAYPAL_WEBHOOK_SIGNATURE_INVALID") {
      securityEvent("PAYPAL_WEBHOOK_SIGNATURE_REJECTED", "warn");
      return new NextResponse(null, { status: 400 });
    }
    if (
      reason === "PAYPAL_WEBHOOK_NOT_CONFIGURED" ||
      reason === "PAYMENT_ENV_NOT_CONFIGURED" ||
      reason === "PAYMENT_VERIFICATION_NOT_CONFIGURED"
    ) {
      securityEvent("PAYPAL_WEBHOOK_CONFIGURATION_MISSING");
      return new NextResponse(null, { status: 503 });
    }
    securityEvent("PAYPAL_WEBHOOK_VERIFICATION_FAILED");
    return new NextResponse(null, { status: 502 });
  }

  if (
    !event.event_type.startsWith("PAYMENT.CAPTURE.") &&
    !event.event_type.startsWith("CHECKOUT.ORDER.")
  )
    return NextResponse.json({ ok: true });

  const resource = event.resource as Record<string, unknown>;
  const providerId =
    typeof resource.id === "string" && resource.id.length <= 100
      ? resource.id
      : event.id;
  const occurredAt = new Date(event.create_time);
  if (!Number.isFinite(occurredAt.getTime())) {
    securityEvent("PAYPAL_WEBHOOK_BODY_REJECTED", "warn");
    return new NextResponse(null, { status: 400 });
  }

  try {
    await database().query(
      "INSERT INTO mm_webhook_receipts(event_id,provider_id,event_type,occurred_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [
        `paypal:${event.id}`,
        providerId,
        `paypal:${event.event_type}`,
        occurredAt.toISOString(),
      ],
    );
    return NextResponse.json({ ok: true });
  } catch {
    securityEvent("PAYPAL_WEBHOOK_PERSISTENCE_FAILED");
    return new NextResponse(null, { status: 503 });
  }
}
