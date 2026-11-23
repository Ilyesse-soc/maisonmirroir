# Livraison ciblée Maison Miroir - 15 novembre 2026

Branche : `fix/responsive-legal`, créée depuis `625a8fc`. Cette intervention concerne uniquement la présentation de la préouverture, ses liens et ses pages légales. Aucun déploiement, accès SSH, changement DNS, e-mail, secret ou donnée de production n'a été modifié. Les changements d'infrastructure de la branche précédente ne sont pas réexécutés par cette livraison.

## Corrections

- L'image composite existante est conservée sans modification du fichier. Après réception des deux captures annotées, le cadrage inclut désormais l'arche originale, sa phrase et les personnages dans un seul bloc : l'arche CSS superposée et la jonction horizontale sont supprimées. Le texte équivalent reste accessible aux lecteurs d'écran. Les raccords périphériques sont adoucis par des masques CSS. Les traits latéraux du titre et du chapitre sont retirés sur mobile et conservés sur ordinateur.
- Le footer s'adapte aux petites largeurs et aux tailles intermédiaires : retour à la ligne des liens, tailles fluides, absence de texte forcé sur une seule ligne, zones tactiles de 44/48 px et focus clavier visible.
- Instagram et TikTok utilisent les chemins officiels fournis, sans paramètres de suivi, dans des liens externes sécurisés et annoncés comme nouvel onglet. Leur disponibilité réelle n'a pas pu être confirmée par l'outil web (accès bloqué par les plateformes).
- Footer partagé : contact, copyright, mentions légales, confidentialité et cookies. Les nouvelles pages ne montent pas le panier, PayPal ou la navigation de boutique.

## Fichiers

| Ensemble | Fichiers |
| --- | --- |
| Préouverture | `app/page.tsx`, `app/launch.css`, `components/LaunchFooter.tsx` |
| Présentation légale | `components/LegalPage.tsx`, `app/legal.css`, `lib/brandInfo.ts` |
| Pages | `app/mentions-legales/page.tsx`, `app/politique-de-confidentialite/page.tsx`, `app/politique-de-cookies/page.tsx` |
| Compatibilité | `app/confidentialite/page.tsx` redirige vers la confidentialité canonique ; `components/NewsletterForm.tsx` adapte uniquement son lien ; `components/SiteShell.tsx` exclut les pages légales du shell boutique |
| Recette et rédaction future | `scripts/test-responsive-legal.cjs`, `docs/CGV-A-PREPARER.md`, ce rapport |

## Recette réellement effectuée

Build de production Next.js standalone, TypeScript et ESLint réussis. Tests existants newsletter/sécurité/webhook réussis avec fournisseur simulé ; aucun e-mail réel ni paiement. Aucun accès à la base cliente : les tests SQL utilisent leur base isolée en mémoire.

Chromium et Firefox installés localement : 14 dimensions demandées testées dans les deux orientations, soit 28 cas par moteur et 56 contrôles de mise en page. Dimensions nominales : 320×568, 360×800, 375×812, 390×844, 393×852, 430×932, 768×1024, 820×1180, 1024×1366, 1280×720, 1366×768, 1440×900, 1920×1080, 2560×1440. Aucun débordement des éléments visibles constaté. Le champ anti-spam volontairement hors écran est exclu de cette mesure.

Les trois pages légales répondent en HTTP 200 ; l'ancienne URL de confidentialité redirige. Catalogue, produit, catégorie, panier et checkout redirigent vers la préouverture avec `SHOP_OPEN=false`. Le consentement newsletter reste initialement décoché ; les champs obligatoires et l'affichage d'une erreur simulée sont vérifiés sans fausse confirmation. La visite publique et les nouvelles pages n'ont déposé aucun cookie ou stockage local et n'ont demandé aucune ressource tierce dans cette recette. Aucun nouveau bandeau de cookies n'a été ajouté.

Les liens du footer et le chargement de l'image sont vérifiés. Safari iOS et de véritables appareils iPhone ne sont pas disponibles : les captures aux dimensions iPhone proviennent de navigateurs de bureau, sans prétendre tester Safari.

## Captures réelles

