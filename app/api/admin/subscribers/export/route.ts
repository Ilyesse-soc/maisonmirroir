import { NextRequest, NextResponse } from "next/server";
import { adminDenied } from "@/lib/adminAuth";
import { database } from "@/lib/newsletterDb";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const status = request.nextUrl.searchParams.get("status") || "all";
  const search = (request.nextUrl.searchParams.get("search") || "").trim().slice(0, 254);
  const allowed = ["all", "active", "pending", "unsubscribed", "suppressed"];
  if (!allowed.includes(status))
    return NextResponse.json({ error: "Filtre invalide." }, { status: 400 });
  try {
    const values: string[] = [];
    const filters: string[] = [];
    if (status !== "all") {
      values.push(status);
      filters.push(`status=$${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      filters.push(`email ILIKE $${values.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await database().query(
      `SELECT email,status,created_at,confirmed_at,unsubscribed_at,consent_at,consent_version
       FROM mm_subscribers ${where} ORDER BY created_at DESC`,
      values,
    );
    const lines = [
      ["Email", "Statut", "Inscription", "Confirmation", "Désinscription", "Consentement", "Version du consentement"].map(csv).join(","),
      ...result.rows.map((row) =>
        [row.email, row.status, row.created_at, row.confirmed_at, row.unsubscribed_at, row.consent_at, row.consent_version].map(csv).join(","),
      ),
    ];
    return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="maison-miroir-abonnees.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    securityEvent("ADMIN_SUBSCRIBER_EXPORT_FAILED");
    return NextResponse.json({ error: "Export momentanément indisponible." }, { status: 503 });
  }
}
