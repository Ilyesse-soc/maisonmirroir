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

`lib/shipping.ts` expose uniquement le Point Relais Mondial Relay. Aucun tarif fixe ou transporteur non configuré n'est proposé. `/admin/settings` permet de saisir le service contractuel 24R/MED ou 24R/APM, le profil colis emballé et la grille tarifaire confirmée. Un prix manquant ou égal à zéro ne génère pas de devis. Les anciennes données de test ne servent jamais au calcul d'une commande.

La recherche API1 appelle uniquement la production lorsque les identifiants, le service, le profil et les garde-fous sont prêts. Un statut fournisseur invalide produit une erreur explicite; aucun point fictif n'est renvoyé. Le choix de relais est signé côté serveur, lié au service choisi et expire après six heures.

Le checkout demande au serveur de recalculer les produits et le tarif avant de créer une commande PayPal. Le serveur vérifie de nouveau le même montant après capture. Une commande payée ne crée pas automatiquement d'expédition. Un administrateur peut confirmer explicitement la création API2 depuis `/admin/orders`; la réservation atomique et les états incertains empêchent les doubles expéditions. L'étiquette PDF est téléchargée par une route protégée et le suivi API1 est actualisé au plus une fois toutes les six heures.

Le contrôle de disponibilité requiert la confirmation du contrat, les accès API1 et API2 de production, le service et tarif réels, le profil colis, les coordonnées de l'expéditeur, le mode de collecte `CCC`, PayPal production et tous les drapeaux commerciaux. `SHOP_OPEN`, `REAL_PAYMENTS_ENABLED`, `REAL_SHIPPING_ENABLED`, `REAL_SHIPMENT_CREATION_ENABLED`, `MONDIAL_RELAY_API1_PROD_ENABLED`, `MONDIAL_RELAY_API2_PROD_ENABLED` et `MONDIAL_RELAY_PRODUCTION_CONFIRMED` restent à `false` jusqu'à confirmation métier. Aucun paiement, commande ou envoi réel n'a été exécuté pour valider cette implémentation.

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
- `/admin/settings` : coordonnées et textes de marque, configuration Mondial Relay et saisie des profils de colis et tarifs contractuels. Les secrets ne sont jamais affichés.
- `/admin/orders` : gestion des commandes, création explicite des expéditions, téléchargement protégé des étiquettes et actualisation limitée du suivi.

La migration additive `migrations/006_admin_console.sql` ajoute le pré-en-tête des campagnes, le calendrier et les paramètres éditables sans supprimer de données existantes. Les taux d'ouverture et de clic restent indiqués comme indisponibles lorsque le suivi n'existe pas. Une campagne ne peut être approuvée que par une action explicite et seulement si `SHOP_OPEN=true`; ne pas activer ce paramètre avant validation métier. `NEWSLETTER_AUTO_PUBLISH` reste indépendant et doit demeurer désactivé tant qu'une publication automatique n'est pas souhaitée.

La migration additive `migrations/007_mondial_relay_settings.sql` crée uniquement la table de configuration de livraison. Les identifiants Mondial Relay et PayPal ne doivent jamais être saisis dans l'administration ou versionnés. Les valeurs privées sont à configurer dans `ops/secrets/app.env` sur le VPS. Le modèle complet, avec les drapeaux désactivés et des marqueurs de remplacement, se trouve dans `ops/secrets/app.env.example`.

Variables serveur Mondial Relay : `MONDIAL_RELAY_PRODUCTION_CONFIRMED`, `MONDIAL_RELAY_API1_PROD_SHOP`, `MONDIAL_RELAY_API1_PROD_PRIVATE_KEY`, `MONDIAL_RELAY_API1_PROD_ENABLED`, `MONDIAL_RELAY_API2_PROD_LOGIN`, `MONDIAL_RELAY_API2_PROD_PASSWORD`, `MONDIAL_RELAY_API2_PROD_CUSTOMER_ID`, `MONDIAL_RELAY_API2_PROD_URL`, `MONDIAL_RELAY_API2_PROD_ENABLED`, `MONDIAL_RELAY_COLLECTION_MODE`, `MONDIAL_RELAY_SENDER_FIRSTNAME`, `MONDIAL_RELAY_SENDER_LASTNAME`, `MONDIAL_RELAY_SENDER_STREET`, `MONDIAL_RELAY_SENDER_HOUSE_NO`, `MONDIAL_RELAY_SENDER_POSTCODE`, `MONDIAL_RELAY_SENDER_CITY`, `MONDIAL_RELAY_SENDER_COUNTRY`, `MONDIAL_RELAY_SENDER_PHONE` et `MONDIAL_RELAY_SENDER_EMAIL`.

Variables serveur PayPal : `PAYPAL_ENV=production`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID` et `PAYPAL_WEBHOOK_ID`. Ne pas configurer le Client ID dans une variable `NEXT_PUBLIC_*`.

Les tests admin isolés sont inclus dans `npm test`; ils utilisent PostgreSQL embarqué, une authentification mockée et un fournisseur Gemini simulé. Aucun email ni campagne réel n'est envoyé.

Pour activer Miroir AI, renseigner `GEMINI_API_KEY` uniquement dans l'environnement serveur protégé (`ops/secrets/app.env` sur OVH), après vérification des accès et quotas du compte Google. Avec `GROQ_API_KEY`, Groq prend automatiquement le relais après deux échecs transitoires de Gemini. `GEMINI_MODEL` vaut `gemini-3.8-flash` et `GROQ_MODEL` vaut `llama-3.3-70b-versatile` par défaut. Ne jamais transmettre de clé dans le navigateur, les issues, les journaux ou Git ; sans aucune clé, les autres fonctions admin continuent de marcher.

## 🔑 Configuration

### PayPal
Les identifiants doivent être placés côté serveur. Les commandes restent fermées jusqu'à la confirmation de l'application Live, du marchand, du webhook et des paramètres de livraison. Le navigateur reçoit le Client ID public uniquement lorsque tous les garde-fous de disponibilité sont activés.

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
