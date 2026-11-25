import "server-only";
import { z } from "zod";
import { database } from "@/lib/newsletterDb";
import {
  DEFAULT_MONDIAL_RELAY_SETTINGS,
  EMPTY_MONDIAL_RELAY_SENDER,
  isSupportedMondialRelayService,
  type MondialRelaySettings,
  type ShippingRate,
  type ShippingTier,
} from "@/lib/mondialRelayTypes";

const serviceCodeSchema = z.enum(["24R/MED", "24R/APM"]);
const collectionModeSchema = z.literal("REL");
const profileSchema = z
  .object({
    itemsPerParcel: z.number().int().min(1).max(30),
    weightGrams: z.number().int().min(1).max(30000).nullable(),
    lengthCm: z.number().int().min(1).max(200).nullable(),
    widthCm: z.number().int().min(1).max(200).nullable(),
    depthCm: z.number().int().min(1).max(200).nullable(),
  })
  .strict();
const shippingTierSchema = z
  .object({
    quantity: z.number().int().min(1).max(30),
    weightGrams: z.number().int().min(1).max(30000).nullable(),
    lengthCm: z.number().int().min(1).max(200).nullable(),
    widthCm: z.number().int().min(1).max(200).nullable(),
    depthCm: z.number().int().min(1).max(200).nullable(),
    customerPriceCents: z.number().int().min(0).max(100000).nullable(),
    confirmed: z.boolean(),
  })
  .strict();
const shippingTiersSchema = z
  .array(shippingTierSchema)
  .max(30)
  .superRefine((tiers, context) => {
    const quantities = new Set<number>();
    tiers.forEach((tier, index) => {
      if (quantities.has(tier.quantity))
        context.addIssue({
          code: "custom",
          message: "Chaque quantité ne peut avoir qu'un seul palier.",
          path: [index, "quantity"],
        });
      quantities.add(tier.quantity);
      if (
        tier.confirmed &&
        (!tier.weightGrams ||
          !tier.lengthCm ||
          !tier.widthCm ||
          !tier.depthCm ||
          !tier.customerPriceCents)
      )
        context.addIssue({
          code: "custom",
          message: "Un palier confirmé doit avoir un colis complet et un tarif client.",
          path: [index, "confirmed"],
        });
    });
  });
const senderSchema = z
  .object({
    company: z.string().max(120),
    firstName: z.string().max(80),
    lastName: z.string().max(80),
    street: z.string().max(120),
    houseNo: z.string().max(20),
    postalCode: z.string().max(12),
    city: z.string().max(80),
    countryCode: z.string().max(2),
    phone: z.string().max(30),
    email: z.string().max(254),
  })
  .strict();
const basisSchema = z.enum(["unknown", "HT", "TTC"]);
const rateSchema = z
  .object({
    serviceCode: serviceCodeSchema,
    maxWeightGrams: z.number().int().min(1).max(30000),
    priceCents: z.number().int().min(0).max(100000),
    priceBasis: basisSchema,
    customerPriceCents: z.number().int().min(0).max(100000).nullable(),
    confirmed: z.boolean(),
  })
  .strict();
const ratesSchema = z.array(rateSchema).max(60);
const proposedRateSchema = z
  .object({
    serviceCode: serviceCodeSchema,
    maxWeightGrams: z.number().int().min(1).max(30000).nullable(),
    priceCents: z.number().int().min(0).max(100000),
    priceBasis: basisSchema,
    customerPriceCents: z.number().int().min(0).max(100000).nullable(),
    confirmed: z.boolean(),
  })
  .strict();
export const mondialRelaySettingsSchema = z
  .object({
    serviceCode: serviceCodeSchema,
    allowedServices: z.array(serviceCodeSchema).max(2),
    contractConfirmed: z.boolean(),
    serviceConfirmed: z.boolean(),
    collectionMode: collectionModeSchema,
    collectionModeConfirmed: z.boolean(),
    sender: senderSchema,
    testParcel: profileSchema,
    contractParcel: profileSchema,
    shippingTiers: shippingTiersSchema,
    testRates: ratesSchema,
    contractRates: ratesSchema,
    proposedRate: proposedRateSchema,
  })
  .strict()
  .superRefine((settings, context) => {
    if (settings.serviceCode !== "24R/MED")
      context.addIssue({
        code: "custom",
        message: "La boutique est configurée en Point Relais uniquement.",
        path: ["serviceCode"],
      });
    if (settings.allowedServices.some((service) => service !== "24R/MED"))
      context.addIssue({
        code: "custom",
        message: "Seul le service Point Relais 24R/MED est autorisé.",
        path: ["allowedServices"],
      });
    if (settings.proposedRate.serviceCode !== "24R/MED")
      context.addIssue({
        code: "custom",
        message: "Le tarif proposé doit concerner le service Point Relais.",
        path: ["proposedRate", "serviceCode"],
      });
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function legacyProfile(value: unknown, fallback: MondialRelaySettings["testParcel"]) {
  const parsed = profileSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

function legacyRates(value: unknown): ShippingRate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || !isSupportedMondialRelayService(item.serviceCode))
      return [];
    const maxWeightGrams = item.maxWeightGrams;
    const priceCents = item.priceCents;
    if (
      typeof maxWeightGrams !== "number" ||
      !Number.isInteger(maxWeightGrams) ||
      maxWeightGrams < 1 ||
      maxWeightGrams > 30000 ||
      typeof priceCents !== "number" ||
      !Number.isInteger(priceCents) ||
      priceCents < 0 ||
      priceCents > 100000
    )
      return [];
    const current = rateSchema.safeParse(item);
    return [
      current.success
        ? current.data
        : {
            serviceCode: item.serviceCode,
            maxWeightGrams,
            priceCents,
            priceBasis: "unknown" as const,
            customerPriceCents: null,
            confirmed: false,
          },
    ];
  });
}

