(function () {
  'use strict';
  var run = document.getElementById('run'), status = document.getElementById('connection');
  var report = document.getElementById('report');
  var url = new URL(location.href); url.search = ''; url.hash = '';
  report.value = 'Adresse : ' + url.href + '\n\n' + report.value;
  run.onclick = async function () {
    run.disabled = true; status.textContent = 'Vérification en cours…';
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 10000);
    try {
      var endpoint = new URL(url.href); endpoint.searchParams.set('check', '1');
      var response = await fetch(endpoint.href, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Réponse HTTP ' + response.status);
      var result = await response.json();
      if (result.scope !== 'hosting_check_only' || !Array.isArray(result.checks)) throw new Error('Réponse inattendue');
      report.value = 'Adresse : ' + url.href + '\n\n' + JSON.stringify(result, null, 2);
      status.textContent = result.ready_for_next_step ? 'Connexion réussie. Les vérifications de préparation sont bonnes : envoyez-nous cette adresse.' : 'Connexion réussie. Les points « À vérifier » sont indiqués ci-dessus : copiez le diagnostic pour que nous les réglions ensemble.';
    } catch (error) {
      status.textContent = 'La page n’a pas reçu une réponse PHP valide. Copiez son adresse dans notre conversation pour que nous vérifiions ensemble.';
    } finally { clearTimeout(timer); run.disabled = false; }
  };
  document.getElementById('copy').onclick = async function () {
    try { await navigator.clipboard.writeText(report.value); document.getElementById('copied').textContent = 'Diagnostic copié. Vous pouvez le coller dans notre conversation.'; }
    catch (error) { report.focus(); report.select(); document.getElementById('copied').textContent = 'Le texte est sélectionné : copiez-le avec le menu Copier de votre appareil.'; }
  };
}());
