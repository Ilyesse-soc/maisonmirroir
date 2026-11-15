# Point de restauration — 15 novembre 2026

Tag Git : `archive/pre-launch-2026-11-15`.
Commit d'origine : `3b677340587209e982bfecf71b2de9dccac0138d`.

Les copies `home.tsx.txt` et `SiteShell.tsx.txt` conservent l'interface initiale sans créer de routes publiques ni dupliquer de données personnelles ou de secrets. Les composants, pages de catalogue, fiches produits, panier, paiements, livraison et services de commandes restent à leurs emplacements d'origine.

Pour restaurer l'interface, comparer puis récupérer les fichiers souhaités depuis le tag dans une branche dédiée. Pour la future boutique : adapter l'accueil, rétablir le shell marchand à la racine puis configurer `SHOP_OPEN=true`. Cette variable seule ouvre les routes conservées, sans changer l'accueil de lancement. Aucun secret ne doit être restauré depuis une archive.

Les API de commandes disposent désormais d'une protection serveur ; conserver cette protection lors de la restauration.
