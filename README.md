# Maison Miroir - Site e-commerce luxe

Production préparée pour OVH VPS-2 2027 : Next.js 16 standalone, PostgreSQL, worker et Nginx via Docker Compose. Consulter [le guide OVH](DEPLOIEMENT-OVH.md) et [le rapport de sécurité](RAPPORT-SECURITE-OVH.md) avant toute migration. Les instructions historiques ci-dessous ne décrivent plus l'hébergement cible. Aucun changement DNS ni import définitif n'a été effectué.

Site Next.js 14 + Tailwind CSS pour une boutique de décoration de mariage personnalisée.

## 🚀 Installation

```bash
npm install
cp .env.local.example .env.local
# → Remplis les clés PayPal et Resend dans .env.local
npm run dev
```

Ouvre http://localhost:3000

## 📦 Structure

```
app/
├── page.tsx                  → Homepage
├── admin/                    → Administration protégée (dashboard, newsletter, commandes...)
├── category/[slug]/          → Pages catégories
├── product/[id]/             → Page produit + commande
├── success/                  → Page de confirmation
├── api/order/                → Validation commande + emails + sauvegarde
├── api/admin/orders/         → Liste commandes + MAJ statut/suivi
components/
├── Navbar.tsx
├── Footer.tsx
├── PayPalButton.tsx          → Paiement PayPal (totaux + livraison)
lib/
├── products.ts               → Données produits (à enrichir)
├── shipping.ts               → Modes de livraison centralises
├── orderTypes.ts             → Types commande/livraison
├── orderStore.ts             → Persistance locale des commandes
data/orders.json              → Base JSON des commandes
public/images/                → Tes vraies photos de produits
```

## Livraison

Les méthodes historiques restent définies dans `lib/shipping.ts`. Le tarif Mondial Relay de 4,10 EUR et le tarif domicile de 7,50 EUR qui figuraient dans ce fichier ne sont pas confirmés par le contrat et ne doivent pas être présentés comme officiels.

`/admin/settings` permet de configurer le code Point Relais 24R ou 24L, les grilles de test et les tarifs contractuels par poids. Les valeurs 0,5 kg, 45 x 40 x 5 cm et 4,10 EUR sont réservées à la simulation. Les tarifs contractuels et le profil d'emballage réel restent vides tant qu'ils ne sont pas confirmés.

La recherche de Points Relais utilise exclusivement les identifiants API1 de test lorsque l'option sandbox est activée. À défaut, elle renvoie un point fictif explicitement étiqueté comme simulation. Le choix du point est conservé dans le panier et sa valeur `location` est utilisée pour préparer `DeliveryMode.location`.

La recherche API1 contrôle le code de réponse `STAT`; un rejet fournisseur est affiché comme erreur et non comme recherche réussie vide. L’administration dispose d’une création d’étiquette API2 strictement sandbox, avec des coordonnées synthétiques et un verrou permanent enregistré dans l’audit admin pour empêcher une seconde tentative. Cette action est disponible seulement si `MONDIAL_RELAY_API2_TEST_ENABLED=true`; le endpoint est fixé au sandbox et n’accepte aucun identifiant de production. Les expéditions des commandes, les paiements et les envois réels restent désactivés. L’API2 ne fournit pas, dans l’intégration présente, de consultation du suivi; le suivi des commandes reste manuel.

Les paiements nécessitent à la fois `SHOP_OPEN=true` et `REAL_PAYMENTS_ENABLED=true`. Ce second verrou est absent par défaut et doit rester désactivé tant que l'ouverture n'a pas été explicitement autorisée.

## 🧾 Emails automatiques

API: app/api/order/route.ts

- Email vendeuse complet a la validation de commande
- Email confirmation client avec recapitulatif commande + livraison
- Objet vendeur: Nouvelle commande recue - #[NUMERO_COMMANDE]

API admin: app/api/admin/orders/[orderId]/route.ts

- Lors d'une mise a jour de statut ou numero de suivi, un email client de suivi est envoye automatiquement
- Le lien de suivi correspond au transporteur choisi

## 🛠️ Administration

L'espace existant est accessible après connexion à `/77774555474447777554555`, puis depuis `/admin`. Le layout protégé réunit :

