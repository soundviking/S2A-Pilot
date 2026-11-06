# Modes d’emploi illustrés

Édition 1.0, thème orange, 35 pages par langue. Les captures représentent Pilot dans Safari Mac ; les parcours Bridge sont des schémas explicitement légendés.

- [Français](S2A-Pilot-et-Bridge-fr.pdf)
- [English](S2A-Pilot-et-Bridge-en.pdf)
- [Español](S2A-Pilot-et-Bridge-es.pdf)
- [Deutsch](S2A-Pilot-et-Bridge-de.pdf)

Le lien de l’aide Pilot choisit automatiquement la langue de l’interface. Ces PDF restent hors du dossier PWA et des exports ZIP de conduite. Ils sont téléchargés à la demande depuis le dépôt GitHub.

`sources/` conserve le catalogue des textes français, leurs traductions, le générateur et les validations. Le générateur utilise les captures maîtres de l’édition française et les captures Safari localisées, conservées séparément dans le dossier de travail du manuel. Les noms et descriptions de la conduite de démonstration sont des données utilisateur et restent volontairement identiques entre captures.

## Complément Flic de la bêta 1.6.4

Les PDF stables ci-dessus restent intacts. `tools/build-beta-manuals.py` leur ajoute une page localisée de configuration Flic (FR/EN/ES/DE) et produit les éditions bêta dans `PWA/manual/`. La bêta ouvre ces copies locales depuis son aide ; elles sont incluses dans les paquets et chargées à la demande, sans dépendre de la branche principale GitHub.
