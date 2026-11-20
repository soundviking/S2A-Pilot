# Pilot 1.11.5 bêta / Bridge 1.6.32 bêta

- Bridge et Copilot : filtrage Sans type / Son / Lumière / FX et types personnalisés ; descriptions colorées par type et repères de timeline colorés. L’import conserve désormais ces métadonnées, y compris en mode Manuel. Les numéros importés avec une ancienne version doivent être réimportés depuis leur export Pilot pour récupérer les types qui n’avaient pas été conservés.
- Bridge Show : fin estimée sous le titre et temps écoulé/durée à droite sous la timeline, comme dans Pilot.
- Les vignettes sans visuel affichent le logo Pilot centré dans les dimensions existantes, dans Pilot, Bridge et Copilot. Les règles de taille des cues active, suivante et autres restent inchangées.

- Arrêt avec Échap dans QLab : Bridge et Copilot se préparent sur la cue armée pour le prochain GO ; la sélection restée sur le numéro arrêté ne le fait plus revenir au début. Lecture et pause restent prioritaires.
- Le crayon des repères du Show permet de modifier le temps au format minutes:secondes.millisecondes, en plus du nom et de la description. Le séparateur décimal virgule est aussi accepté.
- Sauvegarde atomique dans l’index du workspace, maintien des identifiants, réordonnancement chronologique et mise à jour de la timeline, du décompte, du suivi et de Copilot.
- Contrôle des valeurs négatives, de la fin du numéro et des modifications concurrentes. Les brouillons sont préservés lors des rafraîchissements ou d’un échec d’enregistrement.
- Le temps du repère est distinct de la programmation des médias QLab : ces déclenchements restent à éditer dans QLab. Les cues principales lancées au GO n’ont pas de temps absolu de repère.
- Interface disponible en français, anglais, espagnol et allemand.

Validation : tests du formulaire, du payload, de la persistance/réouverture, du réordonnancement, des conflits et des bornes ; compilation macOS universelle et signature dans le workflow bêta. Aucun spectacle QLab réel n’est exécuté par ces tests.

---

# Pilot 1.11.4 bêta / Bridge 1.6.31 bêta

- Correction Bridge Show : une pulsation par seconde, calée sur les secondes du décompte ; les halos de la cue suivante et du décompte utilisent la même phase.
- Fin estimée : utilise uniquement la durée restante du numéro affiché, sans additionner les numéros suivants du workspace QLab.
- Copilot depuis Bridge : sans cue en lecture ou en pause, la sélection QLab sert de prévisualisation avec la timeline du numéro sélectionné. Lecture et pause conservent la priorité absolue ; Pilot seul reste inchangé.
- Icône Bridge : catalogue natif macOS moderne, fond ambre et ailes cyan conservés, avec variante ICNS pour les anciens macOS.
- Les rafraîchissements QLab ne déplacent plus le bloc décompte et ne peuvent plus relancer son animation.
- Arrêt de la pulsation en pause, hors des dix dernières secondes et en cas de perte de synchronisation. Le mode de réduction des animations reste respecté.

Tests : pics sur les secondes, creux entre deux secondes, stabilité du bloc pendant douze rafraîchissements, changement de cue, pause et perte de connexion. Compilation universelle macOS et signature vérifiées par le workflow bêta.

---

# Pilot 1.11.3 bêta / Bridge 1.6.30 bêta

- Télécommande QLab directement depuis Bridge, sans ouvrir Pilot : autorisation et code de quatre chiffres dans le popup Copilot, vérification serveur, invalidation des accès lors d'un changement de code.
- Commandes limitées au workspace connecté, contrôle du playhead, rejet des commandes périmées et des doublons, protection de 500 ms entre deux GO. Les cues principales peuvent être préparées sans être lancées.
- Copilot : un seul halo, priorité à la sous-cue ; mise à jour depuis l'horloge Bridge et placement de chaque nouvelle cue active à 20 px sous la timeline. Aucun recentrage entre deux changements.
- Bridge Show : Iceman, logo ambre BRIDGE avec ailes cyan et fin estimée de la conduite restante. Attentes de GO exclues, pause et durées inconnues indiquées, estimation masquée hors synchronisation.
- Interfaces et nouveaux messages disponibles en français, anglais, espagnol et allemand. Cache hors ligne, version affichée et archive Pilot alignés sur 1.11.3.

