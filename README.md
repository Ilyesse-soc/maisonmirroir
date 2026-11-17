# Maison Miroir — Site e-commerce luxe

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

## 🚚 Livraison (active sur tous les produits)

Les 5 modes sont centralises dans lib/shipping.ts et s'appliquent a toutes les pages produit (existantes et futures) via app/product/[id]/page.tsx.

Modes configures :
1. Mondial Relay - Point Relais - 4.10 EUR - 2 a 5 jours ouvres
2. Mondial Relay - Domicile - 7.50 EUR - 2 a 4 jours ouvres
3. Chronopost Relais - 4.50 EUR - 24h a 72h
4. Chronopost Express - Livraison rapide - 16.00 EUR - 24h a 48h selon zone
5. Colissimo - Livraison standard - 7.90 EUR - 2 a 3 jours ouvres

Le client doit selectionner un mode de livraison avant paiement. Le total TTC est recalcule instantanement.

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
- `/admin/miroir-ai` : assistant Gemini côté serveur avec relais Grok optionnel, brouillons uniquement ; désactivé si aucune clé fournisseur n'est configurée.
- `/admin/calendar` : calendrier marketing et événements persistés.
- `/admin/settings` : coordonnées et textes de marque non sensibles. Les secrets ne sont jamais affichés.
- `/admin/orders` : gestion existante des commandes et du suivi.

La migration additive `migrations/006_admin_console.sql` ajoute le pré-en-tête des campagnes, le calendrier et les paramètres éditables sans supprimer de données existantes. Les taux d'ouverture et de clic restent indiqués comme indisponibles lorsque le suivi n'existe pas. Une campagne ne peut être approuvée que par une action explicite et seulement si `SHOP_OPEN=true`; ne pas activer ce paramètre avant validation métier. `NEWSLETTER_AUTO_PUBLISH` reste indépendant et doit demeurer désactivé tant qu'une publication automatique n'est pas souhaitée.

Les tests admin isolés sont inclus dans `npm test`; ils utilisent PostgreSQL embarqué, une authentification mockée et un fournisseur Gemini simulé. Aucun email ni campagne réel n'est envoyé.

Pour activer Miroir AI, renseigner `GEMINI_API_KEY` uniquement dans l'environnement serveur protégé (`ops/secrets/app.env` sur OVH), après vérification des accès et quotas du compte Google. En configurant aussi `GROK_API_KEY`, Grok prend automatiquement le relais si Gemini échoue. `GEMINI_MODEL` vaut `gemini-2.5-flash` et `GROK_MODEL` vaut `grok-4.7` par défaut. Ne jamais transmettre de clé dans le navigateur, les issues, les journaux ou Git ; sans aucune clé, les autres fonctions admin continuent de marcher.

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
