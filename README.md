# S2A Pilot

**S2A Pilot** est une solution de préparation et de conduite de spectacle multimédia développée par **S2A Production**.

Elle comprend deux outils complémentaires :

- **S2A Pilot 1.4.1** — application web/PWA de préparation et de conduite.
- **S2A Copilote 1.2.2** — companion macOS pour importer une conduite S2A Pilot dans **QLab 5**.

## S2A Pilot 1.4.1

Fonctions principales :

- modes **Édition** et **Show**
- Cues au dixième de seconde
- audio et vidéo
- plusieurs médias dans une même conduite
- points **IN / OUT**
- waveform audio
- aperçu vidéo
- Loop
- CUT
- fondus
- arrêt / fondu global
- vidéo muette ou sonore
- préchargement des médias
- sortie vidéo externe sur noir
- seek pendant la lecture sans pause
- resynchronisation des médias
- durée de conduite automatique ou manuelle
- **Auto +10 s**
- décompte de la prochaine Cue, rouge sous 10 secondes
- visuel associé à la Cue
- sauvegarde locale
- Undo / Redo
- fiche technique PDF
- export portable `.s2apilot.zip`

### Interface Édition

Zone projet :

**Nouveau → Ouvrir → Enregistrer → Enregistrer sous… → Fiche technique PDF**

La restauration de la dernière sauvegarde est automatique.

La zone **PRÉPARATION DU SHOW** contient les commandes de transport, la timeline et la durée de conduite avec **Auto +10 s**.

Depuis la version **1.4.1** :

- sélectionner une Cue dans la liste met son marqueur en surbrillance sur la timeline ;
- cliquer sur un marqueur de timeline sélectionne et ouvre la Cue correspondante.

### Interface Show

Le mode Show affiche principalement :

- **CUE ACTIVE**
- **PROCHAINE CUE**
- décompte rouge sous 10 secondes
- **TIMELINE**

## Calcul Auto +10 s

La durée automatique correspond à :

**fin effective la plus tardive de tous les médias + 10 secondes**

Le calcul doit tenir compte :

- du temps de départ de la Cue ;
- des points IN / OUT ;
- des médias qui continuent après le lancement d’une Cue suivante ;
- des CUT ;
- des STOP / FONDU globaux ;
- des Loops arrêtés ultérieurement.

## Export `.s2apilot.zip`

Un package peut contenir :

```text
conduite.json
media/
visuals/
fiche-technique.pdf
companion/
LISEZ-MOI-Technicien.txt
```

La fiche technique PDF est générée lors de **Enregistrer sous…** et peut être incluse dans le package.

La compatibilité avec l’ancien format `.showcue.zip` est conservée lorsque cela est possible.

## S2A Copilote 1.2.2

S2A Copilote traduit une conduite S2A Pilot en structure exploitable dans **QLab 5**.

Éléments pris en charge :

- Group Timeline
- Audio Cue
- Video Cue
- Memo Cue
- Stop Cue
- Fade Cue
- IN / OUT
- Loop
- CUT audio
- fondus
- vidéo muette
- médias simultanés
- arrêt global audio / vidéo
- marqueur de fin de conduite

### Changements 1.2.2

- tentative de mise en silence des Video Cues via **audio output patch number = 0** ;
- STOP globaux renommés :
  - `STOP GLOBAL — AUDIO`
  - `STOP GLOBAL — VIDÉO`
- nettoyage de la liste des médias actifs après STOP / FONDU global afin d’éviter les `CUT AUDIO` inutiles sur les Cues suivantes.

Ces points doivent encore être validés en conditions réelles dans QLab 5.

## Visualiseur S2A Copilote

Le visualiseur intégré affiche :

- Cue active
- prochaine Cue
- visuel
- décompte
- affichage rouge sous 10 secondes

Les messages d’erreur permanents ont été supprimés : une erreur n’est affichée que lorsqu’une erreur réelle est détectée.

## Structure du dépôt

```text
S2A-Pilot/
├── PWA/
├── S2A-Copilote/
├── README.md
└── SESSION-2026-10-02.md
```

## Compilation de S2A Copilote

```bash
cd S2A-Copilote
chmod +x build.sh
./build.sh
```

L’application produite est :

`S2A Copilote.app`

Les versions de test peuvent utiliser une signature ad hoc.

## Workflow

1. Préparer la conduite dans **S2A Pilot**.
2. Ajouter médias, visuels et Cues.
3. Tester la conduite en mode Show.
4. Exporter le package `.s2apilot.zip`.
5. Ouvrir le package avec **S2A Copilote**.
6. Importer la conduite dans **QLab 5**.
7. Vérifier la conduite QLab avant exploitation.

## Versions actuelles

- **S2A Pilot : 1.4.1**
- **S2A Copilote : 1.2.2**

---

**S2A Production**
