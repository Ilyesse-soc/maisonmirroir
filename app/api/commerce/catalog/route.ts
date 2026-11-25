import { NextResponse } from "next/server";
import { getPublicCommerceCatalog } from "@/lib/commerceInventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(
      { products: await getPublicCommerceCatalog() },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: "CATALOG_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
