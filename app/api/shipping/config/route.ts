import { NextResponse } from "next/server";
import {
  getMondialRelaySettings,
  getMondialRelayProductionReadiness,
} from "@/lib/mondialRelaySettings";
import { getPayPalProductionStatus } from "@/lib/commerceSecurity";
import { securityEvent } from "@/lib/observability";
import { getCgvVersion } from "@/lib/legalVersion";
import {
  MONDIAL_RELAY_HOME_ID,
  MONDIAL_RELAY_POINT_RELAIS_ID,
} from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getMondialRelaySettings();
    const relay = getMondialRelayProductionReadiness(settings);
    const paypal = getPayPalProductionStatus();
    const paymentsEnabled =
      process.env.REAL_PAYMENTS_ENABLED === "true" && paypal.configured;
    const homeModeReady =
      relay.homeDeliveryReady &&
      process.env.REAL_SHIPPING_ENABLED === "true";
    const realShippingEnabled =
      relay.checkoutShippingReady || homeModeReady;
    const realShipmentCreationEnabled =
      relay.shipmentCreationEnabled ||
      (homeModeReady &&
        process.env.REAL_SHIPMENT_CREATION_ENABLED === "true");
    const manualShippingReady =
      relay.manualShippingReady && realShippingEnabled;
    const fulfillmentReady =
      settings.fulfillmentMode === "manual_connect"
        ? manualShippingReady
        : realShipmentCreationEnabled;
    const shopOpen =
      process.env.SHOP_OPEN === "true" &&
      paymentsEnabled &&
      realShippingEnabled &&
      fulfillmentReady;
    const completePublicTier = (tier: (typeof settings.shippingTiers)[number]) =>
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
      tier.customerPriceCents > 0;
    const manualPublicTier = (tier: (typeof settings.shippingTiers)[number]) =>
      Number.isInteger(tier.weightGrams) &&
      Boolean(tier.weightGrams) &&
      tier.weightGrams! > 0 &&
      Number.isInteger(tier.customerPriceCents) &&
      Boolean(tier.customerPriceCents) &&
      tier.customerPriceCents! > 0;
    const publicShippingTiers = settings.shippingTiers.filter(
      settings.fulfillmentMode === "manual_connect"
        ? manualPublicTier
        : completePublicTier,
    );
    const publicHomeShippingTiers = settings.homeDeliveryEnabled &&
      (settings.homeDeliveryContractConfirmed ||
        (settings.fulfillmentMode === "manual_connect" && settings.manualConnectConfirmed))
      ? settings.homeShippingTiers.filter(
          (tier) =>
            completePublicTier(tier),
        )
      : [];
    const availableShippingMethodIds = [
      ...(relay.checkoutShippingReady ? [MONDIAL_RELAY_POINT_RELAIS_ID] : []),
      ...(homeModeReady ? [MONDIAL_RELAY_HOME_ID] : []),
    ];
    return NextResponse.json(
      {
        settings: {
          serviceCode: settings.serviceCode,
          shippingTiers: publicShippingTiers,
          homeShippingTiers: publicHomeShippingTiers,
          homeDeliveryEnabled: homeModeReady,
          homeDeliveryContractConfirmed: settings.homeDeliveryContractConfirmed,
          manualConnectConfirmed: settings.manualConnectConfirmed,
          preparationDays: settings.preparationDays,
          fulfillmentMode: settings.fulfillmentMode,
        },
        availableShippingMethodIds,
        cgvVersion: getCgvVersion(settings.preparationDays),
        shopOpen,
        paymentsEnabled,
        realShippingEnabled,
        realShipmentCreationEnabled,
        manualShippingReady,
        fulfillmentReady,
        paypalClientId: paymentsEnabled ? paypal.clientId : "",
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
