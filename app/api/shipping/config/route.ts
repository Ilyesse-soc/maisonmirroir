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
    const publicRates = relay.checkoutShippingReady
      ? [
          ...settings.contractRates,
          ...(settings.proposedRate.confirmed &&
          settings.proposedRate.maxWeightGrams &&
          settings.proposedRate.priceBasis !== "unknown" &&
          settings.proposedRate.customerPriceCents !== null
            ? [
                {
                  ...settings.proposedRate,
                  maxWeightGrams: settings.proposedRate.maxWeightGrams,
                  customerPriceCents:
                    settings.proposedRate.customerPriceCents,
                },
              ]
            : []),
        ]
          .filter(
            (rate) =>
              rate.confirmed &&
              rate.serviceCode === settings.serviceCode &&
              rate.priceBasis !== "unknown" &&
              rate.customerPriceCents !== null &&
              rate.customerPriceCents > 0,
          )
          .map(({ serviceCode, maxWeightGrams, priceBasis, customerPriceCents, confirmed }) => ({
            serviceCode,
            maxWeightGrams,
            priceBasis,
            customerPriceCents,
            confirmed,
          }))
      : [];
    return NextResponse.json(
      {
        settings: {
          serviceCode: settings.serviceCode,
          contractParcel: settings.contractParcel,
          contractRates: publicRates,
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
