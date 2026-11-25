import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createPayPalCheckoutOrder,
  orderPayloadSchema,
} from "@/lib/commerceSecurity";
import {
  CheckoutConfigurationError,
  prepareCheckoutOrder,
} from "@/lib/checkoutQuote";
import {
  assertCheckoutQuoteProofConfigured,
  createCheckoutQuoteProof,
} from "@/lib/checkoutQuoteProof";
import {
  InputError,
  inputResponse,
  mutationAllowed,
  readJson,
} from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSchema = z.object({ order: orderPayloadSchema }).strict();

export async function POST(request: NextRequest) {
  const denied = mutationAllowed(request);
  if (denied) return denied;
  if (process.env.SHOP_OPEN !== "true")
    return NextResponse.json({ error: "SHOP_CLOSED" }, { status: 403 });
  if (process.env.REAL_PAYMENTS_ENABLED !== "true")
    return NextResponse.json({ error: "PAYMENTS_DISABLED" }, { status: 403 });

  try {
    const { order } = await readJson(request, checkoutSchema, 30000);
    const prepared = await prepareCheckoutOrder({
      ...order,
      shippingMethodId: order.shippingMethodId || "",
    });
    assertCheckoutQuoteProofConfigured();
    const paypalOrderId = await createPayPalCheckoutOrder({
      totalCents: prepared.totalCents,
      subtotalCents: prepared.subtotalCents,
      shippingCents: prepared.shippingCents,
      items: prepared.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPriceCents: Math.round(item.unitPrice * 100),
      })),
      customer: order.customer,
    });
    const checkoutProof = createCheckoutQuoteProof(
      paypalOrderId,
      order,
      prepared,
    );
    return NextResponse.json(
      { id: paypalOrderId, checkoutProof },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    if (error instanceof CheckoutConfigurationError)
      return NextResponse.json(
        { error: error.code },
        { status: error.status },
      );
    securityEvent("PAYPAL_ORDER_CREATION_FAILED");
    return NextResponse.json(
      { error: "PAYMENT_ORDER_CREATION_FAILED" },
      { status: 503 },
    );
  }
}
