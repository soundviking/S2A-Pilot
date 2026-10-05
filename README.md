# S2A Pilot

## Installer S2A Copilote si macOS bloque son ouverture

L’application est signée localement et n’est pas notariée par Apple. Après décompression, glisser **S2A Copilote.app** dans **Applications**, puis essayer de l’ouvrir une première fois.

1. Si macOS la bloque, fermer le message et ouvrir **Réglages Système → Confidentialité et sécurité**.
2. Descendre jusqu’à **Sécurité** et cliquer sur **Ouvrir quand même** pour **S2A Copilote**.
3. Valider avec le mot de passe ou Touch ID si demandé, puis confirmer **Ouvrir**.

Le bouton apparaît après la tentative d’ouverture. S’il a disparu, essayer à nouveau d’ouvrir l’application puis revenir dans ces réglages. Une nouvelle version peut demander une nouvelle autorisation. Autoriser l’application téléchargée depuis ce dépôt officiel. [Procédure Apple](https://support.apple.com/fr-fr/102445).

Lors du premier import, autoriser aussi le contrôle de **QLab** : il s’agit d’une permission distincte. Une notice accompagne l’application dans le ZIP macOS et dans chaque projet exporté (`companion/INSTALLATION.txt`).


![S2A Pilot — conduite de spectacle](assets/social-preview.jpg)

Application de préparation et de conduite de spectacles multimédias, développée par **S2A Production**. Le compagnon **S2A Copilote** importe les projets dans **QLab 5**.

## Versions actuelles et téléchargements

- **[S2A Pilot 1.4.29 — PWA](downloads/S2A-Pilot-V1.4.29-PWA.zip)**
- **[S2A Copilote 1.2.5 — application macOS universelle](downloads/S2A-Copilote-1.2.5-macOS-Universel.zip)** : Intel et Apple Silicon, macOS 13 minimum.

## Raccourci clavier 1.4.29

**Espace** bascule entre Lecture et Pause de la timeline générale, en Edit et Show. Le raccourci est ignoré pendant la saisie, dans les fenêtres de dialogue et sur les autres commandes ayant leur propre action clavier. Maintenir la touche ne provoque pas de bascules répétées. Les aperçus médias conservent leurs commandes indépendantes.

## Édition des Cues 1.4.28

Le déplacement d’un repère sur la timeline est visible avant le relâchement : repère, temps et bande média suivent le geste sur une échelle stable. Le nouvel horaire est validé au relâchement ; une interruption annule l’aperçu. La liste se reclasse ensuite automatiquement.

Le bouton **Dupliquer**, à côté de Supprimer dans la Cue déroulée, crée une copie au même temps avec titre, description, visuel et réglages médias. Les identifiants des actions sont distincts et les fichiers médias sont réutilisés. Les réglages de la copie sont indépendants. L’annulation et la sauvegarde automatique sont conservées.

Retour visuel avant relâchement, validation, annulation du déplacement, duplication, indépendance des réglages et largeur mobile contrôlés dans Chrome. Geste tactile à confirmer sur iPad réel.

## Actualisation et démarrage 1.4.27

Le programme et les modules PDF se chargent avec une URL liée à leur version. Le numéro affiché correspond au programme exécuté. Les pages utilisent le réseau avec repli hors ligne ; le service worker ne mélange plus les caches d’autres versions et son précache ignore les anciens fichiers HTTP. Un diagnostic apparaît si le démarrage échoue. La sortie vidéo est masquée dès le HTML.

**Déploiement : remplacer tous les fichiers, inclure `.htaccess` et purger le cache Cloudflare de `/qlab/`.** Le 5 octobre, les URLs habituelles de ce serveur servaient encore 1.4.20, avec un cache de 31 jours. Lire [DEPLOIEMENT.txt](PWA/DEPLOIEMENT.txt). Ne pas supprimer les données du site : `actualiser.html` conserve les projets locaux.

Version identique/supérieure, boutons Cue/PDF, sortie vidéo masquée, panne de chargement, PDF hors ligne et projet conservé après actualisation vérifiés dans Chrome. Safari iPad réel reste à confirmer après le remplacement des anciens fichiers sur le serveur.

## Édition des Cues 1.4.26

La Cue sélectionnée se distingue par un contour bleu clair, un repère latéral et un fond renforcé sur toute sa hauteur. Une poignée à gauche permet de déplacer les Cues par glisser-déposer dans la liste. Le déplacement ajuste leur temps entre les Cues voisines ; avant la première Cue, le temps devient 00:00.0. L’ordre reste chronologique. Alt + flèches est aussi disponible au clavier. Annulation et sauvegarde automatique conservées.

Déplacement vers zéro, insertion entre deux Cues, annulation, clavier, sauvegarde et largeur mobile vérifiés dans Chrome. Geste tactile à confirmer sur iPad réel.

## Libellé 1.4.24

Le bouton **+ Musique / Vidéo** importe un fichier audio ou vidéo et crée une nouvelle Cue. **+ Cue** crée un repère avec titre, description et visuel.

## Correctif de démarrage 1.4.21

La vérification de permission d’écran non prise en charge ne bloque plus l’initialisation. L’API est interrogée uniquement lorsqu’un affichage étendu peut être détecté. Compatibilité renforcée pour Array.at, ResizeObserver et AbortSignal.timeout. Blocage reproduit et correctif validé avec API indisponible simulée dans Chrome : Nouveau, + Cue et PDF fonctionnels. À confirmer dans Safari sur iPad réel.

## Sortie vidéo 1.4.22

En Show, la sortie vidéo apparaît uniquement si au moins une vidéo est présente. Sans affichage étendu le bouton reste grisé. Il disparaît après suppression de la dernière vidéo.

## Correctif PDF 1.4.23

L’aperçu et la photo d’en-tête fonctionnent aussi lors d’une ouverture directe de index.html en file:// : chargement classique différé, sans import dynamique soumis à CORS. Pour toutes les fonctions PWA et l’export du compagnon, utiliser le lanceur local ou un serveur HTTPS.

## Préparer une conduite

Un nouveau projet commence sans Cue imposée. **+ Cue** crée un repère avec titre, description et visuel. **+ Musique / Vidéo** importe une musique ou une vidéo dans une nouvelle Cue, au temps courant. Toutes les Cues peuvent être déplacées ou supprimées, y compris celles à zéro.

Les médias disposent de points IN / OUT, Loop, waveform, aperçu vidéo, lecture indépendante et zoom. La saisie `02.41` ou `02,41` correspond à 2 minutes 41 secondes. Une Cue placée au-delà de la durée actuelle prolonge la timeline. Le premier média audio d’une Cue à zéro utilise Cut par défaut ; les autres nouveaux médias audio utilisent un fondu de trois secondes. Les réglages des projets importés sont conservés.

Les modifications sont sauvegardées automatiquement sur l’appareil, dès la saisie. **Enregistrer sous…** produit le package portable `.s2apilot.zip`, avec médias, visuels, PDF et **companion/S2A Copilote.app** prête à installer.

## Timeline et mode Show

- Waveform combinée et bandes médias translucides en Edit et Show : **audio vert, vidéo rose vif**.
- Hauteur de timeline adaptée au nombre de bandes, avec espace réservé aux graduations.
- Pastilles audio/vidéo dans les Cues ; aucune pastille pour les Cues sans média.
- Sur ordinateur en paysage, Cue active à gauche, prochaine Cue à droite et timeline en dessous.
- En Show, les clics sur la timeline ne déplacent pas la lecture. Lecture / Pause et Retour au début restent disponibles.
- Préchargement automatique, moniteur vidéo conditionnel et sortie vidéo pour un véritable affichage étendu.
- Zoom de page par pincement bloqué ; défilement et boutons de zoom des éditeurs conservés.

## Conduite PDF

Aperçu intégré avec téléchargement explicite, en-tête photographique, blocs arrondis, compteurs audio/vidéo et cinq Cues standards par page. Chaque Cue affiche le temps écoulé et le temps restant jusqu’à la fin de la conduite **entre parenthèses**. Les descriptions longues continuent sur les pages suivantes.

## Installation et mises à jour

Déployer **tout le contenu de PWA/** sur HTTPS : `index.html`, `app.js`, `manifest.webmanifest`, `service-worker.js`, `version.json`, `actualiser.html`, `technical-preview.js`, `technical-header-data.js`, `assets/`, `icons/` et `companion/`. Le serveur doit ouvrir index.html comme page d’accueil du dossier ; partager une adresse telle que `/s2a-pilot/`, sans ajouter index.html.

Depuis la 1.4.19, l’application vérifie la version publiée sur le serveur au démarrage, au retour dans l’application et toutes les cinq minutes lorsqu’elle est visible. Une version plus récente est proposée sans actualisation forcée pendant Show ou lecture. La sauvegarde locale précède l’actualisation ; les projets IndexedDB sont conservés. Sans réseau, la version du serveur n’est pas confirmée et l’utilisation hors ligne reste disponible. Publier l’ensemble des fichiers de la même version avant de la rendre disponible.

Pour tester localement sur Mac, décompresser la PWA et lancer **Démarrer S2A Pilot.command**. Fermer les anciennes fenêtres et arrêter l’ancien serveur avec Ctrl+C avant de lancer un autre dossier. Le lanceur actualise les caches de fichiers de l’application sans supprimer les projets locaux.

## S2A Copilote et QLab

Logo bleu et orange, angles arrondis dans la fenêtre, détection des workspaces, sélection si plusieurs sont ouverts et import de plusieurs packages. Les groupes conservent leur numéro ; les étapes des nouveaux imports utilisent une numérotation hiérarchique : **5, puis 5.1, 5.2, 5.3…**, en évitant les numéros déjà utilisés. Les anciennes conduites QLab ne sont pas renumérotées.

Glisser l’application dans Applications ; aucune compilation n’est nécessaire. La distribution utilise une signature locale. Pour compiler les sources avec Xcode : `cd S2A-Copilote && ./build.sh`.

## Vérifications et limites

Parcours de création, sauvegarde et restauration, anciens projets, réglages média après autosave, suppression/annulation, Show paysage et timeline verrouillée vérifiés dans Chrome. Six bandes médias intégralement visibles vérifiées. PDF cinq/dix Cues, descriptions longues, aperçu et exports hors ligne contrôlés ; rendu PDF inspecté visuellement. Vérification des versions serveur identiques/supérieures, protection Show et panne réseau testées.

Copilote : compilation Intel/Apple Silicon, signature et permissions de l’application extraite vérifiées ; modèle et scripts d’import testés avec QLab simulé, scripts compilés avec le dictionnaire QLab installé.

À confirmer sur matériel réel avant exploitation : pincement dans Safari et PWA sur iPad, fluidité/CPU/mémoire avec les médias du spectacle, sortie sur écran étendu, import dans un workspace QLab réel et exécution sur Mac Intel physique. Les changements de couleur de la 1.4.20 ont fait l’objet d’un contrôle du code ; les parcours complets correspondent aux versions de test précédentes.

## Documentation

- [Guide PWA et historique](PWA/README.md)
- [Copilote : installation et tests](S2A-Copilote/README.md)
- [Rapports de vérification](PWA/verification.json)

## Aperçu social GitHub

Le visuel [social-preview.jpg](assets/social-preview.jpg) est prêt à charger dans Settings → General → Social preview → Edit → Upload an image. Format 1280 × 640 px, JPEG inférieur à 1 Mo. Ajouter le fichier au dépôt ou au README n’active pas à lui seul l’aperçu social : ce réglage doit être appliqué sur GitHub. Pour un dépôt privé, GitHub limite cette fonctionnalité ; consulter sa documentation avant activation.
