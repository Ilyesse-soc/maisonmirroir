# Maison Miroir - livraison locale du 15 novembre 2026

## État réel

Refonte et infrastructure développées localement. Aucun déploiement, paiement ou envoi d'e-mail réel n'a été effectué. La newsletter n'est pas activée en production : PostgreSQL, migration, worker et configuration d'envoi restent à raccorder. L'API échoue explicitement si sa configuration manque, sans prétendre enregistrer une inscription.

Contrôle en lecture seule de l'environnement existant : clés Resend et adresses d'envoi présentes, sans affichage de leurs valeurs. Domaine `maison-miroir.fr` déclaré `verified` par Resend ; DKIM `resend._domainkey` et SPF `send` déclarés vérifiés. Le TXT racine contient `v=spf1 include:resend.com ~all`. La recherche `_dmarc.maison-miroir.fr` retourne `ENOTFOUND` : DMARC reste à configurer ou confirmer auprès du gestionnaire DNS. Les variables PostgreSQL, authentification admin, origine newsletter, worker et webhook newsletter sont absentes. Aucun secret ni DNS modifié.

La référence JPG fournie est utilisée uniquement pour cadrer la partie illustrée ; les titres, descriptions, formulaire, consentement et liens sont du HTML indépendant. Le cadrage conserve les inscriptions originales des sacs. La composition responsive reprend les couleurs, l'arche, les fleurs et les personnages. Les drapés de fond et détails textiles ne sont pas reproduits à l'identique : aucun fichier séparé de ces décors n'était disponible. L'illustration source reste un JPG de 424 Ko. Les polices Cormorant Garamond et Jost sont hébergées localement avec leurs licences OFL.

Le PDF final de la nouvelle identité n'a pas été identifié parmi les fichiers fournis. Les deux PDF présents décrivent l'ancien catalogue. Les textes et couleurs du brief ont donc été utilisés. Instagram et TikTok n'existent pas dans la configuration source : les emplacements indiquent « bientôt », sans lien inventé.

## Sauvegarde et préservation

- Tag Git `archive/pre-launch-2026-11-15`, commit `3b677340587209e982bfecf71b2de9dccac0138d`.
- Copies de l'ancien accueil et shell dans `archive/pre-launch/`, sans secrets ni données client.
- Catalogue, fiches, images produits, panier, checkout, PayPal, livraison, e-mails transactionnels et fichier des commandes conservés.
- Routes marchandes redirigées vers l'accueil tant que `SHOP_OPEN` n'est pas `true`.
- `/api/order` et `/success` conservées pour les commandes existantes. Aucune route de webhook de paiement n'a été trouvée dans le dépôt.
- Aucun changement à `.env.local`, aux identifiants, à OVH, Vercel ou aux DNS.
- Administration existante désormais protégée par Basic Auth et vérification dans les API serveur. Identifiant : `maison` ; mot de passe : `ADMIN_PASSWORD`. HTTPS et mot de passe long, aléatoire et unique nécessaires en production.

L'ancien stockage des commandes reste un JSON local, avec repli `/tmp` éphémère sur Vercel. Cette limite préexistante n'a pas été migrée : ne pas considérer les commandes comme durablement stockées sur Vercel sans un chantier dédié.

## Fonctions ajoutées

Formulaire accessible, validation navigateur et serveur, consentement non précoché, honeypot, limitation persistante par empreinte IP, protection contre les doubles clics, états d'attente, succès et erreur. Les demandes répétées n'exposent pas le statut d'une adresse.

PostgreSQL : abonnées et statuts, preuve de consentement horodatée/versionnée, campagnes, destinataires/tâches, tentatives et erreurs, événements fournisseur, désinscriptions, limites de requêtes. Jeton de confirmation aléatoire stocké sous forme d'empreinte, expiration 48 h, consommation à usage unique. L'ouverture du lien seule ne confirme pas l'abonnement : un POST évite une activation par un scanner de liens.

Consentement version `launch-marketing-v1-2026-11-15` : « J’accepte de recevoir les nouveautés, offres exclusives et annonces de Maison Miroir. Désinscription à tout moment. » Source `launch-form`. Empreinte IP salée ; pas de conservation d'une adresse IP brute. Derrière un proxy OVH, configurer l'écrasement fiable de `X-Forwarded-For` pour empêcher sa falsification.

