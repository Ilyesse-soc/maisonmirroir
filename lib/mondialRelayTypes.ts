export type MondialRelayServiceCode =
  | "24R/MED"
  | "24R/APM"
  | "24R"
  | "24L";
export type RelayPointSource = "production";

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
  proof?: string;
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
  source: "contract";
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
  testRates: [],
  contractRates: [],
};

export function getMondialRelayQuote(
  settings: Pick<
    MondialRelaySettings,
    "serviceCode" | "contractParcel" | "contractRates"
  >,
  itemCount: number,
): ShippingQuote | null {
  if (!Number.isInteger(itemCount) || itemCount < 1) return null;

  const profile = settings.contractParcel;
  const rates = settings.contractRates;
  const weightGrams = profile.weightGrams;
  if (
    !weightGrams ||
    !profile.lengthCm ||
    !profile.widthCm ||
    !profile.depthCm ||
    profile.itemsPerParcel < 1
  )
    return null;

  const rate = rates
    .filter(
      (candidate) =>
        candidate.serviceCode === settings.serviceCode &&
        candidate.priceCents > 0 &&
        candidate.maxWeightGrams >= weightGrams,
    )
    .sort((left, right) => left.maxWeightGrams - right.maxWeightGrams)[0];
  if (!rate) return null;

  const parcelCount = Math.ceil(itemCount / profile.itemsPerParcel);
  if (parcelCount > 1 && settings.serviceCode !== "24L") return null;
  return {
    priceCents: rate.priceCents * parcelCount,
    parcelCount,
    serviceCode: settings.serviceCode,
    source: "contract",
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
    point.source === "production" &&
    (point.serviceCode === "24R/MED" ||
      point.serviceCode === "24R/APM" ||
      point.serviceCode === "24R" ||
      point.serviceCode === "24L") &&
    (point.proof === undefined || typeof point.proof === "string")
  );
}
