export type OptionChoice =
  | string
  | {
      value: string
      label: string
      priceDelta?: number
      priceOverride?: number
    }

export type ProductOptions = Record<string, OptionChoice[]>

export interface Product {
  id: string;
  name: string;
  category: 'sacs' | 'welcome' | 'gourmandises' | 'rituels' | 'certificats';
  categoryLabel: string;
  price: number;
  originalPrice?: number;
  images: string[];
  description: string;
  features: string[];
  customFields: string[];
  options?: ProductOptions;
}

export const products: Product[] = [
  {
    id: 'tote-bag-premium',
    name: 'Tote Bag Premium',
    category: 'sacs',
    categoryLabel: 'Sacs personnalisés',
    price: 35,
    images: ['/images/tote-bag-premium1.png', '/images/tote-bag-premium2.jpg'],
    description:
      'Sac en jute personnalisable – 35 x 32 cm. Élégant et pratique, idéal pour les entreprises, marques et créateurs de contenu souhaitant mettre en avant leur identité visuelle. Personnalisable avec votre logo, texte ou design selon votre demande.',
    features: [
      'Dimensions : 35 x 32 cm',
      'Matière : toile de jute',
      'Personnalisation : logo / texte / design',
    ],
    customFields: [
      'Décrivez votre personnalisation (emplacement, texte, couleurs, style, etc.)',
    ],
    options: {
      artworkFile: [
        { value: 'upload', label: 'Importer un fichier (PDF / PNG)' },
      ],
    },
  },
  {
    id: 'collection-signature',
    name: 'Collection Signature',
    category: 'sacs',
    categoryLabel: 'Sacs personnalisés',
    price: 25,
    images: ['/images/collection-signature.jpg', '/images/collection-signature2.jpg', '/images/collection-signature3.jpg'],
    description:
      'Sac en jute personnalisé en vinyle thermocollant – 22 x 32 cm. Élégant et tendance, avec une finition soignée et moderne. Personnalisation possible avec une initiale + prénom, uniquement le prénom, ou une petite phrase selon vos envies.',
    features: [
      'Dimensions : 22 x 32 cm',
      'Matière : toile de jute',
      'Personnalisation : vinyle thermocollant',
    ],
    customFields: [
      'Prénom / texte',
      'Détails supplémentaires (police, emplacement, style particulier, etc.)',
    ],
    options: {
      textColor: ['noir', 'doré', 'doré pailleté'],
      style: ['initiale + prénom', 'prénom seul', 'phrase'],
    },
  },
  {
    id: 'welcome-signature',
    name: 'Welcome Signature',
    category: 'welcome',
    categoryLabel: 'Panneaux & welcome',
    price: 45,
    images: ['/images/welcome-signature.jpg', '/images/welcome-signature2.jpg'],
    description:
      'Panneau de bienvenue personnalisé en plexiglas givré. Forme arrondie en haut, finition moderne et épurée — idéal pour mariages, fiançailles, anniversaires et autres événements. Personnalisation réalisée en vinyle, avec plusieurs couleurs d’écriture disponibles.',
    features: [
      'Matière : plexiglas givré',
      'Finition : haut arrondi / bas plat',
      'Personnalisation : vinyle',
    ],
    customFields: [
      'Texte personnalisé',
      'Style souhaité (élégant, minimaliste, moderne, calligraphie, etc.)',
      'Détails supplémentaires (date, disposition, police, éléments, etc.)',
    ],
    options: {
      textColor: ['doré', 'noir', 'blanc'],
    },
  },
  {
    id: 'delices-du-mariage',
    name: 'Les Délices du Mariage',
    category: 'gourmandises',
    categoryLabel: 'Gourmandises personnalisées',
    price: 2.8,
    images: ['/images/delices-mariage.jpg', '/images/delices-mariage2.jpg', '/images/delices-mariage3.jpg'],
    description:
      'Chocolats personnalisés mariage. Une attention délicate et unique qui sublimera votre décoration de table et laissera un joli souvenir à vos proches. Personnalisation possible avec les prénoms des mariés ainsi que la date de l’événement.',
    features: [
      'Personnalisation : sticker / étiquette',
      'Style : élégant, raffiné et moderne',
      'Occasion : mariage',
    ],
    customFields: [
      'Prénoms des mariés',
      'Date du mariage',
      'Thème / couleurs',
      'Détails supplémentaires (police, symbole, etc.)',
    ],
    options: {
      model: [
        { value: 'modele-1', label: 'Modèle 1', priceOverride: 2.8 },
        { value: 'modele-2', label: 'Modèle 2', priceOverride: 2.99 },
      ],
    },
  },
  {
    id: 'douceurs-prestige',
    name: 'Les Douceurs Prestige',
    category: 'gourmandises',
    categoryLabel: 'Gourmandises personnalisées',
    price: 2.9,
    images: ['/images/douceurs-prestige.jpg', '/images/douceurs-prestige2.jpg', '/images/douceurs-prestige3.jpg'],
    description:
      'Dragées personnalisées mariage. Présentées avec soin, elles sublimeront votre décoration de table tout en offrant un souvenir délicat et mémorable à vos proches. Personnalisation possible avec les prénoms des mariés ainsi que la date de l’événement.',
    features: [
      'Personnalisation : étiquette / sticker',
      'Style : élégant, raffiné et moderne',
      'Occasion : mariage',
    ],
    customFields: [
      'Prénoms des mariés',
      'Date du mariage',
      'Thème / couleurs',
      'Détails supplémentaires (police, symbole, etc.)',
    ],
  },
  {
    id: 'rituel-de-henne',
    name: 'Rituel de Henné',
    category: 'rituels',
    categoryLabel: 'Rituels & cadeaux invités',
    price: 2.9,
    images: ['/images/rituel-henne.jpg', '/images/rituel-henne2.jpg', '/images/rituel-henne3.jpg'],
    description:
      'Rituel de Henné – Cadeaux invités personnalisés. Une collection inspirée du rituel du henné, pensée pour sublimer vos cérémonies et offrir un souvenir unique et raffiné. Personnalisation possible selon le modèle choisi (texte, prénom, design, couleur).',
    features: [
      'Occasion : fête du henné, mariage, fiançailles',
      'Personnalisation : texte / prénom / design / couleurs',
    ],
    customFields: [
      'Prénoms / texte',
      'Date de l’événement',
      'Couleurs / thème',
      'Détails supplémentaires (style, police, disposition, etc.)',
    ],
    options: {
      model: [
        { value: 'carte-cadeau', label: 'Carte cadeau henné personnalisée', priceOverride: 2.7 },
        { value: 'chocolats', label: 'Chocolats personnalisés', priceOverride: 2.9 },
        { value: 'fiole-poudre', label: 'Fiole de poudre de henné naturelle', priceOverride: 2.9 },
        { value: 'fiole-roses', label: 'Fiole de roses séchées', priceOverride: 2.9 },
      ],
    },
  },
  {
    id: 'ruban-elegance',
    name: 'Ruban Élégance',
    category: 'rituels',
    categoryLabel: 'Rituels & cadeaux invités',
    price: 15,
    images: ['/images/ruban-elegance.jpg', '/images/ruban-elegance2.jpg'],
    description:
      'Rubans personnalisés – Bouquet de la mariée. Apportez une touche élégante et unique au bouquet avec des rubans délicats et raffinés. Personnalisation possible avec prénom, date ou petit texte selon vos envies.',
    features: [
      'Idéal pour mariage, fiançailles et cérémonies élégantes',
      'Personnalisation : prénom / date / petit texte',
      'Couleurs d’écriture : noir ou doré',
    ],
    customFields: [
      'Texte à personnaliser',
      'Style souhaité (élégant, minimaliste, calligraphie, moderne, etc.)',
      'Détails supplémentaires (disposition du texte, longueur du ruban, police, etc.)',
    ],
    options: {
      textColor: ['noir', 'doré'],
    },
  },
  {
    id: 'certificat-mariage-religieux',
    name: 'Certificat de Mariage Religieux',
    category: 'certificats',
    categoryLabel: 'Certificats',
    price: 15,
    images: ['/images/certificat-mariage.jpg', '/images/certificat-mariage2.jpg', '/images/certificat-mariage3.jpg'],
    description:
      'Certificat de mariage religieux – Certificat d’Union Sacrée. Une touche symbolique, élégante et spirituelle à votre union. Personnalisation possible avec les prénoms des mariés, la date du mariage et le modèle souhaité.',
    features: [
      'Souvenir unique et raffiné',
      'Occasion : mariage religieux',
      'Modèles au choix',
    ],
    customFields: [
      'Prénoms des mariés',
      'Date du mariage',
      'Lieu du mariage',
      'Citation / texte souhaité',
      'Détails supplémentaires (couleurs, style, police, mise en page, etc.)',
    ],
    options: {
      model: ['modèle 1', 'modèle 2', 'modèle 3'],
    },
  },
  {
    id: 'aid-al-adha-chocolats',
    name: 'Collection Aïd al-Adha Chocolats',
    category: 'gourmandises',
    categoryLabel: 'Gourmandises personnalisées',
    price: 2.9,
    images: ['/images/aid-chocolats.jpg', '/images/aid-chocolats2.jpg'],
    description:
      'Pour célébrer l’Aïd al-Adha avec élégance et douceur, découvrez une collection de chocolats personnalisés conçus pour vos invités. Une attention unique, raffinée et pleine de sens, personnalisée selon vos envies.',
    features: [
      'Deux modèles au choix',
      'Personnalisation selon vos envies',
      'Idéal pour vos invités',
    ],
    customFields: [
      'Message personnalisé',
      'Détails supplémentaires (style, police, disposition, etc.)',
    ],
    options: {
      model: ['modèle 1', 'modèle 2'],
    },
  },
];

export const categories = [
  {
    slug: 'sacs',
    label: 'Sacs personnalisés',
    description: 'Tote bags et sacs en jute personnalisés pour votre marque ou événement',
    image: '/images/tote-bag-premium2.jpg',
  },
  {
    slug: 'welcome',
    label: 'Panneaux & welcome',
    description: 'Panneaux de bienvenue élégants, modernes et sur mesure',
    image: '/images/welcome-signature.jpg',
  },
  {
    slug: 'gourmandises',
    label: 'Gourmandises personnalisées',
    description: 'Chocolats, dragées et attentions raffinées pour vos invités',
    image: '/images/delices-mariage.jpg',
  },
  {
    slug: 'rituels',
    label: 'Rituels & cadeaux invités',
    description: 'Cadeaux invités inspirés du rituel du henné, personnalisables',
    image: '/images/rituel-henne.jpg',
  },
  {
    slug: 'certificats',
    label: 'Certificats',
    description: 'Certificats religieux personnalisés, élégants et symboliques',
    image: '/images/certificat-mariage.jpg',
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter((p) => p.category === category);
}
