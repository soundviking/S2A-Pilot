# Bridge 1.4.2 — lot 3, filtres et barre macOS

Base : `6c26c97` (Bridge 1.4.1). Show Maverick, les éditions persistantes et la synchronisation QLab des lots précédents sont conservés.

## Interface

- Menu Type de Cue dans le déroulé : Tous les types, Audio, Vidéo, S2A Pilot, Network et Autres. Les groupes Pilot identifiés par leur ID passent dans S2A Pilot ; leurs médias restent représentés dans ce numéro. Audio inclut Audio/Mic ; Vidéo inclut Video/Camera/Text ; les types non reconnus restent accessibles dans Autres.
- Filtre mémorisé dans les préférences Bridge et conservé lors d’un changement de workspace ou d’une reconnexion. Une ancienne valeur invalide revient à Tous les types.
- Filtrage exclusivement visuel : aucun GO, aucune sélection envoyée, aucune modification de l’horloge ou des données de Cue. Le panneau Show continue de suivre QLab même si la Cue sélectionnée est masquée.
- Message explicite si la sélection est masquée, avec bouton Tout afficher. La sélection visible est recentrée lors du changement de filtre. Une vue vide affiche un texte dédié. L’édition consulte toujours les Cues complètes, y compris celles masquées par le filtre.
- Barre native sombre, style macOS unifiedCompact, avec identité de Bridge, statut de synchronisation et switch Toujours au premier plan. Les boutons fermer/réduire/plein écran restent les contrôles standard de macOS, sans remplacement web ni déplacement manuel.
- Suppression du bandeau web de 60 px : le déroulé et Show utilisent toute la hauteur sous la barre native. La liste du déroulé défile indépendamment du menu de filtre.
- Nouvelles chaînes dans le catalogue FR/EN/ES/DE. La PWA et son installateur Bridge embarqué restent à leur version publiée ; le ZIP Bridge autonome est en 1.4.2.

## Vérifications effectuées

- Compilation universelle Intel et Apple Silicon et signature locale.
- `test-bridge-navigation.py` : modèles et scripts QLab, persistance et conflits d’édition, filtre mémorisé/réouvert, classement des types, priorité Pilot, valeur invalide et absence de commandes QLab ou de mutation de l’horloge lors du filtrage.
- `test-bridge-filters.cjs` : chaque catégorie, changement reçu de l’application, changement de workspace, vue vide, sélection masquée, retour à Tous les types, recentrage sur une conduite de 100 éléments et conservation du Show/décompte. Tous les messages sortants de cette séquence sont des demandes de filtre.
- Régressions Show et éditeur : états sélection/lecture indépendants, numéros réels, auto-scroll, décompte Pilot uniquement, pause/retour temporel, perte de synchronisation, zoom, sauvegarde, erreurs et maintien du brouillon.
- `test-bridge-window.py` : vrais composants SwiftUI/AppKit/WebKit dans une application temporaire, connexion QLab simulée. À 1 360 et 820 px, les trois boutons natifs sont les objets d’origine, visibles et actifs ; le titre et le switch sont présents dans la barre. Hauteur native mesurée : 40 px. Le contenu commence à zéro sous la barre et occupe sa hauteur disponible. Les changements du switch sont reflétés par les niveaux de fenêtre normal et flottant.
- Captures natives inspectées ; contraste des libellés de la barre corrigé et contrôlé. Les boutons macOS peuvent apparaître gris sur les captures d’une fenêtre de test inactive, conformément au comportement natif.
- Génération des groupes, actions médias et Wait Cue inchangée ; les filtres ne modifient pas les index de conduite ni les données QLab.

## Suite

Il reste le lot 4 : validation en conditions réelles dans QLab 5, imports successifs, renommage et descriptions, filtres, pause/reprise et repositionnement, fermeture/réouverture, reconnexion, scénario complet groupe + audio + Wait Cue + horloge. Vérifier aussi plein écran et gestion de plusieurs écrans sur le poste de spectacle. Les tests de ce lot n’exécutent pas un spectacle réel. Copilot et QR Code restent en standby.
