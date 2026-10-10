# Copilot — service de suivi

Copilot reprend l’animation d’ouverture de Pilot pendant trois secondes, avec le logo Copilot et un halo orange ; le slogan suit la langue du lien ou de la conduite. La connexion commence pendant l’animation. Pilot et Bridge partagent la même vue Copilot, en Maverick et en lecture seule. Aucune commande du récepteur ne modifie le transport. Le canal transmet les Cues, le temps et de petites vignettes JPEG ; aucun audio ni vidéo.

## Pilot

Depuis le dépôt : `node copilot-service/server.cjs` (port 8098 par défaut). Cette adresse sert le vrai Pilot, sans Cues fictives. En Show, le bouton de partage à côté de Disposition ouvre le lien, le QR avec logo, Copier, Partager et Arrêter le partage. Fermer la fenêtre conserve le suivi. Arrêter le partage révoque le lien. Hors du service, la fenêtre signale clairement son indisponibilité.

Le lien localhost fonctionne uniquement sur le Mac. L’essai iPad nécessite un accès HTTPS approuvé. Le lanceur dispose d’un mode local `COPILOT_LOCAL_ONLY=1`. Un tunnel temporaire via localhost.run fait transiter les pages et les données servies par un service externe ; il reste désactivé par défaut. Aucun essai physique iPad n’est annoncé comme validé.

## Pilot Bridge

Le bouton Copilot utilise le suivi QLab existant de Bridge pour les conduites S2A Pilot importées et indexées dans le workspace sélectionné. Il ne suit pas encore une conduite QLab arbitraire sans index S2A. Bridge démarre son service embarqué, publie l’état de son moniteur existant et ouvre la page de partage locale sur le Mac. Le récepteur est identique à celui de Pilot. La durée est conservée dans les nouveaux index ; les anciens restent lisibles. La vérification sur un workspace QLab réellement joué reste nécessaire.

Le build embarque les archives compressées Node.js Intel et Apple Silicon, extraites localement au premier lancement de Copilot, dans Resources/CopilotRuntime (dossier ignoré par Git), avec la licence Node. Le script de construction suppose ces moteurs présents ; les sources officielles vérifiées et le ZIP de démo contiennent les moteurs. Ne pas ajouter de dépendance npm au lancement.

## État de la validation

Chrome maître et WebKit récepteur : vraie conduite Pilot, bouton Show uniquement, fermeture de fenêtre sans arrêt du partage, seek avant/arrière, interface sans commandes du récepteur. Le QR avec logo est reconnu par Apple Vision. La validation HTTPS et le suivi Bridge doivent être distingués du test physique final sur iPad/QLab.
