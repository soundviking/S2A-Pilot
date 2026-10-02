# S2A Pilot — V1.4.1 PWA

Cette version est installable et utilisable hors ligne après une première ouverture en ligne.

## Déploiement
Copier ensemble sur le serveur :
- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- le dossier `icons/`

Le site doit être servi en **HTTPS**.

## iPad / iPhone
Ouvrir dans Safari → Partager → Sur l’écran d’accueil.

## Chrome / Android / ordinateur
Utiliser le bouton « Installer » lorsque le navigateur le propose.

## Hors ligne
Après la première ouverture, l’interface est mise en cache par le service worker.
Les projets et médias autosauvegardés restent dans IndexedDB, localement sur chaque appareil/navigateur.

Chaque appareil doit ouvrir S2A Pilot au moins une première fois avec Internet.


## V1.1.1 — audio sur iPad
Le sélecteur accepte explicitement MP3, M4A, AAC, WAV, AIFF, FLAC et OGG.
Sur iPad/iPhone, sélectionne le fichier audio depuis l’app Fichiers. Les morceaux uniquement présents dans Apple Music ne sont pas exposés à Safari comme fichiers locaux importables.


## V1.1.2 — correction chargement audio iPad
- Normalisation du type MIME à partir de l’extension du fichier.
- Reconstruction du Blob audio avec un type standard compatible Safari lorsque nécessaire.
- Message explicite si le codec audio n’est pas décodable par Safari.

### Correctif technique V1.1.3
- Sur iPad, la sortie vidéo externe est volontairement désactivée pour éviter le plein écran bloquant.
- Un monitoring vidéo intégré reste disponible et synchronisé avec la lecture/timeline.
- Sur Mac/PC, la sortie vidéo externe reste disponible en plus du monitoring.


### Correctif technique V1.1.6
- export vidéo maintenu disponible après un premier export ;
- package QLab version 2 compatible audio ou vidéo comme média principal ;
- destiné à S2A Copilote 1.1 pour l’import des Video cues.


## Interface 1.1.6
- En-tête compact avec état Mode édition / Mode show.
- Logos déplacés en pied de page.
- Zone projet resserrée.
- Monitoring vidéo fermé par défaut et ouvert uniquement à la demande.


## Interface 1.1.7
- Monitoring vidéo automatique dès qu’une vidéo est chargée.
- En mode édition, aperçu intégré à droite de la box média.
- En mode show, monitoring vidéo conservé sous la timeline.
- Suppression des boutons Agrandir/Réduire l’aperçu.
- Footer simplifié : logo S2A Production uniquement, affiché en ratio 2:1.

## Correctif 1.1.8
- Restaure le lecteur vidéo principal supprimé par erreur dans la 1.1.7.
- Le choix d'une vidéo réactive Lecture, Nouveau TOP et Export.
- Le monitoring reste automatique à droite en édition et sous la timeline en mode show.

## Ajustements 1.1.9
- Footer S2A réduit à 80 × 40 px, entre les deux tailles précédentes.
- Bouton Mode édition / Mode show vérifié et fiabilisé après validation ou annulation du PIN.

## Interface 1.1.10
- « Choisir un média » déplacé dans l’en-tête, à gauche de « Mode édition ».
- « Mode édition / Mode show » sur fond rouge.
- Box média masquée au démarrage et pour l’audio ; elle apparaît avec une vidéo.
- Sortie vidéo : grand bouton rectangulaire à icône écran, sans texte visible.

## Correctifs 1.1.11
- Import des projets vidéo seuls corrigé : l'audio n'est plus obligatoire.
- Le média principal importé, audio ou vidéo, est maintenant validé correctement.
- Icône de sortie vidéo remplacée par un symbole de recopie d'écran à deux écrans superposés.
- Bouton centré horizontalement et verticalement dans la partie gauche de la box vidéo.
- Texte du nom de la vidéo supprimé visuellement de la box.

## Ajustements 1.1.12
- Monitoring vidéo réduit exactement à 110 × 64 px, comme les vignettes TOP.
- Même taille de monitoring en édition et en mode show.
- Vérification desktop/Mac : monitoring visible et bouton de sortie vidéo actif.
- Vérification iPad/iPadOS : monitoring local visible, sortie vidéo externe désactivée.
- Sur iPad, un texte explicatif est affiché sous le bouton de sortie vidéo.

## Ajustement 1.1.13
- Moniteur vidéo corrigé à exactement 360 × 180 px en mode édition.
- Moniteur vidéo corrigé à exactement 360 × 180 px en mode show.
- Comportement iPad conservé : monitoring local actif, sortie vidéo externe désactivée et texte explicatif affiché.

