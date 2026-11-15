// HTTPS verification against the isolated preview schema. No Resend credential reaches the server process.
const fs = require("node:fs"),
  https = require("node:https"),
  http = require("node:http"),
  { spawn } = require("node:child_process"),
  { Pool } = require("pg"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { chromium } = require("@playwright/test"),
  { connectionOptions } = require("../lib/databaseConnection.mjs");
async function main() {
  const config = JSON.parse(
    fs.readFileSync(".qa/runtime-secrets.json", "utf8"),
  );
  const db = new Pool({
    ...connectionOptions(config.runtime.preview.NEWSLETTER_DATABASE_URL),
    max: 1,
  });
  const email = "qa-owner@example.test",
    password = "A-valid-temporary-password-2026!",
    ip = "198.51.100.77";
  if ((await db.query("SELECT 1 FROM mm_auth_user")).rowCount)
    throw Error("Preview already has a user; test cancelled");
  const env = {
    ...process.env,
    ...config.secrets,
    NODE_ENV: "production",
    NEWSLETTER_DATABASE_URL: config.runtime.preview.NEWSLETTER_DATABASE_URL,
    NEWSLETTER_SITE_URL: "https://localhost:3000",
    BETTER_AUTH_URL: "https://localhost:3000",
    ADMIN_EMAIL: email,
    EMAIL_ADMIN: email,
    OWNER_EMAIL: email,
    RESEND_API_KEY: "",
    SHOP_OPEN: "false",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  const log = fs.openSync(".qa/security/runtime.log", "w");
  fs.cpSync('public','.next/standalone/public',{recursive:true});
  fs.cpSync('.next/static','.next/standalone/.next/static',{recursive:true});
  fs.cpSync('certificates','.next/standalone/certificates',{recursive:true});
  const server = spawn(
    process.execPath,
    ['.next/standalone/server.js'],
    { env:{...env,HOSTNAME:'127.0.0.1',PORT:'3001'}, stdio: ["ignore", log, log], windowsHide: true },
  );
  const proxy = https.createServer(
    {
      key: fs.readFileSync(".qa/localhost.key"),
      cert: fs.readFileSync(".qa/localhost.crt"),
    },
    (req, res) => {
      const upstream = http.request(
        {
          host: "127.0.0.1",
          port: 3001,
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            "x-forwarded-proto": "https",
            "x-forwarded-for": ip,
            "x-vercel-forwarded-for": ip,
            "x-forwarded-host": "localhost:3000",
            host: "localhost:3000",
          },
        },
        (r) => {
          res.writeHead(r.statusCode, r.headers);
          r.pipe(res);
        },
      );
      upstream.on("error", () => {
        res.writeHead(503);
        res.end();
      });
      req.pipe(upstream);
    },
  );
  await new Promise((resolve) => proxy.listen(3000, "127.0.0.1", resolve));
  let browser, testUserId, draftId;
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch("http://127.0.0.1:3001/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.QA_BROWSER_PATH,
      args: ["--disable-gpu"],
    });
    const context = await browser.newContext({ ignoreHTTPSErrors: true }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.__metrics = { lcp: 0, cls: 0 };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__metrics.lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (!e.hadRecentInput) window.__metrics.cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    const root = await page.goto("https://localhost:3000", {
      waitUntil: "networkidle",
    });
    assert.equal(root.status(), 200);
    assert(root.headers()["content-security-policy"].includes("'nonce-"));
    assert(
      !root.headers()["content-security-policy"].includes("'unsafe-eval'"),
    );
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      if (width === 390 || width === 1024)
        await page.screenshot({
          path: ".qa/security/launch-" + width + ".png",
          fullPage: true,
          animations: "disabled",
        });
    }
    const metrics = await page.evaluate(() => window.__metrics);
    fs.writeFileSync(
      ".qa/security/lab-metrics.json",
      JSON.stringify(metrics, null, 2),
    );
    assert.equal(
      (
        await context.request.get("https://localhost:3000/api/admin/orders")
      ).status(),
      401,
    );
    assert.equal(
      (
        await context.request.post(
          "https://localhost:3000/api/admin-access/setup",
          { data: { key: "0".repeat(64), password } },
        )
      ).status(),
      403,
    );
    await page.goto(
      "https://localhost:3000/77774555474447777554555/initialiser#key=" +
        config.setup.preview,
      { waitUntil: "networkidle" },
    );
    await page.locator("input[name=password]").fill(password);
    await page.locator("input[name=confirmation]").fill(password);
    await page.getByRole("button", { name: "Protéger mon espace" }).click();
    await page.waitForURL("**/77774555474447777554555");
    testUserId = (
      await db.query("SELECT id FROM mm_auth_user WHERE email=$1", [email])
    ).rows[0]?.id;
    await page.locator("input[name=password]").fill(password);
    await page.getByRole("button", { name: "Entrer dans mon espace" }).click();
    await page
      .getByRole("heading", { name: "La correspondance Maison Miroir" })
      .waitFor();
    const session = (await context.cookies()).find((c) =>
      c.name.includes("session_token"),
    );
    assert(
      session &&
        session.httpOnly &&
        session.secure &&
        session.sameSite === "Strict",
    );
    assert.equal(
      (
        await context.request.get("https://localhost:3000/api/admin/orders")
      ).status(),
      200,
    );
    assert.equal(
      (
        await context.request.post(
          "https://localhost:3000/api/admin-access/setup",
          {
            data: {
              key: config.setup.preview,
              password: "Another-valid-password-2026!",
            },
          },
        )
      ).status(),
      403,
    );
    assert.equal(
      (
        await context.request.post(
          "https://localhost:3000/api/admin/newsletter",
          {
            headers: { origin: "https://evil.test" },
            data: {
              action: "preview",
              id: "11111111-1111-4111-8111-111111111111",
            },
          },
        )
      ).status(),
      403,
    );
    const created = await context.request.post(
      "https://localhost:3000/api/admin/newsletter",
      {
        data: {
          action: "create",
          id: "",
          title: "QA isolated draft",
          subject: "QA subject",
          body: "QA content",
          productIds: [],
        },
      },
    );
    assert.equal(created.status(), 200);
    draftId = (await created.json()).id;
    assert.equal(
      (
        await context.request.post(
          "https://localhost:3000/api/admin/newsletter",
          { data: { action: "preview", id: draftId } },
        )
      ).status(),
      200,
    );
    assert.equal(
      (
        await context.request.post(
          "https://localhost:3000/api/admin/newsletter",
          { data: { action: "approve", id: draftId, role: "admin" } },
        )
      ).status(),
      400,
    );
    await page.reload({ waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "La correspondance Maison Miroir" })
      .waitFor();
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await page.locator("input[name=password]").waitFor();
    assert.equal(
      (
        await context.request.get("https://localhost:3000/api/admin/orders")
      ).status(),
      401,
    );
    for (let i = 0; i < 7; i++)
      await context.request.post(
        "https://localhost:3000/api/admin-access/login",
        { data: { password: "A-wrong-temporary-password-2026!" } },
      );
    assert.equal(
      (
        await context.request.post(
          "https://localhost:3000/api/admin-access/login",
          { data: { password } },
        )
      ).status(),
      429,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: HTTPS production UI at four widths, CSP, private one-time setup, password-only login, protected cookies, refresh persistence, admin draft and preview, strict validation, CSRF, logout and brute-force protection. No real email or payment.",
    );
    console.log("Local lab metrics:", metrics);
  } finally {
    await browser?.close();
    await new Promise((resolve) => proxy.close(resolve));
    server.kill();
    fs.closeSync(log);
    // Explicit fixture identities only. Never clear a table or unrelated audit/rate-limit history.
    testUserId ||= (
      await db.query("SELECT id FROM mm_auth_user WHERE email=$1", [email])
    ).rows[0]?.id;
    if (testUserId) {
      await db.query("DELETE FROM mm_admin_audit WHERE actor_id=$1", [
        testUserId,
      ]);
      await db.query("DELETE FROM mm_auth_user WHERE id=$1 AND email=$2", [
        testUserId,
        email,
      ]);
    }
    if (draftId)
      await db.query(
        "DELETE FROM mm_campaigns WHERE id=$1 AND title='QA isolated draft'",
        [draftId],
      );
    await db.query("DELETE FROM mm_auth_rate_limit WHERE key LIKE $1", [
      ip + "%",
    ]);
    const rateKey =
      "admin-setup:" +
      crypto
        .createHash("sha256")
        .update(config.secrets.NEWSLETTER_HASH_SECRET + ip)
        .digest("hex");
    await db.query("DELETE FROM mm_rate_limits WHERE key=$1", [rateKey]);
    if (testUserId)
      await db.query(
        "UPDATE mm_admin_setup SET claimed_at=NULL,token_hash=$1 WHERE singleton=true",
        [
          crypto
            .createHash("sha256")
            .update(config.setup.preview)
            .digest("hex"),
        ],
      );
    await db.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
