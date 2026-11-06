<?php
/* Copilot beta hosting check only: no session, no remote control, no project data. */
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");

function copilot_private_parent($directory) {
    $directory = str_replace('\\', '/', $directory);
    $marker = strpos($directory, '/public_html/');
    if ($marker === false) return null;
    $parent = substr($directory, 0, $marker);
    return $parent !== '' && is_dir($parent) && is_writable($parent) ? $parent : null;
}
function copilot_checks() {
    $checks = array();
    $checks[] = array('id'=>'php', 'ok'=>version_compare(PHP_VERSION, '8.2.0', '>='), 'label'=>'PHP disponible', 'detail'=>'Version complète : '.PHP_VERSION.' — vérifiez aussi le niveau de correctif ci-dessous.');
    // October 2026 upstream RCE fixes. Vendor backports require hosting confirmation.
    $minimums = array('8.2'=>'8.2.35', '8.3'=>'8.3.36', '8.4'=>'8.4.27', '8.5'=>'8.5.12');
    $branch = PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;
    $minimum = isset($minimums[$branch]) ? $minimums[$branch] : null;
    $patched = $minimum !== null && version_compare(PHP_VERSION, $minimum, '>=');
    $checks[] = array('id'=>'php_security', 'ok'=>$patched, 'label'=>'Correctifs PHP du 21 octobre 2026', 'detail'=>$patched ? 'Le numéro de version inclut ces correctifs amont. Cela ne constitue pas un audit complet du serveur.' : 'À confirmer auprès d’o2switch : PHP 8.5.12, 8.4.27, 8.3.36 ou 8.2.35 minimum selon la branche, ou correctifs équivalents appliqués par l’hébergeur.');
    $https = (!empty($_SERVER['HTTPS']) && strtolower($_SERVER['HTTPS']) !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);
    $checks[] = array('id'=>'https','ok'=>$https,'label'=>'Adresse sécurisée','detail'=>$https?'La page est ouverte en HTTPS.':'Ouvrez cette même adresse avec https://. Sur un serveur de test local, ce point reste normalement à vérifier.');
    $sqlite = false;
    if (class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        try {
            $db = new PDO('sqlite::memory:');
            $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $db->exec('CREATE TABLE verification (value INTEGER)');
            $db->exec('INSERT INTO verification VALUES (1)');
            $sqlite = (int)$db->query('SELECT value FROM verification')->fetchColumn() === 1;
        } catch (Exception $ignored) { $sqlite = false; }
    }
    $checks[] = array('id'=>'sqlite','ok'=>$sqlite,'label'=>'Petite base de données automatique','detail'=>$sqlite?'Le moteur SQLite fonctionne. Aucune base MySQL à créer pour ce test.':'Dans cPanel, vérifiez les extensions pdo et pdo_sqlite de la version PHP utilisée par ce dossier.');
    $json = function_exists('json_encode') && function_exists('json_decode');
    $random = false;
    if (function_exists('random_bytes')) {
        try { $random = strlen(random_bytes(32)) === 32; } catch (Exception $ignored) {}
    }
    $checks[] = array('id'=>'exchange','ok'=>$json && $random,'label'=>'Échanges et génération des liens','detail'=>($json && $random)?'Les fonctions nécessaires sont disponibles.':'Une fonction PHP nécessaire est indisponible. Copiez le diagnostic pour que nous le vérifiions ensemble.');
    $private = copilot_private_parent(__DIR__) !== null;
    $checks[] = array('id'=>'storage','ok'=>$private,'label'=>'Emplacement privé pour les futures sessions','detail'=>$private?'Un emplacement hors de public_html a été repéré. Le dossier sera créé et testé lors du raccordement.':'L’emplacement privé devra être confirmé au raccordement. Ne modifiez aucune permission pour le moment.');
    return $checks;
}
$checks = copilot_checks();
$ready = true;
foreach ($checks as $check) if (!$check['ok']) $ready = false;
$report = array('product'=>'S2A Copilot — préparation bêta', 'package'=>'hosting-check-2', 'scope'=>'hosting_check_only', 'connected_to_pilot'=>false, 'ready_for_next_step'=>$ready, 'checks'=>$checks);
if (isset($_GET['check'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function h($text) { return htmlspecialchars($text, ENT_QUOTES, 'UTF-8'); }
header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Préparer Copilot · bêta</title><link rel="icon" href="assets/logo.png"><link rel="stylesheet" href="assets/style.css"></head>
<body><main>
<header><img src="assets/logo.png" alt="S2A Pilot"><div><p class="eyebrow">S2A COPILOT · BÊTA</p><h1>Votre hébergement est-il prêt ?</h1></div></header>
<p class="intro">Cette page vérifie le dossier de test chez o2switch. Vous n’avez aucun code à écrire.</p>
<section class="notice"><strong>Première étape : préparer l’hébergement.</strong><p>Le partage QR n’est pas encore activé et cette page n’est pas reliée à Pilot. Après les vérifications, envoyez-nous simplement son adresse pour poursuivre le raccordement.</p></section>
<section class="checks" aria-label="Vérifications de l’hébergement">
<?php foreach ($checks as $check): ?>
<article class="check <?php echo $check['ok'] ? 'ok' : 'attention'; ?>"><span class="badge"><?php echo $check['ok'] ? 'OK' : 'À vérifier'; ?></span><div><h2><?php echo h($check['label']); ?></h2><p><?php echo h($check['detail']); ?></p></div></article>
<?php endforeach; ?>
</section>
<section class="actions"><h2>Vérifier la réponse du serveur</h2><p>Ce bouton contrôle que le navigateur peut échanger avec le fichier PHP de ce dossier.</p><button id="run" type="button">Tester la connexion</button><p id="connection" role="status" aria-live="polite">Le test ne démarre aucun partage.</p></section>
<section class="next"><h2>Ensuite, une seule chose à faire</h2><p>Envoyez l’adresse de cette page dans notre conversation. Je pourrai vérifier le résultat et préparer le branchement de Copilot.</p><button type="button" id="copy">Copier le diagnostic</button><label for="report">Diagnostic à transmettre</label><textarea id="report" readonly rows="8"><?php echo h(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); ?></textarea><p id="copied" role="status"></p></section>
<footer>Ce paquet ne modifie ni S2A Pilot, ni Bridge, ni votre site stable. Il ne crée aucun compte et ne conserve aucune donnée de spectacle.</footer>
</main><script src="assets/check.js"></script></body></html>
