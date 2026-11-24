export type MondialRelayServiceCode = "24R" | "24L";
export type RelayPointSource = "simulation" | "sandbox";

export type RelayPoint = {
  id: string;
  location: string;
  label: string;
  address: string[];
  postalCode: string;
  city: string;
  distanceKm?: number;
  source: RelayPointSource;
  serviceCode: MondialRelayServiceCode;
};

export type ParcelProfile = {
  itemsPerParcel: number;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
};

export type ShippingRate = {
  serviceCode: MondialRelayServiceCode;
  maxWeightGrams: number;
  priceCents: number;
};

export type MondialRelaySettings = {
  serviceCode: MondialRelayServiceCode;
  testParcel: ParcelProfile;
  contractParcel: ParcelProfile;
  testRates: ShippingRate[];
  contractRates: ShippingRate[];
};

export type ShippingQuote = {
  priceCents: number;
  parcelCount: number;
  serviceCode: MondialRelayServiceCode;
  source: "simulation" | "contract";
};

export const DEFAULT_MONDIAL_RELAY_SETTINGS: MondialRelaySettings = {
  serviceCode: "24R",
  testParcel: {
    itemsPerParcel: 1,
    weightGrams: 500,
    lengthCm: 45,
    widthCm: 40,
    depthCm: 5,
  },
  contractParcel: {
    itemsPerParcel: 1,
    weightGrams: null,
    lengthCm: null,
    widthCm: null,
    depthCm: null,
  },
  testRates: [
    { serviceCode: "24R", maxWeightGrams: 500, priceCents: 410 },
  ],
  contractRates: [],
};

export function getMondialRelayQuote(
  settings: MondialRelaySettings,
  itemCount: number,
  source: ShippingQuote["source"],
): ShippingQuote | null {
  if (!Number.isInteger(itemCount) || itemCount < 1) return null;

  const profile =
    source === "contract" ? settings.contractParcel : settings.testParcel;
  const rates =
    source === "contract" ? settings.contractRates : settings.testRates;
  const weightGrams = profile.weightGrams;
  if (!weightGrams || profile.itemsPerParcel < 1) return null;

  const rate = rates
    .filter(
      (candidate) =>
        candidate.serviceCode === settings.serviceCode &&
        candidate.maxWeightGrams >= weightGrams,
    )
    .sort((left, right) => left.maxWeightGrams - right.maxWeightGrams)[0];
  if (!rate) return null;

  const parcelCount = Math.ceil(itemCount / profile.itemsPerParcel);
  return {
    priceCents: rate.priceCents * parcelCount,
    parcelCount,
    serviceCode: settings.serviceCode,
    source,
  };
}

export function createSimulatedRelayPoint(
  postalCode: string,
  city: string,
  serviceCode: MondialRelayServiceCode,
): RelayPoint {
  return {
    id: `SIM-${postalCode}`,
    location: `SIM-${postalCode}`,
    label: "Point Relais simulé",
    address: ["Adresse fictive - résultat de simulation"],
    postalCode,
    city,
    distanceKm: 0,
    source: "simulation",
    serviceCode,
  };
}

export function isRelayPoint(value: unknown): value is RelayPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<RelayPoint>;
  return (
    typeof point.id === "string" &&
    typeof point.location === "string" &&
    typeof point.label === "string" &&
    Array.isArray(point.address) &&
    point.address.every((line) => typeof line === "string") &&
    typeof point.postalCode === "string" &&
    typeof point.city === "string" &&
    (point.source === "simulation" || point.source === "sandbox") &&
    (point.serviceCode === "24R" || point.serviceCode === "24L")
  );
}
