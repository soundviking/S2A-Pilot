# Bridge 1.4.0 — reprise du travail Show et navigation QLab

## Base reprise

La base GitHub était `2a47d27` (Pilot 1.5.7 / Bridge 1.3.4). Le chat **Work S2A Pilot** contenait des modifications locales plus récentes, non publiées, dans un autre checkout : vue Show Maverick, agrandissement des visuels, reconnaissance du workspace et import simplifié avec horloge Wait.

Ces fichiers ont été récupérés sans modifier le checkout d’origine. L’application native simplifiée produite dans le premier tour de ce chat est remplacée par cette base Show. La sauvegarde locale de ce premier essai est conservée hors dépôt, dans `outputs/avant-reprise-work/` du projet Work actuel. Les fichiers synchronisés sous `sources/` n’ont pas été modifiés.

## Changements intégrés

- Vue Show reprenant les styles réels Maverick de Pilot : timeline, Cue active/suivante côte à côte, descriptions et visuels, puis les prochaines Cues.
- Agrandissement d’une image sans recadrage ; retour par clic, bouton Fermer ou Échap. La synchronisation continue pendant le zoom.
- Déroulé global à gauche ; un groupe Pilot reste un numéro, ses repères sont affichés dans le panneau Show. Numéros textuels QLab réels, y compris nombres décimaux et numéros vides.
- Play vert sur les éléments `running && !paused`, indépendamment de la sélection. Halo bleu sur la sélection QLab ; aucun marqueur jaune. Défilement vers la sélection.
- Clic Bridge → `set selected` avec ID unique de workspace et de Cue. Aucune commande GO, start ou déplacement de playback position. QLab → Bridge par lecture de la sélection explicite, ou de playback position si elle est vide.
- Polling et écritures sérialisés. Les résultats antérieurs à un clic et les clics devenus obsolètes après un changement de workspace sont ignorés. Une réponse de polling ne provoque jamais d’écriture.
- Décompte réservé aux conduites Pilot ; caché pour Audio/Vidéo/Network et autres Cues QLab génériques. Compteur « Cue 1/2 » supprimé.
- Correctifs d’import récupérés du chat Work : résolution directe du workspace par ID, vérification d’un premier résultat vide, création des Cues par différence d’identifiants. Un groupe Timeline contient les actions médias et une horloge Wait avec durée persistante en post-wait ; les Memo de repérage restent dans Bridge.
- Horloge lue dans QLab, sans chronomètre indépendant ; pause et déplacements sont conservés, y compris les retours en arrière. La dernière position est figée avec un statut explicite si la synchronisation est perdue. Les anciens index sans `clockID` restent lisibles.
- ZIP autonome Bridge 1.4.0. Les ZIP Pilot 1.5.7 et son installateur embarqué Bridge 1.3.4 restent inchangés. Le catalogue partagé contient les nouveaux libellés Bridge et sa copie générée est cohérente.

## Vérifications effectuées

- Compilation universelle arm64/x86_64 avec macOS 13 minimum et vérification de signature locale.
- `python3 tools/test-bridge-navigation.py` : modèles runtime et workspace de production, décimales locales, lecture/pause, identité stable, retour temporel, réponses invalides, ancien index, imports successifs simulés et absence de bascule vers un autre workspace. Compilation des scripts runtime, sélection et workspace avec le dictionnaire QLab installé, sans les exécuter.
- `tools/test-bridge-show.cjs` : rendu réel des ressources empaquetées dans Chrome à 1 500, 1 100 et 820 px ; colonnes Maverick, sélection/lecture indépendantes ou simultanées, numéros réels, clic transmis par ID, absence d’écho lors des rafraîchissements, défilement sur 80 éléments, pause, retour temporel, perte de synchronisation, décompte masqué hors Pilot, zoom et Échap.
- Vue empaquetée chargée dans une fenêtre WebKit native ; capture inspectée avec timeline, Cues, visuels et déroulé QLab.
- Requête runtime de production exécutée en lecture seule dans le workspace QLab ouvert : cinq éléments et cinq numéros lus et décodés. Aucune sélection, aucun GO et aucune modification de workspace pendant ce contrôle.
- Catalogue FR/EN/ES/DE validé et tests natifs de traduction réussis.

## Validation en conduite encore nécessaire

Dans une copie de spectacle : rejouer groupe + audio + Wait Cue + horloge, contrôler pauses/reprises, départ au milieu et retours temporels, enchaînements de numéros, imports successifs et fermeture/réouverture. Vérifier la sélection des enfants d’un groupe (le déroulé global présente les groupes comme un seul numéro) et les options QLab de suivi de tête/sélection. Le suivi privilégie la sélection explicite ; les options de QLab peuvent dissocier celle-ci du playback position.

Les contrôles automatisés et la lecture réelle du workspace ne remplacent pas ces essais de spectacle. L’exécution sur un Mac Intel physique reste à confirmer.
