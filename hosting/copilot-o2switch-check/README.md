# Préparation Copilot chez o2switch — bêta

Paquet de diagnostic d’hébergement uniquement. Aucun raccordement Pilot, aucune session, aucune commande et aucun QR de partage ne sont ajoutés par ce paquet.

Destination autorisée : `https://s2a-production.com/S2A-Pilot-Beta/copilot-test/`.

Le ZIP s’extrait dans le dossier existant `S2A-Pilot-Beta`. Il contient `copilot-test/index.php`, ses assets et une notice HTML. Il ne remplace aucun fichier de Pilot.

Construction : `python3 tools/package-copilot-check.py`.

Le diagnostic vérifie PHP >= 8.2, HTTPS, une base SQLite en mémoire, JSON et la génération aléatoire de clés. Il repère un parent inscriptible hors de `public_html`, sans créer de stockage ni divulguer ce chemin. Ce repérage n’est pas une certification du futur stockage : une vérification d’écriture et de protection sera nécessaire au raccordement.

Pas de dépendance Composer, pas de base MySQL, pas de compte administrateur, pas de service permanent. Les ressources sont locales. Le test de connexion appelle seulement cette même page en JSON. Les données renvoyées restent volontairement limitées ; aucun phpinfo n’est exposé.

Avant le véritable relais : définir l’installation authentifiée, le stockage privé, les sessions, les clés de publication distinctes des liens de lecture, les plafonds de requêtes, la révocation et la reconnexion. La présence de ce diagnostic ne signifie pas que ces fonctions sont livrées.

Tous les travaux Copilot restent sur `beta/copilot-qr` et hors des distributions stables. Promotion uniquement après validation explicite de l’utilisateur.
