# État technique — 15 novembre 2026

## Résultat et périmètre

L'application et l'infrastructure sont préparées pour OVH VPS-2 2027. L'ancien site public n'a pas été remplacé. Aucun changement DNS, import définitif, paiement ou envoi d'e-mail réel n'a été réalisé. Ce rapport décrit les contrôles locaux ; il ne constitue pas une certification de sécurité ni une validation de charge du VPS.

Le VPS fourni est `vps-5485bc25.vps.ovh.ca`, IPv4 `15.235.62.124`, IPv6 `2607:5300:205:200::8c95`, 4 vCPU / 8 Go / 75 Go, Ubuntu 26.04 déclaré par OVH, région Beauharnois au Canada. La résolution IPv4 est confirmée. L'utilisateur et l'autorisation de clé SSH restent attendus : système installé, versions Docker, conteneurs et base sur ce serveur ne sont pas encore vérifiés. Aucun commit n'y a été déployé.

Les enregistrements publics web observés sont `maison-miroir.fr A 76.76.21.21` et `www CNAME cname.vercel-dns.com`. Cette observation ne remplace pas la sauvegarde complète de la zone OVH, obligatoire avant bascule. Aucun enregistrement de messagerie n'a été modifié.

Next.js a été migré de 14 vers 16.4.6 avec React/React DOM 19.3.1 et mise à jour des dépendances exposées. L'audit npm final recense zéro vulnérabilité, toutes sévérités confondues. Le contrôle npm et les scans Trivy des images sont obligatoires dans GitHub Actions avant livraison. Les dépendances d'outils isolées sous `.qa` ne sont pas embarquées dans l'image.

## Protections réalisées

- Connexion propriétaire par mot de passe, initialisation privée à usage unique, inscription publique désactivée, sessions SQL persistantes et cookies Secure/HttpOnly/SameSite strict, quotas de connexion et limitation du calcul simultané des mots de passe. Les API contrôlent elles-mêmes les permissions.
- CSP avec nonce en production, contrôle des origines et CSRF, validation stricte des entrées, lecture bornée des corps HTTP, absence de secrets dans le navigateur et journaux techniques sans données clients.
- Newsletter SQL durable : consentement explicite, confirmation, désinscription, campagnes avec approbation, destinataires séparés, déduplication, reprise des tâches et preuve de livraison par webhook signé. Les statistiques distinguent acceptation fournisseur et livraison ; pas de suivi d'ouverture ou de clic.
- Paniers persistants, consentement spécifique aux relances, attente de 48 heures, déduplication et annulation après commande. Le lien de relance mène au panier ; la reprise automatique sur un autre appareil reste à développer. Aucune promesse de reconstruction multiappareil n'est faite.
- Commandes stockées en PostgreSQL en production, identifiants uniques, prix recalculés côté serveur et vérification serveur du paiement PayPal avant création. Le tunnel reste fermé tant que les identifiants PayPal serveur et la vérification marchande manquent.
- Architecture Compose limitée en ressources, PostgreSQL privé avec TLS/SCRAM, images par digest, construction hors VPS, sauvegarde externe chiffrée, SSH par clé et déploiement CI restreint. Les secrets ne sont jamais committés.

## Contrôles exécutés

| Contrôle | Résultat local |
| --- | --- |
| Build Next.js standalone | Réussi |
| ESLint et TypeScript | Réussis |
| Tests newsletter et sécurité SQL isolés | Réussis, fournisseur simulé |
| Signatures webhook réelles du SDK | Signatures altérées/expirées rejetées, aucun appel fournisseur |
| Validation Docker Compose | Réussie, plafonds permanents 2 688 Mio |
| Construction des bundles worker/migrateur/importeur | Réussie |
| Recherche des secrets effectivement configurés | Aucun trouvé dans source publiable, statiques, standalone et historique Git disponible |
| Navigateur HTTPS local, base de recette isolée | Initialisation unique, login, session après rafraîchissement, logout, refus non autorisés/CSRF, limitation des tentatives vérifiés |
| Affichage 320/390/1024/1440 px | Pas de débordement horizontal dans la recette |

