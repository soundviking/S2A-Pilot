/* Passive show display, shared Backstage Tops and PIN-authorized remote controls. */
(()=>{'use strict';
const $=id=>document.getElementById(id),args=new URLSearchParams(location.hash.slice(1)),id=args.get('s'),invite=args.get('i');
let viewer=null,latest=null,received=0,terminal=false,signature='',timelineSignature='',lastPosition=0,editingTop=null,pollBusy=false,pollTimer=null,connectionLost=false,failures=0;
const pinText=key=>window.S2AStrings?.text(key)||key;
for(const node of document.querySelectorAll('[data-pin-i18n]'))node.textContent=pinText(node.dataset.pinI18n);
const storageKey='s2a-copilot-view-'+id;
const cueFilterKey=storageKey+'-cue-types';
let cueTypeSelection=null,remoteCueTypes=[],remoteCueTypeSignature='',remoteCueView=null;
const remoteGroupFolds=new Map();
try{
 const saved=JSON.parse(sessionStorage.getItem(cueFilterKey));
 if(Array.isArray(saved))cueTypeSelection=new Set(saved);
}catch{}
const diagnostics={revision:'copilot-backstage-drag1',received:0,failures:0,lastRoundTripMs:0,lastSnapshotAge:0,events:[]};
window.S2ACopilotDiagnostics=()=>JSON.parse(JSON.stringify(diagnostics));
function diagnostic(kind,details={}){diagnostics.events.push({at:new Date().toISOString(),kind,...details});if(diagnostics.events.length>20)diagnostics.events.shift();}

try{viewer=JSON.parse(sessionStorage.getItem(storageKey));}catch{}
let rememberedUntil=0;
if(id){
 try{
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if(saved?.expires>Date.now()/1000&&saved.viewer?.token){
   viewer=saved.viewer;
   rememberedUntil=saved.expires;
  }else if(saved)localStorage.removeItem(storageKey);
 }catch{}
}
function rememberViewer(expires){
 if(!Number.isFinite(expires)||expires<=Date.now()/1000||expires===rememberedUntil)return;
 try{
  localStorage.setItem(storageKey,JSON.stringify({viewer,expires}));
  rememberedUntil=expires;
 }catch{}
}
function forgetViewer(){
 try{sessionStorage.removeItem(storageKey);}catch{}
 try{
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if(saved?.viewer?.token===viewer.token)localStorage.removeItem(storageKey);
 }catch{}
}

if(invite){try{sessionStorage.setItem(storageKey+'-invite',invite);}catch{}history.replaceState(null,'',location.pathname+'#s='+encodeURIComponent(id||''));}
let invitation=invite;try{invitation=invitation||sessionStorage.getItem(storageKey+'-invite');}catch{}
function status(text,bad=false){$('status').textContent=pinText(text);$('status').classList.toggle('offline',bad);}
function connection(mode){
 const indicator=$('connectionIndicator');indicator.className='connectionIndicator '+mode;
 $('connectionLabel').textContent=mode==='connected'?'Connecté':mode==='disconnected'?'Déconnecté':mode==='joining'?'À rejoindre':mode==='connecting'?'Connexion':'Reconnexion';
 indicator.title=mode==='connected'?'Synchronisé avec Pilot':mode==='disconnected'?'Connexion interrompue — conduite conservée, suivi local':'Tentative de reconnexion — conduite conservée, suivi local';
}
async function api(action,credential,body){
 const controller=new AbortController();
 let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},12000);
 try{const response=await fetch('api.php?action='+action,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Authorization':'Bearer '+credential},body:JSON.stringify({id,...body}),signal:controller.signal}).catch(error=>{
  window.S2APilotDiagnostics?.relay?.(action,null,timedOut?'timeout':'network',error);
  throw error;
 });
 if(response.status>=500)window.S2APilotDiagnostics?.relay?.(action,response.status,undefined,undefined,response.headers.get('X-Pilot-Relay-Cause'));let data;try{data=await response.json();}catch{const e=new Error('Le serveur ne renvoie pas la réponse Copilot attendue.');e.status=response.status;e.relayConfirmed=false;e.securityRule=(response.headers.get('blocked-by-security-rule')||'').slice(0,80);e.requestId=(response.headers.get('cf-ray')||'').slice(0,80);throw e;}if(!response.ok){const e=new Error(data.error||'Connexion interrompue.');e.status=response.status;e.relayConfirmed=typeof data.error==='string';throw e;}window.S2APilotDiagnostics?.relayRecovered?.(action);return data;}finally{clearTimeout(timer);}
}
function clock(t){t=Math.max(0,Math.ceil(t));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
function topClock(t){t=Math.max(0,Math.round(t*10)/10);return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0')+(t%1?'.'+Math.round(t*10)%10:'');}
function parseTime(text){const parts=text.trim().replace(',','.').split(':');if(parts.length===1&&/^\d+(\.\d+)?$/.test(parts[0]))return Number(parts[0]);if(parts.length===2&&/^\d+$/.test(parts[0])&&/^\d{1,2}(\.\d+)?$/.test(parts[1])&&Number(parts[1])<60)return Number(parts[0])*60+Number(parts[1]);return NaN;}
let pendingRemote=null,remoteBusy=false,remoteAvailability=null;
let phoneTimeRemaining=false;
try{phoneTimeRemaining=sessionStorage.getItem(storageKey+'-remaining')==='true';}catch{}
function remoteFeedback(message,error=false){
 $('phoneRemoteStatus').textContent=pinText(message);$('phoneRemoteStatus').classList.toggle('isError',error);
}
$('phoneTimeToggle').onclick=()=>{
 phoneTimeRemaining=!phoneTimeRemaining;
 try{sessionStorage.setItem(storageKey+'-remaining',String(phoneTimeRemaining));}catch{}
 paint();
};
function syncPhoneViewport(){
 const height=Math.round(window.visualViewport?.height||innerHeight);
 if(document.documentElement.style.getPropertyValue('--phone-viewport-height')!==height+'px')document.documentElement.style.setProperty('--phone-viewport-height',height+'px');
}
window.visualViewport?.addEventListener('resize',syncPhoneViewport);
window.addEventListener('resize',syncPhoneViewport);syncPhoneViewport();
function isRemote(){return (latest?.role||viewer?.role)==='remote';}
const compactToggle=$('remoteCompactToggle');
let compactPreference=null,lastPhoneGo=-Infinity;
try{const value=localStorage.getItem('s2a-copilot-compact');if(value!==null)compactPreference=value==='1';}catch{}
compactToggle.onclick=()=>{
 compactPreference=compactToggle.getAttribute('aria-pressed')!=='true';
 try{localStorage.setItem('s2a-copilot-compact',compactPreference?'1':'0');}catch{}
 paint();
};
function phoneGoGuardActive(state){
 return performance.now()-lastPhoneGo<Math.max(0,Math.min(2000,Number(state?.goGuardMs)||0));
}
function paintRemote(state,stale){
 const active=isRemote();
 document.body.classList.toggle('isRemoteControl',active);
 $('phoneTimeToggle').hidden=!active;
 $('phoneRemote').hidden=!active;
 $('copilotModeLabel').hidden=!viewer||active;
 if(viewer&&!$('copilotMode').matches(':focus'))$('copilotMode').value=latest?.role||viewer.role||'technician';
 $('copilotMode').querySelector('option[value=remote]').disabled=!!state.bridge&&!state.remoteCapable;
 if(!active)return;
 const result=pendingRemote&&(latest?.commands||[]).find(command=>command.id===pendingRemote.id);
 if(result&&['done','rejected','expired','guarded'].includes(result.status)){
  remoteFeedback(result.status==='done'?'Commande appliquée.':result.status==='guarded'?'GO ignoré par la protection contre les doubles GO.':result.status==='expired'?'Commande expirée. Vérifiez la connexion avant de réessayer.':(state.bridge?'Commande refusée. Vérifiez Bridge.':'Commande refusée. Vérifiez Pilot.'),result.status==='rejected'||result.status==='expired');
  if(result.status==='done'&&pendingRemote.command==='go')lastPhoneGo=performance.now();
  pendingRemote=null;
 }else if(pendingRemote&&performance.now()-pendingRemote.started>5500){
  remoteFeedback((state.bridge?'Envoi non confirmé. Vérifiez Bridge avant de réessayer.':'Envoi non confirmé. Vérifiez Pilot avant de réessayer.'),true);pendingRemote=null;
 }
 const available=state.remoteEnabled&&!stale&&!connectionLost&&!terminal;
 document.querySelectorAll('[data-command]').forEach(button=>{button.disabled=!available||!!pendingRemote||remoteBusy||(button.dataset.command==='go'&&phoneGoGuardActive(state));});
 for(const row of $('rows').querySelectorAll('.remoteSelectable')){
  const disabled=!available||!!pendingRemote||remoteBusy;
  if(row.getAttribute('aria-disabled')!==String(disabled))row.setAttribute('aria-disabled',String(disabled));
  if(row.tabIndex!==(disabled?-1:0))row.tabIndex=disabled?-1:0;
 }
 const armed=(state.cues||[]).find(cue=>cue.id===state.remoteArmed);
 $('phonePreparedCue').hidden=!armed;
 $('phonePreparedName').textContent=armed?[armed.number,armed.name].filter(Boolean).join(' · '):'';
 if(!available)remoteFeedback(stale||connectionLost?'Connexion interrompue.':(state.bridge?'Activez les télécommandes dans Bridge.':'Activez les télécommandes dans Pilot.'),true);
 else if(remoteAvailability!==true&&!pendingRemote&&!remoteBusy)remoteFeedback((state.bridge?'Prête à commander QLab.':'Prête à commander Pilot.'));
 remoteAvailability=!!available;
 const cues=state.cues||[],current=cues.find(cue=>cue.id===state.active),next=cues.find(cue=>cue.id===(state.queued||state.next));
 $('phoneCurrentCue').textContent=current?[current.number,current.name].filter(Boolean).join(' · '):'Aucune';
 $('phoneFollowingCue').textContent=next?[next.number,next.name].filter(Boolean).join(' · '):'Fin du spectacle';
 $('phonePlayIcon').textContent=state.playing?'❚❚':'▶';
 $('phonePlayLabel').textContent=state.playing?'Pause':'Lecture';
}
async function sendRemoteCommand(command,cueId=''){
 if(remoteBusy||pendingRemote||!isRemote()||connectionLost||(command==='go'&&phoneGoGuardActive(latest?.state)))return;
 const commandId=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
 remoteBusy=true;pendingRemote={id:commandId,command,started:performance.now()};
 if(command==='go')lastPhoneGo=pendingRemote.started;
 remoteFeedback(latest?.state?.bridge?'Envoi à Bridge…':'Envoi à Pilot…');paint();
 try{await api('command',viewer.token,{commandId,command,cueId,remoteInstance:latest?.state?.remoteInstance});refresh();}
 catch(error){remoteFeedback(error.message,true);if(error.relayConfirmed){pendingRemote=null;if(command==='go')lastPhoneGo=-Infinity;}}
 finally{remoteBusy=false;paint();}
}
document.querySelectorAll('[data-command]').forEach(button=>{button.onclick=()=>sendRemoteCommand(button.dataset.command);});
function selectRemoteRow(event){
 const row=event.target.closest('.remoteSelectable');
 if(!row||!isRemote())return;
 if(event.type==='keydown'){
  if(event.repeat||!['Enter',' '].includes(event.key))return;
  event.preventDefault();
 }
 if(row.getAttribute('aria-disabled')==='true')return;
 sendRemoteCommand('select',row.dataset.id);
}
$('rows').addEventListener('click',selectRemoteRow);
$('rows').addEventListener('keydown',selectRemoteRow);
async function changeViewerRole(role,remotePin){
 const result=await api('set_role',viewer.token,{role,...(remotePin?{remotePin}:{})});
 viewer.role=result.role;pendingRemote=null;remoteAvailability=null;if(latest)latest.role=result.role;
 try{sessionStorage.setItem(storageKey,JSON.stringify(viewer));}catch{}
 rememberedUntil=0;if(latest)rememberViewer(latest.expires);refresh();
}
$('remotePinForm').onsubmit=async event=>{
 event.preventDefault();const button=event.target.querySelector('button[type=submit]');button.disabled=true;
 try{await changeViewerRole('remote',$('switchRemotePin').value);$('remotePinDialog').close();$('switchRemotePin').value='';}
 catch(error){$('remotePinError').textContent=pinText(error.message);}
 finally{button.disabled=false;}
};
$('remotePinCancel').onclick=()=>$('remotePinDialog').close();
$('remotePinDialog').addEventListener('close',()=>{$('switchRemotePin').value='';paint();});
$('copilotMode').onchange=async event=>{
 const picker=event.target;if(isRemote())return;
 if(picker.value==='remote'){picker.value=latest?.role||viewer.role||'technician';$('switchRemotePin').value='';$('remotePinError').textContent='';$('remotePinDialog').showModal();return;}
 picker.disabled=true;
 try{await changeViewerRole(picker.value);}
 catch(error){status(error.message,true);}
 finally{picker.disabled=false;paint();}
};
function isBackstage(){return (latest?.role||viewer?.role)==='backstage';}
function pulse(element,urgent,remaining){element.classList.toggle('urgent',urgent);const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;element.style.setProperty('--cue-beat',String(urgent?(reduced?1:.12+.88*(.5+.5*Math.cos(2*Math.PI*remaining))):0));}
let centerFrame=0,lastActiveTop=null,dragTop=null,dragSaving=false,topsSignature='',lastFollowedCue=null;
function highlightedCueId(state){
 // Bridge retains its parent QLab cue while a timed child is active. Highlight one row.
 if(state.bridge&&!state.current){
  if(state.sourceLost)return '';
  const preview=state.preview||state.queued||state.selected||'';
  return (state.cues||[]).some(cue=>cue.id===preview&&!cue.child)?preview:'';
 }
 const active=(state.cues||[]).find(cue=>cue.id===state.active);
 return active?.child?active.id:(state.bridge?state.current:state.active)||'';
}
function followCueChange(state){
 const id=highlightedCueId(state);
 if(id===lastFollowedCue)return;
 lastFollowedCue=id;
 if(id)centerCues();else cancelAnimationFrame(centerFrame);
}
function centerCues(backstage=false){
 cancelAnimationFrame(centerFrame);centerFrame=requestAnimationFrame(()=>{
  const list=$(backstage?'topList':'rows');
  const remote=isRemote();
  if(backstage!==isBackstage()||$('show').hidden||(!backstage&&$('remoteCueTypeFilter').open))return;
  const active=list.querySelector('.active');
  if(!active)return;
  const deck=$('stickyDeck'),viewport=window.visualViewport;
  const listBounds=remote?list.getBoundingClientRect():null;
  const top=(remote?listBounds.top:Math.max(viewport?.offsetTop||0,deck.getBoundingClientRect().bottom))+20;
  const a=active.getBoundingClientRect();
  if(backstage){
   const target=deck.getBoundingClientRect().bottom+16;
   const available=Math.max(0,innerHeight-20-target);
   window.scrollTo({top:Math.max(0,scrollY+a.top-target-Math.max(0,(available-a.height)/2)),behavior:'instant'});
   return;
  }
  // A cue change always places that cue below the timeline. Ordinary redraws never follow.
  const delta=a.top-top;
  if(Math.abs(delta)<1)return;
  if(remote)list.scrollTop+=delta;
  else window.scrollTo({top:Math.max(0,scrollY+delta),behavior:'instant'});
 });
}
function updateStickyDeckHeight(){
 document.documentElement.style.setProperty('--remote-transport-height',($('stickyDeck').offsetHeight+20)+'px');
}
// Mobile browser bars can resize the viewport during a swipe. Preserve manual scrolling.
window.addEventListener('resize',updateStickyDeckHeight);
$('remoteCueTypeFilter').addEventListener('toggle',()=>{
 updateStickyDeckHeight();
});
function remoteCueTypeBadge(type){
 const badge=document.createElement('span');badge.className='remoteCueTypeBadge';badge.textContent=type.name;
 if(/^#[0-9a-f]{6}$/i.test(type.color))badge.style.color=type.color;
 return badge;
}
function setRemoteCueTypes(selected){
 cueTypeSelection=selected;
 try{sessionStorage.setItem(cueFilterKey,JSON.stringify(selected?Array.from(selected):null));}catch{}
 remoteCueView=null;
 syncRemoteCueTypeChoices();
 paint();
}
function updateRemoteCueTypes(state,usable){
 const filter=$('remoteCueTypeFilter'),types=!state.bridge&&Array.isArray(state.cueTypes)?state.cueTypes:[];
 filter.hidden=!usable||!types.length;
 const key=JSON.stringify(types);
 if(key===remoteCueTypeSignature)return;
 remoteCueTypeSignature=key;remoteCueTypes=types;remoteCueView=null;
 const choices=$('remoteCueTypeChoices');
 choices.replaceChildren();
 for(const type of types){
  const label=document.createElement('label'),input=document.createElement('input');
  input.type='checkbox';input.value=type.id;
  input.onchange=()=>{
   const ids=Array.from(choices.querySelectorAll('input:checked'),checkbox=>checkbox.value);
   setRemoteCueTypes(ids.length===types.length?null:new Set(ids));
  };
  label.append(input,remoteCueTypeBadge(type));choices.append(label);
 }
 syncRemoteCueTypeChoices();
}
function syncRemoteCueTypeChoices(){
 const inputs=$('remoteCueTypeChoices').querySelectorAll('input');
 const selected=cueTypeSelection?Array.from(inputs).filter(input=>cueTypeSelection.has(input.value)).length:0;
 const filtered=cueTypeSelection&&(!cueTypeSelection.size||selected>0);
 $('remoteCueTypeFilterLabel').textContent='Filtrer les Cues'+(filtered?' ('+selected+')':'');
 for(const input of inputs)input.checked=!filtered||cueTypeSelection.has(input.value);
}
function remoteCueIds(cue,types){
 const ids=Array.isArray(cue.cueTypeIds)?cue.cueTypeIds:[cue.cueTypeId];
 return ids.filter(id=>id!=='none'&&types.has(id));
}
function remoteCueDisplay(cues){
 if(remoteCueView?.source===cues)return remoteCueView;
 const types=new Map(remoteCueTypes.map(type=>[type.id,type]));
 const matches=new Set(),parents=new Set();
 const hasSelection=cueTypeSelection&&(!cueTypeSelection.size||remoteCueTypes.some(type=>cueTypeSelection.has(type.id)));
 const filtered=types.size>0&&hasSelection;
 let visible=cues;
 if(filtered){
  for(const cue of cues){
   const ids=remoteCueIds(cue,types);
   if(!(ids.length?ids.some(id=>cueTypeSelection.has(id)):cueTypeSelection.has('none')))continue;
   matches.add(cue.id);
   if(cue.child&&cue.parentCueId)parents.add(cue.parentCueId);
  }
  visible=cues.filter(cue=>matches.has(cue.id)||parents.has(cue.id));
 }
 remoteCueView={source:cues,cues:visible,types,filtered,matches};
 return remoteCueView;
}
$('remoteCueTypeAll').onclick=()=>setRemoteCueTypes(null);
function remoteCueDescription(cue,display){
 const ids=remoteCueIds(cue,display.types);
 const selected=display.filtered?cueTypeSelection:null;
 const visible=ids.filter(id=>!selected||selected.has(id));
 if(cue.typeDescriptions&&typeof cue.typeDescriptions==='object'){
  return visible.map(id=>{
   const text=cue.typeDescriptions[id];
   return text?(ids.length>1?display.types.get(id).name+' - ':'')+text:'';
  }).filter(Boolean).join('\n');
 }
 // Older snapshots only contain a single combined description.
 if(selected&&(ids.length?visible.length!==ids.length:!selected.has('none')))return '';
 return cue.description||'';
}
function visibleRemoteNext(state,display){
 if(state.bridge||display.cues.some(cue=>cue.id===state.next))return state.next;
 const time=Number(state.time)||0;
 if(!state.manual)return display.cues.find(cue=>cue.time>time+.0001)?.id;
 const active=(state.cues||[]).find(cue=>cue.id===state.active);
 const parent=active?.child?active.parentCueId:active?.id;
 const child=parent&&state.next&&display.cues.find(cue=>cue.child&&cue.parentCueId===parent&&cue.time>time+.0001);
 if(child)return child.id;
 const cues=state.cues||[],queued=cues.findIndex(cue=>cue.id===(state.queued||state.waiting));
 if(queued<0)return;
 const visible=new Set(display.cues.map(cue=>cue.id));
 return cues.slice(queued).find(cue=>!cue.child&&cue.id!==state.active&&visible.has(cue.id))?.id;
}
function updateRemoteNextCue(upcoming,transition,remaining,running){
 const summary=$('remoteNextCue'),name=$('remoteNextCueName'),timer=$('remoteAutoCountdown');
 const label=upcoming?.name||'',automatic=!!transition,hidden=!label&&!automatic;
 if(summary.hidden!==hidden||name.textContent!==label||timer.hidden===automatic){
  summary.hidden=hidden;name.textContent=label;name.hidden=!label;
  summary.classList.toggle('hasAutoTransition',automatic);
  $('remoteNextCueLabel').textContent=automatic?'Enchaînement':'Suivante';
  timer.hidden=!automatic;
  updateStickyDeckHeight();
 }
 if(automatic){
  const value=clock(remaining);
  if(timer.textContent!==value)timer.textContent=value;
  pulse(timer,running&&remaining<=10.0001,remaining);
 }
}
function remoteCueGroups(state){
 if(!state.cueGroups?.length)return ()=>null;
 const groups=new Map((state.cueGroups||[]).map(group=>[group.id,group]));
 const byId=new Map((state.cues||[]).map(cue=>[cue.id,cue]));
 return id=>{
  const cue=byId.get(id),root=cue?.child?byId.get(cue.parentCueId):cue;
  return groups.get(root?.groupId)||null;
 };
}
function renderRemoteGroup(group,folded,forced){
 const section=document.createElement('section'),toggle=document.createElement('button');
 section.className='remoteCueGroup';section.style.setProperty('--remote-group-color',group.color);
 toggle.type='button';toggle.className='remoteCueGroupFold';toggle.disabled=forced;
 toggle.setAttribute('aria-expanded',String(!folded));
 const icon=document.createElement('span');icon.textContent=folded?'▸':'▾';icon.setAttribute('aria-hidden','true');
 const title=document.createElement('strong');title.textContent=group.name;
 toggle.append(icon,title);section.append(toggle);
 toggle.onclick=()=>{
  remoteGroupFolds.set(group.id,!folded);signature='';paint();
  Array.from($('rows').querySelectorAll('.remoteCueGroupFold')).find(button=>button.dataset.groupId===group.id)?.focus({preventScroll:true});
 };
 toggle.dataset.groupId=group.id;
 const body=document.createElement('div');body.className='remoteGroupCues';body.hidden=folded;
 section.append(body);$('rows').append(section);
 return body;
}
function renderRows(state,display,next,automatic,groupFor){
 const key=JSON.stringify([state.manual,state.active,state.next,next,automatic,state.waiting,state.cueGroups,display.cues,remoteCueTypeSignature,display.filtered?Array.from(cueTypeSelection):null,state.images,state.bridge,state.current,state.bridge&&!state.current?(state.preview||state.selected):null,isRemote(),isRemote()?state.remoteArmed:null]);if(key===signature)return;signature=key;
 const rows=$('rows'),activeId=highlightedCueId(state),previousScroll=rows.scrollTop;rows.replaceChildren();
 let children=null,previousGroup=null,container=rows;
 const activeGroup=groupFor(state.active),nextGroup=groupFor(next),preparedGroup=isRemote()?groupFor(state.remoteArmed):null;
 if(display.filtered&&!display.cues.length){
  const empty=document.createElement('p');empty.className='remoteCueTypeEmpty';empty.textContent='Aucune Cue pour ces types.';$('rows').append(empty);
 }
 for(const cue of display.cues){
  const group=groupFor(cue.id);
  if(group!==previousGroup){
   const forced=!!group&&(group===activeGroup||group===nextGroup||group===preparedGroup);
   const folded=!!group&&!forced&&(remoteGroupFolds.get(group.id)??group.folded);
   container=group?renderRemoteGroup(group,folded,forced):rows;
   previousGroup=group;children=null;
  }
  if(container.hidden)continue;
  const row=document.createElement('article');row.className='showOverviewRow';row.dataset.id=cue.id;if((state.manual||state.bridge)&&cue.child)row.classList.add('child');else if(state.manual||state.bridge)row.classList.add('principal');row.classList.toggle('active',cue.id===activeId);row.classList.toggle('next',cue.id===next&&cue.id!==state.active);
  if(isRemote()&&(!state.bridge||!cue.child)){
   row.classList.add('remoteSelectable');row.setAttribute('role','button');
   const disabled=!remoteAvailability||!!pendingRemote||remoteBusy;
   row.tabIndex=disabled?-1:0;row.setAttribute('aria-disabled',String(disabled));
   row.classList.toggle('isPrepared',cue.id===state.remoteArmed);
   row.setAttribute('aria-pressed',String(cue.id===state.remoteArmed));
   row.setAttribute('aria-label','Préparer '+[cue.number,cue.name].filter(Boolean).join(' · '));
  }
  row.classList.toggle('cueTypeContext',display.filtered&&!display.matches.has(cue.id));
  row.classList.toggle('isActive',row.classList.contains('active'));
  row.classList.toggle('isNext',row.classList.contains('next'));
  const label=document.createElement('span');label.className='overviewNumber';label.textContent=cue.number;
  if(state.bridge&&cue.running){const play=document.createElement('span');play.className='bridgePlay';play.textContent='▶ ';play.setAttribute('aria-label','En lecture');label.prepend(play);}
  const visual=document.createElement('div');visual.className='overviewVisual';
  const imageSource=cue.image||(state.images||{})[cue.imageKey];
  if(imageSource){const image=document.createElement('img');image.src=imageSource;image.alt='';visual.append(image);}
  else {visual.classList.add('showOverviewPlaceholder');if(row.classList.contains('active')||row.classList.contains('next'))visual.textContent='Pas de visuel';}
  const time=document.createElement('span');time.className='overviewTime';
  time.textContent=cue.child?'+'+clock(cue.time):state.manual?'GO':state.bridge?'':clock(cue.time);
  const details=document.createElement('div');details.className='overviewContent';
  const h=document.createElement('h2');h.className='overviewName';h.textContent=cue.name;
  const badges=remoteCueIds(cue,display.types).map(id=>remoteCueTypeBadge(display.types.get(id)));
  if(badges.length){
   const group=document.createElement('span');group.className='remoteCueTypeBadges';group.append(...badges);h.prepend(group,' ');
  }
  const desc=document.createElement('p');desc.className='overviewDescription';desc.textContent=remoteCueDescription(cue,display);
  if(isRemote()&&cue.id===state.remoteArmed){
   const prepared=document.createElement('span');prepared.className='remotePreparedBadge';prepared.textContent='Prête pour GO';details.append(prepared);
  }
  details.append(h,desc);row.append(label,visual,time,details);
  if(!state.bridge&&row.classList.contains('active')){
   const progress=document.createElement('span');progress.className='remoteLiveCueProgress';progress.setAttribute('aria-hidden','true');row.append(progress);
  }
  if(!automatic&&cue.id===state.next){const box=document.createElement('div');box.className='showNextCountdown';box.setAttribute('role','timer');box.setAttribute('aria-label','Décompte');const label=document.createElement('span');label.className='showCountdownLabel';label.textContent='Décompte';const time=document.createElement('time');time.className='showCountdownClock';box.append(label,time);row.append(box);}
  if(cue.id===state.waiting){
   const waiting=document.createElement('span');waiting.className='remoteWaitingGo';waiting.textContent='Prochain GO';
   h.prepend(waiting);
  }
  if((state.manual||state.bridge)&&cue.child){if(!children){children=document.createElement('div');children.className='cueChildren';container.append(children);}children.append(row);}else{children=null;container.append(row);}
 }
 updateStickyDeckHeight();
 rows.scrollTop=previousScroll;
}
function updateRemoteCueProgress(state,source,position){
 if(state.bridge)return;
 const row=$('rows').querySelector('.active'),cues=state.cues||[];
 const cue=cues.find(item=>item.id===state.active);
 if(!row||!cue||row.dataset.id!==cue.id)return;
 const next=cues.find(item=>item.id===state.next);
 const end=state.active===source.active&&Number.isFinite(source.activeEnd)?source.activeEnd:next?.time??(state.manual?source.offlineStop:state.duration);
 const progress=end>cue.time?Math.max(0,Math.min(1,(position-cue.time)/(end-cue.time))):0;
 row.style.setProperty('--remote-cue-progress',String(progress));
}
function topFeedback(message){$('backstageFeedback').textContent=message;}
function orderBridgeTops(tops,roots){
 const order=new Map(roots.map((cue,index)=>[cue.id,index]));
 return [...tops].sort((a,b)=>(order.get(a.cueID)??roots.length)-(order.get(b.cueID)??roots.length)||a.time-b.time);
}
function renderTopList(tops,roots=[]){
 if(dragTop||dragSaving)return;
 const key=JSON.stringify([tops,roots.map(c=>[c.id,c.number,c.name])]);if(key===topsSignature)return;topsSignature=key;$('topList').replaceChildren();
 tops.forEach((top,i)=>{const row=document.createElement('article');row.className='backstageTopRow';row.dataset.topId=top.id;
 const button=document.createElement('button');button.type='button';button.className='topCard';button.setAttribute('aria-label','Modifier le Top '+(i+1)+' — '+top.text);
 const label=document.createElement('small');label.textContent='TOP '+(i+1);
 if(top.cueID){const cue=roots.find(c=>c.id===top.cueID);label.textContent+=' · '+(cue?[cue.number,cue.name].filter(Boolean).join(' '):'Cue QLab indisponible');}const time=document.createElement('span');time.className='topCardTime';time.textContent=clock(Number(top.time));
 const text=document.createElement('h2');text.textContent=top.text;button.append(label,time,text);button.onclick=()=>openTop(top);row.append(button);$('topList').append(row);});
}
function attachTopDrag(marker,top,duration){
 marker.onpointerdown=event=>{
  if(event.button!==0||event.isPrimary===false||dragTop||dragSaving||terminal)return;
  event.preventDefault();event.stopPropagation();
  dragTop={marker,top:{...top},pointer:event.pointerId,startX:event.clientX,scroll:$('remoteTimelineViewport').scrollLeft,duration,time:Number(top.time),moved:false};
  marker.setPointerCapture(event.pointerId);marker.classList.add('dragging');topFeedback('');
 };
 marker.onpointermove=event=>{
  const drag=dragTop;if(!drag||drag.marker!==marker||event.pointerId!==drag.pointer)return;
  event.preventDefault();event.stopPropagation();const dx=event.clientX-drag.startX;if(!drag.moved&&Math.abs(dx)<6)return;drag.moved=true;
  const viewport=$('remoteTimelineViewport'),bounds=viewport.getBoundingClientRect();
  if(event.clientX>bounds.right-24)viewport.scrollLeft+=12;else if(event.clientX<bounds.left+24)viewport.scrollLeft-=12;
  const scale=drag.duration/Math.max(1,$('remoteTimeline').clientWidth);
  drag.time=Math.round(Math.max(0,Math.min(drag.duration,Number(drag.top.time)+(dx+viewport.scrollLeft-drag.scroll)*scale))*10)/10;
  placeTopMarker(marker,drag.time/drag.duration*$('remoteTimeline').clientWidth);
 };
 const end=async(event,cancelled=false)=>{
  const drag=dragTop;if(!drag||drag.marker!==marker||event.pointerId!==drag.pointer)return;
  event.preventDefault();event.stopPropagation();dragTop=null;marker.classList.remove('dragging');
  if(marker.hasPointerCapture(event.pointerId))marker.releasePointerCapture(event.pointerId);
  if(cancelled){timelineSignature='';paint();return;}
  if(!drag.moved){openTop(top);return;}
  if(drag.time===Number(top.time)){timelineSignature='';paint();return;}
  dragSaving=true;
  try{
   await api('update_top',viewer.token,{top:top.id,revision:Number(drag.top.revision),time:drag.time,text:drag.top.text,...(top.cueID?{cueID:top.cueID}:{})});
   if(latest?.tops)latest.tops=latest.tops.map(t=>t.id===top.id?{...t,time:drag.time,revision:Number(drag.top.revision)+1}:t);
  }catch(error){topFeedback('Déplacement non confirmé : '+error.message);}
  finally{dragSaving=false;timelineSignature='';topsSignature='';paint();refresh();}
 };
 marker.onpointerup=event=>end(event);marker.onpointercancel=event=>end(event,true);marker.onlostpointercapture=event=>{if(dragTop?.marker===marker)end(event,true);};
 marker.onclick=event=>{event.stopPropagation();if(event.detail===0&&!dragSaving)openTop(top);};
}
const TIMELINE_WINDOW_SECONDS=8*60;
function renderTimeline(cues,duration,backstage,tops,state,types){
 if(dragTop||dragSaving)return;
 const key=JSON.stringify([state.current,state.manual,state.bridge,duration,backstage,remoteCueTypeSignature,cues.map(c=>[c.id,c.number,c.time,c.child,c.goColor,c.cueTypeId,c.cueTypeIds]),tops]);
 if(key===timelineSignature)return;timelineSignature=key;lastTopLayout='';$('remoteTransport').classList.toggle('backstageTimeline',backstage);
 const timeline=$('remoteTimeline');timeline.dataset.duration=String(duration);timeline.style.width=Math.max(100,duration/TIMELINE_WINDOW_SECONDS*100)+'%';$('remoteMarkers').replaceChildren();
 for(const cue of cues){
  const marker=document.createElement('span'),main=(state.manual||state.bridge)&&!cue.child;
  marker.className='remoteCueMarker'+(main?' principal':' child');
  marker.style.left=Math.min(100,cue.time/duration*100)+'%';marker.title='Cue '+cue.number+' — '+cue.name;
  if(!state.bridge){
   if(main)marker.style.backgroundColor=/^#[0-9a-f]{6}$/i.test(cue.goColor)?cue.goColor:'#ffd166';
   else{
    const colors=remoteCueIds(cue,types).map(id=>types.get(id).color).filter(color=>/^#[0-9a-f]{6}$/i.test(color));
    marker.style.backgroundColor=colors[0]||'#fff';
    if(colors.length>1)marker.style.backgroundImage='conic-gradient('+colors.map((color,i)=>color+' '+i/colors.length*100+'% '+(i+1)/colors.length*100+'%').join(',')+')';
   }
  }
  $('remoteMarkers').append(marker);
 }
 for(let i=0;i<tops.length;i++){
  const top=tops[i],marker=document.createElement('button');marker.type='button';marker.className='backstageTop';marker.hidden=true;marker.dataset.topId=top.id;marker.title=clock(Number(top.time))+' — '+top.text;
  const text=document.createElement('span');text.textContent=top.text;marker.append(text);marker.setAttribute('aria-label','Top '+clock(Number(top.time))+' — '+top.text);attachTopDrag(marker,top,duration);$('remoteMarkers').append(marker);
 }

}
let lastTopLayout='';
function placeTopMarker(marker,x){
 const viewport=$('remoteTimelineViewport'),width=marker.offsetWidth;
 const left=Math.max(viewport.scrollLeft,Math.min(x-width/2,viewport.scrollLeft+viewport.clientWidth-width));
 marker.style.left=left+'px';
 marker.style.setProperty('--top-pointer',(x-left)+'px');
 return [left,left+width];
}
function layoutTopMarkers(tops,active,next,duration){
 if(dragTop||dragSaving)return;
 const viewport=$('remoteTimelineViewport'),width=$('remoteTimeline').clientWidth;
 const key=JSON.stringify([viewport.scrollLeft,viewport.clientWidth,width,active?.id,next?.id]);
 if(key===lastTopLayout)return;
 lastTopLayout=key;
 const markers=Array.from($('remoteMarkers').querySelectorAll('.backstageTop'));
 const firstUpcoming=next?tops.indexOf(next):tops.length;
 const ordered=[...tops.slice(firstUpcoming),...tops.slice(0,firstUpcoming).reverse()];
 const occupied=[];
 for(const top of ordered){
  const marker=markers[tops.indexOf(top)],x=Number(top.time)/duration*width;
  marker.classList.toggle('passed',tops.indexOf(top)<firstUpcoming);
  marker.hidden=x<viewport.scrollLeft||x>viewport.scrollLeft+viewport.clientWidth;
  if(marker.hidden)continue;
  const [left,right]=placeTopMarker(marker,x);
  marker.hidden=occupied.some(([start,end])=>left<end+6&&right>start-6);
  if(!marker.hidden)occupied.push([left,right]);
 }
}
// Continue the last received Show locally; a new snapshot always takes precedence.
function displayState(source,position){
 const state={...source},cues=source.cues||[];
 const current=cues.find(cue=>cue.id===source.active);
 const parent=current?.child?current.parentCueId:current?.id;
 const eligible=c=>!source.manual||(parent?(c.id===parent||c.parentCueId===parent):c.id===source.active);
 const candidates=cues.filter(c=>eligible(c)&&Number(c.time)<=position+.0001);
 if(candidates.length)state.active=candidates[candidates.length-1].id;
 const next=cues.find(c=>eligible(c)&&Number(c.time)>position+.0001&&(!source.manual||c.child));
 state.next=next?.id||'';
 return state;
}
function bridgeDisplayState(source,position){
 if(!source.current||source.sourceLost)return source;
 const children=(source.cues||[]).filter(c=>c.child&&c.parentCueId===source.current&&Number.isFinite(Number(c.time)));
 if(!children.length)return source;
 const active=children.filter(c=>Number(c.time)<=position+.0001).sort((a,b)=>Number(a.time)-Number(b.time)).at(-1);
 const next=children.filter(c=>Number(c.time)>position+.0001).sort((a,b)=>Number(a.time)-Number(b.time))[0];
 return {...source,active:active?.id||source.current,next:source.playing?(next?.id||''):''};
}
function paint(){
 if(!latest)return;
 const age=(latest.age||0)+(performance.now()-received)/1000,stale=connectionLost||age>8,source=latest.state||{},usable=source.show===true||isRemote(),backstage=isBackstage();
 paintRemote(source,stale);
 const compact=compactPreference??(source.compact===true);
 compactToggle.hidden=!usable||backstage;
 const layoutChanged=document.body.classList.toggle('isCompactCopilot',compact)!==(compactToggle.getAttribute('aria-pressed')==='true');
 if(layoutChanged)compactToggle.setAttribute('aria-pressed',String(compact));
 $('show').hidden=!usable&&!backstage;$('title').hidden=!usable&&!backstage;$('remoteTransport').hidden=!usable&&!backstage;
 if(!usable){$('remoteNextCue').hidden=true;$('remoteActiveGroup').hidden=true;}
 connection(stale?(navigator.onLine===false||!pollBusy?'disconnected':'reconnecting'):'connected');
 $('status').hidden=usable&&!(source.bridge&&(source.sourceLost||stale));
 if(source.bridge&&(source.sourceLost||stale))status(source.sourceLost?'Synchronisation QLab interrompue.':'Synchronisation Bridge interrompue.',true);
 else if(stale&&!usable)status('Conduite indisponible pour le moment.',true);
 else if(!usable)status('En attente de l’affichage Show de Pilot.',true);
 else status('Connecté · '+(isRemote()?'Télécommande':backstage?'Backstage':'Régie'));
 updateRemoteCueTypes(source,usable);
 if(!usable&&!backstage)return;
 $('backstageTools').hidden=!backstage;$('backstage').hidden=!backstage;$('rows').hidden=backstage;$('title').textContent=source.title||'Show';
 const extrapolating=usable&&!(source.bridge&&stale)&&source.playing&&!source.fading&&!source.resumeWait;
 let position=Math.max(0,(Number(source.time)||0)+(extrapolating?age:0));
 const ceiling=source.manual?(Number.isFinite(source.offlineStop)?source.offlineStop:Number(source.time)||0):Number(source.duration);
 if(Number.isFinite(ceiling)&&ceiling>=(Number(source.time)||0))position=Math.min(position,ceiling);
 const atBoundary=extrapolating&&position>=ceiling;
 const running=extrapolating&&!atBoundary;
 const state=source.bridge&&!stale?bridgeDisplayState(source,position):stale&&!source.bridge&&extrapolating?displayState(source,position):source;lastPosition=position;
 $('transport').textContent=atBoundary?(source.manual?'En attente du GO — confirmation de Pilot nécessaire':'Fin de conduite'):state.resumeWait?'En attente du GO — reprendre la bande-son':state.fading?'Fondu en cours…':running?(stale?'Lecture estimée · hors ligne':'En lecture'):state.waiting?'En attente du GO':'En pause';
 const cues=state.cues||[],roots=state.bridge?cues.filter(c=>!c.child):[];
 const sharedTops=backstage?(latest.tops||[]):[];
 const allTops=state.bridge?orderBridgeTops(sharedTops,roots):sharedTops;
 const tops=state.bridge?allTops.filter(top=>top.cueID===state.current&&state.current):allTops;
 const display=remoteCueDisplay(cues),groupFor=remoteCueGroups(state);
 const currentGroup=usable?groupFor(state.active):null,groupLabel=$('remoteActiveGroup');
 if(groupLabel.hidden===!!currentGroup||groupLabel.textContent!==(currentGroup?.name||'')){
  groupLabel.hidden=!currentGroup;groupLabel.textContent=currentGroup?.name||'';updateStickyDeckHeight();
 }
 if(currentGroup)groupLabel.style.setProperty('--remote-group-color',currentGroup.color);
 const transition=usable&&!state.bridge&&state.manual&&!state.resumeWait&&!state.fading&&Number.isFinite(state.autoTransition?.time)?state.autoTransition:null;
 const upcoming=display.cues.find(cue=>cue.id===transition?.id&&!cue.child);
 const nextCue=upcoming?.id||visibleRemoteNext(state,display);
 const nextSummary=transition?upcoming:backstage?null:display.cues.find(cue=>cue.id===nextCue&&cue.id!==state.active);
 const remaining=transition?Math.max(0,transition.time-(transition.running?position:Number(source.time)||0)):Infinity;
 updateRemoteNextCue(nextSummary,transition,remaining,running&&transition?.running);
 const timelineCues=state.bridge?cues.filter(c=>c.child):display.cues;
 const durationCues=state.bridge?timelineCues:cues;
 const currentCue=roots.find(c=>c.id===(state.current||state.preview||state.selected));
 if(state.bridge)$('transport').textContent=currentCue?[currentCue.number,currentCue.name,...(!state.current?[pinText('En attente du GO')]:[])].filter(Boolean).join(' · '):'En attente du GO';
 $('addTop').disabled=!!state.bridge&&!roots.length;
 if(backstage){$('noTops').hidden=allTops.length>0;renderTopList(allTops,roots);}
 const countdown=$('backstageCountdown');
 countdown.hidden=!backstage;
 const duration=Math.max(1,Number(state.duration)||0,...durationCues.map(c=>Number(c.time)||0),...tops.map(t=>Number(t.time)||0));
 $('remoteTime').textContent=clock(Math.floor(position))+' / '+clock(duration);
 if(isRemote()){
  $('phoneTimeToggle').textContent=(phoneTimeRemaining?'-':'')+clock(phoneTimeRemaining?Math.max(0,duration-position):Math.floor(position));
  $('phoneTimeToggle').setAttribute('aria-label',phoneTimeRemaining?'Temps restant. Afficher le temps écoulé.':'Temps écoulé. Afficher le temps restant.');
 }
 renderTimeline(timelineCues,duration,backstage,tops,state,display.types);
 const percent=Math.min(100,position/duration*100);$('remoteLiveHead').style.left=percent+'%';$('remoteProgress').style.width=percent+'%';$('remoteTimeline').dataset.position=String(position);
 let activeTopForLayout,nextTopForLayout;
 if(backstage){
  const next=tops.find(top=>Number(top.time)>position+.0001);
  const active=tops.filter(top=>Number(top.time)<=position+.0001).at(-1);
  activeTopForLayout=active;nextTopForLayout=next;
  const remaining=next?Math.max(0,Number(next.time)-position):Infinity;
  countdown.hidden=!next||!usable||(state.bridge&&(stale||state.sourceLost));
  if(next)countdown.textContent=clock(remaining);
  pulse(countdown,!!next&&running&&remaining<=10,remaining);
  for(const row of $('topList').querySelectorAll('.backstageTopRow')){
   const selected=next?.id===row.dataset.topId,current=active?.id===row.dataset.topId;
   row.classList.toggle('next',selected);
   row.classList.toggle('active',current);
   row.classList.toggle('passed',!current&&Number(tops.find(top=>top.id===row.dataset.topId)?.time)<=position);
   pulse(row,selected&&running&&remaining<=10,remaining);
  }
  const activeTop=active?.id??null;
  if(activeTop!==lastActiveTop&&!dragTop&&!dragSaving&&!$('topDialog').open){
   lastActiveTop=activeTop;
   updateStickyDeckHeight();
   if(activeTop)centerCues(true);
  }

 }else{
  renderRows(state,display,nextCue,!!transition,groupFor);followCueChange(state);updateRemoteCueProgress(state,source,position);const next=cues.find(c=>c.id===state.next),el=$('rows').querySelector('.showCountdownClock');
  if(el&&next){const remaining=Math.max(0,next.time-position);el.textContent=state.bridge&&stale?'—':clock(remaining);el.dataset.remaining=String(remaining);pulse(el.closest('article'),running&&remaining<=10.0001,remaining);}
 }
 if(running&&!$('topDialog').open&&!dragTop&&!dragSaving){const viewport=$('remoteTimelineViewport'),x=position/duration*$('remoteTimeline').clientWidth;if(x<viewport.scrollLeft+20||x>viewport.scrollLeft+viewport.clientWidth-20)viewport.scrollLeft=Math.max(0,x-viewport.clientWidth/3);}
 if(backstage)layoutTopMarkers(tops,activeTopForLayout,nextTopForLayout,duration);
}
async function poll(){
 if(terminal||!viewer||pollBusy)return;pollBusy=true;if(connectionLost)connection(navigator.onLine===false?'disconnected':'reconnecting');let failed=false;
 try{const started=performance.now(),data=await api('read',viewer.token,{});rememberViewer(data.expires);diagnostics.received++;diagnostics.lastRoundTripMs=Math.round(performance.now()-started);diagnostics.lastSnapshotAge=Math.max(0,Number(data.age)||0);if(connectionLost)diagnostic('reconnected',{roundTripMs:diagnostics.lastRoundTripMs});data.age=diagnostics.lastSnapshotAge+(performance.now()-started)/2000;latest=data;received=performance.now();connectionLost=false;failures=0;paint();}
 catch(e){failed=true;diagnostics.failures++;diagnostic(e.name==='AbortError'?'timeout':e.status?'http_error':'network_error',{status:e.status||0,securityRule:e.securityRule||'',requestId:e.requestId||''});if(e.relayConfirmed&&(e.status===403||e.status===410)){forgetViewer();terminal=true;latest=null;connectionLost=false;connection('disconnected');$('status').hidden=false;$('show').hidden=true;$('title').hidden=true;$('remoteTransport').hidden=true;$('remoteNextCue').hidden=true;$('remoteActiveGroup').hidden=true;$('backstageCountdown').hidden=true;$('backstageTools').hidden=true;$('topDialog').close();if(isRemote()){paintRemote({},true);remoteFeedback(e.message,true);}status(e.message,true);}else{connectionLost=true;failures++;connection('disconnected');if(latest)paint();else status('Connexion interrompue — reconnexion automatique…',true);}}
 finally{pollBusy=false;if(!terminal)pollTimer=setTimeout(poll,failed?Math.min(4000,750*2**Math.min(3,failures-1)):document.hidden?1000:isRemote()?250:500);}
}
function refresh(){clearTimeout(pollTimer);poll();}
window.addEventListener('online',refresh);
window.addEventListener('offline',()=>{connectionLost=true;connection('disconnected');if(latest)paint();});
function openTop(top=null,time=lastPosition){
 if(!isBackstage()||terminal)return;
 const state=latest?.state||{},select=$('topCue'),bridge=!!state.bridge;
 editingTop=top?{...top}:null;
 $('topCueField').hidden=!bridge;
 select.required=bridge;
 select.replaceChildren();
 if(bridge){
  const roots=(state.cues||[]).filter(c=>!c.child);
  for(const cue of roots)select.add(new Option([cue.number,cue.name].filter(Boolean).join(' · '),cue.id));
  const target=top?.cueID||state.current||state.selected;
  if(top?.cueID&&!roots.some(c=>c.id===target))select.add(new Option('Cue QLab indisponible',target));
  if(Array.from(select.options).some(option=>option.value===target))select.value=target;
  if(!top&&(!state.current||select.value!==state.current))time=0;
  if(!top&&!roots.find(c=>c.id===select.value)?.duration)time=0;
 }
 $('topDialogTitle').textContent=top?'Modifier le Top partagé':'Ajouter un Top partagé';
 $('topTime').value=topClock(top?Number(top.time):time);
 $('topText').value=top?top.text:'';
 $('deleteTop').hidden=!top;
 $('topError').textContent='';
 $('topDialog').showModal();
 $('topText').focus();
}
let topBackdropDown=false;
const topDialog=$('topDialog');
function outsideTopDialog(event){
 const r=topDialog.getBoundingClientRect();
 return event.target===topDialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);
}
topDialog.addEventListener('pointerdown',event=>{topBackdropDown=outsideTopDialog(event);});
topDialog.addEventListener('pointercancel',()=>{topBackdropDown=false;});
topDialog.addEventListener('click',event=>{if(topBackdropDown&&outsideTopDialog(event))topDialog.close();topBackdropDown=false;});
$('topCue').onchange=()=>{$('topTime').value=topClock(0);};

$('addTop').onclick=()=>openTop();$('cancelTop').onclick=()=>$('topDialog').close();
$('remoteTimeline').addEventListener('click',event=>{if(!isBackstage()||event.target.closest('button'))return;const rect=$('remoteTimeline').getBoundingClientRect(),duration=Number($('remoteTimeline').dataset.duration)||1;openTop(null,Math.round(Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width))*duration*10)/10);});
$('topForm').addEventListener('submit',async event=>{
 event.preventDefault();const time=parseTime($('topTime').value),text=$('topText').value.trim();if(!Number.isFinite(time)||time<0||time>864000||!text){$('topError').textContent='Indiquez un temps (ex. 03:20) et une consigne.';return;}
 $('saveTop').disabled=true;$('deleteTop').disabled=true;
 try{await api(editingTop?'update_top':'add_top',viewer.token,{time,text,...(latest?.state?.bridge?{cueID:$('topCue').value}:{}),...(editingTop?{top:editingTop.id,revision:Number(editingTop.revision)}:{})});$('topDialog').close();refresh();}
 catch(e){$('topError').textContent=e.message;refresh();}
 finally{$('saveTop').disabled=false;$('deleteTop').disabled=false;}
});
$('deleteTop').onclick=async()=>{
 if(!editingTop||!confirm('Supprimer ce Top pour tous les écrans Backstage ?'))return;$('deleteTop').disabled=true;
 try{await api('delete_top',viewer.token,{top:editingTop.id,revision:Number(editingTop.revision)});$('topDialog').close();refresh();}catch(e){$('topError').textContent=e.message;refresh();}finally{$('deleteTop').disabled=false;}
};
function updateJoinPin(){
 const remote=$('join').querySelector('input[name=role]:checked').value==='remote';
 $('joinPinField').hidden=!remote;$('joinRemotePin').required=remote;
 if(!remote)$('joinRemotePin').value='';
}
$('join').addEventListener('change',updateJoinPin);updateJoinPin();
$('join').addEventListener('submit',async event=>{
 event.preventDefault();const button=$('join').querySelector('button');button.disabled=true;
 try{viewer=await api('join',invitation,{name:$('name').value.trim(),role:$('join').querySelector('input[name="role"]:checked').value,remotePin:$('joinRemotePin').value});try{sessionStorage.setItem(storageKey,JSON.stringify(viewer));}catch{}rememberViewer(viewer.expires);$('joinRemotePin').value='';$('join').hidden=true;document.body.classList.remove('isJoining');connection('connecting');poll();}catch(error){status(error.message,true);}finally{button.disabled=false;}
});
const deck=document.createElement('div');deck.id='stickyDeck';const main=document.querySelector('main');main.prepend(deck);deck.append(document.querySelector('header'),$('title'),$('copilotModeLabel'),$('phoneRemote'),$('remoteActiveGroup'),$('remoteTransport'),$('remoteNextCue'),$('remoteListTools'),$('backstageTools'));$('title').hidden=true;$('remoteTransport').hidden=true;
$('connectionIndicator').onclick=async()=>{const report=JSON.stringify(window.S2ACopilotDiagnostics(),null,2);try{await navigator.clipboard.writeText(report);$('connectionIndicator').title='Diagnostic copié';}catch{alert('Diagnostic : '+diagnostics.received+' réponses, '+diagnostics.failures+' erreurs. Dernier délai : '+diagnostics.lastRoundTripMs+' ms. Dernier âge Pilot : '+diagnostics.lastSnapshotAge.toFixed(1)+' s.');}};
if(!id||(!invitation&&!viewer))status('Lien incomplet. Scannez le QR code affiché dans Pilot.',true);else if(viewer){connection('connecting');poll();}else{connection('joining');document.body.classList.add('isJoining');$('join').hidden=false;status('Indiquez votre nom et votre rôle.');}
setInterval(paint,50);document.addEventListener('visibilitychange',()=>{if(!document.hidden){paint();refresh();}});
})();
