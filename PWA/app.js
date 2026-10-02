function updateSpectaclePriorityLayout(){}
const $=id=>document.getElementById(id);
const showTitle=$('showTitle'),openProjectBtn=$('openProjectBtn'),projectFile=$('projectFile'),saveAsBtn=$('saveAsBtn'),lockBtn=$('lockBtn');
const undoBtn=$('undoBtn'),redoBtn=$('redoBtn'),restartBtn=$('restartBtn'),playBtn=$('playBtn'),addCueBtn=$('addCueBtn'),exportBtn=$('exportBtn'),pdfTechBtn=$('pdfTechBtn');
const clock=$('clock'),durationEl=$('duration'),timeline=$('timeline'),playhead=$('playhead'),progress=$('progress'),cueList=$('cueList'),cueCount=$('cueCount');
const activeCueName=$('activeCueName'),activeCueAt=$('activeCueAt'),activeCueDescription=$('activeCueDescription'),activeCueImage=$('activeCueImage'),activeCueShade=$('activeCueShade'),activeCueNoImage=$('activeCueNoImage');
const activeCueVisualWrap=activeCueImage.closest('.activeCueVisualWrap');
const nextCueDescription=$('nextCueDescription'),nextName=$('nextName'),nextCountdown=$('nextCountdown'),nextAt=$('nextAt'),nextImage=$('nextImage'),noNextImage=$('noNextImage');
const prepareShowBtn=$('prepareShowBtn'),preflightStatus=$('preflightStatus'),preflightStatusText=$('preflightStatusText'),preloadBin=$('preloadBin'),collapseAllCuesBtn=$('collapseAllCuesBtn');
const videoOutputBtn=$('videoOutputBtn'),videoOutputState=$('videoOutputState');
const startupProjectInfo=$('startupProjectInfo'),newProjectBtn=$('newProjectBtn'),playBtnIcon=$('playBtnIcon'),playBtnLabel=$('playBtnLabel');
const showDurationInput=$('showDurationInput'),autoDurationBtn=$('autoDurationBtn'),showDurationMode=$('showDurationMode');

const DB_NAME='showcue-prep-v1', META_STORE='autosave', ASSET_STORE='assets', LEGACY_MEDIA_STORE='media', META_KEY='latest', DB_VERSION=3;
const DEFAULT_DURATION=300, HISTORY_LIMIT=100;
let cues=[],locked=false,transportTime=0,transportPlaying=false,transportEpoch=0,transportBase=0,lastTransportTime=0,rafId=0,transportCommandGeneration=0;
let undoStack=[],redoStack=[],autosaveTimer=null,workspaceCommitted=false,currentProjectName=null;
let runtimeAudio=new Map(),runtimeVideo=null,videoOutputWindow=null,assetUrlCache=new Map(),assetBlobCache=new Map();
let preparedMedia=new Map(),preflightState='idle',preflightErrors=[],expandedCueId=null,seekGeneration=0,preflightPromise=null;
let startupSaved=null,showDurationOverride=null;
const mediaVisualCache=new Map();
const SHOWCUE_IS_IPAD=/iPad/i.test(navigator.userAgent||'')||((navigator.platform==='MacIntel'||/Macintosh/i.test(navigator.userAgent||''))&&(navigator.maxTouchPoints||0)>1);

function uuid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());}
function newBaseCue(){return{id:uuid(),time:0,name:'Cue 1',description:'',imageDataUrl:null,imageName:null,isBase:true,mediaActions:[]};}
function roundTenth(t){return Math.round((Number(t)||0)*10)/10;}
function fmt(t){let x=Math.max(0,roundTenth(Number.isFinite(t)?t:0)),tt=Math.round(x*10),m=Math.floor(tt/600);tt-=m*600;return `${String(m).padStart(2,'0')}:${String(Math.floor(tt/10)).padStart(2,'0')}.${tt%10}`;}
function parseTime(v){if(typeof v!=='string')return null;v=v.trim().replace(',','.');let m=v.match(/^(\d+):([0-5]?\d)(?:\.(\d))?$/);if(m)return roundTenth(+m[1]*60 + +m[2] + +(m[3]||0)/10);if(/^\d+(?:\.\d)?$/.test(v))return roundTenth(+v);return null;}
function safeFileName(name){return(name||'fichier').replace(/[\\/:*?"<>|]+/g,'-').trim()||'fichier';}
function clone(v){return JSON.parse(JSON.stringify(v));}
function normalizeMediaAction(a){
  if(a?.kind==='stopAll')return{id:a.id||uuid(),kind:'stopAll',name:'ARRÊT / FONDU TOUS LES MÉDIAS',transition:a?.transition==='fade'?'fade':'cut',fadeDuration:Math.max(.1,Number(a?.fadeDuration)||3)};
  const kind=a?.kind==='video'?'video':'audio',duration=Math.max(0,Number(a?.duration)||0);
  const inPoint=Math.max(0,Math.min(duration||Infinity,Number(a?.inPoint)||0));
  let outPoint=Number(a?.outPoint);
  if(!Number.isFinite(outPoint)||outPoint<=inPoint)outPoint=duration||0;
  if(duration)outPoint=Math.min(duration,outPoint);
  return{id:a?.id||uuid(),kind,assetKey:a?.assetKey||null,name:a?.name||'Média',mime:a?.mime||'application/octet-stream',size:Number(a?.size)||0,duration,transition:a?.transition==='fade'?'fade':'cut',fadeDuration:Math.max(.1,Number(a?.fadeDuration)||3),muted:a?.muted!==false,inPoint:roundTenth(inPoint),outPoint:roundTenth(outPoint),loop:!!a?.loop};
}
function mediaSegmentDuration(a){if(!a||a.kind==='stopAll')return 0;const end=(Number(a.outPoint)>Number(a.inPoint))?Number(a.outPoint):(Number(a.duration)||0);return Math.max(0,end-(Number(a.inPoint)||0));}
function mediaPositionAt(a,elapsed){const seg=mediaSegmentDuration(a),start=Number(a.inPoint)||0;if(seg<=0)return start;if(a.loop)return start+(((Math.max(0,elapsed)%seg)+seg)%seg);return Math.min(start+Math.max(0,elapsed),start+seg);}
function mediaIsActiveAt(a,elapsed){if(!a||a.kind==='stopAll'||elapsed<0)return false;const seg=mediaSegmentDuration(a);return !!a.loop ? seg>0 : elapsed<seg-.001;}
function lastStopActionBefore(t){let found=null;for(const c of [...cues].sort((a,b)=>a.time-b.time)){if(c.time>t+.0001)break;for(const a of(c.mediaActions||[]))if(a.kind==='stopAll')found={cue:c,action:a,start:c.time};}return found;}
function lastStopBefore(t){return lastStopActionBefore(t)?.start??-Infinity;}
function globalStopFadeAt(t){const s=lastStopActionBefore(t);if(!s||s.action.transition!=='fade')return null;const d=Math.max(.1,Number(s.action.fadeDuration)||3),elapsed=t-s.start;if(elapsed<0||elapsed>=d)return null;return{...s,duration:d,elapsed,factor:Math.max(0,1-elapsed/d)};}
function effectiveMediaEnd(item){const start=Number(item.start)||0,a=item.action,seg=mediaSegmentDuration(a);let end=a.loop?Infinity:start+seg;const ordered=[...cues].sort((x,y)=>(Number(x.time)||0)-(Number(y.time)||0));for(const c of ordered){const t=Number(c.time)||0;if(t<=start+.0001)continue;for(const later of(c.mediaActions||[])){if(later.kind==='stopAll'){const stopEnd=t+(later.transition==='fade'?Math.max(.1,Number(later.fadeDuration)||3):0);end=Math.min(end,stopEnd);continue;}if(a.kind==='audio'&&later.kind==='audio'){const replaceEnd=t+(later.transition==='fade'?Math.max(.1,Number(later.fadeDuration)||3):0);end=Math.min(end,replaceEnd);}else if(a.kind==='video'&&later.kind==='video'){end=Math.min(end,t);}}if(Number.isFinite(end)&&end<=t+.0001)break;}return Number.isFinite(end)?Math.max(start,end):null;}
function automaticProjectDuration(){let lastFinite=0;for(const c of cues)lastFinite=Math.max(lastFinite,Number(c.time)||0);for(const kind of['audio','video'])for(const item of allActions(kind)){const end=effectiveMediaEnd(item);if(Number.isFinite(end))lastFinite=Math.max(lastFinite,end);}return Math.max(10,lastFinite+10);}
function projectDuration(){const minCue=cues.length?Math.max(...cues.map(c=>Number(c.time)||0))+.1:0;const auto=automaticProjectDuration();return Math.max(minCue,Number.isFinite(showDurationOverride)?showDurationOverride:auto);}
function updateDurationEditor(){if(!showDurationInput)return;showDurationInput.value=fmt(projectDuration());showDurationMode.textContent=Number.isFinite(showDurationOverride)?'Personnalisée':'Automatique (+10 s)';}

function ensureBaseCueInvariant(){if(!Array.isArray(cues))cues=[];let base=cues.find(c=>c?.isBase)||cues.find(c=>roundTenth(+c.time||0)===0);if(!base){base=newBaseCue();cues.unshift(base);}base.isBase=true;base.time=0;base.description=base.description||'';base.mediaActions=(base.mediaActions||[]).map(normalizeMediaAction);for(const c of cues){if(c===base)continue;c.isBase=false;c.description=c.description||'';c.mediaActions=(c.mediaActions||[]).map(normalizeMediaAction);if(roundTenth(+c.time||0)<=0)c.time=.1;}cues.sort((a,b)=>a.time-b.time);}
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
async function getAsset(key){if(!key)return null;if(assetBlobCache.has(key))return assetBlobCache.get(key);const rec=await idbGet(ASSET_STORE,key);if(!rec?.blob)return null;assetBlobCache.set(key,rec.blob);return rec.blob;}
async function assetUrl(key){if(assetUrlCache.has(key))return assetUrlCache.get(key);const blob=await getAsset(key);if(!blob)return null;const u=URL.createObjectURL(blob);assetUrlCache.set(key,u);return u;}

function allMediaActions(){const out=[];for(const c of [...cues].sort((a,b)=>a.time-b.time))for(const a of(c.mediaActions||[]))if(a.kind!=='stopAll')out.push({cue:c,action:a,start:c.time});return out;}
function invalidatePreflight(){preflightState='idle';preflightErrors=[];for(const p of preparedMedia.values()){try{p.el.pause();p.el.remove();}catch{}}preparedMedia.clear();updatePreflightUI();}
function updatePreflightUI(){if(!preflightStatus||!preflightStatusText)return;preflightStatus.className='preflightStatus '+preflightState;const total=allMediaActions().length,ready=[...preparedMedia.values()].filter(x=>x.ready).length;if(!total){preflightStatusText.textContent='Aucun média à préparer';preflightStatus.className='preflightStatus ready';prepareShowBtn.textContent='Préparer le show';return;}if(preflightState==='preparing'){preflightStatusText.textContent=`Préparation… ${ready}/${total}`;prepareShowBtn.textContent='Préparation…';}else if(preflightState==='ready'){preflightStatusText.textContent=`${ready}/${total} médias prêts`;prepareShowBtn.textContent='Repréparer le show';}else if(preflightState==='error'){preflightStatusText.textContent=`${ready}/${total} prêts · ${preflightErrors.length} erreur${preflightErrors.length>1?'s':''}`;prepareShowBtn.textContent='Réessayer';}else{preflightStatusText.textContent=`${total} média${total>1?'s':''} à préparer`;prepareShowBtn.textContent='Préparer le show';}prepareShowBtn.disabled=preflightState==='preparing';}
function waitMediaReady(el,kind,timeout=10000){return new Promise((resolve,reject)=>{let done=false;const finish=(ok,err)=>{if(done)return;done=true;clearTimeout(timer);el.removeEventListener('loadeddata',ready);el.removeEventListener('canplay',ready);el.removeEventListener('error',fail);ok?resolve():reject(err||new Error('Média non décodable'));};const ready=()=>finish(true);const fail=()=>finish(false,new Error('Média non décodable par ce navigateur'));const timer=setTimeout(()=>{if(el.readyState>=2)finish(true);else finish(false,new Error('Délai de préchargement dépassé'));},timeout);el.addEventListener('loadeddata',ready,{once:true});el.addEventListener('canplay',ready,{once:true});el.addEventListener('error',fail,{once:true});if(el.readyState>=2)finish(true);else el.load();});}
async function prepareOneMedia(item){const existing=preparedMedia.get(item.action.id);if(existing?.ready)return existing;const url=await assetUrl(item.action.assetKey);if(!url)throw new Error(`Média introuvable : ${item.action.name}`);const el=document.createElement(item.action.kind==='video'?'video':'audio');el.preload='auto';el.src=url;el.playsInline=true;el.controls=false;el.loop=false;if(item.action.kind==='video')el.muted=true;preloadBin.appendChild(el);const rec={item,el,url,ready:false,error:null};preparedMedia.set(item.action.id,rec);el.addEventListener('ended',()=>handleRuntimeMediaEnded(item.action.id,item.action.kind));try{await waitMediaReady(el,item.action.kind);rec.ready=true;try{el.currentTime=Number(item.action.inPoint)||0;}catch{}return rec;}catch(e){rec.error=e;throw e;}}
async function prepareShowMedia(force=false){if(preflightState==='preparing'&&preflightPromise)return preflightPromise;const items=allMediaActions();if(!force&&preflightState==='ready'&&items.every(x=>preparedMedia.get(x.action.id)?.ready))return true;const run=(async()=>{preflightState='preparing';preflightErrors=[];updatePreflightUI();for(const item of items){try{await prepareOneMedia(item);}catch(e){preflightErrors.push({item,error:e});}updatePreflightUI();}preflightState=preflightErrors.length?'error':'ready';updatePreflightUI();renderCues(false);return preflightState==='ready';})();preflightPromise=run;try{return await run;}finally{preflightPromise=null;}}
function preparedRecord(item){const p=preparedMedia.get(item.action.id);return p?.ready?p:null;}

function projectMetadata(){return{format:'showcue-workspace',version:5,savedAt:Date.now(),title:showTitle.value.trim(),showDurationOverride:Number.isFinite(showDurationOverride)?roundTenth(showDurationOverride):null,cues:clone(cues)};}
async function writeAutosave(force=false){if(!workspaceCommitted&&!force)return;ensureBaseCueInvariant();await idbPut(META_STORE,META_KEY,projectMetadata());workspaceCommitted=true;}
function scheduleAutosave(){if(!workspaceCommitted)return;clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>writeAutosave().catch(console.warn),600);}
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
  }catch(err){console.warn('Migration du média V1.1.x incomplète',err);}
  return migrated;
}
function formatSavedAt(ms){if(!ms)return'';try{return new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(ms));}catch{return new Date(ms).toLocaleString();}}

