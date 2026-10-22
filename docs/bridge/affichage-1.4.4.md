# Bridge 1.4.4 — disposition automatique selon la lecture

- Une Cue QLab non issue de Pilot, réellement suivie en lecture ou en pause, utilise Iceman. Les cartes active et suivante sont en pleine largeur, avec les styles Iceman de Pilot ; aucune colonne de décompte n’est réservée et aucun décompte n’est créé sur la suivante. La progression et le temps écoulé restent disponibles.
- Le démarrage d’une conduite Pilot rétablit Maverick et son décompte habituel.
- La disposition dépend de `currentID` et du contenu suivi par le moniteur existant. `selectedID` et la tête de lecture suivante ne commandent pas ce choix. À l’arrêt, la dernière disposition reste conservée jusqu’à la prochaine Cue suivie ; un nouveau workspace repart sur Maverick. Une synchronisation perdue ne change pas la disposition.
- Aucun changement de la sélection bidirectionnelle, des filtres multiples, des éditions persistantes ou des scripts d’import, de transport et d’horloge QLab. La conversion QLab → Pilot reste abandonnée comme demandé.

## Vérifications

`test-bridge-show.cjs` contrôle le passage QLab → Iceman → Pilot/Maverick, la pause, la sélection seule, l’arrêt et la perte de synchronisation, sans message natif sortant. Les cartes Iceman et leurs descriptions sont vérifiées à 1 500, 1 100 et 820 px ; absence de décompte QLab et restauration du décompte Pilot contrôlées. Les régressions zoom, filtres et édition sont également vérifiées.

`test-bridge-window.py` charge les vrais composants Show dans WebKit natif avec connexion QLab simulée et produit une capture Iceman, en plus des tests de barre sombre, boutons natifs et premier plan. Compilation universelle et ZIP signé vérifiés. Le lot 4 d’essais en conduite réelle reste à effectuer.
