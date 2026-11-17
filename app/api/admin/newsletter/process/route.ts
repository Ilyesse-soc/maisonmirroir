import { NextRequest } from "next/server";
import { mutationAllowed } from "@/lib/requestSecurity";
import { adminAudit } from "@/lib/adminAudit";
import { NextResponse } from "next/server";
import { processQueue } from "@/lib/newsletter";
import { adminDenied } from "@/lib/adminAuth";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) return originDenied;
  try {
    await adminAudit("WORKER_MANUAL_RUN");
    return NextResponse.json({ processed: await processQueue() });
  } catch {
    return NextResponse.json(
      { error: "Vérifiez la base de données et la configuration Resend." },
      { status: 503 },
    );
  }
}
