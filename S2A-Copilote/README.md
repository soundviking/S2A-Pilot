## Mise à jour Copilote 1.2.5 / Pilot 1.4.13

## Installer S2A Copilote si macOS bloque son ouverture

L’application est signée localement et n’est pas notariée par Apple. Après décompression, glisser **S2A Copilote.app** dans **Applications**, puis essayer de l’ouvrir une première fois.

1. Si macOS la bloque, fermer le message et ouvrir **Réglages Système → Confidentialité et sécurité**.
2. Descendre jusqu’à **Sécurité** et cliquer sur **Ouvrir quand même** pour **S2A Copilote**.
3. Valider avec le mot de passe ou Touch ID si demandé, puis confirmer **Ouvrir**.

Le bouton apparaît après la tentative d’ouverture. S’il a disparu, essayer à nouveau d’ouvrir l’application puis revenir dans ces réglages. Une nouvelle version peut demander une nouvelle autorisation. Autoriser l’application téléchargée depuis ce dépôt officiel. [Procédure Apple](https://support.apple.com/fr-fr/102445).

Lors du premier import, autoriser aussi le contrôle de **QLab** : il s’agit d’une permission distincte. Une notice accompagne l’application dans le ZIP macOS et dans chaque projet exporté (`companion/INSTALLATION.txt`).


Le logo bleu et orange de Copilote est restauré. Dans la fenêtre, ses angles sont arrondis. Pour les prochains imports QLab, le groupe conserve son numéro (par exemple 5) et les étapes internes sont numérotées 5.1, 5.2, 5.3, etc. Les numéros déjà utilisés ailleurs sont évités ; les anciennes conduites ne sont pas modifiées.

L’application macOS universelle contient les architectures Intel et Apple Silicon et est incluse directement dans les ZIP des projets. Les tests automatisés valident la numérotation, les scripts d’import, les imports multiples simulés et la compilation. Un import dans un workspace QLab réel reste à essayer.

# S2A Copilote 1.2.5

Companion macOS pour importer un package S2A Pilot dans QLab 5 et afficher le visualiseur de conduite.

## Distribution universelle 1.2.5

L’application est désormais compilée pour **Intel (x86_64) et Apple Silicon (arm64)** dans le même exécutable universel, pour macOS 13 ou plus récent. Chaque ZIP de projet enregistré avec S2A Pilot 1.4.13 contient directement **companion/S2A Copilote.app** et une notice d’installation : glisser l’application dans Applications, sans compiler ni décompresser une deuxième archive. Les permissions de l’exécutable sont conservées.

Les deux architectures et la signature locale ont été vérifiées. L’application extraite d’un ZIP produit par la PWA est également contrôlée par signature et comparaison des fichiers avec le build original. Le fonctionnement natif sur un Mac Intel physique reste à essayer ; le build a été réalisé sur Apple Silicon.

## Nouveautés 1.2.3

- Identité **S2A Copilote** et nouveau logo S2A Pilot, dans la fenêtre et l’icône macOS.
- Détection automatique des workspaces QLab ouverts toutes les 3 secondes, en arrière-plan. QLab n’est pas lancé lorsque l’application est fermée. Une seule vérification à la fois ; aucune vérification pendant un import.
- Menu déroulant si plusieurs workspaces sont ouverts. La sélection reste stable, même si un autre workspace passe au premier plan. Import et visualiseur utilisent le workspace choisi.
- Aucun bandeau rouge pour l’état normal « Aucun workspace ». Les véritables erreurs (permission refusée, import invalide…) sont conservées et peuvent être masquées.
- Ajout de plusieurs packages en une sélection, ou successivement. Chaque conduite devient son propre groupe Timeline. Les fichiers sont isolés par import et par média, y compris pour deux titres ou noms de médias identiques.
- Les packages importés avec succès quittent la file au fur et à mesure ; en cas d’échec partiel, seuls les packages restants sont à réessayer.
- Index distincts par workspace, avec lecture des anciens index pour compatibilité.

### Installation et validation

L’archive macOS fournie contient l’application compilée pour **Mac Intel et Apple Silicon**, macOS 13 ou plus récent, avec signature locale ad hoc. Décompresser puis placer **S2A Copilote.app** dans Applications en remplaçant l’ancienne version. Vérifier que le raccourci utilisé ouvre bien cette nouvelle version 1.2.5. L’application n’est pas notarialisée par Apple. Les deux architectures sont déjà incluses.

Compilation et signature vérifiées sur ce Mac. Tests du modèle avec workspaces simulés et deux vrais packages : détection à vide sans bandeau, stabilité de la sélection, reconnexion, erreur affichée une seule fois, extraction multiple, création de fichiers distincts pour titres identiques, index et scripts dirigés vers la bonne cible. Syntaxe des scripts d’import contrôlée avec le dictionnaire QLab installé.

À essayer dans QLab sur des workspaces de test : ouverture/fermeture automatique, choix entre deux workspaces, autorisation macOS d’automatisation, import simultané de plusieurs conduites et lecture/visualiseur. Aucun workspace utilisateur n’a été modifié pendant les tests ; l’import final dans QLab reste à valider sur votre configuration.

## Compatibilité S2A Pilot actuelle

La version 1.2.5 accepte les packages multimédias S2A Pilot V4/V5 et conserve l'import des anciens packages à média principal.

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
- marqueur `FIN DE CONDUITE S2A PILOT` à la durée totale exportée par S2A Pilot.

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

S2A Copilote 1.2.5 accepte les packages S2A Pilot V4/V5 et conserve la compatibilité avec les anciens packages `.showcue.zip`.


## Correctif historique 1.2.2

- État des médias actifs fiabilisé : un STOP/FONDU global vide la liste des médias actifs.
- Suppression des CUT AUDIO/VIDÉO inutiles après un arrêt global déjà exécuté.
- Les Stops globaux sont nommés explicitement AUDIO / VIDÉO dans QLab.
- Vidéo muette : la sortie audio de la Video Cue est dépatchée (`audio output patch number = 0`), avec fallbacks non bloquants.
