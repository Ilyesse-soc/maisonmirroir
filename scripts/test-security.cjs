const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory()
      ? filesBelow(filename)
      : filename.endsWith("route.ts")
        ? [filename]
        : [];
  });
}
async function main() {
  const db = new PGlite();
  for (const file of fs
    .readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(fs.readFileSync("migrations/" + file, "utf8"));
  const query = async (sql, params) => {
    const r = await db.query(sql, params);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  };
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
  const sent = [];
  const retractionEmails = [];
  const cache = new Map();
  const mocked = { database: () => ({ query }), transaction };
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = module.paths;
    cache.set(filename, mod);
    mod.require = (id) => {
      if (id === "server-only") return {};
      if (id === "./newsletterDb") return mocked;
      if (id === "@/lib/newsletterDb") return mocked;
      if (id === "@/lib/requestSecurity") return load("lib/requestSecurity.ts");
      if (id === "@/lib/commerceInventory")
        return {
          sendCommerceEmailOnce: async (message) => {
            retractionEmails.push(message);
          },
        };
      if (id === "@/lib/observability") return { securityEvent: () => {} };
      if (id === "./email")
        return {
          getEmailFrom: () => "sender@example.test",
          getResendClient: () => ({
            emails: {
              send: async (payload, options) => {
                sent.push({ payload, options });
                return {
                  data: {
                    id: "00000000-0000-4000-8000-00000000000" + sent.length,
                  },
                };
              },
            },
          }),
        };
      if (id === "./newsletter")
        return {
          escapeHtml: (s) => s.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
          siteUrl: () => "https://example.test",
        };
      if (id.startsWith(".")) {
        const target = path.resolve(path.dirname(filename), id);
        if (fs.existsSync(target + ".ts")) return load(target + ".ts");
        return require(target);
      }
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
  process.env.NODE_ENV = "production";
  process.env.SHOP_OPEN = "true";
  process.env.NEWSLETTER_SITE_URL = "https://example.test";
  const carts = load("lib/abandonedCarts.ts");
  const items = [
    { id: "bag", name: "<script>bad()</script>", quantity: 1, unitPrice: 35 },
  ];
  const token = await carts.upsertCart(
    undefined,
    items,
    "one",
    "shopper@example.test",
    false,
  );
  assert.equal(await carts.queueCartReminders(), 0);
  await carts.upsertCart(token, items, "one", "shopper@example.test", true);
  await query("UPDATE mm_carts SET updated_at=now()-interval '49 hours'");
  const before = (await query("SELECT updated_at FROM mm_carts")).rows[0]
    .updated_at;
  await carts.upsertCart(token, items, "one");
  assert.equal(
    String((await query("SELECT updated_at FROM mm_carts")).rows[0].updated_at),
    String(before),
  );
  assert.equal(await carts.queueCartReminders(), 1);
  assert.equal(await carts.queueCartReminders(), 0);
  assert.equal(await carts.processCartReminders(), 1);
  assert.equal(sent.length, 1);
  assert(sent[0].payload.html.includes("&lt;script&gt;"));
  assert(!sent[0].payload.html.includes("<script>"));
  assert(
    sent[0].payload.headers["List-Unsubscribe"].includes(
      "/api/cart/unsubscribe",
    ),
  );
  await carts.processCartReminders();
  assert.equal(sent.length, 1);
  const job = (await query("SELECT * FROM mm_cart_reminders")).rows[0];
  await query(
    "INSERT INTO mm_webhook_receipts(event_id,provider_id,event_type,occurred_at) VALUES('evt1',$1,'email.delivered',now())",
    [job.provider_id],
  );
  const delivery = load("lib/deliveryEvents.ts");
  await delivery.reconcileDelivery(job.provider_id);
  assert.equal(
    (await query("SELECT status FROM mm_cart_reminders")).rows[0].status,
    "delivered",
  );
  await carts.upsertCart(
    token,
    [...items, { id: "bag", name: "Bag", quantity: 2, unitPrice: 35 }],
    "two",
  );
  await query("UPDATE mm_carts SET updated_at=now()-interval '49 hours'");
  assert.equal(await carts.queueCartReminders(), 1);
  await carts.markCartOrdered(token);
  assert.equal(
    (await query("SELECT status FROM mm_carts")).rows[0].status,
    "ordered",
  );
  assert.equal(
    (
      await query(
        "SELECT count(*) FROM mm_cart_reminders WHERE status IN ('pending','retry')",
      )
    ).rows[0].count,
    0,
  );
  const { NextRequest } = require("next/server"),
    requestSecurity = load("lib/requestSecurity.ts");
  process.env.BETTER_AUTH_SECRET = "security-regression-secret";
  const retractionOrderId = "MM-2026-AB123456",
    retractionPayPalId = "PAYPAL-RETRACTION-TEST";
  await query(
    "INSERT INTO mm_orders(order_id,paypal_order_id,record) VALUES($1,$2,$3)",
    [
      retractionOrderId,
      retractionPayPalId,
      JSON.stringify({
        orderId: retractionOrderId,
        orderDate: "2026-11-26T00:00:00.000Z",
        customer: { firstName: "Synthetic", email: "owner@example.test" },
      }),
    ],
  );
  await query(
    `INSERT INTO mm_commerce_order_financials
      (order_id,paypal_order_id,payment_status,subtotal_cents,shipping_cents,total_cents)
     VALUES($1,$2,'paid',100,0,100)`,
    [retractionOrderId, retractionPayPalId],
  );
  const retraction = load("app/api/retractation/route.ts");
  const retractionRequest = (email) =>
    new NextRequest("https://example.test/api/retractation", {
      method: "POST",
      headers: {
        origin: "https://example.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        orderId: retractionOrderId,
        email,
        confirmRetraction: true,
      }),
    });
  const otherCustomer = await retraction.POST(
    retractionRequest("other@example.test"),
  );
  assert.equal(otherCustomer.status, 202);
  assert.equal(
    (
      await query(
        "SELECT count(*)::int AS count FROM mm_commerce_withdrawal_requests WHERE order_id=$1",
        [retractionOrderId],
      )
    ).rows[0].count,
    0,
  );
  assert.equal(retractionEmails.length, 0);
  const orderOwner = await retraction.POST(
    retractionRequest("owner@example.test"),
  );
  assert.equal(orderOwner.status, 202);
  assert.equal(
    (
      await query(
        "SELECT count(*)::int AS count FROM mm_commerce_withdrawal_requests WHERE order_id=$1",
        [retractionOrderId],
      )
    ).rows[0].count,
    1,
  );
  assert.equal(retractionEmails.length, 1);
  const adminApiRoutes = filesBelow("app/api/admin");
  assert(adminApiRoutes.length >= 20);
  for (const filename of adminApiRoutes) {
    assert.match(
      fs.readFileSync(filename, "utf8"),
      /\badminDenied\s*\(/,
      `${filename} must invoke the server-side admin guard`,
    );
  }
  assert.match(
    fs.readFileSync("app/admin/layout.tsx", "utf8"),
    /await requireAdminPage\(\)/,
  );
  assert.equal(
    requestSecurity.mutationAllowed(
      new NextRequest("https://example.test/api", {
        method: "POST",
        headers: {
          origin: "https://attacker.test",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    ).status,
    403,
  );
  assert.equal(
    requestSecurity.mutationAllowed(
      new NextRequest("https://example.test/api", {
        method: "POST",
        headers: {
          origin: "null",
          "sec-fetch-site": "same-origin",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "token=test",
      }),
      false,
    ),
    null,
  );
  assert.equal(
    requestSecurity.mutationAllowed(
      new NextRequest("https://example.test/api", {
        method: "POST",
        headers: {
          origin: "null",
          "sec-fetch-site": "cross-site",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "token=test",
      }),
      false,
    ).status,
    403,
  );
  assert.equal(
    requestSecurity.mutationAllowed(
      new NextRequest("https://example.test/api", {
        method: "POST",
        headers: {
          origin: "https://example.test",
          "content-type": "text/plain",
        },
        body: "{}",
      }),
    ).status,
    415,
  );
  const schemas = load("lib/newsletterSchemas.ts");
  const campaignId = "11111111-1111-4111-8111-111111111111";
  assert.equal(
    schemas.campaignSchema.safeParse({
      action: "duplicate",
      id: campaignId,
    }).success,
    true,
  );
  assert.equal(
    schemas.campaignSchema.safeParse({
      action: "send-test",
      id: campaignId,
    }).success,
    true,
  );
  assert.equal(
    schemas.campaignSchema.safeParse({
      action: "send-test",
      id: campaignId,
      to: "attacker@example.test",
    }).success,
    false,
  );
  assert.equal(
    schemas.signupSchema.safeParse({
      email: "valid@example.test",
      consent: true,
      role: "admin",
    }).success,
    false,
  );
  assert.equal(
    schemas.signupSchema.safeParse({
      email: "valid@example.test",
      consent: false,
    }).success,
    false,
  );
  const big = new Request("https://example.test/api", {
    method: "POST",
    body: "x".repeat(5000),
  });
  await assert.rejects(
    () => requestSecurity.readBoundedText(big, 1000),
    (e) => e.status === 413,
  );
  const { proxy } = load("proxy.ts");
  const response = proxy(new NextRequest("https://example.test/"));
  const csp = response.headers.get("content-security-policy");
  assert(csp.includes("'nonce-"));
  assert(!csp.includes("'unsafe-eval'"));
  assert(csp.includes("frame-ancestors 'none'"));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const commerce = load("lib/commerceSecurity.ts");
  const catalogue = load("lib/products.ts");
  assert.throws(() =>
    commerce.canonicalItems([
      {
        id: "tote-bag-premium",
        name: "Forged",
        category: "fake",
        unitPrice: 0.01,
        quantity: 1,
      },
    ]),
  );
  for (const quantity of [-1, 0, 1.5, 1001, NaN, Infinity, "1"]) {
    assert.throws(() =>
      commerce.canonicalItems([
        {
          id: "modest-era",
          name: "Modest Era",
          category: "sacs",
          unitPrice: 29.9,
          quantity,
        },
      ]),
    );
  }
  assert.throws(() =>
    commerce.canonicalItems([
      {
        id: "tote-bag-premium",
        name: "Tote Bag Premium",
        category: "fake",
        unitPrice: 35,
        quantity: 1,
      },
    ]),
  );
  assert.throws(() =>
    commerce.canonicalItems([
      {
        id: "modest-era",
        name: "Forged",
        category: "fake",
        unitPrice: 29.9,
        quantity: 1,
      },
    ]),
  );
  const modestEra = catalogue.products.find(
    (product) => product.id === "modest-era",
  );
  assert(modestEra);
  modestEra.availableForSale = true;
  const canonical = commerce.canonicalItems([
    {
      id: "modest-era",
      name: "Forged",
      category: "fake",
      unitPrice: 29.9,
      quantity: 1,
    },
  ])[0];
  assert.equal(canonical.name, "Modest Era");
  assert.equal(canonical.category, "sacs");
  modestEra.availableForSale = false;
  console.log(
    "PASS: persistent carts across refresh, consent, 48-hour eligibility, deduplication, private-recipient reminder with mocked provider, delivery events, cancellation after order, retraction ownership, all admin page/API guards, CSRF, content type, strict schemas, streamed size bounds, production CSP, canonical prices and invalid quantities. No real email or payment.",
  );
  await db.close();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
