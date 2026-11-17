import { NextRequest, NextResponse } from "next/server";
import { getResendClient } from "@/lib/email";
import { database } from "@/lib/newsletterDb";
import { deliveryStatuses, reconcileDelivery } from "@/lib/deliveryEvents";
import { readBoundedText } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const resend = getResendClient(),
    secret = process.env.RESEND_NEWSLETTER_WEBHOOK_SECRET;
  if (!resend || !secret) return new NextResponse(null, { status: 503 });
  let event;
  try {
    event = resend.webhooks.verify({
      payload: await readBoundedText(request, 65536),
      headers: {
        id: request.headers.get("svix-id") || "",
        timestamp: request.headers.get("svix-timestamp") || "",
        signature: request.headers.get("svix-signature") || "",
      },
      webhookSecret: secret,
    });
  } catch {
    securityEvent("WEBHOOK_SIGNATURE_REJECTED", "warn");
    return new NextResponse(null, { status: 400 });
  }
  if (!deliveryStatuses[event.type]) return NextResponse.json({ ok: true });
  const providerId = "email_id" in event.data ? event.data.email_id : null;
  if (typeof providerId !== "string" || providerId.length > 100)
    return new NextResponse(null, { status: 400 });
  try {
    await database().query(
      "INSERT INTO mm_webhook_receipts(event_id,provider_id,event_type,occurred_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [
        request.headers.get("svix-id"),
        providerId,
        event.type,
        event.created_at,
      ],
    );
    await reconcileDelivery(providerId);
    return NextResponse.json({ ok: true });
  } catch {
    securityEvent("WEBHOOK_PROCESSING_FAILED");
    return new NextResponse(null, { status: 503 });
  }
}
