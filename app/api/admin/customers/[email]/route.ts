import { NextRequest, NextResponse } from "next/server";
import { adminDenied } from "@/lib/adminAuth";
import { database } from "@/lib/newsletterDb";
import { presentAdminOrders } from "@/lib/adminOrderPresentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ email: string }> }) {
  const denied = await adminDenied();
  if (denied) return denied;
  const noStore = { "Cache-Control": "no-store" };
  try {
    const email = (await context.params).email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "Adresse client invalide." }, { status: 400, headers: noStore });
    const result = await database().query(
      `SELECT o.order_id,o.record,
        COALESCE(f.payment_status,'paid') AS payment_status,
        COALESCE(f.shipment_status,'unknown') AS shipment_status,
        COALESCE(f.subtotal_cents,round((o.record->>'subtotal')::numeric*100)::int,0) AS subtotal_cents,
        COALESCE(f.discount_cents,
          greatest(0,round(((o.record->>'subtotal')::numeric
            +(o.record->'shipping'->>'price')::numeric
            -(o.record->>'total')::numeric)*100)::int),0) AS discount_cents,
        COALESCE(f.shipping_cents,round((o.record->'shipping'->>'price')::numeric*100)::int,0) AS shipping_cents,
        COALESCE(f.total_cents,round((o.record->>'total')::numeric*100)::int,0) AS total_cents,
        COALESCE(f.refunded_cents,0) AS refunded_cents,
        COALESCE(f.created_at,(o.record->>'orderDate')::timestamptz) AS created_at
       FROM mm_orders o LEFT JOIN mm_commerce_order_financials f ON f.order_id=o.order_id
       WHERE lower(o.record->'customer'->>'email')=$1
         AND (f.payment_status IN ('paid','refunded','partially_refunded')
           OR (f.order_id IS NULL AND o.record->>'status'='Payee'))
       ORDER BY created_at DESC`,
      [email],
    );
    if (!result.rows.length) return NextResponse.json({ error: "Client introuvable." }, { status: 404, headers: noStore });
    const customer = result.rows[0].record.customer;
    const rawOrders = result.rows.map((row) => ({
      orderId: row.order_id, orderDate: row.created_at, paymentStatus: row.payment_status,
      shipmentStatus: row.shipment_status, subtotalCents: row.subtotal_cents,
      discountCents: row.discount_cents, shippingCents: row.shipping_cents,
      totalCents: row.total_cents, refundedCents: row.refunded_cents,
      items: row.record.items || [], customer: row.record.customer,
      shipping: row.record.shipping,
    }));
    const presented = await presentAdminOrders(rawOrders);
    return NextResponse.json({
      customer,
      newsletterConsent: presented[0]?.newsletterConsent || null,
      orders: presented.map((order) => {
        const clean: Partial<typeof order> = { ...order };
        delete clean.customer;
        delete clean.newsletterConsent;
        return clean;
      }),
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Données client momentanément indisponibles." }, { status: 503, headers: noStore });
  }
}