async function probeMedia(file){return new Promise(resolve=>{const kind=file.type.startsWith('video/')?'video':'audio',el=document.createElement(kind),u=URL.createObjectURL(file),done=d=>{URL.revokeObjectURL(u);resolve({kind,duration:Number.isFinite(d)?d:0});};el.preload='metadata';el.onloadedmetadata=()=>done(el.duration);el.onerror=()=>done(0);el.src=u;});}
function clampTime(t){return Math.max(0,Math.min(Number(t)||0,projectDuration()));}
function currentTransportTime(){return transportPlaying?clampTime(transportBase+(performance.now()-transportEpoch)/1000):transportTime;}
function setTransportTime(t,rebuild=true){transportTime=clampTime(t);transportBase=transportTime;transportEpoch=performance.now();lastTransportTime=transportTime;if(rebuild)rebuildMediaAtTime(transportTime,transportPlaying);updateTransport();}
async function seekTransport(t){const wasPlaying=transportPlaying,nt=clampTime(t);transportTime=nt;transportBase=nt;transportEpoch=performance.now();lastTransportTime=nt;updateTransport();await rebuildMediaAtTime(nt,wasPlaying);if(wasPlaying){transportBase=nt;transportEpoch=performance.now();lastTransportTime=nt;if(!rafId)rafId=requestAnimationFrame(animationLoop);}updateTransport();}