export function parseMondialRelaySettings(value: unknown): MondialRelaySettings {
  const parsed = mondialRelaySettingsSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const source = isRecord(value) ? value : {};
  const serviceCode = source.serviceCode === "24R/MED"
    ? source.serviceCode
    : DEFAULT_MONDIAL_RELAY_SETTINGS.serviceCode;
  const storedSender = senderSchema.safeParse(source.sender);
  const storedProposed = proposedRateSchema.safeParse(source.proposedRate);
  const storedShippingTiers = shippingTiersSchema.safeParse(source.shippingTiers);
  const storedCollectionMode = collectionModeSchema.safeParse(source.collectionMode);
  const allowedServices = Array.isArray(source.allowedServices)
    ? source.allowedServices.filter((service) => service === "24R/MED")
    : [];
  return {
    serviceCode,
    allowedServices: [...new Set(allowedServices)],
    contractConfirmed: source.contractConfirmed === true,
    serviceConfirmed:
      source.serviceCode === "24R/MED" && source.serviceConfirmed === true,
    collectionMode: storedCollectionMode.success
      ? storedCollectionMode.data
      : DEFAULT_MONDIAL_RELAY_SETTINGS.collectionMode,
    collectionModeConfirmed:
      storedCollectionMode.success && source.collectionModeConfirmed === true,
    sender: storedSender.success
      ? storedSender.data
      : { ...EMPTY_MONDIAL_RELAY_SENDER },
    testParcel: legacyProfile(
      source.testParcel,
      DEFAULT_MONDIAL_RELAY_SETTINGS.testParcel,
    ),
    contractParcel: legacyProfile(
      source.contractParcel,
      DEFAULT_MONDIAL_RELAY_SETTINGS.contractParcel,
    ),
    shippingTiers: storedShippingTiers.success
      ? storedShippingTiers.data as ShippingTier[]
      : DEFAULT_MONDIAL_RELAY_SETTINGS.shippingTiers.map((tier) => ({ ...tier })),
    testRates: legacyRates(source.testRates),
    contractRates: legacyRates(source.contractRates),
    proposedRate: storedProposed.success
      ? {
          ...storedProposed.data,
          serviceCode: "24R/MED",
          confirmed:
            storedProposed.data.serviceCode === "24R/MED" &&
            storedProposed.data.confirmed,
        }
      : { ...DEFAULT_MONDIAL_RELAY_SETTINGS.proposedRate },
  };
}

export async function getMondialRelaySettings(): Promise<MondialRelaySettings> {
  const result = await database().query(
    "SELECT settings FROM mm_shipping_settings WHERE id=1",
  );
  const settings = result.rows[0]?.settings;
  if (!settings) return DEFAULT_MONDIAL_RELAY_SETTINGS;
  return parseMondialRelaySettings(settings);
}

