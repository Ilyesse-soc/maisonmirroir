import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { searchTestRelayPoints } from "@/lib/mondialRelayApi1";
import { MondialRelayApi1ResponseError } from "@/lib/mondialRelayApi1Response";
import { database } from "@/lib/newsletterDb";
import { getMondialRelaySettings, getMondialRelayTestCredentialStatus } from "@/lib/mondialRelaySettings";
import { createSimulatedRelayPoint } from "@/lib/mondialRelayTypes";
import { clientIp } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const postalCode = (request.nextUrl.searchParams.get("postalCode") || "").trim();
  const city = (request.nextUrl.searchParams.get("city") || "").trim();
  const quantity = Number(request.nextUrl.searchParams.get("quantity") || "1");
  if (
    !/^[0-9]{5}$/.test(postalCode) ||
    city.length < 2 ||
    city.length > 80 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 30
  )
    return NextResponse.json(
      { error: "Indiquez un code postal français et une ville valides." },
      { status: 400 },
    );

  try {
    const key = createHash("sha256")
      .update(`${process.env.NEWSLETTER_HASH_SECRET || ""}${clientIp(request)}`)
      .digest("hex");
    const limit = (
      await database().query(
        `INSERT INTO mm_rate_limits(key,count,expires_at)
         VALUES($1,1,now()+interval '10 minutes')
         ON CONFLICT(key) DO UPDATE SET
           count=CASE WHEN mm_rate_limits.expires_at<now() THEN 1 ELSE mm_rate_limits.count+1 END,
           expires_at=CASE WHEN mm_rate_limits.expires_at<now() THEN now()+interval '10 minutes' ELSE mm_rate_limits.expires_at END
         RETURNING count`,
        [`mondial-relay-search:${key}`],
      )
    ).rows[0];
    if (Number(limit.count) > 20)
      return NextResponse.json(
        { error: "Trop de recherches. Réessayez dans quelques minutes." },
        { status: 429 },
      );

    const settings = await getMondialRelaySettings();
    const credentials = getMondialRelayTestCredentialStatus();
    if (credentials.api1SandboxEnabled && !credentials.api1)
      return NextResponse.json(
        { error: "Les identifiants API1 de test ne sont pas configurés." },
        { status: 503 },
      );
    if (credentials.api1SandboxEnabled) {
      if (!settings.testParcel.weightGrams)
        return NextResponse.json(
          { error: "Le poids du colis de test doit être configuré." },
          { status: 409 },
        );
      const points = await searchTestRelayPoints({
        shop: process.env.MONDIAL_RELAY_API1_TEST_SHOP || "",
        privateKey: process.env.MONDIAL_RELAY_API1_TEST_PRIVATE_KEY || "",
        postalCode,
        city,
        weightGrams: settings.testParcel.weightGrams,
        serviceCode: settings.serviceCode,
      });
      return NextResponse.json(
        { source: "sandbox", points },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const point = createSimulatedRelayPoint(
      postalCode,
      city,
      settings.serviceCode,
    );
    return NextResponse.json(
      {
        source: "simulation",
        message: "Résultat fictif de simulation, non sélectionnable pour une commande réelle.",
        points: [point],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    securityEvent("MONDIAL_RELAY_SEARCH_FAILED", "warn");
    if (
      error instanceof MondialRelayApi1ResponseError &&
      error.code.startsWith("STAT_")
    )
      return NextResponse.json(
        {
          error: `Mondial Relay a rejeté la recherche (code ${error.code.slice(5)}). Vérifiez la clé API1 de test et les paramètres de recherche.`,
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.json(
      { error: "Recherche des Points Relais indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
