import "server-only";
import { renderNewsletterEmail, launchBody } from "./newsletterTemplates.mjs";
import { securityEvent } from "./observability";
import { processCartReminders } from "./abandonedCarts";
import { reconcileDelivery } from "./deliveryEvents";
import { createHash, randomBytes, randomUUID } from "crypto";
import { database, transaction } from "./newsletterDb";
import { getAdminEmail, getEmailFrom, getResendClient } from "./email";
import { getBrandSettings, type BrandSettings } from "./brandSettings";

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
export async function sendCampaignTest(id: string) {
  if (!emailReady()) throw new Error("EMAIL_DISABLED");
  const recipient = getAdminEmail();
  if (!recipient) throw new Error("TEST_RECIPIENT_DISABLED");
  const c = (
    await database().query("SELECT * FROM mm_campaigns WHERE id=$1", [id])
  ).rows[0];
  if (!c) throw new Error("CAMPAIGN_NOT_FOUND");
  const brandSettings = await getBrandSettings();
  const unsubscribeUrl = `${siteUrl()}/newsletter/desinscription?token=test-only`;
  const rendered = campaignEmail(
    { ...c, ...campaignBrandSettings(brandSettings) },
    unsubscribeUrl,
  );
  const resend = getResendClient();
  if (!resend) throw new Error("EMAIL_DISABLED");
  const result = await resend.emails.send({
    from: getEmailFrom(),
    to: [recipient],
    subject: `[Test] ${c.subject}`,
    html: rendered.html,
    text: rendered.text,
  });
  if (result.error) throw new Error("EMAIL_PROVIDER_ERROR");
  const providerId = result.data?.id;
  if (!providerId) throw new Error("EMAIL_PROVIDER_UNCONFIRMED");
  return { providerId, recipient };
}
export async function subscribe(email: string, ip: string) {
  if (!emailReady()) throw new Error("Newsletter unavailable");
  const base = siteUrl();
  const brandSettings = await getBrandSettings();
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
        JSON.stringify(
          renderNewsletterEmail("confirmation", {
            siteUrl: base,
            actionUrl: link,
            body: brandSettings.confirmation_copy,
            brandName: brandSettings.brand_name,
            contactEmail: brandSettings.contact_email,
            instagramUrl: brandSettings.instagram_url || undefined,
            tiktokUrl: brandSettings.tiktok_url || undefined,
          }),
        ),
      ],
    );
  });
}
export async function confirm(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const brandSettings = await getBrandSettings();
  return transaction(async (db) => {
    const result = await db.query(
      `UPDATE mm_subscribers SET status='active',confirmed_at=now(),confirmation_hash=NULL WHERE confirmation_hash=$1 AND status='pending' AND confirmation_expires>now() RETURNING id,unsubscribe_token,consent_version,consent_ip_hash`,
      [hash(token)],
    );
    if (!result.rowCount) return false;
    const subscriber = result.rows[0];
    await db.query(
      `INSERT INTO mm_consent_events(id,subscriber_id,event,consent_version,ip_hash)
       VALUES($1,$2,'confirmed',$3,$4)`,
      [randomUUID(), subscriber.id, subscriber.consent_version, subscriber.consent_ip_hash],
    );
    const unsubscribeUrl = `${siteUrl()}/newsletter/desinscription?token=${subscriber.unsubscribe_token}`;
    await db.query(
      `INSERT INTO mm_jobs(id,subscriber_id,kind,dedupe_key,payload) VALUES($1,$2,'welcome',$3,$4) ON CONFLICT(dedupe_key) DO NOTHING`,
      [
        randomUUID(),
        subscriber.id,
        `welcome:${subscriber.id}`,
        JSON.stringify({
          ...renderNewsletterEmail("welcome", {
            siteUrl: siteUrl(),
            actionUrl: siteUrl(),
            unsubscribeUrl: unsubscribeUrl.replace("?token=", "#token="),
            body: brandSettings.welcome_copy,
            brandName: brandSettings.brand_name,
            contactEmail: brandSettings.contact_email,
            instagramUrl: brandSettings.instagram_url || undefined,
            tiktokUrl: brandSettings.tiktok_url || undefined,
          }),
          unsubscribe: unsubscribeUrl,
        }),
      ],
    );
    return true;
  });
}
export function welcomeHtml(unsubscribeUrl: string) {
  return renderNewsletterEmail("welcome", {
    siteUrl: siteUrl(),
    actionUrl: siteUrl(),
    unsubscribeUrl,
  }).html;
}
export function launchAnnouncementTemplate() {
  return {
    title: "Ouverture de Maison Miroir",
    subject: "Maison Miroir ouvre enfin ses portes",
    body: launchBody,
    linkUrl: `${siteUrl()}/catalogue`,
  };
}
export async function unsubscribe(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return transaction(async (db) => {
    const previous = (
      await db.query(
        "SELECT id,status,confirmed_at,consent_version FROM mm_subscribers WHERE unsubscribe_token=$1 FOR UPDATE",
        [token],
      )
    ).rows[0];
    if (!previous) return false;
    if (previous.status === "unsubscribed") return true;
    const result = await db.query(
      `UPDATE mm_subscribers SET status='unsubscribed',unsubscribed_at=now(),confirmation_hash=NULL WHERE unsubscribe_token=$1 RETURNING id`,
      [token],
    );
    if (!result.rowCount) return false;
    await db.query(
      `INSERT INTO mm_consent_events(id,subscriber_id,event,consent_version,ip_hash)
       VALUES($1,$2,'unsubscribed',$3,NULL)`,
      [randomUUID(), result.rows[0].id, previous.consent_version],
    );
    await db.query(
      `UPDATE mm_jobs SET status='cancelled',payload='{}' WHERE subscriber_id=$1 AND status IN ('pending','retry')`,
      [result.rows[0].id],
    );
    // A receipt must never prevent the opt-out itself from being committed.
    if (previous.status === "active" && emailReady()) {
      await db.query("SAVEPOINT unsubscribe_receipt");
      try {
        const message = renderNewsletterEmail("unsubscribe", {
          siteUrl: siteUrl(),
          actionUrl: siteUrl(),
        });
        const cycle = new Date(previous.confirmed_at).toISOString();
        await db.query(
          "INSERT INTO mm_jobs(id,subscriber_id,kind,dedupe_key,payload) VALUES($1,$2,'unsubscribe_confirmation',$3,$4) ON CONFLICT(dedupe_key) DO NOTHING",
          [
            randomUUID(),
            previous.id,
            `unsubscribe:${previous.id}:${cycle}`,
            JSON.stringify(message),
          ],
        );
        await db.query("RELEASE SAVEPOINT unsubscribe_receipt");
      } catch {
        await db.query("ROLLBACK TO SAVEPOINT unsubscribe_receipt");
        securityEvent("UNSUBSCRIBE_RECEIPT_QUEUE_FAILED");
      }
    }
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
  preheader?: string;
  body: string;
  image_url?: string;
  link_url?: string;
  promo_code?: string;
  ends_at?: string;
  products?: CampaignProduct[];
  brand_name?: string;
  contact_email?: string;
  instagram_url?: string;
  tiktok_url?: string;
  campaign_footer?: string;
};
export function campaignHtml(c: CampaignContent, unsubscribeUrl: string) {
  return campaignEmail(c, unsubscribeUrl).html;
}
function campaignBrandSettings(settings: BrandSettings) {
  return {
    brand_name: settings.brand_name,
    contact_email: settings.contact_email,
    instagram_url: settings.instagram_url,
    tiktok_url: settings.tiktok_url,
    campaign_footer: settings.campaign_footer,
  };
}
function campaignEmail(c: CampaignContent, unsubscribeUrl: string) {
  const products = Array.isArray(c.products) ? c.products : [];
  const contentHtml =
    (c.image_url
      ? '<img width="540" style="max-width:100%;height:auto" alt="Visuel de la campagne Maison Miroir" src="' +
        escapeHtml(safeUrl(c.image_url)) +
        '">'
      : "") +
    '<p style="white-space:pre-line">' +
    escapeHtml(c.body) +
    "</p>" +
    products
      .map(
        (p) =>
          "<h2>" +
          escapeHtml(p.name) +
          "</h2><p>" +
          escapeHtml(p.description || "") +
          "</p><p>" +
          escapeHtml(String(p.price)) +
          " EUR</p>" +
          (p.image
            ? '<img width="240" style="max-width:100%;height:auto" alt="' +
              escapeHtml(p.name) +
              '" src="' +
              escapeHtml(safeUrl(p.image)) +
              '">'
            : "") +
          '<p><a href="' +
          escapeHtml(safeUrl(p.url)) +
          '">Découvrir</a></p>',
      )
      .join("") +
    (c.promo_code
      ? "<p>Votre code : " + escapeHtml(c.promo_code) + "</p>"
      : "") +
    (c.ends_at
      ? "<p>Offre valable jusqu’au " +
        escapeHtml(
          new Date(c.ends_at).toLocaleDateString("fr-FR", {
            timeZone: "Europe/Paris",
          }),
        ) +
        "</p>"
      : "");
  return renderNewsletterEmail("launch", {
    siteUrl: siteUrl(),
    title: c.title === launchAnnouncementTemplate().title ? undefined : c.title,
    body: c.body,
    preheader: c.preheader,
    brandName: c.brand_name,
    contactEmail: c.contact_email,
    instagramUrl: c.instagram_url || undefined,
    tiktokUrl: c.tiktok_url || undefined,
    footerText: c.campaign_footer,
    contentHtml:
      c.image_url || c.products?.length || c.promo_code || c.ends_at
        ? contentHtml
        : undefined,
    actionUrl: safeUrl(c.link_url || siteUrl()),
    unsubscribeUrl,
    text:
      c.body +
      products
        .map((p) => "\n" + p.name + " - " + p.price + " EUR : " + p.url)
        .join(""),
  });
}
export async function approveCampaign(id: string, scheduledAt?: string) {
  if (!emailReady()) throw new Error("EMAIL_DISABLED");
  const brandSettings = await getBrandSettings();
  return transaction(async (db) => {
    const c = (
      await db.query(
        `UPDATE mm_campaigns SET status='scheduled',approved_at=now(),scheduled_at=$2 WHERE id=$1 AND status='draft' RETURNING *`,
        [id, scheduledAt || new Date().toISOString()],
      )
    ).rows[0];
    if (!c) throw new Error("Campagne déjà validée ou introuvable");
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
            html: campaignHtml({ ...c, ...campaignBrandSettings(brandSettings) }, url.replace("?token=", "#token=")),
            text: campaignEmail({ ...c, ...campaignBrandSettings(brandSettings) }, url.replace("?token=", "#token=")).text,
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
            `UPDATE mm_jobs SET status='processing',lease_id=gen_random_uuid(),leased_at=now(),first_attempt_at=COALESCE(first_attempt_at,now()),attempts=attempts+1 WHERE id=(SELECT id FROM mm_jobs WHERE (kind IN ('confirmation','welcome','unsubscribe_confirmation','campaign') OR $1::boolean) AND ((status IN ('pending','retry') AND next_attempt<=now()) OR (status='processing' AND leased_at<now()-interval '5 minutes')) ORDER BY next_attempt FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
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
        (job.kind === "unsubscribe_confirmation"
          ? s.status !== "unsubscribed"
          : job.kind !== "confirmation"
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
            ...(job.payload.text ? { text: job.payload.text } : {}),
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
