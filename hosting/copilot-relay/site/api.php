<?php
/* S2A Copilot beta: read-only viewers. No playback/control endpoint exists. */
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
function fail(int $code, string $message): never { http_response_code($code); echo json_encode(['error'=>$message],JSON_UNESCAPED_UNICODE); exit; }
function run(PDO $db,string $sql,array $args=[]): PDOStatement {$q=$db->prepare($sql);$q->execute($args);return $q;}
function digest(string $value): string{return hash('sha256',$value);}
function token(): string{return bin2hex(random_bytes(24));}
function textValue($value,int $max): string {if(!is_string($value)||strlen($value)>$max)fail(400,'Texte trop long ou invalide.');return $value;}
function sharedTops(PDO $db,string $sid): array {
 return run($db,"SELECT t.id,t.time,t.text,t.revision,t.cue_id AS cueID,CASE WHEN v.revoked=0 THEN v.name WHEN t.author_id='' THEN t.author_label ELSE 'Équipe' END AS author FROM tops t LEFT JOIN viewers v ON v.id=t.author_id WHERE t.sid=? ORDER BY t.time,t.id",[$sid])->fetchAll(PDO::FETCH_ASSOC);
}
function defaultStorageDir(string $relayDir, string $documentRoot): ?string {
 $marker=strpos($relayDir,'/public_html/');
 if($marker!==false)return substr($relayDir,0,$marker).'/.s2a-copilot-beta';

 // cPanel may place a subdomain beside public_html within the same account.
 if(!preg_match('~^(/home[0-9]*/[A-Za-z0-9_-]+)/~',$relayDir,$match))return null;
 $home=$match[1];
 if(!str_starts_with($documentRoot,$home.'/')||!str_starts_with($relayDir,$documentRoot.'/'))return null;
 return $home.'/.s2a-copilot-beta';
}
try {
 $https=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')||($_SERVER['SERVER_PORT']??'')==='443';
 $local=in_array($_SERVER['REMOTE_ADDR']??'', ['127.0.0.1','::1'],true)&&getenv('S2A_COPILOT_LOCAL')==='1';
 if(!$https&&!$local)fail(403,'Copilot nécessite une adresse HTTPS.');
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST')fail(405,'Utilisez POST.');
 if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json'))fail(415,'JSON requis.');
 // No CORS: only the Pilot and viewer served by this same origin can call the relay.
 if(isset($_SERVER['HTTP_ORIGIN'])){
  $expected=($https?'https':'http').'://'.($_SERVER['HTTP_HOST']??'');
  if($_SERVER['HTTP_ORIGIN']!==$expected)fail(403,'Origine refusée.');
 }
 $body=file_get_contents('php://input',false,null,0,450001);
 if(strlen($body)>450000)fail(413,'Conduite trop volumineuse pour Copilot.');
 $input=json_decode($body,true,32,JSON_THROW_ON_ERROR);if(!is_array($input))fail(400,'Requête invalide.');
 $action=$_GET['action']??'';
 $allowed=['health','create','join','read','publish','members','revoke','lock','stop','add_top','update_top','delete_top'];if(!in_array($action,$allowed,true))fail(404,'Action inconnue.');
 $config=is_file(__DIR__.'/config.php')?require __DIR__.'/config.php':[];
 $serverSecret=$config['server_secret']??$config['host_key_hash']??'';
 if(!preg_match('/^[a-f0-9]{64}$/',$serverSecret))fail(503,'Le paquet Copilot doit être installé avec sa configuration.');
 $doc=realpath($_SERVER['DOCUMENT_ROOT']??'')?:'';
 $configured=$config['storage_dir']??null;
 $store=$local?getenv('S2A_COPILOT_STORAGE'):($configured??defaultStorageDir(__DIR__,$doc));
 if(!is_string($store)||!str_starts_with($store,'/'))fail(503,'Emplacement privé non reconnu. Renseignez storage_dir dans copilot/config.php.');
 $parent=realpath(dirname(rtrim($store,'/')));
 $candidate=realpath($store)?:($parent?$parent.'/'.basename(rtrim($store,'/')):false);
 $isPublic=static function(string $dir)use($doc):bool {
  return ($doc&&($dir===$doc||str_starts_with($dir,$doc.'/')))||preg_match('~(?:^|/)public_html(?:/|$)~',$dir);
 };
 if(!$candidate||$isPublic($candidate))fail(503,'Le stockage doit rester hors du dossier public.');
 if(!is_dir($candidate)&&!mkdir($candidate,0700)&&!is_dir($candidate))fail(503,'Impossible de créer le stockage privé.');
 $store=realpath($candidate);
 if(!$store||$isPublic($store))fail(503,'Le stockage doit rester hors du dossier public.');
 umask(0077);$db=new PDO('sqlite:'.$store.'/sessions.sqlite');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$db->exec('PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON');
 // WAL lets reads coexist with writes; preserve private file permissions through umask above.
 if(strtolower((string)$db->query('PRAGMA journal_mode')->fetchColumn())!=='wal')$db->exec('PRAGMA journal_mode=WAL');
 $db->exec('CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, host TEXT NOT NULL, invite TEXT NOT NULL, expires INTEGER NOT NULL, stopped INTEGER DEFAULT 0, locked INTEGER DEFAULT 0, updated REAL DEFAULT 0, snapshot TEXT DEFAULT "{}")');
 $sessionColumns=$db->query('PRAGMA table_info(sessions)')->fetchAll(PDO::FETCH_COLUMN,1);
 if(!in_array('bridge',$sessionColumns,true))try{$db->exec('ALTER TABLE sessions ADD COLUMN bridge INTEGER NOT NULL DEFAULT 0');}catch(PDOException $e){if(!in_array('bridge',$db->query('PRAGMA table_info(sessions)')->fetchAll(PDO::FETCH_COLUMN,1),true))throw $e;}
 $db->exec('CREATE TABLE IF NOT EXISTS viewers(id TEXT PRIMARY KEY, sid TEXT NOT NULL, credential TEXT NOT NULL, name TEXT NOT NULL, seen REAL NOT NULL, revoked INTEGER DEFAULT 0)');
 $columns=$db->query('PRAGMA table_info(viewers)')->fetchAll(PDO::FETCH_COLUMN,1);
 if(!in_array('role',$columns,true))try{$db->exec("ALTER TABLE viewers ADD COLUMN role TEXT NOT NULL DEFAULT 'technician'");}catch(PDOException $e){if(!in_array('role',$db->query('PRAGMA table_info(viewers)')->fetchAll(PDO::FETCH_COLUMN,1),true))throw $e;}
 $db->exec('CREATE INDEX IF NOT EXISTS viewer_session ON viewers(sid)');
 $db->exec('CREATE TABLE IF NOT EXISTS tops(id TEXT PRIMARY KEY,sid TEXT NOT NULL,time REAL NOT NULL,text TEXT NOT NULL,author_id TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1)');
 $topColumns=$db->query('PRAGMA table_info(tops)')->fetchAll(PDO::FETCH_COLUMN,1);
 if(!in_array('author_label',$topColumns,true))try{$db->exec("ALTER TABLE tops ADD COLUMN author_label TEXT NOT NULL DEFAULT ''");}catch(PDOException $e){if(!in_array('author_label',$db->query('PRAGMA table_info(tops)')->fetchAll(PDO::FETCH_COLUMN,1),true))throw $e;}
 if(!in_array('cue_id',$topColumns,true))try{$db->exec("ALTER TABLE tops ADD COLUMN cue_id TEXT NOT NULL DEFAULT ''");}catch(PDOException $e){if(!in_array('cue_id',$db->query('PRAGMA table_info(tops)')->fetchAll(PDO::FETCH_COLUMN,1),true))throw $e;}
 $db->exec('CREATE INDEX IF NOT EXISTS top_session ON tops(sid)');
 $db->exec('CREATE TABLE IF NOT EXISTS admission_limits(bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
 if($action==='create'||random_int(1,50)===1){run($db,'DELETE FROM tops WHERE sid IN (SELECT id FROM sessions WHERE expires < ?)',[time()]);run($db,'DELETE FROM viewers WHERE sid IN (SELECT id FROM sessions WHERE expires < ?)',[time()]);run($db,'DELETE FROM sessions WHERE expires < ?',[time()]);}
 $auth=$_SERVER['HTTP_AUTHORIZATION']??$_SERVER['REDIRECT_HTTP_AUTHORIZATION']??'';$credential=str_starts_with($auth,'Bearer ')?substr($auth,7):'';
 if($action==='health'){$result=['ok'=>true,'module'=>'copilot-relay-1','private_storage'=>true];}
 elseif($action==='create'){
  // Public beta sharing: no account, installation key or device activation in the UI.
  // Bound anonymous creation on this shared host without storing raw IP addresses.
  $db->exec('BEGIN IMMEDIATE');
  run($db,'DELETE FROM admission_limits WHERE expires < ?',[time()]);
  $bucket=hash_hmac('sha256',($_SERVER['REMOTE_ADDR']??'').':'.intdiv(time(),3600),$serverSecret);
  run($db,'INSERT INTO admission_limits(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1',[$bucket,time()+7200]);
  if((int)run($db,'SELECT count FROM admission_limits WHERE bucket=?',[$bucket])->fetchColumn()>30)fail(429,'Trop de créations récentes. Réessayez plus tard.');
  if((int)$db->query('SELECT count(*) FROM sessions WHERE stopped=0')->fetchColumn()>=100)fail(429,'Trop de sessions. Réessayez après expiration.');
  $id=bin2hex(random_bytes(12));$host=token();$invite=token();$expires=time()+1209600;
  run($db,'INSERT INTO sessions(id,host,invite,expires,bridge) VALUES(?,?,?,?,?)',[$id,digest($host),digest($invite),$expires,($input['bridge']??false)===true?(($input['backstage']??false)===true?2:1):0]);
  $seed=$input['tops']??[];if(!is_array($seed)||count($seed)>200)fail(400,'Liste de Tops invalide.');
  foreach($seed as $top){
   $text=trim(textValue($top['text']??'',2000));$topTime=$top['time']??null;
   if($text===''||!is_numeric($topTime)||!is_finite((float)$topTime)||(float)$topTime<0||(float)$topTime>864000)fail(400,'Top sauvegardé invalide.');
   run($db,'INSERT INTO tops(id,sid,time,text,author_id,author_label,cue_id) VALUES(?,?,?,?,?,?,?)',[bin2hex(random_bytes(12)),$id,round((float)$topTime,1),$text,'',textValue($top['author']??'',240),textValue($top['cueID']??'',80)]);
  }
  $db->exec('COMMIT');
  $result=['id'=>$id,'host'=>$host,'invite'=>$invite,'expires'=>$expires,'backstage'=>($input['bridge']??false)===true&&($input['backstage']??false)===true];
 }else{
  $sid=textValue($input['id']??'',48);
  // Serialize admission/revocation/publication so a concurrent join cannot bypass a lock.
  $db->exec('BEGIN IMMEDIATE');
  $session=run($db,'SELECT * FROM sessions WHERE id=?',[$sid])->fetch(PDO::FETCH_ASSOC);
  if(!$session||$session['stopped']||$session['expires']<time())fail(410,'Ce partage est terminé ou a expiré.');
  if($action==='join'){
   if(!hash_equals($session['invite'],digest($credential)))fail(403,'Lien de partage incorrect.');
   if((int)$session['bridge']===1&&($input['role']??'technician')!=='technician')fail(400,'Ce partage Bridge est réservé à la Régie.');
   if($session['locked'])fail(403,'Les nouvelles connexions sont fermées.');
   $name=trim(textValue($input['name']??'',120));if($name==='')fail(400,'Indiquez votre nom.');
   if((int)run($db,'SELECT count(*) FROM viewers WHERE sid=? AND revoked=0',[$sid])->fetchColumn()>=50)fail(429,'Limite de 50 écrans atteinte pour ce partage.');
   $role=$input['role']??'technician';if(!in_array($role,['technician','backstage'],true))fail(400,'Choisissez Régie ou Backstage.');
   $id=bin2hex(random_bytes(12));$view=token();run($db,'INSERT INTO viewers(id,sid,credential,name,seen,role) VALUES(?,?,?,?,?,?)',[$id,$sid,digest($view),$name,microtime(true),$role]);
   $result=['viewer'=>$id,'token'=>$view,'role'=>$role,'expires'=>(int)$session['expires']];
  }elseif(in_array($action,['read','add_top','update_top','delete_top'],true)){
   $viewer=run($db,'SELECT * FROM viewers WHERE sid=? AND credential=?',[$sid,digest($credential)])->fetch(PDO::FETCH_ASSOC);
   if(!$viewer||$viewer['revoked'])fail(403,'Votre accès a été retiré.');
   run($db,'UPDATE viewers SET seen=? WHERE id=?',[microtime(true),$viewer['id']]);
   if($action==='read'){
    $result=['state'=>json_decode($session['snapshot'],true),'age'=>max(0,microtime(true)-(float)$session['updated']),'role'=>$viewer['role'],'expires'=>(int)$session['expires']];
    if($viewer['role']==='backstage')$result['tops']=sharedTops($db,$sid);
   }else{
    if($viewer['role']!=='backstage')fail(403,'Les Tops sont réservés au mode Backstage.');
    if($action==='add_top'||$action==='update_top'){
     $text=trim(textValue($input['text']??'',2000));$time=$input['time']??null;
     if($text===''||!is_numeric($time)||!is_finite((float)$time)||(float)$time<0||(float)$time>864000)fail(400,'Indiquez un temps et une annotation valides.');
     $time=round((float)$time,1);$cueID='';
     if($session['bridge']){
      $cueID=textValue($input['cueID']??'',80);
      $snapshot=json_decode($session['snapshot'],true);
      $target=null;
      foreach($snapshot['cues']??[] as $cue){if(!$cue['child']&&$cue['id']===$cueID){$target=$cue;break;}}
      if(!$target)fail(409,'Cette cue QLab n’est plus disponible.');
      if($time>($target['duration']??0))fail(400,'Le Top dépasse la durée de la cue QLab.');
     }
     if($action==='add_top'){
      if((int)run($db,'SELECT count(*) FROM tops WHERE sid=?',[$sid])->fetchColumn()>=200)fail(429,'Limite de 200 Tops atteinte.');
      $topId=bin2hex(random_bytes(12));run($db,'INSERT INTO tops(id,sid,time,text,author_id,cue_id) VALUES(?,?,?,?,?,?)',[$topId,$sid,$time,$text,$viewer['id'],$cueID]);$result=['ok'=>true,'top'=>$topId];
     }else{
      $q=run($db,'UPDATE tops SET time=?,text=?,cue_id=?,revision=revision+1 WHERE id=? AND sid=? AND revision=?',[$time,$text,$cueID,textValue($input['top']??'',48),$sid,(int)($input['revision']??0)]);
      if($q->rowCount()!==1)fail(409,'Ce Top a changé sur un autre écran. Rechargez-le avant de modifier.');$result=['ok'=>true];
     }
    }else{
     $q=run($db,'DELETE FROM tops WHERE id=? AND sid=? AND revision=?',[textValue($input['top']??'',48),$sid,(int)($input['revision']??0)]);
     if($q->rowCount()!==1)fail(409,'Ce Top a changé ou a déjà été supprimé.');$result=['ok'=>true];
    }
   }
  }else{
   if(!hash_equals($session['host'],digest($credential)))fail(403,'Accès réservé à Pilot.');
   if($action==='publish'){
    $state=$input['state']??null;if(!is_array($state)||($state['schema']??0)!==1||!is_array($state['cues']??null)||count($state['cues'])>300)fail(400,'État Show invalide.');
    // Keep only the passive display model; viewers never receive host tokens or media URLs.
    $clean=['schema'=>1,'show'=>($state['show']??false)===true,'playing'=>($state['playing']??false)===true,'fading'=>($state['fading']??false)===true,'resumeWait'=>($state['resumeWait']??false)===true,'manual'=>($state['manual']??false)===true,'title'=>textValue($state['title']??'',300),'time'=>max(0,min(864000,(float)($state['time']??0))),'duration'=>max(0,min(864000,(float)($state['duration']??0))),'offlineStop'=>max(0,min(864000,(float)($state['offlineStop']??$state['time']??0))),'active'=>textValue($state['active']??'',80),'next'=>textValue($state['next']??'',80),'waiting'=>textValue($state['waiting']??'',80),'cues'=>[],'bridge'=>(bool)$session['bridge']];
    if($clean['bridge']){
     $clean['current']=textValue($state['current']??'',80);
     $clean['selected']=textValue($state['selected']??'',80);
     $clean['sourceLost']=($state['sourceLost']??false)===true;
    }
    $images=$state['images']??[];if(!is_array($images)||count($images)>300)fail(400,'Visuels invalides.');$clean['images']=[];$imageBytes=0;
    foreach($images as $key=>$image){if(!is_string($key)||!preg_match('/^img[0-9]{1,3}$/D',$key)||!is_string($image)||strlen($image)>45000||!preg_match('~^data:image/jpeg;base64,[A-Za-z0-9+/=]+$~D',$image))fail(400,'Visuel invalide.');$imageBytes+=strlen($image);if($imageBytes>280000)fail(400,'Visuels trop volumineux.');$clean['images'][$key]=$image;}
    foreach($state['cues'] as $cue){
     $image=$cue['image']??'';if(!is_string($image)||strlen($image)>45000||($image!==''&&!preg_match('~^data:image/jpeg;base64,[A-Za-z0-9+/=]+$~D',$image)))fail(400,'Visuel invalide.');
     $clean['cues'][]=['id'=>textValue($cue['id']??'',80),'number'=>textValue($cue['number']??'',24),'name'=>textValue($cue['name']??'',300),'description'=>textValue($cue['description']??'',6000),'time'=>max(0,min(864000,(float)($cue['time']??0))),'duration'=>$clean['bridge']?max(0,min(864000,(float)($cue['duration']??0))):0,'running'=>$clean['bridge']&&($cue['running']??false)===true,'child'=>($cue['child']??false)===true,'waitForGo'=>($cue['waitForGo']??false)===true,'image'=>$image,'imageKey'=>isset($clean['images'][$cue['imageKey']??''])?$cue['imageKey']:''];
    }
    run($db,'UPDATE sessions SET snapshot=?,updated=? WHERE id=?',[json_encode($clean,JSON_THROW_ON_ERROR),microtime(true)-max(0,min(10,(float)($state['sampleAge']??0))),$sid]);$result=['ok'=>true];
   }elseif($action==='members'){$result=['locked'=>(bool)$session['locked'],'expires'=>(int)$session['expires'],'tops'=>sharedTops($db,$sid),'viewers'=>run($db,'SELECT id,name,role,seen,revoked FROM viewers WHERE sid=? ORDER BY seen DESC',[$sid])->fetchAll(PDO::FETCH_ASSOC),'now'=>microtime(true)];}
   elseif($action==='lock'){run($db,'UPDATE sessions SET locked=? WHERE id=?',[($input['locked']??true)?1:0,$sid]);$result=['ok'=>true];}
   elseif($action==='revoke'){run($db,'UPDATE viewers SET revoked=1,name="" WHERE sid=? AND id=?',[$sid,textValue($input['viewer']??'',48)]);run($db,'UPDATE sessions SET locked=1 WHERE id=?',[$sid]);$result=['ok'=>true,'locked'=>true];}
   elseif($action==='stop'){$savedTops=sharedTops($db,$sid);run($db,'UPDATE sessions SET stopped=1,snapshot="{}" WHERE id=?',[$sid]);run($db,'DELETE FROM viewers WHERE sid=?',[$sid]);run($db,'DELETE FROM tops WHERE sid=?',[$sid]);$result=['ok'=>true,'tops'=>$savedTops];}
  }
  $db->exec('COMMIT');
 }
 echo json_encode($result,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
}catch(JsonException $e){fail(400,'JSON invalide.');}catch(Throwable $e){error_log('S2A Copilot: '.get_class($e));fail(503,'Copilot est temporairement indisponible. Pilot peut continuer le spectacle.');}
