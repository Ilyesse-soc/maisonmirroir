import "server-only";
import { createHash } from "node:crypto";
import type {
  SupportedMondialRelayServiceCode,
} from "@/lib/mondialRelayTypes";
import { parseMondialRelayApi1Response } from "@/lib/mondialRelayApi1Response";

export type MondialRelayApi1SearchInput = {
  shop: string;
  privateKey: string;
  postalCode: string;
  city: string;
  weightGrams: number;
  serviceCode: SupportedMondialRelayServiceCode;
};

export type MondialRelayApi1TrackingInput = {
  shop: string;
  privateKey: string;
  shipmentNumber: string;
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

function api1Action(serviceCode: SupportedMondialRelayServiceCode) {
  return serviceCode === "24R/APM" ? "APM" : "MED";
}

export function buildApi1PointSearchRequest(
  input: MondialRelayApi1SearchInput,
) {
  const parameters: Array<[string, string | number]> = [
    ["Enseigne", input.shop],
    ["Pays", "FR"],
    ["NumPointRelais", ""],
    ["Ville", input.city],
    ["CP", input.postalCode],
    ["Latitude", ""],
    ["Longitude", ""],
    ["Taille", ""],
    ["Poids", input.weightGrams],
    ["Action", api1Action(input.serviceCode)],
    ["DelaiEnvoi", ""],
    ["RayonRecherche", ""],
    ["TypeActivite", ""],
    ["NACE", ""],
    ["NombreResultats", 10],
  ];
  const signedValues = parameters
    .filter(([field]) => field !== "NACE")
    .map(([, value]) => value);
  const parametersXml = parameters
    .map(
      ([field, value]) => `<${field}>${escapeXml(String(value))}</${field}>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <WSI4_PointRelais_Recherche xmlns="http://www.mondialrelay.fr/webservice/">
          ${parametersXml}
          <Security>${signature(signedValues, input.privateKey)}</Security>
        </WSI4_PointRelais_Recherche>
      </soap:Body>
    </soap:Envelope>`;
}

export async function searchMondialRelayPoints(
  input: MondialRelayApi1SearchInput,
) {
  const response = await fetch(
    "https://api.mondialrelay.com/Web_Services.asmx",
    {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          '"http://www.mondialrelay.fr/webservice/WSI4_PointRelais_Recherche"',
      },
      body: buildApi1PointSearchRequest(input),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!response.ok) throw new Error("MONDIAL_RELAY_API1_HTTP_ERROR");
  const xml = await response.text();
  return parseMondialRelayApi1Response(xml, input.serviceCode);
}

export function buildApi1TrackingRequest(
  input: MondialRelayApi1TrackingInput,
) {
  const language = "FR";
  const parameters = [
    ["Enseigne", input.shop],
    ["Expedition", input.shipmentNumber],
    ["Langue", language],
  ] as const;
  const parametersXml = parameters
    .map(
      ([field, value]) => `<${field}>${escapeXml(value)}</${field}>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <WSI2_TracingColisDetaille xmlns="http://www.mondialrelay.fr/webservice/">
          ${parametersXml}
          <Security>${signature(
            [input.shop, input.shipmentNumber, language],
            input.privateKey,
          )}</Security>
        </WSI2_TracingColisDetaille>
      </soap:Body>
    </soap:Envelope>`;
}

export async function trackMondialRelayShipment(
  input: MondialRelayApi1TrackingInput,
) {
  const response = await fetch(
    "https://www.mondialrelay.fr/WebService/WebService.asmx",
    {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          '"http://www.mondialrelay.fr/webservice/WSI2_TracingColisDetaille"',
      },
      body: buildApi1TrackingRequest(input),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!response.ok) throw new Error("MONDIAL_RELAY_API1_HTTP_ERROR");
  return parseMondialRelayTrackingResponse(await response.text());
}

export function parseMondialRelayTrackingResponse(xml: string) {
  if (xml.length > 1_000_000)
    throw new Error("MONDIAL_RELAY_API1_RESPONSE_TOO_LARGE");
  if (/<(?:[\w.-]+:)?Fault\b/i.test(xml))
    throw new Error("MONDIAL_RELAY_API1_SOAP_FAULT");
  const text = (name: string, source: string) => {
    const match = source.match(
      new RegExp(
        `<(?:(?:[\\w.-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:(?:[\\w.-]+):)?${name}\\s*>`,
        "i",
      ),
    );
    return match
      ? match[1]
          .trim()
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
          .replaceAll("&amp;", "&")
      : "";
  };
  const result = xml.match(
    /<(?:[\w.-]+:)?WSI2_TracingColisDetailleResult\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?WSI2_TracingColisDetailleResult\s*>/i,
  )?.[1];
  if (!result) throw new Error("MONDIAL_RELAY_API1_TRACKING_RESPONSE_INVALID");
  const events = Array.from(
    result.matchAll(
      /<(?:[\w.-]+:)?ret_WSI2_sub_TracingColisDetaille\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?ret_WSI2_sub_TracingColisDetaille\s*>/gi,
    ),
    (match) => ({
      label: text("Libelle", match[1]).slice(0, 300),
      date: text("Date", match[1]).slice(0, 40),
      time: text("Heure", match[1]).slice(0, 40),
      location: text("Emplacement", match[1]).slice(0, 160),
      relayNumber: text("Relais_Num", match[1]).slice(0, 16) || undefined,
      country: text("Relais_Pays", match[1]).slice(0, 8) || undefined,
    }),
  );
  return {
    summary: text("Libelle01", result).slice(0, 300),
    relayNumber: text("Relais_Num", result).slice(0, 16) || undefined,
    relayLabel: text("Relais_Libelle", result).slice(0, 160) || undefined,
    events,
  };
}
