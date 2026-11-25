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
  openingHours?: { day: string; periods: string[] }[];
  coordinates?: { latitude: number; longitude: number };
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

export type ResolvedParcelProfile = {
  itemsPerParcel: number;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  depthCm: number;
};

export type ShippingTier = {
  quantity: number;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  customerPriceCents: number | null;
  confirmed: boolean;
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
  collectionMode: "REL" | "CCC";
  collectionModeConfirmed: boolean;
  sender: MondialRelaySender;
  testParcel: ParcelProfile;
  contractParcel: ParcelProfile;
  shippingTiers: ShippingTier[];
  homeDeliveryEnabled: boolean;
  homeDeliveryContractConfirmed: boolean;
  homeShippingTiers: ShippingTier[];
  preparationDays: number;
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
  collectionMode: "REL",
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
  shippingTiers: [
    {
      quantity: 1,
      weightGrams: 500,
      lengthCm: 30,
      widthCm: 21,
      depthCm: 6,
      customerPriceCents: 410,
      confirmed: true,
    },
    {
      quantity: 2,
      weightGrams: 1000,
      lengthCm: null,
      widthCm: null,
      depthCm: null,
      customerPriceCents: 454,
      confirmed: false,
    },
  ],
  homeDeliveryEnabled: false,
  homeDeliveryContractConfirmed: false,
  homeShippingTiers: [
    {
      quantity: 1,
      weightGrams: 500,
      lengthCm: 30,
      widthCm: 21,
      depthCm: 6,
      customerPriceCents: 749,
      confirmed: true,
    },
    {
      quantity: 2,
      weightGrams: 1000,
      lengthCm: null,
      widthCm: null,
      depthCm: null,
      customerPriceCents: null,
      confirmed: false,
    },
  ],
  preparationDays: 3,
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

export function getHomeDeliveryPriceCents(
  settings: Pick<
    MondialRelaySettings,
    "homeDeliveryEnabled" | "homeDeliveryContractConfirmed" | "homeShippingTiers"
  >,
  itemCount: number,
): number | null {
  if (
    !settings.homeDeliveryEnabled ||
    !settings.homeDeliveryContractConfirmed ||
    !Number.isInteger(itemCount) ||
    itemCount < 1 ||
    itemCount > 30
  )
    return null;
  const tier = settings.homeShippingTiers.find(
    (candidate) => candidate.quantity === itemCount,
  );
  if (
    !tier?.confirmed ||
    !tier.weightGrams ||
    !tier.lengthCm ||
    !tier.widthCm ||
    !tier.depthCm ||
    !tier.customerPriceCents ||
    tier.customerPriceCents < 1
  )
    return null;
  return tier.customerPriceCents;
}

export function getHomeDeliveryParcelProfile(
  settings: Pick<
    MondialRelaySettings,
    "homeDeliveryEnabled" | "homeDeliveryContractConfirmed" | "homeShippingTiers"
  >,
  itemCount: number,
): ResolvedParcelProfile | null {
  if (
    !settings.homeDeliveryEnabled ||
    !settings.homeDeliveryContractConfirmed ||
    !Number.isInteger(itemCount) ||
    itemCount < 1 ||
    itemCount > 30
  )
    return null;
  const tier = settings.homeShippingTiers.find(
    (candidate) => candidate.quantity === itemCount,
  );
  if (
    !tier?.confirmed ||
    !tier.weightGrams ||
    !tier.lengthCm ||
    !tier.widthCm ||
    !tier.depthCm ||
    !tier.customerPriceCents
  )
    return null;
  return {
    itemsPerParcel: tier.quantity,
    weightGrams: tier.weightGrams,
    lengthCm: tier.lengthCm,
    widthCm: tier.widthCm,
    depthCm: tier.depthCm,
  };
}

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

export function getMondialRelayParcelProfile(
  settings: Partial<
    Pick<MondialRelaySettings, "contractParcel" | "shippingTiers">
  >,
  itemCount: number,
): ResolvedParcelProfile | null {
  if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 30)
    return null;
  if (settings.shippingTiers !== undefined) {
    const tier = settings.shippingTiers.find(
      (candidate) => candidate.quantity === itemCount,
    );
    if (
      !tier ||
      !tier.confirmed ||
      !tier.weightGrams ||
      !tier.lengthCm ||
      !tier.widthCm ||
      !tier.depthCm
    )
      return null;
    return {
      itemsPerParcel: tier.quantity,
      weightGrams: tier.weightGrams,
      lengthCm: tier.lengthCm,
      widthCm: tier.widthCm,
      depthCm: tier.depthCm,
    };
  }

  const profile = settings.contractParcel;
  if (
    !profile ||
    !profile.weightGrams ||
    !profile.lengthCm ||
    !profile.widthCm ||
    !profile.depthCm ||
    itemCount > profile.itemsPerParcel
  )
    return null;
  return {
    itemsPerParcel: profile.itemsPerParcel,
    weightGrams: profile.weightGrams,
    lengthCm: profile.lengthCm,
    widthCm: profile.widthCm,
    depthCm: profile.depthCm,
  };
}

export function getMondialRelayQuote(
  settings: Pick<MondialRelaySettings, "serviceCode"> &
    Partial<
      Pick<
        MondialRelaySettings,
        | "allowedServices"
        | "serviceConfirmed"
        | "contractConfirmed"
        | "contractParcel"
        | "contractRates"
        | "proposedRate"
        | "shippingTiers"
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

  const profile = getMondialRelayParcelProfile(settings, itemCount);
  if (settings.shippingTiers !== undefined) {
    const tier = settings.shippingTiers.find(
      (candidate) => candidate.quantity === itemCount,
    );
    if (
      !profile ||
      !tier?.confirmed ||
      !Number.isInteger(tier.customerPriceCents) ||
      !tier.customerPriceCents ||
      tier.customerPriceCents < 1
    )
      return null;
    return {
      priceCents: tier.customerPriceCents,
      parcelCount: 1,
      serviceCode: settings.serviceCode,
      source: "contract",
    };
  }
  if (!profile || !settings.contractRates) return null;
  const weightGrams = profile.weightGrams;
  if (!weightGrams) return null;

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
