export type ShippingMethod = {
  id: string;
  label: string;
  shortLabel: string;
  carrier: "Mondial Relay";
  estimatedDelay: string;
  trackingBaseUrl: string;
};

export const MONDIAL_RELAY_POINT_RELAIS_ID = "mondial-relay-point-relais";
export const MONDIAL_RELAY_HOME_ID = "mondial-relay-home";

export const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: MONDIAL_RELAY_POINT_RELAIS_ID,
    label: "Mondial Relay - Point Relais",
    shortLabel: "Mondial Relay - Point Relais",
    carrier: "Mondial Relay",
    estimatedDelay:
      "3 à 5 jours ouvrés en moyenne après prise en charge par Mondial Relay",
    trackingBaseUrl: "https://www.mondialrelay.fr/suivi-de-colis/",
  },
  {
    id: MONDIAL_RELAY_HOME_ID,
    label: "Mondial Relay - Livraison à domicile",
    shortLabel: "Mondial Relay - Domicile",
    carrier: "Mondial Relay",
    estimatedDelay:
      "3 à 5 jours ouvrés en moyenne après prise en charge par Mondial Relay",
    trackingBaseUrl: "https://www.mondialrelay.fr/suivi-de-colis/",
  },
];

export function getShippingMethodById(id: string) {
  return SHIPPING_METHODS.find((method) => method.id === id) ?? null;
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function relaySearchErrorMessage(status: number): string {
  if (status === 400)
    return "Vérifiez votre code postal ou votre ville, puis réessayez.";
  if (status === 429)
    return "Trop de recherches ont été effectuées. Réessayez dans quelques minutes.";
  return "La recherche des Points Relais est momentanément indisponible. Réessayez plus tard.";
}
