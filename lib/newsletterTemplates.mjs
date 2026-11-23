/** @typedef {'confirmation'|'welcome'|'launch'|'unsubscribe'} EmailKind */
/** @typedef {{siteUrl:string,actionUrl?:string,unsubscribeUrl?:string,title?:string,body?:string,preheader?:string,contentHtml?:string,text?:string,brandName?:string,contactEmail?:string,instagramUrl?:string,tiktokUrl?:string,footerText?:string}} EmailOptions */
export const emailSubjects = {
  confirmation: "Confirmez votre inscription - MAISON MIROIR",
  welcome: "Bienvenue dans l'univers MAISON MIROIR",
  launch: "MAISON MIROIR ouvre enfin ses portes",
  unsubscribe: "Votre désinscription - MAISON MIROIR",
};
export const launchBody =
  "Notre première collection est désormais disponible.\n\nDécouvrez des pièces raffinées, modernes et pudiques, pensées pour vous accompagner avec élégance et intemporalité.";
/** @param {string} value */
export function emailEscape(value) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || c,
  );
}
/** @param {string} value */
function absolute(value) {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password)
    throw Error("EMAIL_HTTPS_URL_REQUIRED");
  return u.href;
}
/** @param {string} value */
function paragraphs(value) {
  return value
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p style="margin:0 0 18px">${emailEscape(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}
/** @param {string} label @param {string} url */
function button(label, url) {
  const href = emailEscape(absolute(url)),
    text = emailEscape(label);
  return `<table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:24px auto"><tr><td align="center"><!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:280px" arcsize="50%" stroke="f" fillcolor="#684633"><w:anchorlock/><center style="color:#fff9f0;font-family:Georgia,serif;font-size:18px">${text}</center></v:roundrect><![endif]--><!--[if !mso]><!--><a href="${href}" style="background:#684633;color:#fff9f0;border:1px solid #805e46;border-radius:32px;padding:15px 24px;display:inline-block;max-width:100%;box-sizing:border-box;text-decoration:none;font-family:Georgia,serif;font-size:18px;line-height:1.3">${text} <span aria-hidden="true">→</span></a><!--<![endif]--></td></tr></table>`;
}
/** @param {EmailKind} kind @param {EmailOptions} options */
export function renderNewsletterEmail(kind, options) {
  const base = absolute(options.siteUrl).replace(/\/$/, ""),
    unsub = options.unsubscribeUrl ? absolute(options.unsubscribeUrl) : "";
  if ((kind === "welcome" || kind === "launch") && !unsub)
    throw Error("MARKETING_UNSUBSCRIBE_REQUIRED");
  const welcome =
    "Nous sommes ravies de vous compter parmi les premières à rejoindre notre communauté.\n\nUne nouvelle vision de la mode arrive bientôt, pensée pour les femmes qui souhaitent exprimer leur identité avec élégance et pudeur.\n\nVous serez informée en avant-première du lancement de notre première collection.";
  const content = {
    confirmation: {
      title: "Bienvenue dans notre univers",
      body: "Merci pour votre intérêt pour MAISON MIROIR.\n\nPour finaliser votre inscription et commencer à recevoir nos actualités, veuillez confirmer votre adresse e-mail.",
      label: "Confirmer mon inscription",
    },
    welcome: {
      title: "Bienvenue dans l’univers MAISON MIROIR !",
      body: welcome,
      label: "Découvrir MAISON MIROIR",
    },
    launch: {
      title: "MAISON MIROIR ouvre enfin ses portes",
      body: launchBody,
      label: "Découvrir la collection",
    },
    unsubscribe: {
      title: "Votre désinscription a été prise en compte.",
      body: "Vous ne recevrez plus d’emails marketing de la part de MAISON MIROIR.\n\nVous pourrez vous réinscrire à tout moment sur notre site.",
      label: "Retour sur le site",
    },
  }[kind];
  const title = options.title || content.title,
    body = options.body || content.body,
    preheader = options.preheader || title,
    brandName = options.brandName || "MAISON MIROIR",
    instagram = options.instagramUrl
      ? emailEscape(absolute(options.instagramUrl))
      : "https://www.instagram.com/maison_miroir.fr/",
    tiktok = options.tiktokUrl
      ? emailEscape(absolute(options.tiktokUrl))
      : "https://www.tiktok.com/@maison.miroir.fr",
    contact = options.contactEmail
      ? `<p style="margin:10px 0 0"><a style="color:#fff6e9" href="mailto:${emailEscape(options.contactEmail)}">${emailEscape(options.contactEmail)}</a></p>`
      : "",
    footerText = options.footerText ? paragraphs(options.footerText) : "";
  const action = absolute(options.actionUrl || base);
  const legal = `${base}/mentions-legales`,
    privacy = `${base}/politique-de-confidentialite`;
  const extra =
    kind === "confirmation"
      ? '<p class="email-expiry" style="color:#402818;border-radius:28px;background:#efe0ce;padding:12px;font-size:15px">Ce lien est valide pendant 48 heures.</p><p style="font-size:15px;line-height:1.6">Si vous n’êtes pas à l’origine de cette inscription, vous pouvez ignorer cet e-mail en toute tranquillité.</p>'
      : kind === "welcome"
        ? '<p style="margin:24px 0 0;font-style:italic">Avec élégance,</p><p style="margin:4px 0 0">L’équipe MAISON MIROIR</p>'
        : "";
  const values =
    kind === "unsubscribe"
      ? ""
      : `<tr><td style="padding:0 24px 26px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-values" style="border-top:1px solid #d8b995;text-align:center;color:#63462e;font:15px Georgia,serif"><tr><td width="33%" style="padding-top:18px"><img src="${base}/email-assets/diamond.png" width="30" height="30" alt="" style="width:30px;height:30px;border:0;vertical-align:middle"><br>Élégance</td><td width="34%" style="padding-top:18px"><img src="${base}/email-assets/leaf.png" width="30" height="30" alt="" style="width:30px;height:30px;border:0;vertical-align:middle"><br>Pudeur</td><td width="33%" style="padding-top:18px"><img src="${base}/email-assets/infinity.png" width="30" height="30" alt="" style="width:30px;height:30px;border:0;vertical-align:middle"><br>Intemporalité</td></tr></table></td></tr>`;
  const footerUnsub = unsub
    ? `<p style="font-size:14px;line-height:1.6;margin:18px 0 0">Vous ne souhaitez plus recevoir nos e-mails ?<br><a style="color:#fff6e9" href="${emailEscape(unsub)}">Se désinscrire</a></p>`
    : "";
  const html = `<!doctype html><html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${emailEscape(emailSubjects[kind])}</title><style>@media(max-width:480px){.email-copy{padding:24px 18px!important}.email-title{font-size:29px!important}.email-outer{padding:12px 8px!important}}@media(prefers-color-scheme:dark){.email-page{background:#241c17!important}.email-card,.email-header{background:#35291f!important;color:#f7ebdc!important}.email-copy{color:#f7ebdc!important}.email-title{color:#f7ebdc!important}.email-footer{background:#422b20!important}.email-values{color:#f7ebdc!important}.email-expiry{background:#4e3c2b!important;color:#f7ebdc!important}}</style></head><body class="email-page" style="margin:0;padding:0;background:#f6eee5;color:#352418;font-family:Georgia,'Times New Roman',serif"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${emailEscape(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="email-outer" align="center" style="padding:24px 16px"><!--[if mso]><table role="presentation" width="600"><tr><td><![endif]--><table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#fbf2e8;border-radius:20px;border:1px solid #ead8c3;color:#352418"><tr><td class="email-header" align="center" style="padding:22px 16px;background:#fbf2e8;color:#674b2e"><img src="${base}/email-assets/monogram.png" width="70" height="50" alt="Monogramme M" style="display:block;border:0;width:70px;height:50px"><p style="font-size:28px;line-height:1.2;margin:8px 0;letter-spacing:2px">${emailEscape(brandName.toUpperCase())}</p><p style="font-size:12px;line-height:1.5;letter-spacing:2px;margin:0">MODE FÉMININE &amp; PUDIQUE</p></td></tr><tr><td><img src="${base}/email-assets/${kind}.jpg" width="600" alt="Drapés crème, feuillage et lumière douce - décor MAISON MIROIR" style="display:block;border:0;width:100%;max-width:600px;height:auto"></td></tr><tr><td class="email-copy" align="center" style="padding:28px 30px;color:#352418;font-size:18px;line-height:1.65">${kind === "launch" ? '<p style="font-size:13px;letter-spacing:2px;color:#84613e;margin:0 0 12px">LANCEMENT OFFICIEL</p>' : ""}${kind === "unsubscribe" ? '<p style="color:#9b744a;font-size:32px;margin:0 0 16px">&#9993; &#10003;</p>' : ""}<h1 class="email-title" style="font:normal 35px/1.16 Georgia,'Times New Roman',serif;color:#402818;margin:0 0 20px">${emailEscape(title)}</h1><p aria-hidden="true" style="color:#ae8250;font-size:21px;margin:0 0 20px">──── ✦ ────</p>${options.contentHtml || paragraphs(body)}${button(content.label, action)}${extra}</td></tr>${values}<tr><td class="email-footer" align="center" style="padding:24px 18px;background:#684633;color:#fff6e9;font:14px/1.8 Georgia,serif;border-radius:0 0 20px 20px"><p style="margin:0 0 12px"><a style="color:#fff6e9" href="${instagram}">Instagram</a> &nbsp; · &nbsp; <a style="color:#fff6e9" href="${tiktok}">TikTok</a></p><p style="font-size:18px;letter-spacing:3px;margin:0 0 12px">${emailEscape(brandName.toUpperCase())}</p><p style="margin:0"><a style="color:#fff6e9" href="${base}">Visiter le site</a> &nbsp; · &nbsp; <a style="color:#fff6e9" href="${privacy}">Confidentialité</a> &nbsp; · &nbsp; <a style="color:#fff6e9" href="${legal}">Mentions légales</a></p>${contact}${footerText}${footerUnsub}</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  const text = `${brandName.toUpperCase()} - MODE FÉMININE & PUDIQUE\n\n${title}\n\n${options.text || body}\n\n${content.label} : ${action}${kind === "confirmation" ? "\n\nCe lien est valide pendant 48 heures. Si vous n’êtes pas à l’origine de cette inscription, ignorez cet e-mail." : ""}${kind === "welcome" ? `\n\n${options.footerText || "Avec élégance,\nL’équipe MAISON MIROIR"}` : ""}\n\nSite : ${base}\nInstagram : ${options.instagramUrl || "https://www.instagram.com/maison_miroir.fr/"}\nTikTok : ${options.tiktokUrl || "https://www.tiktok.com/@maison.miroir.fr"}${options.contactEmail ? `\nContact : ${options.contactEmail}` : ""}\nConfidentialité : ${privacy}\nMentions légales : ${legal}${unsub ? "\nSe désinscrire : " + unsub : ""}`;
  return { subject: emailSubjects[kind], html, text };
}