function allActions(kind){const out=[];for(const c of [...cues].sort((a,b)=>a.time-b.time))for(const a of(c.mediaActions||[]))if(a.kind===kind)out.push({cue:c,action:a,start:c.time});return out;}
let audioContext=null;async function ensureAudioContext(){if(!audioContext)audioContext=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')await audioContext.resume();return audioContext;}
async function runtimeElementFor(item){let p=preparedRecord(item);if(!p){try{await prepareOneMedia(item);p=preparedRecord(item);}catch{return null;}}return p;}
function stopAudioRuntime(id,release=false){const rt=runtimeAudio.get(id);if(!rt)return;try{rt.el.pause();rt.el.volume=1;}catch{}runtimeAudio.delete(id);if(release&&!preparedMedia.has(id))try{rt.el.remove();}catch{}}
function stopAllAudio(){for(const id of [...runtimeAudio.keys()])stopAudioRuntime(id);}
function stopAllRuntimeMedia(){stopAllAudio();stopVideoRuntime();}
function setRuntimeGain(rt,v){try{rt.el.volume=Math.max(0,Math.min(1,v));}catch{}}
async function activateAudio(item,elapsed=0,gainValue=1,playing=transportPlaying){let rt=runtimeAudio.get(item.action.id);if(!rt){const p=await runtimeElementFor(item);if(!p)return null;rt={item,el:p.el};runtimeAudio.set(item.action.id,rt);}rt.item=item;try{rt.el.currentTime=mediaPositionAt(item.action,elapsed);}catch{}setRuntimeGain(rt,gainValue);if(playing&&transportPlaying)await rt.el.play().catch(()=>{});else rt.el.pause();return rt;}
async function triggerAudioAction(item){const previous=[...runtimeAudio.values()].filter(rt=>rt.item.action.id!==item.action.id);if(item.action.transition==='fade'&&previous.length){const rt=await activateAudio(item,0,0,true);if(!rt)return;rt.fadeStartedAt=currentTransportTime();rt.fadeDuration=Math.max(.1,Number(item.action.fadeDuration)||3);for(const p of previous){p.fadeOutStartedAt=rt.fadeStartedAt;p.fadeDuration=rt.fadeDuration;}}else{for(const p of previous)stopAudioRuntime(p.item.action.id);await activateAudio(item,0,1,true);}}
function audioStateCoreAt(t,stopCutoff=-Infinity){const acts=allActions('audio').filter(x=>x.start>=stopCutoff-.0001&&x.start<=t+.0001);if(!acts.length)return[];const latest=acts.at(-1),elapsed=t-latest.start;if(!mediaIsActiveAt(latest.action,elapsed))return[];if(latest.action.transition==='fade'&&acts.length>1&&elapsed<latest.action.fadeDuration){const prev=acts.at(-2),pe=t-prev.start,p=Math.max(0,Math.min(1,elapsed/latest.action.fadeDuration)),out=[{item:latest,elapsed,gain:p}];if(mediaIsActiveAt(prev.action,pe))out.unshift({item:prev,elapsed:pe,gain:1-p});return out;}return[{item:latest,elapsed,gain:1}];}
function audioStateAt(t){const stop=lastStopActionBefore(t);if(!stop)return audioStateCoreAt(t,-Infinity);if(stop.action.transition==='fade'){const d=Math.max(.1,Number(stop.action.fadeDuration)||3),e=t-stop.start;if(e>=0&&e<d){const before=audioStateCoreAt(Math.max(0,stop.start-.001),-Infinity),factor=Math.max(0,1-e/d);return before.map(s=>({...s,elapsed:Math.max(0,t-s.item.start),gain:s.gain*factor})).filter(s=>mediaIsActiveAt(s.item.action,s.elapsed));}}return audioStateCoreAt(t,stop.start);}
async function rebuildAudioAtTime(t,playing){stopAllAudio();for(const s of audioStateAt(t))await activateAudio(s.item,s.elapsed,s.gain,playing);}
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
async function activateVideo(item,elapsed=0,playing=transportPlaying){if(runtimeVideo?.item?.action?.id!==item.action.id){if(runtimeVideo)try{runtimeVideo.el.pause();}catch{}const p=await runtimeElementFor(item);if(!p)return null;runtimeVideo={item,el:p.el,url:p.url};}else runtimeVideo.item=item;runtimeVideo.el.muted=!!item.action.muted||!!(videoOutputWindow&&!videoOutputWindow.closed);try{runtimeVideo.el.currentTime=mediaPositionAt(item.action,elapsed);}catch{}syncVideoSurfaces();if(playing&&transportPlaying)await runtimeVideo.el.play().catch(()=>{});else runtimeVideo.el.pause();syncExternalVideo(true);return runtimeVideo;}
async function triggerVideoAction(item){await activateVideo(item,0,true);}
function videoStateCoreAt(t,stopCutoff=-Infinity){const acts=allActions('video').filter(x=>x.start>=stopCutoff-.0001&&x.start<=t+.0001),latest=acts.at(-1);if(!latest)return null;const elapsed=t-latest.start;return mediaIsActiveAt(latest.action,elapsed)?{item:latest,elapsed,opacity:1}:null;}
function videoStateAt(t){const stop=lastStopActionBefore(t);if(!stop)return videoStateCoreAt(t,-Infinity);if(stop.action.transition==='fade'){const d=Math.max(.1,Number(stop.action.fadeDuration)||3),e=t-stop.start;if(e>=0&&e<d){const s=videoStateCoreAt(Math.max(0,stop.start-.001),-Infinity);if(s)return{item:s.item,elapsed:Math.max(0,t-s.item.start),opacity:Math.max(0,1-e/d)};}}return videoStateCoreAt(t,stop.start);}
async function rebuildVideoAtTime(t,playing){const s=videoStateAt(t);if(!s){stopVideoRuntime();return;}await activateVideo(s.item,s.elapsed,playing);if(runtimeVideo)runtimeVideo.opacity=s.opacity??1;syncExternalVideo(true);}

function activeVideoAction(){return runtimeVideo?.item?.action||null;}
function syncVideoSurfaces(){updateVideoOutputControls();syncExternalVideo(true);}
function projectHasVideo(){return allActions('video').length>0;}
function updateVideoOutputControls(){const open=!!(videoOutputWindow&&!videoOutputWindow.closed),hasVideo=projectHasVideo();if(SHOWCUE_IS_IPAD){videoOutputBtn.disabled=true;videoOutputState.textContent='Sortie vidéo externe indisponible sur iPad — monitoring local actif.';}else{videoOutputBtn.disabled=!hasVideo;videoOutputBtn.classList.toggle('active',open);videoOutputState.textContent=open?'Sortie vidéo prête — noir actif':(hasVideo?'Sortie vidéo inactive — ouvre-la avant le Show':'Ajoute une vidéo pour préparer la sortie');videoOutputBtn.title=open?'Fermer la sortie vidéo':'Ouvrir la sortie vidéo sur noir';}}
function closeVideoOutput(){if(videoOutputWindow&&!videoOutputWindow.closed)try{videoOutputWindow.close();}catch{}videoOutputWindow=null;updateVideoOutputControls();}
function openVideoOutput(){
  if(SHOWCUE_IS_IPAD||!projectHasVideo())return;
  if(videoOutputWindow&&!videoOutputWindow.closed){videoOutputWindow.focus();syncExternalVideo(true);return;}
  const w=window.open('','showcue-video-output','popup=yes,width=1280,height=720');
  if(!w){alert('Le navigateur a bloqué la fenêtre vidéo. Autorise les fenêtres surgissantes pour S2A Pilot.');return;}
  videoOutputWindow=w;
  const d=w.document;
  d.open();
  d.write('<!doctype html><html><head><meta charset="utf-8"><title>S2A Pilot — Sortie vidéo</title><style>html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden;cursor:pointer}body{display:flex;align-items:center;justify-content:center}video{position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000;pointer-events:none}#showcueFullscreenHint{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:rgba(0,0,0,.18);color:#fff;font:600 18px system-ui,-apple-system,sans-serif;text-align:center;pointer-events:none;text-shadow:0 1px 4px #000}#showcueFullscreenHint.hidden{display:none}</style></head><body><video id="out" playsinline></video><div id="showcueFullscreenHint">Cliquer / toucher pour passer en plein écran</div></body></html>');
  d.close();
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
    }catch(e){console.warn('Plein écran indisponible',e);}
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
function syncExternalVideo(force=false){const outputOpen=!!(videoOutputWindow&&!videoOutputWindow.closed);if(runtimeVideo)runtimeVideo.el.muted=!!runtimeVideo.item.action.muted||outputOpen;if(!outputOpen)return;let v;try{v=videoOutputWindow.document.getElementById('out');}catch{return;}if(!v)return;if(!runtimeVideo){try{v.pause();v.removeAttribute('src');v.load();}catch{}return;}if(v.src!==runtimeVideo.url){v.src=runtimeVideo.url;v.preload='auto';v.load();}const target=runtimeVideo.el.currentTime||0;if(force||Math.abs((v.currentTime||0)-target)>.18)try{v.currentTime=target;}catch{}v.muted=!!runtimeVideo.item.action.muted;v.style.opacity=String(runtimeVideo.opacity??1);if(runtimeVideo.el.paused)v.pause();else v.play().catch(()=>{});}
async function rebuildMediaAtTime(t,playing){const generation=++seekGeneration,commandGeneration=transportCommandGeneration;await prepareShowMedia(false);if(generation!==seekGeneration||commandGeneration!==transportCommandGeneration)return;await Promise.all([rebuildAudioAtTime(t,playing&&transportPlaying),rebuildVideoAtTime(t,playing&&transportPlaying)]);}
async function onCueCrossed(cue){const actions=cue.mediaActions||[];for(const stop of actions.filter(a=>a.kind==='stopAll')){if(stop.transition==='cut')stopAllRuntimeMedia();else{const d=Math.max(.1,Number(stop.fadeDuration)||3);for(const rt of runtimeAudio.values()){rt.globalFadeStartedAt=currentTransportTime();rt.globalFadeDuration=d;}if(runtimeVideo){runtimeVideo.globalFadeStartedAt=currentTransportTime();runtimeVideo.globalFadeDuration=d;runtimeVideo.opacity=1;}}}const items=actions.filter(a=>a.kind!=='stopAll').map(action=>({cue,action,start:cue.time}));for(const item of items){if(item.action.kind==='audio')await triggerAudioAction(item);else if(item.action.kind==='video')await triggerVideoAction(item);}}

function getActiveCue(t=currentTransportTime()){let a=null;for(const c of[...cues].sort((x,y)=>x.time-y.time)){if(c.time<=t+.0001)a=c;else break;}return a;}
function getNextCue(t=currentTransportTime()){return[...cues].sort((a,b)=>a.time-b.time).find(c=>c.time>t+.0001)||null;}
function getCueAfter(cue){const a=[...cues].sort((x,y)=>x.time-y.time),i=a.indexOf(cue);return i>=0?a[i+1]||null:null;}
function updateShowPanels(){const t=currentTransportTime(),cue=getActiveCue(t);if(!cue){activeCueName.textContent='Aucune Cue';nextCountdown.classList.remove('countdownUrgent');return;}activeCueName.textContent=cue.name||'Cue';activeCueAt.textContent=`Depuis ${fmt(cue.time)}`;activeCueDescription.textContent=cue.description||'';activeCueDescription.hidden=!String(cue.description||'').trim();const n=getCueAfter(cue);let fade=n&&n.time>cue.time?Math.max(0,Math.min(1,(t-cue.time)/(n.time-cue.time))):0;activeCueShade.style.opacity=n?String(fade):'0';if(cue.imageDataUrl){if(activeCueVisualWrap)activeCueVisualWrap.hidden=false;activeCueImage.src=cue.imageDataUrl;activeCueImage.hidden=false;activeCueNoImage.hidden=true;}else{if(activeCueVisualWrap)activeCueVisualWrap.hidden=false;activeCueImage.hidden=true;activeCueImage.removeAttribute('src');activeCueShade.style.opacity='0';activeCueNoImage.hidden=false;activeCueNoImage.textContent='Aucun visuel pour cette Cue';}const next=getNextCue(t),wrap=noNextImage.closest('.nextImageWrap');if(!next){nextName.textContent=cues.length?'Fin de conduite':'Aucune Cue';nextCueDescription.textContent='';nextCueDescription.hidden=true;nextCountdown.textContent='—';nextCountdown.classList.remove('countdownUrgent');nextAt.textContent='';nextImage.hidden=true;nextImage.removeAttribute('src');noNextImage.hidden=false;noNextImage.textContent=cues.length?'Aucune autre Cue à venir':'Aucun visuel pour la prochaine Cue';wrap?.classList.add('noUpcomingCue');return;}wrap?.classList.remove('noUpcomingCue');nextName.textContent=next.name||'Cue';nextCueDescription.textContent=next.description||'';nextCueDescription.hidden=!String(next.description||'').trim();const remaining=Math.max(0,next.time-t);nextCountdown.textContent=fmt(remaining);nextCountdown.classList.toggle('countdownUrgent',locked&&remaining<=10.0001);nextAt.textContent=`Cue à ${fmt(next.time)}`;if(next.imageDataUrl){nextImage.src=next.imageDataUrl;nextImage.hidden=false;noNextImage.hidden=true;}else{nextImage.hidden=true;nextImage.removeAttribute('src');noNextImage.hidden=false;noNextImage.textContent='Aucun visuel pour la prochaine Cue';}}
function renderTimeline(){timeline.querySelectorAll('.marker,.tick').forEach(e=>e.remove());const d=projectDuration();for(let i=0;i<=4;i++){const tick=document.createElement('span');tick.className='tick';tick.style.left=`${i*25}%`;tick.textContent=fmt(d*i/4);timeline.appendChild(tick);}for(const cue of cues){const marker=document.createElement('div');marker.className='marker'+(cue.isBase?' baseCueMarker':'');marker.style.left=`${cue.time/d*100}%`;marker.title=`${fmt(cue.time)} — ${cue.name}`;marker.addEventListener('pointerdown',e=>{if(locked||cue.isBase)return;e.preventDefault();pushHistory();marker.setPointerCapture(e.pointerId);const move=ev=>{const r=timeline.getBoundingClientRect(),t=Math.max(.1,Math.min(d,(ev.clientX-r.left)/r.width*d));cue.time=roundTenth(t);renderCues(false);updateShowPanels();};const up=()=>{marker.removeEventListener('pointermove',move);marker.removeEventListener('pointerup',up);normalizeCueOrderAndNames();renderCues();scheduleAutosave();};marker.addEventListener('pointermove',move);marker.addEventListener('pointerup',up);});timeline.appendChild(marker);}}
function updateTransport(){const t=currentTransportTime(),d=projectDuration(),pct=d?Math.min(100,t/d*100):0;clock.textContent=fmt(t);durationEl.textContent=`/ ${fmt(d)}`;playhead.style.left=`${pct}%`;progress.style.width=`${pct}%`;const state=transportPlaying?'pause':'play';if(playBtn.dataset.transportState!==state){playBtn.dataset.transportState=state;playBtnIcon.textContent=transportPlaying?'Ⅱ':'▶';playBtnLabel.textContent=transportPlaying?'Pause':'Lecture';}updateShowPanels();}
function animationLoop(){rafId=0;if(!transportPlaying)return;const t=currentTransportTime();for(const c of cues){if(c.time>lastTransportTime+.0001&&c.time<=t+.0001)onCueCrossed(c).catch(console.warn);}lastTransportTime=t;updateAudioGains(t);enforceMediaBounds(t);const vs=videoStateAt(t);if(runtimeVideo){if(!vs||vs.item.action.id!==runtimeVideo.item.action.id){stopVideoRuntime();}else{const expected=mediaPositionAt(runtimeVideo.item.action,t-runtimeVideo.item.start);if(Math.abs((runtimeVideo.el.currentTime||0)-expected)>.55)try{runtimeVideo.el.currentTime=expected;}catch{}runtimeVideo.opacity=vs.opacity??1;}}syncExternalVideo();updateTransport();if(t>=projectDuration()){pauseTransport();return;}rafId=requestAnimationFrame(animationLoop);}

async function playTransport(){
  if(transportPlaying)return;
  const commandGeneration=++transportCommandGeneration;
  try{await ensureAudioContext();}catch{}
  if(commandGeneration!==transportCommandGeneration)return;
  const ok=await prepareShowMedia(false);
  if(commandGeneration!==transportCommandGeneration)return;
  if(!ok&&preflightErrors.length){const go=confirm('Certains médias n’ont pas pu être préparés. Continuer quand même ?');if(!go||commandGeneration!==transportCommandGeneration)return;}
  transportPlaying=true;transportBase=transportTime;transportEpoch=performance.now();lastTransportTime=transportTime;
  await rebuildMediaAtTime(transportTime,true);
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

function applyLockState(){document.body.classList.toggle('locked',locked);lockBtn.textContent=locked?'Mode édition':'Mode show';lockBtn.classList.toggle('showMode',locked);showTitle.disabled=locked;openProjectBtn.disabled=locked;addCueBtn.disabled=locked;exportBtn.disabled=locked;saveAsBtn.disabled=locked;if(locked&&preflightState!=='ready')prepareShowMedia(false).catch(console.warn);renderCues();syncVideoSurfaces();updateHistoryButtons();}
function setEnabled(){playBtn.disabled=false;restartBtn.disabled=false;addCueBtn.disabled=locked;exportBtn.disabled=locked;saveAsBtn.disabled=locked;openProjectBtn.disabled=locked;if(prepareShowBtn)prepareShowBtn.disabled=locked||preflightState==='preparing';}

async function addMediaToCue(cue,file){const before=captureEditableState();const probe=await probeMedia(file);const key=await storeAsset(file);pushHistory(before);cue.mediaActions=cue.mediaActions||[];cue.mediaActions.push(normalizeMediaAction({id:uuid(),kind:probe.kind,assetKey:key,name:file.name,mime:file.type,size:file.size,duration:probe.duration,inPoint:0,outPoint:probe.duration,loop:false,transition:'cut',fadeDuration:3,muted:true}));expandedCueId=cue.id;invalidatePreflight();renderCues();scheduleAutosave();}
async function generateAudioWaveform(a,canvas){if(mediaVisualCache.has(a.id)){drawWaveform(canvas,mediaVisualCache.get(a.id));return;}try{const blob=await getAsset(a.assetKey),buf=await blob.arrayBuffer(),ctx=new(window.AudioContext||window.webkitAudioContext)(),decoded=await ctx.decodeAudioData(buf.slice(0)),data=decoded.getChannelData(0),count=260,peaks=[];for(let i=0;i<count;i++){const s=Math.floor(i*data.length/count),e=Math.max(s+1,Math.floor((i+1)*data.length/count)),step=Math.max(1,Math.floor((e-s)/80));let peak=0;for(let j=s;j<e;j+=step)peak=Math.max(peak,Math.abs(data[j]||0));peaks.push(peak);}mediaVisualCache.set(a.id,peaks);drawWaveform(canvas,peaks);try{ctx.close();}catch{}}catch(e){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle='#7f8999';c.font='12px system-ui';c.fillText('Waveform indisponible',12,canvas.height/2);}}
function drawWaveform(canvas,peaks){const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(300,Math.round(r.width*dpr));canvas.height=Math.max(70,Math.round(r.height*dpr));const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.fillStyle='#0b1017';c.fillRect(0,0,w,h);c.strokeStyle='#70a9e8';c.lineWidth=Math.max(1,dpr);c.beginPath();for(let i=0;i<peaks.length;i++){const x=i/(peaks.length-1)*w,p=peaks[i]*h*.44;c.moveTo(x,h/2-p);c.lineTo(x,h/2+p);}c.stroke();c.strokeStyle='#273241';c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();}
async function generateVideoFilmstrip(a,holder){if(mediaVisualCache.has(a.id)){for(const src of mediaVisualCache.get(a.id)){const im=new Image();im.src=src;holder.append(im);}return;}try{const url=await assetUrl(a.assetKey),v=document.createElement('video');v.src=url;v.muted=true;v.playsInline=true;v.preload='metadata';await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=rej;v.load();});const frames=[],canvas=document.createElement('canvas');canvas.width=240;canvas.height=135;const c=canvas.getContext('2d'),n=7,d=Math.max(.1,a.duration||v.duration||.1);for(let i=0;i<n;i++){const t=Math.min(d-.05,d*(i+.5)/n);await new Promise(res=>{const done=()=>{v.removeEventListener('seeked',done);res();};v.addEventListener('seeked',done,{once:true});try{v.currentTime=t;}catch{res();}});try{c.drawImage(v,0,0,canvas.width,canvas.height);frames.push(canvas.toDataURL('image/jpeg',.55));}catch{}}mediaVisualCache.set(a.id,frames);for(const src of frames){const im=new Image();im.src=src;holder.append(im);}v.removeAttribute('src');v.load();}catch(e){holder.textContent='Aperçu vidéo indisponible';holder.style.padding='22px';holder.style.color='#7f8999';}}
function updateTrimVisual(a,visual,selection,inHandle,outHandle,inInput,outInput){const d=Math.max(.1,Number(a.duration)||.1),ip=Math.max(0,Math.min(100,(Number(a.inPoint)||0)/d*100)),op=Math.max(ip,Math.min(100,(Number(a.outPoint)||d)/d*100));selection.style.left=ip+'%';selection.style.width=(op-ip)+'%';inHandle.style.left=ip+'%';outHandle.style.left=op+'%';if(document.activeElement!==inInput)inInput.value=fmt(a.inPoint||0);if(document.activeElement!==outInput)outInput.value=fmt(a.outPoint||d);}
function mediaTrimEditor(cue,a){const ed=document.createElement('div');ed.className='mediaEditor';const top=document.createElement('div');top.className='mediaEditorTop';const mkField=(label,val)=>{const l=document.createElement('label');l.className='mediaEditorField';l.append(document.createTextNode(label));const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.value=fmt(val);i.disabled=locked;l.append(i);top.append(l);return i;};const inInput=mkField('IN',a.inPoint||0),outInput=mkField('OUT',a.outPoint||a.duration||0);const loopLab=document.createElement('label');loopLab.className='loopToggle';const loop=document.createElement('input');loop.type='checkbox';loop.checked=!!a.loop;loop.disabled=locked;loopLab.append(loop,document.createTextNode('Loop'));top.append(loopLab);const visual=document.createElement('div');visual.className='mediaVisual';let canvas=null;if(a.kind==='audio'){canvas=document.createElement('canvas');canvas.className='waveCanvas';visual.append(canvas);requestAnimationFrame(()=>generateAudioWaveform(a,canvas));}else{const fs=document.createElement('div');fs.className='filmstrip';visual.append(fs);generateVideoFilmstrip(a,fs);}const selection=document.createElement('div');selection.className='mediaSelection';const ih=document.createElement('div');ih.className='trimHandle';ih.title='Point IN';const oh=document.createElement('div');oh.className='trimHandle';oh.title='Point OUT';visual.append(selection,ih,oh);const labels=document.createElement('div');labels.className='mediaVisualLabels';labels.innerHTML=`<span>${fmt(0)}</span><span>${fmt(a.duration||0)}</span>`;ed.append(top,visual,labels);const commit=(which,input)=>{const v=parseTime(input.value);if(v===null){updateTrimVisual(a,visual,selection,ih,oh,inInput,outInput);return;}pushHistory();if(which==='in')a.inPoint=roundTenth(Math.max(0,Math.min(v,(a.outPoint||a.duration)-.1)));else a.outPoint=roundTenth(Math.max((a.inPoint||0)+.1,Math.min(v,a.duration||v)));expandedCueId=cue.id;preflightState='idle';updateTrimVisual(a,visual,selection,ih,oh,inInput,outInput);renderTimeline();updateDurationEditor();scheduleAutosave();};inInput.onchange=()=>commit('in',inInput);outInput.onchange=()=>commit('out',outInput);loop.onchange=()=>{pushHistory();a.loop=loop.checked;renderTimeline();updateDurationEditor();scheduleAutosave();};const drag=(which,e)=>{if(locked)return;e.preventDefault();const before=captureEditableState();const handle=which==='in'?ih:oh;handle.setPointerCapture?.(e.pointerId);const move=ev=>{const r=visual.getBoundingClientRect(),d=Math.max(.1,a.duration||.1),v=roundTenth(Math.max(0,Math.min(d,(ev.clientX-r.left)/r.width*d)));if(which==='in')a.inPoint=Math.min(v,(a.outPoint||d)-.1);else a.outPoint=Math.max((a.inPoint||0)+.1,v);updateTrimVisual(a,visual,selection,ih,oh,inInput,outInput);};const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);pushHistory(before);preflightState='idle';renderTimeline();updateDurationEditor();scheduleAutosave();};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up,{once:true});};ih.addEventListener('pointerdown',e=>drag('in',e));oh.addEventListener('pointerdown',e=>drag('out',e));updateTrimVisual(a,visual,selection,ih,oh,inInput,outInput);return ed;}
function addStopAllAction(cue){if((cue.mediaActions||[]).some(a=>a.kind==='stopAll'))return;pushHistory();cue.mediaActions=cue.mediaActions||[];cue.mediaActions.push(normalizeMediaAction({kind:'stopAll',transition:'cut',fadeDuration:3}));expandedCueId=cue.id;renderCues();scheduleAutosave();}
function mediaActionElement(cue,a){const row=document.createElement('div');row.className='mediaAction'+(a.kind==='stopAll'?' stopAllAction':'');if(a.kind==='stopAll'){const ident=document.createElement('div');ident.className='mediaActionIdentity';const badge=document.createElement('span');badge.className='mediaKindBadge';badge.textContent='STOP';const n=document.createElement('div');n.className='mediaActionName';n.textContent='ARRÊT / FONDU TOUS LES MÉDIAS';ident.append(badge,n);const opts=document.createElement('div');opts.className='mediaActionOptions';const sel=document.createElement('select');sel.innerHTML='<option value="cut">CUT</option><option value="fade">FONDU</option>';sel.value=a.transition==='fade'?'fade':'cut';sel.disabled=locked;const dur=document.createElement('input');dur.type='number';dur.min='0.1';dur.step='0.1';dur.value=Number(a.fadeDuration||3).toFixed(1);dur.disabled=locked||sel.value!=='fade';dur.title='Durée du fondu global en secondes';sel.onchange=()=>{pushHistory();a.transition=sel.value;dur.disabled=locked||a.transition!=='fade';renderCues();scheduleAutosave();};dur.onchange=()=>{pushHistory();a.fadeDuration=Math.max(.1,Number(dur.value)||3);dur.value=a.fadeDuration.toFixed(1);scheduleAutosave();};opts.append(sel,dur);const del=document.createElement('button');del.className='danger removeMediaBtn';del.type='button';del.textContent='Supprimer';del.disabled=locked;del.onclick=()=>{pushHistory();cue.mediaActions=cue.mediaActions.filter(x=>x.id!==a.id);renderCues();scheduleAutosave();};row.append(ident,opts,document.createElement('span'),del);return row;}const prep=preparedMedia.get(a.id);if(prep?.ready)row.classList.add('prepared');if(prep?.error)row.classList.add('prepareError');const ident=document.createElement('div');ident.className='mediaActionIdentity';const badge=document.createElement('span');badge.className='mediaKindBadge';badge.textContent=a.kind==='video'?'VIDÉO':'AUDIO';const names=document.createElement('div');names.style.minWidth='0';const n=document.createElement('div');n.className='mediaActionName';n.textContent=a.name;const meta=document.createElement('div');meta.className='mediaActionMeta';meta.textContent=`${fmt(mediaSegmentDuration(a))} utile / ${a.duration?fmt(a.duration):'durée inconnue'} · ${(a.size/1024/1024).toFixed(1)} Mo`;names.append(n,meta);ident.append(badge,names);const opts=document.createElement('div');opts.className='mediaActionOptions';if(a.kind==='audio'){const sel=document.createElement('select');sel.innerHTML='<option value="cut">CUT</option><option value="fade">FONDU</option>';sel.value=a.transition;sel.disabled=locked;const dur=document.createElement('input');dur.type='number';dur.min='.1';dur.step='.1';dur.value=a.fadeDuration||3;dur.disabled=locked;dur.title='Durée du fondu en secondes';dur.style.display=a.transition==='fade'?'block':'none';sel.onchange=()=>{pushHistory();a.transition=sel.value;dur.style.display=a.transition==='fade'?'block':'none';scheduleAutosave();};dur.onchange=()=>{pushHistory();a.fadeDuration=Math.max(.1,+dur.value||3);scheduleAutosave();};opts.append(sel,dur);}else{const lab=document.createElement('label');lab.className='mediaActionToggle';const chk=document.createElement('input');chk.type='checkbox';chk.checked=!!a.muted;chk.disabled=locked;chk.onchange=()=>{pushHistory();a.muted=chk.checked;scheduleAutosave();};lab.append(chk,document.createTextNode('Muette'));opts.append(lab);}const ps=document.createElement('span');ps.className='mediaActionPrep '+(prep?.ready?'ready':prep?.error?'error':'');ps.textContent=prep?.ready?'Prêt':prep?.error?'Erreur':'À préparer';const del=document.createElement('button');del.className='danger removeMediaBtn';del.type='button';del.textContent='Supprimer';del.disabled=locked;del.onclick=async()=>{pushHistory();cue.mediaActions=cue.mediaActions.filter(x=>x.id!==a.id);stopAudioRuntime(a.id);if(runtimeVideo?.item?.action?.id===a.id)stopVideoRuntime();const p=preparedMedia.get(a.id);try{p?.el?.pause();p?.el?.remove();}catch{}preparedMedia.delete(a.id);mediaVisualCache.delete(a.id);preflightState='idle';renderCues();updatePreflightUI();scheduleAutosave();};row.append(ident,opts,ps,del,mediaTrimEditor(cue,a));return row;}

