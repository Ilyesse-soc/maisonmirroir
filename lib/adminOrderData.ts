import "server-only";
import { database } from "@/lib/newsletterDb";
import { readOrders } from "@/lib/orderStore";
import type { OrderRecord } from "@/lib/orderTypes";

export type AdminOrder = OrderRecord & {
  paymentStatus: string;
  shipmentStatus: string;
  refundedCents: number;
  discountCents: number;
  totalCents: number;
  refundEligible: boolean;
  refundAttempt: null | { idempotencyKey: string; amountCents: number; status: string };
  refundHistory: Array<{ refundId: string; amountCents: number; status: string; reason: string; createdAt: string; completedAt: string | null }>;
};

const shipmentFor = (status: string) => ({
  "En attente": "unfulfilled",
  Payee: "unfulfilled",
  "En preparation": "preparing",
  Expediee: "shipped",
  Livree: "delivered",
  Annulee: "cancelled",
}[status] || "unknown");

export async function listAdminOrders(search: string, payment: string, shipment: string) {
  const records = await readOrders();
  const finances = new Map<string, Record<string, unknown>>();
  if (records.length) {
    try {
      const result = await database().query(
        `SELECT f.order_id,f.payment_status,f.shipment_status,f.refunded_cents,
          f.discount_cents,f.total_cents,
          (f.payment_status IN ('paid','partially_refunded')
            AND f.paypal_capture_id IS NOT NULL
            AND f.refunded_cents<f.total_cents
            AND active_refund.idempotency_key IS NULL) AS refund_eligible,
          active_refund.idempotency_key,active_refund.amount_cents AS active_refund_cents,
          active_refund.status AS active_refund_status,refund_history.entries AS refund_history
         FROM mm_commerce_order_financials f
         LEFT JOIN LATERAL (
           SELECT idempotency_key,amount_cents,status
           FROM mm_commerce_refunds
           WHERE order_id=f.order_id AND status IN ('pending','unknown')
           ORDER BY created_at DESC LIMIT 1
         ) active_refund ON true
         LEFT JOIN LATERAL (
           SELECT jsonb_agg(jsonb_build_object(
             'refundId',refund_id,'amountCents',amount_cents,'status',status,
             'reason',reason,'createdAt',created_at,'completedAt',completed_at
           ) ORDER BY created_at DESC) AS entries
           FROM mm_commerce_refunds WHERE order_id=f.order_id
         ) refund_history ON true
         WHERE f.order_id=ANY($1::text[])`,
        [records.map((order) => order.orderId)],
      );
      for (const row of result.rows) finances.set(row.order_id, row);
    } catch {
      // Older local databases can still display their legacy order records.
    }
  }
  const term = search.trim().toLowerCase();
  return records.map((order): AdminOrder => {
    const finance = finances.get(order.orderId);
    return {
      ...order,
      paymentStatus: String(finance?.payment_status || (order.status === "Payee" ? "paid" : "pending")),
      shipmentStatus: String(finance?.shipment_status || shipmentFor(order.status)),
      refundedCents: Number(finance?.refunded_cents || 0),
      discountCents: Number(finance?.discount_cents || 0),
      totalCents: Number(finance?.total_cents || Math.round(order.total * 100)),
      refundEligible: finance?.refund_eligible === true,
      refundAttempt: finance?.idempotency_key ? {
        idempotencyKey: String(finance.idempotency_key),
        amountCents: Number(finance.active_refund_cents),
        status: String(finance.active_refund_status),
      } : null,
      refundHistory: (finance?.refund_history as AdminOrder["refundHistory"] | undefined) || [],
    };
  }).filter((order) => {
    const matchesText = !term || [
      order.orderId, order.customer.email, order.customer.firstName,
      order.customer.lastName, order.customer.phone,
    ].some((value) => String(value || "").toLowerCase().includes(term));
    return matchesText &&
      (!payment || order.paymentStatus === payment) &&
      (!shipment || order.shipmentStatus === shipment);
  }).slice(0, 5000);
}
