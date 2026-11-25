const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("../.qa/node_modules/playwright");

async function main() {
  const styles = [
    fs.readFileSync(path.resolve("app/admin/admin.css"), "utf8"),
    fs.readFileSync(path.resolve("app/newsletter/newsletter.css"), "utf8"),
  ].join("\n");
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.QA_BROWSER_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <!doctype html>
      <html lang="fr">
        <head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
          html, body { margin: 0; }
          ${styles}
        </style></head>
        <body>
          <div class="admin-shell">
            <aside class="admin-sidebar">
              <a class="admin-brand" href="#">MAISON MIROIR</a>
              <nav>
                <a href="#">Tableau de bord</a><a href="#">Abonnées</a>
                <a href="#">Campagnes</a><a href="#">Miroir AI</a>
                <a href="#">Calendrier</a><a href="#">Paramètres</a>
                <a href="#">Commandes</a>
              </nav>
            </aside>
            <div class="admin-content">
              <main class="newsletter-page">
                <h1>La correspondance MAISON MIROIR</h1>
                <p>Préparez et prévisualisez votre campagne.</p>
                <button>Préparer l’annonce du lancement</button>
                <form>
                  <h2>Nouvelle campagne</h2>
                  <label>Titre interne<input name="title"></label>
                  <label>Objet de l’e-mail<input name="subject"></label>
                  <label>Texte principal<textarea rows="5"></textarea></label>
                  <label>Produits<select multiple><option>Modest Era</option></select></label>
                  <button>Enregistrer le brouillon</button>
                </form>
                <h2>Campagnes et historique</h2>
                <div class="table-scroll"><table>
                  <thead><tr><th>Campagne</th><th>Statut</th><th>Destinataires</th><th>Actions</th></tr></thead>
                  <tbody><tr><td>Annonce de la première collection</td><td>draft</td><td>12</td>
                    <td><div class="admin-actions"><button>Modifier</button><button>Prévisualiser</button><button>Valider l’envoi</button></div></td>
                  </tr></tbody>
                </table></div>
                <iframe title="Aperçu de la campagne" style="width:390px;max-width:100%"></iframe>
              </main>
            </div>
          </div>
        </body>
      </html>
    `);

    for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => {
        const main = document.querySelector(".newsletter-page");
        const mainRect = main.getBoundingClientRect();
        const tableWrap = document.querySelector(".table-scroll");
        const table = tableWrap.querySelector("table");
        const iframe = document.querySelector("iframe");
        const iframeRect = iframe.getBoundingClientRect();
        return {
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          mainLeft: mainRect.left,
          mainRight: mainRect.right,
          iframeRight: iframeRect.right,
          tableWrapWidth: tableWrap.clientWidth,
          tableWidth: table.scrollWidth,
          tableOverflow: getComputedStyle(tableWrap).overflowX,
          navOverflow: getComputedStyle(document.querySelector(".admin-sidebar nav")).overflowX,
        };
      });
      assert(
        layout.documentWidth <= width,
        `Horizontal page overflow at ${width}px: ${layout.documentWidth}px`,
      );
      assert(layout.mainLeft >= 0, `Campaign page is clipped at ${width}px`);
      assert(layout.mainRight <= width, `Campaign page exceeds ${width}px`);
      assert(layout.iframeRight <= width, `Preview exceeds ${width}px`);
      assert.equal(layout.tableOverflow, "auto");
      if (width <= 800) {
        assert(layout.tableWidth > layout.tableWrapWidth);
        assert(["auto", "scroll"].includes(layout.navOverflow));
      }
    }
    const chartBars = Array.from(
      { length: 30 },
      (_, index) =>
        `<span class="admin-audience-chart-bar" style="height:${20 + (index % 8) * 10}%"></span>`,
    ).join("");
    await page.setContent(`
      <!doctype html>
      <html lang="fr">
        <head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
          html, body { margin: 0; }
          ${styles}
        </style></head>
        <body>
          <div class="admin-shell">
            <aside class="admin-sidebar">
              <a class="admin-brand" href="#">MAISON MIROIR</a>
              <nav><a href="#">Audience en direct</a><a href="#">Commandes</a></nav>
            </aside>
            <div class="admin-content">
              <main class="admin-page">
                <h1>Audience en direct</h1>
                <p class="admin-muted">Estimation fondée sur les sessions récentes.</p>
                <section class="admin-grid" aria-label="Audience actuelle et du jour">
                  ${Array.from({ length: 8 }, (_, index) => `
                    <article class="admin-stat"><span>Statistique ${index + 1}</span><strong>24</strong></article>
                  `).join("")}
                </section>
                <section class="admin-card admin-audience-products">
                  <h2>Pages produits aujourd’hui</h2>
                  <div class="admin-grid">
                    <article class="admin-stat"><span>Modest Era</span><strong>12</strong></article>
                    <article class="admin-stat"><span>Paradise Way</span><strong>9</strong></article>
                  </div>
                </section>
                <section class="admin-card admin-audience-section">
                  <h2>Fréquentation par heure aujourd’hui</h2>
                  <div class="admin-audience-chart">${chartBars}</div>
                </section>
                <section class="admin-card admin-audience-section">
                  <div class="admin-audience-heading">
                    <h2>Historique de fréquentation</h2>
                    <label>Période<select><option>7 jours</option><option>30 jours</option></select></label>
                  </div>
                  <div class="admin-audience-chart">${chartBars}</div>
                  <div class="admin-table-wrap"><table>
                    <thead><tr><th>Jour</th><th>Visiteurs</th><th>Pages consultées</th></tr></thead>
                    <tbody><tr><td>lundi</td><td>12</td><td>31</td></tr></tbody>
                  </table></div>
                </section>
              </main>
            </div>
          </div>
        </body>
      </html>
    `);
    for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => {
        const main = document.querySelector(".admin-page");
        const mainRect = main.getBoundingClientRect();
        const charts = [...document.querySelectorAll(".admin-audience-chart")];
        const heading = document
          .querySelector(".admin-audience-heading")
          .getBoundingClientRect();
        return {
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          mainLeft: mainRect.left,
          mainRight: mainRect.right,
          chartsFit: charts.every(
            (chart) => chart.scrollWidth <= chart.clientWidth,
          ),
          headingRight: heading.right,
        };
      });
      assert(
        layout.documentWidth <= width,
        `Horizontal audience page overflow at ${width}px: ${layout.documentWidth}px`,
      );
      assert(layout.mainLeft >= 0, `Audience page is clipped at ${width}px`);
      assert(layout.mainRight <= width, `Audience page exceeds ${width}px`);
      assert(layout.chartsFit, `Audience chart overflows at ${width}px`);
      assert(layout.headingRight <= width, `Audience controls exceed ${width}px`);
    }
    console.log("PASS: admin campaign and audience layouts at 320, 375, 390, 430, 768, 1024, 1440 and 1920 px.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
