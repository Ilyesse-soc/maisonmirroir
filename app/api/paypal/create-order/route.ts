import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createPayPalCheckoutOrder,
  checkoutOrderSchema,
} from "@/lib/commerceSecurity";
import {
  CheckoutConfigurationError,
  prepareCheckoutOrder,
} from "@/lib/checkoutQuote";
import {
  bindPayPalOrder,
  CommerceError,
  createCommerceCheckoutProof,
  releaseCommerceReservation,
  reserveCommerceCheckout,
} from "@/lib/commerceInventory";
import {
  InputError,
  inputResponse,
  mutationAllowed,
  readJson,
} from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSchema = z.object({ order: checkoutOrderSchema }).strict();

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
    const reservation = await reserveCommerceCheckout({
      order: {
        ...order,
        shippingMethodId: order.shippingMethodId || "",
      },
      shippingCents: prepared.shippingCents,
      orderSnapshot: {
        shippingMethodId: prepared.shippingMethod.id,
        shippingMethod: prepared.shippingMethod,
        relayPoint: prepared.relayPoint,
        preparationDays: prepared.preparationDays,
        cgvVersion: prepared.cgvVersion,
        fulfillmentMode: prepared.fulfillmentMode,
      },
    });
    let paypalOrderId: string;
    try {
      paypalOrderId = await createPayPalCheckoutOrder({
        reservationId: reservation.reservationId,
        totalCents: reservation.totalCents,
        subtotalCents: reservation.subtotalCents,
        discountCents: reservation.discountCents,
        shippingCents: reservation.shippingCents,
        items: reservation.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
        customer: order.customer,
      });
      await bindPayPalOrder(reservation.reservationId, paypalOrderId);
    } catch (error) {
      await releaseCommerceReservation(reservation.reservationId).catch(() => {});
      throw error;
    }
    const checkoutProof = createCommerceCheckoutProof(
      reservation.reservationId,
      paypalOrderId,
      reservation.expiresAt,
    );
    return NextResponse.json(
      {
        id: paypalOrderId,
        checkoutProof,
        subtotal: (reservation.subtotalCents / 100).toFixed(2),
        discount: (reservation.discountCents / 100).toFixed(2),
        shipping: (reservation.shippingCents / 100).toFixed(2),
        total: (reservation.totalCents / 100).toFixed(2),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    if (error instanceof CheckoutConfigurationError)
      return NextResponse.json(
        { error: error.code },
        { status: error.status },
      );
    if (error instanceof CommerceError)
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
