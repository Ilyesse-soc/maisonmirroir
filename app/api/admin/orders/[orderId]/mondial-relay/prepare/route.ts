import { NextRequest, NextResponse } from "next/server";
import { adminAudit } from "@/lib/adminAudit";
import { adminDenied } from "@/lib/adminAuth";
import { getMondialRelaySettings, getMondialRelayTestCredentialStatus } from "@/lib/mondialRelaySettings";
import { mutationAllowed } from "@/lib/requestSecurity";
import { securityEvent } from "@/lib/observability";
import { readOrders } from "@/lib/orderStore";
import { MONDIAL_RELAY_POINT_RELAIS_ID } from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const senderEnvironmentKeys = [
  "MONDIAL_RELAY_SENDER_FIRSTNAME",
  "MONDIAL_RELAY_SENDER_LASTNAME",
  "MONDIAL_RELAY_SENDER_STREET",
  "MONDIAL_RELAY_SENDER_POSTCODE",
  "MONDIAL_RELAY_SENDER_CITY",
  "MONDIAL_RELAY_SENDER_COUNTRY",
  "MONDIAL_RELAY_SENDER_PHONE",
];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const denied = await adminDenied();
  if (denied) return denied;
  const originDenied = mutationAllowed(request, false);
  if (originDenied) return originDenied;
  try {
    const { orderId } = await context.params;
    if (!/^MM-[0-9]{4}-[A-Z0-9]{8}$/.test(orderId))
      return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
    const order = (await readOrders()).find((item) => item.orderId === orderId);
    if (!order)
      return NextResponse.json(
        { error: "Commande introuvable." },
        { status: 404 },
      );
    if (order.shipping.id !== MONDIAL_RELAY_POINT_RELAIS_ID)
      return NextResponse.json(
        { error: "Cette commande ne contient pas de livraison Point Relais." },
        { status: 409 },
      );
    const point = order.shipping.relayPoint;
    if (!point)
      return NextResponse.json(
        { error: "Aucun Point Relais n’est enregistré sur cette commande." },
        { status: 409 },
      );

    await adminAudit("MONDIAL_RELAY_SHIPMENT_PREPARATION_REQUESTED", orderId);
    const [settings, credentials] = await Promise.all([
      getMondialRelaySettings(),
      Promise.resolve(getMondialRelayTestCredentialStatus()),
    ]);
    const senderProfileConfigured = senderEnvironmentKeys.every((key) =>
      Boolean(process.env[key]),
    );
    const blockers = [
      ...(point.source !== "sandbox"
        ? ["Le Point Relais provient d’une simulation et n’est pas réel."]
        : []),
      ...(!credentials.api1
        ? ["Les identifiants API1 de test ne sont pas configurés."]
        : []),
      ...(credentials.api1 && !credentials.api1SandboxEnabled
        ? ["Les appels API1 sandbox ne sont pas activés."]
        : []),
      ...(!settings.testParcel.weightGrams ||
      !settings.testParcel.lengthCm ||
      !settings.testParcel.widthCm ||
      !settings.testParcel.depthCm
        ? ["Le profil colis de test est incomplet."]
        : []),
      ...(!credentials.api2
        ? ["Les identifiants API2 de test ne sont pas configurés."]
        : []),
      ...(credentials.api2 && !credentials.api2SandboxEnabled
        ? ["Les appels API2 sandbox ne sont pas activés."]
        : []),
      ...(!senderProfileConfigured
        ? ["Les coordonnées expéditeur ne sont pas configurées dans l’environnement sécurisé."]
        : []),
    ];
    return NextResponse.json({
      mode: "simulation",
      apiRequestSent: false,
      labelGenerated: false,
      shipmentCreated: false,
      realShippingEnabled: false,
      readyForSandbox: blockers.length === 0,
      deliveryMode: {
        mode: settings.serviceCode,
        location: point.location,
      },
      parcel: settings.testParcel,
      credentialsConfigured: credentials,
      senderProfileConfigured,
      serviceRights: "unverified",
      blockers: [
        ...blockers,
        "Aucune requête de création n’est envoyée : génération d’étiquette et expédition désactivées.",
        "Le droit du compte au service demandé reste non vérifié tant qu’un appel de création sandbox n’est pas explicitement autorisé.",
      ],
    });
  } catch {
    securityEvent("MONDIAL_RELAY_SHIPMENT_PREPARATION_FAILED");
    return NextResponse.json(
      { error: "Préparation de l’expédition indisponible." },
      { status: 503 },
    );
  }
}
