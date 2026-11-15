import { NextRequest, NextResponse } from "next/server";
import { confirm } from "@/lib/newsletter";
import { mutationAllowed, readBoundedText } from "@/lib/requestSecurity";
export async function POST(request: NextRequest) {
  const denied = mutationAllowed(request, false);
  if (denied) return denied;
  try {
    if (
      request.headers.get("content-type")?.split(";")[0] !==
      "application/x-www-form-urlencoded"
    )
      return new NextResponse(null, { status: 415 });
    const data = new URLSearchParams(await readBoundedText(request, 1024));
    if ([...data.keys()].some((k) => k !== "token"))
      return new NextResponse(null, { status: 400 });
    const ok = await confirm(data.get("token") || "");
    return NextResponse.redirect(
      new URL(
        "/newsletter/resultat?status=" + (ok ? "confirmed" : "invalid"),
        request.url,
      ),
      303,
    );
  } catch {
    return NextResponse.redirect(
      new URL("/newsletter/resultat?status=unavailable", request.url),
      303,
    );
  }
}
