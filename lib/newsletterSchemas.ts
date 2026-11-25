import { z } from "zod";
export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254).email(),
    consent: z.literal(true),
    website: z.string().max(200).optional(),
  })
  .strict();
const url = z
  .union([
    z.literal(""),
    z
      .string()
      .url()
      .max(2048)
      .refine(
        (value) =>
          new URL(value).protocol === "https:" &&
          !new URL(value).username &&
          !new URL(value).password,
      ),
  ])
  .optional();
const fields = {
  title: z.string().trim().min(1).max(200),
  subject: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => !/[\r\n]/.test(value)),
  preheader: z.string().trim().max(250).optional().default(""),
  body: z.string().trim().min(1).max(12000),
  imageUrl: url,
  linkUrl: url,
  promoCode: z.string().max(80).optional(),
  endsAt: z.union([z.literal(""), z.string().date()]).optional(),
  productIds: z.array(z.string().max(100)).max(30).default([]),
};
export const campaignSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      id: z.literal("").optional(),
      ...fields,
    })
    .strict(),
  z
    .object({ action: z.literal("update"), id: z.string().uuid(), ...fields })
    .strict(),
  z
    .object({
      action: z.literal("approve"),
      id: z.string().uuid(),
      scheduledAt: z.string().datetime().optional(),
    })
    .strict(),
  z.object({ action: z.literal("preview"), id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("duplicate"), id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("send-test"), id: z.string().uuid() }).strict(),
]);
export const orderPatchSchema = z
  .object({
    status: z
      .enum([
        "En attente",
        "Payee",
        "En preparation",
        "Prete a expedier",
        "Deposee chez Mondial Relay",
        "En transit",
        "Disponible en Point Relais",
        "Expediee",
        "Livree",
        "Retournee",
        "Annulee",
      ])
      .optional(),
    trackingNumber: z
      .string()
      .trim()
      .max(100)
      .regex(/^[A-Za-z0-9 -]*$/)
      .optional(),
    returnStatus: z
      .enum(["requested", "accepted", "awaiting_receipt", "received"])
      .optional(),
  })
  .strict()
  .refine((v) => Boolean(v.status || v.trackingNumber || v.returnStatus));
