import { listAdminOrders } from "@/lib/adminOrderData";
import { presentAdminOrders } from "@/lib/adminOrderPresentation";
import { adminDenied } from "@/lib/adminAuth";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const search = (request.nextUrl.searchParams.get("search") || "").trim().slice(0, 120);
    const payment = request.nextUrl.searchParams.get("payment") || "";
    const shipment = request.nextUrl.searchParams.get("shipment") || "";
    const paymentOptions = ["", "pending", "paid", "failed", "cancelled", "refunded", "partially_refunded"];
    const shipmentOptions = ["", "unfulfilled", "preparing", "ready", "shipped", "delivered", "cancelled", "unknown"];
    if (!paymentOptions.includes(payment) || !shipmentOptions.includes(shipment))
      return NextResponse.json({ error: "Filtre de commande invalide." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const orders = await presentAdminOrders(await listAdminOrders(search, payment, shipment));
    return NextResponse.json({
      orders: orders.map((order) => {
        const shipment = order.shipping.mondialRelayShipment;
        if (!shipment) return order;
        const { labelUrl, ...safeShipment } = shipment;
        return {
          ...order,
          shipping: {
            ...order.shipping,
            mondialRelayShipment: {
              ...safeShipment,
              labelAvailable: Boolean(labelUrl),
            },
          },
        };
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Impossible de charger les commandes" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
