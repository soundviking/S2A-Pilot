# Version 1.4.33 — Cue active mise en évidence

## Cue active 1.4.33

En Show, la box Cue active bénéficie d’un contour et d’un repère latéral bleus, accompagnés d’un halo discret. La prochaine Cue conserve son contour neutre.

# Version 1.4.32 — Exemple du nom du numéro

## Exemple du nom du numéro 1.4.32

Le champ affiche désormais « Ex. Numéro Gala — Norbert Ferré ».

# Version 1.4.31 — Waveforms nettes et zoom général en Edit

## Waveforms et zoom 1.4.31

Les éditeurs audio/vidéo redessinent uniquement la portion visible à la résolution de l’écran, au lieu d’étirer un canvas plafonné. Le cache de waveform conserve 65 536 valeurs par action et réutilise le décodage lors des zooms. Défilement et redimensionnement déclenchent le dessin de la zone visible.

La timeline générale dispose de boutons − / + jusqu’à ×32 **uniquement en Edit**, avec défilement horizontal et graduations adaptées. Le passage en Show rétablit la vue complète et masque les boutons. Un geste de défilement ne valide pas un déplacement de lecture.

Vérification dans Chrome avec audio réel : waveform détaillée, zoom média ×64 à DPR 2, défilement, redimensionnement mobile, zoom général ×32 et retour en Show. Geste tactile à confirmer sur iPad réel.

# Version 1.4.30 — Prochaine Cue en mode Show

## Mode Show 1.4.30

La prochaine Cue affiche son titre à gauche et le compte à rebours à droite. La description occupe toute la largeur en dessous ; le visuel est centré sous ces informations au format 16/9. Les titres longs passent sur plusieurs lignes, les descriptions restent intégrales et la box grandit si nécessaire. À 600 px et moins, le temps repasse sous le titre.

Disposition vérifiée dans Chrome à 1366, 1024, 600 et 390 px, avec titre long et dix lignes de description. La timeline reste visible dans le cas standard testé à 1366 × 768. Vérification Safari iPad réel à poursuivre après déploiement.

# Version 1.4.29 — Lecture / Pause au clavier

## Raccourci clavier 1.4.29

**Espace** bascule entre Lecture et Pause de la timeline générale, en Edit et Show. Le raccourci est ignoré pendant la saisie, dans les fenêtres de dialogue et sur les autres commandes ayant leur propre action clavier. Maintenir la touche ne provoque pas de bascules répétées. Les aperçus médias conservent leurs commandes indépendantes.

# Version 1.4.28 — Déplacement en direct et duplication

## Édition des Cues 1.4.28

Le déplacement d’un repère sur la timeline est visible avant le relâchement : repère, temps et bande média suivent le geste sur une échelle stable. Le nouvel horaire est validé au relâchement ; une interruption annule l’aperçu. La liste se reclasse ensuite automatiquement.

Le bouton **Dupliquer**, à côté de Supprimer dans la Cue déroulée, crée une copie au même temps avec titre, description, visuel et réglages médias. Les identifiants des actions sont distincts et les fichiers médias sont réutilisés. Les réglages de la copie sont indépendants. L’annulation et la sauvegarde automatique sont conservées.

Retour visuel avant relâchement, validation, annulation du déplacement, duplication, indépendance des réglages et largeur mobile contrôlés dans Chrome. Geste tactile à confirmer sur iPad réel.

# Version 1.4.27 — Cohérence des mises à jour

Chargement de app.js et des modules PDF avec numéro de version, affichage du numéro du programme exécuté, navigation réseau avec repli hors ligne, précache sans ancien cache HTTP, diagnostic de démarrage et sortie vidéo masquée dès le HTML. Lire DEPLOIEMENT.txt pour la purge Cloudflare nécessaire sur le serveur actuel.

# Version 1.4.26 — Cue sélectionnée plus visible

Une poignée à gauche permet de déplacer les Cues dans la liste. Le temps est ajusté entre les Cues voisines ; un placement avant la première Cue donne 00:00.0. L’ordre reste chronologique, les médias restent attachés à leur Cue et le déplacement peut être annulé. Alt + flèches permet également de déplacer une Cue au clavier. Le geste tactile reste à confirmer sur iPad réel.

En Edit, la Cue déroulée bénéficie d’un contour bleu clair, d’un repère latéral, d’un en-tête bleu renforcé et d’un fond distinct sur toute la zone d’édition.

# Version 1.4.25 — Assistance à l’installation de Copilote

Notice détaillée ajoutée aux projets exportés : première tentative d’ouverture, Réglages Système, Confidentialité et sécurité, Ouvrir quand même et confirmation. Copilote reste en version 1.2.5 universelle.

## Installer S2A Copilote si macOS bloque son ouverture

L’application est signée localement et n’est pas notariée par Apple. Après décompression, glisser **S2A Copilote.app** dans **Applications**, puis essayer de l’ouvrir une première fois.

1. Si macOS la bloque, fermer le message et ouvrir **Réglages Système → Confidentialité et sécurité**.
2. Descendre jusqu’à **Sécurité** et cliquer sur **Ouvrir quand même** pour **S2A Copilote**.
3. Valider avec le mot de passe ou Touch ID si demandé, puis confirmer **Ouvrir**.

