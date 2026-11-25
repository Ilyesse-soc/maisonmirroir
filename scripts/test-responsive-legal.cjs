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
    await context.addInitScript(() => {
      localStorage.setItem("mm-audience-consent-v1", "rejected");
    });
    const page = await context.newPage();
    const openCartDrawer = async (width) => {
      if (width < 1024) {
        await page.locator(".mm-navbar-menu").click();
        await page.locator("#mm-mobile-menu .mm-navbar-cart").click();
      } else {
        await page.locator(".mm-navbar-cart").click();
      }
      await page.locator("dialog[open]").waitFor();
      await page
        .locator(".mm-cart-panel")
        .evaluate(async (panel) =>
          Promise.all(panel.getAnimations().map((animation) => animation.finished)),
        );
    };
    const seedCartWithCatalogProducts = () =>
      page.evaluate(() => {
        localStorage.setItem(
          "mm:cart:v1",
          JSON.stringify({
            shippingMethodId: "mondial-relay-point-relais",
            items: [
              {
                key: "qa-modest-era",
                productId: "modest-era",
                name: "Modest Era",
                category: "sacs",
                categoryLabel: "Première collection - For Modest Girls",
                image: "/collection/modest-era-feature.jpeg",
                unitPrice: 29.69,
                quantity: 1,
              },
              {
                key: "qa-paradise-way",
                productId: "paradise-way",
                name: "Paradise Way",
                category: "sacs",
                categoryLabel: "Première collection - For Modest Girls",
                image: "/collection/paradise-way-product.webp",
                unitPrice: 31.69,
                quantity: 1,
              },
            ],
          }),
        );
      });
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
          waitUntil: "domcontentloaded",
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
            .evaluate(
              (video) =>
                Boolean(video.getAttribute("poster")) &&
                Boolean(video.querySelector("source[src]")),
            ),
          "active showcase video has a poster and source",
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

    for (const productId of ["modest-era", "paradise-way"]) {
      for (const [width, height] of [
        [320, 568],
        [390, 844],
        [768, 1024],
        [1024, 1366],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        const response = await page.goto(
          `http://127.0.0.1:43819/product/${productId}`,
          { waitUntil: "domcontentloaded" },
        );
        assert.equal(response.status(), 200);
        const copy = page.locator(".product-detail-copy");
        const featureList = copy.locator(".product-feature-list");
        await featureList.waitFor();
        assert.equal(await page.locator(".product-availability").count(), 1);
        assert.match(
          await page.locator(".product-availability").innerText(),
          /^(Disponible|Victime de son succès)$/,
        );
        assert.match(
          await copy.locator(".storefront-product-price").innerText(),
          /29,90\s*€/,
        );
        assert.equal(await featureList.locator("li").count(), 5);
        assert.doesNotMatch(await featureList.innerText(), /◇|◈/);
        assert.equal(
          await copy.getByText(/Sous-total produits \(-/).count(),
          0,
        );
        const presentation = await copy.evaluate((element) => {
          const description = element.querySelector(".storefront-lede");
          const price = element.querySelector(".storefront-product-price");
          const features = element.querySelector(".product-feature-list");
          const style = features && getComputedStyle(features);
          return {
            ordered:
              Boolean(description && price && features) &&
              (description.compareDocumentPosition(price) &
                Node.DOCUMENT_POSITION_FOLLOWING) !==
                0 &&
              (price.compareDocumentPosition(features) &
                Node.DOCUMENT_POSITION_FOLLOWING) !==
                0,
            priceColor: price ? getComputedStyle(price).color : "",
            featureBorderTop: style?.borderTopStyle,
            featureBorderColor: style?.borderTopColor,
            featureBorderSide: style?.borderLeftWidth,
            featureBackground: style?.backgroundColor,
          };
        });
        assert.equal(presentation.ordered, true);
        assert.equal(presentation.priceColor, "rgb(56, 38, 31)");
        assert.equal(presentation.featureBorderTop, "solid");
        assert.equal(presentation.featureBorderColor, "rgb(216, 203, 189)");
        assert.equal(presentation.featureBorderSide, "0px");
        assert.equal(presentation.featureBackground, "rgba(0, 0, 0, 0)");
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${productId} has horizontal overflow at ${width}px`,
        );
        if ([390, 1440].includes(width))
          await page.screenshot({
            path: path.join(
              directory,
              `product-${productId}-${width}.png`,
            ),
            fullPage: true,
            animations: "disabled",
          });
      }
    }

    for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto("http://127.0.0.1:43819/newsletter", {
        waitUntil: "domcontentloaded",
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

    const cartViewports = [
      [320, 568],
      [375, 812],
      [390, 844],
      [430, 932],
      [768, 1024],
      [1024, 1366],
      [1440, 900],
      [1920, 1080],
    ];
    for (const [width, height] of cartViewports) {
      await page.setViewportSize({ width, height });
      await page.goto("http://127.0.0.1:43819/newsletter", {
        waitUntil: "domcontentloaded",
      });
      await openCartDrawer(width);
      const dialog = page.getByRole("dialog", { name: "PANIER" });
      assert.equal(await dialog.getAttribute("aria-modal"), "true");
      assert.equal(await dialog.getAttribute("aria-labelledby"), "cart-drawer-title");
      assert.equal(
        await dialog.getByRole("heading", { name: "PANIER", exact: true }).count(),
        1,
      );
      assert.equal(
        await page.locator(".mm-cart-close").evaluate(
          (button) => button === document.activeElement,
        ),
        true,
      );
      const panelSize = await page.locator(".mm-cart-panel").evaluate((panel) => {
        const rect = panel.getBoundingClientRect();
        const style = getComputedStyle(panel);
        return {
          width: rect.width,
          height: rect.height,
          clientWidth: panel.clientWidth,
          backgroundColor: style.backgroundColor,
        };
      });
      assert(Math.abs(panelSize.width - Math.min(width, 480)) <= 1);
      assert(Math.abs(panelSize.height - height) <= 1);
      assert(Math.abs(panelSize.clientWidth - panelSize.width) <= 1);
      assert.equal(panelSize.backgroundColor, "rgb(250, 247, 242)");
      const summary = await page.locator(".mm-cart-footer").innerText();
      assert.match(summary, /Sous-total\s+0,00\s*€/);
      assert.match(summary, /Livraison\s+À calculer/);
      assert.match(summary, /Total\s+0,00\s*€/);
      assert.equal(await page.locator(".mm-cart-checkout").isDisabled(), true);
      assert.match(
        await page.locator("#cart-orders-notice").innerText(),
        /Les commandes ouvriront prochainement/,
      );
      assert.equal(
        await page.locator(".mm-cart-checkout").evaluate(
          (button) => getComputedStyle(button).backgroundColor,
        ),
        "rgb(48, 32, 23)",
      );
      assert.equal(
        await page.locator(".mm-cart-checkout").evaluate(
          (button) => getComputedStyle(button).backgroundImage,
        ),
        "none",
      );
      assert(
        await page.locator(".mm-cart-footer").evaluate(
          (footer) =>
            footer.getBoundingClientRect().bottom <= window.innerHeight + 1,
        ),
        `Cart actions remain visible at ${width}x${height}`,
      );
      assert.equal(
        await page.evaluate(
          () => getComputedStyle(document.body).position,
        ),
        "fixed",
      );
      if ([390, 1440].includes(width)) {
        await page.screenshot({
          path: path.join(
            directory,
            `cart-empty-${width === 390 ? "mobile" : "desktop"}.png`,
          ),
          animations: "disabled",
        });
      }
      if (width === 320) {
        await page.keyboard.press("Escape");
      } else if (width === 1440) {
        await page.mouse.click(100, Math.round(height / 2));
      } else {
        await page.getByRole("button", { name: "Fermer le panier" }).click();
      }
      await page.waitForFunction(() => !document.querySelector("dialog")?.open);
      assert.equal(
        await page.evaluate(
          () => getComputedStyle(document.body).position !== "fixed",
        ),
        true,
      );
      await page.waitForFunction((selector) => {
        return document.activeElement === document.querySelector(selector);
      }, width < 1024 ? ".mm-navbar-menu" : ".mm-navbar-cart");
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://127.0.0.1:43819/newsletter", {
      waitUntil: "domcontentloaded",
    });
    await seedCartWithCatalogProducts();
    await page.reload({ waitUntil: "domcontentloaded" });
    await openCartDrawer(1440);
    assert.equal(await page.getByText("Modest Era", { exact: true }).count(), 1);
    assert.equal(await page.getByText("Paradise Way", { exact: true }).count(), 1);
    assert(
      await page
        .locator(".mm-cart-item-image img")
        .evaluateAll(
          (images) =>
            images.length === 2 &&
            images.every((image) => image.complete && image.naturalWidth > 0),
        ),
      "real catalog product images load",
    );
    assert.match(await page.locator(".mm-cart-footer").innerText(), /61,38\s*€/);
    assert.match(await page.locator(".mm-cart-item").nth(0).innerText(), /29,69\s*€ l’unité/);
    assert.match(await page.locator(".mm-cart-item").nth(1).innerText(), /31,69\s*€ l’unité/);
    assert.match(await page.locator(".mm-cart-footer").innerText(), /Livraison\s+À calculer/);
    assert.match(await page.locator(".mm-cart-footer").innerText(), /Total\s+À calculer/);
    await page.screenshot({
      path: path.join(directory, "cart-filled-desktop.png"),
      animations: "disabled",
    });
    const itemQuantity = page.locator(".mm-cart-item").nth(0).locator(".mm-cart-quantity span");
    await page
      .getByRole("button", { name: "Augmenter la quantité de Modest Era" })
      .click();
    assert.equal(await itemQuantity.innerText(), "2");
    assert.match(await page.locator(".mm-cart-header p").innerText(), /3 articles/);
    assert.match(await page.locator(".mm-cart-footer").innerText(), /91,07\s*€/);
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("mm:cart:v1") || "{}").items[0]
            .quantity,
      ),
      2,
    );
    assert.match(
      await page
        .locator('.sr-only[aria-live="polite"][aria-atomic="true"]')
        .innerText(),
      /Modest Era, quantité 2/,
    );
    await page
      .getByRole("button", { name: "Diminuer la quantité de Modest Era" })
      .click();
    assert.equal(await itemQuantity.innerText(), "1");
    await page
      .getByRole("button", { name: "Supprimer Modest Era du panier" })
      .click();
    assert.equal(await page.getByText("Paradise Way", { exact: true }).count(), 1);
    assert.match(await page.locator(".mm-cart-header p").innerText(), /1 article/);
    assert.match(await page.locator(".mm-cart-footer").innerText(), /31,69\s*€/);
    await page
      .getByRole("button", { name: "Supprimer Paradise Way du panier" })
      .click();
    assert.equal(await page.getByText("Votre panier est vide").count(), 1);
    assert.equal(await page.locator(".mm-cart-header p").innerText(), "0 article");
    await page.getByRole("button", { name: "Fermer le panier" }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await seedCartWithCatalogProducts();
    await page.reload({ waitUntil: "domcontentloaded" });
    await openCartDrawer(390);
    await page.waitForFunction(() => {
      const images = Array.from(
        document.querySelectorAll(".mm-cart-item-image img"),
      );
      return (
        images.length === 2 &&
        images.every((image) => image.complete && image.naturalWidth > 0)
      );
    });
    await page.screenshot({
      path: path.join(directory, "cart-filled-mobile.png"),
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Fermer le panier" }).click();
    await page.evaluate(() => {
      localStorage.removeItem("mm:cart:v1");
      localStorage.removeItem("mm:cart:shipping:v1");
    });

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
    await page.goto("http://127.0.0.1:43819", {
      waitUntil: "domcontentloaded",
    });
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
        { waitUntil: "domcontentloaded" },
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
      "retractation",
      "politique-de-confidentialite",
      "politique-de-cookies",
    ];
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of legalRoutes) {
        const response = await page.goto(
          `http://127.0.0.1:43819/${route}`,
          { waitUntil: "domcontentloaded" },
        );
        assert.equal(response.status(), 200, route);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${route} has horizontal overflow at ${width}px`,
        );
        assert.equal(
          await page.locator('meta[name="robots"]').getAttribute("content"),
          "noindex, follow",
          `${route} has noindex metadata`,
        );
      }
    }

    await page.goto("http://127.0.0.1:43819/product/modest-era");
    await page.locator(".product-availability").waitFor();
    assert.equal(
      (await page.locator(".product-availability").first().innerText()).trim(),
      "Victime de son succès",
    );
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
      `PASS: ${results.length} storefront responsive checks, ${cartViewports.length} cart viewports, mobile and desktop product detail checks for Modest Era and Paradise Way, empty and filled cart controls, accessibility, responsive newsletter pages, safely disabled newsletter delivery and orders, no third-party requests, no emails or payments.`,
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
