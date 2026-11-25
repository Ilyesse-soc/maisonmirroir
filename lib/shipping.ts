export type ShippingMethod = {
  id: string;
  label: string;
  shortLabel: string;
  carrier: "Mondial Relay";
  estimatedDelay: string;
  trackingBaseUrl: string;
};

export const MONDIAL_RELAY_POINT_RELAIS_ID = "mondial-relay-point-relais";

export const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: MONDIAL_RELAY_POINT_RELAIS_ID,
    label: "Mondial Relay - Point Relais",
    shortLabel: "Mondial Relay - Point Relais",
    carrier: "Mondial Relay",
    estimatedDelay: "Délai indiqué par Mondial Relay après expédition",
    trackingBaseUrl: "https://www.mondialrelay.fr/suivi-de-colis/",
  },
];

export function getShippingMethodById(id: string) {
  return SHIPPING_METHODS.find((method) => method.id === id) ?? null;
}

export function formatEuro(value: number): string {
  return `${value.toFixed(2)} EUR`;
}
