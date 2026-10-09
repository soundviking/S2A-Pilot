# S2A Pilot 1.4.99 / S2A Copilot 1.2.11

🇫🇷 **Français** | 🇬🇧 [English](README.en.md)

![S2A Pilot](assets/social-preview.png)

[PWA 1.4.99](downloads/S2A-Pilot-V1.4.99-PWA.zip) · [Copilot 1.2.11 — Intel / Apple Silicon](downloads/S2A-Copilot-1.2.11-macOS-Universel.zip)

# S2A Pilot — Guide utilisateur

Les droits sur S2A Pilot et S2A Copilot appartiennent à la société S2A Production. Ces applications ont été développées par Antoine CLOPIER, avec l’aide de ChatGPT.

[English user guide](README.en.md)

S2A Pilot prépare et joue des conduites multimédias. S2A Copilot importe leurs packages dans QLab 5.

## Langue

Au premier lancement, la PWA choisit le français si la langue principale du navigateur est française, sinon l’anglais. FR / EN dans l’en-tête permet de changer ce choix, mémorisé sur l’appareil. Copilot détecte la langue de macOS et propose Français / English. Les titres, descriptions et noms de médias des projets restent inchangés. Les PDF et notices exportés suivent la langue de l’interface.

## Aide rapide

Au premier lancement, une aide en quatre étapes présente la création de la conduite, les réglages des Cues, le mode Show et le raccourci Espace pour Lecture/Pause sur ordinateur. Les captures réelles montrent une musique de 3 min 20 avec sa waveform et des visuels de scène. Elle apparaît avant la proposition d’installation. Le bouton « ? », en Edit à gauche d’Annuler et Rétablir, permet de la rouvrir. L’aide et ses captures sont disponibles en français et en anglais, intégrées localement pour fonctionner hors ligne sur les navigateurs compatibles avec ce fonctionnement. Elles sont également adaptées au mode de compatibilité.

## Création et édition

Un projet commence vide. Cue crée une indication avec titre, description et visuel. Musique / Vidéo importe un fichier dans une nouvelle Cue au temps courant. Retour au début permet de revenir à zéro avant l’import.

Les Cues sont classées par temps. 02.41, 02,41 et 02:41.0 signifient 2 minutes 41. Une Cue peut prolonger la timeline. Toutes les Cues peuvent être déplacées ou supprimées, même à zéro. La poignée à gauche permet le glisser-déposer dans la liste ; le temps est ajusté entre les Cues voisines. Avant la première Cue, le temps devient zéro. Alt + flèches fonctionne au clavier sur la poignée.

La sélection est mise en évidence en bleu. Le déplacement d’un repère sur la timeline affiche en direct sa position, son temps et sa bande média, avec une échelle stable jusqu’au relâchement. Dupliquer, dans la Cue déroulée, conserve les informations et réglages au même temps. Les réglages sont indépendants ; les fichiers sont réutilisés. La poubelle à droite de chaque ligne demande confirmation avant suppression. Un clic sur la ligne déroule la Cue. Annuler / Rétablir permet de revenir sur ces changements.

## Médias et timeline

Chaque fichier a sa propre lecture indépendante, sa waveform, IN / OUT, Loop et zoom − / +. Une vidéo ajoute un aperçu. Après zoom, faire défiler horizontalement. Le dessin utilise la portion visible à la résolution de l’écran.

Le premier nouvel audio à zéro utilise Cut ; les autres utilisent un fondu de trois secondes. Les réglages importés sont conservés. Ajouter visuel / Changer visuel concerne l’image de repérage, distincte du média joué.

La timeline générale affiche les bandes audio vertes et vidéo roses ainsi que la waveform combinée des médias audibles. Sa hauteur s’adapte aux bandes. Son zoom jusqu’à ×32 est disponible uniquement en Edit. En Show, elle retrouve sa vue complète.

Lecture / Pause ou Espace commande la conduite. Le raccourci ignore la saisie, les dialogues et les commandes ayant leur propre action clavier ; maintenir la touche ne répète pas les bascules. Retour au début met en pause, arrête les médias et revient à zéro.

## Show et sortie vidéo

Le sélecteur à côté de la langue propose **Maverick**, par défaut, et **Iceman**. Le choix est conservé dans la sauvegarde locale et dans le ZIP de la conduite ; les anciens projets utilisent Maverick. Les boutons Disposition, Sortie vidéo et Edit/Show ont la même hauteur. Disposition apparaît uniquement en Show. Iceman utilise des visuels de 22,5 % de la largeur de l’écran (75 % de leur taille précédente), toujours en 16/9. Iceman affiche toutes les Cues en pleine largeur : les Cues passées restent compactes, seules l’active et la suivante sont agrandies, et le décompte apparaît dans la Cue suivante.

