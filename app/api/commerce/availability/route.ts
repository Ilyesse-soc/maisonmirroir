import { NextResponse } from "next/server";
import { getPublicCommerceAvailability } from "@/lib/commerceInventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(
      { products: await getPublicCommerceAvailability() },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: "AVAILABILITY_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
