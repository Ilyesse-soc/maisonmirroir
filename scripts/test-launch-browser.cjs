const { chromium } = require("../.qa/node_modules/playwright");
const assert = require("node:assert/strict");

async function assertProductImageLayout(page) {
  const layout = await page.locator(".product-gallery-detail-trigger").evaluate((container) => {
    const image = container.querySelector("img");
    const copy = document.querySelector(".product-detail-copy");
    if (!image || !copy) return null;

    const imageRect = image.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    return {
      imageLoaded: image.complete && image.naturalWidth > 0,
      imageContained:
        imageRect.left >= containerRect.left - 1 &&
        imageRect.top >= containerRect.top - 1 &&
        imageRect.right <= containerRect.right + 1 &&
        imageRect.bottom <= containerRect.bottom + 1,
      overlapsCopy:
        imageRect.left < copyRect.right &&
        imageRect.right > copyRect.left &&
        imageRect.top < copyRect.bottom &&
        imageRect.bottom > copyRect.top,
    };
  });

  assert(layout, "Product image and copy should be present");
  assert.equal(layout.imageLoaded, true, "Product image should load");
  assert.equal(layout.imageContained, true, "Product image should stay in its frame");
  assert.equal(layout.overlapsCopy, false, "Product image should not cover product text");
}

async function assertGlobalFooter(page, width) {
  const footer = page.locator("footer.storefront-footer");
  assert.equal(await footer.count(), 1);
  assert.equal(await page.locator("footer").count(), 1);
  assert.equal(await page.locator(".site-shell > footer.storefront-footer").count(), 1);
  assert.equal(
    await page.locator(".site-shell").evaluate((shell) => {
      const main = shell.querySelector("main");
      const globalFooter = shell.querySelector(":scope > footer.storefront-footer");
      return Boolean(
        main &&
          globalFooter &&
          (main.compareDocumentPosition(globalFooter) &
            Node.DOCUMENT_POSITION_FOLLOWING),
      );
    }),
    true,
    "The global footer should follow the main content",
  );
  assert.equal(await footer.locator(".storefront-footer-main > *").count(), 4);
  assert.equal(
    await footer.getByRole("link", { name: "MAISON MIROIR, accueil" }).getAttribute("href"),
    "https://preview.maison-miroir.fr:9443/",
  );
  assert.equal(await footer.locator(".storefront-footer-monogram").count(), 0);
  assert.match(await footer.locator(".storefront-footer-wordmark").innerText(), /MAISON MIROIR/);
  assert.equal(await footer.locator(".storefront-footer-social svg").count(), 2);
  assert.equal(
    await footer.locator('.storefront-footer-social a[target="_blank"][rel="noopener noreferrer"]').count(),
    2,
  );
  assert.equal(
    await footer.getByRole("link", { name: "maison.miroirs@gmail.com" }).getAttribute("href"),
    "mailto:maison.miroirs@gmail.com",
  );
  assert.equal(
    await footer.getByText("Les commandes de la première collection ne sont pas encore ouvertes.").count(),
    1,
  );
  assert.equal(
    await footer.getByText("© 2026 MAISON MIROIR. Tous droits réservés.").count(),
    1,
  );
  assert.equal(await footer.getByText("For Modest Girls").count(), 1);
  assert.match(
    await footer.evaluate((element) => getComputedStyle(element).backgroundImage),
    /footer-clouds\.png/,
  );
  assert.equal(await page.locator(".launch-footer").count(), 0);

  const gridColumns = await footer
    .locator(".storefront-footer-main")
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  assert.equal(gridColumns, width > 900 ? 4 : 2);
  if (width <= 600) {
    assert.match(
      await footer.evaluate((element) => getComputedStyle(element).backgroundSize),
      /auto 50%/,
      "Mobile cloud image should preserve its aspect ratio",
    );
    assert.match(
      await footer.evaluate((element) => getComputedStyle(element).backgroundPosition),
      /80% 100%/,
      "Mobile cloud image should use its vertical framing",
    );
    assert(
      await footer.locator("a").evaluateAll((links) =>
        links.every((link) => link.getBoundingClientRect().height >= 40),
      ),
      "Mobile footer links should have comfortable touch targets",
    );
  }
  assert(
    await footer.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    "Footer should not overflow horizontally",
  );
}

