# S2A Pilot / Bridge 1.6.1 bêta

Cette livraison bêta conserve les évolutions 1.6.0 et ajoute le retour visuel demandé pendant l’arrêt Échap. Branche : `beta/copilot-qr`. Pilot stable 1.5.8 et Bridge stable 1.4.5 restent inchangés.

## Halo de fondu manuel

- Échap conserve le fondu audio de trois secondes.
- Pendant ce fondu, un contour lumineux progresse autour de GO depuis le centre supérieur, dans le sens horaire. Son tracé suit le même temps que la diminution du gain audio, sans animation indépendante.
- GO reste verrouillé pendant le fondu. À la fin ou lors d’une annulation, le contour disparaît. Un retour au début le réinitialise immédiatement.
- Le contour est réservé au mode Manuel ; le comportement Autopilote est conservé.

## Version et livraison

- Version affichée, métadonnées, caches et nom des archives : 1.6.1 bêta.
- Bridge inclus dans les exports : 1.6.1, build interne 16101, application universelle arm64/x86_64, signature locale vérifiée. Les exigences minimales des anciens formats restent inchangées.
- Archives dans `downloads/beta/1.6.1/`. Prévisualisation locale habituelle sur le port 8918.

## Validation

`tools/test-manual-fade-halo.cjs` passe dans Chrome et WebKit : progression réellement dessinée, synchronisation avec le gain audio, fin du fondu, annulation, verrou GO, absence en Autopilote et métadonnées Pilot/Bridge. Inspection visuelle effectuée ; archives ZIP contrôlées. Essai matériel iPad encore nécessaire.

## Ajustements après l’enregistrement utilisateur

- Au GO, le lecteur est désormais rechargé avec `load()` pour réinitialiser le décodeur et les données déjà en file d’attente. Le volume reste coupé jusqu’au nouveau chargement des métadonnées, au déplacement vers le point d’entrée et à la confirmation de lecture. Cela couvre aussi les MP3 ; le test initial en WAV ne suffisait pas à reproduire les conditions de Safari.
- Le préchargement périodique ne remplace plus une source audio/vidéo active pendant son démarrage.
- La position de conduite suit la musique pendant les trois secondes du fondu, puis reste sur la position d’arrêt.
- Le mode Manuel prend le nom visible « Mode Go » (type interne `manual` conservé pour la compatibilité des projets).
- En Show, les Cues principales et leurs sous-Cues sont regroupées, même avec des horaires qui se chevauchent. Les principales portent la mention « Principale · GO » ; les sous-Cues sont numérotées 1.1, 1.2… et présentent un retrait et des branches de liaison. L’Autopilote conserve son affichage chronologique.

Vérifications : redémarrage A/Échap/B/Échap/A en MP3 dans Chrome et WebKit, réinitialisation native observée, gain coupé pendant un déplacement retardé ; halo et annulation vérifiés dans WebKit ; test `tools/test-go-show-tree.cjs` pour l’arborescence, la numérotation, la sélection des principales et les petits écrans. Une confirmation avec les fichiers réels dans Safari reste nécessaire avant de déclarer le problème sonore définitivement résolu.

## Arborescence également en Edit

Le Mode Go partage désormais l’ordre d’affichage des Cues entre Edit et Show : principales regroupées avec leurs sous-Cues, branches visuelles et numéros 1 / 1.1 / 1.2. La sélection d’une sous-Cue en Edit continue de mettre son repère en surbrillance dans la timeline. L’Autopilote restaure l’ordre chronologique plat et les numéros 1, 2, 3… dans les deux vues. Cette présentation ne modifie ni les identifiants ni les temps ni les liens enregistrés.

Le test `tools/test-go-show-tree.cjs` passe dans Chrome et WebKit : regroupement avec chevauchement d’horaires, numérotation Edit/Show, bascule Autopilote et retour, conservation des données, sélection du marqueur et absence de débordement aux largeurs 1024 / 768 / 390 px.

## Retour Edit du 2 novembre — traité le 3 novembre

Retour utilisateur du 2 novembre 2026 : le comportement de la touche Échap en mode Edit ne fonctionne pas correctement. Vérifier notamment le rendu et le dimensionnement du halo de fondu autour du bouton GO, dont la taille diffère du mode Show ; le lien avec ce dimensionnement reste une hypothèse à confirmer. L’utilisateur demande de traiter ce point lors de la prochaine modification, sans correction immédiate.

## Nettoyage et correction Edit — 3 novembre 2026

- Échap déclenche le fondu depuis les champs de titre et de description, sans modifier le texte. Les dialogues conservent la priorité : Échap les ferme d’abord.
- Le contour de GO utilise sa taille et son rayon réels ; il suit les changements de dimensions pendant le fondu.
- Suppression d’un rafraîchissement Show effectué deux fois par mise à jour du transport.
- Cache commun des parents, enfants, numéros et médias, invalidé lors des modifications du projet. Suppression de code d’édition inaccessible.
- Mesure ciblée sur 600 Cues (60 principales, neuf enfants chacune, cinq échantillons de dix parcours) : médiane de 61,5 ms avant à 0,9 ms après, checksum identique 136500. Ce microbenchmark ne mesure pas la fluidité globale ni les performances sur iPad.

Vérifications : `tools/test-edit-escape.cjs` et `tools/test-go-show-tree.cjs` dans Chrome/WebKit, redémarrage MP3 après Échap et export PDF/ZIP avec Bridge inclus. La version reste 1.6.1 bêta.
