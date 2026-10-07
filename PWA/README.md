# S2A Pilot — Guide utilisateur

Les droits sur S2A Pilot et S2A Copilote appartiennent à la société S2A Production. Ces applications ont été développées par Antoine CLOPIER, avec l’aide de ChatGPT.

[English user guide](README.en.md)

S2A Pilot prépare et joue des conduites multimédias. S2A Copilote importe leurs packages dans QLab 5.

## Langue

Au premier lancement, la PWA choisit le français si la langue principale du navigateur est française, sinon l’anglais. FR / EN dans l’en-tête permet de changer ce choix, mémorisé sur l’appareil. Copilote détecte la langue de macOS et propose Français / English. Les titres, descriptions et noms de médias des projets restent inchangés. Les PDF et notices exportés suivent la langue de l’interface.

## Aide rapide

Au premier lancement, une aide en trois étapes présente la création de la conduite, les réglages des Cues et le mode Show avec des captures réelles de l’application. Elle apparaît avant la proposition d’installation. Le bouton « ? », en Edit à gauche d’Annuler et Rétablir, permet de la rouvrir. L’aide et ses captures sont disponibles en français et en anglais, intégrées localement pour fonctionner hors ligne sur les navigateurs compatibles avec ce fonctionnement. Elles sont également adaptées au mode de compatibilité.

## Création et édition

Un projet commence vide. Cue crée une indication avec titre, description et visuel. Musique / Vidéo importe un fichier dans une nouvelle Cue au temps courant. Retour au début permet de revenir à zéro avant l’import.

Les Cues sont classées par temps. 02.41, 02,41 et 02:41.0 signifient 2 minutes 41. Une Cue peut prolonger la timeline. Toutes les Cues peuvent être déplacées ou supprimées, même à zéro. La poignée à gauche permet le glisser-déposer dans la liste ; le temps est ajusté entre les Cues voisines. Avant la première Cue, le temps devient zéro. Alt + flèches fonctionne au clavier sur la poignée.

La sélection est mise en évidence en bleu. Le déplacement d’un repère sur la timeline affiche en direct sa position, son temps et sa bande média, avec une échelle stable jusqu’au relâchement. Dupliquer, à côté de Supprimer dans la Cue déroulée, conserve les informations et réglages au même temps. Les réglages sont indépendants ; les fichiers sont réutilisés. Annuler / Rétablir permet de revenir sur ces changements.

## Médias et timeline

Chaque fichier a sa propre lecture indépendante, sa waveform, IN / OUT, Loop et zoom − / +. Une vidéo ajoute un aperçu. Après zoom, faire défiler horizontalement. Le dessin utilise la portion visible à la résolution de l’écran.

Le premier nouvel audio à zéro utilise Cut ; les autres utilisent un fondu de trois secondes. Les réglages importés sont conservés. Ajouter visuel / Changer visuel concerne l’image de repérage, distincte du média joué.

La timeline générale affiche les bandes audio vertes et vidéo roses ainsi que la waveform combinée des médias audibles. Sa hauteur s’adapte aux bandes. Son zoom jusqu’à ×32 est disponible uniquement en Edit. En Show, elle retrouve sa vue complète.

Lecture / Pause ou Espace commande la conduite. Le raccourci ignore la saisie, les dialogues et les commandes ayant leur propre action clavier ; maintenir la touche ne répète pas les bascules. Retour au début met en pause, arrête les médias et revient à zéro.

## Show et sortie vidéo

En paysage large : Cue active à gauche avec halo bleu, prochaine Cue à droite avec titre et temps côte à côte, description dessous et visuel centré 16/9. Sur petit écran, le temps passe sous le titre. Les descriptions longues restent intégrales et peuvent agrandir les boxes. La timeline permet désormais la navigation dans le temps en Show ; les Cues restent non éditables. Le moniteur vidéo apparaît uniquement si une vidéo est présente.

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


## Affichage sur iPad

La version 1.4.44 harmonise le fond de la PWA et réserve les zones de sécurité de la barre d’état. Le flou éventuellement ajouté par iPadOS doit être contrôlé sur un iPad réel ; sa suppression complète n’est pas garantie.


Version 1.4.44 : halo lumineux bleu renforcé autour de la Cue active en mode Show, avec lumière diffuse intérieure et extérieure, sans animation.


Version 1.4.44 : à dix secondes de la prochaine Cue, son halo rouge pulse en fondu toutes les secondes et le halo bleu de la Cue active s’éteint en fondu. Hors de cette zone, le halo bleu revient. En réduction des animations, le rouge reste fixe.

## Version 1.4.44 — timelines et compatibilité

La tête de lecture blanche reprend le dessin des timelines médias. Elle se déplace en continu au doigt ou à la souris en Edit et Show ; clic/tap direct, flèches, Début/Fin sont conservés. Pendant le glissement, les médias sont mis en pause et l’interface suit la position ; au relâchement, les médias sont repositionnés et la lecture reprend si elle était active. Une annulation du geste restaure la position initiale. Au zoom, le sélecteur reste déplaçable et le fond permet le défilement horizontal.

