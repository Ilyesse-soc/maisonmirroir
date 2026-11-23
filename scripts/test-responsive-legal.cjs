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
          "Maison Miroir",
        );
        assert.equal(await page.locator(".storefront-product-card").count(), 2);
        assert.equal(await page.locator("form").count(), 0);
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

    const publicRoutes = [
      "catalogue",
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
      410,
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
      `PASS: ${results.length} responsive viewport checks, storefront pages, legal placeholders, disabled newsletter and order APIs, no third-party requests, no emails or payments.`,
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
