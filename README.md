# S2A Pilot 1.4.40 / S2A Copilote 1.2.8

🇫🇷 **Français** | 🇬🇧 [English](README.en.md)

![S2A Pilot](assets/social-preview.jpg)

[PWA 1.4.40](downloads/S2A-Pilot-V1.4.40-PWA.zip) · [Copilote 1.2.8 — Intel / Apple Silicon](downloads/S2A-Copilote-1.2.8-macOS-Universel.zip)

# S2A Pilot — Guide utilisateur

Les droits sur S2A Pilot et S2A Copilote appartiennent à la société S2A Production. Ces applications ont été développées par Antoine CLOPIER, avec l’aide de ChatGPT.

S2A Pilot prépare et joue des conduites multimédias. S2A Copilote importe leurs packages dans QLab 5.

## Langue

Au premier lancement, la PWA choisit le français si la langue principale du navigateur est française, sinon l’anglais. FR / EN dans l’en-tête permet de changer ce choix, mémorisé sur l’appareil. Copilote détecte la langue de macOS et propose Français / English. Les titres, descriptions et noms de médias des projets restent inchangés. Les PDF et notices exportés suivent la langue de l’interface.

## Création et édition

Un projet commence vide. + Cue crée une indication avec titre, description et visuel. + Musique / Vidéo importe un fichier dans une nouvelle Cue au temps courant. Retour au début permet de revenir à zéro avant l’import.

Les Cues sont classées par temps. 02.41, 02,41 et 02:41.0 signifient 2 minutes 41. Une Cue peut prolonger la timeline. Toutes les Cues peuvent être déplacées ou supprimées, même à zéro. La poignée à gauche permet le glisser-déposer dans la liste ; le temps est ajusté entre les Cues voisines. Avant la première Cue, le temps devient zéro. Alt + flèches fonctionne au clavier sur la poignée.

La sélection est mise en évidence en bleu. Le déplacement d’un repère sur la timeline affiche en direct sa position, son temps et sa bande média, avec une échelle stable jusqu’au relâchement. Dupliquer, à côté de Supprimer dans la Cue déroulée, conserve les informations et réglages au même temps. Les réglages sont indépendants ; les fichiers sont réutilisés. Annuler / Rétablir permet de revenir sur ces changements.

## Médias et timeline

Chaque fichier a sa propre lecture indépendante, sa waveform, IN / OUT, Loop et zoom − / +. Une vidéo ajoute un aperçu. Après zoom, faire défiler horizontalement. Le dessin utilise la portion visible à la résolution de l’écran.

Le premier nouvel audio à zéro utilise Cut ; les autres utilisent un fondu de trois secondes. Les réglages importés sont conservés. Ajouter visuel / Changer visuel concerne l’image de repérage, distincte du média joué.

La timeline générale affiche les bandes audio vertes et vidéo roses ainsi que la waveform combinée des médias audibles. Sa hauteur s’adapte aux bandes. Son zoom jusqu’à ×32 est disponible uniquement en Edit. En Show, elle retrouve sa vue complète.

Lecture / Pause ou Espace commande la conduite. Le raccourci ignore la saisie, les dialogues et les commandes ayant leur propre action clavier ; maintenir la touche ne répète pas les bascules. Retour au début met en pause, arrête les médias et revient à zéro.

## Show et sortie vidéo

En paysage large : Cue active à gauche avec halo bleu, prochaine Cue à droite avec titre et temps côte à côte, description dessous et visuel centré 16/9. Sur petit écran, le temps passe sous le titre. Les descriptions longues restent intégrales et peuvent agrandir les boxes. La timeline est verrouillée pour le déplacement du temps en Show. Le moniteur vidéo apparaît uniquement si une vidéo est présente.

La sortie vidéo apparaît uniquement en Show avec une vidéo. Son placement automatique demande une API de gestion des écrans disponible, une autorisation du navigateur et un vrai affichage étendu. Sur Mac avec Safari, la sortie ouvre une fenêtre à déplacer manuellement sur le second écran ; l’app ne peut pas vérifier l’affichage étendu. Chrome ou sa PWA peut placer automatiquement la fenêtre sur un affichage étendu détecté. La sortie est désactivée sur iPad / iPhone. La recopie n’est pas un affichage séparé. Le bouton devient rouge pendant l’activation. Autoriser les fenêtres surgissantes si nécessaire, puis cliquer dans la sortie pour le plein écran. Le préchargement est automatique.

