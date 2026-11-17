import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { readBoundedText, mutationAllowed } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";
export const runtime = "nodejs";
async function handle(request: NextRequest) {
  const action = request.nextUrl.pathname.slice("/api/auth/".length);
  if (!["sign-out", "get-session", "ok"].includes(action))
    return new NextResponse(null, { status: 404 });
  try {
    if (request.method === "POST") {
      const denied = mutationAllowed(request);
      if (denied) return denied;
      const raw = await readBoundedText(request, 4096);
      request = new NextRequest(request.url, {
        method: "POST",
        headers: request.headers,
        body: raw,
      });
    }
    const response = await getAuth().handler(request);
    response.headers.set("Cache-Control", "no-store");
    if (action === "sign-in/email")
      securityEvent(
        response.ok ? "ADMIN_LOGIN_SUCCEEDED" : "ADMIN_LOGIN_DENIED",
        response.ok ? "info" : "warn",
      );
    if (action === "sign-out" && response.ok)
      securityEvent("ADMIN_LOGOUT", "info");
    return response;
  } catch {
    securityEvent("AUTH_UNAVAILABLE");
    return NextResponse.json(
      { error: "Connexion momentanément indisponible." },
      { status: 503 },
    );
  }
}
export { handle as GET, handle as POST };
