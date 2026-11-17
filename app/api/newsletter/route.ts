import { NextRequest, NextResponse } from "next/server";
import { subscribe } from "@/lib/newsletter";
import { signupSchema } from "@/lib/newsletterSchemas";
import {
  clientIp,
  inputResponse,
  InputError,
  mutationAllowed,
  readJson,
} from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const denied = mutationAllowed(request);
  if (denied) return denied;
  try {
    const data = await readJson(request, signupSchema);
    if (data.website) return NextResponse.json({ ok: true });
    await subscribe(data.email, clientIp(request));
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    const limited = error instanceof Error && error.message === "RATE_LIMIT";
    securityEvent(
      limited ? "NEWSLETTER_RATE_LIMITED" : "NEWSLETTER_SIGNUP_FAILED",
      limited ? "warn" : "error",
    );
    return NextResponse.json(
      {
        error: limited
          ? "Trop de demandes. Veuillez réessayer plus tard."
          : "L’inscription est momentanément indisponible. Veuillez réessayer plus tard.",
      },
      { status: limited ? 429 : 503 },
    );
  }
}
