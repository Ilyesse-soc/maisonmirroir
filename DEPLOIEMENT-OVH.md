# Maison Miroir - exploitation sur OVHcloud

Préparation du 15 novembre 2026. Cible désormais fournie : VPS-2 2027, 4 vCPU, 8 Go de RAM, 75 Go NVMe, Ubuntu 26.04 annoncé par OVH, Beauharnois Canada. Hôte `vps-5485bc25.vps.ovh.ca`, IPv4 `15.235.62.124`, IPv6 `2607:5300:205:200::8c95`. La résolution IPv4 a été vérifiée ; le système et les accès SSH restent à vérifier sur la machine. Aucun déploiement OVH, import de commandes ou changement DNS n'a encore été effectué. Ce guide remplace les instructions d'hébergement antérieures. Render et Vercel ne font pas partie de cette architecture.

## Budget et isolation

| Service permanent | Plafond RAM | Plafond CPU |
| --- | ---: | ---: |
| Next.js standalone, heap 640 Mio, pool SQL 3 | 1 024 Mio | 0,90 |
| PostgreSQL, 30 connexions maximum | 1 024 Mio | 0,60 |
| Worker séquentiel, lot de 5, pool SQL 2 | 256 Mio | 0,15 |
| Nginx HTTPS, non root | 128 Mio | 0,10 |
| Sauvegarde externe | 256 Mio | 0,15 |
| **Total permanent** | **2 688 Mio** | **1,90** |

Le budget initial compatible avec 4 Gio est conservé : environ 5 504 Mio restent disponibles sur une machine de 8 Gio pour Linux, le cache et les opérations ponctuelles. Le conteneur de migration est limité à 384 Mio et doit être lancé hors des sauvegardes. Ces plafonds constituent un budget vérifié dans Compose, pas une mesure de charge réelle. Ne pas compiler sur le VPS. Aucun Redis n'est nécessaire.

Seul Nginx publie TCP 80/443. PostgreSQL est sur un réseau Docker interne, sans port publié, avec TLS vérifié, rôles séparés et authentification SCRAM. L'application, le proxy et le worker sont non root, en lecture seule, sans capabilities. Les secrets restent dans `/opt/maison-miroir/ops/secrets`, jamais dans GitHub, les images ou les journaux. Les variables de conteneur sont accessibles à root : limiter strictement les accès root et Docker.

## Construction et accès

1. Relire la branche de préparation, puis exécuter `OVH production images` dans GitHub Actions. Le workflow vérifie les dépendances, construit les images sur GitHub et analyse application, sauvegarde et images de base avec Trivy. Il bloque sur HIGH/CRITICAL. Conserver les digests GHCR exacts. Le build et le scan des images doivent réussir avant tout déploiement.
2. Lorsque le VPS sera fourni, vérifier son identité et son empreinte SSH via la console OVH. Prévoir une clé Ed25519 opérateur et une seconde clé dédiée CI. Ne jamais publier leurs clés privées.
3. Copier les fichiers `ops` revus dans `/opt/maison-miroir/ops`. Depuis une session de secours conservée ouverte, lancer `bootstrap-vps.sh` avec sudo et `MM_ADMIN_PUBLIC_KEY_FILE` / `MM_DEPLOY_PUBLIC_KEY_FILE` pointant vers les clés **publiques**. Le script prépare le compte et conserve l'authentification SSH existante. Ouvrir ensuite une **nouvelle connexion SSH par clé comme mmadmin**, y exécuter `sudo --preserve-env=SSH_CONNECTION bash /opt/maison-miroir/ops/bootstrap-vps.sh --finalize-ssh`, vérifier une autre connexion, puis seulement fermer la session initiale. La finalisation refuse les sessions hors du nouveau compte. Les ports SSH configurés restent autorisés dans UFW. Docker Engine et Compose viennent du [dépôt APT officiel Docker](https://docs.docker.com/engine/install/ubuntu/), avec clé de signature vérifiée. Le script configure aussi fail2ban, NTP et mises à jour de sécurité. Vérifier le pare-feu réseau OVH et les options SSH effectives.
4. Exécuter `generate-secrets.sh` une seule fois. Il refuse de remplacer un jeu de secrets même partiel. Une reprise partielle exige une vérification manuelle, jamais une régénération des mots de passe d'une base existante.
5. Copier `.env.example` vers `.env` et renseigner les trois images par digest, le domaine et le contact ACME. Conserver `PROXY_TLS_MODE=staging`. Compléter `secrets/app.env` avec `ADMIN_EMAIL`, l'expéditeur Resend vérifié, sa clé et le secret du webhook. Laisser `SHOP_OPEN=false` et `NEWSLETTER_SEND_ENABLED=false` pendant toute la recette. Tout destinataire d'e-mail réel doit être explicitement autorisé avant recette ; aucune adresse de test n'a encore été autorisée.
   `GEMINI_API_KEY` et `GROQ_API_KEY` sont facultatives : sans aucune des deux, Miroir AI reste désactivé et les autres pages admin restent disponibles. Ajouter les clés uniquement à `secrets/app.env`, jamais dans `.env`, Git, le navigateur ou les journaux. Gemini (`gemini-3.8-flash`) est prioritaire ; après deux échecs transitoires (429, 500, 502, 503, 504 ou timeout), Groq (`llama-3.3-70b-versatile`) prend le relais lorsque `GROQ_API_KEY` est configurée. Vérifier les accès modèles et quotas des deux comptes avant activation.
