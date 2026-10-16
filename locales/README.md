# Traductions de Pilot et Bridge

`interface.json` est la source commune FR / EN / ES / DE. Les clés sont les textes français, sauf les notices longues (`export.readme`, `bridge.installation`) qui déclarent aussi un texte `fr`. Les noms de projets, titres de Cues, descriptions et noms de fichiers sont des données utilisateur : ne pas les traduire.

Utiliser une phrase complète avec paramètres nommés pour les textes dynamiques : `tr('Cue à {time}', {time})` dans Pilot, `L("Cue à {time}", ["time": cue.timeText])` dans Bridge. Les valeurs sont insérées après traduction, sans remplacement global de fragments dans les données utilisateur. `BridgeText` conserve clé et valeurs pour les états du modèle qui doivent changer de langue à chaud.

Après modification :

1. `python3 tools/build-locales.py` valide les langues et paramètres puis construit le catalogue navigateur ES5 et les manifestes.
2. `node tools/build-compat.cjs ../compat-vendor PWA` reconstruit les scripts anciens.
3. `zsh S2A-Copilot/build.sh` reconstruit Bridge Intel et Apple Silicon, avec le catalogue et les quatre notices de permission macOS.
4. `python3 tools/package-release.py --companion-only` renouvelle uniquement le Bridge intégré aux exports, sans remplacer les téléchargements publiés.

La langue des dialogues système macOS suit les réglages de macOS. Les dialogues et titres propres à l’application suivent son sélecteur.

Publication : Pilot 1.5.7 et Bridge 1.3.4. Les quatre manuels sont hébergés dans `docs/manual`, en dehors des archives de l’application et des conduites.
