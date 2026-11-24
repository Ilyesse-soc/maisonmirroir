import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDenied, adminSession } from "@/lib/adminAuth";
import {
  createApi2SandboxTestShipment,
  MondialRelayApi2Error,
} from "@/lib/mondialRelayApi2";
import { database, transaction } from "@/lib/newsletterDb";
import {
  getMondialRelaySettings,
  getMondialRelayTestCredentialStatus,
} from "@/lib/mondialRelaySettings";
import { mutationAllowed } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const auditAction = "MONDIAL_RELAY_API2_SANDBOX_TEST_RESERVED";
const auditTarget = "mondial-relay-api2-sandbox-test-v1";
const outcomeAction = "MONDIAL_RELAY_API2_SANDBOX_TEST_RESULT";

async function recordOutcome(actorId: string, outcome: string) {
  try {
    await database().query(
      "INSERT INTO mm_admin_audit(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)",
      [randomUUID(), actorId, outcomeAction, outcome],
    );
  } catch {
    securityEvent("MONDIAL_RELAY_API2_TEST_OUTCOME_AUDIT_FAILED", "warn");
  }
}

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const [result, outcomeResult] = await Promise.all([
      database().query(
      "SELECT created_at FROM mm_admin_audit WHERE action=$1 AND target_id=$2 ORDER BY created_at LIMIT 1",
      [auditAction, auditTarget],
      ),
      database().query(
        "SELECT target_id FROM mm_admin_audit WHERE action=$1 ORDER BY created_at DESC LIMIT 1",
        [outcomeAction],
      ),
    ]);
    return NextResponse.json(
      {
        attempted: Boolean(result.rows[0]),
        createdAt: result.rows[0]?.created_at ?? null,
        outcome: outcomeResult.rows[0]?.target_id ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    securityEvent("MONDIAL_RELAY_API2_TEST_STATUS_FAILED");
    return NextResponse.json(
      { error: "État du test API2 indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) return originDenied;

  const credentialsStatus = getMondialRelayTestCredentialStatus();
  if (!credentialsStatus.api2)
    return NextResponse.json(
      { error: "Les identifiants API2 de test ne sont pas configurés." },
      { status: 503 },
    );
  if (!credentialsStatus.api2SandboxEnabled)
    return NextResponse.json(
      { error: "L’API2 sandbox est désactivée dans l’environnement serveur." },
      { status: 409 },
    );

  const session = await adminSession();
  if (!session)
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );

  let settings;
  try {
    settings = await getMondialRelaySettings();
  } catch {
    securityEvent("MONDIAL_RELAY_API2_TEST_SETTINGS_FAILED");
    return NextResponse.json(
      { error: "Profil colis de test indisponible." },
      { status: 503 },
    );
  }
  const parcel = settings.testParcel;
  if (
    !parcel.weightGrams ||
    !parcel.lengthCm ||
    !parcel.widthCm ||
    !parcel.depthCm
  )
    return NextResponse.json(
      { error: "Le profil colis de test doit inclure son poids et ses dimensions." },
      { status: 409 },
    );

  let reserved: boolean;
  try {
    reserved = await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        auditTarget,
      ]);
      const previous = await client.query(
        "SELECT 1 FROM mm_admin_audit WHERE action=$1 AND target_id=$2 LIMIT 1",
        [auditAction, auditTarget],
      );
      if (previous.rowCount) return false;
      await client.query(
        "INSERT INTO mm_admin_audit(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)",
        [randomUUID(), session.user.id, auditAction, auditTarget],
      );
      return true;
    });
  } catch {
    securityEvent("MONDIAL_RELAY_API2_TEST_RESERVATION_FAILED");
    return NextResponse.json(
      { error: "Impossible de réserver le test sans risque de doublon." },
      { status: 503 },
    );
  }
  if (!reserved)
    return NextResponse.json(
      {
        error: "Une tentative API2 sandbox a déjà été réservée. Aucune seconde création ne sera envoyée.",
        attempted: true,
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );

  try {
    const result = await createApi2SandboxTestShipment(
      {
        login: process.env.MONDIAL_RELAY_API2_TEST_LOGIN || "",
        password: process.env.MONDIAL_RELAY_API2_TEST_PASSWORD || "",
        customerId: process.env.MONDIAL_RELAY_API2_TEST_CUSTOMER_ID || "",
      },
      {
        weightGrams: parcel.weightGrams,
        lengthCm: parcel.lengthCm,
        widthCm: parcel.widthCm,
        depthCm: parcel.depthCm,
      },
    );
    await recordOutcome(
      session.user.id,
      `success:${result.shipmentNumber}`,
    );
    return NextResponse.json(
      { attempted: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    securityEvent("MONDIAL_RELAY_API2_TEST_FAILED", "warn");
    const code =
      error instanceof MondialRelayApi2Error ? error.code : "UNEXPECTED";
    const providerStatuses =
      error instanceof MondialRelayApi2Error
        ? error.providerStatuses
        : [];
    const shipmentNumber =
      error instanceof MondialRelayApi2Error
        ? error.shipmentNumber
        : undefined;
    const providerCodes = providerStatuses.map((status) => status.code);
    await recordOutcome(
      session.user.id,
      providerCodes.length
        ? `provider-error:${providerCodes.join(",")}`
        : `error:${code}`,
    );
    const details = providerStatuses.length
      ? providerStatuses
          .map(({ code: providerCode, level }) => `${providerCode} (${level})`)
          .join(", ")
      : code;
    return NextResponse.json(
      {
        error: `Le test sandbox Mondial Relay a échoué (${details}). La tentative reste verrouillée pour empêcher un doublon.`,
        attempted: true,
        providerStatuses,
        ...(shipmentNumber ? { shipmentNumber } : {}),
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