6. Ajouter dans l'environnement GitHub `production` la clé privée CI `OVH_DEPLOY_KEY` et les variables `OVH_HOST`, `OVH_SSH_PORT`, `OVH_KNOWN_HOSTS` après vérification indépendante de l'empreinte. Configurer une validation humaine des releases. Le compte `mmdeploy` ne peut exécuter qu'une commande de déploiement par digest ; il n'a pas de shell libre ni d'accès au groupe Docker. L'authentification GHCR utilise le jeton éphémère du job, transmis via SSH, sans PAT permanent.

## Premier démarrage avant DNS

Depuis `ops`, en opérateur autorisé, télécharger les images vérifiées, puis :

```sh
docker compose --env-file .env up -d --wait postgres
docker compose --env-file .env run --rm migrate node migrate.mjs --init-admin
docker compose --env-file .env up -d --no-build --wait app worker proxy
```

Le premier téléchargement GHCR peut demander une connexion éphémère au registre si les packages sont privés. Ne pas utiliser de token en argument de commande. La recette initiale utilise un certificat auto-signé court, généré uniquement sur la machine ; tester avec une résolution locale vers l'IP du VPS et une confiance limitée à ce certificat récupéré par canal sûr. Aucune émission ACME publique n'est encore revendiquée.

Avant bascule, obtenir le certificat public pour l'apex et `www` avec Certbot et le [plugin DNS-01 OVH](https://certbot-dns-ovh.readthedocs.io/en/stable/). Cette méthode permet de tester HTTPS public sur le VPS avant de modifier les A/AAAA. Les identifiants API OVH doivent être fournis via un fichier root 0600, limités à la zone concernée et aux opérations nécessaires sur les enregistrements de challenge. Ne jamais toucher MX/SPF/DKIM/DMARC. L'émission écrit uniquement les TXT `_acme-challenge` puis les retire ; elle nécessite une autorisation préalable pour ces écritures DNS.

Après configuration privée des accès DNS et du contact ACME, utiliser `certbot certonly --dns-ovh --dns-ovh-credentials /root/.secrets/ovh.ini --cert-name maison-miroir.fr -d maison-miroir.fr -d www.maison-miroir.fr` avec les options de contact/acceptation adaptées. Le hook `install-certificate.sh` vérifie les deux noms, la validité et la correspondance clé/certificat, installe les fichiers lisibles uniquement par le proxy et recharge Nginx. Vérifier le timer Certbot et `certbot renew --dry-run` avant mise en service. Les certificats et identifiants de renouvellement doivent aussi être sauvegardés chiffrés hors VPS. Les anciens fichiers Caddy sont conservés comme référence et ne sont plus utilisés par Compose.

