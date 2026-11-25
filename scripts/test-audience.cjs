const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
const { NextRequest } = require("next/server");

async function main() {
  process.env.NEWSLETTER_HASH_SECRET =
    "audience-tests-use-a-long-random-secret-value";
  const db = new PGlite();
  for (const file of fs
    .readdirSync("migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await db.exec(fs.readFileSync(path.join("migrations", file), "utf8"));

  const query = async (sql, params) => {
    const result = await db.query(sql, params);
    return {
      ...result,
      rowCount: result.rows.length || result.affectedRows || 0,
    };
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
      if (id === "@/lib/newsletterDb") return { database: () => pool, transaction };
      if (id === "@/lib/requestSecurity") return requestSecurity;
      if (id === "@/lib/audience") return load("lib/audience.ts");
      if (id === "@/lib/observability") return { securityEvent() {} };
      if (id === "@/lib/adminAuth")
        return { adminDenied: async () => null };
      if (id.startsWith("@/"))
        throw new Error(`Unexpected audience import: ${id}`);
      return require(id);
    };
    mod._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      filename,
    );
    return mod.exports;
  }

  function makeRequest(pathname, method, body, userAgent = "Mozilla/5.0") {
    const url = `https://store.example${pathname}`;
    return new NextRequest(url, {
      method,
      headers: {
        origin: "https://store.example",
        "content-type": "application/json",
        "user-agent": userAgent,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  const audience = load("lib/audience.ts");
  const privacyConsent = load("lib/privacyConsent.ts");
  const savedAt = Date.UTC(2026, 10, 25, 12);
  const acceptedPreferences = privacyConsent.createPrivacyPreferences(
    true,
    savedAt,
  );
  const rejectedPreferences = privacyConsent.createPrivacyPreferences(
    false,
    savedAt,
  );
  assert.equal(acceptedPreferences.essential, true);
  assert.equal(
    new Date(acceptedPreferences.expiresAt).toISOString().slice(0, 10),
    "2027-05-25",
  );
  assert.equal(
    privacyConsent.parsePrivacyPreferences(
      JSON.stringify(acceptedPreferences),
      savedAt,
    )?.audience,
    true,
  );
  assert.equal(
    privacyConsent.parsePrivacyPreferences(
      JSON.stringify(rejectedPreferences),
      acceptedPreferences.expiresAt,
    ),
    null,
  );
  assert.equal(
    privacyConsent.parsePrivacyPreferences(
      JSON.stringify({
        ...acceptedPreferences,
        audience: true,
        essential: false,
      }),
      savedAt,
    ),
    null,
  );
  const issued = audience.createAudienceToken();
  assert.ok(audience.verifyAudienceToken(issued.token));
  assert.equal(
    audience.verifyAudienceToken(`${issued.token.slice(0, -1)}x`),
    null,
  );
  assert.equal(audience.normalizeAudiencePath("/product/modest-era"), "/product/modest-era");
  assert.equal(audience.normalizeAudiencePath("/api/health"), null);
  assert.equal(audience.normalizeAudiencePath("/admin/orders"), null);
  assert.equal(audience.audienceFunnelStage("/panier"), "cart");
  assert.equal(audience.audienceFunnelStage("/checkout"), "checkout");
  assert.equal(audience.isAudienceBot("Googlebot/2.1"), true);

  const sessionRoute = load("app/api/audience/session/route.ts");
  const sessionResponse = await sessionRoute.POST(
    makeRequest("/api/audience/session", "POST", {}),
  );
  assert.equal(sessionResponse.status, 200);
  const session = await sessionResponse.json();
  assert.equal(typeof session.token, "string");
  assert.equal(typeof session.visitorId, "string");

  const heartbeatRoute = load("app/api/audience/heartbeat/route.ts");
  const pageViewId = require("node:crypto").randomUUID();
  const heartbeat = {
    token: session.token,
    path: "/product/modest-era",
    pageViewId,
    hasCartItems: true,
  };
  assert.equal(
    (
      await heartbeatRoute.POST(
        makeRequest("/api/audience/heartbeat", "POST", heartbeat),
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await heartbeatRoute.POST(
        makeRequest("/api/audience/heartbeat", "POST", heartbeat),
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await heartbeatRoute.POST(
        makeRequest(
          "/api/audience/heartbeat",
          "POST",
          { ...heartbeat, path: "/checkout", pageViewId: require("node:crypto").randomUUID() },
        ),
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await heartbeatRoute.POST(
        makeRequest(
          "/api/audience/heartbeat",
          "POST",
          {},
          "Googlebot/2.1",
        ),
      )
    ).status,
    204,
  );

  await query(
    `INSERT INTO mm_commerce_order_financials
      (order_id,paypal_order_id,payment_status,subtotal_cents,shipping_cents,total_cents,paid_at)
     VALUES('MM-2026-TEST0001','PAYPAL-TEST-1','paid',2990,410,3400,now())`,
  );
  const adminRoute = load("app/api/admin/audience/route.ts");
  const metricsResponse = await adminRoute.GET(
    makeRequest("/api/admin/audience", "GET"),
  );
  assert.equal(metricsResponse.status, 200);
  const metrics = await metricsResponse.json();
  assert.equal(metrics.active.visitors, 1);
  assert.equal(metrics.active.checkout, 1);
  assert.equal(metrics.active.cart, 0);
  assert.equal(metrics.today.visitors, 1);
  assert.equal(metrics.today.visits, 1);
  assert.equal(metrics.today.pageViews, 2);
  assert.equal(metrics.today.products["modest-era"], 1);
  assert.equal(metrics.today.paidOrders, 1);
  assert.equal(metrics.today.conversionRate, 100);
  assert.equal(metrics.hourly.length, 24);
  assert.equal(metrics.history.length, 30);

  const consentRoute = load("app/api/audience/consent/route.ts");
  assert.equal(
    (
      await consentRoute.POST(
        makeRequest("/api/audience/consent", "POST", {
          token: session.token,
        }),
      )
    ).status,
    204,
  );
  const afterWithdrawal = await adminRoute.GET(
    makeRequest("/api/admin/audience", "GET"),
  );
  const withdrawnMetrics = await afterWithdrawal.json();
  assert.equal(withdrawnMetrics.active.visitors, 0);
  assert.equal(withdrawnMetrics.today.visitors, 0);

  await db.close();
  console.log("Audience consent, privacy, deduplication, and metrics tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
