const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { chromium, firefox } = require("@playwright/test");
const firefoxRun = process.env.QA_ENGINE === "firefox";
const directory = path.resolve(
  ".qa/responsive-legal",
  firefoxRun ? "firefox" : ".",
);
fs.mkdirSync(directory, { recursive: true });
for (const [src, dest] of [
  ["public", ".next/standalone/public"],
  [".next/static", ".next/standalone/.next/static"],
])
  fs.cpSync(src, dest, { recursive: true });
const env = {
  ...process.env,
  HOSTNAME: "127.0.0.1",
  PORT: "43819",
  NODE_ENV: "production",
  SHOP_OPEN: "false",
  NEWSLETTER_DATABASE_URL: "",
  RESEND_API_KEY: "",
  NEWSLETTER_SEND_ENABLED: "false",
  PAYPAL_ENV: "",
  PAYPAL_CLIENT_ID: "",
  PAYPAL_CLIENT_SECRET: "",
  PAYPAL_MERCHANT_ID: "",
  PAYPAL_WEBHOOK_ID: "",
  NEXT_TELEMETRY_DISABLED: "1",
};
const log = fs.openSync(path.join(directory, "local-server.log"), "w");
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  env,
  stdio: ["ignore", log, log],
  windowsHide: true,
});

async function main() {
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch("http://127.0.0.1:43819")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(ready, "Local server ready");
    browser = await (firefoxRun ? firefox : chromium).launch({
      headless: true,
      executablePath: firefoxRun ? undefined : process.env.QA_BROWSER_PATH,
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    const thirdParties = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1") {
        thirdParties.push(url.hostname);
        return route.abort();
      }
      return route.continue();
    });

    const viewportSizes = [
      [320, 568],
      [360, 800],
      [375, 812],
      [390, 844],
      [393, 852],
      [430, 932],
      [768, 1024],
      [820, 1180],
      [1024, 1366],
      [1280, 720],
      [1366, 768],
      [1440, 900],
      [1920, 1080],
      [2560, 1440],
    ];
    const results = [];
    for (const [width, height] of viewportSizes) {
      for (const [viewportWidth, viewportHeight] of [
        [width, height],
        [height, width],
      ]) {
        await page.setViewportSize({
          width: viewportWidth,
          height: viewportHeight,
        });
        const response = await page.goto("http://127.0.0.1:43819", {
          waitUntil: "networkidle",
        });
        assert.equal(response.status(), 200);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(
          await page.locator(".storefront-showcase-title").textContent(),
          "MAISON MIROIR",
        );
        assert.equal(await page.locator(".storefront-product-card").count(), 2);
        assert.equal(await page.locator("form").count(), 0);
        assert.equal(await page.locator("#newsletter").count(), 0);
        if (viewportWidth >= 1024)
          assert.equal(
            await page.locator('.mm-navbar-links a[href="/newsletter"]').count(),
            1,
          );
        assert(
          await page
            .locator(".storefront-showcase-slide.is-active video")
            .evaluate((video) => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA),
        );
        const overflow = await page.evaluate(() =>
          Array.from(document.querySelectorAll("main *"))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return (
                rect.width > 1 &&
                style.position !== "absolute" &&
                !element.closest(".honeypot, .sr-only") &&
                !element.closest(".storefront-showcase-frame") &&
                (rect.right > innerWidth + 1 || rect.left < -1)
              );
            })
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                element: element.tagName + "." + element.className,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                position: getComputedStyle(element).position,
              };
            }),
        );
        assert.deepEqual(
          overflow,
          [],
          `Element overflow at ${viewportWidth}x${viewportHeight}`,
        );
        assert.equal(
          await page.locator(".home-order-status").textContent(),
          "Pas encore ouverte",
        );
        assert.equal(
          await page.locator(".home-order-notice").count(),
          1,
        );
        results.push({
          width: viewportWidth,
          height: viewportHeight,
          passed: true,
        });
        if ([390, 430, 768, 1440].includes(viewportWidth))
          await page.screenshot({
            path: path.join(
              directory,
              `storefront-${viewportWidth}-${viewportHeight}.png`,
            ),
            fullPage: true,
            animations: "disabled",
          });
      }
    }

    for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto("http://127.0.0.1:43819/newsletter", {
        waitUntil: "networkidle",
      });
      assert.equal(response.status(), 200);
      assert.equal(await page.locator(".launch").count(), 1);
      assert.equal(await page.locator(".launch-header").count(), 1);
      assert.equal(await page.locator(".launch-footer").count(), 1);
      assert.equal(await page.locator(".newsletter-form").count(), 1);
      assert.equal(await page.locator('input[type="email"]').count(), 1);
      assert.equal(await page.getByLabel("Votre adresse e-mail").count(), 1);
      assert.equal(await page.locator('input[name="consent"][required]').count(), 1);
      assert.equal(
        await page.locator(".coming.sr-only").evaluate(
          (element) => getComputedStyle(element).position,
        ),
        "absolute",
      );
      assert.equal(await page.locator(".mm-navbar").count(), 1);
      if (width >= 1024) {
        assert.equal(await page.locator(".mm-navbar-links a").count(), 6);
        assert.equal(
          await page.locator('.mm-navbar-links a[href="/newsletter"]').getAttribute("aria-current"),
          "page",
        );
      } else {
        const menuButton = page.locator(".mm-navbar-menu");
        assert.equal(await menuButton.count(), 1);
        await menuButton.click();
        assert.equal(
          await page.locator('#mm-mobile-menu a[href="/newsletter"]').count(),
          1,
        );
        assert.equal(
          await page.locator("#mm-mobile-menu a").count(),
          6,
        );
        await menuButton.click();
      }
      assert.equal(await page.locator(".storefront-footer").count(), 0);
      assert.equal(
        await page.locator(".brand-message h1").innerText(),
        "For the girls with\nhaya and big dreams",
      );
      assert(
        await page
          .locator(".illustration img")
          .evaluate((image) => image.complete && image.naturalWidth > 0),
        "original launch illustration loads",
      );
      assert.equal(
        await page.locator(".signup-row").evaluate(
          (element) => getComputedStyle(element).flexDirection,
        ),
        width <= 700 ? "column" : "row",
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `newsletter has horizontal overflow at ${width}px`,
      );
      if ([390, 1440].includes(width))
        await page.screenshot({
          path: path.join(directory, `newsletter-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:43819/newsletter", {
      waitUntil: "networkidle",
    });
    await page.locator(".mm-navbar-menu").click();
    await page.locator("#mm-mobile-menu .mm-navbar-cart").click();
    assert.equal(
      await page.locator('[aria-hidden="false"] .mm-drawer-panel').count(),
      1,
    );
    assert(
      (await page.locator(".mm-drawer-panel").getAttribute("class")).includes(
        "mm-drawer-panel--launch",
      ),
    );
    const emptyCartSummary = await page
      .locator(".mm-drawer-summary")
      .innerText();
    assert.match(emptyCartSummary, /Sous-total\s+0\.00 €/);
    assert.match(emptyCartSummary, /Livraison\s+0\.00 €/);
    assert.match(emptyCartSummary, /Total\s+0\.00 €/);
    assert.doesNotMatch(emptyCartSummary, /Mode:/);
    assert.equal(
      await page
        .locator(".mm-drawer-panel .btn-gold")
        .evaluate((button) => getComputedStyle(button).color),
      "rgb(243, 236, 225)",
    );
    await page.getByRole("button", { name: "Fermer le panier" }).click();

    await page.route("**/api/newsletter", async (route) => {
      assert.equal(route.request().method(), "POST");
      assert.deepEqual(route.request().postDataJSON(), {
        email: "preview@example.test",
        consent: true,
        website: "",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.getByLabel("Votre adresse e-mail").fill("preview@example.test");
    await page.locator('input[name="consent"]').check();
    await page.locator(".signup-row button").click();
    await page.getByRole("status").getByText(/confirmez votre inscription/i).waitFor();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:43819", { waitUntil: "networkidle" });
    await page.locator(".mm-navbar-menu").click();
    assert.equal(
      await page.locator('#mm-mobile-menu a[href="/newsletter"]').count(),
      1,
    );
    await page.locator('#mm-mobile-menu a[href="/newsletter"]').click();
    await page.waitForURL("**/newsletter");

    const publicRoutes = [
      "catalogue",
      "newsletter",
      "notre-histoire",
      "faq",
      "contact",
      "category/sacs",
      "product/modest-era",
      "product/paradise-way",
    ];
    for (const route of publicRoutes) {
      const response = await page.goto(
        `http://127.0.0.1:43819/${route}`,
        { waitUntil: "networkidle" },
      );
      assert.equal(response.status(), 200, route);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} has horizontal overflow`,
      );
    }

    const legalRoutes = [
      "mentions-legales",
      "conditions-de-vente",
      "livraison",
      "retours",
      "politique-de-confidentialite",
      "politique-de-cookies",
    ];
    for (const route of legalRoutes) {
      const response = await page.goto(
        `http://127.0.0.1:43819/${route}`,
        { waitUntil: "networkidle" },
      );
      assert.equal(response.status(), 200, route);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} has horizontal overflow`,
      );
      assert.equal(
        await page.locator('meta[name="robots"]').getAttribute("content"),
        "noindex, follow",
        `${route} has noindex metadata`,
      );
    }

    await page.goto("http://127.0.0.1:43819/product/modest-era");
    assert.equal(await page.locator(".product-coming-soon").count(), 1);
    assert.equal(await page.locator("form").count(), 0);
    assert.equal(await page.locator("iframe").count(), 0);
    for (const route of ["panier", "checkout"]) {
      await page.goto(`http://127.0.0.1:43819/${route}`);
      assert.equal(new URL(page.url()).pathname, "/");
    }
    await page.goto("http://127.0.0.1:43819/confidentialite");
    assert.equal(
      new URL(page.url()).pathname,
      "/politique-de-confidentialite",
    );

    const api = page.request;
    assert.equal(
      (
        await api.post("http://127.0.0.1:43819/api/newsletter", {
          data: { email: "qa@example.test", consent: true },
        })
      ).status(),
      503,
    );
    assert.equal(
      (
        await api.post("http://127.0.0.1:43819/api/order", {
          headers: { origin: "http://127.0.0.1:43819" },
          data: {},
        })
      ).status(),
      403,
    );
    assert.deepEqual(await context.cookies(), [], "No public cookies");
    assert.deepEqual(
      thirdParties,
      [],
      "No third-party resources or trackers",
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(directory, "resultats.json"),
      JSON.stringify(
        {
          browser: firefoxRun ? "Firefox" : "Chromium",
          results,
          errors,
          thirdParties,
          productionTouched: false,
        },
        null,
        2,
      ),
    );
    console.log(
      `PASS: ${results.length} responsive viewport checks, storefront and restored newsletter pages, legal placeholders, safely disabled newsletter delivery and order APIs, no third-party requests, no emails or payments.`,
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
    fs.closeSync(log);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
