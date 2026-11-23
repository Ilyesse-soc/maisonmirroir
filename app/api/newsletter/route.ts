import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { subscribe } from "@/lib/newsletter";
import {
  clientIp,
  InputError,
  inputResponse,
  mutationAllowed,
  readJson,
} from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  consent: z.literal(true),
  website: z.string().trim().max(256).default(""),
}).strict();

export async function POST(request: NextRequest) {
  const denied = mutationAllowed(request);
  if (denied) return denied;

  let data: z.infer<typeof requestSchema>;
  try {
    data = await readJson(request, requestSchema, 4096);
  } catch (error) {
    return inputResponse(error);
  }

  if (data.website) {
    return NextResponse.json(
      { ok: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await subscribe(data.email, clientIp(request));
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      securityEvent("NEWSLETTER_SUBSCRIPTION_RATE_LIMITED", "warn");
      return NextResponse.json(
        { error: "Trop de tentatives. Veuillez réessayer plus tard." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof Error && error.message === "Newsletter unavailable") {
      securityEvent("NEWSLETTER_SUBSCRIPTION_UNAVAILABLE", "warn");
      return NextResponse.json(
        { error: "L’inscription est momentanément indisponible." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    securityEvent("NEWSLETTER_SUBSCRIPTION_FAILED");
    return NextResponse.json(
      { error: "L’inscription est momentanément indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
