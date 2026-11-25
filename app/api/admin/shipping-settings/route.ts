import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAudit } from "@/lib/adminAudit";
import { adminDenied, adminSession } from "@/lib/adminAuth";
import {
  getMondialRelaySettings,
  getMondialRelayProductionCredentialStatus,
  getMondialRelayProductionReadiness,
  saveMondialRelaySettings,
} from "@/lib/mondialRelaySettings";
import { mutationAllowed, readJson, InputError, inputResponse } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const serviceCode = z.enum(["24R/MED", "24R/APM", "24R", "24L"]);
const parcelProfileSchema = z.object({
  itemsPerParcel: z.number().int().min(1).max(30),
  weightGrams: z.number().int().min(1).max(30000).nullable(),
  lengthCm: z.number().int().min(1).max(200).nullable(),
  widthCm: z.number().int().min(1).max(200).nullable(),
  depthCm: z.number().int().min(1).max(200).nullable(),
}).strict();
const ratesSchema = z.array(
  z.object({
    serviceCode,
    maxWeightGrams: z.number().int().min(1).max(30000),
    priceCents: z.number().int().min(0).max(100000),
  }).strict(),
).max(60);
const settingsSchema = z.object({
  serviceCode,
  testParcel: parcelProfileSchema,
  contractParcel: parcelProfileSchema,
  testRates: ratesSchema,
  contractRates: ratesSchema,
}).strict();

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const settings = await getMondialRelaySettings();
    const credentialsConfigured =
      getMondialRelayProductionCredentialStatus();
    const readiness = getMondialRelayProductionReadiness(settings);
    return NextResponse.json(
      {
        settings,
        credentialsConfigured,
        readiness,
        realShipmentCreationEnabled: readiness.shipmentCreationEnabled,
        realShippingEnabled: readiness.checkoutShippingReady,
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
    const settings = await readJson(request, settingsSchema, 20000);
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