Administration `/admin/newsletter` : création et modification de brouillons, titre, objet, texte, image HTTPS, produits du catalogue, promotion, fin d'offre, lien, prévisualisation isolée, validation, programmation, historique et compteurs acceptés/livrés/erreurs. Une campagne validée est figée. Les abonnées confirmées au moment de la validation constituent la liste initiale ; chaque statut est revérifié avant envoi. Les campagnes contenant des produits ne peuvent être validées tant que la boutique est fermée.

File durable : dix messages maximum par appel, réservation transactionnelle `FOR UPDATE SKIP LOCKED`, traitement individuel pour ne pas divulguer les destinataires, clés d'idempotence Resend, quatre tentatives avec reprise à cinq minutes. Une réservation abandonnée peut être reprise après cinq minutes. Les résultats inconnus dépassant 23 h passent en `review`, nécessitant une réconciliation manuelle avec Resend avant toute reprise. Le contenu des tâches est vidé après acceptation par le fournisseur. Aucun statut « livré » n'est déduit de la seule réponse d'envoi.

Webhook signé `/api/newsletter/webhook` : événements envoyés, livrés, échecs, rebonds et plaintes ; déduplication des événements, protection contre la régression d'état. Rebonds/plaintes suspendent l'adresse. Si un événement arrive avant la persistance de la réponse d'envoi, le webhook demande une reprise au fournisseur.

Désinscription par page de confirmation et par POST one-click (`List-Unsubscribe`). Les tâches non démarrées sont annulées ; un message déjà transmis au fournisseur ne peut pas être rappelé.

Publication produit : `lib/productPublication.ts` expose le hook idempotent à appeler après une publication effective `draft -> published` depuis l'éditeur. Il prépare une campagne contenant nom, image, prix, description et URL, dédupliquée par identifiant d'événement. Imports et modifications ne déclenchent rien. Le dépôt contient un catalogue TypeScript statique, sans service de publication : le raccordement à un futur éditeur reste à faire. L'option d'envoi automatique est désactivée par défaut.

Conservation : script de purge des inscriptions non confirmées après 30 jours et désinscriptions/suspensions après une durée configurable (730 jours proposés). Suppression des tâches et événements associés par cascade. La suppression ponctuelle à la demande s'effectue actuellement par une opération autorisée en base, pas par une interface dédiée.

## Configuration avant activation

Les nouvelles variables sont documentées dans `.env.local.example` ; aucune valeur secrète n'y figure.

| Variable | Usage |
| --- | --- |
| `ADMIN_PASSWORD` | Protection de toutes les pages/API admin, utilisateur `maison` |
| `SHOP_OPEN` | `false` pendant le lancement |
| `INSTAGRAM_URL`, `TIKTOK_URL` | URL officielles à fournir |
| `NEWSLETTER_DATABASE_URL` | Connexion PostgreSQL durable avec TLS et sauvegardes |
| `NEWSLETTER_SITE_URL` | Origine publique HTTPS réelle, également pour les métadonnées |
| `NEWSLETTER_HASH_SECRET` | Secret aléatoire pour les empreintes techniques |
| `NEWSLETTER_WORKER_SECRET` | Secret Bearer du worker |
| `RESEND_NEWSLETTER_WEBHOOK_SECRET` | Secret du nouveau webhook signé |
| `NEWSLETTER_RETENTION_DAYS` | Durée après désinscription/suspension, 730 proposée |
| `NEWSLETTER_AUTO_PUBLISH` | `false` ; activation explicite ultérieure |

Les variables d'envoi existantes `RESEND_API_KEY` et `EMAIL_FROM` sont réutilisées. Aucun deuxième fournisseur n'a été ajouté. Dépendances ajoutées : `pg` et ses types de développement.

1. Provisionner une base PostgreSQL ; utiliser une URL de connexion adaptée au pool côté hébergeur. Ne pas réutiliser un fichier `/tmp` pour les inscriptions.
2. Configurer les variables dans l'environnement cible sans modifier les secrets de paiement.
3. Appliquer le schéma : `node scripts/newsletter-migrate.cjs`. Les tables sont préfixées `mm_`.
4. Planifier un POST régulier vers `/api/newsletter/worker` avec `Authorization: Bearer <secret>`. Un appel/minute traite jusqu'à dix tâches ; ajuster la fréquence ou les workers aux limites contractuelles Resend. Ne pas rendre le secret public. Le bouton admin permet de traiter un lot manuellement.
5. Planifier `node scripts/newsletter-retention.cjs` quotidiennement sur un environnement ayant accès à la base.
6. Dans Resend, configurer le webhook HTTPS avec les événements `email.sent`, `email.delivered`, `email.failed`, `email.bounced`, `email.complained`. Vérifier domaine, SPF, DKIM, DMARC, quotas et désactivation du suivi non souhaité.
7. Compléter et valider les mentions légales et la confidentialité : identité légale, adresse, immatriculation, responsable de publication/traitement, hébergeur, conservation et transferts. Ne pas publier les mentions provisoires en l'état.
8. Fournir les URL sociales et le PDF final ; valider le rendu et les textes avec la cliente.
9. Tester avec une adresse de recette autorisée : inscription réelle, réception, activation, campagne test, webhook, désinscription et purge. Ces envois réels n'ont pas été autorisés ni effectués pendant cette intervention.

