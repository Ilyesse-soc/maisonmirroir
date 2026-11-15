import "server-only";
import { createHash, randomBytes, randomUUID } from "crypto";
import { database, transaction } from "./newsletterDb";
import { getResendClient, getEmailFrom } from "./email";
import { reconcileDelivery } from "./deliveryEvents";
import { escapeHtml, siteUrl } from "./newsletter";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export async function upsertCart(
  token: string | undefined,
  items: unknown[],
  fingerprint: string,
  email?: string,
  consent?: boolean,
) {
  return transaction(async (db) => {
    const existing = token
      ? (
          await db.query(
            "SELECT * FROM mm_carts WHERE token_hash=$1 FOR UPDATE",
            [hash(token)],
          )
        ).rows[0]
      : null;
    const nextToken = existing ? token! : randomBytes(32).toString("hex");
    const id = existing?.id || randomUUID();
    const address =
      consent === undefined
        ? existing?.email || null
        : consent && email
          ? email
          : null;
    const agreed =
      consent === undefined
        ? existing?.consent || false
        : Boolean(consent && email);
    const changed =
      !existing ||
      existing.fingerprint !== fingerprint ||
      existing.email !== address ||
      existing.consent !== agreed;
    await db.query(
      `INSERT INTO mm_carts(id,token_hash,email,items,fingerprint,consent,consent_at,status,unsubscribe_token,restore_token) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $6 THEN now() ELSE NULL END,$7,$8,$9) ON CONFLICT(token_hash) DO UPDATE SET email=$3,items=$4,fingerprint=$5,consent=$6,consent_at=CASE WHEN $6 AND NOT mm_carts.consent THEN now() ELSE mm_carts.consent_at END,status=$7,updated_at=CASE WHEN $10 THEN now() ELSE mm_carts.updated_at END`,
      [
        id,
        hash(nextToken),
        address,
        JSON.stringify(items),
        fingerprint,
        agreed,
        items.length ? "active" : "expired",
        randomBytes(32).toString("hex"),
        randomBytes(32).toString("hex"),
        changed,
      ],
    );
    if (changed)
      await db.query(
        `UPDATE mm_cart_reminders SET status='cancelled' WHERE cart_id=$1 AND status IN ('pending','retry')`,
        [id],
      );
    return nextToken;
  });
}
export async function markCartOrdered(token: string | undefined) {
  if (!token) return;
  await transaction(async (db) => {
    const row = (
      await db.query(
        `UPDATE mm_carts SET status='ordered' WHERE token_hash=$1 RETURNING id`,
        [hash(token)],
      )
    ).rows[0];
    if (row)
      await db.query(
        `UPDATE mm_cart_reminders SET status='cancelled' WHERE cart_id=$1 AND status IN ('pending','retry')`,
        [row.id],
      );
  });
}
export async function queueCartReminders(id?: string) {
  if (process.env.SHOP_OPEN !== "true") return 0;
  const result = await database().query(
    `INSERT INTO mm_cart_reminders(id,cart_id,dedupe_key) SELECT gen_random_uuid(),id,'cart:'||id||':'||extract(epoch from updated_at)::text FROM mm_carts WHERE status='active' AND consent=true AND email IS NOT NULL AND jsonb_array_length(items)>0 AND updated_at<=now()-interval '48 hours' AND ($1::uuid IS NULL OR id=$1::uuid) ON CONFLICT(dedupe_key) DO NOTHING RETURNING id`,
    [id || null],
  );
  return result.rowCount || 0;
}
export async function processCartReminders(deadline = Date.now() + 30000) {
  if (process.env.SHOP_OPEN !== "true") return 0;
  await queueCartReminders();
  let processed = 0;
  for (let i = 0; i < 5 && Date.now() < deadline; i++) {
    await database().query(
      `UPDATE mm_cart_reminders SET status='review',error_code='IDEMPOTENCY_WINDOW_EXPIRED' WHERE status IN ('retry','processing') AND first_attempt_at<now()-interval '23 hours'`,
    );
    const job = await transaction(
      async (db) =>
        (
          await db.query(
            `UPDATE mm_cart_reminders SET status='processing',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,now()),updated_at=now() WHERE id=(SELECT id FROM mm_cart_reminders WHERE ((status IN ('pending','retry') AND next_attempt<=now()) OR (status='processing' AND updated_at<now()-interval '5 minutes')) ORDER BY next_attempt FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
          )
        ).rows[0],
    );
    if (!job) break;
    const cart = (
      await database().query("SELECT * FROM mm_carts WHERE id=$1", [
        job.cart_id,
      ])
    ).rows[0];
    if (
      !cart ||
      !cart.consent ||
      !cart.email ||
      cart.status !== "active" ||
      new Date(cart.updated_at).getTime() > Date.now() - 48 * 3600000
    ) {
      await database().query(
        `UPDATE mm_cart_reminders SET status='cancelled' WHERE id=$1`,
        [job.id],
      );
      continue;
    }
    const purchased = (
      await database().query(
        `SELECT 1 FROM mm_orders WHERE record->'customer'->>'email'=$1 AND (record->>'orderDate')::timestamptz>=$2 LIMIT 1`,
        [cart.email, cart.updated_at],
      )
    ).rowCount;
    if (purchased) {
      await database().query(
        `UPDATE mm_cart_reminders SET status='cancelled' WHERE id=$1`,
        [job.id],
      );
      continue;
    }
    const url = siteUrl() + "/panier#reprise=" + cart.restore_token;
    const unsubscribe =
      siteUrl() + "/newsletter/panier#token=" + cart.unsubscribe_token;
    const html = `<div style="background:#f3ece1;color:#4f3012;padding:36px;font-family:Georgia,serif"><p>MAISON MIROIR</p><h1>Vos jolies découvertes vous attendent.</h1><p>Vous aviez choisi quelques pièces de notre univers. Votre panier est toujours là, prêt à vous retrouver.</p><ul>${cart.items.map((item: { name: string; quantity: number }) => "<li>" + escapeHtml(item.name) + " × " + item.quantity + "</li>").join("")}</ul><p><a href="${url}">Retrouver mon panier</a></p><p>Aucune obligation, prenez le temps de choisir ce qui vous ressemble.</p><hr/><p><a href="${unsubscribe}">Ne plus recevoir ces rappels</a> ? <a href="${siteUrl()}/confidentialite">Confidentialit?</a></p></div>`;
    try {
      const result = await getResendClient()!.emails.send(
        {
          from: getEmailFrom(),
          to: cart.email,
          subject: "Vos découvertes Maison Miroir vous attendent",
          html,
          headers: {
            "List-Unsubscribe":
              "<" +
              siteUrl() +
              "/api/cart/unsubscribe?token=" +
              cart.unsubscribe_token +
              ">",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        },
        { idempotencyKey: job.dedupe_key, signal: AbortSignal.timeout(8000) },
      );
      if (result.error || !result.data?.id) throw Error("PROVIDER_FAILED");
      await database().query(
        `UPDATE mm_cart_reminders SET status='accepted',provider_id=$2,error_code=NULL,updated_at=now() WHERE id=$1`,
        [job.id, result.data.id],
      );
      await reconcileDelivery(result.data.id);
    } catch {
      await database().query(
        `UPDATE mm_cart_reminders SET status=$2,error_code='PROVIDER_REQUEST_FAILED',next_attempt=now()+interval '5 minutes',updated_at=now() WHERE id=$1`,
        [job.id, job.attempts >= 4 ? "failed" : "retry"],
      );
    }
    processed++;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return processed;
}
