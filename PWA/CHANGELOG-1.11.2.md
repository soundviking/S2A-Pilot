# Pilot 1.11.2 bêta — correction Copilot

- Un seul halo : la sous-cue active a priorité sur sa cue principale. Sans sous-cue active, la principale courante est mise en évidence.
- Le suivi vertical ne se déclenche qu'au changement de cue ou de sous-cue active. Mise à jour d'horloge, sélection QLab, reconstruction de la liste, vue compacte et redimensionnement mobile conservent la position manuelle.
- L'écart de 20 pixels sous le bloc fixe est conservé.
- Le contrôle par code de Pilot 1.11.1 est conservé.

Bridge reste en 1.6.29, inchangé. La télécommande QLab directement depuis Bridge nécessite encore une extension de son moteur natif. Les archives reçues contiennent le .app compilé, sans les fichiers Swift permettant cette extension. Cette livraison ne prétend pas activer cette fonction.

Validation : tests DOM couvrant parent et sous-cue simultanés, transition entre sous-cues et principales, sélection QLab, changement de descriptions, horloge, redimensionnement et vue compacte. Tests de l'interface du code télécommande et d'Iceman conservés.