## Ajustement 1.1.14
- Mode édition : moniteur de 360 px de large avec ratio exact 16:9 (360 × 202,5 px).
- Mode show : moniteur sur toute la largeur intérieure de la box, ratio 16:9.
- Comportement iPad conservé : monitoring local actif, sortie externe désactivée et texte explicatif affiché.

## Ajustement 1.1.15
- La box vidéo porte désormais le titre « MONITOR VIDÉO » en mode édition.
- Le même titre « MONITOR VIDÉO » apparaît dans la box de monitoring en mode show.
- Dimensions et comportement vidéo/iPad de la 1.1.14 conservés.


## V1.1.17

- logo S2A Production déplacé dans le header et footer supprimé ;
- titre compact : `S2A Pilot (by S2A Production)` ;
- monitor vidéo du mode Show réduit de 20 %, toujours en 16:9 ;
- tri automatique des TOPS selon leur position temporelle ;
- renumérotation automatique des noms par défaut `TOP 1`, `TOP 2`, etc. après réorganisation ;
- les noms personnalisés de TOPS sont conservés.


## V1.1.18

- ajout d'un pavé numérique visuel pour définir et saisir le code PIN ;
- saisie tactile directe des chiffres 0 à 9 ;
- boutons effacement complet et retour arrière ;
- le clavier logiciel n'est plus nécessaire pour le code PIN ;
- le code reste strictement limité à 4 chiffres.


## V1.1.19

- correction du header : le logo affiché est désormais le logo de l'application S2A Pilot, et non le logo S2A Production.


## V1.1.20

- le bouton de mode affiche le mode de destination : `Mode show` en édition et `Mode édition` en show ;
- suppression de `Restaurer la sauvegarde locale` et de son horodatage visible ;
- `Ouvrir un projet`, `Enregistrer` et `Enregistrer sous…` sont regroupés dans la zone projet ;
- suppression de la box inférieure d'export et du bouton `Effacer tous les tops` ;
- sur les navigateurs prenant en charge File System Access, `Enregistrer` réécrit le projet ouvert/créé au même emplacement ;
- sur Safari/iPadOS, l'écriture directe dans un fichier existant n'étant pas disponible, un téléchargement reste utilisé en solution de compatibilité.


## V1.1.21

- ajout de `Annuler` et `Rétablir` avec un historique de 100 états d'édition ;
- raccourcis clavier `⌘/Ctrl+Z` et `⇧⌘/Ctrl+Z` ;
- ajout, suppression, déplacement et modification des TOPS, images et titre peuvent être annulés/rétablis ;
- suppression complète du code PIN et du pavé numérique ;
- passage Mode show / Mode édition immédiat, sans code ;
- tous les temps visibles sont affichés au dixième de seconde (`MM:SS.d`) ;
- les temps de TOPS sont normalisés au dixième lors de la saisie, du déplacement, de l'import et de l'export.


## V1.1.22
- boutons Annuler/Rétablir carrés à icônes seules ;
- `Cue` remplace `TOP` dans l'interface ;
- nouveau projet : `Cue 1` à `00:00.0` ;
- `CUE ACTIVE` au-dessus de `PROCHAINE CUE` en mode Show ;
- assombrissement progressif du visuel de la Cue active jusqu'à la Cue suivante ;
- temps maintenus au dixième (`MM:SS.d`).

## V1.1.23

- Cue 1 de base permanente à `00:00.0`, non supprimable et non déplaçable.
- Garantie d'une Cue de base à l'ouverture/import/restauration d'un projet.
- Zone de description pour chaque Cue, sauvegardée dans le projet et prise en charge par annuler/rétablir.
- Description affichée en mode show pour la Cue active et la prochaine Cue.
- Carte Cue active agrandie ; carte Prochaine Cue légèrement compactée en conservant un décompte très lisible.

## V1.1.24

- Mode show : vignette de la Cue active réduite de 20 %, toujours en 16:9.
- Prochaine Cue : vignette forcée en 16:9 et décompte affiché sans le mot « dans ».
- Aide de saisie corrigée au format dixième `mm:ss.m`.
- Nouveau bouton **Fiche technique PDF** dans les actions du projet : export local de la conduite avec titre, Cues, temps, descriptions et aperçus.

## V1.1.25

