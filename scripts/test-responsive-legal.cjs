// Browser-only local QA. No production configuration, database or provider calls.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { chromium, firefox } = require("@playwright/test");
const firefoxRun = process.env.QA_ENGINE === "firefox";
const before = process.argv.includes("--before");
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
      await new Promise((r) => setTimeout(r, 250));
    }
    assert(ready, "Local server ready");
    browser = await (firefoxRun ? firefox : chromium).launch({
      headless: true,
      executablePath: firefoxRun ? undefined : process.env.QA_BROWSER_PATH,
    });
    const context = await browser.newContext(),
      page = await context.newPage(),
      errors = [],
      thirdParties = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1") {
        thirdParties.push(url.hostname);
        return route.abort();
      }
      return route.continue();
    });
    const sizes = before
      ? [
          [390, 844],
          [1440, 900],
        ]
      : [
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
    for (const [width, height] of sizes) {
      for (const [w, h] of before
        ? [[width, height]]
        : [
            [width, height],
            [height, width],
          ]) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto("http://127.0.0.1:43819", { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        if (!before) {
          assert(
            await page
              .locator(".illustration img")
              .evaluate((i) => i.complete && i.naturalWidth > 0),
          );
          const overflow = await page.evaluate(() =>
            Array.from(document.querySelectorAll("main *"))
              .filter((e) => {
                const r = e.getBoundingClientRect(),
                  s = getComputedStyle(e);
                return (
                  r.width > 1 &&
                  s.position !== "absolute" &&
                  !e.closest(".honeypot, .sr-only") &&
                  (r.right > innerWidth + 1 || r.left < -1)
                );
              })
              .map((e) => e.tagName + "." + e.className),
          );
          assert.deepEqual(overflow, [], `Element overflow at ${w}x${h}`);
          assert.equal(
            await page.locator("input[name=consent]").isChecked(),
            false,
          );
          assert.equal(
            await page.locator(".social-links a").first().getAttribute("href"),
            "https://www.instagram.com/maison_miroir.fr/",
          );
          assert.equal(
            await page.locator(".social-links a").nth(1).getAttribute("href"),
            "https://www.tiktok.com/@maison.miroir.fr",
          );
        }
        results.push({ width: w, height: h, passed: true });
        if (w === width && [390, 430, 768, 1440].includes(w))
          await page.screenshot({
            path: path.join(
              directory,
              `${before ? "avant" : "apres"}-accueil-${w}.png`,
            ),
            fullPage: true,
            animations: "disabled",
          });
      }
    }
    if (!before) {
      for (const route of [
        "mentions-legales",
        "politique-de-confidentialite",
        "politique-de-cookies",
      ]) {
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(
          (
            await page.goto("http://127.0.0.1:43819/" + route, {
              waitUntil: "networkidle",
            })
          ).status(),
          200,
        );
        assert(await page.getByRole("heading", { level: 1 }).isVisible());
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.screenshot({
          path: path.join(directory, `${route}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
      for (const route of [
        "catalogue",
        "panier",
        "checkout",
        "product/test",
        "category/test",
      ]) {
        await page.goto("http://127.0.0.1:43819/" + route);
        assert.equal(new URL(page.url()).pathname, "/");
      }
      await page.goto("http://127.0.0.1:43819/confidentialite");
      assert.equal(
        new URL(page.url()).pathname,
        "/politique-de-confidentialite",
      );
      await page.goto("http://127.0.0.1:43819");
      await page
        .getByRole("button", { name: "REJOINDRE LA LISTE PRIVÉE" })
        .click();
      assert(
        await page
          .locator("input[name=email]")
          .evaluate((i) => i.validity.valueMissing),
      );
      await page.locator("input[name=email]").fill("qa@example.test");
      await page.locator("input[name=consent]").check();
      await page.route("**/api/newsletter", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Service temporairement indisponible.",
          }),
        }),
      );
      await page
        .getByRole("button", { name: "REJOINDRE LA LISTE PRIVÉE" })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "Service temporairement indisponible." })
        .waitFor();
      assert.equal(await page.locator(".form-message.success").count(), 0);
      assert.deepEqual(await context.cookies(), [], "No public cookies");
      assert.equal(
        await page.evaluate(() => localStorage.length),
        0,
        "No launch-page local storage",
      );
      assert.deepEqual(
        thirdParties,
        [],
        "No third-party resources or trackers",
      );
      assert.deepEqual(errors, []);
    }
    fs.writeFileSync(
      path.join(directory, before ? "avant-resultats.json" : "resultats.json"),
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
      `PASS: ${results.length} actual viewport checks; ${before ? "before screenshots" : "legal routes, closed shop, consent, error state, cookies and third-party audit"}. No email or database request.`,
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
    fs.closeSync(log);
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
