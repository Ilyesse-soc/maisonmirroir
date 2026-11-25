import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminAudit } from "@/lib/adminAudit";
import { adminDenied } from "@/lib/adminAuth";
import { trackMondialRelayShipment } from "@/lib/mondialRelayApi1";
import {
  finishMondialRelayTrackingCheck,
  readOrders,
  reserveMondialRelayTrackingCheck,
} from "@/lib/orderStore";
import {
  getMondialRelayProductionReadiness,
  getMondialRelaySettings,
} from "@/lib/mondialRelaySettings";
import { mutationAllowed } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";
import type { MondialRelayShipment } from "@/lib/orderTypes";
import { sendCommerceOrderNotification } from "@/lib/commerceNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const orderIdPattern = /^MM-[0-9]{4}-[A-Z0-9]{8}$/;
const refreshIntervalMs = 6 * 60 * 60 * 1000;

function publicTracking(shipment: MondialRelayShipment) {
  return {
    status: shipment.status,
    shipmentNumber: shipment.shipmentNumber,
    trackingEvents: shipment.trackingEvents || [],
    trackingSummary: shipment.trackingSummary || "",
    trackingRelayNumber: shipment.trackingRelayNumber || "",
    trackingRelayLabel: shipment.trackingRelayLabel || "",
    trackingCheckedAt: shipment.trackingCheckedAt || "",
    trackingErrorCode: shipment.trackingErrorCode || "",
  };
}

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
    const order = (await readOrders()).find((item) => item.orderId === orderId);
    if (!order)
      return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    const shipment = order.shipping.mondialRelayShipment;
    if (!shipment?.shipmentNumber)
      return NextResponse.json(
        { error: "SHIPMENT_NUMBER_NOT_AVAILABLE" },
        { status: 409 },
      );
    const settings = await getMondialRelaySettings();
    const readiness = getMondialRelayProductionReadiness(settings);
    if (!readiness.api1Ready)
      return NextResponse.json(
        { error: "MONDIAL_RELAY_API1_NOT_READY" },
        { status: 503 },
      );

    const attemptId = randomUUID();
    const checkedAt = new Date().toISOString();
    const reservation = await reserveMondialRelayTrackingCheck(
      orderId,
      attemptId,
      checkedAt,
      refreshIntervalMs,
    );
    if (reservation.status === "missing")
      return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    if (reservation.status === "shipment-missing")
      return NextResponse.json(
        { error: "SHIPMENT_NUMBER_NOT_AVAILABLE" },
        { status: 409 },
      );
    if (reservation.status === "cooldown")
      return NextResponse.json({
        status: "cached",
        tracking: publicTracking(
          reservation.order.shipping.mondialRelayShipment!,
        ),
      });

    await adminAudit("MONDIAL_RELAY_TRACKING_REQUESTED", orderId);
    try {
      const tracking = await trackMondialRelayShipment({
        shop: process.env.MONDIAL_RELAY_API1_PROD_SHOP || "",
        privateKey: process.env.MONDIAL_RELAY_API1_PROD_PRIVATE_KEY || "",
        shipmentNumber: shipment.shipmentNumber,
      });
      const updated = await finishMondialRelayTrackingCheck(
        orderId,
        attemptId,
        {
          trackingEvents: tracking.events,
          trackingSummary: tracking.summary,
          trackingRelayNumber: tracking.relayNumber,
          trackingRelayLabel: tracking.relayLabel,
          trackingErrorCode: undefined,
        },
      );
      if (!updated)
        return NextResponse.json(
          { error: "TRACKING_RESULT_REQUIRES_RECONCILIATION" },
          { status: 503 },
        );
      const trackingText = [
        tracking.summary,
        ...tracking.events.map((event) => event.label),
      ]
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      if (
        updated.shipping.relayPoint &&
        /(?:disponible (?:au|en) point relais|mis a disposition au point relais)/.test(
          trackingText,
        )
      )
        await sendCommerceOrderNotification(
          updated,
          "relay_available",
          shipment.shipmentNumber,
        );
      await adminAudit("MONDIAL_RELAY_TRACKING_UPDATED", orderId);
      return NextResponse.json({
        status: "updated",
        tracking: publicTracking(
          updated.shipping.mondialRelayShipment!,
        ),
      });
    } catch {
      await finishMondialRelayTrackingCheck(orderId, attemptId, {
        trackingErrorCode: "PROVIDER_UNAVAILABLE",
      });
      securityEvent("MONDIAL_RELAY_TRACKING_FAILED", "warn");
      return NextResponse.json(
        { error: "MONDIAL_RELAY_TRACKING_UNAVAILABLE" },
        { status: 502 },
      );
    }
  } catch {
    securityEvent("MONDIAL_RELAY_TRACKING_FAILED");
    return NextResponse.json(
      { error: "MONDIAL_RELAY_TRACKING_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