export async function saveMondialRelaySettings(
  settings: MondialRelaySettings,
  userId: string,
) {
  const validated = mondialRelaySettingsSchema.parse(settings);
  await database().query(
    `INSERT INTO mm_shipping_settings(id,settings,updated_by)
     VALUES(1,$1,$2)
     ON CONFLICT(id) DO UPDATE SET settings=EXCLUDED.settings,
       updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [JSON.stringify(validated), userId],
  );
}

export function getMondialRelayProductionCredentialStatus(
  settings: MondialRelaySettings = DEFAULT_MONDIAL_RELAY_SETTINGS,
) {
  const sender = settings.sender;
  const senderConfigured = Boolean(
    sender.company.trim() &&
      sender.firstName.trim() &&
      sender.lastName.trim() &&
      sender.street.trim() &&
      sender.houseNo.trim() &&
      /^[0-9]{5}$/.test(sender.postalCode) &&
      sender.city.trim() &&
      sender.countryCode.trim().toUpperCase() === "FR" &&
      sender.phone.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender.email),
  );
  return {
    api1Configured:
      Boolean(process.env.MONDIAL_RELAY_API1_PROD_SHOP) &&
      Boolean(process.env.MONDIAL_RELAY_API1_PROD_PRIVATE_KEY),
    api2Configured:
      Boolean(process.env.MONDIAL_RELAY_API2_PROD_LOGIN) &&
      Boolean(process.env.MONDIAL_RELAY_API2_PROD_PASSWORD) &&
      Boolean(process.env.MONDIAL_RELAY_API2_PROD_CUSTOMER_ID),
    api1Enabled: process.env.MONDIAL_RELAY_API1_PROD_ENABLED === "true",
    api2Enabled: process.env.MONDIAL_RELAY_API2_PROD_ENABLED === "true",
    api2EndpointConfigured:
      process.env.MONDIAL_RELAY_API2_PROD_URL ===
      "https://connect-api.mondialrelay.com/api/shipment",
    providerConfirmed:
      process.env.MONDIAL_RELAY_PRODUCTION_CONFIRMED === "true",
    senderConfigured,
    collectionModeConfigured:
      settings.collectionMode === "REL" &&
      settings.collectionModeConfirmed,
  };
}

export function getMondialRelayProductionReadiness(
  settings: MondialRelaySettings,
) {
  const credentials = getMondialRelayProductionCredentialStatus(settings);
  const contractConfirmed = settings.contractConfirmed;
  const serviceAllowed =
    settings.serviceConfirmed &&
    settings.serviceCode === "24R/MED" &&
    isSupportedMondialRelayService(settings.serviceCode) &&
    settings.allowedServices.includes(settings.serviceCode);
  const shippingTiers = Array.isArray(settings.shippingTiers)
    ? settings.shippingTiers
    : [];
  const completeTiers = shippingTiers.filter(
    (tier) =>
      tier.confirmed &&
      tier.weightGrams &&
      tier.lengthCm &&
      tier.widthCm &&
      tier.depthCm,
  );
  const parcel = settings.contractParcel;
  const parcelConfigured =
    shippingTiers.length > 0
      ? completeTiers.length > 0
      : Boolean(
          parcel.weightGrams &&
            parcel.lengthCm &&
            parcel.widthCm &&
            parcel.depthCm &&
            parcel.itemsPerParcel,
        );
  const activeRates = [
    ...settings.contractRates,
    ...(settings.proposedRate.confirmed &&
    settings.proposedRate.maxWeightGrams &&
    settings.proposedRate.priceBasis !== "unknown" &&
    settings.proposedRate.customerPriceCents !== null
      ? [
          {
            ...settings.proposedRate,
            maxWeightGrams: settings.proposedRate.maxWeightGrams,
            customerPriceCents: settings.proposedRate.customerPriceCents,
          } as ShippingRate,
        ]
      : []),
  ];
  const rateConfigured =
    shippingTiers.length > 0
      ? completeTiers.some(
          (tier) =>
            tier.customerPriceCents !== null &&
            tier.customerPriceCents > 0,
        )
      : activeRates.some(
          (rate) =>
            rate.serviceCode === settings.serviceCode &&
            rate.confirmed &&
            typeof rate.priceCents === "number" &&
            rate.priceCents > 0 &&
            rate.priceBasis !== "unknown" &&
            rate.customerPriceCents !== null &&
            rate.customerPriceCents > 0,
        );
  const api1Ready =
    credentials.providerConfirmed &&
    credentials.api1Configured &&
    credentials.api1Enabled;
  const api2Ready =
    credentials.providerConfirmed &&
    credentials.api2Configured &&
    credentials.api2EndpointConfigured &&
    credentials.api2Enabled;
  const sharedContractReady =
    contractConfirmed && serviceAllowed && parcelConfigured && rateConfigured;
  return {
    ...credentials,
    contractConfirmed,
    serviceAllowed,
    modernService: serviceAllowed,
    parcelConfigured,
    rateConfigured,
    api1Ready,
    api2Ready,
    searchEnabled:
      process.env.REAL_SHIPPING_ENABLED === "true" &&
      api1Ready &&
      sharedContractReady,
    shipmentCreationEnabled:
      process.env.REAL_SHIPMENT_CREATION_ENABLED === "true" &&
      api2Ready &&
      sharedContractReady &&
      credentials.senderConfigured &&
      credentials.collectionModeConfigured,
    checkoutShippingReady:
      process.env.REAL_SHIPPING_ENABLED === "true" &&
      api1Ready &&
      api2Ready &&
      sharedContractReady &&
      credentials.senderConfigured &&
      credentials.collectionModeConfigured,
  };
}
