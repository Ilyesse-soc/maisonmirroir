# Maintenance de sécurité - Maison Miroir

État de cette mise en place : 21 novembre 2026. Cette documentation distingue la configuration du dépôt des faits vérifiés sur le VPS. Elle ne prétend pas qu'un contrôle local prouve l'état réel du serveur.

## Nginx : avis et action immédiate

La configuration source épinglait `nginx:stable-alpine-slim` au digest `sha256:e2355aa95529a7999dad94ddcb45a8768abf6fb0b204c93b1a3ffce477d7b893`. La consultation du manifeste officiel `library/nginx` a identifié ce digest comme Nginx **1.30.6**. Le flux d'avis officiel NGINX signale notamment :

- **CVE-2026-123634**, use-after-free pendant le traitement d'une réponse par le resolver, vulnérable jusqu'à 1.30.6 et corrigé en 1.30.7. Notre configuration utilise `resolver 127.0.0.11` et un backend dynamique.
- **CVE-2026-123007**, corruption mémoire dans le contrôle de flux HTTP/2, corrigée en 1.30.7. HTTP/2 n'est pas activé dans la configuration actuelle.
- Les avis récents comprennent aussi des défauts HTTP/3, TLS 1.3, mail et stream. HTTP/3, mail proxy et stream ne sont pas configurés ici ; TLS 1.3 est permis.

Le digest déclaré a été remplacé dans Compose et dans le scanner CI par celui de l'image officielle **Nginx 1.30.7 stable-alpine-slim** : `sha256:8c950211a641ec5b23f265450517001f6bcca533666120ebe36cb4cff3d00a55`. L'API Docker Hub officielle et le registre OCI donnent le même digest pour `stable-alpine-slim` et `1.30.7-alpine-slim`; le manifeste linux/amd64 déclare `NGINX_VERSION=1.30.7`. Le scan Trivy du nouveau digest et les tests de stack restent obligatoires avant publication.

Sources officielles consultées :

