import "server-only";
import { randomUUID } from "node:crypto";
import { trackMondialRelayShipment } from "@/lib/mondialRelayApi1";
import {
  claimMondialRelayShipmentJob,
  finishMondialRelayShipmentJob,
  finishMondialRelayTrackingCheck,
  readOrdersDueForTracking,
  reserveMondialRelayTrackingCheck,
  syncMondialRelayOrderStatus,
} from "@/lib/orderStore";
import {
  createProductionShipment,
  ShipmentCreationError,
} from "@/lib/mondialRelayShipmentService";
import {
  getMondialRelayProductionReadiness,
  getMondialRelaySettings,
} from "@/lib/mondialRelaySettings";
import { getMondialRelayOrderStatus } from "@/lib/mondialRelayTrackingStatus";
import { sendCommerceOrderNotification } from "@/lib/commerceNotifications";
import { securityEvent } from "@/lib/observability";

export async function processMondialRelayShipmentQueue(limit = 3) {
  let processed = 0;
  const settings = await getMondialRelaySettings();
  if (settings.fulfillmentMode === "api2") {
    for (let index = 0; index < limit; index += 1) {
      const job = await claimMondialRelayShipmentJob();
      if (!job) break;
      try {
        await createProductionShipment(job.order_id);
        await finishMondialRelayShipmentJob(job.order_id, "completed");
      } catch (error) {
        const outcome =
          error instanceof ShipmentCreationError ? error.outcome : "unknown";
        const errorCode =
          error instanceof ShipmentCreationError
            ? error.code
            : "WORKER_RESULT_UNKNOWN";
        await finishMondialRelayShipmentJob(job.order_id, outcome, errorCode);
        securityEvent(
          outcome === "unknown"
            ? "MONDIAL_RELAY_SHIPMENT_JOB_RESULT_UNKNOWN"
            : "MONDIAL_RELAY_SHIPMENT_JOB_FAILED",
          "warn",
        );
      }
      processed += 1;
    }
  }
  return processed + (await processDueTracking());
}

async function processDueTracking() {
  const settings = await getMondialRelaySettings();
  if (!getMondialRelayProductionReadiness(settings).api1Ready) return 0;
  const dueOrders = await readOrdersDueForTracking(3);
  let processed = 0;
  for (const order of dueOrders) {
    const shipment = order.shipping.mondialRelayShipment;
    if (!shipment?.shipmentNumber) continue;
    const attemptId = randomUUID();
    const reservation = await reserveMondialRelayTrackingCheck(
      order.orderId,
      attemptId,
      new Date().toISOString(),
      6 * 60 * 60 * 1000,
    );
    if (reservation.status !== "reserved") continue;
    let tracking;
    try {
      tracking = await trackMondialRelayShipment({
        shop: process.env.MONDIAL_RELAY_API1_PROD_SHOP || "",
        privateKey: process.env.MONDIAL_RELAY_API1_PROD_PRIVATE_KEY || "",
        shipmentNumber: shipment.shipmentNumber,
      });
    } catch {
      await finishMondialRelayTrackingCheck(order.orderId, attemptId, {
        trackingErrorCode: "PROVIDER_UNAVAILABLE",
      });
      securityEvent("MONDIAL_RELAY_AUTOMATIC_TRACKING_FAILED", "warn");
      processed += 1;
      continue;
    }

    const updated = await finishMondialRelayTrackingCheck(
      order.orderId,
      attemptId,
      {
        trackingEvents: tracking.events,
        trackingSummary: tracking.summary,
        trackingRelayNumber: tracking.relayNumber,
        trackingRelayLabel: tracking.relayLabel,
        trackingErrorCode: undefined,
      },
    );
    if (!updated) {
      securityEvent("MONDIAL_RELAY_AUTOMATIC_TRACKING_REQUIRES_RECONCILIATION");
      processed += 1;
      continue;
    }
    const trackingText = [tracking.summary, ...tracking.events.map((event) => event.label)].join(" ");
    const carrierStatus = getMondialRelayOrderStatus(trackingText);
    const currentOrder = carrierStatus
      ? await syncMondialRelayOrderStatus(order.orderId, carrierStatus)
      : updated;
    try {
      if (
        carrierStatus === "Deposee chez Mondial Relay" ||
        carrierStatus === "En transit"
      )
        await sendCommerceOrderNotification(
          currentOrder || updated,
          "shipment_confirmation",
          shipment.shipmentNumber,
        );
      const normalized = trackingText
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      if (
        updated.shipping.relayPoint &&
        /(?:disponible (?:au|en) point relais|mis a disposition au point relais)/.test(
          normalized,
        )
      )
        await sendCommerceOrderNotification(
          currentOrder || updated,
          "relay_available",
          shipment.shipmentNumber,
        );
    } catch {
      securityEvent("MONDIAL_RELAY_AUTOMATIC_TRACKING_NOTIFICATION_FAILED", "warn");
    }
    processed += 1;
  }
  return processed;
}
