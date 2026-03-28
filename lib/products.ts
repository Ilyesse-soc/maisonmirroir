export interface Product {
  id: string;
  name: string;
  category: 'plateaux' | 'panneaux';
  categoryLabel: string;
  price: number;
  images: string[];
  description: string;
  features: string[];
  customFields: string[];
}

export const products: Product[] = [
  {
    id: 'plateau-satin-noir',
    name: 'Nuée élégance',
    category: 'plateaux',
    categoryLabel: 'Plateaux personnalisés',
    price: 89,
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
  },
  {
    id: 'plateau-ceremonie-bordeaux',
    name: 'Reflet élégance',
    category: 'plateaux',
    categoryLabel: 'Plateaux personnalisés',
    price: 80,
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
