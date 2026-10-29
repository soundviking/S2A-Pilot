# S2A Pilot / Bridge 1.6.0 bêta — bilan local

Branche : `beta/copilot-qr`. Base bêta : `0698e14`. La branche `main` reste à `a3ce40a85b991c001a0958b6d235458dd584b2c8`. Aucun push, aucune release stable et aucun déploiement réalisés.

Les versions stables restent Pilot 1.5.8 et Bridge 1.4.5. Les quatre vidéos de prise en main et le logo officiel arrondi sont conservés.

## Tester les fichiers

- Pilot : `downloads/beta/1.6.0/S2A-Pilot-1.6.0-beta-PWA.zip`.
- Dossier Pilot décompressé : `downloads/beta/1.6.0/PWA/`.
- Bridge : `downloads/beta/1.6.0/S2A-Pilot-Bridge-1.6.0-beta-macOS-Universel.zip`.
- Application locale : `S2A-Copilot/build-beta/S2A Pilot Bridge.app`.
- Prévisualisation locale de cette session : `http://127.0.0.1:8918/` tant que le serveur reste ouvert.

Conserver Bridge bêta dans son dossier de test ; ne pas remplacer l’application stable dans Applications. Pour un hébergement ultérieur, utiliser un répertoire séparé, par exemple `/S2A-Pilot-beta/1.6.0/`, après accord. Le fichier ZIP Pilot contient déjà Bridge 1.6.0 pour les exports de conduites.

La bêta utilise une base IndexedDB distincte (`s2a-pilot-beta-1-6`), une identité PWA distincte et un identifiant d’application macOS distinct. Importer un ZIP d’un projet stable pour le tester ; son brouillon stable n’est pas récupéré ni modifié automatiquement.

## Utilisation

Dans Edit, choisir **Type de conduite : Autopilote / Manuel**. Ce choix est enregistré avec le projet et dans l’historique Annuler/Rétablir. Les projets sans propriété `conductType` restent Autopilote. Maverick / Iceman restent indépendants.

En Manuel, toute Cue contenant de l’audio est une musique principale nécessitant GO. Une musique principale contient un seul fichier audio. Ses autres repères sont des tops liés par `parentMusicId` et `relativeTime`. Les données restent dans la même liste de Cues, avec leur position chronologique `time` ; aucun second format n’est créé.

Les tops peuvent être ajoutés depuis la musique ou à la tête de lecture du morceau, déplacés sur la waveform, rattachés à une musique et ajustés par temps relatif. Le nom, la description et le visuel restent éditables dans les contrôles existants. Les accents de Manuel sont violets ; le fond et le logo restent ceux de Pilot.

La barre Espace et le bouton GO lancent la musique suivante. Pendant une musique, GO abandonne les tops restants et effectue un crossfade de trois secondes. Le moteur suit le temps audio réellement lu. Les répétitions clavier et les GO espacés de moins de 500 ms sont ignorés ; un GO pendant une préparation est également protégé. À la fin du morceau, le dernier top reste visible, la conduite attend GO et ne compte pas vers la musique suivante. Le bouton retour au début réinitialise la séquence.

Les médias sont préchargés en arrière-plan et à l’entrée en Show. Le bouton GO attend leur disponibilité. Si un GO clavier arrive avant la fin du chargement, il prépare les médias et demande un nouvel appui ; cela évite de démarrer le son hors du geste utilisateur sur Safari. Une erreur de départ ne saute pas la musique.

## Rattachements et passage entre types

Lors du passage en Manuel, un top non rattaché est associé automatiquement uniquement si une seule musique couvre sa position. En cas de silence entre deux musiques, de chevauchement ambigu, de parent absent ou de temps relatif invalide, Edit demande de choisir explicitement une musique et un temps. Le GO et l’export sont bloqués tant que ces cas ne sont pas résolus. Aucune Cue ni aucun média n’est supprimé.

Le passage en Autopilote utilise les positions chronologiques conservées. Des changements chronologiques faits ensuite en Autopilote sont pris en compte au prochain passage en Manuel.

Pour cette première bêta, une musique principale en boucle est refusée en Manuel avec une indication demandant de désactiver Loop ; son contenu et le fonctionnement Loop en Autopilote sont conservés. Le choix évite de fabriquer une durée finie arbitraire pour l’horloge QLab d’une boucle infinie.

## Export et Bridge

`conduite.json` reste en format V5 avec des champs supplémentaires : `conductType`, `applicationVersion`, `minimumBridgeVersion`, identifiants Pilot, parent et temps relatif. Les médias restent dédupliqués et les visuels et descriptions sont conservés. Le PDF Manuel affiche GO pour les musiques et les temps relatifs pour les tops, sans faux temps restant vers une musique suivante. Le texte technicien indique qu’une conduite Manuel nécessite Bridge 1.6.0 bêta ; Bridge 1.4.5 ignore ce nouveau mode et ne doit pas servir à l’importer.