Validation locale : scénarios PHP/SQLite de code, rôles, limitation d'essais, rotation, commandes et acknowledgements ; tests DOM de halo et suivi ; tests de projection de fin.
Les contrôles macOS automatisés et leurs résultats sont consignés dans verification.json. Aucun spectacle QLab réel ni téléphone physique n'est utilisé par ces contrôles.

---

# Pilot 1.11.2 bêta — correction Copilot

- Un seul halo : la sous-cue active a priorité sur sa cue principale. Sans sous-cue active, la principale courante est mise en évidence.
- Le suivi vertical ne se déclenche qu'au changement de cue ou de sous-cue active. Mise à jour d'horloge, sélection QLab, reconstruction de la liste, vue compacte et redimensionnement mobile conservent la position manuelle.
- L'écart de 20 pixels sous le bloc fixe est conservé.
- Le contrôle par code de Pilot 1.11.1 est conservé.

Bridge reste en 1.6.29, inchangé. La télécommande QLab directement depuis Bridge nécessite encore une extension de son moteur natif. Les archives reçues contiennent le .app compilé, sans les fichiers Swift permettant cette extension. Cette livraison ne prétend pas activer cette fonction.

Validation : tests DOM couvrant parent et sous-cue simultanés, transition entre sous-cues et principales, sélection QLab, changement de descriptions, horloge, redimensionnement et vue compacte. Tests de l'interface du code télécommande et d'Iceman conservés.

---

# Pilot 1.11.1 bêta / Bridge 1.6.29

- Télécommande Copilot : code obligatoire de quatre chiffres, configurable dans le popup hôte, vérifié côté serveur à la connexion et au changement de rôle. Limitation des essais, stockage privé sous forme de HMAC et invalidation des anciennes autorisations lors d’un changement de code.
- Suppression du paragraphe explicatif du popup Copilot ; champ de code compact et messages traduits FR/EN/ES/DE.
- Copilot/QLab : le halo suit la cue courante ; la sélection QLab seule ne provoque plus de halo ni de reconstruction de la liste.
- Marge de suivi de 20 pixels sous le bloc fixe.
- Bridge : Iceman pour tous les types de conduite, icône ambre BRIDGE et ailes cyan. Mise à jour du bundle et nouvelle signature ad hoc.
- Nettoyage ciblé : ancienne mention Bridge 1.6.4 corrigée dans l’export et ses traductions, instructions de déploiement obsolètes remplacées, bundles de compatibilité et cache hors ligne régénérés. Les anciennes archives restent conservées à part.

Vérifications : API PHP/SQLite avec scénarios d’accès, changement de rôle, rotation du code, annulation de commandes et limitation d’essais ; tests DOM des interfaces Pilot/Copilot/Bridge ; contrôle des versions, des assets hors ligne et des empreintes de signature des deux architectures Bridge.
Le lancement natif sur macOS, QLab et le test sur des téléphones physiques restent à effectuer sur le matériel réel.

---

# S2A Pilot - historique des modifications

## 1.11.0 bêta

- Diagnostic détaillé des médias refusés à l’import.
- Une alerte par coupure prolongée du relais Copilot, avec catégorie pour les 503 émis par le relais.

## 1.10.30 bêta

- Retrait de l’entrée Flic. Le GO reste accessible par son raccourci clavier.

## 1.10.29 bêta

- Copilot peut utiliser le réseau local avec le lanceur Pilot. Configuration Flic 2 en mode clavier et envoi OSC sur les Cues en Live.

## 1.10.28 bêta

- Estimation de l’heure de fin en Live, avec indication des pauses et attentes GO.
- Mise à jour d’un Numéro visuel à partir de la bibliothèque après aperçu des sous-Cues, de la durée et de la préparation.

## 1.10.27 bêta

- Après une coupure Copilot détectée par Pilot, les commandes de l’ancienne connexion expirent. La télécommande reprend sur le dernier état reçu de Pilot.
- Un projet avec LTC conserve sa sortie audio si la nouvelle carte sélectionnée propose moins de quatre canaux.

## 1.10.26 bêta

