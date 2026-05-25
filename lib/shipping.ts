export type ShippingMethod = {
  id: string
  label: string
  shortLabel: string
  carrier: 'Mondial Relay' | 'Chronopost' | 'Colissimo'
  price: number
  estimatedDelay: string
  trackingBaseUrl: string
}

export const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: 'mondial-relay-point-relais',
    label: 'Mondial Relay - Point Relais',
    shortLabel: 'Mondial Relay - Point Relais',
    carrier: 'Mondial Relay',
    price: 4.1,
    estimatedDelay: '2 a 5 jours ouvres',
    trackingBaseUrl: 'https://www.mondialrelay.fr/suivi-de-colis/',
  },
  {
    id: 'mondial-relay-domicile',
    label: 'Mondial Relay - Domicile',
    shortLabel: 'Mondial Relay - Domicile',
    carrier: 'Mondial Relay',
    price: 7.5,
    estimatedDelay: '2 a 4 jours ouvres',
    trackingBaseUrl: 'https://www.mondialrelay.fr/suivi-de-colis/',
  },
  {
    id: 'chronopost-relais',
    label: 'Chronopost - Relais',
    shortLabel: 'Chronopost Relais',
    carrier: 'Chronopost',
    price: 4.5,
    estimatedDelay: '24h a 72h',
    trackingBaseUrl: 'https://www.chronopost.fr/tracking-no-cms/suivi-page',
  },
  {
    id: 'chronopost-express',
    label: 'Chronopost Express - Livraison rapide',
    shortLabel: 'Chronopost Express - Livraison rapide',
    carrier: 'Chronopost',
    price: 16,
    estimatedDelay: '24h a 48h selon zone',
    trackingBaseUrl: 'https://www.chronopost.fr/tracking-no-cms/suivi-page',
  },
  {
    id: 'colissimo-standard',
    label: 'Colissimo - Livraison standard',
    shortLabel: 'Colissimo - Livraison standard',
    carrier: 'Colissimo',
    price: 7.9,
    estimatedDelay: '2 a 3 jours ouvres',
    trackingBaseUrl: 'https://www.laposte.fr/outils/suivre-vos-envois',
  },
]

export function getShippingMethodById(id: string) {
  return SHIPPING_METHODS.find((method) => method.id === id) ?? null
}

export function formatEuro(value: number): string {
  return `${value.toFixed(2)} EUR`
}
