import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { database } from "@/lib/newsletterDb";
import {
  approveCampaign,
  campaignHtml,
  safeUrl,
  siteUrl,
  launchAnnouncementTemplate,
} from "@/lib/newsletter";
import { products } from "@/lib/products";
import { adminDenied } from "@/lib/adminAuth";
import { adminAudit } from "@/lib/adminAudit";
import { campaignSchema } from "@/lib/newsletterSchemas";
import {
  readJson,
  mutationAllowed,
  InputError,
  inputResponse,
} from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";
import { getBrandSettings } from "@/lib/brandSettings";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const denied = await adminDenied();
  if (denied) return denied;
  try {
    const campaigns = await database().query(
      `SELECT c.*, (SELECT count(*) FROM mm_jobs j WHERE j.campaign_id=c.id) AS recipients, (SELECT count(*) FROM mm_jobs j WHERE j.campaign_id=c.id AND status IN ('accepted','sent','delivered')) AS accepted, (SELECT count(*) FROM mm_jobs j WHERE j.campaign_id=c.id AND status='delivered') AS delivered, (SELECT count(*) FROM mm_jobs j WHERE j.campaign_id=c.id AND status IN ('failed','bounced','complained','review')) AS failed FROM mm_campaigns c ORDER BY created_at DESC LIMIT 100`,
    );
    const subscribers = await database().query(
      "SELECT status,count(*) FROM mm_subscribers GROUP BY status",
    );
    const brandSettings = await getBrandSettings();
    return NextResponse.json(
      {
        campaigns: campaigns.rows,
        subscribers: subscribers.rows,
        products: products.map((p) => ({ id: p.id, name: p.name })),
        launchTemplate: {
          ...launchAnnouncementTemplate(),
          body: brandSettings.launch_copy,
        },
        shopOpen: process.env.SHOP_OPEN === "true",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    securityEvent("ADMIN_CAMPAIGN_READ_FAILED");
    return NextResponse.json(
      { error: "Service momentanément indisponible." },
      { status: 503 },
    );
  }
}
export async function POST(request: NextRequest) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request);
  if (originDenied) return originDenied;
  try {
    const data = await readJson(request, campaignSchema, 70000);
    if (data.action === "approve") {
      if (data.scheduledAt && Date.parse(data.scheduledAt) < Date.now())
        throw new InputError();
      await adminAudit("CAMPAIGN_APPROVAL_REQUESTED", data.id);
      const recipients = await approveCampaign(data.id, data.scheduledAt);
      return NextResponse.json({ recipients });
    }
    if (data.action === "preview") {
      const c = (
        await database().query("SELECT * FROM mm_campaigns WHERE id=$1", [
          data.id,
        ])
      ).rows[0];
      if (!c)
        return NextResponse.json(
          { error: "Campagne introuvable." },
          { status: 404 },
        );
      const brandSettings = await getBrandSettings();
      return NextResponse.json({
        html: campaignHtml(
          {
            ...c,
            brand_name: brandSettings.brand_name,
            contact_email: brandSettings.contact_email,
            instagram_url: brandSettings.instagram_url,
            tiktok_url: brandSettings.tiktok_url,
            campaign_footer: brandSettings.campaign_footer,
          },
          siteUrl() + "/newsletter/desinscription",
        ),
      });
    }
    if (data.productIds.some((id) => !products.some((p) => p.id === id)))
      throw new InputError();
    const selected = products
      .filter((p) => data.productIds.includes(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description.slice(0, 350),
        image: new URL(p.images[0], siteUrl()).href,
        url: siteUrl() + "/product/" + encodeURIComponent(p.id),
      }));
    const id = data.action === "update" ? data.id : randomUUID();
    await adminAudit(
      data.action === "update"
        ? "CAMPAIGN_UPDATE_REQUESTED"
        : "CAMPAIGN_CREATE_REQUESTED",
      id,
    );
    const values = [
      id,
      data.title,
      data.subject,
      data.preheader,
      data.body,
      safeUrl(data.imageUrl),
      safeUrl(data.linkUrl),
      data.promoCode || "",
      data.endsAt || null,
      JSON.stringify(selected),
    ];
    if (data.action === "update") {
      const result = await database().query(
        `UPDATE mm_campaigns SET title=$2,subject=$3,preheader=$4,body=$5,image_url=$6,link_url=$7,promo_code=$8,ends_at=$9,products=$10 WHERE id=$1 AND status='draft' RETURNING id`,
        values,
      );
      if (!result.rowCount)
        return NextResponse.json(
          { error: "Brouillon introuvable ou déjà validé." },
          { status: 409 },
        );
    } else
      await database().query(
        "INSERT INTO mm_campaigns(id,title,subject,preheader,body,image_url,link_url,promo_code,ends_at,products) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        values,
      );
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof InputError) return inputResponse(error);
    if (error instanceof Error && error.message === "SHOP_CLOSED")
      return NextResponse.json(
        {
          error:
            "Les campagnes ne peuvent être envoyées qu’après l’ouverture de la boutique.",
        },
        { status: 409 },
      );
    securityEvent("ADMIN_CAMPAIGN_WRITE_FAILED");
    return NextResponse.json(
      { error: "Impossible de traiter la campagne." },
      { status: 503 },
    );
  }
}
