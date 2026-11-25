import { NextRequest, NextResponse } from "next/server";
import { adminAudit } from "@/lib/adminAudit";
import { adminDenied } from "@/lib/adminAuth";
import {
  claimMondialRelayShipmentJob,
  finishMondialRelayShipmentJob,
  retryMondialRelayShipmentJob,
} from "@/lib/orderStore";
import {
  createProductionShipment,
  ShipmentCreationError,
} from "@/lib/mondialRelayShipmentService";
import { mutationAllowed } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request, false);
  if (originDenied) return originDenied;
  let orderId = "";
  let jobClaimed = false;
  try {
    orderId = (await context.params).orderId;
    await adminAudit("MONDIAL_RELAY_PRODUCTION_SHIPMENT_REQUESTED", orderId);
    let claim = await claimMondialRelayShipmentJob(orderId);
    if (!claim && (await retryMondialRelayShipmentJob(orderId)))
      claim = await claimMondialRelayShipmentJob(orderId);
    if (!claim) {
      const state = await createProductionShipment(orderId);
      return NextResponse.json(state);
    }
    jobClaimed = true;
    const result = await createProductionShipment(orderId);
    await finishMondialRelayShipmentJob(orderId, "completed");
    await adminAudit("MONDIAL_RELAY_PRODUCTION_SHIPMENT_CREATED", orderId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ShipmentCreationError) {
      if (jobClaimed)
        await finishMondialRelayShipmentJob(
          orderId,
          error.outcome,
          error.code,
        );
      if (error.outcome === "unknown")
        securityEvent("MONDIAL_RELAY_PRODUCTION_SHIPMENT_RESULT_UNKNOWN", "warn");
      else securityEvent("MONDIAL_RELAY_PRODUCTION_SHIPMENT_FAILED", "warn");
      return NextResponse.json(
        {
          error: error.code,
          message:
            error.outcome === "unknown"
              ? "Le résultat est incertain. Vérifiez l’état dans Mondial Relay avant toute nouvelle tentative."
              : "La génération a échoué sans créer d’expédition. Corrigez la configuration puis réessayez.",
        },
        { status: error.httpStatus },
      );
    }
    securityEvent("MONDIAL_RELAY_PRODUCTION_SHIPMENT_FAILED");
    return NextResponse.json(
      { error: "MONDIAL_RELAY_SHIPMENT_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