Autopilote emprunte l’import historique : Group Timeline, médias, Wait Cue d’horloge et numérotation QLab. Manuel réutilise ce même import pour chaque musique, avec ses temps relatifs, son groupe racine sans auto-continue et sa propre Wait Cue d’horloge. Un Stop ajouté au groupe suivant abandonne le groupe précédent lors du GO QLab. Les repères restent visuels dans Bridge, conformément au mécanisme existant.

**Différence à valider : le crossfade de trois secondes est implémenté dans Pilot. Dans QLab, le passage anticipé arrête le groupe précédent ; ce n’est pas un crossfade QLab.**

Bridge affiche la version issue de son bundle, lui-même alimenté par `PWA/version.json`. Le bundle 1.6.0 a le numéro interne 16001 et l’identifiant `fr.s2aproduction.bridge.beta`. L’archive contient arm64 et x86_64 avec une signature ad hoc vérifiée. Le Show Manuel conserve la présentation Maverick / Iceman choisie dans Pilot et masque le décompte à l’attente GO.

## Vérifications automatisées

Résultat final : tous les contrôles ci-dessous exécutés ont réussi. Les tests avec QLab physique et les appareils réels restent distincts et non exécutés.

- `tools/test-manual-conduct.cjs` : Chrome et WebKit ; ancien projet par défaut, bascule réversible, sauvegarde/réouverture, vrai export/import avec médias, ajout tactile à la waveform, déplacement de top, temps relatif, deux présentations Show, Space GO, double GO, crossfade avec gains Web Audio mesurés, abandon du top ancien, fin de morceau, attente, fin de conduite, retour au début, lecture hors ligne et retour à Autopilote, lecture automatique complète de trois musiques et largeurs tactiles 768/820/1024 px.
- `tools/test-manual-bridge.py` / `.swift` : décodeur réel, séparation en musiques, temps relatifs, visuels/descriptions, horloges, arrêt de l’ancien groupe, refus d’un parent invalide. Les véritables scripts d’import Autopilote et Manuel sont compilés contre le dictionnaire QLab 5, sans exécution dans QLab.
- `tools/test-bridge-navigation.py` : runtime, anciennes métadonnées, workspaces, identifiants, sélection sans GO, édition atomique et conflits, filtres ; commandes AppleScript compilées sans modification d’un workspace réel.
- `tools/test-pilot-export.cjs` : vrais PDF/ZIP, médias partagés, réouverture, annulation, téléchargement et export hors ligne ; Bridge 1.6.0 embarqué vérifié.
- `tools/test-locales.cjs` : FR/EN/ES/DE, contenu utilisateur préservé, aide, PDF, notes de version, petite largeur et rechargement.
- `tools/test-help-video.cjs` : quatre vidéos, lecture et déplacement réels, fermeture, reprise, échec récupérable, isolation clavier et ancien navigateur simulé.
- `tools/test-bridge-show.cjs`, `test-bridge-filters.cjs`, `test-bridge-editor.cjs` : deux états sélection/lecture, numéros QLab, auto-scroll sans boucle, filtres combinables, édition, Show Manuel et masquage du décompte en attente.
- Reconstruction ES5 / CSS de compatibilité, architectures et signature macOS, intégrité ZIP et absence de modification des distributions stables vérifiées.

Les tests WebKit bloquent les requêtes HTTP pour simuler la perte du réseau tout en conservant les URL blob locales : le mode offline global de Playwright/WebKit bloque aussi ces blobs, ce qui ne représente pas ce scénario. Les annulations de chargement des aperçus supprimés pendant l’édition sont attendues.

Restent obligatoires avant validation : import et exécution dans un vrai workspace QLab 5, deux GO manuels successifs et anticipés, écoute et contrôle des tops/horloges, essai sur iPad physique, essai HID 8BitDo Micro configurée en clavier/Espace, ainsi qu’un essai Android physique. Les émulations tactiles ne constituent pas ces validations matérielles.

## Reproduction et distribution

Compiler avec `zsh S2A-Copilot/build.sh`, reconstruire les fichiers ES5 avec `tools/build-compat.cjs`, puis lancer `python3 tools/package-beta.py`. Les dépendances exactes de compatibilité sont documentées dans `tools/README.md`.

Le script `package-release.py` refuse désormais de produire une distribution stable depuis cette branche marquée bêta. `package-beta.py` écrit uniquement sous `downloads/beta/1.6.0/` ; il ne remplace pas `PWA/Bridge/` ni les ZIP stables. Les résultats de compilation et les archives bêta restent locaux et ignorés par Git jusqu’à décision de publication.

## Liste précise des fichiers modifiés ou ajoutés

