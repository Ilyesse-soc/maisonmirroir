export type MondialRelayServiceCode =
  | "24R/MED"
  | "24R/APM"
  | "24R"
  | "24L";
export type SupportedMondialRelayServiceCode = Extract<
  MondialRelayServiceCode,
  "24R/MED" | "24R/APM"
>;
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
  serviceCode: SupportedMondialRelayServiceCode;
  maxWeightGrams: number;
  priceCents?: number;
  priceBasis: "unknown" | "HT" | "TTC";
  customerPriceCents: number | null;
  confirmed: boolean;
};

export type ProposedShippingRate = {
  serviceCode: SupportedMondialRelayServiceCode;
  maxWeightGrams: number | null;
  priceCents: number;
  priceBasis: "unknown" | "HT" | "TTC";
  customerPriceCents: number | null;
  confirmed: boolean;
};

export type MondialRelaySender = {
  company: string;
  firstName: string;
  lastName: string;
  street: string;
  houseNo: string;
  postalCode: string;
  city: string;
  countryCode: string;
  phone: string;
  email: string;
};

export type MondialRelaySettings = {
  serviceCode: SupportedMondialRelayServiceCode;
  allowedServices: SupportedMondialRelayServiceCode[];
  contractConfirmed: boolean;
  serviceConfirmed: boolean;
  collectionMode: string;
  collectionModeConfirmed: boolean;
  sender: MondialRelaySender;
  testParcel: ParcelProfile;
  contractParcel: ParcelProfile;
  testRates: ShippingRate[];
  contractRates: ShippingRate[];
  proposedRate: ProposedShippingRate;
};

export type ShippingQuote = {
  priceCents: number;
  parcelCount: number;
  serviceCode: SupportedMondialRelayServiceCode;
  source: "contract";
};

export const SUPPORTED_MONDIAL_RELAY_SERVICES: SupportedMondialRelayServiceCode[] = [
  "24R/MED",
  "24R/APM",
];

export const EMPTY_MONDIAL_RELAY_SENDER: MondialRelaySender = {
  company: "",
  firstName: "",
  lastName: "",
  street: "",
  houseNo: "",
  postalCode: "",
  city: "",
  countryCode: "",
  phone: "",
  email: "",
};

export const DEFAULT_MONDIAL_RELAY_SETTINGS: MondialRelaySettings = {
  serviceCode: "24R/MED",
  allowedServices: [],
  contractConfirmed: false,
  serviceConfirmed: false,
  collectionMode: "",
  collectionModeConfirmed: false,
  sender: EMPTY_MONDIAL_RELAY_SENDER,
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
  proposedRate: {
    serviceCode: "24R/MED",
    maxWeightGrams: null,
    priceCents: 451,
    priceBasis: "unknown",
    customerPriceCents: null,
    confirmed: false,
  },
};

export function isSupportedMondialRelayService(
  value: unknown,
): value is SupportedMondialRelayServiceCode {
  return value === "24R/MED" || value === "24R/APM";
}

export function isMondialRelayServiceAllowed(
  settings: Pick<
    MondialRelaySettings,
    "serviceCode" | "allowedServices" | "serviceConfirmed"
  >,
  serviceCode: unknown = settings.serviceCode,
) {
  return (
    settings.serviceConfirmed &&
    isSupportedMondialRelayService(serviceCode) &&
    settings.allowedServices.includes(serviceCode)
  );
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

export function getMondialRelayQuote(
  settings: Pick<
    MondialRelaySettings,
    "serviceCode" | "contractParcel" | "contractRates"
  > &
    Partial<
      Pick<
        MondialRelaySettings,
        | "allowedServices"
        | "serviceConfirmed"
        | "contractConfirmed"
        | "proposedRate"
      >
    >,
  itemCount: number,
): ShippingQuote | null {
  if (
    !Number.isInteger(itemCount) ||
    itemCount < 1 ||
    settings.contractConfirmed === false ||
    settings.serviceConfirmed === false ||
    (settings.allowedServices !== undefined &&
      !settings.allowedServices.includes(settings.serviceCode))
  )
    return null;

  const profile = settings.contractParcel;
  const weightGrams = profile.weightGrams;
  if (
    !weightGrams ||
    !profile.lengthCm ||
    !profile.widthCm ||
    !profile.depthCm ||
    profile.itemsPerParcel < 1
  )
    return null;

  const proposed = settings.proposedRate;
  const proposedAsRate: ShippingRate | null =
    proposed?.confirmed &&
    proposed.maxWeightGrams &&
    proposed.priceBasis !== "unknown" &&
    proposed.customerPriceCents !== null
      ? {
          ...proposed,
          maxWeightGrams: proposed.maxWeightGrams,
          customerPriceCents: proposed.customerPriceCents,
        }
      : null;
  const rate = [...settings.contractRates, ...(proposedAsRate ? [proposedAsRate] : [])]
    .filter(
      (candidate) =>
        candidate.serviceCode === settings.serviceCode &&
        candidate.confirmed &&
        candidate.priceBasis !== "unknown" &&
        candidate.customerPriceCents !== null &&
        candidate.customerPriceCents > 0 &&
        (candidate.priceCents === undefined || candidate.priceCents > 0) &&
        candidate.maxWeightGrams >= weightGrams,
    )
    .sort((left, right) => left.maxWeightGrams - right.maxWeightGrams)[0];
  if (!rate || rate.customerPriceCents === null) return null;

  const parcelCount = Math.ceil(itemCount / profile.itemsPerParcel);
  if (parcelCount > 1) return null;
  return {
    priceCents: rate.customerPriceCents,
    parcelCount,
    serviceCode: settings.serviceCode,
    source: "contract",
  };
}
