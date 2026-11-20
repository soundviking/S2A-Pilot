# Pilot 1.11.6 bêta / Bridge 1.6.33 bêta

- Bridge : le champ de description générale est masqué lorsque les indications par type sont disponibles, sans suppression des textes enregistrés.
- En préparation d’un numéro Bridge, Copilot déplie la première sous-cue visible, y compris si elle commence à 00:00. La cue 2 n’est plus sélectionnée à tort.
- Les filtres de types restent respectés. En lecture et en pause, le décompte continue de viser la cue suivante ; la préparation ne modifie aucune commande QLab.
- Bridge Show : fin probable du spectacle entre parenthèses après la fin du numéro, calculée à partir du temps restant puis des numéros Pilot et musiques/vidéos QLab suivants ; les contrôles et musiques déjà passées sont exclus.
- Bridge Show : la fin estimée affiche uniquement l’heure, sans les mentions « hors attente GO » ou « si reprise maintenant ».
- Bridge Show : le crayon reste ancré en haut à droite de chaque vignette, y compris sur la cue suivante qui contient le décompte. Les dimensions des vignettes sont conservées.

Validation : scénario de capture à 00:00 / 01:32, pointeur suivant périmé, démarrage GO, pause et filtrage par type. Les tests de halo unique et de suivi restent passants.
