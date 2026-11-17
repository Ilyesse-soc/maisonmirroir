import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDenied } from "@/lib/adminAuth";
import { adminAudit } from "@/lib/adminAudit";
import { database } from "@/lib/newsletterDb";
import { queueCartReminders } from "@/lib/abandonedCarts";
import {
  readJson,
  mutationAllowed,
  InputError,
  inputResponse,
} from "@/lib/requestSecurity";
export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const carts = await database().query(
      `SELECT c.id,c.email,c.items,c.consent,c.status,c.updated_at,(SELECT status FROM mm_cart_reminders r WHERE r.cart_id=c.id ORDER BY updated_at DESC LIMIT 1) AS reminder_status FROM mm_carts c WHERE email IS NOT NULL ORDER BY updated_at DESC LIMIT 200`,
    );
    return NextResponse.json(
      { carts: carts.rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
export async function POST(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) return originDenied;
  try {
    const data = await readJson(
      request,
      z.object({ id: z.string().uuid() }).strict(),
    );
    await adminAudit("CART_REMINDER_REQUESTED", data.id);
    return NextResponse.json({ queued: await queueCartReminders(data.id) });
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    return new NextResponse(null, { status: 503 });
  }
}
