# Validation du prototype — 10 octobre 2026

Prototype séparé de Pilot. Aucun branchement de production et aucune publication.

| Contrôle effectué | Résultat |
|---|---|
| Maître Chrome, récepteur Chrome et récepteur WebKit simultanés | Deux canaux RTCDataChannel ouverts |
| QR généré localement et lien d’appairage | Lien vers le compagnon avec clé de lecture |
| Cue active, suivante, descriptions, liste Ensuite | États reçus correctement |
| Plusieurs changements de Cue et retour au début | Les deux récepteurs suivent le maître |
| Lecture et décompte interpolé | Décompte reçu et actualisé |
| Requêtes Internet bloquées, signalisation locale autorisée | Appairage et suivi fonctionnels sur ce Mac |
| Routes de signalisation temporairement bloquées après appairage | Les canaux déjà ouverts continuent de transmettre les Cues |
| Canal du récepteur fermé et réseau du contexte indisponible | État interrompu après deux secondes, décompte `--:--` |
| Réseau rétabli | Réappairage automatique par la signalisation locale, puis reprise du suivi |
| Récepteur WebKit rechargé | Nouveau canal et état courant reçus |
| Interface récepteur | Aucun bouton, média, champ ou commande de transport |
| Erreurs JavaScript pendant ce scénario | Aucune |

Le contrôle réseau combine le blocage des requêtes du navigateur et la fermeture réelle du canal RTC. L’option « offline » du navigateur seule ne ferme pas nécessairement un canal WebRTC existant : elle ne suffit donc pas à prouver une perte de Wi-Fi.

## À valider avant intégration

- Deux appareils physiques sur le même Wi-Fi, dont iPhone/iPad sous iOS 13 et une version récente.
- Routeur gardé actif avec son accès Internet réellement débranché.
- HTTPS et certificat approuvé, scan avec l’appareil photo, veille et retour au premier plan.
- Réseaux avec isolation des clients, contraintes d’adresses ICE et pare-feu.
- Perte du serveur local, nouvelle session du maître et parcours de réappairage explicite.
- Stratégie d’installation PWA et arrivée d’un appareil jamais connecté sans Internet.

Ces essais sur ordinateur ne certifient pas iOS 13 ni tous les réseaux Wi-Fi. Le serveur local reste nécessaire à l’appairage et à la reconstruction d’un canal ; il n’est pas intégré à Pilot.

## Reproduire

Démarrer `node server.cjs` dans ce dossier. Installer Playwright et ses navigateurs dans un environnement de test séparé, puis exécuter `node test.cjs`. Le test utilise les ports locaux 8098 et uniquement les pages du prototype. `S2A_PLAYWRIGHT` et `S2A_CHROME` permettent d’indiquer des installations existantes. Les deux captures de test sont écrites dans le dossier temporaire du système.