- `.gitignore`
- `PWA/app.js`
- `PWA/compat/BUILD.json`
- `PWA/compat/app.es5.js`
- `PWA/compatibility-loader.js`
- `PWA/i18n-catalog.js`
- `PWA/index.html`
- `PWA/manifest.de.webmanifest`
- `PWA/manifest.en.webmanifest`
- `PWA/manifest.es.webmanifest`
- `PWA/manifest.webmanifest`
- `PWA/service-worker.js`
- `PWA/version.json`
- `S2A-Copilot/Show/show.js`
- `S2A-Copilot/Sources/BridgeShowView.swift`
- `S2A-Copilot/Sources/S2ACopilot.swift`
- `S2A-Copilot/build.sh`
- `docs/beta-1.6.0.md`
- `locales/interface.json`
- `tools/build-bridge-show.py`
- `tools/package-beta.py`
- `tools/package-release.py`
- `tools/test-bridge-editor.cjs`
- `tools/test-bridge-filters.cjs`
- `tools/test-bridge-show.cjs`
- `tools/test-manual-bridge.py`
- `tools/test-manual-bridge.swift`
- `tools/test-manual-conduct.cjs`
- `tools/test-pilot-export.cjs`

## Ajustements après le premier essai utilisateur

- Étape 4 de l’aide : cadrage de la capture Iceman réduit sous la dernière Cue, sans modifier les images ni perdre la dernière ligne ; lien vidéo conservé dans les quatre langues.
- Le choix Autopilote/Manuel est aligné à droite du nom du numéro, avec les contrôles sombres et arrondis de Pilot ; retour à la ligne sur téléphone. Les contrôles internes des Cues reprennent les mêmes couleurs et bordures, avec un violet discret.
- Les tops internes sont en retrait de 28 px dans Edit et les deux présentations Show (16 px sur téléphone). Les musiques restent au niveau principal.
- `Edit` reste identique dans les quatre langues.
- Bouton Pause/Reprendre distinct à côté du GO en Show Manuel. Le temps et le décompte restent figés pendant la pause ; la reprise conserve aussi la progression d’un fondu interrompu. GO reste la musique suivante, y compris après une pause.
- Une constante commune fixe la protection de transport à 500 ms en Autopilote et Manuel, avec le même halo de sécurité.
- Le glissement, le clic et les flèches dans la timeline déplacent l’audio de la musique manuelle courante sans pause ni GO. La position reste dans ce morceau ; les tops sont recalculés et les tops futurs reprennent à leur position relative. Une recherche pendant une pause conserve la pause. Une recherche pendant un crossfade conserve la musique courante et termine la sortie de l’ancien morceau.
- Cache bêta révisé pour que le navigateur récupère les nouveaux scripts et styles. Archives bêta reconstruites ; aucun remplacement des distributions stables.

Vérifications supplémentaires : arrêt/reprise de l’audio réel, recherche pendant pause et lecture, identité musicale inchangée, retrait visible, pause pendant crossfade, alignement sur quatre largeurs, dernière Cue de l’aide visible et libellé Edit inchangé en FR/EN/ES/DE.

Fichiers concernés en plus de la première liste : `PWA/quick-help.js`, `PWA/quick-help.css`.

## Séquences manuelles et timeline longue

- Ajout de numéros principaux muets, avec durée réglable et sous-Cues synchronisées. Ils attendent le GO suivant comme les musiques ; pause et recherche restent disponibles.
- Sélection d’une Cue : marqueur sélectionné dans la timeline et défilement pour le rendre visible. Les nouvelles musiques sont ajoutées après les séquences existantes.
- Fenêtre de timeline de 15 minutes, défilement horizontal au-delà, deux niveaux de pistes alternés maximum. Sur écran tactile : un doigt sélectionne/déplace la tête, deux doigts déplacent la vue sans GO ni changement de position.
- Suppression de « + Top interne » dans les musiques ; seul l’ajout à la tête de lecture est conservé. Le numéro muet dispose du même ajout à partir de la tête principale.
- Export/import des séquences muettes et prise en charge Bridge bêta, build 16002 minimum pour ces projets. Aucun changement du chemin Autopilote groupe + audio + Wait Cue.

Vérification : `tools/test-manual-sequences.cjs` passe dans Chrome et WebKit (aller-retour du projet, musique puis silence, sous-Cues, pause/recherche, attente du GO, fenêtre de 15 minutes, deux niveaux, sélection et ajout de musique). Les gestes tactiles à un/deux doigts sont vérifiés avec des événements tactiles Chromium ; essai matériel iPad encore nécessaire. `tools/test-manual-bridge.py` valide le modèle et compile les scripts avec QLab 5, sans exécuter une conduite dans QLab.

Fichier de test ajouté : `tools/test-manual-sequences.cjs`. Archives bêta reconstruites, branche principale et distributions stables conservées, aucun push.

Limite de validation de cette passe : le scénario complet `test-manual-conduct.cjs` passe dans Chrome. Dans WebKit, le passage audio vers la deuxième musique rencontre un délai dépassé, avec et sans simulation hors connexion (un message WebKitBlobResource a aussi été observé). Les tests ciblés des nouvelles séquences passent dans les deux moteurs ; le scénario audio complet WebKit doit être revérifié avant de déclarer cette bêta stable.
