import { NextRequest, NextResponse } from "next/server";
import { adminDenied } from "@/lib/adminAuth";
import { downloadApi2ProductionLabel } from "@/lib/mondialRelayApi2";
import { readOrders } from "@/lib/orderStore";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const { orderId } = await context.params;
    const order = (await readOrders()).find((item) => item.orderId === orderId);
    const shipment = order?.shipping.mondialRelayShipment;
    if (!shipment?.labelUrl || !shipment.shipmentNumber)
      return NextResponse.json({ error: "SHIPMENT_LABEL_NOT_AVAILABLE" }, { status: 404 });
    const pdf = await downloadApi2ProductionLabel(shipment.labelUrl);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Maison-Miroir-${orderId}.pdf"`,
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
