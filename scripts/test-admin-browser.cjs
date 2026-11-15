const { chromium } = require("../.qa/node_modules/playwright");
const assert = require("node:assert/strict");
async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu"],
    executablePath: process.env.QA_BROWSER_PATH || undefined,
  });
  try {
    const context = await browser.newContext({
      httpCredentials: {
        username: "maison",
        password: "local-qa-only-not-production",
      },
    });
    const page = await context.newPage();
    const calls = [];
    let campaigns = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Lancement",
        subject: "Un nouveau chapitre",
        body: "Bienvenue.",
        status: "draft",
        products: [],
        recipients: "0",
        accepted: "0",
        delivered: "0",
        failed: "0",
      },
    ];
    await page.route("**/api/admin/newsletter", async (route) => {
      const request = route.request();
      if (request.method() === "GET")
        return route.fulfill({
          json: {
            campaigns,
            subscribers: [],
            products: [{ id: "bag", name: "Notre sac" }],
          },
        });
      const data = request.postDataJSON();
      calls.push(data);
      if (data.action === "preview")
        return route.fulfill({ json: { html: "<h1>Bienvenue.</h1>" } });
      if (data.action === "update")
        campaigns = campaigns.map((c) => ({
          ...c,
          title: data.title,
          subject: data.subject,
          body: data.body,
        }));
      if (data.action === "approve")
        campaigns = campaigns.map((c) => ({ ...c, status: "scheduled" }));
      return route.fulfill({ json: { id: campaigns[0].id } });
    });
    await page.goto("http://localhost:3000/admin/newsletter", {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    assert.equal(
      await page.locator("input[name=title]").inputValue(),
      "Lancement",
    );
    await page.locator("input[name=title]").fill("Notre lancement");
    await page
      .getByRole("button", { name: "Enregistrer le brouillon" })
      .click();
    await page.getByRole("cell", { name: "Notre lancement" }).waitFor();
    assert.equal(calls.at(-1).action, "update");
    await page.getByRole("button", { name: "Prévisualiser" }).click();
    await page
      .frameLocator("iframe")
      .getByRole("heading", { name: "Bienvenue." })
      .waitFor();
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Valider l’envoi" }).click();
    await page.getByRole("cell", { name: "scheduled" }).waitFor();
    assert.equal(calls.at(-1).action, "approve");
    const authorized = await context.request.get(
      "http://localhost:3000/api/admin/newsletter",
    );
    assert.equal(authorized.status(), 503); // Missing DB is explicit; auth succeeded. Network API never sends mail.
    const unauth = await browser.newContext();
    const bypass = await unauth.request.get(
      "http://localhost:3000/api/admin/orders",
      {
        headers: {
          "x-middleware-subrequest":
            "middleware:middleware:middleware:middleware:middleware",
        },
      },
    );
    assert.equal(bypass.status(), 401);
    console.log(
      "PASS: authenticated admin page, edit draft, preview, approval UI (mocked campaign API), explicit unconfigured database, unauthenticated API denial including middleware bypass header. No email sent.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
