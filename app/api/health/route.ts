import { NextResponse } from "next/server";
import { database } from "@/lib/newsletterDb";
export const dynamic = "force-dynamic";
let checkedAt = 0,
  healthy = false;
export async function GET() {
  if (Date.now() - checkedAt > 10000) {
    try {
      await database().query("SELECT 1 FROM mm_subscribers LIMIT 1");
      healthy = true;
    } catch {
      healthy = false;
    }
    checkedAt = Date.now();
  }
  return NextResponse.json(
    { status: healthy ? "ok" : "unavailable" },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
