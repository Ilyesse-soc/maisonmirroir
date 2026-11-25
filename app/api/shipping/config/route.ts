import { NextResponse } from "next/server";
import {
  getMondialRelaySettings,
  getMondialRelayProductionReadiness,
} from "@/lib/mondialRelaySettings";
import { getPayPalProductionStatus } from "@/lib/commerceSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getMondialRelaySettings();
    const relay = getMondialRelayProductionReadiness(settings);
    const paypal = getPayPalProductionStatus();
    const paymentsEnabled =
      process.env.REAL_PAYMENTS_ENABLED === "true" && paypal.configured;
    const realShippingEnabled = relay.checkoutShippingReady;
    const realShipmentCreationEnabled = relay.shipmentCreationEnabled;
    const shopOpen =
      process.env.SHOP_OPEN === "true" &&
      paymentsEnabled &&
      realShippingEnabled &&
      realShipmentCreationEnabled;
    const publicShippingTiers = relay.checkoutShippingReady
      ? settings.shippingTiers.filter(
          (tier) =>
            tier.confirmed &&
            typeof tier.weightGrams === "number" &&
            tier.weightGrams > 0 &&
            typeof tier.lengthCm === "number" &&
            tier.lengthCm > 0 &&
            typeof tier.widthCm === "number" &&
            tier.widthCm > 0 &&
            typeof tier.depthCm === "number" &&
            tier.depthCm > 0 &&
            typeof tier.customerPriceCents === "number" &&
            tier.customerPriceCents > 0,
        )
      : [];
    return NextResponse.json(
      {
        settings: {
          serviceCode: settings.serviceCode,
          shippingTiers: publicShippingTiers,
        },
        shopOpen,
        paymentsEnabled,
        realShippingEnabled,
        realShipmentCreationEnabled,
        paypalClientId: paymentsEnabled && shopOpen ? paypal.clientId : "",
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
