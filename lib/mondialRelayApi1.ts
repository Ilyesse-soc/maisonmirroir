import "server-only";
import { createHash } from "node:crypto";
import type {
  MondialRelayServiceCode,
} from "@/lib/mondialRelayTypes";
import { parseMondialRelayApi1Response } from "@/lib/mondialRelayApi1Response";

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
  return parseMondialRelayApi1Response(xml, input.serviceCode);
}
