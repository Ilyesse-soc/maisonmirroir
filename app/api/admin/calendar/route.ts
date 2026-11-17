import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDenied, adminSession } from "@/lib/adminAuth";
import { adminAudit } from "@/lib/adminAudit";
import { database } from "@/lib/newsletterDb";
import { mutationAllowed, readJson, InputError, inputResponse } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventFields = {
  title: z.string().trim().min(1).max(160),
  kind: z.enum(["campaign", "launch", "content", "other"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  notes: z.string().max(2000).default(""),
  campaignId: z.string().uuid().optional(),
};
const eventSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), ...eventFields }).strict(),
  z.object({ action: z.literal("update"), id: z.string().uuid(), ...eventFields }).strict(),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }).strict(),
]);

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const [events, campaigns, scheduledCampaigns] = await Promise.all([
      database().query(
        `SELECT e.id,e.title,e.kind,e.starts_at,e.ends_at,e.notes,e.campaign_id,
          c.title AS campaign_title
         FROM mm_marketing_events e LEFT JOIN mm_campaigns c ON c.id=e.campaign_id
         ORDER BY e.starts_at ASC LIMIT 500`,
      ),
      database().query(
        "SELECT id,title,status FROM mm_campaigns ORDER BY created_at DESC LIMIT 100",
      ),
      database().query(
        `SELECT id,title,status,scheduled_at AS starts_at FROM mm_campaigns
         WHERE status='scheduled' AND scheduled_at IS NOT NULL
         ORDER BY scheduled_at ASC LIMIT 500`,
      ),
    ]);
    return NextResponse.json({
      events: events.rows,
      campaigns: campaigns.rows,
      scheduledCampaigns: scheduledCampaigns.rows,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    securityEvent("ADMIN_CALENDAR_READ_FAILED");
    return NextResponse.json({ error: "Calendrier momentanément indisponible." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) return originDenied;
  try {
    const data = await readJson(request, eventSchema, 5000);
    if (data.action === "delete") {
      await adminAudit("MARKETING_EVENT_DELETE_REQUESTED", data.id);
      const result = await database().query(
        "DELETE FROM mm_marketing_events WHERE id=$1 RETURNING id",
        [data.id],
      );
      if (!result.rowCount)
        return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
      return NextResponse.json({ deleted: true });
    }
    if (data.endsAt && Date.parse(data.endsAt) <= Date.parse(data.startsAt))
      throw new InputError();
    if (data.campaignId) {
      const campaign = await database().query(
        "SELECT 1 FROM mm_campaigns WHERE id=$1",
        [data.campaignId],
      );
      if (!campaign.rowCount)
        return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
    }
    const id = data.action === "create" ? randomUUID() : data.id;
    await adminAudit(
      data.action === "create" ? "MARKETING_EVENT_CREATE_REQUESTED" : "MARKETING_EVENT_UPDATE_REQUESTED",
      id,
    );
    const values = [
      data.title,
      data.kind,
      data.startsAt,
      data.endsAt || null,
      data.notes,
      data.campaignId || null,
    ];
    if (data.action === "create") {
      const session = await adminSession();
      if (!session) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
      await database().query(
        `INSERT INTO mm_marketing_events(id,title,kind,starts_at,ends_at,notes,campaign_id,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, ...values, session.user.id],
      );
    } else {
      const result = await database().query(
        `UPDATE mm_marketing_events SET title=$2,kind=$3,starts_at=$4,ends_at=$5,
          notes=$6,campaign_id=$7,updated_at=now() WHERE id=$1 RETURNING id`,
        [id, ...values],
      );
      if (!result.rowCount)
        return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
    }
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    securityEvent("ADMIN_CALENDAR_WRITE_FAILED");
    return NextResponse.json({ error: "Modification du calendrier impossible." }, { status: 503 });
  }
}
