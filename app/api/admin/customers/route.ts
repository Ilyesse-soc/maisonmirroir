import { NextRequest, NextResponse } from "next/server";
import { adminDenied } from "@/lib/adminAuth";
import { database } from "@/lib/newsletterDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

const paidOrdersCte = `
  WITH paid_orders AS (
    SELECT o.order_id,o.record,f.payment_status,
      COALESCE(f.subtotal_cents,round((o.record->>'subtotal')::numeric*100)::int,0) AS subtotal_cents,
      COALESCE(f.discount_cents,
        greatest(0,round(((o.record->>'subtotal')::numeric
          +(o.record->'shipping'->>'price')::numeric
          -(o.record->>'total')::numeric)*100)::int),0) AS discount_cents,
      COALESCE(f.shipping_cents,round((o.record->'shipping'->>'price')::numeric*100)::int,0) AS shipping_cents,
      COALESCE(f.total_cents,round((o.record->>'total')::numeric*100)::int,0) AS total_cents,
      COALESCE(f.refunded_cents,0) AS refunded_cents,
      COALESCE(f.created_at,(o.record->>'orderDate')::timestamptz) AS ordered_at
    FROM mm_orders o LEFT JOIN mm_commerce_order_financials f ON f.order_id=o.order_id
    WHERE f.payment_status IN ('paid','refunded','partially_refunded')
      OR (f.order_id IS NULL AND o.record->>'status'='Payee')
  )
`;

export async function GET(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1));
  const limitInput = Number(params.get("limit")) || 25;
  const limit = [10, 25, 50, 100].includes(limitInput) ? limitInput : 25;
  const search = (params.get("search") || "").trim().slice(0, 120);
  try {
    const db = database();
    const values: unknown[] = [];
    let where = "";
    if (search) {
      values.push(`%${search}%`);
      where = `WHERE lower(email) LIKE lower($1)
        OR lower(first_name||' '||last_name) LIKE lower($1)
        OR phone LIKE $1`;
    }
    const query = `${paidOrdersCte},
      per_customer AS (
        SELECT lower(record->'customer'->>'email') AS email,
          max(record->'customer'->>'firstName') AS first_name,
          max(record->'customer'->>'lastName') AS last_name,
          max(record->'customer'->>'phone') AS phone,
          count(*)::int AS paid_orders,
          sum(subtotal_cents)::bigint AS product_sales_cents,
          sum(shipping_cents)::bigint AS shipping_cents,
          sum(discount_cents)::bigint AS discount_cents,
          sum(refunded_cents)::bigint AS refunded_cents,
          sum(total_cents-refunded_cents)::bigint AS net_paid_cents,
          max(ordered_at) AS last_order_at
        FROM paid_orders
        WHERE NULLIF(record->'customer'->>'email','') IS NOT NULL
        GROUP BY lower(record->'customer'->>'email')
      )
      SELECT * FROM per_customer ${where}
      ORDER BY last_order_at DESC NULLS LAST,email
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const count = await db.query(
      `${paidOrdersCte}, per_customer AS (
        SELECT lower(record->'customer'->>'email') AS email,
          max(record->'customer'->>'firstName') AS first_name,
          max(record->'customer'->>'lastName') AS last_name,
          max(record->'customer'->>'phone') AS phone
        FROM paid_orders WHERE NULLIF(record->'customer'->>'email','') IS NOT NULL
        GROUP BY lower(record->'customer'->>'email')
      ) SELECT count(*)::int AS total FROM per_customer ${where}`,
      values,
    );
    const customers = await db.query(query, [...values, limit, (page - 1) * limit]);
    return NextResponse.json({ customers: customers.rows, total: count.rows[0].total, page, limit }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Données clients momentanément indisponibles." }, { status: 503, headers: noStore });
  }
}
