import { NextResponse } from "next/server";
import { adminDenied } from "@/lib/adminAuth";
import { database } from "@/lib/newsletterDb";
import { emailReady } from "@/lib/newsletter";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const db = database();
    const [subscribers, signups, campaigns, activity, worker, resend, commerce] =
      await Promise.all([
        db.query(
          `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status='active')::int AS confirmed,
            count(*) FILTER (WHERE status='pending')::int AS pending,
            count(*) FILTER (WHERE status='unsubscribed')::int AS unsubscribed,
            count(*) FILTER (WHERE status='suppressed')::int AS suppressed,
            count(*) FILTER (WHERE created_at>=(date_trunc('day',now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris'))::int AS today,
            count(*) FILTER (WHERE created_at>=(date_trunc('week',now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris'))::int AS this_week,
            count(*) FILTER (WHERE created_at>=(date_trunc('month',now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris'))::int AS this_month
           FROM mm_subscribers`,
        ),
        db.query(
          `SELECT to_char(days.day,'YYYY-MM-DD') AS day,
            count(s.id)::int AS count
           FROM generate_series(
             ((now() AT TIME ZONE 'Europe/Paris')::date-29)::timestamp,
             (now() AT TIME ZONE 'Europe/Paris')::date::timestamp,
             interval '1 day'
           ) days(day)
           LEFT JOIN mm_subscribers s ON s.created_at>=(days.day AT TIME ZONE 'Europe/Paris')
             AND s.created_at<((days.day+interval '1 day') AT TIME ZONE 'Europe/Paris')
           GROUP BY days.day ORDER BY days.day`,
        ),
        db.query(
          `SELECT count(*) FILTER (WHERE status='draft')::int AS drafts,
            count(*) FILTER (WHERE status='scheduled')::int AS scheduled,
            count(*) FILTER (WHERE status='sending')::int AS sending,
            count(*) FILTER (WHERE status='completed')::int AS completed,
            (SELECT count(*)::int FROM mm_jobs WHERE status='delivered') AS delivered,
            (SELECT count(*)::int FROM mm_jobs WHERE status IN ('failed','bounced','complained','review')) AS failed
           FROM mm_campaigns`,
        ),
        db.query(
          `SELECT action,created_at FROM (
            SELECT action,created_at FROM mm_admin_audit
            UNION ALL
            SELECT 'SUBSCRIBER_'||event AS action,created_at FROM mm_consent_events
          ) activity ORDER BY created_at DESC LIMIT 8`,
        ),
        db.query(
          `SELECT status,started_at,finished_at,processed FROM mm_worker_runs
           ORDER BY started_at DESC LIMIT 1`,
        ),
        db.query(
          `SELECT max(occurred_at) AS last_event FROM mm_webhook_receipts`,
        ),
        db.query(
          `WITH paid AS (
             SELECT o.order_id,
               COALESCE(f.subtotal_cents,round((o.record->>'subtotal')::numeric*100)::bigint,0) AS subtotal_cents,
               COALESCE(f.shipping_cents,round((o.record->'shipping'->>'price')::numeric*100)::bigint,0) AS shipping_cents,
               COALESCE(f.discount_cents,
                 greatest(0,round(((o.record->>'subtotal')::numeric
                   +(o.record->'shipping'->>'price')::numeric
                   -(o.record->>'total')::numeric)*100)::bigint),0) AS discount_cents,
               COALESCE(f.refunded_cents,0) AS refunded_cents
             FROM mm_orders o LEFT JOIN mm_commerce_order_financials f ON f.order_id=o.order_id
             WHERE f.payment_status IN ('paid','refunded','partially_refunded')
               OR (f.order_id IS NULL AND o.record->>'status'='Payee')
           ), stock AS (
             SELECT count(*)::int AS products,
               COALESCE(sum(quantity_on_hand-reserved_quantity),0)::int AS available
             FROM mm_commerce_products WHERE active=true
           )
           SELECT (SELECT count(*)::int FROM paid) AS "paidOrders",
             COALESCE((SELECT sum(subtotal_cents) FROM paid),0)::bigint AS "productSalesCents",
             COALESCE((SELECT sum(shipping_cents) FROM paid),0)::bigint AS "shippingCents",
             COALESCE((SELECT sum(discount_cents) FROM paid),0)::bigint AS "discountsCents",
             COALESCE((SELECT sum(refunded_cents) FROM paid),0)::bigint AS "refundsCents",
             stock.products AS "inventoryProducts",stock.available AS "unitsAvailable"
           FROM stock`,
        ),
      ]);
    return NextResponse.json(
      {
        subscribers: subscribers.rows[0],
        signups: signups.rows,
        campaigns: campaigns.rows[0],
        activity: activity.rows,
        service: {
          newsletterSendEnabled:
            process.env.NEWSLETTER_SEND_ENABLED !== "false",
          emailReady: emailReady(),
          shopOpen: process.env.SHOP_OPEN === "true",
          autoPublish: process.env.NEWSLETTER_AUTO_PUBLISH === "true",
          worker: worker.rows[0] || null,
          lastResendEventAt: resend.rows[0]?.last_event || null,
        },
        paypalLive: {
          environmentConfigured: Boolean(process.env.PAYPAL_ENV?.trim()),
          productionEnvironment: process.env.PAYPAL_ENV === "production",
          clientIdConfigured: Boolean(process.env.PAYPAL_CLIENT_ID?.trim()),
          clientSecretConfigured: Boolean(process.env.PAYPAL_CLIENT_SECRET?.trim()),
          merchantIdConfigured: Boolean(process.env.PAYPAL_MERCHANT_ID?.trim()),
          webhookIdConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID?.trim()),
          paymentsEnabled: process.env.REAL_PAYMENTS_ENABLED === "true",
          shopOpen: process.env.SHOP_OPEN === "true",
        },
        metricsAvailability: {
          opens: false,
          clicks: false,
        },
        commerce: commerce.rows[0],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    securityEvent("ADMIN_DASHBOARD_READ_FAILED");
    return NextResponse.json(
      { error: "Tableau de bord momentanément indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
