# S2A Pilot Bridge 1.3.4

Les droits sur S2A Pilot et S2A Pilot Bridge appartiennent à la société S2A Production. Ces applications ont été développées par Antoine CLOPIER, avec l’aide de ChatGPT.

[English](README.en.md)

Application macOS universelle Intel et Apple Silicon, macOS 13 minimum. Langue du système détectée au premier lancement ; choix Français / English / Español / Deutsch mémorisé. Les titres, noms de Cues et descriptions de projets ne sont pas traduits.

## Import et visualiseur

Les workspaces QLab ouverts sont détectés automatiquement ; un menu permet le choix si plusieurs sont ouverts. Enregistrer le workspace avant l’import. Plusieurs packages deviennent plusieurs groupes Timeline, numérotés avec leurs étapes : 5, 5.1, 5.2… Les numéros existants sont évités et les anciennes conduites ne sont pas renumérotées. Le visualiseur peut rester au premier plan.

Le visualiseur affiche la prochaine Cue, son visuel, son décompte et sa description sur toute la largeur en dessous. Les descriptions longues défilent dans cette zone ; une description vide ne crée aucun espace supplémentaire. Les descriptions saisies dans Pilot sont conservées sans traduction.

Voir les [modes d’emploi illustrés](../docs/manual/README.md).

## Vérifications

Tests Chrome : création, édition, sauvegarde, langues, préservation des contenus, PDF, hors ligne, zoom et écrans simulés. Bridge : compilation universelle et signature locale. À confirmer sur appareils réels : Safari iPad, gestes tactiles, écran étendu, import QLab et exécution Intel.


## Compilation

`zsh build.sh` avec les outils Xcode compile les deux architectures, les assemble, génère le logo bleu/orange et applique une signature locale. Aucune notarisation Apple.


## Licence

Utilisation autorisée ; redistribution, publication ou hébergement pour des tiers soumis à un accord écrit préalable de S2A Production. Voir [la licence](LICENSE).
