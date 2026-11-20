/* Copilot beta: isolated network loop, never awaited by the transport. */
(()=>{'use strict';
const $=id=>document.getElementById(id),endpoint=new URL('./copilot/api.php',location.href);let session=null,timer=null,busy=false,stopping=false,cycle=0,starting=false,lastPublishStarted=0,publishRtt=0,urgentQueued=false;const diagnostics={revision:'copilot-backstage1',success:0,failures:0,lastRoundTripMs:0,events:[]};window.S2ACopilotHostDiagnostics=()=>JSON.parse(JSON.stringify(diagnostics));const thumbnails=new Map(),storageKey='s2a-copilot-shares:'+endpoint.pathname;
const remoteInstance=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
let remoteConnectionEpoch=0,pinUpdating=false;
const pinText=key=>window.S2AStrings?.text(key)||key;
function newRemotePin(){
 const value=new Uint32Array(1);
 do{crypto.getRandomValues(value);}while(value[0]>=4294960000);
 return String(value[0]%10000).padStart(4,'0');
}
async function configureRemotePin(current,pin){
 if(!/^[0-9]{4}$/.test(pin))throw new Error(pinText('Saisissez exactement 4 chiffres.'));
 pinUpdating=true;remoteConnectionEpoch++;clearTimeout(timer);
 try{
  const result=await api('set_remote_pin',current.host,{id:current.id,remotePin:pin});
  if(session!==current)return;
  current.remotePin=pin;current.remotePinRevision=result.remotePinRevision;remember(current);
  $('copilotPinStatus').textContent=pinText('Code enregistré. Les télécommandes doivent se reconnecter.');
 }finally{pinUpdating=false;if(session===current&&!busy)tick();}
}
async function applyRemoteCommands(current,commands,sent,connectionEpoch){
 for(const command of commands||[]){
  let status='rejected';
  if(session===current&&!stopping&&connectionEpoch===remoteConnectionEpoch&&navigator.onLine!==false&&!pinUpdating&&!!current.remotePinRevision&&$('copilotRemoteEnabled').checked&&performance.now()-sent<3000){
   try{const result=await window.S2ACopilotCommand(command.action,command.cue_id||'');status=result==='guarded'?'guarded':'done';}
   catch(error){say(error.message||'Commande refusée par Pilot.');}
  }
  try{await api('remote_ack',current.host,{id:current.id,commandId:command.id,status});}catch{if(status==='guarded'){try{await api('remote_ack',current.host,{id:current.id,commandId:command.id,status:'rejected'});}catch{}}}
  urgentQueued=true;
 }
}
function say(message){const el=$('copilotStatus'),label=message.startsWith('Partage actif')?'Partage actif':message.startsWith('Partage arrêté')?'Partage arrêté':'';el.replaceChildren();if(label){const strong=document.createElement('strong');strong.className=label==='Partage actif'?'shareActive':'shareStopped';strong.textContent=label;el.append(strong,document.createTextNode(message.slice(label.length)));}else el.textContent=message;}
async function api(action,credential,body={}){const controller=new AbortController();
 let timedOut=false;
 const timeout=setTimeout(()=>{timedOut=true;controller.abort();},12000);try{const response=await fetch(endpoint+'?action='+action,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Authorization':'Bearer '+credential},body:JSON.stringify(body),signal:controller.signal}).catch(error=>{
  window.S2APilotDiagnostics?.relay?.(action,null,timedOut?'timeout':'network',error);
  throw error;
 });if(response.status>=500)window.S2APilotDiagnostics?.relay?.(action,response.status,undefined,undefined,response.headers.get('X-Pilot-Relay-Cause'));let data;try{data=await response.json();}catch{const error=new Error('Réponse serveur inattendue (HTTP '+response.status+'). Vérifiez le relais ou le filtrage hébergeur.');error.status=response.status;error.relayConfirmed=false;error.securityRule=(response.headers.get('blocked-by-security-rule')||'').slice(0,80);error.requestId=(response.headers.get('cf-ray')||'').slice(0,80);throw error;}if(!response.ok){const error=new Error(data.error||'Copilot indisponible.');error.status=response.status;error.relayConfirmed=typeof data.error==='string';throw error;}window.S2APilotDiagnostics?.relayRecovered?.(action);return data;}finally{clearTimeout(timeout);}}
async function thumbnail(source){if(!source)return '';if(thumbnails.has(source))return thumbnails.get(source);const result=await new Promise(resolve=>{const img=new Image(),timeout=setTimeout(()=>resolve(''),2000);img.onload=()=>{clearTimeout(timeout);try{const c=document.createElement('canvas'),scale=Math.min(1,320/img.width,200/img.height);c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);const url=c.toDataURL('image/jpeg',.6);resolve(url.length<40000?url:'');}catch{resolve('');}};img.onerror=()=>{clearTimeout(timeout);resolve('');};img.src=source;});if(thumbnails.size>10)thumbnails.clear();thumbnails.set(source,result);return result;}
function restoreUI(){const active=!!session;$('copilotSetup').hidden=active;$('copilotSharing').hidden=!active;$('copilotButton').classList.toggle('copilotLive',active);$('copilotButton').title=active?'Copilot — partage actif':'Copilot';$('copilotStart').disabled=active;}
function clearSession(){clearTimeout(timer);session=null;busy=false;stopping=false;thumbnails.clear();$('copilotQr').replaceChildren();$('copilotLink').value='';$('copilotMembers').replaceChildren();restoreUI();}
function memberHue(id){
 let hash=0;
 for(let i=0;i<id.length;i++)hash=(Math.imul(31,hash)+id.charCodeAt(i))>>>0;
 return hash%360;
}
async function refreshMembers(current){const data=await api('members',current.host,{id:current.id});if(session!==current)return;if(Array.isArray(data.tops))window.S2ACopilotTops.set(current.projectId,data.tops);current.locked=data.locked;if(!data.remotePinConfigured){current.remotePinRevision=0;$('copilotPinStatus').textContent=pinText('Configurez le code télécommande dans Pilot.');}$('copilotLock').textContent=data.locked?'Autoriser de nouveaux écrans':'Fermer les nouvelles connexions';const members=data.viewers.filter(v=>!Number(v.revoked));$('copilotCount').textContent=members.filter(v=>data.now-v.seen<8).length+' écran(s) connecté(s) · '+members.length+' autorisé(s)';$('copilotMembers').replaceChildren();for(const member of members){const li=document.createElement('li'),label=document.createElement('span');li.dataset.viewerId=member.id;li.style.setProperty("--member-hue",memberHue(member.id));const connected=data.now-member.seen<8;const status=document.createElement('span');status.className=connected?'copilotMemberConnected':'copilotMemberDisconnected';status.textContent=connected?'connecté':'déconnecté';label.append(member.name+' · '+(member.role==='remote'?'Télécommande':member.role==='backstage'?'Backstage':'Régie')+' · ',status);const button=document.createElement('button');button.type='button';button.textContent='Retirer';button.onclick=async()=>{button.disabled=true;try{await api('revoke',current.host,{id:current.id,viewer:member.id});say('Accès retiré. Les nouvelles connexions sont fermées pour empêcher une nouvelle entrée avec le QR.');await refreshMembers(current);}catch(e){say(e.message);}finally{button.disabled=false;}};li.append(label,button);$('copilotMembers').append(li);}}
async function tick(){const current=session;if(!current||busy||stopping||pinUpdating)return;if(current.projectId!==window.S2ACopilotState().projectId){await endOldProject();return;}let failed=false;busy=true;lastPublishStarted=performance.now();const connectionEpoch=remoteConnectionEpoch;try{const sampled=performance.now(),state=window.S2ACopilotState();state.remoteEnabled=!pinUpdating&&!!current.remotePinRevision&&$('copilotRemoteEnabled').checked;state.remoteInstance=remoteInstance+':'+state.projectEpoch+':'+connectionEpoch;if(state.cues.length>300)throw new Error('Cette bêta Copilot accepte 300 Cues maximum.');const imageKeys=new Map();state.images={};let imageBytes=0;for(const cue of state.cues){const source=cue.image;cue.image='';if(!source)continue;let key=imageKeys.get(source);if(key===undefined){const image=await thumbnail(source);if(!image||imageBytes+image.length>280000)continue;key='img'+imageKeys.size;imageKeys.set(source,key);state.images[key]=image;imageBytes+=image.length;}cue.imageKey=key;}if(session!==current||stopping||connectionEpoch!==remoteConnectionEpoch)return;state.sampleAge=Math.min(10,(performance.now()-sampled)/1000+publishRtt/2000);const sent=performance.now();const result=await api('publish',current.host,{id:current.id,state});publishRtt=performance.now()-sent;await applyRemoteCommands(current,result.commands,sent,connectionEpoch);diagnostics.success++;diagnostics.lastRoundTripMs=Math.round(publishRtt);if(session!==current)return;if(cycle++%6===0)await refreshMembers(current);say(current.localInstance?'Partage actif · réseau local':state.show||state.remoteEnabled?'Partage actif · lien valable jusqu’au ' +new Date(current.expires*1000).toLocaleDateString()+'.':'Partage actif · passez en Show pour afficher la conduite.');}catch(e){failed=true;if(session===current&&connectionEpoch===remoteConnectionEpoch)remoteConnectionEpoch++;diagnostics.failures++;diagnostics.events.push({at:new Date().toISOString(),kind:e.name==='AbortError'?'timeout':e.status?'http_error':'network_error',status:e.status||0,securityRule:e.securityRule||'',requestId:e.requestId||''});if(diagnostics.events.length>20)diagnostics.events.shift();if(session===current){if(e.relayConfirmed&&(e.status===403||e.status===410)){forget(current);clearSession();say(e.message);if($('copilotDialog').open)setTimeout(startShare,0);}else say(e.message+' La lecture de Pilot continue. Reconnexion automatique…');}}finally{busy=false;if(session&&!stopping)timer=setTimeout(tick,failed?1500:urgentQueued?0:Math.max(0,($('copilotRemoteEnabled').checked?300:window.S2ACopilotState().playing?500:1500)-(performance.now()-lastPublishStarted)));urgentQueued=false;}}
function savedShares(){try{return JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{return {};}}
function remember(current){try{const all=savedShares();for(const id of Object.keys(all))if(all[id].expires*1000<Date.now())delete all[id];all[current.projectId]=current;localStorage.setItem(storageKey,JSON.stringify(all));}catch{say('Partage créé, mais ce navigateur ne peut pas mémoriser son lien.');}}
function forget(current){if(!current)return;try{const all=savedShares();delete all[current.projectId];localStorage.setItem(storageKey,JSON.stringify(all));}catch{}}
function mount(current){session=current;cycle=0;$('copilotRemotePin').value=current.remotePin||'';$('copilotPinStatus').textContent='';restoreUI();$('copilotQr').replaceChildren();$('copilotLink').value=current.url;new QRCode($('copilotQr'),{text:current.url,width:220,height:220,correctLevel:QRCode.CorrectLevel.H});const logo=document.createElement('img');logo.className='copilotQrLogo';logo.src='./copilot-assets/copilot-logo.png';logo.alt='S2A Copilot';$('copilotQr').append(logo);}
async function endOldProject(){const old=session;if(!old)return;clearSession();try{await api('publish',old.host,{id:old.id,state:{schema:1,show:false,playing:false,title:'',cues:[]}});}catch{}say('Conduite changée. Son ancien lien reste valable jusqu’à son expiration.');}
async function startShare(){
 if(starting)return;starting=true;const button=$('copilotStart');button.disabled=true;
 try{
  await window.S2ACopilotPersist();
  const state=window.S2ACopilotState(),epoch=state.projectEpoch,projectId=state.projectId;
  if(session&&session.projectId!==projectId)await endOldProject();
  if(session){restoreUI();return;}
  const local=['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='8092';
  const info=local?await window.S2APilotLocalInfo():null;
  if(local&&!info?.viewer)throw new Error('Lancez Pilot avec une adresse réseau pour activer Copilot local.');
  const saved=savedShares()[projectId];if(saved&&(!local||saved.localInstance===info.instance)&&saved.expires*1000>Date.now()&&saved.host&&saved.url){saved.epoch=epoch;mount(saved);await configureRemotePin(saved,saved.remotePin||newRemotePin());$('copilotRemotePin').value=saved.remotePin;say('Lien de partage retrouvé.');tick();return;}
  const remotePin=newRemotePin();say('Création du partage…');const current=await api('create','',{tops:window.S2ACopilotTops.get(),remotePin});current.remotePin=remotePin;current.epoch=epoch;current.projectId=projectId;
  if(projectId!==window.S2ACopilotState().projectId){try{await api('stop',current.host,{id:current.id});}catch{}say('Conduite changée. Cliquez à nouveau sur le bouton QR.');return;}
  current.localInstance=info?.instance;const url=new URL(info?.viewer||'./copilot/index.php',location.href);url.hash=new URLSearchParams({s:current.id,i:current.invite}).toString();current.url=url.href;remember(current);mount(current);say(local?'Partage local actif. Scannez le QR code depuis le même réseau.':'Partage créé pour 14 jours. Scannez le QR code sur un autre appareil.');tick();
 }catch(e){say(e.message);restoreUI();}finally{starting=false;button.disabled=!!session;}
}
function init(){if(!$('copilotStart'))return;
window.addEventListener('s2a-copilot-state',()=>{if(!session||stopping)return;if(busy){urgentQueued=true;return;}clearTimeout(timer);timer=setTimeout(tick,Math.max(0,150-(performance.now()-lastPublishStarted)));});
window.addEventListener('offline',()=>{remoteConnectionEpoch++;});
window.addEventListener('online',()=>{if(!session||stopping)return;if(busy){urgentQueued=true;return;}clearTimeout(timer);tick();});
window.S2ACopilotBeforeExport=async()=>{const current=session;if(!current||current.projectId!==window.S2ACopilotState().projectId)return;try{const data=await api('members',current.host,{id:current.id});if(Array.isArray(data.tops))window.S2ACopilotTops.set(current.projectId,data.tops);await window.S2ACopilotPersist();}catch(error){if(error.status===410){forget(current);clearSession();return;}throw new Error('Impossible de récupérer les derniers Tops Backstage. Rétablissez la connexion puis enregistrez à nouveau.');}};
if($('copilotDiagnostic'))$('copilotDiagnostic').onclick=async()=>{const report=JSON.stringify(window.S2ACopilotHostDiagnostics(),null,2);try{await navigator.clipboard.writeText(report);say('Diagnostic de connexion copié.');}catch{alert(report);}};
const unlock=()=>{window.S2ACopilotUnlock?.().catch(()=>say('Activez la sortie audio depuis Pilot avant de commander la lecture.'));};
try{$('copilotRemoteEnabled').checked=localStorage.getItem('s2a-copilot-remote-enabled')!=='false';}catch{}
$('copilotRemoteEnabled').onchange=()=>{try{localStorage.setItem('s2a-copilot-remote-enabled',String($('copilotRemoteEnabled').checked));}catch{}if($('copilotRemoteEnabled').checked)unlock();clearTimeout(timer);if(!busy)tick();};
$('copilotPinSave').onclick=async()=>{
 const current=session;if(!current||pinUpdating)return;const button=$('copilotPinSave');button.disabled=true;
 try{await configureRemotePin(current,$('copilotRemotePin').value);await refreshMembers(current);}
 catch(error){$('copilotPinStatus').textContent=pinText(error.message);}
 finally{button.disabled=false;}
};
$('copilotStart').onclick=()=>{unlock();startShare();};
$('copilotButton').addEventListener('click',()=>{unlock();startShare();});
$('remoteControlOpen').onclick=()=>{$('pilotToolboxDialog').close();unlock();$('copilotButton').click();};
$('copilotCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('copilotLink').value);say('Lien copié.');}catch{$('copilotLink').focus();$('copilotLink').select();say('Sélectionnez Copier pour récupérer le lien.');}};
$('copilotLock').onclick=async()=>{const current=session;if(!current)return;const button=$('copilotLock');button.disabled=true;try{await api('lock',current.host,{id:current.id,locked:!current.locked});await refreshMembers(current);}catch(e){say(e.message);}finally{button.disabled=false;}};
$('copilotStop').onclick=async()=>{if(!session)return;const current=session;stopping=true;clearTimeout(timer);$('copilotStop').disabled=true;try{const stopped=await api('stop',current.host,{id:current.id});if(Array.isArray(stopped.tops))window.S2ACopilotTops.set(current.projectId,stopped.tops);forget(current);clearSession();say('Partage arrêté. Tous les accès sont fermés.');}catch(e){stopping=false;say('Arrêt non confirmé : '+e.message+' Réessayez.');timer=setTimeout(tick,1000);}finally{$('copilotStop').disabled=false;}};
$('copilotHealth').onclick=async()=>{try{await api('health','');say('Relais prêt, stockage privé vérifié. Vous pouvez créer un partage.');}catch(e){say(e.message);}};
restoreUI();const saved=savedShares()[window.S2ACopilotState().projectId];if(saved&&saved.expires*1000>Date.now())startShare();
}
const boot=setInterval(()=>{if(window.s2aBootReady&&window.S2ACopilotState&&window.S2ACopilotReady){clearInterval(boot);Promise.resolve(window.S2ACopilotReady).then(init);}},100);
})();
