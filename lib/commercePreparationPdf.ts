import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { database } from "@/lib/newsletterDb";
import { formatEuro } from "@/lib/shipping";
import type { OrderRecord } from "@/lib/orderTypes";

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 44;
const dark = rgb(0.16, 0.13, 0.1);
const mid = rgb(0.43, 0.37, 0.3);
const gold = rgb(0.65, 0.49, 0.19);
const rule = rgb(0.87, 0.83, 0.76);

function safeText(value: string) {
  return value.replace(/[\u00a0\u202f]/g, " ");
}

function wrapText(value: string, font: PDFFont, size: number, width: number) {
  const words = safeText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildCommercePreparationPdf(order: OrderRecord) {
  const financeResult = await database().query(
    `SELECT payment_status,paypal_capture_id,discount_cents,total_cents,promotion_code
       FROM mm_commerce_order_financials WHERE order_id=$1`,
    [order.orderId],
  );
  const finance = financeResult.rows[0];
  if (!finance || finance.payment_status !== "paid")
    throw new Error("PAID_ORDER_REQUIRED");
  const colorsResult = await database().query(
    "SELECT product_id,color FROM mm_commerce_products WHERE product_id=ANY($1::text[])",
    [order.items.map((item) => item.id)],
  );
  const colors = new Map(
    colorsResult.rows.map((row) => [String(row.product_id), String(row.color)]),
  );

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const logoPath = path.join(
    process.cwd(),
    "public",
    "email-assets",
    "monogram.png",
  );
  const logo = await pdf.embedPng(await readFile(logoPath));
  let page: PDFPage = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 128;

  const drawHeader = () => {
    page.drawImage(logo, {
      x: margin,
      y: pageHeight - 92,
      width: 42,
      height: 42,
    });
    page.drawText("MAISON MIROIR", {
      x: margin + 54,
      y: pageHeight - 64,
      size: 20,
      font: serif,
      color: dark,
    });
    page.drawText("FICHE DE PRÉPARATION", {
      x: margin + 54,
      y: pageHeight - 82,
      size: 8,
      font: bold,
      color: gold,
    });
    page.drawLine({
      start: { x: margin, y: pageHeight - 106 },
      end: { x: pageWidth - margin, y: pageHeight - 106 },
      thickness: 0.8,
      color: rule,
    });
    y = pageHeight - 128;
  };
  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    drawHeader();
  };
  const ensureRoom = (height: number) => {
    if (y - height < 58) addPage();
  };
  const section = (title: string) => {
    ensureRoom(34);
    page.drawText(title.toUpperCase(), {
      x: margin,
      y,
      size: 9,
      font: bold,
      color: gold,
    });
    y -= 18;
  };
  const pair = (label: string, value: string) => {
    const valueLines = wrapText(value || "-", regular, 9.5, pageWidth - margin * 2 - 150);
    ensureRoom(Math.max(19, valueLines.length * 12 + 5));
    page.drawText(label, {
      x: margin,
      y,
      size: 8.5,
      font: bold,
      color: mid,
    });
    valueLines.forEach((line, index) => {
      page.drawText(line, {
        x: margin + 150,
        y: y - index * 12,
        size: 9.5,
        font: regular,
        color: dark,
      });
    });
    y -= Math.max(19, valueLines.length * 12 + 5);
  };

  drawHeader();
  section("Commande");
  pair("Numéro", order.orderId);
  pair(
    "Date et heure",
    new Date(order.orderDate).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
    }),
  );
  pair("Statut du paiement", String(finance.payment_status));
  pair("Référence PayPal", String(finance.paypal_capture_id || order.paypalOrderId || "-"));

  section("Acheteuse");
  pair("Nom et prénom", `${order.customer.firstName} ${order.customer.lastName}`);
  pair("Adresse e-mail", order.customer.email);
  pair("Téléphone", order.customer.phone || "-");

  section("Livraison");
  pair("Mode", order.shipping.label);
  pair(
    "Adresse",
    [
      order.customer.street,
      `${order.customer.zip} ${order.customer.city}`,
      order.customer.country || "France",
    ].join(", "),
  );
  if (order.shipping.relayPoint)
    pair(
      "Point Relais",
      [
        order.shipping.relayPoint.label,
        ...order.shipping.relayPoint.address,
        `${order.shipping.relayPoint.postalCode} ${order.shipping.relayPoint.city}`,
      ].join(", "),
    );

  section("Articles commandés");
  const columns = [margin, 260, 355, 410, pageWidth - margin];
  const drawTableHeader = () => {
    ensureRoom(28);
    page.drawLine({
      start: { x: margin, y: y + 6 },
      end: { x: pageWidth - margin, y: y + 6 },
      thickness: 0.6,
      color: rule,
    });
    ["Article", "Couleur", "Qté", "Prix unitaire", "Total"].forEach(
      (label, index) => {
        page.drawText(label, {
          x: columns[index] + 2,
          y: y - 7,
          size: 7.5,
          font: bold,
          color: mid,
        });
      },
    );
    y -= 25;
  };
  drawTableHeader();
  for (const item of order.items) {
    const nameLines = wrapText(item.name, regular, 8.5, columns[1] - columns[0] - 8);
    const color = colors.get(item.id) || "-";
    const rowHeight = Math.max(18, nameLines.length * 11);
    const previousPageCount = pdf.getPageCount();
    ensureRoom(rowHeight + 4);
    if (pdf.getPageCount() > previousPageCount) drawTableHeader();
    nameLines.forEach((line, index) =>
      page.drawText(line, {
        x: columns[0] + 2,
        y: y - index * 11,
        size: 8.5,
        font: regular,
        color: dark,
      }),
    );
    [
      color,
      String(item.quantity),
      safeText(formatEuro(item.unitPrice)),
      safeText(formatEuro(item.unitPrice * item.quantity)),
    ].forEach((value, index) =>
      page.drawText(value, {
        x: columns[index + 1] + 2,
        y,
        size: 8,
        font: regular,
        color: dark,
      }),
    );
    y -= rowHeight + 5;
    page.drawLine({
      start: { x: margin, y: y + 2 },
      end: { x: pageWidth - margin, y: y + 2 },
      thickness: 0.35,
      color: rule,
    });
  }

  section("Totaux et suivi");
  pair("Code promotionnel", String(finance.promotion_code || "Aucun"));
  pair("Réduction appliquée", safeText(formatEuro(Number(finance.discount_cents || 0) / 100)));
  pair("Frais de livraison", safeText(formatEuro(order.shipping.price)));
  pair("Total payé", safeText(formatEuro(Number(finance.total_cents) / 100)));
  pair("Numéro de suivi", order.trackingNumber || "En attente");
  pair(
    "Date limite de préparation",
    order.preparationDeadline
      ? new Date(`${order.preparationDeadline}T12:00:00`).toLocaleDateString("fr-FR")
      : "À planifier",
  );
  ensureRoom(28);
  page.drawLine({
    start: { x: margin, y: 48 },
    end: { x: pageWidth - margin, y: 48 },
    thickness: 0.6,
    color: rule,
  });
  page.drawText("Document interne. Ne pas apposer sur le colis.", {
    x: margin,
    y: 34,
    size: 8,
    font: regular,
    color: mid,
  });

  return Buffer.from(await pdf.save());
}
