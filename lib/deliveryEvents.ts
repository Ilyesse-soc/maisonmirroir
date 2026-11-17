import "server-only";
import { transaction } from "./newsletterDb";
export const deliveryStatuses: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "bounced",
};
export async function reconcileDelivery(providerId: string) {
  await transaction(async (db) => {
    let job = (
      await db.query("SELECT * FROM mm_jobs WHERE provider_id=$1 FOR UPDATE", [
        providerId,
      ])
    ).rows[0];
    let cart = false;
    if (!job) {
      job = (
        await db.query(
          "SELECT * FROM mm_cart_reminders WHERE provider_id=$1 FOR UPDATE",
          [providerId],
        )
      ).rows[0];
      cart = true;
    }
    if (!job) return;
    const events = (
      await db.query(
        "SELECT event_type FROM mm_webhook_receipts WHERE provider_id=$1",
        [providerId],
      )
    ).rows;
    const rank: Record<string, number> = {
      accepted: 0,
      sent: 1,
      delivered: 2,
      failed: 3,
      bounced: 4,
      complained: 5,
    };
    let status = job.status;
    for (const event of events) {
      const next = deliveryStatuses[event.event_type];
      if (next && (rank[next] ?? 0) >= (rank[status] ?? 0)) status = next;
    }
    await db.query(
      "UPDATE " +
        (cart ? "mm_cart_reminders" : "mm_jobs") +
        " SET status=$2,updated_at=now() WHERE id=$1",
      [job.id, status],
    );
    if (cart && (status === "bounced" || status === "complained")) {
      await db.query("UPDATE mm_carts SET consent=false WHERE id=$1", [
        job.cart_id,
      ]);
      return;
    }
    if (!cart && (status === "bounced" || status === "complained")) {
      await db.query(
        `UPDATE mm_subscribers SET status='suppressed',unsubscribed_at=now() WHERE id=$1`,
        [job.subscriber_id],
      );
      await db.query(
        `UPDATE mm_jobs SET status='cancelled',payload='{}' WHERE subscriber_id=$1 AND status IN ('pending','retry')`,
        [job.subscriber_id],
      );
    }
  });
}