Dernière mesure de laboratoire locale : LCP 272 ms, CLS 0,029. Ce ne sont pas des mesures OVH ou des indicateurs terrain ; INP et comportement sous charge restent à mesurer. Le Docker daemon local n'est pas disponible : les images sont construites sur GitHub. Le premier scan a détecté six vulnérabilités HIGH dans les outils npm embarqués par l'image Node de base ; ces outils inutiles à l'exécution ont été retirés de l'image finale. Le nouveau scan et le démarrage isolé de la stack doivent réussir avant publication. Les éléments de recette et secrets restent dans `.qa`, ignoré par Git et Docker.

L'image applicative corrigée, la sauvegarde et PostgreSQL passent désormais l'analyse HIGH/CRITICAL. Le binaire `gosu` ancien a été supprimé de la sauvegarde et remplacé par `su-exec` maintenu par Alpine pour PostgreSQL. Caddy présentait encore deux avis HIGH, dont un sans correctif indiqué : il a été remplacé par Nginx officiel avec certificats renouvelés par Certbot sur l'hôte. Le nouveau scan Nginx et le démarrage CI doivent encore réussir. Aucune exception de scanner n'a été ajoutée et aucune image bloquée n'est déployée.

Resend indique le domaine `maison-miroir.fr` vérifié, DKIM `resend._domainkey` et SPF `send` vérifiés. Le TXT SPF public est présent ; DMARC n'a pas été trouvé. Ces lectures ne constituent pas un test de livraison ou de quota. Aucun enregistrement DNS de messagerie n'a été modifié. Un destinataire explicitement autorisé reste nécessaire avant toute recette d'e-mail réel ; aucune campagne réelle n'est approuvée.

Une tentative SSH par la clé dédiée vers `ubuntu@15.235.62.124` a été refusée (`Permission denied`). La clé publique doit être autorisée par la propriétaire via un accès existant. L'empreinte ED25519 observée est `SHA256:/Ds7fNU4mu3XoiEXeBmNdtOJsesuOWiv4PTrXoYVCDE` ; elle reste à comparer avec la console OVH avant administration. Aucun accès existant ni pare-feu ne sera modifié sans autorisation explicite conformément à la dernière instruction.

## Données et conditions restantes

L'ancien e-commerce, son catalogue et le point de restauration `archive/pre-launch-2026-11-15` sont conservés. Le JSON local contient zéro commande et ne prouve pas l'absence de commandes en production. Aucune copie massive des données clients n'a été effectuée. Sans sauvegarde complète datée et vérifiée de la source, l'import est arrêté conformément à la demande de la propriétaire.

L'importeur préparé exige une source intègre, une base de test isolée, une comparaison complète des enregistrements et un rapport d'étape avant le mode définitif. Il ne déclenche aucun e-mail, webhook ou paiement. Les fichiers source et rapports détaillés restent privés. Les comptes et totaux importés ne peuvent pas être annoncés avant la migration réelle.

Avant le choix OVH, une ressource Supabase gratuite de préparation et des schémas de recette ont été créés ; ils ne contiennent pas de commandes ou clientes réelles et ne font pas partie de la cible OVH. Cette ressource n'a pas été supprimée automatiquement. Aucune nouvelle offre payante n'a été engagée.

Restent nécessaires : VPS et empreinte SSH vérifiée, stockage externe approuvé, preuves de sauvegarde source et de restauration, scans CI réussis, tests et mesures sur VPS, finalisation des textes légaux par la propriétaire, configuration des alertes et validation de la bascule. Aucun abonnement payant ne sera créé implicitement.

Procédure opérationnelle : [DEPLOIEMENT-OVH.md](DEPLOIEMENT-OVH.md).