- Vérification avant spectacle dans la boîte à outils, avec médias prêts ou indisponibles, sortie audio sélectionnée et pistes utilisant le LTC.

## 1.10.25 bêta

- Vue compacte dans Copilot, avec choix indépendant sur le téléphone.
- La télécommande applique le délai anti-double GO de Pilot. Pilot conserve la protection même si une commande arrive par un autre appareil.
- Checklist réorganisée autour des rubriques et de l’avancement, avec les commandes de préparation et les options PDF à portée de main.

## 1.10.24 bêta

- Retrait des profils de volume de l’engrenage et des pistes. Les gains déjà appliqués restent enregistrés dans les spectacles.

## 1.10.23 bêta

- Vue Live compacte avec suivi de lecture, descriptions et miniatures.
- Délai réglable entre deux GO manuels, de 0 à 2 000 ms. Les enchaînements automatiques conservent leur timing.
- Profils de gain locaux, réutilisables sur les pistes audio en Edit.

## 1.10.22 bêta

- L’historique permet d’annuler un import PDF par sélection, avec aperçu des coches à restaurer et des lignes protégées. Les modifications ultérieures sont détectées même quand la case est revenue à la valeur importée.
- Les restaurations sont signalées dans le relevé. Les imports antérieurs à la 1.10.22 restent consultables.

## 1.10.21 bêta

- Récapitulatif des coches modifiées après chaque import PDF, avec le fichier retenu ou le choix manuel. Les dix derniers imports sont conservés dans le spectacle.
- Le relevé indique la date, les totaux, les PDF importés et l’ordre de priorité utilisé. Il propose une recherche, un filtre des choix manuels et un export CSV.
- L’aperçu peut afficher seulement les conflits et permet de sélectionner ou désélectionner toutes les propositions hors conflit.

## 1.10.20 bêta

- L’aperçu des conflits affiche le PDF retenu par l’ordre de priorité. Un choix qui diffère de la proposition est signalé comme manuel, avec le fichier proposé en référence.

## 1.10.19 bêta

- Les PDF en conflit peuvent être classés par priorité. « Utiliser cet ordre » choisit pour chaque conflit la valeur du premier fichier qui contient la case. Chaque choix reste modifiable dans l’aperçu avant application.

## 1.10.18 bêta

- Dans l’aperçu de réimportation, choisir un PDF prioritaire préremplit les conflits couverts par ce fichier. Les choix restent modifiables case par case jusqu’à l’application.

## 1.10.17 bêta

- La réimportation de plusieurs PDF présente un seul aperçu. Chaque conflit indique les fichiers qui proposent de cocher ou de décocher. La coche actuelle est conservée tant qu’aucune autre valeur n’est choisie.
- Les PDF individuels exportés depuis cette version sont également réimportables. Les récapitulatifs depuis la 1.10.15 restent compatibles.

## 1.10.16 bêta

- La réimportation d’un PDF présente les cases à cocher ou à décocher avant toute modification. Chaque changement peut être sélectionné individuellement. Annuler conserve la checklist telle quelle.

## 1.10.15 bêta

- La sélection des numéros permet de télécharger le récapitulatif interactif seul ou de l’inclure dans le ZIP.
- Les récapitulatifs exportés depuis cette version permettent de réimporter leurs coches dans le même spectacle. Les lignes renommées ou supprimées sont ignorées et les changements de coche peuvent être annulés. Les PDF imprimés ou aplatis ne conservent pas leurs champs.

## 1.10.14 bêta

- Le PDF récapitulatif affiche les numéros sélectionnés sous chaque élément partagé. L’élément conserve une seule case interactive et sa coche. Une longue liste de numéros se poursuit sur la page suivante sans dupliquer la case.

## 1.10.13 bêta

- Le ZIP de checklist ajoute un PDF récapitulatif interactif des numéros sélectionnés. Chaque libellé partagé y apparaît une seule fois. Si des lignes identiques existent déjà, la coche est reprise dès qu’une de ces lignes est cochée.

## 1.10.12 bêta

- L’export ZIP de la checklist propose une sélection de numéros. Tous sont cochés à l’ouverture. Le ZIP contient les PDF des numéros cochés avec leurs éléments partagés et les coches au moment de l’export.

