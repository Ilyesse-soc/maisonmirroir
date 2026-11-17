import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { products } from "@/lib/products";
import { canonicalItems } from "@/lib/commerceSecurity";
import { database } from "@/lib/newsletterDb";
import { upsertCart } from "@/lib/abandonedCarts";
import {
  readJson,
  mutationAllowed,
  InputError,
  inputResponse,
  clientIp,
} from "@/lib/requestSecurity";
const schema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().max(100),
            quantity: z.number().int().min(1).max(1000),
            unitPrice: z.number().positive().max(100000),
          })
          .strict(),
      )
      .max(30),
    email: z.string().email().max(254).optional(),
    consent: z.boolean().optional(),
  })
  .strict()
  .refine((v) => !v.consent || Boolean(v.email));
export async function POST(request: NextRequest) {
  if (process.env.SHOP_OPEN !== "true")
    return new NextResponse(null, { status: 423 });
  const denied = mutationAllowed(request);
  if (denied) return denied;
  try {
    const data = await readJson(request, schema, 10000);
    if (!data.items.length && !request.cookies.get("mm_cart")?.value)
      return NextResponse.json({ ok: true });
    const key =
      "cart:" +
      createHash("sha256")
        .update((process.env.NEWSLETTER_HASH_SECRET || "") + clientIp(request))
        .digest("hex");
    const limit = (
      await database().query(
        `INSERT INTO mm_rate_limits(key,count,expires_at) VALUES($1,1,now()+interval '1 hour') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN mm_rate_limits.expires_at<now() THEN 1 ELSE mm_rate_limits.count+1 END,expires_at=CASE WHEN mm_rate_limits.expires_at<now() THEN now()+interval '1 hour' ELSE mm_rate_limits.expires_at END RETURNING count`,
        [key],
      )
    ).rows[0];
    if (limit.count > 60) return new NextResponse(null, { status: 429 });
    const items = canonicalItems(
      data.items.map((i) => ({ ...i, name: "", category: "" })),
    ).map((i) => ({
      ...i,
      image: products.find((p) => p.id === i.id)?.images[0],
    }));
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(items))
      .digest("hex");
    const token = await upsertCart(
      request.cookies.get("mm_cart")?.value,
      items,
      fingerprint,
      data.email?.trim().toLowerCase(),
      data.consent,
    );
    const response = NextResponse.json({ ok: true });
    response.cookies.set("mm_cart", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    return NextResponse.json(
      { error: "Enregistrement du panier indisponible." },
      { status: 503 },
    );
  }
}
