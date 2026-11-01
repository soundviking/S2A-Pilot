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
