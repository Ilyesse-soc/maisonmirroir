import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDenied, adminSession } from "@/lib/adminAuth";
import { adminAudit } from "@/lib/adminAudit";
import { getBrandSettings } from "@/lib/brandSettings";
import { transaction } from "@/lib/newsletterDb";
import { mutationAllowed, readJson, InputError, inputResponse } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const httpsUrl = z.union([
  z.literal(""),
  z.string().url().max(2048).refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }),
]);
const settingsSchema = z.object({
  brand_name: z.string().trim().min(1).max(120),
  contact_email: z.string().trim().email().max(254),
  instagram_url: httpsUrl,
  tiktok_url: httpsUrl,
  welcome_copy: z.string().trim().min(1).max(4000),
  confirmation_copy: z.string().trim().min(1).max(2000),
  launch_copy: z.string().trim().min(1).max(4000),
  campaign_footer: z.string().trim().max(1000),
}).strict();

export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    return NextResponse.json(
      { settings: await getBrandSettings(), secretsConfigured: {
        resend: Boolean(process.env.RESEND_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        grok: Boolean(process.env.GROK_API_KEY),
      } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    securityEvent("ADMIN_SETTINGS_READ_FAILED");
    return NextResponse.json({ error: "Paramètres momentanément indisponibles." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) return originDenied;
  try {
    const settings = await readJson(request, settingsSchema, 70000);
    await adminAudit("BRAND_SETTINGS_UPDATE_REQUESTED");
    const session = await adminSession();
    if (!session) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    await transaction(async (db) => {
      for (const [key, value] of Object.entries(settings)) {
        await db.query(
          `INSERT INTO mm_brand_settings(key,value,updated_by)
           VALUES($1,$2,$3)
           ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,
             updated_by=EXCLUDED.updated_by,updated_at=now()`,
          [key, value, session.user.id],
        );
      }
    });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    securityEvent("ADMIN_SETTINGS_WRITE_FAILED");
    return NextResponse.json({ error: "Enregistrement des paramètres impossible." }, { status: 503 });
  }
}
