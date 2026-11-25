import { NextRequest, NextResponse } from "next/server";
import { adminAudit } from "@/lib/adminAudit";
import { adminDenied, adminSession } from "@/lib/adminAuth";
import {
  getMondialRelaySettings,
  getMondialRelayProductionCredentialStatus,
  getMondialRelayProductionReadiness,
  mondialRelaySettingsSchema,
  saveMondialRelaySettings,
} from "@/lib/mondialRelaySettings";
import { mutationAllowed, readJson, InputError, inputResponse } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const settings = await getMondialRelaySettings();
    const credentialsConfigured =
      getMondialRelayProductionCredentialStatus(settings);
    const readiness = getMondialRelayProductionReadiness(settings);
    return NextResponse.json(
      {
        settings,
        credentialsConfigured,
        readiness,
        realShipmentCreationEnabled:
          readiness.shipmentCreationEnabled ||
          readiness.homeShipmentCreationReady,
        realShippingEnabled:
          readiness.checkoutShippingReady || readiness.homeDeliveryReady,
        manualShippingReady: readiness.manualShippingReady,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    securityEvent("MONDIAL_RELAY_SETTINGS_READ_FAILED");
    return NextResponse.json(
      { error: "Paramètres de livraison momentanément indisponibles." },
      { status: 503 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) return originDenied;
  try {
    const settings = await readJson(request, mondialRelaySettingsSchema, 30000);
    const session = await adminSession();
    if (!session)
      return NextResponse.json(
        { error: "Authentification requise." },
        { status: 401 },
      );
    await adminAudit("MONDIAL_RELAY_SETTINGS_UPDATE_REQUESTED");
    await saveMondialRelaySettings(settings, session.user.id);
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    securityEvent("MONDIAL_RELAY_SETTINGS_WRITE_FAILED");
    return NextResponse.json(
      { error: "Enregistrement des paramètres impossible." },
      { status: 503 },
    );
  }
}
