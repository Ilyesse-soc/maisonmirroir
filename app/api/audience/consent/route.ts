import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  audienceIpRateLimit,
  isAudienceBot,
  verifyAudienceToken,
} from "@/lib/audience";
import { transaction } from "@/lib/newsletterDb";
import {
  InputError,
  inputResponse,
  mutationAllowed,
  readJson,
} from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(1).max(4096) }).strict();

export async function POST(request: NextRequest) {
  const denied = mutationAllowed(request);
  if (denied) return denied;
  if (isAudienceBot(request.headers.get("user-agent") || ""))
    return new NextResponse(null, { status: 204 });
  try {
    const body = await readJson(request, schema, 5000);
    const claims = verifyAudienceToken(body.token, true);
    if (!claims)
      return NextResponse.json(
        { error: "Session statistique invalide." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    if (!(await audienceIpRateLimit(request, "withdraw", 30)))
      return NextResponse.json(
        { error: "Trop de demandes. Réessayez plus tard." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    await transaction(async (client) => {
      await client.query(
        "DELETE FROM mm_audience_events WHERE visitor_id=$1",
        [claims.visitorId],
      );
      await client.query(
        "DELETE FROM mm_audience_sessions WHERE visitor_id=$1",
        [claims.visitorId],
      );
    });
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    securityEvent("AUDIENCE_CONSENT_WITHDRAWAL_FAILED");
    return NextResponse.json(
      { error: "La suppression des données statistiques est temporairement indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
