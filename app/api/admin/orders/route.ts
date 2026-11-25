import { NextResponse } from "next/server";
import { readOrders } from "@/lib/orderStore";
import { adminDenied } from "@/lib/adminAuth";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const orders = await readOrders();
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
    });
  } catch {
    return NextResponse.json(
      { error: "Impossible de charger les commandes" },
      { status: 500 },
    );
  }
}
