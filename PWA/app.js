const countdownMotionPreference=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
// Keep the public application address at its directory; manifest identity remains stable.
if(/^https?:$/.test(location.protocol)&&location.pathname.endsWith('/index.html')){const clean=new URL('./',location.href);clean.search=location.search;clean.hash=location.hash;history.replaceState(history.state,'',clean.href);}
const $=id=>document.getElementById(id);
const showTitle=$('showTitle'),openProjectBtn=$('openProjectBtn'),projectFile=$('projectFile'),saveAsBtn=$('saveAsBtn');
const editModeBtn=$('editModeBtn'),showModeBtn=$('showModeBtn');
const undoBtn=$('undoBtn'),redoBtn=$('redoBtn'),restartBtn=$('restartBtn'),playBtn=$('playBtn'),addCueBtn=$('addCueBtn'),pdfTechBtn=$('pdfTechBtn');
const clock=$('clock'),durationEl=$('duration'),timeline=$('timeline'),playhead=$('playhead'),progress=$('progress'),cueList=$('cueList'),cueCount=$('cueCount');
const preloadBin=$('preloadBin');
const videoOutputBtn=$('videoOutputBtn'),videoOutputState=$('videoOutputState');
const startupProjectInfo=$('startupProjectInfo'),newProjectBtn=$('newProjectBtn'),playBtnIcon=$('playBtnIcon'),playBtnLabel=$('playBtnLabel');

const DB_NAME='showcue-prep-v1', META_STORE='autosave', ASSET_STORE='assets', LEGACY_MEDIA_STORE='media', META_KEY='latest', DB_VERSION=3;
const DEFAULT_DURATION=300, HISTORY_LIMIT=100;
let cues=[],locked=false,transportTime=0,transportPlaying=false,transportEpoch=0,transportBase=0,lastTransportTime=0,rafId=0,transportCommandGeneration=0;
let undoStack=[],redoStack=[],autosaveTimer=null,workspaceCommitted=false,currentProjectName=null;
let runtimeAudio=new Map(),runtimeVideo=null,videoOutputWindow=null,assetUrlCache=new Map(),assetBlobCache=new Map();
let preparedMedia=new Map(),preflightState='idle',preflightErrors=[],expandedCueId=null,seekGeneration=0,preflightPromise=null;
let startupSaved=null,showDurationOverride=null;
const mediaVisualCache=new Map();
const generalTimelineViewport=$('generalTimelineViewport');let generalTimelineZoom=1;
let timelineMediaGeneration=0,timelineMediaSignature='',timelineMediaTimer=null;