En Show, TIMELINE est au-dessus des boxes Cue active et prochaine Cue. Les repères jaunes numérotés sont informatifs et ne déplacent pas les Cues. En Edit, seul le repère de la Cue sélectionnée porte son numéro, sans halo bleu. Les portions avant IN et après OUT sont assombries ; la zone retenue garde son bleu transparent. ⏮ remplace le texte Retour au début ; son libellé reste accessible et son comportement ne change pas.

## Version 1.4.45 — pictogrammes et anciens navigateurs

Les pictogrammes utilisent les SVG officiels Material Symbols Outlined, embarqués localement : aucune police Google, aucun CDN, aucune requête distante. Les logos S2A Pilot et S2A Production restent identiques. Les boutons conservent leurs libellés et leur comportement.

En Show, « Ensuite » conserve sa première Cue nette ; les suivantes s’atténuent progressivement par un masque d’opacité CSS et un fond assombri. Aucun flou, aucune animation ajoutée ni traitement JavaScript continu. L’ordre, le contenu et la limite préexistante de quatre Cues affichées ne changent pas.

### Compatibilité iOS 9.3.5

Les anciens navigateurs essaient désormais une version ES5 du même moteur que l’application actuelle, avec des adaptations locales. Cela rétablit les commandes d’édition, plusieurs médias dans la conduite, IN/OUT, boucles et réglages de fondu, waveforms et zoom, prévisualisation indépendante, navigation tactile, annuler/rétablir, PDF intégré et génération du package avec Copilote. Le stockage des médias utilise des buffers plutôt que des Blob sur cette branche. Les fondus audio passent par Web Audio lorsque le navigateur permet le raccordement du média.

L’import audio ne force plus le sélecteur photo/vidéo. Sur iOS 9, il faut un fournisseur de documents compatible installé (par exemple iCloud Drive) et un fichier accessible. L’application ne peut pas installer ce fournisseur. WAV et MP3 sont les premiers formats à essayer.

Si aucune sauvegarde de la version complète n’existe, la sauvegarde du précédent mode allégé est récupérée automatiquement ; l’original est conservé. Un projet complet existant, même vide, reste prioritaire. Le mode allégé à une musique reste accessible via le lien de compatibilité et dans `legacy/index.html`.

**Limites à vérifier sur l’iPad réel :** Safari 9 impose ses règles de lecture, codecs, mémoire et téléchargement. La vidéo peut nécessiter le lecteur natif plein écran ; les enchaînements audio, boucles, fondus et téléchargements doivent être essayés sur l’appareil. Le ZIP est généré, mais son enregistrement peut dépendre du menu de partage ou d’une application installée. iOS 9 n’a pas de service worker : aucun hors ligne complet ni sortie vidéo étendue n’est promis sur cet appareil. L’ajout à l’écran d’accueil ne lève pas ces limites.

Tests : icônes et changements Play/Pause, français/anglais, listes courtes/moyennes/longues, formats ordinateur/tablette/téléphone, hors ligne sur navigateur moderne, PDF et package Copilote. La compatibilité ancienne a été testée avec les API manquantes simulées, lecture callback Web Audio, stockage refusant les Blob, événements tactiles et récupération de sauvegarde ; ce n’est pas un test du moteur Safari 9 sur iPad physique.


La loupe identifie les commandes de zoom en Edit. Show affiche les minutes et secondes, sans dixièmes ; le temps fixe sous le compte à rebours est supprimé. Le chargement du compagnon demande des fichiers frais pour limiter les manifestes obsolètes.

Bulles compactes avec titre seul sous la timeline générale en Edit et Show. Priorité à la Cue active avec halo bleu, puis aux prochaines Cues dans l’ordre du temps ; les traits jaunes restent visibles. En Show, visuel de la prochaine Cue dans la moitié gauche et jusqu’à quatre Cues suivantes à droite. Bouton retour aligné sur Lecture/Pause.

## Version 1.4.47 — aide et boutons

Aide illustrée en trois étapes, au premier lancement avant l’installation et accessible avec « ? » en Edit. Captures françaises/anglaises intégrées localement, également adaptées au mode de compatibilité. Les boutons Cue et Musique / Vidéo conservent leurs icônes sans « + » dans leur texte. Lecture/Pause garde une largeur fixe dans les deux langues. S2A Copilote reste en version 1.2.10 ; le format des packages est inchangé.

## Version 1.4.48

Mode Show : timeline en haut, liste complète à gauche, informations de la Cue active à droite et visuels actif/suivant côte à côte. Les titres sont précédés de leur numéro. Toutes les Cues restent présentes ; lecture et format des projets inchangés. Captures de l’aide actualisées avec secours local intégré si les PNG séparés sont indisponibles. Disposition empilée sur téléphone. Copilote 1.2.10 inchangé.

## Version 1.4.49

Trois boxes Show indépendantes : numéro/titre/description avec décompte avant la prochaine Cue et badge média éventuel ; visuel principal ; prochaine Cue. Le halo bleu est uniquement sur la box du décompte, puis rouge pulsé pendant les dix dernières secondes. Liste à droite en paysage, en bas en portrait. Vignettes noires pour les Cues sans visuel. Captures de l’aide actualisées.