async function assertMobileFooterScroll(page, width, route) {
  const height = 844;
  await page.setViewportSize({ width, height });
  await page.goto(`http://localhost:3000${route}`, {
    waitUntil: "domcontentloaded",
  });
  const footer = page.locator("footer.storefront-footer");
  await footer.waitFor();
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  });

  const { maxScroll, footerTop } = await page.evaluate(() => {
    const element = document.querySelector("footer.storefront-footer");
    const rect = element.getBoundingClientRect();
    return {
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
      footerTop: rect.top + window.scrollY,
    };
  });
  const step = Math.max(120, Math.floor(height * 0.65));
  const positions = [0, footerTop - 40];
  for (let position = step; position < maxScroll; position += step) {
    positions.push(position);
  }
  positions.push(maxScroll);

  for (const position of positions) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), position);
    await page.waitForFunction(() => {
      const footerElement = document.querySelector("footer.storefront-footer");
      const nav = document.querySelector("#mm-navbar");
      if (!footerElement || !nav) return true;
      const rect = footerElement.getBoundingClientRect();
      const shouldHide = rect.top < window.innerHeight && rect.bottom > 0;
      return nav.classList.contains("is-footer-visible") === shouldHide;
    });

    const state = await page.evaluate(() => {
      const footerElement = document.querySelector("footer.storefront-footer");
      const nav = document.querySelector("#mm-navbar");
      const footerRect = footerElement.getBoundingClientRect();
      const footerVisible =
        footerRect.top < window.innerHeight && footerRect.bottom > 0;
      return {
        footerVisible,
        navVisibility: nav ? getComputedStyle(nav).visibility : "hidden",
        navAriaHidden: nav?.getAttribute("aria-hidden") === "true",
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });
    if (state.footerVisible) {
      assert.equal(state.navVisibility, "hidden");
      assert.equal(state.navAriaHidden, true);
    }
    assert(
      state.pageWidth <= state.viewportWidth,
      `Page should not overflow horizontally at ${width}px on ${route}`,
    );
  }

  const finalState = await page.evaluate(() => {
    const footerElement = document.querySelector("footer.storefront-footer");
    const copyright = footerElement.querySelector(".storefront-footer-bottom p");
    const signature = footerElement.querySelector(
      ".storefront-footer-bottom .storefront-footer-tagline",
    );
    const links = [...footerElement.querySelectorAll("a")];
    const invalidLinks = links
      .filter(
        (link) =>
          !link.hasAttribute("href") ||
          getComputedStyle(link).visibility !== "visible" ||
          link.getBoundingClientRect().height < 40,
      )
      .map((link) => ({
        text: link.innerText,
        href: link.getAttribute("href"),
        visibility: getComputedStyle(link).visibility,
        height: link.getBoundingClientRect().height,
      }));
    const footerRect = footerElement.getBoundingClientRect();
    const copyrightRect = copyright.getBoundingClientRect();
    const signatureRect = signature.getBoundingClientRect();
    return {
      footerCount: document.querySelectorAll("footer").length,
      footerVisible: footerRect.top < window.innerHeight && footerRect.bottom > 0,
      footerBottom: footerRect.bottom,
      copyrightVisible:
        copyrightRect.top >= 0 && copyrightRect.bottom <= window.innerHeight,
      signatureVisible:
        signatureRect.top >= 0 && signatureRect.bottom <= window.innerHeight,
      linkCount: links.length,
      linksValid: invalidLinks.length === 0,
      invalidLinks,
      footerFits:
        footerElement.scrollWidth <= footerElement.clientWidth + 1 &&
        footerRect.width <= window.innerWidth + 1,
      clouds: getComputedStyle(footerElement).backgroundImage.includes(
        "footer-clouds.png",
      ),
      cloudFraming: getComputedStyle(footerElement).backgroundSize,
    };
  });
  assert.equal(finalState.footerCount, 1);
  assert.equal(finalState.footerVisible, true);
  assert(finalState.footerBottom <= height + 1);
  assert.equal(finalState.copyrightVisible, true);
  assert.equal(finalState.signatureVisible, true);
  assert.equal(finalState.linkCount, 14);
  assert.equal(finalState.linksValid, true, JSON.stringify(finalState.invalidLinks));
  assert.equal(finalState.footerFits, true);
  assert.equal(finalState.clouds, true);
  assert.match(finalState.cloudFraming, /auto 50%/);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(
    () => !document.querySelector("#mm-navbar")?.classList.contains("is-footer-visible"),
  );
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Fermer le menu" }).getAttribute("aria-expanded"),
    "true",
  );
  await page.getByRole("button", { name: "Fermer le menu" }).click();
}

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
    for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      assert.match(await page.locator("h1").textContent(), /MAISON MIROIR/);
      assert.equal(await page.locator(".storefront-announcement").count(), 0);
      assert.equal(await page.locator(".mm-navbar-monogram, .storefront-footer-monogram").count(), 0);
      assert.equal(
        await page.locator("#mm-navbar").evaluate((nav) => getComputedStyle(nav).position),
        "fixed",
      );
      assert.equal(
        await page.locator("#mm-navbar").evaluate((nav) => getComputedStyle(nav).backgroundColor),
        "rgba(0, 0, 0, 0)",
      );
      assert.equal(await page.locator(".storefront-showcase").count(), 1);
      assert.equal(await page.locator(".storefront-showcase-kicker").count(), 0);
      assert.equal(await page.getByText("Deux films, une même identité.").count(), 0);
      assert.equal(
        await page.locator(".storefront-showcase-title").textContent(),
        "MAISON MIROIR",
      );
      assert.equal(
        await page.locator(".storefront-showcase-subtitle").textContent(),
        "Paradise Way - Just a girl training for Jannah",
      );
      assert.equal(
        await page.locator(".storefront-showcase-copy").evaluate((copy) => {
          const copyRect = copy.getBoundingClientRect();
          const frameRect = copy.closest(".storefront-showcase-frame").getBoundingClientRect();
          return (
            Math.abs(copyRect.left + copyRect.width / 2 - (frameRect.left + frameRect.width / 2)) <= 1 &&
            Math.abs(copyRect.top + copyRect.height / 2 - (frameRect.top + frameRect.height / 2)) <= 1 &&
            getComputedStyle(copy).textAlign === "center"
          );
        }),
        true,
      );
      assert.equal(await page.getByRole("button", { name: "Film précédent" }).count(), 1);
      assert.equal(await page.getByRole("button", { name: "Film suivant" }).count(), 1);
      assert.equal(await page.getByRole("button", { name: "Mettre la vidéo en pause" }).count(), 1);
      assert.deepEqual(
        await page.locator(".storefront-showcase-controls button").evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute("aria-label")),
        ),
        ["Mettre la vidéo en pause", "Film précédent", "Film suivant"],
      );
      assert.equal(
        await page.locator(".storefront-showcase-controls").evaluate((controls) => {
          const controlsRect = controls.getBoundingClientRect();
          const frameRect = controls.closest(".storefront-showcase-frame").getBoundingClientRect();
          const textRects = Array.from(
            controls.closest(".storefront-showcase-overlay")
              .querySelectorAll(".storefront-showcase-copy h1, .storefront-showcase-copy p"),
            (element) => element.getBoundingClientRect(),
          );
          const overlapsText = textRects.some((rect) =>
            controlsRect.left < rect.right &&
            controlsRect.right > rect.left &&
            controlsRect.top < rect.bottom &&
            controlsRect.bottom > rect.top,
          );
          return (
            controlsRect.left >= frameRect.left &&
            controlsRect.left < frameRect.left + frameRect.width / 3 &&
            controlsRect.right <= frameRect.right &&
            controlsRect.bottom < frameRect.bottom &&
            frameRect.bottom - controlsRect.bottom <= 60 &&
            !overlapsText
          );
        }),
        true,
        `Carousel controls should stay bottom-left without covering text at ${width}px`,
      );
      assert.equal(await page.locator(".storefront-showcase video").count(), 3);
      assert.deepEqual(
        await page.locator(".storefront-showcase source").evaluateAll((sources) =>
          sources.map((source) => source.getAttribute("src")),
        ),
        [
          "/collection/IMG_7244.mov",
          "/collection/IMG_7199.mov",
          "/collection/IMG_7197.mov",
        ],
      );
      assert.equal(
        await page.getByRole("button", { name: "Afficher le deuxième film de Modest Era" }).count(),
        1,
      );
      assert.equal(
        await page
          .locator(".storefront-showcase-frame")
          .evaluate((frame) => getComputedStyle(frame).aspectRatio),
        "16 / 9",
      );
      assert.equal(
        await page.locator(".storefront-showcase").evaluate((showcase) => {
          const collection = document.querySelector(".home-collection");
          return (
            collection !== null &&
            Boolean(
              showcase.compareDocumentPosition(collection) &
                Node.DOCUMENT_POSITION_FOLLOWING,
            )
          );
        }),
        true,
      );
      assert.equal(await page.locator(".home-order-notice").count(), 1);
      assert.equal(
        await page
          .locator(".home-order-notice")
          .evaluate((notice) => notice.closest(".home-collection") !== null),
        true,
      );
      assert.equal(await page.locator(".home-story").count(), 1);
      assert.equal(
        await page.locator("#collection-title").textContent(),
        "For Modest Girls",
      );
      assert.equal(await page.getByText("Deux tote bags, deux messages.").count(), 0);
      assert.equal(
        await page.locator("#collection-title").evaluate((heading) =>
          getComputedStyle(heading).fontFamily.includes("Great Vibes"),
        ),
        true,
      );
      assert.equal(
        await page.evaluate(() => document.fonts.check('16px "Great Vibes"')),
        true,
      );
      assert.equal(
        await page.locator("#collection-title").evaluate((heading) => {
          const headingRect = heading.getBoundingClientRect();
          const containerRect = heading.parentElement.getBoundingClientRect();
          const lineHeight = Number.parseFloat(getComputedStyle(heading).lineHeight);
          return (
            headingRect.left >= containerRect.left - 1 &&
            headingRect.right <= containerRect.right + 1 &&
            headingRect.height <= lineHeight + 2
          );
        }),
        true,
      );
      assert.equal(await page.locator(".home-editorial, .home-immersive").count(), 0);
      assert.equal(await page.locator(".home-product-card").count(), 2);
      assert.equal(
        await page.locator(".home-product-card .product-gallery-trigger").count(),
        0,
      );
      assert.equal(
        await page.locator(".home-product-card .product-gallery-static").count(),
        2,
      );
      assert.equal(await page.locator(".storefront-product-price").count(), 0);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert(
        await page
          .locator(".home-product-image img")
          .first()
          .evaluate((img) => img.complete && img.naturalWidth > 0),
      );
      assert.match(
        await page.locator(".home-product-image img").first().getAttribute("src"),
        /modest-era-feature\.jpeg/,
      );
      assert.match(
        await page.locator(".home-product-image img").nth(1).getAttribute("src"),
        /paradise-way-product/,
      );
      if (width === 1440 || width === 1920 || width === 390)
        await page.screenshot({
          path: `.qa/storefront-${width}.png`,
          fullPage: true,
          animations: "disabled",
          timeout: 45000,
        });
      if (width === 1440 || width === 1920) {
        assert(
          Number.parseFloat(
            await page
              .locator(".mm-navbar-links a")
              .first()
              .evaluate((link) => getComputedStyle(link).fontSize),
          ) >= 14,
        );
        assert(
          Number.parseFloat(
            await page
              .locator(".home-product-description")
              .first()
              .evaluate((text) => getComputedStyle(text).fontSize),
          ) >= 16,
        );
        assert(
          Number.parseFloat(
            await page
              .locator(".home-text-link")
              .first()
              .evaluate((link) => getComputedStyle(link).fontSize),
          ) >= 13,
        );
      }
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://localhost:3000/catalogue", {
      waitUntil: "networkidle",
    });
    const productLinkStyles = await page
      .locator(".storefront-product-copy")
      .evaluateAll((links) =>
        links.map((link) => ({
          color: getComputedStyle(link).color,
          decoration: getComputedStyle(link).textDecorationLine,
        })),
      );
    assert.equal(productLinkStyles.length, 2);
    for (const style of productLinkStyles) {
      assert.notEqual(style.color, "rgb(0, 0, 238)");
      assert.notEqual(style.color, "rgb(85, 26, 139)");
      assert.equal(style.decoration, "none");
    }
    await page
      .getByRole("button", { name: "Voir les photos de Modest Era" })
      .click();
    let gallery = page.getByRole("dialog", {
      name: "Galerie photo de Modest Era",
    });
    assert.equal(await gallery.count(), 1);
    assert.equal(
      await gallery.locator(".product-lightbox-thumbnails button").count(),
      6,
    );
    assert.equal(
      await gallery.getByRole("button", { name: "Réinitialiser le zoom" }).count(),
      0,
    );
    assert.match(
      await gallery.locator(".product-lightbox-stage img").getAttribute("src"),
      /modest-era-feature\.jpeg/,
    );
    await gallery.getByRole("button", { name: "Agrandir le zoom" }).click();
    assert.equal(await gallery.locator(".product-lightbox-toolbar span").textContent(), "150%");
    await page.keyboard.press("ArrowRight");
    assert.match(
      await gallery.locator(".product-lightbox-stage img").getAttribute("src"),
      /modest-era-product/,
    );
    assert.doesNotMatch(
      await gallery.locator(".product-lightbox-stage img").getAttribute("src"),
      /paradise-way/,
    );
    await gallery.getByRole("button", { name: "Ouvrir la photo 6 de Modest Era" }).click();
    assert.match(
      await gallery.locator(".product-lightbox-stage img").getAttribute("src"),
      /modest-era-material/,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);

    await page.goto("http://localhost:3000/catalogue", {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", {
      name: "Voir les photos de Paradise Way",
    }).click();
    gallery = page.getByRole("dialog", {
      name: "Galerie photo de Paradise Way",
    });
    assert.equal(
      await gallery.locator(".product-lightbox-thumbnails button").count(),
      5,
    );
    await page.keyboard.press("Escape");

    await page.goto("http://localhost:3000/category/sacs", {
      waitUntil: "networkidle",
    });
    assert.equal(await page.locator(".product-gallery-trigger").count(), 0);
    assert.equal(await page.locator(".product-lightbox").count(), 0);
    assert.match(
      await page.locator(".mm-prod-img img").first().getAttribute("src"),
      /modest-era-feature\.jpeg/,
    );
    assert.match(
      await page.locator(".mm-prod-img img").nth(1).getAttribute("src"),
      /paradise-way-product/,
    );

    await page.goto("http://localhost:3000/product/modest-era", {
      waitUntil: "networkidle",
    });
    const productGallery = page.locator(".product-detail-images");
    assert.equal(await productGallery.locator(".product-gallery-thumbnail").count(), 6);
    assert.equal(await productGallery.locator(".product-gallery-trigger").count(), 1);
    await page
      .getByRole("button", { name: "Agrandir la photo 1 de Modest Era" })
      .click();
    gallery = page.getByRole("dialog", {
      name: "Galerie photo de Modest Era",
    });
    assert.equal(
      await gallery.locator(".product-lightbox-thumbnails button").count(),
      6,
    );
    assert.match(
      await gallery.locator(".product-lightbox-stage img").getAttribute("src"),
      /modest-era-feature\.jpeg/,
    );
    await gallery
      .getByRole("button", { name: "Ouvrir la photo 3 de Modest Era" })
      .click();
    assert.doesNotMatch(
      await gallery.locator(".product-lightbox-stage img").getAttribute("src"),
      /paradise-way/,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".product-lightbox").count(), 0);
    await assertProductImageLayout(page);

    await page.goto("http://localhost:3000/product/paradise-way", {
      waitUntil: "networkidle",
    });
    assert.equal(
      await page.locator(".product-detail-images .product-gallery-thumbnail").count(),
      5,
    );
    assert.equal(await page.locator(".product-gallery-trigger").count(), 1);
    await page
      .getByRole("button", { name: "Agrandir la photo 1 de Paradise Way" })
      .click();
    gallery = page.getByRole("dialog", {
      name: "Galerie photo de Paradise Way",
    });
    assert.equal(
      await gallery.locator(".product-lightbox-thumbnails button").count(),
      5,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".product-lightbox").count(), 0);
    await assertProductImageLayout(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    for (const label of [
      "Accueil",
      "Boutique",
      "Notre histoire",
      "FAQ",
      "Contact",
    ]) {
      assert.equal(
        await page.locator(".mm-mobile-menu-links").getByRole("link", { name: label }).count(),
        1,
      );
    }
    assert.equal(await page.locator(".product-gallery-trigger").count(), 0);
    await page.goto("http://localhost:3000/catalogue", {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: "Voir les photos de Paradise Way" }).click();
    gallery = page.getByRole("dialog", {
      name: "Galerie photo de Paradise Way",
    });
    await gallery.getByRole("button", { name: "Agrandir le zoom" }).click();
    assert.equal(await gallery.locator(".product-lightbox-toolbar span").textContent(), "150%");
    assert.equal(
      await gallery.getByRole("button", { name: "Réinitialiser le zoom" }).count(),
      0,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.keyboard.press("Escape");

    await page.goto("http://localhost:3000/product/paradise-way", {
      waitUntil: "networkidle",
    });
    await assertProductImageLayout(page);
    await page
      .getByRole("button", { name: "Agrandir la photo 1 de Paradise Way" })
      .click();
    assert.equal(
      await page.getByRole("dialog", {
        name: "Galerie photo de Paradise Way",
      }).count(),
      1,
    );
    await page.keyboard.press("Escape");

    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    const activeVideo = page.locator(
      ".storefront-showcase-slide.is-active video",
    );
    assert.equal(
      await activeVideo.evaluate(
        (video) => video.muted && video.playsInline && video.autoplay,
      ),
      true,
    );
    await page.waitForFunction(
      () => {
        const video = document.querySelector(
          ".storefront-showcase-slide.is-active video",
        );
        return (
          video instanceof HTMLVideoElement &&
          !video.paused &&
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        );
      },
      { timeout: 10000 },
    );
    await activeVideo.evaluate((video) =>
      video.dispatchEvent(new Event("ended")),
    );
    await page.waitForFunction(() =>
      document
        .querySelector(".storefront-showcase-slide.is-active source")
        ?.getAttribute("src")
        ?.includes("IMG_7197.mov"),
    );
    await page.waitForFunction(() => {
      const video = document.querySelector(
        ".storefront-showcase-slide.is-active video",
      );
      return (
        video instanceof HTMLVideoElement &&
        !video.paused &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      );
    }, { timeout: 10000 });
    await page.locator(".storefront-showcase-slide.is-active video").evaluate((video) =>
      video.dispatchEvent(new Event("ended")),
    );
    await page.waitForFunction(() =>
      document
        .querySelector(".storefront-showcase-slide.is-active source")
        ?.getAttribute("src")
        ?.includes("IMG_7199.mov"),
    );
    await page
      .locator(".storefront-showcase-slide.is-active video")
      .evaluate((video) => video.dispatchEvent(new Event("ended")));
    await page.waitForFunction(() =>
      document
        .querySelector(".storefront-showcase-slide.is-active source")
        ?.getAttribute("src")
        ?.includes("IMG_7244.mov"),
    );
    await page.getByRole("button", { name: "Film suivant" }).click();
    assert.match(
      await page
        .locator(".storefront-showcase-slide.is-active source")
        .getAttribute("src"),
        /IMG_7199\.mov/,
    );
    assert.equal(
      await page.locator(".storefront-showcase-subtitle").textContent(),
      "Modest Era - Modesty is the mood",
    );
    await page.locator(".home-collection-footer a").click();
    await page.waitForURL("**/catalogue");
    assert.equal(await page.locator(".storefront-product-card").count(), 2);
    await page.getByRole("link", { name: /Modest Era/ }).first().click();
    await page.waitForURL("**/product/modest-era");
    assert(
      await page.getByRole("status").filter({ hasText: "Bientôt disponible" }).count(),
    );
    assert.equal(await page.locator(".product-coming-soon").count(), 1);
    assert(
      Number.parseFloat(
        await page.locator(".product-availability").evaluate((text) => getComputedStyle(text).fontSize),
      ) >= 14,
    );
    assert(
      Number.parseFloat(
        await page.locator(".storefront-lede").evaluate((text) => getComputedStyle(text).fontSize),
      ) >= 16,
    );
    assert(
      Number.parseFloat(
        await page.locator(".product-feature-list").evaluate((text) => getComputedStyle(text).fontSize),
      ) >= 15,
    );
    assert(
      Number.parseFloat(
        await page.locator(".storefront-cta").evaluate((text) => getComputedStyle(text).fontSize),
      ) >= 14,
    );
    assert.equal(await page.locator("form").count(), 0);
    for (const url of ["/notre-histoire", "/faq", "/contact"]) {
      const response = await page.request.get(`http://localhost:3000${url}`);
      assert.equal(response.status(), 200);
    }
    assert.deepEqual(errors, []);
    const api = page.request;
    for (const url of ["/catalogue", "/category/sacs", "/product/modest-era"])
      assert.equal((await api.get(`http://localhost:3000${url}`)).status(), 200);
    for (const url of ["/panier", "/checkout"])
      assert.equal(
        (
          await api.get(`http://localhost:3000${url}`, { maxRedirects: 0 })
        ).status(),
        307,
      );
    for (const url of ["/admin", "/admin/newsletter"])
      assert.equal(
        (
          await api.get(`http://localhost:3000${url}`, { maxRedirects: 0 })
        ).status(),
        307,
      );
    for (const url of ["/api/admin/orders", "/api/admin/newsletter"])
      assert.equal(
        (await api.get(`http://localhost:3000${url}`)).status(),
        401,
      );
    assert.equal(
      (
        await api.post("http://localhost:3000/api/newsletter", {
          data: { email: "qa@example.test", consent: true },
        })
      ).status(),
      410,
    );
    assert.equal(
      (
        await api.post("http://localhost:3000/api/order", {
          headers: { origin: "http://localhost:3000" },
          data: {},
        })
      ).status(),
      403,
    );
    assert.equal(
      (await api.post("http://localhost:3000/api/newsletter/worker")).status(),
      401,
    );
    const publicFooterRoutes = [
      "/",
      "/catalogue",
      "/category/sacs",
      "/product/modest-era",
      "/product/paradise-way",
      "/notre-histoire",
      "/faq",
      "/contact",
      "/mentions-legales",
      "/conditions-de-vente",
      "/livraison",
      "/retours",
      "/politique-de-confidentialite",
      "/politique-de-cookies",
      "/confidentialite",
      "/connexion",
      "/checkout",
      "/panier",
      "/success",
      "/newsletter/confirmer?token=invalid",
      "/newsletter/desinscription?token=invalid",
      "/newsletter/panier",
      "/newsletter/resultat",
      "/route-inconnue",
    ];
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const route of publicFooterRoutes) {
      await page.goto(`http://localhost:3000${route}`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator("footer.storefront-footer").waitFor();
      await assertGlobalFooter(page, 1440);
    }

    for (const { width, routes } of [
      {
        width: 768,
        routes: ["/", "/catalogue", "/mentions-legales", "/contact"],
      },
      ...[320, 375, 390, 430].map((width) => ({
        width,
        routes: [
          "/",
          "/catalogue",
          "/mentions-legales",
          "/newsletter/panier",
          "/success",
        ],
      })),
    ]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        await page.goto(`http://localhost:3000${route}`, {
          waitUntil: "domcontentloaded",
        });
        await page.locator("footer.storefront-footer").waitFor();
        await assertGlobalFooter(page, width);
        if (width <= 600 && (route === "/" || route === "/catalogue")) {
          await assertMobileFooterScroll(page, width, route);
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://localhost:3000/newsletter/panier", {
      waitUntil: "domcontentloaded",
    });
    const shortPageFooterBottom = await page
      .locator("footer.storefront-footer")
      .evaluate((footer) => footer.getBoundingClientRect().bottom);
    assert(Math.abs(shortPageFooterBottom - 1000) <= 2);

    assert.deepEqual(errors, []);
    for (const url of [
      "/confidentialite",
      "/mentions-legales",
      "/politique-de-confidentialite",
      "/politique-de-cookies",
      "/newsletter/confirmer?token=invalid",
      "/newsletter/desinscription?token=invalid",
    ])
      assert.equal(
        (await api.get(`http://localhost:3000${url}`)).status(),
        200,
      );
    console.log(
      "PASS: storefront at 320/390/768/1024/1440/1920px, global four-column cloud footer exactly once on public routes, responsive footer at desktop/tablet/mobile, footer anchored on short pages, clickable product galleries on catalogue and product pages, unchanged videos, closed checkout, admin protection, disabled signup. No real emails or payments.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