function cuePreparationClass(cue){const acts=(cue.mediaActions||[]).filter(a=>a.kind!=='stopAll');if(!acts.length)return'';if(acts.some(a=>preparedMedia.get(a.id)?.error))return'error';if(acts.every(a=>preparedMedia.get(a.id)?.ready))return'ready';return'';}
function renderCues(renderTl=true){ensureBaseCueInvariant();normalizeCueOrderAndNames();if(expandedCueId&&!cues.some(c=>c.id===expandedCueId))expandedCueId=null;cueList.innerHTML='';cueCount.textContent=`${cues.length} Cue${cues.length>1?'s':''}`;cues.forEach((cue,index)=>{const acc=document.createElement('div');acc.className='cueAccordion'+(expandedCueId===cue.id?' expanded':'');const summary=document.createElement('div');summary.className='cueSummary';summary.tabIndex=0;summary.setAttribute('role','button');summary.setAttribute('aria-expanded',expandedCueId===cue.id?'true':'false');const num=document.createElement('div');num.className='cueNumber';num.textContent=`CUE ${index+1}`;const st=document.createElement('div');st.className='cueSummaryTime';st.textContent=fmt(cue.time);const sm=document.createElement('div');sm.className='cueSummaryMain';const sn=document.createElement('div');sn.className='cueSummaryName';sn.textContent=cue.name||`Cue ${index+1}`;const sd=document.createElement('div');sd.className='cueSummaryDescription';sd.textContent=cue.description||((cue.mediaActions||[]).length?'':'Aucune indication');sm.append(sn,sd);const chips=document.createElement('div');chips.className='cueSummaryMedia';for(const kind of ['audio','video']){const n=(cue.mediaActions||[]).filter(a=>a.kind===kind).length;if(n){const ch=document.createElement('span');ch.className='cueMediaChip '+cuePreparationClass(cue);ch.textContent=`${kind==='audio'?'AUDIO':'VIDÉO'}${n>1?' ×'+n:''}`;chips.append(ch);}}if((cue.mediaActions||[]).some(a=>a.kind==='stopAll')){const ch=document.createElement('span');ch.className='cueMediaChip stop';ch.textContent='STOP';chips.append(ch);}if(!(cue.mediaActions||[]).length){const ch=document.createElement('span');ch.className='cueMediaChip';ch.textContent='SANS MÉDIA';chips.append(ch);}const chev=document.createElement('div');chev.className='cueChevron';chev.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';summary.append(num,st,sm,chips,chev);const toggle=()=>{expandedCueId=expandedCueId===cue.id?null:cue.id;renderCues(false);};summary.onclick=e=>{if(e.target.closest('button,input,select,textarea,label'))return;toggle();};summary.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
const details=document.createElement('div');details.className='cueDetails';const grid=document.createElement('div');grid.className='cueEditGrid';const ti=document.createElement('input');ti.className='timeInput'+(cue.isBase?' baseCueTime':'');ti.value=fmt(cue.time);ti.disabled=locked||cue.isBase;const fields=document.createElement('div');fields.className='cueTextFields';const name=document.createElement('input');name.type='text';name.value=cue.name;name.disabled=locked;const desc=document.createElement('textarea');desc.className='cueDescription';desc.placeholder='Description / indication de conduite';desc.value=cue.description||'';desc.disabled=locked;fields.append(name,desc);if(cue.isBase){const b=document.createElement('div');b.className='baseCueBadge';b.textContent='Cue de base — permanente à 00:00.0';fields.append(b);}const imgc=document.createElement('div');imgc.className='imageControls';if(cue.imageDataUrl){const im=document.createElement('img');im.className='cueImageThumb';im.src=cue.imageDataUrl;imgc.append(im);}const il=document.createElement('label');il.className='fileLabel';il.textContent=cue.imageDataUrl?'Changer image':'Ajouter image';const ii=document.createElement('input');ii.type='file';ii.accept='image/*';ii.disabled=locked;ii.onchange=async()=>{const f=ii.files?.[0];if(!f)return;pushHistory();cue.imageDataUrl=await fileToDataURL(f);cue.imageName=f.name;expandedCueId=cue.id;renderCues();scheduleAutosave();};il.append(ii);imgc.append(il);if(cue.imageDataUrl){const ri=document.createElement('button');ri.textContent='Retirer image';ri.disabled=locked;ri.onclick=()=>{pushHistory();cue.imageDataUrl=null;cue.imageName=null;expandedCueId=cue.id;renderCues();scheduleAutosave();};imgc.append(ri);}const del=document.createElement('button');del.className='danger';del.textContent=cue.isBase?'Cue de base':'Supprimer';del.disabled=locked||cue.isBase;del.onclick=()=>{if(cue.isBase)return;pushHistory();cues.splice(cues.indexOf(cue),1);expandedCueId=null;invalidatePreflight();renderCues();scheduleAutosave();};grid.append(ti,fields,imgc,del);const panel=document.createElement('div');panel.className='cueMediaPanel';const mh=document.createElement('div');mh.className='cueMediaHeader';const mt=document.createElement('div');mt.className='cueMediaTitle';mt.textContent='MÉDIAS DÉCLENCHÉS PAR CETTE CUE';const add=document.createElement('label');add.className='fileLabel addMediaBtn';add.textContent='+ Ajouter un média';const mi=document.createElement('input');mi.type='file';mi.accept='audio/*,video/*,.mp3,.m4a,.aac,.wav,.aif,.aiff,.flac,.ogg,.mp4,.m4v,.mov,.webm';mi.disabled=locked;mi.onchange=async()=>{const f=mi.files?.[0];if(!f)return;try{await addMediaToCue(cue,f);}catch(e){alert('Impossible d’ajouter ce média : '+(e.message||e));}};add.append(mi);const actionButtons=document.createElement('div');actionButtons.className='addActionButtons';const stopBtn=document.createElement('button');stopBtn.type='button';stopBtn.className='stopAllBtn';stopBtn.textContent='+ Stop tous les médias';stopBtn.disabled=locked||(cue.mediaActions||[]).some(a=>a.kind==='stopAll');stopBtn.onclick=()=>addStopAllAction(cue);actionButtons.append(add,stopBtn);mh.append(mt,actionButtons);const list=document.createElement('div');list.className='mediaActionList';if(!(cue.mediaActions||[]).length){const empty=document.createElement('div');empty.className='cueMediaEmpty';empty.textContent='Aucun média — cette Cue peut rester une simple indication de conduite.';list.append(empty);}else for(const a of cue.mediaActions)list.append(mediaActionElement(cue,a));panel.append(mh,list);details.append(grid,panel);acc.append(summary,details);cueList.append(acc);const commitTime=()=>{if(cue.isBase){ti.value=fmt(0);return;}const t=parseTime(ti.value);if(t===null){ti.value=fmt(cue.time);return;}pushHistory();cue.time=Math.max(.1,clampTime(t));normalizeCueOrderAndNames();expandedCueId=cue.id;renderCues();scheduleAutosave();};ti.onchange=commitTime;name.onchange=()=>{pushHistory();cue.name=name.value;expandedCueId=cue.id;renderCues();scheduleAutosave();};desc.onchange=()=>{pushHistory();cue.description=desc.value;updateShowPanels();scheduleAutosave();};});if(renderTl)renderTimeline();setEnabled();updateTransport();updateDurationEditor();updatePreflightUI();updateVideoOutputControls();}
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(file);});}

