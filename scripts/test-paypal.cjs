const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
const { NextRequest } = require("next/server");

function loadTypeScript(filename, overrides = {}) {
  const resolved = path.resolve(filename);
  const mod = new Module(resolved, module);
  mod.filename = resolved;
  mod.paths = module.paths;
  mod.require = (id) => {
    if (Object.hasOwn(overrides, id)) return overrides[id];
    if (id === "server-only") return {};
    if (id.startsWith(".")) {
      const target = path.resolve(path.dirname(resolved), id);
      if (fs.existsSync(target + ".ts"))
        return loadTypeScript(target + ".ts", overrides);
    }
    return require(id);
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(resolved, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    resolved,
  );
  return mod.exports;
}

async function main() {
  process.env.PAYPAL_ENV = "production";
  process.env.PAYPAL_CLIENT_ID = "unit-production-client-id";
  process.env.PAYPAL_CLIENT_SECRET = "unit-production-client-secret";
  process.env.PAYPAL_MERCHANT_ID = "unit-production-merchant-id";
  process.env.PAYPAL_WEBHOOK_ID = "unit-production-webhook-id";

  const originalFetch = global.fetch;
  let orderStatus = "COMPLETED";
  let merchantId = "unit-production-merchant-id";
  let capturedAmount = "40.00";
  let signatureStatus = "SUCCESS";
  const calls = [];
  global.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/v1/oauth2/token"))
      return Response.json({ access_token: "unit-access-token" });
    if (url.endsWith("/v2/checkout/orders"))
      return Response.json({ id: "PRODORDER0001" });
    if (url.endsWith("/v2/checkout/orders/PROD-ORDER-01"))
      return Response.json({
        id: "PROD-ORDER-01",
        status: orderStatus,
        purchase_units: [
          {
            payee: { merchant_id: merchantId },
            payments: {
              captures: [
                {
                  status: "COMPLETED",
                  amount: { currency_code: "EUR", value: capturedAmount },
                },
              ],
            },
          },
        ],
      });
    if (url.endsWith("/v1/notifications/verify-webhook-signature"))
      return Response.json({ verification_status: signatureStatus });
    throw new Error("Unexpected PayPal URL");
  };

  const commerce = loadTypeScript("lib/commerceSecurity.ts");
  try {
    assert.equal(commerce.getPayPalProductionStatus().configured, true);
    assert.equal(
      await commerce.createPayPalCheckoutOrder({
        totalCents: 10425,
        subtotalCents: 10000,
        shippingCents: 425,
        items: [
          { name: "Modest Era", quantity: 1, unitPriceCents: 10000 },
        ],
        customer: {
          firstName: "Test",
          lastName: "Client",
          street: "2 rue de test",
          city: "Paris",
          zip: "75001",
          country: "France",
        },
      }),
      "PRODORDER0001",
    );
    const creationCall = calls.find((call) =>
      call.url.endsWith("/v2/checkout/orders"),
    );
    const creationBody = JSON.parse(creationCall.init.body);
    assert.equal(
      creationBody.purchase_units[0].amount.value,
      "104.25",
    );
    assert.equal(
      creationBody.purchase_units[0].amount.breakdown.shipping.value,
      "4.25",
    );
    assert.equal(
      await commerce.verifiedPayPalOrder("PROD-ORDER-01", 40),
      true,
    );
    assert(
      calls.every((call) =>
        call.url.startsWith("https://api-m.paypal.com/"),
      ),
    );

    await assert.rejects(
      commerce.verifiedPayPalOrder("PROD-ORDER-01", 41),
      /PAYMENT_AMOUNT_MISMATCH/,
    );
    capturedAmount = "40.00";
    merchantId = "different-merchant";
    await assert.rejects(
      commerce.verifiedPayPalOrder("PROD-ORDER-01", 40),
      /PAYMENT_MERCHANT_MISMATCH/,
    );
    merchantId = "unit-production-merchant-id";
    orderStatus = "APPROVED";
    await assert.rejects(
      commerce.verifiedPayPalOrder("PROD-ORDER-01", 40),
      /PAYMENT_NOT_COMPLETED/,
    );
    orderStatus = "VOIDED";
    await assert.rejects(
      commerce.verifiedPayPalOrder("PROD-ORDER-01", 40),
      /PAYMENT_NOT_COMPLETED/,
    );
    orderStatus = "COMPLETED";
    process.env.PAYPAL_ENV = "";
    await assert.rejects(
      commerce.verifiedPayPalOrder("PROD-ORDER-01", 40),
      /PAYMENT_ENV_NOT_CONFIGURED/,
    );
    process.env.PAYPAL_ENV = "production";

    const headers = {
      authAlgo: "SHA256withRSA",
      certUrl: "https://api-m.paypal.com/cert",
      transmissionId: "production-transmission",
      transmissionSignature: "production-signature",
      transmissionTime: new Date().toISOString(),
    };
    const event = {
      id: "WH-PROD-01",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      create_time: new Date().toISOString(),
      resource: { id: "CAPTURE-PROD-01" },
    };
    assert.equal(await commerce.verifyPayPalWebhook(headers, event), true);
    signatureStatus = "FAILURE";
    await assert.rejects(
      commerce.verifyPayPalWebhook(headers, event),
      /PAYPAL_WEBHOOK_SIGNATURE_INVALID/,
    );
    signatureStatus = "SUCCESS";

    const db = new PGlite();
    for (const file of fs
      .readdirSync("migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort())
      await db.exec(fs.readFileSync(path.join("migrations", file), "utf8"));

    const database = () => ({
      query: (sql, params) => db.query(sql, params),
    });
    const route = loadTypeScript("app/api/paypal/webhook/route.ts", {
      "@/lib/commerceSecurity": {
        verifyPayPalWebhook: async (_headers, receivedEvent) => {
          if (receivedEvent.id === "WH-INVALID")
            throw new Error("PAYPAL_WEBHOOK_SIGNATURE_INVALID");
          return true;
        },
      },
      "@/lib/newsletterDb": { database },
      "@/lib/requestSecurity": {
        readBoundedText: async (request, maxBytes) => {
          const text = await request.text();
          if (Buffer.byteLength(text) > maxBytes)
            throw new Error("REQUEST_TOO_LARGE");
          return text;
        },
      },
      "@/lib/observability": { securityEvent: () => {} },
    });

    function webhookRequest(receivedEvent) {
      return new NextRequest("https://example.test/api/paypal/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "paypal-auth-algo": "SHA256withRSA",
          "paypal-cert-url": "https://api-m.paypal.com/cert",
          "paypal-transmission-id": "production-transmission",
          "paypal-transmission-sig": "production-signature",
          "paypal-transmission-time": new Date().toISOString(),
        },
        body: JSON.stringify(receivedEvent),
      });
    }

    const accepted = await route.POST(webhookRequest(event));
    assert.equal(accepted.status, 200);
    const duplicate = await route.POST(webhookRequest(event));
    assert.equal(duplicate.status, 200);
    let rows = await db.query(
      "SELECT event_id,provider_id,event_type FROM mm_webhook_receipts WHERE event_id=$1",
      ["paypal:WH-PROD-01"],
    );
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].provider_id, "CAPTURE-PROD-01");

    const approved = {
      id: "WH-PROD-02",
      event_type: "CHECKOUT.ORDER.APPROVED",
      create_time: new Date().toISOString(),
      resource: { id: "PROD-ORDER-02" },
    };
    assert.equal((await route.POST(webhookRequest(approved))).status, 200);
    const cancelled = {
      id: "WH-PROD-03",
      event_type: "CHECKOUT.ORDER.VOIDED",
      create_time: new Date().toISOString(),
      resource: { id: "PROD-ORDER-03" },
    };
    assert.equal((await route.POST(webhookRequest(cancelled))).status, 200);
    assert.equal(
      (
        await db.query(
          "SELECT event_id FROM mm_webhook_receipts WHERE event_id=$1",
          ["paypal:WH-PROD-03"],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (await route.POST(webhookRequest({ ...event, id: "WH-INVALID" }))).status,
      400,
    );
    rows = await db.query("SELECT event_id FROM mm_webhook_receipts");
    assert.equal(rows.rows.length, 3);

    await db.close();
    console.log(
      "PASS: production API URL selection, completed-order amount and merchant checks, rejection of uncompleted orders, webhook signature verification, idempotent PostgreSQL webhook receipts, and cancellation event handling. All PayPal calls were mocked; no real payment or external request was made.",
    );
  } finally {
    global.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