- `/admin` : tableau de bord PostgreSQL, inscriptions sur 30 jours, activité récente et état réel du worker/envoi.
- `/admin/subscribers` : recherche, filtres, tri, pagination, historique du consentement, export CSV et effacement RGPD explicite.
- `/admin/newsletter` : brouillons, aperçu mobile/ordinateur, historique et validation manuelle des campagnes.
- `/admin/miroir-ai` : assistant Gemini côté serveur avec relais Groq optionnel, brouillons uniquement ; désactivé si aucune clé fournisseur n'est configurée.
- `/admin/calendar` : calendrier marketing et événements persistés.
- `/admin/settings` : coordonnées et textes de marque, configuration Mondial Relay, profils de colis et test de création d’étiquette API2 sandbox à usage unique. Les secrets ne sont jamais affichés.
- `/admin/orders` : gestion existante des commandes et du suivi.

La migration additive `migrations/006_admin_console.sql` ajoute le pré-en-tête des campagnes, le calendrier et les paramètres éditables sans supprimer de données existantes. Les taux d'ouverture et de clic restent indiqués comme indisponibles lorsque le suivi n'existe pas. Une campagne ne peut être approuvée que par une action explicite et seulement si `SHOP_OPEN=true`; ne pas activer ce paramètre avant validation métier. `NEWSLETTER_AUTO_PUBLISH` reste indépendant et doit demeurer désactivé tant qu'une publication automatique n'est pas souhaitée.

La migration additive `migrations/007_mondial_relay_settings.sql` crée uniquement la table de configuration de livraison. Le verrou du test API2 réutilise la table d’audit admin existante et n’ajoute aucune migration. Les identifiants Mondial Relay ne doivent jamais être saisis dans l'administration ou versionnés. Les secrets éventuels sont à configurer dans `ops/secrets/app.env` sur le VPS, avec des noms exclusivement réservés au test :

- `MONDIAL_RELAY_API1_TEST_SHOP`
- `MONDIAL_RELAY_API1_TEST_PRIVATE_KEY`
- `MONDIAL_RELAY_API1_TEST_ENABLED=false` par défaut
- `MONDIAL_RELAY_API2_TEST_LOGIN`
- `MONDIAL_RELAY_API2_TEST_PASSWORD`
- `MONDIAL_RELAY_API2_TEST_CUSTOMER_ID`
- `MONDIAL_RELAY_API2_TEST_ENABLED=false` par défaut

Les coordonnées expéditeur utilisées pour une future étiquette doivent également rester côté serveur (`MONDIAL_RELAY_SENDER_*`). Aucun identifiant de production n'est lu par l'application.

Les tests admin isolés sont inclus dans `npm test`; ils utilisent PostgreSQL embarqué, une authentification mockée et un fournisseur Gemini simulé. Aucun email ni campagne réel n'est envoyé.

Pour activer Miroir AI, renseigner `GEMINI_API_KEY` uniquement dans l'environnement serveur protégé (`ops/secrets/app.env` sur OVH), après vérification des accès et quotas du compte Google. Avec `GROQ_API_KEY`, Groq prend automatiquement le relais après deux échecs transitoires de Gemini. `GEMINI_MODEL` vaut `gemini-3.8-flash` et `GROQ_MODEL` vaut `llama-3.3-70b-versatile` par défaut. Ne jamais transmettre de clé dans le navigateur, les issues, les journaux ou Git ; sans aucune clé, les autres fonctions admin continuent de marcher.

## 🔑 Configuration

### PayPal
1. Va sur https://developer.paypal.com
2. Crée une app → récupère le **Client ID**
3. Colle dans `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
4. En production : utilise le **Live Client ID** (pas Sandbox)

### Resend (emails)
1. Crée un compte sur https://resend.com
2. Génère une **API Key**
3. Colle dans `RESEND_API_KEY`
4. Renseigne `EMAIL_FROM` avec une adresse d'envoi vérifiée sur ton domaine
5. Renseigne `EMAIL_ADMIN` avec l'adresse de la vendeuse / admin

### Email propriétaire
- `OWNER_EMAIL` sert de fallback si `EMAIL_FROM` ou `EMAIL_ADMIN` sont absents

## 🖼️ Ajouter des produits

Édite `lib/products.ts` :
- Ajoute tes images dans `public/images/`
- Crée un nouvel objet dans le tableau `products`

## 🛠️ Déploiement (Vercel)

```bash
npm install -g vercel
vercel
# → Ajoute tes variables d'env dans le dashboard Vercel
```

## 💅 Polices utilisées
- Cormorant Garamond (display/titres)
- Great Vibes (script/logo)
- Jost (body)
