# Maison Miroir — Site e-commerce luxe

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
├── category/[slug]/          → Plateaux / Panneaux
├── product/[id]/             → Page produit + commande
├── success/                  → Page de confirmation
├── api/send-email/           → API emails (Resend)
components/
├── Navbar.tsx
├── Footer.tsx
lib/
├── products.ts               → Données produits (à enrichir)
public/images/                → Tes vraies photos de produits
```

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
4. Vérifie ton domaine d'envoi (ou utilise onboarding@resend.dev en test)

### Email propriétaire
- Modifie `OWNER_EMAIL` avec ton adresse professionnelle

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
