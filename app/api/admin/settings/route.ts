import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDenied, adminSession } from "@/lib/adminAuth";
import { adminAudit } from "@/lib/adminAudit";
import { getBrandSettings, normalizeBrandText } from "@/lib/brandSettings";
import { mutationAllowed, readJson, InputError, inputResponse } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";
import { persistSettingsPatch, SettingsConflict } from "@/lib/adminSettingsPatch";

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
  professional_phone: z.string().trim().max(30),
  legal_seller_name: z.string().trim().max(200).optional(),
  mediator_name: z.string().trim().max(200).optional(),
  mediator_address: z.string().trim().max(500).optional(),
  mediator_url: httpsUrl.optional(),
  legal_terms_confirmed: z.enum(["", "true"]).optional(),
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
        groq: Boolean(process.env.GROQ_API_KEY),
      } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    securityEvent("ADMIN_SETTINGS_READ_FAILED");
    return NextResponse.json({ error: "Paramètres momentanément indisponibles." }, { status: 503 });
  }
}

export async function PUT() {
  const denied = await adminDenied();
  if (denied) return denied;
  return NextResponse.json(
    { error: "Cette page utilise une ancienne version. La sauvegarde a ete refusee pour proteger les donnees des autres appareils. Conservez vos champs avant de recharger la page." },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) return originDenied;
  try {
    const body = await readJson(request, z.object({
      changes: z.record(z.string(), z.unknown()),
      expected: z.record(z.string(), z.unknown()),
    }).strict(), 70000);
    const session = await adminSession();
    if (!session) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const settings = await persistSettingsPatch({
      ...body,
      read: client => getBrandSettings(client),
      validate: value => {
        const parsed = settingsSchema.parse(value);
        for (const key of ["brand_name", "welcome_copy", "confirmation_copy", "launch_copy", "campaign_footer"] as const)
          parsed[key] = normalizeBrandText(parsed[key]);
        return parsed;
      },
      write: async (client, value) => {
        for (const key of Object.keys(body.changes)) {
          await client.query(`INSERT INTO mm_brand_settings(key,value,updated_by) VALUES($1,$2,$3)
            ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=now()`,
          [key, value[key], session.user.id]);
        }
      },
    });
    await adminAudit("BRAND_SETTINGS_UPDATE_CONFIRMED");
    return NextResponse.json({ settings, persisted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SettingsConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Champs invalides : " + error.issues.map(issue => issue.path.join(".")).join(", ") }, { status: 422 });
    if (error instanceof InputError) return inputResponse(error);
    securityEvent("ADMIN_SETTINGS_WRITE_FAILED");
    return NextResponse.json({ error: "Enregistrement non confirmé. Vos modifications restent dans le formulaire." }, { status: 503 });
  }
}