- [Avis de sécurité NGINX](https://nginx.org/en/security_advisories.html)
- [Releases NGINX](https://github.com/nginx/nginx/releases)
- [Image officielle NGINX sur Docker Hub](https://hub.docker.com/_/nginx)
- [CVE-2026-123634](https://www.cve.org/CVERecord?id=CVE-2026-123634)
- [CVE-2026-123007](https://www.cve.org/CVERecord?id=CVE-2026-123007)

**Limite de vérification production :** le VPS `15.235.62.124` a refusé la connexion SSH de contrôle (`Permission denied`). Le DNS public pointe vers cette IP et le site répond via Nginx, mais ni `docker inspect`, ni la version réellement en cours, ni les journaux ou fichiers système n'ont pu être lus. Le digest source 1.30.6 est donc un signal d'exposition, pas une preuve du conteneur actuellement déployé. Aucun IOC ne peut être confirmé ou écarté sans accès autorisé aux conteneurs, processus, journaux système et événements réseau. Ne pas annoncer une absence de compromission avant ces contrôles.

## Vérifications automatiques

### Fréquence

`.github/workflows/security-maintenance.yml` programme des déclencheurs UTC aux heures candidates `03,04,08,09,13,14,18,19,22,23`. Le job convertit l'heure effective vers `Europe/Paris` et ne réalise l'audit que dans les fenêtres de 30 minutes autour de **00 h, 05 h, 10 h, 15 h et 20 h**. Cette double planification couvre heure d'hiver et heure d'été sans supposer un décalage UTC fixe. GitHub Actions peut retarder ou omettre un déclenchement planifié ; un déclenchement manuel est disponible.

Chaque exécution active :

1. `npm ci`, `npm audit --audit-level=low`, lint, tests newsletter/admin/sécurité et TypeScript.
2. Build des images applicative, PostgreSQL et sauvegarde ; test de la stack isolée avec données synthétiques, sans envoi.
3. Trivy sur la configuration et les images, avec blocage HIGH/CRITICAL, base de vulnérabilités actualisée.
4. Contrôle public de l'API santé, HTTPS, HSTS, anti-sniff, anti-framing et échéance du certificat TLS (au moins 14 jours).

Le build Next.js est exécuté dans le Dockerfile applicatif. La stack de recette utilise son propre PostgreSQL et ne contacte ni les abonnées ni les fournisseurs d'e-mail.

### Sources de mises à jour et analyse

- **Dependabot** : PR quotidiennes séparées pour npm, GitHub Actions et les Dockerfiles/Compose (Node, PostgreSQL, Nginx et sauvegarde). Les alertes de sécurité natives GitHub doivent rester activées.
- **npm audit** : dépendances directes et transitives du lockfile.
- **Trivy** : CVE dans les images construites et bases, erreurs de configuration HIGH/CRITICAL.
- **CodeQL** : analyse JavaScript/TypeScript sur PR, push `main`, exécution hebdomadaire et déclenchement manuel.
- **Actions tierces** : épinglées par SHA complet ; Dependabot propose leur actualisation.

OSV Scanner n'est pas ajouté : les analyses de dépendances se recouvriraient avec npm audit, Dependabot et Trivy. Le dépôt ne doit pas introduire une nouvelle dépendance d'analyse sans besoin démontré.

Les notifications d'échec créent ou actualisent un ticket GitHub sans secret ni donnée client. Une release OVH réussie génère un ticket de notification avec le commit et le lien d'exécution. Dependabot publie ses alertes et PR de sécurité nativement.

### Fusion et déploiement automatiques limités

Le workflow `dependabot-safe-updates.yml` n'active l'auto-fusion que pour une mise à jour npm **patch SemVer**, provenant de Dependabot, ne modifiant que `package.json` et `package-lock.json`. Les changements majeurs, mineurs, images Docker, actions et fichiers hors de cette liste restent soumis à une revue humaine. Le workflow `verify` obligatoire doit réussir.

Seules ces PR npm patch reçoivent le marqueur `auto-deploy:patch`. Après leur fusion, le build/scanner d'image doit réussir sur `main`; la release vérifie l'identifiant du workflow, sa réussite, sa branche, le SHA de révision intégré à l'image et le digest GHCR. La procédure de release conserve la sauvegarde PostgreSQL avant migration et le rollback applicatif si les contrôles de santé échouent. Toute migration SQL doit rester indépendante des PR de dépendances.

Les images Docker, changements système, migrations, majors/minors npm et changements d'API ne sont jamais auto-fusionnés ou auto-déployés.

## Sauvegarde, données et retour arrière

Le chemin existant de release est [ops/release.sh](./ops/release.sh) :

1. Le préflight valide l'environnement et les preuves de sauvegarde/restauration requises.
2. L'image de sauvegarde vérifie une nouvelle sauvegarde PostgreSQL avant toute migration.
3. La migration additive s'exécute avant le remplacement des conteneurs.
4. Si les contrôles de santé échouent, l'image applicative précédente est restaurée ; les volumes ne sont pas supprimés.

Le rollback applicatif n'annule pas automatiquement une migration PostgreSQL. Pour une migration incompatible, arrêter la release et appliquer la procédure de restauration depuis le dépôt Restic vérifié, sur une instance isolée d'abord ; ne jamais supprimer ou réinitialiser le volume en production. Une restauration de base en production nécessite une décision humaine et une sauvegarde identifiée. Aucun secret, compte, abonnée, campagne ou commande ne doit être régénéré ou supprimé par l'automatisation.

## Couverture et limites de l'hôte et des fournisseurs

- Les versions Node/Next/React/TypeScript et SDK npm sont suivies par Dependabot, npm audit, build, tests et Trivy.
- Nginx, PostgreSQL, images Docker de l'application et de sauvegarde sont suivis par Dependabot et Trivy, avec digests immuables.
- TLS public est contrôlé à chaque vérification planifiée ; la configuration Nginx de reverse proxy est exercée par le test runtime isolé.
- Le script d'amorçage du VPS configure `unattended-upgrades`, mais l'installation effective, la version Ubuntu, Docker Engine/Compose et les journaux du VPS n'ont pas été vérifiés ici. La gateway SSH CI n'accepte que le déploiement restreint, pas de diagnostic hôte.
- Les versions de SDK Gemini, Groq, Resend et PayPal sont couvertes lorsqu'elles sont des dépendances npm. Le statut public d'un fournisseur ne prouve pas l'état des clés ou quotas du compte.
- Les dépréciations de modèles Gemini/Groq et les annonces privées de quota ne sont pas vérifiables sans appeler les API avec les clés stockées côté serveur. Aucune clé n'est copiée dans GitHub Actions. Tant qu'un contrôle sûr côté VPS ou endpoint officiel sans secret n'est pas disponible, ces dépréciations demandent une vérification humaine.

Pour terminer la vérification d'incident Nginx, un opérateur doit consulter en lecture seule sur le VPS l'image exacte du service `proxy`, `nginx -V`, l'état des conteneurs, `docker compose logs` expurgés, les journaux système et les indicateurs réseau. Les journaux ne doivent pas être copiés dans un ticket public. Si le digest actif est 1.30.6 ou antérieur, conserver les preuves avant rotation ; ne pas conclure à une compromission à partir de la seule version.
