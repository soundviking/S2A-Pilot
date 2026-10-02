# ShowCue by S2A Production — V1.1 PWA

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

Chaque appareil doit ouvrir ShowCue au moins une première fois avec Internet.


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
- destiné à ShowCue for QLab 1.1 pour l’import des Video cues.


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
