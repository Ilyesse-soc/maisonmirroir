import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAudit } from "@/lib/adminAudit";
import { adminDenied } from "@/lib/adminAuth";
import { getMondialRelaySettings } from "@/lib/mondialRelaySettings";
import { registerManualMondialRelayShipment } from "@/lib/orderStore";
import {
  InputError,
  inputResponse,
  mutationAllowed,
  readJson,
} from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const orderIdPattern = /^MM-[0-9]{4}-[A-Z0-9]{8}$/;
const manualShipmentSchema = z
  .object({
    shipmentNumber: z.string().trim().min(4).max(40).regex(/^[A-Za-z0-9-]+$/),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request, false);
  if (originDenied) return originDenied;

  try {
    const { orderId } = await context.params;
    if (!orderIdPattern.test(orderId))
      return NextResponse.json({ error: "ORDER_ID_INVALID" }, { status: 400 });
    const { shipmentNumber } = await readJson(
      request,
      manualShipmentSchema,
      1000,
    );
    const settings = await getMondialRelaySettings();
    if (
      settings.fulfillmentMode !== "manual_connect" ||
      !settings.manualConnectConfirmed
    )
      return NextResponse.json(
        { error: "MANUAL_CONNECT_NOT_CONFIRMED" },
        { status: 409 },
      );

    await adminAudit("MONDIAL_RELAY_CONNECT_SHIPMENT_REGISTRATION_REQUESTED", orderId);
    await registerManualMondialRelayShipment(orderId, shipmentNumber);
    await adminAudit("MONDIAL_RELAY_CONNECT_SHIPMENT_REGISTERED", orderId);
    return NextResponse.json({ success: true, shipmentNumber });
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    const knownErrors: Record<string, { status: number; message: string }> = {
      ORDER_NOT_FOUND: { status: 404, message: "Commande introuvable." },
      MANUAL_SHIPMENT_RELAY_REQUIRED: {
        status: 409,
        message: "Cette commande n’utilise pas Mondial Relay Point Relais.",
      },
      MANUAL_SHIPMENT_ORDER_NOT_PAID: {
        status: 409,
        message: "Seule une commande payée peut être expédiée.",
      },
      SHIPMENT_ALREADY_EXISTS: {
        status: 409,
        message: "Une expédition existe déjà pour cette commande.",
      },
      ORDER_NOT_READY_FOR_MANUAL_SHIPMENT: {
        status: 409,
        message: "Le statut de cette commande ne permet pas cet enregistrement.",
      },
      AUTOMATIC_SHIPMENT_REQUIRES_RECONCILIATION: {
        status: 409,
        message:
          "Vérifiez d’abord l’état de l’expédition API2 dans Mondial Relay pour éviter un doublon.",
      },
      SHIPMENT_NUMBER_ALREADY_REGISTERED: {
        status: 409,
        message: "Ce numéro d’expédition est déjà associé à une autre commande.",
      },
    };
    if (error instanceof Error && knownErrors[error.message]) {
      const { status, message } = knownErrors[error.message];
      return NextResponse.json({ error: message }, { status });
    }
    securityEvent("MONDIAL_RELAY_CONNECT_SHIPMENT_REGISTER_FAILED", "warn");
    return NextResponse.json(
      { error: "Impossible d’enregistrer l’expédition manuelle." },
      { status: 503 },
    );
  }
}
