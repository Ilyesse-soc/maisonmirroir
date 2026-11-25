import { NextRequest, NextResponse } from "next/server";
import { adminDenied } from "@/lib/adminAuth";
import { listAdminOrders } from "@/lib/adminOrderData";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const params = request.nextUrl.searchParams;
    const search = (params.get("search") || "").trim().slice(0, 120);
    const payment = params.get("payment") || "";
    const shipment = params.get("shipment") || "";
    const paymentOptions = ["", "pending", "paid", "failed", "cancelled", "refunded", "partially_refunded"];
    const shipmentOptions = ["", "unfulfilled", "preparing", "ready", "shipped", "delivered", "returned", "cancelled", "unknown"];
    if (!paymentOptions.includes(payment) || !shipmentOptions.includes(shipment))
      return NextResponse.json({ error: "Filtre de commande invalide." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const orders = await listAdminOrders(search, payment, shipment);
    const header = ["Commande", "Date", "Paiement", "Expédition", "Prénom", "Nom", "Email", "Téléphone", "Produits", "Sous-total", "Livraison", "Réduction", "Remboursé", "Total"];
    const rows = orders.map((order) => [
      order.orderId, order.orderDate, order.paymentStatus, order.shipmentStatus,
      order.customer.firstName, order.customer.lastName, order.customer.email,
      order.customer.phone, order.items.map((item) => `${item.name} x${item.quantity}`).join("; "),
      order.subtotal, order.shipping.price, order.discountCents / 100,
      order.refundedCents / 100, order.total,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="commandes-maison-miroir.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Export des commandes indisponible." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