En Maverick, sur ordinateur et sur iPad en paysage, la Cue active occupe la moitié gauche de la liste et la suivante la moitié droite ; les autres Cues restent en dessous. Sur iPad en portrait et sur iPhone dans les deux orientations, la disposition verticale est conservée.

La timeline reste fixée en haut de l’écran pendant le défilement de la liste. Le panneau « Décompte » apparaît au centre de son panneau, au-dessus de la timeline, dans une sous-box compacte au cadre discret. Sur ordinateur, elle rejoint le bord droit uniquement si les commandes ne laissent plus assez de place au centre. Sur iPad, elle reste centrée ; sur iPhone, elle est alignée sur le bord droit à la hauteur du bouton Lecture. Sans Cue suivante, il affiche --:--. À dix secondes, le chrono devient rouge et sa sous-box pulse en même temps que le halo de la Cue suivante, au rythme des secondes ; le halo bleu de la Cue active s’éteint en fondu.

En Maverick, la liste affiche jusqu’à cinq Cues et suit automatiquement la lecture, sans défilement tactile interne. La Cue active reste toujours la première visible. Les changements de Cue sont immédiats, sans animation de déplacement. L’ordre est : numéro, visuel, temps, titre et description. La Cue active et la suivante utilisent des visuels identiques en taille, au format 16/9, ainsi que la même taille de titre et de description. Le visuel mesure 30 % de la largeur de l’écran en disposition verticale, 15 % en disposition à deux colonnes. Les descriptions apparaissent uniquement sur ces deux Cues, avec « Pas de description » si elles sont vides. Les pastilles Audio/Vidéo apparaissent uniquement en Edit. Le visuel actif commence son fondu au noir à dix secondes de la suivante et atteint le noir au passage de Cue ; il suit le temps de la conduite, y compris en pause ou après navigation. Sans Cue suivante, il reste éclairé. Les Cues passées restent dans le projet et réapparaissent en revenant dans le temps ; un fondu inférieur masque la suite lorsqu’elle dépasse la fenêtre. La timeline permet la navigation ; les Cues restent non éditables. Le moniteur vidéo apparaît uniquement si une vidéo est présente.

La sortie vidéo apparaît uniquement en Show avec une vidéo. Son placement automatique demande une API de gestion des écrans disponible, une autorisation du navigateur et un vrai affichage étendu. Sur Mac avec Safari, la sortie ouvre une fenêtre à déplacer manuellement sur le second écran ; l’app ne peut pas vérifier l’affichage étendu. Chrome ou sa PWA peut placer automatiquement la fenêtre sur un affichage étendu détecté. La sortie est désactivée sur iPad / iPhone. La recopie n’est pas un affichage séparé. Le bouton devient rouge pendant l’activation. Autoriser les fenêtres surgissantes si nécessaire, puis cliquer dans la sortie pour le plein écran. Le préchargement est automatique.

## Sauvegarde et PDF

Chaque modification est sauvegardée localement, y compris pendant la saisie. Ces données dépendent de l’appareil, du navigateur, du profil et de l’adresse du site. Enregistrer sous… produit un .s2apilot.zip portable avec médias, visuels, données, PDF et Copilot.app compilée. Ouvrir restaure un package. Garder les médias lors de l’import QLab.

Conduite PDF ouvre un aperçu intégré ; Télécharger crée le fichier. L’en-tête du PDF reprend le premier visuel disponible dans l’ordre chronologique des Cues, recadré en bandeau ; sans visuel, il conserve l’image par défaut. Un QR code au cadre arrondi avec un logo S2A Pilot agrandi dans la partie droite mène à https://s2a-production.com/S2A-Pilot/. L’aperçu, le PDF téléchargé et celui intégré au package utilisent le même bandeau et le même QR code, également hors ligne. Le PDF inclut des blocs arrondis, compteurs médias et cinq Cues standards par page. Les descriptions longues continuent sur les pages suivantes. Le temps écoulé et le temps restant entre parenthèses figurent pour chaque Cue. Le contenu saisi n’est pas traduit.

## Installation et mises à jour

