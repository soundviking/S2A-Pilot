<?php
header('Cache-Control: no-store, max-age=0');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
?><!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>S2A Copilot — bêta</title><link rel="icon" href="copilot-logo.png"><link rel="stylesheet" href="viewer.css?v=1.6.19-backstage1"><link rel="stylesheet" href="pilot-show-cards.css?v=1.6.19"></head>
<body><main>
<header><img src="copilot-logo.png" alt="S2A Copilot"><div><strong>S2A Copilot · bêta</strong><p>Conduite en direct</p></div><time id="backstageCountdown" role="timer" aria-label="Temps avant le prochain Top" hidden></time><button type="button" title="Copier le diagnostic de connexion" id="connectionIndicator" class="connectionIndicator joining" role="status" aria-live="polite"><span id="connectionLabel">À rejoindre</span></button></header>
<p id="status" role="status">Connexion au partage…</p>
<form id="join" hidden>
<label for="name">Votre nom</label><input id="name" maxlength="60" autocomplete="name" required placeholder="Ex. Marie">
<fieldset><legend>J’utilise Copilot en tant que</legend><div class="roleChoices"><label><input type="radio" name="role" value="technician" checked> Régie</label><label><input type="radio" name="role" value="backstage"> Backstage</label></div></fieldset>
<button>Rejoindre</button>
</form>
<section id="show" hidden><h1 id="title"></h1>
<div class="remoteTransport" id="remoteTransport"><div class="remoteTransportHeading"><p id="transport"></p><strong id="remoteTime">00:00 / 00:00</strong></div>
<div id="remoteTimelineViewport"><div id="remoteTimeline" role="img" aria-label="Position de lecture dans la conduite"><div class="timelineRail"></div><div id="remoteProgress"></div><div id="remoteMarkers"></div><div id="remoteLiveHead"></div></div></div>
</div>
<div id="rows"></div>
<section id="backstage" hidden><div id="backstageTools" class="backstageTools" hidden><button id="addTop" type="button">+ Top</button><span>Tops partagés · équipe Backstage</span></div><p id="backstageFeedback" role="status" aria-live="polite"></p><div id="topList" aria-label="Tops Backstage"></div><p id="noTops">Aucun Top pour le moment.</p></section>
</section>
</main>
<dialog id="topDialog" aria-labelledby="topDialogTitle"><form id="topForm"><h2 id="topDialogTitle">Ajouter un Top</h2><label id="topCueField" hidden>Cue QLab<select id="topCue"></select></label><label for="topTime">Temps (minutes:secondes)</label><input id="topTime" inputmode="decimal" required placeholder="03:20"><label for="topText">Consigne Backstage</label><textarea id="topText" maxlength="500" rows="4" required placeholder="Rapporter la chaise de jardin"></textarea><p id="topError" role="status"></p><div class="topActions"><button id="saveTop" type="submit">Enregistrer</button><button id="deleteTop" type="button" hidden>Supprimer</button><button id="cancelTop" type="button">Annuler</button></div></form></dialog>
<script src="viewer.js?v=1.6.23-top-order1"></script></body></html>
