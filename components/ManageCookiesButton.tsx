"use client";

import { openCookiePreferences } from "@/lib/privacyConsent";

export default function ManageCookiesButton({
  className,
}: {
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className || "manage-cookie-preferences"}
      onClick={openCookiePreferences}
    >
      Gérer mes cookies
    </button>
  );
}
