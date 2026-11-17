import { NextResponse } from "next/server";
import { readOrders } from "@/lib/orderStore";
import { adminDenied } from "@/lib/adminAuth";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const orders = await readOrders();
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json(
      { error: "Impossible de charger les commandes" },
      { status: 500 },
    );
  }
}