## Sauvegarde et PDF

Chaque modification est sauvegardée localement, y compris pendant la saisie. Ces données dépendent de l’appareil, du navigateur, du profil et de l’adresse du site. Enregistrer sous… produit un .s2apilot.zip portable avec médias, visuels, données, PDF et Copilote.app compilée. Ouvrir restaure un package. Garder les médias lors de l’import QLab.

Conduite PDF ouvre un aperçu intégré ; Télécharger crée le fichier. Le PDF inclut photographie d’en-tête, blocs arrondis, compteurs médias et cinq Cues standards par page. Les descriptions longues continuent sur les pages suivantes. Le temps écoulé et le temps restant entre parenthèses figurent pour chaque Cue. Le contenu saisi n’est pas traduit.

## Installation et mises à jour

Sur Mac, décompresser et lancer Démarrer S2A Pilot.command ou Start S2A Pilot.command. Arrêter l’ancien serveur avant d’ouvrir un autre dossier. L’ouverture directe d’index.html permet l’aperçu PDF, mais le serveur local ou HTTPS est nécessaire pour toutes les fonctions et l’export du compagnon.

Déployer tout le contenu sur HTTPS, y compris .htaccess, i18n.js, les manifests, scripts, assets, icons et companion. Le serveur ouvre index.html comme page d’accueil ; partager l’adresse du dossier.

Purger Cloudflare après remplacement et supprimer les règles imposant un cache long aux fichiers HTML, JS, JSON et service worker. .htaccess empêche leur cache HTTP à l’origine Apache avec mod_headers ; une règle du CDN peut le remplacer. actualiser.html renouvelle les fichiers sans supprimer IndexedDB. Ne pas supprimer les données du site pour réparer une ancienne version.

La PWA vérifie le serveur au démarrage, au retour et toutes les cinq minutes si visible. Elle propose une version supérieure sans actualisation forcée pendant Show ou lecture. Le numéro affiché correspond au programme exécuté. En cas de démarrage interrompu, un diagnostic apparaît. Le fonctionnement hors ligne reste disponible après installation.

## Copilote et QLab

Copilote.app universelle fonctionne sur Intel et Apple Silicon, macOS 13 minimum. La glisser dans Applications ; aucune compilation nécessaire. Signature locale, sans notarisation Apple.

1. Essayer de l’ouvrir une fois.
2. Si bloquée : Réglages Système → Confidentialité et sécurité → Sécurité.
3. Ouvrir quand même pour Copilote, s’authentifier si demandé, puis Ouvrir.

Le bouton apparaît après une tentative ; recommencer si nécessaire. Autoriser uniquement la distribution officielle. Une nouvelle version peut demander une nouvelle autorisation. Autoriser ensuite séparément le contrôle de QLab lors de l’import. [Procédure Apple](https://support.apple.com/fr-fr/102445).

Les workspaces QLab ouverts sont détectés automatiquement ; un menu permet le choix si plusieurs sont ouverts. Enregistrer le workspace avant l’import. Plusieurs packages deviennent plusieurs groupes Timeline, numérotés avec leurs étapes : 5, 5.1, 5.2… Les numéros existants sont évités et les anciennes conduites ne sont pas renumérotées. Le visualiseur peut rester au premier plan.

## Vérifications

Tests Chrome : création, édition, sauvegarde, langues, préservation des contenus, PDF, hors ligne, zoom et écrans simulés. Copilote : compilation universelle et signature locale. À confirmer sur appareils réels : Safari iPad, gestes tactiles, écran étendu, import QLab et exécution Intel.


## Licence

Utilisation autorisée ; redistribution, publication ou hébergement pour des tiers soumis à un accord écrit préalable de S2A Production. Voir [la licence](LICENSE).
