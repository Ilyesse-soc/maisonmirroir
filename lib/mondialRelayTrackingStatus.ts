import type { OrderStatus } from "@/lib/orderTypes";

export function getMondialRelayOrderStatus(
  text: string,
): Extract<
  OrderStatus,
  | "Deposee chez Mondial Relay"
  | "En transit"
  | "Disponible en Point Relais"
  | "Livree"
  | "Retournee"
> | null {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/(retour a l'expediteur|retourne a l'expediteur|retour colis)/.test(normalized))
    return "Retournee";
  if (/(livre|livraison effectuee|colis remis au destinataire)/.test(normalized))
    return "Livree";
  if (
    /(?:disponible (?:au|en) point relais|mis a disposition au point relais)/.test(
      normalized,
    )
  )
    return "Disponible en Point Relais";
  if (/(en transit|acheminement|en cours de livraison)/.test(normalized))
    return "En transit";
  if (/(pris en charge|depose chez mondial relay|remis au transporteur)/.test(normalized))
    return "Deposee chez Mondial Relay";
  return null;
}