function zipU16(n){return new Uint8Array([n&255,(n>>>8)&255]);}function zipU32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function zipConcat(a){const n=a.reduce((s,x)=>s+x.length,0),o=new Uint8Array(n);let p=0;for(const x of a){o.set(x,p);p+=x.length;}return o;}
function zipCrc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function zipDosDateTime(d=new Date()){const y=Math.max(1980,d.getFullYear());return{time:(d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2),date:((y-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};}
async function makeZip(entries){const enc=new TextEncoder(),lp=[],cp=[];let off=0;const dt=zipDosDateTime();for(const e of entries){const nb=enc.encode(e.name),data=e.data instanceof Uint8Array?e.data:new Uint8Array(e.data),crc=zipCrc32(data),lh=zipConcat([zipU32(0x04034b50),zipU16(20),zipU16(0x0800),zipU16(0),zipU16(dt.time),zipU16(dt.date),zipU32(crc),zipU32(data.length),zipU32(data.length),zipU16(nb.length),zipU16(0),nb]);lp.push(lh,data);cp.push(zipConcat([zipU32(0x02014b50),zipU16((3<<8)|20),zipU16(20),zipU16(0x0800),zipU16(0),zipU16(dt.time),zipU16(dt.date),zipU32(crc),zipU32(data.length),zipU32(data.length),zipU16(nb.length),zipU16(0),zipU16(0),zipU16(0),zipU16(0),zipU32((0o100644<<16)>>>0),zipU32(off),nb]));off+=lh.length+data.length;}const central=zipConcat(cp),end=zipConcat([zipU32(0x06054b50),zipU16(0),zipU16(0),zipU16(entries.length),zipU16(entries.length),zipU32(central.length),zipU32(off),zipU16(0)]);return new Blob([...lp,central,end],{type:'application/zip'});}
function dataUrlToBytes(dataUrl){const b=atob(dataUrl.slice(dataUrl.indexOf(',')+1)),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o;}
function readStoredZip(buffer){const bytes=new Uint8Array(buffer),view=new DataView(buffer),dec=new TextDecoder('utf-8'),entries=new Map();let off=0;while(off+4<=bytes.length){const sig=view.getUint32(off,true);if(sig===0x04034b50){const method=view.getUint16(off+8,true),cs=view.getUint32(off+18,true),us=view.getUint32(off+22,true),nl=view.getUint16(off+26,true),el=view.getUint16(off+28,true),ns=off+30,ds=ns+nl+el,name=dec.decode(bytes.subarray(ns,ns+nl));if(method!==0)throw new Error('Ce ZIP utilise une compression non prise en charge.');entries.set(name,bytes.slice(ds,ds+us));off=ds+cs;continue;}if(sig===0x02014b50||sig===0x06054b50)break;throw new Error('Format ZIP non reconnu.');}return entries;}
function bytesToDataUrl(bytes,mime){let s='',ch=0x8000;for(let i=0;i<bytes.length;i+=ch)s+=String.fromCharCode(...bytes.subarray(i,Math.min(i+ch,bytes.length)));return`data:${mime};base64,${btoa(s)}`;}
function mimeFromName(name){const e=(name.split('.').pop()||'').toLowerCase(),m={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp3:'audio/mpeg',wav:'audio/wav',aif:'audio/aiff',aiff:'audio/aiff',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',ogg:'audio/ogg',mp4:'video/mp4',mov:'video/quicktime',m4v:'video/x-m4v',webm:'video/webm'};return m[e]||'application/octet-stream';}
async function buildProjectPackage(){ensureBaseCueInvariant();const title=showTitle.value.trim()||'Projet S2A Pilot',entries=[],project={format:'showcue-multimedia-package',version:5,title,showDuration:roundTenth(projectDuration()),showDurationOverride:Number.isFinite(showDurationOverride)?roundTenth(showDurationOverride):null,cues:[]},assetPaths=new Map();for(let i=0;i<cues.length;i++){const c=cues[i],pc={index:i+1,time:roundTenth(c.time),name:c.name,description:c.description||'',isBase:!!c.isBase,imagePath:null,mediaActions:[]};if(c.imageDataUrl){const p=`images/${String(i+1).padStart(2,'0')}-${safeFileName(c.imageName||'cue.jpg')}`;entries.push({name:p,data:dataUrlToBytes(c.imageDataUrl)});pc.imagePath=p;}for(const a of(c.mediaActions||[])){if(a.kind==='stopAll'){pc.mediaActions.push({...a,assetKey:undefined});continue;}let p=assetPaths.get(a.assetKey);if(!p){const blob=await getAsset(a.assetKey);if(!blob)throw new Error(`Média introuvable : ${a.name}`);p=`media/${a.id}-${safeFileName(a.name)}`;assetPaths.set(a.assetKey,p);entries.push({name:p,data:new Uint8Array(await blob.arrayBuffer())});}pc.mediaActions.push({...a,path:p,assetKey:undefined});}project.cues.push(pc);}const enc=new TextEncoder();entries.push({name:'conduite.json',data:enc.encode(JSON.stringify(project,null,2))});const pdf=await buildTechnicalPdfBytes();entries.push({name:`documents/${safeFileName(title)}-fiche-technique.pdf`,data:pdf.bytes});if(typeof SHOWCUE_COMPANION_ZIP_B64==='string'&&SHOWCUE_COMPANION_ZIP_B64){try{const bin=atob(SHOWCUE_COMPANION_ZIP_B64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);entries.push({name:'companion/S2A-Copilote-1.2.2-source.zip',data:bytes});}catch(e){console.warn('Companion non inclus',e);}}entries.push({name:'LISEZ-MOI-Technicien.txt',data:enc.encode(`S2A PILOT — PACKAGE MULTIMÉDIA\n\nProjet : ${title}\nCues : ${project.cues.length}\n\nContenu :\n- conduite.json : conduite S2A Pilot\n- media/ : médias du spectacle\n- images/ : visuels de repérage\n- documents/ : fiche technique PDF\n- companion/ : source de S2A Copilote compatible avec ce format\n\nS2A Copilote doit être compilé sur macOS avant installation si aucune application précompilée n'est fournie.`)});return{blob:await makeZip(entries),suggestedName:`${safeFileName(title)}.s2apilot.zip`};}
function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
async function saveProject(saveAs=false){if(locked)return;const b=saveAs?saveAsBtn:exportBtn,old=b.textContent;b.disabled=true;b.textContent=saveAs?'Création du package…':'Enregistrement…';try{if(!saveAs){workspaceCommitted=true;await writeAutosave(true);startupSaved=await readAutosave();if(startupSaved){const title=startupSaved.title?.trim()||'Projet sans nom';startupProjectInfo.textContent=`Dernière sauvegarde : « ${title} » — ${formatSavedAt(startupSaved.savedAt)}.`;}b.textContent='Enregistré';setTimeout(()=>b.textContent=old,1200);}else{const {blob,suggestedName}=await buildProjectPackage();if('showSaveFilePicker'in window){try{const h=await window.showSaveFilePicker({suggestedName,types:[{description:'Projet S2A Pilot',accept:{'application/zip':['.zip']}}]});const w=await h.createWritable();await w.write(blob);await w.close();}catch(e){if(e.name==='AbortError')return;throw e;}}else downloadBlob(blob,suggestedName);currentProjectName=suggestedName;}}catch(e){console.error(e);alert('Impossible d’enregistrer : '+(e.message||e));}finally{if(b.textContent!=='Enregistré')b.textContent=old;setEnabled();}}
async function importPackage(file){const entries=readStoredZip(await file.arrayBuffer()),mb=entries.get('conduite.json');if(!mb)throw new Error('conduite.json introuvable.');const m=JSON.parse(new TextDecoder().decode(mb));let imported=[];if(m.version>=3&&Array.isArray(m.cues)){for(const c of m.cues){let imageDataUrl=null;if(c.imagePath&&entries.has(c.imagePath))imageDataUrl=bytesToDataUrl(entries.get(c.imagePath),mimeFromName(c.imagePath));const acts=[];for(const a of(c.mediaActions||[])){if(a.kind==='stopAll'){acts.push(normalizeMediaAction(a));continue;}if(!a.path||!entries.has(a.path))continue;const bytes=entries.get(a.path),name=a.name||a.path.split('/').pop(),mime=a.mime||mimeFromName(name),blob=new Blob([bytes],{type:mime}),key=await storeAsset(new File([blob],name,{type:mime}));acts.push(normalizeMediaAction({...a,assetKey:key,name,mime,size:bytes.length}));}imported.push({id:uuid(),time:+c.time||0,name:c.name||`Cue ${imported.length+1}`,description:c.description||'',isBase:!!c.isBase,imageDataUrl,imageName:c.imagePath?.split('/').pop()||null,mediaActions:acts});}}else{const baseCues=[];for(const c of(m.cues||[])){let imageDataUrl=null;if(c.imagePath&&entries.has(c.imagePath))imageDataUrl=bytesToDataUrl(entries.get(c.imagePath),mimeFromName(c.imagePath));baseCues.push({id:uuid(),time:+c.time||0,name:c.name||`Cue ${baseCues.length+1}`,description:c.description||'',isBase:!!c.isBase,imageDataUrl,imageName:c.imagePath?.split('/').pop()||null,mediaActions:[]});}if(!baseCues.length)baseCues.push(newBaseCue());const base=baseCues.find(c=>c.isBase)||baseCues[0];if(m.audio?.path&&entries.has(m.audio.path)){const bytes=entries.get(m.audio.path),name=m.audio.originalFileName||m.audio.fileName||'audio',mime=m.audio.mimeType||mimeFromName(name),f=new File([bytes],name,{type:mime}),key=await storeAsset(f);base.mediaActions.push(normalizeMediaAction({kind:'audio',assetKey:key,name,mime,size:bytes.length,duration:m.audio.duration||0,transition:'cut'}));}if(m.video?.path&&entries.has(m.video.path)){const bytes=entries.get(m.video.path),name=m.video.originalFileName||m.video.fileName||'video',mime=m.video.mimeType||mimeFromName(name),f=new File([bytes],name,{type:mime}),key=await storeAsset(f),probe=await probeMedia(f);base.mediaActions.push(normalizeMediaAction({kind:'video',assetKey:key,name,mime,size:bytes.length,duration:probe.duration,muted:m.video.mutedOutput!==false}));}imported=baseCues;}showTitle.value=m.title||file.name.replace(/\.s2apilot\.zip$|\.showcue\.zip$|\.zip$/i,'');showDurationOverride=Number.isFinite(m.showDurationOverride)?roundTenth(m.showDurationOverride):null;cues=imported;ensureBaseCueInvariant();workspaceCommitted=true;currentProjectName=file.name;transportTime=0;expandedCueId=null;invalidatePreflight();await writeAutosave(true);renderCues();resetHistory();await rebuildMediaAtTime(0,false);}

async function loadWorkspace(saved){showTitle.value=saved.title||'';showDurationOverride=Number.isFinite(saved.showDurationOverride)?roundTenth(saved.showDurationOverride):null;cues=clone(saved.cues||[]).map(c=>({...c,mediaActions:(c.mediaActions||[]).map(normalizeMediaAction)}));ensureBaseCueInvariant();workspaceCommitted=true;transportTime=0;expandedCueId=null;invalidatePreflight();renderCues();resetHistory();await rebuildMediaAtTime(0,false);}
function startNewProject(){pauseTransport();stopAllAudio();stopVideoRuntime();showTitle.value='';showDurationOverride=null;cues=[newBaseCue()];workspaceCommitted=false;currentProjectName=null;transportTime=0;expandedCueId=cues[0].id;invalidatePreflight();resetHistory();renderCues();}
async function startup(){try{startupSaved=await readAutosave();}catch(e){console.warn(e);}if(startupSaved?.cues?.length){const title=startupSaved.title?.trim()||'Projet sans nom';startupProjectInfo.textContent=`Dernière sauvegarde : « ${title} » — ${formatSavedAt(startupSaved.savedAt)}.`;try{await loadWorkspace(startupSaved);}catch(e){console.warn(e);startNewProject();}}else{startupProjectInfo.textContent='Aucune sauvegarde locale détectée.';startNewProject();}}

playBtn.addEventListener('click',()=>transportPlaying?pauseTransport():playTransport());restartBtn.addEventListener('click',async()=>{const wasPlaying=transportPlaying;if(wasPlaying)await seekTransport(0);else{pauseTransport();await seekTransport(0);}});addCueBtn.addEventListener('click',()=>{if(locked)return;pushHistory();const c={id:uuid(),time:Math.max(.1,roundTenth(currentTransportTime())),name:`Cue ${cues.length+1}`,description:'',imageDataUrl:null,imageName:null,isBase:false,mediaActions:[]};cues.push(c);expandedCueId=c.id;renderCues();scheduleAutosave();});
timeline.addEventListener('pointerdown',e=>{if(e.target.closest('.marker'))return;const r=timeline.getBoundingClientRect();seekTransport((e.clientX-r.left)/r.width*projectDuration()).catch(console.warn);});
lockBtn.addEventListener('click',()=>{locked=!locked;applyLockState();});undoBtn.addEventListener('click',undoEdit);redoBtn.addEventListener('click',redoEdit);document.addEventListener('keydown',e=>{const mod=e.metaKey||e.ctrlKey;if(!mod||e.key.toLowerCase()!=='z'||locked)return;e.preventDefault();e.shiftKey?redoEdit():undoEdit();});
showTitle.addEventListener('change',()=>{scheduleAutosave();});videoOutputBtn.addEventListener('click',()=>videoOutputWindow&&!videoOutputWindow.closed?closeVideoOutput():openVideoOutput());prepareShowBtn.addEventListener('click',()=>prepareShowMedia(true).catch(e=>{console.error(e);preflightState='error';preflightErrors=[{error:e}];updatePreflightUI();}));collapseAllCuesBtn.addEventListener('click',()=>{expandedCueId=null;renderCues(false);});
showDurationInput.addEventListener('change',()=>{const v=parseTime(showDurationInput.value);if(v===null){updateDurationEditor();return;}const min=cues.length?Math.max(...cues.map(c=>c.time))+.1:.1;pushHistory();showDurationOverride=roundTenth(Math.max(min,v));transportTime=Math.min(transportTime,projectDuration());renderTimeline();updateTransport();updateDurationEditor();scheduleAutosave();});
autoDurationBtn.addEventListener('click',()=>{pushHistory();showDurationOverride=null;transportTime=Math.min(transportTime,projectDuration());renderTimeline();updateTransport();updateDurationEditor();scheduleAutosave();});
openProjectBtn.addEventListener('click',()=>projectFile.click());projectFile.addEventListener('change',async()=>{const f=projectFile.files?.[0];if(!f)return;try{pauseTransport();await importPackage(f);}catch(e){console.error(e);alert('Impossible d’ouvrir le projet : '+(e.message||e));}finally{projectFile.value='';}});
exportBtn.addEventListener('click',()=>saveProject(false));saveAsBtn.addEventListener('click',()=>saveProject(true));
newProjectBtn.addEventListener('click',()=>{const hasWork=showTitle.value.trim()||cues.some((c,i)=>i>0||(c.mediaActions||[]).length||c.imageDataUrl||c.description);if(hasWork&&!confirm('Démarrer un nouveau projet ? Les modifications non enregistrées seront perdues.'))return;startNewProject();});


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
function pdfPageHeader(page,title,ordered,pageIndex){
  page.content+=pdfFill(.055,.071,.102)+pdfRect(0,742,595,100,true);
  page.content+=pdfFill(.45,.18,.78)+pdfRect(0,742,595,5,true);
  page.content+=pdfFill(1,1,1)+pdfText(36,814,8,'SHOWCUE  •  FICHE TECHNIQUE DE CONDUITE',true);
  const titleLines=wrapPdfText(title,48).slice(0,2);
  let ty=786;
  for(const line of titleLines){page.content+=pdfText(36,ty,21,line,true);ty-=23;}
  const lastTime=ordered.length?fmt(ordered[ordered.length-1].time):'00:00.0';
  page.content+=pdfFill(.78,.82,.88)+pdfText(36,755,9,`${ordered.length} Cue${ordered.length>1?'s':''}  •  Dernière Cue : ${lastTime}`);
  if(pageIndex>0){page.content+=pdfFill(.78,.82,.88)+pdfText(494,814,8,`PAGE ${pageIndex+1}`,true);}
}
function pdfCueBlock(page,entry,idx,top){
  const {cue,image}=entry;
  const nameLines=wrapPdfText(cue.name||`Cue ${idx+1}`,29).slice(0,2);
  const descLines=wrapPdfText(cue.description||'',43).slice(0,5);
  const mediaLines=(cue.mediaActions||[]).slice(0,4).map(a=>a.kind==='stopAll'?`ARRÊT TOUS LES MÉDIAS  •  ${a.transition==='fade'?`FONDU ${Number(a.fadeDuration||3).toFixed(1)} s`:'CUT'}`:`${a.kind==='video'?'VIDÉO':'AUDIO'}  •  ${a.name}  •  IN ${fmt(a.inPoint||0)} / OUT ${fmt(a.outPoint||a.duration||0)}${a.loop?'  •  LOOP':''}${a.kind==='video'?`  •  ${a.muted?'MUETTE':'SON ACTIF'}`:`  •  ${a.transition==='fade'?`FONDU ${Number(a.fadeDuration||3).toFixed(1)} s`:'CUT'}`}`);
  const textNeed=62+nameLines.length*15+Math.max(0,descLines.length)*12+mediaLines.length*12;
  const blockH=Math.max(image?126:94,textNeed);
  const bottom=top-blockH;
  page.content+=pdfFill(.965,.972,.982)+pdfRect(36,bottom,523,blockH-6,true);
  page.content+=pdfFill(.45,.18,.78)+pdfRect(36,bottom,4,blockH-6,true);
  page.content+=pdfFill(.10,.12,.16)+pdfText(52,top-24,8,`CUE ${String(idx+1).padStart(2,'0')}`,true);
  page.content+=pdfFill(.45,.18,.78)+pdfText(52,top-43,13,fmt(cue.time),true);
  let ty=top-24;
  page.content+=pdfFill(.07,.09,.13);
  for(const line of nameLines){page.content+=pdfText(142,ty,13,line,true);ty-=16;}
  if(descLines.length){
    ty-=4; page.content+=pdfFill(.34,.38,.45);
    for(const line of descLines){page.content+=pdfText(142,ty,9,line);ty-=12;}
  }else{
    page.content+=pdfFill(.52,.56,.62)+pdfText(142,ty-7,8,'Aucune description');ty-=18;
  }
  if(mediaLines.length){
    ty-=4;page.content+=pdfFill(.45,.18,.78);page.content+=pdfText(142,ty,7,'MÉDIAS',true);ty-=11;
    page.content+=pdfFill(.25,.29,.35);for(const line of mediaLines){for(const wrapped of wrapPdfText(line,42).slice(0,2)){page.content+=pdfText(142,ty,7.5,wrapped);ty-=10;}}
  }
  if(image){
    const imIndex=page.images.length+1;page.images.push(image);
    const iw=142,ih=79.9,ix=401,iy=bottom+(blockH-6-ih)/2;
    page.content+=pdfFill(.05,.06,.08)+pdfRect(ix-2,iy-2,iw+4,ih+4,true);
    page.content+=`q ${iw} 0 0 ${ih.toFixed(1)} ${ix} ${iy.toFixed(1)} cm /Im${imIndex} Do Q\n`;
  }
  return blockH+10;
}
function pdfPageFooter(page,pageIndex,pageCount){
  page.content+=pdfStroke(.82,.84,.88)+pdfLine(36,34,559,34,.6);
  page.content+=pdfFill(.40,.43,.49)+pdfText(36,19,8,'Créé avec S2A Pilot — S2A Production');
  page.content+=pdfText(500,19,8,`Page ${pageIndex+1} / ${pageCount}`);
}
async function buildTechnicalPdfBytes(){ensureBaseCueInvariant();normalizeCueOrderAndNames();const title=(showTitle.value||'Conduite').trim().normalize('NFC')||'Conduite';const ordered=[...cues].sort((a,b)=>a.time-b.time);const prepared=[];for(const cue of ordered)prepared.push({cue:{...cue,name:String(cue.name||'').normalize('NFC'),description:String(cue.description||'').normalize('NFC')},image:await cueImageToJpeg(cue.imageDataUrl)});const pages=[];let page=null,y=0;function newPage(){page={content:'',images:[]};pages.push(page);pdfPageHeader(page,title,ordered,pages.length-1);y=720;}newPage();for(let idx=0;idx<prepared.length;idx++){const entry=prepared[idx],nameLines=wrapPdfText(entry.cue.name||`Cue ${idx+1}`,29).slice(0,2),descLines=wrapPdfText(entry.cue.description||'',43).slice(0,5),mediaCount=Math.min(4,(entry.cue.mediaActions||[]).length),estimated=Math.max(entry.image?126:94,62+nameLines.length*15+descLines.length*12+mediaCount*12)+10;if(y-estimated<48)newPage();y-=pdfCueBlock(page,entry,idx,y);}for(let i=0;i<pages.length;i++)pdfPageFooter(pages[i],i,pages.length);return{bytes:buildPdfDocument(pages),title};}
async function generateTechnicalPdf(){const old=pdfTechBtn.textContent;pdfTechBtn.disabled=true;pdfTechBtn.textContent='Création du PDF…';try{const {bytes,title}=await buildTechnicalPdfBytes(),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${safeFileName(title)}-fiche-technique.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(err){console.error(err);alert('Impossible de générer la fiche technique PDF : '+(err?.message||err));}finally{pdfTechBtn.disabled=false;pdfTechBtn.textContent=old;}}
pdfTechBtn.addEventListener('click',generateTechnicalPdf);


/* ShowCue V1.1 — PWA / hors ligne */
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
  if(!shouldOfferInstall()) return;
  installIOSHelp.classList.remove('show');
  installNowBtn.textContent = 'Installer';
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
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    try{ await deferredInstallPrompt.userChoice; }catch{}
    deferredInstallPrompt = null;
    if(installPromptDialog.open) installPromptDialog.close();
    return;
  }

  if(isIOSDevice()){
    installIOSHelp.classList.add('show');
    installNowBtn.textContent = 'Instructions affichées';
    return;
  }

  installIOSHelp.classList.add('show');
  installIOSHelp.innerHTML =
    '<strong>Installation :</strong><p style="margin-bottom:0">' +
    'Utilise le menu du navigateur puis « Installer l’application » ou ' +
    '« Ajouter à l’écran d’accueil ».</p>';
  installNowBtn.textContent = 'Instructions affichées';
});

installPromptDialog.addEventListener('cancel',(event)=>{
  event.preventDefault();
  localStorage.setItem('showcue-install-dismissed-at', String(Date.now()));
  installPromptDialog.close();
});

if('serviceWorker' in navigator){
  window.addEventListener('load', async ()=>{
    try{
      await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
    }catch(err){
      console.warn('S2A Pilot : service worker non enregistré', err);
    }
    if(isIOSDevice() && shouldOfferInstall()){
      setTimeout(showInstallPrompt, 900);
    }
  });
}



ensureBaseCueInvariant();renderCues();applyLockState();updatePreflightUI();updateDurationEditor();startup();


