import { orderPatchSchema } from "@/lib/newsletterSchemas";
import {
  readJson,
  mutationAllowed,
  InputError,
} from "@/lib/requestSecurity";
import { adminAudit } from "@/lib/adminAudit";
import { securityEvent } from "@/lib/observability";
import { adminDenied } from "@/lib/adminAuth";
import { NextRequest, NextResponse } from "next/server";
import { readOrders, updateOrder } from "@/lib/orderStore";
import type { OrderRecord, OrderStatus } from "@/lib/orderTypes";
import { database, transaction } from "@/lib/newsletterDb";
import { sendCommerceOrderNotification } from "@/lib/commerceNotifications";
import { presentAdminOrders } from "@/lib/adminOrderPresentation";

const STATUS_VALUES: OrderStatus[] = [
  "En attente",
  "En preparation",
  "Prete a expedier",
  "Deposee chez Mondial Relay",
  "En transit",
  "Disponible en Point Relais",
  "Expediee",
  "Livree",
  "Retournee",
  "Annulee",
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function logAdminOrderEvent(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    void meta;
    securityEvent("ORDER_ADMIN_UPDATE", "info");
    return;
  }
  void message;
  securityEvent("ORDER_ADMIN_UPDATE", "info");
}

function getTrackingLink(carrier: string, fallbackUrl: string) {
  const normalized = carrier.toLowerCase();
  if (normalized.includes("colissimo"))
    return "https://www.laposte.fr/outils/suivre-vos-envois";
  if (normalized.includes("mondial relay"))
    return "https://www.mondialrelay.fr/suivi-de-colis/";
  if (normalized.includes("chronopost"))
    return "https://www.chronopost.fr/tracking-no-cms/suivi-page";
  return fallbackUrl;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const denied = await adminDenied();
  if (denied) return denied;
  const noStore = { "Cache-Control": "no-store" };
  try {
    const { orderId } = await context.params;
    if (!/^MM-[0-9]{4}-[A-Z0-9]{8}$/.test(orderId))
      return NextResponse.json({ error: "Identifiant invalide." }, { status: 400, headers: noStore });
    const order = (await readOrders()).find((item) => item.orderId === orderId);
    if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404, headers: noStore });
    let finance: Record<string, unknown> | null = null;
    try {
      finance = (await database().query(
        `SELECT payment_status,shipment_status,subtotal_cents,discount_cents,
          shipping_cents,total_cents,refunded_cents,internal_notes,created_at,updated_at,
          return_status,return_updated_at
         FROM mm_commerce_order_financials WHERE order_id=$1`,
        [orderId],
      )).rows[0] || null;
    } catch {}
    const [presented] = await presentAdminOrders([order]);
    return NextResponse.json({ order: presented, finance }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Détail de commande indisponible." }, { status: 503, headers: noStore });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(req);
  if (originDenied) {
    originDenied.headers.set("Cache-Control", "no-store");
    return originDenied;
  }
  try {
    const { orderId } = await context.params;
    const body = await readJson(req, orderPatchSchema);
    if (!/^MM-[0-9]{4}-[A-Z0-9]{8}$/.test(orderId)) throw new InputError();
    await adminAudit("ORDER_UPDATE_REQUESTED", orderId);

    const nextStatus = body.status;
    const nextReturnStatus = body.returnStatus;
    const nextTracking = isNonEmptyString(body.trackingNumber)
      ? body.trackingNumber.trim()
      : "";

    if (nextStatus && !STATUS_VALUES.includes(nextStatus)) {
      return NextResponse.json({ error: "Statut invalide ou non modifiable manuellement." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const orders = await readOrders();
    const existing = orders.find((order) => order.orderId === orderId);
    if (!existing) {
      return NextResponse.json(
        { error: "Commande introuvable" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const patch: Record<string, unknown> = {};
    if (nextStatus) patch.status = nextStatus;
    if (nextTracking) {
      patch.trackingNumber = nextTracking;
      patch.trackingUrl = getTrackingLink(
        existing.shipping.carrier,
        existing.shipping.trackingBaseUrl,
      );
    }

    const durable = Boolean(
      process.env.NEWSLETTER_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.NODE_ENV === "production",
    );
    let previousShipmentStatus = "";
    let updatedReturnStatus = "none";
    let updated: OrderRecord | null;
    if (durable) {
      const committed = await transaction(async (db) => {
        const row = (await db.query(
          "SELECT record FROM mm_orders WHERE order_id=$1 FOR UPDATE",
          [orderId],
        )).rows[0];
        if (!row) return null;
        const before = row.record as OrderRecord;
        const finance = (await db.query(
          "SELECT shipment_status,payment_status,return_status FROM mm_commerce_order_financials WHERE order_id=$1 FOR UPDATE",
          [orderId],
        )).rows[0];
        if (nextReturnStatus) {
          if (!finance) throw new Error("RETURN_ORDER_FINANCIALS_MISSING");
          const currentReturnStatus = String(finance.return_status || "none");
          const nextReturnByStatus: Record<string, string[]> = {
            none: ["requested"],
            requested: ["accepted"],
            accepted: ["awaiting_receipt"],
            awaiting_receipt: ["received"],
            received: [],
          };
          if (
            nextReturnStatus !== currentReturnStatus &&
            !nextReturnByStatus[currentReturnStatus]?.includes(nextReturnStatus)
          )
            throw new Error("RETURN_STATUS_TRANSITION_INVALID");
          if (
            !["paid", "partially_refunded"].includes(
              String(finance.payment_status),
            )
          )
            throw new Error("RETURN_PAYMENT_NOT_PAID");
          if (nextReturnStatus !== currentReturnStatus)
            await db.query(
              `UPDATE mm_commerce_order_financials
               SET return_status=$2,return_updated_at=now(),updated_at=now()
               WHERE order_id=$1`,
              [orderId, nextReturnStatus],
            );
          updatedReturnStatus = nextReturnStatus;
        } else {
          updatedReturnStatus = String(finance?.return_status || "none");
        }
        const statusShipmentMap: Record<string, string> = {
          "En preparation": "preparing",
          "Prete a expedier": "ready",
          "Deposee chez Mondial Relay": "shipped",
          "En transit": "shipped",
          "Disponible en Point Relais": "shipped",
          Expediee: "shipped",
          Livree: "delivered",
          Retournee: "returned",
          Annulee: "cancelled",
        };
        previousShipmentStatus = String(finance?.shipment_status || statusShipmentMap[before.status] || "unfulfilled");
        if (nextStatus === "Annulee" && ["shipped", "delivered", "returned"].includes(previousShipmentStatus))
          throw new Error("SHIPPED_ORDER_CANCELLATION_BLOCKED");
        const next = { ...before, ...patch } as OrderRecord;
        await db.query("UPDATE mm_orders SET record=$2,updated_at=now() WHERE order_id=$1", [orderId, JSON.stringify(next)]);
        const shipmentStatus = ({
          "En preparation": "preparing",
          "Prete a expedier": "ready",
          "Deposee chez Mondial Relay": "shipped",
          "En transit": "shipped",
          "Disponible en Point Relais": "shipped",
          Expediee: "shipped",
          Livree: "delivered",
          Retournee: "returned",
          Annulee: "cancelled",
        } as Record<string, string>)[String(nextStatus)];
        if (shipmentStatus) {
          await db.query(
            "UPDATE mm_commerce_order_financials SET shipment_status=$2,updated_at=now() WHERE order_id=$1",
            [orderId, shipmentStatus],
          );
        }
        return next;
      });
      updated = committed;
    } else {
      updated = await updateOrder(orderId, patch);
      updatedReturnStatus = nextReturnStatus || "none";
    }
    if (!updated) {
      return NextResponse.json(
        { error: "Mise a jour impossible" },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    logAdminOrderEvent("commande mise à jour", {
      orderId,
      status: nextStatus || updated.status,
      trackingNumber: nextTracking || updated.trackingNumber || "",
    });

    const trackingAvailable = Boolean(
      updated.trackingNumber ||
        updated.shipping.mondialRelayShipment?.shipmentNumber,
    );
    const shipmentStatuses = [
      "Deposee chez Mondial Relay",
      "En transit",
      "Expediee",
    ];
    const shipmentJustMarked =
      shipmentStatuses.includes(nextStatus || "") &&
      !shipmentStatuses.includes(existing.status);
    const trackingAddedAfterShipment =
      existing.status === "Expediee" &&
      Boolean(nextTracking) &&
      !existing.trackingNumber;
    if (
      durable &&
      trackingAvailable &&
      (shipmentJustMarked || trackingAddedAfterShipment)
    ) {
      await sendCommerceOrderNotification(
        updated,
        "shipment_confirmation",
        "shipped",
      );
    }

    if (durable && nextStatus && existing.status !== nextStatus) {
      if (nextStatus === "Annulee") {
        await sendCommerceOrderNotification(updated, "cancellation", "cancelled");
      }
    }

    const shipment = updated.shipping.mondialRelayShipment;
    let safeOrder = updated;
    if (shipment) {
      const safeShipment = { ...shipment };
      delete safeShipment.labelUrl;
      safeShipment.labelAvailable = shipment.labelAvailable === true;
      safeOrder = {
        ...updated,
        shipping: {
          ...updated.shipping,
          mondialRelayShipment: safeShipment,
        },
      };
    }
    return NextResponse.json(
      { success: true, order: safeOrder, returnStatus: updatedReturnStatus },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json(
      { error: "Requête invalide." },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
    if (error instanceof Error && error.message === "SHIPPED_ORDER_CANCELLATION_BLOCKED")
      return NextResponse.json({ error: "Une commande expédiée ou livrée ne peut pas être annulée ici." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    if (error instanceof Error && error.message === "RETURN_STATUS_TRANSITION_INVALID")
      return NextResponse.json({ error: "Le statut de retour ne peut pas suivre cette transition." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    if (error instanceof Error && error.message === "RETURN_PAYMENT_NOT_PAID")
      return NextResponse.json({ error: "Un retour ne peut être suivi que sur une commande payée." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    if (error instanceof Error && error.message === "RETURN_ORDER_FINANCIALS_MISSING")
      return NextResponse.json({ error: "Le dossier financier de cette commande est introuvable." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(
      { error: "Echec de mise a jour" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
