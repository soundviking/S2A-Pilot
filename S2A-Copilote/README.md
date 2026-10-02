# S2A Copilote 1.2.2

Companion macOS pour importer un package S2A Pilot dans QLab 5 et afficher le visualiseur de conduite.

## Compatibilité S2A Pilot actuelle

La version 1.2.2 accepte les packages multimédias S2A Pilot V4/V5 et conserve l'import des anciens packages à média principal.

Lors d'un import multimédia, elle crée un **Group cue en mode Timeline** et traduit la conduite en cues QLab :

- Memo cue pour chaque Cue S2A Pilot, avec Pre-Wait correspondant à son horaire ;
- Audio / Video cues pour les médias associés ;
- points **IN / OUT** via Start Time / End Time ;
- **Loop** via Infinite Loop ;
- vidéo muette via la sortie audio coupée ;
- remplacement vidéo par Stop cues ;
- audio **CUT** par Stop cues ;
- audio **FONDU** par Fade cues de sortie et d'entrée ;
- **ARRÊT / FONDU TOUS LES MÉDIAS** traduit en Stop ou Fade cues ciblant les médias précédents ;
- marqueur `FIN DE CONDUITE SHOWCUE` à la durée totale exportée par S2A Pilot.

Les médias et les visuels de conduite sont copiés dans le dossier du workspace QLab. Les descriptions de Cue sont conservées dans les notes des Memo cues.


## Correctif 1.2.1

- Les Video Cues muettes n'interrompent plus l'import lorsqu'un fichier vidéo ne possède aucune piste audio ou aucune matrice audio exploitable dans QLab. Le mute de la sortie principale est maintenant appliqué comme réglage optionnel et isolé dans un bloc `try`.
- Le même correctif est appliqué aux anciens packages à média vidéo principal.
- Le bouton **Visualiseur** redevient disponible après un import réussi : dans la 1.2, l'erreur de mute interrompait l'import avant l'enregistrement de la conduite dans l'index local, ce qui laissait ce bouton grisé.

## Visualiseur

Le visualiseur reste intégré au companion :

- suivi automatique du S2A Pilot en cours ;
- prochaine Cue, compte à rebours et visuel ;
- compte à rebours rouge dans les 10 dernières secondes ;
- fenêtre compacte et option « Toujours au premier plan » ;
- absence de visuel gérée sans image cassée.

Pour les packages multimédias, le visualiseur suit le temps du **Group Timeline**, ce qui permet de rester synchronisé avec une conduite contenant plusieurs médias simultanés.

## Interface

La ligne permanente de statut/erreur en bas de la fenêtre n'est plus affichée. Un bandeau rouge apparaît uniquement lorsqu'une véritable erreur doit être signalée et peut être fermé.

## Build macOS

Nécessite macOS avec Xcode / Command Line Tools :

```bash
chmod +x build.sh && ./build.sh
```

Le script produit `build/S2A Copilote.app`, signé ad hoc. Aucun abonnement Apple Developer n'est requis pour ce build local.

## Limitation de l'archive fournie avec S2A Pilot Web

Le package source peut être inclus dans un export S2A Pilot. Une application `.app` installable doit toutefois être compilée sur macOS ; elle ne peut pas être produite depuis un environnement Linux sans le SDK macOS.


## Compatibilité

S2A Copilote 1.2.2 accepte les packages S2A Pilot V4/V5 et conserve la compatibilité avec les anciens packages `.showcue.zip`.


## Correctif 1.2.2

- État des médias actifs fiabilisé : un STOP/FONDU global vide la liste des médias actifs.
- Suppression des CUT AUDIO/VIDÉO inutiles après un arrêt global déjà exécuté.
- Les Stops globaux sont nommés explicitement AUDIO / VIDÉO dans QLab.
- Vidéo muette : la sortie audio de la Video Cue est dépatchée (`audio output patch number = 0`), avec fallbacks non bloquants.
