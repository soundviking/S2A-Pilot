# Bridge 1.4.3 — filtres multiples et barre sombre

Suite au retour utilisateur sur Bridge 1.4.2 :

- Le menu de filtre propose désormais des cases indépendantes Audio, Vidéo, S2A Pilot, Network et Autres. Plusieurs types peuvent être affichés ensemble. Tout afficher recoche tous les types ; aucune case cochée affiche une vue vide explicite. Le menu reste ouvert pendant les changements pour permettre plusieurs choix.
- La combinaison est mémorisée entre les lancements. L’ancienne préférence à un seul type est reprise sans perte. La sélection QLab, les éléments en lecture et le panneau Show ne sont pas modifiés par les filtres.
- L’apparence sombre est demandée au niveau de la vue SwiftUI Show et réappliquée lorsque la même fenêtre est reconfigurée. Auparavant, l’apparence était seulement définie au premier attachement et pouvait rester claire si elle était rétablie ensuite, laissant les textes blancs illisibles. L’apparence des autres fenêtres n’est pas imposée.

## Vérifications

- Tests natifs : application forcée en Aqua, vue Show sombre à 1 360 et 820 px ; simulation d’un retour en Aqua sur la fenêtre déjà attachée puis vérification du rétablissement sombre. Boutons natifs, hauteur de barre et switch normal/flottant conservés.
- Tests navigateur : chaque type, combinaison Audio + S2A Pilot, aucune case cochée, Tout afficher, sélection masquée, vue vide, maintien du Show et de son décompte. Aucune commande de sélection ou de lecture envoyée.
- Tests du vrai AppModel avec connexion simulée : mémorisation/réouverture de la combinaison, choix vide, migration de l’ancienne préférence et absence de mutation du temps ou d’appel QLab lors du filtrage. Régressions des sauvegardes, conflits et identités d’édition réussies.
- Compilation universelle macOS, signature locale et vérification du ZIP après extraction. Catalogue FR/EN/ES/DE cohérent.

Le lot 4 de validation complète dans QLab réel reste à effectuer. Copilot et QR Code restent en standby ; les archives Pilot restent inchangées.