Sur Mac, décompresser et lancer Démarrer S2A Pilot.command ou Start S2A Pilot.command. Arrêter l’ancien serveur avant d’ouvrir un autre dossier. L’ouverture directe d’index.html permet l’aperçu PDF, mais le serveur local ou HTTPS est nécessaire pour toutes les fonctions et l’export du compagnon.

Déployer tout le contenu sur HTTPS, y compris .htaccess, i18n.js, les manifests, scripts, assets, icons et companion. Le serveur ouvre index.html comme page d’accueil ; partager l’adresse du dossier.

Purger Cloudflare après remplacement et supprimer les règles imposant un cache long aux fichiers HTML, JS, JSON et service worker. .htaccess empêche leur cache HTTP à l’origine Apache avec mod_headers ; une règle du CDN peut le remplacer. actualiser.html renouvelle les fichiers sans supprimer IndexedDB. Ne pas supprimer les données du site pour réparer une ancienne version.

La PWA vérifie le serveur au démarrage, au retour et toutes les cinq minutes si visible. Elle propose une version supérieure sans actualisation forcée pendant Show ou lecture. Le numéro affiché correspond au programme exécuté. En cas de démarrage interrompu, un diagnostic apparaît. Le fonctionnement hors ligne reste disponible après installation.

## Copilot et QLab

Copilot.app universelle fonctionne sur Intel et Apple Silicon, macOS 13 minimum. La glisser dans Applications ; aucune compilation nécessaire. Signature locale, sans notarisation Apple.

1. Essayer de l’ouvrir une fois.
2. Si bloquée : Réglages Système → Confidentialité et sécurité → Sécurité.
3. Ouvrir quand même pour Copilot, s’authentifier si demandé, puis Ouvrir.

Le bouton apparaît après une tentative ; recommencer si nécessaire. Autoriser uniquement la distribution officielle. Une nouvelle version peut demander une nouvelle autorisation. Autoriser ensuite séparément le contrôle de QLab lors de l’import. [Procédure Apple](https://support.apple.com/fr-fr/102445).

Les workspaces QLab ouverts sont détectés automatiquement ; un menu permet le choix si plusieurs sont ouverts. Enregistrer le workspace avant l’import. Plusieurs packages deviennent plusieurs groupes Timeline, numérotés avec leurs étapes : 5, 5.1, 5.2… Les numéros existants sont évités et les anciennes conduites ne sont pas renumérotées. Le visualiseur peut rester au premier plan.

## Vérifications

Tests Chrome et WebKit : changements immédiats de Cue sur ordinateur, tablette et téléphone simulés, tailles des visuels, lecture audio, pauses et navigation. Contrôles complémentaires : création, édition, sauvegarde, langues, PDF et fonctionnement hors ligne. Copilot : compilation universelle et signature locale. À confirmer sur appareils réels : Safari iPad, gestes tactiles, écran étendu, import QLab et exécution Intel.


## Licence

Utilisation autorisée ; redistribution, publication ou hébergement pour des tiers soumis à un accord écrit préalable de S2A Production. Voir [la licence](LICENSE).


## Affichage sur iPad

La PWA harmonise le fond de la PWA et réserve les zones de sécurité de la barre d’état. Le flou éventuellement ajouté par iPadOS doit être contrôlé sur un iPad réel ; sa suppression complète n’est pas garantie.

## Démarrage

Une animation de trois secondes affiche le logo validé fixe, une lumière bleue progressive et un reflet discret. Le slogan apparaît mot par mot. Le slogan reprend la langue française ou anglaise choisie. Sur iOS 9 et avec la réduction des mouvements, un simple fondu est utilisé. L’aide apparaît ensuite. Toutes les ressources sont locales.

## Anciens navigateurs

L’interface complète utilise un moteur compatible ES5 sur les anciens navigateurs. Le mode allégé et les liens de bascule ont été supprimés. Sur iOS 9.3.5, l’import nécessite un fournisseur de documents disponible. Les codecs audio/vidéo, fondus, téléchargements et limites de mémoire restent à vérifier sur l’iPad réel ; l’ajout à l’écran d’accueil ne supprime pas ces limites du navigateur.

## Identité visuelle

S2A Pilot utilise les ailes cyan ; S2A Copilot, les ailes orange. L’application compagnon porte désormais le nom S2A Copilot dans les deux langues. Le logo S2A Production reste inchangé.

Show layouts: **Maverick** (default, side-by-side on wide screens, past Cues hidden) and **Iceman** (full-width, compact past Cues retained, countdown inside the next Cue). The choice is saved locally and in the project ZIP; older projects default to Maverick.
