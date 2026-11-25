import { NextRequest, NextResponse } from "next/server";
import { adminDenied, adminSession } from "@/lib/adminAuth";
import { database, transaction } from "@/lib/newsletterDb";
import { InputError, mutationAllowed, readJson } from "@/lib/requestSecurity";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  productId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  quantity: z.number().int().min(0).optional(),
  priceCents: z.number().int().min(0).optional(),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().uuid(),
}).strict().refine((value) => value.quantity !== undefined || value.priceCents !== undefined);

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const result = await database().query(
      `SELECT product_id,name,color,price_cents,initial_quantity,quantity_on_hand,
        reserved_quantity,sold_quantity,active,updated_at,
        quantity_on_hand-reserved_quantity AS available_quantity
       FROM mm_commerce_products ORDER BY product_id`,
    );
    return NextResponse.json({ products: result.rows }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Inventaire momentanément indisponible." }, { status: 503, headers: noStore });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) {
    originDenied.headers.set("Cache-Control", "no-store");
    return originDenied;
  }
  try {
    const body = await readJson(request, updateSchema, 2048);
    const session = await adminSession();
    if (!session) return NextResponse.json({ error: "Authentification requise" }, { status: 401, headers: noStore });
    const result = await transaction(async (db) => {
      const replay = await db.query(
        "SELECT product_id,quantity_after FROM mm_stock_movements WHERE idempotency_key=$1",
        [body.idempotencyKey],
      );
      if (replay.rowCount) {
        if (replay.rows[0].product_id !== body.productId) throw new Error("IDEMPOTENCY_CONFLICT");
        const product = await db.query("SELECT * FROM mm_commerce_products WHERE product_id=$1", [body.productId]);
        return { product: product.rows[0] || null, replayed: true };
      }
      const locked = await db.query(
        "SELECT * FROM mm_commerce_products WHERE product_id=$1 FOR UPDATE",
        [body.productId],
      );
      const current = locked.rows[0];
      if (!current) throw new Error("PRODUCT_NOT_FOUND");
      const quantity = body.quantity ?? Number(current.quantity_on_hand);
      if (quantity < Number(current.reserved_quantity)) throw new Error("QUANTITY_BELOW_RESERVED");
      const priceCents = body.priceCents ?? Number(current.price_cents);
      const changed = quantity !== Number(current.quantity_on_hand) || priceCents !== Number(current.price_cents);
      if (!changed) return { product: current, replayed: false };
      const updated = await db.query(
        `UPDATE mm_commerce_products SET quantity_on_hand=$2,price_cents=$3,updated_at=now()
         WHERE product_id=$1 RETURNING *`,
        [body.productId, quantity, priceCents],
      );
      await db.query(
        `INSERT INTO mm_stock_movements
          (idempotency_key,product_id,movement_type,quantity_delta,quantity_before,quantity_after,reason,admin_user_id)
         VALUES($1,$2,'correction',$3,$4,$5,$6,$7)`,
        [body.idempotencyKey, body.productId, quantity - Number(current.quantity_on_hand),
          Number(current.quantity_on_hand), quantity, body.reason, session.user.id],
      );
      return { product: updated.rows[0], replayed: false };
    });
    if (!result.product) return NextResponse.json({ error: "Produit introuvable." }, { status: 404, headers: noStore });
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: "Requête invalide." }, { status: error.status, headers: noStore });
    const code = error instanceof Error ? error.message : "";
    if (code === "PRODUCT_NOT_FOUND") return NextResponse.json({ error: "Produit introuvable." }, { status: 404, headers: noStore });
    if (code === "IDEMPOTENCY_CONFLICT") return NextResponse.json({ error: "Cette clé d’idempotence est déjà utilisée pour un autre produit." }, { status: 409, headers: noStore });
    if (code === "QUANTITY_BELOW_RESERVED") return NextResponse.json({ error: "La quantité ne peut pas être inférieure au stock réservé." }, { status: 409, headers: noStore });
    return NextResponse.json({ error: "Modification d’inventaire impossible." }, { status: 503, headers: noStore });
  }
}
