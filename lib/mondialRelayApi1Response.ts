import type {
  MondialRelayServiceCode,
  RelayPoint,
} from "@/lib/mondialRelayTypes";

export class MondialRelayApi1ResponseError extends Error {
  constructor(readonly code: string) {
    super(`MONDIAL_RELAY_API1_${code}`);
    this.name = "MondialRelayApi1ResponseError";
  }
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
    new RegExp(
      `<(?:(?:[\\w.-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:(?:[\\w.-]+):)?${name}\\s*>`,
      "i",
    ),
  );
  return match ? decodeXml(match[1].trim()) : "";
}

function elements(xml: string, name: string) {
  const pattern = new RegExp(
    `<(?:(?:[\\w.-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:(?:[\\w.-]+):)?${name}\\s*>`,
    "gi",
  );
  return Array.from(xml.matchAll(pattern), (match) =>
    decodeXml(match[1].trim()),
  );
}

function openingPeriods(details: string, field: string) {
  const raw = element(details, field);
  if (!raw) return [];
  const nested = Array.from(
    raw.matchAll(/<[^>]+>([^<>]*)<\/[^>]+>/g),
    (match) => match[1].trim(),
  ).filter(Boolean);
  const plain = raw.replace(/<[^>]+>/g, "").trim();
  return nested.length ? nested : plain ? [plain] : [];
}

function relayPoints(xml: string, serviceCode: MondialRelayServiceCode) {
  const hoursFields = [
    ["Horaires_Lundi", "Lundi"],
    ["Horaires_Mardi", "Mardi"],
    ["Horaires_Mercredi", "Mercredi"],
    ["Horaires_Jeudi", "Jeudi"],
    ["Horaires_Vendredi", "Vendredi"],
    ["Horaires_Samedi", "Samedi"],
    ["Horaires_Dimanche", "Dimanche"],
  ] as const;
  return Array.from(
    xml.matchAll(
      /<(?:(?:[\w.-]+):)?PointRelais_Details(?:\s[^>]*)?>([\s\S]*?)<\/(?:(?:[\w.-]+):)?PointRelais_Details\s*>/gi,
    ),
  )
    .map((match): RelayPoint | null => {
      const details = match[1];
      const id = element(details, "Num");
      if (!/^[0-9]{6}$/.test(id)) return null;
      const address = ["LgAdr1", "LgAdr2", "LgAdr3", "LgAdr4"]
        .map((name) => element(details, name))
        .filter(Boolean);
      const openingHours = hoursFields
        .map(([field, day]) => ({
          day,
          periods: openingPeriods(details, field),
        }))
        .filter((entry) => entry.periods.length > 0);
      const latitudeText = element(details, "Latitude");
      const longitudeText = element(details, "Longitude");
      const latitude = Number(latitudeText);
      const longitude = Number(longitudeText);
      const distanceText = element(details, "Distance");
      const distance = Number(distanceText);
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
        ...(openingHours.length ? { openingHours } : {}),
        ...(latitudeText &&
        longitudeText &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        Math.abs(latitude) <= 90 &&
        Math.abs(longitude) <= 180
          ? { coordinates: { latitude, longitude } }
          : {}),
        ...(distanceText && Number.isFinite(distance)
          ? { distanceKm: distance / 1000 }
          : {}),
        source: "production",
        serviceCode,
      };
    })
    .filter((point): point is RelayPoint => point !== null);
}

export function parseMondialRelayApi1Response(
  xml: string,
  serviceCode: MondialRelayServiceCode,
) {
  if (xml.length > 1_000_000)
    throw new MondialRelayApi1ResponseError("RESPONSE_TOO_LARGE");
  if (/<(?:[\w.-]+:)?Fault\b/i.test(xml))
    throw new MondialRelayApi1ResponseError("SOAP_FAULT");
  const statuses = elements(xml, "STAT");
  if (statuses.length) {
    for (const status of statuses) {
      if (!/^[0-9]{1,3}$/.test(status))
        throw new MondialRelayApi1ResponseError("STATUS_INVALID");
      if (status !== "0")
        throw new MondialRelayApi1ResponseError(`STAT_${status}`);
    }
  } else if (
    !/<(?:(?:[\w.-]+):)?PointsRelais\b/i.test(xml) ||
    /<(?:(?:[\w.-]+):)?PointRelais_Details\b/i.test(xml)
  ) {
    throw new MondialRelayApi1ResponseError("STATUS_MISSING");
  }
  return relayPoints(xml, serviceCode);
}
