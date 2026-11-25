const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
const { NextRequest } = require("next/server");

function createLoader(overrides = {}) {
  const cache = new Map();
  function load(filename) {
    const resolved = path.resolve(filename);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const mod = new Module(resolved, module);
    mod.filename = resolved;
    mod.paths = module.paths;
    cache.set(resolved, mod);
    mod.require = (id) => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id === "server-only") return {};
      if (id.startsWith("@/")) {
        const target = path.resolve(process.cwd(), id.slice(2));
        if (fs.existsSync(target + ".ts")) return load(target + ".ts");
      }
      if (id.startsWith(".")) {
        const target = path.resolve(path.dirname(resolved), id);
        if (fs.existsSync(target + ".ts")) return load(target + ".ts");
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
  return load;
}

async function main() {
  process.env.BETTER_AUTH_SECRET = "commerce-test-signing-secret";
  process.env.PAYPAL_ENV = "production";
  process.env.PAYPAL_CLIENT_ID = "test-client";
  process.env.PAYPAL_CLIENT_SECRET = "test-secret";
  process.env.PAYPAL_MERCHANT_ID = "test-merchant";
  process.env.PAYPAL_WEBHOOK_ID = "test-webhook";
  process.env.EMAIL_FROM = "shop@example.test";
  process.env.EMAIL_ADMIN = "owner@example.test";

  const db = new PGlite();
  for (const migration of fs
    .readdirSync("migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await db.exec(fs.readFileSync(path.join("migrations", migration), "utf8"));

  const query = async (sql, params = []) => {
    const result = await db.query(sql, params);
    return {
      ...result,
      rowCount: result.affectedRows ?? result.rows.length,
    };
  };
  let transactionTail = Promise.resolve();
  const transaction = async (callback) => {
    let release;
    const previous = transactionTail;
    transactionTail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    await db.exec("BEGIN");
    try {
      const result = await callback({ query });
      await db.exec("COMMIT");
      return result;
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    } finally {
      release();
    }
  };
  const database = () => ({ query });
  const emails = [];
  let failingEmailRecipient = "";
  const emailMock = {
    getEmailFrom: () => "shop@example.test",
    getAdminEmail: () => "owner@example.test",
    sendEmailOrThrow: async (message) => {
      emails.push(message);
      if (
        failingEmailRecipient &&
        (Array.isArray(message.to)
          ? message.to.includes(failingEmailRecipient)
          : message.to === failingEmailRecipient)
      ) {
        failingEmailRecipient = "";
        throw new Error("MOCK_EMAIL_DELIVERY_UNKNOWN");
      }
      return { data: { id: `email-${emails.length}` } };
    },
    normalizeEmailError: (error) =>
      error instanceof Error ? error.message : "EMAIL_FAILED",
  };
  const loadInventory = createLoader({
    "@/lib/newsletterDb": { database, transaction },
    "@/lib/email": emailMock,
  });
  const inventory = loadInventory("lib/commerceInventory.ts");
  const mondialRelaySettings = loadInventory("lib/mondialRelaySettings.ts");
  const mondialRelayTypes = loadInventory("lib/mondialRelayTypes.ts");
  const savedShippingEnv = {};
  const shippingEnv = {
    MONDIAL_RELAY_API1_PROD_SHOP: "test-shop",
    MONDIAL_RELAY_API1_PROD_PRIVATE_KEY: "test-private-key",
    MONDIAL_RELAY_API2_PROD_LOGIN: "test-login",
    MONDIAL_RELAY_API2_PROD_PASSWORD: "test-password",
    MONDIAL_RELAY_API2_PROD_CUSTOMER_ID: "test-customer",
    MONDIAL_RELAY_API2_PROD_URL:
      "https://connect-api.mondialrelay.com/api/shipment",
    MONDIAL_RELAY_API1_PROD_ENABLED: "true",
    MONDIAL_RELAY_API2_PROD_ENABLED: "true",
    MONDIAL_RELAY_PRODUCTION_CONFIRMED: "false",
    REAL_SHIPPING_ENABLED: "true",
    REAL_SHIPMENT_CREATION_ENABLED: "true",
  };
  for (const [key, value] of Object.entries(shippingEnv)) {
    savedShippingEnv[key] = process.env[key];
    process.env[key] = value;
  }
  const relaySettings = {
    ...mondialRelayTypes.DEFAULT_MONDIAL_RELAY_SETTINGS,
    allowedServices: ["24R/MED"],
    contractConfirmed: true,
    serviceConfirmed: false,
    collectionMode: "LOCKER",
    collectionModeConfirmed: false,
    sender: {
      company: "Maison Miroir",
      firstName: "Test",
      lastName: "Sender",
      street: "1 rue Test",
      houseNo: "1",
      postalCode: "75001",
      city: "Paris",
      countryCode: "FR",
      phone: "+33123456789",
      email: "sender@example.test",
    },
    contractParcel: {
      itemsPerParcel: 1,
      weightGrams: 500,
      lengthCm: 45,
      widthCm: 40,
      depthCm: 5,
    },
    contractRates: [
      {
        serviceCode: "24R/MED",
        maxWeightGrams: 30000,
        priceCents: 425,
        priceBasis: "TTC",
        customerPriceCents: 425,
        confirmed: true,
      },
    ],
    proposedRate: {
      serviceCode: "24R/MED",
      maxWeightGrams: null,
      priceCents: 425,
      priceBasis: "unknown",
      customerPriceCents: null,
      confirmed: false,
    },
  };
  const api1OnlyReadiness =
    mondialRelaySettings.getMondialRelayProductionReadiness(relaySettings);
  assert.equal(api1OnlyReadiness.api1Ready, true);
  assert.equal(api1OnlyReadiness.searchEnabled, true);
  assert.equal(api1OnlyReadiness.checkoutShippingReady, true);
  assert.equal(api1OnlyReadiness.api2Ready, false);
  assert.equal(api1OnlyReadiness.shipmentCreationEnabled, false);
  assert.equal(api1OnlyReadiness.manualShippingReady, false);
  assert.equal(
    mondialRelaySettings.getMondialRelayProductionReadiness({
      ...relaySettings,
      manualConnectConfirmed: true,
    }).manualShippingReady,
    true,
  );
  assert.equal(
    mondialRelaySettings.getMondialRelayProductionReadiness({
      ...relaySettings,
      serviceConfirmed: true,
      collectionModeConfirmed: false,
    }).checkoutShippingReady,
    true,
  );
  for (const key of Object.keys(shippingEnv)) {
    if (savedShippingEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedShippingEnv[key];
  }
  const submitted = (id, quantity, unitPrice = 999) => [
    { id, quantity, unitPrice, name: "untrusted name", category: "client" },
  ];
  const orderPayload = (items) => ({
    product: items[0],
    items,
    customer: {
      firstName: "Test",
      lastName: "Client",
      email: "client@example.test",
      phone: "+33123456789",
      street: "2 rue de Test",
      city: "Paris",
      zip: "75001",
      country: "France",
    },
    shippingMethodId: "mondial-relay-point-relais",
    acceptTerms: true,
    cgvVersion: "2026-11-25-prep-3bd",
    relayPoint: {
      id: "FR-TEST-1",
      location: "Paris",
      label: "Point test",
      address: ["1 rue test"],
      postalCode: "75001",
      city: "Paris",
      source: "production",
      serviceCode: "24R/MED",
    },
    customValues: {},
  });
  const orderSnapshot = {
    cgvVersion: "2026-11-25-prep-3bd",
    preparationDays: 3,
  };

  const canonical = await inventory.canonicalCommerceItems(
    submitted("modest-era", 1),
  );
  assert.equal(canonical[0].unitPrice, 29.9);
  assert.equal(canonical[0].unitPriceCents, 2990);
  const promo = await inventory.validatePromotion(
    "FIRSTPRINCESS1",
    submitted("modest-era", 1),
  );
  assert.equal(promo.subtotalCents, 2990);
  assert.equal(promo.discountCents, 299);
  assert.equal(promo.totalCents, 2691);
  await assert.rejects(
    inventory.validatePromotion("NOTAREALCODE", submitted("modest-era", 1)),
    /FIRSTPRINCESS1_INVALID/,
  );

  const promoReservations = [];
  for (let i = 0; i < 20; i++) {
    const order = orderPayload(submitted("modest-era", 1));
    promoReservations.push(
      await inventory.reserveCommerceCheckout({
        order: { ...order, promotionCode: "FIRSTPRINCESS1" },
        shippingCents: 425,
        orderSnapshot,
      }),
    );
  }
  assert.equal(
    (await query("SELECT reserved_count FROM mm_promotions WHERE code=$1", [
      "FIRSTPRINCESS1",
    ])).rows[0].reserved_count,
    20,
  );
  await assert.rejects(
    inventory.reserveCommerceCheckout({
      order: {
        ...orderPayload(submitted("modest-era", 1)),
        promotionCode: "FIRSTPRINCESS1",
      },
      shippingCents: 425,
      orderSnapshot,
    }),
    /FIRSTPRINCESS1_EXHAUSTED/,
  );
  for (const reservation of promoReservations)
    await inventory.releaseCommerceReservation(reservation.reservationId);
  assert.equal(
    (await query("SELECT reserved_count FROM mm_promotions WHERE code=$1", [
      "FIRSTPRINCESS1",
    ])).rows[0].reserved_count,
    0,
  );

  const concurrent = await Promise.all(
    Array.from({ length: 50 }, () =>
      inventory.reserveCommerceCheckout({
        order: orderPayload(submitted("modest-era", 1)),
        shippingCents: 425,
        orderSnapshot,
      })
        .then((reservation) => ({ reservation }))
        .catch((error) => ({ error })),
    ),
  );
  const successful = concurrent.filter((entry) => entry.reservation);
  const rejected = concurrent.filter((entry) => entry.error);
  assert.equal(successful.length, 44);
  assert.equal(rejected.length, 6);
  assert(
    rejected.every((entry) => /INVENTORY_UNAVAILABLE/.test(entry.error.message)),
  );
  const stockWhileReserved = (
    await query(
      "SELECT quantity_on_hand, reserved_quantity FROM mm_commerce_products WHERE product_id='modest-era'",
    )
  ).rows[0];
  assert.equal(stockWhileReserved.quantity_on_hand, 44);
  assert.equal(stockWhileReserved.reserved_quantity, 44);
  assert(stockWhileReserved.reserved_quantity <= stockWhileReserved.quantity_on_hand);
  for (const { reservation } of successful)
    await inventory.releaseCommerceReservation(reservation.reservationId);

  const expiring = await inventory.reserveCommerceCheckout({
    order: {
      ...orderPayload(submitted("paradise-way", 2)),
      promotionCode: "FIRSTPRINCESS1",
    },
    shippingCents: 425,
    orderSnapshot,
  });
  await query(
    "UPDATE mm_commerce_reservations SET expires_at=now()-interval '1 minute' WHERE reservation_id=$1",
    [expiring.reservationId],
  );
  const publicCatalog = await inventory.getPublicCommerceCatalog();
  assert.deepEqual(
    publicCatalog.find((item) => item.id === "modest-era"),
    { id: "modest-era", price: 29.9, available: true },
  );
  assert.equal(
    (await query(
      "SELECT status FROM mm_commerce_reservations WHERE reservation_id=$1",
      [expiring.reservationId],
    )).rows[0].status,
    "expired",
  );
  assert.equal(
    (await query(
      "SELECT reserved_quantity FROM mm_commerce_products WHERE product_id='paradise-way'",
    )).rows[0].reserved_quantity,
    0,
  );
  assert.equal(
    (await query(
      "SELECT reserved_count FROM mm_promotions WHERE code='FIRSTPRINCESS1'",
    )).rows[0].reserved_count,
    0,
  );

  const originalFetch = global.fetch;
  const paypalCalls = [];
  let providerStatus = "COMPLETED";
  global.fetch = async (input, init = {}) => {
    const url = String(input);
    paypalCalls.push({ url, init });
    if (url.endsWith("/v1/oauth2/token"))
      return Response.json({ access_token: "mock-token" });
    if (url.endsWith("/v2/checkout/orders"))
      return Response.json({ id: "PAYPALTEST0001" });
    if (url.endsWith("/v2/checkout/orders/PAYPALTEST0001/capture"))
      return Response.json({ status: "COMPLETED" });
    if (url.endsWith("/v2/checkout/orders/PAYPALTEST0001"))
      return Response.json({
        id: "PAYPALTEST0001",
        status: providerStatus,
        purchase_units: [
          {
            payee: { merchant_id: "test-merchant" },
            payments: {
              captures: [
                {
                  id: "CAPTURETEST0001",
                  status: "COMPLETED",
                  amount: { currency_code: "EUR", value: "31.16" },
                },
              ],
            },
          },
        ],
      });
    if (url.endsWith("/v2/checkout/orders/PAYPALFAIL0001/capture"))
      return new Response("capture denied", { status: 422 });
    if (url.endsWith("/v2/checkout/orders/PAYPALFAIL0001"))
      return Response.json({
        id: "PAYPALFAIL0001",
        status: providerStatus,
        purchase_units: [],
      });
    throw new Error(`Unexpected mocked PayPal URL: ${url}`);
  };
  try {
    const security = loadInventory("lib/commerceSecurity.ts");
    const authoritativeOrder = await inventory.reserveCommerceCheckout({
      order: {
        ...orderPayload(submitted("modest-era", 1, 0.01)),
        promotionCode: "FIRSTPRINCESS1",
      },
      shippingCents: 425,
      orderSnapshot,
    });
    assert.equal(authoritativeOrder.subtotalCents, 2990);
    assert.equal(authoritativeOrder.discountCents, 299);
    assert.equal(authoritativeOrder.totalCents, 3116);
    await security.createPayPalCheckoutOrder({
      reservationId: authoritativeOrder.reservationId,
      totalCents: authoritativeOrder.totalCents,
      subtotalCents: authoritativeOrder.subtotalCents,
      discountCents: authoritativeOrder.discountCents,
      shippingCents: authoritativeOrder.shippingCents,
      items: authoritativeOrder.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
      customer: authoritativeOrder.snapshot.order.customer,
    });
    const payPalOrderCall = paypalCalls.find((call) =>
      call.url.endsWith("/v2/checkout/orders"),
    );
    const payPalBody = JSON.parse(payPalOrderCall.init.body);
    assert.equal(payPalBody.purchase_units[0].custom_id, authoritativeOrder.reservationId);
    assert.equal(payPalBody.purchase_units[0].amount.value, "31.16");
    assert.equal(
      payPalBody.purchase_units[0].amount.breakdown.item_total.value,
      "29.90",
    );
    assert.equal(
      payPalBody.purchase_units[0].amount.breakdown.discount.value,
      "2.99",
    );
    assert.equal(
      (await security.captureAndVerifyPayPalOrder("PAYPALTEST0001", 3116))
        .captureId,
      "CAPTURETEST0001",
    );
    providerStatus = "APPROVED";
    await assert.rejects(
      security.captureAndVerifyPayPalOrder("PAYPALFAIL0001", 3116),
      /PAYMENT_CAPTURE_FAILED/,
    );
    providerStatus = "COMPLETED";

    const commerceSchemas = security.incomingOrderSchema;
    const validClientOrder = orderPayload(submitted("modest-era", 1));
    const validClientBody = {
      paymentMethod: "PAYPAL",
      paypalOrderId: "PAYPALTEST0001",
      checkoutProof: "signed",
      order: validClientOrder,
    };
    assert.equal(commerceSchemas.safeParse(validClientBody).success, true);
    const clientCaptureAttempt = commerceSchemas.safeParse({
      ...validClientBody,
      paypalCapture: { status: "COMPLETED" },
    });
    assert.equal(clientCaptureAttempt.success, false);
    for (const component of [
      "components/PayPalButton.tsx",
      "components/CartCheckoutButton.tsx",
    ])
      assert.equal(
        fs.readFileSync(component, "utf8").includes("actions.order.capture"),
        false,
      );

    const webhookReservation = await inventory.reserveCommerceCheckout({
      order: {
        ...orderPayload(submitted("paradise-way", 1)),
        promotionCode: "FIRSTPRINCESS1",
      },
      shippingCents: 425,
      orderSnapshot: {
        ...orderSnapshot,
        shippingMethodId: "mondial-relay-point-relais",
        relayPoint: orderPayload(submitted("paradise-way", 1)).relayPoint,
        fulfillmentMode: "api2",
      },
    });
    await inventory.bindPayPalOrder(
      webhookReservation.reservationId,
      "WEBHOOKORDER001",
    );
    const webhookLoad = createLoader({
      "@/lib/commerceSecurity": {
        verifyPayPalWebhook: async () => true,
        verifiedPayPalOrderDetails: async () => ({
          captureId: "WEBHOOKCAPTURE01",
        }),
      },
      "@/lib/newsletterDb": { database, transaction },
      "@/lib/commerceInventory": inventory,
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
    const webhookRoute = webhookLoad("app/api/paypal/webhook/route.ts");
    const event = {
      id: "WEBHOOKEVENT001",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      create_time: new Date().toISOString(),
      resource: {
        id: "WEBHOOKCAPTURE01",
        supplementary_data: {
          related_ids: { order_id: "WEBHOOKORDER001" },
        },
      },
    };
    const request = () =>
      new NextRequest("https://example.test/api/paypal/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "paypal-auth-algo": "SHA256withRSA",
          "paypal-cert-url": "https://api-m.paypal.com/cert",
          "paypal-transmission-id": "transmission-test",
          "paypal-transmission-sig": "signature-test",
          "paypal-transmission-time": new Date().toISOString(),
        },
        body: JSON.stringify(event),
      });
    assert.equal((await webhookRoute.POST(request())).status, 200);
    assert.equal((await webhookRoute.POST(request())).status, 200);
    assert.equal(
      (await query(
        "SELECT count(*)::int AS count FROM mm_commerce_order_financials WHERE paypal_order_id='WEBHOOKORDER001'",
      )).rows[0].count,
      1,
    );
    assert.equal(
      (await query(
        `SELECT status FROM mm_mondial_relay_shipment_jobs
          WHERE order_id=(SELECT order_id FROM mm_commerce_reservations
                           WHERE paypal_order_id='WEBHOOKORDER001')`,
      )).rows[0].status,
      "queued",
    );
    assert.equal(
      (await query(
        "SELECT count(*)::int AS count FROM mm_stock_movements WHERE idempotency_key LIKE 'sale:WEBHOOKORDER001:%'",
      )).rows[0].count,
      1,
    );
    assert.equal(
      (await query(
        "SELECT redeemed_count FROM mm_promotions WHERE code='FIRSTPRINCESS1'",
      )).rows[0].redeemed_count,
      1,
    );
    assert.equal(
      (await query(
        "SELECT count(*)::int AS count FROM mm_commerce_email_events WHERE order_id=(SELECT order_id FROM mm_commerce_reservations WHERE paypal_order_id='WEBHOOKORDER001') AND status='sent'",
      )).rows[0].count,
      2,
    );
    assert.equal(emails.length, 2);

    const retryEmail = {
      orderId: "EMAIL-RETRY-1",
      type: "order_confirmation",
      recipient: "retry@example.test",
      subject: "Retry test",
      html: "<p>Retry</p>",
    };
    failingEmailRecipient = retryEmail.recipient;
    await assert.rejects(
      inventory.sendCommerceEmailOnce(retryEmail),
      /MOCK_EMAIL_DELIVERY_UNKNOWN/,
    );
    await query(
      "UPDATE mm_commerce_email_events SET updated_at=now()-interval '6 minutes' WHERE event_key='EMAIL-RETRY-1:order_confirmation'",
    );
    await inventory.sendCommerceEmailOnce(retryEmail);
    const retryCalls = emails.filter(
      (message) => message.to === retryEmail.recipient,
    );
    assert.equal(retryCalls.length, 2);
    assert.equal(
      retryCalls[0].idempotencyKey,
      "EMAIL-RETRY-1:order_confirmation",
    );
    assert.equal(retryCalls[1].idempotencyKey, retryCalls[0].idempotencyKey);

    const unknownEmail = {
      ...retryEmail,
      orderId: "EMAIL-UNKNOWN-1",
      recipient: "unknown@example.test",
    };
    failingEmailRecipient = unknownEmail.recipient;
    await assert.rejects(
      inventory.sendCommerceEmailOnce(unknownEmail),
      /MOCK_EMAIL_DELIVERY_UNKNOWN/,
    );
    await query(
      "UPDATE mm_commerce_email_events SET created_at=now()-interval '25 hours', updated_at=now()-interval '6 minutes' WHERE event_key='EMAIL-UNKNOWN-1:order_confirmation'",
    );
    const beforeExpiredRetry = emails.length;
    const expiredRetry = await inventory.sendCommerceEmailOnce(unknownEmail);
    assert.equal(expiredRetry.skipped, true);
    assert.equal(emails.length, beforeExpiredRetry);
    assert.equal(
      (await query(
        "SELECT last_error FROM mm_commerce_email_events WHERE event_key='EMAIL-UNKNOWN-1:order_confirmation'",
      )).rows[0].last_error,
      "RESEND_IDEMPOTENCY_WINDOW_EXPIRED",
    );

    const availabilityRoute = loadInventory(
      "app/api/commerce/availability/route.ts",
    );
    const availabilityResponse = await availabilityRoute.GET();
    assert.equal(availabilityResponse.headers.get("cache-control"), "no-store, max-age=0");
    const availabilityJson = await availabilityResponse.json();
    assert.deepEqual(
      Object.keys(availabilityJson.products[0]).sort(),
      ["available", "id"],
    );
    const catalogRoute = loadInventory("app/api/commerce/catalog/route.ts");
    const catalogResponse = await catalogRoute.GET();
    assert.equal(catalogResponse.headers.get("cache-control"), "no-store, max-age=0");
    const catalogJson = await catalogResponse.json();
    assert.equal(catalogJson.products[0].price, 29.9);
    assert.equal(typeof catalogJson.products[0].available, "boolean");
    await query(
      "UPDATE mm_commerce_products SET price_cents=3190 WHERE product_id='modest-era'",
    );
    const updatedCatalog = await catalogRoute.GET();
    assert.equal(
      (await updatedCatalog.json()).products.find(
        (product) => product.id === "modest-era",
      ).price,
      31.9,
    );
    await query(
      "UPDATE mm_commerce_products SET price_cents=2990 WHERE product_id='modest-era'",
    );
    assert.equal(
      (await query(
        "SELECT count(*)::int AS count FROM mm_subscribers WHERE email='client@example.test'",
      )).rows[0].count,
      0,
    );

    console.log(
      "PASS: DB-authoritative 29.90 EUR and live catalog pricing, promotion math and 20-reservation limit, concurrent stock reservations without oversell, lazy expiry/release, fail-closed Mondial Relay readiness, PayPal totals and server-side capture validation, rejection of client capture claims, verified/idempotent capture webhooks, stable Resend idempotency keys and no retry beyond 24 hours, no newsletter subscription, and quantity-free no-store catalog/availability responses. All provider calls were mocked.",
    );
  } finally {
    global.fetch = originalFetch;
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
