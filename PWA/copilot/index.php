<?php
header('Cache-Control: no-store, max-age=0');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
?><!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>S2A Copilot — bêta</title><link rel="icon" href="copilot-logo.png"><link rel="stylesheet" href="viewer.css?v=1.11.6-bridge-remote"><link rel="stylesheet" href="pilot-show-cards.css?v=1.6.19"></head>
<body><main>
<header><img src="copilot-logo.png" alt="S2A Copilot"><div><strong>S2A Copilot · bêta</strong><p>Conduite en direct</p></div><time id="backstageCountdown" role="timer" aria-label="Temps avant le prochain Top" hidden></time><button type="button" title="Copier le diagnostic de connexion" id="connectionIndicator" class="connectionIndicator joining" role="status" aria-live="polite"><span id="connectionLabel">À rejoindre</span></button></header>
<p id="status" role="status">Connexion au partage…</p>
<form id="join" hidden>
<label for="name">Votre nom</label><input id="name" maxlength="60" autocomplete="name" required placeholder="Ex. Marie">
<fieldset><legend>J’utilise Copilot en tant que</legend><div class="roleChoices"><label><input type="radio" name="role" value="technician" checked> Régie</label><label><input type="radio" name="role" value="backstage"> Backstage</label><label><input type="radio" name="role" value="remote"> Télécommande</label></div></fieldset>
<div id="joinPinField" hidden><label for="joinRemotePin" data-pin-i18n="Code télécommande">Code télécommande</label><input id="joinRemotePin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off"></div>
<button>Rejoindre</button>
</form>
<section id="show" hidden><h1 id="title"></h1><span id="remoteActiveGroup" hidden></span>
<label id="copilotModeLabel" hidden>Mode Copilot<select id="copilotMode"><option value="technician">Régie</option><option value="backstage">Backstage</option><option value="remote">Télécommande</option></select></label>
<section id="phoneRemote" hidden aria-label="Télécommande Pilot">
<p class="phoneListHint">Touchez une Cue dans la liste pour la préparer, puis appuyez sur GO.</p>
<div id="phonePreparedCue" hidden><small>Prête pour GO</small><strong id="phonePreparedName"></strong></div>
<div class="phoneRemoteButtons">
<button type="button" data-command="previous" aria-label="Cue précédente"><span aria-hidden="true">⏮</span><small>Précédente</small></button>
<button type="button" data-command="go" class="phoneRemoteGo">▷ GO</button>
<button type="button" data-command="next" aria-label="Cue suivante"><span aria-hidden="true">⏭</span><small>Suivante</small></button>
<button type="button" data-command="play" class="phoneRemotePlay"><span id="phonePlayIcon" aria-hidden="true">▶</span><span id="phonePlayLabel">Lecture</span></button>
</div>
<div class="phoneRemoteCue"><small>Cue en cours</small><strong id="phoneCurrentCue">Aucune</strong></div>
<div class="phoneRemoteCue next"><small>Cue suivante</small><strong id="phoneFollowingCue">Aucune</strong></div>
<p id="phoneRemoteStatus" role="status" aria-live="polite"></p>
</section>
<div class="remoteTransport" id="remoteTransport"><div class="remoteTransportHeading"><p id="transport"></p><strong id="remoteTime">00:00 / 00:00</strong></div>
<button id="phoneTimeToggle" type="button" hidden aria-label="Afficher le temps restant">00:00</button>
<div id="remoteTimelineViewport"><div id="remoteTimeline" role="img" aria-label="Position de lecture dans la conduite"><div class="timelineRail"></div><div id="remoteProgress"></div><div id="remoteMarkers"></div><div id="remoteLiveHead"></div></div></div>
</div>
<div id="remoteNextCue" hidden><span id="remoteNextCueLabel">Suivante</span><strong id="remoteNextCueName"></strong><time id="remoteAutoCountdown" role="timer" aria-label="Temps avant l’enchaînement automatique" hidden></time></div>
<div id="remoteListTools">
<details id="remoteCueTypeFilter" hidden>
<summary id="remoteCueTypeFilterLabel">Filtrer les Cues</summary>
<div id="remoteCueTypeChoices"></div>
<button id="remoteCueTypeAll" type="button">Tout afficher</button>
</details>
<button id="remoteCompactToggle" type="button" aria-pressed="false" hidden>Vue compacte</button>
</div>
<div id="rows"></div>
<section id="backstage" hidden><div id="backstageTools" class="backstageTools" hidden><button id="addTop" type="button">+ Top</button><span>Tops partagés · équipe Backstage</span></div><p id="backstageFeedback" role="status" aria-live="polite"></p><div id="topList" aria-label="Tops Backstage"></div><p id="noTops">Aucun Top pour le moment.</p></section>
</section>
<details><summary>Diagnostic technique</summary>
<label><input type="checkbox" id="pilotDiagnosticsEnabled" checked> Envoyer les rapports d’erreur techniques</label>
<p>Version, environnement, emplacements dans le code et dernières actions techniques.</p></details>
</main>
<dialog id="topDialog" aria-labelledby="topDialogTitle"><form id="topForm"><h2 id="topDialogTitle">Ajouter un Top</h2><label id="topCueField" hidden>Cue QLab<select id="topCue"></select></label><label for="topTime">Temps (minutes:secondes)</label><input id="topTime" inputmode="decimal" required placeholder="03:20"><label for="topText">Consigne Backstage</label><textarea id="topText" maxlength="500" rows="4" required placeholder="Rapporter la chaise de jardin"></textarea><p id="topError" role="status"></p><div class="topActions"><button id="saveTop" type="submit">Enregistrer</button><button id="deleteTop" type="button" hidden>Supprimer</button><button id="cancelTop" type="button">Annuler</button></div></form></dialog>
<script src="../diagnostics/report.js?v=1.11.6" data-version="1.11.6" data-surface="Copilot"></script>
<dialog id="remotePinDialog" aria-labelledby="remotePinTitle"><form id="remotePinForm"><h2 id="remotePinTitle" data-pin-i18n="Code télécommande">Code télécommande</h2><label for="switchRemotePin" data-pin-i18n="Saisissez exactement 4 chiffres.">Saisissez exactement 4 chiffres.</label><input id="switchRemotePin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required><p id="remotePinError" role="status" aria-live="polite"></p><div class="topActions"><button type="submit" data-pin-i18n="Déverrouiller">Déverrouiller</button><button id="remotePinCancel" type="button" data-pin-i18n="Annuler">Annuler</button></div></form></dialog>
<script src="../i18n-catalog.js?v=1.11.6"></script>
<script src="viewer.js?v=1.11.6-bridge-remote"></script></body></html>
