<?php
/* Copilot roles isolate viewing, Backstage editing and authenticated remote controls. */
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
function fail(int $code, string $message): never { http_response_code($code); echo json_encode(['error'=>$message],JSON_UNESCAPED_UNICODE); exit; }
function unavailable(string $cause,string $message): never { header('X-Pilot-Relay-Cause: '.$cause); fail(503,$message); }
function run(PDO $db,string $sql,array $args=[]): PDOStatement {$q=$db->prepare($sql);$q->execute($args);return $q;}
function digest(string $value): string{return hash('sha256',$value);}
function token(): string{return bin2hex(random_bytes(24));}
function textValue($value,int $max): string {if(!is_string($value)||strlen($value)>$max)fail(400,'Texte trop long ou invalide.');return $value;}
function sharedTops(PDO $db,string $sid): array {
 return run($db,"SELECT t.id,t.time,t.text,t.revision,t.cue_id AS cueID,CASE WHEN v.revoked=0 THEN v.name WHEN t.author_id='' THEN t.author_label ELSE 'Équipe' END AS author FROM tops t LEFT JOIN viewers v ON v.id=t.author_id WHERE t.sid=? ORDER BY t.time,t.id",[$sid])->fetchAll(PDO::FETCH_ASSOC);
}
function remotePinHash(string $sid,string $pin,string $secret): string {
 if(!preg_match('/^[0-9]{4}$/D',$pin))fail(400,'Saisissez exactement 4 chiffres.');
 return hash_hmac('sha256','remote-pin:'.$sid.':'.$pin,$secret);
}
function requireRemotePin(PDO $db,array $session,array $input,string $secret): void {
 if((int)$session['bridge']!==0&&!(bool)$session['remote_capable'])fail(403,'La télécommande est indisponible pour cette version de Bridge.');
 if($session['remote_pin_hash']==='')fail(403,(int)$session['bridge']!==0?'Configurez le code télécommande dans Bridge.':'Configurez le code télécommande dans Pilot.');
 run($db,'DELETE FROM admission_limits WHERE expires < ?',[time()]);
 $window=intdiv(time(),300);
 $ip=hash_hmac('sha256','pin-ip:'.$session['id'].':'.($_SERVER['REMOTE_ADDR']??'').':'.$window,$secret);
 $global=hash_hmac('sha256','pin-session:'.$session['id'].':'.$window,$secret);
 foreach([[$ip,5],[$global,30]] as [$bucket,$limit]){
  if((int)run($db,'SELECT count FROM admission_limits WHERE bucket=?',[$bucket])->fetchColumn()>=$limit)
   fail(429,'Trop de codes incorrects. Réessayez dans 5 minutes.');
 }
 $pin=$input['remotePin']??null;
 if(!is_string($pin)||!preg_match('/^[0-9]{4}$/D',$pin)||!hash_equals($session['remote_pin_hash'],remotePinHash($session['id'],$pin,$secret))){
  foreach([$ip,$global] as $bucket)run($db,'INSERT INTO admission_limits(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1',[$bucket,time()+600]);
  // fail() exits the request: persist the failed attempt before releasing the transaction.
  $db->exec('COMMIT');fail(403,'Code télécommande incorrect.');
 }
 run($db,'DELETE FROM admission_limits WHERE bucket=?',[$ip]);
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
 $allowed=['health','create','join','read','publish','members','revoke','lock','stop','add_top','update_top','delete_top','command','remote_ack','set_role','set_remote_pin'];if(!in_array($action,$allowed,true))fail(404,'Action inconnue.');
 $config=is_file(__DIR__.'/config.php')?require __DIR__.'/config.php':[];
 $serverSecret=$config['server_secret']??$config['host_key_hash']??'';
 if(!preg_match('/^[a-f0-9]{64}$/',$serverSecret))unavailable('configuration','Le paquet Copilot doit être installé avec sa configuration.');
 $doc=realpath($_SERVER['DOCUMENT_ROOT']??'')?:'';
 $configured=$config['storage_dir']??null;
 $store=$local?getenv('S2A_COPILOT_STORAGE'):($configured??defaultStorageDir(__DIR__,$doc));
 if(!is_string($store)||!str_starts_with($store,'/'))unavailable('storage','Emplacement privé non reconnu. Renseignez storage_dir dans copilot/config.php.');
 $parent=realpath(dirname(rtrim($store,'/')));
 $candidate=realpath($store)?:($parent?$parent.'/'.basename(rtrim($store,'/')):false);
 $isPublic=static function(string $dir)use($doc):bool {
  return ($doc&&($dir===$doc||str_starts_with($dir,$doc.'/')))||preg_match('~(?:^|/)public_html(?:/|$)~',$dir);
 };
 if(!$candidate||$isPublic($candidate))unavailable('storage','Le stockage doit rester hors du dossier public.');
 if(!is_dir($candidate)&&!mkdir($candidate,0700)&&!is_dir($candidate))unavailable('storage','Impossible de créer le stockage privé.');
 $store=realpath($candidate);
 if(!$store||$isPublic($store))unavailable('storage','Le stockage doit rester hors du dossier public.');
 umask(0077);$db=new PDO('sqlite:'.$store.'/sessions.sqlite');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$db->exec('PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON');
 // WAL lets reads coexist with writes; preserve private file permissions through umask above.
 if(strtolower((string)$db->query('PRAGMA journal_mode')->fetchColumn())!=='wal')$db->exec('PRAGMA journal_mode=WAL');
 $db->exec('CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, host TEXT NOT NULL, invite TEXT NOT NULL, expires INTEGER NOT NULL, stopped INTEGER DEFAULT 0, locked INTEGER DEFAULT 0, updated REAL DEFAULT 0, snapshot TEXT DEFAULT "{}")');
 $sessionColumns=$db->query('PRAGMA table_info(sessions)')->fetchAll(PDO::FETCH_COLUMN,1);
 if(!in_array('bridge',$sessionColumns,true))try{$db->exec('ALTER TABLE sessions ADD COLUMN bridge INTEGER NOT NULL DEFAULT 0');}catch(PDOException $e){if(!in_array('bridge',$db->query('PRAGMA table_info(sessions)')->fetchAll(PDO::FETCH_COLUMN,1),true))throw $e;}
 $db->exec('CREATE TABLE IF NOT EXISTS viewers(id TEXT PRIMARY KEY, sid TEXT NOT NULL, credential TEXT NOT NULL, name TEXT NOT NULL, seen REAL NOT NULL, revoked INTEGER DEFAULT 0)');
 $columns=$db->query('PRAGMA table_info(viewers)')->fetchAll(PDO::FETCH_COLUMN,1);
 if(!in_array('role',$columns,true))try{$db->exec("ALTER TABLE viewers ADD COLUMN role TEXT NOT NULL DEFAULT 'technician'");}catch(PDOException $e){if(!in_array('role',$db->query('PRAGMA table_info(viewers)')->fetchAll(PDO::FETCH_COLUMN,1),true))throw $e;}
 // Additive migrations preserve existing invitations, members and Backstage annotations.
 foreach(['sessions'=>['remote_pin_hash'=>"TEXT NOT NULL DEFAULT ''",'remote_pin_revision'=>'INTEGER NOT NULL DEFAULT 0','remote_capable'=>'INTEGER NOT NULL DEFAULT 0'],
          'viewers'=>['remote_pin_revision'=>'INTEGER NOT NULL DEFAULT 0']] as $table=>$fields){
  foreach($fields as $name=>$definition){
   if(in_array($name,$db->query('PRAGMA table_info('.$table.')')->fetchAll(PDO::FETCH_COLUMN,1),true))continue;
   try{$db->exec('ALTER TABLE '.$table.' ADD COLUMN '.$name.' '.$definition);}
   catch(PDOException $e){if(!in_array($name,$db->query('PRAGMA table_info('.$table.')')->fetchAll(PDO::FETCH_COLUMN,1),true))throw $e;}
  }
 }
 $db->exec('CREATE INDEX IF NOT EXISTS viewer_session ON viewers(sid)');
 $db->exec('CREATE TABLE IF NOT EXISTS tops(id TEXT PRIMARY KEY,sid TEXT NOT NULL,time REAL NOT NULL,text TEXT NOT NULL,author_id TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1)');
 $topColumns=$db->query('PRAGMA table_info(tops)')->fetchAll(PDO::FETCH_COLUMN,1);
 if(!in_array('author_label',$topColumns,true))try{$db->exec("ALTER TABLE tops ADD COLUMN author_label TEXT NOT NULL DEFAULT ''");}catch(PDOException $e){if(!in_array('author_label',$db->query('PRAGMA table_info(tops)')->fetchAll(PDO::FETCH_COLUMN,1),true))throw $e;}
 if(!in_array('cue_id',$topColumns,true))try{$db->exec("ALTER TABLE tops ADD COLUMN cue_id TEXT NOT NULL DEFAULT ''");}catch(PDOException $e){if(!in_array('cue_id',$db->query('PRAGMA table_info(tops)')->fetchAll(PDO::FETCH_COLUMN,1),true))throw $e;}
 $db->exec('CREATE INDEX IF NOT EXISTS top_session ON tops(sid)');
 $db->exec('CREATE TABLE IF NOT EXISTS admission_limits(bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
 $db->exec('CREATE TABLE IF NOT EXISTS remote_commands(sid TEXT NOT NULL,id TEXT NOT NULL,viewer TEXT NOT NULL,action TEXT NOT NULL,instance TEXT NOT NULL,created REAL NOT NULL,status TEXT NOT NULL DEFAULT "pending",PRIMARY KEY(sid,id))');
 $commandColumns=$db->query('PRAGMA table_info(remote_commands)')->fetchAll(PDO::FETCH_COLUMN,1);
 if(!in_array('cue_id',$commandColumns,true))try{$db->exec("ALTER TABLE remote_commands ADD COLUMN cue_id TEXT NOT NULL DEFAULT ''");}catch(PDOException $e){if(!in_array('cue_id',$db->query('PRAGMA table_info(remote_commands)')->fetchAll(PDO::FETCH_COLUMN,1),true))throw $e;}
 $db->exec('CREATE INDEX IF NOT EXISTS remote_pending ON remote_commands(sid,status,created)');
 run($db,'DELETE FROM remote_commands WHERE created < ?',[microtime(true)-60]);
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
  $remoteCapable=($input['bridge']??false)===true&&($input['backstage']??false)===true&&($input['bridgeRemoteProtocol']??0)===1;
  if($remoteCapable)run($db,'UPDATE sessions SET remote_capable=1 WHERE id=?',[$id]);
  if(($input['bridge']??false)!==true||$remoteCapable){
   $hash=remotePinHash($id,textValue($input['remotePin']??'',4),$serverSecret);
   run($db,'UPDATE sessions SET remote_pin_hash=?,remote_pin_revision=1 WHERE id=?',[$hash,$id]);
  }
  $seed=$input['tops']??[];if(!is_array($seed)||count($seed)>200)fail(400,'Liste de Tops invalide.');
  foreach($seed as $top){
   $text=trim(textValue($top['text']??'',2000));$topTime=$top['time']??null;
   if($text===''||!is_numeric($topTime)||!is_finite((float)$topTime)||(float)$topTime<0||(float)$topTime>864000)fail(400,'Top sauvegardé invalide.');
   run($db,'INSERT INTO tops(id,sid,time,text,author_id,author_label,cue_id) VALUES(?,?,?,?,?,?,?)',[bin2hex(random_bytes(12)),$id,round((float)$topTime,1),$text,'',textValue($top['author']??'',240),textValue($top['cueID']??'',80)]);
  }
  $db->exec('COMMIT');
  $result=['id'=>$id,'host'=>$host,'invite'=>$invite,'expires'=>$expires,'bridgeRemoteProtocol'=>$remoteCapable?1:0,'remotePinRevision'=>($input['bridge']??false)===true&&!$remoteCapable?0:1,'backstage'=>($input['bridge']??false)===true&&($input['backstage']??false)===true];
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
   $role=$input['role']??'technician';if(!in_array($role,['technician','backstage','remote'],true))fail(400,'Choisissez Régie, Backstage ou Télécommande.');
   if($role==='remote')requireRemotePin($db,$session,$input,$serverSecret);
   $id=bin2hex(random_bytes(12));$view=token();run($db,'INSERT INTO viewers(id,sid,credential,name,seen,role) VALUES(?,?,?,?,?,?)',[$id,$sid,digest($view),$name,microtime(true),$role]);
   if($role==='remote')run($db,'UPDATE viewers SET remote_pin_revision=? WHERE id=?',[(int)$session['remote_pin_revision'],$id]);
   $result=['viewer'=>$id,'token'=>$view,'role'=>$role,'expires'=>(int)$session['expires']];
  }elseif(in_array($action,['read','add_top','update_top','delete_top','command','set_role'],true)){
   $viewer=run($db,'SELECT * FROM viewers WHERE sid=? AND credential=?',[$sid,digest($credential)])->fetch(PDO::FETCH_ASSOC);
   if(!$viewer||$viewer['revoked'])fail(403,'Votre accès a été retiré.');
   run($db,'UPDATE viewers SET seen=? WHERE id=?',[microtime(true),$viewer['id']]);
   if($action==='read'){
    $result=['state'=>json_decode($session['snapshot'],true),'age'=>max(0,microtime(true)-(float)$session['updated']),'role'=>$viewer['role'],'expires'=>(int)$session['expires']];
    if($viewer['role']==='backstage')$result['tops']=sharedTops($db,$sid);
    if($viewer['role']==='remote'){
     run($db,"UPDATE remote_commands SET status='expired' WHERE sid=? AND status IN ('pending','claimed') AND created < ?",[$sid,microtime(true)-5]);
     $result['commands']=run($db,'SELECT id,status FROM remote_commands WHERE sid=? AND viewer=? ORDER BY created DESC LIMIT 10',[$sid,$viewer['id']])->fetchAll(PDO::FETCH_ASSOC);
    }
   }elseif($action==='set_role'){
    $role=$input['role']??'';
    if($viewer['role']==='remote'&&$role!=='remote')fail(403,'Le mode Télécommande ne permet pas de changer de rôle.');
    if(!in_array($role,['technician','backstage','remote'],true)||(int)$session['bridge']!==0&&!(bool)$session['remote_capable']&&$role==='remote'||(int)$session['bridge']===1&&$role!=='technician')fail(400,'Mode indisponible pour ce partage.');
    if($role==='remote')requireRemotePin($db,$session,$input,$serverSecret);
    run($db,'UPDATE viewers SET role=?,remote_pin_revision=? WHERE id=?',[$role,$role==='remote'?(int)$session['remote_pin_revision']:0,$viewer['id']]);
    run($db,"UPDATE remote_commands SET status='rejected' WHERE sid=? AND viewer=? AND status='pending'",[$sid,$viewer['id']]);
    $result=['role'=>$role];
   }elseif($action==='command'){
    if($viewer['role']!=='remote')fail(403,'Commande réservée au mode Télécommande.');
    if($session['remote_pin_hash']===''||(int)$viewer['remote_pin_revision']!==(int)$session['remote_pin_revision'])fail(403,'Saisissez à nouveau le code télécommande.');
    $snapshot=json_decode($session['snapshot'],true);
    if(((int)$session['bridge']!==0&&!(bool)$session['remote_capable'])||($snapshot['remoteEnabled']??false)!==true)fail(403,(int)$session['bridge']!==0?'Les télécommandes sont désactivées dans Bridge.':'Les télécommandes sont désactivées dans Pilot.');
    if(microtime(true)-(float)$session['updated']>4)fail(409,'Pilot ne répond plus. Rétablissez la connexion.');
    if(isset($input['remoteInstance'])&&$input['remoteInstance']!==($snapshot['remoteInstance']??''))
     fail(409,'Connexion à Pilot rétablie. Vérifiez la Cue suivante avant de renvoyer la commande.');
    $command=textValue($input['command']??'',32);$commandId=textValue($input['commandId']??'',32);
    if(!in_array($command,['go','play','next','previous','select'],true)||!preg_match('/^[a-f0-9]{32}$/',$commandId))fail(400,'Commande invalide.');
    $cueId=$command==='select'?textValue($input['cueId']??'',80):'';
    if($command==='select'){
     $available=false;
     foreach($snapshot['cues']??[] as $cue)if(($cue['id']??'')===$cueId&&$cueId!==''&&((int)$session['bridge']===0||!($cue['child']??false))){$available=true;break;}
     if(!$available)fail(400,'Cette Cue n’est plus disponible.');
    }
    $existing=run($db,'SELECT viewer,status FROM remote_commands WHERE sid=? AND id=?',[$sid,$commandId])->fetch(PDO::FETCH_ASSOC);
    if($existing&&$existing['viewer']!==$viewer['id'])fail(409,'Identifiant de commande déjà utilisé.');
    if(!$existing){
     if((int)run($db,'SELECT count(*) FROM remote_commands WHERE sid=? AND viewer=? AND created>?',[$sid,$viewer['id'],microtime(true)-1])->fetchColumn()>=6)fail(429,'Commandes trop rapprochées.');
     run($db,'INSERT INTO remote_commands(sid,id,viewer,action,instance,created,cue_id) VALUES(?,?,?,?,?,?,?)',[$sid,$commandId,$viewer['id'],$command,$snapshot['remoteInstance']??'',microtime(true),$cueId]);
    }
    $result=['commandId'=>$commandId,'status'=>$existing['status']??'pending'];
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
    $clean['compact']=($state['compact']??false)===true;
    $clean['remoteCapable']=(bool)$session['remote_capable'];
    $clean['goGuardMs']=$clean['bridge']&&$clean['remoteCapable']?500:($clean['manual']&&!$clean['bridge']?max(0,min(2000,(int)($state['goGuardMs']??0))):0);
    $clean['remoteEnabled']=$session['remote_pin_hash']!==''&&(!$clean['bridge']||$clean['remoteCapable'])&&($state['remoteEnabled']??false)===true;
    $clean['remoteInstance']=textValue($state['remoteInstance']??'',100);
    $clean['remoteArmed']=textValue($state['remoteArmed']??'',80);
    if(!$clean['bridge']){
     if(is_numeric($state['activeEnd']??null))$clean['activeEnd']=max(0,min(864000,(float)$state['activeEnd']));
     $clean['queued']=textValue($state['queued']??'',80);
    }
    if($clean['bridge']){
     if($clean['remoteCapable'])$clean['queued']=textValue($state['queued']??'',80);
     $clean['current']=textValue($state['current']??'',80);
     $clean['preview']=textValue($state['preview']??'',80);
     $clean['selected']=textValue($state['selected']??'',80);
     $clean['sourceLost']=($state['sourceLost']??false)===true;
    }
    $types=$state['cueTypes']??null;$knownTypes=[];
    if(!$clean['bridge']&&is_array($types)){
     $clean['cueTypes']=[];
     foreach(array_slice($types,0,400) as $type){
      if(!is_array($type))continue;
      $typeId=$type['id']??null;$name=$type['name']??null;$color=$type['color']??null;
      if(!is_string($typeId)||!preg_match('/^[a-z][a-zA-Z0-9-]{0,70}$/D',$typeId)||isset($knownTypes[$typeId])||
         !is_string($name)||trim($name)===''||strlen($name)>192||
         !is_string($color)||!preg_match('/^#[0-9a-f]{6}$/Di',$color))continue;
      $knownTypes[$typeId]=$name;$clean['cueTypes'][]=['id'=>$typeId,'name'=>$name,'color'=>$color];
     }
    }
    $images=$state['images']??[];if(!is_array($images)||count($images)>300)fail(400,'Visuels invalides.');$clean['images']=[];$imageBytes=0;
    foreach($images as $key=>$image){if(!is_string($key)||!preg_match('/^img[0-9]{1,3}$/D',$key)||!is_string($image)||strlen($image)>45000||!preg_match('~^data:image/jpeg;base64,[A-Za-z0-9+/=]+$~D',$image))fail(400,'Visuel invalide.');$imageBytes+=strlen($image);if($imageBytes>280000)fail(400,'Visuels trop volumineux.');$clean['images'][$key]=$image;}
    $groups=[];
    if($clean['show']&&$clean['manual']&&!$clean['bridge']&&is_array($state['cueGroups']??null)){
     foreach(array_slice($state['cueGroups'],0,300) as $group){
      if(!is_array($group))continue;
      $groupId=$group['id']??null;$name=$group['name']??null;$color=$group['color']??null;
      if(!is_string($groupId)||!preg_match('/^[a-z0-9-]{1,80}$/Di',$groupId)||isset($groups[$groupId])||
         !is_string($name)||trim($name)===''||strlen($name)>256||
         !is_string($color)||!preg_match('/^#[0-9a-f]{6}$/Di',$color))continue;
      $groups[$groupId]=['id'=>$groupId,'name'=>$name,'color'=>$color,'folded'=>($group['folded']??false)===true];
     }
    }
    $usedGroups=[];
    $transition=$clean['show']&&$clean['manual']&&!$clean['bridge']?($state['autoTransition']??null):null;
    $transitionId=is_array($transition)?textValue($transition['id']??'',80):'';
    foreach($state['cues'] as $cue){
     $rawTypes=$cue['cueTypeIds']??[$cue['cueTypeId']??''];
     $cueTypes=[];
     if(is_array($rawTypes))foreach(array_slice($rawTypes,0,400) as $typeId){
      if(is_string($typeId)&&$typeId!=='none'&&isset($knownTypes[$typeId]))$cueTypes[$typeId]=true;
     }
     $cueTypes=array_keys($cueTypes);
     $image=$cue['image']??'';if(!is_string($image)||strlen($image)>45000||($image!==''&&!preg_match('~^data:image/jpeg;base64,[A-Za-z0-9+/=]+$~D',$image)))fail(400,'Visuel invalide.');
     $cleanCue=['id'=>textValue($cue['id']??'',80),'number'=>textValue($cue['number']??'',24),'name'=>textValue($cue['name']??'',300),'description'=>textValue($cue['description']??'',6000),'time'=>max(0,min(864000,(float)($cue['time']??0))),'duration'=>$clean['bridge']?max(0,min(864000,(float)($cue['duration']??0))):0,'running'=>$clean['bridge']&&($cue['running']??false)===true,'child'=>($cue['child']??false)===true,'parentCueId'=>textValue($cue['parentCueId']??'',80),'cueTypeId'=>$cueTypes[0]??'none','cueTypeIds'=>$cueTypes,'waitForGo'=>($cue['waitForGo']??false)===true,'image'=>$image,'imageKey'=>isset($clean['images'][$cue['imageKey']??''])?$cue['imageKey']:''];
     $groupId=$cue['groupId']??null;
     if(!$cleanCue['child']&&is_string($groupId)&&isset($groups[$groupId])){
      $cleanCue['groupId']=$groupId;$usedGroups[$groupId]=$groups[$groupId];
     }
     $goColor=$cue['goColor']??null;
     if(!$clean['bridge']&&$clean['manual']&&!$cleanCue['child']&&is_string($goColor)&&preg_match('/^#[0-9a-f]{6}$/Di',$goColor))$cleanCue['goColor']=$goColor;
     if(!$clean['bridge']&&is_array($cue['typeDescriptions']??null)){
      $descriptions=[];$lines=[];$bytes=0;
      foreach($cueTypes as $typeId){
       $text=$cue['typeDescriptions'][$typeId]??null;
       if(!is_string($text)||$text==='')continue;
       $bytes+=strlen($text);
       if($bytes>6000)break;
       $descriptions[$typeId]=$text;
       $lines[]=$knownTypes[$typeId].' - '.$text;
      }
      $cleanCue['typeDescriptions']=(object)$descriptions;
      $cleanCue['description']=implode("\n",$lines);
     }
     if($transitionId!==''&&$cleanCue['id']===$transitionId&&!$cleanCue['child']&&is_numeric($transition['time']??null)){
      $time=(float)$transition['time'];
      if(is_finite($time)&&$time>=0&&$time<=864000)$clean['autoTransition']=['id'=>$transitionId,'time'=>$time,'running'=>$clean['playing']&&($transition['running']??false)===true];
     }
     $clean['cues'][]=$cleanCue;
    }
    if($usedGroups)$clean['cueGroups']=array_values($usedGroups);
    run($db,'UPDATE sessions SET snapshot=?,updated=? WHERE id=?',[json_encode($clean,JSON_THROW_ON_ERROR),microtime(true)-max(0,min(10,(float)($state['sampleAge']??0))),$sid]);$result=['ok'=>true,'commands'=>[]];
    run($db,"UPDATE remote_commands SET status='expired' WHERE sid=? AND status='pending' AND (created < ? OR instance<>?)",[$sid,microtime(true)-3,$clean['remoteInstance']]);
    if($clean['remoteEnabled']){
     $result['commands']=run($db,"SELECT c.id,c.action,c.created,c.cue_id FROM remote_commands c JOIN viewers v ON v.id=c.viewer WHERE c.sid=? AND c.status='pending' AND v.revoked=0 AND v.role='remote' AND v.remote_pin_revision=(SELECT remote_pin_revision FROM sessions WHERE id=c.sid) ORDER BY c.created LIMIT 10",[$sid])->fetchAll(PDO::FETCH_ASSOC);
     foreach($result['commands'] as &$command)$command['age']=max(0,microtime(true)-(float)$command['created']);unset($command);
     foreach($result['commands'] as $command)run($db,"UPDATE remote_commands SET status='claimed' WHERE sid=? AND id=?",[$sid,$command['id']]);
    }else run($db,"UPDATE remote_commands SET status='rejected' WHERE sid=? AND status='pending'",[$sid]);
   }elseif($action==='remote_ack'){
    $commandId=textValue($input['commandId']??'',32);$status=$input['status']??'rejected';
    if(!in_array($status,['done','rejected','guarded'],true))fail(400,'Résultat invalide.');
    run($db,"UPDATE remote_commands SET status=? WHERE sid=? AND id=? AND status='claimed'",[$status,$sid,$commandId]);
    $result=['ok'=>true];
   }elseif($action==='set_remote_pin'){
    if((int)$session['bridge']!==0&&!(bool)$session['remote_capable'])fail(403,'La télécommande est indisponible pour cette version de Bridge.');
    $hash=remotePinHash($sid,textValue($input['remotePin']??'',4),$serverSecret);
    $revision=(int)$session['remote_pin_revision'];
    if(!hash_equals($session['remote_pin_hash'],$hash)){
     $revision++;
     run($db,'UPDATE sessions SET remote_pin_hash=?,remote_pin_revision=? WHERE id=?',[$hash,$revision,$sid]);
     run($db,"UPDATE viewers SET role='technician',remote_pin_revision=0 WHERE sid=? AND role='remote'",[$sid]);
     run($db,"UPDATE remote_commands SET status='rejected' WHERE sid=? AND status IN ('pending','claimed')",[$sid]);
    }
    $result=['ok'=>true,'remotePinRevision'=>$revision];
   }elseif($action==='members'){$result=['remotePinConfigured'=>$session['remote_pin_hash']!=='','remotePinRevision'=>(int)$session['remote_pin_revision'],'locked'=>(bool)$session['locked'],'expires'=>(int)$session['expires'],'tops'=>sharedTops($db,$sid),'viewers'=>run($db,'SELECT id,name,role,seen,revoked FROM viewers WHERE sid=? ORDER BY seen DESC',[$sid])->fetchAll(PDO::FETCH_ASSOC),'now'=>microtime(true)];}
   elseif($action==='lock'){run($db,'UPDATE sessions SET locked=? WHERE id=?',[($input['locked']??true)?1:0,$sid]);$result=['ok'=>true];}
   elseif($action==='revoke'){run($db,'UPDATE viewers SET revoked=1,name="" WHERE sid=? AND id=?',[$sid,textValue($input['viewer']??'',48)]);run($db,'UPDATE sessions SET locked=1 WHERE id=?',[$sid]);$result=['ok'=>true,'locked'=>true];}
   elseif($action==='stop'){$savedTops=sharedTops($db,$sid);run($db,'UPDATE sessions SET stopped=1,snapshot="{}" WHERE id=?',[$sid]);run($db,'DELETE FROM viewers WHERE sid=?',[$sid]);run($db,'DELETE FROM tops WHERE sid=?',[$sid]);$result=['ok'=>true,'tops'=>$savedTops];}
  }
  $db->exec('COMMIT');
 }
 echo json_encode($result,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
}catch(JsonException $e){fail(400,'JSON invalide.');}catch(Throwable $e){error_log('S2A Copilot: '.get_class($e));unavailable($e instanceof PDOException?'sqlite':'internal','Copilot est temporairement indisponible. Pilot peut continuer le spectacle.');}
