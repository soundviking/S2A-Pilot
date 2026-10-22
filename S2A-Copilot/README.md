# S2A Pilot Bridge 1.4.0

Les droits sur S2A Pilot et S2A Pilot Bridge appartiennent à la société S2A Production. Ces applications ont été développées par Antoine CLOPIER, avec l’aide de ChatGPT.

[English](README.en.md)

Application macOS universelle Intel et Apple Silicon, macOS 13 minimum. Langue du système détectée au premier lancement ; choix Français / English / Español / Deutsch mémorisé. Les titres, noms de Cues et descriptions de projets ne sont pas traduits.

## Import et visualiseur

Les workspaces QLab ouverts sont détectés automatiquement ; un menu permet le choix si plusieurs sont ouverts. Enregistrer le workspace avant l’import. Plusieurs packages deviennent plusieurs groupes Timeline, numérotés avec leurs étapes : 5, 5.1, 5.2… Les numéros existants sont évités et les anciennes conduites ne sont pas renumérotées. Le visualiseur peut rester au premier plan.

La vue Show reprend Maverick de Pilot : timeline, Cue active et suivante côte à côte, descriptions et visuels. Un clic agrandit une image, un second clic ou Échap revient à la vue normale. Le déroulé QLab conserve chaque groupe Pilot comme un numéro et affiche les numéros réels. Le Play vert indique la lecture et le halo bleu la sélection ; un clic sélectionne par ID sans GO. Le décompte est réservé aux conduites Pilot. Le compteur « Cue 1/2 » est supprimé.

Les imports successifs vérifient le workspace par ID. L’import conserve les actions médias et une horloge Wait unique ; les repères visuels restent dans Bridge. Les index antérieurs sans identifiant d’horloge restent lisibles. QLab fournit le temps : pause, reprise et déplacements sont reflétés ; une perte de communication fige le dernier temps confirmé et affiche « Synchronisation perdue ».

Voir les [modes d’emploi illustrés](../docs/manual/README.md).

## Vérifications

Modèles et scripts QLab vérifiés, tests Show dans Chrome à trois largeurs, rendu WebKit natif inspecté, compilation universelle et signature locale. La validation complète de conduite dans QLab 5 et l’exécution sur Intel physique restent à confirmer. Voir le [compte rendu](../docs/bridge/lot-1-validation.md).


## Compilation

`zsh build.sh` avec les outils Xcode compile les deux architectures, les assemble, génère le logo bleu/orange et applique une signature locale. Aucune notarisation Apple.


## Licence

Utilisation autorisée ; redistribution, publication ou hébergement pour des tiers soumis à un accord écrit préalable de S2A Production. Voir [la licence](LICENSE).
