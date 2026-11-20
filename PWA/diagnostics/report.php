<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Content-Type: application/json; charset=utf-8');

function finish(int $status): never { http_response_code($status); exit; }
function field(array $input,string $key,string $pattern): string {
    $value=$input[$key]??null;
    if(!is_string($value)||!preg_match($pattern,$value))finish(400);
    return $value;
}
function integer(array $input,string $key): int {
    $value=$input[$key]??null;
    if(!is_int($value)||$value<0||$value>10000000)finish(400);
    return $value;
}
function workerMessage($value): string {
    if(!is_string($value))finish(400);
    $value=preg_replace('/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u',' ',$value);
    $value=preg_replace("~\b(?:https?|file|blob|data):[^\s'\"<>]+~i",'[adresse masquée]',$value);
    $value=preg_replace("~(?:[A-Z]:\\\\|\\\\\\\\|/)[^\s'\"<>]+~i",'[chemin masqué]',$value);
    $value=preg_replace("~\bBearer\s+[^\s'\"<>]+~i",'Bearer [masqué]',$value);
    $value=preg_replace("~\b(token|password|secret|credential|authorization|api[_-]?key)\s*[=:]\s*[^\s'\"<>]+~i",'$1=[masqué]',$value);
    $value=preg_replace('/\S+@\S+\.\S+/u','[adresse masquée]',$value);
    $value=trim(preg_replace('/\s+/u',' ',$value));
    preg_match('/^.{0,400}/us',$value,$match);
    return $match[0]??'';
}
function execute(PDO $db,string $sql,array $args=[]): PDOStatement {
    $query=$db->prepare($sql);$query->execute($args);return $query;
}

