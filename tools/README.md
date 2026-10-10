# Génération des fichiers de compatibilité

La PWA charge des fichiers déjà construits, jamais Babel depuis le navigateur.

`build-compat.cjs` prend deux arguments : le dossier des dépendances de construction et le dossier PWA cible. Il requiert Node.js et les fichiers locaux suivants :

- `babel.min.js` de `@babel/standalone` 7.28.5 ;
- `core-js-bundle/` de `core-js-bundle` 3.46.0, avec `minified.js` et `LICENSE` ;
- `whatwg-fetch/` de `whatwg-fetch` 3.6.20, avec `dist/fetch.umd.js` et `LICENSE`.

Exemple : `node tools/build-compat.cjs ../compat-vendor PWA`.

Les sources restent `PWA/app.js`, `PWA/i18n.js` et `PWA/technical-preview.js`. Le générateur applique les adaptations nécessaires uniquement au build ancien (stockage buffer, Web Audio, récupération du brouillon allégé, téléchargements et en-tête JPEG), puis produit ES5. `PWA/compat/BUILD.json` contient les empreintes des sources. Après toute modification de ces sources, reconstruire avant de publier.

`tools/compat-layout.css` complète les couleurs statiques et remplace Grid par Flex dans cette branche. `PWA/compat/adapters.js` fournit les API DOM, fichiers, audio et événements manquantes. Les licences tierces sont dans `PWA/compat/`. Le JPEG et sa version base64 sont des conversions du même en-tête WebP, sans modification des logos.

## Vérification des exports et du partage web

`test-lightweight-export.cjs` vérifie un enregistrement après clic, son annulation, le téléchargement de secours, la génération PDF, la déduplication audio et la réouverture du ZIP, sans Bridge. Chrome est placé hors ligne ; les requêtes HTTP de WebKit sont bloquées car son mode hors ligne simulé bloque aussi les lectures de Blob en mémoire.

`test-copilot-hosted.cjs` utilise le véritable relais PHP sur le port 8892 et deux contextes navigateur indépendants (Chrome hôte, WebKit lecteur). Il contrôle les visuels, la navigation, la coupure/reprise, l’absence de commandes chez le lecteur, le refus de publication/révocation avec le secret lecteur et les liens invalides.

Lancer `php -S 127.0.0.1:8892 -t PWA`, puis les tests avec Playwright. Le relais réel ne doit jamais être mis dans le cache de la PWA ou du CDN.
