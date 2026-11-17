import { randomUUID } from "crypto";
import { database } from "./newsletterDb";
import { siteUrl, approveCampaign } from "./newsletter";
import type { Product } from "./products";

// Call only from the future authoritative backend AFTER committing a draft -> published transition.
// Static catalog edits and imports never invoke this hook.
export async function recordProductPublication(
  product: Product,
  event: {
    id: string;
    previousStatus: "draft" | "published";
    status: "draft" | "published";
    source: "editor" | "import";
  },
) {
  if (
    event.previousStatus !== "draft" ||
    event.status !== "published" ||
    event.source !== "editor"
  )
    return null;
  const id = randomUUID(),
    base = siteUrl();
  const item = {
    id: product.id,
    name: product.name,
    price: product.price,
    description: product.description.slice(0, 350),
    image: new URL(product.images[0], base).href,
    url: `${base}/product/${encodeURIComponent(product.id)}`,
  };
  const result = await database().query(
    `INSERT INTO mm_campaigns(id,title,subject,body,products,publication_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(publication_key) DO NOTHING RETURNING id`,
    [
      id,
      `Nouveauté : ${product.name}`,
      `Une nouvelle pièce rejoint Maison Miroir`,
      product.description.slice(0, 350),
      JSON.stringify([item]),
      `product:${product.id}:${event.id}`,
    ],
  );
  if (!result.rowCount) return null;
  if (process.env.NEWSLETTER_AUTO_PUBLISH === "true") await approveCampaign(id);
  return id;
}