- `Enregistrer` sauvegarde désormais le projet de travail localement sans reconstruire ni télécharger le package ZIP complet.
- Les médias lourds sont stockés séparément dans IndexedDB et réutilisés par les sauvegardes de métadonnées ; une demande de stockage persistant est effectuée quand le navigateur la prend en charge.
- `Enregistrer sous…` crée explicitement le package `.s2apilot.zip` portable complet avec le média, pour transfert ou import QLab.
- Un ZIP ouvert est importé dans l'espace de travail local ; le fichier source n'est jamais présenté comme réécrit sur Safari/iPadOS.
- Restauration automatique du dernier espace de travail local au redémarrage lorsque le stockage navigateur est toujours disponible.
- La carte `PROCHAINE CUE` est masquée en mode édition.
- En mode show, la vignette de la prochaine Cue est réduite de 10 %, reste en 16:9 et ne déborde plus de sa carte.
- Correction de l'export PDF (`ensureBaseCueInvariant`) et conservation des titres, temps, descriptions et aperçus.


## V1.1.26 — fiche technique et finition du mode Show
- Fiche technique PDF entièrement remise en page : en-tête, cartes de Cues, colonnes mieux alignées, visuels 16:9 et pagination.
- Normalisation Unicode NFC avant génération PDF pour conserver correctement les accents français.
- Pied de page PDF : « Créé avec S2A Pilot by S2A Production » et pagination.
- Correction de l’affichage « Fin de conduite » après la dernière Cue : plus de vignette/texte d’image cassé.
- Bouton « Mode show » vert en mode édition ; bouton « Mode édition » rouge lorsque le mode Show est actif.
- Icônes Annuler/Rétablir remplacées par des pictogrammes SVG contemporains.


## V1.2.0 — conduite multimédia par Cue

- Au démarrage, choix entre reprendre le dernier projet local et démarrer un nouveau projet.
- Le média n'est plus global : chaque Cue peut déclencher zéro, un ou plusieurs médias audio/vidéo.
- Audio : transition CUT ou FONDU avec durée réglable. Le fondu croise l'ancien et le nouveau média.
- Vidéo : lecture indépendante de l'audio, avec choix muette / son actif. Une vidéo muette peut donc être projetée pendant qu'une musique continue.
- Le chronomètre de conduite est indépendant des fichiers média.
- Les médias sont conservés séparément dans IndexedDB et ne sont pas recompilés lors d'un simple Enregistrer.
- Enregistrer sous… produit un package multimédia S2A Pilot v3 contenant la conduite et tous les médias.
- Import rétrocompatible avec les packages v2 (média principal converti en action de la Cue de base).



## V1.3.0 — éditeur média et durée de conduite

- Durée de conduite indépendante des fichiers : calcul automatique à **+3 minutes après la fin du dernier média non bouclé**, avec durée totale modifiable manuellement et retour au mode automatique.
- Chaque média dispose de points **IN / OUT** au dixième de seconde.
- Les médias audio affichent une **waveform** générée localement ; les vidéos affichent une **pellicule de vignettes** pour faciliter le placement des points IN/OUT.
- Option **Loop** par média, limitée aux points IN/OUT.
- Nouvelle action de Cue **STOP TOUS LES MÉDIAS**.
- Le moteur de lecture, les seeks et la sortie vidéo tiennent compte des points IN/OUT, des boucles et des actions STOP.
- Le format de projet passe en version 4 tout en conservant l'import des projets multimédias V3 et des anciens projets.
- Les données restent structurées par actions afin de conserver une traduction possible vers S2A Copilote (Audio/Video/Fade/Stop/Group Cues).
- Suppression du texte d'aide de saisie sous la liste des Cues.


## V1.2.2 — sortie vidéo simplifiée

- Suppression complète du moniteur vidéo intégré à l’interface : la vidéo destinée à la diffusion n’est plus dupliquée dans une box de monitoring.
- La sortie vidéo externe reste préparée sur noir depuis le mode édition.
- Dans la fenêtre de sortie vidéo, un clic/toucher passe en plein écran ; un nouveau clic/toucher en plein écran en sort.
- Le préchargement média, la conduite multimédia et la resynchronisation de la V1.2.1 sont conservés.

## V1.2.1 — fiabilité de conduite et interface

- Préflight « Préparer le show » : les médias de toutes les Cues sont préparés avant la conduite et leur état Prêt/Erreur est visible.
- La sortie vidéo peut être ouverte dès le mode édition ; elle reste sur noir jusqu’au déclenchement d’une vidéo.
- Le passage d’une Cue sans nouvelle action média ne reconstruit plus les lecteurs audio/vidéo actifs.
- Les actions média sont déclenchées de façon incrémentale pendant la lecture afin d’éviter les coupures provoquées par la reconstruction complète du moteur à chaque Cue.
- Le déplacement sur la timeline pendant la lecture conserve l’état Lecture et resynchronise les médias au nouvel instant.
- Les Cues du mode édition sont compactes et dépliables en accordéon ; une seule Cue est ouverte à la fois et « Tout réduire » permet de retrouver rapidement une vue d’ensemble.

