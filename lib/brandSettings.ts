import "server-only";
import { database } from "./newsletterDb";

export function normalizeBrandText(value: string) {
  return value.replace(/\bMAISON MIROIRS?\b/gi, "MAISON MIROIR");
}

export const BRAND_SETTING_DEFAULTS = {
  brand_name: "MAISON MIROIR",
  contact_email: "contact@maison-miroir.fr",
  instagram_url: "",
  tiktok_url: "",
  welcome_copy:
    "Nous sommes ravies de vous compter parmi les premières à rejoindre notre communauté.\n\nUne nouvelle vision de la mode arrive bientôt, pensée pour les femmes qui souhaitent exprimer leur identité avec élégance et pudeur.\n\nVous serez informée en avant-première du lancement de notre première collection.",
  confirmation_copy:
    "Merci pour votre intérêt pour MAISON MIROIR.\n\nPour finaliser votre inscription et commencer à recevoir nos actualités, veuillez confirmer votre adresse e-mail.",
  launch_copy:
    "Notre première collection est désormais disponible.\n\nDécouvrez des pièces raffinées, modernes et pudiques, pensées pour vous accompagner avec élégance et intemporalité.",
  campaign_footer: "",
} as const;

export type BrandSettingKey = keyof typeof BRAND_SETTING_DEFAULTS;
export type BrandSettings = Record<BrandSettingKey, string>;

export async function getBrandSettings(): Promise<BrandSettings> {
  const result = await database().query(
    "SELECT key,value FROM mm_brand_settings",
  );
  const settings: BrandSettings = { ...BRAND_SETTING_DEFAULTS };
  for (const row of result.rows) {
    if (row.key in BRAND_SETTING_DEFAULTS)
      settings[row.key as BrandSettingKey] = normalizeBrandText(row.value);
  }
  return settings;
}

export async function getBrandCopy(): Promise<
  Pick<BrandSettings, "welcome_copy" | "confirmation_copy" | "launch_copy">
> {
  const settings = await getBrandSettings();
  return {
    welcome_copy: settings.welcome_copy,
    confirmation_copy: settings.confirmation_copy,
    launch_copy: settings.launch_copy,
  };
}
