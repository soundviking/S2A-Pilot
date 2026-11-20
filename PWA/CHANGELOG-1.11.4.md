# Pilot 1.11.4 bêta / Bridge 1.6.31 bêta

- Correction Bridge Show : une pulsation par seconde, calée sur les secondes du décompte ; les halos de la cue suivante et du décompte utilisent la même phase.
- Fin estimée : utilise uniquement la durée restante du numéro affiché, sans additionner les numéros suivants du workspace QLab.
- Copilot depuis Bridge : sans cue en lecture ou en pause, la sélection QLab sert de prévisualisation avec la timeline du numéro sélectionné. Lecture et pause conservent la priorité absolue ; Pilot seul reste inchangé.
- Les rafraîchissements QLab ne déplacent plus le bloc décompte et ne peuvent plus relancer son animation.
- Arrêt de la pulsation en pause, hors des dix dernières secondes et en cas de perte de synchronisation. Le mode de réduction des animations reste respecté.

Tests : pics sur les secondes, creux entre deux secondes, stabilité du bloc pendant douze rafraîchissements, changement de cue, pause et perte de connexion. Compilation universelle macOS et signature vérifiées par le workflow bêta.
