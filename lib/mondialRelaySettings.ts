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
    serviceCode: z.enum(["24R", "24L"]),
    maxWeightGrams: z.number().int().min(1).max(30000),
    priceCents: z.number().int().min(0).max(100000),
  }).strict(),
).max(60);
const settingsSchema = z.object({
  serviceCode: z.enum(["24R", "24L"]),
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

export function getMondialRelayTestCredentialStatus() {
  return {
    api1:
      Boolean(process.env.MONDIAL_RELAY_API1_TEST_SHOP) &&
      Boolean(process.env.MONDIAL_RELAY_API1_TEST_PRIVATE_KEY),
    api2:
      Boolean(process.env.MONDIAL_RELAY_API2_TEST_LOGIN) &&
      Boolean(process.env.MONDIAL_RELAY_API2_TEST_PASSWORD) &&
      Boolean(process.env.MONDIAL_RELAY_API2_TEST_CUSTOMER_ID),
    api1SandboxEnabled:
      process.env.MONDIAL_RELAY_API1_TEST_ENABLED === "true",
    api2SandboxEnabled:
      process.env.MONDIAL_RELAY_API2_TEST_ENABLED === "true",
  };
}
