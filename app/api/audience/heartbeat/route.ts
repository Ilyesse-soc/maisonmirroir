import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  audienceFunnelStage,
  audienceRateLimit,
  cleanupAudienceData,
  isAudienceBot,
  normalizeAudiencePath,
  verifyAudienceToken,
} from "@/lib/audience";
import { database } from "@/lib/newsletterDb";
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
  token: z.string().min(1).max(4096),
  path: z.string().min(1).max(200),
  pageViewId: z.string().uuid().optional(),
  hasCartItems: z.boolean().optional(),
}).strict();

export async function POST(request: NextRequest) {
  const denied = mutationAllowed(request);
  if (denied) return denied;
  if (isAudienceBot(request.headers.get("user-agent") || ""))
    return new NextResponse(null, { status: 204 });
  try {
    const body = await readJson(request, schema, 6000);
    const claims = verifyAudienceToken(body.token);
    const path = normalizeAudiencePath(body.path);
    if (!claims || !path)
      return NextResponse.json(
        { error: "Session statistique ou page invalide." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    if (
      !(await audienceRateLimit(
        "heartbeat",
        claims.sessionId,
        180,
      ))
    )
      return NextResponse.json(
        { error: "Trop de signaux pour cette session." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );

    await cleanupAudienceData();
    const db = database();
    const funnelStage =
      path === "/checkout" || path.startsWith("/checkout/")
        ? "checkout"
        : body.hasCartItems
          ? "cart"
          : audienceFunnelStage(path);
    await db.query(
      `INSERT INTO mm_audience_sessions
         (session_id,visitor_id,current_path,funnel_stage,started_at,last_heartbeat)
       VALUES($1,$2,$3,$4,now(),now())
       ON CONFLICT(session_id) DO UPDATE SET
         current_path=EXCLUDED.current_path,
         funnel_stage=EXCLUDED.funnel_stage,
         last_heartbeat=now()
       WHERE mm_audience_sessions.visitor_id=EXCLUDED.visitor_id`,
      [claims.sessionId, claims.visitorId, path, funnelStage],
    );
    await db.query(
      `INSERT INTO mm_audience_events
         (event_id,visitor_id,session_id,event_type,path,dedupe_key)
       VALUES($1,$2,$3,'visit',$4,$5)
       ON CONFLICT(dedupe_key) DO NOTHING`,
      [
        randomUUID(),
        claims.visitorId,
        claims.sessionId,
        path,
        `visit:${claims.sessionId}`,
      ],
    );
    if (body.pageViewId) {
      await db.query(
        `INSERT INTO mm_audience_events
           (event_id,visitor_id,session_id,event_type,path,dedupe_key)
         VALUES($1,$2,$3,'page_view',$4,$5)
         ON CONFLICT(dedupe_key) DO NOTHING`,
        [
          randomUUID(),
          claims.visitorId,
          claims.sessionId,
          path,
          `page:${claims.sessionId}:${body.pageViewId}`,
        ],
      );
    }
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    securityEvent("AUDIENCE_HEARTBEAT_FAILED");
    return NextResponse.json(
      { error: "Le signal de fréquentation n’a pas pu être enregistré." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
