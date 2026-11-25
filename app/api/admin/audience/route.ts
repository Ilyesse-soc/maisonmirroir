import { NextRequest, NextResponse } from "next/server";
import { adminDenied } from "@/lib/adminAuth";
import { audienceIpRateLimit } from "@/lib/audience";
import { database } from "@/lib/newsletterDb";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    if (!(await audienceIpRateLimit(request, "dashboard", 600)))
      return NextResponse.json(
        { error: "Trop de consultations. Réessayez dans quelques minutes." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    const db = database();
    const [today, active, products, hourly, history, paid] = await Promise.all([
      db.query(
        `WITH bounds AS (
           SELECT (date_trunc('day',now() AT TIME ZONE 'Europe/Paris')
             AT TIME ZONE 'Europe/Paris') AS start_at,
             ((date_trunc('day',now() AT TIME ZONE 'Europe/Paris')+interval '1 day')
             AT TIME ZONE 'Europe/Paris') AS end_at
         )
         SELECT count(DISTINCT e.visitor_id)::int AS visitors,
           count(DISTINCT e.session_id) FILTER (WHERE e.event_type='visit')::int AS visits,
           count(*) FILTER (WHERE e.event_type='page_view')::int AS page_views
         FROM mm_audience_events e CROSS JOIN bounds b
         WHERE e.occurred_at>=b.start_at AND e.occurred_at<b.end_at`,
      ),
      db.query(
        `SELECT count(DISTINCT visitor_id)::int AS visitors,
           count(DISTINCT visitor_id) FILTER (WHERE funnel_stage='cart')::int AS cart,
           count(DISTINCT visitor_id) FILTER (WHERE funnel_stage='checkout')::int AS checkout
         FROM mm_audience_sessions
         WHERE last_heartbeat>=now()-interval '90 seconds'`,
      ),
      db.query(
        `WITH bounds AS (
           SELECT (date_trunc('day',now() AT TIME ZONE 'Europe/Paris')
             AT TIME ZONE 'Europe/Paris') AS start_at,
             ((date_trunc('day',now() AT TIME ZONE 'Europe/Paris')+interval '1 day')
             AT TIME ZONE 'Europe/Paris') AS end_at
         )
         SELECT path,count(DISTINCT visitor_id)::int AS visitors
         FROM mm_audience_events e CROSS JOIN bounds b
         WHERE e.event_type='page_view'
           AND e.path IN ('/product/modest-era','/product/paradise-way')
           AND e.occurred_at>=b.start_at AND e.occurred_at<b.end_at
         GROUP BY path`,
      ),
      db.query(
        `WITH bounds AS (
           SELECT (date_trunc('day',now() AT TIME ZONE 'Europe/Paris')
             AT TIME ZONE 'Europe/Paris') AS start_at,
             ((date_trunc('day',now() AT TIME ZONE 'Europe/Paris')+interval '1 day')
             AT TIME ZONE 'Europe/Paris') AS end_at
         ), hours AS (
           SELECT generate_series(0,23)::int AS hour
         ), traffic AS (
           SELECT extract(hour FROM e.occurred_at AT TIME ZONE 'Europe/Paris')::int AS hour,
             count(DISTINCT e.visitor_id)::int AS visitors
           FROM mm_audience_events e CROSS JOIN bounds b
           WHERE e.event_type='page_view'
             AND e.occurred_at>=b.start_at AND e.occurred_at<b.end_at
           GROUP BY hour
         )
         SELECT h.hour,COALESCE(t.visitors,0)::int AS visitors
         FROM hours h LEFT JOIN traffic t USING(hour) ORDER BY h.hour`,
      ),
      db.query(
        `WITH bounds AS (
           SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS today
         ), days AS (
           SELECT generate_series((today-29)::timestamp,today::timestamp,interval '1 day')::date AS day
           FROM bounds
         ), traffic AS (
           SELECT (occurred_at AT TIME ZONE 'Europe/Paris')::date AS day,
             count(DISTINCT visitor_id)::int AS visitors,
             count(*) FILTER (WHERE event_type='page_view')::int AS page_views
           FROM mm_audience_events
           WHERE occurred_at >= (
             SELECT ((today-29)::timestamp AT TIME ZONE 'Europe/Paris') FROM bounds
           )
           GROUP BY day
         )
         SELECT to_char(d.day,'YYYY-MM-DD') AS day,
           COALESCE(t.visitors,0)::int AS visitors,
           COALESCE(t.page_views,0)::int AS page_views
         FROM days d LEFT JOIN traffic t USING(day) ORDER BY d.day`,
      ),
      db.query(
        `WITH bounds AS (
           SELECT (date_trunc('day',now() AT TIME ZONE 'Europe/Paris')
             AT TIME ZONE 'Europe/Paris') AS start_at,
             ((date_trunc('day',now() AT TIME ZONE 'Europe/Paris')+interval '1 day')
             AT TIME ZONE 'Europe/Paris') AS end_at
         )
         SELECT count(*)::int AS paid_orders
         FROM mm_commerce_order_financials f CROSS JOIN bounds b
         WHERE f.payment_status IN ('paid','refunded','partially_refunded')
           AND f.paid_at>=b.start_at AND f.paid_at<b.end_at`,
      ),
    ]);

    const visitorsToday = Number(today.rows[0]?.visitors || 0);
    const paidOrdersToday = Number(paid.rows[0]?.paid_orders || 0);
    return NextResponse.json(
      {
        active: {
          visitors: Number(active.rows[0]?.visitors || 0),
          cart: Number(active.rows[0]?.cart || 0),
          checkout: Number(active.rows[0]?.checkout || 0),
        },
        today: {
          visitors: visitorsToday,
          visits: Number(today.rows[0]?.visits || 0),
          pageViews: Number(today.rows[0]?.page_views || 0),
          paidOrders: paidOrdersToday,
          conversionRate:
            visitorsToday > 0 ? (paidOrdersToday / visitorsToday) * 100 : 0,
          products: {
            "modest-era": Number(
              products.rows.find((row) => row.path === "/product/modest-era")
                ?.visitors || 0,
            ),
            "paradise-way": Number(
              products.rows.find((row) => row.path === "/product/paradise-way")
                ?.visitors || 0,
            ),
          },
        },
        hourly: hourly.rows.map((row) => ({
          hour: Number(row.hour),
          visitors: Number(row.visitors),
        })),
        history: history.rows.map((row) => ({
          day: String(row.day),
          visitors: Number(row.visitors),
          pageViews: Number(row.page_views),
        })),
        refreshedAt: new Date().toISOString(),
        activeWindowSeconds: 90,
        heartbeatSeconds: 30,
        refreshSeconds: 10,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    securityEvent("ADMIN_AUDIENCE_READ_FAILED");
    return NextResponse.json(
      { error: "Les statistiques d’audience sont momentanément indisponibles." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
