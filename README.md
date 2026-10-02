# S2A Pilot

<p align="center">
  <img src="PWA/icons/s2a-pilot-512.png" width="220" alt="S2A Pilot">
</p>

**S2A Pilot** est un outil de prÃ©paration et de conduite de spectacle multimÃ©dia dÃ©veloppÃ© par **S2A Production**.

Il permet Ã  un artiste ou Ã  un technicien de prÃ©parer simplement une conduite contenant des **Cues**, des fichiers audio, des vidÃ©os, des visuels et des transitions, puis :

- de l'exploiter directement dans **S2A Pilot** ;
- ou de la transfÃ©rer dans **QLab 5** grÃ¢ce Ã  **S2A Sopilote** pour macOS.

## Versions actuelles

- **S2A Pilot 1.4.1** â€” application web / PWA
- **S2A Copilote 1.2.2** â€” companion macOS pour QLab 5

## S2A Pilot

S2A Pilot est une application web installable conÃ§ue pour fonctionner notamment sur :

- iPad / iPadOS
- macOS
- Windows
- Android

L'application fonctionne localement et permet de prÃ©parer une conduite sans dÃ©pendre d'une application native spÃ©cifique.

### Fonctions principales

- Cues positionnÃ©es au dixiÃ¨me de seconde
- Mode **Ã‰dition**
- Mode **Show**
- Audio et vidÃ©o
- Plusieurs mÃ©dias indÃ©pendants dans une mÃªme conduite
- Points **IN / OUT**
- Waveform pour les fichiers audio
- RepÃ©rage visuel des vidÃ©os
- Lecture en **Loop**
- Transition audio **CUT**
- Fondus rÃ©glables
- ArrÃªt / fondu de tous les mÃ©dias
- VidÃ©o avec son ou vidÃ©o muette
- PrÃ©chargement des mÃ©dias avant le spectacle
- Sortie vidÃ©o externe prÃ©parÃ©e au noir
- DÃ©placement dans la timeline pendant la lecture
- Resynchronisation des mÃ©dias aprÃ¨s dÃ©placement
- DurÃ©e de conduite automatique ou manuelle
- DÃ©compte avant la prochaine Cue avec alerte rouge sous 10 secondes
- Visuel associÃ© Ã  chaque Cue
- Mise en Ã©vidence de la Cue sÃ©lectionnÃ©e sur la timeline
- Sauvegarde locale
- Undo / Redo
- GÃ©nÃ©ration d'une **fiche technique PDF**

## Format de projet

Les projets portables utilisent l'extension :

```text
.s2apilot.zip
```

Le package peut contenir :

```text
conduite.json
media/
visuals/
fiche-technique.pdf
companion/
LISEZ-MOI-Technicien.txt
```

Le but est que l'artiste puisse remettre **un seul package** au technicien.

Les anciens packages ShowCue restent pris en charge lorsque cela est possible.

## S2A Copilote

<p align="center">
  <img src="S2A-Copilote/Resources/S2ACopiloteIcon.png" width="180" alt="S2ACopilote">
</p>

**S2A Copilote** est l'application macOS chargÃ©e de traduire une conduite S2A Pilot en vÃ©ritable workspace **QLab 5**.

Elle transforme les informations simples prÃ©parÃ©es par l'artiste en Cues techniques QLab.

### Traduction vers QLab

S2ACopilote peut notamment crÃ©er :

- Group Cues en mode Timeline
- Audio Cues
- Video Cues
- Memo Cues
- Stop Cues
- Fade Cues
- points IN / OUT
- Loops
- CUT audio
- fondus audio
- arrÃªts globaux audio / vidÃ©o
- vidÃ©os muettes
- dÃ©clenchements simultanÃ©s
- marqueur de fin de conduite

Une Cue S2A Pilot peut donc produire plusieurs Cues techniques dans QLab.

## Visualiseur

S2A Copilote dispose Ã©galement d'un visualiseur destinÃ© au suivi de conduite.

Il permet notamment d'afficher :

- la Cue active ;
- la prochaine Cue ;
- le visuel associÃ© ;
- le dÃ©compte avant la prochaine Cue ;
- l'alerte rouge dans les derniÃ¨res secondes.

## Workflow

```text
ARTISTE
  â†“
S2A Pilot
  â†“
PrÃ©paration des Cues
  â†“
Audio / VidÃ©o / IN / OUT / Loop / Fondus
  â†“
Enregistrer sousâ€¦ 
  â†“
Projet .s2apilot.zip
  â†“
RÃ‰GISSEUR
  â†“
S2A Copilote
  â†“
Import dans QLab 5
  â†“
Conduite QLab prÃªte Ã  Ãªtre exploitÃ©e
```

## Structure du dÃ©pÃ´t

```text
S2A-Pilot/
â”œâ”€ PWA/                  S2A Pilot
â”œâ”€ S2A-Copilote/        Application macOS / QLab
â”œâ”€ README.md
âˆ”â€” SESSION-2026-10-02.md
```

## Construction de S2A Copilote

Sur un Mac Ã©quipé des outils de dÃ©qÙ•±½ÁÁ•µ•¹Ğ·¥•ÍÍ…¥É•Ì€è()‰…Í )LÉµ½Á¥±½Ñ”)¡µ½€­à‰Õ¥±¹Í (¸½‰Õ¥±¹Í )€()0…ÁÁ±¥…Ñ¥½¸Ÿ¥»¥Ë¥”•ÍĞ€è()Ñ•áĞ)‰Õ¥±½LÉ½Á¥±½Ñ”¹…ÁÀ)€()1”‰Õ¥±…ÑÕ•°ÕÑ¥±¥Í”Õ¹”Í¥¹…ÑÕÉ”±½…±”€¼…¡½Œ•Ğ¹”»¥•ÍÍ¥Ñ”Á…Ì‘”ÁÕ‰±¥…Ñ¥½¸ÍÕÈ±”5…ŒÁÀMÑ½É”¸((ŒŒA¡¥±½Í½Á¡¥”‘ÔÁÉ½©•Ğ()LÉA¥±½Ğ‘½¥ĞÉ•ÍÑ•ÈÍÕ™™¥Í…µµ•¹ĞÍ¥µÁ±”Á½ÕÈƒ
ÑÉ”ÕÑ¥±¥Ï¤Á…ÈÕ¸…ÉÑ¥ÍÑ”ÅÕ¤¹”½¹¹‡¹ĞÁ…ÌE1…ˆ¸()1„½µÁ±•á¥Ó¤Ñ•¡¹¥ÅÕ”•ÍĞÁÉ¥Í”•¸¡…É”…Ôµ½µ•¹Ğ‘”°¥µÁ½ÉĞÁ…ÈLÉ½Á¥±½Ñ”¸()0½‰©•Ñ¥˜•ÍĞ‘½¹Œ€è((ø€¨©ÁË¥Á…É•ÈÍ¥µÁ±•µ•¹ĞÑÓ¤…ÉÑ¥ÍÑ”°•áÁ±½¥Ñ•ÈÁÉ½ÁÉ•µ•¹ĞÑÓ¤Ë¥¥”¸¨¨((ŒŒ¥Ù•±½ÁÁ•µ•¹Ğ()AÉ½©•Ğ“¥Ù•±½ÁÃ¤Á½ÕÈ€¨©LÉAÉ½‘ÕÑ¥½¸¨¨¸()LÉA¥±½Ğ•ĞLÉ½Á¥±½Ñ”Í½¹Ğ…ÑÕ•±±•µ•¹Ğ•¸“¥Ù•±½ÁÁ•µ•¹Ğ…Ñ¥˜¸(