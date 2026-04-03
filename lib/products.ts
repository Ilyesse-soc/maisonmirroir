export type ProductOptions = {
  boxColor?: string[]
  roseColor?: string[]
  decoration?: string[]
  handles?: string[]
  ringBoxes?: string[]
  size?: string[]
  textColor?: string[]
  ringHolder?: string[]
}

export interface Product {
  id: string;
  name: string;
  category: 'plateaux' | 'panneaux';
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
    id: 'plateau-satin-noir',
    name: 'Nuée élégance',
    category: 'plateaux',
    categoryLabel: 'Plateaux personnalisés',
    price: 35,
    originalPrice: 65,
    images: ['/images/tray-dark-2.jpg','/images/tray-dark.jpg'],
    description:
      'Un nuage organique, posé sur un drap satin chocolat, sublimé par une bougie ambrée et une rose blanche. Gravé à la main avec la basmala et vos initiales, il devient la pièce centrale de votre décoration de fiançailles ou de mariage.',
    features: [
      'Miroir organique forme unique',
      'Gravure laser personnalisée',
      'Basmala et initiales incluses',
      'Finition dorée mate',
      'Livraison en boîte cadeau',
    ],
    customFields: ['Initiales (ex: A & C)', 'Date (ex: 04.04.2026)', 'Phrase personnalisée'],
    options: {
      textColor: ['doré', 'noir'],
      ringHolder: ['rond', 'hexagone'],
    },
  },
  {
    id: 'plateau-ceremonie-bordeaux',
    name: 'Reflet élégance',
    category: 'plateaux',
    categoryLabel: 'Plateaux personnalisés',
    price: 45,
    originalPrice: 75,
    images: ['/images/tray-ring.jpg'],
    description:
      'Plateau miroir rond, bordé de perles et de strass nacrés, accompagné d\'écrins velours bordeaux pour les alliances. Une composition raffinée avec roses artificielles et calligraphie dorée. Idéal pour la présentation des bagues lors de la cérémonie.',
    features: [
      'Miroir rond grand format',
      'Bordure perles et strass',
      'Basmala gravée',
      'Texte bilingue arabe / français',
      'Prénom des mariés et date gravés',
    ],
    customFields: ['Prénom mariée', 'Prénom marié', 'Date (ex: 04.04.2026)', 'Verset ou phrase'],
    options: {
      boxColor: ['rouge', 'blanc', 'beige'],
      roseColor: ['rouge', 'beige', 'blanc'],
      decoration: ['perles', 'diamants'],
      size: ['petit', 'grand'],
      textColor: ['blanc', 'doré', 'noir'],
    },
  },
  {
    id: 'plateau-reflet-purete',
    name: 'Reflet & Pureté',
    category: 'plateaux',
    categoryLabel: 'Plateaux personnalisés',
    price: 35,
    originalPrice: 40,
    images: ['/images/reflet-purete-1.jpg', '/images/reflet-purete-2.jpg'],
    description:
      'Plateau miroir rond au design épuré, sublimé par un contour délicat de strass et de perles transparentes. Accompagné d’écrins en velours ivoire pour les alliances, il offre une esthétique lumineuse et minimaliste. La calligraphie fine associée à la citation coranique apporte une touche spirituelle et intemporelle. Idéal pour une présentation élégante et symbolique des bagues lors de la cérémonie.',
    features: [
      'Miroir rond design épuré',
      'Contour strass & perles transparentes',
      'Écrins velours ivoire pour alliances',
      'Calligraphie fine + citation coranique',
      'Présentation élégante et symbolique',
    ],
    customFields: ['Prénom 1', 'Prénom 2', 'Date (ex: 09.05.2026)', 'Citation / verset (optionnel)'],
  },
  {
    id: 'plateau-elegance-nuptial',
    name: 'ÉLEGANCE NUPTIAL',
    category: 'plateaux',
    categoryLabel: 'Plateaux personnalisés',
    price: 50,
    originalPrice: 65,
    images: ['/images/elegance-nuptial-1.jpg', '/images/elegance-nuptial-2.jpg'],
    description:
      'Plateau miroir au style luxueux, rehaussé d’écrins géométriques dorés suspendus, garnis de roses rouges profondes pour accueillir les alliances. Le ruban en velours bordeaux apporte une touche noble et contrastée, tandis que les détails floraux et dorés créent une composition riche et élégante. Idéal pour une mise en scène romantique et sophistiquée lors de la cérémonie.',
    features: [
      'Plateau miroir style luxueux',
      'Écrins géométriques dorés suspendus',
      'Roses rouges pour alliances',
      'Ruban velours bordeaux',
      'Composition romantique & sophistiquée',
    ],
    customFields: ['Prénom 1', 'Prénom 2', 'Date (ex: 09.05.2026)', 'Verset ou phrase (optionnel)'],
    options: {
      decoration: ['perles', 'strass'],
      handles: ['avec poignets', 'sans poignets'],
      ringBoxes: ['hexagone doré sans roses', 'hexagone doré avec roses'],
    },
  },
  {
    id: 'panneau-acrylique-or-layla',
    name: 'Panneau Bienvenue Acrylique Or',
    category: 'panneaux',
    categoryLabel: 'Panneaux décoratifs',
    price: 149,
    images: ['/images/panel-layla.png'],
    description:
      'Panneau acrylique transparent avec éclats dorés, monté sur chevalet doré. La basmala en calligraphie arabe trône en haut, suivie du texte de bienvenue "Au Mariage de" et des prénoms en lettres script élégantes. Effet marbre et or de toute beauté.',
    features: [
      'Acrylique transparent haute qualité',
      'Éclats dorés effet geode',
      'Basmala dorée en calligraphie',
      'Prénoms en police script luxe',
      'Chevalet doré inclus',
    ],
    customFields: ['Prénom mariée', 'Prénom marié', 'Date de mariage'],
  },
  {
    id: 'panneau-acrylique-or-salma',
    name: 'Panneau Bienvenue Or & Blanc',
    category: 'panneaux',
    categoryLabel: 'Panneaux décoratifs',
    price: 149,
    images: ['/images/panel-salma.png'],
    description:
      'Même modèle signature, personnalisé à vos prénoms. Le panneau acrylique transparent avec dorures artistiques et basmala calligraphiée crée une entrée inoubliable pour votre mariage. Dimensions généreuses pour une visibilité parfaite.',
    features: [
      'Acrylique transparent 5mm',
      'Dorures or 24k appliquées à la main',
      'Texte entièrement personnalisable',
      'Chevalet doré inclus',
      'Expédition sécurisée',
    ],
    customFields: ['Prénom mariée', 'Prénom marié', 'Date de mariage', 'Texte d\'accueil (optionnel)'],
  },
];

export const categories = [
  {
    slug: 'plateaux',
    label: 'Plateaux personnalisés',
    description: 'Plateaux miroir gravés pour alliances et décoration de cérémonie',
    image: '/images/tray-ring.jpg',
  },
  {
    slug: 'panneaux',
    label: 'Panneaux décoratifs',
    description: 'Panneaux acrylique personnalisés pour accueillir vos invités',
    image: '/images/panel-layla.png',
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter((p) => p.category === category);
}
