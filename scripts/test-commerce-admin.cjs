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
  let sentEmailCount = 0;
  let paypalRefundCallCount = 0;
  let paypalRefundVerifyCount = 0;
  let paypalRefundStatus = "COMPLETED";
  let paypalRefundAmountCents = 500;
  const emailObservations = [];
  const session = { user: { id: "commerce-admin-test" } };
  const cache = new Map();
  const originalFetch = global.fetch;
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
      if (id === "@/lib/adminAuth") return {
        adminDenied: async () => authorized ? null : Response.json({ error: "Authentification requise" }, { status: 401, headers: { "Cache-Control": "no-store" } }),
        adminSession: async () => authorized ? session : null,
      };
      if (id === "@/lib/adminAudit") return {
        adminAudit: async (action, target) => query(
          "INSERT INTO mm_admin_audit(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)",
          [randomUUID(), session.user.id, action, target || null],
        ),
      };
      if (id === "@/lib/newsletterDb") return { database: () => pool, transaction };
      if (id === "./newsletterDb") return { database: () => pool, transaction };
      if (id === "@/lib/observability") return { securityEvent() {} };
      if (id === "@/lib/newsletter") return { emailReady: () => true };
      if (id === "@/lib/email") return {
        getEmailFrom: () => "noreply@example.test",
        getAdminEmail: () => "admin@example.test",
        sendEmailOrThrow: async () => {
          sentEmailCount += 1;
          const order = await query(
            "SELECT record FROM mm_orders WHERE order_id='MM-2026-AB123456'",
          );
          const finance = await query(
            "SELECT shipment_status FROM mm_commerce_order_financials WHERE order_id='MM-2026-AB123456'",
          );
          emailObservations.push({
            status: order.rows[0]?.record.status,
            shipment: finance.rows[0]?.shipment_status,
          });
        },
      };
      if (id === "@/lib/requestSecurity") return requestSecurity;
      if (id === "@/lib/newsletterSchemas") return load("lib/newsletterSchemas.ts");
      if (id === "@/lib/orderStore") return load("lib/orderStore.ts");
      if (id === "@/lib/commerceNotifications") return load("lib/commerceNotifications.ts");
      if (id === "@/lib/adminOrderPresentation") return load("lib/adminOrderPresentation.ts");
      if (id === "@/lib/adminPaypalRefund") return load("lib/adminPaypalRefund.ts");
      if (id === "@/lib/commerceSecurity") return { getPayPalProductionStatus: () => ({ configured: true }) };
      if (id === "@/lib/products") return load("lib/products.ts");
      if (id.startsWith("@/")) throw new Error(`Unexpected commerce-admin import: ${id}`);
      return require(id);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, filename);
    return mod.exports;
  }
  function req(url, method = "GET", body) {
    return new NextRequest(url, {
      method,
      ...(body === undefined ? {} : {
        headers: { origin: new URL(url).origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
  }

  process.env.DATABASE_URL = "postgres://commerce-test.invalid/db";
  process.env.REAL_PAYMENTS_ENABLED = "false";
  process.env.SHOP_OPEN = "false";
  process.env.PAYPAL_ENV = "production";
  process.env.PAYPAL_CLIENT_ID = "test-client-id";
  process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
  process.env.PAYPAL_MERCHANT_ID = "test-merchant";
  process.env.PAYPAL_WEBHOOK_ID = "test-webhook";
  global.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.endsWith("/v1/oauth2/token"))
      return Response.json({ access_token: "mock-access-token" });
    if (url.includes("/v2/payments/refunds/")) {
      paypalRefundVerifyCount += 1;
      const refundId = url.split("/").pop();
      return Response.json({
        id: refundId, status: paypalRefundStatus,
        amount: { value: (paypalRefundAmountCents / 100).toFixed(2), currency_code: "EUR" },
      });
    }
    if (url.includes("/v2/payments/captures/") && url.endsWith("/refund")) {
      paypalRefundCallCount += 1;
      assert.equal(options.headers["PayPal-Request-Id"], options.headers["PayPal-Request-Id"].toLowerCase());
      const requestBody = JSON.parse(options.body);
      assert.equal(requestBody.amount.currency_code, "EUR");
      assert.equal(Math.round(Number(requestBody.amount.value) * 100), paypalRefundAmountCents);
      const requestId = options.headers["PayPal-Request-Id"];
      return Response.json({
        id: `R-${requestId.replaceAll("-", "").slice(0, 20)}`, status: paypalRefundStatus,
        amount: { value: (paypalRefundAmountCents / 100).toFixed(2), currency_code: "EUR" },
      }, { status: 201 });
    }
    throw new Error("Unexpected external fetch in isolated test");
  };

  const inventory = load("app/api/admin/inventory/route.ts");
  const inventoryRead = await inventory.GET();
  assert.equal(inventoryRead.status, 200);
  assert.equal(inventoryRead.headers.get("cache-control"), "no-store");
  const inventoryData = await inventoryRead.json();
  assert.equal(inventoryData.products.length, 2);
  assert.equal(inventoryData.products[0].quantity_on_hand, 44);
  authorized = false;
  assert.equal((await inventory.GET()).status, 401);
  authorized = true;
  await query("UPDATE mm_commerce_products SET reserved_quantity=3 WHERE product_id='modest-era'");
  const badQuantity = await inventory.PATCH(req("https://admin.test/api/admin/inventory", "PATCH", {
    productId: "modest-era", quantity: 2, reason: "Correction test", idempotencyKey: randomUUID(),
  }));
  assert.equal(badQuantity.status, 409);
  const movementKey = randomUUID();
  const correctionBody = {
    productId: "modest-era", quantity: 40, priceCents: 3190,
    reason: "Ajustement de contrôle", idempotencyKey: movementKey,
  };
  const corrected = await inventory.PATCH(req("https://admin.test/api/admin/inventory", "PATCH", correctionBody));
  assert.equal(corrected.status, 200);
  assert.equal((await corrected.json()).product.quantity_on_hand, 40);
  const movement = await query("SELECT quantity_before,quantity_after,reason,admin_user_id FROM mm_stock_movements WHERE idempotency_key=$1", [movementKey]);
  assert.deepEqual(movement.rows[0], {
    quantity_before: 44, quantity_after: 40, reason: "Ajustement de contrôle",
    admin_user_id: "commerce-admin-test",
  });
  const replay = await inventory.PATCH(req("https://admin.test/api/admin/inventory", "PATCH", correctionBody));
  assert.equal((await replay.json()).replayed, true);
  assert.equal((await query("SELECT count(*)::int AS n FROM mm_stock_movements WHERE idempotency_key=$1", [movementKey])).rows[0].n, 1);

  const promotions = load("app/api/admin/promotions/route.ts");
  const newPromotion = {
    code: "TESTFUTURE", discountType: "fixed", discountValue: 500,
    maxRedemptions: 4, startsAt: "2027-01-01T00:00:00.000Z",
    endsAt: "2027-02-01T00:00:00.000Z", productIds: ["modest-era"],
    minimumOrderCents: 2500, active: true,
  };
  assert.equal((await promotions.POST(req("https://admin.test/api/admin/promotions", "POST", newPromotion))).status, 201);

  const orderRecord = {
    orderId: "MM-2026-AB123456", orderDate: "2026-10-01T10:00:00.000Z",
    paymentMethod: "PAYPAL", paypalOrderId: "PAYPAL-AB123456", status: "Payee",
    customer: { firstName: "Ada", lastName: "Test", email: "ada@example.test", phone: "0612345678", street: "1 rue Test", city: "Paris", zip: "75001" },
    items: [{ id: "modest-era", name: "Modest Era", quantity: 1, unitPrice: 29.9 }],
    subtotal: 29.9, total: 29.9,
    shipping: { id: "standard", label: "Standard", carrier: "Test", estimatedDelay: "2 jours", trackingBaseUrl: "", price: 4.9 },
  };
  const newsletterId = randomUUID();
  await query(
    `INSERT INTO mm_subscribers(id,email,status,created_at,consent_at,confirmed_at,
      consent_version,consent_ip_hash,unsubscribe_token)
     VALUES($1,'ada@example.test','active',now(),now(),now(),'test-consent-v1','test-hash',$2)`,
    [newsletterId, randomUUID().replaceAll("-", "")],
  );
  await query(
    `INSERT INTO mm_consent_events(id,subscriber_id,event,consent_version,ip_hash)
     VALUES($1,$2,'confirmed','test-consent-v1','test-hash')`,
    [randomUUID(), newsletterId],
  );
  await query("INSERT INTO mm_orders(order_id,paypal_order_id,record) VALUES($1,$2,$3)", [orderRecord.orderId, orderRecord.paypalOrderId, JSON.stringify(orderRecord)]);
  await query(
    `INSERT INTO mm_commerce_order_financials
      (order_id,paypal_order_id,paypal_capture_id,payment_status,shipment_status,subtotal_cents,discount_cents,shipping_cents,total_cents,refunded_cents)
     VALUES($1,$2,'CAPTURE-AB123456','paid','unfulfilled',2990,500,490,2980,100)`,
    [orderRecord.orderId, orderRecord.paypalOrderId],
  );
  await query(
    "INSERT INTO mm_promotion_redemptions(order_id,paypal_order_id,code,discount_cents) VALUES($1,$2,$3,$4)",
    [orderRecord.orderId, orderRecord.paypalOrderId, "TESTFUTURE", 500],
  );

  const promotionRead = await promotions.GET();
  assert.equal(promotionRead.headers.get("cache-control"), "no-store");
  const promotionRows = (await promotionRead.json()).promotions;
  assert.equal(promotionRows.find((row) => row.code === "TESTFUTURE").redemptions[0].orderId, orderRecord.orderId);

  const customers = load("app/api/admin/customers/route.ts");
  const customerResponse = await customers.GET(req("https://admin.test/api/admin/customers?search=ada&page=1"));
  assert.equal(customerResponse.status, 200);
  assert.equal(customerResponse.headers.get("cache-control"), "no-store");
  const customerData = await customerResponse.json();
  assert.equal(customerData.total, 1);
  assert.equal(customerData.customers[0].paid_orders, 1);
  assert.equal(customerData.customers[0].net_paid_cents, 2880);
  const customerDetail = load("app/api/admin/customers/[email]/route.ts");
  const detailResponse = await customerDetail.GET(new NextRequest("https://admin.test/api/admin/customers/ada%40example.test"), { params: Promise.resolve({ email: "ada@example.test" }) });
  const customerDetailData = await detailResponse.json();
  assert.equal(customerDetailData.orders.length, 1);
  assert.equal(customerDetailData.newsletterConsent.status, "active");
  assert.equal(customerDetailData.newsletterConsent.lastEvent, "confirmed");
  assert.equal((await query("SELECT count(*)::int AS n FROM mm_subscribers")).rows[0].n, 1);

  const paypalStatus = load("app/api/admin/paypal-status/route.ts");
  const paypalData = await (await paypalStatus.GET()).json();
  assert.equal(Object.values(paypalData.paypalLive).every((value) => typeof value === "boolean"), true);
  assert.equal(paypalData.paypalLive.environmentConfigured, true);
  assert.equal(paypalData.paypalLive.productionEnvironment, true);
  assert.equal(paypalData.paypalLive.paymentsEnabled, false);
  assert.equal(paypalData.paypalLive.clientSecretConfigured, true);
  assert.equal(paypalData.paypalLive.shopOpen, false);
  const paypalStatusJson = JSON.stringify(paypalData);
  for (const secret of ["test-client-id", "test-client-secret", "test-merchant", "test-webhook"])
    assert.equal(paypalStatusJson.includes(secret), false);
  const dashboard = load("app/api/admin/dashboard/route.ts");
  const dashboardResponse = await dashboard.GET();
  const dashboardData = await dashboardResponse.json();
  assert.equal(dashboardResponse.headers.get("cache-control"), "no-store");
  assert.equal(dashboardData.commerce.paidOrders, 1);
  assert.equal(Number(dashboardData.commerce.productSalesCents), 2990);
  assert.equal(Number(dashboardData.commerce.shippingCents), 490);
  assert.equal(Number(dashboardData.commerce.discountsCents), 500);
  assert.equal(Number(dashboardData.commerce.refundsCents), 100);

  const orderAdmin = load("app/api/admin/orders/[orderId]/route.ts");
  const shipmentUpdate = await orderAdmin.PATCH(
    req("https://admin.test/api/admin/orders/MM-2026-AB123456", "PATCH", { status: "Expediee" }),
    { params: Promise.resolve({ orderId: "MM-2026-AB123456" }) },
  );
  assert.equal(shipmentUpdate.status, 200);
  assert.deepEqual(emailObservations[0], { status: "Expediee", shipment: "shipped" });
  assert.equal(sentEmailCount, 1);
  const repeatedUpdate = await orderAdmin.PATCH(
    req("https://admin.test/api/admin/orders/MM-2026-AB123456", "PATCH", { status: "Expediee" }),
    { params: Promise.resolve({ orderId: "MM-2026-AB123456" }) },
  );
  assert.equal(repeatedUpdate.status, 200);
  assert.equal(sentEmailCount, 1);
  assert.equal((await query("SELECT count(*)::int AS n FROM mm_commerce_email_events WHERE order_id=$1", [orderRecord.orderId])).rows[0].n, 1);
  const unsafePaidStatus = await orderAdmin.PATCH(
    req("https://admin.test/api/admin/orders/MM-2026-AB123456", "PATCH", { status: "Payee" }),
    { params: Promise.resolve({ orderId: "MM-2026-AB123456" }) },
  );
  assert.equal(unsafePaidStatus.status, 400);
  const orderDetailResponse = await orderAdmin.GET(
    new NextRequest("https://admin.test/api/admin/orders/MM-2026-AB123456"),
    { params: Promise.resolve({ orderId: "MM-2026-AB123456" }) },
  );
  const orderDetailData = await orderDetailResponse.json();
  assert.equal(orderDetailData.order.items[0].catalogName, "Modest Era");
  assert.equal(orderDetailData.order.items[0].catalogColor, "Noir");
  assert.equal(orderDetailData.order.items[0].catalogImage, "/collection/modest-era-feature.jpeg");
  assert.equal(orderDetailData.order.newsletterConsent.lastEvent, "confirmed");

  const refundApi = load("app/api/admin/orders/[orderId]/refund/route.ts");
  const refundKey = randomUUID();
  const refundRequest = {
    amountCents: 500, reason: "Remboursement de test", confirmation: true,
    idempotencyKey: refundKey,
  };
  const stockBeforeRefund = await query(
    "SELECT quantity_on_hand FROM mm_commerce_products WHERE product_id='modest-era'",
  );
  const movementsBeforeRefund = await query("SELECT count(*)::int AS n FROM mm_stock_movements");
  const refundResponse = await refundApi.POST(
    req("https://admin.test/api/admin/orders/MM-2026-AB123456/refund", "POST", refundRequest),
    { params: Promise.resolve({ orderId: "MM-2026-AB123456" }) },
  );
  assert.equal(refundResponse.status, 200);
  assert.equal(refundResponse.headers.get("cache-control"), "no-store");
  assert.equal((await refundResponse.json()).refund.status, "completed");
  assert.equal(paypalRefundCallCount, 1);
  const refundedFinancials = await query(
    "SELECT payment_status,refunded_cents FROM mm_commerce_order_financials WHERE order_id=$1",
    [orderRecord.orderId],
  );
  assert.deepEqual(refundedFinancials.rows[0], { payment_status: "partially_refunded", refunded_cents: 600 });
  const repeatedRefund = await refundApi.POST(
    req("https://admin.test/api/admin/orders/MM-2026-AB123456/refund", "POST", refundRequest),
    { params: Promise.resolve({ orderId: "MM-2026-AB123456" }) },
  );
  assert.equal((await repeatedRefund.json()).refund.idempotentReplay, true);
  assert.equal(paypalRefundCallCount, 1);
  assert.deepEqual(
    (await query("SELECT quantity_on_hand FROM mm_commerce_products WHERE product_id='modest-era'")).rows[0],
    stockBeforeRefund.rows[0],
  );
  assert.equal((await query("SELECT count(*)::int AS n FROM mm_stock_movements")).rows[0].n, movementsBeforeRefund.rows[0].n);
  assert.equal((await query("SELECT count(*)::int AS n FROM mm_commerce_email_events WHERE order_id=$1 AND event_type='refund'", [orderRecord.orderId])).rows[0].n, 1);

  const overRefund = await refundApi.POST(
    req("https://admin.test/api/admin/orders/MM-2026-AB123456/refund", "POST", {
      ...refundRequest, amountCents: 5000, idempotencyKey: randomUUID(),
    }),
    { params: Promise.resolve({ orderId: "MM-2026-AB123456" }) },
  );
  assert.equal(overRefund.status, 409);
  assert.equal(paypalRefundCallCount, 1);

  const pendingRefundOrder = {
    ...orderRecord, orderId: "MM-2026-EF123456", paypalOrderId: "PAYPAL-EF123456",
    status: "Payee",
  };
  await query("INSERT INTO mm_orders(order_id,paypal_order_id,record) VALUES($1,$2,$3)", [pendingRefundOrder.orderId, pendingRefundOrder.paypalOrderId, JSON.stringify(pendingRefundOrder)]);
  await query(
    `INSERT INTO mm_commerce_order_financials
      (order_id,paypal_order_id,paypal_capture_id,payment_status,shipment_status,subtotal_cents,shipping_cents,total_cents)
     VALUES($1,$2,'CAPTURE-EF123456','paid','unfulfilled',2990,490,3480)`,
    [pendingRefundOrder.orderId, pendingRefundOrder.paypalOrderId],
  );
  const pendingKey = randomUUID();
  const pendingBody = { amountCents: 250, reason: "Remboursement partiel test", confirmation: true, idempotencyKey: pendingKey };
  paypalRefundAmountCents = 250;
  paypalRefundStatus = "PENDING";
  const pendingResponse = await refundApi.POST(
    req("https://admin.test/api/admin/orders/MM-2026-EF123456/refund", "POST", pendingBody),
    { params: Promise.resolve({ orderId: pendingRefundOrder.orderId }) },
  );
  assert.equal(pendingResponse.status, 202);
  assert.equal((await query("SELECT refunded_cents FROM mm_commerce_order_financials WHERE order_id=$1", [pendingRefundOrder.orderId])).rows[0].refunded_cents, 0);
  const blockedSecondRefund = await refundApi.POST(
    req("https://admin.test/api/admin/orders/MM-2026-EF123456/refund", "POST", { ...pendingBody, idempotencyKey: randomUUID() }),
    { params: Promise.resolve({ orderId: pendingRefundOrder.orderId }) },
  );
  assert.equal(blockedSecondRefund.status, 409);
  assert.equal(paypalRefundCallCount, 2);
  paypalRefundStatus = "COMPLETED";
  const retryPending = await refundApi.POST(
    req("https://admin.test/api/admin/orders/MM-2026-EF123456/refund", "POST", pendingBody),
    { params: Promise.resolve({ orderId: pendingRefundOrder.orderId }) },
  );
  assert.equal(retryPending.status, 200);
  assert.equal(paypalRefundCallCount, 2);
  assert.equal(paypalRefundVerifyCount, 1);
  assert.equal((await query("SELECT refunded_cents FROM mm_commerce_order_financials WHERE order_id=$1", [pendingRefundOrder.orderId])).rows[0].refunded_cents, 250);

  const cancelledRecord = {
    ...orderRecord, orderId: "MM-2026-CD123456", paypalOrderId: "PAYPAL-CD123456",
    status: "En preparation",
  };
  await query("INSERT INTO mm_orders(order_id,paypal_order_id,record) VALUES($1,$2,$3)", [cancelledRecord.orderId, cancelledRecord.paypalOrderId, JSON.stringify(cancelledRecord)]);
  await query(
    `INSERT INTO mm_commerce_order_financials
      (order_id,paypal_order_id,payment_status,shipment_status,subtotal_cents,shipping_cents,total_cents)
     VALUES($1,$2,'paid','preparing',2990,490,3480)`,
    [cancelledRecord.orderId, cancelledRecord.paypalOrderId],
  );
  const cancellationUpdate = await orderAdmin.PATCH(
    req("https://admin.test/api/admin/orders/MM-2026-CD123456", "PATCH", { status: "Annulee" }),
    { params: Promise.resolve({ orderId: "MM-2026-CD123456" }) },
  );
  assert.equal(cancellationUpdate.status, 200);
  assert.equal(sentEmailCount, 4);
  assert.equal((await query("SELECT event_type,status FROM mm_commerce_email_events WHERE order_id=$1", [cancelledRecord.orderId])).rows[0].event_type, "cancellation");

  console.log("Commerce admin tests passed (PGlite; email sender mocked, no real payments or external APIs).");
  global.fetch = originalFetch;
  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
