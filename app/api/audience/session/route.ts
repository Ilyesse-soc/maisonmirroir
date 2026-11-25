import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  audienceIpRateLimit,
  createAudienceToken,
  isAudienceBot,
  verifyAudienceToken,
} from "@/lib/audience";
import {
  InputError,
  inputResponse,
  mutationAllowed,
  readJson,
} from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  previousToken: z.string().max(4096).optional(),
}).strict();

export async function POST(request: NextRequest) {
  const denied = mutationAllowed(request);
  if (denied) return denied;
  if (isAudienceBot(request.headers.get("user-agent") || ""))
    return new NextResponse(null, { status: 204 });
  try {
    const { previousToken } = await readJson(request, schema, 5000);
    if (!(await audienceIpRateLimit(request, "session", 120)))
      return NextResponse.json(
        { error: "Trop de demandes. Réessayez plus tard." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    if (previousToken && !verifyAudienceToken(previousToken, true))
      return NextResponse.json(
        { error: "Session statistique invalide." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.json(
      createAudienceToken(previousToken),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    securityEvent("AUDIENCE_SESSION_ISSUE_FAILED");
    return NextResponse.json(
      { error: "Les statistiques de fréquentation sont temporairement indisponibles." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
