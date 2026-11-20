/* Bounded reports: known code locations, predefined actions and technical state only. */
(function(){
 'use strict';
 var script=document.currentScript;
 if(!script||!window.fetch||!/^https?:$/.test(location.protocol))return;
 var version=script.getAttribute('data-version'),surface=script.getAttribute('data-surface');
 var endpoint=new URL('report.php',script.src).href;
 var preference='s2a-pilot-diagnostics-disabled',queueKey='s2a-pilot-diagnostics-queue';
 var queue=[],recent={},activity=[],busy=false,retryAfter=0,enabled=true;
 var phases='page scripts interface storage-read project-restore new-project';
 var reasons='exception rejection script-load timeout storage-read restore';
 var relayActions='health create join read publish members revoke lock stop add_top update_top delete_top command remote_ack set_role';
 function cleanWorkerMessage(value){
  if(typeof value!=='string')return '';
  return value.replace(/[\x00-\x1f\x7f-\x9f]/g,' ')
   .replace(/\b(?:https?|file|blob|data):[^\s'"<>]+/gi,'[adresse masquée]')
   .replace(/(?:[A-Z]:\\|\\\\|\/)[^\s'"<>]+/gi,'[chemin masqué]')
   .replace(/\bBearer\s+[^\s'"<>]+/gi,'Bearer [masqué]')
   .replace(/\b(token|password|secret|credential|authorization|api[_-]?key)\s*[=:]\s*[^\s'"<>]+/gi,'$1=[masqué]')
   .replace(/\S+@\S+\.\S+/g,'[adresse masquée]').replace(/\s+/g,' ').trim().slice(0,400).replace(/[\uD800-\uDBFF]$/,'');
 }
 function cleanTechnical(kind,value){
  if(!value)return undefined;
  if(kind==='copilot-relay'&&inList(relayActions,value.action)&&typeof value.status==='number'&&value.status%1===0&&value.status>=500&&value.status<=599){
   return {action:value.action,status:value.status,cause:inList('configuration storage sqlite internal',value.cause)?value.cause:undefined};
  }
  if(kind==='copilot-relay'&&inList(relayActions,value.action)&&inList('timeout network',value.failure)){
   return {action:value.action,failure:value.failure};
  }
  if(kind==='media'&&inList('timeout duration unsupported decode read',value.probe)){
   var mime=/^(?:audio|video)\/[a-z0-9.+-]{1,45}$/.test(value.mime)?value.mime:'unknown';
   return {probe:value.probe,mime:mime,mediaCode:[1,2,3,4].indexOf(value.mediaCode)>=0?value.mediaCode:0};
  }
  if(kind==='offline'&&inList('register update',value.operation)){
   return {operation:value.operation,message:cleanWorkerMessage(value.message)};
  }
  return undefined;
 }
 var blockingStartupError=false;
 var steps='go auto-go play pause seek open save import toolbox checklist sequence-sheet audio-test ltc-test pdf share';
 var detailCodes='undefined-access null-access not-callable missing-symbol syntax media-decode media-missing playback-denied output-unavailable quota network timeout unsupported';
 var buttons={openProjectBtn:'open',saveAsBtn:'save',addMediaGlobalBtn:'import',pilotToolboxButton:'toolbox',checklistOpen:'checklist',pilotAudioOutputTest:'audio-test',pilotAudioOutputLeft:'audio-test',pilotAudioOutputRight:'audio-test',pilotAudioOutputLtc:'ltc-test',pdfTechBtn:'pdf',stagePdfDownload:'pdf',checklistPdfDownload:'pdf',copilotButton:'share'};
 var files='polyfills.js adapters.js pako_inflate.min.js qrcode.js app.js app.es5.js index.html viewer.js copilot-host.js startup.js compatibility-loader.js i18n.js i18n.es5.js i18n-catalog.js material-ui.js quick-help.js help-video.js help-images.js technical-preview.js technical-preview.es5.js service-worker.js';
 var kinds='runtime rejection resource startup transport save open pdf autosave media offline copilot-relay';
 var errors='Error TypeError ReferenceError SyntaxError RangeError URIError EvalError AggregateError AbortError NotAllowedError NotSupportedError InvalidStateError QuotaExceededError NetworkError SecurityError NotFoundError';
 function inList(list,value){return typeof value==='string'&&(' '+list+' ').indexOf(' '+value+' ')>=0&&value.indexOf(' ')<0;}
 try{
  enabled=localStorage.getItem(preference)!=='1';
  var saved=JSON.parse(sessionStorage.getItem(queueKey)||'[]');
  if(enabled&&Array.isArray(saved))queue=saved.filter(function(item){
   return item&&item.version===version&&item.surface===surface&&inList(kinds,item.kind)&&inList(errors,item.error)&&(!item.file||inList(files,item.file));
  }).slice(-20).map(function(item){
   return {version:version,surface:surface,kind:item.kind,error:item.error,file:item.file||'',
    technical:cleanTechnical(item.kind,item.technical),detail:inList(detailCodes,item.detail)?item.detail:'',context:cleanContext(item.context),frames:cleanFrames(item.frames),actions:cleanActions(item.actions),
    line:coordinate(item.line),column:coordinate(item.column),phase:inList(phases,item.phase)?item.phase:'',reason:inList(reasons,item.reason)?item.reason:'',position:item.position==='checkpoint'?'checkpoint':'',
    browser:/^(?:(?:Chrome|Firefox|Safari|Edge) [0-9]{1,3}|Other)$/.test(item.browser)?item.browser:'Other'};
  });
 }catch(ignore){}
 function coordinate(value){return Math.floor(Math.min(10000000,Math.max(0,Number(value)||0)));}
 function persist(){try{sessionStorage.setItem(queueKey,JSON.stringify(queue));}catch(ignore){}}
 function step(action){
  if(!enabled||!inList(steps,action))return;
  var now=Date.now(),last=activity[activity.length-1];
  if(last&&last.action===action&&now-last.at<1500){last.at=now;return;}
  activity.push({action:action,at:now});
  if(activity.length>8)activity.shift();
 }
 function cleanFrames(value){
  return (Array.isArray(value)?value:[]).filter(function(frame){return frame&&inList(files,frame.file);}).slice(0,6)
   .map(function(frame){return {file:frame.file,line:coordinate(frame.line),column:coordinate(frame.column)};});
 }
 function cleanActions(value){
  return (Array.isArray(value)?value:[]).filter(function(entry){return entry&&inList(steps,entry.action);}).slice(-8)
   .map(function(entry){return {action:entry.action,seconds:Math.min(600,coordinate(entry.seconds))};});
 }
 function cleanContext(value){
  value=value||{};
  var allowed={platform:'macOS Windows iOS iPadOS Android Linux Other',screen:'narrow medium wide',connection:'online offline',ui:'edit live',mode:'spectacle visual',playback:'playing paused stopped',output:'system external',ltc:'on off',build:'modern compatibility'};
  var result={};
  Object.keys(allowed).forEach(function(key){if(inList(allowed[key],value[key]))result[key]=value[key];});
  if(typeof value.platformVersion==='string'&&/^\d{1,3}(?:\.\d{1,3})?$/.test(value.platformVersion))result.platformVersion=value.platformVersion;
  ['cues','audio','video'].forEach(function(key){if(Number.isInteger(value[key]))result[key]=Math.min(10000,coordinate(value[key]));});
  return result;
 }
 function context(){
  var ua=navigator.userAgent,platform='Other',match;
  if(/Android/.test(ua)){platform='Android';match=/Android (\d+(?:\.\d+)?)/.exec(ua);}
  else if(/iPad/.test(ua)||/Macintosh/.test(ua)&&navigator.maxTouchPoints>1){platform='iPadOS';match=/OS (\d+_\d+)/.exec(ua);}
  else if(/iPhone|iPod/.test(ua)){platform='iOS';match=/OS (\d+_\d+)/.exec(ua);}
  else if(/Windows/.test(ua)){platform='Windows';match=/Windows NT (\d+\.\d+)/.exec(ua);}
  else if(/Macintosh/.test(ua)){platform='macOS';match=/Mac OS X (\d+_\d+)/.exec(ua);}
  else if(/Linux/.test(ua))platform='Linux';
  var data={};
  try{if(window.S2APilotDiagnosticContext)data=window.S2APilotDiagnosticContext()||{};}catch(ignore){}
  data.platform=platform;data.platformVersion=match?match[1].replace('_','.'):'';
  data.connection=navigator.onLine===false?'offline':'online';
  data.screen=innerWidth<=600?'narrow':innerWidth<=1000?'medium':'wide';
  var build=source(window.s2aBootScript);
  if(build==='app.js'||build==='app.es5.js')data.build=build==='app.es5.js'?'compatibility':'modern';
  return cleanContext(data);
 }
 function classify(error){
  var message='';
  try{message=String(error&&error.message||'').slice(0,1200);}catch(ignore){}
  if(/undefined is not an object|cannot read.*undefined|can't access.*undefined/i.test(message))return 'undefined-access';
  if(/null is not an object|cannot read.*null|can't access.*null/i.test(message))return 'null-access';
  if(/not a function|not a constructor/i.test(message))return 'not-callable';
  if(/is not defined|can't find variable|cannot access.*before initialization/i.test(message))return 'missing-symbol';
  if(/unexpected token|unexpected identifier|syntax error/i.test(message))return 'syntax';
  if(/média introuvable|media not found/i.test(message))return 'media-missing';
  if(/non décodable|decode.*(?:audio|media)|decod(?:e|ing) failed/i.test(message))return 'media-decode';
  if(/not allowed.*(?:play|user)|user.*interact.*play|play\(\) failed/i.test(message))return 'playback-denied';
  if(/sortie pilot indisponible|audio.output.changed|audio output unavailable/i.test(message))return 'output-unavailable';
  if(/quota/i.test(message))return 'quota';
  if(/timed out|timeout|délai.*dépassé/i.test(message))return 'timeout';
  if(/network|failed to fetch|load failed/i.test(message))return 'network';
  if(/not supported|non pris en charge/i.test(message))return 'unsupported';
  return '';
 }
 function browser(){
  var ua=navigator.userAgent,match=/(EdgA?|EdgiOS|Firefox|FxiOS|CriOS|Chrome)\/(\d{1,3})/.exec(ua);
  if(!match&&/Safari/.test(ua))match=/Version\/(\d{1,3})/.exec(ua);
  if(!match)return 'Other';
  var names={Edg:'Edge',EdgA:'Edge',EdgiOS:'Edge',FxiOS:'Firefox',CriOS:'Chrome'};
  return match.length===2?'Safari '+match[1]:(names[match[1]]||match[1])+' '+match[2];
 }
 function source(value){
  if(!value)return '';
  try{
   var url=new URL(value,location.href),file=url.pathname.split('/').pop();
   if(url.origin!==location.origin)return '';
   if(url.pathname===location.pathname)return 'index.html';
   return inList(files,file)?file:'';
  }catch(ignore){return '';}
 }
 function send(){
  if(!enabled||busy||!queue.length||navigator.onLine===false||Date.now()<retryAfter)return;
  var item=queue[0];busy=true;
  fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item),credentials:'omit',cache:'no-store',keepalive:true})
   .then(function(response){
    if(response.ok||response.status===400){
     if(queue[0]===item)queue.shift();
     persist();
    }else retryAfter=Date.now()+60000;
   },function(){retryAfter=Date.now()+60000;})
   .then(function(){busy=false;if(Date.now()>=retryAfter)send();});
 }
 function findFrames(stack){
  if(typeof stack!=='string')return [];
  var entries=stack.slice(0,12000).match(/https?:\/\/[^\s)]+:\d+:\d+/g)||[],frames=[];
  for(var i=0;i<entries.length&&frames.length<6;i++){
   var frame=/^(.*):(\d+):(\d+)$/.exec(entries[i]),file=frame&&source(frame[1]);
   if(file)frames.push({file:file,line:coordinate(frame[2]),column:coordinate(frame[3])});
  }
  return frames;
 }
 function report(kind,error,file,line,column,phase,reason,fallback,checkpoint,technical){
  if(!enabled||!inList(kinds,kind)||queue.length>=20)return;
  var name,stack;
  try{name=error&&error.name;stack=error&&error.stack;}catch(ignore){}
  file=source(file||'');
  var position='',frames=findFrames(stack),now=Date.now();
  if(!file||!line){
   var frame=frames.find(function(entry){return !file||entry.file===file;});
   if(!frame&&(checkpoint||!file&&kind!=='startup'&&kind!=='resource')){
    frames=findFrames((checkpoint||new Error()).stack);frame=frames[0];if(frame)position='checkpoint';
   }
   if(frame){file=frame.file;line=frame.line;column=frame.column;}
  }
  if(!file)file=source(fallback);
  var actions=cleanActions(activity.filter(function(entry){return now-entry.at<=600000;}).map(function(entry){
   return {action:entry.action,seconds:Math.round((now-entry.at)/1000)};
  }));
  var item={version:version,surface:surface,kind:kind,error:inList(errors,name)?name:'Error',file:file,line:file?coordinate(line):0,column:file?coordinate(column):0,browser:browser(),phase:inList(phases,phase)?phase:'',reason:inList(reasons,reason)?reason:'',position:position,
   technical:cleanTechnical(kind,technical),detail:classify(error),context:context(),frames:frames,actions:actions};
  var key=[item.kind,item.error,item.file,item.line,item.column,item.phase,item.reason,item.position,item.detail,item.technical&&[item.technical.action,item.technical.status,item.technical.failure,item.technical.operation,item.technical.probe,item.technical.mime,item.technical.mediaCode,item.technical.cause].join('/')].join('|');
  if(recent[key]&&now-recent[key]<60000)return;
  if(Object.keys(recent).length>=100)recent={};
  recent[key]=now;queue.push(item);persist();setTimeout(send,0);
 }
 function booting(){return surface==='Pilot'&&(!window.s2aBootReady||!window.s2aWorkspaceReady);}
 function startup(reason,error,file,line,column){
  if(!inList(reasons,reason))return;
  if(reason==='timeout'&&blockingStartupError)return;
  if(reason==='exception'||reason==='rejection'||reason==='script-load')blockingStartupError=true;
  var checkpoint=reason==='storage-read'||reason==='restore'?new Error():null;
  report('startup',error,file,line,column,window.s2aBootPhase||'page',reason,window.s2aBootScript||location.href,checkpoint);
 }
 var relayIncidents={};
 function sendRelayIncident(incident){
  if(incident.sent)return;
  incident.sent=true;
  report('copilot-relay',incident.error,'',0,0,'','','',incident.checkpoint,incident.technical);
 }
 window.S2APilotDiagnostics={
  report:report,startup:startup,step:step,
  mediaProbe:function(error,probe){
   report('media',error,'',0,0,'','','',new Error(),{probe:probe.reason,mime:probe.mime,mediaCode:probe.code});
  },
  relay:function(action,status,failure,error,cause){
   var technical={action:action,status:status,failure:failure,cause:cause};
   if(action!=='read'&&action!=='publish'){
    report('copilot-relay',error,'',0,0,'','','',new Error(),technical);return;
   }
   var incident=relayIncidents[action];
   if(!incident){
    incident=relayIncidents[action]={technical:technical,error:error,checkpoint:new Error(),sent:false};
    incident.timer=setTimeout(function(){sendRelayIncident(incident);},15000);
   }else if(!incident.sent&&(status||(!incident.technical.status&&failure==='timeout'))){
    incident.technical=technical;incident.error=error;
   }
  },
  relayRecovered:function(action){
   var incident=relayIncidents[action];
   if(!incident)return;
   clearTimeout(incident.timer);
   delete relayIncidents[action];
   // Transient polling failures that recovered within the grace period are not emailed.
  },
  offline:function(operation,error){
   var message;
   try{message=error&&error.message;}catch(ignore){}
   report('offline',error,'',0,0,'','','',new Error(),{operation:operation,message:message});
  }
 };
 document.addEventListener('click',function(event){
  var node=event.target;
  while(node&&node!==document){
   if(node.id&&Object.prototype.hasOwnProperty.call(buttons,node.id)){step(buttons[node.id]);break;}
   node=node.parentNode;
  }
 },true);
 window.addEventListener('error',function(event){
  if(event.target===window){
   if(source(event.filename||'')){
    if(booting())startup('exception',event.error,event.filename,event.lineno,event.colno);
    else report('runtime',event.error,event.filename,event.lineno,event.colno);
   }
  }else if(event.target&&event.target.tagName==='SCRIPT'&&source(event.target.src)){
   if(booting())startup('script-load',null,event.target.src);
   else report('resource',null,event.target.src);
  }
 },true);
 window.addEventListener('unhandledrejection',function(event){
  if(booting())startup('rejection',event.reason);
  else report('rejection',event.reason);
 });
 window.addEventListener('online',function(){retryAfter=0;send();});
 window.addEventListener('storage',function(event){
  if(event.key!==preference)return;
  enabled=event.newValue!=='1';
  if(!enabled){queue=[];activity=[];persist();}
  var checkbox=document.getElementById('pilotDiagnosticsEnabled');
  if(checkbox)checkbox.checked=enabled;
 });
 document.addEventListener('DOMContentLoaded',function(){
  var checkbox=document.getElementById('pilotDiagnosticsEnabled');
  if(!checkbox)return;
  checkbox.checked=enabled;
  checkbox.addEventListener('change',function(){
   enabled=checkbox.checked;
   try{if(enabled)localStorage.removeItem(preference);else localStorage.setItem(preference,'1');}catch(ignore){}
   if(!enabled){queue=[];activity=[];persist();}else send();
  });
 });
 if(surface==='Pilot')setTimeout(function(){if(booting())startup('timeout');},15000);
 setTimeout(send,0);setInterval(send,60000);
})();
