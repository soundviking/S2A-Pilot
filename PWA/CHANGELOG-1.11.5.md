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
