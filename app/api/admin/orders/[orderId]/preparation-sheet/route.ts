import { NextRequest, NextResponse } from "next/server";
import { adminDenied } from "@/lib/adminAuth";
import { buildCommercePreparationPdf } from "@/lib/commercePreparationPdf";
import { readOrders } from "@/lib/orderStore";
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
    if (!order)
      return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    const pdf = await buildCommercePreparationPdf(order);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Fiche-preparation-${orderId}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    securityEvent("ORDER_PREPARATION_PDF_FAILED", "warn");
    return NextResponse.json(
      { error: "PREPARATION_PDF_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
