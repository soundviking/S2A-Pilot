# Génération des fichiers de compatibilité

La PWA charge des fichiers déjà construits, jamais Babel depuis le navigateur.

`build-compat.cjs` prend deux arguments : le dossier des dépendances de construction et le dossier PWA cible. Il requiert Node.js et les fichiers locaux suivants :

- `babel.min.js` de `@babel/standalone` 7.28.5 ;
- `core-js-bundle/` de `core-js-bundle` 3.46.0, avec `minified.js` et `LICENSE` ;
- `whatwg-fetch/` de `whatwg-fetch` 3.6.20, avec `dist/fetch.umd.js` et `LICENSE`.

Exemple : `node tools/build-compat.cjs ../compat-vendor PWA`.

Les sources restent `PWA/app.js`, `PWA/i18n.js` et `PWA/technical-preview.js`. Le générateur applique les adaptations nécessaires uniquement au build ancien (stockage buffer, Web Audio, récupération du brouillon allégé, téléchargements et en-tête JPEG), puis produit ES5. `PWA/compat/BUILD.json` contient les empreintes des sources. Après toute modification de ces sources, reconstruire avant de publier.

`tools/compat-layout.css` complète les couleurs statiques et remplace Grid par Flex dans cette branche. `PWA/compat/adapters.js` fournit les API DOM, fichiers, audio et événements manquantes. Les licences tierces sont dans `PWA/compat/`. Le JPEG et sa version base64 sont des conversions du même en-tête WebP, sans modification des logos.

## Export avec Bridge

test-pilot-export.cjs vérifie la sauvegarde, le PDF, les médias et leur réouverture dans Pilot ainsi que la présence de Bridge sans serveur dans le ZIP. Le format conduite.json version 5 reste compatible avec Bridge / QLab.

## Recentrage des Cues

test-cue-centering.cjs contrôle une conduite de 200 Cues dans Chrome et WebKit : Iceman sur ordinateur, iPad et iPhone simulés, défilement manuel, première/dernière Cue, changement de disposition et ouverture en Edit sans recentrage pendant la saisie. Définir S2A_TEST_URL pour le serveur local, S2A_PLAYWRIGHT pour le module Playwright et S2A_CHROME si Chrome doit être fourni explicitement.

## Traductions et manuels

Le catalogue commun est documenté dans `locales/README.md`. `test-locales.cjs` contrôle FR/EN/ES/DE, les textes utilisateur, l’aide, les liens PDF, le PDF technique, les notes de mise à jour et le retour après rechargement. `S2A_TEST_ENGINES=chromium` limite l’exécution à Chrome ; sans cette variable, Chrome et WebKit doivent être installés. Le visualiseur et le catalogue natifs sont également vérifiés avec `test-locales.swift`, compilé avec `S2A-Copilot/Sources/BridgeStrings.swift`.

`capture-help-locales.cjs` produit de vraies captures des quatre interfaces et leurs copies hors ligne. Il utilise les médias de démonstration du dossier de travail du manuel. Il ne dessine pas de fausse interface.

`python3 tools/serve-preview.py` sert uniquement en local l’application et les quatre manuels séparés. En production, le lien de l’aide télécharge le PDF depuis GitHub ; les PDF ne sont pas inclus dans la PWA. Avant publication, mettre à jour `PWA/version.json` : `releaseNotes` est un objet de résumés courts `fr/en/es/de`, affiché sur deux lignes au maximum dans l’annonce de nouvelle version. Un serveur sans ce champ reste compatible.

### Reconnaissance du workspace Bridge

`test-bridge-workspaces.swift`, compilé avec `S2A-Copilot/Sources/BridgeWorkspaceQuery.swift`, contrôle les réponses de QLab simulées : cible sélectionnée, deux imports successifs, ordre des workspaces modifié, premier résultat vide, fermeture réelle, réponse invalide et absence de bascule vers un autre workspace. La requête AppleScript est compilée avec le dictionnaire de QLab installé. Ces tests ne constituent pas deux imports exécutés dans un vrai workspace QLab.

## Bridge Show 1.4.0

`python3 tools/test-bridge-navigation.py` vérifie les modèles runtime/workspace et compile les scripts AppleScript, sans les exécuter. `tools/test-bridge-show.cjs` teste l’interface Show empaquetée dans Chrome : Maverick, lecture/sélection, numéros, auto-scroll, zoom, pause/retour, décompte Pilot uniquement et trois largeurs. Il utilise le module Playwright disponible via `NODE_PATH` ou `S2A_PLAYWRIGHT` ; le navigateur peut être défini par `S2A_CHROME`.

`python3 tools/package-release.py --bridge-only` produit uniquement le ZIP Bridge et laisse les archives et l’installateur embarqué de Pilot inchangés.

## Lot 2 — édition Bridge 1.4.1

`test-bridge-navigation.py` exécute également `test-bridge-editing.swift` (écriture atomique, réouverture, identités, conflits, métadonnées préservées) et `test-bridge-edit-integration.swift` (vrai AppModel avec connexion QLab injectée : sauvegarde réelle en dossier temporaire, renommage confirmé simulé, réponses périmées et changement de workspace). La commande d’édition est compilée avec le dictionnaire QLab ; seul le sérialiseur de texte est exécuté dans AppleScript, sans application cible.

`test-bridge-editor.cjs` vérifie l’éditeur de Show : sauvegarde explicite, Annuler/Échap, texte multiligne, brouillon conservé pendant le polling et les erreurs, conflits externes, identifiants Pilot/QLab et absence de commandes de transport. Les écritures QLab y sont simulées.

## Lot 3 — interface Bridge 1.4.2

`test-bridge-filters.cjs` vérifie les six vues du déroulé, la sélection masquée, le retour à Tout afficher, les filtres vides et l’auto-scroll, sans commande QLab. La classification et la mémorisation du filtre sont testées dans `test-bridge-edit-integration.swift`, via `test-bridge-navigation.py` et un domaine de préférences temporaire.

`python3 tools/test-bridge-window.py` compile les vrais composants Show dans une application temporaire avec connexion QLab simulée. Il vérifie les trois boutons macOS d’origine, la barre sombre compacte, la visibilité du switch à 1 360 et 820 px, la hauteur du contenu et les transitions `.normal`/`.floating`. Il produit des captures de la fenêtre et du contenu WebKit dans `/tmp/s2a-bridge-frame-*.png` et `/tmp/s2a-bridge-window-*.png`. Aucun workspace QLab n’est ouvert ou modifié.
