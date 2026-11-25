export const CGV_UPDATED_AT = "25 novembre 2026";

export function getCgvVersion(preparationDays: number): string {
  if (!Number.isInteger(preparationDays) || preparationDays < 1)
    throw new Error("INVALID_CGV_PREPARATION_DAYS");
  return `2026-11-25-prep-${preparationDays}bd`;
}
