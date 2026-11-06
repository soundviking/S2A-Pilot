"""Produce a beta-only full o2switch install, with one-time server configuration and no user activation key."""
from pathlib import Path
import hashlib,json,secrets,zipfile
repo=Path(__file__).resolve().parents[1]
meta=json.loads((repo/'PWA/version.json').read_text());assert meta['channel']=='beta'
version=meta['version'];stage=repo/'downloads/beta'/version/'PWA';assert stage.is_dir()
out=repo/'downloads/beta/copilot-install';out.mkdir(parents=True,exist_ok=True)
secret=out/'copilot-private-key.txt'
if not secret.exists():
 secret.write_text(secrets.token_hex(24));secret.chmod(0o600)
key=secret.read_text().strip();assert len(key)==48
config="<?php\n// Generated beta install: only the hash is stored here. Never upload the private notice.\nreturn ['server_secret'=>'"+hashlib.sha256(key.encode()).hexdigest()+"'];\n"
archive=out/f'S2A-Pilot-{version}-beta-Copilot-o2switch.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for path in sorted(stage.rglob('*')):
  if path.is_file() and path.name!='.DS_Store':z.write(path,path.relative_to(stage).as_posix())
 for path in sorted((repo/'hosting/copilot-relay/site').rglob('*')):
  if path.is_file():z.write(path,'copilot/'+path.relative_to(repo/'hosting/copilot-relay/site').as_posix())
 # Reuse Pilot's Show card rules, without importing its application-wide layout.
 pilot_html=(repo/'PWA/index.html').read_text()
 card_rules=pilot_html.split('.showOverviewRow{position:relative',1)[1].split('/* Keep a five-Cue window',1)[0]
 z.writestr('copilot/pilot-show-cards.css','.showOverviewRow{position:relative'+card_rules)
 z.writestr('copilot/config.php',config)
notice=out/'INSTALLATION-COPILOT.txt'
notice.write_text("""S2A PILOT / COPILOT — BÊTA """+version+"""

INSTALLATION O2SWITCH
1. Ouvrez le dossier S2A-Pilot-Beta dans le gestionnaire de fichiers.
2. Déposez S2A-Pilot-"""+version+"""-beta-Copilot-o2switch.zip, puis extrayez-le directement dans ce dossier en remplaçant les fichiers bêta.
3. Rechargez la page bêta ; une seconde fois si l’ancienne version était déjà ouverte. La version indiquée doit être """+version+""".
Ne touchez pas au dossier stable S2A-Pilot. Le relais et sa base privée se mettent à jour automatiquement. Aucun compte, clé ou appareil à valider.

La fenêtre QR se ferme avec la croix fixe en haut à droite ou en touchant à l’extérieur, sans arrêter le partage.

PARTAGER
4. Ouvrez une conduite et cliquez sur le bouton QR. Son lien est valable 14 jours ; il est retrouvé dans le même navigateur. Après expiration, un nouveau lien est créé.
5. Sur chaque téléphone/tablette, scannez le QR et saisissez votre nom. Choisissez Régie ou Backstage.
   Régie : Show avec la timeline fixe en haut.
   Backstage : timeline et Tops partagés avec toute l’équipe Backstage. + Top ajoute une annotation (ex. 03:20 — Rapporter la chaise). Glissez un repère de Top au doigt sur la timeline pour modifier son heure. Les fiches sous la timeline présentent tous les Tops ; touchez une fiche ou un repère sans le déplacer pour modifier sa consigne ou supprimer le Top pour tous. Un conflit de modification ou une erreur réseau est signalé, sans confirmer un enregistrement incertain.

CONNEXION COPILOT
État en haut à droite : Connecté en vert, Déconnecté en rouge, Reconnexion en orange. Avant de rejoindre : À rejoindre. Touchez cet état pour copier le diagnostic technique sans donnée du spectacle.
Sur iPad : formulaire centré, en-tête/titre/timeline fixes, arborescence des Cues et recentrage de la Cue active et de la suivante. Le décompte reprend l’encadré du mode Show.
Une coupure ne masque plus la conduite : le dernier état reçu continue localement, sans son. Au retour du réseau, Pilot reprend autorité. En Mode Go, le suivi local s’arrête à la prochaine attente ou fin de séquence connue : il ne peut pas deviner un GO, une pause ou un déplacement effectué pendant la coupure. Gardez la page ouverte ; le rechargement hors ligne n’est pas pris en charge.

CONSERVER LES ANNOTATIONS
6. Après les ajouts de l’équipe, utilisez Enregistrer sous… dans Pilot. Le ZIP contient les derniers Tops Backstage, séparés des Cues de la conduite.
   En le rouvrant, les Tops restent disponibles et sont réinstallés lors d’un nouveau partage, même si l’ancien lien a expiré. Un nouveau navigateur peut lui aussi retrouver les Tops depuis ce ZIP.
   Si le relais est inaccessible pendant une sauvegarde avec partage actif, Pilot signale qu’il ne peut pas récupérer les derniers Tops ; reconnectez-le et enregistrez à nouveau. Ne supposez pas que des annotations récentes non synchronisées sont déjà dans votre ancien ZIP.
7. Arrêter le partage coupe les accès. Pilot conserve alors une copie des Tops : enregistrez votre conduite pour les garder dans un fichier.

Les écrans distants ne peuvent pas commander la lecture ni modifier les Cues Pilot. Backstage peut modifier uniquement les Tops partagés. Les modifications concurrentes du même Top sont signalées.
Gardez Pilot ouvert et l’appareil éveillé. Sur ordinateur vous pouvez passer à une autre application. iOS peut suspendre une page en arrière-plan ; la mise en veille et le réseau mobile doivent être testés sur les appareils réels.

Les fonctions Mode Go précédentes restent présentes : Attendre GO met la piste en pause au repère ; GO anticipé saute à la prochaine attente et lit sa suite ; sans attente à venir, GO passe à la principale suivante avec fondu 3 s. Le moteur Bridge/QLab ne gère pas encore ces nouvelles attentes.
Télécommande multimédia : Lecture/Pause en Autopilote, GO en Mode Go ; volume géré par le système. Routage réel à tester avec la télécommande ; Unified Remote demande son serveur sur l’ordinateur.

Limites bêta : 300 Cues, 50 écrans autorisés, 200 Tops par partage ; partage 14 jours ; environ 500 ms entre mises à jour avec compensation du délai. Aucun son ou fichier vidéo envoyé. Module Copilot en français pour ces essais. Création limitée à 30 partages/h par adresse réseau pour préserver l’hébergement.

Notice incluse dans le ZIP. Pas de changement de la version stable ni de push automatique GitHub.
""")
with zipfile.ZipFile(archive,'a',zipfile.ZIP_DEFLATED) as z:
 z.write(notice,'LISEZ-MOI-COPILOT.txt')
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert 'copilot/api.php' in z.namelist() and 'index.html' in z.namelist()
 assert not any('PRIVEE' in name or 'private-key' in name for name in z.namelist())
 assert key.encode() not in z.read('copilot/config.php')
print(archive)
print(notice)