Fichiers locaux dans `.qa/responsive-legal/` (ignorés par Git, sans donnée cliente) :

- `avant-accueil-390.png`, `avant-accueil-1440.png` : ancien build local avant correction.
- `apres-accueil-390.png`, `apres-accueil-430.png`, `apres-accueil-768.png`, `apres-accueil-1440.png` : nouveau rendu Chromium.
- `mentions-legales.png`, `politique-de-confidentialite.png`, `politique-de-cookies.png`.
- `resultats.json` : résultats Chromium ; sous-dossier `firefox/` : captures et résultats Firefox.

## Informations manquantes et limites

Le dépôt de préouverture utilise `public/launch/reference.jpg`, une illustration composite. Les deux images ensuite fournies par la cliente sont des captures annotées du site : elles identifient les raccords et les traits à corriger, et ne sont pas des photographies à intégrer dans la page. Elles ont guidé le second ajustement. Aucun remplacement arbitraire ni changement des fichiers image du catalogue n'a été effectué. La comparaison avant/après montre le rendu réel du code local.

Informations légales à confirmer : nom/prénom de l'entrepreneuse, responsable de publication et du traitement, téléphone professionnel, mentions d'immatriculation applicables, régime/numéro de TVA si applicable, entité juridique contractuelle de l'hébergeur avec adresse et téléphone. Le SIRET fourni `103 982 576 000 13` échoue au contrôle local de sa clé Luhn : il est repris comme numéro communiqué à confirmer, sans correction inventée. La question correspondant à « Je ne le suis pas » reste inconnue ; aucune exonération ou absence d'immatriculation n'en est déduite.

Les pages sont des versions préparées, avec les informations manquantes clairement signalées et `noindex` tant que non finalisées. Elles ne sont pas présentées comme une validation juridique achevée. Hébergement prévu dans le code : PostgreSQL sur OVHcloud Canada, envois Resend. Aucun accès au serveur ou au compte fournisseur n'a été fait pour cette intervention ; localisation et contrats effectifs, sous-traitants et garanties de transfert restent à confirmer. La purge présente dans le code est configurable et n'est pas planifiée automatiquement : les durées effectives et la politique d'archivage nécessitent validation. Aucun comportement métier n'a été changé pour masquer cette limite.

Références vérifiées : [mentions obligatoires, Service Public](https://entreprendre.service-public.gouv.fr/vosdroits/F37351?lang=fr), [consentement aux e-mails, CNIL](https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique), [cookies techniques et consentement, CNIL](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/lignes-directrices-modificatives-et-recommandation), [transferts hors EEE, CNIL](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre5). Les garanties applicables au Canada doivent être appréciées pour les organismes concernés ; elles ne se déduisent pas du seul pays du VPS.

## Déploiement après validation uniquement

1. Faire confirmer les informations manquantes et les assets, puis valider les captures. Identifier le commit réellement présent sur le VPS et son mécanisme de déploiement ; ne pas supposer qu'il correspond à la branche de préparation d'infrastructure.
2. Reporter uniquement le commit de cette intervention sur la branche de livraison appropriée (au besoin par cherry-pick après revue). Ne pas fusionner implicitement toute l'ancienne branche `security-launch`, qui contient d'autres travaux.
3. Construire l'image via le pipeline existant après TypeScript, lint, tests et build. Conserver le digest de l'image actuellement déployée comme retour arrière. Ne modifier ni variables de production ni fichiers SQL ; cette intervention ne comporte aucune migration.
4. Après autorisation de publication, utiliser le déploiement existant pour remplacer l'image applicative. Conserver les volumes, les secrets et la configuration Nginx en place. Ne pas rejouer les scripts de bootstrap, d'initialisation admin ou d'import ; ne pas utiliser `down -v` ni changer le DNS.
5. Vérifier sur le domaine existant accueil, assets, pages légales, redirections boutique, liens et absence d'erreur navigateur. En cas de régression, rétablir l'image applicative précédente avec les volumes inchangés. Aucun test d'e-mail réel n'est nécessaire à cette modification de présentation.

La validation de publication n'est pas demandée avant que cette livraison soit relue et que les informations indispensables soient complétées.
