import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processQueue } from "@/lib/newsletter";
import { securityEvent } from "@/lib/observability";
export const runtime = "nodejs";
export const maxDuration = 60;
async function handle(request: NextRequest) {
  const secret =
    process.env.CRON_SECRET || process.env.NEWSLETTER_WORKER_SECRET;
  const expected = Buffer.from("Bearer " + (secret || "")),
    actual = Buffer.from(request.headers.get("authorization") || "");
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return new NextResponse(null, { status: 401 });
  try {
    return NextResponse.json({ processed: await processQueue() });
  } catch {
    securityEvent("NEWSLETTER_WORKER_FAILED");
    return NextResponse.json({ error: "Worker unavailable" }, { status: 503 });
  }
}
export { handle as GET, handle as POST };
