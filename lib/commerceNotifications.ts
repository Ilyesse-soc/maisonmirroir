import "server-only";
import { database, transaction } from "@/lib/newsletterDb";
import { getAdminEmail, getEmailFrom, sendEmailOrThrow } from "@/lib/email";
import { securityEvent } from "@/lib/observability";
import type { OrderRecord } from "@/lib/orderTypes";

type CommerceEvent =
  | "shipment_confirmation"
  | "relay_available"
  | "cancellation"
  | "refund";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export async function sendCommerceOrderNotification(
  order: OrderRecord,
  eventType: CommerceEvent,
  stateKey: string,
) {
  const from = getEmailFrom();
  const replyTo = getAdminEmail();
  const recipient = order.customer.email;
  if (!from || !recipient) {
    securityEvent("COMMERCE_NOTIFICATION_CONFIGURATION_MISSING", "warn");
    return;
  }
  const eventKey = `order:${order.orderId}:${eventType}:${stateKey}`;
  const claimed = await transaction(async (db) => {
    const result = await db.query(
      `INSERT INTO mm_commerce_email_events(event_key,order_id,recipient,event_type,status)
       VALUES($1,$2,$3,$4,'pending') ON CONFLICT(event_key) DO NOTHING RETURNING event_key`,
      [eventKey, order.orderId, recipient, eventType],
    );
    return Boolean(result.rowCount);
  });
  if (!claimed) return;
  try {
    const subject = eventType === "cancellation"
      ? `Annulation de la commande #${order.orderId}`
      : eventType === "refund"
        ? `Remboursement de la commande #${order.orderId}`
        : eventType === "relay_available"
          ? `Colis disponible en Point Relais - #${order.orderId}`
          : `Expédition de la commande #${order.orderId}`;
    const trackingNumber =
      order.trackingNumber ||
      order.shipping.mondialRelayShipment?.shipmentNumber ||
      "";
    const trackingUrl = order.trackingUrl || order.shipping.trackingBaseUrl;
    const trackingDetails =
      eventType === "shipment_confirmation" && trackingNumber
        ? `<p>Numéro de suivi : ${escapeHtml(trackingNumber)}</p><p><a href="${escapeHtml(trackingUrl)}">Suivre mon colis sur le site Mondial Relay</a></p>`
        : "";
    const relayDetails =
      eventType === "relay_available" && order.shipping.relayPoint
        ? `<p>Votre colis est indiqué comme disponible au Point Relais ${escapeHtml(order.shipping.relayPoint.label)}, ${escapeHtml(order.shipping.relayPoint.address.join(", "))}, ${escapeHtml(order.shipping.relayPoint.postalCode)} ${escapeHtml(order.shipping.relayPoint.city)}.</p><p>Numéro de suivi : ${escapeHtml(trackingNumber)}</p><p><a href="${escapeHtml(trackingUrl)}">Suivre mon colis sur le site Mondial Relay</a></p>`
        : "";
    await sendEmailOrThrow({
      from,
      to: recipient,
      ...(replyTo ? { replyTo } : {}),
      subject,
      html: `<p>Bonjour ${escapeHtml(order.customer.firstName || "")},</p>
        <p>${escapeHtml(subject)}.</p>${trackingDetails}${relayDetails}
        <p>Votre commande reste consultable avec la référence ${escapeHtml(order.orderId)}.</p>`,
    });
    await database().query(
      "UPDATE mm_commerce_email_events SET status='sent',sent_at=now(),updated_at=now() WHERE event_key=$1",
      [eventKey],
    );
  } catch {
    await database().query(
      "UPDATE mm_commerce_email_events SET status='failed',attempts=attempts+1,last_error='PROVIDER_ERROR',updated_at=now() WHERE event_key=$1",
      [eventKey],
    );
    securityEvent("COMMERCE_NOTIFICATION_SEND_FAILED", "warn");
  }
}
