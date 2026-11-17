// Uses an isolated PostgreSQL engine and a fake email provider. Never loads .env.local.
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
async function main() {
  const db = new PGlite();
  await db.exec(fs.readFileSync("migrations/001_newsletter.sql", "utf8"));
  await db.exec(fs.readFileSync("migrations/002_security.sql", "utf8"));
  await db.exec(fs.readFileSync("migrations/004_welcome.sql", "utf8"));
  await db.exec(
    fs.readFileSync("migrations/005_unsubscribe_receipt.sql", "utf8"),
  );
  await db.exec(fs.readFileSync("migrations/006_admin_console.sql", "utf8"));
  // Advisory locks are unnecessary for this single-connection test database.
  let failReceiptInsert = false;
  const query = async (text, params) => {
    if (
      failReceiptInsert &&
      text.startsWith("INSERT INTO mm_jobs") &&
      text.includes("'unsubscribe_confirmation'")
    )
      return db.query("SELECT intentionally_missing_column FROM mm_jobs");
    if (
      text.includes("pg_advisory_xact_lock") ||
      text.includes("pg_advisory_unlock")
    )
      return { rows: [], rowCount: 0 };
    if (text.includes("pg_try_advisory_lock"))
      return { rows: [{ locked: true }], rowCount: 1 };
    const r = await db.query(text, params);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const transaction = async (fn) => {
    await db.exec("BEGIN");
    try {
      const r = await fn({ query });
      await db.exec("COMMIT");
      return r;
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }
  };
  let calls = [],
    fail = false;
  let providerSequence = 0;
  const send = async (payload, options) => {
    calls.push({ payload, options });
    return fail
      ? { error: { message: "temporary" } }
      : { data: { id: `fake-${++providerSequence}` } };
  };
  const email = {
    getEmailFrom: () => "test@example.test",
    getResendClient: () => ({ emails: { send } }),
  };
  process.env.NEWSLETTER_DATABASE_URL = "test-only";
  process.env.NEWSLETTER_HASH_SECRET = "test-secret";
  process.env.NEWSLETTER_WORKER_SECRET = "test-worker";
  process.env.NEWSLETTER_SITE_URL = "https://example.test";
  process.env.NODE_ENV = "test";
  const filename = path.resolve("lib/newsletter.ts"),
    mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  mod.require = (id) =>
    id === "./newsletterTemplates.mjs"
      ? require("../lib/newsletterTemplates.mjs")
      : id === "./observability"
        ? { securityEvent: () => {} }
        : id === "./newsletterDb"
          ? { database: () => pool, transaction }
          : id === "./email"
            ? email
            : id === "./brandSettings"
              ? {
                  getBrandSettings: async () => {
                    const result = await query(
                      "SELECT key,value FROM mm_brand_settings",
                    );
                    return Object.fromEntries(
                      result.rows.map((row) => [row.key, row.value]),
                    );
                  },
                }
            : id === "server-only"
              ? {}
              : id === "./deliveryEvents"
                ? { reconcileDelivery: async () => {} }
                : id === "./abandonedCarts"
                  ? { processCartReminders: async () => 0 }
                  : require(id);
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    filename,
  );
  const n = mod.exports;
  await n.subscribe("girl@example.test", "test-ip");
  let subscriber = (await query("SELECT * FROM mm_subscribers")).rows[0];
  assert.equal(subscriber.status, "pending");
  assert.equal(subscriber.consent_version, n.CONSENT_VERSION);
  assert.notEqual(subscriber.consent_ip_hash, "test-ip");
  let job = (await query("SELECT * FROM mm_jobs")).rows[0];
  const token = job.payload.html.match(/token=([a-f0-9]{64})/)[1];
  assert.equal(subscriber.confirmation_hash, n.hash(token));
  assert(!JSON.stringify(subscriber).includes(token));
  await n.subscribe("girl@example.test", "test-ip");
  assert.equal((await query("SELECT * FROM mm_jobs")).rows.length, 1);
  assert.equal(await n.confirm("invalid"), false);
  await query(
    `UPDATE mm_subscribers SET confirmation_expires=now()-interval '1 hour'`,
  );
  assert.equal(await n.confirm(token), false);
  await query(
    `UPDATE mm_subscribers SET confirmation_expires=now()+interval '1 hour'`,
  );
  assert.equal(await n.confirm(token), true);
  assert.equal(await n.confirm(token), false);
  assert.equal(
    (await query("SELECT * FROM mm_subscribers")).rows[0].status,
    "active",
  );
  assert.deepEqual(
    (await query(
      "SELECT event FROM mm_consent_events WHERE subscriber_id=$1 ORDER BY created_at,id",
      [subscriber.id],
    )).rows.map((event) => event.event).sort(),
    ["confirmed", "requested"],
  );
  process.env.SHOP_OPEN = "false";
  await n.processQueue();
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].payload.subject,
    "Bienvenue dans l'univers Maison Miroir",
  );
  assert(calls[0].payload.html.includes("L’équipe Maison Miroir"));
  assert(calls[0].payload.text.includes("L’équipe Maison Miroir"));
  assert(calls[0].payload.html.includes("Se désinscrire"));
  await n.subscribe("girl@example.test", "another-ip");
  await n.processQueue();
  assert.equal(calls.length, 1);
  assert.equal(
    (await query("SELECT count(*)::int AS n FROM mm_jobs WHERE kind='welcome'"))
      .rows[0].n,
    1,
  );
  calls = [];
  const campaignId = require("node:crypto").randomUUID();
  await query(
    "INSERT INTO mm_campaigns(id,title,subject,preheader,body) VALUES($1,$2,$3,$4,$5)",
    [
      campaignId,
      "New chapter",
      "Bienvenue",
      "Pré-en-tête de test & titre",
      "Bonjour <script>bad()</script>",
    ],
  );
  await assert.rejects(() => n.approveCampaign(campaignId), /SHOP_CLOSED/);
  assert.equal(
    (await query("SELECT status FROM mm_campaigns WHERE id=$1", [campaignId]))
      .rows[0].status,
    "draft",
  );
  process.env.SHOP_OPEN = "true";
  assert.equal(await n.approveCampaign(campaignId), 1);
  await assert.rejects(() => n.approveCampaign(campaignId));
  assert.equal(
    (await query(`SELECT * FROM mm_jobs WHERE kind='campaign'`)).rows.length,
    1,
  );
  process.env.SHOP_OPEN = "false";
  await n.processQueue();
  assert.equal(calls.length, 0, "Pre-launch campaign must remain unsent");
  assert.equal(
    (await query("SELECT status FROM mm_jobs WHERE kind='campaign'")).rows[0]
      .status,
    "pending",
  );
  process.env.SHOP_OPEN = "true";
  await n.processQueue();
  assert.equal(calls.length, 1);
  assert(
    calls[0].payload.headers["List-Unsubscribe"].includes(
      "/api/newsletter/desinscription",
    ),
  );
  assert(calls[0].payload.html.includes("&lt;script&gt;"));
  assert(!calls[0].payload.html.includes("<script>"));
  assert(calls[0].payload.html.includes("Pré-en-tête de test &amp; titre"));
  assert.equal(
    (await query(`SELECT status FROM mm_jobs WHERE kind='campaign'`)).rows[0]
      .status,
    "accepted",
  );
  await n.processQueue();
  assert.equal(calls.length, 1);
  assert.equal(await n.unsubscribe(subscriber.unsubscribe_token), true);
  assert.equal(await n.unsubscribe(subscriber.unsubscribe_token), true);
  assert.equal(
    (
      await query(
        "SELECT count(*)::int AS n FROM mm_jobs WHERE kind='unsubscribe_confirmation'",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await query(
        "SELECT count(*)::int AS n FROM mm_consent_events WHERE subscriber_id=$1 AND event='unsubscribed'",
        [subscriber.id],
      )
    ).rows[0].n,
    1,
  );
  process.env.SHOP_OPEN = "false";
  const beforeReceipt = calls.length;
  await n.processQueue();
  assert.equal(calls.length, beforeReceipt + 1);
  assert.equal(
    calls.at(-1).payload.subject,
    "Votre désinscription — Maison Miroir",
  );
  assert(calls.at(-1).payload.text.includes("ne recevrez plus"));
  await n.processQueue();
  assert.equal(calls.length, beforeReceipt + 1);
  process.env.SHOP_OPEN = "true";
  assert.equal(
    (await query("SELECT status FROM mm_subscribers")).rows[0].status,
    "unsubscribed",
  );
  await query(`UPDATE mm_subscribers SET status='active'`);
  const retryId = require("node:crypto").randomUUID();
  await query(
    `INSERT INTO mm_jobs(id,subscriber_id,kind,dedupe_key,payload) VALUES($1,$2,'campaign','retry-test',$3)`,
    [
      retryId,
      subscriber.id,
      JSON.stringify({ subject: "Retry", html: "test" }),
    ],
  );
  fail = true;
  await n.processQueue();
  assert.equal(
    (await query("SELECT status FROM mm_jobs WHERE id=$1", [retryId])).rows[0]
      .status,
    "retry",
  );
  assert.equal(calls.at(-1).options.idempotencyKey, "retry-test");
  fail = false;
  await query(`UPDATE mm_jobs SET next_attempt=now() WHERE id=$1`, [retryId]);
  await n.processQueue();
  assert.equal(calls.at(-1).options.idempotencyKey, "retry-test");
  assert.equal(
    (await query("SELECT status FROM mm_jobs WHERE id=$1", [retryId])).rows[0]
      .status,
    "accepted",
  );
  const publicationFile = path.resolve("lib/productPublication.ts"),
    publicationModule = new Module(publicationFile, module);
  publicationModule.filename = publicationFile;
  publicationModule.paths = module.paths;
  publicationModule.require = (id) =>
    id === "./newsletterDb"
      ? { database: () => ({ query }) }
      : id === "./newsletter"
        ? n
        : id === "server-only"
          ? {}
          : require(id);
  publicationModule._compile(
    ts.transpileModule(fs.readFileSync(publicationFile, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    publicationFile,
  );
  const publish = publicationModule.exports.recordProductPublication;
  const product = {
    id: "new-bag",
    name: "New bag",
    price: 35,
    description: "Test product",
    images: ["/test.jpg"],
  };
  const event = {
    id: "publication-1",
    previousStatus: "draft",
    status: "published",
    source: "editor",
  };
  assert.equal(await publish(product, { ...event, source: "import" }), null);
  assert.equal(
    await publish(product, { ...event, previousStatus: "published" }),
    null,
  );
  assert.equal(await publish(product, { ...event, status: "draft" }), null);
  assert(await publish(product, event));
  assert.equal(await publish(product, event), null);
  assert.equal(
    (
      await query(
        `SELECT status FROM mm_campaigns WHERE publication_key='product:new-bag:publication-1'`,
      )
    ).rows[0].status,
    "draft",
  );
  await n.subscribe("receipt-failure@example.test", "separate-fixture-ip");
  const receiptSubscriber = (
    await query("SELECT * FROM mm_subscribers WHERE email=$1", [
      "receipt-failure@example.test",
    ])
  ).rows[0];
  const receiptJob = (
    await query(
      "SELECT payload FROM mm_jobs WHERE subscriber_id=$1 AND kind='confirmation'",
      [receiptSubscriber.id],
    )
  ).rows[0];
  await n.confirm(receiptJob.payload.html.match(/token=([a-f0-9]{64})/)[1]);
  failReceiptInsert = true;
  assert.equal(await n.unsubscribe(receiptSubscriber.unsubscribe_token), true);
  failReceiptInsert = false;
  assert.equal(
    (
      await query("SELECT status FROM mm_subscribers WHERE id=$1", [
        receiptSubscriber.id,
      ])
    ).rows[0].status,
    "unsubscribed",
    "Receipt failure must not undo opt-out",
  );
  for (let i = 0; i < 6; i++) await n.subscribe("girl@example.test", "test-ip");
  await assert.rejects(
    () => n.subscribe("girl@example.test", "test-ip"),
    /RATE_LIMIT/,
  );
  console.log(
    "PASS: publication drafts, edit/import filtering, event deduplication, persistent rate limiting.",
  );
  console.log(
    "PASS: consent, double opt-in, unique welcome after confirmation, no duplicate welcome, pre-launch campaign block, unsubscribe, retries and provider idempotency. No real emails sent.",
  );
  await db.close();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
