import { NextRequest, NextResponse } from "next/server";
import { adminDenied } from "@/lib/adminAuth";
import {
  readMondialRelayShipmentLabel,
  readOrders,
} from "@/lib/orderStore";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const orderIdPattern = /^MM-[0-9]{4}-[A-Z0-9]{8}$/;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const { orderId } = await context.params;
    if (!orderIdPattern.test(orderId))
      return NextResponse.json({ error: "ORDER_ID_INVALID" }, { status: 400 });
    const order = (await readOrders()).find((item) => item.orderId === orderId);
    const shipment = order?.shipping.mondialRelayShipment;
    if (!shipment?.shipmentNumber || !shipment.labelAvailable)
      return NextResponse.json({ error: "SHIPMENT_LABEL_NOT_AVAILABLE" }, { status: 404 });
    const pdf = await readMondialRelayShipmentLabel(orderId);
    if (!pdf)
      return NextResponse.json({ error: "SHIPMENT_LABEL_NOT_AVAILABLE" }, { status: 404 });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${_request.nextUrl.searchParams.get("print") === "1" ? "inline" : "attachment"}; filename="Maison-Miroir-${orderId}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    securityEvent("MONDIAL_RELAY_LABEL_DOWNLOAD_FAILED", "warn");
    return NextResponse.json(
      { error: "SHIPMENT_LABEL_DOWNLOAD_FAILED" },
      { status: 502 },
    );
  }
}
