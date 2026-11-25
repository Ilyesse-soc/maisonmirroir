import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDenied, adminSession } from "@/lib/adminAuth";
import { database, transaction } from "@/lib/newsletterDb";
import { InputError, mutationAllowed, readJson } from "@/lib/requestSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

const promoSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.number().int().positive(),
  maxRedemptions: z.number().int().positive().nullable(),
  startsAt: z.string().datetime({ offset: true }).nullable(),
  endsAt: z.string().datetime({ offset: true }).nullable(),
  productIds: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(50),
  minimumOrderCents: z.number().int().min(0),
  active: z.boolean(),
}).strict().refine((value) =>
  (value.discountType !== "percent" || value.discountValue <= 100) &&
  (!value.startsAt || !value.endsAt || Date.parse(value.endsAt) > Date.parse(value.startsAt)),
);

async function readPromotions() {
  return database().query(
    `SELECT p.*,
      (p.max_redemptions-p.redeemed_count-p.reserved_count) AS remaining_count,
      COALESCE(r.redemptions,'[]'::jsonb) AS redemptions
     FROM mm_promotions p
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(jsonb_build_object(
         'orderId',d.order_id,'discountCents',d.discount_cents,'createdAt',d.created_at,
         'paymentStatus',f.payment_status
       ) ORDER BY d.created_at DESC) AS redemptions
       FROM mm_promotion_redemptions d
       LEFT JOIN mm_commerce_order_financials f ON f.order_id=d.order_id
       WHERE d.code=p.code
     ) r ON true
     ORDER BY p.created_at DESC`,
  );
}

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const result = await readPromotions();
    return NextResponse.json({ promotions: result.rows }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Promotions momentanément indisponibles." }, { status: 503, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  return savePromotion(request, false);
}

export async function PATCH(request: NextRequest) {
  return savePromotion(request, true);
}

async function savePromotion(request: NextRequest, update: boolean) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) {
    originDenied.headers.set("Cache-Control", "no-store");
    return originDenied;
  }
  try {
    const data = await readJson(request, promoSchema, 4096);
    const session = await adminSession();
    if (!session) return NextResponse.json({ error: "Authentification requise" }, { status: 401, headers: noStore });
    const result = await transaction(async (db) => {
      if (data.productIds.length) {
        const products = await db.query(
          "SELECT product_id FROM mm_commerce_products WHERE product_id=ANY($1::text[])",
          [data.productIds],
        );
        if (products.rowCount !== new Set(data.productIds).size) throw new Error("INVALID_PRODUCTS");
      }
      const existing = await db.query("SELECT code FROM mm_promotions WHERE code=$1 FOR UPDATE", [data.code]);
      if (!update && existing.rowCount) throw new Error("PROMOTION_EXISTS");
      if (update && !existing.rowCount) throw new Error("PROMOTION_NOT_FOUND");
      const values = [
        data.code, data.discountType, data.discountValue, data.maxRedemptions,
        data.startsAt, data.endsAt, data.productIds, data.minimumOrderCents,
        data.active, session.user.id,
      ];
      const saved = update
        ? await db.query(
          `UPDATE mm_promotions SET discount_type=$2,discount_value=$3,max_redemptions=$4,
            starts_at=$5,ends_at=$6,product_ids=$7,minimum_order_cents=$8,
            active=$9,updated_by=$10,updated_at=now()
           WHERE code=$1 AND ($4 IS NULL OR $4>=redeemed_count+reserved_count)
           RETURNING *`,
          values,
        )
        : await db.query(
          `INSERT INTO mm_promotions
            (code,discount_type,discount_value,max_redemptions,starts_at,ends_at,
             product_ids,minimum_order_cents,active,created_by,updated_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
          values,
        );
      if (!saved.rowCount) throw new Error("MAX_BELOW_USED");
      return saved.rows[0];
    });
    return NextResponse.json({ promotion: result }, { status: update ? 200 : 201, headers: noStore });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: "Requête invalide." }, { status: error.status, headers: noStore });
    const code = error instanceof Error ? error.message : "";
    const statuses: Record<string, [number, string]> = {
      INVALID_PRODUCTS: [400, "Un ou plusieurs produits sont inconnus."],
      PROMOTION_EXISTS: [409, "Ce code existe déjà."],
      PROMOTION_NOT_FOUND: [404, "Code promotionnel introuvable."],
      MAX_BELOW_USED: [409, "Le plafond ne peut pas être inférieur aux réservations et utilisations existantes."],
    };
    if (statuses[code]) return NextResponse.json({ error: statuses[code][1] }, { status: statuses[code][0], headers: noStore });
    return NextResponse.json({ error: "Enregistrement de la promotion impossible." }, { status: 503, headers: noStore });
  }
}
