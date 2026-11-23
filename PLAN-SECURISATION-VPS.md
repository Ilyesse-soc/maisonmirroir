# Opérations prévues sur le VPS - validation avant modification

Serveur fourni : `ubuntu@15.235.62.124`, `vps-5485bc25.vps.ovh.ca`. Ce plan ne signifie pas que les opérations ont été exécutées. L'accès par la clé préparée est actuellement refusé. Aucun changement SSH ou pare-feu n'a été réalisé.

## Première connexion : lecture seule

- Comparer l'empreinte ED25519 observée avec celle affichée par `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` depuis la console OVH.
- Lire l'identité du système et le noyau ; vérifier CPU, RAM, disques, montages et horloge.
- Inventorier les comptes, la configuration SSH effective, les ports en écoute, le pare-feu actuel et les services installés. Ne pas lire ni afficher de clés privées, mots de passe, environnement de conteneurs ou fichiers clients.
- Identifier toute installation Docker, base ou volume existant avant toute installation ou migration. Ne jamais remplacer une installation ou initialiser un volume existant implicitement.

## Changements proposés, soumis à autorisation

1. Sauvegarder les configurations existantes et la liste des règles de pare-feu dans un dossier root privé.
2. Mettre à jour Ubuntu depuis ses dépôts ; installer Docker Engine et Compose depuis le dépôt officiel signé, uniquement après examen d'une éventuelle installation existante. Préserver les données et ne pas redémarrer le noyau sans fenêtre planifiée.
3. Ajouter `mmadmin` pour l'administration humaine avec une clé dédiée. Conserver `ubuntu` et ses accès actuels. Vérifier une **nouvelle session SSH par clé** et sudo avant de proposer une restriction supplémentaire.
4. Ajouter `mmdeploy` avec une seconde clé CI, une commande forcée limitée au déploiement d'un digest, sans shell libre, transfert de ports ou groupe Docker. Aucun mot de passe ni clé privée n'est placé dans le dépôt.
5. Après autorisation séparée du pare-feu, préserver le port SSH réel et les éventuels usages existants, autoriser HTTP/HTTPS et refuser les autres entrées inutiles. Vérifier IPv4 et IPv6 et le pare-feu OVH. Les conteneurs PostgreSQL/app/worker ne publient aucun port.
6. L'éventuelle désactivation de l'authentification SSH par mot de passe reste soumise à autorisation explicite **après** validation de la nouvelle connexion. Le script possède un mode distinct `--finalize-ssh` ; ne pas l'exécuter sans cette autorisation.
7. Activer fail2ban, NTP, mises à jour de sécurité et supervision, avec contrôle de leur configuration effective. Installer les certificats, secrets et sauvegardes avec des permissions minimales.

Les scripts sont préparés dans `ops`. Ils ne doivent pas être lancés globalement avant validation de cet audit et des changements d'accès/pare-feu. Si des règles ou services existants ont un usage non identifié, suspendre leur modification et préserver leur fonctionnement.

La mise en service applicative suit ensuite [DEPLOIEMENT-OVH.md](DEPLOIEMENT-OVH.md), avec sauvegarde source vérifiée, import isolé, restauration externe testée et recette avant DNS. L'ajout des challenges TXT ACME et la bascule web seront présentés après ces étapes ; aucun enregistrement de messagerie ne sera modifié implicitement.