Le bouton apparaît après la tentative d’ouverture. S’il a disparu, essayer à nouveau d’ouvrir l’application puis revenir dans ces réglages. Une nouvelle version peut demander une nouvelle autorisation. Autoriser l’application téléchargée depuis ce dépôt officiel. [Procédure Apple](https://support.apple.com/fr-fr/102445).

Lors du premier import, autoriser aussi le contrôle de **QLab** : il s’agit d’une permission distincte. Une notice accompagne l’application dans le ZIP macOS et dans chaque projet exporté (`companion/INSTALLATION.txt`).

# S2A Pilot 1.4.24

Le bouton de création d’une Cue média est nommé **+ Musique / Vidéo**. Il conserve le choix d’un fichier audio ou vidéo et la création d’une nouvelle Cue. Tous les correctifs de la 1.4.23 sont inclus.

## Historique

# S2A Pilot 1.4.23 — aperçu PDF en ouverture locale

L’aperçu PDF charge désormais un script classique à la demande, au lieu d’un import de module bloqué en file://. La photo d’en-tête dispose d’un fichier de données chargé uniquement en ouverture directe pour éviter les restrictions canvas sur fichiers locaux. Les ressources restent chargées à la demande ; sur serveur, la photo d’origine et le cache hors ligne sont conservés.

Test Chrome : index.html ouvert directement, + Cue, aperçu et photo d’en-tête validés. Les correctifs Safari 1.4.21 et visibilité conditionnelle Sortie vidéo 1.4.22 sont inclus. Pour utiliser l’ensemble des fonctions PWA et l’export du compagnon, privilégier le lanceur local ou un serveur HTTPS.

## Historique

# S2A Pilot 1.4.22

En mode Show, le bouton Sortie vidéo et son statut sont visibles uniquement si la conduite contient une vidéo. Ils disparaissent après suppression de la dernière vidéo et restent masqués en Edit. Sans écran étendu, le bouton visible reste grisé. Le correctif de démarrage Safari 1.4.21 est inclus.

## Historique

# S2A Pilot 1.4.21 — compatibilité au démarrage

La demande d’autorisation window-management n’est effectuée que si l’API des écrans étendus existe. Les erreurs synchrones et asynchrones sont interceptées ; elles ne bloquent plus l’initialisation. Compatibilité complémentaire : accès aux derniers éléments sans Array.at, ResizeObserver conditionnel et timeout de vérification version conditionnel.

Test de reproduction dans Chrome avec API écran/permission non prise en charge : ancien démarrage bloqué, Nouveau / + Cue / Conduite PDF fonctionnels après correction. Ce test simule la défaillance ; Safari sur iPad réel reste à confirmer. Aucune donnée locale supprimée.

Déployer tout le dossier et ouvrir actualiser.html si Safari conserve l’ancienne page. Le cache est versionné 1.4.21.

## Historique

# S2A Pilot 1.4.20

Bandes et pastilles VIDÉO en rose vif, fond translucide et bordure plus visible. Les bandes audio restent vertes.

## Historique

# S2A Pilot 1.4.19 — vérification des mises à jour

Vérification réseau de version.json au démarrage, au retour dans l’application et toutes les cinq minutes si visible. Le manifeste contourne le cache du service worker et est demandé sans cache avec une adresse unique. Sans réseau, aucune confirmation « à jour » n’est donnée ; le mode hors ligne reste disponible.

Une version serveur supérieure affiche une proposition d’actualisation. L’actualisation est bloquée en Show ou pendant la lecture ; elle sauvegarde le projet puis renouvelle uniquement les fichiers de l’application. Les données IndexedDB restent conservées.

Alexandre doit déployer tout le dossier, notamment version.json et actualiser.html, à chaque mise à jour. La comparaison porte sur la version publiée sur son serveur, pas sur GitHub. La mise à jour du serveur doit être complète avant sa mise à disposition. Ce mécanisme est disponible à partir de la 1.4.19 ; les anciennes pages déjà ouvertes nécessitent un premier rechargement.

Tests : version identique, version supérieure, Show, lecture en cours et panne réseau vérifiés.

## Historique

# S2A Pilot 1.4.18

Pastille VIDÉO violette : fond translucide, texte clair et bordure assortis à la bande vidéo de la timeline. Les erreurs restent signalées en rouge. Les Cues sans média n’affichent aucune pastille.

# S2A Pilot 1.4.17

La hauteur de la timeline s’adapte au nombre de médias (minimum 86 px), avec une zone réservée aux graduations. Les bandes restent translucides : audio vert, vidéo violet. Les six bandes du scénario de test sont entièrement visibles. Les commandes et la waveform sont conservées.

## Historique

# Correctif 1.4.16 : actualisation du cache

Le service worker possède désormais un cache distinct pour la version 1.4.16. Le lanceur local ouvre actualiser.html : seuls les caches de fichiers S2A Pilot et son service worker sont renouvelés. IndexedDB et les projets sauvegardés restent intacts. Fermer les anciennes fenêtres de S2A Pilot avant de lancer le dossier.

# S2A Pilot 1.4.15

- Bouton **+ Cue**.
- Bandes des médias directement dans la timeline, hauteur 20 px conservée, fond translucide et waveform visible. Elles ne bloquent ni les marqueurs ni le déplacement en Edit. La timeline reste verrouillée en Show.
- Mention « Waveform combinée des médias audibles » supprimée. Les erreurs de décodage restent indiquées si nécessaire.

Les parcours de création, sauvegarde, édition média et Show ont été vérifiés automatiquement ; la disposition a été inspectée visuellement.

## Historique

# S2A Pilot 1.4.14 — version de test

## Changements 1.4.14

- Nouvelle conduite vide, aucune Cue permanente imposée. Toutes les Cues, y compris celles à zéro dans les anciens projets, peuvent être déplacées et supprimées.
- **+ C** crée un repère avec titre, description et visuel, sans zone d’ajout de média.
- **+ Média** ouvre le choix d’un fichier audio ou vidéo puis crée une nouvelle Cue portant son nom, au temps courant. Annuler le choix ne crée rien. Les éditeurs IN / OUT, waveform, aperçu, lecture indépendante, Loop et zoom sont conservés. Les anciens projets avec plusieurs médias par Cue restent lisibles.
- Show paysage sur ordinateur : Cue active à gauche, prochaine Cue à droite, timeline en dessous. Les commandes restent visibles aux dimensions testées 1366 × 768 et 1280 × 720. Le moniteur vidéo reste disponible en dessous lorsque nécessaire.
- Timeline Show en lecture seule : clics et marqueurs ne déplacent plus la lecture. Lecture / Pause et Retour au début restent actifs.
- Waveform combinée et bandes de position des médias visibles en Edit **et** Show. Les enveloppes audio sont additionnées en tenant compte du montage, des loops, cuts et fondus ; la vidéo muette apparaît comme bande sans contribuer au son. Les fichiers sont décodés et mis en cache, sans recalcul à chaque image de lecture. Si le navigateur ne décode pas la piste audio d’une vidéo, sa bande reste visible et une indication signale la waveform indisponible.
- Zoom de page par pincement bloqué, tout en conservant le défilement tactile et les boutons de zoom dédiés aux fichiers et au PDF.
- Sauvegarde locale automatique dès la première modification, y compris pendant la saisie du titre et de la description. Le bouton Enregistrer est supprimé ; **Enregistrer sous…** exporte le package portable. La sauvegarde reste sur cet appareil et dans cette installation de l’application.
- PDF : temps écoulé, puis temps restant jusqu’à la fin de la conduite entre parenthèses, par exemple **02:41.0 (-03:19.0)**. Une légende précise le calcul. L’aperçu intégré affiche les mêmes informations. Cinq Cues standards par page sont conservées.

## Vérifications de cette version

Création, déplacements, restauration locale après rechargement, changement d’options après autosave, déverrouillage d’une ancienne Cue permanente, suppression de la dernière Cue et annulation vérifiés. Layout Show paysage, verrouillage du seek, waveform et largeurs téléphone/tablette vérifiés dans Chrome. PDF cinq/dix Cues et longues descriptions, aperçu et export hors ligne vérifiés. Le rendu PDF a été inspecté visuellement.

À tester sur matériel réel : pincement Safari et PWA installée sur iPad, fluidité avec les médias du spectacle, vidéo et écran étendu. Copilote 1.2.5 universel Intel / Apple Silicon reste inclus dans les packages.

## Installation sur serveur

Déployer tout le contenu du dossier sur HTTPS, y compris companion/, assets/, icons/ et technical-preview.js. Partager l’adresse du dossier avec une barre finale ; index.html reste l’entrée interne du serveur. Le cache de service worker est versionné 1.4.14.

## Historique des versions précédentes

Les notes ci-dessous décrivent les versions antérieures et leur état lors des tests ; les changements ci-dessus prévalent.

## Mise à jour Copilote 1.2.5 / Pilot 1.4.13

Le logo bleu et orange de Copilote est restauré. Dans la fenêtre, ses angles sont arrondis. Pour les prochains imports QLab, le groupe conserve son numéro (par exemple 5) et les étapes internes sont numérotées 5.1, 5.2, 5.3, etc. Les numéros déjà utilisés ailleurs sont évités ; les anciennes conduites ne sont pas modifiées.

L’application macOS universelle contient les architectures Intel et Apple Silicon et est incluse directement dans les ZIP des projets. Les tests automatisés valident la numérotation, les scripts d’import, les imports multiples simulés et la compilation. Un import dans un workspace QLab réel reste à essayer.

# S2A Pilot 1.4.13 — version PWA à tester

Base : version locale 1.4.11, issue de S2A-Pilot-V1.4.1-PWA. Travail réalisé le 5 octobre 2026.
Aucun push, publication ou changement sur GitHub. Le point 11 n’a pas été traité.

## Démarrer le test

Sur Mac : décompresser l’archive, puis ouvrir `Démarrer S2A Pilot.command` depuis le dossier décompressé. Un serveur local ouvre http://localhost:8092/index.html ; garder sa fenêtre Terminal ouverte. Arrêter avec Ctrl+C. Le lanceur utilise Python 3, déjà disponible sur le Mac utilisé pour ces tests. Si macOS bloque le lanceur, ouvrir un Terminal dans ce dossier et lancer `python3 -m http.server 8092 --bind 127.0.0.1`, puis ouvrir l’adresse ci-dessus.

Ne pas ouvrir directement index.html depuis le Finder : l’installation et le service worker nécessitent localhost ou une adresse HTTPS.

Pour iPhone/iPad : les fichiers doivent être servis depuis une adresse HTTPS accessible à l’appareil. L’adresse localhost du Mac ne convient pas. L’archive peut remplacer les fichiers de l’hébergement habituel après validation ; aucune mise en ligne n’a été effectuée ici.

En test local sur un autre port/adresse, les conduites enregistrées sur l’adresse habituelle ne sont pas accessibles : utiliser Ouvrir pour importer un package .s2apilot.zip. Pour une mise à jour, conserver l’adresse et le chemin habituels afin de retrouver la sauvegarde locale.

## Changements intégrés

1. Nom installé et nom court : **S2A Pilot**. Métadonnées Apple et titre cohérents ; identité du manifest alignée sur l’ancienne URL de lancement pour éviter de créer volontairement une seconde application.
2. Icône S2A Pilot existante réutilisée pour favicon, en-tête, Chrome et Safari. Suppression du favicon ancien embarqué dans le HTML. Références d’icônes versionnées, icône Apple préchargée, nouveau cache 1.4.13 et nettoyage des caches des versions précédentes.
3. **Retour au début** annule aussi une Lecture en attente, met en pause immédiatement, arrête les médias et revient à **00:00.0**, avec le bouton **Lecture**.
4. Ligne sous la timeline « Durée de la conduite / Auto +10 s » supprimée. Calcul automatique +10 s conservé ; les durées personnalisées des packages existants restent respectées.
5. Bouton « Préparer le show », pastille et texte associés supprimés. Préchargement au chargement/ajout de médias, contrôle toutes les 30 secondes lorsque la page est visible et contient des médias ; réutilisation des médias prêts, relance ciblée des médias non prêts. Pas de contrôle périodique lorsque la conduite est vide ou la page masquée.
6. **Sortie vidéo** grisée tant qu’aucun véritable affichage étendu n’est confirmé. Mention exacte : « Disponible uniquement avec un affichage étendu ». Le bouton **Détecter les écrans** est supprimé. Chaque ajout de vidéo vérifie la permission navigateur : autorisation accordée réutilisée ; sinon nouvelle tentative de demande. L’import d’une conduite contenant des vidéos déclenche également cette vérification, une fois pour le package. Le chargement automatique d’une sauvegarde ne déclenche pas de nouvelle invite sans action utilisateur. La fenêtre vidéo est placée sur l’écran secondaire ; elle se ferme si la configuration ne permet plus un affichage étendu.
7. Mise en page adaptable sur ordinateur, tablette et téléphone ; boutons et champs se réorganisent en gardant les mêmes noms.
8. Libellés uniformes : **Ajouter une Cue**, **Show**, **Edit**. La bascule « Edit | Show » garde les deux noms visibles et indique le mode sélectionné.
9. En Show, box **Moniteur vidéo** tout en bas uniquement si la conduite contient une vidéo. Elle utilise le lecteur vidéo en cours, sans ajouter de décodage vidéo local supplémentaire. Sans vidéo en cours, elle affiche un état d’attente.
10. JavaScript centralisé dans app.js : suppression de la copie redondante dans index.html. Durée, ordre des Cues et index des actions mis en cache entre modifications ; affichage du transport limité à 10 mises à jour/seconde, tandis que le suivi des médias reste animé à la fréquence du navigateur. Mise à jour ciblée des lignes lors d’une sélection ou d’un renommage de Cue ; calcul des aperçus audio/vidéo réservé à la Cue dépliée ; libération des lecteurs et URLs des médias retirés.

Lecture/Pause/reprise restent en place. Le code de génération du PDF est conservé à l’identique. Les identifiants internes historiques nécessaires aux sauvegardes, packages et companion restent compatibles.

## Ajustements 1.4.13 — horaires libres et transitions audio

- La saisie du temps d’une Cue n’est plus plafonnée par la durée actuelle de la conduite. On peut créer plusieurs Cues sans média, puis placer une Cue à **2 minutes 41** ; la timeline s’agrandit automatiquement (jusqu’à **2 minutes 51** en durée automatique). Aucun média n’est nécessaire. La Cue permanente reste à zéro ; les autres Cues conservent leur minimum de 0,1 s et le classement chronologique validé.
- **02.41** et **02,41** sont compris comme **2 minutes 41 secondes**. Les formats existants restent acceptés : **02:41**, **02:41.5** pour les dixièmes, **161** pour un nombre de secondes et **2.4** pour 2,4 secondes. Deux chiffres après le point représentent les secondes dans le format minutes.secondes ; un seul chiffre après le point reste un dixième de seconde. **02.41.5** est également accepté. Les secondes hors de 00 à 59 dans une notation minutes/secondes sont refusées.
- Cette saisie fonctionne également pour IN/OUT ; les limites réelles du fichier restent appliquées aux médias.
- Nouvel audio sur la **Cue 1 permanente** : **Cut** par défaut. Nouvel audio sur toutes les autres Cues : **Fondu, 3 secondes** par défaut. Ces valeurs sont appliquées uniquement à l’ajout d’un média ; les réglages existants, personnalisés ou importés sont conservés.
- Le PDF validé, son visuel et son aperçu restent inchangés. Copilote 1.2.5 universel, déjà compilé, est inclus directement dans chaque ZIP de projet.

### Compagnon directement installable dans les ZIP de projets

Chaque projet exporté contient **companion/S2A Copilote.app**, déjà compilée pour **Mac Intel et Apple Silicon** (application universelle), ainsi que **companion/INSTALLATION.txt**. Après décompression du projet, glisser l’application dans Applications. **Aucune compilation et aucune deuxième archive à décompresser.** macOS 13 ou plus récent est requis. L’archive des sources optionnelles n’est plus ajoutée dans les projets ; elle reste disponible séparément.

La signature locale est valide pour les deux architectures ; les permissions de l’exécutable sont conservées dans le ZIP. Un projet réellement exporté par la PWA a été décompressé et contrôlé : tous les fichiers de l’application sont identiques au build original et la signature reste valide. Le fonctionnement sur un Mac Intel physique reste à essayer ; la compilation a été réalisée sur Apple Silicon.

L’application compilée est distribuée comme ressource dans le dossier **companion** de la PWA. Elle n’est lue par le code de l’application que lors de l’export d’un package et est mise en cache pour permettre les exports hors ligne. Aucun chargement du binaire en tant que code JavaScript, ni impact sur les timers de lecture. L’ancien gros script contenant les sources encodées n’est plus chargé au démarrage.

**Déploiement : inclure tout le dossier de la PWA**, notamment **companion/S2A-Copilote-1.2.5-app.zip**, **companion/app-files.json**, **assets** et le service worker. Un export est refusé avec un message explicite si les ressources du compagnon sont absentes ; un ZIP annoncé complet ne sera pas produit sans l’application.

### Adresse de l’application

Le correctif est bien présent : une ouverture par **index.html** est remplacée dans la barre d’adresse par celle du dossier. La PWA démarre aussi sur le dossier. Le fichier reste nommé **index.html** en interne ; utiliser et partager le lien **https://votre-domaine/s2a-pilot/**, sans index.html, sur un serveur qui ouvre automatiquement ce fichier. L’hébergement d’Alexandre n’a pas été modifié et aucune publication ni poussée GitHub n’a été effectuée.

### Validation 1.4.13

Scénario reproduit en Chrome : cinq Cues, aucun média, modification de la deuxième Cue à 02:41, valeur exacte conservée, durée portée à 02:51, annuler/rétablir et saisies 02.41 / 02,41 vérifiés. Durée fixe héritée plus courte : la Cue peut tout de même être placée au temps demandé. Export/import de conduite sans média, lecture au passage de la Cue et retour à zéro vérifiés. Saisie testée aux largeurs 820 / 390 / 320 px.

Audio WAV réel ajouté à la Cue permanente : Cut ; à une autre Cue : Fondu 3 secondes. Des réglages personnalisés différents des valeurs par défaut ont été exportés et réimportés sans modification. Tests des lecteurs locaux audio/vidéo, des points IN/OUT, boucle, pause, séparation avec la conduite, moniteur Show et vues mobiles réussis. Export avec compagnon directement installable et réimport dans la PWA vérifiés, également hors ligne. Aucune erreur JavaScript relevée.

À tester avant mise en ligne : reproduire votre scénario sans média ; saisir 02.41 puis contrôler 02:41.0 ; ajouter un audio sur Cue 1 puis sur une autre Cue ; rouvrir une ancienne conduite et vérifier ses réglages. Les tests mobiles ici sont simulés dans Chrome ; l’essai sur iPad installé reste à effectuer.

## Ajustement 1.4.11 — visuel photographique de l’en-tête

L’en-tête utilise désormais le visuel de projecteurs bleus fourni par l’utilisateur, en remplacement du dessin précédent. Le fichier original est inclus dans **assets/conduite-header.webp**. Lors de la génération, il est recadré au format du bandeau sans déformation, avec un léger voile sombre pour préserver la lisibilité des titres et compteurs. Le PDF téléchargé et l’aperçu intégré utilisent exactement le même bandeau. L’image du bandeau est préparée une fois par session et réutilisée ; aucune ressource distante n’est nécessaire.

Le visuel est inclus dans le cache de la PWA. Il faut donc déployer **tout le dossier**, y compris le nouveau dossier **assets**, et le service worker 1.4.11.

Validation : PDF rendu et inspecté visuellement ; cinq Cues sur une page, dix sur deux ; aperçu, zoom, téléchargement explicite, vues tablette/téléphone et ouverture hors ligne réussis. Le reste du fonctionnement est conservé. La validation sur iPad physique reste à effectuer. Aucune publication ni poussée GitHub.

## Ajustements 1.4.10 — conduite technique et aperçu léger intégré

- Le bouton s’appelle désormais **Conduite PDF**.
- L’aperçu est intégré à S2A Pilot : pages défilables, zoom **− / +**, **Ajuster à l’écran**, téléchargement facultatif et fermeture. Il ne dépend plus du lecteur PDF de Safari ou du système. L’aperçu et le fichier téléchargé utilisent les mêmes pages, textes, visuels et instructions de dessin.
- Le module de consultation ajoute environ **5 Ko** de code non compressé, sans bibliothèque PDF externe. Il s’exécute uniquement à l’ouverture de l’aperçu. Il est mis en cache pour fonctionner également hors ligne ; aucun serveur tiers n’est nécessaire. À la fermeture, les pages, observateurs et ressources temporaires sont libérés.
- En-tête **CONDUITE TECHNIQUE**, sans mention S2A Pilot dans cet en-tête. Deux projecteurs et faisceaux bleus croisés sur bleu nuit, dessinés en vectoriel, sans avion ni image supplémentaire.
- Cartes des Cues adoucies par des **angles arrondis**, avec repère bleu intérieur.
- Les informations d’en-tête conservent le nombre de Cues et le temps de la dernière Cue, et ajoutent le **nombre de fichiers audio** ainsi que le **nombre de fichiers vidéo uniquement lorsqu’il y en a**. Les fichiers sont dédupliqués : un fichier réutilisé plusieurs fois compte une fois.
- Cinq Cues par page dans les fiches courantes, textes très longs continués sans perte, pied de page et mention de reproduction conservés.
- Les PDFs téléchargés et inclus dans les packages portent le suffixe **-conduite-technique.pdf**. Les sources Copilote 1.2.3 restent incluses et inchangées.

### Validation 1.4.10

Tests Chrome sur ordinateur et vues 820 / 390 / 320 px : affichage intégré sans iframe, pages et visuels, dix Cues sur deux pages, défilement, zoom, ajustement, téléchargement uniquement sur demande, Échap et fermeture. L’aperçu fonctionne après rechargement hors ligne, y compris dans le test avec indicateur de mode installé et lecteur PDF natif désactivé. Les compteurs audio/vidéo, l’absence de compteur vidéo sans vidéo et les descriptions longues sont vérifiés.

Les PDF générés ont été rendus et contrôlés visuellement. Cinq Cues avec visuels et médias tiennent sur une page ; dix sur deux. Tests de régression Lecture/Pause/reprise, retour au début, médias réels, moniteur Show, export/import, préchargement et PWA hors ligne réussis. Aucune erreur JavaScript relevée.

À vérifier sur un **iPad réel, application installée** : ouverture de Conduite PDF, passage entre plusieurs pages, zoom et ajustement, téléchargement/partage du fichier, ouverture hors ligne. La solution ne dépend plus du lecteur PDF Apple, mais les essais effectués ici restent des essais Chrome avec tailles et indicateurs simulés, pas une validation physique Safari/iPadOS.

Aucune publication ni poussée GitHub effectuée. Pour la mise en ligne, fournir l’ensemble du dossier, y compris **technical-preview.js** et le nouveau service worker ; conserver l’adresse du dossier sans index.html.

## Ajustements 1.4.9 — PDF, adresse et Copilote

- En-tête PDF **S2A Pilot**, sans ancien nom ; mise en page compacte : **5 Cues par page** dans les fiches courantes, y compris avec visuels et médias. Pagination vérifiée avec 5 et 10 Cues. Les descriptions et médias ne sont plus tronqués : les cas très chargés utilisent davantage de place et, au besoin, une continuation sur la page suivante.
- Pied de page bleu : **Toute reproduction non autorisée par l’artiste est interdite.** Nom de l’application et numéros de pages conservés.
- **Fiche technique PDF** ouvre une fenêtre d’aperçu intégrée, sans téléchargement automatique. **Télécharger** enregistre le fichier uniquement sur demande ; **Fermer** ou Échap ferment la fenêtre. Les ressources temporaires sont libérées à la fermeture. Le PDF reste inclus dans les packages exportés.
- Bouton **Tout réduire** supprimé ; l’ouverture d’une Cue referme toujours les autres.
- Démarrage PWA à l’adresse du dossier ; le nom `index.html` est retiré de l’adresse visible lorsque l’application est chargée par ce fichier. L’identité d’installation existante est conservée.
- Sources **S2A Copilote 1.2.3** incluses automatiquement dans les nouveaux packages. Une application Mac compilée est également fournie séparément. Nouveau logo, détection automatique des workspaces, sélection par menu lorsque plusieurs sont ouverts, erreurs normales de déconnexion retirées, imports multiples et fichiers isolés entre imports.

### Mise en ligne chez Alexandre

Conserver le fichier `index.html` dans le dossier de déploiement, avec tous les autres fichiers de l’archive à côté. Le nom du dossier peut être **s2a-pilot**. L’adresse à utiliser et à partager est par exemple **https://son-site.fr/s2a-pilot/** (à adapter au véritable domaine), sans `index.html` à la fin. Le serveur doit ouvrir automatiquement `index.html` lorsqu’on visite ce dossier, ce qui est habituel sur un hébergement web. Aucun renommage du fichier ni nouvelle installation séparée ne sont nécessaires. La version existante de la PWA conserve son identifiant ; son prochain démarrage utilise le dossier.

Cette archive n’a pas été publiée ni poussée sur GitHub ; aucun réglage de l’hébergement d’Alexandre n’a été modifié.

### Validation et points à tester

Tests Chrome : aperçu PDF sans téléchargement, téléchargement explicite, fermeture répétée, Échap, formats 1440 / 820 / 390 / 320 px, URL sans index, disparition de Tout réduire. PDF rendus et inspectés : 5 Cues sur une page, 10 sur deux pages, longue description continuée sans perte. Tests de régression Lecture/Pause, retour au début, vidéo réelle, moniteur Show, export/import, préchargement et application hors ligne réussis, sans erreur JavaScript.

Copilote : application macOS Apple Silicon compilée et signature locale vérifiée. Tests avec deux vrais packages et workspaces simulés, timer automatique, sélection stable, gestion des erreurs, extraction, fichiers distincts malgré titres identiques, index et scripts ciblés. Les scripts d’import et de découverte ont été compilés avec le dictionnaire QLab installé, sans être exécutés contre les workspaces utilisateur.

À tester : votre propre conduite dans le PDF, aperçu sous Safari iPhone/iPad (l’affichage PDF intégré dépend du navigateur), mise à jour de la PWA sur l’hébergement, écran étendu réel ; et Copilote 1.2.3 dans QLab avec deux workspaces de test et plusieurs packages. L’essai réel d’import et de lecture QLab reste à effectuer sur votre configuration. Voir le guide d’installation Copilote fourni séparément.

## Ajustement 1.4.8 — précision des médias et commandes

- **Zoom − / +** dans les timelines audio et vidéo. Le zoom se centre sur la tête de lecture et permet de défiler dans le fichier pour régler IN/OUT plus précisément. Il ne modifie ni les points sélectionnés ni la timeline générale. Retour à ×1 pour voir tout le fichier.
- Les **nouveaux fichiers audio** utilisent par défaut un **fondu de 3 secondes**. Les réglages des médias existants et importés sont conservés.
- Le bouton **Stop tous les médias** est supprimé. Les actions déjà enregistrées dans les anciennes conduites restent compatibles.
- **Ajouter un média** devient bleu, comme Lecture, pour être plus visible.
- **Sortie vidéo** apparaît uniquement en Show, dans l’en-tête entre le nom de l’application et Edit/Show. Son format est compact ; les indications de disponibilité sont conservées et le bouton devient rouge lorsque la sortie est active. Sur petit écran, les commandes occupent une deuxième ligne lisible.
- Le moniteur vidéo Show conserve le rendu validé. Lecture/Pause, PDF et lecteurs locaux indépendants sont conservés.

### Validation 1.4.8 et essais à effectuer

Tests Chrome sur ce Mac : audio WAV et vidéo MP4 réels, zoom et positionnement précis, défilement, bornes du zoom, indépendance de la conduite et des points IN/OUT, fondu par défaut et conservation des anciens réglages. Ouverture/fermeture de la sortie et couleur rouge vérifiées avec une configuration d’écrans simulée. Vues ordinateur, tablette et téléphone (1440, 820, 390 et 320 px), sans débordement ni chevauchement de l’en-tête ; captures examinées. Régressions des lecteurs médias, Lecture/Pause, retour au début, PDF, export/import et fonctionnement hors ligne réussies, sans erreur JavaScript.

À tester sur vos appareils : zoom sur des médias longs, précision des points IN/OUT et écoute du fondu, Safari iPhone/iPad, installation PWA et renouvellement du cache, et véritable écran étendu (autorisation navigateur, sortie rouge, déconnexion de l’écran). Les tailles mobiles sont simulées dans Chrome ; elles ne remplacent pas ces essais physiques. Les mesures CPU/mémoire historiques du guide concernent les versions antérieures et ne constituent pas une nouvelle mesure des aperçus zoomés.

## Ajustement 1.4.7 — bascule Edit / Show et éditeur média

### Modes

La commande en haut de l’application comporte désormais deux segments **Edit | Show**, toujours visibles. Le segment actif est mis en évidence. Cliquer sur le mode déjà actif conserve l’état de la conduite et de l’éditeur. Les touches Entrée et Espace activent le bouton sélectionné au clavier. Les libellés restent identiques sur tous les appareils.

### Visuels

Dans chaque Cue, les libellés sont **Ajouter visuel**, **Changer visuel** et **Retirer visuel**, distincts d’**Ajouter un média**.

### Édition audio / vidéo indépendante

- Le bouton local **Lecture / Pause** se trouve tout à gauche, sur la ligne des points **IN**, **OUT** et de **Loop**, pour l’audio comme pour la vidéo. Sur téléphone, les libellés IN/OUT passent au-dessus de leur champ pour conserver tous les contrôles sur une même ligne.
- Chaque média affiche une waveform et une tête de lecture blanche déplaçable. Cliquer ou glisser sur la waveform positionne le lecteur local. Les touches gauche/droite déplacent la tête de 0,1 s ; avec Maj, de 1 s. Début et Fin vont aux extrémités du fichier.
- Pour une vidéo, les vignettes ont été supprimées. La waveform représente sa piste audio et un mini moniteur à droite montre l’image à la position choisie.
- Déplacer les poignées jaunes ou saisir IN/OUT permet de vérifier le point sélectionné dans l’aperçu. La lecture utilise la sélection IN/OUT : départ à la position courante si elle est dans cette zone, sinon à IN ; arrêt à OUT, ou retour à IN si Loop est cochée. Pause conserve la position.
- La vidéo respecte le réglage **Muette** du média. Pour écouter sa piste audio dans l’aperçu, décocher Muette.
- Ces lecteurs sont séparés des lecteurs de la conduite : leurs commandes ne déplacent pas la timeline générale et ne changent pas son bouton Lecture/Pause. Une conduite déjà en lecture continue lorsque l’on utilise un aperçu local.
- Un seul aperçu local joue à la fois. Lancer la lecture générale arrête les aperçus. Refermer/reconstruire une Cue, passer en Show ou masquer la page arrête l’aperçu ; les lecteurs quittés sont libérés. Le moniteur vidéo du mode Show conserve ses dimensions et son style validés.

La waveform dépend d’une piste audio décodable par le navigateur. Si la vidéo ne comporte pas de piste audio compatible, la timeline indique **Waveform indisponible** ; les points IN/OUT, la tête de lecture et l’aperçu vidéo restent utilisables. Aucun tracé fictif n’est généré.

### Validation 1.4.7

Tests Chrome sur ce Mac avec vidéo MP4/H.264/AAC et audio WAV réellement décodés : waveform, aperçu lors du déplacement, commandes locales, IN/OUT, boucle, pause, annulation d’une lecture en attente, séparation des lecteurs et indépendance lorsque la conduite est déjà en lecture. Libellés Visuel et sélection Edit/Show vérifiés. Reconstruction répétée des lignes : anciens lecteurs libérés.

Vues 1440, 820, 390 et 320 px : contrôles du média sur une seule ligne, mini moniteur à droite, absence de débordement. Captures ordinateur et téléphone examinées. Tests de régression Lecture/Pause/reprise, retour à zéro, moniteur Show, PDF, export/import et rechargement hors ligne réussis ; aucune erreur JavaScript pendant les tests.

À tester sur vos fichiers et appareils : précision du déplacement vidéo, écoute sur les sorties audio habituelles, IN/OUT proches des extrémités, boucles courtes, codecs de vos vidéos, vidéos sans son, médias longs/volumineux, Safari iPhone/iPad et lecture générale simultanée. Les vues mobiles ont été simulées dans Chrome : l’essai sur appareils physiques reste à effectuer.

## Ajustement 1.4.6 — libellé Visuel

Dans chaque Cue du mode Edit, « Ajouter image » et « Changer image » deviennent « Visuel ». Le sélecteur conserve son fonctionnement pour ajouter ou remplacer une image. « Ajouter un média » garde son libellé. Vérification statique du libellé et validation syntaxique ; aucune nouvelle mesure de performance.

## Ajustement 1.4.5 — visuels des Cues en Show

La vignette de la Cue active garde ses dimensions. Ses images remplissent le cadre en mode cover, centrées et sans déformation. La prochaine Cue conserve la largeur de son visuel : hauteur réduite au ratio 16/9, centrage vertical dans la rangée À VENIR et espacement horizontal régulier entre cadre texte, image et bords de la box. Sur téléphone, le visuel reste centré sous le texte.

Les images sont recadrées si leur format diffère du cadre : une partie des bords peut être coupée afin d’éviter les bandes ajoutées par l’affichage. Les bandes déjà présentes dans le fichier image lui-même ne sont pas supprimées automatiquement. Le moniteur vidéo reste strictement inchangé.

Tests comparatifs 1.4.4 / 1.4.5 sur vues 1440, 820, 390 et 320 px, avec images portrait, carrées et panoramiques : dimensions actives stables, largeur suivante conservée, ratio 16/9, remplissage cover, centrage et espacements validés. Tests moniteur vidéo, Lecture/Pause, Retour au début, PDF, export/import et mode hors ligne également réussis.

## Ajustement 1.4.4 — moniteur Show

Le cadre et la vidéo sont centrés horizontalement dans la box, avec une largeur limitée à 720 px, adaptée à l’écran, et un ratio 16/9 conservé. Le titre utilise désormais les mêmes règles de couleur, taille, graisse, espacement et barre bleue que « CUE ACTIVE » et « PROCHAINE CUE ».

Vérification dans Chrome avec une vraie vidéo : centrage du cadre et du lecteur à moins d’un pixel, ratio 16/9, styles de titre identiques et aucun débordement horizontal, aux largeurs 1440, 820, 390 et 320 px. Lecture/Pause, Retour au début, export/import, PDF et mode hors ligne passent aussi. Le comportement d’autorisation automatique de la 1.4.3 reste en place.

## Ajustement 1.4.3

Le bouton de détection a disparu. Les tests automatisés du parcours d’ajout confirment :
- première vidéo : vérification puis demande ;
- vidéo suivante avec autorisation accordée : vérification sans nouvelle demande ;
- permission refusée : nouvelle tentative à chaque vidéo suivante, sortie grisée ;
- ajout audio : aucune demande ;
- navigateur incompatible : ajout accepté, sortie externe grisée.

Un refus explicite peut être mémorisé par le navigateur : l’application retente l’appel, mais ne peut pas forcer l’affichage d’une invite. Dans ce cas, changer l’autorisation de gestion des fenêtres dans les paramètres du site, puis ajouter une vidéo. [Référence getScreenDetails](https://developer.mozilla.org/en-US/docs/Web/API/Window/getScreenDetails).

## Tests déjà exécutés

Chrome sur ce Mac, avec vidéo WebM et audio WAV réellement décodés : Lecture/Pause/reprise, arrêt à zéro, annulation d’une Lecture en préparation, moniteur conditionnel, export/import d’un package avec média, génération du PDF, préchargement conservé, absence d’erreurs JavaScript.

Vues 1440, 820, 390 et 320 px : Edit/Show sans débordement horizontal. Captures examinées sur ordinateur et téléphone. Tests hors ligne réussis, y compris app.js après son extraction du HTML. Activation du nouveau service worker : anciens caches S2A/ShowCue supprimés, cache d’une autre application conservé.

Configurations d’écrans simulées : étendu accepté ; miroir et écran unique refusés. Ces tests ne remplacent pas une vérification avec écrans physiques.

## À vérifier sur vos appareils

- Importer une conduite habituelle avec images, audio, vidéo, boucles, points IN/OUT, fondus et Stop tous les médias. Tester Lecture/Pause/reprise, seek, changements de Cue et Retour au début, y compris pendant un chargement.
- Installer depuis Chrome puis Safari iPhone/iPad. Vérifier le nom exact et l’icône sur l’écran d’accueil, puis fermer/réouvrir et tester en mode avion après un premier chargement complet.
- Sur une installation existante, ouvrir la nouvelle version en ligne puis la relancer. Si le système conserve l’ancienne icône malgré le nouveau manifest, exporter d’abord la conduite puis supprimer/réinstaller le raccourci PWA. Le système d’exploitation décide du délai de rafraîchissement de l’icône.
- Vérifier le moniteur Show avec vidéo, son emplacement en bas et sa disparition sur une conduite sans vidéo.
- Sur ordinateur avec navigateur compatible, ajouter une vidéo et autoriser l’accès ; tester affichage étendu, puis miroir, débranchement et rebranchement. Vérifier le placement et le plein écran de la sortie.
- Safari et les navigateurs sans API de gestion des écrans gardent la sortie externe grisée : aucune supposition basée sur la taille d’écran. Le moniteur local reste utilisable. [Documentation Chrome sur la gestion des écrans](https://developer.chrome.com/docs/capabilities/web-apis/window-management).
- Vérifier le PDF d’une conduite réelle avec accents, images et plusieurs pages, ainsi que la récupération des sauvegardes habituelles.
- Faire une répétition de durée réelle sur iPhone/iPad/ordinateur, avec les médias habituels, en observant fluidité, mémoire et température. Les performances et installations Safari sur appareils physiques n’ont pas été mesurées ici.

## Mesures de performance

Mesures conservées de la comparaison 1.4.1 / 1.4.2 ; elles n’ont pas été remesurées pour les ajustements 1.4.3 à 1.4.7. Ces chiffres ne mesurent pas les nouveaux aperçus audio/vidéo.

Mesure comparative unique dans Chrome headless sur ce Mac : 100 Cues comprenant chacune une action audio, lecture pendant 5 secondes avant les médias futurs, sans décodage simultané de ces 100 médias. Les tailles iPad/iPhone sont des vues simulées dans Chrome, pas des appareils physiques. Le temps CPU ci-dessous est celui des tâches navigateur pendant la fenêtre mesurée ; ce n’est pas un pourcentage CPU système.

| Vue | CPU tâches 1.4.1 | CPU tâches 1.4.2 | Mémoire JS 1.4.1 | Mémoire JS 1.4.2 |
|---|---:|---:|---:|---:|
| Ordinateur 1440 px | 931 ms | 180 ms | 2,73 Mo | 3,60 Mo |
| iPad simulé 820 px | 1028 ms | 188 ms | 2,73 Mo | 3,61 Mo |
| iPhone simulé 390 px | 1279 ms | 180 ms | 2,73 Mo | 3,59 Mo |

Le temps CPU baisse dans ce scénario ; les caches ajoutent un peu de mémoire JS. Une mesure unique de mémoire dépend aussi du ramasse-miettes : elle ne démontre ni une baisse générale de mémoire, ni l’absence de fuite sur un show long. Un essai de durée réelle avec les médias définitifs reste nécessaire.
