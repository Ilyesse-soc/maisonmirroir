import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { persistSettingsPatch, SettingsConflict } from "@/lib/adminSettingsPatch";
import { adminAudit } from "@/lib/adminAudit";
import { adminDenied, adminSession } from "@/lib/adminAuth";
import {
  getMondialRelaySettings,
  getMondialRelayProductionCredentialStatus,
  getMondialRelayProductionReadiness,
  mondialRelaySettingsSchema,
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

export async function PUT() {
  const denied = await adminDenied();
  if (denied) return denied;
  return NextResponse.json(
    { error: "Cette page utilise une ancienne version. La sauvegarde a ete refusee pour proteger les donnees des autres appareils. Conservez vos champs avant de recharger la page." },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) return originDenied;
  try {
    const body = await readJson(request,
      z.object({ changes: z.record(z.string(), z.unknown()), expected: z.record(z.string(), z.unknown()) }).strict(), 30000);
    const session = await adminSession();
    if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    if ("changes" in body) {
      const settings = await persistSettingsPatch({
        ...body,
        read: client => getMondialRelaySettings(client),
        validate: value => mondialRelaySettingsSchema.parse(value),
        write: async (client, value) => {
          const changes = { ...body.changes };
          // Confirmations refer to the service and collection mode shown in the
          // form, even when those contextual fields were absent in old JSON.
          if ("serviceConfirmed" in changes) changes.serviceCode = value.serviceCode;
          if ("collectionModeConfirmed" in changes) changes.collectionMode = value.collectionMode;
          await client.query(`INSERT INTO mm_shipping_settings(id,settings,updated_by) VALUES(1,$1,$2)
            ON CONFLICT(id) DO UPDATE SET settings=$1::jsonb || mm_shipping_settings.settings || ($3::jsonb - 'sender') ||
              CASE WHEN $3::jsonb ? 'sender' THEN jsonb_build_object('sender',
                COALESCE(mm_shipping_settings.settings->'sender','{}'::jsonb) || ($3::jsonb->'sender'))
              ELSE '{}'::jsonb END,
            updated_by=EXCLUDED.updated_by,updated_at=now()`, [JSON.stringify(value), session.user.id, JSON.stringify(changes)]);
        },
      });
      await adminAudit("MONDIAL_RELAY_SETTINGS_UPDATE_CONFIRMED");
      return NextResponse.json({ settings, persisted: true }, { headers: { "Cache-Control": "no-store" } });
    }

  } catch (error) {
    if (error instanceof SettingsConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Champs invalides : " + error.issues.map(issue => issue.path.join(".")).join(", ") }, { status: 422 });
    if (error instanceof InputError) return inputResponse(error);
    securityEvent("MONDIAL_RELAY_SENDER_WRITE_FAILED");
    return NextResponse.json({ error: "Enregistrement du profil expéditeur impossible." }, { status: 503 });
  }
}
