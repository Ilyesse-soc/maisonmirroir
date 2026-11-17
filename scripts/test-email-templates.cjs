// Actual HTML renderer previews; no SMTP, Resend or subscriber API calls.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require("@playwright/test");
const {
  renderNewsletterEmail,
  emailSubjects,
} = require("../lib/newsletterTemplates.mjs");
async function main() {
  const directory = path.resolve(".qa/email-previews");
  fs.mkdirSync(directory, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.QA_BROWSER_PATH,
  });
  const results = [];
  try {
    for (const kind of ["confirmation", "welcome", "launch", "unsubscribe"]) {
      // Tokens here are inert preview data, never submitted to any service.
      const actionUrl =
        kind === "confirmation"
          ? "https://maison-miroir.fr/newsletter/confirmer#token=" +
            "0".repeat(64)
          : kind === "launch"
            ? "https://maison-miroir.fr/catalogue"
            : "https://maison-miroir.fr";
      const email = renderNewsletterEmail(kind, {
        siteUrl: "https://maison-miroir.fr",
        actionUrl,
        unsubscribeUrl: ["welcome", "launch"].includes(kind)
          ? "https://maison-miroir.fr/newsletter/desinscription#token=" +
            "0".repeat(64)
          : undefined,
      });
      assert.equal(email.subject, emailSubjects[kind]);
      assert(email.text.length > 150);
      assert(!/<script\b/i.test(email.html));
      assert(email.html.length < 100 * 1024);
      assert(email.html.includes(actionUrl));
      fs.writeFileSync(path.join(directory, kind + ".html"), email.html);
      fs.writeFileSync(path.join(directory, kind + ".txt"), email.text);
      for (const width of [390, 600]) {
        const context = await browser.newContext({
            viewport: { width, height: 900 },
          }),
          page = await context.newPage();
        await context.route("**/*", async (route) => {
          const url = new URL(route.request().url());
          if (
            url.hostname === "maison-miroir.fr" &&
            url.pathname.startsWith("/email-assets/")
          ) {
            const file = path.join(
              "public/email-assets",
              path.basename(url.pathname),
            );
            return route.fulfill({
              body: fs.readFileSync(file),
              contentType: file.endsWith(".png") ? "image/png" : "image/jpeg",
            });
          }
          return route.abort();
        });
        await page.setContent(email.html, { waitUntil: "networkidle" });
        assert(await page.locator("h1").isVisible());
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        assert(
          await page
            .locator("img")
            .evaluateAll((images) =>
              images.every((i) => i.complete && i.naturalWidth > 0),
            ),
        );
        assert(
          await page
            .locator("a")
            .evaluateAll((links) =>
              links.every((a) => a.href.startsWith("https://")),
            ),
        );
        await page.screenshot({
          path: path.join(directory, `${kind}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
        await page.emulateMedia({ colorScheme: "dark" });
        await page.screenshot({
          path: path.join(directory, `${kind}-${width}-dark.png`),
          fullPage: true,
        });
        results.push({
          kind,
          width,
          overflow: false,
          imagesLoaded: true,
          darkCapture: true,
        });
        await context.close();
      }
      const context = await browser.newContext({
          viewport: { width: 390, height: 900 },
        }),
        page = await context.newPage();
      await context.route("**/*", (r) => r.abort());
      await page.setContent(email.html, { waitUntil: "networkidle" });
      assert(await page.locator("h1").isVisible());
      assert(
        await page
          .getByRole("link", {
            name: /Confirmer mon inscription|Découvrir Maison Miroir|Découvrir la collection|Retour sur le site/,
          })
          .first()
          .isVisible(),
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await context.close();
    }
    assert.throws(
      () =>
        renderNewsletterEmail("welcome", {
          siteUrl: "https://maison-miroir.fr",
        }),
      /UNSUBSCRIBE_REQUIRED/,
    );
    assert.throws(
      () =>
        renderNewsletterEmail("confirmation", {
          siteUrl: "https://maison-miroir.fr",
          actionUrl: "javascript:alert(1)",
        }),
      /HTTPS_URL_REQUIRED/,
    );
    const customized = renderNewsletterEmail("welcome", {
      siteUrl: "https://maison-miroir.fr",
      actionUrl: "https://maison-miroir.fr",
      unsubscribeUrl: "https://maison-miroir.fr/newsletter/desinscription#token=" + "0".repeat(64),
      brandName: "<script>Maison</script>",
      instagramUrl: "https://www.instagram.com/maison-miroir-test/",
    });
    assert(!customized.html.includes("<script>"));
    assert(customized.html.includes("&lt;SCRIPT&gt;MAISON&lt;/SCRIPT&gt;"));
    assert(customized.html.includes('href="https://www.instagram.com/maison-miroir-test/"'));
    fs.writeFileSync(
      path.join(directory, "results.json"),
      JSON.stringify(
        {
          browser: "Chromium",
          results,
          imagesBlockedReadable: true,
          emailClientsTested: [],
          messagesSent: 0,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: four actual HTML/plain-text models, eight responsive previews, dark captures, blocked images, HTTPS links, no scripts or overflow. No email sent. Gmail/Outlook not tested.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
