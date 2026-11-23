import { NextRequest, NextResponse } from "next/server";
import {
  mutationAllowed,
} from "@/lib/requestSecurity";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const denied = mutationAllowed(request);
  if (denied) return denied;
  return NextResponse.json(
    { error: "Les inscriptions à la liste privée sont temporairement fermées." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
