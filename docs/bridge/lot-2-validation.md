# Bridge 1.4.1 — lot 2, édition

Base : `cbac465` (Bridge 1.4.0). L’interface Maverick et le déroulé du lot 1 sont conservés.

## Comportement livré

- Crayon dans chaque élément du déroulé QLab : édition du nom réel (`q name`) et des notes, dans les deux sens Bridge ⇄ QLab. Le nom d’affichage par défaut reste distinct du nom saisi ; un nom vide reste éditable. Le titre d’une conduite Pilot suit le nom du groupe QLab.
- Crayon sur les cartes Pilot : édition du titre et de la description du repère. Ces données sont sauvegardées dans l’index Bridge du workspace, sans recréer de Memo ni modifier le package source.
- Boutons Enregistrer et Annuler ; Échap annule avant envoi. La lecture et les rafraîchissements continuent sans écraser la saisie. Le formulaire distingue clairement une Cue QLab d’un repère Pilot.
- Identité QLab = ID workspace + ID Cue. Identité Pilot = ID workspace + ID groupe + index du repère. Aucune recherche par nom ou par temps, y compris avec deux repères du même nom.
- Comparaison avec le nom et la description présents à l’ouverture avant d’écrire. Une modification externe entraîne un conflit, sensible à la casse et aux accents pour QLab. La saisie reste disponible. Une erreur de connexion ou de disque ne ferme pas le formulaire.
- Si le workspace change, le brouillon reste visible et copiable, mais l’enregistrement dans le nouveau workspace est bloqué. Une écriture en attente est abandonnée si sa cible de workspace n’est plus courante.
- Sérialisation AppleScript conservant guillemets, barres obliques inverses, Unicode et sauts de ligne. Les délimiteurs du protocole runtime sont maintenant encodés de façon réversible ; aucune perte de caractères dans les notes.
- Écritures et polling sérialisés ; les réponses antérieures à une édition ne rétablissent pas les anciennes données. La détection des workspaces rejette également une réponse de métadonnées périmée.
- Les descriptions Pilot sont écrites atomiquement dans l’index du workspace. L’ancien `index.json` est lu si nécessaire ; la sauvegarde crée le fichier par workspace en conservant l’ancien fichier. Les autres Cues, médias, images, temps, durée, groupe et identifiant d’horloge sont conservés.
- Les noms et notes QLab sont modifiés dans QLab ; sauvegarder le workspace dans QLab comme d’habitude pour les conserver après sa fermeture. Bridge ne sauvegarde pas implicitement toutes les autres modifications du workspace.
- Aucun changement de la génération groupe + audio + Wait Cue + horloge de conduite, hormis le blocage d’un import pendant une sauvegarde d’édition. Aucune édition ne provoque GO, start ou sélection.

## Vérifications

- Compilation universelle Intel / Apple Silicon, macOS 13 minimum et signature locale.
- `python3 tools/test-bridge-navigation.py` : runtime, workspace, sauvegarde réelle en dossier temporaire, réouverture, ancien index, noms dupliqués, Unicode/multiligne, texte vide, erreur disque, conflit et conservation de toutes les métadonnées hors titre/description. Scripts AppleScript compilés avec le dictionnaire QLab installé ; sérialiseur de texte exécuté et comparé octet par octet, sans application cible.
- Vrai AppModel testé avec exécuteur de commandes injecté : sauvegarde disque, actualisation du panneau Show, renommage QLab confirmé simulé, erreur de conflit et annulation d’une écriture en attente après changement de workspace. Les repères Pilot n’envoient aucune écriture QLab ; aucune opération d’édition n’envoie de transport.
- `test-bridge-editor.cjs` : formulaire sur les ressources empaquetées, sauvegarde explicite, annulation, maintien du brouillon pendant les rafraîchissements et les erreurs, conflits, retour positif/négatif, distinction des deux repères de même nom, changement de workspace et absence de commandes de lecture/sélection.
- Régression `test-bridge-show.cjs` : Maverick, Play/sélection, numéros, auto-scroll, décompte Pilot uniquement, pause, retour temporel, perte de synchronisation, zoom et trois largeurs.
- Formulaire empaqueté ouvert dans WebKit natif, capture inspectée ; le clic Enregistrer est transmis au gestionnaire natif et décodé avec le vrai modèle de requête (cible QLab sans groupID, Unicode et notes multilignes), sans exécuter de commande QLab. Catalogue et tests natifs FR/EN/ES/DE validés.

## Limites et essais restants

Les écritures dans un workspace de spectacle réel ne sont pas revendiquées par ces tests : les réponses QLab d’édition sont simulées. Le lot 4 doit vérifier les renommages et notes dans QLab 5 réel, la sauvegarde/fermeture/réouverture du workspace, les pauses/reprises et le scénario complet groupe + audio + Wait Cue + horloge.

Le lot 3 reste à traiter : filtres du déroulé et barre macOS compacte avec commandes de fenêtre et Toujours au premier plan. Copilot et QR Code restent en standby. La PWA et son installateur embarqué restent à leur version publiée ; seul le ZIP Bridge autonome passe à 1.4.1.
