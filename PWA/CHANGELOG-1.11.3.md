# Pilot 1.11.3 bêta / Bridge 1.6.30 bêta

- Télécommande QLab directement depuis Bridge, sans ouvrir Pilot : autorisation et code de quatre chiffres dans le popup Copilot, vérification serveur, invalidation des accès lors d'un changement de code.
- Commandes limitées au workspace connecté, contrôle du playhead, rejet des commandes périmées et des doublons, protection de 500 ms entre deux GO. Les cues principales peuvent être préparées sans être lancées.
- Copilot : un seul halo, priorité à la sous-cue ; mise à jour depuis l'horloge Bridge et placement de chaque nouvelle cue active à 20 px sous la timeline. Aucun recentrage entre deux changements.
- Bridge Show : Iceman, logo ambre BRIDGE avec ailes cyan et fin estimée de la conduite restante. Attentes de GO exclues, pause et durées inconnues indiquées, estimation masquée hors synchronisation.
- Interfaces et nouveaux messages disponibles en français, anglais, espagnol et allemand. Cache hors ligne, version affichée et archive Pilot alignés sur 1.11.3.

Validation locale : scénarios PHP/SQLite de code, rôles, limitation d'essais, rotation, commandes et acknowledgements ; tests DOM de halo et suivi ; tests de projection de fin.
Les contrôles macOS automatisés et leurs résultats sont consignés dans verification.json. Aucun spectacle QLab réel ni téléphone physique n'est utilisé par ces contrôles.
