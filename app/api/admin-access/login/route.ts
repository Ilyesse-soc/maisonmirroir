import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import {
  readJson,
  mutationAllowed,
  InputError,
  inputResponse,
} from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";
import { claimLoginSlot } from "@/lib/loginConcurrency";
const schema = z.object({ password: z.string().min(14).max(128) }).strict();
export async function POST(request: NextRequest) {
  const release = claimLoginSlot();
  if (!release) return new NextResponse(null, { status: 429 });
  try {
    const denied = mutationAllowed(request);
    if (denied) return denied;
    try {
      const { password } = await readJson(request, schema);
      const email = (
        process.env.ADMIN_EMAIL ||
        process.env.EMAIL_ADMIN ||
        process.env.OWNER_EMAIL ||
        ""
      )
        .trim()
        .toLowerCase();
      if (!email) throw Error("ADMIN_NOT_CONFIGURED");
      const forwarded = new Headers(request.headers);
      forwarded.delete("content-length");
      const response = await getAuth().handler(
        new Request(new URL("/api/auth/sign-in/email", request.url), {
          method: "POST",
          headers: forwarded,
          body: JSON.stringify({ email, password, rememberMe: false }),
        }),
      );
      securityEvent(
        response.ok ? "ADMIN_LOGIN_SUCCEEDED" : "ADMIN_LOGIN_DENIED",
        response.ok ? "info" : "warn",
      );
      const result = NextResponse.json(
        response.ok ? { ok: true } : { error: "Connexion impossible." },
        {
          status: response.ok ? 200 : response.status,
          headers: { "Cache-Control": "no-store" },
        },
      );
      for (const cookie of response.headers.getSetCookie())
        result.headers.append("Set-Cookie", cookie);
      return result;
    } catch (error) {
      if (error instanceof InputError) return inputResponse(error);
      securityEvent("AUTH_UNAVAILABLE");
      return NextResponse.json(
        { error: "Connexion momentanément indisponible." },
        { status: 503 },
      );
    }
  } finally {
    release();
  }
}
