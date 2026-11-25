import { NextResponse } from "next/server";
import { adminDenied } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  return NextResponse.json({
    paypalLive: {
      environmentConfigured: Boolean(process.env.PAYPAL_ENV?.trim()),
      productionEnvironment: process.env.PAYPAL_ENV === "production",
      clientIdConfigured: Boolean(process.env.PAYPAL_CLIENT_ID?.trim()),
      clientSecretConfigured: Boolean(process.env.PAYPAL_CLIENT_SECRET?.trim()),
      merchantIdConfigured: Boolean(process.env.PAYPAL_MERCHANT_ID?.trim()),
      webhookIdConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID?.trim()),
      paymentsEnabled: process.env.REAL_PAYMENTS_ENABLED === "true",
      shopOpen: process.env.SHOP_OPEN === "true",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