## V1.3.1 — correctifs de fiabilité

- Correction du Loop : rebouclage fiable de OUT vers IN, y compris lorsque OUT correspond à la fin physique du fichier.
- Pause prioritaire : une commande Pause invalide les opérations de lecture/resynchronisation asynchrones encore en cours afin qu'elles ne puissent pas relancer un média après la pause.
- Mode Show : lorsqu'une Cue active n'a pas de visuel, la grande zone 16:9 vide n'est plus affichée.



## V1.3.3 — conduite, export et companion

- Mode Show : une Cue sans visuel affiche un cadre noir 16:9 propre avec « Aucun visuel pour cette Cue », sans balise image cassée ni texte alternatif parasite.
- Durée automatique de conduite : **fin du dernier média fini + 10 secondes** au lieu de +3 minutes ; le réglage manuel reste prioritaire.
- Action **ARRÊT / FONDU TOUS LES MÉDIAS** : choix CUT ou FONDU avec durée réglable. Le fondu global baisse les audios et fond la vidéo vers le noir avant arrêt.
- Démarrage : suppression du pop-up Reprendre/Nouveau. Le dernier projet local est repris automatiquement et les boutons **Reprendre la dernière sauvegarde** / **Nouveau projet** restent disponibles dans la box Projet.
- Protection d'interface contre l'overscroll vertical afin de limiter les rechargements involontaires sur appareils tactiles.
- `Enregistrer sous…` crée un package V5 contenant la conduite, les médias, les visuels, la **fiche technique PDF**, un LISEZ-MOI technicien et le package source **S2A Copilote 1.2**.
- Le manifest exporte aussi la durée de conduite résolue (`showDuration`) pour que le companion QLab reproduise la fin de timeline, y compris le silence final.
- S2A Copilote 1.2 prend en charge les packages V4/V5, les médias multiples, IN/OUT, Loop, audio CUT/FONDU, vidéo muette, arrêt/fondu global et conserve le visualiseur intégré.


## V1.3.4 — stabilisation interface et arrêt global

- Box Projet simplifiée : Nouveau, Ouvrir, Enregistrer, Enregistrer sous…, Fiche technique PDF.
- Suppression du bouton « Reprendre la dernière sauvegarde » : la dernière sauvegarde locale reste restaurée automatiquement au chargement.
- Correction du bouton Lecture/Pause sous Safari : son contenu n’est plus remplacé à chaque frame et toute sa surface reste cliquable/touchable.
- Arrêt/Fondu tous les médias : le CUT arrête audio + vidéo immédiatement ; le FONDU baisse l’audio puis arrête aussi la vidéo et remet la sortie vidéo au noir à la fin.
- Hiérarchie visuelle des titres de sections renforcée sans concurrencer le titre de la Cue.


## V1.3.5 — timeline et durée automatique

- Retour du décompte rouge pendant les 10 dernières secondes avant la prochaine Cue en mode Show.
- Le calcul **Auto +10 s** utilise la fin effective la plus tardive de tous les médias : durée utile IN/OUT, remplacement par un média ultérieur, CUT/FONDU global et boucles arrêtées sont pris en compte.
- En mode édition, la préparation du show et la timeline sont réunies dans une seule carte **PRÉPARATION DU SHOW**.
- En mode Show, la même carte est titrée **TIMELINE**.
- Lecture/Pause, hiérarchie visuelle des titres et fiche technique PDF restent inchangés par rapport à la V1.3.4.


## V1.4.0 — nouvelle identité S2A Pilot

- Nouveau nom public : **S2A Pilot**.
- Nouvelle icône Pilot issue du visuel validé S2A Production.
- Le companion macOS devient **S2A Copilote 1.2** avec son identité dédiée.
- Les exports portables utilisent désormais `.s2apilot.zip` et incluent le source S2A Copilote 1.2.
- Compatibilité conservée avec les anciens packages `.showcue.zip` et les formats internes V4/V5.
- En mode édition, les commandes de transport restent au-dessus de la timeline ; la durée de conduite / Auto +10 s est désormais placée sous la timeline ; le texte d’aide sous la timeline est supprimé.


## V1.4.1 — sélection Cue / timeline

- Une Cue ouverte dans la liste est maintenant mise en surbrillance sur la timeline.
- Un clic sur un marqueur de timeline ouvre/sélectionne la Cue correspondante.
- Le glisser-déposer des marqueurs reste disponible pour modifier l'horaire.
- Le package exporté embarque le source S2A Copilote 1.2.2.
