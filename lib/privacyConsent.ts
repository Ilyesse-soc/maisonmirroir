export const PRIVACY_PREFERENCES_KEY = "mm:cookie-preferences:v1";
export const LEGACY_AUDIENCE_CONSENT_KEY = "mm-audience-consent-v1";
export const AUDIENCE_IDENTITY_KEY = "mm-audience-identity-v1";
export const COOKIE_PREFERENCES_EVENT = "mm:open-cookie-preferences";
export const CONSENT_CHANGED_EVENT = "mm-cookie-preferences-change";

export type PrivacyPreferences = {
  version: 1;
  essential: true;
  audience: boolean;
  savedAt: number;
  expiresAt: number;
};

function sixMonthsFrom(timestamp: number) {
  const date = new Date(timestamp);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + 6);
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  date.setDate(Math.min(day, lastDay));
  return date.getTime();
}

export function createPrivacyPreferences(
  audience: boolean,
  savedAt = Date.now(),
): PrivacyPreferences {
  return {
    version: 1,
    essential: true,
    audience,
    savedAt,
    expiresAt: sixMonthsFrom(savedAt),
  };
}

export function parsePrivacyPreferences(
  value: string | null,
  now = Date.now(),
): PrivacyPreferences | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PrivacyPreferences>;
    if (
      parsed.version !== 1 ||
      parsed.essential !== true ||
      typeof parsed.audience !== "boolean" ||
      !Number.isSafeInteger(parsed.savedAt) ||
      !Number.isSafeInteger(parsed.expiresAt) ||
      (parsed.expiresAt as number) <= now
    )
      return null;
    return parsed as PrivacyPreferences;
  } catch {
    return null;
  }
}

export function hasAudienceConsent() {
  if (typeof window === "undefined") return false;
  try {
    return (
      parsePrivacyPreferences(
        window.localStorage.getItem(PRIVACY_PREFERENCES_KEY),
      )?.audience === true
    );
  } catch {
    return false;
  }
}

export function openCookiePreferences() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT));
}