Le lien privé d'initialisation est écrit en mode 0600 dans `ops/bootstrap/admin-initialisation.url`, valable sept jours, et ne doit pas être copié dans les logs ou un ticket. L'ouvrir en privé pour définir le mot de passe propriétaire une seule fois. L'entrée habituelle est ensuite `/77774555474447777554555`. Le secret d'initialisation ne constitue pas le mot de passe. Après initialisation, le compte et les sessions restent dans PostgreSQL ; un redémarrage ou un rafraîchissement ne réinitialise rien.

## Sauvegarde source et import : arrêt obligatoire sans preuve

L'autorisation d'import est conditionnelle. À ce jour, aucune sauvegarde complète vérifiée de la source n'est disponible et aucun import n'a été lancé. Le JSON local vide et une simple réponse API ne prouvent pas l'exhaustivité de l'ancien site.

Obtenir une sauvegarde datée de la source faisant autorité et la restaurer dans un environnement isolé pour en vérifier le contenu. Conserver l'original chiffré hors du VPS et du dépôt, sa somme SHA-256, le nombre de commandes, clients, lignes/articles et les totaux. Ne jamais modifier la source. Préparer un export JSON conforme à `lib/orderTypes.ts` et un manifeste privé contenant `sha256`, `complete:true`, `backupVerified:true`, `sourceSystem`, `capturedAt`, `sourceCount`. Ces attestations doivent correspondre à une vérification réelle ; le programme ne peut pas prouver à lui seul la complétude d'une source externe.

L'importeur `import-orders.mjs` exige `IMPORT_SOURCE_FILE`, `IMPORT_MANIFEST_FILE`, `IMPORT_REPORT_FILE`, `IMPORT_DATABASE_URL`. Monter le répertoire privé de migration en lecture seule pour la source et prévoir un emplacement protégé en écriture pour le rapport. Utiliser le rôle migrateur et la CA PostgreSQL, jamais le rôle applicatif ni un port SQL public.

1. Initialiser le schéma dans `maison_miroir_import`, base dédiée isolée, en lançant le migrateur avec son URL adaptée. Exécuter l'importeur sans `--commit`. Il refuse toute autre base pour cette étape.
2. Vérifier le rapport, le SHA-256, les identifiants, les données clients, les articles et les montants. Rejouer sur cette base pour vérifier `inserted:0`, commandes inchangées. Les comparaisons portent sur les enregistrements complets, pas uniquement les compteurs.
3. Uniquement après réussite, cibler `maison_miroir`, fournir `IMPORT_STAGE_REPORT` et exécuter avec `--commit`. Rapports distincts obligatoires ; ne jamais écraser les preuves précédentes. L'importeur utilise une transaction, refuse les conflits, ne charge aucun module d'e-mail, de paiement ou de webhook et ne modifie jamais la source.
4. Placer le rapport final validé dans `ops/migration/final-report.json`. Toute différence ou absence de sauvegarde impose l'arrêt et une confirmation de la propriétaire.

## Sauvegardes externalisées et restauration

Fournir un stockage S3 externe au VPS, approuvé séparément s'il est payant. Renseigner `RESTIC_REPOSITORY` et les fichiers privés `s3_access_key`, `s3_secret_key` (UID 70, mode 0400). Conserver une copie hors VPS du mot de passe restic et du dossier de configuration chiffré ; les perdre empêcherait la restauration. Les sauvegardes SQL ne sauvegardent pas les clés, la configuration du serveur ou les médias hors base.

```sh
docker compose --env-file .env run --rm backup --init
docker compose --env-file .env run --rm backup --once
docker compose --env-file .env run --rm backup --check
docker compose --env-file .env --profile backup up -d backup
```

Dump SQL en flux, chiffré avant stockage externe, sans fichier SQL temporaire sur les 75 Go. Planification quotidienne après 03:15 UTC ; conservation 7 quotidiennes, 4 hebdomadaires, 6 mensuelles. Objectif RPO : 24 heures après vérification effective du service. `restic check` ne remplace pas une restauration SQL.

