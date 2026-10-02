# ShowCue for QLab 1.1

## Nouveautés

### Plusieurs ShowCues dans un workspace

Chaque import est enregistré dans :

`ShowCue/index.json`

à l’intérieur du dossier du workspace QLab.

L’index mémorise :
- le Group cue QLab associé ;
- le nom du numéro ;
- les TOPS ;
- les chemins des visuels ;
- la date d’import.

ShowCue for QLab recharge automatiquement cet index quand le workspace est détecté.

### Visualiseur automatique

Le visualiseur surveille tous les Group cues ShowCue connus dans le workspace.

- Aucun Group ShowCue en lecture → `En attente d’un numéro ShowCue`
- Un Group démarre → le visualiseur bascule automatiquement dessus
- Un autre Group démarre plus tard → bascule automatique sur ce nouveau numéro
- Pause → le visualiseur indique `Pause`

Aucune sélection manuelle de numéro n’est nécessaire.

### Visualiseur compact

- fenêtre réduite pour moins masquer QLab ;
- toujours au premier plan par défaut ;
- option pour désactiver le premier plan ;
- prochain TOP, compte à rebours et visuel conservés.

### Import QLab

Toujours identique à la branche robuste :
- Group Timeline ;
- Audio cue ;
- Memo cues avec Pre-Wait exact ;
- aucune image collée dans QLab ;
- aucune permission Accessibilité.

## Build

```bash
chmod +x build.sh && ./build.sh
```

Signature ad hoc, sans abonnement Apple Developer.


## 0.8.1

- Corrige l’erreur de compilation Swift du libellé comptant les ShowCues associés au workspace.


## 0.8.2

- Le compte à rebours du visualiseur passe en rouge pendant les 10 dernières secondes avant le prochain TOP.

## 0.8.3

- Sélection de plusieurs packages `.showcue.zip` en une seule fois.
- File d’attente visible dans l’application.
- Possibilité de retirer un package ou de vider toute la file.
- Import en lot dans le workspace QLab au premier plan.
- Chaque package crée son propre Group Timeline.
- Confirmation unique avant l’import du lot.
- Le visualiseur multi-ShowCue continue ensuite à suivre automatiquement le numéro en lecture.

## 0.8.4

- Corrige deux chaînes Swift mal générées dans l'import multi-package.
- Les séparateurs de lignes utilisent désormais explicitement `\n`.

## 0.8.5

- Le décompte du visualiseur n'affiche plus les dixièmes.
- Affichage en secondes entières, ou en `m:ss` au-delà d'une minute.
- Le passage en rouge reste actif pendant les 10 dernières secondes.

## 0.8.6

- Le Group cue importé est désormais en mode **Start First** au lieu de Timeline.
- Les Memo cues n'utilisent plus de **Pre-Wait**.
- Le temps du TOP reste dans le nom du Memo cue uniquement comme repère visuel.
- Le visualiseur externe conserve son propre décompte.

## 0.8.7

- Corrige le mode AppleScript du Group cue : `start_first`.
- Le Group cue est bien créé en mode **Start First**.
- Les Memo cues restent sans Pre-Wait.

## 0.8.8

- Le visualiseur suit désormais l'**Audio cue** importé, pas le temps du Group cue.
- Un déplacement dans la lecture audio de QLab doit donc recaler immédiatement le visualiseur.
- `audioID` est conservé dans `ShowCue/index.json`.
- Les anciens index restent lisibles : sans `audioID`, l'app retombe sur le suivi du Group cue.
- Première proposition d'icône ShowCue for QLab intégrée au build.

## Version 1.0

Version définitive basée sur la branche validée.

Fonctions conservées :
- import de plusieurs packages ShowCue ;
- Group cue en mode **Start First** ;
- Memo cues sans **Pre-Wait** ;
- temps du TOP conservé dans le nom du Memo comme repère visuel ;
- visualiseur multi-ShowCue ;
- suivi du temps réel de l’**Audio cue** ;
- recalage du visualiseur quand la position audio change dans QLab ;
- compte à rebours en secondes entières ;
- passage du compte à rebours en rouge pendant les 10 dernières secondes ;
- index persistant par workspace ;
- icône ShowCue intégrée ;
- aucune permission Accessibilité requise.


## Version 1.1

Ajoute la compatibilité des packages ShowCue avec média principal vidéo : import en Video cue QLab, suivi du timecode du média vidéo et compatibilité conservée avec les anciens packages audio.
