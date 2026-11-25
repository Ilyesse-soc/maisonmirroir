import "server-only";
import { z } from "zod";
import { database } from "@/lib/newsletterDb";
import {
  DEFAULT_MONDIAL_RELAY_SETTINGS,
  type MondialRelaySettings,
} from "@/lib/mondialRelayTypes";

const profileSchema = z.object({
  itemsPerParcel: z.number().int().min(1).max(30),
  weightGrams: z.number().int().min(1).max(30000).nullable(),
  lengthCm: z.number().int().min(1).max(200).nullable(),
  widthCm: z.number().int().min(1).max(200).nullable(),
  depthCm: z.number().int().min(1).max(200).nullable(),
}).strict();
const ratesSchema = z.array(
  z.object({
    serviceCode: z.enum(["24R/MED", "24R/APM", "24R", "24L"]),
    maxWeightGrams: z.number().int().min(1).max(30000),
    priceCents: z.number().int().min(0).max(100000),
  }).strict(),
).max(60);
const settingsSchema = z.object({
  serviceCode: z.enum(["24R/MED", "24R/APM", "24R", "24L"]),
  testParcel: profileSchema,
  contractParcel: profileSchema,
  testRates: ratesSchema,
  contractRates: ratesSchema,
}).strict();

export async function getMondialRelaySettings(): Promise<MondialRelaySettings> {
  const result = await database().query(
    "SELECT settings FROM mm_shipping_settings WHERE id=1",
  );
  const settings = result.rows[0]?.settings;
  if (!settings) return DEFAULT_MONDIAL_RELAY_SETTINGS;
  return settingsSchema.parse(settings);
}

export async function saveMondialRelaySettings(
  settings: MondialRelaySettings,
  userId: string,
) {
  await database().query(
    `INSERT INTO mm_shipping_settings(id,settings,updated_by)
     VALUES(1,$1,$2)
     ON CONFLICT(id) DO UPDATE SET settings=EXCLUDED.settings,
       updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [JSON.stringify(settings), userId],
  );
}

export function getMondialRelayProductionCredentialStatus() {
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
    senderConfigured: [
      "MONDIAL_RELAY_SENDER_FIRSTNAME",
      "MONDIAL_RELAY_SENDER_LASTNAME",
      "MONDIAL_RELAY_SENDER_STREET",
      "MONDIAL_RELAY_SENDER_HOUSE_NO",
      "MONDIAL_RELAY_SENDER_POSTCODE",
      "MONDIAL_RELAY_SENDER_CITY",
      "MONDIAL_RELAY_SENDER_COUNTRY",
      "MONDIAL_RELAY_SENDER_PHONE",
      "MONDIAL_RELAY_SENDER_EMAIL",
    ].every((key) => Boolean(process.env[key]?.trim())),
    collectionModeConfigured:
      (process.env.MONDIAL_RELAY_COLLECTION_MODE || "").trim() === "CCC",
  };
}

export function getMondialRelayProductionReadiness(
  settings: MondialRelaySettings,
) {
  const credentials = getMondialRelayProductionCredentialStatus();
  const modernService =
    settings.serviceCode === "24R/MED" ||
    settings.serviceCode === "24R/APM";
  const parcel = settings.contractParcel;
  const parcelConfigured = Boolean(
    parcel.weightGrams &&
      parcel.lengthCm &&
      parcel.widthCm &&
      parcel.depthCm &&
      parcel.itemsPerParcel,
  );
  const rateConfigured = settings.contractRates.some(
    (rate) =>
      rate.serviceCode === settings.serviceCode && rate.priceCents > 0,
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
  return {
    ...credentials,
    modernService,
    parcelConfigured,
    rateConfigured,
    api1Ready,
    api2Ready,
    searchEnabled:
      process.env.REAL_SHIPPING_ENABLED === "true" &&
      api1Ready &&
      modernService &&
      parcelConfigured &&
      rateConfigured,
    shipmentCreationEnabled:
      process.env.REAL_SHIPMENT_CREATION_ENABLED === "true" &&
      api2Ready &&
      modernService &&
      parcelConfigured &&
      rateConfigured &&
      credentials.senderConfigured &&
      credentials.collectionModeConfigured,
    checkoutShippingReady:
      process.env.REAL_SHIPPING_ENABLED === "true" &&
      api1Ready &&
      api2Ready &&
      modernService &&
      parcelConfigured &&
      rateConfigured &&
      credentials.senderConfigured &&
      credentials.collectionModeConfigured,
  };
}