## 1.10.11 bêta

- Depuis la checklist d’un spectacle, un ZIP rassemble un PDF par numéro, même lorsqu’un filtre est actif. Les éléments partagés et leurs coches sont repris dans chaque PDF concerné. Les numéros sans élément ont une page qui l’indique.

## 1.10.10 bêta

- Le PDF interactif de la checklist exporte les lignes du numéro sélectionné, y compris les éléments partagés et leurs coches actuelles. Le numéro figure dans le PDF et le nom de fichier. « Tous les numéros » exporte la checklist complète.

## 1.10.9 bêta

- Le filtre de la checklist permet d’afficher un seul numéro. Les éléments partagés utilisent la même ligne et la même coche dans toutes les vues. Les compteurs suivent le filtre.

## 1.10.8 bêta

- Chaque ligne rattachée de la checklist affiche les noms et positions des numéros qui l’utilisent. La liste est recalculée à l’ouverture de la checklist et après un rattachement ou un détachement.

## 1.10.7 bêta

- Dans la checklist, « Rattacher aux numéros » est proposé pour chaque ligne existante dont le libellé correspond au matériel ou à une consigne. Le choix se fait ligne par ligne et conserve les coches.
- « Détacher » rend la ligne indépendante. Un élément rattaché reste tant qu’un numéro l’utilise. Le lien est conservé dans le ZIP du spectacle.

## 1.10.6 bêta

- Retirer un numéro retire aussi ses éléments générés qui ne servent plus à aucun autre numéro. Les éléments partagés gardent leur coche.
- Les lignes manuelles, les lignes retouchées et les lignes créées avant 1.10.6 sont conservées. Les versions précédentes ne mémorisaient pas leur provenance.
- Le ZIP de conduite conserve la provenance des nouvelles lignes générées. Annuler rétablit ensemble le numéro et les éléments retirés.

## 1.10.5 bêta

- En Edit, « Préparation du numéro » enregistre le matériel à emporter et les consignes d’installation, un élément par ligne. Le bouton est accessible dans Numéro visuel et dans la Cue principale du numéro en mode Spectacle.
- Les données de préparation suivent le numéro dans les archives et les copies indépendantes de la bibliothèque.
- « Générer depuis les numéros » complète la checklist du spectacle. Les libellés identiques à la casse et aux espaces près sont ajoutés une seule fois. Les éléments déjà présents gardent leur identifiant et leur coche. Les anciens éléments restent modifiables.

## 1.10.4 bêta - 12 novembre 2026

- L’alerte avant lecture identifie les cues dont les médias sont absents ou non préparés. Les références audio et vidéo absentes d’un ZIP restent visibles dans la conduite importée.
- En Edit, « Bibliothèque de numéros » permet d’enregistrer le Numéro visuel ouvert ou d’importer une archive. En mode Spectacle, « Ajouter une copie » insère une copie indépendante à la fin de la conduite.
- La bibliothèque est locale au navigateur. Retirer une entrée de la bibliothèque n’efface pas les copies déjà ajoutées à un spectacle.

## 1.10.3 bêta - 12 novembre 2026

- Dans Boîte à outils → Checklist, « Ajouter la préparation du spectacle » propose trois rubriques modifiables : matériel à emporter, installation sur place et vérifications avant spectacle.
- Une seconde utilisation complète les rubriques reconnues sans ajouter deux fois les mêmes suggestions. Les éléments déjà présents gardent leurs identifiants, leurs liens et leur état.
- L’avancement apparaît pour la checklist entière et par rubrique. Une ligne sans texte ne compte pas. « Tout décocher » remet l’avancement à zéro.
- Les libellés sont disponibles en français, anglais, espagnol et allemand. Le texte d’une suggestion reste éditable une fois ajouté.
- Les projets utilisent le même format ZIP et le même stockage. Le moteur audio et les commandes Live sont inchangés.

## Livraisons précédentes

- 1.10.2 bêta : synchronisation des rampes pour les fondus entre sous-cues dans Safari.
- 1.10.1 bêta : lecture d’une sous-cue à 00:00 au GO dans Safari.
- 1.10.0 bêta : commandes compactes de transition entre sous-cues et nom partagé entre cue et piste.
