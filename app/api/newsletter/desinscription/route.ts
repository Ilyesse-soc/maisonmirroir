import { NextRequest, NextResponse } from "next/server";
import { siteUrl, unsubscribe } from "@/lib/newsletter";
import { mutationAllowed, readBoundedText } from "@/lib/requestSecurity";
export async function POST(request: NextRequest) {
  try {
    if (
      request.headers.get("content-type")?.split(";")[0] !==
      "application/x-www-form-urlencoded"
    )
      return new NextResponse(null, { status: 415 });
    const data = new URLSearchParams(await readBoundedText(request, 1024));
    if (
      [...data.keys()].some((k) => !["token", "List-Unsubscribe"].includes(k))
    )
      return new NextResponse(null, { status: 400 });
    const oneClick = data.get("List-Unsubscribe") === "One-Click";
    if (!oneClick) {
      const denied = mutationAllowed(request, false);
      if (denied) return denied;
    }
    const ok = await unsubscribe(
      data.get("token") || request.nextUrl.searchParams.get("token") || "",
    );
    if (oneClick) return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
    return NextResponse.redirect(
      new URL(
        "/newsletter/resultat?status=" + (ok ? "unsubscribed" : "invalid"),
        siteUrl(),
      ),
      303,
    );
  } catch {
    return NextResponse.redirect(
      new URL("/newsletter/resultat?status=unavailable", siteUrl()),
      303,
    );
  }
}
