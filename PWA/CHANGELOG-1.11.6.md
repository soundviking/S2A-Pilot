# Pilot 1.11.6 bêta / Bridge 1.6.32 inchangé

- En préparation d’un numéro Bridge, Copilot déplie la première sous-cue visible, y compris si elle commence à 00:00. La cue 2 n’est plus sélectionnée à tort.
- Les filtres de types restent respectés. En lecture et en pause, le décompte continue de viser la cue suivante ; la préparation ne modifie aucune commande QLab.
- Correctif côté Copilot uniquement : aucune réinstallation de Bridge 1.6.32 n’est nécessaire.

Validation : scénario de capture à 00:00 / 01:32, pointeur suivant périmé, démarrage GO, pause et filtrage par type. Les tests de halo unique et de suivi restent passants.
