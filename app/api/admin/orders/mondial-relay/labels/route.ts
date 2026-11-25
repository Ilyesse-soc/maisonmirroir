import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { adminDenied } from "@/lib/adminAuth";
import {
  readMondialRelayShipmentLabel,
  readOrders,
} from "@/lib/orderStore";
import {
  InputError,
  inputResponse,
  mutationAllowed,
  readJson,
} from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const orderIdPattern = /^MM-[0-9]{4}-[A-Z0-9]{8}$/;

export async function POST(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request, false);
  if (originDenied) return originDenied;
  try {
    const body = await readJson(
      request,
      z.object({
        orderIds: z
          .array(z.string().regex(orderIdPattern))
          .min(2)
          .max(10),
      }),
    );
    const orderIds = [...new Set(body.orderIds)];
    if (orderIds.length !== body.orderIds.length)
      return NextResponse.json({ error: "ORDER_IDS_INVALID" }, { status: 400 });
    const orders = await readOrders();
    const selected = orderIds.map((id) =>
      orders.find((order) => order.orderId === id),
    );
    if (
      selected.some(
        (order) =>
          !order?.shipping.mondialRelayShipment?.labelUrl ||
          !order.shipping.mondialRelayShipment.shipmentNumber ||
          !order.shipping.mondialRelayShipment.labelAvailable,
      )
    )
      return NextResponse.json(
        { error: "SHIPMENT_LABEL_NOT_AVAILABLE" },
        { status: 409 },
      );

    const merged = await PDFDocument.create();
    for (const order of selected) {
      const label = await readMondialRelayShipmentLabel(order!.orderId);
      if (!label)
        return NextResponse.json(
          { error: "SHIPMENT_LABEL_NOT_AVAILABLE" },
          { status: 409 },
        );
      const source = await PDFDocument.load(label);
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }
    return new NextResponse(Buffer.from(await merged.save()), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Etiquettes-Maison-Miroir.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    if (error instanceof SyntaxError) return inputResponse(new InputError());
    securityEvent("MONDIAL_RELAY_BULK_LABEL_DOWNLOAD_FAILED", "warn");
    return NextResponse.json(
      { error: "BULK_LABEL_DOWNLOAD_FAILED" },
      { status: 502 },
    );
  }
}
