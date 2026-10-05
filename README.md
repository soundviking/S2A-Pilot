## Version 1.4.18

Pastille VIDÉO violette, assortie aux bandes vidéo de la timeline.

[Télécharger la PWA 1.4.18](downloads/S2A-Pilot-V1.4.18-PWA.zip)

## Correctif 1.4.17

Timeline de hauteur automatique : aucune bande média tronquée, zone distincte pour les durées. Bandes audio vertes translucides ; vidéos violettes.

[Télécharger la PWA 1.4.17](downloads/S2A-Pilot-V1.4.17-PWA.zip)

Correctif 1.4.16 : cache du service worker versionné correctement ; lanceur local avec actualisation des fichiers, sans suppression des projets IndexedDB.

# S2A Pilot

S2A Pilot, développé par S2A Production, prépare et conduit des spectacles multimédias. S2A Copilote importe les projets dans QLab 5.

## Versions actuelles

- **S2A Pilot 1.4.16** : application web installable, modes Edit et Show.
- **S2A Copilote 1.2.5** : application macOS universelle Intel et Apple Silicon, macOS 13 minimum.

## Nouveautés Pilot 1.4.16

Les bandes médias sont intégrées à la timeline avec un fond translucide. La mention de waveform sous la timeline est supprimée.

## Nouveautés Pilot 1.4.14

- Départ sans Cue imposée. **+ Cue** crée un repère ; **+ Média** crée une Cue audio ou vidéo.
- Sauvegarde locale automatique dès la saisie ; bouton Enregistrer supprimé, export via Enregistrer sous… conservé.
- Show paysage : Cue active et prochaine Cue côte à côte, timeline en dessous et déplacements temporels verrouillés.
- Waveform combinée et position des médias en Edit et Show ; cache réutilisé, aucun recalcul à chaque frame.
- Zoom par pincement bloqué ; défilement et boutons de zoom des éditeurs conservés.
- PDF : temps écoulé et temps restant entre parenthèses, calculé jusqu’à la fin de la conduite.

[Télécharger la PWA 1.4.16](downloads/S2A-Pilot-V1.4.16-PWA.zip)

Tests automatisés Chrome, restauration locale, anciens projets, export hors ligne et mise en page PDF validés. Le blocage du pincement Safari / PWA reste à confirmer sur iPad réel.

## Modifications précédentes

- Logo bleu et orange de Copilote restauré et arrondi dans la fenêtre.
- Numéros QLab hiérarchiques pour les nouveaux imports : groupe 5, étapes 5.1, 5.2, 5.3… Les collisions sont évitées sans modifier les autres cues.
- Copilote compilé est directement inclus dans chaque archive de projet, sans compilation supplémentaire, également hors ligne.
- Saisie `02.41` ou `02,41` comprise comme 2 minutes 41 secondes ; déplacer une Cue sans média prolonge automatiquement la timeline.
- Audio : Cut par défaut pour la Cue permanente à zéro ; fondu de 3 secondes pour les autres nouvelles Cues.
- Interface responsive, bascule Edit / Show, préchargement automatique, moniteur vidéo et aperçu des médias avec waveform, lecture indépendante et zoom.
- Conduite PDF consultable dans l’application, téléchargement explicite, en-tête photographique et cinq Cues standards par page.

## Utilisation et hébergement

Servir **tout le dossier PWA/** sur HTTPS, y compris `companion/`, `assets/`, `icons/`, `technical-preview.js` et le service worker. Ouvrir l’adresse du dossier (par exemple `/s2a-pilot/`). `index.html` reste le fichier d’accueil interne ; son nom est retiré de l’adresse affichée par l’application.

Le projet s’enregistre en `.s2apilot.zip` avec médias, visuels, conduite et **companion/S2A Copilote.app**. Glisser l’application dans Applications, puis ouvrir les packages pour les importer dans QLab. L’application utilise une signature locale de test.

## Vérifications

Compilation native Intel et Apple Silicon, signature de l’application extraite, conservation des permissions, export et réimport des projets en ligne et hors ligne validés. Tests du modèle Copilote et des scripts d’import réalisés avec QLab simulé ; numérotation testée et scripts compilés avec le dictionnaire QLab installé.

À vérifier avant exploitation : import réel dans QLab 5, fonctionnement sur Mac Intel physique, PWA sur iPhone/iPad et sortie sur un véritable écran étendu. Les versions précédentes et leurs tests sont détaillés dans les guides.

## Documentation et sources

- [Guide PWA et historique](PWA/README.md)
- [Copilote : installation et tests](S2A-Copilote/README.md)
- [Rapport de vérification](PWA/verification.json)

Pour compiler Copilote depuis les sources : `cd S2A-Copilote && ./build.sh`. La distribution prête à installer est universelle ; aucune compilation n’est nécessaire pour l’utilisateur.
