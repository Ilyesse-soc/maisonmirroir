import "server-only";
import { createHash } from "node:crypto";
import type {
  MondialRelayServiceCode,
  RelayPoint,
} from "@/lib/mondialRelayTypes";

type SearchInput = {
  shop: string;
  privateKey: string;
  postalCode: string;
  city: string;
  weightGrams: number;
  serviceCode: MondialRelayServiceCode;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function signature(values: Array<string | number>, privateKey: string) {
  return createHash("md5")
    .update(values.map(String).join("") + privateKey, "utf8")
    .digest("hex")
    .toUpperCase();
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function element(xml: string, name: string) {
  const match = xml.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"),
  );
  return match ? decodeXml(match[1].trim()) : "";
}

function relayPoints(xml: string, serviceCode: MondialRelayServiceCode) {
  return Array.from(
    xml.matchAll(
      /<PointRelais_Details(?:\s[^>]*)?>([\s\S]*?)<\/PointRelais_Details>/gi,
    ),
  )
    .map((match): RelayPoint | null => {
      const details = match[1];
      const id = element(details, "Num");
      if (!/^[0-9A-Z]{1,10}$/i.test(id)) return null;
      const address = ["LgAdr1", "LgAdr2", "LgAdr3", "LgAdr4"]
        .map((name) => element(details, name))
        .filter(Boolean);
      return {
        id,
        location: `FR-${id}`,
        label:
          element(details, "Localisation1") ||
          element(details, "LgAdr1") ||
          "Point Relais",
        address,
        postalCode: element(details, "CP"),
        city: element(details, "Ville"),
        ...(Number.isFinite(Number(element(details, "Distance")))
          ? { distanceKm: Number(element(details, "Distance")) }
          : {}),
        source: "sandbox",
        serviceCode,
      };
    })
    .filter((point): point is RelayPoint => point !== null);
}

export async function searchTestRelayPoints(input: SearchInput) {
  const values = [
    input.shop,
    "FR",
    "",
    input.city,
    input.postalCode,
    "",
    "",
    "",
    input.weightGrams,
    "",
    "",
    "",
    "",
    "",
    10,
  ];
  const fields = [
    "Enseigne",
    "Pays",
    "NumPointRelais",
    "Ville",
    "CP",
    "Latitude",
    "Longitude",
    "Taille",
    "Poids",
    "Action",
    "DelaiEnvoi",
    "RayonRecherche",
    "TypeActivite",
    "NACE",
    "NombreResultats",
  ];
  const parameters = fields
    .map(
      (field, index) =>
        `<${field}>${escapeXml(String(values[index]))}</${field}>`,
    )
    .join("");
  const body = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <WSI4_PointRelais_Recherche xmlns="http://www.mondialrelay.fr/webservice/">
          ${parameters}
          <Security>${signature(values, input.privateKey)}</Security>
        </WSI4_PointRelais_Recherche>
      </soap:Body>
    </soap:Envelope>`;
  const response = await fetch(
    "https://api.mondialrelay.com/Web_Services.asmx",
    {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          '"http://www.mondialrelay.fr/webservice/WSI4_PointRelais_Recherche"',
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!response.ok) throw new Error("MONDIAL_RELAY_API1_HTTP_ERROR");
  const xml = await response.text();
  if (xml.length > 1_000_000) throw new Error("MONDIAL_RELAY_API1_RESPONSE_LARGE");
  if (/<(?:\w+:)?Fault\b/i.test(xml))
    throw new Error("MONDIAL_RELAY_API1_SOAP_FAULT");
  return relayPoints(xml, input.serviceCode);
}