try {
    $https=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')||($_SERVER['SERVER_PORT']??'')==='443';
    if(!$https)finish(403);
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST')finish(405);
    $origin='https://'.($_SERVER['HTTP_HOST']??'');
    if(($_SERVER['HTTP_ORIGIN']??'')!==$origin)finish(403);
    if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json'))finish(415);
    $body=file_get_contents('php://input',false,null,0,8193);
    if(!is_string($body)||strlen($body)>8192)finish(413);
    $input=json_decode($body,true,8,JSON_THROW_ON_ERROR);
    if(!is_array($input))finish(400);
    $version=field($input,'version','/^\d{1,4}\.\d{1,4}\.\d{1,4}$/D');
    $surface=field($input,'surface','/^(Pilot|Copilot)$/D');
    $kind=field($input,'kind','/^(runtime|rejection|resource|startup|transport|save|open|pdf|autosave|media|offline|copilot-relay)$/D');
    $error=field($input,'error','/^(Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|AggregateError|AbortError|NotAllowedError|NotSupportedError|InvalidStateError|QuotaExceededError|NetworkError|SecurityError|NotFoundError)$/D');
    $filePattern='/^(?:polyfills\.js|adapters\.js|pako_inflate\.min\.js|qrcode\.js|app\.js|app\.es5\.js|index\.html|viewer\.js|copilot-host\.js|startup\.js|compatibility-loader\.js|i18n\.js|i18n\.es5\.js|i18n-catalog\.js|material-ui\.js|quick-help\.js|help-video\.js|help-images\.js|technical-preview\.js|technical-preview\.es5\.js|service-worker\.js)?$/D';
    $file=field($input,'file',$filePattern);
    $line=integer($input,'line');$column=integer($input,'column');
    $phase=field($input+['phase'=>''],'phase','/^(?:page|scripts|interface|storage-read|project-restore|new-project)?$/D');
    $reason=field($input+['reason'=>''],'reason','/^(?:exception|rejection|script-load|timeout|storage-read|restore)?$/D');
    $position=field($input+['position'=>''],'position','/^(?:checkpoint)?$/D');
    $phases=['page'=>'Chargement de la page','scripts'=>'Chargement des scripts','interface'=>'Initialisation de l’interface',
      'storage-read'=>'Lecture de la sauvegarde locale','project-restore'=>'Restauration du projet','new-project'=>'Initialisation d’un projet'];
    $reasons=['exception'=>'Exception JavaScript','rejection'=>'Opération asynchrone en échec','script-load'=>'Script inaccessible',
      'timeout'=>'Délai de démarrage dépassé','storage-read'=>'Accès à la sauvegarde en échec','restore'=>'Restauration en échec'];
    $browser=field($input,'browser','/^(Other|(?:Chrome|Safari|Firefox|Edge) \d{1,3})$/D');
    $detailLabels=[
      'undefined-access'=>'Accès à une valeur non définie','null-access'=>'Accès à une valeur nulle',
      'not-callable'=>'Fonction ou constructeur indisponible','missing-symbol'=>'Nom inconnu ou utilisé avant son initialisation',
      'syntax'=>'Syntaxe JavaScript incompatible ou invalide','media-decode'=>'Décodage du média en échec',
      'media-missing'=>'Média introuvable','playback-denied'=>'Lecture refusée par le navigateur',
      'output-unavailable'=>'Sortie audio indisponible','quota'=>'Limite de stockage atteinte','network'=>'Échec réseau',
      'timeout'=>'Délai dépassé','unsupported'=>'Opération non prise en charge'
    ];
    $actionLabels=[
      'go'=>'GO','auto-go'=>'Enchaînement automatique','play'=>'Lecture','pause'=>'Pause','seek'=>'Déplacement de la tête de lecture',
      'open'=>'Ouverture d’un projet','save'=>'Enregistrement','import'=>'Import de médias','toolbox'=>'Boîte à outils',
      'checklist'=>'Checklist','sequence-sheet'=>'Fiche de séquence','audio-test'=>'Test audio','ltc-test'=>'Test LTC',
      'pdf'=>'Export PDF','share'=>'Partage Copilot'
    ];
    $detail=$input['detail']??'';
    if(!is_string($detail)||($detail!==''&&!isset($detailLabels[$detail])))finish(400);
    $rawContext=$input['context']??[];$context=[];$frames=[];$actions=[];
    if(!is_array($rawContext))finish(400);
    $contextFields=[
      'platform'=>['macOS','Windows','iOS','iPadOS','Android','Linux','Other'],
      'screen'=>['narrow','medium','wide'],'connection'=>['online','offline'],
      'ui'=>['edit','live'],'mode'=>['spectacle','visual'],'playback'=>['playing','paused','stopped'],
      'output'=>['system','external'],'ltc'=>['on','off'],'build'=>['modern','compatibility']
    ];
    foreach($contextFields as $key=>$allowed){
      if(!isset($rawContext[$key]))continue;
      if(!in_array($rawContext[$key],$allowed,true))finish(400);
      $context[$key]=$rawContext[$key];
    }
    if(isset($rawContext['platformVersion']))$context['platformVersion']=field($rawContext,'platformVersion','/^\d{1,3}(?:\.\d{1,3})?$/D');
    foreach(['cues','audio','video'] as $key)if(isset($rawContext[$key]))$context[$key]=min(10000,integer($rawContext,$key));
    $rawFrames=$input['frames']??[];$rawActions=$input['actions']??[];
    if(!is_array($rawFrames)||count($rawFrames)>6||!is_array($rawActions)||count($rawActions)>8)finish(400);
    foreach($rawFrames as $frame){
      if(!is_array($frame))finish(400);
      $frameFile=field($frame,'file',$filePattern);
      if($frameFile!=='')$frames[]=['file'=>$frameFile,'line'=>integer($frame,'line'),'column'=>integer($frame,'column')];
    }
    foreach($rawActions as $entry){
      if(!is_array($entry)||!is_string($entry['action']??null)||!isset($actionLabels[$entry['action']]))finish(400);
      $actions[]=['action'=>$entry['action'],'seconds'=>min(600,integer($entry,'seconds'))];
    }
    $technical=[];
    if(array_key_exists('technical',$input)){
      if(!is_array($input['technical']))finish(400);
      $data=$input['technical'];
      if($kind==='copilot-relay'){
        $action=field($data,'action','/^(?:health|create|join|read|publish|members|revoke|lock|stop|add_top|update_top|delete_top|command|remote_ack|set_role)$/D');
        if(array_key_exists('failure',$data)){
          $technical=['action'=>$action,'failure'=>field($data,'failure','/^(?:timeout|network)$/D')];
        }else{
          $status=integer($data,'status');
          if($status<500||$status>599)finish(400);
          $technical=['action'=>$action,'status'=>$status];
          if(isset($data['cause']))$technical['cause']=field($data,'cause','/^(?:configuration|storage|sqlite|internal)$/D');
        }
      }elseif($kind==='media'){
        $code=integer($data,'mediaCode');
        if($code<0||$code>4)finish(400);
        $technical=['probe'=>field($data,'probe','/^(?:timeout|duration|unsupported|decode|read)$/D'),
          'mime'=>field($data,'mime','~^(?:unknown|(?:audio|video)/[a-z0-9.+-]{1,45})$~D'),'mediaCode'=>$code];
      }elseif($kind==='offline'){
        $technical=['operation'=>field($data,'operation','/^(?:register|update)$/D')];
        if(isset($data['message']))$technical['message']=workerMessage($data['message']);
      }else finish(400);
    }
    $reportContext=json_encode(['detail'=>$detail,'context'=>$context,'frames'=>$frames,'actions'=>$actions,'technical'=>$technical],JSON_THROW_ON_ERROR);
    $directory=getenv('S2A_PILOT_REPORT_DIR')?:($_SERVER['S2A_PILOT_REPORT_DIR']??'');
    $store=$directory!==''?realpath($directory):false;
    $doc=realpath($_SERVER['DOCUMENT_ROOT']??'');
    if(!$doc||!$store||!is_dir($store)||$store==='/'||$store===$doc||str_starts_with($store,$doc.'/')||
       preg_match('~(?:^|/)(?:public_html|www|htdocs)(?:/|$)~',$store))finish(503);

    umask(0077);
    $db=new PDO('sqlite:'.$store.'/pilot-errors.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA busy_timeout=3000');
    $db->exec('CREATE TABLE IF NOT EXISTS incidents(
      id TEXT PRIMARY KEY, version TEXT, surface TEXT, kind TEXT, error TEXT, file TEXT, line INTEGER, column_no INTEGER,
      browser TEXT, first_seen INTEGER, last_seen INTEGER, occurrences INTEGER, last_attempt INTEGER DEFAULT 0, mail_status TEXT DEFAULT ""
    )');
    $db->exec('CREATE TABLE IF NOT EXISTS daily(day TEXT PRIMARY KEY, reports INTEGER DEFAULT 0, alerts INTEGER DEFAULT 0)');
    $now=time();$day=gmdate('Y-m-d',$now);
    $signature=[$version,$surface,$kind,$error,$file,$line,$column,$browser];
    if($phase!==''||$reason!==''||$position!=='')array_push($signature,$phase,$reason,$position);
    if($detail!=='')$signature[]=$detail;
    if($technical)$signature[]=json_encode(array_diff_key($technical,['message'=>true]),JSON_THROW_ON_ERROR);
    if($line===0&&$actions)$signature[]=$actions[array_key_last($actions)]['action'];
    $id=hash('sha256',implode('|',$signature));
    $to=filter_var(getenv('S2A_PILOT_REPORT_TO')?:($_SERVER['S2A_PILOT_REPORT_TO']??'contact@s2a-production.com'),FILTER_VALIDATE_EMAIL);
    $from=filter_var(getenv('S2A_PILOT_REPORT_FROM')?:($_SERVER['S2A_PILOT_REPORT_FROM']??''),FILTER_VALIDATE_EMAIL);
    $db->exec('BEGIN IMMEDIATE');
    $columns=$db->query('PRAGMA table_info(incidents)')->fetchAll(PDO::FETCH_COLUMN,1);
    foreach(['boot_phase','boot_reason','boot_position','context_json'] as $columnName){
        if(!in_array($columnName,$columns,true))$db->exec("ALTER TABLE incidents ADD COLUMN $columnName TEXT NOT NULL DEFAULT ''");
    }
    execute($db,'DELETE FROM incidents WHERE last_seen < ?',[$now-30*86400]);
    execute($db,'DELETE FROM daily WHERE day < ?',[gmdate('Y-m-d',$now-30*86400)]);
    execute($db,'INSERT OR IGNORE INTO daily(day) VALUES(?)',[$day]);
    $daily=execute($db,'SELECT reports,alerts FROM daily WHERE day=?',[$day])->fetch(PDO::FETCH_ASSOC);
    if((int)$daily['reports']>=2000){$db->exec('COMMIT');finish(429);}
    execute($db,'UPDATE daily SET reports=reports+1 WHERE day=?',[$day]);
    execute($db,'INSERT INTO incidents(id,version,surface,kind,error,file,line,column_no,browser,first_seen,last_seen,boot_phase,boot_reason,boot_position,context_json,occurrences)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen, context_json=excluded.context_json, occurrences=occurrences+1',
      [$id,$version,$surface,$kind,$error,$file,$line,$column,$browser,$now,$now,$phase,$reason,$position,$reportContext]);
    $incident=execute($db,'SELECT last_attempt,occurrences FROM incidents WHERE id=?',[$id])->fetch(PDO::FETCH_ASSOC);
    $send=$to&&$from&&function_exists('mail')&&(int)$daily['alerts']<25&&(int)$incident['last_attempt']<=$now-86400;
    if($send){
        execute($db,'UPDATE daily SET alerts=alerts+1 WHERE day=?',[$day]);
        execute($db,'UPDATE incidents SET last_attempt=?,mail_status=? WHERE id=?',[$now,'pending',$id]);
    }
    $db->exec('COMMIT');
    if($send){
        $subject="[S2A Pilot] $surface $version - $kind";
        $location=$file!==''?$file:'indisponible';
        $location.=$line>0?":$line".($column>0?":$column":''):' (ligne indisponible)';
        $details=$position==='checkpoint'?"\nEmplacement: repère de l’étape, trace d’origine indisponible":'';
        if(isset($phases[$phase]))$details.="\nÉtape: ".$phases[$phase];
        if(isset($reasons[$reason]))$details.="\nDétail: ".$reasons[$reason];
        $message="Identifiant: ".substr($id,0,16)."\nVersion: $version\nModule: $surface\nCategorie: $kind\nErreur: $error\nFichier: $location".$details."\nNavigateur: $browser\nOccurrences: ".$incident['occurrences']."\nUTC: ".gmdate('c',$now);
        if($detail!=='')$message.="\nDiagnostic: ".$detailLabels[$detail];
        if(isset($technical['action'])){
          $message.="\nRequête Copilot: POST copilot/api.php?action=".$technical['action'];
          if(isset($technical['status']))$message.="\nStatut HTTP: ".$technical['status'];
          else $message.="\nÉchec Copilot sans réponse HTTP: ".($technical['failure']==='timeout'?'Délai dépassé':'Erreur réseau');
        }
        if(isset($technical['cause']))$message.="\nDiagnostic du relais: ".$technical['cause'];
        if(isset($technical['probe']))$message.="\nImport média: ".$technical['probe']." | type: ".$technical['mime']." | code navigateur: ".$technical['mediaCode'];
        if(isset($technical['operation'])){
          $message.="\nÉtape hors ligne: ".($technical['operation']==='register'?'Enregistrement du service worker':'Mise à jour du service worker');
          if(!empty($technical['message']))$message.="\nMessage du service worker: ".$technical['message'];
        }
        if(isset($context['platform'])){
          $message.="\nSystème: ".$context['platform'].(isset($context['platformVersion'])?' '.$context['platformVersion']:'');
        }
        $labels=[
          'screen'=>['narrow'=>'compact','medium'=>'moyen','wide'=>'large'],
          'connection'=>['online'=>'en ligne','offline'=>'hors ligne'],
          'ui'=>['edit'=>'Edit','live'=>'Live'],'mode'=>['spectacle'=>'Spectacle','visual'=>'Numéro visuel'],
          'playback'=>['playing'=>'en lecture','paused'=>'en pause','stopped'=>'à l’arrêt'],
          'output'=>['system'=>'système','external'=>'externe'],
          'ltc'=>['on'=>'présent dans le projet','off'=>'absent'],'build'=>['modern'=>'standard','compatibility'=>'compatibilité']
        ];
        $titles=['screen'=>'Écran','connection'=>'Connexion','ui'=>'Interface','mode'=>'Mode','playback'=>'Transport',
                 'output'=>'Sortie audio','ltc'=>'LTC','build'=>'Version du code'];
        foreach($labels as $key=>$values)if(isset($context[$key]))$message.="\n".$titles[$key].": ".$values[$context[$key]];
        if(isset($context['cues']))$message.="\nProjet: ".$context['cues'].' Cue(s), '.($context['audio']??0).' piste(s) audio, '.($context['video']??0).' vidéo(s)';
        if($frames){
          $message.=$position==='checkpoint'?"\n\nPile du point de signalement:":"\n\nPile JavaScript (code Pilot):";
          foreach($frames as $index=>$frame)$message.="\n".($index+1).'. '.$frame['file'].':'.$frame['line'].':'.$frame['column'];
        }
        if($actions){
          $message.="\n\nDernières actions avant le rapport:";
          foreach($actions as $entry)$message.="\n- ".$entry['seconds'].' s avant - '.$actionLabels[$entry['action']];
        }
        try{$sent=@mail($to,$subject,$message,['From'=>$from,'Content-Type'=>'text/plain; charset=UTF-8']);}
        catch(Throwable $ignored){$sent=false;}
        execute($db,'UPDATE incidents SET mail_status=? WHERE id=?',[$sent?'accepted':'failed',$id]);
    }
    finish(204);
} catch(JsonException $ignored) {
    finish(400);
} catch(Throwable $error) {
    error_log('Pilot diagnostics: '.get_class($error));
    finish(503);
}
