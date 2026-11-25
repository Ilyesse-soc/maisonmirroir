import "server-only";
import { getMondialRelaySettings } from "@/lib/mondialRelaySettings";
import { securityEvent } from "@/lib/observability";

export async function getPublicPreparationDays(): Promise<number | null> {
  try {
    return (await getMondialRelaySettings()).preparationDays;
  } catch {
    securityEvent("PUBLIC_PREPARATION_DAYS_READ_FAILED");
    return null;
  }
}
