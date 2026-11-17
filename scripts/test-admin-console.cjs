// Isolated PostgreSQL API tests. Admin auth is mocked; no production data or email is used.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const { NextRequest } = require("next/server");

async function main() {
  const db = new PGlite();
  for (const file of fs.readdirSync("migrations").filter((name) => name.endsWith(".sql")).sort())
    await db.exec(fs.readFileSync(path.join("migrations", file), "utf8"));
  const query = async (sql, params) => {
    const result = await db.query(sql, params);
    return { ...result, rowCount: result.rows.length || result.affectedRows || 0 };
  };
  const pool = {
    query,
    connect: async () => ({ query, release() {} }),
  };
  const transaction = async (work) => {
    await db.exec("BEGIN");
    try {
      const result = await work({ query });
      await db.exec("COMMIT");
      return result;
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  };
  let authorized = true;
  const session = { user: { id: "admin-test" } };
  const cache = new Map();
  const requestSecurity = load("lib/requestSecurity.ts");
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = module.paths;
    cache.set(filename, mod);
    mod.require = (id) => {
      if (id === "server-only") return {};
      if (id === "@/lib/adminAuth")
        return {
          adminDenied: async () => authorized ? null : Response.json({ error: "Authentification requise" }, { status: 401 }),
          adminSession: async () => authorized ? session : null,
        };
      if (id === "@/lib/adminAudit")
        return {
          adminAudit: async (action, target) =>
            query(
              "INSERT INTO mm_admin_audit(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)",
              [randomUUID(), session.user.id, action, target || null],
            ),
        };
      if (id === "@/lib/newsletterDb") return { database: () => pool, transaction };
      if (id === "@/lib/observability") return { securityEvent() {} };
      if (id === "@/lib/newsletter") return { emailReady: () => true };
      if (id === "@/lib/brandSettings") {
        return {
          getBrandSettings: async () => {
            const result = await query("SELECT key,value FROM mm_brand_settings");
            return Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
          },
        };
      }
      if (id === "@/lib/requestSecurity") return requestSecurity;
      if (id.startsWith("@/"))
        throw new Error(`Unexpected admin-test import: ${id}`);
      return require(id);
    };
    mod._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      filename,
    );
    return mod.exports;
  }
  function req(url, method = "GET", body) {
    return new NextRequest(url, {
      method,
      ...(body === undefined ? {} : {
        headers: {
          origin: new URL(url).origin,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    });
  }
  async function insertSubscriber(id, email, status, day) {
    await query(
      `INSERT INTO mm_subscribers(id,email,status,created_at,consent_at,consent_version,
       consent_ip_hash,unsubscribe_token) VALUES($1,$2,$3,$4,now(),'test-v1','hash',$5)`,
      [id, email, status, day, randomUUID().replaceAll("-", "")],
    );
  }

  const activeId = "10000000-0000-4000-8000-000000000001";
  const pendingId = "10000000-0000-4000-8000-000000000002";
  const optedOutId = "10000000-0000-4000-8000-000000000003";
  await insertSubscriber(activeId, "active@example.test", "active", "2026-01-02");
  await insertSubscriber(pendingId, "pending@example.test", "pending", new Date().toISOString());
  await insertSubscriber(optedOutId, "opted-out@example.test", "unsubscribed", "2026-01-01");
  await query(
    "INSERT INTO mm_consent_events(id,subscriber_id,event,consent_version,ip_hash) VALUES($1,$2,'requested','test-v1','hash')",
    [randomUUID(), activeId],
  );
  const scheduledCampaignId = randomUUID();
  await query(
    "INSERT INTO mm_campaigns(id,title,subject,body,status,scheduled_at) VALUES($1,'Scheduled','Subject','Body','scheduled',now()+interval '1 day')",
    [scheduledCampaignId],
  );

  const dashboard = load("app/api/admin/dashboard/route.ts");
  const dashboardResponse = await dashboard.GET();
  const dashboardData = await dashboardResponse.json();
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardData.subscribers.total, 3);
  assert.equal(dashboardData.subscribers.confirmed, 1);
  assert.equal(dashboardData.subscribers.pending, 1);
  assert.equal(dashboardData.subscribers.unsubscribed, 1);
  assert.equal(dashboardData.campaigns.scheduled, 1);
  assert.equal(dashboardData.metricsAvailability.opens, false);

  const subscribers = load("app/api/admin/subscribers/route.ts");
  const filtered = await subscribers.GET(req("https://example.test/api/admin/subscribers?status=pending&sort=email&direction=asc"));
  const filteredData = await filtered.json();
  assert.equal(filteredData.total, 1);
  assert.equal(filteredData.subscribers[0].email, "pending@example.test");
  const history = await subscribers.GET(req(`https://example.test/api/admin/subscribers?history=${activeId}`));
  assert.equal((await history.json()).history[0].event, "requested");

  const exportRoute = load("app/api/admin/subscribers/export/route.ts");
  const exportResponse = await exportRoute.GET(req("https://example.test/api/admin/subscribers/export?status=active"));
  const csv = await exportResponse.text();
  assert.match(csv, /active@example\.test/);
  assert.doesNotMatch(csv, /opted-out@example\.test/);

  const calendar = load("app/api/admin/calendar/route.ts");
  const createEvent = await calendar.POST(req("https://example.test/api/admin/calendar", "POST", {
    action: "create",
    title: "Lancement éditorial",
    kind: "launch",
    startsAt: "2030-01-02T10:00:00.000Z",
    notes: "Préparer le contenu",
  }));
  assert.equal(createEvent.status, 200);
  const eventId = (await createEvent.json()).id;
  assert.equal((await calendar.GET()).status, 200);
  const updateEvent = await calendar.POST(req("https://example.test/api/admin/calendar", "POST", {
    action: "update",
    id: eventId,
    title: "Lancement éditorial modifié",
    kind: "launch",
    startsAt: "2030-01-03T10:00:00.000Z",
    notes: "",
  }));
  assert.equal(updateEvent.status, 200);
  const deleteEvent = await calendar.POST(req("https://example.test/api/admin/calendar", "POST", {
    action: "delete",
    id: eventId,
  }));
  assert.equal(deleteEvent.status, 200);

  const settings = load("app/api/admin/settings/route.ts");
  const settingsData = await (await settings.GET()).json();
  assert.equal(settingsData.settings.brand_name, "Maison Miroir");
  assert.equal(Object.hasOwn(settingsData, "resendApiKey"), false);
  const updatedSettings = await settings.PUT(req("https://example.test/api/admin/settings", "PUT", {
    ...settingsData.settings,
    instagram_url: "https://www.instagram.com/maison-miroir-test/",
  }));
  assert.equal(updatedSettings.status, 200);
  assert.equal(
    (await query("SELECT value FROM mm_brand_settings WHERE key='instagram_url'")).rows[0].value,
    "https://www.instagram.com/maison-miroir-test/",
  );

  const ai = load("app/api/admin/miroir-ai/route.ts");
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROK_API_KEY;
  assert.equal((await ai.GET()).status, 200);
  const aiResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", { message: "Prépare une campagne de lancement" }));
  assert.equal(aiResponse.status, 503);
  process.env.GEMINI_API_KEY = "local-test-key";
  process.env.GEMINI_MODEL = "gemini-2.5-flash";
  process.env.GROK_API_KEY = "local-grok-test-key";
  process.env.GROK_MODEL = "grok-4.7";
  const aiStatus = await (await ai.GET()).json();
  assert.equal(aiStatus.provider, "gemini");
  assert.equal(aiStatus.model, "gemini-2.5-flash");
  assert.equal(aiStatus.fallbackEnabled, true);
  const originalFetch = global.fetch;
  let aiCalls = 0;
  global.fetch = async (url, options) => {
    aiCalls++;
    if (String(url) === "https://api.x.ai/v1/chat/completions") {
      assert.equal(options.headers.Authorization, "Bearer local-grok-test-key");
      const requestBody = JSON.parse(options.body);
      assert.equal(requestBody.model, "grok-4.7");
      assert.equal(requestBody.response_format.type, "json_object");
      assert.equal(JSON.stringify(requestBody).includes("active@example.test"), false);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            reply: "Voici un brouillon.",
            intent: "create_draft",
            draft: { title: "Lancement", subject: "Une nouvelle collection", preheader: "Découvrir", body: "Notre collection arrive." },
          }) } }],
        }),
      };
    }
    assert.match(String(url), /models\/gemini-2\.5-flash:generateContent$/);
    assert.equal(options.headers["x-goog-api-key"], "local-test-key");
    const requestBody = JSON.parse(options.body);
    assert.equal(JSON.stringify(requestBody).includes("active@example.test"), false);
    if (aiCalls === 1) return { ok: false, status: 503 };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          reply: "Voici un brouillon.",
          intent: "create_draft",
          draft: { title: "Lancement", subject: "Une nouvelle collection", preheader: "Découvrir", body: "Notre collection arrive." },
        }) }] } }],
      }),
    };
  };
  try {
    const draftResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Prépare une campagne de lancement",
    }));
    const draftResult = await draftResponse.json();
    assert.equal(draftResult.provider, "grok");
    assert.equal(draftResult.fallbackUsed, true);
    assert.equal(draftResult.createdDraft, true);
    assert.equal(
      (await query("SELECT status FROM mm_campaigns WHERE id=$1", [draftResult.draftId])).rows[0].status,
      "draft",
    );
    assert.equal(
      (await query("SELECT count(*)::int AS count FROM mm_jobs WHERE campaign_id=$1", [draftResult.draftId])).rows[0].count,
      0,
    );
    const callsBeforePii = aiCalls;
    const piiResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Écris à cliente@example.test",
    }));
    assert.equal(piiResponse.status, 400);
    assert.equal(aiCalls, callsBeforePii);
    delete process.env.GROK_API_KEY;
    global.fetch = async (_url, options) => {
      aiCalls++;
      assert.equal(options.headers["x-goog-api-key"], "local-test-key");
      return { ok: false, status: 403 };
    };
    const providerError = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Propose trois objets d’email élégants.",
    }));
    assert.equal(providerError.status, 502);
    assert.match((await providerError.json()).error, /autorisations Gemini/);
    for (let call = 1; call < 19; call++) {
      const limitedRequest = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
        message: "Propose trois objets d’email élégants.",
      }));
      assert.equal(limitedRequest.status, 502);
    }
    const overLimit = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Propose un objet d’email.",
    }));
    assert.equal(overLimit.status, 429);
  } finally {
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GROK_API_KEY;
    delete process.env.GROK_MODEL;
  }

  const activeSendJob = randomUUID();
  await query(
    `INSERT INTO mm_jobs(id,subscriber_id,kind,dedupe_key,payload,status)
     VALUES($1,$2,'confirmation',$3,'{}','processing')`,
    [activeSendJob, pendingId, `active-send:${activeSendJob}`],
  );
  const blockedErasure = await subscribers.POST(req("https://example.test/api/admin/subscribers", "POST", {
    action: "erase",
    id: pendingId,
    confirmation: true,
  }));
  assert.equal(blockedErasure.status, 409);
  assert.equal(
    (await query("SELECT count(*)::int AS count FROM mm_subscribers WHERE id=$1", [pendingId])).rows[0].count,
    1,
  );
  await query("UPDATE mm_jobs SET status='failed' WHERE id=$1", [activeSendJob]);
  const erased = await subscribers.POST(req("https://example.test/api/admin/subscribers", "POST", {
    action: "erase",
    id: pendingId,
    confirmation: true,
  }));
  assert.equal(erased.status, 200);
  assert.equal(
    (await query("SELECT count(*)::int AS count FROM mm_subscribers WHERE id=$1", [pendingId])).rows[0].count,
    0,
  );
  assert.equal(
    (await query("SELECT count(*)::int AS count FROM mm_consent_events WHERE subscriber_id=$1", [activeId])).rows[0].count,
    1,
  );

  authorized = false;
  assert.equal((await dashboard.GET()).status, 401);
  assert.equal((await subscribers.GET(req("https://example.test/api/admin/subscribers"))).status, 401);
  assert.equal((await exportRoute.GET(req("https://example.test/api/admin/subscribers/export"))).status, 401);
  assert.equal((await calendar.GET()).status, 401);
  assert.equal((await settings.GET()).status, 401);
  assert.equal((await ai.GET()).status, 401);
  console.log("PASS: authenticated admin dashboard aggregates, subscriber filters/history/export/erasure, persisted calendar and allowlisted settings, Miroir AI draft-only flow, PII rejection, Gemini-to-Grok fallback, provider error reporting and rate limits. No campaign or email sent.");
  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