## Fichiers

Créés : `middleware.ts`, `components/NewsletterForm.tsx`, `app/launch.css`, `app/launch-fonts.css`, `app/admin/newsletter/page.tsx`, API admin newsletter (liste/création/validation/aperçu et traitement), API newsletter (inscription, confirmation, désinscription, worker, webhook), pages newsletter (confirmation/désinscription/résultat), pages confidentialité et mentions légales, `lib/adminAuth.ts`, `lib/newsletter.ts`, `lib/newsletterDb.ts`, `lib/productPublication.ts`, migration SQL, scripts de migration/purge/tests/téléchargement des polices, illustration et polices sous `public/launch/`, archive et ce rapport.

Modifiés : `app/page.tsx`, `app/layout.tsx`, `components/SiteShell.tsx`, `app/admin/page.tsx` (lien newsletter), les deux API admin commandes (authentification uniquement), `package.json`, `package-lock.json`, `.env.local.example`, `.gitignore`.

## Vérification et limites

- Build Next.js de production réussi et contrôle TypeScript réussi.
- Tests PostgreSQL embarqué isolé : migration, consentement, doublons, empreinte/expiration/usage unique des jetons, confirmation, campagne, échappement HTML, désinscription, acceptation fournisseur simulée et reprise avec clé d'idempotence constante. Les advisory locks sont neutralisés sur la connexion de test unique ; la concurrence entre plusieurs véritables connexions reste à tester sur PostgreSQL cible.
- Tests navigateur Chromium : largeurs 320, 390, 1024 et 1440 px, absence de débordement, illustration chargée, champs obligatoires, consentement, erreur et reprise, succès simulé et désactivation du formulaire, redirections marchandes, refus des API admin non authentifiées, validation serveur et erreur explicite sans configuration.
- Captures locales dans `.qa/launch-1024.png` et `.qa/launch-390.png`. Les messages de succès UI utilisent une interception de requête ; aucun e-mail réel n'a été envoyé.
- Recette de l'administration avec mot de passe temporaire injecté uniquement dans le processus de test : ouverture authentifiée, modification d'un brouillon, aperçu isolé et validation (API campagnes simulée). Une API réellement non configurée retourne 503 après authentification. Une demande non authentifiée avec en-tête de contournement du middleware retourne bien 401 grâce à la protection serveur.
- Le hook de publication a été testé sur PostgreSQL embarqué : brouillon créé, événement dédupliqué, imports/modifications/brouillons ignorés. La limitation persistante d'inscription a également été testée.
- Tests de domaine, livraison réelle, webhook signé de bout en bout, ordonnanceur de production et charge concurrente restent à réaliser dans l'environnement cible.
- L'audit npm a signalé 9 vulnérabilités dans les dépendances existantes (4 modérées, 4 élevées, 1 critique, dont Next.js 14). La correction complète proposée nécessite une migration majeure de Next.js ; elle n'a pas été appliquée automatiquement pour préserver les intégrations. Cette migration et sa recette sont nécessaires avant une mise en production présentée comme sécurisée.

Reproduire les tests : installer les outils de recette localement (`npm.cmd install --prefix .qa --no-package-lock @electric-sql/pglite playwright`), puis `node scripts/test-newsletter.cjs`. Pour le navigateur, démarrer le site sur le port 3000, installer Chromium via Playwright ou renseigner `QA_BROWSER_PATH`, puis lancer `node scripts/test-launch-browser.cjs`. `.qa/` est ignoré par Git.

Référence fournisseur : [idempotence Resend](https://www.resend.com/blog/engineering-idempotency-keys). Les identifiants stables évitent de confondre reprise technique et nouvelle demande d'envoi.
