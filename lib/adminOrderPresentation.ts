import "server-only";
import { products } from "@/lib/products";
import { database } from "@/lib/newsletterDb";
import type { OrderRecord, ProductInfo } from "@/lib/orderTypes";

type AdminCatalogItem = ProductInfo & {
  catalogName: string;
  catalogImage: string | null;
  catalogColor: string | null;
};
type NewsletterConsent = {
  status: string;
  consentAt: string | null;
  confirmedAt: string | null;
  consentVersion: string | null;
  lastEvent: string | null;
  lastEventAt: string | null;
};

export async function presentAdminOrders<T extends Pick<OrderRecord, "items" | "customer">>(
  orders: T[],
): Promise<Array<T & { items: AdminCatalogItem[]; newsletterConsent: NewsletterConsent | null }>> {
  const productIds = [...new Set(orders.flatMap((order) => order.items.map((item) => item.id)))];
  const emails = [...new Set(orders.map((order) => order.customer.email.trim().toLowerCase()).filter(Boolean))];
  const [colorRows, consentRows] = await Promise.all([
    productIds.length
      ? Promise.resolve().then(() => database().query(
        "SELECT product_id,color FROM mm_commerce_products WHERE product_id=ANY($1::text[])",
        [productIds],
      )).catch(() => ({ rows: [] as Array<{ product_id: string; color: string }> }))
      : Promise.resolve({ rows: [] as Array<{ product_id: string; color: string }> }),
    emails.length
      ? Promise.resolve().then(() => database().query(
        `SELECT lower(s.email) AS email,s.status,s.consent_at,s.confirmed_at,s.consent_version,
          ce.event AS last_event,ce.created_at AS last_event_at
         FROM mm_subscribers s
         LEFT JOIN LATERAL (
           SELECT event,created_at FROM mm_consent_events
           WHERE subscriber_id=s.id ORDER BY created_at DESC LIMIT 1
         ) ce ON true
         WHERE lower(s.email)=ANY($1::text[])`,
        [emails],
      )).catch(() => ({ rows: [] as Array<Record<string, unknown>> }))
      : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
  ]);
  const colors = new Map(colorRows.rows.map((row) => [row.product_id, row.color]));
  const consents = new Map<string, NewsletterConsent>();
  for (const row of consentRows.rows) {
    consents.set(String(row.email), {
      status: String(row.status),
      consentAt: row.consent_at ? new Date(row.consent_at as string).toISOString() : null,
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at as string).toISOString() : null,
      consentVersion: row.consent_version ? String(row.consent_version) : null,
      lastEvent: row.last_event ? String(row.last_event) : null,
      lastEventAt: row.last_event_at ? new Date(row.last_event_at as string).toISOString() : null,
    });
  }
  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => {
      const catalog = products.find((entry) => entry.id === item.id);
      return {
        ...item,
        catalogName: catalog?.name || item.name,
        catalogImage: catalog?.images?.[0] || null,
        catalogColor: colors.get(item.id) || null,
      };
    }),
    newsletterConsent: consents.get(order.customer.email.trim().toLowerCase()) || null,
  }));
}