function uuid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());}
function newBaseCue(){return{id:uuid(),time:0,name:'Cue 1',description:'',imageDataUrl:null,imageName:null,isBase:false,mediaActions:[]};}
function roundTenth(t){return Math.round((Number(t)||0)*10)/10;}
function fmt(t){let x=Math.max(0,roundTenth(Number.isFinite(t)?t:0)),tt=Math.round(x*10),m=Math.floor(tt/600);tt-=m*600;return `${String(m).padStart(2,'0')}:${String(Math.floor(tt/10)).padStart(2,'0')}.${tt%10}`;}
let timelineLabelSignature='';
function fmtDisplay(t,countdown=false){if(!locked)return fmt(t);const seconds=(countdown?Math.ceil:Math.floor)(Math.max(0,Number(t)||0));return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
function parseTime(value){
 if(typeof value!=='string')return null;
 const text=value.trim().replace(/,/g,'.');
 // Two digits after the separator mean minutes/seconds; a single decimal remains seconds/tenths.
 const parts=text.match(/^(\d+):([0-5]?\d)(?:\.(\d))?$/)||text.match(/^(\d+)\.([0-5]\d)(?:\.(\d))?$/);
 const seconds=parts?Number(parts[1])*60+Number(parts[2])+Number(parts[3]||0)/10:/^\d+(?:\.\d)?$/.test(text)?Number(text):NaN;
 return Number.isFinite(seconds)&&seconds<=Number.MAX_SAFE_INTEGER/10?roundTenth(seconds):null;
}
function safeFileName(name){return(name||'fichier').replace(/[\\/:*?"<>|]+/g,'-').trim()||'fichier';}
function clone(v){return JSON.parse(JSON.stringify(v));}
function normalizeMediaAction(a){
  if(a?.kind==='stopAll')return{id:a.id||uuid(),kind:'stopAll',name:tr('ARRÊT / FONDU TOUS LES MÉDIAS'),transition:a?.transition==='fade'?'fade':'cut',fadeDuration:Math.max(.1,Number(a?.fadeDuration)||3)};
  const kind=a?.kind==='video'?'video':'audio',duration=Math.max(0,Number(a?.duration)||0);
  const inPoint=Math.max(0,Math.min(duration||Infinity,Number(a?.inPoint)||0));
  let outPoint=Number(a?.outPoint);
  if(!Number.isFinite(outPoint)||outPoint<=inPoint)outPoint=duration||0;
  if(duration)outPoint=Math.min(duration,outPoint);
  return{id:a?.id||uuid(),kind,assetKey:a?.assetKey||null,name:a?.name||tr('Média'),mime:a?.mime||'application/octet-stream',size:Number(a?.size)||0,duration,transition:a?.transition==='fade'?'fade':'cut',fadeDuration:Math.max(.1,Number(a?.fadeDuration)||3),muted:a?.muted!==false,inPoint:roundTenth(inPoint),outPoint:roundTenth(outPoint),loop:!!a?.loop};
}
function mediaSegmentDuration(a){if(!a||a.kind==='stopAll')return 0;const end=(Number(a.outPoint)>Number(a.inPoint))?Number(a.outPoint):(Number(a.duration)||0);return Math.max(0,end-(Number(a.inPoint)||0));}
function mediaPositionAt(a,elapsed){const seg=mediaSegmentDuration(a),start=Number(a.inPoint)||0;if(seg<=0)return start;if(a.loop)return start+(((Math.max(0,elapsed)%seg)+seg)%seg);return Math.min(start+Math.max(0,elapsed),start+seg);}
function mediaIsActiveAt(a,elapsed){if(!a||a.kind==='stopAll'||elapsed<0)return false;const seg=mediaSegmentDuration(a);return !!a.loop ? seg>0 : elapsed<seg-.001;}
function lastStopActionBefore(t){let found=null;for(const c of orderedCues()){if(c.time>t+.0001)break;for(const a of(c.mediaActions||[]))if(a.kind==='stopAll')found={cue:c,action:a,start:c.time};}return found;}
function lastStopBefore(t){return lastStopActionBefore(t)?.start??-Infinity;}
function globalStopFadeAt(t){const s=lastStopActionBefore(t);if(!s||s.action.transition!=='fade')return null;const d=Math.max(.1,Number(s.action.fadeDuration)||3),elapsed=t-s.start;if(elapsed<0||elapsed>=d)return null;return{...s,duration:d,elapsed,factor:Math.max(0,1-elapsed/d)};}
function effectiveMediaEnd(item){const start=Number(item.start)||0,a=item.action,seg=mediaSegmentDuration(a);let end=a.loop?Infinity:start+seg;const ordered=[...cues].sort((x,y)=>(Number(x.time)||0)-(Number(y.time)||0));for(const c of ordered){const t=Number(c.time)||0;if(t<=start+.0001)continue;for(const later of(c.mediaActions||[])){if(later.kind==='stopAll'){const stopEnd=t+(later.transition==='fade'?Math.max(.1,Number(later.fadeDuration)||3):0);end=Math.min(end,stopEnd);continue;}if(a.kind==='audio'&&later.kind==='audio'){const replaceEnd=t+(later.transition==='fade'?Math.max(.1,Number(later.fadeDuration)||3):0);end=Math.min(end,replaceEnd);}else if(a.kind==='video'&&later.kind==='video'){end=Math.min(end,t);}}if(Number.isFinite(end)&&end<=t+.0001)break;}return Number.isFinite(end)?Math.max(start,end):null;}
function automaticProjectDuration(){let lastFinite=0;for(const c of cues)lastFinite=Math.max(lastFinite,Number(c.time)||0);for(const kind of['audio','video'])for(const item of allActions(kind)){const end=effectiveMediaEnd(item);if(Number.isFinite(end))lastFinite=Math.max(lastFinite,end);}return Math.max(10,lastFinite+10);}
let durationCache=null;
function projectDuration(){if(durationCache!==null)return durationCache;const minCue=cues.length?Math.max(...cues.map(c=>Number(c.time)||0))+.1:0;const auto=automaticProjectDuration();return durationCache=Math.max(minCue,Number.isFinite(showDurationOverride)?showDurationOverride:auto);}
function updateDurationEditor(){invalidateComputationCaches();}

function ensureBaseCueInvariant(){if(!Array.isArray(cues))cues=[];for(const c of cues){c.isBase=false;c.time=Math.max(0,roundTenth(c.time));c.description=c.description||'';c.mediaActions=(c.mediaActions||[]).map(a=>Object.assign(a,normalizeMediaAction(a)));}cues.sort((a,b)=>a.time-b.time);}
function normalizeCueOrderAndNames(){ensureBaseCueInvariant();cues.sort((a,b)=>a.time-b.time);cues.forEach((c,i)=>{if(!String(c.name||'').trim()||/^Cue \d+$/i.test(String(c.name).trim()))c.name=`Cue ${i+1}`;});}
function captureEditableState(){return{title:showTitle.value,cues:clone(cues),showDurationOverride};}
function updateHistoryButtons(){undoBtn.disabled=locked||!undoStack.length;redoBtn.disabled=locked||!redoStack.length;}
function pushHistory(s=captureEditableState()){undoStack.push(clone(s));if(undoStack.length>HISTORY_LIMIT)undoStack.shift();redoStack=[];updateHistoryButtons();}
function resetHistory(){undoStack=[];redoStack=[];updateHistoryButtons();}
function restoreEditableState(s){showTitle.value=s.title||'';cues=clone(s.cues||[]);showDurationOverride=Number.isFinite(s.showDurationOverride)?s.showDurationOverride:null;ensureBaseCueInvariant();invalidatePreflight();renderCues();updateShowPanels();updateDurationEditor();scheduleAutosave();}
function undoEdit(){if(locked||!undoStack.length)return;let cur=captureEditableState(),prev=undoStack.pop();redoStack.push(cur);restoreEditableState(prev);updateHistoryButtons();}
function redoEdit(){if(locked||!redoStack.length)return;let cur=captureEditableState(),next=redoStack.pop();undoStack.push(cur);restoreEditableState(next);updateHistoryButtons();}

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(META_STORE))db.createObjectStore(META_STORE);if(!db.objectStoreNames.contains(ASSET_STORE))db.createObjectStore(ASSET_STORE);if(!db.objectStoreNames.contains(LEGACY_MEDIA_STORE))db.createObjectStore(LEGACY_MEDIA_STORE);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function requestPersistentStorage(){try{if(navigator.storage?.persist)await navigator.storage.persist();}catch{}}
async function idbGet(store,key){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();});}
async function idbPut(store,key,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function idbDelete(store,key){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function storeAsset(file,key='asset:'+uuid()){await requestPersistentStorage();await idbPut(ASSET_STORE,key,{blob:file,name:file.name,mime:file.type||'application/octet-stream',size:file.size,lastModified:file.lastModified||0});assetBlobCache.set(key,file);return key;}
async function getAsset(key){if(!key)return null;if(assetBlobCache.has(key))return assetBlobCache.get(key);const rec=await idbGet(ASSET_STORE,key);const blob=rec?.blob||(rec?.buffer?new Blob([rec.buffer],{type:rec.mime||'application/octet-stream'}):null);if(!blob)return null;assetBlobCache.set(key,blob);return blob;}
async function assetUrl(key){if(assetUrlCache.has(key))return assetUrlCache.get(key);const blob=await getAsset(key);if(!blob)return null;const u=URL.createObjectURL(blob);assetUrlCache.set(key,u);return u;}

let sortedCueCache=null,actionIndexCache=null;
function orderedCues(){return sortedCueCache||(sortedCueCache=[...cues].sort((a,b)=>a.time-b.time));}
function invalidateComputationCaches(){durationCache=null;sortedCueCache=null;actionIndexCache=null;}
function indexedActions(kind){if(!actionIndexCache){actionIndexCache=new Map();for(const cue of orderedCues())for(const action of cue.mediaActions||[]){if(!actionIndexCache.has(action.kind))actionIndexCache.set(action.kind,[]);actionIndexCache.get(action.kind).push({cue,action,start:cue.time});}}return actionIndexCache.get(kind)||[];}
function allMediaActions(){const out=[];for(const c of orderedCues())for(const a of(c.mediaActions||[]))if(a.kind!=='stopAll')out.push({cue:c,action:a,start:c.time});return out;}
let mediaMaintenanceTimer=null;
function releasePrepared(p){try{p.el.pause();p.el.removeAttribute('src');p.el.load();p.el.remove();}catch{}}
function reconcilePreparedMedia(){const items=allMediaActions(),ids=new Map(items.map(i=>[i.action.id,i]));for(const [id,p] of preparedMedia){const item=ids.get(id);if(!item||item.action.assetKey!==p.item.action.assetKey){stopAudioRuntime(id);if(runtimeVideo?.item.action.id===id)stopVideoRuntime();releasePrepared(p);preparedMedia.delete(id);}else p.item=item;}
 const keys=new Set(items.map(i=>i.action.assetKey));for(const [key,url] of assetUrlCache)if(!keys.has(key)){URL.revokeObjectURL(url);assetUrlCache.delete(key);assetBlobCache.delete(key);}for(const id of mediaVisualCache.keys())if(!ids.has(id))mediaVisualCache.delete(id);for(const id of mediaPreviewPositions.keys())if(!ids.has(id))mediaPreviewPositions.delete(id);for(const id of mediaPreviewViews.keys())if(!ids.has(id))mediaPreviewViews.delete(id);
}
function invalidatePreflight(){invalidateComputationCaches();preflightState='idle';preflightErrors=[];reconcilePreparedMedia();scheduleMediaMaintenance();}
function updatePreflightUI(){for(const row of cueList.querySelectorAll('.cueAccordion')){const cue=cues.find(c=>c.id===row.dataset.cueId);if(!cue)continue;const state=cuePreparationClass(cue);for(const chip of row.querySelectorAll('.cueMediaChip:not(.stop)')){chip.classList.toggle('ready',state==='ready');chip.classList.toggle('error',state==='error');}}}
function scheduleMediaMaintenance(delay=200){clearTimeout(mediaMaintenanceTimer);if(document.hidden||!allMediaActions().length)return;mediaMaintenanceTimer=setTimeout(async()=>{try{reconcilePreparedMedia();for(const p of preparedMedia.values())if(p.el.error||p.el.readyState<2)p.ready=false;await prepareShowMedia();}catch(e){console.warn(e);}finally{scheduleMediaMaintenance(30000);}},delay);}
document.addEventListener('visibilitychange',()=>scheduleMediaMaintenance());
function waitMediaReady(el,kind,timeout=10000){return new Promise((resolve,reject)=>{let done=false;const finish=(ok,err)=>{if(done)return;done=true;clearTimeout(timer);el.removeEventListener('loadeddata',ready);el.removeEventListener('canplay',ready);el.removeEventListener('error',fail);ok?resolve():reject(err||new Error(tr('Média non décodable')));};const ready=()=>finish(true);const fail=()=>finish(false,new Error(tr('Média non décodable par ce navigateur')));const timer=setTimeout(()=>{if(el.readyState>=2)finish(true);else finish(false,new Error(tr('Délai de préchargement dépassé')));},timeout);el.addEventListener('loadeddata',ready,{once:true});el.addEventListener('canplay',ready,{once:true});el.addEventListener('error',fail,{once:true});if(el.readyState>=2)finish(true);else el.load();});}
async function prepareOneMedia(item){let existing=preparedMedia.get(item.action.id);if(existing?.ready)return existing;if(existing?.pending)return existing.pending;if(existing){releasePrepared(existing);preparedMedia.delete(item.action.id);}
const rec={item,el:document.createElement(item.action.kind==='video'?'video':'audio'),ready:false,error:null};preparedMedia.set(item.action.id,rec);
rec.pending=(async()=>{try{const url=await assetUrl(item.action.assetKey);if(preparedMedia.get(item.action.id)!==rec)throw new Error(tr('Préchargement annulé'));if(!url)throw new Error(`${tr("Média introuvable : ")}${item.action.name}`);rec.url=url;const el=rec.el;el.preload='auto';el.src=url;el.playsInline=true;el.controls=false;el.loop=false;if(item.action.kind==='video')el.muted=true;preloadBin.appendChild(el);el.addEventListener('ended',()=>handleRuntimeMediaEnded(item.action.id,item.action.kind));await waitMediaReady(el,item.action.kind);if(preparedMedia.get(item.action.id)!==rec){releasePrepared(rec);throw new Error(tr('Préchargement annulé'));}rec.ready=true;try{el.currentTime=Number(item.action.inPoint)||0;}catch{}return rec;}catch(e){rec.error=e;throw e;}finally{rec.pending=null;}})();return rec.pending;}
async function prepareShowMedia(){if(preflightPromise){await preflightPromise;return prepareShowMedia();}const items=allMediaActions();if(items.every(x=>preparedMedia.get(x.action.id)?.ready)){preflightState='ready';return true;}preflightState='preparing';preflightErrors=[];
preflightPromise=(async()=>{for(const item of items){if(!allMediaActions().some(x=>x.action.id===item.action.id))continue;try{await prepareOneMedia(item);}catch(error){preflightErrors.push({item,error});}}preflightState=preflightErrors.length?'error':'ready';updatePreflightUI();return preflightState==='ready';})();try{return await preflightPromise;}finally{preflightPromise=null;}}
function preparedRecord(item){const p=preparedMedia.get(item.action.id);return p?.ready?p:null;}

function projectMetadata(){return{format:'showcue-workspace',version:5,savedAt:Date.now(),title:showTitle.value.trim(),showDurationOverride:Number.isFinite(showDurationOverride)?roundTenth(showDurationOverride):null,cues:clone(cues)};}
let autosaveWrites=Promise.resolve();
function writeAutosave(){ensureBaseCueInvariant();const snapshot=projectMetadata();workspaceCommitted=true;autosaveWrites=autosaveWrites.catch(()=>{}).then(()=>idbPut(META_STORE,META_KEY,snapshot)).then(()=>{startupProjectInfo.textContent=tr('Sauvegarde locale automatique · ')+formatSavedAt(snapshot.savedAt);}).catch(e=>{startupProjectInfo.textContent=tr('Échec de la sauvegarde locale : ')+(e.message||e);throw e;});return autosaveWrites;}
function scheduleAutosave(){invalidateComputationCaches();scheduleTimelineMedia();scheduleMediaMaintenance();clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>writeAutosave().catch(console.warn),120);}
function flushAutosave(){clearTimeout(autosaveTimer);writeAutosave().catch(console.warn);}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushAutosave();});
window.addEventListener('pagehide',flushAutosave);
async function readAutosave(){
  const saved=await idbGet(META_STORE,META_KEY);
  if(!saved)return null;
  if(Number(saved.version)>=3)return saved;
  // Migration V1.1.x : le média global devient une action de la Cue de base.
  const migrated=clone(saved);migrated.version=3;migrated.format='showcue-workspace';
  migrated.cues=(migrated.cues||[]).map(c=>({...c,mediaActions:c.mediaActions||[]}));
  if(!migrated.cues.length)migrated.cues=[newBaseCue()];
  let base=migrated.cues.find(c=>c.isBase)||migrated.cues.find(c=>roundTenth(+c.time||0)===0)||migrated.cues[0];
  base.isBase=true;base.time=0;base.mediaActions=base.mediaActions||[];
  try{
    const legacyAudio=await idbGet(LEGACY_MEDIA_STORE,'audio');
    if(legacyAudio?.blob){
      const name=legacyAudio.name||saved.audioName||'audio',mime=legacyAudio.mime||saved.audioMime||legacyAudio.blob.type||'application/octet-stream';
      const f=new File([legacyAudio.blob],name,{type:mime}),key=await storeAsset(f),probe=await probeMedia(f);
      base.mediaActions.push(normalizeMediaAction({kind:'audio',assetKey:key,name,mime,size:f.size,duration:probe.duration,transition:'cut'}));
    }
    const legacyVideo=await idbGet(LEGACY_MEDIA_STORE,'video');
    if(legacyVideo?.blob){
      const name=legacyVideo.name||saved.videoName||'video',mime=legacyVideo.mime||saved.videoMime||legacyVideo.blob.type||'application/octet-stream';
      const f=new File([legacyVideo.blob],name,{type:mime}),key=await storeAsset(f),probe=await probeMedia(f);
      base.mediaActions.push(normalizeMediaAction({kind:'video',assetKey:key,name,mime,size:f.size,duration:probe.duration,muted:true}));
    }
    await idbPut(META_STORE,META_KEY,migrated);
  }catch(err){console.warn(tr('Migration du média V1.1.x incomplète'),err);}
  return migrated;
}
function formatSavedAt(ms){if(!ms)return'';try{return new Intl.DateTimeFormat(S2ALanguage.language==='en'?'en-GB':'fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(ms));}catch{return new Date(ms).toLocaleString();}}

async function probeMedia(file){return new Promise(resolve=>{const kind=file.type.startsWith('video/')?'video':'audio',el=document.createElement(kind),u=URL.createObjectURL(file),done=d=>{URL.revokeObjectURL(u);resolve({kind,duration:Number.isFinite(d)?d:0});};el.preload='metadata';el.onloadedmetadata=()=>done(el.duration);el.onerror=()=>done(0);el.src=u;});}
function clampTime(t){return Math.max(0,Math.min(Number(t)||0,projectDuration()));}
function currentTransportTime(){return transportPlaying?clampTime(transportBase+(performance.now()-transportEpoch)/1000):transportTime;}
function setTransportTime(t,rebuild=true){transportTime=clampTime(t);transportBase=transportTime;transportEpoch=performance.now();lastTransportTime=transportTime;if(rebuild)rebuildMediaAtTime(transportTime,transportPlaying);updateTransport();}
async function seekTransport(t){const wasPlaying=transportPlaying,nt=clampTime(t);transportTime=nt;transportBase=nt;transportEpoch=performance.now();lastTransportTime=nt;updateTransport();await rebuildMediaAtTime(nt,wasPlaying);if(wasPlaying){transportBase=nt;transportEpoch=performance.now();lastTransportTime=nt;if(!rafId)rafId=requestAnimationFrame(animationLoop);}updateTransport();}

function allActions(kind){return indexedActions(kind);}
let audioContext=null;async function ensureAudioContext(){if(!audioContext)audioContext=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')await audioContext.resume();return audioContext;}
async function runtimeElementFor(item){let p=preparedRecord(item);if(!p){try{await prepareOneMedia(item);p=preparedRecord(item);}catch{return null;}}return p;}
function stopAudioRuntime(id,release=false){const rt=runtimeAudio.get(id);if(!rt)return;try{rt.el.pause();rt.el.volume=1;}catch{}runtimeAudio.delete(id);if(release&&!preparedMedia.has(id))try{rt.el.remove();}catch{}}
function stopAllAudio(){for(const id of [...runtimeAudio.keys()])stopAudioRuntime(id);}
function stopAllRuntimeMedia(){stopAllAudio();stopVideoRuntime();}
function setRuntimeGain(rt,v){try{rt.el.volume=Math.max(0,Math.min(1,v));}catch{}}
async function activateAudio(item,elapsed=0,gainValue=1,playing=transportPlaying,resume=false){const command=transportCommandGeneration,seek=seekGeneration;let rt=runtimeAudio.get(item.action.id);if(!rt){const p=await runtimeElementFor(item);if(!p||command!==transportCommandGeneration||seek!==seekGeneration)return null;rt={item,el:p.el};runtimeAudio.set(item.action.id,rt);}rt.item=item;const position=mediaPositionAt(item.action,elapsed);if(!resume||Math.abs((rt.el.currentTime||0)-position)>.1)try{rt.el.currentTime=position;}catch{}setRuntimeGain(rt,gainValue);if(playing&&transportPlaying)await rt.el.play().catch(()=>{});else rt.el.pause();return rt;}
async function triggerAudioAction(item){const previous=[...runtimeAudio.values()].filter(rt=>rt.item.action.id!==item.action.id);if(item.action.transition==='fade'&&previous.length){const rt=await activateAudio(item,0,0,true);if(!rt)return;rt.fadeStartedAt=currentTransportTime();rt.fadeDuration=Math.max(.1,Number(item.action.fadeDuration)||3);for(const p of previous){p.fadeOutStartedAt=rt.fadeStartedAt;p.fadeDuration=rt.fadeDuration;}}else{for(const p of previous)stopAudioRuntime(p.item.action.id);await activateAudio(item,0,1,true);}}
function audioStateCoreAt(t,stopCutoff=-Infinity){const acts=allActions('audio').filter(x=>x.start>=stopCutoff-.0001&&x.start<=t+.0001);if(!acts.length)return[];const latest=acts[acts.length-1],elapsed=t-latest.start;if(!mediaIsActiveAt(latest.action,elapsed))return[];if(latest.action.transition==='fade'&&acts.length>1&&elapsed<latest.action.fadeDuration){const prev=acts[acts.length-2],pe=t-prev.start,p=Math.max(0,Math.min(1,elapsed/latest.action.fadeDuration)),out=[{item:latest,elapsed,gain:p}];if(mediaIsActiveAt(prev.action,pe))out.unshift({item:prev,elapsed:pe,gain:1-p});return out;}return[{item:latest,elapsed,gain:1}];}
function audioStateAt(t){const stop=lastStopActionBefore(t);if(!stop)return audioStateCoreAt(t,-Infinity);if(stop.action.transition==='fade'){const d=Math.max(.1,Number(stop.action.fadeDuration)||3),e=t-stop.start;if(e>=0&&e<d){const before=audioStateCoreAt(Math.max(0,stop.start-.001),-Infinity),factor=Math.max(0,1-e/d);return before.map(s=>({...s,elapsed:Math.max(0,t-s.item.start),gain:s.gain*factor})).filter(s=>mediaIsActiveAt(s.item.action,s.elapsed));}}return audioStateCoreAt(t,stop.start);}
async function rebuildAudioAtTime(t,playing,resume=false){const state=audioStateAt(t);if(resume){const wanted=new Set(state.map(s=>s.item.action.id));for(const id of runtimeAudio.keys())if(!wanted.has(id))stopAudioRuntime(id);}else stopAllAudio();await Promise.all(state.map(s=>activateAudio(s.item,s.elapsed,s.gain,playing,resume)));}
function updateAudioGains(t){const state=audioStateAt(t),wanted=new Set(state.map(s=>s.item.action.id));for(const [id] of [...runtimeAudio])if(!wanted.has(id))stopAudioRuntime(id);for(const s of state){const rt=runtimeAudio.get(s.item.action.id);if(rt)setRuntimeGain(rt,s.gain);}}
function restartLoopRuntime(rt,isVideo=false){
  if(!rt?.item?.action?.loop)return false;
  const start=Math.max(0,Number(rt.item.action.inPoint)||0);
  try{rt.el.currentTime=start;}catch{}
  if(transportPlaying)rt.el.play().catch(()=>{});else rt.el.pause();
  if(isVideo)syncExternalVideo(true);
  return true;
}
function handleRuntimeMediaEnded(id,kind){
  if(kind==='audio'){
    const rt=runtimeAudio.get(id);if(!rt)return;
    if(restartLoopRuntime(rt,false))return;
    stopAudioRuntime(id);
    return;
  }
  if(kind==='video'&&runtimeVideo?.item?.action?.id===id){
    if(restartLoopRuntime(runtimeVideo,true))return;
    stopVideoRuntime();
  }
}
function enforceMediaBounds(t){
  for(const [id,rt] of [...runtimeAudio]){
    const a=rt.item.action,seg=mediaSegmentDuration(a);
    if(seg<=0){stopAudioRuntime(id);continue;}
    const end=(Number(a.inPoint)||0)+seg;
    if((rt.el.currentTime||0)>=end-.035){
      if(a.loop)restartLoopRuntime(rt,false);
      else stopAudioRuntime(id);
    }
  }
  if(runtimeVideo){
    const a=runtimeVideo.item.action,seg=mediaSegmentDuration(a),end=(Number(a.inPoint)||0)+seg;
    if(seg<=0)stopVideoRuntime();
    else if((runtimeVideo.el.currentTime||0)>=end-.035){
      if(a.loop)restartLoopRuntime(runtimeVideo,true);
      else stopVideoRuntime();
    }
  }
}

function stopVideoRuntime(){if(runtimeVideo){try{runtimeVideo.el.pause();}catch{}runtimeVideo=null;}syncVideoSurfaces();}
async function activateVideo(item,elapsed=0,playing=transportPlaying,resume=false){const command=transportCommandGeneration,seek=seekGeneration;if(runtimeVideo?.item?.action?.id!==item.action.id){if(runtimeVideo)try{runtimeVideo.el.pause();}catch{}const p=await runtimeElementFor(item);if(!p||command!==transportCommandGeneration||seek!==seekGeneration)return null;runtimeVideo={item,el:p.el,url:p.url};}else runtimeVideo.item=item;runtimeVideo.el.muted=!!item.action.muted||!!(videoOutputWindow&&!videoOutputWindow.closed);const position=mediaPositionAt(item.action,elapsed);if(!resume||Math.abs((runtimeVideo.el.currentTime||0)-position)>.1)try{runtimeVideo.el.currentTime=position;}catch{}syncVideoSurfaces();if(playing&&transportPlaying)await runtimeVideo.el.play().catch(()=>{});else runtimeVideo.el.pause();syncExternalVideo(true);return runtimeVideo;}
async function triggerVideoAction(item){await activateVideo(item,0,true);}
function videoStateCoreAt(t,stopCutoff=-Infinity){const acts=allActions('video').filter(x=>x.start>=stopCutoff-.0001&&x.start<=t+.0001),latest=acts[acts.length-1];if(!latest)return null;const elapsed=t-latest.start;return mediaIsActiveAt(latest.action,elapsed)?{item:latest,elapsed,opacity:1}:null;}
function videoStateAt(t){const stop=lastStopActionBefore(t);if(!stop)return videoStateCoreAt(t,-Infinity);if(stop.action.transition==='fade'){const d=Math.max(.1,Number(stop.action.fadeDuration)||3),e=t-stop.start;if(e>=0&&e<d){const s=videoStateCoreAt(Math.max(0,stop.start-.001),-Infinity);if(s)return{item:s.item,elapsed:Math.max(0,t-s.item.start),opacity:Math.max(0,1-e/d)};}}return videoStateCoreAt(t,stop.start);}
async function rebuildVideoAtTime(t,playing,resume=false){const s=videoStateAt(t);if(!s){stopVideoRuntime();return;}await activateVideo(s.item,s.elapsed,playing,resume);if(runtimeVideo)runtimeVideo.opacity=s.opacity??1;syncExternalVideo(true);}

function activeVideoAction(){return runtimeVideo?.item?.action||null;}
function syncVideoSurfaces(){updateVideoOutputControls();const box=$('showVideoMonitor'),surface=$('showVideoSurface');box.hidden=!locked||!projectHasVideo();for(const v of surface.querySelectorAll('video'))if(v!==runtimeVideo?.el)preloadBin.append(v);$('showVideoEmpty').hidden=!!runtimeVideo;if(runtimeVideo){if(locked)surface.append(runtimeVideo.el);else preloadBin.append(runtimeVideo.el);runtimeVideo.el.style.opacity=String(runtimeVideo.opacity??1);}syncExternalVideo(true);}
function projectHasVideo(){return allActions('video').length>0;}
let screenDetails=null;
function manualMacVideoOutput(){return !isIOSDevice()&&/Mac/i.test(navigator.platform)&&typeof window.getScreenDetails!=='function';}
function extendedScreen(){if(isIOSDevice())return null;return screenDetails?.screens.find(s=>s!==screenDetails.currentScreen&&(s.left!==screenDetails.currentScreen.left||s.top!==screenDetails.currentScreen.top))||null;}
function updateVideoOutputControls(){videoOutputBtn.closest('.headerVideoOutput').hidden=!projectHasVideo();const open=!!(videoOutputWindow&&!videoOutputWindow.closed),extended=!!extendedScreen();videoOutputBtn.disabled=isIOSDevice()||(!extended&&!manualMacVideoOutput())||!projectHasVideo();videoOutputBtn.classList.toggle('active',open);videoOutputState.textContent=isIOSDevice()?tr('Sortie vidéo indisponible sur iPad / iPhone'):manualMacVideoOutput()?tr(open?'Sortie vidéo activée · placement manuel sur Mac':'Mac · placer la fenêtre sur l’écran secondaire'):!extended?tr('Disponible uniquement avec un affichage étendu'):open?tr('Sortie vidéo activée · affichage étendu prêt'):tr('Affichage étendu prêt');videoOutputBtn.title=open?tr('Fermer la sortie vidéo'):tr('Ouvrir la sortie vidéo');}
let screenDetectionPromise=null;
async function detectScreens(){
  if(typeof window.getScreenDetails!=='function'){screenDetails=null;onScreensChanged();return false;}
  if(screenDetectionPromise)return screenDetectionPromise;
  screenDetectionPromise=(async()=>{try{
    const details=await window.getScreenDetails();
    if(screenDetails!==details){screenDetails?.removeEventListener('screenschange',onScreensChanged);screenDetails?.removeEventListener('currentscreenchange',onScreensChanged);screenDetails=details;screenDetails.addEventListener('screenschange',onScreensChanged);screenDetails.addEventListener('currentscreenchange',onScreensChanged);}
    return true;
  }catch(e){screenDetails?.removeEventListener('screenschange',onScreensChanged);screenDetails?.removeEventListener('currentscreenchange',onScreensChanged);screenDetails=null;console.warn('Détection des écrans indisponible',e);return false;}finally{onScreensChanged();}})();
  try{return await screenDetectionPromise;}finally{screenDetectionPromise=null;}
}
async function checkScreensForAddedVideo(){
  if(typeof window.getScreenDetails!=='function')return false;
  let state=null;try{state=(await navigator.permissions.query({name:'window-management'})).state;}catch{}
  // A granted permission is reused. A denied permission is retried only on a new video addition;
  // the browser may reject without displaying another prompt until its site setting is changed.
  if(state==='granted'&&screenDetails){onScreensChanged();return true;}
  return detectScreens();
}
function onScreensChanged(){if(!extendedScreen()&&!manualMacVideoOutput())closeVideoOutput();updateVideoOutputControls();}
screen.addEventListener?.('change',onScreensChanged);
if(typeof window.getScreenDetails==='function'&&navigator.permissions?.query)Promise.resolve().then(()=>navigator.permissions.query({name:'window-management'})).then(p=>{const update=()=>{if(p.state==='granted')detectScreens();else{screenDetails=null;onScreensChanged();}};p.addEventListener('change',update);update();}).catch(()=>{});
function closeVideoOutput(){if(videoOutputWindow&&!videoOutputWindow.closed)try{videoOutputWindow.close();}catch{}videoOutputWindow=null;updateVideoOutputControls();}
function openVideoOutput(){
  if(isIOSDevice()||(!extendedScreen()&&!manualMacVideoOutput())||!projectHasVideo())return;
  if(videoOutputWindow&&!videoOutputWindow.closed){videoOutputWindow.focus();syncExternalVideo(true);return;}
  const target=extendedScreen();const w=window.open('','s2a-pilot-video-output',target?`popup=yes,left=${target.availLeft},top=${target.availTop},width=${target.availWidth},height=${target.availHeight}`:'popup=yes,width=1280,height=720');
  if(!w){alert(tr('Le navigateur a bloqué la fenêtre vidéo. Autorise les fenêtres surgissantes pour S2A Pilot.'));return;}
  videoOutputWindow=w;
  const d=w.document;
  d.open();
  d.write('<!doctype html><html><head><meta charset="utf-8"><title>S2A Pilot — Sortie vidéo</title><style>html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden;cursor:pointer}body{display:flex;align-items:center;justify-content:center}video{position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000;pointer-events:none}#showcueFullscreenHint{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:rgba(0,0,0,.18);color:#fff;font:600 18px system-ui,-apple-system,sans-serif;text-align:center;pointer-events:none;text-shadow:0 1px 4px #000}#showcueFullscreenHint.hidden{display:none}</style></head><body><video id="out" playsinline></video><div id="showcueFullscreenHint">Cliquer / toucher pour passer en plein écran</div></body></html>');
  d.close();if(S2ALanguage.language==='en'){d.title='S2A Pilot — Video output';d.getElementById('showcueFullscreenHint').textContent=tr('Cliquer / toucher pour passer en plein écran');}
  const hint=d.getElementById('showcueFullscreenHint');
  const isFullscreen=()=>!!(d.fullscreenElement||d.webkitFullscreenElement);
  const updateFullscreenHint=()=>{if(hint)hint.classList.toggle('hidden',isFullscreen());};
  const toggleFullscreen=async()=>{
    try{
      if(isFullscreen()){
        if(d.exitFullscreen)await d.exitFullscreen();
        else if(d.webkitExitFullscreen)d.webkitExitFullscreen();
      }else{
        const root=d.documentElement;
        if(root.requestFullscreen)await root.requestFullscreen();
        else if(root.webkitRequestFullscreen)root.webkitRequestFullscreen();
      }
    }catch(e){console.warn(tr('Plein écran indisponible'),e);}
    updateFullscreenHint();
  };
  d.addEventListener('click',e=>{e.preventDefault();toggleFullscreen();});
  d.addEventListener('contextmenu',e=>e.preventDefault());
  d.addEventListener('fullscreenchange',updateFullscreenHint);
  d.addEventListener('webkitfullscreenchange',updateFullscreenHint);
  w.addEventListener('beforeunload',()=>{if(videoOutputWindow===w){videoOutputWindow=null;setTimeout(updateVideoOutputControls,0);}});
  syncExternalVideo(true);
  updateVideoOutputControls();
}
function syncExternalVideo(force=false){const outputOpen=!!(videoOutputWindow&&!videoOutputWindow.closed);if(runtimeVideo)runtimeVideo.el.muted=!!runtimeVideo.item.action.muted||outputOpen;if(!outputOpen)return;let v;try{v=videoOutputWindow.document.getElementById('out');}catch{return;}if(!v)return;if(!runtimeVideo){try{v.pause();if(v.hasAttribute('src')){v.removeAttribute('src');v.load();}}catch{}return;}if(v.src!==runtimeVideo.url){v.src=runtimeVideo.url;v.preload='auto';v.load();}const target=runtimeVideo.el.currentTime||0;if(force||Math.abs((v.currentTime||0)-target)>.18)try{v.currentTime=target;}catch{}v.muted=!!runtimeVideo.item.action.muted;v.style.opacity=String(runtimeVideo.opacity??1);if(runtimeVideo.el.paused)v.pause();else if(v.paused)v.play().catch(()=>{});}
async function rebuildMediaAtTime(t,playing,resume=false){const generation=++seekGeneration,commandGeneration=transportCommandGeneration;await prepareShowMedia(false);if(generation!==seekGeneration||commandGeneration!==transportCommandGeneration)return;await Promise.all([rebuildAudioAtTime(t,playing&&transportPlaying,resume),rebuildVideoAtTime(t,playing&&transportPlaying,resume)]);}
async function onCueCrossed(cue){const actions=cue.mediaActions||[];for(const stop of actions.filter(a=>a.kind==='stopAll')){if(stop.transition==='cut')stopAllRuntimeMedia();else{const d=Math.max(.1,Number(stop.fadeDuration)||3);for(const rt of runtimeAudio.values()){rt.globalFadeStartedAt=currentTransportTime();rt.globalFadeDuration=d;}if(runtimeVideo){runtimeVideo.globalFadeStartedAt=currentTransportTime();runtimeVideo.globalFadeDuration=d;runtimeVideo.opacity=1;}}}const items=actions.filter(a=>a.kind!=='stopAll').map(action=>({cue,action,start:cue.time}));for(const item of items){if(item.action.kind==='audio')await triggerAudioAction(item);else if(item.action.kind==='video')await triggerVideoAction(item);}}

function getActiveCue(t=currentTransportTime()){let a=null;for(const c of orderedCues()){if(c.time<=t+.0001)a=c;else break;}return a;}
function getNextCue(t=currentTransportTime()){return orderedCues().find(c=>c.time>t+.0001)||null;}
function getCueAfter(cue){const a=orderedCues(),i=a.indexOf(cue);return i>=0?a[i+1]||null:null;}
function updateShowPanels(){updateShowOverview();updateCountdownBeat(currentTransportTime());}
function renderTimeline(){
 invalidateComputationCaches();timeline.querySelectorAll('.marker,.tick').forEach(e=>e.remove());const d=projectDuration();
 const ticks=4*generalTimelineZoom;for(let i=0;i<=ticks;i++){const tick=document.createElement('span');tick.className='tick';tick.style.left=`${i/ticks*100}%`;tick.textContent=fmtDisplay(d*i/ticks);timeline.appendChild(tick);}
 for(const cue of cues){
  const marker=document.createElement('div');marker.className='marker'+(expandedCueId===cue.id?' selectedCueMarker':'');marker.dataset.cueId=cue.id;marker.dataset.number=String(orderedCues().findIndex(c=>c.id===cue.id)+1);marker.style.left=`${cue.time/d*100}%`;marker.title=`${fmt(cue.time)} — ${cue.name}`;
  marker.addEventListener('pointerdown',e=>{
   if(locked||e.button!==0)return;e.preventDefault();e.stopPropagation();
   const startX=e.clientX,startTime=cue.time,rect=timeline.getBoundingClientRect();let dragging=false,draft=startTime;
   const hint=document.createElement('span');hint.className='cueDragTime';hint.hidden=true;marker.append(hint);marker.setPointerCapture(e.pointerId);
   const bars=[...$('projectMediaTracks').querySelectorAll('.projectMediaBar')].filter(b=>b.dataset.cueId===cue.id).map(b=>({el:b,left:b.style.left}));
   const row=cueList.querySelector(`[data-cue-id="${cue.id}"]`),rowTime=row?.querySelector('.cueSummaryTime'),input=row?.querySelector('.timeInput');
   const preview=ev=>{
    if(!dragging&&Math.abs(ev.clientX-startX)<4)return;dragging=true;
    // Keep the original scale and pointer offset throughout the gesture.
    draft=roundTenth(Math.max(0,Math.min(d,startTime+(ev.clientX-startX)/rect.width*d)));
    marker.classList.add('dragging','selectedCueMarker');marker.style.left=`${draft/d*100}%`;hint.hidden=false;hint.textContent=fmt(draft);
    hint.style.transform=draft/d<.1?'translateX(0)':draft/d>.9?'translateX(-100%)':'translateX(-50%)';
    for(const b of bars)b.el.style.left=`${draft/d*100}%`;
    if(rowTime)rowTime.textContent=fmt(draft);if(input)input.value=fmt(draft);
   };
   const finish=ev=>{
    if(ev.type==='pointerup')preview(ev);
    marker.removeEventListener('pointermove',preview);marker.removeEventListener('pointerup',finish);marker.removeEventListener('pointercancel',finish);marker.removeEventListener('lostpointercapture',finish);
    hint.remove();marker.classList.remove('dragging');
    if(dragging&&ev.type==='pointerup'&&draft!==startTime){pushHistory();cue.time=draft;expandedCueId=cue.id;invalidatePreflight();renderCues();scheduleAutosave();}
    else if(dragging){marker.style.left=`${startTime/d*100}%`;for(const b of bars)b.el.style.left=b.left;if(rowTime)rowTime.textContent=fmt(startTime);if(input)input.value=fmt(startTime);}
    else if(ev.type==='pointerup'){expandedCueId=cue.id;renderCues(false);renderTimeline();document.querySelector(`[data-cue-id="${cue.id}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});}
   };
   marker.addEventListener('pointermove',preview);marker.addEventListener('pointerup',finish);marker.addEventListener('pointercancel',finish);marker.addEventListener('lostpointercapture',finish);
  });timeline.appendChild(marker);
 }timelineLabelSignature='';updateTimelineCueLabels();scheduleTimelineMedia();
}

let showOverviewSignature='';
function updateTransport(){const t=currentTransportTime(),d=projectDuration(),pct=d?Math.min(100,t/d*100):0;clock.textContent=fmtDisplay(t);durationEl.textContent=`/ ${fmtDisplay(d)}`;playhead.style.left=`${pct}%`;playhead.setAttribute('aria-valuemin','0');playhead.setAttribute('aria-valuemax',String(d));playhead.setAttribute('aria-valuenow',String(roundTenth(t)));playhead.setAttribute('aria-valuetext',fmtDisplay(t));progress.style.width=`${pct}%`;const state=transportPlaying?'pause':'play';if(playBtn.dataset.transportState!==state){playBtn.dataset.transportState=state;S2AMaterial.set(playBtnIcon,transportPlaying?'pause':'play_arrow');playBtnLabel.textContent=transportPlaying?tr('Pause'):tr('Lecture');}updateShowPanels();updateTimelineCueLabels();updateShowOverview();}
let lastDisplayUpdate=0;
function animationLoop(){rafId=0;if(!transportPlaying)return;const t=currentTransportTime();updateCountdownBeat(t);for(const c of cues){if(c.time>lastTransportTime+.0001&&c.time<=t+.0001)onCueCrossed(c).catch(console.warn);}lastTransportTime=t;updateAudioGains(t);enforceMediaBounds(t);const vs=videoStateAt(t);if(runtimeVideo){if(!vs||vs.item.action.id!==runtimeVideo.item.action.id){stopVideoRuntime();}else{const expected=mediaPositionAt(runtimeVideo.item.action,t-runtimeVideo.item.start);if(Math.abs((runtimeVideo.el.currentTime||0)-expected)>.55)try{runtimeVideo.el.currentTime=expected;}catch{}runtimeVideo.opacity=vs.opacity??1;}}if(performance.now()-lastDisplayUpdate>=100){lastDisplayUpdate=performance.now();syncExternalVideo();if(runtimeVideo)runtimeVideo.el.style.opacity=String(runtimeVideo.opacity??1);updateTransport();}if(t>=projectDuration()){pauseTransport();return;}rafId=requestAnimationFrame(animationLoop);}

async function playTransport(){
  pauseMediaPreviews();
  if(transportPlaying)return;
  const commandGeneration=++transportCommandGeneration;
  try{await ensureAudioContext();}catch{}
  if(commandGeneration!==transportCommandGeneration)return;
  const ok=await prepareShowMedia(false);
  if(commandGeneration!==transportCommandGeneration)return;
  if(!ok&&preflightErrors.length){const go=confirm(tr('Certains médias n’ont pas pu être préparés. Continuer quand même ?'));if(!go||commandGeneration!==transportCommandGeneration)return;}
  transportPlaying=true;transportBase=transportTime;transportEpoch=performance.now();lastTransportTime=transportTime;
  await rebuildMediaAtTime(transportTime,true,true);
  if(commandGeneration!==transportCommandGeneration||!transportPlaying)return;
  if(!rafId)rafId=requestAnimationFrame(animationLoop);updateTransport();
}
function pauseTransport(){
  ++transportCommandGeneration;++seekGeneration;
  transportTime=currentTransportTime();transportPlaying=false;
  cancelAnimationFrame(rafId);rafId=0;
  for(const rt of runtimeAudio.values())try{rt.el.pause();}catch{}
  if(runtimeVideo)try{runtimeVideo.el.pause();}catch{}
  syncExternalVideo(true);updateTransport();
}

function applyLockState(){timeline.style.touchAction=generalTimelineZoom>1?'pan-x':'none';if(locked){generalTimelineZoom=1;timeline.style.width='100%';generalTimelineViewport.scrollLeft=0;updateGeneralZoomControls();}updateVersionButton();document.body.classList.toggle('locked',locked);editModeBtn.classList.toggle('active',!locked);showModeBtn.classList.toggle('active',locked);editModeBtn.setAttribute('aria-pressed',String(!locked));showModeBtn.setAttribute('aria-pressed',String(locked));showTitle.disabled=locked;openProjectBtn.disabled=locked;addCueBtn.disabled=locked;$('addMediaGlobalBtn').disabled=locked;$('globalMediaFile').disabled=locked;saveAsBtn.disabled=locked;if(locked&&preflightState!=='ready')prepareShowMedia(false).catch(console.warn);renderCues();syncVideoSurfaces();updateHistoryButtons();}
function setEnabled(){playBtn.disabled=false;restartBtn.disabled=false;addCueBtn.disabled=locked;$('addMediaGlobalBtn').disabled=locked;$('globalMediaFile').disabled=locked;saveAsBtn.disabled=locked;openProjectBtn.disabled=locked;}

async function addMediaToCue(cue,file){const screenCheck=file.type.startsWith('video/')?checkScreensForAddedVideo():Promise.resolve(false);const before=captureEditableState();const probe=await probeMedia(file);const key=await storeAsset(file);pushHistory(before);if(!cues.includes(cue))cues.push(cue);cue.mediaActions=cue.mediaActions||[];cue.mediaActions.push(normalizeMediaAction({id:uuid(),kind:probe.kind,assetKey:key,name:file.name,mime:file.type,size:file.size,duration:probe.duration,inPoint:0,outPoint:probe.duration,loop:false,transition:probe.kind==='audio'&&!(cue.time===0&&!cues.some(c=>c!==cue&&c.time===0))?'fade':'cut',fadeDuration:3,muted:true}));expandedCueId=cue.id;invalidatePreflight();renderCues();scheduleAutosave();await screenCheck;}
const mediaPreviewSessions=new Map(),mediaPreviewPositions=new Map(),mediaPreviewViews=new Map(),waveformTasks=new Map();
function pauseMediaPreviews(except=null){for(const session of mediaPreviewSessions.values())if(session!==except)session.pause();}
function disposeMediaPreviews(cueId=null){for(const [id,session] of mediaPreviewSessions)if(!cueId||session.cueId===cueId){session.dispose();mediaPreviewSessions.delete(id);}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseMediaPreviews();});
window.addEventListener('pagehide',()=>disposeMediaPreviews());
async function generateMediaWaveform(a,canvas,status){
  if(!mediaVisualCache.has(a.id)){
    if(!waveformTasks.has(a.id))waveformTasks.set(a.id,(async()=>{let ctx=null;try{
      const blob=await getAsset(a.assetKey);if(!blob)throw new Error(tr('Média introuvable'));
      ctx=new(window.AudioContext||window.webkitAudioContext)();
      const decoded=await ctx.decodeAudioData(await blob.arrayBuffer()),count=65536,channels=Array.from({length:Math.min(2,decoded.numberOfChannels)},(_,i)=>decoded.getChannelData(i)),peaks=[];
      for(let i=0;i<count;i++){const start=Math.floor(i*decoded.length/count),end=Math.max(start+1,Math.floor((i+1)*decoded.length/count)),step=Math.max(1,Math.floor((end-start)/80));let peak=0;for(const data of channels)for(let j=start;j<end;j+=step)peak=Math.max(peak,Math.abs(data[j]||0));peaks.push(peak);}
      mediaVisualCache.set(a.id,peaks);
    }catch{mediaVisualCache.set(a.id,{unavailable:true});}finally{try{await ctx?.close();}catch{}waveformTasks.delete(a.id);}})());
    await waveformTasks.get(a.id);
  }
  if(!canvas.isConnected)return;const result=mediaVisualCache.get(a.id);drawWaveform(canvas,Array.isArray(result)?result:[]);status.hidden=Array.isArray(result);status.textContent=Array.isArray(result)?'':tr('Waveform indisponible');
}
function drawWaveform(canvas,peaks,start=0,end=1){
 const r=canvas.getBoundingClientRect(),dpr=Math.min(3,devicePixelRatio||1);canvas.width=Math.max(1,Math.min(8192,Math.round(r.width*dpr)));canvas.height=Math.max(70,Math.round(r.height*dpr));
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.fillStyle='#0b1017';c.fillRect(0,0,w,h);c.strokeStyle='#70a9e8';c.lineWidth=1;c.beginPath();
 if(peaks.length){const first=Math.max(0,start)*peaks.length,span=Math.max(0,end-start)*peaks.length;
  for(let x=0;x<w;x++){const from=Math.min(peaks.length-1,Math.floor(first+x/w*span)),to=Math.min(peaks.length,Math.max(from+1,Math.ceil(first+(x+1)/w*span)));let peak=0;for(let i=from;i<to;i++)peak=Math.max(peak,peaks[i]||0);const p=peak*h*.44;c.moveTo(x+.5,h/2-p);c.lineTo(x+.5,h/2+p);}
 }c.stroke();c.strokeStyle='#273241';c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();
}

function updateTrimVisual(a,visual,selection,inHandle,outHandle,inInput,outInput){const d=Math.max(.1,Number(a.duration)||.1),ip=Math.max(0,Math.min(100,(Number(a.inPoint)||0)/d*100)),op=Math.max(ip,Math.min(100,(Number(a.outPoint)||d)/d*100));selection.style.left=ip+'%';selection.style.width=(op-ip)+'%';const before=visual.querySelector('.mediaExcluded.before'),after=visual.querySelector('.mediaExcluded.after');if(before)before.style.width=ip+'%';if(after){after.style.left=op+'%';after.style.width=(100-op)+'%';}inHandle.style.left=ip+'%';outHandle.style.left=op+'%';if(document.activeElement!==inInput)inInput.value=fmt(a.inPoint||0);if(document.activeElement!==outInput)outInput.value=fmt(a.outPoint||d);}
function mediaTrimEditor(cue,initialAction){
  const action=()=>cues.find(c=>c.id===cue.id)?.mediaActions?.find(a=>a.id===initialAction.id)||initialAction;
  const ed=document.createElement('div');ed.className='mediaEditor';ed.dataset.mediaId=initialAction.id;
  const top=document.createElement('div');top.className='mediaEditorTop';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='mediaPreviewToggle';S2AMaterial.button(toggle,'play_arrow',tr('▶ Lecture'));toggle.disabled=locked;toggle.title=tr('Lecture / pause de ce fichier uniquement');toggle.setAttribute('aria-label',tr('Lecture du média'));top.append(toggle);
  const mkField=(label,val)=>{const l=document.createElement('label');l.className='mediaEditorField';l.append(document.createTextNode(label));const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.value=fmt(val);i.disabled=locked;l.append(i);top.append(l);return i;};
  const inInput=mkField('IN',initialAction.inPoint||0),outInput=mkField('OUT',initialAction.outPoint||initialAction.duration||0);
  const loopLab=document.createElement('label');loopLab.className='loopToggle';const loop=document.createElement('input');loop.type='checkbox';loop.checked=!!initialAction.loop;loop.disabled=locked;loopLab.append(loop,document.createTextNode('Loop'));top.append(loopLab);
  const main=document.createElement('div');main.className='mediaEditorMain'+(initialAction.kind==='video'?' hasVideoPreview':'');
  const lane=document.createElement('div');lane.className='mediaEditorTimeline';
  const toolbar=document.createElement('div');toolbar.className='mediaZoomControls';toolbar.setAttribute('aria-label',tr('Zoom de la timeline du fichier'));
  const zoomOut=document.createElement('button'),zoomIn=document.createElement('button'),zoomLabel=document.createElement('span');zoomOut.type=zoomIn.type='button';S2AMaterial.set(zoomOut,'zoom_out');S2AMaterial.set(zoomIn,'zoom_in');zoomOut.title=tr('Dézoomer la timeline du fichier');zoomIn.title=tr('Zoomer la timeline du fichier');zoomOut.setAttribute('aria-label',tr('Dézoomer le média'));zoomIn.setAttribute('aria-label',tr('Zoomer le média'));zoomOut.className='mediaZoomOut';zoomIn.className='mediaZoomIn';zoomLabel.className='mediaZoomLabel';toolbar.append(zoomOut,zoomLabel,zoomIn);
  const viewport=document.createElement('div');viewport.className='mediaVisual';viewport.title=tr('Déplacer la tête de lecture ; faire défiler horizontalement après un zoom');
  const visual=document.createElement('div');visual.className='mediaVisualContent';viewport.append(visual);
  const savedView=mediaPreviewViews.get(initialAction.id)||{zoom:1,start:0};let zoom=Math.max(1,Math.min(64,savedView.zoom));
  const canvas=document.createElement('canvas');canvas.className='waveCanvas';visual.append(canvas);
  const selection=document.createElement('div');selection.className='mediaSelection';const excludedBefore=document.createElement('div'),excludedAfter=document.createElement('div');excludedBefore.className='mediaExcluded before';excludedAfter.className='mediaExcluded after';visual.append(excludedBefore,excludedAfter);
  const ih=document.createElement('div'),oh=document.createElement('div');ih.className=oh.className='trimHandle';ih.title='Point IN';oh.title='Point OUT';
  const head=document.createElement('div');head.className='mediaPreviewHead';head.tabIndex=locked?-1:0;head.setAttribute('role','slider');head.setAttribute('aria-label',tr('Position dans le média'));head.setAttribute('aria-valuemin','0');head.title=tr('Déplacer la tête de lecture du média');
  const status=document.createElement('span');status.className='waveformStatus';status.hidden=true;visual.append(selection,head,ih,oh,status);
  const labels=document.createElement('div');labels.className='mediaVisualLabels';const startLabel=document.createElement('span'),positionLabel=document.createElement('span'),endLabel=document.createElement('span');startLabel.textContent=fmt(0);positionLabel.className='mediaPreviewPosition';endLabel.textContent=fmt(initialAction.duration||0);labels.append(startLabel,positionLabel,endLabel);lane.append(toolbar,viewport,labels);main.append(lane);
  const el=document.createElement(initialAction.kind==='video'?'video':'audio');el.preload='metadata';el.playsInline=true;el.controls=false;el.loop=false;
  if(initialAction.kind==='video'){const monitor=document.createElement('div');monitor.className='mediaEditMonitor';monitor.setAttribute('aria-label',tr('Aperçu vidéo du média sélectionné'));monitor.append(el);main.append(monitor);}else{el.hidden=true;ed.append(el);}
  ed.append(top,main);
  let session=null,seekSequence=0,position=mediaPreviewPositions.get(initialAction.id)??(Number(initialAction.inPoint)||0);
  function saveView(){const d=Number(action().duration)||0;mediaPreviewViews.set(initialAction.id,{zoom,start:visual.clientWidth?viewport.scrollLeft/visual.clientWidth*d:0});}
  function updateViewLabels(){const d=Number(action().duration)||0,total=visual.clientWidth||viewport.clientWidth*zoom;startLabel.textContent=fmt(total?viewport.scrollLeft/total*d:0);endLabel.textContent=fmt(total?Math.min(d,(viewport.scrollLeft+viewport.clientWidth)/total*d):d);zoomLabel.textContent=`×${Number(zoom.toFixed(2))}`;zoomOut.disabled=locked||zoom<=1;zoomIn.disabled=locked||zoom>=Math.min(64,Math.max(1,d/.5));}
  function keepHeadVisible(){if(zoom<=1||!viewport.clientWidth)return;const x=position/Math.max(.1,Number(action().duration)||.1)*visual.clientWidth;if(x<viewport.scrollLeft||x>viewport.scrollLeft+viewport.clientWidth)viewport.scrollLeft=Math.max(0,x-viewport.clientWidth/2);}
  function drawVisibleWaveform(){if(!canvas.isConnected)return;const total=visual.clientWidth||1,width=viewport.clientWidth;canvas.style.width=width+'px';canvas.style.transform=`translateX(${viewport.scrollLeft}px)`;const peaks=mediaVisualCache.get(initialAction.id);drawWaveform(canvas,Array.isArray(peaks)?peaks:[],viewport.scrollLeft/total,Math.min(1,(viewport.scrollLeft+width)/total));}
  let waveformFrame=0,waveformResizeObserver=null;function scheduleVisibleWaveform(){if(waveformFrame)return;waveformFrame=requestAnimationFrame(()=>{waveformFrame=0;drawVisibleWaveform();});}
  function setZoom(next){const d=Number(action().duration)||0;zoom=Math.max(1,Math.min(next,64,Math.max(1,d/.5)));visual.style.width=`${zoom*100}%`;viewport.scrollLeft=Math.max(0,position/Math.max(.1,d)*visual.clientWidth-viewport.clientWidth/2);drawVisibleWaveform();updateViewLabels();saveView();}
  zoomOut.onclick=()=>setZoom(zoom/2);zoomIn.onclick=()=>setZoom(zoom*2);viewport.addEventListener('scroll',()=>{updateViewLabels();saveView();scheduleVisibleWaveform();});
  function updatePosition(t=position){position=Math.max(0,Math.min(t,Number(action().duration)||0));mediaPreviewPositions.set(initialAction.id,position);const d=Math.max(.1,Number(action().duration)||.1);head.style.left=`${position/d*100}%`;head.setAttribute('aria-valuemax',String(action().duration||0));head.setAttribute('aria-valuenow',String(position));head.setAttribute('aria-valuetext',fmt(position));positionLabel.textContent=fmt(position);if(session?.running)keepHeadVisible();}
  function refreshTrim(){updateTrimVisual(action(),visual,selection,ih,oh,inInput,outInput);updateViewLabels();updatePosition();}
  function ensureSession(){
    if(session)return session;
    session={cueId:cue.id,el,disposed:false,running:false,pendingPlay:false,command:0,raf:0,readyPromise:null,cancelMetadata:null};mediaPreviewSessions.set(initialAction.id,session);
    const setButton=(playing,loading=false)=>{S2AMaterial.button(toggle,playing?'pause':'play_arrow',loading?tr('Chargement…'):playing?tr('Ⅱ Pause'):tr('▶ Lecture'));toggle.setAttribute('aria-label',playing||loading?tr('Pause du média'):tr('Lecture du média'));};
    session.pause=()=>{++session.command;session.running=false;session.pendingPlay=false;el.pause();cancelAnimationFrame(session.raf);session.raf=0;setButton(false);updatePosition(el.readyState?el.currentTime:position);};
    session.dispose=()=>{waveformResizeObserver?.disconnect();cancelAnimationFrame(waveformFrame);saveView();session.pause();session.disposed=true;session.cancelMetadata?.();el.removeAttribute('src');el.load();};
    session.ready=()=>{if(session.disposed)return Promise.resolve(null);if(el.readyState>=1&&!el.error)return Promise.resolve(el);if(session.readyPromise)return session.readyPromise;
      session.readyPromise=(async()=>{try{const initialPosition=position;const url=await assetUrl(action().assetKey);if(session.disposed)return null;if(!url)throw new Error(tr('Média introuvable'));el.src=url;
        await new Promise((resolve,reject)=>{const finish=error=>{clearTimeout(timer);el.removeEventListener('loadedmetadata',ready);el.removeEventListener('error',fail);session.cancelMetadata=null;error?reject(error):resolve();};const ready=()=>finish();const fail=()=>finish(new Error(tr('Média non décodable')));const timer=setTimeout(()=>finish(new Error(tr('Délai de chargement dépassé'))),10000);session.cancelMetadata=()=>finish(new Error(tr('Aperçu fermé')));el.addEventListener('loadedmetadata',ready,{once:true});el.addEventListener('error',fail,{once:true});if(el.readyState>=1)ready();else el.load();});
        if(session.disposed)return null;try{el.currentTime=initialPosition;}catch{}return el;
      }catch{if(!session.disposed){positionLabel.textContent=tr('Aperçu indisponible');setButton(false);}return null;}finally{session.readyPromise=null;}})();return session.readyPromise;
    };
    const checkBounds=()=>{if(!session.running)return;const a=action(),end=Number(a.outPoint)||Number(a.duration)||0,start=Number(a.inPoint)||0;if(el.currentTime>=end-.01||el.ended){if(a.loop&&end>start){el.currentTime=start;if(el.paused)el.play().catch(()=>session.pause());}else{session.pause();try{el.currentTime=end;}catch{}updatePosition(end);}}};
    const tick=()=>{session.raf=0;if(session.disposed||!session.running)return;checkBounds();updatePosition(el.currentTime);if(session.running)session.raf=requestAnimationFrame(tick);};
    session.play=async()=>{pauseMediaPreviews(session);const command=++session.command;session.pendingPlay=true;setButton(false,true);const player=await session.ready();if(!player||session.disposed||command!==session.command){if(command===session.command){session.pendingPlay=false;setButton(false);}return;}
      const a=action(),start=Number(a.inPoint)||0,end=Number(a.outPoint)||Number(a.duration)||0;if(end<=start){session.pause();return;}if(el.currentTime<start||el.currentTime>=end-.01)el.currentTime=start;el.muted=a.kind==='video'&&!!a.muted;
      try{await el.play();if(session.disposed||command!==session.command){el.pause();return;}session.pendingPlay=false;session.running=true;setButton(true);if(!session.raf)session.raf=requestAnimationFrame(tick);}catch{if(command===session.command){session.pendingPlay=false;setButton(false);positionLabel.textContent=tr('Lecture indisponible');}}
    };
    el.addEventListener('timeupdate',()=>{if(session.disposed)return;checkBounds();updatePosition(el.currentTime);});el.addEventListener('seeked',()=>{if(!session.disposed)updatePosition(el.currentTime);});el.addEventListener('ended',checkBounds);
    return session;
  }
  async function seek(t){const sequence=++seekSequence;updatePosition(t);const target=position;const s=ensureSession(),player=await s.ready();if(!player||s.disposed||sequence!==seekSequence)return;try{player.currentTime=target;}catch{}updatePosition(target);keepHeadVisible();}
  toggle.onclick=()=>{const s=ensureSession();if(s.running||s.pendingPlay)s.pause();else s.play();};
  function edited(){preflightState='idle';renderTimeline();updateDurationEditor();scheduleAutosave();}
  const commit=(which,input)=>{const v=parseTime(input.value);if(v===null){refreshTrim();return;}pushHistory();const a=action();if(which==='in')a.inPoint=roundTenth(Math.max(0,Math.min(v,(a.outPoint||a.duration)-.1)));else a.outPoint=roundTenth(Math.max((a.inPoint||0)+.1,Math.min(v,a.duration||v)));session?.pause();refreshTrim();seek(which==='in'?a.inPoint:a.outPoint);edited();};
  inInput.onchange=()=>commit('in',inInput);outInput.onchange=()=>commit('out',outInput);loop.onchange=()=>{pushHistory();action().loop=loop.checked;edited();};
  const timeAt=e=>{const r=visual.getBoundingClientRect();return Math.max(0,Math.min(Number(action().duration)||0,(e.clientX-r.left)/r.width*(Number(action().duration)||0)));};
  visual.addEventListener('pointerdown',e=>{if(locked||e.target.closest('.trimHandle'))return;e.preventDefault();ensureSession().pause();visual.setPointerCapture(e.pointerId);seek(timeAt(e));const move=ev=>seek(timeAt(ev));const end=()=>{visual.removeEventListener('pointermove',move);visual.removeEventListener('pointerup',end);visual.removeEventListener('pointercancel',end);};visual.addEventListener('pointermove',move);visual.addEventListener('pointerup',end);visual.addEventListener('pointercancel',end);});
  head.addEventListener('keydown',e=>{if(locked)return;let t=position;if(e.key==='ArrowLeft')t-=e.shiftKey?1:.1;else if(e.key==='ArrowRight')t+=e.shiftKey?1:.1;else if(e.key==='Home')t=0;else if(e.key==='End')t=Number(action().duration)||0;else return;e.preventDefault();ensureSession().pause();seek(t);});
  const drag=(which,e)=>{if(locked)return;e.preventDefault();e.stopPropagation();const before=captureEditableState();ensureSession().pause();const handle=which==='in'?ih:oh;handle.setPointerCapture(e.pointerId);const move=ev=>{const a=action(),v=roundTenth(timeAt(ev)),d=Math.max(.1,a.duration||.1);if(which==='in')a.inPoint=Math.min(v,(a.outPoint||d)-.1);else a.outPoint=Math.max((a.inPoint||0)+.1,v);refreshTrim();seek(which==='in'?a.inPoint:a.outPoint);};const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);pushHistory(before);edited();};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);};
  ih.addEventListener('pointerdown',e=>drag('in',e));oh.addEventListener('pointerdown',e=>drag('out',e));visual.style.width=`${zoom*100}%`;refreshTrim();
  if(!locked&&expandedCueId===cue.id)requestAnimationFrame(()=>{if(!ed.isConnected)return;viewport.scrollLeft=savedView.start/Math.max(.1,Number(action().duration)||.1)*visual.clientWidth;updateViewLabels();drawVisibleWaveform();generateMediaWaveform(action(),canvas,status).then(drawVisibleWaveform);ensureSession().ready();if(typeof ResizeObserver==='function'){waveformResizeObserver=new ResizeObserver(scheduleVisibleWaveform);waveformResizeObserver.observe(viewport);}});
  return ed;
}

function mediaActionElement(cue,a){const row=document.createElement('div');row.className='mediaAction'+(a.kind==='stopAll'?' stopAllAction':'');if(a.kind==='stopAll'){const ident=document.createElement('div');ident.className='mediaActionIdentity';const badge=document.createElement('span');badge.className='mediaKindBadge';badge.textContent='STOP';const n=document.createElement('div');n.className='mediaActionName';n.textContent=tr('ARRÊT / FONDU TOUS LES MÉDIAS');ident.append(badge,n);const opts=document.createElement('div');opts.className='mediaActionOptions';const sel=document.createElement('select');sel.innerHTML='<option value="cut">CUT</option><option value="fade">' + tr('FONDU') + '</option>';sel.value=a.transition==='fade'?'fade':'cut';sel.disabled=locked;const dur=document.createElement('input');dur.type='number';dur.min='0.1';dur.step='0.1';dur.value=Number(a.fadeDuration||3).toFixed(1);dur.disabled=locked||sel.value!=='fade';dur.title=tr('Durée du fondu global en secondes');sel.onchange=()=>{pushHistory();a.transition=sel.value;dur.disabled=locked||a.transition!=='fade';renderCues();scheduleAutosave();};dur.onchange=()=>{pushHistory();a.fadeDuration=Math.max(.1,Number(dur.value)||3);dur.value=a.fadeDuration.toFixed(1);scheduleAutosave();};opts.append(sel,dur);const del=document.createElement('button');del.className='danger removeMediaBtn';del.type='button';S2AMaterial.button(del,'delete',tr('Supprimer'));del.disabled=locked;del.onclick=()=>{pushHistory();cue.mediaActions=cue.mediaActions.filter(x=>x.id!==a.id);renderCues();scheduleAutosave();};row.append(ident,opts,document.createElement('span'),del);return row;}const prep=preparedMedia.get(a.id);if(prep?.ready)row.classList.add('prepared');if(prep?.error)row.classList.add('prepareError');const ident=document.createElement('div');ident.className='mediaActionIdentity';const badge=document.createElement('span');badge.className='mediaKindBadge '+a.kind;badge.textContent=a.kind==='video'?tr('VIDÉO'):'AUDIO';const names=document.createElement('div');names.style.minWidth='0';const n=document.createElement('div');n.className='mediaActionName';n.textContent=a.name;const meta=document.createElement('div');meta.className='mediaActionMeta';meta.textContent=`${fmt(mediaSegmentDuration(a))}${tr(" utile /")} ${a.duration?fmt(a.duration):tr('durée inconnue')} · ${(a.size/1024/1024).toFixed(1)}${tr(" Mo")}`;names.append(n,meta);ident.append(badge,names);const opts=document.createElement('div');opts.className='mediaActionOptions';if(a.kind==='audio'){const sel=document.createElement('select');sel.innerHTML='<option value="cut">CUT</option><option value="fade">' + tr('FONDU') + '</option>';sel.value=a.transition;sel.disabled=locked;const dur=document.createElement('input');dur.type='number';dur.min='.1';dur.step='.1';dur.value=a.fadeDuration||3;dur.disabled=locked;dur.title=tr('Durée du fondu en secondes');dur.style.display=a.transition==='fade'?'block':'none';sel.onchange=()=>{pushHistory();a.transition=sel.value;dur.style.display=a.transition==='fade'?'block':'none';scheduleAutosave();};dur.onchange=()=>{pushHistory();a.fadeDuration=Math.max(.1,+dur.value||3);scheduleAutosave();};opts.append(sel,dur);}else{const mute=document.createElement('button');mute.type='button';mute.className='videoMuteBtn';mute.disabled=locked;const refresh=()=>{S2AMaterial.set(mute,a.muted?'volume_off':'volume_up');mute.setAttribute('aria-pressed',String(!!a.muted));mute.title=S2ALanguage.language==='en'?(a.muted?'Video muted — enable audio':'Video audio active — mute'):(a.muted?'Vidéo muette — activer le son':'Son vidéo actif — couper le son');mute.setAttribute('aria-label',mute.title);};refresh();mute.onclick=()=>{pushHistory();a.muted=!a.muted;refresh();scheduleAutosave();};opts.append(mute);}row.append(ident,opts,mediaTrimEditor(cue,a));return row;}

function cuePreparationClass(cue){const acts=(cue.mediaActions||[]).filter(a=>a.kind!=='stopAll');if(!acts.length)return'';if(acts.some(a=>preparedMedia.get(a.id)?.error))return'error';if(acts.every(a=>preparedMedia.get(a.id)?.ready))return'ready';return'';}
function duplicateCue(cue){
 if(locked)return;pushHistory();const copy=clone(cue);copy.id=uuid();copy.name=(cue.name||'Cue')+tr(' (copie)');copy.isBase=false;
 copy.mediaActions=(copy.mediaActions||[]).map((a,i)=>{const originalId=cue.mediaActions[i].id;a.id=uuid();if(mediaVisualCache.has(originalId))mediaVisualCache.set(a.id,mediaVisualCache.get(originalId));return a;});
 cues.splice(cues.indexOf(cue)+1,0,copy);expandedCueId=copy.id;invalidatePreflight();renderCues();scheduleAutosave();
}
function moveCueInList(cue,targetId,after){
 if(locked||cue.id===targetId)return;
 const remaining=orderedCues().filter(c=>c.id!==cue.id),target=remaining.findIndex(c=>c.id===targetId);if(target<0)return;
 const index=target+(after?1:0),previous=remaining[index-1],next=remaining[index];
 let time=previous&&next?roundTenth((previous.time+next.time)/2):previous?roundTenth(previous.time+1):0;
 pushHistory();cue.time=Math.max(0,time);remaining.splice(index,0,cue);cues=remaining;expandedCueId=cue.id;
 invalidatePreflight();renderCues();scheduleAutosave();
}
function attachCueDrag(handle,cue,row){
 handle.addEventListener('pointerdown',e=>{
  if(locked||e.button!==0)return;e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);
  const startY=e.clientY;let targetId=null,after=false,moved=false,frame=0,lastY=e.clientY;
  const clear=()=>cueList.querySelectorAll('.dropBefore,.dropAfter').forEach(r=>r.classList.remove('dropBefore','dropAfter'));
  const locate=()=>{clear();targetId=null;const rows=[...cueList.querySelectorAll('.cueAccordion')].filter(r=>r.dataset.cueId!==cue.id);if(!rows.length)return;
   let target=rows.find(r=>lastY<=r.getBoundingClientRect().bottom)||rows[rows.length-1];const box=target.getBoundingClientRect();after=lastY>box.top+box.height/2;targetId=target.dataset.cueId;target.classList.add(after?'dropAfter':'dropBefore');};
  const scroll=()=>{if(!moved)return;const delta=lastY<70?-12:lastY>innerHeight-70?12:0;if(delta){window.scrollBy(0,delta);locate();}frame=requestAnimationFrame(scroll);};
  const move=ev=>{lastY=ev.clientY;if(!moved&&Math.abs(lastY-startY)<5)return;if(!moved){moved=true;row.classList.add('cueDragging');frame=requestAnimationFrame(scroll);}locate();};
  const end=ev=>{cancelAnimationFrame(frame);handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);row.classList.remove('cueDragging');clear();if(ev.type==='pointerup'&&moved&&targetId)moveCueInList(cue,targetId,after);};
  handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
 });
 handle.onkeydown=e=>{if(locked||!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();const rows=orderedCues(),index=rows.findIndex(c=>c.id===cue.id),target=rows[index+(e.key==='ArrowUp'?-1:1)];if(target)moveCueInList(cue,target.id,e.key==='ArrowDown');};
}
function renderCues(renderTl=true,onlyCueId=null){showOverviewSignature='';disposeMediaPreviews(onlyCueId);invalidateComputationCaches();ensureBaseCueInvariant();normalizeCueOrderAndNames();if(expandedCueId&&!cues.some(c=>c.id===expandedCueId))expandedCueId=null;if(!onlyCueId)cueList.innerHTML='';cueCount.textContent=`${cues.length} Cue${cues.length>1?'s':''}`;cues.forEach((cue,index)=>{if(onlyCueId&&cue.id!==onlyCueId)return;const previousRow=onlyCueId?cueList.querySelector(`[data-cue-id="${cue.id}"]`):null;const acc=document.createElement('div');acc.className='cueAccordion'+(expandedCueId===cue.id?' expanded':'');acc.dataset.cueId=cue.id;const summary=document.createElement('div');summary.className='cueSummary';summary.tabIndex=0;summary.setAttribute('role','button');summary.setAttribute('aria-expanded',expandedCueId===cue.id?'true':'false');const num=document.createElement('div');num.className='cueNumber';num.textContent=`CUE ${index+1}`;if(!locked){const handle=document.createElement('button');handle.type='button';handle.className='cueDragHandle';handle.textContent='⠿';handle.title=tr('Glisser pour déplacer la Cue et ajuster son temps (Alt + flèches au clavier)');handle.setAttribute('aria-label',tr('Déplacer ')+(cue.name||tr('la Cue')));handle.onclick=e=>e.stopPropagation();num.prepend(handle);attachCueDrag(handle,cue,acc);}const st=document.createElement('div');st.className='cueSummaryTime';st.textContent=fmt(cue.time);const sm=document.createElement('div');sm.className='cueSummaryMain';const sn=document.createElement('div');sn.className='cueSummaryName';sn.textContent=cue.name||`Cue ${index+1}`;const sd=document.createElement('div');sd.className='cueSummaryDescription';sd.textContent=cue.description||((cue.mediaActions||[]).length?'':tr('Aucune indication'));sm.append(sn,sd);const chips=document.createElement('div');chips.className='cueSummaryMedia';for(const kind of ['audio','video']){const n=(cue.mediaActions||[]).filter(a=>a.kind===kind).length;if(n){const ch=document.createElement('span');ch.className='cueMediaChip '+kind+' '+cuePreparationClass(cue);ch.textContent=`${kind==='audio'?'AUDIO':tr('VIDÉO')}${n>1?' ×'+n:''}`;chips.append(ch);}}if((cue.mediaActions||[]).some(a=>a.kind==='stopAll')){const ch=document.createElement('span');ch.className='cueMediaChip stop';ch.textContent='STOP';chips.append(ch);}summary.append(num,st,sm,chips);const toggle=()=>{const previous=expandedCueId;expandedCueId=previous===cue.id?null:cue.id;if(previous&&previous!==cue.id)renderCues(false,previous);renderCues(false,cue.id);renderTimeline();};summary.onclick=e=>{if(e.target.closest('button,input,select,textarea,label'))return;toggle();};summary.onkeydown=e=>{if(e.target.closest('button,input,select,textarea,label'))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
const details=document.createElement('div');details.className='cueDetails';const grid=document.createElement('div');grid.className='cueEditGrid';const ti=document.createElement('input');ti.className='timeInput'+(cue.isBase?' baseCueTime':'');ti.value=fmt(cue.time);ti.setAttribute('aria-label',tr('Temps de la Cue'));ti.title=tr('Exemples : 02:41.0 ou 02.41 pour 2 minutes 41 ; 02:41.5 pour les dixièmes.');ti.disabled=locked;const fields=document.createElement('div');fields.className='cueTextFields';const name=document.createElement('input');name.type='text';name.value=cue.name;name.disabled=locked;const desc=document.createElement('textarea');desc.className='cueDescription';desc.placeholder=tr('Description / indication de conduite');desc.value=cue.description||'';desc.disabled=locked;fields.append(name,desc);const imgc=document.createElement('div');imgc.className='imageControls';if(cue.imageDataUrl){const im=document.createElement('img');im.className='cueImageThumb';im.src=cue.imageDataUrl;imgc.append(im);}const il=document.createElement('label');il.className='fileLabel';S2AMaterial.button(il,'add_photo_alternate',cue.imageDataUrl?tr('Changer visuel'):tr('Ajouter visuel'));const ii=document.createElement('input');ii.type='file';ii.accept='image/*';ii.disabled=locked;ii.onchange=async()=>{const f=ii.files?.[0];if(!f)return;pushHistory();cue.imageDataUrl=await fileToDataURL(f);cue.imageName=f.name;expandedCueId=cue.id;renderCues();scheduleAutosave();};il.append(ii);imgc.append(il);if(cue.imageDataUrl){const ri=document.createElement('button');S2AMaterial.button(ri,'hide_image',tr('Retirer visuel'));ri.disabled=locked;ri.onclick=()=>{pushHistory();cue.imageDataUrl=null;cue.imageName=null;expandedCueId=cue.id;renderCues();scheduleAutosave();};imgc.append(ri);}const del=document.createElement('button');del.className='cueDeleteBtn';del.type='button';S2AMaterial.set(del,'delete');del.title=tr('Supprimer')+' CUE '+(index+1);del.setAttribute('aria-label',del.title);del.disabled=locked;del.onclick=e=>{e.stopPropagation();if(locked)return;if(!confirm(tr('Supprimer cette Cue ?')+'\nCUE '+(index+1)+' — '+(cue.name||'Cue '+(index+1))))return;pushHistory();cues.splice(cues.indexOf(cue),1);expandedCueId=null;invalidatePreflight();renderCues();scheduleAutosave();};const actions=document.createElement('div');actions.className='cueEditActions';const duplicate=document.createElement('button');duplicate.type='button';S2AMaterial.button(duplicate,'content_copy',tr('Dupliquer'));duplicate.disabled=locked;duplicate.onclick=()=>duplicateCue(cue);actions.append(duplicate);if(!locked)summary.append(del);grid.append(ti,fields,imgc,actions);const panel=document.createElement('div');panel.className='cueMediaPanel';const mh=document.createElement('div');mh.className='cueMediaHeader';const mt=document.createElement('div');mt.className='cueMediaTitle';mt.textContent=tr('MÉDIAS DÉCLENCHÉS PAR CETTE CUE');mh.append(mt);const list=document.createElement('div');list.className='mediaActionList';if(!(cue.mediaActions||[]).length){const empty=document.createElement('div');empty.className='cueMediaEmpty';empty.textContent=tr('Aucun média — cette Cue peut rester une simple indication de conduite.');list.append(empty);}else for(const a of cue.mediaActions)list.append(mediaActionElement(cue,a));panel.append(mh,list);details.append(grid);if((cue.mediaActions||[]).length)details.append(panel);acc.append(summary,details);if(previousRow)previousRow.replaceWith(acc);else cueList.append(acc);const commitTime=()=>{const t=parseTime(ti.value);if(t===null){ti.value=fmt(cue.time);return;}pushHistory();cue.time=Math.max(0,roundTenth(t));normalizeCueOrderAndNames();expandedCueId=cue.id;renderCues();scheduleAutosave();};ti.onchange=commitTime;let nameBefore=null,descBefore=null;name.onfocus=()=>{nameBefore=captureEditableState();};desc.onfocus=()=>{descBefore=captureEditableState();};name.oninput=()=>{cue.name=name.value;updateShowPanels();scheduleAutosave();};desc.oninput=()=>{cue.description=desc.value;updateShowPanels();scheduleAutosave();};name.onchange=()=>{pushHistory(nameBefore||captureEditableState());cue.name=name.value;expandedCueId=cue.id;renderCues(true,cue.id);scheduleAutosave();};desc.onchange=()=>{pushHistory(descBefore||captureEditableState());cue.description=desc.value;updateShowPanels();scheduleAutosave();};});if(renderTl)renderTimeline();setEnabled();updateTransport();updateDurationEditor();updatePreflightUI();updateVideoOutputControls();}
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(file);});}

function zipU16(n){return new Uint8Array([n&255,(n>>>8)&255]);}function zipU32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function zipConcat(a){const n=a.reduce((s,x)=>s+x.length,0),o=new Uint8Array(n);let p=0;for(const x of a){o.set(x,p);p+=x.length;}return o;}
function zipCrc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function zipDosDateTime(d=new Date()){const y=Math.max(1980,d.getFullYear());return{time:(d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2),date:((y-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};}
async function makeZip(entries){const enc=new TextEncoder(),lp=[],cp=[];let off=0;const dt=zipDosDateTime();for(const e of entries){const nb=enc.encode(e.name),data=e.data instanceof Uint8Array?e.data:new Uint8Array(e.data),crc=zipCrc32(data),lh=zipConcat([zipU32(0x04034b50),zipU16(20),zipU16(0x0800),zipU16(0),zipU16(dt.time),zipU16(dt.date),zipU32(crc),zipU32(data.length),zipU32(data.length),zipU16(nb.length),zipU16(0),nb]);lp.push(lh,data);cp.push(zipConcat([zipU32(0x02014b50),zipU16((3<<8)|20),zipU16(20),zipU16(0x0800),zipU16(0),zipU16(dt.time),zipU16(dt.date),zipU32(crc),zipU32(data.length),zipU32(data.length),zipU16(nb.length),zipU16(0),zipU16(0),zipU16(0),zipU16(0),zipU32(((e.mode??0o100644)<<16)>>>0),zipU32(off),nb]));off+=lh.length+data.length;}const central=zipConcat(cp),end=zipConcat([zipU32(0x06054b50),zipU16(0),zipU16(0),zipU16(entries.length),zipU16(entries.length),zipU32(central.length),zipU32(off),zipU16(0)]);return new Blob([...lp,central,end],{type:'application/zip'});}
function dataUrlToBytes(dataUrl){const b=atob(dataUrl.slice(dataUrl.indexOf(',')+1)),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o;}
function readStoredZip(buffer){const bytes=new Uint8Array(buffer),view=new DataView(buffer),dec=new TextDecoder('utf-8'),entries=new Map();let off=0;while(off+4<=bytes.length){const sig=view.getUint32(off,true);if(sig===0x04034b50){const method=view.getUint16(off+8,true),cs=view.getUint32(off+18,true),us=view.getUint32(off+22,true),nl=view.getUint16(off+26,true),el=view.getUint16(off+28,true),ns=off+30,ds=ns+nl+el,name=dec.decode(bytes.subarray(ns,ns+nl));if(method!==0)throw new Error(tr('Ce ZIP utilise une compression non prise en charge.'));entries.set(name,bytes.slice(ds,ds+us));off=ds+cs;continue;}if(sig===0x02014b50||sig===0x06054b50)break;throw new Error(tr('Format ZIP non reconnu.'));}return entries;}
function bytesToDataUrl(bytes,mime){let s='',ch=0x8000;for(let i=0;i<bytes.length;i+=ch)s+=String.fromCharCode(...bytes.subarray(i,Math.min(i+ch,bytes.length)));return`data:${mime};base64,${btoa(s)}`;}
function mimeFromName(name){const e=(name.split('.').pop()||'').toLowerCase(),m={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp3:'audio/mpeg',wav:'audio/wav',aif:'audio/aiff',aiff:'audio/aiff',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',ogg:'audio/ogg',mp4:'video/mp4',mov:'video/quicktime',m4v:'video/x-m4v',webm:'video/webm'};return m[e]||'application/octet-stream';}
async function addCompiledCompanion(entries){
 const [archiveResponse,manifestResponse]=await Promise.all([fetch('./companion/S2A-Copilot-1.2.11-app.zip',{cache:'no-store'}),fetch('./companion/app-files.json?v=1.2.11',{cache:'no-store'})]);
 if(!archiveResponse.ok||!manifestResponse.ok)throw new Error(tr('S2A Copilot est indisponible. Vérifiez que tous les fichiers de la PWA ont été déployés.'));
 const [buffer,manifest]=await Promise.all([archiveResponse.arrayBuffer(),manifestResponse.json()]),files=readStoredZip(buffer);
 for(const file of manifest.files){
  if(!file.path.startsWith('S2A Copilot.app/')||file.path.split('/').some(part=>part==='..'))throw new Error(tr('Archive Copilot invalide.'));
  const data=files.get(file.path);if(!data||data.length!==file.size)throw new Error(tr('Archive Copilot incomplète.'));
  entries.push({name:'companion/'+file.path,data,mode:file.mode});
 }
 entries.push({name:'companion/INSTALLATION.txt',data:new TextEncoder().encode(S2ALanguage.language==='en'?"S2A COPILOT 1.2.11 \u2014 MAC INSTALLATION\n\nIntel and Apple Silicon Macs \u2014 macOS 13 or later. No compilation required. Locally signed; not notarized by Apple.\n\n1. Extract the ZIP and move S2A Copilot.app into Applications. Replace the previous version if needed.\n2. Try opening S2A Copilot once.\n3. If macOS blocks it, dismiss the message and open System Settings > Privacy & Security.\n4. Scroll to Security and choose Open Anyway for S2A Copilot.\n5. Authenticate if requested, then confirm Open.\n\nOpen Anyway appears after an opening attempt. If it disappears, try opening the app again and return to these settings. A new version may require a new approval. Only approve the app from the official repository:\nhttps://github.com/soundviking/S2A-Pilot\n\nWhen importing, also allow S2A Copilot to control QLab. This is a separate permission.\nApple instructions: https://support.apple.com/en-us/102445\n":"S2A COPILOT 1.2.11 — INSTALLATION SUR MAC\n\nMac Intel et Apple Silicon — macOS 13 ou plus récent.\nAucune compilation nécessaire. Application signée localement, non notariée par Apple.\n\n1. Décompressez le ZIP et glissez S2A Copilot.app dans Applications.\n   Remplacez l’ancienne version si nécessaire.\n2. Essayez d’ouvrir S2A Copilot depuis Applications une première fois.\n3. Si macOS bloque son ouverture, fermez le message et ouvrez :\n   Réglages Système > Confidentialité et sécurité.\n4. Descendez jusqu’à la section Sécurité. Repérez le message concernant\n   S2A Copilot, puis cliquez sur « Ouvrir quand même ».\n5. Validez avec votre mot de passe ou Touch ID si demandé, puis confirmez\n   « Ouvrir ». L’autorisation est mémorisée pour cette application.\n\nLe bouton « Ouvrir quand même » apparaît après la tentative d’ouverture.\nS’il n’est plus affiché, essayez à nouveau d’ouvrir l’application, puis\nretournez immédiatement dans Confidentialité et sécurité.\nUne nouvelle version peut nécessiter une nouvelle autorisation.\nAutorisez uniquement l’application provenant du dépôt officiel :\nhttps://github.com/soundviking/S2A-Pilot\n\nUne fois l’application ouverte, autorisez le contrôle de QLab lorsque\nmacOS le demande lors de l’import. Cette permission est distincte de\nl’autorisation d’ouverture ci-dessus.\n\nProcédure Apple : https://support.apple.com/fr-fr/102445\n")});
}
async function buildProjectPackage(){ensureBaseCueInvariant();const title=showTitle.value.trim()||tr('Projet S2A Pilot'),entries=[],project={format:'showcue-multimedia-package',version:5,title,showDuration:roundTenth(projectDuration()),showDurationOverride:Number.isFinite(showDurationOverride)?roundTenth(showDurationOverride):null,cues:[]},assetPaths=new Map();for(let i=0;i<cues.length;i++){const c=cues[i],pc={index:i+1,time:roundTenth(c.time),name:c.name,description:c.description||'',isBase:!!c.isBase,imagePath:null,mediaActions:[]};if(c.imageDataUrl){const p=`images/${String(i+1).padStart(2,'0')}-${safeFileName(c.imageName||'cue.jpg')}`;entries.push({name:p,data:dataUrlToBytes(c.imageDataUrl)});pc.imagePath=p;}for(const a of(c.mediaActions||[])){if(a.kind==='stopAll'){pc.mediaActions.push({...a,assetKey:undefined});continue;}let p=assetPaths.get(a.assetKey);if(!p){const blob=await getAsset(a.assetKey);if(!blob)throw new Error(`${tr("Média introuvable : ")}${a.name}`);p=`media/${a.id}-${safeFileName(a.name)}`;assetPaths.set(a.assetKey,p);entries.push({name:p,data:new Uint8Array(await blob.arrayBuffer())});}pc.mediaActions.push({...a,path:p,assetKey:undefined});}project.cues.push(pc);}const enc=new TextEncoder();entries.push({name:'conduite.json',data:enc.encode(JSON.stringify(project,null,2))});const pdf=await buildTechnicalPdfBytes();entries.push({name:`documents/${safeFileName(title)}-conduite-technique.pdf`,data:pdf.bytes});await addCompiledCompanion(entries);entries.push({name:'LISEZ-MOI-Technicien.txt',data:enc.encode(S2ALanguage.language==='en'?`S2A PILOT — MULTIMEDIA PACKAGE\n\nProject: ${title}\nCues: ${project.cues.length}\n\nContents:\n- conduite.json: S2A Pilot show data\n- media/: show media\n- images/: Cue visuals\n- documents/: technical cue sheet PDF\n- companion/: ready-to-install S2A Copilot.app for Intel and Apple Silicon Macs\n\nMove companion/S2A Copilot.app into Applications. macOS 13 or later. No compilation required. If macOS blocks opening, follow companion/INSTALLATION.txt. Do not remove media files before importing into QLab.`:`S2A PILOT — PACKAGE MULTIMÉDIA\n\nProjet : ${title}\nCues : ${project.cues.length}\n\nContenu :\n- conduite.json : conduite S2A Pilot\n- media/ : médias du spectacle\n- images/ : visuels de repérage\n- documents/ : fiche technique PDF\n- companion/ : application S2A Copilot.app prête à installer (Mac Intel et Apple Silicon)\n\nINSTALLATION : après décompression du package, glisser companion/S2A Copilot.app dans le dossier Applications. Aucune compilation nécessaire. macOS 13 ou version ultérieure. Si macOS bloque l’ouverture, suivre la procédure « Ouvrir quand même » dans companion/INSTALLATION.txt.`)});return{blob:await makeZip(entries),suggestedName:`${safeFileName(title)}.s2apilot.zip`};}
function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
async function saveProject(){if(locked)return;const b=saveAsBtn,old=b.textContent;b.disabled=true;S2AMaterial.button(b,'save_as',tr('Création du package…'));try{await writeAutosave();const {blob,suggestedName}=await buildProjectPackage();if('showSaveFilePicker'in window){try{const h=await window.showSaveFilePicker({suggestedName,types:[{description:tr('Projet S2A Pilot'),accept:{'application/zip':['.zip']}}]});const w=await h.createWritable();await w.write(blob);await w.close();}catch(e){if(e.name==='AbortError')return;throw e;}}else downloadBlob(blob,suggestedName);currentProjectName=suggestedName;}catch(e){console.error(e);alert(tr('Impossible d’enregistrer : ')+(e.message||e));}finally{S2AMaterial.button(b,'save_as',old);setEnabled();}}
async function compatibilityProjectAsPackage(file){
 const parsed=JSON.parse(await file.text());if(parsed.format!=='s2a-legacy-project'||!parsed.project||!Array.isArray(parsed.project.cues))throw new Error(tr('Format de projet non reconnu.'));
 const p=parsed.project,entries=[],manifest={format:'showcue-multimedia-package',version:5,title:p.title||'',cues:[]};
 for(let i=0;i<p.cues.length;i++){const c=p.cues[i],record={index:i+1,time:Math.max(0,Number(c.time)||0),name:c.name||'Cue',description:c.description||'',imagePath:null,mediaActions:[]};if(c.imageDataUrl){record.imagePath=`images/${i+1}.jpg`;entries.push({name:record.imagePath,data:dataUrlToBytes(c.imageDataUrl)});}
  if(p.audio&&String(p.audio.cueID)===String(c.id)){const a=p.audio,path='media/'+safeFileName(a.name||'audio.mp3');entries.push({name:path,data:dataUrlToBytes(a.data)});record.mediaActions.push({id:uuid(),kind:'audio',name:a.name,path,duration:(Number(a.duration)||0)+(Number(a.inPoint)||0),inPoint:Number(a.inPoint)||0,outPoint:(Number(a.duration)||0)+(Number(a.inPoint)||0),loop:false,transition:'cut',gain:1});}manifest.cues.push(record);}
 entries.push({name:'conduite.json',data:new TextEncoder().encode(JSON.stringify(manifest))});return new File([await makeZip(entries)],(file.name||'compatibility')+'.zip',{type:'application/zip'});
}
async function importPackage(file){if(/\.json$/i.test(file.name||''))file=await compatibilityProjectAsPackage(file);const entries=readStoredZip(await file.arrayBuffer()),mb=entries.get('conduite.json');if(!mb)throw new Error(tr('conduite.json introuvable.'));const m=JSON.parse(new TextDecoder().decode(mb));const screenCheck=(m.video||(m.cues||[]).some(c=>(c.mediaActions||[]).some(a=>a.kind==='video')))?checkScreensForAddedVideo():Promise.resolve(false);let imported=[];if(m.version>=3&&Array.isArray(m.cues)){for(const c of m.cues){let imageDataUrl=null;if(c.imagePath&&entries.has(c.imagePath))imageDataUrl=bytesToDataUrl(entries.get(c.imagePath),mimeFromName(c.imagePath));const acts=[];for(const a of(c.mediaActions||[])){if(a.kind==='stopAll'){acts.push(normalizeMediaAction(a));continue;}if(!a.path||!entries.has(a.path))continue;const bytes=entries.get(a.path),name=a.name||a.path.split('/').pop(),mime=a.mime||mimeFromName(name),blob=new Blob([bytes],{type:mime}),key=await storeAsset(new File([blob],name,{type:mime}));acts.push(normalizeMediaAction({...a,assetKey:key,name,mime,size:bytes.length}));}imported.push({id:uuid(),time:+c.time||0,name:c.name||`Cue ${imported.length+1}`,description:c.description||'',isBase:!!c.isBase,imageDataUrl,imageName:c.imagePath?.split('/').pop()||null,mediaActions:acts});}}else{const baseCues=[];for(const c of(m.cues||[])){let imageDataUrl=null;if(c.imagePath&&entries.has(c.imagePath))imageDataUrl=bytesToDataUrl(entries.get(c.imagePath),mimeFromName(c.imagePath));baseCues.push({id:uuid(),time:+c.time||0,name:c.name||`Cue ${baseCues.length+1}`,description:c.description||'',isBase:!!c.isBase,imageDataUrl,imageName:c.imagePath?.split('/').pop()||null,mediaActions:[]});}if(!baseCues.length)baseCues.push(newBaseCue());const base=baseCues.find(c=>c.isBase)||baseCues[0];if(m.audio?.path&&entries.has(m.audio.path)){const bytes=entries.get(m.audio.path),name=m.audio.originalFileName||m.audio.fileName||'audio',mime=m.audio.mimeType||mimeFromName(name),f=new File([bytes],name,{type:mime}),key=await storeAsset(f);base.mediaActions.push(normalizeMediaAction({kind:'audio',assetKey:key,name,mime,size:bytes.length,duration:m.audio.duration||0,transition:'cut'}));}if(m.video?.path&&entries.has(m.video.path)){const bytes=entries.get(m.video.path),name=m.video.originalFileName||m.video.fileName||'video',mime=m.video.mimeType||mimeFromName(name),f=new File([bytes],name,{type:mime}),key=await storeAsset(f),probe=await probeMedia(f);base.mediaActions.push(normalizeMediaAction({kind:'video',assetKey:key,name,mime,size:bytes.length,duration:probe.duration,muted:m.video.mutedOutput!==false}));}imported=baseCues;}showTitle.value=m.title||file.name.replace(/\.s2apilot\.zip$|\.showcue\.zip$|\.zip$/i,'');showDurationOverride=Number.isFinite(m.showDurationOverride)?roundTenth(m.showDurationOverride):null;cues=imported;ensureBaseCueInvariant();workspaceCommitted=true;currentProjectName=file.name;transportTime=0;expandedCueId=null;invalidatePreflight();await writeAutosave(true);renderCues();resetHistory();await rebuildMediaAtTime(0,false);await screenCheck;}

async function loadWorkspace(saved){showTitle.value=saved.title||'';showDurationOverride=Number.isFinite(saved.showDurationOverride)?roundTenth(saved.showDurationOverride):null;cues=clone(saved.cues||[]).map(c=>({...c,mediaActions:(c.mediaActions||[]).map(normalizeMediaAction)}));ensureBaseCueInvariant();workspaceCommitted=true;transportTime=0;expandedCueId=null;invalidatePreflight();renderCues();resetHistory();await rebuildMediaAtTime(0,false);}
function startNewProject(){pauseTransport();stopAllAudio();stopVideoRuntime();showTitle.value='';showDurationOverride=null;cues=[];workspaceCommitted=false;currentProjectName=null;transportTime=0;expandedCueId=null;invalidatePreflight();resetHistory();renderCues();scheduleAutosave();}
async function startup(){try{startupSaved=await readAutosave();}catch(e){console.warn(e);}if(startupSaved&&Array.isArray(startupSaved.cues)){const title=startupSaved.title?.trim()||tr('Projet sans nom');startupProjectInfo.textContent=`${tr("Dernière sauvegarde :")} « ${title} » — ${formatSavedAt(startupSaved.savedAt)}.`;try{await loadWorkspace(startupSaved);}catch(e){console.warn(e);startNewProject();}}else{startupProjectInfo.textContent=tr('Aucune sauvegarde locale détectée.');startNewProject();}}

let spaceTransportPending=false,transportAcceptedAt=-Infinity;
function toggleTransportGuarded(){
 if(spaceTransportPending||playBtn.disabled||performance.now()-transportAcceptedAt<500)return;
 transportAcceptedAt=performance.now();playBtn.classList.add('spaceGuard');setTimeout(()=>playBtn.classList.remove('spaceGuard'),500);
 if(transportPlaying){pauseTransport();return;}
 spaceTransportPending=true;Promise.resolve(playTransport()).catch(console.warn).finally(()=>{spaceTransportPending=false;});
}
playBtn.addEventListener('click',toggleTransportGuarded);
document.addEventListener('keydown',e=>{
 if(e.code!=='Space'&&e.key!==' ')return;
 if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;
 const target=e.target instanceof Element?e.target:document.activeElement;
 if(target?.isContentEditable||target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"]'))return;
 if(document.querySelector('dialog[open]'))return;
 const control=target?.closest('button,a,label,[role="button"]');if(control&&control!==playBtn)return;
 e.preventDefault();if(e.repeat)return;toggleTransportGuarded();
});
restartBtn.addEventListener('click',()=>{pauseTransport();stopAllRuntimeMedia();transportTime=transportBase=lastTransportTime=0;for(const p of preparedMedia.values())try{p.el.pause();p.el.currentTime=Number(p.item.action.inPoint)||0;}catch{}updateTransport();});addCueBtn.addEventListener('click',()=>{if(locked)return;pushHistory();const c={id:uuid(),time:Math.max(0,roundTenth(currentTransportTime())),name:`Cue ${cues.length+1}`,description:'',imageDataUrl:null,imageName:null,isBase:false,mediaActions:[]};cues.push(c);expandedCueId=c.id;renderCues();scheduleAutosave();});
let generalScrubGeneration=0;
timeline.addEventListener('pointerdown',e=>{
 const gesture=++generalScrubGeneration;
 if(e.button!==0||(!locked&&e.target.closest('.marker')))return;
 const panOnly=e.pointerType==='touch'&&generalTimelineZoom>1&&e.target!==playhead;
 const startX=e.clientX,startY=e.clientY,rect=timeline.getBoundingClientRect(),duration=projectDuration(),original=currentTransportTime(),wasPlaying=transportPlaying;
 let dragging=false;timeline.setPointerCapture(e.pointerId);
 const preview=ev=>{if(panOnly)return;if(!dragging&&Math.abs(ev.clientX-startX)<3&&Math.abs(ev.clientY-startY)<3)return;
  if(!dragging){dragging=true;pauseTransport();}ev.preventDefault();transportTime=Math.max(0,Math.min(duration,(ev.clientX-rect.left)/rect.width*duration));updateTransport();};
 const finish=ev=>{timeline.removeEventListener('pointermove',preview);timeline.removeEventListener('pointerup',finish);timeline.removeEventListener('pointercancel',finish);timeline.removeEventListener('lostpointercapture',finish);
  const tap=Math.abs(ev.clientX-startX)<5&&Math.abs(ev.clientY-startY)<5;
  if(!dragging&&!tap)return;
  if(!dragging)pauseTransport();
  const target=ev.type==='pointerup'?Math.max(0,Math.min(duration,(ev.clientX-rect.left)/rect.width*duration)):original;
  seekTransport(target).then(()=>{if(wasPlaying&&gesture===generalScrubGeneration)return playTransport();}).catch(console.warn);
 };
 timeline.addEventListener('pointermove',preview);timeline.addEventListener('pointerup',finish);timeline.addEventListener('pointercancel',finish);timeline.addEventListener('lostpointercapture',finish);
});
playhead.tabIndex=0;playhead.setAttribute('role','slider');playhead.setAttribute('aria-label',tr('Position dans la conduite'));
playhead.addEventListener('keydown',e=>{let t=currentTransportTime();if(e.key==='ArrowLeft')t-=e.shiftKey?10:1;else if(e.key==='ArrowRight')t+=e.shiftKey?10:1;else if(e.key==='Home')t=0;else if(e.key==='End')t=projectDuration();else return;e.preventDefault();seekTransport(t).catch(console.warn);});
editModeBtn.addEventListener('click',()=>{if(locked){locked=false;applyLockState();}});showModeBtn.addEventListener('click',()=>{if(!locked){locked=true;applyLockState();}});undoBtn.addEventListener('click',undoEdit);redoBtn.addEventListener('click',redoEdit);document.addEventListener('keydown',e=>{const mod=e.metaKey||e.ctrlKey;if(!mod||e.key.toLowerCase()!=='z'||locked)return;e.preventDefault();e.shiftKey?redoEdit():undoEdit();});
showTitle.addEventListener('input',()=>{scheduleAutosave();});videoOutputBtn.addEventListener('click',()=>videoOutputWindow&&!videoOutputWindow.closed?closeVideoOutput():openVideoOutput());
openProjectBtn.addEventListener('click',()=>projectFile.click());projectFile.addEventListener('change',async()=>{const f=projectFile.files?.[0];if(!f)return;try{pauseTransport();await importPackage(f);}catch(e){console.error(e);alert(tr('Impossible d’ouvrir le projet : ')+(e.message||e));}finally{projectFile.value='';}});
saveAsBtn.addEventListener('click',()=>saveProject(true));
newProjectBtn.addEventListener('click',()=>{const hasWork=showTitle.value.trim()||cues.length>0;if(hasWork&&!confirm(tr('Démarrer un nouveau projet ? Les modifications non enregistrées seront perdues.')))return;startNewProject();});


/* V1.1.26 — fiche technique PDF mise en page, autonome et compatible accents */
function pdfWinAnsiBytes(text){
  const extra={0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
  const out=[];
  const normalized=String(text||'').normalize('NFC');
  for(const ch of normalized){
    const cp=ch.codePointAt(0);
    if(cp<=0x7F || (cp>=0xA0&&cp<=0xFF)) out.push(cp);
    else out.push(extra[cp]??0x3F);
  }
  return new Uint8Array(out);
}
function pdfHex(text){return Array.from(pdfWinAnsiBytes(text),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();}
function pdfText(x,y,size,text,bold=false){return `BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm <${pdfHex(text)}> Tj ET\n`;}
function pdfFill(r,g,b){return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\n`;}
function pdfStroke(r,g,b){return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG\n`;}
function pdfRect(x,y,w,h,fill=true){return `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re ${fill?'f':'S'}\n`;}
function pdfRoundedRect(x,y,w,h,r=8){
 const k=.55228475;r=Math.min(r,w/2,h/2);const n=v=>v.toFixed(2);
 return `${n(x+r)} ${n(y)} m ${n(x+w-r)} ${n(y)} l ${n(x+w-r+r*k)} ${n(y)} ${n(x+w)} ${n(y+r-r*k)} ${n(x+w)} ${n(y+r)} c ${n(x+w)} ${n(y+h-r)} l ${n(x+w)} ${n(y+h-r+r*k)} ${n(x+w-r+r*k)} ${n(y+h)} ${n(x+w-r)} ${n(y+h)} c ${n(x+r)} ${n(y+h)} l ${n(x+r-r*k)} ${n(y+h)} ${n(x)} ${n(y+h-r+r*k)} ${n(x)} ${n(y+h-r)} c ${n(x)} ${n(y+r)} l ${n(x)} ${n(y+r-r*k)} ${n(x+r-r*k)} ${n(y)} ${n(x+r)} ${n(y)} c h f\n`;
}
function pdfLine(x1,y1,x2,y2,width=.7){return `${width.toFixed(1)} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S\n`;}
function wrapPdfText(text,maxChars){
  const paras=String(text||'').normalize('NFC').replace(/\r/g,'').split('\n'), lines=[];
  for(const para of paras){
    if(!para.trim()){lines.push('');continue;}
    const words=para.trim().split(/\s+/); let line='';
    for(const word of words){
      if(word.length>maxChars && !line){for(let i=0;i<word.length;i+=maxChars) lines.push(word.slice(i,i+maxChars));continue;}
      const trial=line?line+' '+word:word;
      if(trial.length>maxChars && line){lines.push(line);line=word;}else line=trial;
    }
    if(line)lines.push(line);
  }
  return lines;
}
async function cueImageToJpeg(dataUrl){
  if(!dataUrl)return null;
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      try{
        const canvas=document.createElement('canvas'); canvas.width=640; canvas.height=360;
        const ctx=canvas.getContext('2d'); ctx.fillStyle='#0d1118';ctx.fillRect(0,0,640,360);
        const scale=Math.min(640/img.naturalWidth,360/img.naturalHeight);
        const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
        ctx.drawImage(img,(640-w)/2,(360-h)/2,w,h);
        const jpeg=canvas.toDataURL('image/jpeg',0.84);
        const bin=atob(jpeg.split(',')[1]); const bytes=new Uint8Array(bin.length);
        for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
        resolve({bytes,width:640,height:360});
      }catch{resolve(null);}
    };
    img.onerror=()=>resolve(null); img.src=dataUrl;
  });
}
function concatBytes(parts){
  const total=parts.reduce((n,p)=>n+p.length,0), out=new Uint8Array(total);let off=0;
  for(const p of parts){out.set(p,off);off+=p.length;}return out;
}
function asciiBytes(s){return new TextEncoder().encode(s);}
function buildPdfDocument(pages){
  const catalogNum=1,pagesNum=2,fontNum=3,boldNum=4;let nextObj=5;
  for(const page of pages){page.pageObj=nextObj++;page.contentObj=nextObj++;for(const im of page.images)im.obj=nextObj++;}
  const objects=new Map();
  objects.set(catalogNum,asciiBytes(`<< /Type /Catalog /Pages ${pagesNum} 0 R >>`));
  objects.set(pagesNum,asciiBytes(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(p=>`${p.pageObj} 0 R`).join(' ')}] >>`));
  objects.set(fontNum,asciiBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  objects.set(boldNum,asciiBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  for(const page of pages){
    const xobjs=page.images.length?` /XObject << ${page.images.map((im,i)=>`/Im${i+1} ${im.obj} 0 R`).join(' ')} >>`:'';
    objects.set(page.pageObj,asciiBytes(`<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontNum} 0 R /F2 ${boldNum} 0 R >>${xobjs} >> /Contents ${page.contentObj} 0 R >>`));
    const content=asciiBytes(page.content);
    objects.set(page.contentObj,concatBytes([asciiBytes(`<< /Length ${content.length} >>\nstream\n`),content,asciiBytes('\nendstream')]));
    for(const im of page.images){
      objects.set(im.obj,concatBytes([asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`),im.bytes,asciiBytes('\nendstream')]));
    }
  }
  const parts=[asciiBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')], offsets=[0];let pos=parts[0].length;
  for(let n=1;n<nextObj;n++){
    offsets[n]=pos;const body=objects.get(n),part=concatBytes([asciiBytes(`${n} 0 obj\n`),body,asciiBytes('\nendobj\n')]);parts.push(part);pos+=part.length;
  }
  const xrefPos=pos;let xref=`xref\n0 ${nextObj}\n0000000000 65535 f \n`;
  for(let n=1;n<nextObj;n++)xref+=`${String(offsets[n]).padStart(10,'0')} 00000 n \n`;
  xref+=`trailer\n<< /Size ${nextObj} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  parts.push(asciiBytes(xref));return concatBytes(parts);
}
function technicalMediaCounts(ordered){
 const files={audio:new Set(),video:new Set()};
 for(const cue of ordered)for(const action of cue.mediaActions||[])if(files[action.kind])files[action.kind].add(action.assetKey||action.path||action.id||action.name);
 return {audio:files.audio.size,video:files.video.size};
}
let technicalHeaderImagePromise=null;
async function loadTechnicalHeaderImage(){if(location.protocol==='file:'&&!window.S2ATechnicalHeader)await loadClassicScript('./technical-header-data.js');return loadTechnicalHeaderImageFromSource();}
function loadTechnicalHeaderImageFromSource(){
 if(!technicalHeaderImagePromise)technicalHeaderImagePromise=new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>{try{
   const canvas=document.createElement('canvas');canvas.width=1190;canvas.height=200;
   const ctx=canvas.getContext('2d'),scale=Math.max(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);
   const sourceWidth=canvas.width/scale,sourceHeight=canvas.height/scale;
   const sx=(image.naturalWidth-sourceWidth)/2,sy=Math.max(0,Math.min(image.naturalHeight-sourceHeight,image.naturalHeight*.42-sourceHeight/2));
   ctx.drawImage(image,sx,sy,sourceWidth,sourceHeight,0,0,canvas.width,canvas.height);
   const shade=ctx.createLinearGradient(0,0,canvas.width,0);shade.addColorStop(0,'rgba(2,8,24,.62)');shade.addColorStop(.65,'rgba(2,8,24,.32)');shade.addColorStop(1,'rgba(2,8,24,.12)');ctx.fillStyle=shade;ctx.fillRect(0,0,canvas.width,canvas.height);
   const bottom=ctx.createLinearGradient(0,120,0,200);bottom.addColorStop(0,'rgba(2,8,24,0)');bottom.addColorStop(1,'rgba(2,8,24,.45)');ctx.fillStyle=bottom;ctx.fillRect(0,120,canvas.width,80);
   const binary=atob(canvas.toDataURL('image/jpeg',.9).split(',')[1]),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));resolve({bytes,width:canvas.width,height:canvas.height});
  }catch(error){technicalHeaderImagePromise=null;reject(error);}};
  image.onerror=()=>{technicalHeaderImagePromise=null;reject(new Error(tr('Le visuel de l’en-tête est indisponible.')));};image.src=location.protocol==='file:'?window.S2ATechnicalHeader:'./assets/conduite-header.webp';
 });return technicalHeaderImagePromise;
}
function pdfPageHeader(page,title,ordered,pageIndex,headerImage){
 page.images.push({...headerImage});
 page.content+=`q 595 0 0 100 0 742 cm /Im1 Do Q\n`;
 page.content+=pdfFill(.14,.40,.76)+pdfRect(0,742,595,3,true);
 page.content+=pdfFill(.69,.85,1)+pdfText(36,811,9,tr('CONDUITE TECHNIQUE'),true);
 const titleLines=wrapPdfText(title,48).slice(0,2);let ty=787;
 for(const line of titleLines){page.content+=pdfFill(1,1,1)+pdfText(36,ty,20,line,true);ty-=22;}
 const lastTime=ordered.length?fmt(ordered[ordered.length-1].time):'00:00.0',counts=technicalMediaCounts(ordered);
 const media=`${counts.audio}${tr(" fichier")}${counts.audio>1?'s':''}${tr(' audio')}`+(counts.video?` • ${counts.video}${tr(" fichier")}${counts.video>1?'s':''}${tr(' vidéo')}`:'');
 page.content+=pdfFill(.83,.90,.98)+pdfText(36,751,8,`${ordered.length} Cue${ordered.length>1?'s':''} • ${tr("Dernière Cue :")} ${lastTime} • ${media}`);
 page.content+=pdfFill(.34,.38,.45)+pdfText(36,731,8,tr('Temps écoulé (temps restant avant la fin)'));
 if(pageIndex>0)page.content+=pdfFill(.69,.85,1)+pdfText(494,811,8,`PAGE ${pageIndex+1}`,true);
}
function pdfCueLayout(entry,idx){
 const cue=entry.cue;
 const names=wrapPdfText(cue.name||`Cue ${idx+1}`,36);
 const descriptions=wrapPdfText(cue.description||tr('Aucune description'),52);
 const media=(cue.mediaActions||[]).flatMap(a=>wrapPdfText(a.kind==='stopAll'?`${S2ALanguage.language==='en'?'STOP ALL MEDIA':'ARRÊT TOUS LES MÉDIAS'} • ${a.transition==='fade'?`${tr("FONDU")} ${Number(a.fadeDuration||3).toFixed(1)} s`:'CUT'}`:`${a.kind==='video'?tr('VIDÉO'):'AUDIO'} • ${a.name} • IN ${fmt(a.inPoint||0)} / OUT ${fmt(a.outPoint||a.duration||0)}${a.loop?' • LOOP':''}${a.kind==='video'?` • ${a.muted?(S2ALanguage.language==='en'?'MUTED':'MUETTE'):tr('SON ACTIF')}`:` • ${a.transition==='fade'?`${tr("FONDU")} ${Number(a.fadeDuration||3).toFixed(1)} s`:'CUT'}`}`,58));
 return {names,descriptions,media};
}
function pdfCueBlock(page,entry,idx,top,layout){
 const {cue,image}=entry,{names,descriptions,media}=layout;
 const blockH=Math.max(122,28+names.length*12+descriptions.length*10+(media.length?14+media.length*9:0));
 const bottom=top-blockH;
 page.content+=pdfFill(.965,.972,.982)+pdfRoundedRect(36,bottom,523,blockH-6,9);
 page.content+=pdfFill(.14,.40,.76)+pdfRoundedRect(44,bottom+12,3,blockH-30,1.5);
 page.content+=pdfFill(.10,.12,.16)+pdfText(52,top-22,8,`CUE ${String(idx+1).padStart(2,'0')}`,true);
 page.content+=pdfFill(.14,.40,.76)+pdfText(52,top-40,12,fmt(cue.time),true);
 page.content+=pdfFill(.34,.38,.45)+pdfText(52,top-56,9,`(-${fmt(Math.max(0,projectDuration()-cue.time))})`);
 let ty=top-20;
 page.content+=pdfFill(.07,.09,.13);for(const line of names){page.content+=pdfText(137,ty,10,line,true);ty-=12;}
 ty-=3;page.content+=pdfFill(.34,.38,.45);for(const line of descriptions){page.content+=pdfText(137,ty,8,line);ty-=10;}
 if(media.length){ty-=3;page.content+=pdfFill(.14,.40,.76)+pdfText(137,ty,7,tr('MÉDIAS'),true);ty-=11;page.content+=pdfFill(.25,.29,.35);for(const line of media){page.content+=pdfText(137,ty,7,line);ty-=9;}}
 if(image){const imIndex=page.images.length+1;page.images.push({...image});const iw=142,ih=79.9,ix=401,iy=bottom+(blockH-6-ih)/2;page.content+=pdfFill(.05,.06,.08)+pdfRoundedRect(ix-3,iy-3,iw+6,ih+6,5);page.content+=`q ${iw} 0 0 ${ih.toFixed(1)} ${ix} ${iy.toFixed(1)} cm /Im${imIndex} Do Q\n`;}
 return blockH+10;
}
function pdfPageFooter(page,pageIndex,pageCount){
 page.content+=pdfFill(.14,.40,.76)+pdfRect(0,0,595,48,true);
 page.content+=pdfFill(1,1,1)+pdfText(36,30,7,tr('Toute reproduction non autorisée par l’artiste est interdite.'));
 page.content+=pdfText(36,15,7,tr('Créé avec S2A Pilot - S2A Production'));
 page.content+=pdfText(500,15,7,`Page ${pageIndex+1} / ${pageCount}`);
}
async function buildTechnicalPdfBytes(){
 ensureBaseCueInvariant();normalizeCueOrderAndNames();
 const title=(showTitle.value||'Conduite').trim().normalize('NFC')||'Conduite',ordered=[...cues].sort((a,b)=>a.time-b.time),prepared=[];
 for(const cue of ordered)prepared.push({cue:{...cue,name:String(cue.name||'').normalize('NFC'),description:String(cue.description||'').normalize('NFC')},image:await cueImageToJpeg(cue.imageDataUrl)});
 const headerImage=await loadTechnicalHeaderImage(),pages=[];let page=null,y=0,count=0;
 function newPage(){page={content:'',images:[]};pages.push(page);pdfPageHeader(page,title,ordered,pages.length-1,headerImage);y=720;count=0;}
 newPage();
 for(let idx=0;idx<prepared.length;idx++){
  const entry=prepared[idx],layout=pdfCueLayout(entry,idx),height=Math.max(122,28+layout.names.length*12+layout.descriptions.length*10+(layout.media.length?14+layout.media.length*9:0))+10;
  if(count&&(count===5||y-height<54))newPage();
  // Very long descriptions continue on another page rather than being lost or crossing the footer.
  const chunks=[];let names=[...layout.names],descriptions=[...layout.descriptions],media=[...layout.media];
  do{
   const part={names:[],descriptions:[],media:[]};let available=y-54-38;
   while(names.length&&available>=12){part.names.push(names.shift());available-=12;}
   while(!names.length&&descriptions.length&&available>=10){part.descriptions.push(descriptions.shift());available-=10;}
   if(!names.length&&!descriptions.length&&media.length&&available>=23){available-=14;while(media.length&&available>=9){part.media.push(media.shift());available-=9;}}
   chunks.push(part);y-=pdfCueBlock(page,entry,idx,y,part);count++;
   if(names.length||descriptions.length||media.length)newPage();
  }while(names.length||descriptions.length||media.length);
 }
 for(let i=0;i<pages.length;i++)pdfPageFooter(pages[i],i,pages.length);
 return{bytes:buildPdfDocument(pages),title,pages};
}
let pdfPreviewUrl=null,pdfPreviewDispose=null,pdfPreviewGeneration=0;
function closePdfPreview(){
 pdfPreviewGeneration++;$('pdfPreviewDialog').close();
 if(pdfPreviewDispose){pdfPreviewDispose();pdfPreviewDispose=null;}
 $('pdfPreviewPages').replaceChildren();
 if(pdfPreviewUrl){URL.revokeObjectURL(pdfPreviewUrl);pdfPreviewUrl=null;}
 $('pdfPreviewDownload').removeAttribute('href');
}
async function generateTechnicalPdf(){
 const old=pdfTechBtn.textContent,generation=++pdfPreviewGeneration;pdfTechBtn.disabled=true;S2AMaterial.button(pdfTechBtn,'picture_as_pdf',tr('Création de la conduite…'));
 try{
  const [{bytes,title,pages},preview]=await Promise.all([buildTechnicalPdfBytes(),loadTechnicalPreview()]);
  if(generation!==pdfPreviewGeneration)return;
  if(pdfPreviewDispose)pdfPreviewDispose();if(pdfPreviewUrl)URL.revokeObjectURL(pdfPreviewUrl);
  pdfPreviewUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const link=$('pdfPreviewDownload');link.href=pdfPreviewUrl;link.download=`${safeFileName(title)}-conduite-technique.pdf`;
  $('pdfPreviewTitle').textContent=`${tr("Conduite technique —")} ${title}`;$('pdfPreviewDialog').showModal();
  pdfPreviewDispose=preview.mountTechnicalPreview(pages,title,{
   container:$('pdfPreviewPages'),minus:$('pdfPreviewZoomOut'),plus:$('pdfPreviewZoomIn'),label:$('pdfPreviewZoomLabel'),fit:$('pdfPreviewFit')
  });
 }catch(err){closePdfPreview();console.error(err);alert(tr('Impossible de générer la conduite PDF : ')+(err?.message||err));}
 finally{pdfTechBtn.disabled=false;S2AMaterial.button(pdfTechBtn,'picture_as_pdf',old);}
}
$('pdfPreviewClose').addEventListener('click',closePdfPreview);
$('pdfPreviewDialog').addEventListener('cancel',event=>{event.preventDefault();closePdfPreview();});
pdfTechBtn.addEventListener('click',generateTechnicalPdf);


/* S2A Pilot — PWA / hors ligne */
let deferredInstallPrompt = null;
const installPromptDialog = document.getElementById('installPrompt');
const installNowBtn = document.getElementById('installNowBtn');
const installLaterBtn = document.getElementById('installLaterBtn');
const installIOSHelp = document.getElementById('installIOSHelp');

function isStandaloneMode(){
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}
function isIOSDevice(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function shouldOfferInstall(){
  if(isStandaloneMode()) return false;
  const dismissedAt = Number(localStorage.getItem('showcue-install-dismissed-at') || 0);
  return !dismissedAt || (Date.now() - dismissedAt >= 7*24*60*60*1000);
}
function showInstallPrompt(){
  if(window.S2AQuickHelp&&S2AQuickHelp.deferInstall(showInstallPrompt))return;
  if(!shouldOfferInstall()) return;
  installIOSHelp.classList.remove('show');
  installNowBtn.textContent = tr('Installer');
  if(!installPromptDialog.open) installPromptDialog.showModal();
}

window.addEventListener('beforeinstallprompt', (event)=>{
  event.preventDefault();
  deferredInstallPrompt = event;
  if(shouldOfferInstall()) setTimeout(showInstallPrompt, 450);
});

window.addEventListener('appinstalled', ()=>{
  deferredInstallPrompt = null;
  localStorage.setItem('showcue-installed','1');
  if(installPromptDialog.open) installPromptDialog.close();
});

installLaterBtn.addEventListener('click', ()=>{
  localStorage.setItem('showcue-install-dismissed-at', String(Date.now()));
  if(installPromptDialog.open) installPromptDialog.close();
});

installNowBtn.addEventListener('click', async ()=>{
  if(installIOSHelp.classList.contains('show')){
    localStorage.setItem('showcue-install-dismissed-at', String(Date.now()));
    if(installPromptDialog.open) installPromptDialog.close();
    return;
  }
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    try{ await deferredInstallPrompt.userChoice; }catch{}
    deferredInstallPrompt = null;
    if(installPromptDialog.open) installPromptDialog.close();
    return;
  }

  if(isIOSDevice()){
    installIOSHelp.classList.add('show');
    installNowBtn.textContent = tr('J’ai compris');
    return;
  }

  installIOSHelp.classList.add('show');
  installIOSHelp.innerHTML =
    '<strong>Installation :</strong><p style="margin-bottom:0">' +
    tr('Utilise le menu du navigateur puis « Installer l’application » ou ') +
    tr('« Ajouter à l’écran d’accueil ».</p>');
  installNowBtn.textContent = tr('J’ai compris');
});

installPromptDialog.addEventListener('cancel',(event)=>{
  event.preventDefault();
  localStorage.setItem('showcue-install-dismissed-at', String(Date.now()));
  installPromptDialog.close();
});

if('serviceWorker' in navigator){
  window.addEventListener('load', async ()=>{
    try{
      const registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});registration.update().catch(console.warn);
    }catch(err){
      console.warn('S2A Pilot : service worker non enregistré', err);
    }
    if(isIOSDevice() && shouldOfferInstall()){
      setTimeout(showInstallPrompt, 900);
    }
  });
}



ensureBaseCueInvariant();renderCues();applyLockState();updatePreflightUI();updateDurationEditor();startup();



$('addMediaGlobalBtn').addEventListener('click',()=>{if(!locked)$('globalMediaFile').click();});
$('globalMediaFile').addEventListener('change',async()=>{const input=$('globalMediaFile'),file=input.files?.[0];if(!file||locked)return;const cue={id:uuid(),time:Math.max(0,roundTenth(currentTransportTime())),name:file.name.replace(/\.[^.]+$/,''),description:'',imageDataUrl:null,imageName:null,isBase:false,mediaActions:[]};$('addMediaGlobalBtn').disabled=true;try{await addMediaToCue(cue,file);}catch(e){alert(tr('Impossible d’ajouter ce média : ')+(e.message||e));}finally{input.value='';setEnabled();}});

function scheduleTimelineMedia(){clearTimeout(timelineMediaTimer);timelineMediaTimer=setTimeout(renderTimelineMedia,80);}
async function renderTimelineMedia(){
 const canvas=$('projectWaveform'),tracks=$('projectMediaTracks'),status=$('projectWaveformStatus');if(!canvas)return;
 const items=allMediaActions(),d=projectDuration();const visibleCount=items.filter(i=>mediaSegmentDuration(i.action)>0&&Math.min(d,effectiveMediaEnd(i)??d)>i.start).length;timeline.style.height=Math.max(86,30+visibleCount*23)+'px';const total=timeline.clientWidth||1,viewStart=generalTimelineViewport.scrollLeft/total,viewSpan=Math.min(1,generalTimelineViewport.clientWidth/total);
 canvas.style.width=generalTimelineViewport.clientWidth+'px';canvas.style.transform=`translateX(${generalTimelineViewport.scrollLeft}px)`;
 const width=Math.min(2048,Math.max(300,Math.round(generalTimelineViewport.clientWidth*(Math.min(2,devicePixelRatio||1)))));
 const signature=JSON.stringify([width,d,viewStart,viewSpan,items.map(i=>[i.action.id,i.start,i.action.inPoint,i.action.outPoint,i.action.loop,i.action.transition,i.action.fadeDuration,i.action.muted])]);
 if(signature===timelineMediaSignature)return;timelineMediaSignature=signature;const generation=++timelineMediaGeneration;
 tracks.replaceChildren();canvas.width=width;canvas.height=72;const sums=new Float32Array(width);drawWaveform(canvas,[]);
 if(!items.length){status.textContent=tr('Ajoutez un média pour afficher sa waveform.');return;}
 status.textContent=tr('Calcul de la waveform…');let unavailable=0;const audioGains=new Map();for(let x=0;x<width;x++)for(const state of audioStateAt((viewStart+x/width*viewSpan)*d)){if(!audioGains.has(state.item.action.id))audioGains.set(state.item.action.id,new Float32Array(width));audioGains.get(state.item.action.id)[x]=state.gain;}
 for(const item of items){
  const a=item.action,seg=mediaSegmentDuration(a),end=Math.min(d,effectiveMediaEnd(item)??d);if(seg<=0||end<=item.start)continue;
  const bar=document.createElement('div');bar.className='projectMediaBar '+a.kind;bar.dataset.cueId=item.cue.id;bar.style.left=(item.start/d*100)+'%';bar.style.width=((end-item.start)/d*100)+'%';bar.textContent=(a.kind==='audio'?'♫ ':'▶ ')+a.name;bar.title=fmt(item.start)+' → '+fmt(end)+' · '+a.name;tracks.append(bar);
  // Reuse the bounded peak cache of the file editor; decode at most one new file at a time here.
  await generateMediaWaveform(a,document.createElement('canvas'),{hidden:true,textContent:''});
  if(generation!==timelineMediaGeneration)return;const peaks=mediaVisualCache.get(a.id);if(!Array.isArray(peaks)){unavailable++;continue;}if(a.kind==='video'&&a.muted)continue;
  const first=Math.max(0,Math.floor((item.start/d-viewStart)/viewSpan*width)),last=Math.min(width,Math.ceil((end/d-viewStart)/viewSpan*width));
  for(let x=first;x<last;x++){const elapsed=Math.max(0,(viewStart+x/width*viewSpan)*d-item.start),position=mediaPositionAt(a,elapsed),index=Math.min(peaks.length-1,Math.floor(position/Math.max(.1,a.duration)*peaks.length));const gain=a.kind==='audio'?(audioGains.get(a.id)?.[x]||0):1;
   sums[x]+=(peaks[index]||0)*gain;
  }
 }
 if(generation!==timelineMediaGeneration)return;const max=Math.max(1,...sums);drawWaveform(canvas,Array.from(sums,x=>x/max));status.textContent=unavailable?(S2ALanguage.language==='en'?'Combined waveform · ':'Waveform combinée · ')+unavailable+tr(' média(s) sans waveform décodable'):'';
}
if(typeof ResizeObserver==='function')new ResizeObserver(()=>{timelineMediaSignature='';scheduleTimelineMedia();}).observe(timeline);

// Safari iPad keeps accepting pinch gestures despite viewport hints: block only page zoom, preserving single-finger scrolling.
for(const event of ['gesturestart','gesturechange','gestureend'])document.addEventListener(event,e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
document.addEventListener('wheel',e=>{if(e.ctrlKey)e.preventDefault();},{passive:false});

// This manifest is requested from the network, outside the service-worker cache.
const APP_VERSION='1.4.83';document.querySelector('.appVersion').textContent='Version '+APP_VERSION;let lastVersionCheck=0,versionCheckRunning=false;
const updateNotice=document.createElement('div');updateNotice.id='updateNotice';updateNotice.hidden=true;updateNotice.setAttribute('role','status');const updateText=document.createElement('span'),updateButton=document.createElement('button');updateButton.type='button';updateButton.textContent=tr('Ouvrir la nouvelle version');updateNotice.append(updateText,updateButton);document.querySelector('main').prepend(updateNotice);
function updateVersionButton(){const b=document.getElementById('updateNotice')?.querySelector('button');if(!b)return;b.disabled=locked||transportPlaying;b.title=b.disabled?tr('Quitter le mode Show et mettre la lecture en pause pour actualiser.'):'';}
function versionIsNewer(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
async function checkAppVersion(force=false){if(versionCheckRunning||(!force&&Date.now()-lastVersionCheck<30000)||document.hidden)return;versionCheckRunning=true;lastVersionCheck=Date.now();const label=document.querySelector('.appVersion');try{const response=await fetch('./version.json?check='+Date.now(),{cache:'no-store',signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(8000):undefined});if(!response.ok)throw new Error(tr('Vérification indisponible'));const data=await response.json();if(!/^\d+\.\d+\.\d+$/.test(data.version))throw new Error(tr('Version invalide'));const newer=versionIsNewer(data.version,APP_VERSION);updateNotice.hidden=!newer;if(newer){updateText.textContent=tr('Nouvelle version ')+data.version+tr(' disponible. Quittez le mode Show pour actualiser.');updateVersionButton();}label.title=newer?tr('Version plus récente disponible sur le serveur'):tr('Version vérifiée sur le serveur');}catch{label.title=tr('Version du serveur non vérifiée : connexion indisponible.');}finally{versionCheckRunning=false;}}
updateButton.onclick=async()=>{if(locked||transportPlaying)return;try{await writeAutosave();location.assign('./actualiser.html?update='+Date.now());}catch(e){updateText.textContent=tr('Actualisation annulée : la sauvegarde locale a échoué.');}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAppVersion();});window.addEventListener('online',()=>checkAppVersion(true));setInterval(()=>{updateVersionButton();checkAppVersion();},300000);setTimeout(()=>checkAppVersion(true),1200);

const classicScriptLoads=new Map();
function loadClassicScript(path){if(classicScriptLoads.has(path))return classicScriptLoads.get(path);const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=path+(path.includes('?')?'&':'?')+'v='+APP_VERSION;script.onload=resolve;script.onerror=()=>{classicScriptLoads.delete(path);script.remove();reject(new Error(tr('Fichier de l’application indisponible : ')+path));};document.head.append(script);});classicScriptLoads.set(path,promise);return promise;}
async function loadTechnicalPreview(){if(!window.S2ATechnicalPreview)await loadClassicScript('./technical-preview.js');return window.S2ATechnicalPreview;}

window.s2aBootReady=true;

function updateGeneralZoomControls(){ $('generalZoomLabel').textContent='×'+generalTimelineZoom;$('generalZoomOut').disabled=generalTimelineZoom<=1;$('generalZoomIn').disabled=generalTimelineZoom>=32; }
function setGeneralTimelineZoom(next){if(locked)return;generalTimelineZoom=Math.max(1,Math.min(32,next));timeline.style.touchAction=generalTimelineZoom>1?'pan-x':'none';timeline.style.width=(generalTimelineZoom*100)+'%';generalTimelineViewport.scrollLeft=Math.max(0,currentTransportTime()/Math.max(.1,projectDuration())*timeline.clientWidth-generalTimelineViewport.clientWidth/2);updateGeneralZoomControls();renderTimeline();}
$('generalZoomIn').onclick=()=>setGeneralTimelineZoom(generalTimelineZoom*2);
$('generalZoomOut').onclick=()=>setGeneralTimelineZoom(generalTimelineZoom/2);
generalTimelineViewport.addEventListener('scroll',()=>scheduleTimelineMedia());updateGeneralZoomControls();

S2ALanguage.localize();$('languageSelect').onchange=()=>S2ALanguage.setLanguage($('languageSelect').value);window.addEventListener('s2a-language-change',()=>{pauseMediaPreviews();closePdfPreview();playBtn.dataset.transportState='';renderCues();S2ALanguage.localize();updateShowPanels();checkAppVersion(true);});

function updateTimelineCueLabels(){
 const host=$('timelineCueLabels');if(!host)return;
 const t=currentTransportTime(),active=getActiveCue(t),ordered=orderedCues(),width=generalTimelineViewport.clientWidth,total=timeline.clientWidth,scroll=generalTimelineViewport.scrollLeft,d=projectDuration();
 const key=JSON.stringify([active?.id,width,total,scroll,d,ordered.map(c=>[c.id,c.name,c.time])]);if(key===timelineLabelSignature)return;timelineLabelSignature=key;host.style.transform='translateX('+scroll+'px)';host.replaceChildren();if(width<1)return;
 const priority=[...(active?[active]:[]),...ordered.filter(c=>c.time>t),...ordered.filter(c=>c.time<=t&&c!==active).reverse()],occupied=[];
 for(const cue of priority){const anchor=cue.time/d*total-scroll;if(anchor<0||anchor>width)continue;
 const bubble=document.createElement('div');bubble.className='timelineCueBubble'+(cue===active?' active':cue.time<=t?' completed':'');bubble.title=cue.name||'Cue';const text=document.createElement('span');text.className='cueBubbleText';text.textContent=cue.name||'Cue';bubble.append(text);host.append(bubble);
 const w=Math.min(width,bubble.getBoundingClientRect().width),left=Math.max(0,Math.min(width-w,anchor-w/2));if(occupied.some(r=>left<r.end+6&&left+w>r.start-6)){bubble.remove();continue;}
 bubble.style.left=left+'px';bubble.style.maxWidth=Math.min(160,width)+'px';bubble.style.setProperty('--pointer-left',Math.max(5,Math.min(w-5,anchor-left))+'px');occupied.push({start:left,end:left+w});
 }
}
generalTimelineViewport.addEventListener('scroll',updateTimelineCueLabels);
window.addEventListener('resize',()=>{timelineLabelSignature='';updateTimelineCueLabels();});
updateTimelineCueLabels();

if(window.S2AQuickHelp)S2AQuickHelp.start();

function updateShowOverview(){
 const host=$('showCueOverviewRows');if(!host||!locked)return;
 const ordered=orderedCues(),active=getActiveCue(),next=getNextCue();
 const key=JSON.stringify([S2ALanguage.language,active?.id,next?.id,ordered.map(c=>[c.id,c.name,c.description,c.time,c.imageDataUrl?.length,(c.mediaActions||[]).map(a=>a.kind)])]);
 if(key===showOverviewSignature)return;showOverviewSignature=key;host.replaceChildren();
 if(!ordered.length){const empty=document.createElement('div');empty.className='small muted';empty.textContent=tr('Aucune Cue');host.append(empty);}
 for(const cue of ordered){
  const row=document.createElement('div');row.className='showOverviewRow'+(cue===active?' isActive':'')+(cue===next?' isNext':'');row.dataset.cueId=cue.id;
  if(cue===active)row.setAttribute('aria-current','step');
  const number=document.createElement('span');number.className='overviewNumber';number.textContent=String(cues.indexOf(cue)+1);
  const visual=document.createElement('div');visual.className='overviewVisual';
  if(cue.imageDataUrl){const img=document.createElement('img');img.src=cue.imageDataUrl;img.alt='';visual.append(img);}else{visual.classList.add('showOverviewPlaceholder');visual.setAttribute('aria-label',tr('Aucun visuel'));if(cue===active)visual.textContent=S2ALanguage.language==='en'?'No visual':'Pas de visuel';}
  const content=document.createElement('div');content.className='overviewContent';const name=document.createElement('div');name.className='overviewName';name.textContent=cue.name||'Cue';content.append(name);
  if(cue===active||cue===next){const description=document.createElement('div');description.className='overviewDescription';description.textContent=String(cue.description||'').trim()?cue.description:(S2ALanguage.language==='en'?'No description':'Pas de description');content.append(description);}
  const badges=document.createElement('span');badges.className='overviewBadges';renderCueMediaBadges(badges,cue);content.append(badges);
  const time=document.createElement('time');time.className='overviewTime';time.textContent=fmtDisplay(cue.time);
  row.append(number,visual,time,content);
  if(cue===next){const timing=document.createElement('div');timing.className='overviewCountdown';const clock=document.createElement('span');clock.className='overviewCountdownClock';timing.append(clock);row.append(timing);const beat=document.createElement('span');beat.className='overviewBeat';beat.setAttribute('aria-hidden','true');row.append(beat);}
  host.append(row);
 }
 requestAnimationFrame(fitShowCueList);
}

function fitShowCueList(){
 if(!locked)return;const host=$('showCueOverviewRows'),rows=Array.from(host.children).filter(row=>row.classList.contains('showOverviewRow'));
 host.style.height='auto';if(!rows.length)return;
 const activeIndex=Math.max(0,rows.findIndex(row=>row.classList.contains('isActive'))),start=activeIndex,visible=rows.slice(start,start+5);
 const height=visible.reduce((sum,row)=>sum+row.getBoundingClientRect().height,0)+Math.max(0,visible.length-1)*12;
 rows.forEach((row,index)=>{row.style.visibility=index>=start&&index<start+5?'visible':'hidden';});
 host.style.height=(height+48)+'px';host.scrollTop=rows[start].offsetTop-rows[0].offsetTop;updateShowListOverflow();
}
function updateShowListOverflow(){
 if(!locked)return;const host=$('showCueOverviewRows'),card=host.parentElement;
 card.classList.toggle('hasHiddenCues',host.scrollHeight-host.clientHeight-host.scrollTop>1);
}
window.addEventListener('resize',()=>requestAnimationFrame(fitShowCueList));

function setShowText(element,text){if(element.textContent!==text)element.textContent=text;}
function renderCueMediaBadges(host,cue){const kinds=[...new Set((cue?.mediaActions||[]).map(a=>a.kind).filter(k=>k==='audio'||k==='video'))],key=kinds.join(',')+S2ALanguage.language;if(host.dataset.kind===key)return;host.dataset.kind=key;host.replaceChildren();for(const kind of kinds){const chip=document.createElement('span');chip.className='cueMediaChip '+kind;chip.textContent=kind==='video'?tr('VIDÉO'):'AUDIO';host.append(chip);}}

function updateCountdownBeat(t){
 if(!locked)return;const host=$('showCueOverviewRows'),next=getNextCue(t),remaining=next?Math.max(0,next.time-t):Infinity;
 const urgent=!!next&&remaining<=10.0001;document.body.classList.toggle('nextCueUrgent',urgent);
 const activeImage=host.querySelector('.isActive .overviewVisual img');
 if(activeImage){const opacity=String(Math.min(1,remaining/10));if(activeImage.style.opacity!==opacity)activeImage.style.opacity=opacity;}
 const row=host.querySelector('.isNext');if(!row||row.dataset.cueId!==next?.id)return;
 const clock=row.querySelector('.overviewCountdownClock');setShowText(clock,fmtDisplay(remaining,true));row.classList.toggle('isUrgent',urgent);
 const reduced=countdownMotionPreference&&countdownMotionPreference.matches;
 const opacity=urgent?(reduced?1:.12+.88*(.5+.5*Math.cos(2*Math.PI*remaining))):0;
 row.querySelector('.overviewBeat').style.opacity=opacity.toFixed(3);
}
