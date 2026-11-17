import { NextRequest, NextResponse } from "next/server";
import { transaction } from "@/lib/newsletterDb";
import { readBoundedText, mutationAllowed } from "@/lib/requestSecurity";
export async function POST(request: NextRequest) {
  try {
    const data = new URLSearchParams(await readBoundedText(request, 1024));
    const token =
      data.get("token") || request.nextUrl.searchParams.get("token") || "";
    const oneClick = data.get("List-Unsubscribe") === "One-Click";
    if (!oneClick) {
      const denied = mutationAllowed(request, false);
      if (denied) return denied;
    }
    if (!/^[a-f0-9]{64}$/.test(token))
      return new NextResponse(null, { status: 400 });
    const ok = await transaction(async (db) => {
      const cart = (
        await db.query(
          "UPDATE mm_carts SET consent=false WHERE unsubscribe_token=$1 RETURNING id",
          [token],
        )
      ).rows[0];
      if (!cart) return false;
      await db.query(
        `UPDATE mm_cart_reminders SET status='cancelled' WHERE cart_id=$1 AND status IN ('pending','retry')`,
        [cart.id],
      );
      return true;
    });
    if (oneClick) return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
    return NextResponse.redirect(
      new URL(
        "/newsletter/resultat?status=" + (ok ? "unsubscribed" : "invalid"),
        request.url,
      ),
      303,
    );
  } catch {
    return NextResponse.json(
      { error: "Service indisponible." },
      { status: 503 },
    );
  }
}
