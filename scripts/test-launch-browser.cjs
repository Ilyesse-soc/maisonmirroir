const { chromium } = require("../.qa/node_modules/playwright");
const assert = require("node:assert/strict");
async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu"],
    executablePath: process.env.QA_BROWSER_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const width of [1024, 390, 320, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.locator("h1").textContent(),
        "For the girls withhaya and big dreams",
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert(
        await page
          .locator(".illustration img")
          .evaluate((img) => img.complete && img.naturalWidth > 0),
      );
      if (width === 1024 || width === 390)
        await page.screenshot({
          path: `.qa/launch-${width}.png`,
          fullPage: true,
          animations: "disabled",
          timeout: 45000,
        });
    }
    await page
      .getByRole("button", { name: "REJOINDRE LA LISTE PRIVÉE" })
      .click();
    assert.equal(
      await page
        .locator("input[name=email]")
        .evaluate((input) => input.validity.valueMissing),
      true,
    );
    await page.locator("input[name=email]").fill("qa@example.test");
    await page.locator("input[name=consent]").check();
    await page.route("**/api/newsletter", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Service temporairement indisponible." }),
      }),
    );
    await page
      .getByRole("button", { name: "REJOINDRE LA LISTE PRIVÉE" })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Service temporairement indisponible." })
      .waitFor();
    await page.unroute("**/api/newsletter");
    await page.route("**/api/newsletter", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"ok":true}',
      }),
    );
    await page
      .getByRole("button", { name: "REJOINDRE LA LISTE PRIVÉE" })
      .click();
    await page
      .getByRole("button", { name: "VÉRIFIEZ VOTRE BOÎTE E-MAIL" })
      .waitFor();
    assert(await page.locator("input[name=email]").isDisabled());
    assert.deepEqual(errors, []);
    const api = page.request;
    for (const url of [
      "/catalogue",
      "/category/sacs",
      "/product/tote-bag-premium",
      "/panier",
      "/checkout",
    ]) {
      const r = await api.get(`http://localhost:3000${url}`, {
        maxRedirects: 0,
      });
      assert.equal(r.status(), 307);
    }
    for (const url of [
      "/admin",
      "/admin/newsletter",
      "/api/admin/orders",
      "/api/admin/newsletter",
    ]) {
      const r = await api.get(`http://localhost:3000${url}`);
      assert.equal(r.status(), 401);
    }
    assert.equal(
      (
        await api.post("http://localhost:3000/api/newsletter", {
          data: { email: "bad", consent: true },
        })
      ).status(),
      400,
    );
    assert.equal(
      (
        await api.post("http://localhost:3000/api/newsletter", {
          data: { email: "qa@example.test", consent: false },
        })
      ).status(),
      400,
    );
    assert.equal(
      (
        await api.post("http://localhost:3000/api/newsletter", {
          data: { email: "qa@example.test", consent: true },
        })
      ).status(),
      503,
    );
    assert.equal(
      (await api.post("http://localhost:3000/api/newsletter/worker")).status(),
      401,
    );
    for (const url of [
      "/confidentialite",
      "/mentions-legales",
      "/newsletter/confirmer?token=invalid",
      "/newsletter/desinscription?token=invalid",
    ])
      assert.equal(
        (await api.get(`http://localhost:3000${url}`)).status(),
        200,
      );
    console.log(
      "PASS: desktop/mobile at 320/390/1024/1440px, no horizontal overflow, illustration, required fields, error/retry/success UI, duplicate submission lock, closed shop redirects, admin protection, server validation, missing configuration failure, legal and newsletter pages. No real emails sent.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
