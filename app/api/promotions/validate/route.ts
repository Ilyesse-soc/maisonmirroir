import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validatePromotion, CommerceError } from "@/lib/commerceInventory";
import {
  InputError,
  inputResponse,
  mutationAllowed,
  readJson,
} from "@/lib/requestSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    code: z.string().trim().min(1).max(80),
    items: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(100),
            quantity: z.number().int().min(1).max(44),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();

export async function POST(request: NextRequest) {
  const denied = mutationAllowed(request);
  if (denied) return denied;
  try {
    const { code, items } = await readJson(request, requestSchema, 10000);
    const quote = await validatePromotion(
      code,
      items.map(
        (item) =>
          ({
            ...item,
            name: "",
            category: "",
            unitPrice: 1,
          }) as import("@/lib/orderTypes").ProductInfo,
      ),
    );
    return NextResponse.json(
      {
        valid: true,
        code: quote.code,
        subtotalCents: quote.subtotalCents,
        discountCents: quote.discountCents,
        totalCents: quote.totalCents,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    if (error instanceof CommerceError)
      return NextResponse.json(
        {
          valid: false,
          error: error.code,
          message:
            error.code === "FIRSTPRINCESS1_EXHAUSTED"
              ? "Cette offre a atteint sa limite d’utilisation."
              : "Ce code promotionnel est invalide.",
        },
        {
          status: error.status,
          headers: { "Cache-Control": "no-store" },
        },
      );
    return NextResponse.json(
      { error: "PROMOTION_VALIDATION_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
