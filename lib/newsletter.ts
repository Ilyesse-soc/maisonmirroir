import "server-only";
import { processCartReminders } from "./abandonedCarts";
import { reconcileDelivery } from "./deliveryEvents";
import { createHash, randomBytes, randomUUID } from "crypto";
import { database, transaction } from "./newsletterDb";
import { getEmailFrom, getResendClient } from "./email";

export const CONSENT_VERSION = "launch-marketing-v1-2026-11-15";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function siteUrl() {
  const url = new URL(process.env.NEWSLETTER_SITE_URL || "");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("HTTPS required");
  return url.origin;
}
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
export function safeUrl(value: unknown): string {
  if (!value) return "";
  const url = new URL(String(value));
  if (
    url.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")
  )
    throw new Error("URL HTTPS requise");
  return url.href;
}
export function emailReady() {
  return Boolean(
    process.env.NEWSLETTER_SEND_ENABLED !== "false" &&
    (process.env.NEWSLETTER_DATABASE_URL || process.env.DATABASE_URL) &&
    getResendClient() &&
    getEmailFrom() &&
    process.env.NEWSLETTER_SITE_URL &&
    process.env.NEWSLETTER_HASH_SECRET &&
    process.env.NEWSLETTER_WORKER_SECRET,
  );
}
export async function subscribe(email: string, ip: string) {
  if (!emailReady()) throw new Error("Newsletter unavailable");
  const base = siteUrl();
  const ipHash = hash(`${process.env.NEWSLETTER_HASH_SECRET}:${ip}`);
  await transaction(async (db) => {
    const limit = await db.query(
      `INSERT INTO mm_rate_limits(key,count,expires_at) VALUES($1,1,now()+interval '1 hour') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN mm_rate_limits.expires_at<now() THEN 1 ELSE mm_rate_limits.count+1 END, expires_at=CASE WHEN mm_rate_limits.expires_at<now() THEN now()+interval '1 hour' ELSE mm_rate_limits.expires_at END RETURNING count`,
      [ipHash],
    );
    if (limit.rows[0].count > 8) throw new Error("RATE_LIMIT");
    // Serialize concurrent requests for the same normalized address, including first signup.
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [email]);
    const existing = (
      await db.query("SELECT * FROM mm_subscribers WHERE email=$1 FOR UPDATE", [
        email,
      ])
    ).rows[0];
    if (existing?.status === "active" || existing?.status === "suppressed")
      return;
    if (
      existing?.last_confirmation_at &&
      Date.now() - new Date(existing.last_confirmation_at).getTime() < 3600000
    )
      return;
    const budget = await db.query(
      `INSERT INTO mm_rate_limits(key,count,expires_at) VALUES('confirmation-daily',1,date_trunc('day',now())+interval '1 day') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN mm_rate_limits.expires_at<now() THEN 1 ELSE mm_rate_limits.count+1 END,expires_at=CASE WHEN mm_rate_limits.expires_at<now() THEN date_trunc('day',now())+interval '1 day' ELSE mm_rate_limits.expires_at END RETURNING count`,
    );
    if (
      budget.rows[0].count >
      Math.min(
        10000,
        Math.max(
          1,
          Number(process.env.NEWSLETTER_DAILY_CONFIRMATION_LIMIT) || 500,
        ),
      )
    )
      throw new Error("RATE_LIMIT");
    const token = randomBytes(32).toString("hex"),
      unsub = randomBytes(32).toString("hex"),
      id = existing?.id || randomUUID();
    if (existing)
      await db.query(
        `UPDATE mm_jobs SET status='cancelled',payload='{}' WHERE subscriber_id=$1 AND kind='confirmation' AND status IN ('pending','retry')`,
        [id],
      );
    await db.query(
      `INSERT INTO mm_subscribers(id,email,status,consent_version,consent_ip_hash,confirmation_hash,confirmation_expires,unsubscribe_token,last_confirmation_at) VALUES($1,$2,'pending',$3,$4,$5,now()+interval '48 hours',$6,now()) ON CONFLICT(email) DO UPDATE SET status='pending',consent_at=now(),consent_version=$3,consent_ip_hash=$4,confirmation_hash=$5,confirmation_expires=now()+interval '48 hours',unsubscribe_token=$6,last_confirmation_at=now(),unsubscribed_at=NULL`,
      [id, email, CONSENT_VERSION, ipHash, hash(token), unsub],
    );
    await db.query(
      `INSERT INTO mm_consent_events(id,subscriber_id,event,consent_version,ip_hash) VALUES($1,$2,'requested',$3,$4)`,
      [randomUUID(), id, CONSENT_VERSION, ipHash],
    );
    const link = `${base}/newsletter/confirmer#token=${token}`;
    await db.query(
      `INSERT INTO mm_jobs(id,subscriber_id,kind,dedupe_key,payload) VALUES($1,$2,'confirmation',$3,$4)`,
      [
        randomUUID(),
        id,
        `confirm:${hash(token)}`,
        JSON.stringify({
          subject: "Confirmez votre inscription — Maison Miroir",
          html: `<h1>Bienvenue dans notre univers.</h1><p>Confirmez votre souhait de recevoir les nouvelles de Maison Miroir.</p><p><a href="${link}">Confirmer mon inscription</a></p><p>Ce lien expire dans 48 heures. Si vous n’avez pas demandé cette inscription, ignorez cet e-mail.</p>`,
        }),
      ],
    );
  });
}
export async function confirm(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return transaction(async (db) => {
    const result = await db.query(
      `UPDATE mm_subscribers SET status='active',confirmed_at=now(),confirmation_hash=NULL WHERE confirmation_hash=$1 AND status='pending' AND confirmation_expires>now() RETURNING id,unsubscribe_token`,
      [hash(token)],
    );
    if (!result.rowCount) return false;
    const subscriber = result.rows[0];
    const unsubscribeUrl = `${siteUrl()}/newsletter/desinscription?token=${subscriber.unsubscribe_token}`;
    await db.query(
      `INSERT INTO mm_jobs(id,subscriber_id,kind,dedupe_key,payload) VALUES($1,$2,'welcome',$3,$4) ON CONFLICT(dedupe_key) DO NOTHING`,
      [
        randomUUID(),
        subscriber.id,
        `welcome:${subscriber.id}`,
        JSON.stringify({
          subject: "Bienvenue dans l'univers Maison Miroir",
          html: welcomeHtml(unsubscribeUrl.replace("?token=", "#token=")),
          unsubscribe: unsubscribeUrl,
        }),
      ],
    );
    return true;
  });
}
export function welcomeHtml(unsubscribeUrl: string) {
  return `<html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3ece1;color:#4f3012;font-family:Georgia,serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:28px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fff9f0;border:1px solid #dcc6ad;border-radius:20px"><tr><td style="padding:32px 24px;line-height:1.7;font-size:17px"><p style="letter-spacing:3px;text-align:center">MAISON MIROIR</p><h1 style="font-size:28px;line-height:1.25;font-weight:normal">Bienvenue dans l'univers Maison Miroir !</h1><p>Nous sommes ravies de vous compter parmi les premières à rejoindre notre communauté.</p><p>Une nouvelle vision de la mode arrive bientôt, pensée pour les femmes qui souhaitent exprimer leur identité avec élégance et pudeur.</p><p>Vous serez informée en avant-première du lancement de notre première collection.</p><p>Avec élégance,<br><strong>L'équipe Maison Miroir</strong></p><hr style="border:0;border-top:1px solid #dcc6ad"><p style="font-size:13px">Vous recevez ce message après confirmation de votre inscription. <a style="color:#4f3012" href="${escapeHtml(unsubscribeUrl)}">Me désinscrire</a> · <a style="color:#4f3012" href="${siteUrl()}/politique-de-confidentialite">Confidentialité</a></p></td></tr></table></td></tr></table></body></html>`;
}
export function launchAnnouncementTemplate() {
  return {
    title: "Ouverture de Maison Miroir",
    subject: "Maison Miroir ouvre enfin ses portes",
    body: "Maison Miroir ouvre enfin ses portes !\n\nDécouvrez notre première collection, pensée pour exprimer votre identité avec élégance et pudeur.\n\nMerci de faire partie des premières à écrire ce nouveau chapitre avec nous.\n\nAvec élégance,\nL'équipe Maison Miroir",
    linkUrl: `${siteUrl()}/catalogue`,
  };
}
export async function unsubscribe(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return transaction(async (db) => {
    const result = await db.query(
      `UPDATE mm_subscribers SET status='unsubscribed',unsubscribed_at=now(),confirmation_hash=NULL WHERE unsubscribe_token=$1 RETURNING id`,
      [token],
    );
    if (!result.rowCount) return false;
    await db.query(
      `UPDATE mm_jobs SET status='cancelled',payload='{}' WHERE subscriber_id=$1 AND status IN ('pending','retry')`,
      [result.rows[0].id],
    );
    return true;
  });
}
type CampaignProduct = {
  id?: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  url: string;
};
type CampaignContent = {
  title: string;
  body: string;
  image_url?: string;
  link_url?: string;
  promo_code?: string;
  ends_at?: string;
  products?: CampaignProduct[];
};
export function campaignHtml(c: CampaignContent, unsubscribeUrl: string) {
  const products = Array.isArray(c.products) ? c.products : [];
  return `<div style="background:#f3ece1;color:#4f3012;padding:32px;font-family:Georgia,serif"><p>MAISON MIROIR</p><h1>${escapeHtml(c.title)}</h1>${c.image_url ? `<img width="480" style="max-width:100%" src="${escapeHtml(c.image_url)}" alt=""/>` : ""}<p style="white-space:pre-line">${escapeHtml(c.body)}</p>${products.map((p: CampaignProduct) => `<h2>${escapeHtml(p.name)}</h2><p>${escapeHtml(p.description || "")}</p><p>${escapeHtml(String(p.price))} €</p>${p.image ? `<img width="240" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"/>` : ""}<p><a href="${escapeHtml(p.url)}">Découvrir</a></p>`).join("")}${c.promo_code ? `<p>Votre code : ${escapeHtml(c.promo_code)}</p>` : ""}${c.ends_at ? `<p>Offre valable jusqu’au ${escapeHtml(new Date(c.ends_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }))}</p>` : ""}${c.link_url ? `<p><a style="display:inline-block;background:#4f3012;color:#fff9f0;padding:14px 24px;border-radius:30px;text-decoration:none" href="${escapeHtml(c.link_url)}">Découvrir Maison Miroir</a></p>` : ""}<hr/><p><a href="${escapeHtml(unsubscribeUrl)}">Me désinscrire</a> · <a href="${siteUrl()}/confidentialite">Confidentialité</a></p></div>`;
}
export async function approveCampaign(id: string, scheduledAt?: string) {
  if (process.env.SHOP_OPEN !== "true") throw new Error("SHOP_CLOSED");
  return transaction(async (db) => {
    const c = (
      await db.query(
        `UPDATE mm_campaigns SET status='scheduled',approved_at=now(),scheduled_at=$2 WHERE id=$1 AND status='draft' RETURNING *`,
        [id, scheduledAt || new Date().toISOString()],
      )
    ).rows[0];
    if (!c) throw new Error("Campagne déjà validée ou introuvable");
    if (process.env.SHOP_OPEN !== "true" && c.products?.length)
      throw new Error("SHOP_CLOSED");
    const subscribers = (
      await db.query(
        `SELECT id,unsubscribe_token FROM mm_subscribers WHERE status='active'`,
      )
    ).rows;
    for (const subscriber of subscribers) {
      const url = `${siteUrl()}/newsletter/desinscription?token=${subscriber.unsubscribe_token}`;
      await db.query(
        `INSERT INTO mm_jobs(id,subscriber_id,campaign_id,kind,dedupe_key,payload,next_attempt) VALUES($1,$2,$3,'campaign',$4,$5,$6) ON CONFLICT(dedupe_key) DO NOTHING`,
        [
          randomUUID(),
          subscriber.id,
          id,
          `${id}:${subscriber.id}`,
          JSON.stringify({
            subject: c.subject,
            html: campaignHtml(c, url.replace("?token=", "#token=")),
            unsubscribe: url,
          }),
          c.scheduled_at,
        ],
      );
    }
    return subscribers.length;
  });
}
export async function processQueue() {
  const runner = await database().connect();
  const runId = randomUUID();
  const locked = (
    await runner.query(
      `SELECT pg_try_advisory_lock(hashtext('mm-newsletter-worker')) AS locked`,
    )
  ).rows[0]?.locked;
  if (!locked) {
    runner.release();
    return 0;
  }
  try {
    await runner.query(
      `INSERT INTO mm_worker_runs(id,status) VALUES($1,'running')`,
      [runId],
    );
    if (!emailReady()) throw new Error("Newsletter unavailable");
    const deadline = Date.now() + 40000;
    let processed = 0;
    const batchSize = Math.max(
      1,
      Math.min(10, Number(process.env.NEWSLETTER_BATCH_SIZE) || 5),
    );
    for (let i = 0; i < batchSize && Date.now() < deadline; i++) {
      const job = await transaction(async (db) => {
        // Unknown outcomes older than the provider's idempotency window require manual reconciliation.
        await db.query(
          `UPDATE mm_jobs SET status='review',error_code='IDEMPOTENCY_WINDOW_EXPIRED' WHERE status IN ('retry','processing') AND first_attempt_at<now()-interval '23 hours'`,
        );
        return (
          await db.query(
            `UPDATE mm_jobs SET status='processing',lease_id=gen_random_uuid(),leased_at=now(),first_attempt_at=COALESCE(first_attempt_at,now()),attempts=attempts+1 WHERE id=(SELECT id FROM mm_jobs WHERE (kind IN ('confirmation','welcome') OR $1::boolean) AND ((status IN ('pending','retry') AND next_attempt<=now()) OR (status='processing' AND leased_at<now()-interval '5 minutes')) ORDER BY next_attempt FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
            [process.env.SHOP_OPEN === "true"],
          )
        ).rows[0];
      });
      if (!job) break;
      const s = (
        await database().query("SELECT * FROM mm_subscribers WHERE id=$1", [
          job.subscriber_id,
        ])
      ).rows[0];
      if (
        !s ||
        (job.kind !== "confirmation"
          ? s.status !== "active"
          : s.status !== "pending" ||
            new Date(s.confirmation_expires).getTime() < Date.now())
      ) {
        await database().query(
          `UPDATE mm_jobs SET status='cancelled',payload='{}' WHERE id=$1`,
          [job.id],
        );
        continue;
      }
      try {
        const result = await getResendClient()!.emails.send(
          {
            from: getEmailFrom(),
            to: s.email,
            subject: job.payload.subject,
            html: job.payload.html,
            ...(job.payload.unsubscribe
              ? {
                  headers: {
                    "List-Unsubscribe": `<${job.payload.unsubscribe.replace("/newsletter/desinscription", "/api/newsletter/desinscription")}>`,
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                  },
                }
              : {}),
          },
          { idempotencyKey: job.dedupe_key, signal: AbortSignal.timeout(8000) },
        );
        if (result.error || !result.data?.id)
          throw new Error("PROVIDER_REJECTED");
        await database().query(
          `UPDATE mm_jobs SET status=CASE WHEN status IN ('processing','retry') THEN 'accepted' ELSE status END,provider_id=$2,payload='{}',error_code=NULL,updated_at=now() WHERE id=$1 AND lease_id=$3`,
          [job.id, result.data.id, job.lease_id],
        );
        await reconcileDelivery(result.data.id);
      } catch {
        await database().query(
          `UPDATE mm_jobs SET status=$2,error_code='PROVIDER_REQUEST_FAILED',next_attempt=now()+interval '5 minutes',updated_at=now() WHERE id=$1 AND status='processing' AND lease_id=$3`,
          [job.id, job.attempts >= 4 ? "failed" : "retry", job.lease_id],
        );
      }
      processed++;
      if (i < 9) await new Promise((resolve) => setTimeout(resolve, 600));
    }
    await database().query(
      `UPDATE mm_campaigns c SET status='completed' WHERE status IN ('scheduled','sending') AND NOT EXISTS(SELECT 1 FROM mm_jobs j WHERE j.campaign_id=c.id AND j.status IN ('pending','retry','processing'))`,
    );
    processed += await processCartReminders(deadline);
    await runner.query(
      `UPDATE mm_worker_runs SET status='completed',processed=$2,finished_at=now() WHERE id=$1`,
      [runId, processed],
    );
    return processed;
  } catch (error) {
    await runner
      .query(
        `UPDATE mm_worker_runs SET status='failed',finished_at=now() WHERE id=$1`,
        [runId],
      )
      .catch(() => {});
    throw error;
  } finally {
    await runner
      .query(`SELECT pg_advisory_unlock(hashtext('mm-newsletter-worker'))`)
      .catch(() => {});
    runner.release();
  }
}
