import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDenied } from "@/lib/adminAuth";
import { adminAudit } from "@/lib/adminAudit";
import { database, transaction } from "@/lib/newsletterDb";
import { mutationAllowed, readJson, InputError, inputResponse } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eraseSchema = z.object({
  action: z.literal("erase"),
  id: z.string().uuid(),
  confirmation: z.literal(true),
}).strict();

export async function GET(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const params = request.nextUrl.searchParams;
  const historyId = params.get("history");
  if (historyId) {
    if (!z.string().uuid().safeParse(historyId).success)
      return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    try {
      const history = await database().query(
        `SELECT event,consent_version,created_at FROM mm_consent_events
         WHERE subscriber_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [historyId],
      );
      return NextResponse.json({ history: history.rows }, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      securityEvent("ADMIN_SUBSCRIBER_HISTORY_FAILED");
      return NextResponse.json({ error: "Historique momentanément indisponible." }, { status: 503 });
    }
  }
  const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
  const limitValue = Number(params.get("limit")) || 25;
  const limit = [10, 25, 50, 100].includes(limitValue) ? limitValue : 25;
  const status = params.get("status") || "all";
  const allowedStatuses = ["all", "active", "pending", "unsubscribed", "suppressed"];
  const search = (params.get("search") || "").trim().slice(0, 254);
  const sort = params.get("sort") || "created_at";
  const direction = params.get("direction") === "asc" ? "ASC" : "DESC";
  const sortColumns: Record<string, string> = {
    created_at: "s.created_at",
    email: "s.email",
    status: "s.status",
    confirmed_at: "s.confirmed_at",
  };
  if (!allowedStatuses.includes(status))
    return NextResponse.json({ error: "Filtre invalide." }, { status: 400 });
  if (!sortColumns[sort])
    return NextResponse.json({ error: "Tri invalide." }, { status: 400 });
  try {
    const where: string[] = [];
    const values: string[] = [];
    if (status !== "all") {
      values.push(status);
      where.push(`status=$${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      where.push(`email ILIKE $${values.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const db = database();
    const count = await db.query(
      `SELECT count(*)::int AS total FROM mm_subscribers ${clause}`,
      values,
    );
    const rows = await db.query(
      `SELECT s.id,s.email,s.status,s.created_at,s.confirmed_at,s.unsubscribed_at,
        s.consent_at,s.consent_version,s.last_confirmation_at,
        (SELECT j.error_code FROM mm_jobs j WHERE j.subscriber_id=s.id
          AND j.error_code IS NOT NULL ORDER BY j.updated_at DESC LIMIT 1) AS last_delivery_error
       FROM mm_subscribers s ${clause}
       ORDER BY ${sortColumns[sort]} ${direction} NULLS LAST,s.id
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit],
    );
    return NextResponse.json(
      { subscribers: rows.rows, total: count.rows[0].total, page, limit },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    securityEvent("ADMIN_SUBSCRIBER_READ_FAILED");
    return NextResponse.json(
      { error: "Abonnées momentanément indisponibles." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) return originDenied;
  try {
    const data = await readJson(request, eraseSchema, 1000);
    await adminAudit("SUBSCRIBER_ERASURE_REQUESTED");
    const erased = await transaction(async (db) => {
      const subscriber = (
        await db.query(
          "SELECT id FROM mm_subscribers WHERE id=$1 FOR UPDATE",
          [data.id],
        )
      ).rows[0];
      if (!subscriber) return false;
      const activeSend = await db.query(
        "SELECT 1 FROM mm_jobs WHERE subscriber_id=$1 AND status='processing' LIMIT 1",
        [data.id],
      );
      if (activeSend.rowCount)
        throw new Error("SUBSCRIBER_SEND_IN_PROGRESS");
      await db.query(
        `DELETE FROM mm_webhook_receipts WHERE provider_id IN
         (SELECT provider_id FROM mm_jobs WHERE subscriber_id=$1 AND provider_id IS NOT NULL)`,
        [data.id],
      );
      await db.query(
        "UPDATE mm_jobs SET status='cancelled',payload='{}' WHERE subscriber_id=$1 AND status IN ('pending','retry')",
        [data.id],
      );
      await db.query("DELETE FROM mm_subscribers WHERE id=$1", [data.id]);
      return true;
    });
    if (!erased)
      return NextResponse.json({ error: "Abonnée introuvable." }, { status: 404 });
    return NextResponse.json({ erased: true });
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    if (error instanceof Error && error.message === "SUBSCRIBER_SEND_IN_PROGRESS")
      return NextResponse.json(
        { error: "Un envoi est en cours pour cette abonnée. Réessayez après son traitement." },
        { status: 409 },
      );
    securityEvent("ADMIN_SUBSCRIBER_ERASURE_FAILED");
    return NextResponse.json(
      { error: "Suppression impossible pour le moment." },
      { status: 503 },
    );
  }
}