Exporter un snapshot avec `backup --export-latest`, le restaurer dans une base de récupération isolée et comparer commandes, articles, abonnements et configuration admin. Ne jamais restaurer une recette sur la production. Après réussite, enregistrer une preuve privée `ops/migration/restore-verified.json` contenant `passed:true`, `snapshot` et `verifiedAt`. Mesurer le temps de récupération pour définir le RTO ; il n'est pas encore mesuré.

## Recette puis bascule

Vérifier sur le VPS : santé de chaque service, certificat de staging, connexion propriétaire, persistance après redémarrage, protection des API, absence de port SQL public, comparaison de l'import, sauvegarde/restauration. Mesurer `docker stats`, mémoire disponible, charge et disque au repos et sous trafic représentatif. Refuser la bascule si OOM, swaps soutenus, erreurs ou marge mémoire insuffisante. Aucun test d'e-mail réel ni paiement réel n'est autorisé.

La propriétaire finalise ses mentions légales et sa politique de confidentialité avant ouverture. La réouverture de l'ancien tunnel de paiement nécessite en plus les identifiants serveur PayPal et la vérification marchande ; maintenir la boutique fermée jusque-là. Conserver la source et l'ancien hébergement, sans purge. En cas d'activité d'écriture sur l'ancien site après la sauvegarde, prévoir une fenêtre de gel ou un export différentiel vérifié avant bascule.

Après validation de toutes les preuves et du certificat public préémis, passer `PROXY_TLS_MODE=production`, puis basculer uniquement les A/AAAA/CNAME web nécessaires vers OVH. Vérifier apex et www, HTTPS public, renouvellement et redirections. Ne publier l'IPv6 qu'après test du service et du pare-feu IPv6. L'envoi newsletter ne sera activé explicitement qu'à cette étape (`NEWSLETTER_SEND_ENABLED=true`), avec configuration fournisseur vérifiée et sans campagne réelle non validée. Le préflight bloque la configuration production si les preuves d'import/restauration manquent. Conserver Vercel pour un retour DNS et les deux bases ; ne jamais écraser l'une avec l'autre.

Les releases ultérieures passent par le workflow manuel depuis `main`, avec digest préalablement vérifié. Le script conserve l'image précédente et tente un retour applicatif si les healthchecks échouent. Ce retour ne restaure pas la base : les migrations doivent rester compatibles avec l'image précédente. Un premier déploiement n'a pas encore d'image fonctionnelle de repli. Aucune commande `down -v` ou suppression des volumes ne fait partie des releases.

## Exploitation des 75 Go

Logs Docker : pilote `local`, 10 Mo × 3 par conteneur ; journald borné. Alertes après trois contrôles consécutifs : mémoire disponible < 400 Mio, disque libre < 20 %, charge sur cinq minutes > 3, service arrêté/OOM ou unhealthy, échecs d'envoi et de sauvegarde. Configurer le fichier privé `secrets/monitor.json` à partir de `monitor.json.example` et activer les alertes opérationnelles au moment de la mise en service. Aucun message de test n'est envoyé automatiquement.

Surveiller aussi depuis l'extérieur la disponibilité HTTPS et les sauvegardes : la supervision locale ne peut pas signaler une panne complète du VPS. Ce contrôle externe reste à choisir/configurer. Garder au maximum l'image courante et l'image précédente après vérification d'une release ; supprimer seulement les images identifiées comme inutiles, jamais les volumes. Maintenir au moins 15 Go libres, suivre la croissance de la base et des WAL, prévoir une extension avant saturation. Les données clientes ne sont pas purgées arbitrairement pour libérer du disque.

Mises à jour de sécurité OS automatiques ; redémarrage noyau planifié manuellement avec contrôle préalable. Dependabot propose les mises à jour npm et Docker, qui passent de nouveau les tests et scans avant release. Les alertes de ressources, la restauration externe, le renouvellement HTTPS et les redémarrages restent à vérifier sur la machine réelle.
