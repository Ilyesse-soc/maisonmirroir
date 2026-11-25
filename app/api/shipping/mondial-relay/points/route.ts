import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { searchMondialRelayPoints } from "@/lib/mondialRelayApi1";
import { MondialRelayApi1ResponseError } from "@/lib/mondialRelayApi1Response";
import { database } from "@/lib/newsletterDb";
import {
  getMondialRelayProductionReadiness,
  getMondialRelaySettings,
} from "@/lib/mondialRelaySettings";
import {
  getMondialRelayParcelProfile,
  getMondialRelayQuote,
  isSupportedMondialRelayService,
} from "@/lib/mondialRelayTypes";
import { clientIp } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";
import { signMondialRelayPoint } from "@/lib/mondialRelayPointProof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawPostalCode = (
    request.nextUrl.searchParams.get("postalCode") || ""
  ).trim();
  const rawCity = (request.nextUrl.searchParams.get("city") || "").trim();
  const address = (request.nextUrl.searchParams.get("address") || "").trim();
  const addressPostalCode = address.match(/\b([0-9]{5})\b/);
  const addressCity =
    addressPostalCode?.index === undefined
      ? ""
      : address
          .slice(addressPostalCode.index + addressPostalCode[1].length)
          .split(",")[0]
          .trim();
  const addressLooksLikeStreet =
    /^\s*\d/.test(address) ||
    /\b(rue|avenue|av\.|boulevard|bd|chemin|impasse|place|route|allée)\b/i.test(
      address,
    );
  const postalCode =
    /^[0-9]{5}$/.test(rawPostalCode)
      ? rawPostalCode
      : addressPostalCode?.[1] || "";
  const cityCandidate =
    rawCity ||
    addressCity ||
    (!rawPostalCode && !addressPostalCode && !addressLooksLikeStreet
      ? address
      : "");
  const city =
    cityCandidate.length >= 2 && cityCandidate.length <= 80
      ? cityCandidate
      : "";
  const quantity = Number(request.nextUrl.searchParams.get("quantity") || "1");
  if (
    (!postalCode && !city) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 30
  )
    return NextResponse.json(
      { error: "Indiquez un code postal français ou une ville valides." },
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
    const readiness = getMondialRelayProductionReadiness(settings);
    if (!readiness.searchEnabled)
      return NextResponse.json(
        { error: "La recherche Mondial Relay n’est pas encore configurée pour la production." },
        { status: 503 },
      );
    if (!isSupportedMondialRelayService(settings.serviceCode))
      return NextResponse.json(
        { error: "Le service de recherche Mondial Relay n’est pas pris en charge." },
        { status: 409 },
      );
    const parcel = getMondialRelayParcelProfile(settings, quantity);
    if (!parcel || !getMondialRelayQuote(settings, quantity))
      return NextResponse.json(
        { error: "Le profil colis ou le tarif de livraison n’est pas configuré pour cette quantité." },
        { status: 409 },
      );
    const points = await searchMondialRelayPoints({
      shop: process.env.MONDIAL_RELAY_API1_PROD_SHOP || "",
      privateKey: process.env.MONDIAL_RELAY_API1_PROD_PRIVATE_KEY || "",
      postalCode,
      city: city || "",
      weightGrams: parcel.weightGrams || 0,
      serviceCode: settings.serviceCode,
    });
    return NextResponse.json(
      {
        source: "production",
        points: points.map((point) => signMondialRelayPoint(point)),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    securityEvent("MONDIAL_RELAY_SEARCH_FAILED", "warn");
    if (
      error instanceof MondialRelayApi1ResponseError &&
      error.code.startsWith("STAT_")
    ) {
      if (error.code === "STAT_49")
        return NextResponse.json(
          {
            error:
              "Mondial Relay refuse l’action de recherche demandée (STAT 49). Vérifiez l’action autorisée pour le contrat API1.",
          },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      return NextResponse.json(
        {
          error: `Mondial Relay a rejeté la recherche (code ${error.code.slice(5)}). Vérifiez les accès API1 et le code de service de production.`,
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Recherche des Points Relais indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
