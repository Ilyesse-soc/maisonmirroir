import { NextResponse } from "next/server";
import {
  getMondialRelaySettings,
  getMondialRelayTestCredentialStatus,
} from "@/lib/mondialRelaySettings";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const credentials = getMondialRelayTestCredentialStatus();
    return NextResponse.json(
      {
        settings: await getMondialRelaySettings(),
        mode: credentials.api1 && credentials.api1SandboxEnabled ? "sandbox" : "simulation",
        shopOpen: process.env.SHOP_OPEN === "true",
        paymentsEnabled: process.env.REAL_PAYMENTS_ENABLED === "true",
        realShippingEnabled: false,
        realShipmentCreationEnabled: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    securityEvent("MONDIAL_RELAY_PUBLIC_SETTINGS_READ_FAILED");
    return NextResponse.json(
      { error: "Configuration de livraison momentanément indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
