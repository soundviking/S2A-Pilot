/* Display-only transport. Backstage can edit shared Tops, never the Pilot Cues. */
(()=>{'use strict';
const $=id=>document.getElementById(id),args=new URLSearchParams(location.hash.slice(1)),id=args.get('s'),invite=args.get('i');
let viewer=null,latest=null,received=0,terminal=false,signature='',timelineSignature='',lastPosition=0,editingTop=null,pollBusy=false,pollTimer=null,connectionLost=false,failures=0;
const storageKey='s2a-copilot-view-'+id;
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
function status(text,bad=false){$('status').textContent=text;$('status').classList.toggle('offline',bad);}
function connection(mode){
 const indicator=$('connectionIndicator');indicator.className='connectionIndicator '+mode;
 $('connectionLabel').textContent=mode==='connected'?'Connecté':mode==='disconnected'?'Déconnecté':mode==='joining'?'À rejoindre':mode==='connecting'?'Connexion':'Reconnexion';
 indicator.title=mode==='connected'?'Synchronisé avec Pilot':mode==='disconnected'?'Connexion interrompue — conduite conservée, suivi local':'Tentative de reconnexion — conduite conservée, suivi local';
}
async function api(action,credential,body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch('api.php?action='+action,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Authorization':'Bearer '+credential},body:JSON.stringify({id,...body}),signal:controller.signal});
 let data;try{data=await response.json();}catch{const e=new Error('Le serveur ne renvoie pas la réponse Copilot attendue.');e.status=response.status;e.relayConfirmed=false;e.securityRule=(response.headers.get('blocked-by-security-rule')||'').slice(0,80);e.requestId=(response.headers.get('cf-ray')||'').slice(0,80);throw e;}if(!response.ok){const e=new Error(data.error||'Connexion interrompue.');e.status=response.status;e.relayConfirmed=typeof data.error==='string';throw e;}return data;}finally{clearTimeout(timer);}
}
function clock(t){t=Math.max(0,Math.ceil(t));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
function topClock(t){t=Math.max(0,Math.round(t*10)/10);return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0')+(t%1?'.'+Math.round(t*10)%10:'');}
function parseTime(text){const parts=text.trim().replace(',','.').split(':');if(parts.length===1&&/^\d+(\.\d+)?$/.test(parts[0]))return Number(parts[0]);if(parts.length===2&&/^\d+$/.test(parts[0])&&/^\d{1,2}(\.\d+)?$/.test(parts[1])&&Number(parts[1])<60)return Number(parts[0])*60+Number(parts[1]);return NaN;}
function isBackstage(){return (latest?.role||viewer?.role)==='backstage';}
function pulse(element,urgent,remaining){element.classList.toggle('urgent',urgent);const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;element.style.setProperty('--cue-beat',String(urgent?(reduced?1:.12+.88*(.5+.5*Math.cos(2*Math.PI*remaining))):0));}
let centerFrame=0,lastActiveCue=null,lastActiveTop=null,dragTop=null,dragSaving=false,topsSignature='';
function centerCues(backstage=false){
 cancelAnimationFrame(centerFrame);centerFrame=requestAnimationFrame(()=>{
  const list=$(backstage?'topList':'rows');
  const active=list.querySelector('.active');if(!active||backstage!==isBackstage()||$('show').hidden)return;
  const next=backstage?null:list.querySelector('.next'),top=$('stickyDeck').getBoundingClientRect().bottom+16,bottom=innerHeight-20,space=Math.max(0,bottom-top);
  const a=active.getBoundingClientRect(),n=next?.getBoundingClientRect();
  let end=n&&n.top>=a.top?n.bottom:a.bottom;
  if(end-a.top>space)end=a.bottom;
  const target=top+Math.max(0,(space-(end-a.top))/2);
  window.scrollTo({top:Math.max(0,scrollY+a.top-target),behavior:'instant'});
 });
}
function updateStickyDeckHeight(){
 document.documentElement.style.setProperty('--remote-transport-height',($('stickyDeck').offsetHeight+16)+'px');
}
window.addEventListener('resize',updateStickyDeckHeight);
function renderRows(state){
 const key=JSON.stringify([state.manual,state.active,state.next,state.waiting,state.cues,state.images,state.bridge,state.selected]);if(key===signature)return;signature=key;$('rows').replaceChildren();let children=null;
 for(const cue of state.cues||[]){
  const row=document.createElement('article');row.className='showOverviewRow';row.dataset.id=cue.id;if((state.manual||state.bridge)&&cue.child)row.classList.add('child');else if(state.manual||state.bridge)row.classList.add('principal');row.classList.toggle('active',cue.id===(state.bridge&&!cue.child?state.selected:state.active));row.classList.toggle('next',cue.id===state.next);
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
  const desc=document.createElement('p');desc.className='overviewDescription';desc.textContent=cue.description;
  details.append(h,desc);row.append(label,visual,time,details);
  if(cue.id===state.next){const box=document.createElement('div');box.className='showNextCountdown';box.setAttribute('role','timer');box.setAttribute('aria-label','Décompte');const label=document.createElement('span');label.className='showCountdownLabel';label.textContent='Décompte';const time=document.createElement('time');time.className='showCountdownClock';box.append(label,time);row.append(box);}
  if(cue.id===state.waiting){const waiting=document.createElement('p');waiting.textContent='Prochain GO';row.append(waiting);}if((state.manual||state.bridge)&&cue.child){if(!children){children=document.createElement('div');children.className='cueChildren';$('rows').append(children);}children.append(row);}else{children=null;$('rows').append(row);}
 }
 updateStickyDeckHeight();
 const activeCue=(state.bridge?state.selected||state.active:state.active)||null;
 if(activeCue!==lastActiveCue){
  lastActiveCue=activeCue;
  if(activeCue)centerCues();
 }
}
function topFeedback(message){$('backstageFeedback').textContent=message;}
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
function renderTimeline(cues,duration,backstage,tops,scope){
 if(dragTop||dragSaving)return;
 const key=JSON.stringify([scope,duration,backstage,cues.map(c=>[c.id,c.number,c.time,c.child]),tops]);
 if(key===timelineSignature)return;timelineSignature=key;lastTopLayout='';$('remoteTransport').classList.toggle('backstageTimeline',backstage);
 const timeline=$('remoteTimeline');timeline.dataset.duration=String(duration);timeline.style.width=Math.max(100,duration/TIMELINE_WINDOW_SECONDS*100)+'%';$('remoteMarkers').replaceChildren();
 for(const cue of cues){const marker=document.createElement('span');marker.className='remoteCueMarker'+(cue.child?' child':' principal');marker.style.left=Math.min(100,cue.time/duration*100)+'%';marker.title='Cue '+cue.number+' — '+cue.name;$('remoteMarkers').append(marker);}
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
 const candidates=cues.filter(c=>(!source.manual||c.child||c.id===source.active)&&Number(c.time)<=position+.0001);
 if(candidates.length)state.active=candidates[candidates.length-1].id;
 const next=cues.find(c=>Number(c.time)>position+.0001&&(!source.manual||c.child));
 state.next=next?.id||'';
 return state;
}
function paint(){
 if(!latest)return;
 const age=(latest.age||0)+(performance.now()-received)/1000,stale=connectionLost||age>8,source=latest.state||{},usable=source.show===true,backstage=isBackstage();
 $('show').hidden=!usable&&!backstage;$('title').hidden=!usable&&!backstage;$('remoteTransport').hidden=!usable&&!backstage;
 connection(stale?(navigator.onLine===false||!pollBusy?'disconnected':'reconnecting'):'connected');
 $('status').hidden=usable&&!(source.bridge&&(source.sourceLost||stale));
 if(source.bridge&&(source.sourceLost||stale))status(source.sourceLost?'Synchronisation QLab interrompue.':'Synchronisation Bridge interrompue.',true);
 else if(stale&&!usable)status('Conduite indisponible pour le moment.',true);
 else if(!usable)status('En attente de l’affichage Show de Pilot.',true);
 else status('Connecté · '+(backstage?'Backstage':'Régie'));
 if(!usable&&!backstage)return;
 $('backstageTools').hidden=!backstage;$('backstage').hidden=!backstage;$('rows').hidden=backstage;$('title').textContent=source.title||'Show';
 const extrapolating=usable&&!(source.bridge&&stale)&&source.playing&&!source.fading&&!source.resumeWait;
 let position=Math.max(0,(Number(source.time)||0)+(extrapolating?age:0));
 const ceiling=source.manual?(Number.isFinite(source.offlineStop)?source.offlineStop:Number(source.time)||0):Number(source.duration);
 if(Number.isFinite(ceiling)&&ceiling>=(Number(source.time)||0))position=Math.min(position,ceiling);
 const atBoundary=extrapolating&&position>=ceiling;
 const running=extrapolating&&!atBoundary;
 const state=stale&&!source.bridge?displayState(source,position):source;lastPosition=position;
 $('transport').textContent=atBoundary?(source.manual?'En attente du GO — confirmation de Pilot nécessaire':'Fin de conduite'):state.resumeWait?'En attente du GO — reprendre la bande-son':state.fading?'Fondu en cours…':running?(stale?'Lecture estimée · hors ligne':'En lecture'):state.waiting?'En attente du GO':'En pause';
 const cues=state.cues||[],roots=state.bridge?cues.filter(c=>!c.child):[];
 const allTops=backstage?(latest.tops||[]):[];
 const tops=state.bridge?allTops.filter(top=>top.cueID===state.current&&state.current):allTops;
 const timelineCues=state.bridge?cues.filter(c=>c.child):cues;
 const currentCue=roots.find(c=>c.id===state.current);
 if(state.bridge)$('transport').textContent=currentCue?[currentCue.number,currentCue.name].filter(Boolean).join(' · '):'En attente du GO';
 $('addTop').disabled=!!state.bridge&&!roots.length;
 if(backstage){$('noTops').hidden=allTops.length>0;renderTopList(allTops,roots);}
 const countdown=$('backstageCountdown');
 countdown.hidden=!backstage;
 const duration=Math.max(1,Number(state.duration)||0,...timelineCues.map(c=>Number(c.time)||0),...tops.map(t=>Number(t.time)||0));
 $('remoteTime').textContent=clock(Math.floor(position))+' / '+clock(duration);renderTimeline(timelineCues,duration,backstage,tops,state.current);
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
  renderRows(state);const next=cues.find(c=>c.id===state.next),el=$('rows').querySelector('.showCountdownClock');
  if(el&&next){const remaining=Math.max(0,next.time-position);el.textContent=state.bridge&&stale?'—':clock(remaining);el.dataset.remaining=String(remaining);pulse(el.closest('article'),running&&remaining<=10.0001,remaining);}
 }
 if(running&&!$('topDialog').open&&!dragTop&&!dragSaving){const viewport=$('remoteTimelineViewport'),x=position/duration*$('remoteTimeline').clientWidth;if(x<viewport.scrollLeft+20||x>viewport.scrollLeft+viewport.clientWidth-20)viewport.scrollLeft=Math.max(0,x-viewport.clientWidth/3);}
 if(backstage)layoutTopMarkers(tops,activeTopForLayout,nextTopForLayout,duration);
}
async function poll(){
 if(terminal||!viewer||pollBusy)return;pollBusy=true;if(connectionLost)connection(navigator.onLine===false?'disconnected':'reconnecting');let failed=false;
 try{const started=performance.now(),data=await api('read',viewer.token,{});rememberViewer(data.expires);diagnostics.received++;diagnostics.lastRoundTripMs=Math.round(performance.now()-started);diagnostics.lastSnapshotAge=Math.max(0,Number(data.age)||0);if(connectionLost)diagnostic('reconnected',{roundTripMs:diagnostics.lastRoundTripMs});data.age=diagnostics.lastSnapshotAge+(performance.now()-started)/2000;latest=data;received=performance.now();connectionLost=false;failures=0;paint();}
 catch(e){failed=true;diagnostics.failures++;diagnostic(e.name==='AbortError'?'timeout':e.status?'http_error':'network_error',{status:e.status||0,securityRule:e.securityRule||'',requestId:e.requestId||''});if(e.relayConfirmed&&(e.status===403||e.status===410)){forgetViewer();terminal=true;latest=null;connectionLost=false;connection('disconnected');$('status').hidden=false;$('show').hidden=true;$('title').hidden=true;$('remoteTransport').hidden=true;$('backstageCountdown').hidden=true;$('backstageTools').hidden=true;$('topDialog').close();status(e.message,true);}else{connectionLost=true;failures++;connection('disconnected');if(latest)paint();else status('Connexion interrompue — reconnexion automatique…',true);}}
 finally{pollBusy=false;if(!terminal)pollTimer=setTimeout(poll,failed?Math.min(4000,750*2**Math.min(3,failures-1)):document.hidden?1000:500);}
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
$('join').addEventListener('submit',async event=>{
 event.preventDefault();const button=$('join').querySelector('button');button.disabled=true;
 try{viewer=await api('join',invitation,{name:$('name').value.trim(),role:$('join').querySelector('input[name="role"]:checked').value});try{sessionStorage.setItem(storageKey,JSON.stringify(viewer));}catch{}rememberViewer(viewer.expires);$('join').hidden=true;document.body.classList.remove('isJoining');connection('connecting');poll();}catch(error){status(error.message,true);}finally{button.disabled=false;}
});
const deck=document.createElement('div');deck.id='stickyDeck';const main=document.querySelector('main');main.prepend(deck);deck.append(document.querySelector('header'),$('title'),$('remoteTransport'),$('backstageTools'));$('title').hidden=true;$('remoteTransport').hidden=true;
$('connectionIndicator').onclick=async()=>{const report=JSON.stringify(window.S2ACopilotDiagnostics(),null,2);try{await navigator.clipboard.writeText(report);$('connectionIndicator').title='Diagnostic copié';}catch{alert('Diagnostic : '+diagnostics.received+' réponses, '+diagnostics.failures+' erreurs. Dernier délai : '+diagnostics.lastRoundTripMs+' ms. Dernier âge Pilot : '+diagnostics.lastSnapshotAge.toFixed(1)+' s.');}};
if(!id||(!invitation&&!viewer))status('Lien incomplet. Scannez le QR code affiché dans Pilot.',true);else if(viewer){connection('connecting');poll();}else{connection('joining');document.body.classList.add('isJoining');$('join').hidden=false;status('Indiquez votre nom et votre rôle.');}
setInterval(paint,50);document.addEventListener('visibilitychange',()=>{if(!document.hidden){paint();refresh();}});
})();
