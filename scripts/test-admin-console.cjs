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
      if (id === "@/lib/newsletter")
        return {
          emailReady: () => true,
          siteUrl: () => "https://example.test",
          safeUrl: (value) => value || "",
          campaignHtml: () => "<html>preview</html>",
          launchAnnouncementTemplate: () => ({
            title: "Lancement",
            subject: "Lancement",
            body: "Lancement",
            linkUrl: "https://example.test",
          }),
          sendCampaignTest: async () => ({
            providerId: "fake-test-1",
            recipient: "admin@example.test",
          }),
        };
      if (id === "@/lib/email")
        return { getAdminEmail: () => "admin@example.test" };
      if (id === "@/lib/products") return load("lib/products.ts");
      if (id === "@/lib/brandSettings") {
        const normalizeBrandText = (value) =>
          value.replace(/\bMAISON MIROIRS?\b/gi, "MAISON MIROIR");
        return {
          normalizeBrandText,
          getBrandSettings: async () => {
            const result = await query("SELECT key,value FROM mm_brand_settings");
            return Object.fromEntries(
              result.rows.map((row) => [
                row.key,
                normalizeBrandText(row.value),
              ]),
            );
          },
        };
      }
      if (id === "@/lib/requestSecurity") return requestSecurity;
      if (id === "@/lib/newsletterSchemas")
        return load("lib/newsletterSchemas.ts");
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
  assert.equal(settingsData.settings.brand_name, "MAISON MIROIR");
  assert.equal(Object.hasOwn(settingsData, "resendApiKey"), false);
  const updatedSettings = await settings.PUT(req("https://example.test/api/admin/settings", "PUT", {
    ...settingsData.settings,
    brand_name: "Maison Miroir",
    confirmation_copy: "Merci pour Maison Miroir.",
    instagram_url: "https://www.instagram.com/maison-miroir-test/",
  }));
  assert.equal(updatedSettings.status, 200);
  const updatedSettingsData = await updatedSettings.json();
  assert.equal(updatedSettingsData.settings.brand_name, "MAISON MIROIR");
  assert.equal(updatedSettingsData.settings.confirmation_copy, "Merci pour MAISON MIROIR.");
  assert.equal(
    (await query("SELECT value FROM mm_brand_settings WHERE key='brand_name'")).rows[0].value,
    "MAISON MIROIR",
  );
  await query(
    "UPDATE mm_brand_settings SET value=$1 WHERE key='confirmation_copy'",
    ["Merci pour Maison Miroir."],
  );
  const legacySettings = await (await settings.GET()).json();
  assert.equal(legacySettings.settings.confirmation_copy, "Merci pour MAISON MIROIR.");
  assert.equal(
    (await query("SELECT value FROM mm_brand_settings WHERE key='instagram_url'")).rows[0].value,
    "https://www.instagram.com/maison-miroir-test/",
  );

  const ai = load("app/api/admin/miroir-ai/route.ts");
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  assert.equal((await ai.GET()).status, 200);
  const aiResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", { message: "Prépare une campagne de lancement" }));
  assert.equal(aiResponse.status, 503);
  process.env.GEMINI_API_KEY = "local-test-key";
  process.env.GEMINI_MODEL = "gemini-3.8-flash";
  process.env.GROQ_API_KEY = "local-groq-test-key";
  process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  const originalFetch = global.fetch;
  let aiCalls = 0;
  let geminiModelListed = true;
  let groqModelListed = true;
  let transientGeminiStatuses = [];
  let forceGeminiCredentialsError = false;
  let forceGroqUnavailable = false;
  let testNow = Date.now();
  const originalDateNow = Date.now;
  Date.now = () => testNow;
  const normalReply = {
    reply: "Voici trois propositions élégantes.",
    intent: "none",
    draft: null,
  };
  const draftReply = {
    reply: "Voici un brouillon.",
    intent: "create_draft",
    draft: { title: "Lancement", subject: "Une nouvelle collection", preheader: "Découvrir", body: "Notre collection arrive.", productIds: ["modest-era"] },
  };
  global.fetch = async (url, options) => {
    aiCalls++;
    const urlString = String(url);
    if ((!options.method || options.method === "GET") && urlString.endsWith("/v1beta/models")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          models: geminiModelListed
            ? [{ name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] }]
            : [{ name: "models/another-model", supportedGenerationMethods: ["generateContent"] }],
        }),
      };
    }
    if ((!options.method || options.method === "GET") && urlString === "https://api.groq.com/openai/v1/models") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: groqModelListed ? [{ id: "openai/gpt-oss-120b" }] : [{ id: "other-model" }],
        }),
      };
    }
    if (String(url) === "https://api.groq.com/openai/v1/chat/completions") {
      assert.equal(options.headers.Authorization, "Bearer local-groq-test-key");
      const requestBody = JSON.parse(options.body);
      assert.equal(requestBody.model, "openai/gpt-oss-120b");
      assert.equal(requestBody.max_completion_tokens, 700);
      assert.equal("max_tokens" in requestBody, false);
      assert.equal(requestBody.response_format.type, "json_object");
      assert.equal(JSON.stringify(requestBody).includes("active@example.test"), false);
      const requestData = JSON.parse(requestBody.messages[1].content);
      if (requestData.campaignProducts) {
        assert.ok(requestData.campaignProducts.some((product) => product.id === "modest-era"));
        assert.ok(requestData.campaignProducts.some((product) => product.id === "paradise-way"));
        assert.ok(requestData.campaignProducts.every((product) => product.availableForSale === false));
      }
      const reply = /(?:prépare|rédige|crée)/i.test(requestData.question)
        ? draftReply
        : normalReply;
      if (forceGroqUnavailable) return { ok: false, status: 503 };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            ...reply,
          }) } }],
        }),
      };
    }
    assert.match(String(url), /models\/gemini-3\.8-flash:generateContent$/);
    assert.equal(options.headers["x-goog-api-key"], "local-test-key");
    const requestBody = JSON.parse(options.body);
    assert.equal(JSON.stringify(requestBody).includes("active@example.test"), false);
    const requestData = JSON.parse(requestBody.contents[0].parts[0].text);
    if (requestData.campaignProducts) {
      assert.ok(requestData.campaignProducts.some((product) => product.id === "modest-era"));
      assert.ok(requestData.campaignProducts.some((product) => product.id === "paradise-way"));
      assert.ok(requestData.campaignProducts.every((product) => product.availableForSale === false));
    }
    const reply = /(?:prépare|rédige|crée)/i.test(requestData.question)
      ? draftReply
      : normalReply;
    if (forceGeminiCredentialsError) return { ok: false, status: 403 };
    if (transientGeminiStatuses.length) {
      const status = transientGeminiStatuses.shift();
      if (status === "timeout") throw new Error("simulated timeout");
      return { ok: false, status };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          ...reply,
        }) }] } }],
      }),
    };
  };
  try {
    const aiStatus = await (await ai.GET()).json();
    assert.equal(aiStatus.provider, "gemini");
    assert.equal(aiStatus.model, "gemini-3.8-flash");
    assert.equal(aiStatus.fallbackEnabled, true);
    assert.equal(aiStatus.providers.gemini.verified, true);
    assert.equal(aiStatus.providers.groq.verified, true);
    assert.equal(JSON.stringify(aiStatus).includes("local-test-key"), false);
    geminiModelListed = false;
    testNow += 30001;
    const unavailableModelStatus = await (await ai.GET()).json();
    assert.equal(unavailableModelStatus.providers.gemini.status, "model_unavailable");
    assert.equal(unavailableModelStatus.provider, "groq");
    geminiModelListed = true;
    groqModelListed = false;
    testNow += 30001;
    const unavailableGroqStatus = await (await ai.GET()).json();
    assert.equal(unavailableGroqStatus.providers.groq.status, "model_unavailable");
    assert.equal(unavailableGroqStatus.fallbackEnabled, false);
    groqModelListed = true;
    testNow += 60001;

    const geminiResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Propose-moi trois objets d’email élégants.",
    }));
    const geminiResult = await geminiResponse.json();
    assert.equal(geminiResponse.status, 200);
    assert.equal(geminiResult.provider, "gemini");
    assert.equal(geminiResult.fallbackUsed, false);

    const callsBeforeWeeklyStats = aiCalls;
    const expectedWeeklyCount = Number(
      (await query(
        `SELECT count(*)::int AS count FROM mm_subscribers
         WHERE created_at >= (date_trunc('week',now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris')`,
      )).rows[0].count,
    );
    const weeklyStats = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Combien de nouvelles abonnées avons-nous cette semaine ?",
    }));
    const weeklyStatsResult = await weeklyStats.json();
    assert.equal(weeklyStatsResult.source, "postgres");
    assert.match(weeklyStatsResult.reply, new RegExp(String(expectedWeeklyCount)));
    assert.equal(aiCalls, callsBeforeWeeklyStats);

    const groqTestKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    await query("DELETE FROM mm_rate_limits");
    const geminiOnlyResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Propose trois objets d’email élégants.",
    }));
    assert.equal(geminiOnlyResponse.status, 200);
    assert.equal((await geminiOnlyResponse.json()).provider, "gemini");
    process.env.GROQ_API_KEY = groqTestKey;

    for (const prompt of [
      "Prépare une campagne de lancement pour notre collection.",
      "Rédige une newsletter professionnelle.",
      "Crée un brouillon de campagne marketing.",
    ]) {
      await query("DELETE FROM mm_rate_limits");
      const draftResponseForPrompt = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
        message: prompt,
      }));
      const draftResultForPrompt = await draftResponseForPrompt.json();
      assert.equal(draftResponseForPrompt.status, 200);
      assert.equal(draftResultForPrompt.createdDraft, true);
      assert.equal(
        (await query("SELECT status FROM mm_campaigns WHERE id=$1", [draftResultForPrompt.draftId])).rows[0].status,
        "draft",
      );
      assert.equal(
        (await query("SELECT count(*)::int AS count FROM mm_jobs WHERE campaign_id=$1", [draftResultForPrompt.draftId])).rows[0].count,
        0,
      );
      const savedProducts = (await query("SELECT products FROM mm_campaigns WHERE id=$1", [draftResultForPrompt.draftId])).rows[0].products;
      assert.equal(savedProducts.length, 1);
      assert.equal(savedProducts[0].id, "modest-era");
      assert.equal(savedProducts[0].url, "https://example.test/product/modest-era");
      assert.ok(savedProducts[0].image.startsWith("https://example.test/"));
    }

    testNow += 60001;
    transientGeminiStatuses = [503, 503];
    const callsBeforeFallback = aiCalls;
    const draftResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Prépare une campagne de lancement",
    }));
    const draftResult = await draftResponse.json();
    assert.equal(aiCalls - callsBeforeFallback, 3);
    assert.equal(draftResult.provider, "groq");
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

    for (const transient of [429, 500, 502, 503, 504, "timeout"]) {
      testNow += 60001;
      await query("DELETE FROM mm_rate_limits");
      transientGeminiStatuses = [transient, transient];
      const before = aiCalls;
      const fallbackResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
        message: "Propose une idée de communication.",
      }));
      const fallbackResult = await fallbackResponse.json();
      assert.equal(fallbackResponse.status, 200);
      assert.equal(aiCalls - before, 3);
      assert.equal(fallbackResult.provider, "groq");
      assert.equal(fallbackResult.fallbackUsed, true);
    }

    for (const inaccessibleModelStatus of [400, 404]) {
      testNow += 60001;
      await query("DELETE FROM mm_rate_limits");
      transientGeminiStatuses = [inaccessibleModelStatus];
      const before = aiCalls;
      const modelFallback = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
        message: "Propose une idée de communication.",
      }));
      const modelFallbackResult = await modelFallback.json();
      assert.equal(modelFallback.status, 200);
      assert.equal(aiCalls - before, 2);
      assert.equal(modelFallbackResult.provider, "groq");
      assert.equal(modelFallbackResult.fallbackUsed, true);
    }

    testNow += 60001;
    await query("DELETE FROM mm_rate_limits");
    transientGeminiStatuses = [503, 503];
    forceGroqUnavailable = true;
    const callsBeforeBothUnavailable = aiCalls;
    const bothUnavailableResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Propose une idée de communication.",
    }));
    const bothUnavailable = await bothUnavailableResponse.json();
    assert.equal(bothUnavailableResponse.status, 503);
    assert.match(bothUnavailable.error, /Gemini est momentanément indisponible/);
    assert.match(bothUnavailable.error, /relais Groq : Groq est momentanément indisponible/);
    assert.equal(aiCalls - callsBeforeBothUnavailable, 3);
    const callsWithBothCircuitsOpen = aiCalls;
    await query("DELETE FROM mm_rate_limits");
    const fastCircuitResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Propose une idée de communication.",
    }));
    assert.equal(fastCircuitResponse.status, 503);
    assert.equal(aiCalls, callsWithBothCircuitsOpen);
    forceGroqUnavailable = false;

    testNow += 60001;
    await query("DELETE FROM mm_rate_limits");
    delete process.env.GEMINI_API_KEY;
    const groqStatus = await (await ai.GET()).json();
    assert.equal(groqStatus.provider, "groq");
    assert.equal(groqStatus.model, "openai/gpt-oss-120b");
    const groqResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Propose une idée de communication.",
    }));
    const groqResult = await groqResponse.json();
    assert.equal(groqResponse.status, 200);
    assert.equal(groqResult.provider, "groq");
    assert.equal(groqResult.fallbackUsed, false);
    process.env.GEMINI_API_KEY = "local-test-key";

    forceGeminiCredentialsError = true;
    await query("DELETE FROM mm_rate_limits");
    const callsBeforeCredentialFallback = aiCalls;
    const credentialFallback = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Propose une idée de communication.",
    }));
    const credentialFallbackResult = await credentialFallback.json();
    assert.equal(credentialFallback.status, 200);
    assert.equal(credentialFallbackResult.provider, "groq");
    assert.equal(aiCalls - callsBeforeCredentialFallback, 2);
    forceGeminiCredentialsError = false;
    testNow += 60001;

    await query("DELETE FROM mm_rate_limits");
    const callsBeforePii = aiCalls;
    const piiResponse = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Écris à cliente@example.test",
    }));
    assert.equal(piiResponse.status, 400);
    assert.equal(aiCalls, callsBeforePii);
    delete process.env.GROQ_API_KEY;
    forceGeminiCredentialsError = true;
    await query("DELETE FROM mm_rate_limits");
    const callsBeforeCredentialError = aiCalls;
    const providerError = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Propose trois objets d’email élégants.",
    }));
    assert.equal(providerError.status, 502);
    assert.match((await providerError.json()).error, /autorisations Gemini/);
    assert.equal(aiCalls - callsBeforeCredentialError, 1);
    forceGeminiCredentialsError = false;
    testNow += 60001;
    await query("DELETE FROM mm_rate_limits");
    for (let call = 1; call <= 20; call++) {
      const limitedRequest = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
        message: "Propose trois objets d’email élégants.",
      }));
      assert.equal(limitedRequest.status, 200);
    }
    const overLimit = await ai.POST(req("https://example.test/api/admin/miroir-ai", "POST", {
      message: "Propose un objet d’email.",
    }));
    assert.equal(overLimit.status, 429);
  } finally {
    global.fetch = originalFetch;
    Date.now = originalDateNow;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_MODEL;
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

  const newsletter = load("app/api/admin/newsletter/route.ts");
  const campaignFields = {
    title: "Launch MAISON MIROIR",
    subject: "Maison Miroir subject",
    preheader: "Maison Miroir preview",
    body: "Maison Miroir body",
    imageUrl: "",
    linkUrl: "",
    promoCode: "",
    endsAt: "",
    productIds: [],
  };
  const createdResponse = await newsletter.POST(
    req("https://example.test/api/admin/newsletter", "POST", {
      action: "create",
      ...campaignFields,
    }),
  );
  assert.equal(createdResponse.status, 200);
  const sourceCampaignId = (await createdResponse.json()).id;
  const updatedResponse = await newsletter.POST(
    req("https://example.test/api/admin/newsletter", "POST", {
      action: "update",
      id: sourceCampaignId,
      ...campaignFields,
      title: "Updated launch Maison Miroir",
      body: "Updated body Maison Miroir",
    }),
  );
  assert.equal(updatedResponse.status, 200);
  const updatedRow = (
    await query("SELECT title,body,status FROM mm_campaigns WHERE id=$1", [
      sourceCampaignId,
    ])
  ).rows[0];
  assert.deepEqual(updatedRow, {
    title: "Updated launch MAISON MIROIR",
    body: "Updated body MAISON MIROIR",
    status: "draft",
  });
  const previewResponse = await newsletter.POST(
    req("https://example.test/api/admin/newsletter", "POST", {
      action: "preview",
      id: sourceCampaignId,
    }),
  );
  assert.equal(previewResponse.status, 200);
  assert.equal((await previewResponse.json()).html, "<html>preview</html>");
  const duplicatedResponse = await newsletter.POST(
    req("https://example.test/api/admin/newsletter", "POST", {
      action: "duplicate",
      id: sourceCampaignId,
    }),
  );
  assert.equal(duplicatedResponse.status, 200);
  const duplicated = await duplicatedResponse.json();
  const duplicateRow = (
    await query("SELECT * FROM mm_campaigns WHERE id=$1", [duplicated.id])
  ).rows[0];
  assert.equal(duplicateRow.title, "Updated launch MAISON MIROIR - Copie");
  assert.equal(duplicateRow.subject, "MAISON MIROIR subject");
  assert.equal(duplicateRow.status, "draft");
  await query(
    "UPDATE mm_campaigns SET title=$1,subject=$2,preheader=$3,body=$4 WHERE id=$5",
    [
      "Legacy Maison Miroir title",
      "Legacy Maison Miroir subject",
      "Legacy Maison Miroir preview",
      "Legacy Maison Miroir body",
      sourceCampaignId,
    ],
  );
  const campaignList = await (await newsletter.GET()).json();
  const listedCampaign = campaignList.campaigns.find(
    (campaign) => campaign.id === sourceCampaignId,
  );
  assert.equal(listedCampaign.title, "Legacy MAISON MIROIR title");
  assert.equal(listedCampaign.subject, "Legacy MAISON MIROIR subject");
  assert.equal(listedCampaign.preheader, "Legacy MAISON MIROIR preview");
  assert.equal(listedCampaign.body, "Legacy MAISON MIROIR body");
  const testResponse = await newsletter.POST(
    req("https://example.test/api/admin/newsletter", "POST", {
      action: "send-test",
      id: sourceCampaignId,
    }),
  );
  assert.deepEqual(await testResponse.json(), {
    providerId: "fake-test-1",
    recipient: "admin@example.test",
  });

  authorized = false;
  assert.equal((await dashboard.GET()).status, 401);
  assert.equal((await subscribers.GET(req("https://example.test/api/admin/subscribers"))).status, 401);
  assert.equal((await exportRoute.GET(req("https://example.test/api/admin/subscribers/export"))).status, 401);
  assert.equal((await calendar.GET()).status, 401);
  assert.equal((await settings.GET()).status, 401);
  assert.equal((await ai.GET()).status, 401);
  assert.equal(
    (
      await newsletter.POST(
        req("https://example.test/api/admin/newsletter", "POST", {
          action: "duplicate",
          id: sourceCampaignId,
        }),
      )
    ).status,
    401,
  );
  console.log("PASS: authenticated admin dashboard aggregates, subscriber filters/history/export/erasure, campaign duplication and test-email routing, persisted calendar and allowlisted settings, Miroir AI draft-only flow, PII rejection, Gemini, Groq, transient retry/fallback, provider error reporting and rate limits. All campaign and email operations used isolated fixtures.");
  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
