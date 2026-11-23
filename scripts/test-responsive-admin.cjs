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
              <a class="admin-brand" href="#">Maison Miroir</a>
              <nav>
                <a href="#">Tableau de bord</a><a href="#">Abonnées</a>
                <a href="#">Campagnes</a><a href="#">Miroir AI</a>
                <a href="#">Calendrier</a><a href="#">Paramètres</a>
                <a href="#">Commandes</a>
              </nav>
            </aside>
            <div class="admin-content">
              <main class="newsletter-page">
                <h1>La correspondance Maison Miroir</h1>
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
    console.log("PASS: admin campaign layout at 320, 375, 390, 430, 768, 1024, 1440 and 1920 px.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
