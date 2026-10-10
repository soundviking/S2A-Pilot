<?php
/* Hosted read-only Copilot relay. No media files, playback commands or Bridge runtime. */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
function reply(int $code, array $data): void { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fail(int $code, string $message): void { reply($code, ['error'=>$message]); }
function write_record($file, array $data): void {
    $json=json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    rewind($file); if (!ftruncate($file, 0) || fwrite($file, $json)!==strlen($json) || !fflush($file)) fail(503, 'Copilot storage unavailable');
}
function valid_state($s): bool {
    if (!is_array($s) || ($s['type']??'')!=='state' || ($s['version']??0)!==1 || !is_bool($s['playing']??null) || !is_string($s['title']??null) || strlen($s['title'])>1200 || !in_array($s['language']??'', ['fr','en'], true)) return false;
    foreach (['time','duration','revision'] as $k) if (!isset($s[$k]) || !is_numeric($s[$k]) || !is_finite((float)$s[$k]) || $s[$k]<0) return false;
    if (!isset($s['cues']) || !is_array($s['cues']) || count($s['cues'])>1000 || strlen(json_encode($s))>128000) return false;
    foreach ($s['cues'] as $c) {
        if (!is_array($c) || !is_string($c['id']??null) || strlen($c['id'])>800 || !is_int($c['number']??null) || $c['number']<1 || !isset($c['time']) || !is_numeric($c['time']) || !is_finite((float)$c['time']) || $c['time']<0 || !is_string($c['title']??null) || strlen($c['title'])>1200 || !is_string($c['description']??null) || strlen($c['description'])>16000) return false;
    }
    return true;
}
try {
    if ($_SERVER['REQUEST_METHOD']!=='POST') fail(405, 'POST required');
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $parts=parse_url($_SERVER['HTTP_ORIGIN']); $origin=$parts['host']??''; if (isset($parts['port'])) $origin.=':'.$parts['port'];
        if (!$origin || strcasecmp($origin, $_SERVER['HTTP_HOST']??'')!==0) fail(403, 'Origin refused');
    }
    if (stripos($_SERVER['CONTENT_TYPE']??'', 'application/json')!==0) fail(415, 'JSON required');
    $raw=file_get_contents('php://input', false, null, 0, 400001);
    if ($raw===false || strlen($raw)>400000) fail(413, 'Snapshot too large');
    $data=json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($data)) fail(400, 'Invalid request');
    // Private server storage, outside the published application directory.
    $root=sys_get_temp_dir().'/s2a-copilot-'.substr(hash('sha256', __DIR__),0,24);
    if (!is_dir($root) && !@mkdir($root,0700,true) && !is_dir($root)) fail(503, 'Copilot private storage unavailable');
    $action=$_GET['action']??'';
    if ($action==='create') {
        $registry=fopen($root.'/registry','c+'); if (!$registry || !flock($registry,LOCK_EX)) fail(503,'Copilot unavailable');
        $now=time(); $rates=json_decode(stream_get_contents($registry),true)?:[];
        foreach ($rates as $ip=>$entry) if ($entry['until']<$now) unset($rates[$ip]);
        $ip=hash('sha256',$_SERVER['REMOTE_ADDR']??'local'); $entry=$rates[$ip]??['until'=>$now+3600,'count'=>0];
        if ($entry['count']>=30) fail(429,'Too many shares; retry later');
        $count=0;
        foreach (glob($root.'/*.json')?:[] as $path) {
            if (filemtime($path)<$now-120) { $f=@fopen($path,'r+'); if ($f && flock($f,LOCK_EX|LOCK_NB)) { @unlink($path); fclose($f); } elseif ($f) fclose($f); }
            else $count++;
        }
        if ($count>=100) fail(429,'Copilot is busy');
        $id=bin2hex(random_bytes(24)); $host=bin2hex(random_bytes(24)); $view=bin2hex(random_bytes(24));
        $f=fopen($root.'/'.$id.'.json','x+'); if (!$f) fail(503,'Copilot storage unavailable'); chmod($root.'/'.$id.'.json',0600); flock($f,LOCK_EX);
        write_record($f,['host'=>hash('sha256',$host),'view'=>hash('sha256',$view),'expires'=>$now+21600000,'updatedAt'=>0,'state'=>null,'visuals'=>[]]); fclose($f);
        $entry['count']++; $rates[$ip]=$entry; write_record($registry,$rates); fclose($registry);
        reply(201,['transport'=>'relay','id'=>$id,'hostKey'=>$host,'viewKey'=>$view]);
    }
    $id=$data['session']??''; $key=$data['key']??'';
    if (!is_string($id) || !preg_match('/^[a-f0-9]{48}$/D',$id) || !is_string($key) || !preg_match('/^[a-f0-9]{48}$/D',$key)) fail(403,'Share expired or invalid');
    $path=$root.'/'.$id.'.json'; $f=@fopen($path,'r+'); if (!$f || !flock($f,LOCK_EX)) fail(403,'Share expired or stopped');
    $record=json_decode(stream_get_contents($f),true);
    if (!$record || $record['expires']<time()) { @unlink($path); fail(403,'Share expired'); }
    $digest=hash('sha256',$key); $isHost=hash_equals($record['host'],$digest); $isViewer=hash_equals($record['view'],$digest);
    if (!$isHost && !$isViewer) fail(403,'Access refused');
    if ($action==='revoke' && $isHost) { @unlink($path); fclose($f); reply(200,['ok'=>true]); }
    if ($action==='publish' && $isHost) {
        $state=$data['state']??null; if (!valid_state($state)) fail(400,'Invalid show snapshot');
        $images=$data['visuals']??[]; if (!is_array($images) || count($images)>5) fail(400,'Invalid visuals');
        $allowed=array_column($state['cues'],'id'); $ids=$state['visualIds']??[];
        if (!is_array($ids) || count($ids)>1000) fail(400,'Invalid visual list');
        $keep=$data['visibleIds']??[]; if (!is_array($keep) || count($keep)>5) fail(400,'Invalid visible cues');
        foreach ($record['visuals'] as $vid=>$v) if (!in_array($vid,$keep,true) || !in_array($vid,$ids,true)) unset($record['visuals'][$vid]);
        foreach ($images as $v) {
            if (!is_array($v) || !is_string($v['id']??null) || !in_array($v['id'],$allowed,true) || !in_array($v['id'],$keep,true) || !is_string($v['src']??null) || strlen($v['src'])>50000 || !preg_match('#^data:image/jpeg;base64,[A-Za-z0-9+/=]+$#D',$v['src'])) fail(400,'Invalid thumbnail');
            $record['visuals'][$v['id']]=['id'=>$v['id'],'src'=>$v['src'],'hash'=>hash('sha256',$v['src'])];
        }
        $record['state']=$state; $record['updatedAt']=(int)round(microtime(true)*1000); write_record($f,$record); fclose($f); reply(200,['ok'=>true]);
    }
    if ($action==='snapshot' && $isViewer) {
        $known=$data['known']??[]; if (!is_array($known) || count($known)>1000) fail(400,'Invalid cache');
        $images=[]; foreach ($record['visuals'] as $vid=>$v) if (($known[$vid]??'')!==$v['hash']) $images[]=$v;
        fclose($f); reply(200,['state'=>$record['state'],'visuals'=>$images,'updatedAt'=>$record['updatedAt']]);
    }
    fail(403,'Read-only access');
} catch (JsonException $e) { fail(400,'Invalid JSON'); }
catch (Throwable $e) { error_log('S2A Copilot: '.$e->getMessage()); fail(503,'Copilot server unavailable'); }
