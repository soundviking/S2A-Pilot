# S2A Copilote 1.2.6

Les droits sur S2A Pilot et S2A Copilote appartiennent à la société S2A Production. Ces applications ont été développées par Antoine CLOPIER, avec l’aide de ChatGPT.

[English](README.en.md)

Application macOS universelle Intel et Apple Silicon, macOS 13 minimum. Langue du système détectée au premier lancement ; bascule Français / English mémorisée. Les titres, noms de Cues et descriptions de projets ne sont pas traduits.

S2A COPILOTE 1.2.6 — INSTALLATION SUR MAC

Mac Intel et Apple Silicon — macOS 13 ou plus récent.
Aucune compilation nécessaire. Application signée localement, non notariée par Apple.

1. Décompressez le ZIP et glissez S2A Copilote.app dans Applications.
   Remplacez l’ancienne version si nécessaire.
2. Essayez d’ouvrir S2A Copilote depuis Applications une première fois.
3. Si macOS bloque son ouverture, fermez le message et ouvrez :
   Réglages Système > Confidentialité et sécurité.
4. Descendez jusqu’à la section Sécurité. Repérez le message concernant
   S2A Copilote, puis cliquez sur « Ouvrir quand même ».
5. Validez avec votre mot de passe ou Touch ID si demandé, puis confirmez
   « Ouvrir ». L’autorisation est mémorisée pour cette application.

Le bouton « Ouvrir quand même » apparaît après la tentative d’ouverture.
S’il n’est plus affiché, essayez à nouveau d’ouvrir l’application, puis
retournez immédiatement dans Confidentialité et sécurité.
Une nouvelle version peut nécessiter une nouvelle autorisation.
Autorisez uniquement l’application provenant du dépôt officiel :
https://github.com/soundviking/S2A-Pilot

Une fois l’application ouverte, autorisez le contrôle de QLab lorsque
macOS le demande lors de l’import. Cette permission est distincte de
l’autorisation d’ouverture ci-dessus.

Procédure Apple : https://support.apple.com/fr-fr/102445




Copilote.app universelle fonctionne sur Intel et Apple Silicon, macOS 13 minimum. La glisser dans Applications ; aucune compilation nécessaire. Signature locale, sans notarisation Apple.

1. Essayer de l’ouvrir une fois.
2. Si bloquée : Réglages Système → Confidentialité et sécurité → Sécurité.
3. Ouvrir quand même pour Copilote, s’authentifier si demandé, puis Ouvrir.

Le bouton apparaît après une tentative ; recommencer si nécessaire. Autoriser uniquement la distribution officielle. Une nouvelle version peut demander une nouvelle autorisation. Autoriser ensuite séparément le contrôle de QLab lors de l’import. [Procédure Apple](https://support.apple.com/fr-fr/102445).

Les workspaces QLab ouverts sont détectés automatiquement ; un menu permet le choix si plusieurs sont ouverts. Enregistrer le workspace avant l’import. Plusieurs packages deviennent plusieurs groupes Timeline, numérotés avec leurs étapes : 5, 5.1, 5.2… Les numéros existants sont évités et les anciennes conduites ne sont pas renumérotées. Le visualiseur peut rester au premier plan.

## Vérifications

Tests Chrome : création, édition, sauvegarde, langues, préservation des contenus, PDF, hors ligne, zoom et écrans simulés. Copilote : compilation universelle et signature locale. À confirmer sur appareils réels : Safari iPad, gestes tactiles, écran étendu, import QLab et exécution Intel.


## Compilation

`zsh build.sh` avec les outils Xcode compile les deux architectures, les assemble, génère le logo bleu/orange et applique une signature locale. Aucune notarisation Apple.


## Licence

Utilisation autorisée ; redistribution, publication ou hébergement pour des tiers soumis à un accord écrit préalable de S2A Production. Voir [la licence](LICENSE).
