window.s2aBootPhase='interface';
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
const startupProjectInfo=$('startupProjectInfo'),newProjectBtn=$('newProjectBtn'),playBtnLabel=$('playBtnLabel');

const DB_NAME='s2a-pilot-beta-1-6', META_STORE='autosave', ASSET_STORE='assets', LEGACY_MEDIA_STORE='media', META_KEY='latest', DB_VERSION=3;
const DEFAULT_DURATION=300, HISTORY_LIMIT=100, TRANSPORT_GUARD_MS=500;
let cues=[],locked=false,transportTime=0,transportPlaying=false,transportEpoch=0,transportBase=0,lastTransportTime=0,rafId=0,transportCommandGeneration=0;
let undoStack=[],redoStack=[],autosaveTimer=null,workspaceCommitted=false,currentProjectName=null;
const mediaGainNodes=new WeakMap();
let runtimeAudio=new Map(),runtimeVideo=null,videoOutputWindow=null,assetUrlCache=new Map(),assetBlobCache=new Map();
let preparedMedia=new Map(),preflightState='idle',preflightErrors=[],expandedCueId=null,seekGeneration=0,preflightPromise=null;
const openManualCueEditors=new Set(),closedManualCueEditors=new Set(),foldedManualCueRows=new Set();
let manualCueListEpoch=-1;
const defaultCueTypes=[
 {id:'none',name:'Sans type',color:'#aeb8c6'},
 {id:'sound',name:'Son',color:'#8fc5ff'},
 {id:'light',name:'Lumière',color:'#ffd166'},
 {id:'effect',name:'FX',color:'#ff838b'}
];
let customCueTypes=[],cueTypeFilters={edit:null,live:null};
const batchCueIds=new Set();
let cueBatchMode=false,cueBatchEpoch=-1;
let cueGroups=[];
const lightingCatalog={
 wash:{label:'Lyre wash',mark:'W',group:'Projecteurs',color:'#75abff',shape:'moving'},
 beam:{label:'Lyre beam',mark:'B',group:'Projecteurs',color:'#73bfff',shape:'moving'},
 spot:{label:'Lyre spot',mark:'S',group:'Projecteurs',color:'#ac97ff',shape:'moving'},
 par:{label:'Par LED',mark:'PAR',group:'Projecteurs',color:'#68d8c9',shape:'par'},
 profile:{label:'Découpe',mark:'D',group:'Projecteurs',color:'#ffce7b',shape:'profile'},
 pc:{label:'PC',mark:'PC',group:'Projecteurs',color:'#ffe5ac',shape:'profile'},
 bar:{label:'Barre LED',mark:'LED',group:'Projecteurs',color:'#88dcff',shape:'bar'},
 sun:{label:'Sunstrip',mark:'SUN',group:'Projecteurs',color:'#ffb26e',shape:'bar'},
 fog:{label:'Machine à brouillard',mark:'F',group:'FX',color:'#a0d8e1',shape:'effect'},
 spark:{label:'Machine à étincelles',mark:'E',group:'FX',color:'#ffb981',shape:'effect'},
 geyser:{label:'Geyser de fumée',mark:'G',group:'FX',color:'#f39abe',shape:'effect'},
 snow:{label:'Machine à neige',mark:'N',group:'FX',color:'#b1dfff',shape:'effect'},
 stand:{label:'Pied Gravity',mark:'P',group:'Supports',color:'#b1bfd3',shape:'stand'},
 totem:{label:'Totem',mark:'T',group:'Supports',color:'#b1bfd3',shape:'totem'},
 leg:{label:'Pendrillon',mark:'PD',group:'Scénographie',color:'#8995aa',shape:'curtain'},
 backdrop:{label:'Rideau de fond',mark:'RF',group:'Scénographie',color:'#8995aa',shape:'curtain'},
 spider:{label:'Spider',mark:'SP',group:'Scénographie',color:'#8995aa',shape:'curtain'},
 speaker:{label:'Enceinte',mark:'HP',group:'Son',color:'#99d49d',shape:'speaker'}
};

let pilotTools=normalizePilotTools();
const liveCueGroupFolds=new Map();
let startupSaved=null,showDurationOverride=null,showLayout='maverick',copilotProjectEpoch=0,copilotProjectId=null,backstageTops=[],copilotTransportSignature='',lastBackgroundTransportTick=0;
let editCueSelectionRevision=0;
let manualArmedID=null,manualArmExplicit=false,manualPauseAudioPositions=null,editBlockPreview=null;
const individuallyStoppedAudio=new Set();
let conductType='autopilot',manualCurrentID=null,manualCompletedID=null,manualPending=false,manualPendingGeneration=null,manualLastGO=-Infinity,manualFade=null,manualPausedAt=null,manualPausePending=false,manualWaitCueID=null,manualWaitDeferred=[];
const mediaVisualCache=new Map();
const generalTimelineViewport=$('generalTimelineViewport');let generalTimelineZoom=1;
const TIMELINE_WINDOW_SECONDS=8*60;
let timelineZoomFactor=1,timelinePinchUntil=0,manualTimelinePan=false;const manualTimelineTouches=new Map();let manualPanOrigin=null;
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
const TRACK_GAIN_MIN=-24,TRACK_GAIN_MAX=12;
function normalizeTrackGain(value){
 const db=Number(value);
 return Number.isFinite(db)?roundTenth(Math.max(TRACK_GAIN_MIN,Math.min(TRACK_GAIN_MAX,db))):0;
}
const GO_GUARD_DEFAULT=500,GO_GUARD_MAX=2000;
const goGuardStorage='s2a-go-guard-ms';
function readLocalSetting(key){
 try{return JSON.parse(localStorage.getItem(key));}catch(error){return null;}
}
function writeLocalSetting(key,value){
 try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(error){return false;}
}
let goGuardMs=readLocalSetting(goGuardStorage);
if(!Number.isInteger(goGuardMs)||goGuardMs<0||goGuardMs>GO_GUARD_MAX)goGuardMs=GO_GUARD_DEFAULT;
function normalizeLevelMatch(value){
 const db=Number(value);
 return Number.isFinite(db)?roundTenth(Math.max(-72,Math.min(36,db))):0;
}
function trackOutputDb(action,trim=action.gainDb){return normalizeTrackGain(trim)+normalizeLevelMatch(action.levelMatchDb);}
function trackGainFactor(db){return Math.pow(10,db/20);}
function normalizeTrackPan(value){return value===-1||value===1?value:0;}
function connectTrackPan(context,source,destination){
 if(typeof context.createStereoPanner==='function'){
  const panner=context.createStereoPanner();
  source.connect(panner);panner.connect(destination);
  return {set(value){if(panner.pan.value!==value)panner.pan.value=value;},disconnect(){panner.disconnect();}};
 }
 // Older Web Audio implementations can route the downmixed signal explicitly.
 const center=context.createGain(),mono=context.createGain(),left=context.createGain(),right=context.createGain(),stereo=context.createChannelMerger(2);
 mono.channelCount=1;mono.channelCountMode='explicit';
 source.connect(center);center.connect(destination);source.connect(mono);
 mono.connect(left);mono.connect(right);
 left.connect(stereo,0,0);right.connect(stereo,0,1);stereo.connect(destination);
 let current=null;
 return {
  set(value){
   if(current===value)return;
   current=value;
   center.gain.value=value===0?1:0;left.gain.value=value===-1?1:0;right.gain.value=value===1?1:0;
  },
  disconnect(){center.disconnect();mono.disconnect();left.disconnect();right.disconnect();stereo.disconnect();}
 };
}
function normalizeMediaAction(a){
  if(a?.kind==='stopAll')return{id:a.id||uuid(),kind:'stopAll',name:tr('ARRÊT / FONDU TOUS LES MÉDIAS'),transition:a?.transition==='fade'?'fade':'cut',fadeDuration:Math.max(.1,Number(a?.fadeDuration)||3)};
  const kind=a?.kind==='video'?'video':'audio',duration=Math.max(0,Number(a?.duration)||0);
  const inPoint=Math.max(0,Math.min(duration||Infinity,Number(a?.inPoint)||0));
  let outPoint=Number(a?.outPoint);
  if(!Number.isFinite(outPoint)||outPoint<=inPoint)outPoint=duration||0;
  if(duration)outPoint=Math.min(duration,outPoint);
  return{id:a?.id||uuid(),kind,assetKey:a?.assetKey||null,name:a?.name||tr('Média'),mime:a?.mime||'application/octet-stream',size:Number(a?.size)||0,duration,transition:a?.transition==='fade'?'fade':'cut',fadeDuration:Math.max(.1,Number(a?.fadeDuration)||3),muted:a?.muted!==false,inPoint:roundTenth(inPoint),outPoint:roundTenth(outPoint),loop:!!a?.loop,autoNext:kind==='audio'&&a?.autoNext===true,autoNextFadeSeconds:kind==='audio'?normalizeAutoNextFade(a?.autoNextFadeSeconds):0,gainDb:kind==='audio'?normalizeTrackGain(a?.gainDb):undefined,levelMatchDb:kind==='audio'?normalizeLevelMatch(a?.levelMatchDb)||undefined:undefined,pan:kind==='audio'?normalizeTrackPan(a?.pan):undefined,gainLineUnlocked:kind==='audio'&&a?.gainLineUnlocked===true,keepBackground:kind==='audio'&&a?.keepBackground===true,overlayAudio:kind==='audio'&&a?.overlayAudio===true,ltc:kind==='audio'&&a?.ltc===true,ltcStartFrame:kind==='audio'?normalizeLtcStartFrame(a?.ltcStartFrame):0,ltcLead:kind==='audio'?normalizeLtcLead(a?.ltcLead):0};
}
function mediaSegmentDuration(a){if(!a||a.kind==='stopAll')return 0;const end=(Number(a.outPoint)>Number(a.inPoint))?Number(a.outPoint):(Number(a.duration)||0);return Math.max(0,end-(Number(a.inPoint)||0));}
function mediaLoops(a){return !!a?.loop&&(a.kind!=='audio'||conductType==='manual');}
function mediaPositionAt(a,elapsed){const seg=mediaSegmentDuration(a),start=Number(a.inPoint)||0;if(seg<=0)return start;if(mediaLoops(a))return start+(((Math.max(0,elapsed)%seg)+seg)%seg);return Math.min(start+Math.max(0,elapsed),start+seg);}
function mediaIsActiveAt(a,elapsed){if(!a||a.kind==='stopAll'||elapsed<0)return false;const seg=mediaSegmentDuration(a);return mediaLoops(a) ? seg>0 : elapsed<seg-.001;}
function lastStopActionBefore(t,cueList=orderedCues()){let found=null;for(const c of cueList){if(c.time>t+.0001)break;for(const a of(c.mediaActions||[]))if(a.kind==='stopAll')found={cue:c,action:a,start:c.time};}return found;}
function lastStopBefore(t){return lastStopActionBefore(t)?.start??-Infinity;}
function globalStopFadeAt(t){const s=lastStopActionBefore(t);if(!s||s.action.transition!=='fade')return null;const d=Math.max(.1,Number(s.action.fadeDuration)||3),elapsed=t-s.start;if(elapsed<0||elapsed>=d)return null;return{...s,duration:d,elapsed,factor:Math.max(0,1-elapsed/d)};}
function effectiveMediaEnd(item,cueList=cues){const start=Number(item.start)||0,a=item.action,seg=mediaSegmentDuration(a);let end=mediaLoops(a)?Infinity:start+seg;const ordered=[...cueList].sort((x,y)=>(Number(x.time)||0)-(Number(y.time)||0));for(const c of ordered){const t=Number(c.time)||0;if(t<=start+.0001)continue;for(const later of(c.mediaActions||[])){if(later.kind==='stopAll'){const stopEnd=t+(later.transition==='fade'?Math.max(.1,Number(later.fadeDuration)||3):0);end=Math.min(end,stopEnd);continue;}if(a.kind==='audio'&&later.kind==='audio'){const replaceEnd=t+(later.transition==='fade'?Math.max(.1,Number(later.fadeDuration)||3):0);end=Math.min(end,replaceEnd);}else if(a.kind==='video'&&later.kind==='video'){end=Math.min(end,t);}}if(Number.isFinite(end)&&end<=t+.0001)break;}return Number.isFinite(end)?Math.max(start,end):null;}
function automaticProjectDuration(){let lastFinite=0;for(const c of cues)if(c.manualKind==='silent')lastFinite=Math.max(lastFinite,c.time+(Number(c.manualDuration)||0));for(const c of cues)lastFinite=Math.max(lastFinite,Number(c.time)||0);for(const kind of['audio','video'])for(const item of allActions(kind)){const end=effectiveMediaEnd(item);if(Number.isFinite(end))lastFinite=Math.max(lastFinite,end);}return Math.max(10,lastFinite+10);}
let durationCache=null;
function projectDuration(){if(durationCache!==null)return durationCache;const minCue=cues.length?Math.max(...cues.map(c=>Number(c.time)||0))+(conductType==='manual'?0:.1):0;if(conductType==='manual'){const end=cues.reduce((end,c)=>isManualMainCue(c)?Math.max(end,c.time+(Number.isFinite(manualDuration(c))?manualDuration(c):mediaSegmentDuration((c.mediaActions||[]).find(a=>a.kind==='audio')))):end,0);return durationCache=Math.max(10,minCue,end,Number.isFinite(showDurationOverride)?showDurationOverride:0);}const auto=automaticProjectDuration();return durationCache=Math.max(minCue,Number.isFinite(showDurationOverride)?showDurationOverride:auto);}
function updateDurationEditor(){invalidateComputationCaches();}

function ensureBaseCueInvariant(){if(!Array.isArray(cues))cues=[];for(const c of cues){c.isBase=false;c.time=Math.max(0,roundTenth(c.time));c.description=c.description||'';c.mediaActions=(c.mediaActions||[]).map(a=>Object.assign(a,normalizeMediaAction(a)));}cues.sort((a,b)=>a.time-b.time);}
function normalizeCueOrderAndNames(){ensureBaseCueInvariant();cues.sort((a,b)=>a.time-b.time);cues.forEach((c,i)=>{if(!String(c.name||'').trim()||(!c.visualNumber&&!isVisualNumberChild(c)&&/^Cue \d+$/i.test(String(c.name).trim())))c.name=`Cue ${i+1}`;});}
function captureEditableState(){return{title:showTitle.value,cues:clone(cues),customCueTypes:clone(customCueTypes),cueGroups:clone(cueGroups),pilotTools:clone(pilotTools),showDurationOverride,showLayout,conductType};}
function updateHistoryButtons(){undoBtn.disabled=locked||!undoStack.length;redoBtn.disabled=locked||!redoStack.length;}
function pushHistory(s=captureEditableState()){undoStack.push(clone(s));if(undoStack.length>HISTORY_LIMIT)undoStack.shift();redoStack=[];updateHistoryButtons();}
function resetHistory(){undoStack=[];redoStack=[];updateHistoryButtons();}
function restoreEditableState(s){goSequenceSignature='';conductType=s.conductType==='manual'?'manual':'autopilot';resetManualRuntime();setShowLayout(s.showLayout,false);showTitle.value=s.title||'';cues=clone(s.cues||[]);customCueTypes=normalizeCustomCueTypes(s.customCueTypes);cueGroups=normalizeCueGroups(s.cueGroups);pilotTools=normalizePilotTools(s.pilotTools);showDurationOverride=Number.isFinite(s.showDurationOverride)?s.showDurationOverride:null;ensureBaseCueInvariant();invalidatePreflight();renderCues();updateShowPanels();updateDurationEditor();scheduleAutosave();}
function undoEdit(){if(locked||!undoStack.length)return;let cur=captureEditableState(),prev=undoStack.pop();redoStack.push(cur);restoreEditableState(prev);updateHistoryButtons();}
function redoEdit(){if(locked||!redoStack.length)return;let cur=captureEditableState(),next=redoStack.pop();undoStack.push(cur);restoreEditableState(next);updateHistoryButtons();}

function openDB(){return new Promise((resolve,reject)=>{
 const r=indexedDB.open(DB_NAME,DB_VERSION);let settled=false;
 const timer=setTimeout(()=>{if(settled)return;settled=true;reject(new Error(tr('Le stockage local ne répond pas. Fermez les autres onglets Pilot puis réessayez.')));},20000);
 r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(META_STORE))db.createObjectStore(META_STORE);if(!db.objectStoreNames.contains(ASSET_STORE))db.createObjectStore(ASSET_STORE);if(!db.objectStoreNames.contains(LEGACY_MEDIA_STORE))db.createObjectStore(LEGACY_MEDIA_STORE);};
 r.onsuccess=()=>{clearTimeout(timer);const db=r.result;if(settled){db.close();return;}settled=true;db.onversionchange=()=>db.close();resolve(db);};
 r.onerror=()=>{clearTimeout(timer);if(!settled){settled=true;reject(r.error);}};
});}
async function requestPersistentStorage(){try{if(navigator.storage?.persist)await navigator.storage.persist();}catch{}}
async function idbOperation(store,mode,operation){const db=await openDB();return new Promise((resolve,reject)=>{
 let settled=false;const finish=(error,result)=>{if(settled)return;settled=true;db.close();error?reject(error):resolve(result);};
 try{const tx=db.transaction(store,mode),request=operation(tx.objectStore(store));tx.oncomplete=()=>finish(null,request.result);tx.onerror=tx.onabort=event=>{let error=tx.error;try{error=error||event?.target?.error;}catch{}finish(error||new DOMException(tr('Opération de stockage annulée.'),'AbortError'));};}
 catch(error){finish(error);}
});}
async function idbGet(store,key){const value=await idbOperation(store,'readonly',s=>s.get(key));return value||null;}
async function idbPut(store,key,value){return idbOperation(store,'readwrite',s=>s.put(value,key));}
async function idbDelete(store,key){return idbOperation(store,'readwrite',s=>s.delete(key));}
async function storeAsset(file,key='asset:'+uuid()){
 await requestPersistentStorage();
 try{await idbPut(ASSET_STORE,key,{blob:file,name:file.name,mime:file.type||'application/octet-stream',size:file.size,lastModified:file.lastModified||0});}
 catch(error){
  if(error&&error.name!=='DataCloneError'&&error.name!=='UnknownError')throw error;
  // Some WebKit storage engines reject Blob/File records; the existing reader also accepts bytes.
  await idbPut(ASSET_STORE,key,{buffer:await file.arrayBuffer(),name:file.name,mime:file.type||'application/octet-stream',size:file.size,lastModified:file.lastModified||0});
 }
 assetBlobCache.set(key,file);return key;
}
async function getAsset(key){if(!key)return null;if(assetBlobCache.has(key))return assetBlobCache.get(key);const rec=await idbGet(ASSET_STORE,key);const blob=rec?.blob||(rec?.buffer?new Blob([rec.buffer],{type:rec.mime||'application/octet-stream'}):null);if(!blob)return null;assetBlobCache.set(key,blob);return blob;}
async function assetUrl(key){if(assetUrlCache.has(key))return assetUrlCache.get(key);const blob=await getAsset(key);if(!blob)return null;if(assetUrlCache.has(key))return assetUrlCache.get(key);const u=URL.createObjectURL(blob);assetUrlCache.set(key,u);return u;}

let sortedCueCache=null,actionIndexCache=null,manualHierarchyCache=null,allMediaCache=null;
function orderedCues(){return sortedCueCache||(sortedCueCache=[...cues].sort((a,b)=>a.time-b.time));}
function invalidateComputationCaches(){durationCache=null;sortedCueCache=null;actionIndexCache=null;manualHierarchyCache=null;allMediaCache=null;}
function indexedActions(kind){if(!actionIndexCache){actionIndexCache=new Map();for(const cue of orderedCues())for(const action of cue.mediaActions||[]){if(!actionIndexCache.has(action.kind))actionIndexCache.set(action.kind,[]);actionIndexCache.get(action.kind).push({cue,action,start:cue.time});}}return actionIndexCache.get(kind)||[];}
function allMediaActions(){if(allMediaCache)return allMediaCache;const out=[];for(const c of orderedCues())for(const a of(c.mediaActions||[]))if(a.kind!=='stopAll')out.push({cue:c,action:a,start:c.time});return allMediaCache=out;}
let mediaMaintenanceTimer=null;
function releasePrepared(p){releaseMediaGain(p.el);const route=ltcRoutes.get(p.el);if(route){route.ltc.gain.value=0;route.source.disconnect();route.pan.disconnect();route.merge.disconnect();ltcRoutes.delete(p.el);}if(p.generatedUrl)URL.revokeObjectURL(p.generatedUrl);try{p.el.pause();p.el.removeAttribute('src');p.el.load();p.el.remove();}catch{}}
function reconcilePreparedMedia(){const items=allMediaActions(),ids=new Map(items.map(i=>[i.action.id,i]));for(const [id,p] of preparedMedia){const item=ids.get(id);if(!item||item.action.assetKey!==p.item.action.assetKey||p.ltcKey!==ltcPreparationKey(item)){stopAudioRuntime(id);if(runtimeVideo?.item.action.id===id)stopVideoRuntime();releasePrepared(p);preparedMedia.delete(id);}else p.item=item;}
 const keys=new Set(items.map(i=>i.action.assetKey));for(const [key,url] of assetUrlCache)if(!keys.has(key)){URL.revokeObjectURL(url);assetUrlCache.delete(key);assetBlobCache.delete(key);}for(const id of mediaVisualCache.keys())if(!ids.has(id))mediaVisualCache.delete(id);for(const id of mediaPreviewPositions.keys())if(!ids.has(id))mediaPreviewPositions.delete(id);for(const id of mediaPreviewViews.keys())if(!ids.has(id))mediaPreviewViews.delete(id);
}
function invalidatePreflight(){invalidateComputationCaches();preflightState='idle';preflightErrors=[];reconcilePreparedMedia();updateMediaPreflightNotice();scheduleMediaMaintenance();}
function mediaPreflightFailures(){
 return allMediaActions().map(({cue,action})=>({cue,action,error:preparedMedia.get(action.id)?.error}))
  .filter(({action,error})=>!action.assetKey||error);
}
function renderMediaPreflightFailures(list,failures){
 list.replaceChildren();
 for(const {cue,action,error} of failures){
  const row=document.createElement('li');
  const reason=!action.assetKey||error?.missingMedia?tr('Fichier manquant'):tr('Média non préparé');
  row.textContent=cue.name+' · '+(action.name||tr('Média'))+' — '+reason;
  list.append(row);
 }
}
function updateMediaPreflightNotice(){
 const failures=mediaPreflightFailures();
 $('mediaPreflightNotice').hidden=!failures.length;
 renderMediaPreflightFailures($('mediaPreflightList'),failures);
}
function updatePreflightUI(){updateMediaPreflightNotice();if($('showCheckDialog').open)renderShowCheck();for(const row of cueList.querySelectorAll('.cueAccordion')){const cue=cues.find(c=>c.id===row.dataset.cueId);if(!cue)continue;const state=cuePreparationClass(cue);for(const chip of row.querySelectorAll('.cueMediaChip:not(.stop)')){chip.classList.toggle('ready',state==='ready');chip.classList.toggle('error',state==='error');}}if(conductType==='manual')updateManualStatus();}
function scheduleMediaMaintenance(delay=200){clearTimeout(mediaMaintenanceTimer);if(document.hidden||!allMediaActions().length)return;mediaMaintenanceTimer=setTimeout(async()=>{try{reconcilePreparedMedia();for(const p of preparedMedia.values())if(!runtimeAudio.has(p.item.action.id)&&runtimeVideo?.item.action.id!==p.item.action.id&&(p.el.error||p.el.readyState<2))p.ready=false;await prepareShowMedia();}catch(e){console.warn(e);}finally{scheduleMediaMaintenance(30000);}},delay);}
document.addEventListener('visibilitychange',()=>scheduleMediaMaintenance());
function waitMediaReady(el,kind,timeout=10000){return new Promise((resolve,reject)=>{let done=false;const finish=(ok,err)=>{if(done)return;done=true;clearTimeout(timer);el.removeEventListener('loadeddata',ready);el.removeEventListener('canplay',ready);el.removeEventListener('error',fail);ok?resolve():reject(err||new Error(tr('Média non décodable')));};const ready=()=>finish(true);const fail=()=>finish(false,new Error(tr('Média non décodable par ce navigateur')));const timer=setTimeout(()=>{if(el.readyState>=2)finish(true);else finish(false,new Error(tr('Délai de préchargement dépassé')));},timeout);el.addEventListener('loadeddata',ready,{once:true});el.addEventListener('canplay',ready,{once:true});el.addEventListener('error',fail,{once:true});if(el.readyState>=2)finish(true);else el.load();});}
async function prepareOneMedia(item){let existing=preparedMedia.get(item.action.id);if(existing?.ready)return existing;if(existing?.pending)return existing.pending;if(existing){releasePrepared(existing);preparedMedia.delete(item.action.id);}
const rec={item,ltcKey:ltcPreparationKey(item),el:document.createElement(item.action.kind==='video'?'video':'audio'),ready:false,error:null};preparedMedia.set(item.action.id,rec);rec.el.addEventListener('timeupdate',backgroundTransportTick);rec.el.addEventListener('ended',backgroundTransportTick);
rec.pending=(async()=>{try{if(pilotOutputChangeTask)await pilotOutputChangeTask;let url;if(rec.ltcKey){try{url=await prepareLtcMedia(rec,item);}catch(error){if(preparedMedia.get(item.action.id)!==rec)throw error;releasePrepared(rec);ltcUnavailableActions.add(item.action.id);rec.ltcKey='';rec.el=document.createElement('audio');rec.el.addEventListener('timeupdate',backgroundTransportTick);rec.el.addEventListener('ended',backgroundTransportTick);url=await assetUrl(item.action.assetKey);updateLtcOfflineNotice();}}else url=await assetUrl(item.action.assetKey);if(preparedMedia.get(item.action.id)!==rec){releasePrepared(rec);throw new Error(tr('Préchargement annulé'));}if(!url){const error=new Error(`${tr("Média introuvable : ")}${item.action.name}`);error.missingMedia=true;throw error;}rec.url=url;const el=rec.el;if(pilotOutputChangeTask)await pilotOutputChangeTask;await routePilotElement(el);el.preload='auto';el.src=url;el.playsInline=true;el.controls=false;el.loop=false;if(item.action.kind==='video')el.muted=true;preloadBin.appendChild(el);el.addEventListener('ended',()=>handleRuntimeMediaEnded(item.action.id,item.action.kind));await waitMediaReady(el,item.action.kind);if(preparedMedia.get(item.action.id)!==rec){releasePrepared(rec);throw new Error(tr('Préchargement annulé'));}rec.ready=true;try{el.currentTime=Number(item.action.inPoint)||0;}catch{}return rec;}catch(e){releasePrepared(rec);rec.error=e;throw e;}finally{rec.pending=null;}})();return rec.pending;}
async function prepareShowMedia(){if(preflightPromise){await preflightPromise;return prepareShowMedia();}const items=allMediaActions();if(items.every(x=>preparedMedia.get(x.action.id)?.ready)){preflightState='ready';return true;}preflightState='preparing';preflightErrors=[];
preflightPromise=(async()=>{for(const item of items){if(!allMediaActions().some(x=>x.action.id===item.action.id))continue;try{await prepareOneMedia(item);}catch(error){preflightErrors.push({item,error});window.S2APilotDiagnostics?.report('media',error);}}preflightState=preflightErrors.length?'error':'ready';updatePreflightUI();return preflightState==='ready';})();try{return await preflightPromise;}finally{preflightPromise=null;}}
function preparedRecord(item){const p=preparedMedia.get(item.action.id);return p?.ready?p:null;}

// Identity only, never an authentication secret. Older packages get a repeatable ID.
function copilotIdentity(saved){
 if(typeof saved.copilotProjectId==='string'&&/^[a-zA-Z0-9_.-]{8,100}$/.test(saved.copilotProjectId))return saved.copilotProjectId;
 const source=JSON.stringify([saved.title||'',saved.cues||[]]);let a=2166136261,b=5381;for(let i=0;i<source.length;i++){a=Math.imul(a^source.charCodeAt(i),16777619);b=(Math.imul(b,33)^source.charCodeAt(i))>>>0;}return 'legacy-'+(a>>>0).toString(16)+'-'+b.toString(16);
}
function normalizeBackstageTops(list){return (Array.isArray(list)?list:[]).slice(0,200).filter(t=>t&&typeof t.text==='string'&&t.text.trim()&&Number.isFinite(Number(t.time))&&Number(t.time)>=0&&Number(t.time)<=864000).map(t=>({id:typeof t.id==='string'?t.id:uuid(),time:roundTenth(Number(t.time)),text:Array.from(t.text.trim()).slice(0,500).join(''),author:Array.from(String(t.author||'')).slice(0,60).join(''),revision:Number(t.revision)||1}));}
function projectMetadata(){return{copilotProjectId,backstageTops:clone(backstageTops),format:'showcue-workspace',version:5,showLayout,conductType,...storedManualCueListView(),customCueTypes:clone(customCueTypes),cueGroups:clone(cueGroups),pilotTools:clone(pilotTools),savedAt:Date.now(),title:showTitle.value.trim(),showDurationOverride:Number.isFinite(showDurationOverride)?roundTenth(showDurationOverride):null,cues:clone(cues)};}
let autosaveWrites=Promise.resolve();
function writeAutosave(){ensureBaseCueInvariant();const snapshot=projectMetadata();workspaceCommitted=true;autosaveWrites=autosaveWrites.catch(()=>{}).then(()=>idbPut(META_STORE,META_KEY,snapshot)).then(()=>{showSavedStatus(snapshot,'auto');}).catch(e=>{window.S2APilotDiagnostics?.report('autosave',e);startupProjectInfo.textContent=tr('Échec de la sauvegarde locale : ')+(e.message||e);throw e;});return autosaveWrites;}
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
let savedStatus=null;
function showSavedStatus(snapshot,kind){savedStatus={snapshot,kind};const date=formatSavedAt(snapshot.savedAt);startupProjectInfo.textContent=kind==='auto'?tr('Sauvegarde locale automatique · ')+date:tr('Dernière sauvegarde :')+' « '+snapshot.title+' » — '+date+'.';}
function formatSavedAt(ms){if(!ms)return'';try{return new Intl.DateTimeFormat(S2ALanguage.locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(ms));}catch{return new Date(ms).toLocaleString(S2ALanguage.locale);}}

async function probeMedia(file){
 return new Promise(resolve=>{
  const mime=(file.type||mimeFromName(file.name)||'').toLowerCase();
  const kind=mime.startsWith('video/')?'video':'audio',el=document.createElement(kind);
  const url=URL.createObjectURL(file);
  let settled=false;
  function done(duration,reason='',code=0){
   if(settled)return;
   settled=true;clearTimeout(timer);
   el.onloadedmetadata=el.onerror=null;
   try{el.pause();el.removeAttribute('src');el.load();}catch{}
   URL.revokeObjectURL(url);
   const valid=Number.isFinite(duration)&&duration>0;
   resolve({kind,duration:valid?duration:0,reason:valid?'':reason||'duration',code,mime});
  }
  const timer=setTimeout(()=>done(0,'timeout'),10000);
  el.preload='metadata';
  el.onloadedmetadata=()=>done(el.duration);
  el.onerror=()=>{
   const code=el.error?.code||0;
   done(0,code===4?'unsupported':code===3?'decode':'read',code);
  };
  el.src=url;
 });
}
function mediaProbeError(probe){
 const messages={
  timeout:'Délai dépassé à la lecture du fichier.',
  unsupported:'Format non pris en charge par ce navigateur.',
  decode:'Média non décodable par ce navigateur',
  duration:'Le fichier ne fournit pas de durée valide.',
  read:'Impossible de lire le fichier.'
 };
 const error=new Error(tr(messages[probe.reason]||messages.duration));
 error.pilotMediaProbe=true;
 window.S2APilotDiagnostics?.mediaProbe?.(error,probe);
 return error;
}
function clampTime(t){return Math.max(0,Math.min(Number(t)||0,projectDuration()));}
function currentTransportTime(){if(conductType==='manual')return transportTime;return transportPlaying?clampTime(transportBase+(performance.now()-transportEpoch)/1000):transportTime;}
function setTransportTime(t,rebuild=true){if(conductType==='manual'&&transportPlaying)return;transportTime=clampTime(t);transportBase=transportTime;transportEpoch=performance.now();lastTransportTime=transportTime;if(rebuild)rebuildMediaAtTime(transportTime,transportPlaying);updateTransport();}
async function seekTransport(t){
 if(conductType==='manual')return seekManualTransport(t);
 window.S2APilotDiagnostics?.step?.('seek');
 const wasPlaying=transportPlaying,nt=clampTime(t);
 transportTime=transportBase=lastTransportTime=nt;
 transportEpoch=performance.now();updateTransport();
 const command=transportCommandGeneration,generation=seekGeneration+1;
 try{await rebuildMediaAtTime(nt,wasPlaying);}
 catch(error){
  if(command!==transportCommandGeneration||generation!==seekGeneration)return;
  if(wasPlaying)pauseTransport();
  throw error;
 }
 if(command!==transportCommandGeneration||generation!==seekGeneration)return;
 if(wasPlaying&&!rafId)rafId=requestAnimationFrame(animationLoop);
 updateTransport();
}

function allActions(kind){return indexedActions(kind);}
let audioContext=null;async function ensureAudioContext(){const context=pilotOutputContext();if(context.state==='suspended')await context.resume();return context;}
let ltcOffline=false;
const ltcUnavailableActions=new Set();
function ltcAvailable(){
 try{if(ltcOffline||pilotOutputChanging)return false;return pilotOutputContext().destination.maxChannelCount>=4;}catch{return false;}
}
function updateLtcOfflineNotice(){
 const requested=allMediaActions().some(item=>item.action.ltc);
 const unavailable=requested&&(!ltcAvailable()||ltcUnavailableActions.size>0);
 for(const id of ['ltcOfflineNotice','liveLtcOfflineNotice']){
  const label=$(id);if(!label)continue;label.hidden=!unavailable;
  if(unavailable)label.textContent=tr('TC hors ligne — la musique reste disponible.');
 }
 const control=$('ltcOffline');if(control){control.checked=ltcOffline;control.disabled=pilotOutputInUse()||pilotOutputChanging;}
}
function normalizeLtcLead(value){return Number.isInteger(value)&&value>=0&&value<=5?value:0;}
function plannedLtcLead({cue,action}){
 return action.ltc&&ltcAvailable()&&!ltcUnavailableActions.has(action.id)&&conductType==='manual'&&isManualMainCue(cue)&&!cue.visualNumber?normalizeLtcLead(action.ltcLead):0;
}
function ltcPreparationKey(item){
 const {action}=item;
 return action.kind==='audio'&&action.ltc&&ltcAvailable()&&!ltcUnavailableActions.has(action.id)?[action.inPoint,action.outPoint,normalizeLtcStartFrame(action.ltcStartFrame),plannedLtcLead(item)].join(':'):'';
}
// The four-channel PCM stream shares one decoder and clock with the music.
// Channels 1–2 are music, 3 is LTC, and 4 is silent.
const LTC_FPS=25, LTC_MAX_SECONDS=600;
function normalizeLtcStartFrame(value){
 return Number.isInteger(value)&&value>=0&&value<86400*LTC_FPS?value:0;
}
function parseLtcAddress(value){
 const match=/^(\d{2}):(\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
 if(!match)return null;
 const [h,m,s,f]=match.slice(1).map(Number);
 return h<24&&m<60&&s<60&&f<LTC_FPS?((h*60+m)*60+s)*LTC_FPS+f:null;
}
function formatLtcAddress(value){
 const frame=normalizeLtcStartFrame(value),seconds=Math.floor(frame/LTC_FPS);
 return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60,frame%LTC_FPS].map(n=>String(n).padStart(2,'0')).join(':');
}
const ltcRoutes=new WeakMap();
function ltcFrameBits(frame){
 const seconds=Math.floor(frame/LTC_FPS);
 const values=[frame%LTC_FPS,seconds%60,Math.floor(seconds/60)%60,Math.floor(seconds/3600)%24];
 const bits=new Uint8Array(80);
 for(let group=0;group<4;group++){
  const value=values[group],bcd=(Math.floor(value/10)<<8)|(value%10);
  for(let bit=0;bit<12;bit++)bits[group*16+bit]=(bcd>>bit)&1;
 }
 bits.set([0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1],64);
 bits[59]=bits.reduce((parity,bit)=>parity^bit,0);
 return bits;
}
function createLtcWave(buffer,startTime,endTime,startFrame,isCurrent,lead=0){
 const rate=buffer.sampleRate,prefix=lead*rate;
 const musicLength=Math.min(buffer.length,Math.ceil(endTime*rate)),length=musicLength+prefix;
 const start=Math.round(startTime*rate);
 const channels=4,blockSize=channels*2;
 const bytes=new ArrayBuffer(68+length*blockSize),view=new DataView(bytes);
 const word=(offset,value)=>view.setUint16(offset,value,true);
 const long=(offset,value)=>view.setUint32(offset,value,true);
 const tag=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
 tag(0,'RIFF');long(4,bytes.byteLength-8);tag(8,'WAVEfmt ');long(16,40);
 word(20,65534);word(22,channels);long(24,rate);long(28,rate*blockSize);word(32,blockSize);word(34,16);
 word(36,22);word(38,16);long(40,0x33);
 new Uint8Array(bytes,44,16).set([1,0,0,0,0,0,16,0,128,0,0,170,0,56,155,113]);
 tag(60,'data');long(64,length*blockSize);
 const pcm=new Int16Array(bytes,68),left=buffer.getChannelData(0),right=buffer.getChannelData(buffer.numberOfChannels===1?0:1);
 const samplesPerHalfBit=rate/(LTC_FPS*160);
 let polarity=-1,halfBit=0,sample=start,musicSample=lead?start:0;
 const day=86400*LTC_FPS;
 let frame=normalizeLtcStartFrame(startFrame)+day-lead*LTC_FPS;
 function emit(count){
  const end=Math.min(length,start+Math.round((halfBit+=count)*samplesPerHalfBit));
  while(sample<end)pcm[sample++*channels+2]=polarity*8192;
 }
 // Let the browser process input and paint between short batches of PCM work.
 return new Promise(function(resolve,reject){
  function encode(){
   try{
    if(!isCurrent())throw new Error(tr('Préchargement annulé'));
    const deadline=performance.now()+8;
    while(musicSample<musicLength&&performance.now()<deadline){
     const end=Math.min(musicLength,musicSample+16384);
     for(;musicSample<end;musicSample++){
      const offset=(musicSample+prefix)*channels;
      pcm[offset]=Math.round(Math.max(-1,Math.min(1,left[musicSample]))*32767);
      pcm[offset+1]=Math.round(Math.max(-1,Math.min(1,right[musicSample]))*32767);
     }
    }
    while(sample<length&&performance.now()<deadline){
     const bits=ltcFrameBits(frame++%day);
     for(let bit=0;bit<bits.length;bit++){
      polarity=-polarity;
      if(bits[bit]){emit(1);polarity=-polarity;emit(1);}else emit(2);
     }
    }
    if(musicSample<musicLength||sample<length)setTimeout(encode,0);
    else resolve(new Blob([bytes],{type:'audio/wav'}));
   }catch(error){reject(error);}
  }
  setTimeout(encode,0);
 });
}
function ltcOutputContext(){
 pilotOutputContext();
 audioContext.destination.channelCount=ltcAvailable()?4:2;
 return audioContext;
}
async function prepareLtcMedia(rec,item){
 const action=item.action;
 if(action.duration>LTC_MAX_SECONDS)throw new Error(tr('LTC bêta : choisissez un fichier audio de 10 minutes maximum.'));
 if(pilotOutputId)checkPilotOutput();
 const context=ltcOutputContext(),asset=await getAsset(action.assetKey);
 if(!asset)throw new Error(tr('Média non décodable'));
 const buffer=await context.decodeAudioData(await asset.arrayBuffer());
 if(buffer.duration>LTC_MAX_SECONDS||buffer.numberOfChannels>2)throw new Error(tr('LTC bêta : choisissez un fichier mono ou stéréo de 10 minutes maximum.'));
 const isCurrent=()=>preparedMedia.get(action.id)===rec;
 if(!isCurrent())throw new Error(tr('Préchargement annulé'));
 const lead=plannedLtcLead(item);
 const wav=await createLtcWave(buffer,action.inPoint,action.outPoint,action.ltcStartFrame,isCurrent,lead);
 rec.generatedUrl=URL.createObjectURL(wav);
 // Connect before assigning src so the unseparated stream cannot reach the speakers.
 const source=context.createMediaElementSource(rec.el),split=context.createChannelSplitter(4);
 const merge=context.createChannelMerger(4),music=context.createGain(),ltc=context.createGain();
 const stereo=context.createChannelMerger(2),musicSplit=context.createChannelSplitter(2);
 music.gain.value=0;ltc.gain.value=0;
 source.connect(split);split.connect(stereo,0,0);split.connect(stereo,1,1);
 stereo.connect(music);const pan=connectTrackPan(context,music,musicSplit);pan.set(normalizeTrackPan(action.pan));
 musicSplit.connect(merge,0,0);musicSplit.connect(merge,1,1);
 split.connect(ltc,2);ltc.connect(merge,0,2);merge.connect(context.destination);
 ltcRoutes.set(rec.el,{music,ltc,source,merge,pan,lead});
 return rec.generatedUrl;
}
function runtimeLtcLead(rt){return ltcRoutes.get(rt?.el)?.lead||0;}
function remainingLtcLead(rt){
 const lead=runtimeLtcLead(rt);
 if(!lead)return 0;
 const start=Number(rt.item.action.inPoint)||0;
 return Math.max(0,Math.min(lead,start+lead-rt.el.currentTime));
}
function audioInLtcLead(rt){return remainingLtcLead(rt)>0;}
function updateLtcRouting(){
 const tracks=[...runtimeAudio.values()];
 const staged=manualCrossfadeLead?.incoming;
 const current=conductType==='manual'
  ?(staged&&!staged.el.paused&&!staged.el.seeking?staged:tracks.filter(rt=>rt.item.cue.id===manualCurrentID||rt.item.cue.parentMusicId===manualCurrentID).at(-1))
  :tracks.reduce((latest,rt)=>!latest||rt.item.start>=latest.item.start?rt:latest,null);
 updateLtcOfflineNotice();
 const available=ltcAvailable()&&audioContext?.destination.maxChannelCount>=4&&audioContext.destination.channelCount===4;
 for(const rt of tracks){
  const route=ltcRoutes.get(rt.el);
  if(!route)continue;
  route.ltc.gain.value=available&&transportPlaying&&rt===current&&(rt.manualGainValue>0||audioInLtcLead(rt))&&!rt.el.seeking?1:0;
 }
}
async function runtimeElementFor(item){let p=preparedRecord(item);if(!p){try{await prepareOneMedia(item);p=preparedRecord(item);}catch{return null;}}return p;}
function stopAudioRuntime(id,release=false){const rt=runtimeAudio.get(id);if(!rt)return;try{rt.el.pause();rt.el.volume=1;}catch{}const route=ltcRoutes.get(rt.el);if(route)route.ltc.gain.value=0;runtimeAudio.delete(id);if(manualCrossfadeLead?.incoming===rt)manualCrossfadeLead=null;if(release&&!preparedMedia.has(id))try{rt.el.remove();}catch{}}
function isBackgroundTrack(rt){return !!(rt&&(rt.background||rt.layered));}
function stopAllAudio(){for(const id of [...runtimeAudio.keys()])stopAudioRuntime(id);}
function stopAllRuntimeMedia(){stopAllAudio();stopVideoRuntime();}
function releaseMediaGain(el){
 const route=mediaGainNodes.get(el);
 if(!route)return;
 route.source.disconnect();
 route.gain.disconnect();
 route.pan.disconnect();
 mediaGainNodes.delete(el);
}
function setMediaOutputGain(el,gain,useGraph,pan=0){
 let route=mediaGainNodes.get(el);
 if(audioContext&&(useGraph||route||pan!==0)){
  try{
   if(!route){
    const gainNode=audioContext.createGain();
    const source=audioContext.createMediaElementSource(el);
    source.connect(gainNode);
    route={source,gain:gainNode,pan:connectTrackPan(audioContext,gainNode,audioContext.destination)};
    mediaGainNodes.set(el,route);
   }
   route.gain.gain.value=gain;route.pan.set(pan);
   el.volume=1;
   return;
  }catch(error){window.S2APilotDiagnostics?.report('media',error);}
 }
 el.volume=Math.min(1,gain);
}
function setRuntimeGain(rt,v){
 const envelope=Math.max(0,Math.min(1,v)),db=trackOutputDb(rt.item.action);
 const gain=envelope*trackGainFactor(db)*(rt.stopFade?.factor??1);
 rt.manualGainValue=envelope;
 const pan=normalizeTrackPan(rt.item.action.pan),ltcRoute=ltcRoutes.get(rt.el);
 if(ltcRoute){ltcRoute.music.gain.value=gain;ltcRoute.pan.set(pan);updateLtcRouting();return;}
 setMediaOutputGain(rt.el,gain,!!pilotOutputId||conductType==='manual'||db!==0,pan);
}

async function activateAudio(item,elapsed=0,gainValue=1,playing=transportPlaying,resume=false){
 if(playing&&item.action.ltc)ltcOutputContext();
 const command=transportCommandGeneration,seek=seekGeneration;
 let rt=runtimeAudio.get(item.action.id);
 const keepPosition=resume&&!!rt&&!rt.el.ended;
 if(!rt){
  const p=preparedRecord(item)||await runtimeElementFor(item);
  if(!p||command!==transportCommandGeneration||seek!==seekGeneration)return null;
  rt={item,el:p.el};runtimeAudio.set(item.action.id,rt);
 }
 rt.item=item;
 if(!keepPosition){
  let position=mediaPositionAt(item.action,elapsed)+runtimeLtcLead(rt);
  // A seek just past zero prevents a silent WebKit media source on the initial GO.
  if(position===0&&playing&&isVisualNumberChild(item.cue)&&navigator.vendor==='Apple Computer, Inc.'){
   position=Math.min(.001,mediaSegmentDuration(item.action)/2);
  }
  if(rt.el.currentTime!==position)rt.el.currentTime=position;
  if(rt.localPausePosition!=null)rt.localPausePosition=rt.el.currentTime;
 }
 setRuntimeGain(rt,gainValue);
 if(playing&&transportPlaying&&rt.localPausePosition==null){
  // Keep playback on the same element and call play before awaiting a seek.
  const started=rt.el.paused?rt.el.play():Promise.resolve();
  await Promise.all([started,waitForAudioSeek(rt.el)]);
 }else rt.el.pause();
 return command===transportCommandGeneration&&seek===seekGeneration?rt:null;
}
async function triggerAudioAction(item){const previous=[...runtimeAudio.values()].filter(rt=>rt.item.action.id!==item.action.id&&!isBackgroundTrack(rt));if(item.action.transition==='fade'&&previous.length){const rt=await activateAudio(item,0,0,true);if(!rt)return;rt.fadeStartedAt=currentTransportTime();rt.fadeDuration=Math.max(.1,Number(item.action.fadeDuration)||3);for(const p of previous){p.fadeOutStartedAt=rt.fadeStartedAt;p.fadeDuration=rt.fadeDuration;}}else{for(const p of previous)stopAudioRuntime(p.item.action.id);await activateAudio(item,0,1,true);}}
function audioStateCoreAt(t,stopCutoff=-Infinity,actions=allActions('audio')){const acts=actions.filter(x=>x.start>=stopCutoff-.0001&&x.start<=t+.0001);if(!acts.length)return[];const latest=acts[acts.length-1],elapsed=t-latest.start;if(!mediaIsActiveAt(latest.action,elapsed))return[];if(latest.action.transition==='fade'&&acts.length>1&&elapsed<latest.action.fadeDuration){const prev=acts[acts.length-2],pe=t-prev.start,p=Math.max(0,Math.min(1,elapsed/latest.action.fadeDuration)),out=[{item:latest,elapsed,gain:p}];if(mediaIsActiveAt(prev.action,pe))out.unshift({item:prev,elapsed:pe,gain:1-p});return out;}return[{item:latest,elapsed,gain:1}];}
function audioStateAt(t,scope){const stop=lastStopActionBefore(t,scope?.cues);if(!stop)return audioStateCoreAt(t,-Infinity,scope?.audio);if(stop.action.transition==='fade'){const d=Math.max(.1,Number(stop.action.fadeDuration)||3),e=t-stop.start;if(e>=0&&e<d){const before=audioStateCoreAt(Math.max(0,stop.start-.001),-Infinity,scope?.audio),factor=Math.max(0,1-e/d);return before.map(s=>({...s,elapsed:Math.max(0,t-s.item.start),gain:s.gain*factor})).filter(s=>mediaIsActiveAt(s.item.action,s.elapsed));}}return audioStateCoreAt(t,stop.start,scope?.audio);}
async function rebuildAudioAtTime(t,playing,resume=false){const state=audioStateAt(t);const wanted=new Set(state.map(s=>s.item.action.id));for(const id of runtimeAudio.keys())if(!wanted.has(id))stopAudioRuntime(id);await Promise.all(state.map(s=>activateAudio(s.item,s.elapsed,s.gain,playing,resume)));}
function updateAudioGains(t){const state=audioStateAt(t),wanted=new Set(state.map(s=>s.item.action.id));for(const [id] of [...runtimeAudio])if(!wanted.has(id))stopAudioRuntime(id);for(const s of state){const rt=runtimeAudio.get(s.item.action.id);if(rt)setRuntimeGain(rt,s.gain);}}
function restartLoopRuntime(rt,isVideo=false){
  if(!mediaLoops(rt?.item?.action))return false;
  const start=Math.max(0,Number(rt.item.action.inPoint)||0)+(isVideo?0:runtimeLtcLead(rt));
  if(conductType==='manual'&&!isVideo){const length=mediaSegmentDuration(rt.item.action);if(!rt.el.ended&&rt.el.currentTime<start+length-.05)return true;rt.manualLoopElapsed=(rt.manualLoopElapsed||0)+length;}
  try{rt.el.currentTime=start;}catch{}
  if(transportPlaying||isBackgroundTrack(rt)&&rt.item.cue.id!==manualCurrentID)rt.el.play().catch(()=>{});else rt.el.pause();
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
function enforceMediaBounds(t,backgroundOnly=false){
  for(const [id,rt] of [...runtimeAudio]){
    if(rt.localPausePosition!=null||backgroundOnly&&(!isBackgroundTrack(rt)||rt.el.paused))continue;
    const a=rt.item.action,seg=mediaSegmentDuration(a);
    if(seg<=0){stopAudioRuntime(id);continue;}
    const end=(Number(a.inPoint)||0)+seg+runtimeLtcLead(rt);
    if((rt.el.currentTime||0)>=end-.035){
      if(mediaLoops(a))restartLoopRuntime(rt,false);
      else stopAudioRuntime(id);
    }
  }
  if(!backgroundOnly&&runtimeVideo){
    const a=runtimeVideo.item.action,seg=mediaSegmentDuration(a),end=(Number(a.inPoint)||0)+seg;
    if(seg<=0)stopVideoRuntime();
    else if((runtimeVideo.el.currentTime||0)>=end-.035){
      if(mediaLoops(a))restartLoopRuntime(runtimeVideo,true);
      else stopVideoRuntime();
    }
  }
}

function stopVideoRuntime(){if(runtimeVideo){try{runtimeVideo.el.pause();}catch{}runtimeVideo=null;}syncVideoSurfaces();}
async function activateVideo(item,elapsed=0,playing=transportPlaying,resume=false){const command=transportCommandGeneration,seek=seekGeneration;if(runtimeVideo?.item?.action?.id!==item.action.id){if(runtimeVideo)try{runtimeVideo.el.pause();}catch{}const p=preparedRecord(item)||await runtimeElementFor(item);if(!p||command!==transportCommandGeneration||seek!==seekGeneration)return null;runtimeVideo={item,el:p.el,url:p.url};}else runtimeVideo.item=item;runtimeVideo.el.muted=!!item.action.muted||(!pilotOutputId&&!!(videoOutputWindow&&!videoOutputWindow.closed));const position=mediaPositionAt(item.action,elapsed);if(!resume||Math.abs((runtimeVideo.el.currentTime||0)-position)>.1)try{runtimeVideo.el.currentTime=position;}catch{}syncVideoSurfaces();if(playing&&transportPlaying)await runtimeVideo.el.play().catch(()=>{});else runtimeVideo.el.pause();syncExternalVideo(true);return runtimeVideo;}
async function triggerVideoAction(item){await activateVideo(item,0,true);}
function videoStateCoreAt(t,stopCutoff=-Infinity,actions=allActions('video')){const acts=actions.filter(x=>x.start>=stopCutoff-.0001&&x.start<=t+.0001),latest=acts[acts.length-1];if(!latest)return null;const elapsed=t-latest.start;return mediaIsActiveAt(latest.action,elapsed)?{item:latest,elapsed,opacity:1}:null;}
function videoStateAt(t,scope){const stop=lastStopActionBefore(t,scope?.cues);if(!stop)return videoStateCoreAt(t,-Infinity,scope?.video);if(stop.action.transition==='fade'){const d=Math.max(.1,Number(stop.action.fadeDuration)||3),e=t-stop.start;if(e>=0&&e<d){const s=videoStateCoreAt(Math.max(0,stop.start-.001),-Infinity,scope?.video);if(s)return{item:s.item,elapsed:Math.max(0,t-s.item.start),opacity:Math.max(0,1-e/d)};}}return videoStateCoreAt(t,stop.start,scope?.video);}
async function rebuildVideoAtTime(t,playing,resume=false){const s=videoStateAt(t);if(!s){stopVideoRuntime();return;}await activateVideo(s.item,s.elapsed,playing,resume);if(runtimeVideo)runtimeVideo.opacity=s.opacity??1;syncExternalVideo(true);}

function activeVideoAction(){return runtimeVideo?.item?.action||null;}
function syncVideoSurfaces(){updateVideoOutputControls();const box=$('showVideoMonitor'),surface=$('showVideoSurface');const previewing=!!editBlockPreview?.video;box.hidden=!(previewing||(locked&&projectHasVideo()));box.classList.toggle('editBlockVideo',previewing);for(const v of surface.querySelectorAll('video'))if(v!==runtimeVideo?.el)preloadBin.append(v);$('showVideoEmpty').hidden=!!runtimeVideo;if(runtimeVideo){if(locked||previewing)surface.append(runtimeVideo.el);else preloadBin.append(runtimeVideo.el);runtimeVideo.el.style.opacity=String(runtimeVideo.opacity??1);}syncExternalVideo(true);}
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
  d.close();d.documentElement.lang=S2ALanguage.language;d.title='S2A Pilot — '+tr('SORTIE VIDÉO');d.getElementById('showcueFullscreenHint').textContent=tr('Cliquer / toucher pour passer en plein écran');
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
function syncExternalVideo(force=false){const outputOpen=!!(videoOutputWindow&&!videoOutputWindow.closed);if(runtimeVideo)runtimeVideo.el.muted=!!runtimeVideo.item.action.muted||(outputOpen&&!pilotOutputId);if(!outputOpen)return;let v;try{v=videoOutputWindow.document.getElementById('out');}catch{return;}if(!v)return;if(!runtimeVideo){try{v.pause();if(v.hasAttribute('src')){v.removeAttribute('src');v.load();}}catch{}return;}if(v.src!==runtimeVideo.url){v.src=runtimeVideo.url;v.preload='auto';v.load();}const target=runtimeVideo.el.currentTime||0;if(force||Math.abs((v.currentTime||0)-target)>.18)try{v.currentTime=target;}catch{}v.muted=!!pilotOutputId||!!runtimeVideo.item.action.muted;v.style.opacity=String(runtimeVideo.opacity??1);if(runtimeVideo.el.paused)v.pause();else if(v.paused)v.play().catch(()=>{});}
async function rebuildMediaAtTime(t,playing,resume=false){if(conductType==='manual'){if(!playing)stopAllRuntimeMedia();return;}const generation=++seekGeneration,commandGeneration=transportCommandGeneration;if(!allMediaActions().every(item=>preparedRecord(item)))await prepareShowMedia(false);if(generation!==seekGeneration||commandGeneration!==transportCommandGeneration)return;await Promise.all([rebuildAudioAtTime(t,playing&&transportPlaying,resume),rebuildVideoAtTime(t,playing&&transportPlaying,resume)]);}
async function onCueCrossed(cue){dispatchCueOsc(cue);const actions=cue.mediaActions||[];for(const stop of actions.filter(a=>a.kind==='stopAll')){if(stop.transition==='cut')stopAllRuntimeMedia();else{const d=Math.max(.1,Number(stop.fadeDuration)||3);for(const rt of runtimeAudio.values()){rt.globalFadeStartedAt=currentTransportTime();rt.globalFadeDuration=d;rt.globalFadeInitialGain=rt.manualGainValue??1;}if(runtimeVideo){runtimeVideo.globalFadeStartedAt=currentTransportTime();runtimeVideo.globalFadeDuration=d;runtimeVideo.opacity=1;}}}const items=actions.filter(a=>a.kind!=='stopAll').map(action=>({cue,action,start:cue.time}));for(const item of items){if(item.action.kind==='audio')await triggerAudioAction(item);else if(item.action.kind==='video')await triggerVideoAction(item);}}

function getActiveCue(t=currentTransportTime()){if(conductType==='manual')return manualActiveCue(t);let a=null;for(const c of orderedCues()){if(c.time<=t+.0001)a=c;else break;}return a;}
function getNextCue(t=currentTransportTime()){if(conductType==='manual')return manualNextTop(t);return orderedCues().find(c=>c.time>t+.0001)||null;}
function getCueAfter(cue){const a=orderedCues(),i=a.indexOf(cue);return i>=0?a[i+1]||null:null;}
function updateShowPanels(){updateShowOverview();updateCountdownBeat(currentTransportTime());}
function renderTimeline(){
 invalidateComputationCaches();
 if(manualEditSequenceVisible()){renderManualSequence();return;}
 applyTimelineWindow();timeline.querySelectorAll('.marker,.tick').forEach(e=>e.remove());const d=projectDuration();
 const ticks=Math.min(2048,Math.ceil(4*generalTimelineZoom));for(let i=0;i<=ticks;i++){const tick=document.createElement('span');tick.className='tick';tick.style.left=`${i/ticks*100}%`;tick.textContent=fmtDisplay(d*i/ticks);timeline.appendChild(tick);}
 const filter=cueTypeVisibility(),typeColors=locked?cueMarkerColors():null;
 for(const cue of cues){
  if(filter&&!filter.visible.has(cue.id))continue;
  const main=conductType==='manual'&&isManualMainCue(cue);
  const marker=document.createElement('div');marker.className='marker'+(main?' mainCueMarker':'')+(expandedCueId===cue.id?' selectedCueMarker':'');marker.dataset.cueId=cue.id;marker.dataset.number=String(orderedCues().findIndex(c=>c.id===cue.id)+1);marker.style.left=`${cue.time/d*100}%`;marker.title=`${fmt(cue.time)} — ${cue.name}`;
  if(locked)paintCueTimelineMarker(marker,cue,main,typeColors);
  marker.addEventListener('pointerdown',e=>{
   if(locked||e.button!==0||manualTimelinePan)return;e.preventDefault();e.stopPropagation();
   const startX=e.clientX,startTime=cue.time,rect=timeline.getBoundingClientRect();let dragging=false,draft=startTime;
   const hint=document.createElement('span');hint.className='cueDragTime';hint.hidden=true;marker.append(hint);marker.setPointerCapture(e.pointerId);
   const bars=[...$('projectMediaTracks').querySelectorAll('.projectMediaBar')].filter(b=>b.dataset.cueId===cue.id).map(b=>({el:b,left:b.style.left}));
   const row=cueList.querySelector(`[data-cue-id="${cue.id}"]`),rowTime=row?.querySelector('.cueSummaryTime'),input=row?.querySelector('.timeInput');
   const preview=ev=>{
    if(manualTimelinePan)return;
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
    if(dragging&&ev.type==='pointerup'&&draft!==startTime){pushHistory();cue.time=draft;updateManualRelative(cue);expandedCueId=cue.id;invalidatePreflight();renderCues();scheduleAutosave();}
    else if(dragging){marker.style.left=`${startTime/d*100}%`;for(const b of bars)b.el.style.left=b.left;if(rowTime)rowTime.textContent=fmt(startTime);if(input)input.value=fmt(startTime);}
    else if(ev.type==='pointerup'){expandedCueId=cue.id;renderCues(false);renderTimeline();centerEditedCue(cue.id);}
   };
   marker.addEventListener('pointermove',preview);marker.addEventListener('pointerup',finish);marker.addEventListener('pointercancel',finish);marker.addEventListener('lostpointercapture',finish);
  });timeline.appendChild(marker);
 }timelineLabelSignature='';updateTimelineCueLabels();scheduleTimelineMedia();
}

let autoShowSelectedCueId=null;
let showOverviewSignature='',liveFollowSignature='',liveFollowFrame=0,editCenterFrame=0;
let liveFinishLocale='',liveFinishFormatter=null;
function liveFinishProjection(){
 if(!cues.length)return null;
 const time=currentTransportTime();
 if(conductType!=='manual'){
  const remaining=Math.max(0,projectDuration()-time);
  return remaining>0?{remaining,waiting:false}:null;
 }
 const current=manualCurrent(),first=current||manualNextMusic();
 if(!first)return null;
 const duration=manualDuration(first);
 if(!Number.isFinite(duration)||duration<=0||manualHoldsAtStart(first))return {remaining:null,waiting:true};
 const primary=manualPrimaryAudio(first);
 const lead=current?remainingLtcLead(runtimeAudio.get(primary?.id)):manualCrossfadeLeadDuration(first);
 return {remaining:Math.max(0,first.time+duration-(current?time:first.time))+lead,waiting:!!manualWaitCueID||!transportPlaying};
}
function liveShowFinishProjection(){
 if(!locked||conductType!=='manual'||!cues.length)return null;
 const time=currentTransportTime();
 const roots=manualMusics(),current=manualCurrent(),first=current||manualNextMusic();
 if(!first)return null;
 const queue=roots.slice(roots.indexOf(first));
 let remaining=0,waiting=!!manualWaitCueID||(!current&&!transportPlaying);
 for(const [index,cue] of queue.entries()){
  const duration=manualDuration(cue);
  if(manualHoldsAtStart(cue))continue;
  if(!Number.isFinite(duration)||duration<=0)return {remaining:null,waiting:true};
  const position=cue===current?time:cue.time;
  const primary=manualPrimaryAudio(cue);
  const lead=cue===current?remainingLtcLead(runtimeAudio.get(primary?.id)):manualCrossfadeLeadDuration(cue);
  remaining+=Math.max(0,cue.time+duration-position)+lead;
  if(manualChildren(cue).some(child=>child.waitForGo&&child.time>=position))waiting=true;
  const next=queue[index+1];
  if(!next)continue;
  if(!primary?.autoNext){waiting=true;continue;}
  const transition=manualCrossfadeStart(cue,primary,next);
  if(transition<cue.time+duration){
   remaining-=Math.max(0,cue.time+duration-Math.max(position,transition));
   remaining-=manualCrossfadeLeadDuration(next);
  }
 }
 return {remaining:Math.max(0,remaining),waiting};
}
function updateLiveFinish(){
 if(!locked)return;
 const label=$('liveFinishEstimate'),projection=liveFinishProjection();
 label.hidden=!projection;
 if(!projection)return;

 if(liveFinishLocale!==S2ALanguage.locale||!liveFinishFormatter){
  liveFinishLocale=S2ALanguage.locale;
  liveFinishFormatter=new Intl.DateTimeFormat(liveFinishLocale,{hour:'numeric',minute:'2-digit'});
 }
 const now=Date.now(),format=remaining=>liveFinishFormatter.format(now+remaining*1000);
 const estimate=projection.remaining===null?tr('Fin indéterminée'):tr('Fin estimée : {time}',{time:format(projection.remaining)});
 if(conductType==='manual'){
  const show=liveShowFinishProjection();
  const total=show?(show.remaining===null?tr('fin probable du spectacle indéterminée'):tr('fin probable du spectacle : {time}',{time:format(show.remaining)})):'';
  setShowText(label,estimate+(total?' ('+total+')':''));return;
 }
 const notes=[estimate];
 if(!transportPlaying&&(conductType!=='manual'||manualCurrent())&&!manualWaitCueID)notes.push(tr('si reprise maintenant'));
 if(projection.waiting)notes.push(tr('hors attente GO'));
 setShowText(label,notes.join(' · '));
}
setInterval(updateLiveFinish,1000);
function updateTransportHeading(){
 if(!locked)return;
 const title=showTitle.value.trim()||tr('Projet S2A Pilot'),active=getActiveCue();
 setShowText($('transportShowTitle'),title);
 setShowText($('showCuePosition'),`CUE ${active?cues.indexOf(active)+1:0}/${cues.length}`);
 updateLiveFinish();
}
let liveClockRemaining=false,editClockRemaining=false;
function updateTransportClock(time,duration){
 const remaining=locked?liveClockRemaining:editClockRemaining,button=$('transportClockToggle');
 setShowText(clock,remaining?'-'+fmtDisplay(duration-time,true):fmtDisplay(time));
 setShowText(durationEl,`/ ${fmtDisplay(duration)}`);
 const label=tr(remaining?'Afficher le temps écoulé':'Afficher le temps restant');
 if(button.title!==label){button.title=label;button.setAttribute('aria-label',label);}
}
$('transportClockToggle').onclick=()=>{
 if(locked)liveClockRemaining=!liveClockRemaining;
 else editClockRemaining=!editClockRemaining;
 updateTransportClock(currentTransportTime(),projectDuration());
};
function updateTransport(){updateLtcRouting();updateTransportHeading();updateCueNavigation();const t=currentTransportTime(),d=projectDuration(),pct=d?Math.min(100,t/d*100):0;updateTransportClock(t,d);if(manualEditSequenceVisible()){updateGoWaveTransport(t);updateGoSequencePlayback(t);}playhead.style.left=`${pct}%`;playhead.setAttribute('aria-valuemin','0');playhead.setAttribute('aria-valuemax',String(d));playhead.setAttribute('aria-valuenow',String(roundTenth(t)));playhead.setAttribute('aria-valuetext',fmtDisplay(t));progress.style.width=`${pct}%`;if(locked){for(const attr of ['min','max','now','text'])timeline.setAttribute('aria-value'+attr,playhead.getAttribute('aria-value'+attr));}followTimelinePlayhead(t);updateShowPanels();updateTimelineCueLabels();updateManualStatus();updateLiveAudioTracks();updatePilotMediaSession();notifyCopilotTransport();}
let lastDisplayUpdate=0;
function animationLoop(){if(conductType==='manual'){manualAnimationLoop();return;}rafId=0;if(!transportPlaying)return;const t=currentTransportTime();updateCountdownBeat(t);for(const c of cues){if(c.time>lastTransportTime+.0001&&c.time<=t+.0001)onCueCrossed(c).catch(console.warn);}lastTransportTime=t;updateAudioGains(t);enforceMediaBounds(t);const vs=videoStateAt(t);if(runtimeVideo){if(!vs||vs.item.action.id!==runtimeVideo.item.action.id){stopVideoRuntime();}else{const expected=mediaPositionAt(runtimeVideo.item.action,t-runtimeVideo.item.start);if(Math.abs((runtimeVideo.el.currentTime||0)-expected)>.55)try{runtimeVideo.el.currentTime=expected;}catch{}runtimeVideo.opacity=vs.opacity??1;}}if(performance.now()-lastDisplayUpdate>=100){lastDisplayUpdate=performance.now();syncExternalVideo();if(runtimeVideo)runtimeVideo.el.style.opacity=String(runtimeVideo.opacity??1);updateTransport();}if(t>=projectDuration()){pauseTransport();return;}rafId=requestAnimationFrame(animationLoop);}

async function playTransport(){
  window.S2APilotDiagnostics?.step?.('play');
  checkPilotOutput();
  if(conductType==='manual'){await manualGO();return;}
  pauseMediaPreviews();
  if(transportPlaying)return;
  const commandGeneration=++transportCommandGeneration;
  const contextReady=ensureAudioContext().catch(console.warn);
  const ok=allMediaActions().every(item=>preparedRecord(item))||await prepareShowMedia(false);
  if(commandGeneration!==transportCommandGeneration)return;
  if(!ok&&preflightErrors.length){const go=confirm(tr('Certains médias n’ont pas pu être préparés. Continuer quand même ?'));if(!go||commandGeneration!==transportCommandGeneration)return;}
  transportPlaying=true;transportBase=transportTime;transportEpoch=performance.now();lastTransportTime=transportTime;
  try{await Promise.all([contextReady,rebuildMediaAtTime(transportTime,true,true)]);}catch(error){if(commandGeneration===transportCommandGeneration)pauseTransport();throw error;}
  if(commandGeneration!==transportCommandGeneration||!transportPlaying)return;
  transportEpoch=performance.now();
  if(locked&&transportTime===0&&pilotOscStartEpoch!==copilotProjectEpoch){
   pilotOscStartEpoch=copilotProjectEpoch;
   for(const cue of cues)if(cue.time===0)dispatchCueOsc(cue);
  }
  if(!rafId)rafId=requestAnimationFrame(animationLoop);updateTransport();
}
function pauseTransport(keepBackground=false){
  if(transportPlaying)window.S2APilotDiagnostics?.step?.('pause');
  ++transportCommandGeneration;++seekGeneration;
  transportTime=currentTransportTime();transportPlaying=false;
  cancelAnimationFrame(rafId);rafId=0;
  for(const rt of runtimeAudio.values())if(!keepBackground||!isBackgroundTrack(rt)||rt.item.cue.id===manualCurrentID)try{rt.el.pause();}catch{}
  if(runtimeVideo)try{runtimeVideo.el.pause();}catch{}
  syncExternalVideo(true);updateTransport();
}

// The same timeline and controls serve Edit and Show; media/seek handlers stay attached.
function placeEditAddActions(){
 const actions=$('editAddActions'),fold=$('goSequenceFoldAll');
 const target=conductType==='manual'?fold.parentElement:$('editTimelineTools');
 if(actions.parentElement!==target)target.insertBefore(actions,conductType==='manual'?fold:target.firstElementChild);
}
function setTransportPresentation(){
 timeline.tabIndex=locked?0:-1;
 if(locked){timeline.setAttribute('role','slider');timeline.setAttribute('aria-label',tr('Position dans la conduite'));}
 else{timeline.removeAttribute('role');timeline.setAttribute('aria-label',tr('Timeline audio'));}
}
function applyLockState(){if(locked&&editBlockPreview)stopEditBlockPreview();autoShowSelectedCueId=null;setShowLayout(showLayout,false);if(!locked)scheduleLiveCueFollow();setTransportPresentation();timeline.style.touchAction=conductType!=='manual'&&generalTimelineZoom>1?'pan-x pan-y':'pan-y';if(locked){generalTimelineZoom=1;timeline.style.width='100%';generalTimelineViewport.scrollLeft=0;updateGeneralZoomControls();}updateVersionButton();document.body.classList.toggle('locked',locked);editModeBtn.classList.toggle('active',!locked);showModeBtn.classList.toggle('active',locked);editModeBtn.setAttribute('aria-pressed',String(!locked));showModeBtn.setAttribute('aria-pressed',String(locked));showTitle.disabled=locked;openProjectBtn.disabled=projectFile.disabled=locked;addCueBtn.disabled=locked;$('addMediaGlobalBtn').disabled=locked||importingGlobalMedia;$('globalMediaFile').disabled=locked||importingGlobalMedia;saveAsBtn.disabled=locked||savingProject;if(locked&&preflightState!=='ready')prepareShowMedia(false).catch(console.warn);renderCues();if(locked)requestAnimationFrame(fitShowCueList);syncVideoSurfaces();updateHistoryButtons();}
let importingGlobalMedia=false;
function setEnabled(){playBtn.disabled=false;restartBtn.disabled=false;addCueBtn.disabled=locked;$('addMediaGlobalBtn').disabled=locked||importingGlobalMedia;$('globalMediaFile').disabled=locked||importingGlobalMedia;saveAsBtn.disabled=locked||savingProject;openProjectBtn.disabled=projectFile.disabled=locked;}

function appendNewMediaCue(cue,probe){
 if(cues.includes(cue))return;
 if(conductType==='manual'){
  cue.time=nextManualMainTime();
  if(probe.kind==='video'){
   cue.manualKind='silent';
   cue.manualDuration=roundTenth(probe.duration);
  }
 }
 cues.push(cue);
}
async function importGlobalMedia(files){
 if(!files.length||locked||importingGlobalMedia)return;
 const epoch=copilotProjectEpoch,mode=conductType,staged=[],failures=[];
 const editable=()=>!locked&&epoch===copilotProjectEpoch&&mode===conductType;
 let time=Math.max(0,roundTenth(currentTransportTime())),committed=false;
 importingGlobalMedia=true;setEnabled();
 const screenCheck=files.some(file=>(file.type||mimeFromName(file.name)).startsWith('video/'))
  ?checkScreensForAddedVideo():Promise.resolve(false);
 try{
  for(const file of files){
   if(!editable())return;
   try{
    const mime=file.type||mimeFromName(file.name);
    const probe=await probeMedia(file);
    if(!(probe.duration>0))throw mediaProbeError(probe);
    const assetKey=await storeAsset(file);
    staged.push({file,mime,probe,assetKey});
   }catch(error){failures.push(file.name+' - '+error.message);if(!error.pilotMediaProbe)window.S2APilotDiagnostics?.report('media',error);}
  }
  if(!editable())return;
  if(staged.length){
   pushHistory();
   for(const {file,mime,probe,assetKey} of staged){
    const cue={id:uuid(),time,name:file.name.replace(/\.[^.]+$/,''),description:'',imageDataUrl:null,imageName:null,isBase:false,mediaActions:[]};
    appendNewMediaCue(cue,probe);
    const transition=probe.kind==='audio'&&!(cue.time===0&&!cues.some(item=>item!==cue&&item.time===0))?'fade':'cut';
    cue.mediaActions.push(normalizeMediaAction({kind:probe.kind,assetKey,name:file.name,mime,size:file.size,duration:probe.duration,transition,fadeDuration:3,muted:true}));
    invalidateComputationCaches();
    time=roundTenth(time+probe.duration);
    expandedCueId=cue.id;
   }
   committed=true;invalidatePreflight();renderCues();scheduleAutosave();
  }
  await screenCheck;
  if(failures.length)alert(tr('Fichiers non importés')+' - '+failures.join(', '));
 }finally{
  if(!committed)for(const {assetKey} of staged){
   assetBlobCache.delete(assetKey);await idbDelete(ASSET_STORE,assetKey).catch(console.warn);
  }
  importingGlobalMedia=false;setEnabled();
 }
}
let replacingManualTrack=false;
async function replaceManualTrack(cue,action,file){
 if(replacingManualTrack||!canReorderGoSequence())return;
 const epoch=copilotProjectEpoch;
 const stillEditable=()=>epoch===copilotProjectEpoch&&canReorderGoSequence()&&cues.includes(cue)&&cue.mediaActions.includes(action);
 let key=null,committed=false;
 replacingManualTrack=true;
 try{
  const mime=file.type||mimeFromName(file.name);
  if(mime.startsWith('video/'))throw new Error(tr('Choisissez un fichier audio.'));
  const probe=await probeMedia(file),duration=roundTenth(probe.duration);
  if(probe.kind!=='audio'||!(duration>0))throw mediaProbeError({...probe,reason:probe.reason||'duration'});
  if(!stillEditable())return;
  key=await storeAsset(file.type?file:new File([file],file.name,{type:mime}));
  if(!stillEditable())return;
  const oldDuration=manualPlannedDuration(cue),oldEnd=roundTenth(cue.time+oldDuration),delta=roundTenth(duration-oldDuration);
  const roots=manualMusics(),following=roots.slice(roots.indexOf(cue)+1),children=manualChildren(cue);
  pushHistory();
  cue.mediaActions=cue.mediaActions.map(item=>item===action?normalizeMediaAction({...item,id:uuid(),assetKey:key,name:file.name,mime,size:file.size,duration,inPoint:0,outPoint:duration}):item);
  // Ripple a sequential rundown. Leave deliberately overlapping main cues in place.
  if(following.every(root=>root.time>=oldEnd))for(const root of following)root.time=roundTenth(root.time+delta);
  let adjusted=0;
  for(const child of children){
   const limit=child.waitForGo?roundTenth(Math.max(0,duration-.1)):duration;
   if(child.relativeTime>limit){child.relativeTime=limit;adjusted++;}
  }
  committed=true;
  invalidatePreflight();expandedCueId=cue.id;renderCues();scheduleAutosave();
  if(adjusted)alert(tr('{count} sous-Cue(s) dépassaient la nouvelle durée. Elles ont été rapprochées de la fin pour te permettre de les recaler.',{count:adjusted}));
 }finally{
  if(key&&!committed){assetBlobCache.delete(key);await idbDelete(ASSET_STORE,key).catch(console.warn);}
  replacingManualTrack=false;
 }
}
function manualTrackReplaceControl(cue,action){
 const button=document.createElement('button'),input=document.createElement('input');
 button.type='button';button.className='cueReplaceBtn';button.title=tr('Remplacer la piste');
 button.setAttribute('aria-label',button.title);
 S2AMaterial.set(button,'folder_open');
 button.disabled=!canReorderGoSequence();
 input.type='file';input.accept='audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac,.ogg,.aac,.opus';input.hidden=true;
 button.onclick=()=>{if(canReorderGoSequence()&&!replacingManualTrack)input.click();};
 input.onchange=()=>{
  const file=input.files?.[0];input.value='';
  if(file)replaceManualTrack(cue,action,file).catch(error=>alert(tr('Impossible de remplacer la piste : ')+error.message));
 };
 const fragment=document.createDocumentFragment();fragment.append(button,input);return fragment;
}
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
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.fillStyle='#0b1017';c.fillRect(0,0,w,h);c.strokeStyle=conductType==='manual'?'#b58aff':'#70a9e8';c.lineWidth=1;c.beginPath();
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
  const loopLab=document.createElement('label');loopLab.className='loopToggle';const loop=document.createElement('input');loop.type='checkbox';loop.checked=!!initialAction.loop;loop.disabled=locked;loopLab.append(loop,document.createTextNode(tr('Boucle')));if(initialAction.kind!=='audio'||conductType==='manual')top.append(loopLab);
  if(initialAction.kind==='audio'&&(conductType!=='manual'||isManualMainCue(cue))){
   if(conductType==='manual'){
    if(!cue.visualNumber){
     const chain=document.createElement('label'),enabled=document.createElement('input');
     chain.className='loopToggle';enabled.type='checkbox';enabled.checked=initialAction.autoNext;enabled.disabled=locked;
     chain.append(enabled,document.createTextNode(tr('Enchaîne suivante')));
     enabled.onchange=()=>{
      const track=action();
      setManualCueTransition(cue,track,enabled.checked,enabled.checked?track.autoNextFadeSeconds:0);
      document.getElementById(enabled.id)?.focus({preventScroll:true});
     };
     enabled.id='chain-'+initialAction.id;
     top.append(chain);
    }
    const label=document.createElement('label');label.className='loopToggle';
    const input=document.createElement('input');input.type='checkbox';input.checked=initialAction.overlayAudio;input.disabled=locked||transportPlaying;
    label.title=tr('Lance cette piste pendant que celle en cours continue de jouer.');
    label.append(input,document.createTextNode(tr('Jouer par-dessus')));top.append(label);
    input.onchange=()=>{
     if(locked||transportPlaying){input.checked=action().overlayAudio;return;}
     pushHistory();action().overlayAudio=input.checked;edited();
    };
   }
   const label=document.createElement('label');label.className='loopToggle';
   const ltc=document.createElement('input');ltc.type='checkbox';ltc.checked=initialAction.ltc===true;ltc.disabled=locked||transportPlaying;
   label.append(ltc,document.createTextNode(tr('Générer LTC')));
   ltc.onchange=()=>{if(transportPlaying){ltc.checked=action().ltc===true;return;}pushHistory();action().ltc=ltc.checked;invalidatePreflight();renderCues(false,cue.id);scheduleAutosave();};
   top.append(label);
   if(ltc.checked){
    const address=document.createElement('input');address.type='text';address.size=11;address.maxLength=11;
    address.value=formatLtcAddress(initialAction.ltcStartFrame);address.disabled=ltc.disabled;
    address.setAttribute('aria-label',tr('Départ LTC (HH:MM:SS:II)'));
    address.title=tr('Départ LTC (HH:MM:SS:II)');
    address.oninput=()=>address.setCustomValidity('');
    address.onchange=()=>{
     const a=action(),frame=parseLtcAddress(address.value);
     if(transportPlaying){address.value=formatLtcAddress(a.ltcStartFrame);return;}
     if(frame===null){address.setCustomValidity(tr('Adresse LTC invalide (HH:MM:SS:II, images de 00 à 24).'));address.reportValidity();return;}
     address.value=formatLtcAddress(frame);
     if(frame===a.ltcStartFrame)return;
     pushHistory();a.ltcStartFrame=frame;invalidatePreflight();scheduleAutosave();
    };
    top.append(address);
    if(conductType==='manual'&&!cue.visualNumber){
     const field=document.createElement('label'),lead=document.createElement('select');
     field.className='ltcLeadField';
     field.append(tr('Pré-roll LTC'),lead);
     for(let seconds=0;seconds<=5;seconds++)lead.append(new Option(seconds+' s',String(seconds)));
     lead.value=String(normalizeLtcLead(initialAction.ltcLead));lead.disabled=ltc.disabled;
     lead.title=tr('Le LTC démarre avant la musique, qui entre au timecode indiqué.');
     lead.onchange=()=>{
      const a=action();
      if(locked||transportPlaying||manualPending){lead.value=String(normalizeLtcLead(a.ltcLead));return;}
      pushHistory();a.ltcLead=normalizeLtcLead(Number(lead.value));invalidatePreflight();scheduleAutosave();
     };
     top.append(field);
    }
   }
  }
  const main=document.createElement('div');main.className='mediaEditorMain'+(initialAction.kind==='video'?' hasVideoPreview':'');
  const lane=document.createElement('div');lane.className='mediaEditorTimeline';
  const toolbar=document.createElement('div');toolbar.className='mediaZoomControls';toolbar.setAttribute('aria-label',tr('Zoom de la timeline du fichier'));
  const zoomOut=document.createElement('button'),zoomIn=document.createElement('button'),zoomLabel=document.createElement('span');zoomOut.type=zoomIn.type='button';S2AMaterial.set(zoomOut,'zoom_out');S2AMaterial.set(zoomIn,'zoom_in');zoomOut.title=tr('Dézoomer la timeline du fichier');zoomIn.title=tr('Zoomer la timeline du fichier');zoomOut.setAttribute('aria-label',tr('Dézoomer le média'));zoomIn.setAttribute('aria-label',tr('Zoomer le média'));zoomOut.className='mediaZoomOut';zoomIn.className='mediaZoomIn';zoomLabel.className='mediaZoomLabel';toolbar.append(zoomOut,zoomLabel,zoomIn);
  const viewport=document.createElement('div');viewport.className='mediaVisual';viewport.title=tr('Déplacer la tête de lecture ; faire défiler horizontalement après un zoom');
  const visual=document.createElement('div');visual.className='mediaVisualContent';viewport.append(visual);
  const savedView=mediaPreviewViews.get(initialAction.id)||{zoom:1,start:0};let zoom=Math.max(1,Math.min(64,savedView.zoom));
  const canvas=document.createElement('canvas');canvas.className='waveCanvas';visual.append(canvas);
  const selection=document.createElement('div');selection.className='mediaSelection';const excludedBefore=document.createElement('div'),excludedAfter=document.createElement('div');excludedBefore.className='mediaExcluded before';excludedAfter.className='mediaExcluded after';visual.append(excludedBefore,excludedAfter);
  const ih=document.createElement('div'),oh=document.createElement('div');ih.className=oh.className='trimHandle';ih.title=tr('Point IN');oh.title=tr('Point OUT');
  const head=document.createElement('div');head.className='mediaPreviewHead';head.tabIndex=locked?-1:0;head.setAttribute('role','slider');head.setAttribute('aria-label',tr('Position dans le média'));head.setAttribute('aria-valuemin','0');head.title=tr('Déplacer la tête de lecture du média');
  const status=document.createElement('span');status.className='waveformStatus';status.hidden=true;visual.append(selection,head,ih,oh,status);
  const labels=document.createElement('div');labels.className='mediaVisualLabels';const startLabel=document.createElement('span'),positionLabel=document.createElement('span'),endLabel=document.createElement('span');startLabel.textContent=fmt(0);positionLabel.className='mediaPreviewPosition';endLabel.textContent=fmt(initialAction.duration||0);labels.append(startLabel,positionLabel,endLabel);lane.append(toolbar,viewport,labels);main.append(lane);
  const el=document.createElement(initialAction.kind==='video'?'video':'audio');el.preload='metadata';el.playsInline=true;el.controls=false;el.loop=false;
  if(initialAction.kind==='video'){const monitor=document.createElement('div');monitor.className='mediaEditMonitor';monitor.setAttribute('aria-label',tr('Aperçu vidéo du média sélectionné'));monitor.append(el);main.append(monitor);}else{el.hidden=true;ed.append(el);}
  ed.append(top,main);
  let session=null,seekSequence=0,position=mediaPreviewPositions.get(initialAction.id)??(Number(initialAction.inPoint)||0);
  if(initialAction.kind==='audio'){
   const field=document.createElement('label');
   field.className='trackGainField';
   const input=document.createElement('input');
   input.type='text';input.inputMode='text';input.maxLength=12;input.disabled=locked;
   const label=tr('Volume de sortie de la piste');
   input.setAttribute('aria-label',label);
   field.title=label;
   field.append(input,'dB');
   const gainControls=document.createElement('div'),lock=document.createElement('button');
   gainControls.className='trackGainControls';lock.type='button';lock.className='trackGainLock';lock.disabled=locked;
   const panField=document.createElement('div'),rail=document.createElement('span'),pan=document.createElement('input');
   panField.className='trackPanField';rail.className='trackPanRail';
   pan.type='range';pan.min='-1';pan.max='1';pan.step='1';
   pan.setAttribute('aria-label',tr('Position stéréo'));pan.disabled=locked;
   pan.value=String(normalizeTrackPan(initialAction.pan));
   const panText=()=>{
    const text=tr(['Gauche','Centre','Droite'][Number(pan.value)+1]);
    pan.setAttribute('aria-valuetext',text);pan.title=text;panField.dataset.pan=pan.value;
   };
   panText();pan.oninput=panText;
   pan.onchange=()=>{
    panText();
    const a=action(),value=normalizeTrackPan(Number(pan.value));
    if(locked||value===a.pan)return;
    pushHistory();a.pan=value;
    const rt=runtimeAudio.get(a.id);
    if(rt){rt.item.action=a;setRuntimeGain(rt,rt.manualGainValue??1);}
    applyPreview(a.gainDb);scheduleAutosave();
   };
   const speaker=side=>{
    const endpoint=document.createElement('span');endpoint.className='trackPanSide';endpoint.dataset.side=side;
    endpoint.setAttribute('aria-hidden','true');
    endpoint.innerHTML='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h3l4-3v10l-4-3H2zM11 5c2 2 2 4 0 6"/></svg>'+side;
    return endpoint;
   };
   rail.append(pan);panField.append(speaker('L'),rail,speaker('R'));gainControls.append(field,lock,panField);
   if(initialAction.levelMatchDb){
    const automaticGain=document.createElement('span');automaticGain.className='trackAutoGain';
    const db=initialAction.levelMatchDb;
    automaticGain.textContent=tr('Auto {gain} dB',{gain:(db>0?'+':'')+db});
    gainControls.append(automaticGain);
   }
   toolbar.prepend(gainControls);

   const level=document.createElement('button');
   level.type='button';level.className='trackGainLine';level.disabled=locked;
   level.setAttribute('role','slider');
   level.setAttribute('aria-label',label);
   level.setAttribute('aria-valuemin',String(TRACK_GAIN_MIN));
   level.setAttribute('aria-valuemax',String(TRACK_GAIN_MAX));
   visual.append(level);
   function updateGainLock(){
    const isLocked=!action().gainLineUnlocked;
    level.disabled=locked||isLocked;
    lock.setAttribute('aria-pressed',String(isLocked));
    lock.title=tr(isLocked?'Déverrouiller la ligne de volume':'Verrouiller la ligne de volume');
    lock.setAttribute('aria-label',lock.title);
    const shackle=isLocked?'M7 10V7a5 5 0 0 1 10 0v3':'M7 10V7a5 5 0 0 1 10 0';
    lock.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="'+shackle+'"/><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M12 14v3"/></svg>';
   }
   lock.onclick=()=>{
    if(locked)return;
    pushHistory();action().gainLineUnlocked=!action().gainLineUnlocked;
    updateGainLock();scheduleAutosave();
   };
   updateGainLock();
   const formatDb=db=>(db>0?'+':'')+String(db);
   const display=db=>{
    const ratio=db<0?db/-TRACK_GAIN_MIN:db/TRACK_GAIN_MAX;
    level.style.top=(50-ratio*39)+'%';
    level.setAttribute('aria-valuenow',String(db));
    level.setAttribute('aria-valuetext',formatDb(db)+' dB');
    level.title=label+' · '+formatDb(db)+' dB';
    input.value=formatDb(db);
   };
   const applyPreview=db=>{
    if(session?.running||mediaGainNodes.has(el))setMediaOutputGain(el,trackGainFactor(trackOutputDb(action(),db)),true,normalizeTrackPan(action().pan));
   };
   const commitGain=db=>{
    const a=action();
    if(locked||a.gainDb===db){display(normalizeTrackGain(a.gainDb));return;}
    pushHistory();
    a.gainDb=db;
    const rt=runtimeAudio.get(a.id);
    if(rt){rt.item.action=a;setRuntimeGain(rt,rt.manualGainValue??1);}
    applyPreview(db);
    display(db);
    scheduleAutosave();
   };
   input.onchange=()=>{
    const raw=input.value.trim().replace(/\s*dB$/i,'').replace(',','.');
    if(/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw))commitGain(normalizeTrackGain(raw));
    else display(normalizeTrackGain(action().gainDb));
   };
   input.onkeydown=e=>{
    if(e.key==='Enter'){e.preventDefault();e.stopPropagation();input.blur();}
   };
   level.onkeydown=e=>{
    if(level.disabled)return;
    const steps={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1};
    const value=normalizeTrackGain(action().gainDb);
    if(e.key==='Home')commitGain(0);
    else if(steps[e.key])commitGain(normalizeTrackGain(value+steps[e.key]*(e.shiftKey?3:1)));
    else return;
    e.preventDefault();e.stopPropagation();
   };
   level.onpointerdown=e=>{
    if(level.disabled||e.button!==0||e.isPrimary===false)return;
    e.preventDefault();e.stopPropagation();
    const pointer=e.pointerId,original=normalizeTrackGain(action().gainDb);
    const height=visual.getBoundingClientRect().height;
    if(!height)return;
    const startY=e.clientY,initialRatio=original<0?original/-TRACK_GAIN_MIN:original/TRACK_GAIN_MAX;
    let value=original;
    level.focus({preventScroll:true});
    level.setPointerCapture(pointer);
    function move(event){
     if(event.pointerId!==pointer)return;
     const ratio=initialRatio+(startY-event.clientY)/(height*.39);
     value=normalizeTrackGain(ratio*(ratio<0?-TRACK_GAIN_MIN:TRACK_GAIN_MAX));
     display(value);
     applyPreview(value);
    }
    function finish(event){
     if(event.pointerId!==pointer)return;
     level.removeEventListener('pointermove',move);
     level.removeEventListener('pointerup',finish);
     level.removeEventListener('pointercancel',finish);
     level.removeEventListener('lostpointercapture',finish);
     if(event.type==='pointerup'&&level.isConnected&&!level.disabled){move(event);commitGain(value);}
     else{display(original);applyPreview(original);}
    }
    level.addEventListener('pointermove',move);
    level.addEventListener('pointerup',finish);
    level.addEventListener('pointercancel',finish);
    level.addEventListener('lostpointercapture',finish);
   };
   display(normalizeTrackGain(initialAction.gainDb));
  }
  const refreshChildMarkers=[];
  if(conductType==='manual'&&(initialAction.kind==='audio'||(isManualMainCue(cue)&&initialAction===cue.mediaActions.find(a=>a.kind==='video')&&!cue.mediaActions.some(a=>a.kind==='audio')))){
    const add=document.createElement('button');add.type='button';add.className='manualAddTop';add.textContent=tr('+ Ajouter une Cue');add.disabled=locked;add.onclick=()=>addManualTop(cue,Math.max(0,position-(Number(action().inPoint)||0)));toolbar.append(add);
    for(const child of manualChildren(cue)){
      const marker=document.createElement('button');
      marker.type='button';marker.className='manualWaveTop';marker.dataset.subCueId=child.id;marker.textContent=child.name;marker.disabled=locked;visual.append(marker);
      const showTime=relative=>{
       const inPoint=Number(action().inPoint)||0,duration=Math.max(.1,Number(action().duration)||0);
       marker.style.left=((relative+inPoint)/duration*100)+'%';
       marker.title='+'+fmt(relative);
       marker.setAttribute('aria-label',child.name+' · '+marker.title);
      };
      refreshChildMarkers.push(()=>showTime(child.relativeTime));
      marker.onpointerdown=event=>{
       if(locked||event.button!==0||event.isPrimary===false)return;
       event.preventDefault();event.stopPropagation();
       const pointer=event.pointerId,epoch=copilotProjectEpoch,original=child.relativeTime;
       const bounds=visual.getBoundingClientRect(),startX=event.clientX-bounds.left;
       const duration=Number(action().duration)||0;
       if(!bounds.width||!duration)return;
       marker.focus({preventScroll:true});
       marker.setPointerCapture(pointer);
       let relative=original,moving=false;
       function move(e){
        if(e.pointerId!==pointer)return;
        const dx=e.clientX-visual.getBoundingClientRect().left-startX;
        if(!moving&&Math.abs(dx)<4)return;
        moving=true;
        const limit=Math.max(0,Math.min(manualPlannedDuration(cue),mediaSegmentDuration(action())));
        relative=Math.max(0,Math.min(limit,roundTenth(original+dx/bounds.width*duration)));
        showTime(relative);
       }
       function finish(e){
        if(e.pointerId!==pointer)return;
        if(e.type==='pointerup')move(e);
        marker.removeEventListener('pointermove',move);
        marker.removeEventListener('pointerup',finish);
        marker.removeEventListener('pointercancel',finish);
        marker.removeEventListener('lostpointercapture',finish);
        if(e.type!=='pointerup'||relative===original||locked||epoch!==copilotProjectEpoch||!cues.includes(child)||child.parentMusicId!==cue.id){
         showTime(original);
         return;
        }
        pushHistory();
        child.relativeTime=relative;child.time=roundTenth(cue.time+relative);
        renderCues();scheduleAutosave();
       }
       marker.addEventListener('pointermove',move);
       marker.addEventListener('pointerup',finish);
       marker.addEventListener('pointercancel',finish);
       marker.addEventListener('lostpointercapture',finish);
      };
    }
  }
  function saveView(){const d=Number(action().duration)||0;mediaPreviewViews.set(initialAction.id,{zoom,start:visual.clientWidth?viewport.scrollLeft/visual.clientWidth*d:0});}
  function updateViewLabels(){const d=Number(action().duration)||0,total=visual.clientWidth||viewport.clientWidth*zoom;startLabel.textContent=fmt(total?viewport.scrollLeft/total*d:0);endLabel.textContent=fmt(total?Math.min(d,(viewport.scrollLeft+viewport.clientWidth)/total*d):d);zoomLabel.textContent=`×${Number(zoom.toFixed(2))}`;zoomOut.disabled=locked||zoom<=1;zoomIn.disabled=locked||zoom>=Math.min(64,Math.max(1,d/.5));}
  function keepHeadVisible(){if(zoom<=1||!viewport.clientWidth)return;const x=position/Math.max(.1,Number(action().duration)||.1)*visual.clientWidth;if(x<viewport.scrollLeft||x>viewport.scrollLeft+viewport.clientWidth)viewport.scrollLeft=Math.max(0,x-viewport.clientWidth/2);}
  function drawVisibleWaveform(){if(!canvas.isConnected)return;const total=visual.clientWidth||1,width=viewport.clientWidth;canvas.style.width=width+'px';canvas.style.transform=`translateX(${viewport.scrollLeft}px)`;const peaks=mediaVisualCache.get(initialAction.id);drawWaveform(canvas,Array.isArray(peaks)?peaks:[],viewport.scrollLeft/total,Math.min(1,(viewport.scrollLeft+width)/total));}
  let waveformFrame=0,waveformResizeObserver=null;function scheduleVisibleWaveform(){if(waveformFrame)return;waveformFrame=requestAnimationFrame(()=>{waveformFrame=0;drawVisibleWaveform();});}
  function setZoom(next,anchor){
   if(locked)return;
   const d=Number(action().duration)||0;
   const scale=Math.max(1,Math.min(next,64,Math.max(1,d/.5)));
   if(scale===zoom)return;
   const start=waveformZoomStart(viewport,visual,anchor,position/Math.max(.1,d));
   zoom=scale;
   visual.style.width=(zoom*100)+'%';
   viewport.scrollLeft=Math.max(0,start*visual.clientWidth-(anchor??viewport.clientWidth/2));
   drawVisibleWaveform();updateViewLabels();saveView();
  }
  installWaveformPinch(viewport,(factor,anchor)=>setZoom(zoom*factor,anchor));
  installWaveformPan(viewport,pixels=>{
   if(locked||zoom<=1||viewport.scrollWidth<=viewport.clientWidth)return false;
   viewport.scrollLeft+=pixels;
   return true;
  });
  zoomOut.onclick=()=>setZoom(zoom/2);zoomIn.onclick=()=>setZoom(zoom*2);viewport.addEventListener('scroll',()=>{updateViewLabels();saveView();scheduleVisibleWaveform();});
  function updatePosition(t=position){position=Math.max(0,Math.min(t,Number(action().duration)||0));mediaPreviewPositions.set(initialAction.id,position);const d=Math.max(.1,Number(action().duration)||.1);head.style.left=`${position/d*100}%`;head.setAttribute('aria-valuemax',String(action().duration||0));head.setAttribute('aria-valuenow',String(position));head.setAttribute('aria-valuetext',fmt(position));positionLabel.textContent=fmt(position);if(session?.running)keepHeadVisible();}
  function refreshTrim(){updateTrimVisual(action(),visual,selection,ih,oh,inInput,outInput);refreshChildMarkers.forEach(refresh=>refresh());updateViewLabels();updatePosition();}
  function ensureSession(){
    if(session)return session;
    session={cueId:cue.id,el,disposed:false,running:false,pendingPlay:false,command:0,raf:0,readyPromise:null,cancelMetadata:null};mediaPreviewSessions.set(initialAction.id,session);
    const setButton=(playing,loading=false)=>{S2AMaterial.button(toggle,playing?'pause':'play_arrow',loading?tr('Chargement…'):playing?tr('Ⅱ Pause'):tr('▶ Lecture'));toggle.setAttribute('aria-label',playing||loading?tr('Pause du média'):tr('Lecture du média'));};
    session.pause=()=>{++session.command;session.running=false;session.pendingPlay=false;el.pause();cancelAnimationFrame(session.raf);session.raf=0;setButton(false);updatePosition(el.readyState?el.currentTime:position);};
    session.dispose=()=>{waveformResizeObserver?.disconnect();cancelAnimationFrame(waveformFrame);saveView();session.pause();session.disposed=true;session.cancelMetadata?.();releaseMediaGain(el);el.removeAttribute('src');el.load();};
    session.ready=()=>{if(session.disposed)return Promise.resolve(null);if(el.readyState>=1&&!el.error)return Promise.resolve(el);if(session.readyPromise)return session.readyPromise;
      session.readyPromise=(async()=>{try{const initialPosition=position;const url=await assetUrl(action().assetKey);if(session.disposed)return null;if(!url)throw new Error(tr('Média introuvable'));el.src=url;
        await new Promise((resolve,reject)=>{const finish=error=>{clearTimeout(timer);el.removeEventListener('loadedmetadata',ready);el.removeEventListener('error',fail);session.cancelMetadata=null;error?reject(error):resolve();};const ready=()=>finish();const fail=()=>finish(new Error(tr('Média non décodable')));const timer=setTimeout(()=>finish(new Error(tr('Délai de chargement dépassé'))),10000);session.cancelMetadata=()=>finish(new Error(tr('Aperçu fermé')));el.addEventListener('loadedmetadata',ready,{once:true});el.addEventListener('error',fail,{once:true});if(el.readyState>=1)ready();else el.load();});
        if(session.disposed)return null;try{el.currentTime=initialPosition;}catch{}return el;
      }catch{if(!session.disposed){positionLabel.textContent=tr('Aperçu indisponible');setButton(false);}return null;}finally{session.readyPromise=null;}})();return session.readyPromise;
    };
    const checkBounds=()=>{if(!session.running)return;const a=action(),end=Number(a.outPoint)||Number(a.duration)||0,start=Number(a.inPoint)||0;if(el.currentTime>=end-.01||el.ended){if(mediaLoops(a)&&end>start){el.currentTime=start;if(el.paused)el.play().catch(()=>session.pause());}else{session.pause();try{el.currentTime=end;}catch{}updatePosition(end);}}};
    const tick=()=>{session.raf=0;if(session.disposed||!session.running)return;checkBounds();updatePosition(el.currentTime);if(session.running)session.raf=requestAnimationFrame(tick);};
    session.play=async()=>{
     try{checkPilotOutput();}catch(error){positionLabel.textContent=error.message;return;}
     const contextReady=initialAction.kind==='audio'?ensureAudioContext().catch(()=>null):null;pauseMediaPreviews(session);const command=++session.command;session.pendingPlay=true;setButton(false,true);const player=el.readyState>=1&&!el.error?el:await session.ready();if(!player||session.disposed||command!==session.command){if(command===session.command){session.pendingPlay=false;setButton(false);}return;}
      const a=action(),start=Number(a.inPoint)||0,end=Number(a.outPoint)||Number(a.duration)||0;if(end<=start){session.pause();return;}if(el.currentTime<start||el.currentTime>=end-.01)el.currentTime=start;el.muted=a.kind==='video'&&!!a.muted;if(a.kind==='audio'){const db=trackOutputDb(a);setMediaOutputGain(el,trackGainFactor(db),!!db,normalizeTrackPan(a.pan));}
      try{if((pilotOutputId||el.sinkId)&&el.sinkId!==pilotOutputId)await routePilotElement(el);checkPilotOutput();if(session.disposed||command!==session.command)return;const started=el.play();await Promise.all([contextReady,started]);if(session.disposed||command!==session.command){el.pause();return;}session.pendingPlay=false;session.running=true;setButton(true);if(!session.raf)session.raf=requestAnimationFrame(tick);}catch{if(command===session.command){session.pendingPlay=false;setButton(false);positionLabel.textContent=tr('Lecture indisponible');}}
    };
    el.addEventListener('timeupdate',()=>{if(session.disposed)return;checkBounds();updatePosition(el.currentTime);});el.addEventListener('seeked',()=>{if(!session.disposed)updatePosition(el.currentTime);});el.addEventListener('ended',checkBounds);
    return session;
  }
  async function seek(t){const sequence=++seekSequence;updatePosition(t);const target=position;const s=ensureSession(),player=await s.ready();if(!player||s.disposed||sequence!==seekSequence)return;try{player.currentTime=target;}catch{}updatePosition(target);keepHeadVisible();}
  toggle.onclick=()=>{const s=ensureSession();if(s.running||s.pendingPlay)s.pause();else s.play();};
  function edited(){invalidatePreflight();renderTimeline();updateDurationEditor();scheduleAutosave();}
  const commit=(which,input)=>{const v=parseTime(input.value);if(v===null){refreshTrim();return;}pushHistory();const a=action();if(which==='in')a.inPoint=roundTenth(Math.max(0,Math.min(v,(a.outPoint||a.duration)-.1)));else a.outPoint=roundTenth(Math.max((a.inPoint||0)+.1,Math.min(v,a.duration||v)));session?.pause();refreshTrim();seek(which==='in'?a.inPoint:a.outPoint);if(a.ltc)invalidatePreflight();edited();};
  inInput.onchange=()=>commit('in',inInput);outInput.onchange=()=>commit('out',outInput);loop.onchange=()=>{pushHistory();action().loop=loop.checked;edited();};
  const timeAt=e=>{const r=visual.getBoundingClientRect();return Math.max(0,Math.min(Number(action().duration)||0,(e.clientX-r.left)/r.width*(Number(action().duration)||0)));};
  visual.addEventListener('pointerdown',event=>{
   if(locked||event.button!==0||event.isPrimary===false||event.target.closest('.trimHandle,.manualWaveTop,.trackGainLine'))return;
   event.preventDefault();head.focus({preventScroll:true});
   const pointer=event.pointerId;
   visual.setPointerCapture(pointer);seek(timeAt(event));
   const move=next=>{if(next.pointerId===pointer)seek(timeAt(next));};
   const finish=next=>{
    if(next.pointerId!==pointer)return;
    visual.removeEventListener('pointermove',move);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])visual.removeEventListener(type,finish);
   };
   visual.addEventListener('pointermove',move);
   for(const type of ['pointerup','pointercancel','lostpointercapture'])visual.addEventListener(type,finish);
  });
  head.addEventListener('keydown',e=>{if(locked)return;let t=position;if(e.key==='ArrowLeft')t-=e.shiftKey?1:.1;else if(e.key==='ArrowRight')t+=e.shiftKey?1:.1;else if(e.key==='Home')t=0;else if(e.key==='End')t=Number(action().duration)||0;else return;e.preventDefault();seek(t);});
  const drag=(which,e)=>{if(locked)return;e.preventDefault();e.stopPropagation();const before=captureEditableState();ensureSession().pause();const handle=which==='in'?ih:oh;handle.setPointerCapture(e.pointerId);const move=ev=>{const a=action(),v=roundTenth(timeAt(ev)),d=Math.max(.1,a.duration||.1);if(which==='in')a.inPoint=Math.min(v,(a.outPoint||d)-.1);else a.outPoint=Math.max((a.inPoint||0)+.1,v);refreshTrim();seek(which==='in'?a.inPoint:a.outPoint);};const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);pushHistory(before);edited();};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);};
  ih.addEventListener('pointerdown',e=>drag('in',e));oh.addEventListener('pointerdown',e=>drag('out',e));visual.style.width=`${zoom*100}%`;refreshTrim();
  if(!locked&&isCueEditorOpen(cue))requestAnimationFrame(()=>{if(!ed.isConnected)return;viewport.scrollLeft=savedView.start/Math.max(.1,Number(action().duration)||.1)*visual.clientWidth;updateViewLabels();drawVisibleWaveform();generateMediaWaveform(action(),canvas,status).then(drawVisibleWaveform);ensureSession().ready();if(typeof ResizeObserver==='function'){waveformResizeObserver=new ResizeObserver(scheduleVisibleWaveform);waveformResizeObserver.observe(viewport);}});
  return ed;
}

function mediaFadeDurationField(input,transition){
 const field=document.createElement('label');
 field.className='mediaFadeDuration';field.hidden=transition!=='fade';
 input.setAttribute('aria-label',input.title);
 field.append(input,'s');
 return field;
}
function mediaActionElement(cue,a){const row=document.createElement('div');row.className='mediaAction'+(a.kind==='stopAll'?' stopAllAction':'');if(a.kind==='stopAll'){const ident=document.createElement('div');ident.className='mediaActionIdentity';const badge=document.createElement('span');badge.className='mediaKindBadge';badge.textContent='STOP';const n=document.createElement('div');n.className='mediaActionName';n.textContent=tr('ARRÊT / FONDU TOUS LES MÉDIAS');ident.append(badge,n);const opts=document.createElement('div');opts.className='mediaActionOptions';const sel=document.createElement('select');sel.innerHTML='<option value="cut">CUT</option><option value="fade">' + tr('FONDU') + '</option>';sel.value=a.transition==='fade'?'fade':'cut';sel.disabled=locked;const dur=document.createElement('input');dur.type='number';dur.min='0.1';dur.step='0.1';dur.value=Number(a.fadeDuration||3).toFixed(1);dur.disabled=locked||sel.value!=='fade';dur.title=tr('Durée du fondu global en secondes');const field=mediaFadeDurationField(dur,a.transition);sel.onchange=()=>{pushHistory();a.transition=sel.value;dur.disabled=locked||a.transition!=='fade';field.hidden=a.transition!=='fade';renderCues();scheduleAutosave();};dur.onchange=()=>{pushHistory();a.fadeDuration=Math.max(.1,Number(dur.value)||3);dur.value=a.fadeDuration.toFixed(1);scheduleAutosave();};opts.append(sel,field);const del=document.createElement('button');del.className='danger removeMediaBtn';del.type='button';S2AMaterial.button(del,'delete',tr('Supprimer'));del.disabled=locked;del.onclick=()=>{pushHistory();cue.mediaActions=cue.mediaActions.filter(x=>x.id!==a.id);renderCues();scheduleAutosave();};row.append(ident,opts,document.createElement('span'),del);return row;}const prep=preparedMedia.get(a.id);if(prep?.ready)row.classList.add('prepared');if(prep?.error)row.classList.add('prepareError');const ident=document.createElement('div');ident.className='mediaActionIdentity';const badge=document.createElement('span');badge.className='mediaKindBadge '+a.kind;badge.textContent=a.kind==='video'?tr('VIDÉO'):'AUDIO';const names=document.createElement('div');names.style.minWidth='0';const n=document.createElement('div');n.className='mediaActionName';n.textContent=a.name;if(a===cueNamedTrack(cue))names.append(cueRenameButton(cue,'mediaRename',a.name));const meta=document.createElement('div');meta.className='mediaActionMeta';meta.textContent=`${fmt(mediaSegmentDuration(a))}${tr(" utile /")} ${a.duration?fmt(a.duration):tr('durée inconnue')} · ${(a.size/1024/1024).toFixed(1)}${tr(" Mo")}`;names.append(n,meta);ident.append(badge,names);const opts=document.createElement('div');opts.className='mediaActionOptions';if(a.kind==='audio'){const sel=document.createElement('select');sel.innerHTML='<option value="cut">CUT</option><option value="fade">' + tr('FONDU') + '</option>';sel.value=a.transition;sel.disabled=locked;const dur=document.createElement('input');dur.type='number';dur.min='.1';dur.step='.1';dur.value=a.fadeDuration||3;dur.disabled=locked;dur.title=tr('Durée du fondu en secondes');const field=mediaFadeDurationField(dur,a.transition);sel.onchange=()=>{pushHistory();a.transition=sel.value;field.hidden=a.transition!=='fade';scheduleAutosave();};dur.onchange=()=>{pushHistory();a.fadeDuration=Math.max(.1,+dur.value||3);scheduleAutosave();};opts.append(sel,field);}else{const mute=document.createElement('button');mute.type='button';mute.className='videoMuteBtn';mute.disabled=locked;const refresh=()=>{S2AMaterial.set(mute,a.muted?'volume_off':'volume_up');mute.setAttribute('aria-pressed',String(!!a.muted));mute.title=tr(a.muted?'Vidéo muette — activer le son':'Son vidéo actif — couper le son');mute.setAttribute('aria-label',mute.title);};refresh();mute.onclick=()=>{pushHistory();a.muted=!a.muted;refresh();scheduleAutosave();};opts.append(mute);}row.append(ident,opts,mediaTrimEditor(cue,a));return row;}

function cuePreparationClass(cue){const acts=(cue.mediaActions||[]).filter(a=>a.kind!=='stopAll');if(!acts.length)return'';if(acts.some(a=>preparedMedia.get(a.id)?.error))return'error';if(acts.every(a=>preparedMedia.get(a.id)?.ready))return'ready';return'';}
function duplicateCue(cue){
 if(locked)return;pushHistory();const copy=clone(cue);copy.id=uuid();copy.name=(cue.name||'Cue')+tr(' (copie)');copy.isBase=false;
 copy.mediaActions=(copy.mediaActions||[]).map((a,i)=>{const originalId=cue.mediaActions[i].id;a.id=uuid();if(mediaVisualCache.has(originalId))mediaVisualCache.set(a.id,mediaVisualCache.get(originalId));return a;});
 if(cue.visualNumber){
  copy.time=nextManualMainTime();
  const children=manualChildren(cue).map(child=>({...clone(child),id:uuid(),parentMusicId:copy.id,time:roundTenth(copy.time+child.relativeTime),mediaActions:child.mediaActions.map(action=>({...clone(action),id:uuid()}))}));
  cues.push(copy,...children);
 }else cues.splice(cues.indexOf(cue)+1,0,copy);
 const sheet=pilotTools.sequenceSheets.find(item=>item.cueId===cue.id);
 if(sheet)pilotTools.sequenceSheets.push({...clone(sheet),cueId:copy.id});
 expandedCueId=copy.id;invalidatePreflight();renderCues();scheduleAutosave();
}
function moveCueInList(cue,targetId,after){
 if(locked||cue.id===targetId)return;
 const remaining=orderedCues().filter(c=>c.id!==cue.id),target=remaining.findIndex(c=>c.id===targetId);if(target<0)return;
 const index=target+(after?1:0),previous=remaining[index-1],next=remaining[index];
 let time=previous&&next?roundTenth((previous.time+next.time)/2):previous?roundTenth(previous.time+1):0;
 pushHistory();cue.time=Math.max(0,time);updateManualRelative(cue);remaining.splice(index,0,cue);cues=remaining;expandedCueId=cue.id;
 invalidatePreflight();renderCues();scheduleAutosave();
}
const CUE_DRAG_HOLD_MS=330;
let cancelCueReorder=null;

function bindCueReorderGesture(handle,prepare){
 function begin(point,touch,id){
  if(cancelCueReorder||handle.disabled)return false;
  const drag=prepare();
  if(!drag)return false;
  const box=drag.source.getBoundingClientRect();
  const startX=point.clientX,startY=point.clientY;
  let x=startX,y=startY,ghost=null,moved=false,hold=0,frame=0;
  const options={capture:true,passive:false};
  const moveType=touch?'touchmove':'pointermove',endType=touch?'touchend':'pointerup',cancelType=touch?'touchcancel':'pointercancel';
  const getPoint=event=>touch?Array.from(event.changedTouches).find(item=>item.identifier===id):event.pointerId===id?event:null;
  const valid=()=>handle.isConnected&&drag.valid();
  function update(){
   ghost.style.transform='translate3d('+(x-startX)+'px,'+(y-startY)+'px,0) scale(1.04)';
   if(moved)drag.locate(x,y);
  }
  function scroll(){
   if(!valid()){cancel();return;}
   if(moved&&drag.scroll(x,y))drag.locate(x,y);
   frame=requestAnimationFrame(scroll);
  }
  function lift(){
   if(!valid()){cancel();return;}
   ghost=drag.source.cloneNode(true);
   ghost.classList.add('cueReorderGhost');
   ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');
   ghost.removeAttribute('id');
   for(const child of ghost.querySelectorAll('[id],button,input,select,textarea,a,[tabindex]')){
    child.removeAttribute('id');child.tabIndex=-1;
   }
   Object.assign(ghost.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px'});
   document.body.append(ghost);
   drag.source.classList.add('cueReorderSource');
   update();
   frame=requestAnimationFrame(scroll);
  }
  function move(event){
   const current=getPoint(event);
   if(!current)return;
   if(event.cancelable)event.preventDefault();
   x=current.clientX;y=current.clientY;
   const distance=Math.max(Math.abs(x-startX),Math.abs(y-startY));
   if(!ghost&&touch){
    if(distance>10)cancel();
    return;
   }
   if(distance>=5)moved=true;
   if(!moved)return;
   if(!ghost)lift();else update();
  }
  function end(event){
   const current=getPoint(event);
   if(!current){if(touch&&event.type===cancelType&&!event.changedTouches.length)cancel();return;}
   if(event.cancelable)event.preventDefault();
   const drop=event.type===endType&&ghost&&moved&&valid();
   cancel();
   if(drop)drag.drop(current.clientX,current.clientY);
  }
  function cancelMultitouch(event){if(event.touches.length>1)cancel();}
  function cancel(){
   clearTimeout(hold);cancelAnimationFrame(frame);
   window.removeEventListener(moveType,move,true);
   window.removeEventListener(endType,end,true);
   window.removeEventListener(cancelType,end,true);
   window.removeEventListener('blur',cancel);
   if(touch)window.removeEventListener('touchstart',cancelMultitouch,true);
   drag.source.classList.remove('cueReorderSource');
   ghost?.remove();drag.clear();cancelCueReorder=null;
  }
  cancelCueReorder=cancel;
  window.addEventListener(moveType,move,options);
  window.addEventListener(endType,end,options);
  window.addEventListener(cancelType,end,options);
  window.addEventListener('blur',cancel);
  if(touch){
   window.addEventListener('touchstart',cancelMultitouch,true);
   hold=setTimeout(lift,CUE_DRAG_HOLD_MS);
  }
  return true;
 }
 handle.addEventListener('touchstart',event=>{
  if(event.touches.length!==1)return;
  const point=event.changedTouches[0];
  if(begin(point,true,point.identifier)){event.preventDefault();event.stopPropagation();}
 },{passive:false});
 handle.addEventListener('pointerdown',event=>{
  if(event.pointerType==='touch'||event.button!==0||event.isPrimary===false)return;
  if(begin(event,false,event.pointerId)){event.preventDefault();event.stopPropagation();}
 });
 handle.addEventListener('contextmenu',event=>event.preventDefault());
}

function cueListDragSiblings(cue){
 return conductType==='manual'?goSequenceSiblings(cue):orderedCues();
}
function dropCueInList(cue,targetId,after){
 if(conductType!=='manual'){moveCueInList(cue,targetId,after);return;}
 const siblings=goSequenceSiblings(cue).filter(item=>item!==cue);
 const index=siblings.findIndex(item=>item.id===targetId);
 if(index>=0)reorderGoSequence(cue.id,siblings[index+(after?1:0)]?.id??null);
}
function attachCueDrag(handle,cue,row){
 const valid=()=>!locked&&(conductType!=='manual'||canReorderGoSequence());
 bindCueReorderGesture(handle,()=>{
  if(!valid())return null;
  const siblings=new Set(cueListDragSiblings(cue).map(item=>item.id));
  const targets=[...cueList.children].filter(item=>item!==row&&!item.hidden&&siblings.has(item.dataset.cueId));
  if(!targets.length)return null;
  let target=null,after=false;
  const clear=()=>{target?.classList.remove('dropBefore','dropAfter');target=null;};
  const locate=(x,y)=>{
   clear();
   target=targets.find(item=>y<=item.firstElementChild.getBoundingClientRect().bottom)||targets[targets.length-1];
   const box=target.firstElementChild.getBoundingClientRect();
   after=y>box.top+box.height/2;
   target.classList.add(after?'dropAfter':'dropBefore');
  };
  return {
   source:row.firstElementChild,valid,locate,clear,
   scroll(x,y){
    const bounds=cueList.getBoundingClientRect(),previous=scrollY;
    if(x>=bounds.left-20&&x<=bounds.right+20){
     const delta=y<70?-12:y>innerHeight-70?12:0;
     if(delta)window.scrollBy(0,delta);
    }
    return scrollY!==previous;
   },
   drop(x,y){
    const bounds=cueList.getBoundingClientRect();
    if(x<bounds.left-12||x>bounds.right+12||y<Math.max(0,bounds.top-12)||y>Math.min(innerHeight,bounds.bottom+12))return;
    locate(x,y);
    const id=target.dataset.cueId;clear();
    dropCueInList(cue,id,after);
   }
  };
 });
 handle.onkeydown=e=>{
  if(!valid()||!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();
  const siblings=cueListDragSiblings(cue),index=siblings.indexOf(cue),after=e.key==='ArrowDown',target=siblings[index+(after?1:-1)];
  if(target)dropCueInList(cue,target.id,after);
 };
}
function confirmCueDeletion(cue,index,trigger){
 if(document.querySelector('.cueDeleteOverlay'))return Promise.resolve(false);
 return new Promise(resolve=>{
  const overlay=document.createElement('div');overlay.className='cueDeleteOverlay';
  const panel=document.createElement('div');panel.className='cueDeleteDialog';panel.setAttribute('role','alertdialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','cueDeleteTitle');panel.setAttribute('aria-describedby','cueDeleteName');
  const title=document.createElement('h2');title.id='cueDeleteTitle';title.textContent=tr(cue.visualNumber?'Supprimer ce numéro et toutes ses Cues ?':'Supprimer cette Cue ?');
  const name=document.createElement('p');name.id='cueDeleteName';name.textContent='CUE '+(index+1)+' — '+(cue.name||'Cue '+(index+1));
  const actions=document.createElement('div');actions.className='cueDeleteDialogActions';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent=tr('Annuler');
  const remove=document.createElement('button');remove.type='button';remove.className='danger';S2AMaterial.button(remove,'delete',tr('Supprimer'));
  let finished=false;const close=result=>{if(finished)return;finished=true;overlay.remove();document.removeEventListener('keydown',key,true);if(trigger.isConnected)trigger.focus();resolve(result);};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(false);}else if(e.key==='Tab'){e.preventDefault();(document.activeElement===cancel?remove:cancel).focus();}else if(e.code==='Space'||e.key===' '){e.stopPropagation();}};
  cancel.onclick=()=>close(false);remove.onclick=()=>close(true);overlay.onclick=e=>{if(e.target===overlay)close(false);};
  actions.append(cancel,remove);panel.append(title,name,actions);overlay.append(panel);document.body.append(overlay);document.addEventListener('keydown',key,true);cancel.focus();
 });
}

function centerEditedCue(cueId){
 centerTimelineCue(cueId);
 cancelAnimationFrame(editCenterFrame);if(!cueId||locked)return;
 editCenterFrame=requestAnimationFrame(()=>{
  if(locked||expandedCueId!==cueId)return;
  const row=Array.from(cueList.children).find(item=>item.dataset.cueId===cueId);if(!row||row.hidden)return;
  const bounds=row.getBoundingClientRect(),viewport=window.visualViewport;
  const top=(viewport?.offsetTop||0)+$('editCueToolbar').offsetHeight+16,bottom=viewport?viewport.offsetTop+viewport.height:window.innerHeight;
  const available=Math.max(0,bottom-top-16),target=top+Math.max(0,(available-bounds.height)/2);
  window.scrollTo({top:Math.max(0,window.scrollY+bounds.top-target),behavior:'instant'});
 });
}

function cueViewOrder(){return conductType==='manual'?manualHierarchy().order:orderedCues();}
function cueViewNumber(cue){return conductType==='manual'?manualHierarchy().numbers.get(cue.id)||String(orderedCues().indexOf(cue)+1):String(orderedCues().indexOf(cue)+1);}
function isManualCueEditor(cue){
 return conductType==='manual'&&!locked&&isManualMainCue(cue);
}
function isCueEditorOpen(cue){
 if(!isManualCueEditor(cue))return expandedCueId===cue.id;
 return openManualCueEditors.has(cue.id)||(expandedCueId===cue.id&&!closedManualCueEditors.has(cue.id));
}
function normalizeCustomCueTypes(value){
 const types=new Map();
 for(const type of Array.isArray(value)?value:[]){
  const id=type?.id,name=typeof type?.name==='string'?type.name.trim().slice(0,48):'',color=normalizeGoCueColor(type?.color);
  if(typeof id==='string'&&/^custom-[a-zA-Z0-9-]{1,64}$/.test(id)&&name&&color&&!types.has(id))types.set(id,{id,name,color});
 }
 return Array.from(types.values());
}
function cueTypes(){
 return [...defaultCueTypes.map(type=>({...type,name:tr(type.name)})),...customCueTypes];
}
function rawCueTypeIds(cue){
 return Array.isArray(cue.cueTypeIds)?cue.cueTypeIds:cue.cueTypeId?[cue.cueTypeId]:[];
}
function cueTypeIds(cue){
 return Array.from(new Set(rawCueTypeIds(cue).filter(id=>id!=='none'&&
  (defaultCueTypes.some(type=>type.id===id)||customCueTypes.some(type=>type.id===id)))));
}
function cueTypeId(cue){return cueTypeIds(cue)[0]||'none';}
function normalizeTypeDescriptions(value){
 return Object.fromEntries(Object.entries(value&&typeof value==='object'&&!Array.isArray(value)?value:{})
  .filter(([id,text])=>/^[a-z][a-zA-Z0-9-]{0,70}$/.test(id)&&typeof text==='string'));
}
function typeDescription(cue,id){
 if(!id)return cue.description||'';
 return cue.typeDescriptions?.[id]??(!cue.typeDescriptions&&id===cueTypeId(cue)?cue.description||'':'');
}
function setCueTypeIds(cue,ids){
 const old=cueTypeIds(cue);
 const legacyType=old[0]||ids[0];
 if(!cue.typeDescriptions&&legacyType&&cue.description)cue.typeDescriptions={[legacyType]:cue.description};
 cue.cueTypeIds=ids.slice();
 delete cue.cueTypeId;
}
function cueDescriptionLines(cue,selected){
 const ids=cueTypeIds(cue);
 if(!ids.length)return (!selected||selected.has('none'))&&cue.description?[{id:'none',text:cue.description}]:[];
 const names=new Map(cueTypes().map(type=>[type.id,type.name]));
 const lines=[];
 for(const id of ids){
  if(selected&&!selected.has(id))continue;
  const description=typeDescription(cue,id);
  if(description)lines.push({id,text:(ids.length>1?names.get(id)+' - ':'')+description});
 }
 return lines;
}
function cueDescriptionText(cue,selected=null){
 return cueDescriptionLines(cue,selected).map(line=>line.text).join('\n');
}
function updateEditCueDescription(row,cue,selected){
 const summary=row?.querySelector('.cueSummaryDescription');
 if(!summary)return;
 summary.textContent=cueDescriptionText(cue,selected)||((selected||(cue.mediaActions||[]).length)?'':tr('Aucune indication'));
 for(const field of row.querySelectorAll('.cueDescriptionField')){
  field.hidden=!!selected&&!selected.has(field.dataset.descriptionType);
 }
}
function cueDescriptionFields(cue){
 const fields=document.createDocumentFragment(),ids=cueTypeIds(cue),names=new Map(cueTypes().map(type=>[type.id,type.name]));
 for(const id of ids.length?ids:[null]){
  const label=document.createElement('label'),input=document.createElement('textarea');
  label.className='cueDescriptionField';label.dataset.descriptionType=id||'none';
  const title=id?tr('Description {type}',{type:names.get(id)}):tr('Description / indication de conduite');
  label.append(title,input);
  input.className='cueDescription';input.placeholder=title;input.value=typeDescription(cue,id);input.disabled=locked;
  let before=null;
  input.onfocus=()=>{before=captureEditableState();};
  input.oninput=()=>{
   if(id){
    if(!cue.typeDescriptions)cue.typeDescriptions=cue.description?{[ids[0]]:cue.description}:{};
    cue.typeDescriptions[id]=input.value;
   }else cue.description=input.value;
   updateEditCueDescription(input.closest('.cueAccordion'),cue,selectedCueTypes());
   updateShowPanels();scheduleAutosave();
  };
  input.onchange=()=>{pushHistory(before||captureEditableState());scheduleAutosave();};
  fields.append(label);
 }
 return fields;
}
function cueTypeBadge(type){
 const badge=document.createElement('span');
 badge.className='cueTypeBadge';badge.dataset.noI18n='true';badge.textContent=type.name;
 badge.style.setProperty('--cue-type-color',type.color);badge.style.color=type.color;
 return badge;
}
function cueTypeBadges(cue,includeNone=false){
 const ids=cueTypeIds(cue),badges=document.createElement('span');
 badges.className='cueTypeBadges';
 for(const type of cueTypes())if(ids.includes(type.id)||(includeNone&&!ids.length&&type.id==='none'))badges.append(cueTypeBadge(type));
 return badges;
}
function cueTypeFilterMode(){return locked?'live':'edit';}
function cueTypeFilterKey(){return 'pilot-cue-type-filter:'+copilotProjectId;}
function restoreCueTypeFilters(){
 cueTypeFilters={edit:null,live:null};
 try{
  const saved=JSON.parse(localStorage.getItem(cueTypeFilterKey()));
  for(const mode of ['edit','live'])if(Array.isArray(saved?.[mode]))cueTypeFilters[mode]=saved[mode].filter(id=>typeof id==='string');
 }catch{}
}
function selectedCueTypes(){
 const stored=cueTypeFilters[cueTypeFilterMode()];
 if(!stored)return null;
 const allowed=new Set(cueTypes().map(type=>type.id)),selected=new Set(stored.filter(id=>allowed.has(id)));
 return selected.size===allowed.size||(!selected.size&&stored.length)?null:selected;
}
function cueMatchesTypes(cue,selected){
 if(!selected)return true;
 const ids=cueTypeIds(cue);
 return ids.length?ids.some(id=>selected.has(id)):selected.has('none');
}
function cueTypeVisibility(){
 const selected=selectedCueTypes();
 if(!selected)return null;
 const matches=new Set(),visible=new Set();
 for(const cue of cues){
  if(!cueMatchesTypes(cue,selected))continue;
  matches.add(cue.id);visible.add(cue.id);
  if(isManualInternalCue(cue))visible.add(cue.parentMusicId);
 }
 return {matches,visible,selected};
}
function normalizeCueGroups(value){
 const seenIds=new Set(),assigned=new Set(),result=[];
 for(const group of Array.isArray(value)?value:[]){
  const id=group?.id,name=typeof group?.name==='string'?group.name.trim().slice(0,64):'';
  if(typeof id!=='string'||!id||seenIds.has(id)||!name||!Array.isArray(group.cueIds))continue;
  const cueIds=[];
  for(const cueId of group.cueIds)if(typeof cueId==='string'&&cueId&&!assigned.has(cueId)){
   assigned.add(cueId);cueIds.push(cueId);
  }
  if(cueIds.length){
   seenIds.add(id);result.push({id,name,color:normalizeGoCueColor(group.color)||'#8dbaff',cueIds,folded:group.folded===true});
  }
 }
 return result;
}
function restoreCueGroups(value){
 cueGroups=normalizeCueGroups(value);liveCueGroupFolds.clear();
}
function cueGroupMembership(){
 const members=new Map();
 if(conductType==='manual')for(const group of cueGroups)for(const id of group.cueIds)members.set(id,group);
 return members;
}
function groupForCue(cue,members){
 if(!cue)return null;
 return members.get(isManualInternalCue(cue)?cue.parentMusicId:cue.id)||null;
}
function selectedCueGroupMembers(){
 if(!manualEditSequenceVisible()||!cueBatchMode)return [];
 const roots=manualMusics(),selected=roots.filter(cue=>batchCueIds.has(cue.id));
 if(selected.length<2)return [];
 const first=roots.indexOf(selected[0]),members=cueGroupMembership();
 return selected.every((cue,index)=>cue===roots[first+index]&&!members.has(cue.id))?selected:[];
}
function applyCueGroupStyle(element,group){
 if(!group)return;
 element.dataset.cueGroup=group.id;
 element.style.setProperty('--cue-group-color',group.color);
}
function renderCueGroupBranches(host){
 let group=null,branches=[],lastMain=-1;
 const finish=()=>{
  if(lastMain<0)return;
  branches[lastMain].classList.add('isGroupEnd');
  branches.slice(lastMain+1).forEach(branch=>branch.remove());
 };
 for(const row of host.children){
  row.querySelector('.cueGroupBranch')?.remove();
  if(row.hidden||row.classList.contains('cueGroupHeading'))continue;
  const id=row.dataset.cueGroup;
  if(id!==group){finish();group=id;branches=[];lastMain=-1;}
  if(!id)continue;
  const branch=document.createElement('span');
  branch.className='cueGroupBranch';branch.setAttribute('aria-hidden','true');
  if(!row.classList.contains('manualInternalCue')){
   lastMain=branches.length;branch.classList.add('isMainBranch');
  }
  row.append(branch);branches.push(branch);
 }
 finish();
}
function refreshCueGroupViews(){
 applyEditCueVisibility();
 renderManualSequence();
}
function focusCueGroup(host,group){
 Array.from(host.querySelectorAll('.cueGroupHeading')).find(row=>row.dataset.cueGroup===group.id)?.querySelector('.cueGroupFold').focus({preventScroll:true});
}
function cueGroupHeading(group,surface,folded,forced=false){
 const heading=document.createElement('div'),toggle=document.createElement('button');
 heading.className='cueGroupHeading';applyCueGroupStyle(heading,group);
 toggle.type='button';toggle.className='cueGroupFold';
 const icon=document.createElement('span');icon.textContent=folded?'▸':'▾';icon.setAttribute('aria-hidden','true');
 const name=document.createElement('strong');name.textContent=group.name;
 toggle.append(icon,name);toggle.setAttribute('aria-expanded',String(!folded));toggle.disabled=forced;
 toggle.onclick=()=>{
  const host=heading.parentElement;
  if(surface==='live'){
   liveCueGroupFolds.set(group.id,!folded);
   showOverviewSignature='';updateShowPanels();
  }else{
   group.folded=!folded;refreshCueGroupViews();scheduleAutosave();
  }
  focusCueGroup(host,group);
 };
 heading.append(toggle);
 if(surface!=='live'){
  const edit=document.createElement('button');edit.type='button';edit.className='cueGroupEdit';
  edit.textContent=tr('Modifier');edit.setAttribute('aria-label',tr('Modifier le groupe {name}',{name:group.name}));
  edit.onclick=()=>openCueGroupDialog(group);heading.append(edit);
 }
 return heading;
}
let cueGroupEdit=null;
function openCueGroupDialog(group=null){
 const selected=group?[]:selectedCueGroupMembers();
 if(!manualEditSequenceVisible()||(!group&&!selected.length))return;
 cueGroupEdit={group,cueIds:selected.map(cue=>cue.id)};
 $('cueGroupDialogTitle').textContent=tr(group?'Modifier le groupe':'Créer un groupe');
 $('cueGroupName').value=group?.name||'';$('cueGroupColor').value=group?.color||'#8dbaff';
 $('cueGroupRemove').hidden=!group;
 $('cueGroupDialog').showModal();$('cueGroupName').focus();
}
function applyEditCueVisibility(){
 const filter=locked?null:cueTypeVisibility(),byId=new Map(cues.map(cue=>[cue.id,cue])),members=cueGroupMembership();
 cueList.querySelectorAll('.cueGroupHeading').forEach(heading=>heading.remove());
 let previousGroup=null;
 for(const row of Array.from(cueList.children)){
  const id=row.dataset.cueId,parent=row.dataset.parentCueId,group=groupForCue(byId.get(id),members);
  delete row.dataset.cueGroup;row.style.removeProperty('--cue-group-color');applyCueGroupStyle(row,group);
  const visible=!filter||filter.visible.has(id);
  if(visible&&group!==previousGroup){
   if(group&&!locked)cueList.insertBefore(cueGroupHeading(group,'edit',group.folded),row);
   previousGroup=group;
  }
  row.hidden=!!group?.folded||!!(parent&&foldedManualCueRows.has(parent))||!visible;
  row.classList.toggle('cueTypeContext',!!(filter&&filter.visible.has(id)&&!filter.matches.has(id)));
  if(byId.has(id))updateEditCueDescription(row,byId.get(id),filter?.selected);
  const navigation=row.querySelector('.manualSubCueNav');
  if(navigation){
   const children=manualChildren(byId.get(id)).filter(child=>!filter||filter.visible.has(child.id));
   navigation.replaceChildren(new Option(tr('Voir les sous-Cues'),''));
   for(const child of children){
    const option=new Option('+'+fmt(child.relativeTime)+' - '+child.name,child.id);
    option.dataset.noI18n='true';navigation.append(option);
   }
   navigation.disabled=!children.length;
  }
  for(const button of row.querySelectorAll('.manualWaveTop[data-sub-cue-id]')){
   button.hidden=!!(filter&&!filter.visible.has(button.dataset.subCueId));
  }
 }
 renderCueGroupBranches(cueList);
 $('cueTypeEmpty').hidden=!filter||filter.matches.size>0;
 updateCueTypeFilterButtons();updateCueBatchSelection();
}
function updateCueTypeFilterButtons(){
 const button=$(locked?'liveCueTypeFilter':'editCueTypeFilter'),selected=selectedCueTypes();
 button.textContent=tr('Filtrer les Cues')+(selected?' ('+selected.size+')':'');
 button.classList.toggle('isFiltered',!!selected);
}
function openCueTypeFilter(){
 const dialog=$('cueTypeFilterDialog'),choices=$('cueTypeFilterChoices'),types=cueTypes(),mode=cueTypeFilterMode();
 const selected=selectedCueTypes();
 choices.replaceChildren();
 function apply(){
  const ids=Array.from(choices.querySelectorAll('input:checked'),input=>input.value);
  cueTypeFilters[mode]=ids.length===types.length?null:ids;
  if(copilotProjectId)try{localStorage.setItem(cueTypeFilterKey(),JSON.stringify(cueTypeFilters));}catch{}
  if(locked)updateCueTypeFilterButtons();else applyEditCueVisibility();
  renderTimeline();renderGoWaveMarkers();updateShowPanels();
 }
 for(const type of types){
  const label=document.createElement('label'),input=document.createElement('input');
  input.type='checkbox';input.value=type.id;input.checked=!selected||selected.has(type.id);
  input.onchange=apply;label.append(input,cueTypeBadge(type));choices.append(label);
 }
 $('cueTypeFilterAll').onclick=()=>{
  for(const input of choices.querySelectorAll('input'))input.checked=true;
  apply();
 };
 dialog.showModal();
}
function cueBatchScope(){
 return cueTypeVisibility()?.visible??new Set(cues.map(cue=>cue.id));
}
function updateCueBatchSelection(){
 if(locked||cueBatchEpoch!==copilotProjectEpoch){
  cueBatchEpoch=copilotProjectEpoch;cueBatchMode=false;batchCueIds.clear();
 }
 const scope=cueBatchMode?cueBatchScope():new Set();
 const groups=cueBatchMode&&conductType==='manual'?manualHierarchy().children:null;
 for(const id of batchCueIds)if(!scope.has(id))batchCueIds.delete(id);
 for(const row of cueList.children){
  const id=row.dataset.cueId,control=row.querySelector('.cueBatchCheck');
  const selected=cueBatchMode&&batchCueIds.has(id);
  if(control){
   control.hidden=!cueBatchMode;
   const checkbox=control.firstElementChild;
   checkbox.checked=selected;
   const children=(groups?.get(id)||[]).filter(child=>scope.has(child.id));
   const checked=children.filter(child=>batchCueIds.has(child.id)).length;
   checkbox.indeterminate=checked>0&&checked<children.length;
  }
  row.classList.toggle('cueBatchSelected',selected);
 }
 $('cueBatchToggle').setAttribute('aria-pressed',String(cueBatchMode));
 $('cueBatchBar').hidden=!cueBatchMode;
 const count=batchCueIds.size;
 $('cueBatchCount').textContent=tr(count===1?'1 Cue sélectionnée':'{count} Cues sélectionnées',{count});
 $('cueBatchAssign').disabled=!count;
 $('cueGroupCreate').hidden=!manualEditSequenceVisible();
 $('cueGroupCreate').disabled=!selectedCueGroupMembers().length;
 const toggleAll=$('cueBatchToggleAll');
 toggleAll.disabled=!scope.size;
 toggleAll.textContent=tr(scope.size&&count===scope.size?'Tout désélectionner':'Tout sélectionner');
}
function cueBatchCheckbox(cue){
 const label=document.createElement('label'),input=document.createElement('input');
 label.className='cueBatchCheck';label.hidden=!cueBatchMode;
 input.type='checkbox';input.checked=batchCueIds.has(cue.id);
 input.setAttribute('aria-label',tr('Sélectionner la Cue')+' · '+cueViewNumber(cue)+' · '+cue.name);
 input.onchange=()=>{
  const group=conductType==='manual'&&isManualMainCue(cue)?[cue,...manualChildren(cue)]:[cue];
  const scope=cueBatchScope();
  for(const item of group){
   if(input.checked&&scope.has(item.id))batchCueIds.add(item.id);
   else batchCueIds.delete(item.id);
  }
  updateCueBatchSelection();
 };
 label.append(input);
 return label;
}
function cueTypePicker(cue){
 const button=document.createElement('button'),chevron=document.createElement('span');
 const ids=cueTypeIds(cue),names=cueTypes().filter(type=>ids.length?ids.includes(type.id):type.id==='none').map(type=>type.name);
 button.type='button';button.className='cueTypePicker';button.setAttribute('aria-haspopup','dialog');
 button.setAttribute('aria-label',tr('Type de Cue')+' · '+names.join(', '));
 chevron.className='cueTypeChevron';chevron.setAttribute('aria-hidden','true');
 button.append(cueTypeBadges(cue,true),chevron);
 button.onclick=()=>openCueTypePicker([cue]);
 return button;
}
function openCueTypePicker(targets,batch=false){
 if(locked||!targets.length)return;
 const dialog=$('cueTypePickerDialog'),choices=$('cueTypePickerChoices'),epoch=copilotProjectEpoch;
 const initial=targets.map(cue=>cueTypeIds(cue));
 const types=cueTypes(),count=targets.length;
 $('cueTypePickerName').textContent=batch?tr(count===1?'1 Cue sélectionnée':'{count} Cues sélectionnées',{count}):targets[0].name||'Cue';
 choices.replaceChildren();
 function refreshNone(){
  const none=choices.querySelector('[value="none"]');
  none.indeterminate=false;
  none.checked=!choices.querySelector('input:not([value="none"]):checked,input:not([value="none"]):indeterminate');
 }
 for(const type of types){
  const label=document.createElement('label'),input=document.createElement('input');
  label.className='cueTypeOption';label.dataset.cueType=type.id;
  input.type='checkbox';input.value=type.id;
  const matching=initial.filter(ids=>type.id==='none'?!ids.length:ids.includes(type.id)).length;
  input.checked=matching===count;input.indeterminate=matching>0&&matching<count;
  input.onchange=()=>{
   if(type.id==='none'){
    for(const option of choices.querySelectorAll('input:not([value="none"])')){option.checked=false;option.indeterminate=false;}
   }
   refreshNone();
  };
  label.append(input,cueTypeBadge(type));choices.append(label);
 }
 $('cueTypePickerApply').onclick=()=>{
  const selected=Array.from(choices.querySelectorAll('input:not([value="none"]):checked'),input=>input.value);
  const mixed=new Set(Array.from(choices.querySelectorAll('input:not([value="none"]):indeterminate'),input=>input.value));
  const result=initial.map(ids=>types.filter(type=>selected.includes(type.id)||(mixed.has(type.id)&&ids.includes(type.id))).map(type=>type.id));
  dialog.close();
  if(locked||epoch!==copilotProjectEpoch||!targets.every(cue=>cues.includes(cue)))return;
  if(result.every((ids,i)=>ids.length===initial[i].length&&ids.every(id=>initial[i].includes(id))))return;
  pushHistory();
  targets.forEach((cue,i)=>setCueTypeIds(cue,result[i]));
  renderCues(true,batch?null:targets[0].id);scheduleAutosave();
  if(batch)$(batchCueIds.size?'cueBatchAssign':'cueBatchToggle').focus({preventScroll:true});
  else{
   const row=Array.from(cueList.children).find(item=>item.dataset.cueId===targets[0].id);
   (row?.hidden?$('editCueTypeFilter'):row?.querySelector('.cueTypePicker'))?.focus({preventScroll:true});
  }
 };
 dialog.showModal();
 (choices.querySelector('input:checked')||choices.querySelector('input'))?.focus();
}
function openCueTypeManager(){
 const dialog=$('cueTypeCreateDialog'),name=$('cueTypeName'),color=$('cueTypeColor'),form=$('cueTypeCreateForm');
 const select=$('managedCueType'),remove=$('deleteCueType'),save=$('saveCueType'),epoch=copilotProjectEpoch;
 const current=()=>customCueTypes.find(type=>type.id===select.value);
 function loadFields(){
  const type=current();
  name.value=type?.name||'';name.setCustomValidity('');
  color.value=type?.color||'#8fc5ff';
  remove.hidden=!type;
  save.textContent=tr(type?'Enregistrer':'Créer un type');
 }
 function refreshTypes(id=''){
  select.replaceChildren(new Option(tr('Nouveau type'),''));
  for(const type of customCueTypes)select.add(new Option(type.name,type.id));
  select.value=id;
  loadFields();
 }
 select.onchange=loadFields;
 refreshTypes();
 const canEdit=()=>!locked&&epoch===copilotProjectEpoch;
 function changed(){
  renderCues();scheduleAutosave();
 }
 form.onsubmit=event=>{
  event.preventDefault();
  if(!canEdit()){dialog.close();return;}
  const type=current(),title=name.value.trim(),hex=normalizeGoCueColor(color.value);
  if(!title){name.setCustomValidity(tr('Indiquez un nom de type.'));name.reportValidity();return;}
  if(!hex){color.setCustomValidity(tr('Choisissez une couleur valide.'));color.reportValidity();return;}
  if(cueTypes().some(candidate=>candidate.id!==type?.id&&candidate.name.toLocaleLowerCase()===title.toLocaleLowerCase())){
   name.setCustomValidity(tr('Ce type existe déjà.'));name.reportValidity();return;
  }
  if(type&&type.name===title&&type.color===hex)return;
  pushHistory();
  const id=type?.id||'custom-'+uuid();
  if(type){type.name=title;type.color=hex;}
  else customCueTypes.push({id,name:title,color:hex});
  changed();refreshTypes(id);
 };
 remove.onclick=()=>{
  const type=current();
  if(!type||!canEdit()||!window.confirm(tr('Supprimer ce type ? Ses Cues passeront en Sans type.')))return;
  pushHistory();
  customCueTypes=customCueTypes.filter(item=>item!==type);
  for(const item of cues)if(rawCueTypeIds(item).includes(type.id)||item.typeDescriptions?.[type.id]!==undefined){
   const ids=rawCueTypeIds(item).filter(id=>id!==type.id),text=item.typeDescriptions?.[type.id];
   item.cueTypeIds=ids;delete item.cueTypeId;
   if(text&&text!==item.description)item.description=[item.description,text].filter(Boolean).join('\n');
   if(item.typeDescriptions)delete item.typeDescriptions[type.id];
  }
  changed();refreshTypes();
 };
 name.oninput=()=>name.setCustomValidity('');
 color.setCustomValidity('');
 color.oninput=()=>color.setCustomValidity('');
 dialog.showModal();
}
function mergeImportedCueTypes(children,types){
 const remap=new Map();
 for(const type of types){
  const existing=customCueTypes.find(candidate=>candidate.id===type.id);
  if(existing&&existing.name===type.name&&existing.color===type.color)continue;
  if(existing){
   const id='custom-'+uuid();remap.set(type.id,id);customCueTypes.push({...type,id});
  }else customCueTypes.push(type);
 }
 for(const child of children){
  child.cueTypeIds=rawCueTypeIds(child).map(id=>remap.get(id)||id);delete child.cueTypeId;
  if(child.typeDescriptions)child.typeDescriptions=Object.fromEntries(Object.entries(child.typeDescriptions).map(([id,text])=>[remap.get(id)||id,text]));
 }
}
function manualCueListViewKey(){
 return 'pilot-cue-list-view:'+copilotProjectId;
}
function normalizeManualCueListView(view){
 const parents=new Set(cues.map(cue=>cue.parentMusicId).filter(Boolean));
 const mainIds=new Set(cues.filter(isManualMainCue).map(cue=>cue.id));
 const validIds=(ids,allowed)=>Array.isArray(ids)?Array.from(new Set(ids.filter(id=>allowed.has(id)))):[];
 return {
  foldedSubCueParents:validIds(view.foldedSubCueParents,parents),
  openMainCueIds:validIds(view.openMainCueIds,mainIds)
 };
}
function storedManualCueListView(){
 return normalizeManualCueListView({
  foldedSubCueParents:Array.from(foldedManualCueRows),
  openMainCueIds:Array.from(openManualCueEditors)
 });
}
function restoreManualCueListView(saved={}){
 manualCueListEpoch=copilotProjectEpoch;
 openManualCueEditors.clear();closedManualCueEditors.clear();foldedManualCueRows.clear();
 let view=saved;
 if(copilotProjectId){
  try{
   const local=JSON.parse(localStorage.getItem(manualCueListViewKey()));
   const folds=local?.foldedSubCueParents??JSON.parse(localStorage.getItem('pilot-folded-sub-cues:'+copilotProjectId));
   view={
    foldedSubCueParents:Array.isArray(folds)?folds:saved.foldedSubCueParents,
    openMainCueIds:Array.isArray(local?.openMainCueIds)?local.openMainCueIds:saved.openMainCueIds
   };
  }catch{}
 }
 const {foldedSubCueParents,openMainCueIds}=normalizeManualCueListView(view);
 foldedSubCueParents.forEach(id=>foldedManualCueRows.add(id));
 openMainCueIds.forEach(id=>openManualCueEditors.add(id));
}
function saveManualCueListView(){
 if(copilotProjectId){
  try{localStorage.setItem(manualCueListViewKey(),JSON.stringify(storedManualCueListView()));}catch{}
 }
 scheduleAutosave();
}
function syncManualCueListView(){
 if(manualCueListEpoch!==copilotProjectEpoch)restoreManualCueListView();
 const selected=cues.find(cue=>cue.id===expandedCueId);
 if(selected&&isManualCueEditor(selected)&&!openManualCueEditors.has(selected.id)&&!closedManualCueEditors.has(selected.id)){
  openManualCueEditors.add(selected.id);
  saveManualCueListView();
 }
}
function manualCueListParents(){
 return Array.from(new Set(cues.filter(isManualInternalCue).map(cue=>cue.parentMusicId)));
}
function allManualCueRowsFolded(parents){
 return parents.length>0&&parents.every(id=>foldedManualCueRows.has(id));
}
function updateManualCueListFoldButton(){
 const button=$('cueListFoldAll'),parents=manualEditSequenceVisible()?manualCueListParents():[];
 button.hidden=!parents.length;
 button.textContent=tr(allManualCueRowsFolded(parents)?'Tout déplier':'Tout replier');
}
function updateManualCueRowFold(button,root,count){
 const folded=foldedManualCueRows.has(root.id);
 button.textContent=(folded?'▸':'▾')+' '+count;
 button.title=tr(folded?'Afficher les sous-Cues':'Masquer les sous-Cues');
 button.setAttribute('aria-label',button.title+' · '+root.name);
 button.setAttribute('aria-expanded',String(!folded));
}
function applyManualCueRowFolds(){
 for(const row of cueList.children){
  const rootId=row.dataset.cueId;
  const button=row.querySelector('.manualCueRowFold');
  if(button){
   const root=cues.find(cue=>cue.id===rootId);
   updateManualCueRowFold(button,root,manualChildren(root).length);
  }
 }
 applyEditCueVisibility();
 updateManualCueListFoldButton();
}
function manualCueRowFold(root,children){
 const button=document.createElement('button');
 button.type='button';button.className='manualCueRowFold';button.dataset.noI18n='true';
 updateManualCueRowFold(button,root,children.length);
 button.onclick=()=>{
  if(foldedManualCueRows.has(root.id))foldedManualCueRows.delete(root.id);
  else foldedManualCueRows.add(root.id);
  applyManualCueRowFolds();
  saveManualCueListView();
 };
 return button;
}
function renderCues(renderTl=true,onlyCueId=null){placeEditAddActions();if(editBlockPreview&&!editBlockPreview.root&&editBlockPreview.cueId!==expandedCueId)stopEditBlockPreview();syncManualLinks();showOverviewSignature='';disposeMediaPreviews(onlyCueId);invalidateComputationCaches();ensureBaseCueInvariant();normalizeCueOrderAndNames();if(expandedCueId&&!cues.some(c=>c.id===expandedCueId))expandedCueId=null;syncManualCueListView();if(!onlyCueId)cueList.innerHTML='';cueCount.textContent=`${cues.length} Cue${cues.length>1?'s':''}`;cueViewOrder().forEach((cue,index)=>{if(onlyCueId&&cue.id!==onlyCueId)return;const previousRow=onlyCueId?cueList.querySelector(`[data-cue-id="${cue.id}"]`):null;const acc=document.createElement('div');acc.className='cueAccordion'+(conductType==='manual'&&isManualMainCue(cue)?' manualPrincipalEditor':'')+(isCueEditorOpen(cue)?' expanded':'')+(isManualInternalCue(cue)?' manualInternalCue':'');acc.dataset.cueId=cue.id;
if(!locked&&isManualInternalCue(cue))acc.dataset.parentCueId=cue.parentMusicId;
if(conductType==='manual'&&!locked)applyGoCueColor(acc,cue);if(isManualInternalCue(cue)&&manualChildren(cues.find(p=>p.id===cue.parentMusicId)).at(-1)===cue)acc.classList.add('lastInternalCue');const summary=document.createElement('div');summary.className='cueSummary';summary.tabIndex=0;summary.setAttribute('role','button');summary.setAttribute('aria-expanded',String(isCueEditorOpen(cue)));const num=document.createElement('div');num.className='cueNumber';num.textContent='CUE '+cueViewNumber(cue);if(!locked){const handle=document.createElement('button');handle.type='button';handle.className='cueDragHandle';handle.textContent='⠿';handle.title=tr('Glisser pour déplacer la Cue et ajuster son temps (Alt + flèches au clavier)');handle.setAttribute('aria-label',tr('Déplacer ')+(cue.name||tr('la Cue')));handle.onclick=e=>e.stopPropagation();num.prepend(handle);attachCueDrag(handle,cue,acc);}const st=document.createElement('div');st.className='cueSummaryTime';st.textContent=isManualInternalCue(cue)?'+'+fmt(cue.relativeTime):fmt(cue.time);const sm=document.createElement('div');sm.className='cueSummaryMain';const sn=document.createElement('div');sn.className='cueSummaryName';sn.textContent=cue.name||`Cue ${index+1}`;const sd=document.createElement('div');sd.className='cueSummaryDescription';sd.textContent=cueDescriptionText(cue)||((cue.mediaActions||[]).length?'':tr('Aucune indication'));if(conductType==='manual'){const kind=document.createElement('span');kind.className='cueHierarchyKind';kind.textContent=manualCueLabel(cue);sm.append(kind);}sm.append(sn,sd);const chips=document.createElement('div');chips.className='cueSummaryMedia';
if(!locked)chips.append(cueBatchCheckbox(cue),cueTypePicker(cue));
if(isManualCueEditor(cue)){
 const children=manualChildren(cue);
 if(children.length){summary.classList.add('hasCueFold');num.append(manualCueRowFold(cue,children));}
}
for(const [flag,label] of [['loop',tr('Boucle').toUpperCase()],['ltc','LTC']]){
 if(!(cue.mediaActions||[]).some(action=>action.kind==='audio'&&(flag==='loop'?mediaLoops(action):action[flag])))continue;
 const badge=document.createElement('span');
 badge.className='cueMediaChip '+flag;
 badge.textContent=label;
 chips.append(badge);
}
for(const kind of ['audio','video']){const n=(cue.mediaActions||[]).filter(a=>a.kind===kind).length;if(n){const ch=document.createElement('span');ch.className='cueMediaChip '+kind+' '+cuePreparationClass(cue);ch.textContent=`${kind==='audio'?'AUDIO':tr('VIDÉO')}${n>1?' ×'+n:''}`;chips.append(ch);}}if((cue.mediaActions||[]).some(a=>a.kind==='stopAll')){const ch=document.createElement('span');ch.className='cueMediaChip stop';ch.textContent='STOP';chips.append(ch);}summary.append(num,st,sm,chips);const toggle=()=>{
 const previous=cues.find(item=>item.id===expandedCueId);
 const wasOpen=isCueEditorOpen(cue);
 if(isManualCueEditor(cue)){
  if(wasOpen){
   openManualCueEditors.delete(cue.id);closedManualCueEditors.add(cue.id);
   if(expandedCueId===cue.id)expandedCueId=null;
  }else{
   closedManualCueEditors.delete(cue.id);openManualCueEditors.add(cue.id);
   expandedCueId=cue.id;
  }
  saveManualCueListView();
 }else expandedCueId=wasOpen?null:cue.id;
 if(previous&&previous!==cue&&!isCueEditorOpen(previous))renderCues(false,previous.id);
 renderCues(false,cue.id);renderTimeline();
 if(!wasOpen)centerEditedCue(cue.id);
};summary.onclick=e=>{if(e.target.closest('button,input,select,textarea,label'))return;toggle();};summary.onkeydown=e=>{if(e.target.closest('button,input,select,textarea,label'))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
const details=document.createElement('div');details.className='cueDetails';const grid=document.createElement('div');grid.className='cueEditGrid';const ti=document.createElement('input');ti.className='timeInput'+(cue.isBase?' baseCueTime':'');ti.value=fmt(cue.time);ti.setAttribute('aria-label',tr('Temps de la Cue'));ti.title=tr('Exemples : 02:41.0 ou 02.41 pour 2 minutes 41 ; 02:41.5 pour les dixièmes.');ti.disabled=locked;const fields=document.createElement('div');fields.className='cueTextFields';const name=document.createElement('input');name.type='text';name.value=cue.name;name.disabled=locked;fields.append(name,cueDescriptionFields(cue));const imgc=document.createElement('div');imgc.className='imageControls';if(cue.imageDataUrl){const im=document.createElement('img');im.className='cueImageThumb';im.src=cue.imageDataUrl;imgc.append(im);}const il=document.createElement('label');il.className='fileLabel';S2AMaterial.button(il,'add_photo_alternate',cue.imageDataUrl?tr('Changer visuel'):tr('Ajouter visuel'));const ii=document.createElement('input');ii.type='file';ii.accept='image/*';ii.disabled=locked;ii.onchange=async()=>{const f=ii.files?.[0];if(!f)return;pushHistory();cue.imageDataUrl=await fileToDataURL(f);cue.imageName=f.name;expandedCueId=cue.id;renderCues();scheduleAutosave();};il.append(ii);imgc.append(il);if(cue.imageDataUrl){const ri=document.createElement('button');S2AMaterial.button(ri,'hide_image',tr('Retirer visuel'));ri.disabled=locked;ri.onclick=()=>{pushHistory();cue.imageDataUrl=null;cue.imageName=null;expandedCueId=cue.id;renderCues();scheduleAutosave();};imgc.append(ri);}const del=document.createElement('button');del.className='cueDeleteBtn';del.type='button';S2AMaterial.set(del,'delete');del.title=tr('Supprimer')+' CUE '+cueViewNumber(cue);del.setAttribute('aria-label',del.title);del.disabled=locked;del.onclick=async e=>{e.stopPropagation();if(locked)return;if(!await confirmCueDeletion(cue,index,del)||locked||!cues.includes(cue))return;pushHistory();const removingAct=conductType==='manual'&&isManualMainCue(cue);cues=cues.filter(item=>item!==cue&&(!cue.visualNumber||item.parentMusicId!==cue.id));pilotTools.sequenceSheets=pilotTools.sequenceSheets.filter(sheet=>sheet.cueId!==cue.id);expandedCueId=null;invalidatePreflight();if(removingAct)pruneGeneratedChecklist();renderCues();scheduleAutosave();};const actions=document.createElement('div');actions.className='cueEditActions';const duplicate=document.createElement('button');duplicate.type='button';S2AMaterial.button(duplicate,'content_copy',tr('Dupliquer'));duplicate.disabled=locked;duplicate.onclick=()=>duplicateCue(cue);actions.append(duplicate);if(!locked){
 const audio=conductType==='manual'&&isManualMainCue(cue)&&!cue.visualNumber&&(cue.mediaActions||[]).find(item=>item.kind==='audio');
 if(audio){
  const controls=document.createElement('div');controls.className='cueTrackControls';
  summary.classList.add('hasTrackReplace');controls.append(manualTrackReplaceControl(cue,audio),del);summary.append(controls);
 }else summary.append(del);
}grid.append(ti,fields,imgc,actions);const panel=document.createElement('div');panel.className='cueMediaPanel';const mh=document.createElement('div');mh.className='cueMediaHeader';const mt=document.createElement('div');mt.className='cueMediaTitle';mt.textContent=tr('MÉDIAS DÉCLENCHÉS PAR CETTE CUE');mh.append(mt);const list=document.createElement('div');list.className='mediaActionList';if(!(cue.mediaActions||[]).length){const empty=document.createElement('div');empty.className='cueMediaEmpty';empty.textContent=tr('Aucun média — cette Cue peut rester une simple indication de conduite.');list.append(empty);}else for(const a of cue.mediaActions)list.append(mediaActionElement(cue,a));panel.append(mh,list);details.append(grid,makeCueOscEditor(cue));if((cue.mediaActions||[]).length)details.append(panel);acc.append(summary,details);if(previousRow)previousRow.replaceWith(acc);else cueList.append(acc);const commitTime=()=>{const t=parseTime(ti.value);if(t===null){ti.value=fmt(cue.time);return;}pushHistory();cue.time=Math.max(0,roundTenth(t));updateManualRelative(cue);normalizeCueOrderAndNames();expandedCueId=cue.id;renderCues();scheduleAutosave();};ti.onchange=commitTime;let nameBefore=null;name.onfocus=()=>{nameBefore=captureEditableState();};name.oninput=()=>{setCueTrackName(cue,name.value);updateShowPanels();renderManualSequence();scheduleAutosave();};name.onchange=()=>{pushHistory(nameBefore||captureEditableState());setCueTrackName(cue,name.value);expandedCueId=cue.id;renderCues(true,cue.id);scheduleAutosave();};});if(renderTl)renderTimeline();setEnabled();updateTransport();updateDurationEditor();updatePreflightUI();updateVideoOutputControls();renderManualEditor();applyEditCueVisibility();}
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(file);});}

function zipU16(n){return new Uint8Array([n&255,(n>>>8)&255]);}function zipU32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function zipConcat(a){const n=a.reduce((s,x)=>s+x.length,0),o=new Uint8Array(n);let p=0;for(const x of a){o.set(x,p);p+=x.length;}return o;}
function zipCrc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function zipDosDateTime(d=new Date()){const y=Math.max(1980,d.getFullYear());return{time:(d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2),date:((y-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};}
async function makeZip(entries){const enc=new TextEncoder(),lp=[],cp=[];let off=0;const dt=zipDosDateTime();for(const e of entries){const nb=enc.encode(e.name),data=e.data instanceof Uint8Array?e.data:new Uint8Array(e.data),crc=zipCrc32(data),lh=zipConcat([zipU32(0x04034b50),zipU16(20),zipU16(0x0800),zipU16(0),zipU16(dt.time),zipU16(dt.date),zipU32(crc),zipU32(data.length),zipU32(data.length),zipU16(nb.length),zipU16(0),nb]);lp.push(lh,data);cp.push(zipConcat([zipU32(0x02014b50),zipU16((3<<8)|20),zipU16(20),zipU16(0x0800),zipU16(0),zipU16(dt.time),zipU16(dt.date),zipU32(crc),zipU32(data.length),zipU32(data.length),zipU16(nb.length),zipU16(0),zipU16(0),zipU16(0),zipU16(0),zipU32(((e.mode??0o100644)<<16)>>>0),zipU32(off),nb]));off+=lh.length+data.length;}const central=zipConcat(cp),end=zipConcat([zipU32(0x06054b50),zipU16(0),zipU16(0),zipU16(entries.length),zipU16(entries.length),zipU32(central.length),zipU32(off),zipU16(0)]);return new Blob([...lp,central,end],{type:'application/zip'});}
function dataUrlToBytes(dataUrl){const b=atob(dataUrl.slice(dataUrl.indexOf(',')+1)),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o;}
function readStoredZip(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),dec=new TextDecoder('utf-8'),entries=new Map();
 const invalid=()=>new Error(tr('Format ZIP non reconnu.'));
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
 if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true))throw invalid();
 const count=view.getUint16(end+10,true),centralSize=view.getUint32(end+12,true);let off=view.getUint32(end+16,true),total=0;
 if(count===65535||off+centralSize>end)throw invalid();
 for(let i=0;i<count;i++){
  if(off+46>end||view.getUint32(off,true)!==0x02014b50)throw invalid();
  const flags=view.getUint16(off+8,true),method=view.getUint16(off+10,true),crc=view.getUint32(off+16,true),cs=view.getUint32(off+20,true),us=view.getUint32(off+24,true),nl=view.getUint16(off+28,true),el=view.getUint16(off+30,true),cl=view.getUint16(off+32,true),local=view.getUint32(off+42,true);
  if(off+46+nl+el+cl>end||local+30>bytes.length||view.getUint32(local,true)!==0x04034b50||flags&1)throw invalid();
  const name=dec.decode(bytes.subarray(off+46,off+46+nl)).replace(/\\/g,'/'),start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);off+=46+nl+el+cl;
  if(start+cs>bytes.length||us>536870912||(total+=us)>1073741824)throw new Error(tr('Archive ZIP trop volumineuse ou invalide.'));
  if(name.endsWith('/'))continue;
  if(entries.has(name)||name.startsWith('/')||name.split('/').includes('..'))throw invalid();
  let data;if(method===0){if(cs!==us)throw invalid();data=bytes.slice(start,start+cs);}
  else if(method===8&&window.pako){
   const chunks=[];let size=0;const inflate=new pako.Inflate({raw:true,chunkSize:65536});
   inflate.onData=chunk=>{size+=chunk.length;if(size>us)throw invalid();chunks.push(chunk);};
   inflate.push(bytes.subarray(start,start+cs),true);if(inflate.err||size!==us)throw invalid();data=zipConcat(chunks);
  }else throw new Error(tr('Ce ZIP utilise une compression non prise en charge.'));
  if(data.length!==us||zipCrc32(data)!==crc)throw invalid();entries.set(name,data);
 }
 return entries;
}
function projectZipEntries(entries){
 if(entries.has('conduite.json'))return entries;
 const candidates=[...entries.keys()].filter(name=>!name.startsWith('__MACOSX/')&&name.endsWith('/conduite.json'));
 if(candidates.length!==1)throw new Error(tr('conduite.json introuvable.'));
 const prefix=candidates[0].slice(0,-'conduite.json'.length);return new Map([...entries].filter(([name])=>name.startsWith(prefix)).map(([name,data])=>[name.slice(prefix.length),data]));
}
function bytesToDataUrl(bytes,mime){let s='',ch=0x8000;for(let i=0;i<bytes.length;i+=ch)s+=String.fromCharCode(...bytes.subarray(i,Math.min(i+ch,bytes.length)));return`data:${mime};base64,${btoa(s)}`;}
function mimeFromName(name){const e=(name.split('.').pop()||'').toLowerCase(),m={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp3:'audio/mpeg',wav:'audio/wav',aif:'audio/aiff',aiff:'audio/aiff',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',ogg:'audio/ogg',mp4:'video/mp4',mov:'video/quicktime',m4v:'video/x-m4v',webm:'video/webm'};return m[e]||'application/octet-stream';}
async function addCompiledCompanion(entries){
 const [archiveResponse,manifestResponse]=await Promise.all([fetch('./Bridge/S2A-Pilot-Bridge-'+BRIDGE_VERSION+'-app.zip',{cache:'no-store'}),fetch('./Bridge/app-files.json?v='+BRIDGE_VERSION,{cache:'no-store'})]);
 if(!archiveResponse.ok||!manifestResponse.ok)throw new Error(tr('S2A Pilot Bridge est indisponible. Vérifiez que tous les fichiers de la PWA ont été déployés.'));
 const [buffer,manifest]=await Promise.all([archiveResponse.arrayBuffer(),manifestResponse.json()]);
 if(manifest.version!==BRIDGE_VERSION)throw new Error(tr('Archive Bridge incomplète.'));
 const files=readStoredZip(buffer);
 for(const file of manifest.files){
  if(!file.path.startsWith('S2A Pilot Bridge.app/')||file.path.split('/').some(part=>part==='..'))throw new Error(tr('Archive Bridge invalide.'));
  const data=files.get(file.path);if(!data||data.length!==file.size)throw new Error(tr('Archive Bridge incomplète.'));
  entries.push({name:'Bridge/'+file.path,data,mode:file.mode});
 }
 entries.push({name:'Bridge/INSTALLATION.txt',data:new TextEncoder().encode(tr('bridge.installation',{version:manifest.version}))});
}
// Bridge imports automatic packages as one QLab Timeline group per file.
async function addBridgeActPackages(entries,project,encoder){
 const roots=manualMusics();
 const records=new Map(project.cues.map(cue=>[cue.id,cue]));
 const assets=new Map(entries.map(entry=>[entry.name,entry]));
 const digits=Math.max(2,String(roots.length).length);
 for(const [index,root] of roots.entries()){
  const prefix=String(index+1).padStart(digits,'0'),duration=manualPlannedDuration(root);
  const ordered=[root,...manualChildren(root)];
  const actCues=(root.visualNumber?ordered.filter(cue=>cue!==root||cue.mediaActions.length):ordered).map((cue,i)=>{
   const record=clone(records.get(cue.id));
   record.index=i+1;
   record.time=roundTenth(cue===root?0:cue.relativeTime);
   if(root.visualNumber){
    delete record.visualNumber;
    record.parentMusicId=null;record.relativeTime=null;record.manualKind=null;record.manualDuration=null;record.waitForGo=false;
    if(record.time>=duration)record.mediaActions=record.mediaActions.filter(action=>action.kind==='stopAll');
    for(const action of record.mediaActions){
     if(action.kind==='stopAll'||(action.kind==='video'&&action.loop))continue;
     const start=Number(action.inPoint)||0;
     action.outPoint=roundTenth(start+Math.min(mediaSegmentDuration(action),duration-record.time));
    }
   }
   return record;
  });
  if(root.visualNumber&&actCues.some(cue=>cue.mediaActions.some(action=>action.kind==='video'&&action.loop))){
   actCues.push({id:uuid(),index:actCues.length+1,time:duration,name:tr('Fin du numéro'),description:'',mediaActions:[{id:uuid(),kind:'stopAll',transition:'cut'}]});
  }
  const title=prefix+' - '+root.name;
  const act={...project,copilotProjectId:root.id,title,showDuration:duration,showDurationOverride:duration,
   conductType:root.visualNumber?'autopilot':'manual',
   minimumBridgeBuild:root.visualNumber?24:root.manualKind==='silent'?16002:16001,
   minimumBridgeVersion:root.visualNumber?'1.4.5':'1.6.0',backstageTops:[],cues:actCues};
  const paths=new Set();
  for(const cue of actCues){
   if(cue.imagePath)paths.add(cue.imagePath);
   for(const action of cue.mediaActions)if(action.path)paths.add(action.path);
  }
  const files=[{name:'conduite.json',data:encoder.encode(JSON.stringify(act))},...Array.from(paths,path=>assets.get(path))];
  const archive=await makeZip(files);
  entries.push({name:'Bridge/Numeros/'+safeFileName(title)+'.s2apilot.zip',data:new Uint8Array(await archive.arrayBuffer())});
 }
}
async function buildProjectPackage(librarySnapshot=false){if(!librarySnapshot&&window.S2ACopilotBeforeExport)await window.S2ACopilotBeforeExport();if(conductType==='manual'&&manualIssues().length)throw new Error(manualIssues().join('\n'));ensureBaseCueInvariant();const title=showTitle.value.trim()||tr('Projet S2A Pilot'),entries=[],project={copilotProjectId,backstageTops:clone(backstageTops),format:'showcue-multimedia-package',version:5,showLayout,conductType,applicationVersion:APP_VERSION,customCueTypes:clone(customCueTypes),cueGroups:clone(cueGroups),pilotTools:clone(pilotTools),minimumBridgeBuild:conductType==='manual'?(cues.some(c=>c.manualKind==='silent')?16002:16001):24,minimumBridgeVersion:conductType==='manual'?'1.6.0':'1.4.5',title,showDuration:roundTenth(projectDuration()),showDurationOverride:Number.isFinite(showDurationOverride)?roundTenth(showDurationOverride):null,cues:[]},assetPaths=new Map();for(let i=0;i<cues.length;i++){const c=cues[i],pc={osc:c.osc||undefined,librarySourceCueId:c.librarySourceCueId||undefined,actPreparation:c.actPreparation?normalizeActPreparation(c.actPreparation):undefined,visualNumber:c.visualNumber===true||undefined,goColor:normalizeGoCueColor(c.goColor)||undefined,cueTypeId:cueTypeIds(c)[0],cueTypeIds:cueTypeIds(c),typeDescriptions:c.typeDescriptions?normalizeTypeDescriptions(c.typeDescriptions):undefined,manualKind:c.manualKind||null,manualDuration:c.manualDuration??null,waitForGo:c.waitForGo===true,id:c.id,parentMusicId:c.parentMusicId||null,relativeTime:Number.isFinite(c.relativeTime)?c.relativeTime:null,index:i+1,time:roundTenth(c.time),name:c.name,description:c.description||'',isBase:!!c.isBase,imagePath:null,mediaActions:[]};if(c.imageDataUrl){const p=`images/${String(i+1).padStart(2,'0')}-${safeFileName(c.imageName||'cue.jpg')}`;entries.push({name:p,data:dataUrlToBytes(c.imageDataUrl)});pc.imagePath=p;}for(const a of(c.mediaActions||[])){if(a.kind==='stopAll'){pc.mediaActions.push({...a,assetKey:undefined});continue;}let p=assetPaths.get(a.assetKey);if(!p){const blob=await getAsset(a.assetKey);if(!blob)throw new Error(`${tr("Média introuvable : ")}${a.name}`);p=`media/${a.id}-${safeFileName(a.name)}`;assetPaths.set(a.assetKey,p);entries.push({name:p,data:new Uint8Array(await blob.arrayBuffer())});}pc.mediaActions.push({...a,path:p,assetKey:undefined});}project.cues.push(pc);}const enc=new TextEncoder(),hasVisualNumbers=conductType==='manual'&&cues.some(c=>c.visualNumber);
 if(librarySnapshot){
  entries.push({name:'conduite.json',data:enc.encode(JSON.stringify(project))});
  return {blob:await makeZip(entries),project};
 }
 if(hasVisualNumbers)await addBridgeActPackages(entries,project,enc);
 Object.assign(project,storedManualCueListView());
 await addCompiledCompanion(entries);entries.push({name:'conduite.json',data:enc.encode(JSON.stringify(project,null,2))});const pdf=await buildTechnicalPdfBytes();entries.push({name:`documents/${safeFileName(title)}-conduite-technique.pdf`,data:pdf.bytes});entries.push({name:'LISEZ-MOI-Technicien.txt',data:enc.encode((conductType==='manual'?tr(hasVisualNumbers?'Pour Bridge, décompressez ce ZIP et importez ensemble les fichiers numérotés du dossier Bridge/Numeros. Dans QLab, placez le départ sur le premier groupe. Un GO lance chaque numéro.':'Conduite Spectacle : utilisez Bridge 1.6.33 bêta inclus dans ce ZIP. Bridge 1.4.5 ne connaît pas le mode Spectacle.')+'\n\n':'')+tr('export.readme',{title,count:project.cues.length}))});return{blob:await makeZip(entries),suggestedName:`${safeFileName(title)}.s2apilot.zip`};}
async function decodeVisualNumber(m,entries,fileName,assets){
  if(m.conductType==='manual'||!Array.isArray(m.cues)||!m.cues.length)throw new Error(tr('Choisissez un fichier exporté depuis le mode Numéro visuel.'));
  const children=await decodeProjectCues(m,entries,assets);
  const root={...newBaseCue(),name:m.title?.trim()||fileName.replace(/(?:\.s2apilot)?\.(zip|json)$/i,''),manualKind:'silent',visualNumber:true};
  root.actPreparation=normalizeActPreparation(m.pilotTools?.actPreparation);
  for(const [index,cue] of children.entries()){
   cue.librarySourceCueId=m.version>=3&&typeof m.cues[index]?.id==='string'?m.cues[index].id:undefined;cue.id=uuid();cue.isBase=false;cue.parentMusicId=root.id;cue.manualKind=null;cue.manualDuration=null;cue.visualNumber=false;cue.waitForGo=false;
   cue.relativeTime=roundTenth(Math.max(0,Number(cue.time)||0));cue.time=cue.relativeTime;
   for(const action of cue.mediaActions){
    action.id=uuid();
    if(action.kind==='audio'){action.loop=false;action.keepBackground=false;}
   }
  }
  const lastCue=children.reduce((max,cue)=>Math.max(max,cue.time),0);
  const declared=m.showDurationOverride??m.showDuration;
  let duration=Number.isFinite(declared)&&declared>0?declared:0;
  if(!duration){
   let mediaEnd=lastCue;
   for(const cue of children)for(const action of cue.mediaActions){
    if(action.kind!=='stopAll')mediaEnd=Math.max(mediaEnd,effectiveMediaEnd({start:cue.time,action},children)??0);
   }
   duration=Math.max(10,mediaEnd+10);
  }
  root.manualDuration=roundTenth(Math.max(lastCue+.1,duration));
  return {root,children,types:normalizeCustomCueTypes(m.customCueTypes)};
}
let importingVisualNumbers=false;
async function appendVisualNumbers(files){
 if(importingVisualNumbers||!canReorderGoSequence()||!files.length)return;
 const project=copilotProjectEpoch,assets=[],groups=[];
 importingVisualNumbers=true;
 updateManualStatus();
 try{
  for(const file of files){
   try{
    const {m,entries}=await readProjectPackage(file);
    groups.push(await decodeVisualNumber(m,entries,file.name,assets));
   }catch(error){throw new Error(file.name+' - '+error.message);}
  }
  if(project!==copilotProjectEpoch||!canReorderGoSequence())throw new Error(tr('Le spectacle a changé pendant l’import. Réessayez.'));
  let offset=nextManualMainTime();
  for(const {root,children} of groups){
   root.time=offset;
   for(const child of children)child.time=roundTenth(offset+child.relativeTime);
   offset=roundTenth(offset+root.manualDuration);
  }
  pushHistory();
  for(const {children,types} of groups)mergeImportedCueTypes(children,types);
  cues=cues.concat(groups.flatMap(({root,children})=>[root,...children]));
  expandedCueId=groups[0].root.id;
  invalidatePreflight();
  renderCues();
  scheduleAutosave();
 }catch(error){
  if(!groups.some(({root})=>cues.includes(root))){
   for(const key of assets){
    assetBlobCache.delete(key);
    await idbDelete(ASSET_STORE,key).catch(console.warn);
   }
  }
  throw error;
 }finally{
  importingVisualNumbers=false;
  updateManualStatus();
 }
}
const actLibraryMetadataPrefix='act-library-meta:';
const actLibraryArchivePrefix='act-library-zip:';
const actLibraryDialog=$('actLibraryDialog');
let actLibraryBusy=false;
async function listLibraryActs(){
 const prefix=actLibraryMetadataPrefix;
 const entries=await idbOperation(META_STORE,'readonly',store=>store.getAll(IDBKeyRange.bound(prefix,prefix+'\uffff')));
 return entries.sort((a,b)=>b.savedAt-a.savedAt||a.title.localeCompare(b.title));
}
async function saveLibraryAct(file){
 const {m,entries}=await readProjectPackage(file);
 if(m.conductType==='manual'||!Array.isArray(m.cues)||!m.cues.length)throw new Error(tr('Choisissez un fichier exporté depuis le mode Numéro visuel.'));
 const archive=[{name:'conduite.json',data:new TextEncoder().encode(JSON.stringify(m))}];
 const paths=new Map();
 for(const cue of m.cues){
  if(cue.imagePath)paths.set(cue.imagePath,cue.imagePath);
  for(const action of cue.mediaActions||[])if(action.kind!=='stopAll')paths.set(action.path,action.name||action.path);
 }
 for(const kind of ['audio','video'])if(m[kind]?.path)paths.set(m[kind].path,m[kind].originalFileName||m[kind].path);
 for(const [path,name] of paths){
  if(!path||path==='conduite.json'||!entries.has(path))throw new Error(tr('Média introuvable : ')+(name||tr('Média')));
  archive.push({name:path,data:entries.get(path)});
 }
 await storeLibraryAct(m.title?.trim()||file.name.replace(/(?:\.s2apilot)?\.(zip|json)$/i,''),await makeZip(archive));
}
async function storeLibraryAct(title,archive){
 const id=uuid(),buffer=await archive.arrayBuffer();
 const record={id,title,savedAt:Date.now()};
 await requestPersistentStorage();
 await idbOperation(META_STORE,'readwrite',store=>{
  store.put(buffer,actLibraryArchivePrefix+id);
  return store.put(record,actLibraryMetadataPrefix+id);
 });
}
let libraryUpdateSource=null,libraryUpdateTarget=null;
function matchLibraryCues(previous,incoming){
 const matches=new Map(),used=new Set();
 function match(key,legacyOnly=false){
  const current=new Map(),updated=new Map();
  const collect=(list,groups,get)=>list.forEach(cue=>{
   const value=get(cue);if(!value)return;
   if(!groups.has(value))groups.set(value,[]);
   groups.get(value).push(cue);
  });
  collect(previous.filter(cue=>!used.has(cue)&&(!legacyOnly||!cue.librarySourceCueId)),current,key);
  collect(incoming.filter(cue=>!matches.has(cue)),updated,key);
  for(const [value,rows] of updated){
   const old=current.get(value);
   if(rows.length===1&&old?.length===1){matches.set(rows[0],old[0]);used.add(old[0]);}
  }
 }
 match(cue=>cue.librarySourceCueId);
 match(cue=>cue.name?.trim().toLowerCase(),true);
 return {matches,removed:previous.filter(cue=>!used.has(cue))};
}
function showLibraryUpdatePreview(){
 const target=manualMusics().find(cue=>cue.id===$('actLibraryUpdateTarget').value&&cue.visualNumber);
 const preview=$('actLibraryUpdatePreview'),changes=$('actLibraryUpdateChanges');
 libraryUpdateTarget=target;
 preview.hidden=!target||!libraryUpdateSource;
 changes.replaceChildren();
 $('actLibraryUpdateApply').disabled=preview.hidden||actLibraryBusy;
 if(preview.hidden)return;
 const {m}=libraryUpdateSource;
 const incoming=m.cues.map((cue,index)=>({librarySourceCueId:cue.id,name:cue.name||'Cue '+(index+1),time:+cue.time||0,mediaActions:cue.mediaActions||[]}));
 const {matches,removed}=matchLibraryCues(manualChildren(target),incoming);
 $('actLibraryUpdateSummary').textContent=target.name+' → '+libraryUpdateSource.title;
 const add=text=>{const row=document.createElement('li');row.textContent=text;changes.append(row);};
 const preparation=normalizeActPreparation(m.pilotTools?.actPreparation),current=normalizeActPreparation(target.actPreparation);
 for(const [key,label] of [['equipment','Matériel'],['setup','Consignes d’installation']]){
  const additions=preparation[key].filter(item=>!current[key].includes(item));
  const removals=current[key].filter(item=>!preparation[key].includes(item));
  for(const item of additions)add(tr('Ajouter : {cue}',{cue:tr(label)+' · '+item}));
  for(const item of removals)add(tr('Retirer : {cue}',{cue:tr(label)+' · '+item}));
 }
 const declared=m.showDurationOverride??m.showDuration;
 if(Number.isFinite(declared)&&declared>0){
  const after=Math.max(declared,...incoming.map(cue=>cue.time+.1));
  add(tr('Durée : {before} → {after}',{before:fmtDisplay(manualDuration(target)),after:fmtDisplay(after)}));
 }
 for(const cue of incoming){
  const old=matches.get(cue);
  const media=cue.mediaActions.filter(action=>action.kind!=='stopAll');
  const files=media.map(action=>action.name||action.path?.split('/').pop()||tr('Média'));
  const detail=[cue.name,'+'+fmtDisplay(cue.time),...files].join(' · ');
  add(tr(old?'Remplacer : {cue}':'Ajouter : {cue}',{cue:old&&old.name!==cue.name?old.name+' → '+detail:detail}));
 }
 for(const cue of removed)add(tr('Retirer : {cue}',{cue:cue.name}));
}
function resetLibraryUpdate(){
 libraryUpdateSource=null;libraryUpdateTarget=null;
 $('actLibraryUpdatePanel').hidden=true;$('actLibraryUpdatePreview').hidden=true;
}
async function startLibraryUpdate(entry){
 if(actLibraryBusy||!canReorderGoSequence())return;
 const epoch=copilotProjectEpoch;
 const status=$('actLibraryStatus');
 resetLibraryUpdate();
 actLibraryBusy=true;status.textContent=tr('Traitement en cours…');
 try{
  const buffer=await idbGet(META_STORE,actLibraryArchivePrefix+entry.id);
  if(!buffer)throw new Error(tr('Numéro indisponible dans la bibliothèque.'));
  const {m,entries}=await readProjectPackage(new File([buffer],entry.title+'.zip'));
  if(epoch!==copilotProjectEpoch||!canReorderGoSequence()||!actLibraryDialog.open)return;
  if(m.conductType==='manual'||!m.cues?.length)throw new Error(tr('Choisissez un fichier exporté depuis le mode Numéro visuel.'));
  libraryUpdateSource={m,entries,epoch,title:entry.title};
  const target=$('actLibraryUpdateTarget');
  target.replaceChildren(new Option(tr('Choisir un numéro du spectacle'),''));
  for(const cue of manualMusics().filter(cue=>cue.visualNumber))target.add(new Option(cueViewNumber(cue)+' · '+cue.name,cue.id));
  $('actLibraryUpdatePanel').hidden=false;status.textContent='';
  target.focus();
 }catch(error){status.textContent=error.message;}
 finally{actLibraryBusy=false;}
}
async function applyLibraryUpdate(source,target){
 const assets=[];
 try{
  const data=await decodeVisualNumber(source.m,source.entries,source.title,assets);
  if(source!==libraryUpdateSource||target!==libraryUpdateTarget||source.epoch!==copilotProjectEpoch||!cues.includes(target)||!canReorderGoSequence()||importingVisualNumbers)throw new Error(tr('Le spectacle a changé pendant l’import. Réessayez.'));
  const before=manualChildren(target),{matches,removed}=matchLibraryCues(before,data.children);
  const durationDifference=data.root.manualDuration-manualDuration(target);
  const following=manualMusics().slice(manualMusics().indexOf(target)+1);
  const shifted=Math.max(durationDifference,target.time-(following[0]?.time??target.time+manualDuration(target)));
  pushHistory();
  mergeImportedCueTypes(data.children,data.types);
  for(const cue of data.children){
   const previous=matches.get(cue);
   if(previous)cue.id=previous.id;
   cue.parentMusicId=target.id;cue.time=roundTenth(target.time+cue.relativeTime);
  }
  target.name=data.root.name;target.manualDuration=data.root.manualDuration;target.actPreparation=data.root.actPreparation;
  for(const cue of following)cue.time=roundTenth(cue.time+shifted);
  const obsolete=new Set(before),removedIds=new Set(removed.map(cue=>cue.id));
  cues=cues.filter(cue=>!obsolete.has(cue)).concat(data.children);
  pilotTools.sequenceSheets=pilotTools.sequenceSheets.filter(sheet=>!removedIds.has(sheet.cueId));
  if(manualArmedID===target.id||before.some(cue=>cue.id===manualArmedID)){manualArmedID=null;manualArmExplicit=false;}
  if(manualCompletedID===target.id){manualCompletedID=null;transportTime=transportBase=lastTransportTime=0;}
  expandedCueId=target.id;
  invalidatePreflight();pruneGeneratedChecklist();renderCues();scheduleAutosave();
 }catch(error){
  for(const key of assets){
   if(cues.some(cue=>cue.mediaActions?.some(action=>action.assetKey===key)))continue;
   assetBlobCache.delete(key);await idbDelete(ASSET_STORE,key).catch(console.warn);
  }
  throw error;
 }
}
$('actLibraryUpdateTarget').onchange=showLibraryUpdatePreview;
$('actLibraryUpdateCancel').onclick=resetLibraryUpdate;
$('actLibraryUpdateApply').onclick=()=>{
 const source=libraryUpdateSource,target=libraryUpdateTarget;
 if(!source||!target||actLibraryBusy)return;
 runActLibraryAction(async()=>{await applyLibraryUpdate(source,target);resetLibraryUpdate();},'Numéro mis à jour.');
};
actLibraryDialog.addEventListener('close',resetLibraryUpdate);
async function renderActLibrary(){
 const entries=await listLibraryActs();
 const list=$('actLibraryList');
 list.replaceChildren();$('actLibraryEmpty').hidden=entries.length>0;
 $('actLibrarySaveCurrent').hidden=conductType==='manual';
 $('actLibraryAddHelp').hidden=conductType==='manual';
 for(const entry of entries){
  const row=document.createElement('li'),title=document.createElement('strong'),add=document.createElement('button'),remove=document.createElement('button');
  title.textContent=entry.title;
  add.type=remove.type='button';
  add.textContent=tr('Ajouter une copie');add.disabled=conductType!=='manual'||!canReorderGoSequence();
  remove.textContent=tr('Retirer');
  add.setAttribute('aria-label',add.textContent+' · '+entry.title);
  remove.setAttribute('aria-label',remove.textContent+' · '+entry.title);
  add.onclick=()=>runActLibraryAction(async()=>{
   const project=copilotProjectEpoch,buffer=await idbGet(META_STORE,actLibraryArchivePrefix+entry.id);
   if(!buffer)throw new Error(tr('Numéro indisponible dans la bibliothèque.'));
   if(project!==copilotProjectEpoch||!canReorderGoSequence()||importingVisualNumbers)throw new Error(tr('Le spectacle a changé pendant l’import. Réessayez.'));
   await appendVisualNumbers([new File([buffer],entry.title+'.zip',{type:'application/zip'})]);
  },'Copie ajoutée au spectacle.');
  remove.onclick=()=>{
   if(actLibraryBusy||!confirm(tr('Retirer ce numéro de la bibliothèque ?')))return;
   runActLibraryAction(()=>idbOperation(META_STORE,'readwrite',store=>{
    store.delete(actLibraryArchivePrefix+entry.id);
    return store.delete(actLibraryMetadataPrefix+entry.id);
   }),'Numéro retiré de la bibliothèque.');
  };
  row.append(title,add);
  if(conductType==='manual'&&manualMusics().some(cue=>cue.visualNumber)){
   const update=document.createElement('button');update.type='button';update.textContent=tr('Mettre à jour un numéro');
   update.disabled=!canReorderGoSequence();update.onclick=()=>startLibraryUpdate(entry);
   row.append(update);
  }
  row.append(remove);list.append(row);
 }
}
async function runActLibraryAction(action,message){
 if(actLibraryBusy)return;
 actLibraryBusy=true;
 const status=$('actLibraryStatus');
 const controls=$('actLibraryControls');
 const buttons=[$('actLibraryClose'),...controls.querySelectorAll('button,input')].filter(button=>!button.disabled);
 for(const button of buttons)button.disabled=true;
 status.textContent=tr('Traitement en cours…');
 try{await action();await renderActLibrary();status.textContent=tr(message);}
 catch(error){status.textContent=error.message;}
 finally{actLibraryBusy=false;for(const button of buttons)button.disabled=false;}
}
$('actLibraryOpen').onclick=()=>{
 if(locked||transportPlaying||actLibraryBusy)return;
 actLibraryDialog.showModal();
 runActLibraryAction(()=>Promise.resolve(),'');
};
$('actLibraryClose').onclick=()=>actLibraryDialog.close();
actLibraryDialog.addEventListener('cancel',event=>{if(actLibraryBusy)event.preventDefault();});
$('actLibrarySaveCurrent').onclick=()=>runActLibraryAction(async()=>{
 if(locked||transportPlaying||conductType==='manual')return;
 const {blob,project}=await buildProjectPackage(true);
 await storeLibraryAct(project.title,blob);
},'Numéro enregistré dans la bibliothèque.');
$('actLibraryImport').onclick=()=>$('actLibraryFiles').click();
$('actLibraryFiles').onchange=event=>{
 const file=event.currentTarget.files[0];event.currentTarget.value='';
 if(file)runActLibraryAction(()=>saveLibraryAct(file),'Numéro enregistré dans la bibliothèque.');
};
function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
let savingProject=false;
async function saveProject(){
 if(locked||savingProject)return;
 savingProject=true;
 const b=saveAsBtn,old=b.textContent,suggestedName=`${safeFileName(showTitle.value.trim()||tr('Projet S2A Pilot'))}.s2apilot.zip`;
 b.disabled=true;
 try{
  // The picker must be opened during the click, before autosave or PDF generation.
  let handle=null;
  if(typeof window.showSaveFilePicker==='function'){
   try{handle=await window.showSaveFilePicker({suggestedName,types:[{description:tr('Projet S2A Pilot'),accept:{'application/zip':['.zip']}}]});}
   catch(e){if(e.name==='AbortError')return;if(!['SecurityError','NotAllowedError'].includes(e.name))throw e;}
  }
  S2AMaterial.button(b,'save_as',tr('Création du package…'));
  await writeAutosave();const {blob}=await buildProjectPackage();
  if(handle){const writer=await handle.createWritable();try{await writer.write(blob);await writer.close();}catch(e){try{await writer.abort();}catch{}throw e;}}
  else downloadBlob(blob,suggestedName);
  currentProjectName=suggestedName;
 }catch(e){window.S2APilotDiagnostics?.report('save',e);console.error(e);alert(tr('Impossible d’enregistrer : ')+(e.message||e));}
 finally{savingProject=false;S2AMaterial.button(b,'save_as',old);setEnabled();}
}
async function compatibilityProjectAsPackage(file){
 const parsed=JSON.parse(await file.text());if(parsed.format!=='s2a-legacy-project'||!parsed.project||!Array.isArray(parsed.project.cues))throw new Error(tr('Format de projet non reconnu.'));
 const p=parsed.project,entries=[],manifest={format:'showcue-multimedia-package',version:5,showLayout:['compact','iceman'].includes(p.showLayout)?p.showLayout:'maverick',title:p.title||'',cues:[]};
 for(let i=0;i<p.cues.length;i++){const c=p.cues[i],record={index:i+1,time:Math.max(0,Number(c.time)||0),name:c.name||'Cue',description:c.description||'',imagePath:null,mediaActions:[]};if(c.imageDataUrl){record.imagePath=`images/${i+1}.jpg`;entries.push({name:record.imagePath,data:dataUrlToBytes(c.imageDataUrl)});}
  if(p.audio&&String(p.audio.cueID)===String(c.id)){const a=p.audio,path='media/'+safeFileName(a.name||'audio.mp3');entries.push({name:path,data:dataUrlToBytes(a.data)});record.mediaActions.push({id:uuid(),kind:'audio',name:a.name,path,duration:(Number(a.duration)||0)+(Number(a.inPoint)||0),inPoint:Number(a.inPoint)||0,outPoint:(Number(a.duration)||0)+(Number(a.inPoint)||0),loop:false,transition:'cut',gain:1});}manifest.cues.push(record);}
 entries.push({name:'conduite.json',data:new TextEncoder().encode(JSON.stringify(manifest))});return new File([await makeZip(entries)],(file.name||'compatibility')+'.zip',{type:'application/zip'});
}
async function readProjectPackage(file){
 if(/\.json$/i.test(file.name||''))file=await compatibilityProjectAsPackage(file);
 const entries=projectZipEntries(readStoredZip(await file.arrayBuffer()));
 const m=JSON.parse(new TextDecoder().decode(entries.get('conduite.json')));
 if(!m||typeof m!=='object'||(m.conductType&&!['autopilot','manual'].includes(m.conductType)))throw new Error(tr('Format de projet non reconnu.'));
 return {m,entries};
}
async function decodeProjectCues(m,entries,stagedAssets){
 async function saveAsset(file){
  const key=await storeAsset(file);
  stagedAssets?.push(key);
  return key;
 }
 function assetBytes(path,name){
  if(entries.has(path))return entries.get(path);
  if(stagedAssets)throw new Error(tr('Média introuvable : ')+(name||path||tr('Média')));
  return null;
 }
 function imageFor(c){
  const bytes=c.imagePath&&assetBytes(c.imagePath);
  return bytes?bytesToDataUrl(bytes,mimeFromName(c.imagePath)):null;
 }
 if(m.version>=3&&Array.isArray(m.cues)){
  const imported=[];
  for(const c of m.cues){
   const mediaActions=[];
   for(const a of c.mediaActions||[]){
    if(a.kind==='stopAll'){mediaActions.push(normalizeMediaAction(a));continue;}
    const bytes=assetBytes(a.path,a.name);
    const name=a.name||a.path?.split('/').pop()||tr('Média'),mime=a.mime||mimeFromName(name);
    if(!bytes){mediaActions.push(normalizeMediaAction({...a,assetKey:null,name,mime}));continue;}
    const key=await saveAsset(new File([bytes],name,{type:mime}));
    mediaActions.push(normalizeMediaAction({...a,assetKey:key,name,mime,size:bytes.length}));
   }
   imported.push({
    osc:typeof c.osc==='string'?c.osc.slice(0,2000):undefined,
    librarySourceCueId:typeof c.librarySourceCueId==='string'?c.librarySourceCueId:undefined,
    actPreparation:c.actPreparation?normalizeActPreparation(c.actPreparation):undefined,
    visualNumber:c.visualNumber===true&&c.manualKind==='silent',goColor:normalizeGoCueColor(c.goColor),
    cueTypeId:typeof c.cueTypeId==='string'?c.cueTypeId:undefined,
    cueTypeIds:Array.isArray(c.cueTypeIds)?c.cueTypeIds.filter(id=>typeof id==='string'):undefined,
    typeDescriptions:c.typeDescriptions?normalizeTypeDescriptions(c.typeDescriptions):undefined,
    manualKind:c.manualKind||null,manualDuration:c.manualDuration??null,waitForGo:c.waitForGo===true,
    id:c.id||uuid(),parentMusicId:c.parentMusicId||null,relativeTime:Number.isFinite(c.relativeTime)?c.relativeTime:null,
    time:+c.time||0,name:c.name||'Cue '+(imported.length+1),description:c.description||'',isBase:!!c.isBase,
    imageDataUrl:imageFor(c),imageName:c.imagePath?.split('/').pop()||null,mediaActions
   });
  }
  return imported;
 }
 const legacy=(m.cues||[]).map((c,index)=>({
  id:uuid(),time:+c.time||0,name:c.name||'Cue '+(index+1),description:c.description||'',isBase:!!c.isBase,
  imageDataUrl:imageFor(c),imageName:c.imagePath?.split('/').pop()||null,mediaActions:[]
 }));
 if(!legacy.length)legacy.push(newBaseCue());
 const base=legacy.find(c=>c.isBase)||legacy[0];
 for(const kind of ['audio','video']){
  const record=m[kind];
  if(!record?.path)continue;
  const bytes=assetBytes(record.path);
  const name=record.originalFileName||record.fileName||kind,mime=record.mimeType||mimeFromName(name);
  if(!bytes){base.mediaActions.push(normalizeMediaAction({kind,name,mime,duration:record.duration}));continue;}
  const file=new File([bytes],name,{type:mime}),key=await saveAsset(file);
  const duration=kind==='audio'&&(record.duration>0||!stagedAssets)?record.duration||0:(await probeMedia(file)).duration;
  base.mediaActions.push(normalizeMediaAction({kind,assetKey:key,name,mime,size:file.size,duration,transition:'cut',muted:record.mutedOutput!==false}));
 }
 return legacy;
}
async function importPackage(file){
 const {m,entries}=await readProjectPackage(file);
 const screenCheck=(m.video||(m.cues||[]).some(c=>(c.mediaActions||[]).some(a=>a.kind==='video')))?checkScreensForAddedVideo():Promise.resolve(false);const imported=await decodeProjectCues(m,entries);
 copilotProjectEpoch++;copilotProjectId=copilotIdentity(m);backstageTops=normalizeBackstageTops(m.backstageTops);conductType=m.conductType==='manual'?'manual':'autopilot';resetManualRuntime();showTitle.value=m.title||file.name.replace(/\.s2apilot\.zip$|\.showcue\.zip$|\.zip$/i,'');showDurationOverride=Number.isFinite(m.showDurationOverride)?roundTenth(m.showDurationOverride):null;setShowLayout(m.showLayout,false);cues=imported;customCueTypes=normalizeCustomCueTypes(m.customCueTypes);restoreCueGroups(m.cueGroups);pilotTools=normalizePilotTools(m.pilotTools);restoreCueTypeFilters();ensureBaseCueInvariant();workspaceCommitted=true;currentProjectName=file.name;transportTime=0;expandedCueId=null;restoreManualCueListView(m);invalidatePreflight();await writeAutosave(true);renderCues();resetHistory();await rebuildMediaAtTime(0,false);await screenCheck;}

async function loadWorkspace(saved){copilotProjectEpoch++;copilotProjectId=copilotIdentity(saved);backstageTops=normalizeBackstageTops(saved.backstageTops);conductType=saved.conductType==='manual'?'manual':'autopilot';resetManualRuntime();setShowLayout(saved.showLayout,false);showTitle.value=saved.title||'';showDurationOverride=Number.isFinite(saved.showDurationOverride)?roundTenth(saved.showDurationOverride):null;cues=clone(saved.cues||[]).map(c=>({...c,mediaActions:(c.mediaActions||[]).map(normalizeMediaAction)}));customCueTypes=normalizeCustomCueTypes(saved.customCueTypes);restoreCueGroups(saved.cueGroups);pilotTools=normalizePilotTools(saved.pilotTools);restoreCueTypeFilters();ensureBaseCueInvariant();workspaceCommitted=true;transportTime=0;expandedCueId=null;restoreManualCueListView(saved);invalidatePreflight();renderCues();resetHistory();await rebuildMediaAtTime(0,false);}
function startNewProject(){copilotProjectEpoch++;copilotProjectId=uuid();backstageTops=[];customCueTypes=[];restoreCueGroups();pilotTools=normalizePilotTools();restoreCueTypeFilters();conductType='autopilot';resetManualRuntime();setShowLayout('maverick',false);pauseTransport();stopAllAudio();stopVideoRuntime();showTitle.value='';showDurationOverride=null;cues=[];workspaceCommitted=false;currentProjectName=null;transportTime=0;expandedCueId=null;invalidatePreflight();resetHistory();locked=false;applyLockState();scheduleAutosave();}
async function startup(){
 window.s2aBootPhase='storage-read';
 try{startupSaved=await readAutosave();}
 catch(error){window.S2APilotDiagnostics?.startup('storage-read',error);console.warn(error);}
 if(startupSaved&&Array.isArray(startupSaved.cues)){
  window.s2aBootPhase='project-restore';
  const title=startupSaved.title?.trim()||tr('Projet sans nom');
  showSavedStatus({...startupSaved,title},'restored');
  try{
   await loadWorkspace(startupSaved);
   window.s2aWorkspaceReady=true;
   return;
  }catch(error){window.S2APilotDiagnostics?.startup('restore',error);console.warn(error);}
 }else startupProjectInfo.textContent=tr('Aucune sauvegarde locale détectée.');
 window.s2aBootPhase='new-project';
 startNewProject();
 window.s2aWorkspaceReady=true;
}

let escapeFading=false,showEscapeResume=null;
let spaceTransportPending=false,transportAcceptedAt=-Infinity;
let transportGuardTimer;
function showTransportGuard(duration=TRANSPORT_GUARD_MS){
 clearTimeout(transportGuardTimer);
 playBtn.classList.toggle('spaceGuard',duration>0);
 if(duration>0)transportGuardTimer=setTimeout(()=>playBtn.classList.remove('spaceGuard'),duration);
}
function toggleTransportGuarded(){
 if(escapeFading)return;
 if(conductType==='manual'){
  if(manualEditSequenceVisible())playEditFromCue(currentTransportTime()).catch(reportTransportError);
  else manualGO().catch(reportTransportError);
  return;
 }
 if(spaceTransportPending||(!transportPlaying&&playBtn.disabled)||performance.now()-transportAcceptedAt<TRANSPORT_GUARD_MS)return;
 transportAcceptedAt=performance.now();showTransportGuard();
 if(transportPlaying){pauseTransport();return;}
 spaceTransportPending=true;Promise.resolve(playTransport()).catch(reportTransportError).finally(()=>{spaceTransportPending=false;});
}

// Consumer-media remotes can send a keyboard event or a Media Session action.
let lastMediaRemoteAt=-Infinity;
function pilotDialogOpen(){
 return document.querySelector('dialog[open],.cueDeleteOverlay,.quickHelpOverlay:not([hidden]),.helpVideoOverlay:not([hidden])');
}
function routePilotMediaAction(action){
 const help=document.querySelector('.helpVideoOverlay:not([hidden]) video');
 if(help){if(action==='pause'||(action==='toggle'&&!help.paused))help.pause();else help.play().catch(function(){});return;}
 if(pilotDialogOpen()||escapeFading||performance.now()-lastMediaRemoteAt<TRANSPORT_GUARD_MS)return;
 const playing=transportPlaying||(conductType==='manual'&&[...runtimeAudio.values()].some(rt=>!rt.el.paused));
 if((action==='play'&&playing)||(action==='pause'&&!playing))return;
 lastMediaRemoteAt=performance.now();
 if(manualEditSequenceVisible())toggleEditTimeline().catch(reportTransportError);
 else if(conductType==='manual')toggleManualPause().catch(reportTransportError);
 else toggleTransportGuarded();
}
function reportTransportError(error){window.S2APilotDiagnostics?.report('transport',error);alert(error.message);}
function updatePilotMediaSession(){
 if(!navigator.mediaSession)return;
 try{const playing=transportPlaying||(conductType==='manual'&&[...runtimeAudio.values()].some(rt=>!rt.el.paused));const state=playing?'playing':'paused';if(navigator.mediaSession.playbackState!==state)navigator.mediaSession.playbackState=state;}catch(error){}
}
function registerPilotMediaActions(){
 const session=navigator.mediaSession;
 if(!session||!session.setActionHandler)return;
 const actions={
  play:function(){routePilotMediaAction('play');},
  pause:function(){routePilotMediaAction('pause');},
  previoustrack:function(){if(!pilotDialogOpen())navigateCue(-1);},
  nexttrack:function(){if(!pilotDialogOpen())navigateCue(1);},
  seekbackward:function(details){if(!pilotDialogOpen())seekPilotBy(-1,details&&details.seekOffset);},
  seekforward:function(details){if(!pilotDialogOpen())seekPilotBy(1,details&&details.seekOffset);}
 };
 Object.keys(actions).forEach(function(action){
  try{session.setActionHandler(action,actions[action]);}catch(error){}
 });
}
registerPilotMediaActions();
function updateGoFadeHalo(progress=null){
 const visible=progress!==null;
 playBtn.classList.toggle('fadeStopping',visible);
 let ring=playBtn.querySelector('.goFadeHalo');
 if(!visible){if(ring)ring.remove();return;}
 if(!ring){
  const ns='http://www.w3.org/2000/svg';ring=document.createElementNS(ns,'svg');ring.classList.add('goFadeHalo');ring.setAttribute('preserveAspectRatio','none');ring.setAttribute('aria-hidden','true');ring.setAttribute('focusable','false');
  for(const kind of ['goFadeTrack','goFadeProgress']){const path=document.createElementNS(ns,'path');path.classList.add(kind);path.setAttribute('pathLength','100');ring.append(path);}playBtn.append(ring);
 }
 const width=ring.clientWidth,height=ring.clientHeight,radius=Math.min(width/2-2,height/2-2,(parseFloat(getComputedStyle(playBtn).borderTopLeftRadius)||10)+3),geometry=[width,height,radius].join(',');
 if(width>4&&height>4&&ring.dataset.geometry!==geometry){
  ring.dataset.geometry=geometry;ring.setAttribute('viewBox','0 0 '+width+' '+height);
  const right=width-2,bottom=height-2,r=radius,mid=width/2,d=`M${mid} 2 H${right-r} A${r} ${r} 0 0 1 ${right} ${2+r} V${bottom-r} A${r} ${r} 0 0 1 ${right-r} ${bottom} H${2+r} A${r} ${r} 0 0 1 2 ${bottom-r} V${2+r} A${r} ${r} 0 0 1 ${2+r} 2 H${mid}`;
  for(const path of ring.querySelectorAll('path'))path.setAttribute('d',d);
 }
 const value=Math.max(0,Math.min(1,progress));const path=ring.querySelector('.goFadeProgress'),offset=String(100*(1-value));path.setAttribute('stroke-dashoffset',offset);path.style.setProperty('stroke-dashoffset',offset);ring.dataset.progress=String(value);
}
function finishEscapeStop(fadeCue,video,opacity){
 editBlockPreview=null;
 const primary=fadeCue&&(fadeCue.mediaActions||[]).find(function(action){return action.kind==='audio';});
 const track=primary&&runtimeAudio.get(primary.id);
 const resumeManual=locked&&fadeCue&&
  (primary?track&&!track.el.ended:!manualHoldsAtStart(fadeCue)&&transportTime<fadeCue.time+manualDuration(fadeCue)-.025);
 showEscapeResume=resumeManual?{videoOpacity:opacity,armedID:null}:null;
 if(conductType==='manual'){
  manualFade=null;
  if(resumeManual){
   manualPausedAt=performance.now();
   manualWaitCueID=null;manualWaitDeferred=[];
  }else{
   manualCompletedID=manualCurrentID||manualCompletedID;
   manualCurrentID=null;manualPausedAt=null;
  }
  if(locked){
   const next=orderedCues().find(function(cue){
    return cue.time>transportTime+.0001||
     (fadeCue&&cue.time>fadeCue.time&&isManualMainCue(cue)&&Math.abs(cue.time-transportTime)<=.0001);
   });
   manualArmedID=next?next.id:null;
   manualArmExplicit=!!next;
   manualLastGO=-Infinity;
   if(showEscapeResume)showEscapeResume.armedID=manualArmedID;
  }
 }
 escapeFading=false;updateGoFadeHalo();pauseTransport();
 if(resumeManual){
  runtimeAudio.forEach(function(rt,id){
   if(rt!==track)stopAudioRuntime(id);
   else{delete rt.globalFadeStartedAt;delete rt.stopFade;}
  });
  if(runtimeVideo===video&&runtimeVideo)delete runtimeVideo.globalFadeStartedAt;
 }else stopAllRuntimeMedia();
 updateTransport();
 if(locked&&conductType==='manual'&&(manualArmExplicit||showEscapeResume)&&
    !pilotDialogOpen()&&!shortcutInput(document.activeElement))playBtn.focus({preventScroll:true});
}
function restoreEscapedManualMedia(){
 if(!showEscapeResume)return;
 if(showEscapeResume.armedID&&manualArmedID===showEscapeResume.armedID){
  manualArmedID=null;manualArmExplicit=false;
 }
 runtimeAudio.forEach(function(rt){setRuntimeGain(rt,1);});
 if(runtimeVideo){
  runtimeVideo.opacity=showEscapeResume.videoOpacity;
  runtimeVideo.el.style.opacity=String(runtimeVideo.opacity);
 }
 showEscapeResume=null;
}
function fadeOutAndStop(){
 if(escapeFading||(!transportPlaying&&![...runtimeAudio.values()].some(rt=>isBackgroundTrack(rt)&&!rt.el.paused)))return;
 cancelManualCrossfadeLead();
 escapeFading=true;updateGoFadeHalo(0);const generation=++transportCommandGeneration,started=performance.now(),duration=pilotShortcuts.stopFadeSeconds*1000;
 cancelAnimationFrame(rafId);rafId=0;
 const audio=[...runtimeAudio.values()].map(rt=>({rt,gain:rt.manualGainValue??rt.el.volume})),video=runtimeVideo,opacity=video?.opacity??1,fadeCue=conductType==='manual'?manualCurrent():null,fadeTime=currentTransportTime();
 updateTransport();
 let frame=0,timer=0;
 const schedule=()=>{if(document.hidden)timer=setTimeout(()=>{timer=0;step(performance.now());},50);else frame=requestAnimationFrame(now=>{frame=0;step(now);});};
 const visibility=()=>{cancelAnimationFrame(frame);clearTimeout(timer);frame=timer=0;schedule();};
 const cleanup=()=>{cancelAnimationFrame(frame);clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);};
 document.addEventListener('visibilitychange',visibility);
 const step=now=>{
  if(generation!==transportCommandGeneration){cleanup();escapeFading=false;updateGoFadeHalo();for(const x of audio)if(runtimeAudio.get(x.rt.item.action.id)===x.rt)setRuntimeGain(x.rt,x.gain);updateTransport();return;}
  const factor=Math.max(0,1-(now-started)/duration);updateGoFadeHalo(1-factor);
  for(const x of audio)setRuntimeGain(x.rt,x.gain*factor);
  if(fadeCue){const main=audio.find(x=>x.rt.item.cue.id===fadeCue.id),elapsed=main?manualAudioElapsed(main.rt):fadeTime-fadeCue.time+(now-started)/1000;transportTime=transportBase=fadeCue.time+Math.min(manualDuration(fadeCue),elapsed);lastTransportTime=transportTime;if(now-lastDisplayUpdate>=60){lastDisplayUpdate=now;updateTransport();}}
  if(video&&runtimeVideo===video){video.opacity=opacity*factor;video.el.style.opacity=String(video.opacity);syncExternalVideo();}
  if(factor>0){schedule();return;}
  cleanup();
  finishEscapeStop(fadeCue,video,opacity);
 };
 schedule();
}
function cueNavigationIndex(list){
 const active=locked&&getActiveCue();
 const selected=locked?(conductType==='manual'?manualArmedID||(active&&active.id)||manualCompletedID:autoShowSelectedCueId||(active&&active.id)):expandedCueId;
 return list.findIndex(function(cue){return cue.id===selected;});
}
function cueNavigationBusy(){
 return locked&&conductType==='manual'&&(manualPending||escapeFading);
}
function updateCueNavigation(){
 const blocks=manualEditSequenceVisible()?editGoBlocks():null;
 const list=blocks||cueViewOrder(),index=blocks?blocks.indexOf(expandedCueId):cueNavigationIndex(list),busy=cueNavigationBusy();
 const current=currentTransportTime(),start=pilotSeekTarget(0),end=pilotSeekTarget(projectDuration());
 const holding=heldCueShortcut&&heldCueShortcut.key;
 const noPrevious=busy||(blocks?!list.length||index===0:index<=0&&current<=start+.001);
 const noNext=busy||(blocks?!list.length||index===list.length-1:index>=list.length-1&&current>=end-.001);
 const previous=$('transportPreviousCue'),next=$('transportNextCue');
 previous.disabled=holding!==previous&&noPrevious;
 next.disabled=holding!==next&&noNext;
}
function navigateCue(direction){
 if(cueNavigationBusy())return;
 if(manualEditSequenceVisible()){
  const ids=editGoBlocks(),index=ids.indexOf(expandedCueId);
  const cue=cues.find(item=>item.id===ids[index<0?0:index+direction]);
  if(cue)selectGoSequenceCue(cue);
  return;
 }
 const list=cueViewOrder(),index=cueNavigationIndex(list);
 const cue=list[index<0?0:index+direction];
 if(!cue)return;
 if(!locked){
  expandedCueId=cue.id;renderCues();centerEditedCue(cue.id);
 }else if(conductType==='manual'){
  armManualCue(cue.id);
 }else{
  autoShowSelectedCueId=cue.id;updateShowOverview();updateCueNavigation();
 }
}
function bindCueArrow(button,direction){
 let press=null,suppressPointerClick=false;
 function finish(cancelled){
  suppressPointerClick=cancelled||press.hold.long||heldCueShortcut!==press.hold;
  if(heldCueShortcut===press.hold)cancelCueShortcut();
  press=null;
  updateCueNavigation();
 }
 button.addEventListener('pointerdown',function(event){
  if(event.button!==0||event.isPrimary===false||button.disabled||pilotDialogOpen())return;
  if(press&&press.hold===heldCueShortcut)return;
  suppressPointerClick=false;
  press={id:event.pointerId,hold:startCueShortcut(button,direction)};
  button.setPointerCapture(event.pointerId);
 });
 button.addEventListener('pointermove',function(event){
  if(!press||event.pointerId!==press.id)return;
  const rect=button.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)finish(true);
 });
 button.addEventListener('pointerup',function(event){
  if(press&&event.pointerId===press.id)finish(!canUseCueShortcut(press.hold));
 });
 ['pointercancel','lostpointercapture'].forEach(function(type){
  button.addEventListener(type,function(event){if(press&&event.pointerId===press.id)finish(true);});
 });
 button.addEventListener('contextmenu',function(event){event.preventDefault();});
 button.addEventListener('click',function(event){
  if((event.detail!==0||event.pointerType)&&suppressPointerClick)return;
  if(!pilotDialogOpen())navigateCue(direction);
 });
}
bindCueArrow($('transportPreviousCue'),-1);
bindCueArrow($('transportNextCue'),1);
// A short press selects a cue. A sustained press seeks until release.
const CUE_HOLD_DELAY=400,CUE_SEEK_INTERVAL=200,CUE_SEEK_SECONDS=5;
const shortcutSpecs=[
 ['play','Lecture / Pause',[['play','Space'],['mediaPlay','F8']]],
 ['go','GO',[['go','Enter']]],
 ['stop','Arrêt avec fondu',[['stop','Escape']]],
 ['next','Cue suivante / avance rapide',[['next','ArrowRight'],['forward','F9']]],
 ['previous','Cue précédente / recul rapide',[['previous','ArrowLeft'],['rewind','F7']]]
];
// Keep the existing storage slots so custom keys from 1.6.33 are preserved.
const shortcutSlots=shortcutSpecs.reduce(function(slots,spec){return slots.concat(spec[2]);},[]);
const shortcutAliases={
 ' ':'Space',Spacebar:'Space',Esc:'Escape',NumpadEnter:'Enter',Left:'ArrowLeft',Right:'ArrowRight',
 MediaTrackPrevious:'F7',MediaPreviousTrack:'F7',MediaRewind:'F7',
 MediaPlayPause:'F8',MediaTrackNext:'F9',MediaNextTrack:'F9',MediaFastForward:'F9'
};
const shortcutStorage='s2a-pilot-shortcuts-v1',DEFAULT_STOP_FADE_SECONDS=3;
let pilotShortcuts=defaultPilotShortcuts();
function defaultPilotShortcuts(){
 const keys={stopFadeSeconds:DEFAULT_STOP_FADE_SECONDS};
 shortcutSlots.forEach(function(slot){keys[slot[0]]=slot[1];});
 return keys;
}
function validFadeSeconds(seconds){
 return Number.isFinite(seconds)&&seconds>=.1&&seconds<=60;
}
function normalizeShortcutKey(key){
 if(typeof key!=='string')return '';
 if(Object.prototype.hasOwnProperty.call(shortcutAliases,key))return shortcutAliases[key];
 if(/^(?:F(?:[1-9]|1[0-9]|2[0-4])|Space|Enter|Escape|Arrow(?:Left|Right|Up|Down)|Home|End|PageUp|PageDown|Insert|Delete|Backspace)$/.test(key))return key;
 return key.length===1?(/[a-z]/.test(key)?key.toUpperCase():key):'';
}
try{
 const stored=JSON.parse(localStorage.getItem(shortcutStorage));
 if(stored&&shortcutSlots.every(function(slot){return normalizeShortcutKey(stored[slot[0]])===stored[slot[0]]&&!!stored[slot[0]];})){
  const keys=shortcutSlots.map(function(slot){return stored[slot[0]];});
  if(new Set(keys).size===keys.length){
   if(!validFadeSeconds(stored.stopFadeSeconds))stored.stopFadeSeconds=DEFAULT_STOP_FADE_SECONDS;
   delete stored.goFadeSeconds;
   pilotShortcuts=stored;
  }
 }
}catch(error){}
function shortcutLabel(key){
 const labels={Space:'Espace',Enter:'Entrée',Escape:'Échap',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓'};
 return labels[key]?tr(labels[key]):key;
}
function shortcutEventKey(event){
 return normalizeShortcutKey(event.key)||normalizeShortcutKey(event.code);
}
function shortcutSlot(key){
 const slot=shortcutSlots.find(function(row){return pilotShortcuts[row[0]]===key;});
 return slot&&slot[0];
}
function shortcutAction(key){
 const group=shortcutSpecs.find(function(spec){
  return spec[2].some(function(slot){return pilotShortcuts[slot[0]]===key;});
 });
 return group&&group[0];
}
function shortcutPressId(event,key){
 return event.code&&event.code!=='Unidentified'?event.code:key;
}
const shortcutDialog=$('shortcutDialog'),shortcutList=$('shortcutList'),shortcutStatus=$('shortcutStatus');
let capturingShortcut=null;
function renderShortcutSettings(){
 shortcutList.replaceChildren();
 shortcutSpecs.forEach(function(spec){
  const row=document.createElement('div'),label=document.createElement('span'),keys=document.createElement('div');
  label.textContent=tr(spec[1]);keys.className='shortcutKeys';
  spec[2].forEach(function(slot,index){
   const id=slot[0],button=document.createElement('button');
   button.type='button';button.dataset.shortcut=id;
   button.textContent=capturingShortcut===id?tr('Appuyez sur une touche…'):shortcutLabel(pilotShortcuts[id]);
   button.setAttribute('aria-label',label.textContent+' · '+(index+1)+' - '+button.textContent);
   button.setAttribute('aria-pressed',String(capturingShortcut===id));
   button.onclick=function(){
    capturingShortcut=capturingShortcut===id?null:id;
    shortcutStatus.textContent=capturingShortcut?tr('Appuyez sur la touche à attribuer. Cliquez de nouveau pour annuler.'):'';
    renderShortcutSettings();
    shortcutList.querySelector('[data-shortcut="'+id+'"]').focus();
   };
   keys.append(button);
  });
  row.append(label,keys);shortcutList.append(row);
  if(spec[0]==='stop')appendFadeSetting('stopFadeSeconds','Durée du fondu d’arrêt');
 });
}
function appendFadeSetting(setting,labelText){
 const row=document.createElement('div'),label=document.createElement('label'),controls=document.createElement('div');
 const input=document.createElement('input'),unit=document.createElement('span');
 label.htmlFor='shortcut-'+setting;label.textContent=tr(labelText);
 input.id=label.htmlFor;input.type='number';input.min='0.1';input.max='60';input.step='0.1';
 input.value=String(pilotShortcuts[setting]);
 unit.textContent=tr('s');
 unit.id=input.id+'-unit';input.setAttribute('aria-describedby',unit.id);
 controls.className='shortcutKeys fadeDurationKeys';
 input.onchange=function(){
  const seconds=Number(input.value);
  if(!validFadeSeconds(seconds)){
   input.value=String(pilotShortcuts[setting]);
   shortcutStatus.textContent=tr('Choisissez une durée de 0,1 à 60 secondes.');
   return;
  }
  pilotShortcuts[setting]=roundTenth(seconds);
  input.value=String(pilotShortcuts[setting]);
  shortcutStatus.textContent=savePilotShortcuts()?tr('Durée du fondu enregistrée.'):tr('Raccourcis modifiés pour cette session.');
 };
 controls.append(input,unit);row.append(label,controls);shortcutList.append(row);
}
function savePilotShortcuts(){
 try{localStorage.setItem(shortcutStorage,JSON.stringify(pilotShortcuts));return true;}
 catch(error){return false;}
}
function closeShortcutSettings(){
 capturingShortcut=null;shortcutDialog.close();$('shortcutSettingsButton').focus();
}
$('shortcutSettingsButton').onclick=function(){
 cancelCueShortcut();capturingShortcut=null;shortcutStatus.textContent='';
 renderShortcutSettings();$('pilotGoGuard').value=String(goGuardMs);shortcutDialog.showModal();refreshPilotOutputs();
};
$('pilotGoGuard').onchange=function(){
 const value=this.valueAsNumber;
 if(this.validity.valid&&Number.isInteger(value)){
  goGuardMs=value;
  $('pilotGoGuardStatus').textContent=writeLocalSetting(goGuardStorage,value)?'':tr('Réglage conservé pour cette session.');
 }
 this.value=String(goGuardMs);
};
$('shortcutClose').onclick=closeShortcutSettings;
$('shortcutReset').onclick=function(){
 capturingShortcut=null;pilotShortcuts=defaultPilotShortcuts();
 shortcutStatus.textContent=savePilotShortcuts()?tr('Raccourcis par défaut rétablis.'):tr('Raccourcis modifiés pour cette session.');
 renderShortcutSettings();updateManualStatus();
};
window.addEventListener('s2a-language-change',function(){
 if(shortcutDialog.open)renderShortcutSettings();
});
function captureShortcut(event){
 if(!shortcutDialog.open)return false;
 if(!capturingShortcut){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeShortcutSettings();}
  return true;
 }
 // Tab still reaches the reset and close controls during assignment.
 if(event.key==='Tab'||event.isComposing||(event.target instanceof Element&&event.target.closest('.fadeDurationKeys')))return true;
 event.preventDefault();event.stopPropagation();
 if(event.repeat)return true;
 const key=shortcutEventKey(event);
 if(!key||shortcutModified(event)){
  shortcutStatus.textContent=tr('Choisissez une touche seule, sans modificateur.');
  return true;
 }
 const used=shortcutSlot(key);
 if(used&&used!==capturingShortcut){
  shortcutStatus.textContent=tr('Cette touche est déjà attribuée.');
  return true;
 }
 const id=capturingShortcut;
 pilotShortcuts[id]=key;capturingShortcut=null;
 shortcutStatus.textContent=savePilotShortcuts()?tr('Raccourci enregistré.'):tr('Raccourcis modifiés pour cette session.');
 renderShortcutSettings();updateManualStatus();
 shortcutList.querySelector('[data-shortcut="'+id+'"]').focus();
 return true;
}
let heldCueShortcut=null,shortcutSeekPending=false;
function shortcutInput(target){
 return target instanceof Element&&target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
}
function shortcutModified(event){
 return event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey;
}
function pilotSeekTarget(time){
 const target=clampTime(time),parent=conductType==='manual'&&manualCurrent();
 return parent?parent.time+manualSeekOffset(parent,target):target;
}
function seekPilotBy(direction,seconds){
 if(shortcutSeekPending||spaceTransportPending||escapeFading||manualPending||manualPausePending)return;
 const step=Number.isFinite(seconds)&&seconds>0?seconds:CUE_SEEK_SECONDS;
 const current=currentTransportTime(),target=pilotSeekTarget(current+direction*step);
 if(Math.abs(target-current)<.001)return;
 shortcutSeekPending=true;
 seekTransport(target).catch(console.warn).finally(function(){shortcutSeekPending=false;});
}
function cancelCueShortcut(){
 if(!heldCueShortcut)return;
 clearTimeout(heldCueShortcut.timer);
 clearInterval(heldCueShortcut.interval);
 heldCueShortcut=null;
}
function canUseCueShortcut(hold){
 return !document.hidden&&!pilotDialogOpen()&&(typeof hold.key!=='string'||!shortcutInput(document.activeElement))&&hold.locked===locked&&hold.conduct===conductType&&hold.project===copilotProjectEpoch;
}
function startCueShortcut(key,direction){
 if(heldCueShortcut&&heldCueShortcut.key===key)return heldCueShortcut;
 cancelCueShortcut();
 const hold={key:key,direction:direction,locked:locked,conduct:conductType,project:copilotProjectEpoch,long:false,timer:0,interval:0};
 heldCueShortcut=hold;
 function advance(){
  if(!canUseCueShortcut(hold)){cancelCueShortcut();return;}
  seekPilotBy(direction);
 }
 hold.timer=setTimeout(function(){
  if(!canUseCueShortcut(hold)){cancelCueShortcut();return;}
  hold.long=true;
  advance();
  hold.interval=setInterval(advance,CUE_SEEK_INTERVAL);
 },CUE_HOLD_DELAY);
 return hold;
}
function editCuePreviewButton(target){
 if(locked)return null;
 const editor=target?.closest('.mediaEditor');
 if(editor)return editor.querySelector('.mediaPreviewToggle');
 const row=target?.closest('.cueAccordion')||[...cueList.children].find(item=>item.dataset.cueId===expandedCueId);
 if(!row?.classList.contains('expanded')||row.hidden)return null;
 const audio=row.querySelector('.mediaEditor audio')?.closest('.mediaEditor');
 return (audio||row).querySelector('.mediaPreviewToggle');
}
document.addEventListener('keydown',function(event){
 if(captureShortcut(event)||event.defaultPrevented||shortcutModified(event))return;
 const key=shortcutEventKey(event),action=shortcutAction(key);
 const target=event.target instanceof Element?event.target:document.activeElement;
 if(!pilotDialogOpen()&&!shortcutInput(target)){
  if(manualEditSequenceVisible()&&!target?.closest('.mediaEditor')&&(key==='ArrowLeft'||key==='ArrowRight')){
   event.preventDefault();event.stopPropagation();
   if(!event.repeat)navigateCue(key==='ArrowLeft'?-1:1);
   return;
  }
  const control=target?.closest('button,a,label,summary,[role="button"]');
  const transportTarget=!control||control===playBtn||control.matches('.goSequenceBlock,.goWaveMarker')||
   (key==='Space'&&control.classList.contains('cueSummary'));
  if(!locked&&transportTarget&&(key==='Space'||key==='Enter')){
   event.preventDefault();event.stopPropagation();
   if(event.repeat)return;
   const editor=target?.closest('.mediaEditor'),inCue=target?.closest('.cueAccordion');
   const preview=key==='Space'&&(editor||inCue)?editCuePreviewButton(target):null;
   if(preview&&!preview.disabled){preview.click();return;}
   if(key==='Enter')playEditFromCue(editTimelinePosition(editor)).catch(reportTransportError);
   else if(manualEditSequenceVisible())toggleEditTimeline().catch(reportTransportError);
   else toggleTransportGuarded();
   return;
  }
 }
 const mediaAction=event.key==='MediaPlay'?'play':event.key==='MediaPause'?'pause':action==='play'&&key==='F8'?'toggle':null;
 if(mediaAction&&document.querySelector('.helpVideoOverlay:not([hidden]) video')){
  event.preventDefault();event.stopPropagation();
  if(!event.repeat)routePilotMediaAction(mediaAction);
  return;
 }
 if((!action&&!mediaAction)||pilotDialogOpen())return;
 const emergency=action==='stop'&&key==='Escape'&&!(target&&target.closest('select'));
 if(shortcutInput(target)&&!emergency)return;
 const manual=conductType==='manual';
 if(action==='go'&&!manual)return;
 // Preserve normal activation of other controls with Space and Enter.
 if(key==='Space'||key==='Enter'){
  const control=target&&target.closest('button,a,label,summary,[role="button"]');
  if(control&&control!==playBtn&&!control.matches('.showOverviewRow'))return;
  if(target&&target.closest('.mediaEditor [role="slider"]'))return;
 }
 event.preventDefault();event.stopPropagation();
 if(event.repeat)return;
 if(action==='next'||action==='previous')startCueShortcut(shortcutPressId(event,key),action==='next'?1:-1);
 else if(action==='stop')fadeOutAndStop();
 else if(mediaAction)routePilotMediaAction(mediaAction);
 else if(action==='go'||!manual)toggleTransportGuarded();
 else if(manualEditSequenceVisible()&&action==='play')toggleEditTimeline().catch(reportTransportError);
 else if(key==='Space'&&locked&&!transportPlaying&&!manualCurrentID&&manualCompletedID&&
   !manualPrimaryAudio(cues.find(cue=>cue.id===manualCompletedID))?.autoNext&&manualNextMusic())toggleTransportGuarded();
 else toggleManualPause().catch(reportTransportError);
},true);
document.addEventListener('keyup',function(event){
 const hold=heldCueShortcut;
 if(!hold||shortcutPressId(event,shortcutEventKey(event))!==hold.key)return;
 event.preventDefault();
 cancelCueShortcut();
 if(!hold.long&&!shortcutModified(event)&&canUseCueShortcut(hold))navigateCue(hold.direction);
},true);
window.addEventListener('blur',cancelCueShortcut);
document.addEventListener('visibilitychange',cancelCueShortcut);
playBtn.addEventListener('click',function(){
 if(conductType==='manual'||!transportPlaying)toggleTransportGuarded();
});
restartBtn.addEventListener('click',()=>{pilotOscStartEpoch=null;goWaveInsertionTime=null;resetManualRuntime();pauseTransport();stopAllRuntimeMedia();transportTime=transportBase=lastTransportTime=0;if(manualEditSequenceVisible())centerGoWaveTime(0);for(const p of preparedMedia.values())try{p.el.pause();p.el.currentTime=Number(p.item.action.inPoint)||0;}catch{}updateTransport();});function addEditorCue(time,kind=null){
 if(locked)return;
 const c={...newBaseCue(),time:roundTenth(time),name:`Cue ${cues.length+1}`};
 if(kind){
  const roots=manualMusics(),parent=manualRootAtTime(c.time,roots);
  if(kind==='child'){
   if(!parent)return;
   c.parentMusicId=parent.id;
   c.relativeTime=roundTenth(c.time-parent.time);
  }else{
   const next=roots.find(root=>root.time>c.time);
   const end=Math.min(next?.time??Infinity,parent?parent.time+manualPlannedDuration(parent):Infinity);
   c.manualKind='silent';
   c.manualDuration=Math.max(.1,roundTenth(Math.min(180,end-c.time)));
  }
 }else if(conductType==='manual')attachManualEditCue(c);
 goWaveInsertionTime=null;
 pushHistory();
 cues.push(c);expandedCueId=c.id;renderCues();
 if(!manualEditSequenceVisible())centerEditedCue(c.id);
 scheduleAutosave();
}
function requestEditorCue(){
 if(locked)return;
 const insertion=currentTransportTime();
 if(!manualEditSequenceVisible()){addEditorCue(insertion);return;}
 const dialog=$('waveCueDialog');
 if(dialog.open)return;
 const parent=manualRootAtTime(insertion),epoch=copilotProjectEpoch;
 const main=$('waveCueMain'),child=$('waveCueChild');
 $('waveCueTime').textContent=fmt(insertion);
 $('waveCueContext').textContent=parent
  ?tr('Sous-Cue du numéro « {name} ».',{name:parent.name})
  :tr('Une sous-Cue doit être placée dans un numéro.');
 child.textContent=tr('waveCue.choice.child');
 child.disabled=!parent;
 function choose(kind){
  dialog.close();
  if(manualEditSequenceVisible()&&epoch===copilotProjectEpoch)addEditorCue(insertion,kind);
 }
 main.onclick=()=>choose('main');child.onclick=()=>choose('child');
 $('waveCueCancel').onclick=()=>dialog.close();
 cancelCueShortcut();
 dialog.showModal();
 (parent?child:main).focus();
}
addCueBtn.addEventListener('click',requestEditorCue);
let showScrubPointer=null;
function startShowScrub(event){
 if(showScrubPointer!==null||manualPending||manualPausePending||escapeFading||manualTimelinePan)return;
 const pointer=event.pointerId,rect=timeline.getBoundingClientRect();
 const startX=event.clientX,startY=event.clientY,duration=projectDuration(),project=copilotProjectEpoch;
 let dragging=false,lastSeek=-Infinity,lastTarget=null;
 showScrubPointer=pointer;
 timeline.focus({preventScroll:true});
 function seekAt(e,commit=false){
  const x=e.clientX-rect.left;
  const nearby=conductType==='manual'&&!manualCurrentID&&manualMusics().find(c=>Math.abs(c.time/duration*rect.width-x)<=7);
  const target=nearby?nearby.time:Math.max(0,Math.min(duration,x/rect.width*duration));
  if(!locked||project!==copilotProjectEpoch)return;
  if(lastTarget===target&&(!commit||Math.abs(currentTransportTime()-target)<.03))return;
  lastSeek=performance.now();lastTarget=target;
  if(!transportPlaying&&conductType!=='manual')transportAcceptedAt=-Infinity;
  seekTransport(target).catch(reportTransportError);
 }
 function move(e){
  if(e.pointerId!==pointer||manualTimelinePan)return;
  const dx=Math.abs(e.clientX-startX),dy=Math.abs(e.clientY-startY);
  if(!dragging&&(dx<3||(e.pointerType==='touch'&&dy>dx)))return;
  dragging=true;
  e.preventDefault();
  // Leave the decoder time to settle during a drag, then apply the exact drop position.
  if(performance.now()-lastSeek>=75){
   if(manualPanOrigin)manualPanOrigin.sought=true;
   seekAt(e);
  }
 }
 function end(e){
  if(e.pointerId!==pointer)return;
  window.removeEventListener('pointermove',move);
  window.removeEventListener('pointerup',end);
  window.removeEventListener('pointercancel',end);
  timeline.removeEventListener('lostpointercapture',end);
  showScrubPointer=null;
  timelineFollowGesture=false;
  const tap=Math.abs(e.clientX-startX)<5&&Math.abs(e.clientY-startY)<5;
  if(!manualTimelinePan&&e.type==='pointerup'&&(dragging||tap))seekAt(e,true);
  // On cancellation, keep the last applied position. The two-finger pan has its own rollback.
  requestAnimationFrame(()=>followTimelinePlayhead(currentTransportTime()));
 }
 window.addEventListener('pointermove',move,{passive:false});
 window.addEventListener('pointerup',end);
 window.addEventListener('pointercancel',end);
 timeline.addEventListener('lostpointercapture',end);
 timeline.setPointerCapture(pointer);
}

let generalScrubGeneration=0;
timeline.addEventListener('pointerdown',e=>{
 if(e.button!==0||e.isPrimary===false||(!locked&&e.target.closest('.marker')))return;
 if(locked){startShowScrub(e);return;}
 if(conductType==='manual')return;
 const gesture=++generalScrubGeneration;
 const panOnly=conductType!=='manual'&&e.pointerType==='touch'&&generalTimelineZoom>1&&e.target!==playhead;
 const startX=e.clientX,startY=e.clientY,rect=timeline.getBoundingClientRect(),duration=projectDuration(),original=currentTransportTime(),wasPlaying=transportPlaying;
 let dragging=false;timeline.setPointerCapture(e.pointerId);
 const preview=ev=>{if(panOnly)return;if(!dragging&&((Math.abs(ev.clientX-startX)<3&&Math.abs(ev.clientY-startY)<3)||(ev.pointerType==='touch'&&Math.abs(ev.clientY-startY)>Math.abs(ev.clientX-startX))))return;
  if(!dragging){dragging=true;pauseTransport();}ev.preventDefault();transportTime=Math.max(0,Math.min(duration,(ev.clientX-rect.left)/rect.width*duration));updateTransport();};
 const finish=ev=>{timeline.removeEventListener('pointermove',preview);timeline.removeEventListener('pointerup',finish);timeline.removeEventListener('pointercancel',finish);timeline.removeEventListener('lostpointercapture',finish);
  const tap=Math.abs(ev.clientX-startX)<5&&Math.abs(ev.clientY-startY)<5;
  if(!dragging&&(!tap||ev.type!=='pointerup'))return;
  if(!dragging)pauseTransport();
  playhead.focus({preventScroll:true});
  const target=ev.type==='pointerup'?Math.max(0,Math.min(duration,(ev.clientX-rect.left)/rect.width*duration)):original;
  seekTransport(target).then(()=>{if(wasPlaying&&gesture===generalScrubGeneration)return playTransport();}).catch(console.warn);
 };
 timeline.addEventListener('pointermove',preview);timeline.addEventListener('pointerup',finish);timeline.addEventListener('pointercancel',finish);timeline.addEventListener('lostpointercapture',finish);
});
playhead.tabIndex=0;playhead.setAttribute('role','slider');playhead.setAttribute('aria-label',tr('Position dans la conduite'));
function navigateTransportWithKeyboard(e){
 if(e.key!=='Home'&&e.key!=='End')return;
 e.preventDefault();seekTransport(e.key==='Home'?0:projectDuration()).catch(console.warn);
}
playhead.addEventListener('keydown',navigateTransportWithKeyboard);timeline.addEventListener('keydown',e=>{if(locked&&e.target===timeline)navigateTransportWithKeyboard(e);});
editModeBtn.addEventListener('click',()=>{if(locked){locked=false;applyLockState();if(conductType==='manual')playBtn.focus({preventScroll:true});}});showModeBtn.addEventListener('click',()=>{if(!locked){locked=true;applyLockState();if(conductType==='manual')playBtn.focus({preventScroll:true});}});undoBtn.addEventListener('click',undoEdit);redoBtn.addEventListener('click',redoEdit);document.addEventListener('keydown',e=>{const mod=e.metaKey||e.ctrlKey;if(!mod||e.key.toLowerCase()!=='z'||locked)return;e.preventDefault();e.shiftKey?redoEdit():undoEdit();});
showTitle.addEventListener('input',()=>{scheduleAutosave();});videoOutputBtn.addEventListener('click',()=>videoOutputWindow&&!videoOutputWindow.closed?closeVideoOutput():openVideoOutput());
$('importVisualNumbers').onclick=()=>$('visualNumberFiles').click();
$('visualNumberFiles').onchange=event=>{
 const input=event.currentTarget,files=Array.from(input.files);
 input.value='';
 appendVisualNumbers(files).catch(error=>alert(tr('Impossible d’ajouter les numéros : ')+error.message));
};
openProjectBtn.addEventListener('click',()=>projectFile.click());projectFile.addEventListener('change',async()=>{const f=projectFile.files?.[0];if(!f)return;try{pauseTransport();await importPackage(f);}catch(e){window.S2APilotDiagnostics?.report('open',e);console.error(e);alert(tr('Impossible d’ouvrir le projet : ')+(e.message||e));}finally{projectFile.value='';}});
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
function pdfUnicodeHex(text){return String(text).split('').map(char=>char.charCodeAt(0).toString(16).padStart(4,'0')).join('');}
function buildPdfDocument(pages){
  const catalogNum=1,pagesNum=2,fontNum=3,boldNum=4;let nextObj=5;
  for(const page of pages){
   page.pageObj=nextObj++;page.contentObj=nextObj++;
   for(const im of page.images){im.obj=nextObj++;if(im.alpha)im.alphaObj=nextObj++;}
  }
  const fields=[];
  for(const page of pages)for(const field of page.checkboxes||[]){field.obj=nextObj++;fields.push(field);}
  const objects=new Map();
  let acro='';
  if(fields.length){
   const off=nextObj++,on=nextObj++;
   const appearance=(id,mark)=>{
    const content=asciiBytes('1 1 1 rg 0 0 14 14 re f .30 .37 .49 RG 1 w .6 .6 12.8 12.8 re S '+mark);
    objects.set(id,concatBytes([asciiBytes(`<< /Type /XObject /Subtype /Form /BBox [0 0 14 14] /Resources << >> /Length ${content.length} >>\nstream\n`),content,asciiBytes('\nendstream')]));
   };
   appearance(off,'');appearance(on,'.27 .17 .55 RG 1.8 w 3 7 m 6 4 l 11 10 l S');
   acro=` /AcroForm << /Fields [${fields.map(field=>field.obj+' 0 R').join(' ')}] /NeedAppearances false >>`;
   for(const page of pages)for(const field of page.checkboxes||[]){
    const {x,y}=field,value=field.checked?'Yes':'Off';
    objects.set(field.obj,asciiBytes(`<< /Type /Annot /Subtype /Widget /FT /Btn /F 4 /T (${field.name||'item-'+field.obj}) /TU <FEFF${pdfUnicodeHex(field.label)}> /Rect [${x} ${y} ${x+14} ${y+14}] /P ${page.pageObj} 0 R /V /${value} /AS /${value} /AP << /N << /Off ${off} 0 R /Yes ${on} 0 R >> >> >>`));
   }
  }
  objects.set(catalogNum,asciiBytes(`<< /Type /Catalog /Pages ${pagesNum} 0 R${acro} >>`));
  objects.set(pagesNum,asciiBytes(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(p=>`${p.pageObj} 0 R`).join(' ')}] >>`));
  objects.set(fontNum,asciiBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  objects.set(boldNum,asciiBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  for(const page of pages){
    const xobjs=page.images.length?` /XObject << ${page.images.map((im,i)=>`/Im${i+1} ${im.obj} 0 R`).join(' ')} >>`:'';
    const annots=page.checkboxes?.length?` /Annots [${page.checkboxes.map(field=>field.obj+' 0 R').join(' ')}]`:'';
    objects.set(page.pageObj,asciiBytes(`<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontNum} 0 R /F2 ${boldNum} 0 R >>${xobjs} >> /Contents ${page.contentObj} 0 R${annots} >>`));
    const content=asciiBytes(page.content);
    objects.set(page.contentObj,concatBytes([asciiBytes(`<< /Length ${content.length} >>\nstream\n`),content,asciiBytes('\nendstream')]));
    for(const im of page.images){
      const imageHeader=`<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /BitsPerComponent 8`;
      const imageStream=(bytes,properties)=>concatBytes([asciiBytes(`${imageHeader} ${properties} /Length ${bytes.length} >>\nstream\n`),bytes,asciiBytes('\nendstream')]);
      const format=im.alpha?`/FlateDecode /SMask ${im.alphaObj} 0 R`:'/DCTDecode';
      objects.set(im.obj,imageStream(im.bytes,`/ColorSpace /DeviceRGB /Filter ${format}`));
      if(im.alpha)objects.set(im.alphaObj,imageStream(im.alpha,'/ColorSpace /DeviceGray /Filter /FlateDecode'));
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
async function loadTechnicalHeaderImage(){
 if(location.protocol==='file:'&&!window.S2ATechnicalHeader)await loadClassicScript('./technical-header-data.js',()=>typeof window.S2ATechnicalHeader==='string');
 if(!technicalHeaderImagePromise)technicalHeaderImagePromise=loadTechnicalHeaderImageFromSource(location.protocol==='file:'?window.S2ATechnicalHeader:'./assets/conduite-header.webp').catch(error=>{technicalHeaderImagePromise=null;throw error;});
 return technicalHeaderImagePromise;
}
function loadTechnicalHeaderImageFromSource(source){
 return new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>{try{
   const canvas=document.createElement('canvas');canvas.width=1190;canvas.height=200;
   const ctx=canvas.getContext('2d'),scale=Math.max(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);
   const sourceWidth=canvas.width/scale,sourceHeight=canvas.height/scale;
   const sx=(image.naturalWidth-sourceWidth)/2,sy=Math.max(0,Math.min(image.naturalHeight-sourceHeight,image.naturalHeight*.42-sourceHeight/2));
   ctx.drawImage(image,sx,sy,sourceWidth,sourceHeight,0,0,canvas.width,canvas.height);
   const shade=ctx.createLinearGradient(0,0,canvas.width,0);shade.addColorStop(0,'rgba(2,8,24,.62)');shade.addColorStop(.65,'rgba(2,8,24,.32)');shade.addColorStop(1,'rgba(2,8,24,.12)');ctx.fillStyle=shade;ctx.fillRect(0,0,canvas.width,canvas.height);
   const bottom=ctx.createLinearGradient(0,120,0,200);bottom.addColorStop(0,'rgba(2,8,24,0)');bottom.addColorStop(1,'rgba(2,8,24,.45)');ctx.fillStyle=bottom;ctx.fillRect(0,120,canvas.width,80);
   const binary=atob(canvas.toDataURL('image/jpeg',.9).split(',')[1]),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));resolve({bytes,width:canvas.width,height:canvas.height});
  }catch(error){reject(error);}};
  image.onerror=()=>reject(new Error(tr('Le visuel de l’en-tête est indisponible.')));image.src=source;
 });
}
async function loadTechnicalQrImage(){
 if(!window.S2ATechnicalQr)await loadClassicScript('./technical-qr-data.js',()=>typeof window.S2ATechnicalQr?.dataUrl==='string');
 const qr=window.S2ATechnicalQr;return {bytes:dataUrlToBytes(qr.dataUrl),width:qr.width,height:qr.height};
}
function pdfHeaderTitleLines(title){
 const ctx=document.createElement('canvas').getContext('2d');ctx.font='bold 20px Arial';
 const lines=[];let line='';
 for(const word of title.split(/\s+/)){
  const trial=line?line+' '+word:word;
  if(line&&ctx.measureText(trial).width>445){lines.push(line);line='';}
  for(const char of word){if(ctx.measureText(line+char).width>445){lines.push(line);line='';}line+=char;}
  line+=' ';
 }
 if(line.trim())lines.push(line.trim());return lines.slice(0,2).map(part=>part.trim());
}
function pdfAccentFill(manual=conductType==='manual'){return manual?pdfFill(.44,.24,.68):pdfFill(.14,.40,.76);}
function pdfPageHeader(page,title,ordered,pageIndex,headerImage,qrImage,manual=conductType==='manual',filterLabel=''){
 page.images.push({...headerImage});
 page.content+=`q 595 0 0 100 0 742 cm /Im1 Do Q\n`;
 page.images.push({...qrImage});page.content+='q\n'+pdfRoundedRect(495,750,84,84,6).replace('h f\n','h W n\n')+`q 84 0 0 84 495 750 cm /Im2 Do Q\nQ\n`;
 page.content+=pdfAccentFill(manual)+pdfRect(0,742,595,3,true);
 page.content+=(manual?pdfFill(.86,.77,1):pdfFill(.69,.85,1))+pdfText(36,811,9,tr('CONDUITE TECHNIQUE'),true);
 const titleLines=pdfHeaderTitleLines(title);let ty=787;
 for(const line of titleLines){page.content+=pdfFill(1,1,1)+pdfText(36,ty,20,line,true);ty-=22;}
 const lastTime=ordered.length?fmt(ordered[ordered.length-1].time):'00:00.0',counts=technicalMediaCounts(ordered);
 const media=tr('{count} fichier(s) audio',{count:counts.audio})+(counts.video?' • '+tr('{count} fichier(s) vidéo',{count:counts.video}):'');
 page.content+=(manual?pdfFill(.92,.87,.98):pdfFill(.83,.90,.98))+pdfText(36,751,8,`${ordered.length} Cue${ordered.length>1?'s':''} • ${tr("Dernière Cue :")} ${lastTime} • ${media}`);
 page.content+=pdfFill(.34,.38,.45)+pdfText(36,731,8,tr('Temps écoulé (temps restant avant la fin)'));
 if(filterLabel)page.content+=pdfAccentFill(manual)+pdfText(36,715,8,filterLabel,true);
 if(pageIndex>0)page.content+=(manual?pdfFill(.86,.77,1):pdfFill(.69,.85,1))+pdfText(438,811,8,tr('PAGE')+' '+(pageIndex+1),true);
}
function pdfCueLayout(entry,idx){
 const cue=entry.cue;
 const names=wrapPdfText(cue.name||`Cue ${idx+1}`,36);
 const descriptions=wrapPdfText(cue.description||tr('Aucune description'),52);
 const media=(cue.mediaActions||[]).flatMap(a=>wrapPdfText(a.kind==='stopAll'?`${tr('ARRÊT TOUS LES MÉDIAS')} • ${a.transition==='fade'?`${tr("FONDU")} ${Number(a.fadeDuration||3).toFixed(1)} s`:'CUT'}`:`${a.kind==='video'?tr('VIDÉO'):'AUDIO'} • ${a.name} • IN ${fmt(a.inPoint||0)} / OUT ${fmt(a.outPoint||a.duration||0)}${mediaLoops(a)?' • LOOP':''}${a.kind==='video'?` • ${a.muted?tr('MUETTE'):tr('SON ACTIF')}`:` • ${a.transition==='fade'?`${tr("FONDU")} ${Number(a.fadeDuration||3).toFixed(1)} s`:'CUT'}`}`,58));
 return {names,descriptions,media};
}
function pdfCueBlock(page,entry,idx,top,layout,context={manual:conductType==='manual',duration:projectDuration()}){
 const {cue,image}=entry,{names,descriptions,media}=layout,{manual,duration}=context;
 const blockH=Math.max(122,28+names.length*12+descriptions.length*10+(media.length?14+media.length*9:0));
 const bottom=top-blockH,child=manual&&(entry.child??isManualInternalCue(cue)),inset=child?24:0;
 if(child&&entry.showBranch!==false){
  const last=entry.lastSibling??(()=>{const siblings=manualChildren(cues.find(c=>c.id===cue.parentMusicId));return siblings[siblings.length-1]?.id===cue.id;})();
  const junction=top-26,trunkBottom=last?junction:bottom-10;
  page.content+=pdfFill(.66,.60,.75)+pdfRect(44,trunkBottom,1.5,top+10-trunkBottom,true)+pdfRect(44,junction,16,1.5,true);
 }
 page.content+=pdfFill(.965,.972,.982)+pdfRoundedRect(36+inset,bottom,523-inset,blockH-6,9);
 page.content+=pdfAccentFill(manual)+pdfRoundedRect(44+inset,bottom+12,3,blockH-30,1.5);
 page.content+=pdfFill(.10,.12,.16)+pdfText(52+inset,top-22,8,`CUE ${entry.number??String(idx+1).padStart(2,'0')}`,true);
 page.content+=pdfAccentFill(manual)+pdfText(52+inset,top-40,12,manual?(isManualInternalCue(cue)?'+'+fmt(cue.relativeTime):'GO'):fmt(cue.time),true);
 if(manual)page.content+=pdfAccentFill(manual)+pdfText(52+inset,top-54,7,child?(cue.waitForGo===true?'Wait':'Next'):'Go',true);
 if(child&&entry.showBranch===false)page.content+=pdfFill(.34,.38,.45)+pdfText(52+inset,top-68,8,fmt(cue.time));
 if(!manual)page.content+=pdfFill(.34,.38,.45)+pdfText(52+inset,top-56,9,`(-${fmt(Math.max(0,duration-cue.time))})`);
 let ty=top-20;
 page.content+=pdfFill(.07,.09,.13);for(const line of names){page.content+=pdfText(137+inset,ty,10,line,true);ty-=12;}
 ty-=3;page.content+=pdfFill(.34,.38,.45);for(const line of descriptions){page.content+=pdfText(137+inset,ty,8,line);ty-=10;}
 if(media.length){ty-=3;page.content+=pdfAccentFill(manual)+pdfText(137+inset,ty,7,tr('MÉDIAS'),true);ty-=11;page.content+=pdfFill(.25,.29,.35);for(const line of media){page.content+=pdfText(137+inset,ty,7,line);ty-=9;}}
 if(image){const imIndex=page.images.length+1;page.images.push({...image});const iw=142,ih=79.9,ix=401,iy=bottom+(blockH-6-ih)/2;page.content+=pdfFill(.05,.06,.08)+pdfRoundedRect(ix-3,iy-3,iw+6,ih+6,5);page.content+=`q ${iw} 0 0 ${ih.toFixed(1)} ${ix} ${iy.toFixed(1)} cm /Im${imIndex} Do Q\n`;}
 return blockH+10;
}
function pdfPageFooter(page,pageIndex,pageCount,manual=conductType==='manual'){
 page.content+=pdfAccentFill(manual)+pdfRect(0,0,595,48,true);
 page.content+=pdfFill(1,1,1)+pdfText(36,30,7,tr('Toute reproduction non autorisée par l’artiste est interdite.'));
 page.content+=pdfText(36,15,7,tr('Créé avec S2A Pilot - S2A Production')+' - www.s2a-production.com');
 page.content+=pdfText(500,15,7,`Page ${pageIndex+1} / ${pageCount}`);
}
async function buildTechnicalPdfBytes(selected=null){
 ensureBaseCueInvariant();syncManualLinks();normalizeCueOrderAndNames();invalidateComputationCaches();
 const title=(showTitle.value||'Conduite').trim().normalize('NFC')||'Conduite',manual=conductType==='manual',duration=projectDuration(),all=cueViewOrder(),prepared=[];
 const ordered=clone(all.filter(cue=>cueMatchesTypes(cue,selected))),exportedIds=new Set(ordered.map(cue=>cue.id));
 const filterLabel=selected?tr('Types exportés')+' - '+cueTypes().filter(type=>selected.has(type.id)).map(type=>type.name).join(', '):'';
 const printedFilter=filterLabel.length>92?filterLabel.slice(0,89)+'…':filterLabel;
 const indices=new Map(all.map((cue,index)=>[cue.id,index+1]));
 // Capture all editable data and hierarchy before the first asynchronous image conversion.
 const snapshot=ordered.map(cue=>{
  const child=manual&&isManualInternalCue(cue),siblings=child?manualChildren(cues.find(c=>c.id===cue.parentMusicId)).filter(sibling=>exportedIds.has(sibling.id)):[];
  return {
   number:manual?cueViewNumber(cue):String(indices.get(cue.id)).padStart(2,'0'),
   child,showBranch:!child||exportedIds.has(cue.parentMusicId),lastSibling:child&&siblings[siblings.length-1]?.id===cue.id,
   cue:{...cue,name:String(cue.name||'').normalize('NFC'),description:cueDescriptionText(cue,selected).normalize('NFC')}
  };
 });
 for(const entry of snapshot)prepared.push({...entry,image:await cueImageToJpeg(entry.cue.imageDataUrl)});
 const firstVisual=prepared.find(entry=>entry.image);
 const headerImage=firstVisual?await loadTechnicalHeaderImageFromSource(firstVisual.cue.imageDataUrl):await loadTechnicalHeaderImage(),qrImage=await loadTechnicalQrImage(),pages=[];let page=null,y=0,count=0;
 function newPage(){page={content:'',images:[]};pages.push(page);pdfPageHeader(page,manual?title+' - '+tr('Spectacle'):title,ordered,pages.length-1,headerImage,qrImage,manual,printedFilter);y=printedFilter?704:720;count=0;}
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
   chunks.push(part);y-=pdfCueBlock(page,entry,idx,y,part,{manual,duration});count++;
   if(names.length||descriptions.length||media.length)newPage();
  }while(names.length||descriptions.length||media.length);
 }
 for(let i=0;i<pages.length;i++)pdfPageFooter(pages[i],i,pages.length,manual);
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
async function generateTechnicalPdf(selected){
 const label=$('toolboxConductLabel'),old=label.textContent,generation=++pdfPreviewGeneration;pdfTechBtn.disabled=true;label.textContent=tr('Création de la conduite…');
 try{
  const {bytes,title,pages}=await buildTechnicalPdfBytes(selected);
  if(generation!==pdfPreviewGeneration)return;
  if(pdfPreviewDispose)pdfPreviewDispose();if(pdfPreviewUrl)URL.revokeObjectURL(pdfPreviewUrl);
  pdfPreviewUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const link=$('pdfPreviewDownload');link.href=pdfPreviewUrl;link.download=`${safeFileName(title)}-conduite-technique.pdf`;
  $('pdfPreviewTitle').textContent=`${tr("Conduite technique —")} ${title}`;$('pdfPreviewDialog').showModal();
  const zoom=$('pdfPreviewDialog').querySelector('.pdfPreviewZoom');zoom.hidden=false;
  try{
   const preview=await loadTechnicalPreview();if(generation!==pdfPreviewGeneration)return;
   pdfPreviewDispose=preview.mountTechnicalPreview(pages,title,{
    container:$('pdfPreviewPages'),minus:$('pdfPreviewZoomOut'),plus:$('pdfPreviewZoomIn'),label:$('pdfPreviewZoomLabel'),fit:$('pdfPreviewFit')
   });
  }catch(previewError){
   if(generation!==pdfPreviewGeneration)return;
   zoom.hidden=true;const message=document.createElement('p');message.textContent=tr('L’aperçu est indisponible. Votre PDF est prêt : utilisez Télécharger.');message.setAttribute('role','status');$('pdfPreviewPages').replaceChildren(message);console.warn('PDF preview unavailable; PDF download remains available.');
  }
 }catch(err){window.S2APilotDiagnostics?.report('pdf',err);closePdfPreview();console.error(err);alert(tr('Impossible de générer la conduite PDF : ')+(err?.message||err));}
 finally{pdfTechBtn.disabled=false;label.textContent=old;}
}
$('pdfPreviewClose').addEventListener('click',closePdfPreview);
$('pdfPreviewDialog').addEventListener('cancel',event=>{event.preventDefault();closePdfPreview();});
function openPdfTypeFilter(){
 const dialog=$('pdfTypeDialog'),choices=$('pdfTypeChoices'),apply=$('pdfTypeApply'),epoch=copilotProjectEpoch,types=cueTypes();
 choices.replaceChildren();
 const selection=()=>new Set(Array.from(choices.querySelectorAll('input:checked'),input=>input.value));
 function update(){
  const ids=selection();
  const count=cues.filter(cue=>cueMatchesTypes(cue,ids)).length;
  $('pdfTypeCount').textContent=count+' Cue'+(count===1?'':'s');
  apply.disabled=!ids.size||(!count&&ids.size!==types.length);
 }
 for(const type of types){
  const label=document.createElement('label'),input=document.createElement('input');
  input.type='checkbox';input.value=type.id;input.checked=true;input.onchange=update;
  label.append(input,cueTypeBadge(type));choices.append(label);
 }
 $('pdfTypeAll').onclick=()=>{for(const input of choices.querySelectorAll('input'))input.checked=true;update();};
 apply.onclick=()=>{
  const ids=selection();dialog.close();
  if(epoch===copilotProjectEpoch)generateTechnicalPdf(ids.size===types.length?null:ids);
 };
 update();dialog.showModal();
}
$('pdfTypeClose').onclick=()=>$('pdfTypeDialog').close();
pdfTechBtn.addEventListener('click',()=>{$('pilotToolboxDialog').close();openPdfTypeFilter();});


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
    '<strong>'+tr('Installation :')+'</strong><p style="margin-bottom:0">' +
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
    let registration;
    try{
      registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
    }catch(error){
      window.S2APilotDiagnostics?.offline?.('register',error);
      console.warn('S2A Pilot : service worker non enregistré',error);
    }
    if(isIOSDevice() && shouldOfferInstall()){
      setTimeout(showInstallPrompt, 900);
    }
    if(registration){
      try{await registration.update();}
      catch(error){window.S2APilotDiagnostics?.offline?.('update',error);}
    }
  });
}



// Manual conduct keeps the canonical chronological cue list; links add relative timing.
function isVisualNumberChild(cue){
 return !!cue.parentMusicId&&cues.some(parent=>parent.id===cue.parentMusicId&&parent.visualNumber);
}
function isManualMainCue(cue){
 return (cue.manualKind==='silent'||(cue.mediaActions||[]).some(a=>a.kind==='audio'))&&!isVisualNumberChild(cue);
}
function normalizeGoCueColor(value){
 return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():null;
}
function paintGoCueColor(element,color){
 element.classList.toggle('goCueColored',!!color);
 if(!color)return;
 const value=parseInt(color.slice(1),16);
 const rgb=[value>>16,(value>>8)&255,value&255];
 // Keep very dark choices visible against Pilot's dark background.
 const channels=rgb.map(channel=>Math.round(channel*.72+62)).join(',');
 element.style.setProperty('--go-cue-tint','rgba('+channels+',.21)');
 element.style.setProperty('--go-cue-accent','rgb('+channels+')');
 element.style.setProperty('--go-cue-accent-soft','rgba('+channels+',.53)');
}
function applyGoCueColor(element,cue){
 const owner=isManualMainCue(cue)?cue:manualMusics().find(parent=>parent.id===cue.parentMusicId);
 if(!owner)return;
 element.dataset.goColorRoot=owner.id;
 paintGoCueColor(element,normalizeGoCueColor(owner.goColor));
}
function goCueColorPicker(cue,name){
 const label=document.createElement('label'),input=document.createElement('input');
 label.className='goSequenceColor';
 label.title=tr('Choisir la couleur de la Cue');
 input.type='color';
 input.setAttribute('aria-label',label.title+' · '+name);
 input.value=normalizeGoCueColor(cue.goColor)||'#b58aff';
 label.style.setProperty('--go-picker-color',input.value);
 input.onchange=function(){
  const color=normalizeGoCueColor(input.value);
  if(locked||conductType!=='manual'||!cues.includes(cue)||!color||color===cue.goColor)return;
  pushHistory();
  cue.goColor=color;
  label.style.setProperty('--go-picker-color',color);
  renderGoWaveMarkers();
  document.querySelectorAll('[data-go-color-root]').forEach(function(element){
   if(element.dataset.goColorRoot===cue.id)paintGoCueColor(element,color);
  });
  scheduleAutosave();
 };
 label.append(input);
 return label;
}
function manualCueLabel(cue){return isManualMainCue(cue)?'Go':cue.waitForGo===true?'Wait':'Next';}
function isManualInternalCue(cue){return conductType==='manual'&&!!cue.parentMusicId&&!isManualMainCue(cue);}
function manualHierarchy(){
 if(manualHierarchyCache)return manualHierarchyCache;
 const ordered=orderedCues(),roots=ordered.filter(isManualMainCue),children=new Map(roots.map(c=>[c.id,[]])),numbers=new Map(),order=[];
 for(const cue of ordered)if(!isManualMainCue(cue)&&children.has(cue.parentMusicId))children.get(cue.parentMusicId).push(cue);
 roots.forEach((root,index)=>{numbers.set(root.id,String(index+1));order.push(root);children.get(root.id).forEach((child,position)=>{numbers.set(child.id,(index+1)+'.'+(position+1));order.push(child);});});
 for(const cue of ordered)if(!numbers.has(cue.id)){numbers.set(cue.id,String(ordered.indexOf(cue)+1));order.push(cue);}
 return manualHierarchyCache={roots,children,numbers,order,visualScopes:new Map()};
}
function detachedSubCueGroups(roots=manualMusics()){
 const rootIds=new Set(roots.map(cue=>cue.id)),groups=new Map();
 for(const cue of orderedCues()){
  if(!isManualInternalCue(cue)||rootIds.has(cue.parentMusicId))continue;
  if(!groups.has(cue.parentMusicId))groups.set(cue.parentMusicId,[]);
  groups.get(cue.parentMusicId).push(cue);
 }
 return groups;
}
function openSubCueReattachment(){
 if(!canReorderGoSequence())return;
 const roots=manualMusics(),groups=detachedSubCueGroups(roots);
 if(!groups.size)return;
 const dialog=$('reattachDialog'),source=$('reattachSource'),target=$('reattachTarget');
 const confirm=$('reattachConfirm'),status=$('reattachStatus'),epoch=copilotProjectEpoch;
 source.replaceChildren();target.replaceChildren(new Option(tr('Choisir un numéro'),''));
 let index=0;
 for(const [id,items] of groups){
  source.add(new Option(tr('Groupe {number} · {count} sous-Cue(s) · {name}',{number:++index,count:items.length,name:items[0].name}),id));
 }
 for(const root of roots)target.add(new Option(root.name,root.id));
 source.disabled=groups.size===1;
 const selected=cues.find(cue=>cue.id===expandedCueId);
 if(selected&&groups.has(selected.parentMusicId))source.value=selected.parentMusicId;
 const selectedRoot=roots.find(root=>root===selected||root.id===selected?.parentMusicId);
 if(selectedRoot)target.value=selectedRoot.id;
 function validate(items,root){
  if(!root||!items?.length)return '';
  if(items.some(cue=>!Number.isFinite(cue.relativeTime)||cue.relativeTime<0))return tr('Certains temps relatifs sont manquants ou invalides.');
  if(items.some(cue=>cue.relativeTime>roundTenth(manualPlannedDuration(root))))return tr('Ce numéro est trop court pour conserver tous les temps relatifs.');
  return '';
 }
 function update(){
  const items=groups.get(source.value),root=roots.find(cue=>cue.id===target.value);
  status.textContent=validate(items,root);
  confirm.disabled=!root||!items?.length||!!status.textContent;
 }
 source.onchange=target.onchange=update;
 confirm.onclick=()=>{
  if(epoch!==copilotProjectEpoch||!canReorderGoSequence()){dialog.close();return;}
  const currentRoots=manualMusics(),root=currentRoots.find(cue=>cue.id===target.value);
  const items=detachedSubCueGroups(currentRoots).get(source.value);
  const issue=validate(items,root);
  if(!root||!items?.length||issue){status.textContent=issue;confirm.disabled=true;return;}
  pushHistory();
  for(const cue of items){
   cue.parentMusicId=root.id;
   cue.time=roundTenth(root.time+cue.relativeTime);
  }
  goCollapsed.delete(root.id);expandedCueId=root.id;
  dialog.close();invalidatePreflight();renderCues();scheduleAutosave();
 };
 $('reattachCancel').onclick=()=>dialog.close();
 update();cancelCueShortcut();dialog.showModal();
 (source.disabled?target:source).focus();
}
$('reattachSubCues').onclick=openSubCueReattachment;
$('alignShowStart').onclick=()=>{
 if(!canReorderGoSequence())return;
 const roots=manualMusics(),offset=roots[0]?.time;
 if(!(offset>0))return;
 pushHistory();
 // syncManualLinks recalculates absolute times from the unchanged child offsets.
 for(const root of roots)root.time=roundTenth(root.time-offset);
 if(Number.isFinite(showDurationOverride))showDurationOverride=Math.max(0,roundTenth(showDurationOverride-offset));
 resetManualRuntime();
 transportTime=transportBase=lastTransportTime=0;transportEpoch=performance.now();
 goWaveInsertionTime=null;goWaveCueId=null;goWaveCueSelected=false;
 goWaveStart=0;goWaveZoom=1;
 expandedCueId=roots[0].id;
 renderCues();scheduleAutosave();
};
function manualRootAtTime(time,roots=manualMusics()){
 return roots.filter(root=>time>=root.time&&time<root.time+manualPlannedDuration(root)).pop();
}
function attachManualEditCue(cue){
 const roots=manualMusics(),selected=cues.find(item=>item.id===expandedCueId);
 const selectedRoot=selected&&roots.find(root=>root===selected||root.id===selected.parentMusicId);
 const playheadRoot=manualRootAtTime(cue.time,roots);
 const parent=(!transportPlaying&&selectedRoot)||playheadRoot;
 if(!parent){cue.manualKind='silent';cue.manualDuration=180;return;}
 if(!transportPlaying&&parent===selectedRoot){
  cue.time=Math.max(selected.time,parent===playheadRoot?cue.time:parent.time);
 }
 cue.parentMusicId=parent.id;
 cue.relativeTime=roundTenth(cue.time-parent.time);
}
function manualMusics(){return manualHierarchy().roots;}
function nextManualMainTime(){return roundTenth(manualMusics().reduce((end,p)=>Math.max(end,p.time+manualPlannedDuration(p)),0));}
function manualPlannedDuration(c){if(c?.manualKind==='silent')return Math.max(0,Number(c.manualDuration)||0);return mediaSegmentDuration((c?.mediaActions||[]).find(a=>a.kind==='audio'));}
function manualAudioElapsed(rt){return (rt.manualLoopElapsed||0)+Math.max(0,rt.el.currentTime-(Number(rt.item.action.inPoint)||0)-runtimeLtcLead(rt));}
function visualNumberMediaScope(root){
 const hierarchy=manualHierarchy();
 if(!hierarchy.visualScopes.has(root.id)){
  const scope={cues:[root,...manualChildren(root)],audio:[],video:[]};
  for(const cue of scope.cues)for(const action of cue.mediaActions||[]){
   if(action.kind==='audio'||action.kind==='video')scope[action.kind].push({cue,action,start:cue.time});
  }
  hierarchy.visualScopes.set(root.id,scope);
 }
 return hierarchy.visualScopes.get(root.id);
}
const visualAudioFades=new WeakMap();
function syncVisualAudioFade(root,t,audio,playing,reposition,scope){
 const latest=audio[audio.length-1];
 let fade=visualAudioFades.get(root);
 if(reposition||fade?.incoming.action.id!==latest?.item.action.id){
  visualAudioFades.delete(root);fade=null;
 }
 if(!playing||!latest||individuallyStoppedAudio.has(latest.item.action.id))return;
 const incoming=runtimeAudio.get(latest.item.action.id);
 const outgoing=audio.length===2&&audio[0].item;
 if(!fade&&!reposition&&!incoming&&outgoing&&latest.item.action.transition==='fade'){
  const previous=runtimeAudio.get(outgoing.action.id);
  if(previous&&!previous.el.paused&&previous.localPausePosition==null){
   fade={incoming:latest.item,outgoing,requestedAt:t,duration:latest.item.action.fadeDuration,startedAt:null};
   visualAudioFades.set(root,fade);
  }
 }
 if(!fade)return;
 if((lastStopActionBefore(t,scope.cues)?.start??-Infinity)>fade.incoming.start){
  visualAudioFades.delete(root);return;
 }
 const previous=runtimeAudio.get(fade.outgoing.action.id);
 if(fade.startedAt===null&&incoming&&!incoming.el.paused&&!incoming.el.seeking&&
   incoming.el.currentTime>mediaPositionAt(fade.incoming.action,0)+runtimeLtcLead(incoming)+.008){
  fade.startedAt=t;
 }
 // Keep the outgoing track at full gain while the incoming decoder starts.
 // A shared clock then gives both ramps the full configured duration.
 const progress=fade.startedAt===null?0:Math.min(1,(t-fade.startedAt)/fade.duration);
 if(progress>=1||(fade.startedAt===null&&t-fade.requestedAt>2)){
  visualAudioFades.delete(root);return;
 }
 latest.gain=progress;
 if(!incoming)latest.elapsed=0;
 const previousState=audio.find(state=>state.item.action.id===fade.outgoing.action.id);
 if(previousState)previousState.gain=1-progress;
 else if(previous&&!previous.el.paused)audio.unshift({item:fade.outgoing,elapsed:t-fade.outgoing.start,gain:1-progress});
}
function syncVisualNumberMedia(root,t,playing,reposition=false,resume=false){
 const scope=visualNumberMediaScope(root),audio=audioStateAt(t,scope),video=videoStateAt(t,scope),tasks=[];
 syncVisualAudioFade(root,t,audio,playing,reposition,scope);
 const incoming=manualFade?Math.min(1,(performance.now()-manualFade.started)/manualFade.duration):1;
 const wanted=new Set(audio.filter(state=>!individuallyStoppedAudio.has(state.item.action.id)).map(state=>state.item.action.id));
 for(const [id,track] of runtimeAudio){
  if((track.item.cue.parentMusicId===root.id||track.item.cue.id===root.id)&&!wanted.has(id)&&track.localPausePosition==null)stopAudioRuntime(id);
 }
 for(const state of audio){
  if(!wanted.has(state.item.action.id))continue;
  const track=runtimeAudio.get(state.item.action.id),gain=state.gain*incoming;
  if(!track||reposition)tasks.push(activateAudio(state.item,state.elapsed,gain,playing,resume));
  else setRuntimeGain(track,gain);
 }
 if(!video){if(runtimeVideo)stopVideoRuntime();}
 else{
  const current=runtimeVideo?.item.action.id===video.item.action.id?runtimeVideo:null;
  if(!current||reposition)tasks.push(activateVideo(video.item,video.elapsed,playing,resume));
  else if(Math.abs(current.el.currentTime-mediaPositionAt(video.item.action,video.elapsed))>.55)current.el.currentTime=mediaPositionAt(video.item.action,video.elapsed);
  if(runtimeVideo?.item.action.id===video.item.action.id)runtimeVideo.opacity=video.opacity;
 }
 return Promise.all(tasks);
}
function manualDuration(c){if(c?.manualKind==='silent')return Math.max(0,Number(c.manualDuration)||0);const a=(c?.mediaActions||[]).find(a=>a.kind==='audio');return a?.loop?Infinity:mediaSegmentDuration(a);}
function manualCurrent(){return cues.find(c=>c.id===manualCurrentID)||null;}
function manualChildren(c){return c?manualHierarchy().children.get(c.id)||[]:[];}
function updateManualRelative(c){if(conductType!=='manual'||!c.parentMusicId)return;const p=cues.find(x=>x.id===c.parentMusicId);if(p)c.relativeTime=roundTenth(c.time-p.time);}
function syncManualLinks(){
 if(conductType!=='manual')return;
 // Older beta projects stored independent silent Cues without a manual kind.
 for(const c of cues){const audio=(c.mediaActions||[]).some(a=>a.kind==='audio');if(audio&&c.manualKind==='silent'&&!c.visualNumber){delete c.manualKind;delete c.manualDuration;}else if(!audio&&!c.parentMusicId&&c.manualKind!=='silent'){c.manualKind='silent';c.manualDuration=180;}}
 for(const c of cues){if(!c.parentMusicId||isManualMainCue(c))continue;const p=cues.find(x=>x.id===c.parentMusicId);if(p&&Number.isFinite(c.relativeTime))c.time=roundTenth(p.time+c.relativeTime);}
}
function manualIssues(){
 const music=manualMusics(),issues=[];
 if(!music.length)issues.push(tr('Ajoutez une musique ou un numéro muet.'));
 for(const p of music){if(p.manualKind!=='silent'&&(p.mediaActions||[]).filter(a=>a.kind==='audio').length!==1)issues.push(p.name+' : '+tr('Une seule musique principale par Cue.'));if(!(manualPlannedDuration(p)>0))issues.push(p.name+' : '+tr('Durée audio inconnue.'));}
 for(const c of cues){if(music.includes(c))continue;const p=music.find(p=>p.id===c.parentMusicId);if(!p||!Number.isFinite(c.relativeTime)||c.relativeTime<0||c.relativeTime> manualPlannedDuration(p))issues.push(c.name+' : '+tr('Choisissez une musique et un temps relatif valides.'));}
 return issues;
}
function resetManualRuntime(){cancelManualCrossfadeLead();editBlockPreview=null;individuallyStoppedAudio.clear();manualPauseAudioPositions=null;showEscapeResume=null;manualWaitCueID=null;manualWaitDeferred=[];updateGoFadeHalo();manualArmedID=null;manualArmExplicit=false;manualCurrentID=null;manualCompletedID=null;manualFade=null;manualPending=false;manualPendingGeneration=null;manualLastGO=-Infinity;manualPausedAt=null;manualPausePending=false;}
function manualActiveCue(t){const p=manualCurrent()||cues.find(c=>c.id===manualCompletedID);if(!p)return null;const children=manualChildren(p);for(let i=children.length-1;i>=0;i--)if(children[i].time<=t+.0001)return children[i];return p;}
function manualNextTop(t){const p=manualCurrent();return (transportPlaying||manualPausedAt!==null)&&p?manualChildren(p).find(c=>c.time>t+.0001)||null:null;}
function nextManualWait(){const p=manualCurrent();return !showEscapeResume&&!manualArmExplicit&&p?manualChildren(p).find(c=>c.waitForGo===true&&c.time>currentTransportTime()+.0001&&c.time<p.time+manualDuration(p)-.05)||null:null;}
function normalizeAutoNextFade(value){
 const seconds=Number(value)||0;
 return seconds>0?Math.max(.1,Math.min(60,roundTenth(seconds))):0;
}
function manualPrimaryAudio(cue){
 return cue?.mediaActions?.find(action=>action.kind==='audio');
}
function supportsManualCrossfade(next,action){
 return !!action&&!next.visualNumber&&
  !manualChildren(next).some(cue=>cue.waitForGo&&cue.relativeTime===0);
}
let manualCrossfadeLead=null;
function cancelManualCrossfadeLead(){
 const incoming=manualCrossfadeLead?.incoming;
 if(incoming)stopAudioRuntime(incoming.item.action.id);
 manualCrossfadeLead=null;
}
function manualCrossfadeLeadDuration(next){
 const action=manualPrimaryAudio(next);
 return action?.ltc?plannedLtcLead({cue:next,action}):0;
}
function manualCrossfadeStart(cue,primary,next){
 const end=cue.time+manualDuration(cue),incoming=manualPrimaryAudio(next);
 const fade=normalizeAutoNextFade(primary.autoNextFadeSeconds);
 if(!fade||!supportsManualCrossfade(next,incoming))return end;
 const last=manualChildren(cue).at(-1)?.time??cue.time;
 const duration=Math.min(fade,Math.max(0,mediaSegmentDuration(incoming)-.05));
 return Math.min(end,Math.max(last+.05,cue.time+.05+manualCrossfadeLeadDuration(next),end-duration));
}
function stageManualCrossfadeLead(next,outgoing){
 const action=manualPrimaryAudio(next),item={cue:next,action,start:next.time},prepared=preparedRecord(item);
 if(!prepared||runtimeAudio.has(action.id))return;
 ltcOutputContext();
 const incoming={item,el:prepared.el,background:false};
 const staged={incoming,outgoing,next,ready:false};
 manualCrossfadeLead=staged;runtimeAudio.set(action.id,incoming);setRuntimeGain(incoming,0);
 const position=mediaPositionAt(action,0);
 if(Math.abs(incoming.el.currentTime-position)>.01)incoming.el.currentTime=position;
 Promise.all([incoming.el.play(),waitForAudioSeek(incoming.el)]).then(()=>{
  if(manualCrossfadeLead!==staged)return;
  staged.ready=true;
  updateTransport();
 }).catch(error=>{
  if(manualCrossfadeLead!==staged)return;
  cancelManualCrossfadeLead();outgoing.crossfadeLeadFailed=true;
  window.S2APilotDiagnostics?.report('transport',error);
 });
}
function manualAutomaticNext(cue,primary){
 if(!locked||!primary?.autoNext||!Number.isFinite(manualDuration(cue)))return null;
 const roots=manualMusics(),index=roots.indexOf(cue);
 return index>=0?roots[index+1]||null:null;
}
function manualNextMusic(){const m=manualMusics();if(manualArmExplicit){const selected=cues.find(c=>c.id===manualArmedID);return m.find(c=>c.id===selected?.id||c.id===selected?.parentMusicId)||null;}const id=manualCurrentID||manualCompletedID;return m[id?m.findIndex(c=>c.id===id)+1:0]||null;}
function manualGoTarget(){
 if(manualArmExplicit)return cues.find(c=>c.id===manualArmedID)||null;
 if(manualWaitCueID)return cues.find(c=>c.id===manualWaitCueID)||null;
 return nextManualWait()||manualNextMusic();
}
function armManualCue(id){
 if(conductType!=='manual'||!locked||manualPending||escapeFading)return;
 const cue=cues.find(c=>c.id===id);if(!cue)return;
 if(showEscapeResume)showEscapeResume.armedID=null;manualArmedID=cue.id;manualArmExplicit=true;showOverviewSignature='';updateTransport();
}
function armManualCueAtTime(time){
 manualArmedID=manualMusics().find(c=>c.time>=time-.0001)?.id||null;manualArmExplicit=true;showOverviewSignature='';
}

function updateLiveLtcLead(){
 const timer=$('liveLtcLead');
 const primary=locked&&conductType==='manual'&&!escapeFading&&(transportPlaying||manualPausedAt!==null)
  ?manualPrimaryAudio(manualCurrent()):null;
 const remaining=primary?remainingLtcLead(manualCrossfadeLead?.incoming||runtimeAudio.get(primary.id)):0;
 timer.hidden=remaining<=0;
 if(remaining>0)setShowText(timer,tr(transportPlaying?'Pré-roll LTC · {seconds} s':'Pré-roll LTC en pause · {seconds} s',{seconds:Math.ceil(remaining)}));
}
function updateManualStatus(){
 updateLiveLtcLead();
 document.body.classList.toggle('manualConduct',conductType==='manual');updateGoSequenceHandles();
 const importButton=$('importVisualNumbers');
 importButton.hidden=conductType!=='manual'||locked;
 importButton.disabled=importingVisualNumbers||!canReorderGoSequence();
 $('actLibraryOpen').disabled=locked||transportPlaying;
 const preparationButton=$('actPreparationOpen');
 preparationButton.hidden=conductType==='manual'||locked;
 preparationButton.disabled=transportPlaying;
 playBtn.title=tr('Lecture');
 playBtn.setAttribute('aria-keyshortcuts',conductType==='manual'?pilotShortcuts.go:pilotShortcuts.play+' '+pilotShortcuts.mediaPlay);

 const modeSwitch=$('conductType');
 if(modeSwitch){
  modeSwitch.dataset.activeMode=conductType;
  modeSwitch.setAttribute('aria-label',tr('Type de conduite :'));
  for(const button of modeSwitch.children){
   button.disabled=locked||transportPlaying;
   button.textContent=tr(button.dataset.mode==='manual'?'Spectacle':'Numéro visuel');
   button.setAttribute('aria-pressed',String(button.dataset.mode===conductType));
  }
 }
 const pauseButton=$('manualPauseBtn'),manual=conductType==='manual',resume=manual&&(manualPausedAt!==null||editBlockPreview&&!transportPlaying);
 pauseButton.disabled=escapeFading||(manual?((!manualCurrentID&&!runtimeAudio.size)||manualPending||manualPausePending):!transportPlaying);
 const pauseLabel=tr(resume?'Reprendre':'Pause');
 pauseButton.setAttribute('aria-label',pauseLabel);
 pauseButton.title=pauseLabel;
 pauseButton.setAttribute('aria-keyshortcuts',pilotShortcuts.play+' '+pilotShortcuts.mediaPlay);
 S2AMaterial.set($('pauseBtnIcon'),resume?'play_arrow':'pause');
 const panel=$('manualShowStatus');if(!panel)return;panel.hidden=conductType!=='manual';
 if(!manual){
  playBtn.disabled=escapeFading||transportPlaying;
  setShowText(playBtnLabel,tr('Lecture'));
  playBtn.setAttribute('aria-label',playBtnLabel.textContent);
  return;
 }
 playBtn.disabled=escapeFading||manualPending||manualPausePending;
 const current=manualCurrent(),next=manualNextMusic(),nextWait=nextManualWait();
 timeline.querySelectorAll('.marker').forEach(marker=>marker.classList.toggle('armedMainCue',manualArmExplicit&&marker.dataset.cueId===manualArmedID));
 panel.textContent=(manualWaitCueID?tr('En attente du GO — reprendre la bande-son'):manualPausedAt!==null?tr('Pause')+' — '+(current?.name||''):transportPlaying?tr('EN LECTURE — {name}',{name:current?.name||''}):tr('EN ATTENTE DU GO'))+(manualWaitCueID?'':nextWait?' · '+tr('Prochain GO : {name}',{name:nextWait.name}):next?' · '+tr('Prochain numéro : {name}',{name:next.name}):manualCompletedID&&!transportPlaying?' · '+tr('Fin de conduite'):'');
 const goLabel=tr(manualWaitCueID?'GO — reprendre la bande-son':nextWait?'GO — prochain repère Wait':'GO - prochain numéro');playBtnLabel.textContent='GO';playBtn.setAttribute('aria-label',goLabel);playBtn.title=goLabel+' ('+shortcutLabel(pilotShortcuts.go)+')';
}
function setConductType(value){
 if(locked||transportPlaying)return;
 const next=value==='manual'?'manual':'autopilot';if(next===conductType)return;
 pushHistory();conductType=next;resetManualRuntime();
 if(next==='manual'){
  const music=manualMusics();
  for(const c of cues){if(music.includes(c))continue;
   const linked=music.find(p=>p.id===c.parentMusicId);if(linked){c.relativeTime=roundTenth(c.time-linked.time);continue;}
   const candidates=music.filter(p=>c.time>=p.time&&c.time<p.time+manualPlannedDuration(p));
   if(candidates.length===1){c.parentMusicId=candidates[0].id;c.relativeTime=roundTenth(c.time-candidates[0].time);}
  }
 }
 invalidatePreflight();applyLockState();scheduleAutosave();
}
// A reused media element may still contain samples from its last playback position.
// Keep its gain closed until both seeking and play() have completed.
function rewindManualAudio(rt,target){
 rt.el.pause();setRuntimeGain(rt,0);
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=error=>{if(done)return;done=true;clearTimeout(timer);rt.el.removeEventListener('loadedmetadata',seek);rt.el.removeEventListener('seeked',ready);rt.el.removeEventListener('error',fail);error?reject(error):resolve();};
  const ready=()=>{if(rt.el.readyState>=1&&!rt.el.seeking)finish();};
  const seek=()=>{try{rt.el.currentTime=target;if(!rt.el.seeking&&Math.abs(rt.el.currentTime-target)<.05)ready();}catch(error){finish(error);}};
  const fail=()=>finish(new Error(tr('Média non décodable par ce navigateur')));
  const timer=setTimeout(()=>finish(new Error(tr('Délai de préchargement dépassé'))),10000);
  rt.el.addEventListener('loadedmetadata',seek);rt.el.addEventListener('seeked',ready);rt.el.addEventListener('error',fail);
  // Reset the decoder and queued samples as well as the playback position (Safari).
  try{rt.el.load();if(rt.el.readyState>=1)seek();}catch(error){finish(error);}
 });
}

function manualGoGuardActive(){return performance.now()-manualLastGO<goGuardMs;}
async function manualGO(automaticNext=null,crossfade=null){
 window.S2APilotDiagnostics?.step?.(automaticNext?'auto-go':'go');
 checkPilotOutput();
 if(escapeFading||manualPending||manualPausePending||(!automaticNext&&manualGoGuardActive()))return;
 syncManualLinks();const issues=manualIssues();if(issues.length)throw new Error(issues.join('\n'));
 if(!automaticNext&&manualWaitCueID&&!manualArmExplicit){manualLastGO=performance.now();showTransportGuard(goGuardMs);await toggleManualPause();return;}
 const upcomingWait=automaticNext?null:nextManualWait();
 if(upcomingWait){await jumpToManualWait(upcomingWait);return;}
 const next=automaticNext||manualNextMusic();if(!next)return;
 const staged=crossfade?.incoming;
 if(staged)manualCrossfadeLead=null;
 else cancelManualCrossfadeLead();
 const selectedChild=!automaticNext&&manualArmExplicit?manualChildren(next).find(c=>c.id===manualArmedID):null;
 const startTime=selectedChild?.time??next.time;
 const zeroWait=!selectedChild&&manualChildren(next).find(c=>c.waitForGo===true&&Math.abs(c.time-startTime)<.0001);
 manualPending=true;if(!automaticNext)manualLastGO=performance.now();const previous=manualCurrentID||manualCompletedID;const generation=++transportCommandGeneration;manualPendingGeneration=generation;
 try{
  pauseMediaPreviews();manualWaitCueID=null;manualWaitDeferred=[];
  const primary=(next.mediaActions||[]).find(a=>a.kind==='audio');
  if(primary?.ltc)ltcOutputContext();
  const item={cue:next,action:primary,start:next.time};
  let prepared=primary?preparedRecord(item):null;
  if((primary&&!prepared)||(!automaticNext&&!allMediaActions().every(x=>preparedMedia.get(x.action.id)?.ready))){
   const ready=await prepareShowMedia();if(generation!==transportCommandGeneration)return;
   if(!ready)throw new Error(tr('Préparez tous les médias avant le GO.'));
   if(!automaticNext){manualLastGO=-Infinity;updateManualStatus();$('manualShowStatus').textContent=tr('Médias prêts. Appuyez sur GO.');return;}
   prepared=primary?preparedRecord(item):null;
  }
  // Safari requires play() inside the actual keyboard/touch event, before any await.
  const contextReady=ensureAudioContext();
  individuallyStoppedAudio.clear();
  const overlay=primary?.overlayAudio===true;
  // A new visual-number fade uses its own clock, so finish the previous transition first.
  if(overlay&&next.visualNumber&&manualFade){
   for(const {rt} of manualFade.outgoing)stopAudioRuntime(rt.item.action.id);
   if(manualFade.incoming)setRuntimeGain(manualFade.incoming,1);
  }
  const outgoing=[];
  for(const track of [...runtimeAudio.values()]){
   const id=track.item.action.id;
   if(track===staged)continue;
   if(id===primary?.id||(track.el.paused&&!(overlay&&track.localPausePosition!=null))){stopAudioRuntime(id);continue;}
   if(track===crossfade?.track){delete track.globalFadeStartedAt;outgoing.push(track);continue;}
   if(overlay){track.layered=true;continue;}
   delete track.globalFadeStartedAt;
   if(!track.background&&(!next.visualNumber||track.item.cue.parentMusicId!==next.id))outgoing.push(track);
  }
  manualPausedAt=null;manualPauseAudioPositions=null;
  if(!overlay||next.visualNumber)manualFade=null;
  showEscapeResume=null;stopVideoRuntime();
  cancelAnimationFrame(rafId);rafId=0;
  manualCurrentID=next.id;manualCompletedID=null;transportTime=transportBase=startTime;transportEpoch=performance.now();lastTransportTime=startTime;transportPlaying=true;
  const rt=staged||(primary?{item,el:prepared.el,background:primary.keepBackground===true}:null);
  if(staged)staged.background=primary.keepBackground===true;
  let rewound=Promise.resolve();if(rt&&!staged){runtimeAudio.set(primary.id,rt);setRuntimeGain(rt,outgoing.length?0:1);const position=mediaPositionAt(primary,startTime-next.time)+(selectedChild?runtimeLtcLead(rt):0);
   if(automaticNext){
    if(Math.abs(rt.el.currentTime-position)>.01)rt.el.currentTime=position;
    rewound=waitForAudioSeek(rt.el);
   }else rewound=rewindManualAudio(rt,position);}
  // Call play synchronously in the input event for Safari, with gain still zero.
  if(next.visualNumber&&outgoing.length)manualFade={started:performance.now(),duration:MANUAL_GO_FADE_MS,incoming:null,outgoing:outgoing.map(x=>({rt:x,gain:x.manualGainValue??x.el.volume}))};
 const started=next.visualNumber&&!zeroWait?syncVisualNumberMedia(next,startTime,true,true):rt&&!zeroWait&&!staged?rt.el.play():Promise.resolve();
 updateManualStatus();await Promise.all([contextReady,rewound,started]);
  if(generation!==transportCommandGeneration)return;
  if(primary&&(!rt||(!zeroWait&&rt.el.paused))){transportPlaying=false;manualCurrentID=null;throw new Error(tr('La lecture audio n’a pas démarré. Relancez le GO.'));}
  transportEpoch=performance.now();if(rt&&!zeroWait)setRuntimeGain(rt,outgoing.length?0:1);
  manualArmedID=null;manualArmExplicit=false;if(!automaticNext){manualLastGO=performance.now();showTransportGuard(goGuardMs);}
  if(outgoing.length&&!next.visualNumber){
   const fadeMs=crossfade?Math.max(1,(manualDuration(crossfade.track.item.cue)-manualAudioElapsed(crossfade.track))*1000):MANUAL_GO_FADE_MS;
   manualFade={started:performance.now(),waitingForLead:!!(rt&&audioInLtcLead(rt)),duration:fadeMs,incoming:rt,outgoing:outgoing.map(x=>({rt:x,gain:x.manualGainValue??x.el.volume}))};
  }
  if(zeroWait&&outgoing.length){for(const track of outgoing)stopAudioRuntime(track.item.action.id);manualFade=null;}
  if(next.visualNumber){
   dispatchCueOsc(next);
   if(!zeroWait)for(const cue of manualChildren(next))if(Math.abs(cue.time-startTime)<.0001)dispatchCueOsc(cue);
  }else{
   const starting=[next,...manualChildren(next).filter(c=>Math.abs(c.time-startTime)<.0001&&!zeroWait)]
    .map(c=>({...c,mediaActions:(c.mediaActions||[]).filter(a=>a.id!==primary?.id&&(c!==next||a.kind!=='stopAll'))}));
   if(rt&&audioInLtcLead(rt))rt.ltcStartingCues=starting;
   else for(const cue of starting)await onCueCrossed(cue);
  }
  if(zeroWait){pauseAtManualWait(zeroWait,next);return;}
  if(!rafId)rafId=requestAnimationFrame(animationLoop);showOverviewSignature='';updateTransport();
 }catch(error){if(generation===transportCommandGeneration){manualCurrentID=null;manualCompletedID=previous;manualFade=null;manualPending=false;pauseTransport();stopAllRuntimeMedia();}throw error;}finally{if(manualPendingGeneration===generation){manualPending=false;manualPendingGeneration=null;}updateManualStatus();}
}
function waitForAudioSeek(element){
 if(!element.seeking)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const finish=error=>{
   clearTimeout(timer);
   element.removeEventListener('seeked',onSeeked);
   element.removeEventListener('error',onError);
   if(error)reject(error);else resolve();
  };
  const onSeeked=()=>{if(!element.seeking)finish();};
  const onError=()=>finish(new Error(tr('Média non décodable par ce navigateur')));
  const timer=setTimeout(()=>finish(new Error(tr('Délai de préchargement dépassé'))),10000);
  element.addEventListener('seeked',onSeeked);
  element.addEventListener('error',onError);
 });
}
async function jumpToManualWait(cue){
 if([...runtimeAudio.values()].some(track=>track.item.action.ltc))ltcOutputContext();
 const generation=++transportCommandGeneration;manualPausePending=true;manualLastGO=performance.now();showTransportGuard(goGuardMs);
 let tracks=[];
 cancelAnimationFrame(rafId);rafId=0;
 try{
  manualWaitCueID=null;manualWaitDeferred=[];manualPausedAt=null;transportPlaying=true;
  const contextReady=ensureAudioContext(),positioned=seekManualTransport(cue.time);
  // Same-track seek: do not reload the decoder or start the next principal Cue.
  tracks=[...runtimeAudio.values()].filter(rt=>rt.item.cue.id===manualCurrentID);
  const seeks=tracks.map(rt=>{setRuntimeGain(rt,0);return waitForAudioSeek(rt.el);});
  const started=tracks.map(rt=>rt.el.paused&&rt.localPausePosition==null?rt.el.play():Promise.resolve());
  await Promise.all([contextReady,positioned,...seeks,...started]);if(generation!==transportCommandGeneration)return;
  const parent=manualCurrent();if(!parent?.visualNumber)for(const child of manualChildren(parent).filter(c=>Math.abs(c.time-cue.time)<.0001))onCueCrossed(child).catch(console.warn);
  showOverviewSignature='';updateTransport();if(!rafId)rafId=requestAnimationFrame(animationLoop);
 }catch(error){if(generation===transportCommandGeneration){manualPausedAt=performance.now();pauseTransport();}throw error;}
 finally{
  for(const rt of tracks)if(runtimeAudio.get(rt.item.action.id)===rt)setRuntimeGain(rt,1);
  manualPausePending=false;updateManualStatus();
 }
}
async function toggleManualPause(){
 if(editBlockPreview){
  if(transportPlaying)pauseTransport();
  else await startEditBlockMedia(editBlockPreview,true);
  return;
 }
 if(conductType!=='manual'||manualPending||manualPausePending||escapeFading)return;
 const tracks=[...runtimeAudio.values()];
 if(!manualCurrentID&&!tracks.length)return;
 if(transportPlaying||(!manualCurrentID&&tracks.some(track=>!track.el.paused))){
  manualPausedAt=performance.now();
  manualPauseAudioPositions=new Map(tracks.map(rt=>[rt,rt.el.currentTime]));
  pauseTransport();return;
 }
 if(manualPausedAt===null)return;
 checkPilotOutput();
 if(tracks.some(track=>track.item.action.ltc&&track.localPausePosition==null))ltcOutputContext();
 const pausedAt=manualPausedAt,generation=++transportCommandGeneration;manualPausePending=true;
 try{
  // Start media in the button event, just as GO does on Safari.
  const contextReady=ensureAudioContext();transportPlaying=!!manualCurrentID;
  const parent=manualCurrent(),primary=runtimeAudio.get((parent?.mediaActions||[]).find(a=>a.kind==='audio')?.id);
  const rebuildVisual=parent?.visualNumber&&!manualPauseAudioPositions;
  const promises=rebuildVisual?[syncVisualNumberMedia(parent,transportTime,true,true)]:tracks.filter(rt=>rt.localPausePosition==null&&(rt.el.paused||rt===primary)).map(rt=>{
   // Safari can reset a paused decoder to its previous seek position.
   const position=manualPauseAudioPositions?.get(rt);
   if(Number.isFinite(position)&&Math.abs(rt.el.currentTime-position)>.025)rt.el.currentTime=position;
   const started=rt.el.play();
   return Promise.all([started,waitForAudioSeek(rt.el)]);
  });
  if(runtimeVideo&&!rebuildVisual)promises.push(runtimeVideo.el.play());
  await Promise.all([contextReady,...promises]);if(generation!==transportCommandGeneration)return;
  if(primary?.el.paused&&primary.localPausePosition==null)throw new Error(tr('La lecture audio n’a pas démarré.'));
  if(manualFade)manualFade.started+=performance.now()-pausedAt;
  else if(manualWaitCueID)for(const rt of runtimeAudio.values())if(rt!==manualCrossfadeLead?.incoming)setRuntimeGain(rt,1);
  const deferred=manualWaitDeferred;manualWaitCueID=null;manualWaitDeferred=[];
  restoreEscapedManualMedia();manualPausedAt=null;manualPauseAudioPositions=null;transportBase=transportTime;transportEpoch=performance.now();lastTransportTime=transportTime;
  for(const id of deferred){
   const cue=cues.find(c=>c.id===id);
   if(!cue)continue;
   if(parent?.visualNumber){dispatchCueOsc(cue);continue;}
   if(primary&&audioInLtcLead(primary))(primary.ltcStartingCues||(primary.ltcStartingCues=[])).push(cue);
   else onCueCrossed(cue).catch(console.warn);
  }
  if(transportPlaying&&!rafId)rafId=requestAnimationFrame(animationLoop);syncExternalVideo(true);updateTransport();
 }catch(error){if(generation===transportCommandGeneration)pauseTransport();throw error;}
 finally{manualPausePending=false;updateManualStatus();}
}
$('manualPauseBtn').addEventListener('click',function(){
 if(conductType==='manual')toggleManualPause().catch(reportTransportError);
 else if(transportPlaying&&!escapeFading)pauseTransport();
});
function manualSeekOffset(parent,target){
 return Math.max(0,Math.min(Math.max(0,manualDuration(parent)-.05),(Number(target)||0)-parent.time));
}
function seekManualTransport(target){
 window.S2APilotDiagnostics?.step?.('seek');
 if(escapeFading)return Promise.resolve();
 cancelManualCrossfadeLead();
 if(manualEditSequenceVisible()&&transportPlaying)return seekPlayingEditTimeline(clampTime(target));
 if(editBlockPreview)stopEditBlockPreview();
 const parent=manualCurrent();if(!parent){transportTime=clampTime(target);if(locked)armManualCueAtTime(transportTime);updateTransport();return Promise.resolve();}
 if(parent.visualNumber){
  const position=parent.time+manualSeekOffset(parent,target);
  ++seekGeneration;manualWaitDeferred=[];
  if(manualFade){for(const track of manualFade.outgoing)stopAudioRuntime(track.rt.item.action.id);manualFade=null;}
  transportTime=transportBase=lastTransportTime=position;transportEpoch=performance.now();
  if(manualPauseAudioPositions)for(const rt of manualPauseAudioPositions.keys()){
   if(rt.item.cue.id===parent.id||rt.item.cue.parentMusicId===parent.id)manualPauseAudioPositions.delete(rt);
  }
  const pending=syncVisualNumberMedia(parent,position,transportPlaying,true);
  if(manualPauseAudioPositions)for(const state of audioStateAt(position,visualNumberMediaScope(parent))){
   const rt=runtimeAudio.get(state.item.action.id);
   if(rt)manualPauseAudioPositions.set(rt,mediaPositionAt(state.item.action,state.elapsed)+runtimeLtcLead(rt));
  }
  showOverviewSignature='';updateTransport();return pending.then(()=>syncExternalVideo(true));
 }
 const action=(parent.mediaActions||[]).find(a=>a.kind==='audio'),rt=runtimeAudio.get(action?.id);if(!rt&&parent.manualKind!=='silent')return Promise.resolve();
 const relative=manualSeekOffset(parent,target),position=parent.time+relative;
 // Seeking never changes music, never issues GO and never pauses its audio element.
 ++seekGeneration;manualWaitDeferred=[];manualFade=null;for(const id of [...runtimeAudio.keys()])if(id!==action?.id&&!isBackgroundTrack(runtimeAudio.get(id)))stopAudioRuntime(id);
 let started=Promise.resolve();
 if(rt){
  delete rt.globalFadeStartedAt;setRuntimeGain(rt,1);
  rt.manualLoopElapsed=action.loop?Math.floor(relative/Math.max(.1,mediaSegmentDuration(action)))*mediaSegmentDuration(action):0;
  const mediaTime=mediaPositionAt(action,relative)+runtimeLtcLead(rt);
  if(Math.abs(rt.el.currentTime-mediaTime)>.01)rt.el.currentTime=mediaTime;
  manualPauseAudioPositions?.set(rt,mediaTime);
  if(rt.localPausePosition!=null)rt.localPausePosition=mediaTime;
  if(locked&&transportPlaying&&!manualPausePending&&rt.el.paused&&rt.localPausePosition==null)started=rt.el.play();
 }
 transportTime=transportBase=lastTransportTime=position;transportEpoch=performance.now();
 const candidates=[parent,...manualChildren(parent)].filter(c=>c.time<=position+.0001);
 const videos=candidates.flatMap(c=>(c.mediaActions||[]).filter(a=>a.kind==='video').map(a=>({cue:c,action:a,start:c.time}))),video=videos[videos.length-1];
 const rebuild=video&&mediaIsActiveAt(video.action,position-video.start)?activateVideo(video,position-video.start,transportPlaying):Promise.resolve(stopVideoRuntime());
 showOverviewSignature='';updateTransport();return Promise.all([rebuild,started]).then(()=>syncExternalVideo(true));
}
function pauseAtManualWait(cue,parent){
 manualPauseAudioPositions=null;
 manualWaitCueID=cue.id;manualWaitDeferred=manualChildren(parent).filter(c=>Math.abs(c.time-cue.time)<.0001).map(c=>c.id);
 manualPausedAt=performance.now();transportTime=transportBase=lastTransportTime=cue.time;
 pauseTransport(true);
 // Keep the media decoder at the position where pause actually took effect.
 showOverviewSignature='';updateTransport();
}
function manualHoldsAtStart(cue){return cue?.manualKind==='silent'&&!cue.visualNumber&&manualChildren(cue).length===0&&!(cue.mediaActions||[]).some(a=>a.kind==='video');}
function manualAnimationLoop(){
 rafId=0;if(!transportPlaying)return;
 if(editBlockPreview){tickEditBlockPreview();return;}
 const p=manualCurrent();if(!p)return;
 const primary=(p.mediaActions||[]).find(a=>a.kind==='audio');
 const rt=runtimeAudio.get(primary?.id);
 if(rt?.el.seeking){rafId=requestAnimationFrame(animationLoop);return;}
 if(locked&&rt?.el.paused&&!rt.el.ended&&rt.localPausePosition==null&&!rt.localPlayPending&&!manualPausePending){
  manualPausedAt=performance.now();pauseTransport(true);return;
 }
 if(rt?.ltcStartingCues&&!audioInLtcLead(rt)){
  const starting=rt.ltcStartingCues;
  delete rt.ltcStartingCues;
  for(const cue of starting)onCueCrossed(cue).catch(console.warn);
 }
 // Read the real audio clock: buffering must not make the top countdown run ahead.
 const hold=manualHoldsAtStart(p);
 const elapsed=hold?0:p.manualKind==='silent'?Math.max(0,transportBase-p.time+(performance.now()-transportEpoch)/1000):rt?manualAudioElapsed(rt):manualDuration(p);
 const t=p.time+elapsed;
 const wait=manualChildren(p).find(c=>c.waitForGo===true&&c.time>lastTransportTime+.0001&&c.time<=t+.0001&&c.time<p.time+manualDuration(p)-.025);
 if(wait){
  for(const c of manualChildren(p))if(c.time>lastTransportTime+.0001&&c.time<wait.time-.0001){
   if(p.visualNumber)dispatchCueOsc(c);else onCueCrossed(c).catch(console.warn);
  }
  pauseAtManualWait(wait,p);return;
 }
 transportBase=transportTime=t;transportEpoch=performance.now();
 if(p.visualNumber){
  syncVisualNumberMedia(p,t,true).catch(console.warn);
  for(const cue of manualChildren(p))if(cue.time>lastTransportTime+.0001&&cue.time<=t+.0001)dispatchCueOsc(cue);
 }
 else for(const c of manualChildren(p))if(c.time>lastTransportTime+.0001&&c.time<=t+.0001)onCueCrossed(c).catch(console.warn);
 lastTransportTime=t;
 if(manualFade){const f=manualFade;if(f.waitingForLead&&!audioInLtcLead(f.incoming)){f.waitingForLead=false;f.started=performance.now();}const k=f.waitingForLead?0:Math.min(1,(performance.now()-f.started)/f.duration);if(f.incoming)setRuntimeGain(f.incoming,k);for(const x of f.outgoing)setRuntimeGain(x.rt,x.gain*(1-k));if(k>=1){for(const x of f.outgoing)stopAudioRuntime(x.rt.item.action.id);manualFade=null;}}
 for(const [id,audio] of runtimeAudio){if(Number.isFinite(audio.globalFadeStartedAt)){const factor=Math.max(0,1-(t-audio.globalFadeStartedAt)/audio.globalFadeDuration);setRuntimeGain(audio,(audio.globalFadeInitialGain??1)*factor);if(factor<=0)stopAudioRuntime(id);}}
 if(runtimeVideo&&Number.isFinite(runtimeVideo.globalFadeStartedAt)){runtimeVideo.opacity=Math.max(0,1-(t-runtimeVideo.globalFadeStartedAt)/runtimeVideo.globalFadeDuration);if(runtimeVideo.opacity<=0)stopVideoRuntime();}
 const automatic=manualAutomaticNext(p,primary);
 if(automatic&&rt&&!rt.el.paused&&!audioInLtcLead(rt)&&!manualFade&&!manualPending){
  const end=p.time+manualDuration(p),handoff=manualCrossfadeStart(p,primary,automatic);
  const lead=manualCrossfadeLeadDuration(automatic),staged=manualCrossfadeLead;
  if(handoff<end-.025&&lead&&!staged&&!rt.crossfadeLeadFailed&&t>=handoff-lead&&t+lead<end-.025){
   try{stageManualCrossfadeLead(automatic,rt);}
   catch(error){cancelManualCrossfadeLead();rt.crossfadeLeadFailed=true;window.S2APilotDiagnostics?.report('transport',error);}
  }
  const incoming=staged?.next===automatic&&staged.ready&&!staged.incoming.el.paused&&!audioInLtcLead(staged.incoming)?staged.incoming:null;
  if(handoff<end-.025&&t<end-.025&&(incoming||!lead&&t>=handoff)){
   manualGO(automatic,{track:rt,incoming}).catch(error=>{
    if(transportPlaying&&!manualCurrentID)pauseTransport(true);
    reportTransportError(error);
   });
   return;
  }
 }
 enforceMediaBounds(t);
 if((hold&&!manualFade)||elapsed>=manualDuration(p)-.025||(!rt&&p.manualKind!=='silent'&&!manualPending)){
  if(manualEditSequenceVisible()){
   transportTime=transportBase=lastTransportTime=p.time;
   goWaveInsertionTime=null;
   centerGoWaveTime(p.time);
  }else transportTime=p.time+Math.min(elapsed,manualDuration(p));
  const record=primary&&preparedMedia.get(primary.id),media=rt?.el||record?.el;
  const naturalEnd=media&&Number.isFinite(manualDuration(p))&&
   (media.ended||media.currentTime>=(Number(primary.inPoint)||0)+manualDuration(p)+(ltcRoutes.get(media)?.lead||0)-.04);
  const next=naturalEnd?automatic:null;
  manualCompletedID=p.id;manualCurrentID=null;
  if(manualFade)for(const track of manualFade.outgoing)stopAudioRuntime(track.rt.item.action.id);
  manualFade=null;
  const staged=manualCrossfadeLead;
  const incoming=next&&staged?.next===next&&staged.ready&&!staged.incoming.el.paused?staged.incoming:null;
  if(!incoming)cancelManualCrossfadeLead();
  for(const [id,track] of runtimeAudio)if(track!==incoming&&!isBackgroundTrack(track))stopAudioRuntime(id);
  stopVideoRuntime();showOverviewSignature='';
  if(next){
   manualGO(next,incoming?{track:staged.outgoing,incoming}:null).catch(error=>{
    if(transportPlaying&&!manualCurrentID)pauseTransport(true);
    reportTransportError(error);
   });
  }else pauseTransport(true);
  return;
 }
 if(performance.now()-lastDisplayUpdate>=60){lastDisplayUpdate=performance.now();if(runtimeVideo)runtimeVideo.el.style.opacity=String(runtimeVideo.opacity??1);syncExternalVideo();updateTransport();}
 else if(manualEditSequenceVisible()){updateGoWaveTransport(t);updateGoSequencePlayback(t);}
 else if(locked)updateLiveCueProgress(t);
 rafId=requestAnimationFrame(animationLoop);
}
function addManualTop(parent,relative=0){
 if(locked)return;pushHistory();const c=newBaseCue();c.parentMusicId=parent.id;c.relativeTime=roundTenth(Math.max(0,Math.min(relative,Number.isFinite(manualDuration(parent))?manualDuration(parent):relative)));c.time=roundTenth(parent.time+c.relativeTime);c.name='Cue '+(manualChildren(parent).length+1);cues.push(c);expandedCueId=c.id;renderCues();scheduleAutosave();
}
const MANUAL_GO_FADE_MS=2000;
let goSequenceSignature='',goSequenceSelected=null;
let goWaveSignature='',goWaveMarkerSignature='';
let goWaveButtons=new Map(),openGoWaveCluster=null;
let goWaveStart=0,goWaveZoom=1,goWaveInsertionTime=null,goWaveScrubTime=null;
const goWaveCapturedPointers=new Set();
let goWaveCueId=null,goWaveCueSelected=false,goWaveFrame=0,goWaveDecoding=false,skipGoWaveClick=false;
const goCollapsed=new Set();
let goSequenceZoom=1,goSequenceEpoch=-1,lastGoBlockClick=null;
let goSequenceGroups=new Map(),goSequencePlaybackGroup=null,goSequencePlaybackIndex=-1,goSequencePlaybackTime=null;
const goSequencePlayhead=$('goSequencePlayhead');
function setGoSequenceZoom(value,anchor){
 const view=$('goSequenceViewport'),track=$('goSequenceTrack'),next=Math.round(Math.max(.6,Math.min(1,value))*1000)/1000;
 if(Math.abs(next-goSequenceZoom)<.001)return;
 const point=anchor==null?view.clientWidth/2:anchor;
 const fraction=(view.scrollLeft+point)/Math.max(1,track.offsetWidth);
 goSequenceZoom=next;
 const sizes={'--go-media':202,'--go-cue':136,'--go-gap':9,'--go-height':88};
 Object.keys(sizes).forEach(function(key){view.style.setProperty(key,Math.round(sizes[key]*next)+'px');});
 view.dataset.compact=String(next<.85);
 $('goSequenceZoomIn').disabled=next>=1;
 $('goSequenceZoomOut').disabled=next<=.6;
 view.scrollLeft=Math.max(0,fraction*track.offsetWidth-point);
 updateGoSequencePlayback(currentTransportTime());
}
function updateGoFoldButton(){
 const parents=manualMusics().filter(function(cue){return manualChildren(cue).length>0;});
 const folded=parents.length>0&&parents.every(function(cue){return goCollapsed.has(cue.id);});
 const button=$('goSequenceFoldAll');
 button.disabled=!parents.length;
 button.textContent=tr(folded?'Tout déplier':'Tout replier');
 button.setAttribute('aria-pressed',String(folded));
 return folded;
}
function toggleGoSequenceGroup(id,keepFocus){
 
 if(goCollapsed.has(id))goCollapsed.delete(id);
 else goCollapsed.add(id);
 renderManualSequence();
 if(keepFocus){
  const root=Array.from($('goSequenceTrack').querySelectorAll('.goSequenceRoot')).find(function(item){return item.dataset.rootId===id;});
  if(root)root.querySelector('.goSequenceFold').focus({preventScroll:true});
 }
}
function updateGoSequencePlayback(time){
 const root=manualCurrent()||manualRootAtTime(time),group=root&&goSequenceGroups.get(root.id);
 const previousGroup=goSequencePlaybackGroup,previousIndex=goSequencePlaybackIndex,previousTime=goSequencePlaybackTime;
 let index=-1;
 if(editBlockPreview)index=group?.findIndex(({block})=>block.dataset.cueId===editBlockPreview.cueId)??-1;
 else if(group){
  for(let i=0;i<group.length&&group[i].time<=time+.0001;i++)index=i;
 }
 if(previousGroup!==group||previousIndex!==index){
  if(previousGroup&&previousGroup!==group)for(const {block} of previousGroup){
   block.classList.remove('goSequenceActive','goSequencePlayed');
  }
  if(group)group.forEach(({block},i)=>{
   block.classList.toggle('goSequenceActive',i===index);
   block.classList.toggle('goSequencePlayed',i<index);
  });
 }
 goSequencePlaybackGroup=group;goSequencePlaybackIndex=index;goSequencePlaybackTime=time;
 goSequencePlayhead.hidden=index<0;
 if(index<0)return;
 const view=$('goSequenceViewport'),track=$('goSequenceTrack');
 const {block,time:start}=group[index],next=group[index+1],end=next?.time??root.time+manualPlannedDuration(root);
 const progress=end>start?Math.max(0,Math.min(1,(time-start)/(end-start))):0;
 const trackLeft=track.getBoundingClientRect().left,left=block.getBoundingClientRect().left-trackLeft;
 const x=left+block.clientLeft+block.clientWidth*progress;
 block.style.setProperty('--go-played',(progress*100)+'%');
 goSequencePlayhead.style.transform='translateX('+x+'px)';
 if((transportPlaying||previousTime!==time)&&view.scrollWidth>view.clientWidth){
  const local=trackLeft+x-view.getBoundingClientRect().left;
  if(local>view.clientWidth*.86||local<0)view.scrollLeft+=local-view.clientWidth*.16;
 }
}
function manualEditSequenceVisible(){return conductType==='manual'&&!locked;}
function canReorderGoSequence(){
 return manualEditSequenceVisible()&&!transportPlaying&&!manualCurrentID&&!manualPending&&!escapeFading&&!runtimeAudio.size&&!runtimeVideo;
}
function updateGoSequenceHandles(){
 const view=$('goSequenceViewport'),ready=canReorderGoSequence();
 if(view.dataset.reorderReady===String(ready))return;
 view.dataset.reorderReady=String(ready);
 view.querySelectorAll('.goSequenceHandle').forEach(function(handle){handle.disabled=!ready;});
 cueList.querySelectorAll('.cueReplaceBtn').forEach(button=>{button.disabled=!ready;});
 $('reattachSubCues').disabled=!ready;
 $('alignShowStart').disabled=!ready;
}
function goSequenceSiblings(cue){
 if(!isManualInternalCue(cue))return manualMusics();
 const parent=cues.find(function(item){return item.id===cue.parentMusicId;});
 return manualChildren(parent);
}
function reorderGoSequence(cueId,beforeId){
 if(!canReorderGoSequence()||beforeId===cueId)return;
 const cue=cues.find(function(item){return item.id===cueId;});
 if(!cue)return;
 const child=isManualInternalCue(cue),original=goSequenceSiblings(cue),from=original.indexOf(cue);
 if(from<0)return;
 const order=original.slice();
 order.splice(from,1);
 const to=beforeId===null?order.length:order.findIndex(function(item){return item.id===beforeId;});
 if(to<0||to===from)return;
 order.splice(to,0,cue);
 pushHistory();
 if(child)assignGoChildSlots(original,order);
 else assignGoRootSlots(original,order,Math.min(from,to));
 expandedCueId=cueId;goSequenceSelected=null;
 invalidatePreflight();renderCues();scheduleAutosave();
}
function assignGoChildSlots(original,order){
 const offsets=original.map(function(cue){return Number(cue.relativeTime)||0;});
 const parent=cues.find(function(cue){return cue.id===original[0].parentMusicId;});
 const replacements=new Map();
 order.forEach(function(cue,index){
  cue.relativeTime=offsets[index];
  cue.time=roundTenth(parent.time+cue.relativeTime);
  replacements.set(original[index].id,cue);
 });
 // Stable sorting uses array order when multiple Cues share a time.
 cues=cues.map(function(cue){return replacements.get(cue.id)||cue;});
}
function assignGoRootSlots(original,order,start){
 const gaps=original.map(function(item,index){
  const previous=original[index-1];
  return previous?Math.max(0,item.time-previous.time-manualPlannedDuration(previous)):0;
 });
 let time=original[start].time;
 for(let index=start;index<order.length;index++){
  if(index>start){
   const previous=order[index-1];
   time=roundTenth(previous.time+Math.max(.1,manualPlannedDuration(previous)+gaps[index]));
  }
  order[index].time=time;
 }
}
function attachGoSequenceDrag(handle,cue){
 const view=$('goSequenceViewport'),track=$('goSequenceTrack');
 const child=isManualInternalCue(cue),group=child?cue.parentMusicId:'';
 bindCueReorderGesture(handle,()=>{
  if(!canReorderGoSequence())return null;
  const siblings=Array.from(track.querySelectorAll('.goSequenceMovable')).filter(item=>item.dataset.goGroup===group);
  const targets=siblings.filter(item=>item.dataset.goCue!==cue.id);
  if(!targets.length)return null;
  let marker=null,beforeId=null;
  const clear=()=>{marker?.classList.remove('goDropBefore','goDropAfter');marker=null;};
  const locate=x=>{
   clear();
   const target=targets.find(item=>{const box=item.getBoundingClientRect();return x<box.left+box.width/2;});
   beforeId=target?.dataset.goCue??null;
   marker=target||(child?siblings[siblings.length-1]:track.lastElementChild);
   marker?.classList.add(target?'goDropBefore':'goDropAfter');
  };
  return {
   source:handle.parentElement.querySelector('.goSequenceBlock'),valid:canReorderGoSequence,locate,clear,
   scroll(x,y){
    const bounds=view.getBoundingClientRect(),previous=view.scrollLeft;
    if(y>=bounds.top&&y<=bounds.bottom){
     const delta=x<bounds.left+36?-12:x>bounds.right-36?12:0;
     if(delta)view.scrollLeft+=delta;
    }
    return view.scrollLeft!==previous;
   },
   drop(x,y){
    const bounds=view.getBoundingClientRect();
    if(y<bounds.top-12||y>bounds.bottom+12||x<bounds.left-12||x>bounds.right+12)return;
    locate(x);clear();reorderGoSequence(cue.id,beforeId);
   }
  };
 });
 handle.onkeydown=function(event){
  if(!canReorderGoSequence()||!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||
     (event.key!=='ArrowLeft'&&event.key!=='ArrowRight'))return;
  event.preventDefault();event.stopPropagation();
  const roots=goSequenceSiblings(cue),index=roots.indexOf(cue),left=event.key==='ArrowLeft';
  if(index<0||(left?index===0:index===roots.length-1))return;
  const before=roots[index+(left?-1:2)];
  reorderGoSequence(cue.id,before?before.id:null);
  const item=Array.from(track.querySelectorAll('.goSequenceMovable')).find(function(item){return item.dataset.goCue===cue.id;});
  if(item)item.querySelector('.goSequenceHandle').focus({preventScroll:true});
 };
}
function cueNamedTrack(cue){
 const media=(cue.mediaActions||[]).filter(action=>action.kind==='audio'||action.kind==='video');
 return media.find(action=>action.kind==='audio')||(media.length===1?media[0]:null);
}
function setCueTrackName(cue,name){
 cue.name=name;
 const track=cueNamedTrack(cue);
 if(track&&name.trim())track.name=name.trim();
}
const cueRenameDialog=$('cueRenameDialog');
let cueRenameTarget=null;
function cueRenameButton(cue,className,name){
 const button=document.createElement('button');
 button.type='button';button.className=className;button.disabled=locked;
 button.title=tr('Renommer')+' · '+name;
 button.setAttribute('aria-label',button.title);
 button.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l1-5L16 4a2.8 2.8 0 0 1 4 4L9 19z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
 button.onclick=()=>{
  if(locked)return;
  cueRenameTarget=cue;
  const input=$('cueRenameName');
  input.value=cue.name;
  cueRenameDialog.showModal();input.focus();input.select();
 };
 return button;
}
$('cueRenameCancel').onclick=()=>cueRenameDialog.close();
cueRenameDialog.addEventListener('close',()=>{cueRenameTarget=null;});
$('cueRenameForm').onsubmit=event=>{
 event.preventDefault();
 const cue=cueRenameTarget,name=$('cueRenameName').value.trim();
 if(locked||!cue||!name)return;
 if(name!==cue.name||name!==cueNamedTrack(cue)?.name){
  pushHistory();setCueTrackName(cue,name);renderCues();scheduleAutosave();
 }
 cueRenameDialog.close();
};
function setSubCueTransition(cue,action,mode,seconds){
 if(locked)return;
 pushHistory();
 cue.waitForGo=mode==='go';
 if(action){
  action.transition=mode==='fade'?'fade':'cut';
  if(mode==='fade')action.fadeDuration=normalizeAutoNextFade(seconds)||3;
 }
 renderCues();scheduleAutosave();
}
function setManualCueTransition(cue,action,automatic,fade){
 if(locked)return;
 const seconds=automatic?normalizeAutoNextFade(fade):0;
 if(action.autoNext===automatic&&action.autoNextFadeSeconds===seconds)return;
 pushHistory();
 action.autoNext=automatic;action.autoNextFadeSeconds=seconds;
 renderCues(false,cue.id);renderManualSequence();scheduleAutosave();
}
const cueTransitionDialog=$('cueTransitionDialog');
let cueTransitionEdit=null;
function focusCueTransition(id,mode){
 const button=Array.from(document.querySelectorAll('.goTransition button')).find(item=>item.dataset.cue===id&&item.dataset.mode===mode);
 button?.focus({preventScroll:true});
}
cueTransitionDialog.addEventListener('close',()=>{
 if(cueTransitionEdit)focusCueTransition(cueTransitionEdit.cue.id,'fade');
 cueTransitionEdit=null;
});
$('cueTransitionForm').onsubmit=event=>{
 event.preventDefault();
 if(!cueTransitionEdit)return;
 const {cue,action,child}=cueTransitionEdit,seconds=$('cueTransitionDuration').valueAsNumber;
 if(child)setSubCueTransition(cue,action,'fade',seconds);
 else setManualCueTransition(cue,action,true,seconds);
 cueTransitionDialog.close();
};
$('cueTransitionCancel').onclick=()=>cueTransitionDialog.close();
function goSequenceConnector(previous,next,preceding){
 const arrow=document.createElement('span');
 arrow.className='goSequenceArrow';arrow.textContent='→';arrow.setAttribute('aria-hidden','true');
 const child=isManualInternalCue(preceding)&&isManualInternalCue(next)&&preceding.parentMusicId===next.parentMusicId;
 if(child){
  const parent=cues.find(cue=>cue.id===next.parentMusicId);
  const siblings=manualChildren(parent);
  if(siblings[siblings.indexOf(preceding)+1]!==next)return arrow;
 }else{
  if(!previous||!isManualMainCue(previous)||!isManualMainCue(next))return arrow;
  const roots=manualMusics();
  if(roots[roots.indexOf(previous)+1]!==next)return arrow;
 }
 const action=child?manualPrimaryAudio(next)||(next.mediaActions||[]).find(item=>item.kind==='stopAll'):
  previous.visualNumber?null:manualPrimaryAudio(previous);
 const duration=normalizeAutoNextFade(child?action?.fadeDuration:action?.autoNextFadeSeconds);
 const box=document.createElement('div');
 box.className='goTransition'+(child?' goTransitionCompact':'');
 box.setAttribute('role','group');box.setAttribute('aria-label',tr('Transition vers {cue}',{cue:next.name}));
 const active=child?(next.waitForGo?'go':action?.transition==='fade'?'fade':'auto'):
  !action?.autoNext||action.loop?'go':duration&&supportsManualCrossfade(next,manualPrimaryAudio(next))?'fade':'auto';
 const owner=child?next:previous;
 const controls=[
  ['go','Attendre un GO','Attendre un GO','M6 5h4v14H6zM14 5h4v14h-4z'],
  ['auto','Enchaîner automatiquement','Enchaîner en auto','M4 5l12 7L4 19zM18 5h3v14h-3z'],
  ['fade','Fondu enchaîné','Fondu','M3 4l18 13v3H3z']
 ];
 for(const [mode,label,shortLabel,path] of controls){
  if(mode==='auto')box.append(arrow);
  const button=document.createElement('button');button.type='button';button.dataset.mode=mode;button.dataset.cue=owner.id;
  button.setAttribute('aria-pressed',String(mode===active));
  button.title=tr(label)+(mode==='fade'&&active==='fade'?' · '+tr('Fondu {seconds} s',{seconds:duration}):'');
  button.setAttribute('aria-label',button.title);
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="'+path+'"/></svg>';
  if(!child){const text=document.createElement('span');text.textContent=tr(shortLabel);button.append(text);}
  if(!child&&mode==='fade'&&active==='fade'){
   const seconds=document.createElement('small');seconds.textContent=duration+' s';seconds.setAttribute('aria-hidden','true');button.append(seconds);
  }
  button.disabled=locked||(child?mode==='fade'&&!action:
   !action||(mode!=='go'&&(action.loop||(mode==='fade'&&!supportsManualCrossfade(next,manualPrimaryAudio(next))))));
  button.onclick=()=>{
   if(mode==='fade'){
    cueTransitionEdit={cue:owner,action,child};
    $('cueTransitionTarget').textContent=tr('Transition vers {cue}',{cue:next.name});
    $('cueTransitionDuration').value=String(duration||3);
    cueTransitionDialog.showModal();$('cueTransitionDuration').focus();
   }else{
    if(child)setSubCueTransition(owner,action,mode);
    else setManualCueTransition(owner,action,mode==='auto',0);
    focusCueTransition(owner.id,mode);
   }
  };
  box.append(button);
 }
 return box;
}
function renderManualSequence(){
 if(!manualEditSequenceVisible()){
  goSequenceSignature='';goWaveSignature='';goWaveInsertionTime=null;
  goSequencePlayhead.hidden=true;closeGoWaveChoices();return;
 }
 const view=$('goSequenceViewport'),track=$('goSequenceTrack');
 if(goSequenceEpoch!==copilotProjectEpoch){
  goSequenceEpoch=copilotProjectEpoch;lastGoBlockClick=null;goCollapsed.clear();goSequenceSelected=null;goSequenceSignature='';goSequencePlaybackTime=null;
  view.scrollLeft=0;
  goWaveStart=0;goWaveZoom=1;goWaveInsertionTime=null;goWaveCueId=null;goWaveCueSelected=false;
 }
 const all=cueViewOrder(),changedSelection=goSequenceSelected!==expandedCueId;
 if(changedSelection){
  const active=all.find(function(cue){return cue.id===expandedCueId;});
  if(active&&active.parentMusicId)goCollapsed.delete(active.parentMusicId);
 }
 const filter=cueTypeVisibility();
 const unfolded=all.filter(cue=>!isManualInternalCue(cue)||!goCollapsed.has(cue.parentMusicId));
 const order=filter?unfolded.filter(cue=>filter.visible.has(cue.id)):unfolded;
 const signature=JSON.stringify([expandedCueId,cueGroups,S2ALanguage.language,Array.from(goCollapsed),Array.from(selectedCueTypes()||[]),!!filter,customCueTypes,all.map(function(cue){
  return [cue.id,cue.name,cueDescriptionText(cue,filter?.selected),cue.time,cue.parentMusicId,cue.relativeTime,cue.waitForGo,cue.manualKind,cue.manualDuration,cue.visualNumber,rawCueTypeIds(cue),
   (cue.mediaActions||[]).map(function(action){return [action.kind,action.name,action.duration,action.inPoint,action.outPoint,action.transition,action.fadeDuration,action.overlayAudio,action.loop,action.ltcLead,action.autoNext,action.autoNextFadeSeconds];})];
 })]);
 if(signature===goSequenceSignature)return;
 goSequenceSignature=signature;
 
 const scroll=view.scrollLeft;
 goSequenceSelected=expandedCueId;
 const fragment=document.createDocumentFragment(),groups=new Map();
 let selected=null,previousGroup=null;
 const members=cueGroupMembership();
 order.forEach(function(cue,index){
  const actions=cue.mediaActions||[],media=actions.filter(function(action){return action.kind==='audio'||action.kind==='video';});
  const audio=media.some(function(action){return action.kind==='audio';}),child=isManualInternalCue(cue),visualChild=child&&isVisualNumberChild(cue);
  const group=groupForCue(cue,members);
  if(index&&!group?.folded){
   const preceding=order[index-1],previous=isManualInternalCue(preceding)?all.find(item=>item.id===preceding.parentMusicId):preceding;
   if(!groupForCue(preceding,members)?.folded)fragment.append(goSequenceConnector(previous,cue,preceding));
  }
  if(group&&group!==previousGroup)fragment.append(cueGroupHeading(group,'sequence',group.folded));
  previousGroup=group;
  if(group?.folded)return;
  const button=document.createElement('button'),kind=document.createElement('span'),name=document.createElement('strong'),timing=document.createElement('span');
  button.type='button';button.className='goSequenceBlock'+(cue.visualNumber?' isVideo':media.length&&!visualChild?(audio?' isMusic':' isVideo'):' isCue')+(child?' isChild':'');
  button.dataset.cueId=cue.id;button.dataset.sequenceRoot=child?cue.parentMusicId:cue.id;
  const groupId=button.dataset.sequenceRoot;
  if(!groups.has(groupId))groups.set(groupId,[]);
  groups.get(groupId).push({block:button,time:cue.time});
  applyGoCueColor(button,cue);applyCueGroupStyle(button,group);
  button.setAttribute('aria-pressed',String(cue.id===expandedCueId));
  kind.className='goSequenceKind';
  kind.textContent=(cue.visualNumber?tr('Numéro visuel'):media.length&&!visualChild?tr(audio?'Musique':'Vidéo'):'Cue '+cueViewNumber(cue))+' · '+manualCueLabel(cue).toUpperCase();
  name.className='goSequenceName';
  name.textContent=cue.name;
  timing.className='goSequenceTiming';
  timing.textContent=child?'+'+fmt(cue.relativeTime||0):fmt(cue.time);
  if(!child&&manualPlannedDuration(cue)>0)timing.textContent=tr('Durée {time}',{time:fmt(manualPlannedDuration(cue))});
  button.append(kind,name,timing);
  if(cueTypeIds(cue).length)button.append(cueTypeBadges(cue));
  button.classList.toggle('cueTypeContext',!!(filter&&!filter.matches.has(cue.id)));
  const details=[];
  if(!child&&actions.some(action=>action.overlayAudio))details.push(tr('Superposition'));
  actions.forEach(function(action){
   if(action.kind!=='stopAll')return;
   details.push(action.transition==='fade'?tr('Arrêt avec fondu')+' · '+tr('Fondu {seconds} s',{seconds:action.fadeDuration}):tr('Arrêt immédiat'));
  });
  const description=cueDescriptionText(cue,filter?.selected);if(description)details.push(description);
  if(details.length){
   const detail=document.createElement('span');detail.className='goSequenceDetail';
   detail.textContent=details.join(' · ');button.append(detail);
  }
  button.title=name.textContent+(details.length?' · '+details.join(' · '):'');
  const childrenCount=isManualMainCue(cue)?manualChildren(cue).length:0;
  button.onclick=function(event){
   const now=performance.now();
   if(childrenCount&&event.detail!==0&&lastGoBlockClick?.id===cue.id&&now-lastGoBlockClick.time<360){
    lastGoBlockClick=null;toggleGoSequenceGroup(cue.id,false);return;
   }
   lastGoBlockClick=childrenCount&&event.detail!==0?{id:cue.id,time:now}:null;
   selectGoSequenceCue(cue);
  };
  if(cue.id===expandedCueId)selected=button;
  if(isManualMainCue(cue)||child){
   const root=document.createElement('div'),handle=document.createElement('button');
   root.className='goSequenceMovable '+(child?'goSequenceChild':'goSequenceRoot');
   root.dataset.goCue=cue.id;root.dataset.goGroup=child?cue.parentMusicId:'';
   if(!child)root.dataset.rootId=cue.id;
   handle.type='button';handle.className='goSequenceHandle';handle.textContent='⠿';
   handle.title=tr(child?'Glisser pour réordonner dans le même média':'Glisser pour déplacer le bloc et ses Cues');
   handle.setAttribute('aria-label',handle.title+' · '+name.textContent);
   handle.setAttribute('aria-keyshortcuts','Alt+ArrowLeft Alt+ArrowRight');
   handle.disabled=!canReorderGoSequence();
   attachGoSequenceDrag(handle,cue);
   if(childrenCount){
    const fold=document.createElement('button'),folded=goCollapsed.has(cue.id);
    fold.type='button';fold.className='goSequenceFold';
    fold.textContent=folded?'▸ '+childrenCount:'▾ '+childrenCount;
    fold.title=tr(folded?'Afficher les sous-Cues':'Masquer les sous-Cues');
    fold.setAttribute('aria-label',fold.title+' · '+childrenCount);
    fold.setAttribute('aria-expanded',String(!folded));
    fold.onclick=function(){toggleGoSequenceGroup(cue.id,true);};
    root.append(fold);
   }
   if(!child)root.append(goCueColorPicker(cue,name.textContent));
   if(media.length)root.append(cueRenameButton(cue,'goSequenceRename',name.textContent));
   root.append(handle,button);fragment.append(root);
  }else fragment.append(button);
 });
 goSequenceGroups=groups;
 track.replaceChildren(goSequencePlayhead,fragment);updateGoFoldButton();
 view.scrollLeft=scroll;
 if(selected&&changedSelection)revealGoSequenceBlock(selected);
 updateGoSequencePlayback(currentTransportTime());
 renderGoWaveMarkers();
 updateCueNavigation();
}
function revealGoSequenceBlock(block){
 const view=$('goSequenceViewport'),box=block.getBoundingClientRect(),bounds=view.getBoundingClientRect();
 if(box.right>bounds.right-8)view.scrollLeft+=box.right-bounds.right+8;
 else if(box.left<bounds.left+8)view.scrollLeft+=box.left-bounds.left-8;
}
function selectGoSequenceCue(cue,fromWave=false){
 editCueSelectionRevision++;
 const group=groupForCue(cue,cueGroupMembership());
 if(group?.folded){group.folded=false;scheduleAutosave();}
 if(editBlockPreview)stopEditBlockPreview();
 if(!fromWave&&(transportPlaying||runtimeAudio.size||runtimeVideo)){
  stopAllRuntimeMedia();
  resetManualRuntime();
  pauseTransport();
 }
 goWaveInsertionTime=null;
 goWaveCueId=cue.id;goWaveCueSelected=fromWave;
 if(fromWave)goCollapsed.delete(cue.parentMusicId);
 revealGoWaveTime(cue.time);
 closeGoWaveChoices();
 expandedCueId=cue.id;
 setTransportTime(cue.time,false);
 renderCues();
 const block=Array.from($('goSequenceTrack').querySelectorAll('.goSequenceBlock')).find(item=>item.dataset.cueId===cue.id);
 if(block)revealGoSequenceBlock(block);
 renderGoWaveMarkers();
 const focusTarget=fromWave?$('goWaveMarkers').querySelector('.isSelected'):block;
 focusTarget?.focus({preventScroll:true});
}
function editGoBlocks(){
 return Array.from($('goSequenceTrack').querySelectorAll('.goSequenceBlock'),block=>block.dataset.cueId);
}
function editTimelinePosition(editor){
 const id=editor?.dataset.mediaId;
 const item=id&&allMediaActions().find(entry=>entry.action.id===id);
 if(!item)return currentTransportTime();
 const offset=(mediaPreviewPositions.get(id)??item.action.inPoint)-item.action.inPoint;
 return item.start+Math.max(0,Math.min(mediaSegmentDuration(item.action),offset));
}
async function playEditFromCue(position){
 if(locked||escapeFading||manualPending||manualPausePending)return;
 if(!manualEditSequenceVisible()){
  const ordered=orderedCues(),cue=ordered.filter(item=>item.time<=position+.0001).at(-1)||ordered[0];
  if(!cue)return;
  pauseTransport();setTransportTime(cue.time,false);
  return playTransport();
 }
 const roots=manualMusics(),root=manualRootAtTime(position,roots)||roots.filter(item=>item.time<=position+.0001).at(-1)||roots[0];
 if(!root)return;
 const cue=manualChildren(root).filter(child=>child.time<=position+.0001).at(-1)||root;
 if(cue.id!==expandedCueId)selectGoSequenceCue(cue);
 return playEditGoBlock(cue);
}
async function toggleEditTimeline(){
 if(locked||escapeFading||manualPending||manualPausePending)return;
 if(transportPlaying){pauseTransport();return;}
 if(editBlockPreview?.root)return startEditBlockMedia(editBlockPreview,true);
 const preview=editTimelinePreviewAt(currentTransportTime());
 if(preview)return beginEditPreview(preview.root,preview);
}
function editTimelinePreviewAt(time){
 const roots=manualMusics(),root=manualRootAtTime(time,roots)||roots.find(item=>item.time>time);
 return root?{root,start:time,end:root.time+manualPlannedDuration(root)}:null;
}
async function seekPlayingEditTimeline(position){
 const preview=editTimelinePreviewAt(position);
 if(!preview){
  if(editBlockPreview)stopEditBlockPreview(position);
  else{transportTime=position;pauseTransport();stopAllRuntimeMedia();}
  return;
 }
 if(manualCurrentID!==preview.root.id||!editBlockPreview)return beginEditPreview(preview.root,preview);
 // Keep the existing media element playing as its decoder seeks to the new time.
 ++seekGeneration;
 cancelAnimationFrame(rafId);rafId=0;
 editBlockPreview=preview;goWaveInsertionTime=null;
 transportTime=transportBase=lastTransportTime=position;
 transportEpoch=performance.now();
 updateTransport();
 return startEditBlockMedia(preview);
}
function editBlockMedia(cue,root){
 const start=cue.time,children=manualChildren(root);
 const end=children.find(child=>child.time>start+.0001)?.time??root.time+manualPlannedDuration(root);
 const actions=(cue.mediaActions||[]).filter(action=>action.kind==='audio'||action.kind==='video');
 const explicit=kind=>actions.filter(action=>action.kind===kind&&mediaIsActiveAt(action,0))
  .map(action=>({item:{cue,action,start},elapsed:0,gain:1}));
 const previous=[root,...children.filter(child=>child.time<start-.0001||child===cue)];
 const scope=root.visualNumber?{
  cues:previous,
  audio:visualNumberMediaScope(root).audio.filter(item=>previous.includes(item.cue)),
  video:visualNumberMediaScope(root).video.filter(item=>previous.includes(item.cue))
 }:{cues:previous,video:[]};
 if(!root.visualNumber)for(const owner of previous)for(const action of owner.mediaActions||[]){
  if(action.kind==='video')scope.video.push({cue:owner,action,start:owner.time});
 }
 const stops=(cue.mediaActions||[]).some(action=>action.kind==='stopAll');
 let audio=explicit('audio');
 if(!audio.length&&!stops){
  if(root.visualNumber)audio=audioStateAt(start,scope);
  else if(cue!==root)audio=(root.mediaActions||[]).filter(action=>action.kind==='audio'&&mediaIsActiveAt(action,start-root.time))
   .map(action=>({item:{cue:root,action,start:root.time},elapsed:start-root.time,gain:1}));
 }
 const video=explicit('video').at(-1)||(!stops?videoStateAt(start,scope):null);
 return {cueId:cue.id,start,end,audio,video};
}
function stopEditBlockPreview(at=transportTime){
 if(!editBlockPreview)return;
 editBlockPreview=null;
 manualCurrentID=null;
 transportTime=transportBase=lastTransportTime=at;
 stopAllRuntimeMedia();
 pauseTransport();
}
async function startEditBlockMedia(preview,resume=false){
 window.S2APilotDiagnostics?.step?.('play');
 checkPilotOutput();
 const generation=transportCommandGeneration;
 try{
  const audio=preview.root?visualNumberMediaScope(preview.root).audio:preview.audio;
  const context=audio.length?ensureAudioContext():null;
  transportPlaying=true;
  if(preview.root)await Promise.all([context,syncVisualNumberMedia(preview.root,transportTime,true,true,resume)]);
  else{
   const offset=transportTime-preview.start;
   const tasks=preview.audio.map(({item,elapsed,gain})=>activateAudio(item,elapsed+offset,gain,true,resume));
   if(preview.video){
    const {item,elapsed}=preview.video;
    tasks.push(activateVideo(item,elapsed+offset,true,resume));
   }
   await Promise.all([context,...tasks]);
  }
  if(editBlockPreview!==preview||generation!==transportCommandGeneration||!transportPlaying)return;
  transportBase=transportTime;transportEpoch=performance.now();
  if(!rafId)rafId=requestAnimationFrame(animationLoop);
  updateTransport();
 }catch(error){
  if(editBlockPreview!==preview||generation!==transportCommandGeneration)return;
  stopEditBlockPreview();throw error;
 }
}
function playEditGoBlock(cue){
 const root=isManualMainCue(cue)?cue:cues.find(item=>item.id===cue.parentMusicId);
 if(!root)return;
 return beginEditPreview(root,editBlockMedia(cue,root));
}
function beginEditPreview(root,preview){
 if(editBlockPreview)stopEditBlockPreview();
 else if(transportPlaying||runtimeAudio.size||runtimeVideo){pauseTransport();stopAllRuntimeMedia();}
 pauseMediaPreviews();
 manualCurrentID=null;manualPausedAt=null;manualPauseAudioPositions=null;
 manualFade=null;manualWaitCueID=null;manualWaitDeferred=[];
 goWaveInsertionTime=null;
 transportTime=transportBase=lastTransportTime=preview.start;
 if(preview.end<=preview.start||(!preview.root&&!preview.audio.length&&!preview.video)){updateTransport();return;}
 manualCurrentID=root.id;
 editBlockPreview=preview;
 return startEditBlockMedia(preview);
}
function tickEditBlockPreview(){
 const preview=editBlockPreview;
 const time=transportBase+(performance.now()-transportEpoch)/1000;
 if(time>=preview.end){stopEditBlockPreview(Math.max(preview.start,preview.end-.001));return;}
 transportTime=time;
 if(preview.root)syncVisualNumberMedia(preview.root,time,true).catch(console.warn);
 enforceMediaBounds(time);
 if(performance.now()-lastDisplayUpdate>=60){lastDisplayUpdate=performance.now();updateTransport();}
 else {updateGoWaveTransport(time);updateGoSequencePlayback(time);}
 rafId=requestAnimationFrame(animationLoop);
}
function scrollGoSequence(direction){
 const view=$('goSequenceViewport');
 view.scrollLeft+=direction*Math.max(140,view.clientWidth*.75);
}
$('editCueTypeFilter').onclick=$('liveCueTypeFilter').onclick=openCueTypeFilter;
$('cueTypeFilterClose').onclick=()=>$('cueTypeFilterDialog').close();
$('manageCueTypes').onclick=openCueTypeManager;
$('cueTypePickerClose').onclick=()=>$('cueTypePickerDialog').close();
$('cueBatchToggle').onclick=()=>{
 if(locked)return;
 cueBatchMode=!cueBatchMode;
 if(!cueBatchMode)batchCueIds.clear();
 updateCueBatchSelection();
};
$('cueBatchToggleAll').onclick=()=>{
 if(locked||!cueBatchMode)return;
 const scope=cueBatchScope(),allSelected=[...scope].every(id=>batchCueIds.has(id));
 batchCueIds.clear();
 if(!allSelected)for(const id of scope)batchCueIds.add(id);
 updateCueBatchSelection();
};
$('cueBatchAssign').onclick=()=>openCueTypePicker(cues.filter(cue=>batchCueIds.has(cue.id)),true);
$('cueGroupCreate').onclick=()=>openCueGroupDialog();
$('cueGroupCancel').onclick=()=>$('cueGroupDialog').close();
$('cueGroupDialog').addEventListener('close',()=>{cueGroupEdit=null;});
$('cueGroupForm').onsubmit=event=>{
 event.preventDefault();
 if(!cueGroupEdit||locked)return;
 const name=$('cueGroupName').value.trim();
 if(!name){$('cueGroupName').focus();return;}
 const {group,cueIds}=cueGroupEdit;
 const color=normalizeGoCueColor($('cueGroupColor').value)||'#8dbaff';
 pushHistory();
 if(group)Object.assign(group,{name,color});
 else{
  cueGroups.push({id:uuid(),name,color,cueIds,folded:false});
  cueBatchMode=false;batchCueIds.clear();
 }
 $('cueGroupDialog').close();refreshCueGroupViews();scheduleAutosave();
};
$('cueGroupRemove').onclick=()=>{
 const group=cueGroupEdit?.group;
 if(!group||locked)return;
 pushHistory();cueGroups=cueGroups.filter(item=>item!==group);liveCueGroupFolds.delete(group.id);
 $('cueGroupDialog').close();refreshCueGroupViews();scheduleAutosave();
};
$('cueTypeCreateCancel').onclick=()=>$('cueTypeCreateDialog').close();
$('goSequenceZoomOut').onclick=function(){setGoSequenceZoom(goSequenceZoom-.2);};
$('goSequenceZoomIn').onclick=function(){setGoSequenceZoom(goSequenceZoom+.2);};
$('goSequenceFoldAll').onclick=function(){
 const folded=updateGoFoldButton();
 goCollapsed.clear();
 if(!folded)manualMusics().forEach(function(cue){if(manualChildren(cue).length)goCollapsed.add(cue.id);});
 renderManualSequence();if(!transportPlaying)$('goSequenceViewport').scrollLeft=0;
};
installWaveformPinch($('goSequenceViewport'),function(factor,anchor){setGoSequenceZoom(goSequenceZoom*factor,anchor);});
$('goSequenceBack').onclick=function(){scrollGoSequence(-1);};
$('goSequenceForward').onclick=function(){scrollGoSequence(1);};
$('cueListFoldAll').onclick=()=>{
 if(!manualEditSequenceVisible())return;
 const parents=manualCueListParents();
 const unfold=allManualCueRowsFolded(parents);
 foldedManualCueRows.clear();
 if(!unfold)parents.forEach(id=>foldedManualCueRows.add(id));
 applyManualCueRowFolds();
 saveManualCueListView();
};
function bindConductModeDrag(control){
 let gesture=null, suppressClick=false;
 const clear=()=>{
  gesture=null;
  control.classList.remove('is-dragging');
  control.style.removeProperty('--conduct-pill-offset');
 };
 control.addEventListener('pointerdown',event=>{
  if(!event.isPrimary)return;
  suppressClick=false;
  const active=event.target.closest('button[aria-pressed="true"]');
  if(event.pointerType==='mouse'||!active||active.disabled)return;
  gesture={
   id:event.pointerId,x:event.clientX,y:event.clientY,
   travel:control.clientWidth/2-3,
   mode:active.dataset.mode,dragging:false
  };
 });
 const offset=event=>Math.max(0,Math.min(gesture.travel,
  (gesture.mode==='autopilot'?gesture.travel:0)+event.clientX-gesture.x));
 control.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  if(!gesture.dragging){
   const dx=Math.abs(event.clientX-gesture.x),dy=Math.abs(event.clientY-gesture.y);
   if(dy>=8&&dy>=dx){clear();return;}
   if(dx<8||dx<=dy)return;
   gesture.dragging=true;
   control.setPointerCapture(event.pointerId);
   control.classList.add('is-dragging');
  }
  control.style.setProperty('--conduct-pill-offset',offset(event)+'px');
 });
 control.addEventListener('pointerup',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  if(!gesture.dragging){clear();return;}
  const mode=offset(event)>=gesture.travel/2?'autopilot':'manual';
  suppressClick=true;
  clear();
  setConductType(mode);
 });
 control.addEventListener('pointercancel',event=>{
  if(gesture?.id===event.pointerId)clear();
 });
 control.addEventListener('lostpointercapture',event=>{
  if(event.target===control&&gesture?.id===event.pointerId)clear();
 });
 control.addEventListener('click',event=>{
  if(!suppressClick||event.detail===0)return;
  suppressClick=false;
  event.stopPropagation();
 },true);
}
function renderManualEditor(){
 if(!$('conductType')){
  const label=document.createElement('div');label.className='conductSelector editOnly';
  const modeSwitch=document.createElement('div');
  modeSwitch.id='conductType';modeSwitch.className='conductModeSwitch';modeSwitch.setAttribute('role','group');
  for(const mode of ['manual','autopilot']){
   const button=document.createElement('button');
   button.type='button';button.dataset.mode=mode;button.dataset.noI18n='true';
   button.onclick=()=>setConductType(mode);
   modeSwitch.append(button);
  }
  bindConductModeDrag(modeSwitch);
  label.append(modeSwitch);
  const titleWrap=document.querySelector('.showTitleWrap'),row=document.createElement('div');row.className='projectHeadingRow';titleWrap.before(row);row.append(titleWrap,label);
  const status=document.createElement('div');status.id='manualShowStatus';status.dataset.noI18n='true';status.setAttribute('role','status');document.querySelector('.timelineTransport').prepend(status);
 }
 updateManualStatus();renderManualSequence();updateManualCueListFoldButton();
 const music=manualMusics(),reattach=$('reattachSubCues'),align=$('alignShowStart');
 align.hidden=!manualEditSequenceVisible()||!(music[0]?.time>0);
 align.disabled=!canReorderGoSequence();
 reattach.hidden=!manualEditSequenceVisible()||!detachedSubCueGroups(music).size;
 reattach.disabled=!canReorderGoSequence();
 for(const row of cueList.querySelectorAll('.cueAccordion')){
  row.querySelector('.manualCueTools')?.remove();if(conductType!=='manual')continue;
  const c=cues.find(c=>c.id===row.dataset.cueId);if(!c)continue;
  const tools=document.createElement('div');tools.className='manualCueTools';
  if(c.visualNumber||(music.includes(c)&&c.manualKind!=='silent')){
   tools.append(tr(c.visualNumber?'Numéro visuel':'MUSIQUE · GO'));
   if(manualChildren(c).length&&!locked){
    const select=document.createElement('select');
    select.className='manualSubCueNav';select.setAttribute('aria-label',tr('Voir les sous-Cues'));
    select.onchange=()=>{
     const child=manualChildren(c).find(item=>item.id===select.value);
     if(!child)return;
     if(foldedManualCueRows.delete(c.id))saveManualCueListView();
     selectGoSequenceCue(child,true);centerEditedCue(child.id);
    };
    tools.append(select);
   }
  }else{
   const label=document.createElement('label');label.textContent=tr('Séquence :')+' ';const select=document.createElement('select');const empty=document.createElement('option');empty.value='';empty.textContent=tr('Aucune séquence');select.append(empty);for(const p of music.filter(p=>p!==c)){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;o.dataset.noI18n='true';select.append(o);}select.value=c.parentMusicId||'';select.disabled=locked||isVisualNumberChild(c);select.onchange=()=>{pushHistory();c.parentMusicId=select.value||null;const p=music.find(p=>p.id===select.value);c.relativeTime=p?Math.max(0,roundTenth(c.time-p.time)):null;if(p){delete c.manualKind;delete c.manualDuration;}else{c.manualKind='silent';c.manualDuration=180;}renderCues();scheduleAutosave();};label.append(select);tools.append(label);
   if(c.parentMusicId){const rel=document.createElement('input');rel.className='manualRelative';rel.type='text';rel.inputMode='decimal';rel.setAttribute('aria-label',tr('Temps relatif dans la musique'));rel.value=fmt(c.relativeTime||0);rel.disabled=locked||!c.parentMusicId;rel.onchange=()=>{const t=parseTime(rel.value);if(t===null||t<0){renderCues();return;}pushHistory();c.relativeTime=roundTenth(t);renderCues();scheduleAutosave();};tools.append(' + ',rel);}
  }
  if(isManualInternalCue(c)){
   const waitLabel=document.createElement('label');waitLabel.className='manualWaitOption';
   const wait=document.createElement('input');wait.type='checkbox';wait.checked=c.waitForGo===true;wait.disabled=locked;wait.setAttribute('aria-label',tr('Wait'));
   wait.onchange=()=>{pushHistory();c.waitForGo=wait.checked;renderCues();scheduleAutosave();};
   waitLabel.append(wait,document.createTextNode(tr('Wait')));waitLabel.title=tr('Mettre la bande-son en pause à cette Cue ; Espace reprend la même bande-son.');tools.append(waitLabel);
  }
  if(isManualCueEditor(c)){
   const sheet=checklistToolButton('Fiche de séquence',()=>openSequenceSheet(c));
   sheet.className='sequenceSheetButton';sheet.setAttribute('aria-haspopup','dialog');tools.append(sheet);
   const preparation=checklistToolButton('Préparation du numéro',()=>openActPreparation(c));
   preparation.className='actPreparationCueButton';preparation.setAttribute('aria-haspopup','dialog');tools.append(preparation);
  }
  row.querySelector('.cueDetails').prepend(tools);
 }
}

function minimumTimelineZoom(){return Math.max(1,projectDuration()/TIMELINE_WINDOW_SECONDS);}
function applyTimelineWindow(){
 generalTimelineZoom=locked?1:minimumTimelineZoom()*timelineZoomFactor;
 if(locked)generalTimelineViewport.scrollLeft=0;
 timeline.style.width=(generalTimelineZoom*100)+'%';
 timeline.style.touchAction=conductType!=='manual'&&generalTimelineZoom>1?'pan-x pan-y':'pan-y';
 generalTimelineViewport.classList.toggle('hasManualOverflow',generalTimelineZoom>1);
 updateGeneralZoomControls();
}
// Reframe before the playhead reaches the edge, including after a seek or GO.
let timelineFollowGesture=false;
timeline.addEventListener('pointerdown',()=>{timelineFollowGesture=true;},true);
for(const type of ['pointerup','pointercancel'])window.addEventListener(type,()=>{if(!timelineFollowGesture)return;timelineFollowGesture=false;requestAnimationFrame(()=>followTimelinePlayhead(currentTransportTime()));});
function followTimelinePlayhead(t){
 const view=generalTimelineViewport,width=view.clientWidth,total=timeline.clientWidth;
 if(width<=0||total<=width+1||performance.now()<timelinePinchUntil||timelineFollowGesture||manualTimelinePan||manualTimelineTouches.size||timeline.querySelector('.dragging'))return;
 const x=Math.max(0,Math.min(total,t/Math.max(.1,projectDuration())*total)),left=view.scrollLeft;
 if(x>left+width*.85||x<left+width*.05)view.scrollLeft=Math.max(0,Math.min(total-width,x-width*.2));
}
function centerTimelineCue(id){if(!id)return;const cue=cues.find(c=>c.id===id);if(!cue)return;applyTimelineWindow();const x=cue.time/Math.max(.1,projectDuration())*timeline.clientWidth,view=generalTimelineViewport;view.scrollLeft=Math.max(0,x-view.clientWidth/2);}
// Track both contacts before marker/transport handlers so a two-finger pan cancels selection.
generalTimelineViewport.addEventListener('pointerdown',e=>{
 if(conductType!=='manual'||e.pointerType!=='touch')return;
 manualTimelineTouches.set(e.pointerId,{x:e.clientX,target:e.target});
 if(manualTimelineTouches.size===1)manualPanOrigin={time:currentTransportTime(),at:performance.now(),playing:transportPlaying,armedID:manualArmedID,armExplicit:manualArmExplicit};
 if(manualTimelineTouches.size===2){
  manualTimelinePan=true;const contacts=[...manualTimelineTouches.values()];manualPanOrigin={...manualPanOrigin,x:(contacts[0].x+contacts[1].x)/2,scroll:generalTimelineViewport.scrollLeft};
  for(const [id,contact] of manualTimelineTouches){const cancel=new Event('pointercancel',{bubbles:true});cancel.pointerId=id;cancel.pointerType='touch';cancel.s2aPanCancellation=true;contact.target.dispatchEvent(cancel);if(contact.target.hasPointerCapture?.(id))contact.target.releasePointerCapture(id);}
  if(manualPanOrigin.sought){seekManualTransport(manualPanOrigin.time+(manualPanOrigin.playing?(performance.now()-manualPanOrigin.at)/1000:0)).catch(console.warn);manualArmedID=manualPanOrigin.armedID;manualArmExplicit=manualPanOrigin.armExplicit;showOverviewSignature='';updateTransport();}
 }
},true);
generalTimelineViewport.addEventListener('pointermove',e=>{
 if(!manualTimelineTouches.has(e.pointerId))return;manualTimelineTouches.get(e.pointerId).x=e.clientX;
 if(manualTimelinePan&&manualTimelineTouches.size>=2){e.preventDefault();const contacts=[...manualTimelineTouches.values()];generalTimelineViewport.scrollLeft=manualPanOrigin.scroll-((contacts[0].x+contacts[1].x)/2-manualPanOrigin.x);}
},true);
const endManualTimelineTouch=e=>{if(e.s2aPanCancellation)return;manualTimelineTouches.delete(e.pointerId);if(!manualTimelineTouches.size){manualTimelinePan=false;manualPanOrigin=null;}};
window.addEventListener('pointerup',endManualTimelineTouch);window.addEventListener('pointercancel',endManualTimelineTouch);

const pilotAudioDevices=navigator.mediaDevices;
const pilotAudioContextClass=window.AudioContext||window.webkitAudioContext;
const pilotOutputKey='s2a-pilot-audio-output';
let pilotOutputId='',pilotOutputName='',pilotOutputReady=true,pilotOutputChanging=false,pilotOutputMessage='';
let pilotOutputs=[],pilotOutputChangeTask=null,pilotOutputTest=null,pilotOutputRetry=null;
let ltcTestSettings={duration:3,startFrame:3600*LTC_FPS};
try{
 const saved=JSON.parse(localStorage.getItem('s2a-pilot-ltc-test')||'null');
 if(Number.isInteger(saved?.duration)&&saved.duration>=1&&saved.duration<=60){
  ltcTestSettings={duration:saved.duration,startFrame:normalizeLtcStartFrame(saved.startFrame)};
 }
}catch(error){}
const pilotElementRoutes=new WeakMap();
try{
 const saved=JSON.parse(localStorage.getItem(pilotOutputKey)||'null');
 if(typeof saved?.id==='string'&&saved.id){pilotOutputId=saved.id;pilotOutputName=String(saved.name||'');pilotOutputReady=false;}
}catch(error){}

function pilotOutputSupported(){
 return !!(window.isSecureContext&&pilotAudioDevices?.enumerateDevices&&
  pilotAudioContextClass?.prototype.setSinkId&&window.HTMLMediaElement?.prototype.setSinkId);
}
function pilotOutputInUse(){
 return !!pilotOutputTest||transportPlaying||spaceTransportPending||manualPending||manualPausePending||escapeFading||
  [...runtimeAudio.values()].some(track=>!track.el.paused)||!!(runtimeVideo&&!runtimeVideo.el.paused)||
  [...mediaPreviewSessions.values()].some(session=>session.running||session.pendingPlay);
}
function renderPilotOutput(){
 if($('showCheckDialog').open)renderShowCheck();
 const select=$('pilotAudioOutput'),access=$('pilotAudioOutputAccess'),supported=pilotOutputSupported();
 select.replaceChildren(new Option(tr('Sortie système'),''));
 pilotOutputs.forEach((device,index)=>{
  const option=new Option(device.label||tr('Sortie audio {number}',{number:index+1}),device.deviceId);
  option.dataset.noI18n='true';select.append(option);
 });
 if(pilotOutputId&&!pilotOutputs.some(device=>device.deviceId===pilotOutputId)){
  const option=new Option(pilotOutputName||tr('Carte son sélectionnée'),pilotOutputId);
  option.dataset.noI18n='true';select.append(option);
 }
 select.value=pilotOutputId;
 select.disabled=(!supported&&!pilotOutputId)||pilotOutputChanging||!!pilotOutputTest;
 access.hidden=!supported||!(pilotAudioDevices.selectAudioOutput||pilotAudioDevices.getUserMedia);
 access.disabled=pilotOutputChanging||!!pilotOutputTest;
 const testDisabled=!supported||!pilotOutputId||!pilotOutputReady||pilotOutputChanging||!!pilotOutputTest;
 for(const id of ['pilotAudioOutputTest','pilotAudioOutputLeft','pilotAudioOutputRight','pilotAudioOutputLtc'])$(id).disabled=testDisabled;
 $('pilotAudioOutputHint').textContent=tr(!supported?'Ce navigateur ne permet pas de séparer toute la sortie audio de Pilot.':pilotAudioDevices.selectAudioOutput?'Choisissez une sortie pour Pilot.':'Si la carte son ne figure pas dans la liste, autorisez la détection. Le navigateur peut demander l’accès au micro pour afficher les sorties.');
 $('pilotAudioOutputStatus').textContent=pilotOutputMessage?tr(pilotOutputMessage):
  pilotOutputId?(pilotOutputReady?tr('Sortie Pilot indépendante active.'):tr('Sortie Pilot indisponible. Choisissez une sortie avant de lancer la lecture.')):tr('Pilot utilise la sortie système.');
}
function markPilotOutputUnavailable(){
 if(!pilotOutputId||!pilotOutputReady)return;
 pilotOutputReady=false;
 stopPilotOutputTest();
 pilotOutputMessage='Sortie Pilot déconnectée. Lecture suspendue.';
 if(conductType==='manual'&&manualCurrentID&&!editBlockPreview){
  manualPausedAt=performance.now();
  manualPauseAudioPositions=new Map([...runtimeAudio.values()].map(track=>[track,track.el.currentTime]));
 }
 pauseMediaPreviews();
 pauseTransport();
 renderPilotOutput();
}
function pilotOutputContext(){
 if(!audioContext){
  audioContext=new pilotAudioContextClass();
  audioContext.addEventListener?.('sinkchange',()=>{
   if(!pilotOutputChanging&&pilotOutputReady&&pilotOutputId&&audioContext.sinkId!==pilotOutputId)markPilotOutputUnavailable();
  });
 }
 return audioContext;
}
function checkPilotOutput(){
 if(pilotOutputChanging||!pilotOutputReady||(pilotOutputId&&audioContext?.sinkId!==pilotOutputId)){
  throw new Error(tr('Sortie Pilot indisponible. Choisissez une sortie avant de lancer la lecture.'));
 }
}
function routePilotElement(el,id=pilotOutputId){
 const queued=pilotElementRoutes.get(el);
 if(!queued&&((!id&&!el.sinkId)||el.sinkId===id))return Promise.resolve();
 const task=(queued||Promise.resolve()).catch(()=>{}).then(()=>{
  if(el.sinkId!==id)return el.setSinkId(id);
 });
 pilotElementRoutes.set(el,task);
 const clear=()=>{if(pilotElementRoutes.get(el)===task)pilotElementRoutes.delete(el);};
 task.then(clear,clear);
 return task;
}
function choosePilotOutput(id,name='',restore=false,authorize=false){
 if(pilotOutputChangeTask)return pilotOutputChangeTask;
 const task=applyPilotOutput(id,name,restore,authorize);
 pilotOutputChangeTask=task;
 const clear=()=>{if(pilotOutputChangeTask===task)pilotOutputChangeTask=null;};
 task.then(clear,clear);
 return task;
}
async function applyPilotOutput(id,name,restore,authorize){
 if(pilotOutputChanging)return;
 if(!restore&&pilotOutputInUse()){
  pilotOutputMessage='Mettez la lecture en pause avant de changer la sortie audio.';
  renderPilotOutput();return;
 }
 if(!pilotOutputSupported()){
  if(!id){pilotOutputId='';pilotOutputName='';pilotOutputReady=true;pilotOutputMessage='';try{localStorage.removeItem(pilotOutputKey);}catch(error){}}
  renderPilotOutput();return;
 }
 const previous=pilotOutputId,wasReady=pilotOutputReady;
 const elements=[...preparedMedia.values()].map(record=>record.el).concat([...mediaPreviewSessions.values()].map(session=>session.el));
 let context=null,channelCount=2,stream=null,authorizing=authorize;
 pilotOutputChanging=true;pilotOutputMessage='';renderPilotOutput();
 try{
  if(authorize){
   if(pilotAudioDevices.selectAudioOutput){
    const device=await pilotAudioDevices.selectAudioOutput(id?{deviceId:id}:undefined);
    id=device.deviceId;name=device.label;
    await refreshPilotOutputs();
   }else{
    stream=await pilotAudioDevices.getUserMedia({audio:true});
    await refreshPilotOutputs();
    if(!id)return;
   }
   authorizing=false;
  }
  context=pilotOutputContext();
  channelCount=context.destination.channelCount;
  for(const rec of preparedMedia.values()){const route=ltcRoutes.get(rec.el);if(route)route.ltc.gain.value=0;}
  // LTC playback and tests enable their extra channels only when needed.
  if(channelCount>2)context.destination.channelCount=2;
  if(context.sinkId!==id)await context.setSinkId(id);
  const needsLtc=allMediaActions().some(item=>ltcPreparationKey(item));
  if(needsLtc&&!ltcOffline&&context.destination.maxChannelCount>=4)context.destination.channelCount=4;
  await Promise.all(elements.map(el=>routePilotElement(el,id)));
  pilotOutputId=id;pilotOutputName=name;pilotOutputReady=true;pilotOutputRetry=null;
  try{
   if(id)localStorage.setItem(pilotOutputKey,JSON.stringify({id,name}));
   else localStorage.removeItem(pilotOutputKey);
  }catch(error){}
  syncExternalVideo(true);
  scheduleMediaMaintenance();
 }catch(error){
  if(context)pilotOutputReady=false;
  if(context&&wasReady){
   try{
    if(context&&context.sinkId!==previous)await context.setSinkId(previous);
    if(context&&context.destination.maxChannelCount>=channelCount)context.destination.channelCount=channelCount;
    await Promise.all(elements.map(el=>routePilotElement(el,previous)));
    pilotOutputReady=true;
   }catch(rollbackError){window.S2APilotDiagnostics?.report('media',rollbackError);}
  }
  if(id)pilotOutputRetry={id,name};
  pilotOutputMessage=authorizing?'Accès aux sorties audio refusé ou indisponible.':
   error.name==='LtcChannelError'?'Le LTC exige une sortie audio avec au moins quatre canaux.':
   error.name==='NotAllowedError'?'Sortie audio non autorisée. Cliquez sur « Détecter les sorties » pour réessayer.':
   error.name==='NotFoundError'?'Sortie audio introuvable. Rebranchez la carte son puis cliquez sur « Détecter les sorties ».':
   'Impossible de sélectionner cette sortie. Vérifiez le branchement et les autorisations.';
 }finally{
  if(stream)stream.getTracks().forEach(track=>track.stop());
  pilotOutputChanging=false;ltcUnavailableActions.clear();reconcilePreparedMedia();updateLtcRouting();renderPilotOutput();
 }
}
async function refreshPilotOutputs(deviceChanged=false){
 if(!pilotOutputSupported()){renderPilotOutput();return;}
 try{
  const devices=await pilotAudioDevices.enumerateDevices();
  pilotOutputs=devices.filter(device=>device.kind==='audiooutput'&&device.deviceId&&device.deviceId!=='default'&&device.deviceId!=='communications');
  if(deviceChanged&&pilotOutputId&&!pilotOutputChanging){
   const device=pilotOutputs.find(item=>item.deviceId===pilotOutputId);
   if(!device)markPilotOutputUnavailable();
   else if(!pilotOutputReady)await choosePilotOutput(device.deviceId,device.label,true);
  }
 }catch(error){window.S2APilotDiagnostics?.report('media',error);}
 renderPilotOutput();
}
function authorizePilotOutputs(){
 if(!pilotOutputSupported())return;
 const retry=pilotOutputRetry;
 const nativePicker=pilotAudioDevices.selectAudioOutput;
 return choosePilotOutput(retry?.id||(nativePicker?pilotOutputId:''),retry?.name||pilotOutputName,false,true);
}
$('ltcOffline').onchange=event=>{if(pilotOutputInUse()){event.target.checked=ltcOffline;return;}ltcOffline=event.target.checked;ltcUnavailableActions.clear();for(const rec of preparedMedia.values()){const route=ltcRoutes.get(rec.el);if(route)route.ltc.gain.value=0;}reconcilePreparedMedia();invalidatePreflight();scheduleMediaMaintenance(0);updateLtcRouting();};
$('pilotAudioOutput').onchange=event=>{
 const id=event.currentTarget.value;
 pilotOutputRetry=null;
 choosePilotOutput(id,pilotOutputs.find(device=>device.deviceId===id)?.label||'');
};
$('pilotAudioOutputAccess').onclick=authorizePilotOutputs;
function stopPilotOutputTest(test=pilotOutputTest){
 if(!test||pilotOutputTest!==test)return;
 pilotOutputTest=null;
 if(test.source){
  test.source.onended=null;
  try{test.source.stop();}catch(error){}
  test.source.disconnect();
 }
 test.gain?.disconnect();
 test.merger?.disconnect();
 if(test.previousChannelCount!==null){
  const destination=audioContext.destination;
  if(test.previousChannelCount<=destination.maxChannelCount)destination.channelCount=test.previousChannelCount;
 }
 renderPilotOutput();
}
async function playPilotOutputTest(channel=null){
 if(!pilotOutputSupported()||!pilotOutputId||!pilotOutputReady||pilotOutputChanging||pilotOutputTest)return;
 if(pilotOutputInUse()){
  pilotOutputMessage='Mettez la lecture en pause avant de tester la sortie.';
  renderPilotOutput();return;
 }
 const test={id:pilotOutputId,source:null,gain:null,merger:null,previousChannelCount:null};
 pilotOutputTest=test;
 pilotOutputMessage=channel===2?'Envoi du LTC de test…':'Lecture du son de test…';
 renderPilotOutput();
 try{
  checkPilotOutput();
  const context=await ensureAudioContext();
  if(pilotOutputTest!==test)return;
  checkPilotOutput();
  if(context.sinkId!==test.id)throw new Error('audio-output-changed');
  if(channel===2){
   await playPilotLtcTest(context,test);
   return;
  }
  if(channel!==null&&(context.destination.maxChannelCount<2||context.destination.channelCount<2)){
   pilotOutputMessage='Cette sortie doit être en stéréo pour tester gauche et droite séparément.';
   stopPilotOutputTest(test);return;
  }
  const tone=test.source=context.createOscillator(),gain=test.gain=context.createGain();
  const now=context.currentTime;
  tone.frequency.value=440;
  gain.gain.setValueAtTime(0,now);
  gain.gain.linearRampToValueAtTime(.04,now+.025);
  gain.gain.setValueAtTime(.04,now+.16);
  gain.gain.linearRampToValueAtTime(0,now+.24);
  tone.connect(gain);
  const channels=context.destination.channelCount;
  if(channel===null&&channels<2)gain.connect(context.destination);
  else{
   // Only the first two outputs carry the test, including on a four-channel LTC device.
   const merger=test.merger=context.createChannelMerger(channels);
   if(channel!==1)gain.connect(merger,0,0);
   if(channel!==0)gain.connect(merger,0,1);
   merger.connect(context.destination);
  }
  tone.onended=()=>{
   if(pilotOutputTest!==test)return;
   pilotOutputMessage=channel===0?'Son de test envoyé à gauche.':
    channel===1?'Son de test envoyé à droite.':'Son de test envoyé à la sortie sélectionnée.';
   stopPilotOutputTest(test);
  };
  tone.start(now);tone.stop(now+.24);
 }catch(error){
  if(pilotOutputTest!==test)return;
  pilotOutputMessage=channel===2?'Impossible de jouer le LTC sur cette sortie.':'Impossible de jouer le son de test sur cette sortie.';
  stopPilotOutputTest(test);
 }
}
$('pilotAudioOutputTest').onclick=()=>playPilotOutputTest();
$('pilotAudioOutputLeft').onclick=()=>playPilotOutputTest(0);
$('pilotAudioOutputRight').onclick=()=>playPilotOutputTest(1);
const ltcTestDuration=$('pilotLtcTestDuration'),ltcTestStart=$('pilotLtcTestStart');
ltcTestDuration.value=String(ltcTestSettings.duration);
ltcTestStart.value=formatLtcAddress(ltcTestSettings.startFrame);
ltcTestStart.oninput=()=>ltcTestStart.setCustomValidity('');
$('pilotAudioOutputLtc').onclick=()=>{
 const duration=ltcTestDuration.valueAsNumber,startFrame=parseLtcAddress(ltcTestStart.value);
 if(startFrame===null)ltcTestStart.setCustomValidity(tr('Adresse LTC invalide (HH:MM:SS:II, images de 00 à 24).'));
 if(!ltcTestDuration.reportValidity()||!ltcTestStart.reportValidity())return;
 ltcTestSettings={duration,startFrame};
 try{localStorage.setItem('s2a-pilot-ltc-test',JSON.stringify(ltcTestSettings));}catch(error){}
 playPilotOutputTest(2);
};
async function playPilotLtcTest(context,test){
 const destination=context.destination;
 if(destination.maxChannelCount<4){
  pilotOutputMessage='Le LTC exige une sortie audio avec au moins quatre canaux.';
  stopPilotOutputTest(test);return;
 }
 const {duration,startFrame}=ltcTestSettings;
 const buffer=context.createBuffer(1,duration*context.sampleRate,context.sampleRate);
 const isCurrent=()=>pilotOutputTest===test;
 const wave=await createLtcWave(buffer,0,duration,startFrame,isCurrent);
 const pcm=new Int16Array(await wave.arrayBuffer(),68);
 if(!isCurrent())return;
 checkPilotOutput();
 const signal=buffer.getChannelData(0);
 for(let i=0;i<signal.length;i++)signal[i]=pcm[i*4+2]/32768;
 if(destination.channelCount!==4){
  test.previousChannelCount=destination.channelCount;
  ltcOutputContext();
 }
 const source=test.source=context.createBufferSource(),merger=test.merger=context.createChannelMerger(4);
 source.buffer=buffer;
 source.connect(merger,0,2);
 merger.connect(destination);
 source.onended=()=>{
  if(!isCurrent())return;
  pilotOutputMessage='LTC de test envoyé sur le canal 3.';
  stopPilotOutputTest(test);
 };
 source.start();
}
shortcutDialog.addEventListener('close',()=>{
 if(pilotOutputTest){pilotOutputMessage='';stopPilotOutputTest();}
});
pilotAudioDevices?.addEventListener?.('devicechange',()=>refreshPilotOutputs(true));
window.addEventListener('s2a-language-change',renderPilotOutput);

if(pilotOutputId&&pilotOutputSupported())choosePilotOutput(pilotOutputId,pilotOutputName,true);
refreshPilotOutputs();
ensureBaseCueInvariant();renderCues();applyLockState();updatePreflightUI();updateDurationEditor();const workspaceStartup=startup();



$('addMediaGlobalBtn').addEventListener('click',()=>{if(!locked)$('globalMediaFile').click();});
$('globalMediaFile').addEventListener('change',event=>{
 const input=event.currentTarget,files=Array.from(input.files||[]);
 input.value='';
 importGlobalMedia(files).catch(reportTransportError);
});

function closeGoWaveChoices(){
 const panel=$('goWaveChoices');
 panel.hidden=true;panel.replaceChildren();
 if(openGoWaveCluster)openGoWaveCluster.setAttribute('aria-expanded','false');
 openGoWaveCluster=null;
}
function goWaveWindow(){
 const duration=projectDuration(),maxZoom=Math.max(1,duration);
 const zoom=Math.max(1,Math.min(maxZoom,goWaveZoom)),span=duration/zoom;
 const start=Math.max(0,Math.min(duration-span,goWaveStart));
 return {duration,start,span,end:start+span,zoom,maxZoom};
}
function refreshGoWaveWindow(){
 if(goWaveFrame)return;
 goWaveFrame=requestAnimationFrame(()=>{
  goWaveFrame=0;
  if(manualEditSequenceVisible())renderGoWaveOverview();
 });
}
function zoomGoWave(factor,anchor){
 const width=$('goWaveTrack').clientWidth;
 if(!width)return;
 const view=goWaveWindow(),position=transportPlaying?currentTransportTime():(goWaveInsertionTime??cues.find(cue=>cue.id===expandedCueId)?.time??currentTransportTime());
 const fraction=anchor==null?(view.span>0&&position>=view.start&&position<=view.end?(position-view.start)/view.span:.5):anchor/width;
 goWaveZoom=Math.max(1,Math.min(view.maxZoom,view.zoom*factor));
 goWaveStart=Math.max(0,Math.min(view.duration-view.duration/goWaveZoom,view.start+fraction*(view.span-view.duration/goWaveZoom)));
 refreshGoWaveWindow();
}
function revealGoWaveTime(time){
 const view=goWaveWindow();
 if(time>=view.start&&time<=view.end)return;
 goWaveStart=Math.max(0,Math.min(view.duration-view.span,time-view.span/2));
 refreshGoWaveWindow();
}
function centerGoWaveTime(time,view=goWaveWindow()){
 const start=Math.max(0,Math.min(view.duration-view.span,time-view.span/2));
 if(start===view.start)return;
 goWaveStart=start;
 renderGoWaveOverview();
}
function updateGoWaveTransport(time){
 const view=goWaveWindow();
 // Page the waveform before the cursor reaches the edge, without rebuilding its markers on every frame.
 if(transportPlaying&&goWaveScrubTime===null&&!goWaveCapturedPointers.size&&view.zoom>1&&(time<view.start||time>view.start+view.span*.85))centerGoWaveTime(time,view);
 updateGoWavePlayhead(time);
}
function updateGoWavePlayhead(time=currentTransportTime()){
 const view=goWaveWindow(),cursor=$('goWavePlayhead');
 if(goWaveScrubTime!==null)time=goWaveScrubTime;
 cursor.hidden=!view.span||time<view.start||time>view.end;
 if(!cursor.hidden)cursor.style.left=(time-view.start)/view.span*100+'%';
}
function goWaveLabel(cue,time=cue.time){return 'Cue '+cueViewNumber(cue)+' · '+fmt(time)+' · '+cue.name;}
function bindGoWaveDrag(button,id){
 button.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.isPrimary===false||!manualEditSequenceVisible())return;
  const cue=cues.find(item=>item.id===id),parent=cues.find(item=>item.id===cue?.parentMusicId);
  const main=cue&&isManualMainCue(cue);
  if(!cue||(main?!canReorderGoSequence():!parent))return;
  const pointer=event.pointerId,startX=event.clientX,epoch=copilotProjectEpoch;
  const track=$('goWaveTrack'),preview=$('goWaveDragPreview'),view=goWaveWindow(),bounds=track.getBoundingClientRect();
  const parentTime=main?0:parent.time,limit=main?view.duration:manualPlannedDuration(parent);
  if(!bounds.width)return;
  const original=roundTenth(cue.time-parentTime);
  let moving=false,offset=original;
  track.setPointerCapture(pointer);
  function move(e){
   if(e.pointerId!==pointer)return;
   const dx=e.clientX-startX;
   if(!moving&&Math.abs(dx)<4)return;
   moving=true;
   offset=Math.max(0,Math.min(limit,roundTenth(original+dx/bounds.width*view.span)));
   const time=parentTime+offset;
   preview.hidden=false;preview.style.left=Math.max(0,Math.min(100,(time-view.start)/view.span*100))+'%';
   preview.firstElementChild.textContent=fmt(time);
  }
  function finish(e){
   if(e.pointerId!==pointer)return;
   if(e.type==='pointerup'&&moving)move(e);
   track.removeEventListener('pointermove',move);
   track.removeEventListener('pointerup',finish);
   track.removeEventListener('pointercancel',finish);
   track.removeEventListener('lostpointercapture',finish);
   preview.hidden=true;
   if(!moving){
    // Capture retargets the final click to the track. Keep it a marker selection.
    if(e.type==='pointerup'){suppressGoWaveClick();selectGoSequenceCue(cue,true);}
    return;
   }
   suppressGoWaveClick();
   if(e.type!=='pointerup'||epoch!==copilotProjectEpoch||!manualEditSequenceVisible()||!cues.includes(cue)||(main?!canReorderGoSequence():cue.parentMusicId!==parent.id))return;
   if(offset!==original){
    pushHistory();
    if(!main)cue.relativeTime=offset;
    cue.time=roundTenth(parentTime+offset);
    invalidatePreflight();scheduleAutosave();
   }
   selectGoSequenceCue(cue,true);
  }
  track.addEventListener('pointermove',move);
  track.addEventListener('pointerup',finish);
  track.addEventListener('pointercancel',finish);
  track.addEventListener('lostpointercapture',finish);
 });
}
function suppressGoWaveClick(){
 skipGoWaveClick=true;
 setTimeout(()=>{skipGoWaveClick=false;},0);
}
function cueMarkerColors(){
 return new Map([...defaultCueTypes,...customCueTypes].filter(type=>type.id!=='none').map(type=>[type.id,type.color]));
}
function paintCueTimelineMarker(marker,cue,main,typeColors){
 if(main){marker.style.backgroundColor=normalizeGoCueColor(cue.goColor)||'#ffd166';return;}
 const colors=cueTypeIds(cue).map(id=>typeColors.get(id));
 marker.style.backgroundColor=colors[0]||'#fff';
 if(colors.length>1)marker.style.backgroundImage='conic-gradient('+colors.map((color,i)=>color+' '+i/colors.length*100+'% '+(i+1)/colors.length*100+'%').join(',')+')';
}
function renderGoWaveMarkers(){
 if(!manualEditSequenceVisible())return;
 const track=$('goWaveTrack'),width=track.clientWidth,view=goWaveWindow(),filter=cueTypeVisibility();
 const ordered=orderedCues().filter(cue=>!filter||filter.visible.has(cue.id));
 if(!width)return;
 $('goWaveZoomOut').disabled=view.zoom<=1.001;
 $('goWaveZoomIn').disabled=view.zoom>=view.maxZoom-.001;
 const signature=JSON.stringify([copilotProjectEpoch,S2ALanguage.language,width,view.start,view.span,goWaveCueSelected?goWaveCueId:null,customCueTypes,ordered.map(cue=>[cue.id,cue.name,cue.time,cue.parentMusicId,isManualMainCue(cue),cue.goColor,rawCueTypeIds(cue)])]);
 const host=$('goWaveMarkers');
 if(signature!==goWaveMarkerSignature){
  goWaveMarkerSignature=signature;goWaveButtons=new Map();closeGoWaveChoices();
  const typeColors=cueMarkerColors();
  const fragment=document.createDocumentFragment();
  for(const main of [true,false]){
   const clusters=[];
   for(const cue of ordered){
    if(isManualMainCue(cue)!==main||cue.time<view.start-.0001||cue.time>view.end+.0001)continue;
    const x=(cue.time-view.start)/view.span*100,last=clusters[clusters.length-1];
    const landmark=document.createElement('span');
    landmark.className='goWaveLandmark'+(main?' isMain':'');
    landmark.setAttribute('aria-hidden','true');landmark.style.left=x+'%';
    paintCueTimelineMarker(landmark,cue,main,typeColors);
    fragment.append(landmark);
    if(last&&(x-last.x)*width/100<20){last.cues.push(cue);last.lastX=x;}
    else clusters.push({x,lastX:x,cues:[cue]});
   }
   for(const cluster of clusters){
    const button=document.createElement('button'),multiple=cluster.cues.length>1;
    button.type='button';button.className='goWaveMarker'+(main?' isMain':'')+(multiple?' isCluster':'');
    button.style.left=(cluster.x+cluster.lastX)/2+'%';
    if(multiple){
     button.style.width=Math.max(20,(cluster.lastX-cluster.x)*width/100+8)+'px';
     button.title=tr('Cues à proximité');
     button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','goWaveChoices');
    }else button.title=goWaveLabel(cluster.cues[0]);
    button.setAttribute('aria-label',button.title);
    button.onclick=function(){
     if(skipGoWaveClick)return;
     if(!multiple){selectGoSequenceCue(cluster.cues[0],true);return;}
     const wasOpen=openGoWaveCluster===button;
     closeGoWaveChoices();
     if(wasOpen)return;
     openGoWaveCluster=button;button.setAttribute('aria-expanded','true');
     const panel=$('goWaveChoices');
     for(const cue of cluster.cues){
      const choice=document.createElement('button');choice.type='button';choice.textContent=goWaveLabel(cue);
      choice.onclick=()=>selectGoSequenceCue(cue,true);
      panel.append(choice);
     }
     panel.hidden=false;panel.firstElementChild.focus({preventScroll:true});
    };
    if(!multiple)bindGoWaveDrag(button,cluster.cues[0].id);
    for(const cue of cluster.cues)goWaveButtons.set(cue.id,button);
    fragment.append(button);
    // After choosing a crowded cue, provide its own drag target at the exact time.
    const selected=goWaveCueSelected&&multiple&&cluster.cues.find(cue=>cue.id===goWaveCueId);
    if(selected){
     const handle=document.createElement('button');
     handle.type='button';handle.className='goWaveMarker goWaveDragHandle'+(main?' isMain':'');
     handle.style.left=(selected.time-view.start)/view.span*100+'%';
     handle.title=goWaveLabel(selected);handle.setAttribute('aria-label',handle.title);
     handle.onclick=()=>{if(!skipGoWaveClick)selectGoSequenceCue(selected,true);};
     bindGoWaveDrag(handle,selected.id);
     goWaveButtons.set(selected.id,handle);fragment.append(handle);
    }
   }
  }
  host.replaceChildren(fragment);
 }
 const selected=ordered.find(cue=>cue.id===goWaveCueId),button=goWaveCueSelected&&selected&&goWaveButtons.get(selected.id);
 const previous=host.querySelector('.isSelected');
 if(previous&&previous!==button){previous.classList.remove('isSelected');previous.removeAttribute('aria-current');}
 if(button){button.classList.add('isSelected');button.setAttribute('aria-current','true');}
 const line=$('goWaveSelected');line.classList.toggle('isLocation',!goWaveCueSelected);line.hidden=!selected||selected.time<view.start||selected.time>view.end;
 if(!line.hidden)line.style.left=(selected.time-view.start)/view.span*100+'%';
 updateGoWavePlayhead();
}
function renderGoWaveOverview(){
 renderGoWaveMarkers();
 const canvas=$('goWaveCanvas'),view=$('goWaveTrack'),width=Math.min(2048,Math.round(view.clientWidth*Math.min(2,devicePixelRatio||1)));
 if(!width)return;
 const expanded=$('goWaveLayersToggle').getAttribute('aria-expanded')==='true';
 const range=goWaveWindow(),duration=range.duration,roots=new Map(manualMusics().map(root=>[root.id,root]));
 const laneEnds=[];
 const items=allMediaActions().filter(item=>item.action.kind==='audio'||!item.action.muted).map(item=>{
  const root=roots.get(item.cue.parentMusicId||item.cue.id);
  const slotEnd=root?root.time+manualPlannedDuration(root):duration;
  const end=root?.visualNumber?effectiveMediaEnd(item,visualNumberMediaScope(root).cues):item.start+mediaSegmentDuration(item.action);
  const clippedEnd=Math.min(duration,slotEnd,end??slotEnd);
  let lane=0;
  if(item.action.overlayAudio&&root===item.cue&&clippedEnd>item.start){
   let index=laneEnds.findIndex(laneEnd=>laneEnd<=item.start+.0001);
   if(index<0)index=laneEnds.length;
   laneEnds[index]=clippedEnd;lane=index+1;
  }
  return {...item,end:clippedEnd,lane};
 }).filter(item=>item.end>Math.max(item.start,range.start)&&item.start<range.end);
 const signature=JSON.stringify([copilotProjectEpoch,S2ALanguage.language,width,duration,range.start,range.span,expanded,laneEnds.length,items.map(({cue,action,start,end,lane})=>[action.id,action.assetKey,action.name,action.inPoint,action.outPoint,action.loop,start,end,lane,cue.goColor])]);
 if(signature===goWaveSignature)return;
 goWaveSignature=signature;
 const stack=$('goWaveLayers'),layers=[];
 stack.replaceChildren();
 $('goWaveLayersToggle').hidden=!laneEnds.length;
 stack.hidden=!expanded;
 const visibleLanes=expanded?laneEnds.length:0;
 view.style.setProperty('--go-wave-overlay-height',visibleLanes*40+'px');
 for(let i=visibleLanes;i>=1;i--){
  const row=document.createElement('div'),wave=document.createElement('canvas');
  row.className='goWaveOverlayLane';wave.setAttribute('aria-hidden','true');
  row.append(wave);stack.append(row);
  layers[i]={row,wave,peaks:new Float32Array(width)};
 }
 const base=new Float32Array(width);
 const missing=items.find(({action})=>!mediaVisualCache.has(action.id));
 if(missing&&!goWaveDecoding){
  goWaveDecoding=true;
  generateMediaWaveform(missing.action,document.createElement('canvas'),{hidden:true,textContent:''}).finally(()=>{
   goWaveDecoding=false;goWaveSignature='';refreshGoWaveWindow();
  });
 }
 for(const {cue,action,start,end,lane} of items){
  const layer=layers[lane];
  if(layer){
   const clip=document.createElement('span'),left=Math.max(range.start,start),right=Math.min(range.end,end);
   clip.className='goWaveOverlayClip';
   clip.style.left=(left-range.start)/range.span*100+'%';
   clip.style.width=(right-left)/range.span*100+'%';
   clip.style.setProperty('--overlay-color',normalizeGoCueColor(cue.goColor)||'#b9a0ff');
   clip.textContent=action.name;clip.title=tr('Superposition')+' - '+action.name;
   layer.row.append(clip);
  }
  const combined=layer?.peaks||base;
  const peaks=mediaVisualCache.get(action.id);
  if(!Array.isArray(peaks))continue;
  const first=Math.max(0,Math.floor((start-range.start)/range.span*width)),last=Math.min(width,Math.ceil((end-range.start)/range.span*width));
  const peakRate=peaks.length/Math.max(.1,action.duration),segment=mediaSegmentDuration(action);
  if(!segment)continue;
  for(let x=first;x<last;x++){
   const fromTime=Math.max(start,range.start+x/width*range.span),toTime=Math.min(end,range.start+(x+1)/width*range.span);
   const from=mediaPositionAt(action,fromTime-start);
   const span=Math.max(0,toTime-fromTime);
   let peak=0;
   const limit=Math.min(peaks.length,Math.max(Math.floor(from*peakRate)+1,Math.ceil((from+span)*peakRate)));
   const firstPeak=Math.floor(from*peakRate),step=Math.max(1,Math.floor((limit-firstPeak)/48));
   for(let i=firstPeak;i<limit;i+=step)peak=Math.max(peak,peaks[i]||0);
   if(mediaLoops(action)&&from+span>(Number(action.inPoint)||0)+segment){
    const startPeak=Math.floor((Number(action.inPoint)||0)*peakRate);
    const wrapEnd=Math.min(peaks.length,Math.ceil((from+span-segment)*peakRate));
    for(let i=startPeak;i<wrapEnd;i++)peak=Math.max(peak,peaks[i]||0);
   }
   combined[x]=Math.max(combined[x],peak);
  }
 }
 drawWaveform(canvas,base);
 for(const layer of layers.slice(1))drawWaveform(layer.wave,layer.peaks);
}
$('goWaveLayersToggle').addEventListener('click',event=>{
 const button=event.currentTarget;
 button.setAttribute('aria-expanded',String(button.getAttribute('aria-expanded')!=='true'));
 renderGoWaveOverview();
});
const goWaveTrack=$('goWaveTrack');
goWaveTrack.addEventListener('gotpointercapture',event=>{if(event.target===goWaveTrack)goWaveCapturedPointers.add(event.pointerId);});
goWaveTrack.addEventListener('lostpointercapture',event=>goWaveCapturedPointers.delete(event.pointerId));
$('goWaveZoomIn').onclick=()=>zoomGoWave(2);
$('goWaveZoomOut').onclick=()=>zoomGoWave(.5);
installWaveformPinch(goWaveTrack,zoomGoWave);
installWaveformPan(goWaveTrack,pixels=>{
 if(!manualEditSequenceVisible())return false;
 const view=goWaveWindow();
 if(view.zoom<=1)return false;
 goWaveStart=Math.max(0,Math.min(view.duration-view.span,view.start+pixels/goWaveTrack.clientWidth*view.span));
 refreshGoWaveWindow();
 return true;
});
goWaveTrack.addEventListener('pointerdown',event=>{
 if(event.button!==0||event.isPrimary===false||event.target.closest('button')||!manualEditSequenceVisible())return;
 const view=goWaveWindow();
 if(view.zoom<=1)return;
 const pointer=event.pointerId,startX=event.clientX;
 let dragging=false;
 function move(e){
  if(e.pointerId!==pointer)return;
  const dx=e.clientX-startX;
  if(!dragging&&Math.abs(dx)<5)return;
  if(!dragging){dragging=true;goWaveTrack.setPointerCapture(pointer);}
  goWaveStart=Math.max(0,Math.min(view.duration-view.span,view.start-dx/goWaveTrack.clientWidth*view.span));
  refreshGoWaveWindow();
 }
 function end(e){
  if(e.pointerId!==pointer)return;
  window.removeEventListener('pointermove',move);
  window.removeEventListener('pointerup',end);
  window.removeEventListener('pointercancel',end);
  if(dragging)suppressGoWaveClick();
 }
 window.addEventListener('pointermove',move);
 window.addEventListener('pointerup',end);
 window.addEventListener('pointercancel',end);
});
function goWavePointerTime(event){
 const view=goWaveWindow(),bounds=goWaveTrack.getBoundingClientRect();
 const fraction=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
 return view.start+fraction*view.span;
}
function seekGoWaveAt(time){
 goWaveCueId=null;goWaveCueSelected=false;goWaveInsertionTime=time;
 renderGoWaveMarkers();goWaveTrack.focus({preventScroll:true});closeGoWaveChoices();
 seekManualTransport(time).catch(reportTransportError);
}
const goWaveHead=$('goWavePlayhead');
goWaveHead.addEventListener('pointerdown',event=>{
 if(event.button!==0||event.isPrimary===false||!manualEditSequenceVisible())return;
 event.preventDefault();event.stopPropagation();
 const pointer=event.pointerId;
 goWaveScrubTime=currentTransportTime();goWaveHead.setPointerCapture(pointer);
 const move=next=>{
  if(next.pointerId!==pointer)return;
  goWaveScrubTime=goWavePointerTime(next);updateGoWavePlayhead();
 };
 const finish=next=>{
  if(next.pointerId!==pointer)return;
  goWaveHead.removeEventListener('pointermove',move);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])goWaveHead.removeEventListener(type,finish);
  goWaveScrubTime=null;suppressGoWaveClick();
  if(next.type==='pointerup'&&manualEditSequenceVisible())seekGoWaveAt(goWavePointerTime(next));
  else updateGoWavePlayhead();
 };
 goWaveHead.addEventListener('pointermove',move);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])goWaveHead.addEventListener(type,finish);
});
goWaveTrack.addEventListener('click',event=>{
 if(skipGoWaveClick||!manualEditSequenceVisible()||event.target.closest('button'))return;
 seekGoWaveAt(goWavePointerTime(event));
});
function scheduleTimelineMedia(){clearTimeout(timelineMediaTimer);timelineMediaTimer=setTimeout(renderTimelineMedia,80);}
async function renderTimelineMedia(){
 if(manualEditSequenceVisible()){timelineMediaGeneration++;timelineMediaSignature='';renderManualSequence();return renderGoWaveOverview();}
 const canvas=$('projectWaveform'),tracks=$('projectMediaTracks'),status=$('projectWaveformStatus');if(!canvas)return;
 const items=[...allMediaActions(),...(conductType==='manual'?manualMusics().filter(c=>c.manualKind==='silent').map(c=>({cue:c,start:c.time,action:{id:'silent:'+c.id,kind:'silent',name:c.name,duration:manualDuration(c),inPoint:0,outPoint:manualDuration(c)}})):[])].sort((a,b)=>a.start-b.start),d=projectDuration();const visibleCount=items.filter(i=>mediaSegmentDuration(i.action)>0&&Math.min(d,effectiveMediaEnd(i)??d)>i.start).length;timeline.style.height=Math.max(86,30+(conductType==='manual'?Math.min(2,visibleCount):visibleCount)*23)+'px';const total=timeline.clientWidth||1,viewStart=generalTimelineViewport.scrollLeft/total,viewSpan=Math.min(1,generalTimelineViewport.clientWidth/total);
 canvas.style.width=generalTimelineViewport.clientWidth+'px';canvas.style.transform=`translateX(${generalTimelineViewport.scrollLeft}px)`;
 const width=Math.min(2048,Math.max(300,Math.round(generalTimelineViewport.clientWidth*(Math.min(2,devicePixelRatio||1)))));
 const signature=JSON.stringify([width,d,viewStart,viewSpan,items.map(i=>[i.action.id,i.start,i.action.inPoint,i.action.outPoint,i.action.loop,i.action.transition,i.action.fadeDuration,i.action.muted])]);
 if(signature===timelineMediaSignature)return;timelineMediaSignature=signature;const generation=++timelineMediaGeneration;
 tracks.replaceChildren();canvas.width=width;canvas.height=72;const sums=new Float32Array(width);drawWaveform(canvas,[]);
 if(!items.length){status.textContent=tr('Ajoutez un média pour afficher sa waveform.');return;}
 status.textContent=tr('Calcul de la waveform…');let unavailable=0;const audioGains=new Map();for(let x=0;x<width;x++)for(const state of audioStateAt((viewStart+x/width*viewSpan)*d)){if(!audioGains.has(state.item.action.id))audioGains.set(state.item.action.id,new Float32Array(width));audioGains.get(state.item.action.id)[x]=state.gain;}
 for(const [lane,item] of items.entries()){
  const a=item.action,seg=mediaSegmentDuration(a),end=Math.min(d,conductType==='manual'?item.start+seg:effectiveMediaEnd(item)??d);if(seg<=0||end<=item.start)continue;
  const bar=document.createElement('div');bar.className='projectMediaBar '+a.kind;bar.dataset.cueId=item.cue.id;bar.style.left=(item.start/d*100)+'%';bar.style.width=((end-item.start)/d*100)+'%';bar.textContent=(a.kind==='audio'?'♫ ':a.kind==='silent'?'— ':'▶ ')+a.name;bar.title=fmt(item.start)+' → '+fmt(end)+' · '+a.name;if(conductType==='manual'){bar.style.position='absolute';bar.style.top=(lane%2*23)+'px';}tracks.append(bar);if(a.kind==='silent')continue;
  // Reuse the bounded peak cache of the file editor; decode at most one new file at a time here.
  await generateMediaWaveform(a,document.createElement('canvas'),{hidden:true,textContent:''});
  if(generation!==timelineMediaGeneration)return;const peaks=mediaVisualCache.get(a.id);if(!Array.isArray(peaks)){unavailable++;continue;}if(a.kind==='video'&&a.muted)continue;
  const first=Math.max(0,Math.floor((item.start/d-viewStart)/viewSpan*width)),last=Math.min(width,Math.ceil((end/d-viewStart)/viewSpan*width));
  for(let x=first;x<last;x++){const elapsed=Math.max(0,(viewStart+x/width*viewSpan)*d-item.start),position=mediaPositionAt(a,elapsed),index=Math.min(peaks.length-1,Math.floor(position/Math.max(.1,a.duration)*peaks.length));const gain=a.kind==='audio'?(audioGains.get(a.id)?.[x]||0):1;
   sums[x]+=(peaks[index]||0)*gain;
  }
 }
 if(generation!==timelineMediaGeneration)return;const max=Math.max(1,...sums);drawWaveform(canvas,Array.from(sums,x=>x/max));status.textContent=unavailable?tr('Waveform combinée · ')+unavailable+tr(' média(s) sans waveform décodable'):'';
}
if(typeof ResizeObserver==='function'){
 const observer=new ResizeObserver(()=>{timelineMediaSignature='';scheduleTimelineMedia();});
 observer.observe(timeline);
 observer.observe($('goWaveTrack'));
}

// This manifest is requested from the network, outside the service-worker cache.
const APP_VERSION='1.11.10',BRIDGE_VERSION='1.6.33';document.querySelector('.appVersion').textContent='Version '+APP_VERSION+' bêta';let lastVersionCheck=0,versionCheckRunning=false;
const updateNotice=document.createElement('div');updateNotice.id='updateNotice';updateNotice.hidden=true;updateNotice.setAttribute('role','status');const updateText=document.createElement('span'),updateButton=document.createElement('button'),updateSummary=document.createElement('p');updateSummary.className='updateSummary';updateSummary.hidden=true;updateButton.type='button';updateButton.textContent=tr('Ouvrir la nouvelle version');updateText.className='updateVersionText';const updateContent=document.createElement('div');updateContent.className='updateContent';updateContent.append(updateText,updateSummary);updateNotice.append(updateContent,updateButton);const updateMain=document.querySelector('main');updateMain.insertBefore(updateNotice,updateMain.firstChild);
function updateVersionButton(){const b=document.getElementById('updateNotice')?.querySelector('button');if(!b)return;b.disabled=locked||transportPlaying;b.title=b.disabled?tr('Quitter le mode Show et mettre la lecture en pause pour actualiser.'):'';}
function versionIsNewer(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
async function checkAppVersion(force=false){if(versionCheckRunning||(!force&&Date.now()-lastVersionCheck<30000)||document.hidden)return;versionCheckRunning=true;lastVersionCheck=Date.now();const label=document.querySelector('.appVersion');try{const response=await fetch('./version.json?check='+Date.now(),{cache:'no-store',signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(8000):undefined});if(!response.ok)throw new Error(tr('Vérification indisponible'));const data=await response.json();if(!/^\d+\.\d+\.\d+$/.test(data.version))throw new Error(tr('Version invalide'));const newer=versionIsNewer(data.version,APP_VERSION);updateNotice.hidden=!newer;if(newer){const notes=data.releaseNotes;const summary=typeof notes==='string'?notes:notes?.[S2ALanguage.language]||notes?.en||notes?.fr||'';updateSummary.textContent=summary;updateSummary.title=summary;updateSummary.hidden=!summary;updateText.textContent=tr('Nouvelle version ')+data.version+tr(' disponible. Quittez le mode Show pour actualiser.');updateVersionButton();}label.title=newer?tr('Version plus récente disponible sur le serveur'):tr('Version vérifiée sur le serveur');}catch{label.title=tr('Version du serveur non vérifiée : connexion indisponible.');}finally{versionCheckRunning=false;}}
updateButton.onclick=async()=>{if(locked||transportPlaying)return;try{await writeAutosave();location.assign('./actualiser.html?update='+Date.now());}catch(e){updateText.textContent=tr('Actualisation annulée : la sauvegarde locale a échoué.');}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAppVersion();});window.addEventListener('online',()=>checkAppVersion(true));setInterval(()=>{updateVersionButton();checkAppVersion();},300000);setTimeout(()=>checkAppVersion(true),1200);

const classicScriptLoads=new Map(),classicScriptFailures=new Map();
function loadClassicScript(path,ready=null){
 if(ready&&ready())return Promise.resolve();
 if(classicScriptLoads.has(path))return classicScriptLoads.get(path);
 const promise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');let settled=false;
  const finish=(ok,message)=>{if(settled)return;settled=true;clearTimeout(timer);script.onload=script.onerror=null;if(ok){classicScriptFailures.delete(path);resolve();}else{classicScriptFailures.set(path,(classicScriptFailures.get(path)||0)+1);classicScriptLoads.delete(path);script.remove();reject(new Error(message||tr('Fichier de l’application indisponible : ')+path));}};
  const timer=setTimeout(()=>finish(false,tr('Délai de chargement dépassé')+' : '+path),12000);
  script.src=path+(path.includes('?')?'&':'?')+'v='+APP_VERSION+(classicScriptFailures.has(path)?'&retry='+Date.now()+'-'+classicScriptFailures.get(path):'');
  script.onload=()=>finish(!ready||!!ready(),tr('Le fichier chargé n’a pas pu être initialisé : ')+path);
  script.onerror=()=>finish(false);document.head.append(script);
 });classicScriptLoads.set(path,promise);return promise;
}
async function loadTechnicalPreview(){if(!window.S2ATechnicalPreview)await loadClassicScript('./technical-preview.js',()=>typeof window.S2ATechnicalPreview?.mountTechnicalPreview==='function');return window.S2ATechnicalPreview;}

window.s2aBootReady=true;

function installWaveformPan(view,panBy){
 view.addEventListener('wheel',event=>{
  if(event.ctrlKey||event.defaultPrevented||!event.cancelable||!view.clientWidth)return;
  const delta=event.shiftKey?event.deltaX||event.deltaY:Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:0;
  if(!delta)return;
  const unit=event.deltaMode===1?16:event.deltaMode===2?view.clientWidth:1;
  if(panBy(delta*unit))event.preventDefault();
 },{passive:false});
}
function installWaveformPinch(view,zoomBy){
 let frame=0,factor=1,clientX,safariScale=0;
 function enqueue(delta,event){
  if(!Number.isFinite(delta)||delta<=0)return;
  factor*=delta;
  clientX=event.clientX;
  if(!frame)frame=requestAnimationFrame(function(){
   frame=0;
   const rect=view.getBoundingClientRect();
   const anchor=Number.isFinite(clientX)?Math.max(0,Math.min(view.clientWidth,clientX-rect.left)):view.clientWidth/2;
   const change=factor;
   factor=1;
   if(view.clientWidth)zoomBy(change,anchor);
  });
 }
 view.addEventListener('wheel',function(event){
  if(!event.ctrlKey)return;
  event.preventDefault();
  if(safariScale)return;
  const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?view.clientHeight:1);
  enqueue(Math.exp(Math.max(-1,Math.min(1,-pixels*.01))),event);
 },{passive:false});
 view.addEventListener('gesturestart',function(event){
  event.preventDefault();
  safariScale=1;
 },{passive:false});
 view.addEventListener('gesturechange',function(event){
  if(!safariScale||!Number.isFinite(event.scale)||event.scale<=0)return;
  event.preventDefault();
  enqueue(event.scale/safariScale,event);
  safariScale=event.scale;
 },{passive:false});
 view.addEventListener('gestureend',function(event){
  if(safariScale)event.preventDefault();
  safariScale=0;
 },{passive:false});
 view.addEventListener('touchmove',function(event){
  if(event.touches.length>1)event.preventDefault();
 },{passive:false});
}
// The timeline handles its own pinch. Cancel the browser's page zoom everywhere else.
['gesturestart','gesturechange','gestureend'].forEach(function(type){
 document.addEventListener(type,function(event){if(!event.defaultPrevented)event.preventDefault();},{passive:false});
});
// WebKit can latch a vertical wheel gesture to the horizontal timeline.
const webKitWheelFallback=navigator.vendor==='Apple Computer, Inc.'&&/AppleWebKit/.test(navigator.userAgent);
document.addEventListener('wheel',function(event){
  if(event.defaultPrevented||!event.cancelable)return;
  if(event.ctrlKey){event.preventDefault();return;}
  if(!webKitWheelFallback||event.metaKey||event.altKey||event.shiftKey||
     !event.deltaY||Math.abs(event.deltaX)>Math.abs(event.deltaY)||pilotDialogOpen())return;
  const root=document.scrollingElement||document.documentElement;
  if(root.scrollHeight<=root.clientHeight)return;
  for(let node=event.target;node instanceof Element&&node!==root&&node!==document.body;node=node.parentElement){
   if(node.matches('input,select,textarea'))return;
   if(node.scrollHeight>node.clientHeight+1&&/^(auto|scroll)$/.test(getComputedStyle(node).overflowY))return;
  }
  const unit=event.deltaMode===1?16:event.deltaMode===2?root.clientHeight:1;
  event.preventDefault();
  root.scrollTop+=event.deltaY*unit;
},{passive:false});
function waveformZoomStart(view,content,anchor,fallback){
 return anchor==null?fallback:(view.scrollLeft+anchor)/Math.max(1,content.clientWidth);
}

function updateGeneralZoomControls(){
 $('generalZoomLabel').textContent=fmtDisplay(projectDuration()/generalTimelineZoom);
 $('generalZoomOut').disabled=timelineZoomFactor<=1;
 $('generalZoomIn').disabled=timelineZoomFactor>=32;
}
function setGeneralTimelineZoom(next,anchor){
 if(locked)return;
 const scale=Math.max(1,Math.min(32,next/minimumTimelineZoom()));
 if(scale===timelineZoomFactor)return;
 const view=generalTimelineViewport;
 const start=waveformZoomStart(view,timeline,anchor,currentTransportTime()/Math.max(.1,projectDuration()));
 timelineZoomFactor=scale;
 if(anchor!=null)timelinePinchUntil=performance.now()+1500;
 renderTimeline();
 view.scrollLeft=Math.max(0,start*timeline.clientWidth-(anchor==null?view.clientWidth/2:anchor));
}
installWaveformPinch(generalTimelineViewport,function(factor,anchor){setGeneralTimelineZoom(generalTimelineZoom*factor,anchor);});
$('generalZoomIn').onclick=()=>setGeneralTimelineZoom(generalTimelineZoom*2);
$('generalZoomOut').onclick=()=>setGeneralTimelineZoom(generalTimelineZoom/2);
generalTimelineViewport.addEventListener('scroll',()=>scheduleTimelineMedia());updateGeneralZoomControls();

S2ALanguage.localize();$('languageSelect').onchange=()=>S2ALanguage.setLanguage($('languageSelect').value);window.addEventListener('s2a-language-change',()=>{pauseMediaPreviews();closePdfPreview();if(savedStatus)showSavedStatus(savedStatus.snapshot,savedStatus.kind);renderCues();S2ALanguage.localize();updateTransport();updateVideoOutputControls();if(videoOutputWindow&&!videoOutputWindow.closed){videoOutputWindow.document.documentElement.lang=S2ALanguage.language;videoOutputWindow.document.title='S2A Pilot — '+tr('SORTIE VIDÉO');videoOutputWindow.document.getElementById('showcueFullscreenHint').textContent=tr('Cliquer / toucher pour passer en plein écran');}checkAppVersion(true);});

function updateTimelineCueLabels(){
 const host=$('timelineCueLabels');if(!host)return;
 const filter=cueTypeVisibility(),t=currentTransportTime(),current=getActiveCue(t),active=current&&(!filter||filter.visible.has(current.id))?current:null,ordered=orderedCues().filter(cue=>!filter||filter.visible.has(cue.id)),width=generalTimelineViewport.clientWidth,total=timeline.clientWidth,scroll=generalTimelineViewport.scrollLeft,d=projectDuration();
 const key=JSON.stringify([expandedCueId,active?.id,width,total,scroll,d,ordered.map(c=>[c.id,c.name,c.time])]);if(key===timelineLabelSignature)return;timelineLabelSignature=key;timeline.querySelectorAll('.marker').forEach(marker=>marker.classList.toggle('pastCue',ordered.find(c=>c.id===marker.dataset.cueId)?.time<=t+.0001));if(locked){host.replaceChildren();return;}host.replaceChildren();if(width<1)return;
 const selected=ordered.find(c=>c.id===expandedCueId),priority=[...(selected?[selected]:[]),...(active&&active!==selected?[active]:[]),...ordered.filter(c=>c.time>t&&c!==selected&&c!==active),...ordered.filter(c=>c.time<=t&&c!==active&&c!==selected).reverse()],occupied=[];
 for(const cue of priority){const anchor=cue.time/d*total-scroll;if(anchor<0||anchor>width)continue;
 const bubble=document.createElement('div');bubble.dataset.cueId=cue.id;bubble.className='timelineCueBubble'+(expandedCueId===cue.id?' selectedCueBubble':'')+(cue===active?' active':cue.time<=t?' completed':'');bubble.title=cue.name||'Cue';const text=document.createElement('span');text.className='cueBubbleText';text.textContent=cue.name||'Cue';bubble.append(text);host.append(bubble);
 const w=Math.min(width,bubble.getBoundingClientRect().width),left=Math.max(0,Math.min(width-w,anchor-w/2));if(occupied.some(r=>left<r.end+6&&left+w>r.start-6)){bubble.remove();continue;}
 bubble.style.left=left+'px';bubble.style.maxWidth=Math.min(160,width)+'px';bubble.style.setProperty('--pointer-left',Math.max(5,Math.min(w-5,anchor-left))+'px');occupied.push({start:left,end:left+w});
 }
}
generalTimelineViewport.addEventListener('scroll',updateTimelineCueLabels);
window.addEventListener('resize',()=>{timelineLabelSignature='';updateTimelineCueLabels();});
updateTimelineCueLabels();

if(window.S2AQuickHelp)S2AQuickHelp.start();

function scheduleLiveCueFollow(force=false){
 const host=$('showCueOverviewRows');
 if(!locked){liveFollowSignature='';cancelAnimationFrame(liveFollowFrame);host.style.removeProperty('padding-bottom');return;}
 const active=getActiveCue();
 const signature=JSON.stringify([conductType,active?.id,conductType==='manual'?manualCurrentID:null,conductType==='manual'?manualLastGO:null]);
 if(signature===liveFollowSignature)return;
 liveFollowSignature=signature;
 cancelAnimationFrame(liveFollowFrame);
 liveFollowFrame=requestAnimationFrame(()=>{
  if(!locked)return;
  const following=host.querySelector('.isNext'),current=host.querySelector('.isActive');
  const first=current||following;
  if(!first)return;
  const card=$('preflightCard'),viewport=window.visualViewport;
  const inset=parseFloat(getComputedStyle(card).top)||0,top=Math.max(inset,viewport?.offsetTop||0)+card.offsetHeight+20;
  const bottom=(viewport?viewport.offsetTop+viewport.height:window.innerHeight)-12;
  const space=bottom-top;if(space<=0)return;
  const a=first.getBoundingClientRect();
  host.style.paddingBottom=Math.max(24,space-a.height)+'px';
  if(current){
   window.scrollTo({top:Math.max(0,window.scrollY+a.top-top),behavior:'instant'});
   return;
  }
  const b=following?.getBoundingClientRect()||a;
  const start=Math.min(a.top,b.top),end=Math.max(a.bottom,b.bottom),fits=end-start<=space;
  const target=fits?start:a.top,limit=fits?end:a.bottom;
  if(target>=top&&limit<=bottom)return;
  const delta=target<top||limit-target>space?target-top:limit-bottom;
  window.scrollTo({top:Math.max(0,window.scrollY+delta),behavior:'instant'});
 });
}

function nextLiveVisibleCue(ordered,timedNext){
 if(timedNext&&ordered.includes(timedNext))return timedNext;
 const time=currentTransportTime();
 if(conductType!=='manual')return ordered.find(cue=>cue.time>time+.0001)||null;
 const current=manualCurrent(),queued=manualNextMusic();
 if(current&&(transportPlaying||manualPausedAt!==null)){
  const child=ordered.find(cue=>cue.parentMusicId===current.id&&isManualInternalCue(cue)&&cue.time>time+.0001);
  if(child)return child;
 }
 if(!queued)return null;
 const roots=manualMusics(),start=roots.indexOf(queued);
 return roots.slice(start).find(cue=>ordered.includes(cue))||null;
}

function liveCueEnd(cue){
 if(conductType!=='manual')return getCueAfter(cue)?.time??projectDuration();
 const root=manualCurrent()||cues.find(item=>item.id===manualCompletedID);
 if(!root)return cue.time;
 const next=manualChildren(root).find(child=>child.time>cue.time+.0001);
 return next?.time??root.time+manualPlannedDuration(root);
}
function updateLiveCueProgress(time){
 const row=$('showCueOverviewRows').querySelector('.isActive'),cue=getActiveCue(time);
 if(!row||!cue||row.dataset.cueId!==cue.id)return;
 const end=liveCueEnd(cue);
 const progress=end>cue.time?Math.max(0,Math.min(1,(time-cue.time)/(end-cue.time))):0;
 row.style.setProperty('--live-cue-progress',String(progress));
}

function liveCountdownTarget(time=currentTransportTime()){
 const next=getNextCue(time);
 if(conductType==='manual'&&(transportPlaying||manualPausedAt!==null)&&!manualWaitCueID&&!escapeFading){
  const current=manualCurrent(),primary=current?.mediaActions?.find(action=>action.kind==='audio');
  const automatic=manualAutomaticNext(current,primary);
  if(automatic){
   const handoff=manualCrossfadeStart(current,primary,automatic),staged=manualCrossfadeLead;
   const lead=manualCrossfadeLeadDuration(automatic),end=current.time+manualDuration(current);
   const audible=staged?.next===automatic?Math.max(handoff,time+remainingLtcLead(staged.incoming)):
    lead&&handoff<end-.025?Math.max(handoff,Math.min(end,time+lead)):handoff;
   if(!next||next.time>audible+.0001)return {cue:automatic,time:audible,automatic:true};
  }
 }
 return next?{cue:next,time:next.time}:null;
}

function updateShowOverview(){
 const host=$('showCueOverviewRows');if(!host||!locked)return;
 const filter=cueTypeVisibility(),principals=conductType==='manual'?manualMusics():[],ordered=cueViewOrder().filter(cue=>!filter||filter.visible.has(cue.id)),active=getActiveCue(),timedNext=liveCountdownTarget()?.cue,goTarget=conductType==='manual'?manualGoTarget():null;
 const following=nextLiveVisibleCue(ordered,timedNext),next=following===active?null:following;
 const members=cueGroupMembership(),activeGroup=groupForCue(active,members),nextGroup=groupForCue(next,members);
 let previousGroup=null;
 const key=JSON.stringify([autoShowSelectedCueId,manualArmedID,manualArmExplicit,goTarget?.id,showLayout,S2ALanguage.language,active?.id,next?.id,timedNext?.id,cueGroups,customCueTypes,filter?Array.from(filter.matches):null,ordered.map(c=>[c.id,c.name,cueDescriptionLines(c,filter?.selected),c.time,c.imageDataUrl?.length,c.goColor,c.parentMusicId,rawCueTypeIds(c),(c.mediaActions||[]).map(a=>a.kind)])]);
 if(key===showOverviewSignature)return;showOverviewSignature=key;
 const groupLabel=$('liveCueGroupLabel');
 groupLabel.hidden=!activeGroup;setShowText(groupLabel,activeGroup?.name||'');
 if(activeGroup)groupLabel.style.setProperty('--cue-group-color',activeGroup.color);
 const typeColors=new Map(cueTypes().map(type=>[type.id,type.color]));
 const previousRows=new Map(Array.from(host.querySelectorAll('.showOverviewRow')).map(row=>[row.dataset.cueId,row]));
 document.querySelector('.showTransportHeader').append($('showNextCountdown'));
 host.replaceChildren();
 if(!ordered.length){const empty=document.createElement('div');empty.className='small muted';empty.textContent=tr(filter?'Aucune Cue pour ces types.':'Aucune Cue');host.append(empty);}
 for(const cue of ordered){
  const group=groupForCue(cue,members),forced=!!group&&(group===activeGroup||group===nextGroup);
  const folded=!!group&&!forced&&(liveCueGroupFolds.get(group.id)??group.folded);
  if(group&&group!==previousGroup)host.append(cueGroupHeading(group,'live',folded,forced));
  previousGroup=group;
  if(folded)continue;
  const row=document.createElement('div');applyCueGroupStyle(row,group);row.className='showOverviewRow'+(cue===active?' isActive':'')+(cue===next?' isNext':'')+(isManualInternalCue(cue)?' manualInternalCue':'');row.dataset.cueId=cue.id;row.dataset.cueTime=cue.time;
  row.classList.toggle('cueTypeContext',!!(filter&&!filter.matches.has(cue.id)));
  const mediaKinds=['audio','video'].filter(kind=>(cue.mediaActions||[]).some(action=>action.kind===kind));
  if(mediaKinds.length){
   row.classList.add('hasLiveMediaBadges');
   const badges=document.createElement('div');badges.className='liveMediaBadges';
   for(const kind of mediaKinds){
    const count=(cue.mediaActions||[]).filter(action=>action.kind===kind).length;
    const badge=document.createElement('span');badge.className='cueMediaChip '+kind+' '+cuePreparationClass(cue);
    badge.textContent=(kind==='audio'?'AUDIO':tr('VIDÉO'))+(count>1?' ×'+count:'');badges.append(badge);
   }
   row.append(badges);
  }

  row.classList.toggle('isKeyboardSelected',conductType!=='manual'&&autoShowSelectedCueId===cue.id);
  if(conductType==='manual'){
   if(isManualMainCue(cue))row.classList.add('manualPrincipalCue');
   applyGoCueColor(row,cue);
   row.classList.toggle('isArmed',goTarget===cue);row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-pressed',String(goTarget===cue));row.title=tr('Sélectionner pour le prochain GO');
   row.onclick=()=>armManualCue(cue.id);
  }
  if(cue===active)row.setAttribute('aria-current','step');
  const number=document.createElement('span');number.className='overviewNumber';number.textContent=String(cues.indexOf(cue)+1);
  if(conductType==='manual'){const parent=isManualMainCue(cue)?cue:principals.find(p=>p.id===cue.parentMusicId),root=principals.indexOf(parent)+1;if(parent&&root){const children=manualChildren(parent);number.textContent=cueViewNumber(cue);if(cue!==parent&&children.at(-1)===cue)row.classList.add('lastInternalCue');row.dataset.parentCueId=cue===parent?'':parent.id;}}
  const visual=document.createElement('div');visual.className='overviewVisual';
  if(cue.imageDataUrl){const previousImage=previousRows.get(cue.id)?.querySelector('.overviewVisual img'),img=previousImage?.getAttribute('src')===cue.imageDataUrl?previousImage:document.createElement('img');img.src=cue.imageDataUrl;img.alt='';visual.append(img);}else{visual.classList.add('showOverviewPlaceholder');visual.setAttribute('aria-label',tr('Aucun visuel'));const logo=document.createElement('img');logo.className='pilotCuePlaceholder';logo.src='./icons/s2a-pilot-512.png';logo.alt='';visual.append(logo);}
  const content=document.createElement('div');content.className='overviewContent';const name=document.createElement('div');name.className='overviewName';name.textContent=cue.name||'Cue';if(conductType==='manual'){const kind=document.createElement('span');kind.className='overviewKind';kind.textContent=manualCueLabel(cue);name.prepend(kind);}content.append(name);
  if(cueTypeIds(cue).length)name.prepend(cueTypeBadges(cue),' ');
  if(cue===active||cue===next){
   const description=document.createElement('div');
   description.className='overviewDescription';
   for(const {id,text} of cueDescriptionLines(cue,filter?.selected)){
    if(!text.trim())continue;
    const line=document.createElement('div');
    line.textContent=text.trim();
    if(id!=='none')line.style.color=typeColors.get(id);
    description.append(line);
   }
   if(!description.hasChildNodes()&&!filter&&showLayout!=='compact')description.textContent=tr('Pas de description');
   if(description.hasChildNodes()||showLayout!=='compact')content.append(description);
  }
  const time=document.createElement('time');time.className='overviewTime';time.textContent=conductType==='manual'?(isManualInternalCue(cue)?'+'+fmtDisplay(cue.relativeTime):'GO'):fmtDisplay(cue.time);
  row.append(number,visual,time,content);
  if(cue===active){
   const progress=document.createElement('span');progress.className='liveCueProgress';progress.setAttribute('aria-hidden','true');row.append(progress);
  }
  if(cue===timedNext){const beat=document.createElement('span');beat.className='overviewBeat';beat.setAttribute('aria-hidden','true');row.append(beat);}
  host.append(row);
 }
 if(showLayout==='iceman'&&timedNext===next&&next)host.querySelector('.isNext')?.append($('showNextCountdown'));
 renderCueGroupBranches(host);
 fitShowCueList();
}

function showCueWindowStart(rows){
 let active=rows.findIndex(row=>row.classList.contains('isActive'));
 if(active<0)active=rows.findIndex(row=>row.classList.contains('isNext'));
 if(active<0&&selectedCueTypes()&&rows.length){
  active=rows.findIndex(row=>Number(row.dataset.cueTime)>=currentTransportTime());
  if(active<0)active=Math.max(0,rows.length-5);
 }
 active=Math.max(0,active);
 const selected=rows.findIndex(function(row){return row.classList.contains('isKeyboardSelected');});
 if(selected<0)return active;
 return Math.min(Math.max(0,rows.length-5),Math.min(selected,Math.max(active,selected-4)));
}
function fitShowCueList(){
 if(!locked)return;const host=$('showCueOverviewRows'),rows=Array.from(host.children).filter(row=>row.classList.contains('showOverviewRow'));
 const start=showCueWindowStart(rows);
 rows.forEach((row,index)=>{const shown=showLayout!=='maverick'||(index>=start&&index<start+5)||row.classList.contains('isActive')||row.classList.contains('isNext');row.style.display=shown?'':'none';row.style.visibility=shown?'visible':'hidden';});
 host.style.height='auto';if(!rows.length){host.parentElement.classList.remove('hasHiddenCues');return;}
 updateShowListOverflow();scheduleLiveCueFollow();
}
function updateShowListOverflow(){
 if(!locked)return;const host=$('showCueOverviewRows'),rows=Array.from(host.children).filter(row=>row.classList.contains('showOverviewRow')),start=showCueWindowStart(rows);
 host.parentElement.classList.toggle('hasHiddenCues',showLayout==='maverick'&&rows.length-start>5);
}
window.addEventListener('resize',()=>{requestAnimationFrame(fitShowCueList);});

function setShowText(element,text){if(element.textContent!==text)element.textContent=text;}

function updateCountdownBeat(t){
 if(!locked)return;
 updateLiveCueProgress(t);const host=$('showCueOverviewRows'),target=liveCountdownTarget(t),next=target?.cue,remaining=target?Math.max(0,target.time-t):Infinity;
 const waiting=conductType==='manual'&&!!manualWaitCueID;
 const urgent=!waiting&&!!next&&remaining<=10.0001;document.body.classList.toggle('nextCueUrgent',urgent);
 const timing=$('showNextCountdown');timing.classList.toggle('isAutoTransition',!!target?.automatic);setShowText($('showCountdownClock'),!waiting&&next?fmtDisplay(remaining,true):conductType==='manual'?tr('EN ATTENTE DU GO'):'--:--');timing.classList.toggle('isUrgent',urgent);
 const reduced=countdownMotionPreference&&countdownMotionPreference.matches;
 const opacity=(urgent?(reduced?1:.12+.88*(.5+.5*Math.cos(2*Math.PI*remaining))):0).toFixed(3);
 $('showCountdownBeat').style.opacity=opacity;
 const row=host.querySelector('.isNext');if(!row||row.dataset.cueId!==next?.id)return;
 row.classList.toggle('isUrgent',urgent);row.querySelector('.overviewBeat').style.opacity=opacity;
}

function setShowLayout(value,save=true){
 showLayout=value==='compact'?'compact':conductType==='manual'||value==='iceman'?'iceman':'maverick';
 document.body.classList.toggle('showLayoutIceman',showLayout==='iceman');
 document.body.classList.toggle('showLayoutCompact',showLayout==='compact');
 const button=$('showLayoutButton');
 const name=showLayout==='compact'?tr('Compacte'):showLayout==='iceman'?'Iceman':'Maverick';
 button.title=tr('Disposition Show : {style}',{style:name});button.setAttribute('aria-label',button.title);
 for(const choice of document.querySelectorAll('[data-show-layout]')){choice.disabled=conductType==='manual'&&choice.dataset.showLayout==='maverick';choice.hidden=choice.disabled;choice.setAttribute('aria-pressed',String(choice.dataset.showLayout===showLayout));}
 showOverviewSignature='';updateShowPanels();if(save)writeAutosave().catch(console.warn);
}
const showLayoutDialog=$('showLayoutDialog');
$('showLayoutButton').addEventListener('click',()=>showLayoutDialog.showModal());
$('showLayoutClose').addEventListener('click',()=>showLayoutDialog.close());
for(const choice of document.querySelectorAll('[data-show-layout]'))choice.addEventListener('click',()=>{setShowLayout(choice.dataset.showLayout);showLayoutDialog.close();$('showLayoutButton').focus();});
window.addEventListener('s2a-language-change',()=>{setShowLayout(showLayout,false);renderManualEditor();});

$('copilotButton').addEventListener('click',()=>$('copilotDialog').showModal());
$('copilotClose').addEventListener('click',()=>$('copilotDialog').close());
// Require a gesture that starts and ends on the backdrop.
let backdropDialog=null;
function outsidePilotDialog(dialog,event){
 const r=dialog.getBoundingClientRect();
 return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;
}
document.addEventListener('pointerdown',event=>{
 const dialogs=document.querySelectorAll('dialog[open]'),dialog=dialogs[dialogs.length-1];
 backdropDialog=dialog&&event.button===0&&outsidePilotDialog(dialog,event)?dialog:null;
},true);
document.addEventListener('pointercancel',()=>{backdropDialog=null;},true);
document.addEventListener('click',event=>{
 const dialog=backdropDialog;backdropDialog=null;
 if(!dialog?.open||!outsidePilotDialog(dialog,event))return;
 event.preventDefault();event.stopPropagation();
 if(dialog.id==='shortcutDialog')closeShortcutSettings();
 else if(dialog.id==='pdfPreviewDialog')closePdfPreview();
 else dialog.close();
},true);

function copilotCueDescription(cue,ids){
 if(ids.length<2)return {description:cueDescriptionText(cue).slice(0,1000)};
 const entries=ids.map(id=>[id,typeDescription(cue,id)]).filter(([,text])=>text);
 const limit=Math.floor(1000/Math.max(1,entries.length));
 return {typeDescriptions:Object.fromEntries(entries.map(([id,text])=>[id,Array.from(text).slice(0,limit).join('')]))};
}

// Passive Copilot display model. No remote command is exposed.
window.S2ACopilotState=()=>{
 const ordered=cueViewOrder(),selected=ordered.find(cue=>cue.id===expandedCueId)||ordered[0];
 const active=locked?getActiveCue():getActiveCue()||selected,next=locked?getNextCue():ordered[ordered.findIndex(cue=>cue.id===active?.id)+1],queued=conductType==='manual'?manualNextMusic():null;
 const main=manualCurrent(),now=currentTransportTime(),target=locked?liveCountdownTarget(now):null;
 const primary=target?.automatic?main?.mediaActions.find(action=>action.kind==='audio'):null;
 const track=primary?runtimeAudio.get(primary.id):null;
 const autoTransition=target?.automatic?{
  id:target.cue.id,time:target.time,running:!!(transportPlaying&&track&&!track.el.paused&&!track.el.seeking&&!audioInLtcLead(track))
 }:undefined;
 const waiting=!autoTransition&&!transportPlaying&&!manualWaitCueID?queued:null;
 const usedTypes=new Set(cues.flatMap(cueTypeIds));
 const sharedTypes=[...defaultCueTypes,...customCueTypes.filter(type=>usedTypes.has(type.id))];
 const groupMembers=cueGroupMembership();
 const sharedGroups=Array.from(new Set(groupMembers.values()),group=>({
  id:group.id,name:group.name,color:group.color,folded:liveCueGroupFolds.get(group.id)??group.folded
 }));
 const upcomingWait=main?manualChildren(main).find(c=>c.waitForGo&&c.time>now+.0001):null;
 const mainEnd=main?main.time+(manualHoldsAtStart(main)?0:manualDuration(main)):now;
 const offlineStop=conductType==='manual'?Math.min(Number.isFinite(mainEnd)?mainEnd:projectDuration(),upcomingWait?upcomingWait.time:Infinity):projectDuration();
 return {schema:1,offlineStop,autoTransition,compact:showLayout==='compact',goGuardMs:conductType==='manual'?goGuardMs:0,projectEpoch:copilotProjectEpoch,projectId:copilotProjectId,show:locked,remoteArmed:conductType==='manual'?(manualArmExplicit?manualArmedID||'':''):autoShowSelectedCueId||'',playing:transportPlaying,fading:escapeFading,resumeWait:!!manualWaitCueID,manual:conductType==='manual',title:(showTitle.value||'Show').slice(0,70),time:roundTenth(currentTransportTime()),duration:projectDuration(),active:active?.id||'',activeEnd:active?liveCueEnd(active):undefined,next:next?.id||'',queued:queued?.id||'',waiting:waiting?.id||'',cueTypes:sharedTypes,cueGroups:sharedGroups,cues:cueViewOrder().map(c=>{
  const ids=cueTypeIds(c),child=isManualInternalCue(c);
  return {id:c.id,number:String(cueViewNumber(c)),name:(c.name||'Cue').slice(0,70),groupId:child?undefined:groupMembers.get(c.id)?.id,...copilotCueDescription(c,ids),time:c.time,child,parentCueId:child?c.parentMusicId:undefined,goColor:conductType==='manual'&&isManualMainCue(c)?normalizeGoCueColor(c.goColor)||undefined:undefined,cueTypeId:ids[0],cueTypeIds:ids,waitForGo:c.waitForGo===true,image:c.imageDataUrl||''};
 })};
};

window.S2ACopilotReady=workspaceStartup;
window.S2ACopilotPersist=()=>writeAutosave();
window.S2ACopilotUnlock=ensureAudioContext;
let copilotRemotePending=false,copilotRemoteEditProject=-1,copilotRemoteEditRevision=-1;
async function copilotManualGO(){
 if(manualGoGuardActive())return 'guarded';
 if(locked)return manualGO();
 const project=copilotProjectEpoch,revision=editCueSelectionRevision;
 const selected=cues.find(cue=>cue.id===expandedCueId);
 const explicit=copilotRemoteEditProject!==project||copilotRemoteEditRevision!==revision;
 if(selected&&(explicit||editBlockPreview||!manualCurrentID&&!manualCompletedID)){
  if(editBlockPreview)stopEditBlockPreview();
  manualArmedID=selected.id;manualArmExplicit=true;
 }
 await manualGO();
 if(copilotProjectEpoch===project){copilotRemoteEditProject=project;copilotRemoteEditRevision=revision;}
}
window.S2ACopilotCommand=async (action,cueId='')=>{
 if(copilotRemotePending||document.querySelector('dialog[open]:not(#copilotDialog)')||manualPending||manualPausePending||spaceTransportPending||escapeFading)throw Error('Pilot est occupé. Réessayez.');
 copilotRemotePending=true;
 try{
  if(action==='select'){
   const cue=cues.find(item=>item.id===cueId);
   if(!cue)throw Error('Cette Cue n’est plus disponible.');
   if(conductType==='manual'){
    if(locked)armManualCue(cue.id);
    else{selectGoSequenceCue(cue);manualArmedID=cue.id;manualArmExplicit=true;updateTransport();}
   }else{
    pauseTransport();await seekTransport(cue.time);
    autoShowSelectedCueId=cue.id;
    if(locked)updateShowOverview();
    else{expandedCueId=cue.id;renderCues();centerEditedCue(cue.id);}
   }
   return;
  }
  if(action==='next'||action==='previous'){
   const revision=editCueSelectionRevision;
   navigateCue(action==='next'?1:-1);
   if(!locked&&conductType==='manual'&&revision!==editCueSelectionRevision){
    manualArmedID=expandedCueId;manualArmExplicit=true;updateTransport();
   }
   return;
  }
  if(action==='go'){
   if(conductType==='manual')return await copilotManualGO();
   const result=!locked?await playEditFromCue(editTimelinePosition()):await playTransport();
   if(transportPlaying)autoShowSelectedCueId=null;
   return result;
  }
  if(action!=='play')throw Error('Commande inconnue.');
  if(conductType==='manual'){
   if(!manualCurrentID&&!runtimeAudio.size)return await copilotManualGO();
   return await toggleManualPause();
  }
  if(transportPlaying)pauseTransport();else await playTransport();
 }finally{copilotRemotePending=false;notifyCopilotTransport();}
};

function notifyCopilotTransport(){
 const key=[locked,transportPlaying,escapeFading,manualWaitCueID,manualCurrentID,manualArmedID,manualArmExplicit,autoShowSelectedCueId,getActiveCue()?.id,getNextCue()?.id].join('|');
 if(key!==copilotTransportSignature){copilotTransportSignature=key;window.dispatchEvent(new Event('s2a-copilot-state'));}
}

// Audio events keep the real transport moving when rendering frames are suspended.
let individualFadeFrame=0;
const liveAudioRows=new Map();

function finishIndividualAudioStop(rt){
 const {action,cue}=rt.item;
 individuallyStoppedAudio.add(action.id);
 stopAudioRuntime(action.id);
 if(manualFade){
  manualFade.outgoing=manualFade.outgoing.filter(track=>track.rt!==rt);
  if(manualFade.incoming===rt)manualFade.incoming=null;
 }
 const current=manualCurrent();
 if(current===cue&&!current.visualNumber&&current.mediaActions.find(media=>media.kind==='audio')?.id===action.id){
  cancelManualCrossfadeLead();
  manualCompletedID=current.id;manualCurrentID=null;
  manualWaitCueID=null;manualWaitDeferred=[];showEscapeResume=null;
  if(manualFade)for(const track of manualFade.outgoing)stopAudioRuntime(track.rt.item.action.id);
  manualFade=null;
  pauseTransport(true);
  stopVideoRuntime();
 }
 if(!manualCurrentID&&!runtimeAudio.size){manualPausedAt=null;manualPauseAudioPositions=null;}
 updateTransport();
}
function advanceIndividualFades(now){
 let pending=false;
 for(const rt of runtimeAudio.values()){
  const fade=rt.stopFade;
  if(!fade)continue;
  if(!rt.el.paused)fade.remaining=Math.max(0,fade.remaining-Math.max(0,now-fade.last));
  fade.last=now;
  fade.factor=fade.remaining/fade.duration;
  setRuntimeGain(rt,rt.manualGainValue??1);
  if(!fade.remaining){finishIndividualAudioStop(rt);continue;}
  pending=true;
 }
 return pending;
}
function animateIndividualFades(now){
 individualFadeFrame=0;
 if(!escapeFading&&advanceIndividualFades(now))individualFadeFrame=requestAnimationFrame(animateIndividualFades);
}
function fadeLiveAudioTrack(rt){
 if(!locked||conductType!=='manual'||liveAudioControlsBusy(rt)||runtimeAudio.get(rt.item.action.id)!==rt)return;
 if(rt.el.paused){finishIndividualAudioStop(rt);return;}
 const duration=Math.max(.1,Number(rt.item.action.fadeDuration)||3)*1000;
 rt.stopFade={duration,remaining:duration,last:performance.now(),factor:1};
 if(!individualFadeFrame)individualFadeFrame=requestAnimationFrame(animateIndividualFades);
 updateLiveAudioTracks();
}
function liveAudioControlsBusy(rt){
 return escapeFading||manualPending||manualPausePending||rt===manualCrossfadeLead?.incoming||rt.localPlayPending||!!rt.stopFade;
}
async function toggleLiveAudioTrack(rt){
 if(!locked||conductType!=='manual'||liveAudioControlsBusy(rt)||manualPausedAt!==null||runtimeAudio.get(rt.item.action.id)!==rt)return;
 if(!rt.el.paused){
  if(rt===manualCrossfadeLead?.outgoing)cancelManualCrossfadeLead();
  rt.localPausePosition=rt.el.currentTime;
  rt.el.pause();
  updateLtcRouting();updateLiveAudioTracks();return;
 }
 checkPilotOutput();
 if(rt.item.action.ltc)ltcOutputContext();
 const position=rt.localPausePosition??rt.el.currentTime,generation=transportCommandGeneration;
 rt.localPlayPending=true;rt.localPausePosition=null;
 try{
  const context=ensureAudioContext();
  if(Math.abs(rt.el.currentTime-position)>.025)rt.el.currentTime=position;
  const started=rt.el.play();
  updateLiveAudioTracks();
  await Promise.all([context,started]);
 }catch(error){
  if(runtimeAudio.get(rt.item.action.id)!==rt||generation!==transportCommandGeneration)return;
  rt.localPausePosition=position;
  rt.el.pause();
  throw error;
 }finally{
  rt.localPlayPending=false;
  updateLtcRouting();updateLiveAudioTracks();
 }
}
function createLiveAudioRow(rt){
 const row=document.createElement('div'),name=document.createElement('strong'),controls=document.createElement('div'),play=document.createElement('button'),fade=document.createElement('button'),wave=document.createElement('span'),canvas=document.createElement('canvas'),fill=document.createElement('span'),head=document.createElement('span'),time=document.createElement('span');
 row.className='liveAudioTrack';row.dataset.trackId=rt.item.action.id;
 name.className='liveAudioName';name.textContent=rt.item.action.name;
 controls.className='liveAudioControls';play.type=fade.type='button';
 play.className='liveAudioPlay';fade.className='liveAudioFade';
 fade.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 4L21 17V20H3Z" fill="currentColor"/></svg>';
 controls.append(play,fade);
 wave.className='liveAudioWave';time.className='liveAudioTime';
 fill.className='liveAudioProgress';head.className='liveAudioHead';wave.setAttribute('aria-hidden','true');
 wave.append(canvas,fill,head);row.append(name,controls,wave,time);
 play.onclick=()=>toggleLiveAudioTrack(rt).catch(reportTransportError);
 fade.onclick=()=>fadeLiveAudioTrack(rt);
 return {rt,row,play,fade,canvas,time,width:0,peaks:null,decoding:false};
}
function updateLiveAudioTracks(){
 const panel=$('liveAudioLayers'),toggle=$('liveAudioToggle'),host=$('liveAudioTracks');
 panel.hidden=!locked||conductType!=='manual';
 if(panel.hidden)return;
 const expanded=toggle.getAttribute('aria-expanded')==='true';
 const tracks=[...runtimeAudio.values()];
 setShowText(toggle,tr('Pistes audio')+(tracks.length?' ('+tracks.length+')':''));
 host.hidden=!expanded;
 for(const [id,entry] of liveAudioRows){
  if(expanded&&runtimeAudio.get(id)===entry.rt)continue;
  entry.row.remove();liveAudioRows.delete(id);
 }
 if(!expanded)return;
 if(!tracks.length){
  if(!host.firstChild){
   const empty=document.createElement('div');
   empty.className='small muted liveAudioEmpty';host.append(empty);
  }
  setShowText(host.firstChild,tr('Aucune piste audio en cours'));
  return;
 }
 host.querySelector('.liveAudioEmpty')?.remove();
 for(const rt of tracks){
  const action=rt.item.action,id=action.id;
  let entry=liveAudioRows.get(id);
  if(!entry){
   entry=createLiveAudioRow(rt);liveAudioRows.set(id,entry);host.append(entry.row);
  }
  const {row,play,fade,canvas,time}=entry;
  const duration=mediaSegmentDuration(action);
  const elapsed=Math.min(duration,Math.max(0,rt.el.currentTime-(Number(action.inPoint)||0)-runtimeLtcLead(rt)));
  const ratio=duration?elapsed/duration:0;
  row.style.setProperty('--audio-position',String(ratio));row.style.setProperty('--audio-percent',ratio*100+'%');
  const seconds=Math.max(.1,Number(action.fadeDuration)||3);
  const paused=rt.el.paused,icon=paused?'play_arrow':'pause';
  if(play.dataset.icon!==icon){S2AMaterial.set(play,icon);play.dataset.icon=icon;}
  play.title=tr(paused?'Lecture':'Pause');
  play.setAttribute('aria-label',play.title+' - '+action.name);
  play.disabled=liveAudioControlsBusy(rt)||manualPausedAt!==null;
  fade.title=rt.stopFade?tr('Fondu en cours'):tr('Fondu {seconds} s',{seconds});
  fade.setAttribute('aria-label',fade.title+' - '+action.name);
  fade.disabled=liveAudioControlsBusy(rt);
  setShowText(time,fmt(elapsed)+' / '+fmt(duration));
  const peaks=mediaVisualCache.get(id),width=canvas.clientWidth;
  if(width&&(width!==entry.width||peaks!==entry.peaks)){
   entry.width=width;entry.peaks=peaks;
   const total=Math.max(.1,action.duration);
   drawWaveform(canvas,Array.isArray(peaks)?peaks:[],(action.inPoint||0)/total,Math.min(1,((action.inPoint||0)+duration)/total));
  }
  if(!peaks&&!entry.decoding){
   entry.decoding=true;
   generateMediaWaveform(action,document.createElement('canvas'),{hidden:true,textContent:''}).finally(()=>{
    entry.decoding=false;
    if(liveAudioRows.get(id)===entry)updateLiveAudioTracks();
   });
  }
 }
}
$('liveAudioToggle').addEventListener('click',event=>{
 const toggle=event.currentTarget;
 toggle.setAttribute('aria-expanded',String(toggle.getAttribute('aria-expanded')!=='true'));
 updateLiveAudioTracks();
});
window.addEventListener('resize',updateLiveAudioTracks);

function backgroundTransportTick(){
 if(document.hidden&&!escapeFading)advanceIndividualFades(performance.now());
 if(!transportPlaying&&!escapeFading&&conductType==='manual'){
  if(runtimeAudio.size){enforceMediaBounds(transportTime,true);updateManualStatus();}
  if(locked)updateLiveAudioTracks();
 }
 if(!document.hidden||!transportPlaying||escapeFading||manualPending||manualPausePending||performance.now()-lastBackgroundTransportTick<50)return;
 lastBackgroundTransportTick=performance.now();cancelAnimationFrame(rafId);rafId=0;animationLoop();
}
setInterval(backgroundTransportTick,250);
document.addEventListener('visibilitychange',()=>{
 if(escapeFading||!transportPlaying||manualPending||manualPausePending)return;
 cancelAnimationFrame(rafId);rafId=0;if(document.hidden)backgroundTransportTick();else rafId=requestAnimationFrame(animationLoop);
});

window.S2ACopilotTops={get:()=>clone(backstageTops),set:(projectId,tops)=>{if(projectId!==copilotProjectId)return;const normalized=normalizeBackstageTops(tops);if(JSON.stringify(normalized)!==JSON.stringify(backstageTops)){backstageTops=normalized;scheduleAutosave();}}};

// BEGIN EMBEDDED TECHNICAL PREVIEW
window.S2ATechnicalPreview=(()=>{
// Lightweight preview for this application's own drawing instructions.
// The PDF download and the SVG pages use the same page layout, text and JPEGs.
const escapeXml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const color=values=>`rgb(${values.map(v=>Math.round(Number(v)*255)).join(',')})`;
function jpegUrl(bytes){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return 'data:image/jpeg;base64,'+btoa(binary);}
function svgPage(page,index,title){
 let fill='#000',stroke='#000',width=.7,clipId=null;const drawing=[];
 for(const raw of page.content.split('\n')){
  const line=raw.trim();if(!line)continue;
  let match;
  if(line==='q'||line==='Q'){clipId=null;continue;}
  if((match=line.match(/^([\d.]+) ([\d.]+) ([\d.]+) (rg|RG)$/))){if(match[4]==='rg')fill=color(match.slice(1,4));else stroke=color(match.slice(1,4));continue;}
  if((match=line.match(/^BT \/(F[12]) ([\d.]+) Tf 1 0 0 1 ([-\d.]+) ([-\d.]+) Tm <([A-F\d]*)> Tj ET$/))){
   const bytes=Uint8Array.from(match[5].match(/../g)||[],v=>parseInt(v,16));
   const text=new TextDecoder('windows-1252').decode(bytes);
   drawing.push(`<text x="${match[3]}" y="${-Number(match[4])}" transform="scale(1 -1)" font-family="Arial,Helvetica,sans-serif" font-size="${match[2]}" font-weight="${match[1]==='F2'?700:400}" fill="${fill}">${escapeXml(text)}</text>`);continue;
  }
  if((match=line.match(/^([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) re ([fS])$/))){drawing.push(`<rect x="${match[1]}" y="${match[2]}" width="${match[3]}" height="${match[4]}" fill="${match[5]==='f'?fill:'none'}" stroke="${match[5]==='S'?stroke:'none'}" stroke-width="${width}"/>`);continue;}
  if((match=line.match(/^q ([-\d.]+) 0 0 ([-\d.]+) ([-\d.]+) ([-\d.]+) cm \/Im(\d+) Do Q$/))){
   const image=page.images[Number(match[5])-1];if(!image)throw new Error(tr('Visuel de conduite manquant'));
   const imageSvg=`<image x="${match[3]}" y="${-(Number(match[4])+Number(match[2]))}" width="${match[1]}" height="${match[2]}" transform="scale(1 -1)" href="${jpegUrl(image.bytes)}" preserveAspectRatio="none"/>`;
   drawing.push(clipId?`<g clip-path="url(#${clipId})">${imageSvg}</g>`:imageSvg);continue;
  }
  if(/\b(?:m|l|c|h)\b/.test(line)){
   const tokens=line.split(/\s+/),path=[];let args=[],paint=null,clipping=false;
   for(const token of tokens){
    if(/^-?\d+(?:\.\d+)?$/.test(token)){args.push(token);continue;}
    if(token==='w'){width=Number(args.pop());args=[];continue;}
    if(['m','l','c'].includes(token)){path.push(({m:'M',l:'L',c:'C'})[token]+args.join(' '));args=[];continue;}
    if(token==='h'){path.push('Z');continue;}
    if(token==='W'){clipping=true;continue;}
    if(token==='f'||token==='S')paint=token;
   }
   if(clipping){clipId=`pdf-clip-${index}-${drawing.length}`;drawing.push(`<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><path d="${path.join(' ')}"/></clipPath></defs>`);continue;}
   if(!paint)throw new Error(tr('Dessin de conduite non reconnu'));
   drawing.push(`<path d="${path.join(' ')}" fill="${paint==='f'?fill:'none'}" stroke="${paint==='S'?stroke:'none'}" stroke-width="${width}"/>`);continue;
  }
  throw new Error(tr('Instruction de conduite non reconnue'));
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" width="595" height="842" role="img" aria-label="${escapeXml(tr('Page {page} sur {total}',{page:index+1,total:page.totalPages})+' — '+title)}"><title>${escapeXml(`${tr('Conduite technique')} — ${title} — page ${index+1}`)}</title><rect width="595" height="842" fill="white"/><g transform="translate(0 842) scale(1 -1)">${drawing.join('')}</g></svg>`;
}
function mountTechnicalPreview(pages,title,controls){
 const {container,minus,plus,label,fit}=controls;let zoom=1,disposed=false;
 const fragment=document.createDocumentFragment(),elements=[];
 pages.forEach((page,index)=>{const element=document.createElement('article');element.className='pdfPreviewPage';element.setAttribute('aria-label',tr('Page {page} sur {total}',{page:index+1,total:pages.length}));element.innerHTML=svgPage({...page,totalPages:pages.length},index,title);elements.push(element);fragment.append(element);});
 container.replaceChildren(fragment);
 function layout(){if(disposed)return;const padding=parseFloat(getComputedStyle(container).paddingLeft)*2,baseWidth=Math.min(794,Math.max(100,container.clientWidth-padding));for(const element of elements)element.style.width=`${Math.round(baseWidth*zoom)}px`;label.textContent=`${Math.round(zoom*100)} %`;minus.disabled=zoom<=1;plus.disabled=zoom>=3;}
 function change(value){const old=zoom;zoom=Math.max(1,Math.min(3,value));layout();container.scrollTop=container.scrollTop*zoom/old;}
 const zoomOut=()=>change(zoom-.25),zoomIn=()=>change(zoom+.25),fitPage=()=>{change(1);container.scrollLeft=0;};
 minus.addEventListener('click',zoomOut);plus.addEventListener('click',zoomIn);fit.addEventListener('click',fitPage);
 const observer=new ResizeObserver(layout);observer.observe(container);layout();
 return()=>{disposed=true;observer.disconnect();minus.removeEventListener('click',zoomOut);plus.removeEventListener('click',zoomIn);fit.removeEventListener('click',fitPage);container.replaceChildren();elements.length=0;};
}

return {mountTechnicalPreview};})();
// END EMBEDDED TECHNICAL PREVIEW

// Project toolbox. The plan and checklist travel with the project manifest.
function toolClamp(value,min,max,fallback){
 const number=Number(value);
 return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;
}
function newChecklistItem(text='',checked=false){return {id:uuid(),text,checked};}
function setChecklistItemChecked(item,checked){
 if(item.checked===checked)return;
 item.checked=checked;item.checkRevision=uuid();
}
function normalizeChecklist(checklist,template=false){
 const used=new Set();
 return {title:typeof checklist?.title==='string'?checklist.title.slice(0,90):'',
  sections:(Array.isArray(checklist?.sections)?checklist.sections:[]).slice(0,50)
   .filter(section=>section&&typeof section==='object').map(section=>({
    title:String(section.title||'').slice(0,90),icon:typeof section.icon==='string'?section.icon:'',
    items:(Array.isArray(section.items)?section.items:[]).slice(0,120).filter(item=>item&&typeof item==='object')
     .map(item=>{
      const id=typeof item.id==='string'&&item.id.length<=80&&!used.has(item.id)?item.id:'';
      const text=String(item.text||'').slice(0,240);
      if(template)return {text,checked:false};
      const record=id?{id,text,checked:item.checked===true}:newChecklistItem(text,item.checked===true);
      if(item.preparationSource==='show'||item.preparationSource==='act')record.preparationSource=item.preparationSource;
      if(id&&typeof item.checkRevision==='string'&&item.checkRevision.length<=80)record.checkRevision=item.checkRevision;
      used.add(record.id);return record;
     })
   }))};
}
function normalizeSequenceSheets(value,checklist){
 const sheets=[],seen=new Set(),ids=new Set(checklist.sections.flatMap(section=>section.items.map(item=>item.id)));
 for(const sheet of Array.isArray(value)?value:[]){
  const id=sheet?.cueId;
  if(typeof id!=='string'||!id||seen.has(id))continue;
  const notes=typeof sheet.notes==='string'?sheet.notes.slice(0,4000):'';
  const itemIds=Array.from(new Set((Array.isArray(sheet.itemIds)?sheet.itemIds:[]).filter(item=>ids.has(item))));
  seen.add(id);
  if(notes||itemIds.length)sheets.push({cueId:id,notes,itemIds});
 }
 return sheets;
}
function normalizeActPreparation(value){
 const lines=items=>Array.isArray(items)?items.slice(0,120).filter(item=>typeof item==='string')
  .map(item=>item.trim().slice(0,240)).filter(Boolean):[];
 return {equipment:lines(value?.equipment),setup:lines(value?.setup)};
}
function normalizeChecklistImportHistory(value){
 const strings=list=>Array.isArray(list)?list.slice(0,200).filter(item=>typeof item==='string').map(item=>item.slice(0,300)):[];
 return (Array.isArray(value)?value:[]).slice(0,10).filter(record=>Number.isFinite(record?.at)&&Array.isArray(record.changes)).map(record=>({
  at:record.at,files:strings(record.files),order:strings(record.order),
  changes:record.changes.slice(0,6000).filter(row=>typeof row?.text==='string').map(row=>({
   text:row.text.slice(0,240),section:typeof row.section==='string'?row.section.slice(0,90):'',
   checked:row.checked===true,manual:row.manual===true,files:strings(row.files),
   itemId:typeof row.itemId==='string'?row.itemId.slice(0,80):undefined,
   revision:typeof row.revision==='string'?row.revision.slice(0,80):undefined,
   previous:typeof row.previous==='boolean'?row.previous:undefined,restored:row.restored===true
  }))
 }));
}
function normalizePilotTools(saved){
 const plan=saved?.stagePlan,checklist=normalizeChecklist(saved?.checklist);
 return {
  stagePlan:{width:toolClamp(plan?.width,1,60,10),depth:toolClamp(plan?.depth,1,60,7),grid:plan?.grid!==false,audience:plan?.audience==='top'?'top':'bottom',objects:(Array.isArray(plan?.objects)?plan.objects:[]).slice(0,200)
   .filter(item=>['circle','square','triangle','cross','person'].includes(item?.shape)).map(item=>({
    shape:item.shape,name:String(item.name||'').slice(0,30),color:normalizeGoCueColor(item.color)||'#6452ad',
    x:toolClamp(item.x,0,840,420),y:toolClamp(item.y,0,590,295),size:toolClamp(item.size,12,180,54),
    angle:toolClamp(item.angle,0,359,0)
   }))},
  lightingPlan:normalizeLightingPlan(saved?.lightingPlan),
  checklist,sequenceSheets:normalizeSequenceSheets(saved?.sequenceSheets,checklist),
  actPreparation:normalizeActPreparation(saved?.actPreparation),
  checklistImportHistory:normalizeChecklistImportHistory(saved?.checklistImportHistory)
 };
}
function savePilotTools(){
 // These fields don't invalidate the media cache or restart preflight.
 clearTimeout(autosaveTimer);
 autosaveTimer=setTimeout(()=>writeAutosave().catch(console.warn),120);
}
const stageShapeNames={circle:'Rond',square:'Carré',triangle:'Triangle',cross:'Croix',person:'Personnage'};
let stageToolSelection=-1,stageToolDrag=null;
function stageShapePath(ctx,shape,size){
 const half=size/2;
 ctx.beginPath();
 if(shape==='circle')ctx.arc(0,0,half,0,2*Math.PI);
 else if(shape==='square')ctx.rect(-half,-half,size,size);
 else if(shape==='triangle'){ctx.moveTo(0,-half);ctx.lineTo(half,half);ctx.lineTo(-half,half);ctx.closePath();}
 else if(shape==='cross'){
  const points=[[-1,-.63],[-.63,-1],[0,-.37],[.63,-1],[1,-.63],[.37,0],[1,.63],[.63,1],[0,.37],[-.63,1],[-1,.63],[-.37,0]];
  points.forEach(([x,y],index)=>index?ctx.lineTo(x*half,y*half):ctx.moveTo(x*half,y*half));
  ctx.closePath();
 }else{
  ctx.moveTo(.28*half,-.69*half);ctx.arc(0,-.69*half,.28*half,0,2*Math.PI);ctx.closePath();
  const points=[[-.34,-.31],[.34,-.31],[.76,.26],[.52,.43],[.29,.11],[.29,.96],[.05,.96],[0,.45],[-.05,.96],[-.29,.96],[-.29,.11],[-.52,.43],[-.76,.26]];
  points.forEach(([x,y],index)=>index?ctx.lineTo(x*half,y*half):ctx.moveTo(x*half,y*half));
  ctx.closePath();
 }
}
function drawStageTool(ctx,plan,selected=-1){
 const w=840,h=590,flip=plan.audience==='top',y=value=>flip?h-value:value;
 const text=(label,x,at,size,color='#31435c')=>{
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold '+size+'px Arial';ctx.fillText(label,x,at);
 };
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#f4f7fb';ctx.fillRect(0,0,w,h);
 const scale=Math.min(512/plan.width,355/plan.depth),width=plan.width*scale,depth=plan.depth*scale;
 const left=(w-width)/2,top=270.5-depth/2,front=top+depth,back=Math.min(y(top),y(front));
 ctx.fillStyle='#e6edf6';ctx.fillRect(28,back,784,depth);
 ctx.fillStyle='#fff';ctx.fillRect(left,back,width,depth);
 if(plan.grid){
  ctx.strokeStyle='#d2dce9';ctx.lineWidth=1;ctx.beginPath();
  for(let metre=1;metre<plan.width;metre++){const x=left+metre*scale;ctx.moveTo(x,y(top));ctx.lineTo(x,y(front));}
  for(let metre=1;metre<plan.depth;metre++){const at=y(top+metre*scale);ctx.moveTo(left,at);ctx.lineTo(left+width,at);}
  ctx.stroke();
 }
 ctx.strokeStyle='#8190a6';ctx.lineWidth=2;ctx.strokeRect(left,back,width,depth);
 text(tr('PLATEAU'),420,y(top+Math.min(18,depth/2)),14);
 text(tr('FOND DE SCÈNE'),420,y(52),14);
 text(plan.width+' × '+plan.depth+' m'+(plan.grid?' · '+tr('Grille de 1 m'):''),420,y(75),13);
 const wings=[(left+28)/2,(left+width+812)/2];
 for(const x of wings){
  text(tr('ACCÈS SCÈNE'),x,y(65),12);text(tr('COULISSES'),x,y(277),13);
  ctx.strokeStyle='#59719a';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(x,y(78));ctx.lineTo(x,y(102));
  ctx.moveTo(x-6,y(96));ctx.lineTo(x,y(102));ctx.lineTo(x+6,y(96));ctx.stroke();
  const offset=x<420?18:-66;
  ctx.fillStyle='#555176';
  for(const fraction of [.17,.45,.73]){
   const r=top+depth*fraction;
   ctx.fillRect(x+offset,Math.min(y(r),y(r+12)),48,12);
  }
 }
 text(tr('PUBLIC'),420,y(549),16);
 ctx.fillStyle='#667b96';
 for(let i=0;i<9;i++){
  const x=260+i*40;
  ctx.beginPath();ctx.arc(x,y(483),5,0,2*Math.PI);ctx.fill();
  ctx.fillRect(x-8,Math.min(y(492),y(501)),16,9);
 }
 for(let i=0;i<plan.objects.length;i++){
  const item=plan.objects[i];
  ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.angle*Math.PI/180);
  stageShapePath(ctx,item.shape,item.size);
  ctx.fillStyle=item.color;ctx.fill();ctx.strokeStyle=i===selected?'#25233e':'#354255';ctx.lineWidth=i===selected?3:1;ctx.stroke();
  ctx.restore();
  if(item.name.trim()){
   const yLabel=Math.min(h-12,item.y+item.size/2+14);
   ctx.font='bold 13px Arial';
   const width=Math.min(214,ctx.measureText(item.name).width+12);
   const x=Math.min(w-width/2,Math.max(width/2,item.x));
   ctx.fillStyle='#ffffffed';ctx.fillRect(x-width/2,yLabel-9,width,18);
   ctx.fillStyle='#16233a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(item.name,x,yLabel,width-8);
  }
 }
}
function selectedStageObject(){return pilotTools.stagePlan.objects[stageToolSelection];}
function paintStageTool(){
 const canvas=$('stagePlanCanvas');
 drawStageTool(canvas.getContext('2d'),pilotTools.stagePlan,stageToolSelection);
}
function updateStageTool(){
 const plan=pilotTools.stagePlan,picker=$('stageObjectPicker'),item=selectedStageObject();
 $('stageAudience').value=plan.audience;
 $('stageWidth').value=plan.width;$('stageDepth').value=plan.depth;$('stageGrid').checked=plan.grid;
 picker.replaceChildren(new Option(tr('Aucun objet sélectionné'),''));
 plan.objects.forEach((object,index)=>picker.append(new Option(object.name||tr(stageShapeNames[object.shape])+' '+(index+1),String(index))));
 picker.value=item?String(stageToolSelection):'';
 $('stageObjectFields').disabled=!item;
 $('stageObjectName').value=item?.name||'';$('stageObjectColor').value=item?.color||'#6452ad';
 $('stageObjectSize').value=item?String(item.size):'';$('stageObjectAngle').value=item?String(item.angle):'';
 $('stageObjectX').value=item?String(Math.round(item.x*100/840)):'';
 $('stageObjectY').value=item?String(Math.round(item.y*100/590)):'';
 for(const button of $('stageShapes').querySelectorAll('button'))button.disabled=plan.objects.length>=200;
 paintStageTool();
}
function stageToolPoint(event,canvas){
 const bounds=canvas.getBoundingClientRect();
 const width=Number(canvas.dataset.logicalWidth)||canvas.width,height=Number(canvas.dataset.logicalHeight)||canvas.height;
 const style=getComputedStyle(canvas),left=parseFloat(style.borderLeftWidth)||0,right=parseFloat(style.borderRightWidth)||0;
 const top=parseFloat(style.borderTopWidth)||0,bottom=parseFloat(style.borderBottomWidth)||0;
 return {x:(event.clientX-bounds.left-left)*width/(bounds.width-left-right),y:(event.clientY-bounds.top-top)*height/(bounds.height-top-bottom)};
}
function stageToolHit(ctx,item,point){
 const dx=point.x-item.x,dy=point.y-item.y,angle=-item.angle*Math.PI/180,half=item.size/2;
 const x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);
 if(Math.abs(x)>half||Math.abs(y)>half)return false;
 stageShapePath(ctx,item.shape,item.size);
 return ctx.isPointInPath(x,y);
}
function placeStageToolObject(item,x,y){
 const margin=item.shape==='circle'?item.size/2:item.size/Math.sqrt(2);
 item.x=toolClamp(x,margin,840-margin,420);
 item.y=toolClamp(y,margin,590-margin,295);
}

const checklistToolIcons={
 plateau:['Plateau','2,5 22,5 22,20 2,20 2,5|6,20 6,11 18,11 18,20'],
 lumiere:['Lumière','7,4 17,4 17,13 7,13 7,4|9,13 7,19|15,13 17,19|12,15 12,21'],
 son:['Son','3,9 8,9 13,4 13,20 8,15 3,15 3,9|17,8 20,12 17,16'],
 micro:['Micro','9,4 15,4 15,12 12,15 9,12 9,4|6,11 6,15 12,19 18,15 18,11|12,19 12,22'],
 video:['Vidéo','3,6 16,6 16,18 3,18 3,6|16,10 22,7 22,17 16,14'],
 cable:['Câbles','3,4 3,9 8,9 8,4|5,9 5,16 9,20 18,20 21,17 21,14|18,14 23,14'],
 alimentation:['Alimentation','13,2 5,14 11,14 10,22 19,10 13,10 13,2'],
 securite:['Sécurité','12,3 20,6 19,15 12,21 5,15 4,6 12,3|8,12 11,15 16,9'],
 costume:['Costumes','8,5 12,7 16,5 22,9 19,13 16,11 16,21 8,21 8,11 5,13 2,9 8,5'],
 accessoire:['Accessoires','3,8 21,8 21,20 3,20 3,8|8,8 8,4 16,4 16,8|3,13 21,13'],
 transport:['Transport','2,6 14,6 14,17 2,17 2,6|14,9 19,9 22,13 22,17 14,17|5,17 5,21 8,21 8,17|17,17 17,21 20,21 20,17'],
 loge:['Loge','4,21 4,3 17,3 17,21|2,21 22,21|13,12 15,12'],
 regie:['Régie','4,5 20,5 20,19 4,19 4,5|8,8 8,16|12,8 12,16|16,8 16,16|6,11 10,11|10,14 14,14|14,10 18,10'],
 reseau:['Réseau','3,9 8,5 16,5 21,9|6,12 10,9 14,9 18,12|9,15 12,13 15,15|12,18 12,19'],
 montage:['Montage','4,20 12,12 10,7 13,4 18,3 15,7 17,9 21,6 20,11 17,14 13,14 6,22 4,20'],
 controle:['Contrôle','5,5 19,5 19,21 5,21 5,5|9,3 15,3 15,7 9,7 9,3|8,13 11,16 16,10'],
 ampoule:['Ampoule','9,17 9,14 6,11 6,7 8,4 12,3 16,4 18,7 18,11 15,14 15,17 9,17|9,20 15,20|11,22 13,22|12,17 12,11 10,9|12,11 14,9'],
 prise:['Prise électrique','7,9 17,9 17,14 14,17 10,17 7,14 7,9|9,9 9,4|15,9 15,4|12,17 12,22'],
 table:['Table','2,8 22,8 22,11 2,11 2,8|5,11 5,21|19,11 19,21'],
 chaise:['Chaise','6,3 6,15 18,15 18,12 6,12|6,15 6,22|17,15 17,22|6,3 13,3 13,10 6,10'],
 stylo:['Stylo','4,20 6,15 17,4 20,7 9,18 4,20|15,6 18,9|6,15 9,18'],
 ordinateur:['Ordinateur','4,5 20,5 20,16 4,16 4,5|4,16 2,20 22,20 20,16|10,18 14,18'],
 casque:['Casque audio','4,15 4,10 6,6 9,4 15,4 18,6 20,10 20,15|4,13 8,13 8,20 4,20 4,13|16,13 20,13 20,20 16,20 16,13'],
 horloge:['Horloge','12,3 17,4 20,8 21,12 20,16 17,20 12,21 7,20 4,16 3,12 4,8 7,4 12,3|12,7 12,12 16,14'],
 cle:['Clé','9,4 13,4 16,7 16,11 13,14 10,14 10,18 8,18 8,21 4,21 4,17 8,13 6,10 6,7 9,4|11,7 13,7 13,9 11,9 11,7'],
 ruban:['Ruban adhésif','10,4 15,4 19,7 20,12 18,17 14,20 9,20 5,17 4,12 6,7 10,4|10,9 14,9 16,12 14,15 10,15 8,12 10,9|19,15 22,20 14,20'],
 bouteille:['Bouteille','9,3 15,3 15,8 18,11 18,21 6,21 6,11 9,8 9,3|6,13 18,13|6,17 18,17'],
 trousse:['Premiers secours','3,7 21,7 21,20 3,20 3,7|8,7 8,4 16,4 16,7|12,10 12,17|8.5,13.5 15.5,13.5'],
 rideau:['Rideau','2,4 22,4|4,4 4,20 10,20 7,13 10,4|20,4 20,20 14,20 17,13 14,4'],
 carton:['Carton','3,8 12,3 21,8 21,17 12,22 3,17 3,8 12,13 21,8|12,13 12,22|7,6 16,11'],
 flightcase:['Flight case','3,7 21,7 21,19 3,19 3,7|8,7 8,4 16,4 16,7|3,11 21,11|6,10 6,13|18,10 18,13|5,19 5,21|19,19 19,21'],
 multiprise:['Multiprise','2,8 20,8 20,16 2,16 2,8|20,12 23,12|5,11 5,13|8,11 8,13|11,11 11,13|14,11 14,13|17,11 17,13'],
 rallonge:['Rallonge','3,3 3,7 7,7 7,3|5,7 5,16 7,20 13,20 16,17 16,12 13,9 10,12 10,15 13,17 20,17 22,15 22,11'],
 piles:['Piles','5,6 11,6 11,21 5,21 5,6|7,6 7,3 9,3 9,6|14,6 20,6 20,21 14,21 14,6|16,6 16,3 18,3 18,6|6,12 10,12|8,10 8,14'],
 chargeur:['Chargeur','7,4 7,8|13,4 13,8|5,8 15,8 15,15 5,15 5,8|10,15 10,20 20,20 20,16|18,16 22,16'],
 adaptateur:['Adaptateur','7,3 7,7|15,3 15,7|4,7 18,7 18,17 4,17 4,7|8,11 8,13|14,11 14,13|9,17 9,21 14,21 14,17'],
 usb:['Clé USB','4,9 14,9 14,16 4,16 4,9|14,10 21,10 21,15 14,15|17,12 18,12|6,12 8,12'],
 piedmicro:['Pied de micro','12,20 12,8 18,5|12,20 6,22|12,20 18,22|16,4 20,2 22,6 18,8 16,4'],
 gants:['Gants','5,21 4,14 3,11 5,10 7,14 7,5 9,4 10,10 10,3 12,3 13,10 14,4 16,5 16,11 18,7 20,8 20,14 16,21 5,21'],
 lampe:['Lampe torche','3,5 12,5 12,10 9,13 9,21 6,21 6,13 3,10 3,5|15,7 21,4|15,10 22,10|15,13 21,16']
};
function checklistIconKey(key){
 return Object.prototype.hasOwnProperty.call(checklistToolIcons,key)?key:'controle';
}
function checklistIconLines(key){
 return checklistToolIcons[checklistIconKey(key)][1].split('|').map(line=>line.split(' ').map(point=>point.split(',').map(Number)));
}
function checklistToolIcon(key){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','checklistIcon');svg.setAttribute('aria-hidden','true');
 for(const line of checklistIconLines(key)){
  const polyline=document.createElementNS(ns,'polyline');
  polyline.setAttribute('points',line.map(point=>point.join(',')).join(' '));polyline.setAttribute('fill','none');
  polyline.setAttribute('stroke','currentColor');polyline.setAttribute('stroke-width','1.5');polyline.setAttribute('stroke-linejoin','round');
  svg.append(polyline);
 }
 return svg;
}
function checklistToolButton(text,action){
 const button=document.createElement('button');button.type='button';button.textContent=tr(text);button.onclick=action;return button;
}
function checklistToolField(text,control){
 const label=document.createElement('label');label.append(document.createTextNode(tr(text)),control);return label;
}
function checklistToolText(value,length,callback,label){
 const input=document.createElement('input');input.type='text';input.value=value;input.maxLength=length;
 input.setAttribute('aria-label',tr(label));input.oninput=()=>{callback(input.value);savePilotTools();};return input;
}
let closeChecklistIconGallery=null;
function checklistIconPicker(section,index,header){
 const field=document.createElement('div'),caption=document.createElement('span'),trigger=document.createElement('button');
 const gallery=document.createElement('div'),options=[];
 field.className='checklistCategory';caption.className='checklistIconCaption';caption.textContent=tr('Icône');
 trigger.type='button';trigger.className='checklistIconTrigger';
 gallery.className='checklistIconGallery';gallery.id='checklistIcons-'+index;gallery.hidden=true;
 gallery.setAttribute('role','group');gallery.setAttribute('aria-label',tr('Choisir une icône'));
 trigger.setAttribute('aria-controls',gallery.id);trigger.setAttribute('aria-expanded','false');
 field.append(caption,trigger);header.append(field);
 let selected=checklistIconKey(section.icon);
 const chevron=document.createElement('span');chevron.className='checklistIconChevron';chevron.setAttribute('aria-hidden','true');
 function updateTrigger(){
  trigger.replaceChildren(checklistToolIcon(selected),chevron);
  trigger.setAttribute('aria-label',tr('Choisir une icône')+' - '+tr(checklistToolIcons[selected][0]));
 }
 function close(restoreFocus=false){
  gallery.hidden=true;trigger.setAttribute('aria-expanded','false');
  if(closeChecklistIconGallery===close)closeChecklistIconGallery=null;
  if(restoreFocus)trigger.focus({preventScroll:true});
 }
 for(const [key,[name]] of Object.entries(checklistToolIcons)){
  const option=document.createElement('button');option.type='button';option.dataset.checklistIcon=key;
  option.title=tr(name);option.setAttribute('aria-label',option.title);option.setAttribute('aria-pressed',String(key===selected));
  option.append(checklistToolIcon(key));options.push(option);gallery.append(option);
  option.onclick=()=>{
   section.icon=selected=key;
   options.forEach(button=>button.setAttribute('aria-pressed',String(button===option)));
   updateTrigger();close(true);savePilotTools();
  };
 }
 trigger.onclick=()=>{
  if(!gallery.hidden){close();return;}
  closeChecklistIconGallery?.();
  gallery.hidden=false;trigger.setAttribute('aria-expanded','true');closeChecklistIconGallery=close;
  options.find(option=>option.dataset.checklistIcon===selected)?.focus({preventScroll:true});
 };
 for(const element of [trigger,gallery])element.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!gallery.hidden){event.preventDefault();event.stopPropagation();close(true);}
 });
 updateTrigger();
 return gallery;
}
function renderChecklistTool(focusSection=-1,focusItem=-1){
 const list=$('checklistSections'),data=pilotTools.checklist;
 $('checklistEmpty').hidden=!!data.sections.length;
 const acts=actsForChecklist(),usages=actChecklistUsage(acts),source=preparationChecklistSource();
 refreshChecklistActFilter(acts);
 closeChecklistIconGallery?.();list.replaceChildren();$('checklistName').value=data.title;
 $('checklistAddSection').disabled=data.sections.length>=50;
 let focus=null;
 data.sections.forEach((section,index)=>{
  const card=document.createElement('section'),header=document.createElement('div');
  card.className='checklistToolSection';header.className='checklistSectionHeader';
  const title=checklistToolText(section.title,90,value=>{section.title=value;updateChecklistControls();},'Titre de la rubrique');
  title.classList.add('checklistSectionTitle');title.placeholder=tr('Titre de la rubrique');header.append(title);if(index===focusSection&&focusItem<0)focus=title;
  const gallery=checklistIconPicker(section,index,header);
  const remove=checklistToolButton('×',()=>{
   pushHistory();data.sections.splice(index,1);pruneSequenceLinks();renderChecklistTool();savePilotTools();
  });
  remove.className='checklistDelete';remove.setAttribute('aria-label',tr('Supprimer la rubrique'));header.append(remove);card.append(header,gallery);
  const progress=document.createElement('div'),meter=document.createElement('progress'),count=document.createElement('span');
  progress.className='checklistProgress';progress.hidden=true;
  count.setAttribute('aria-hidden','true');progress.append(meter,count);card.append(progress);
  section.items.forEach((item,itemIndex)=>{
   const row=document.createElement('div'),check=document.createElement('input');
   row.className='checklistItem';check.type='checkbox';check.checked=item.checked;
   check.setAttribute('aria-label',tr('Cocher cet élément'));check.onchange=()=>{setChecklistItemChecked(item,check.checked);updateChecklistControls();savePilotTools();};
   const link=document.createElement('button'),usage=document.createElement('small');
   link.type='button';link.className='checklistActLink';
   usage.className='checklistActUsage';
   const updateLink=()=>{
    const linked=item.preparationSource===source;
    const acts=usages.get(checklistTextKey(item.text));
    link.hidden=(!linked&&!!item.preparationSource)||!acts;
    usage.hidden=!linked||!acts;
    usage.textContent=usage.hidden?'':tr('Utilisé par {acts}',{acts:acts.join(', ')});
    link.textContent=tr(linked?'Détacher':'Rattacher aux numéros');
    link.setAttribute('aria-label',link.textContent+' · '+item.text);
   };
   link.onclick=()=>{
    if(locked||!requiredActChecklistKeys().has(checklistTextKey(item.text)))return;
    pushHistory();
    if(item.preparationSource===source)delete item.preparationSource;
    else item.preparationSource=source;
    updateLink();savePilotTools();
   };
   const text=checklistToolText(item.text,240,value=>{
    item.text=value;delete item.preparationSource;updateLink();updateChecklistControls();
   },'Élément de checklist');
   text.placeholder=tr('À faire…');
   updateLink();
   if(index===focusSection&&itemIndex===focusItem)focus=text;
   const remove=checklistToolButton('×',()=>{
    pushHistory();section.items.splice(itemIndex,1);pruneSequenceLinks();renderChecklistTool(index);savePilotTools();
   });
   remove.className='checklistDelete';remove.setAttribute('aria-label',tr('Supprimer cet élément'));row.append(check,text,remove,usage,link);card.append(row);
  });
  const add=checklistToolButton('+ Élément',()=>{
   pushHistory();section.items.push(newChecklistItem());renderChecklistTool(index,section.items.length-1);savePilotTools();
  });
  add.className='checklistAddItem';add.disabled=section.items.length>=120;card.append(add);list.append(card);
 });
 updateChecklistControls();renderChecklistImportHistory();focus?.focus();
}

// Lossless PDF samples derived from icons/s2a-pilot-192.png, including its alpha channel.
const pilotToolboxLogo={rgb:'eNqlnQV4VNfW99faZ0KCFLc4MSAJcc/E3YknECEJIYHgrsXdpUJxaEspVpxSihUKhZaWurtRuW2huOVba+8zk4G+ct/75VnPeQ7JZHLOb/7L9t5nA/BvfE1rhMZGdSoAtm8/G/z6tW6v3eh84lqHk9e7nLzd9fiNdq9cb3noevMD15rv/9tm71WbXX/Z7PjT5sU/rLf+bvP8bzbP/maz+VfrTb9Yb/jFev0v1mulrfuVbe2v1qt/sX76crMnf272xM/NVkpb/lOzpT9aLfreaj5bs3nfWM36stnMz62mf2Y19dNmkz9uNvFDq3HvW42+ZDX8rWbDLlgNet1Qd8rQ/5ih+qih6hVDzStWVS9b9zvUvOpgu9pDHesOt63a16HfHsf6A6FDd2nm+yraDtAI/z9fjToZBBh66DO3N663P3unxdk7Vmdua+ca8Y1GPNcIJxvhyB3YfwP2XIOdf8O2v+C5P2Dzv2D977DmV1h9GZ68DKt+guU/wLLvYen3sPhbWPANzPsa5n4Fc76AmZ/B1E9g8kcw6QMY/x6MfRfGXIJRb8Pwt2DYBRj2Jgy9AA3noOEsDHodBp6ButMw4BTUnoT+J6D6GFQdhX6HoewA9NkDJbuheBcU74TiHXzvRTuk7YSSvVh2UFQc1sr2WhVvb1W2q0u/l9KGbscmSv/R13adTNi5W53evNvirbvau43wQSO82Qin7sDR63DoGuy7iruv4It/4vPE5HdY/xus+QWe/BlX/ITLfsTF3zOK2V8qCPj4RzjxAxxPBN6BURdh+AUceg4bzmD9azjgBPQ/htVHsepl7HcIKw7yLffdj2X7sM8eLJVGt1+yC0skgaIdWPgiFr4gCp7HvC3YeyPmrIfstZj5DGaQPY3pT2Hak5guLe0pTF+NmWsgax3kPY9992nlB62Ld3QoeDasdK10kGn/NyGZHCrs3M12795v9vZ9/KQR3m6EM7fg5E04cg33/40vXYXtV2DrX7j5D2Sp/AZP/QqrLuOyn2DxDzD/O5jzDcz8Cqd9jpM/hvHvS1UwExj6Bja8DoNOY91JrD0GNSwArNyP5fQp7xF9d4s+SgDboHAbFr1AEJAg5D+Lecq2YO4mzNmA2eswa41EQQSewLRVmLICk5dh0hJMXIQJCzFhgUiYj/HS9JMF9FORslzQr+RuFkW7rAtf6FK8Rfc4pvTvysYAYHvxjvX79/ALSebsbSbzyg08cB12XcUX/sItf+CG32Htb7D6V3jiF1jxMy79CRf9iCYyMO0zmPQJjP8ASS0j3oRh53EwY4H6UzDgGPQ/itUklYNYvg/LXsK+u7B0O5Zsw+IXsGgr5j+H+VswbxOhgNwNmLsee6/DnLWYvQazSAnE5AmRvhJTV2DKMpGylJkkLcbEhZLDPIybgzGzMHamiJmBUdMxahoap6LxcbaoqRgzXcTP1ZIWaakrRe5mQ8ELbTLXJObO/bd8TcIJ3/9763fuia8b4f1GOH8HTt+CV2/CgWv40t+4/So+/yds/JckQ670C674GZb+iIt+gHnf4ZxvYdbXMP0LfPxTnPghjnuPIgmSZoaQH53G+hNY+yrUvMJkqg5iJZOBPjuxhMi8KMk8B4VbIH8zkSEs0HutZPIMZj2Dmasxg9yEdLICU5cjMUlZzEySF4mkhSKRsMxlLHGMBQlL9HSMnsZAIidjxCSMmIDh4zGMbJwIH4cRE4VxihYzQ0uYr6Wt1HKfbZn+tE/mvP9FRRKOLyWgt+7BV43wzj1k2dzCw9dh71XYcQVf+BO3/Itl8wxp5jKs/BmW/YQLv4d538Kcr2HGl0De9PinQA41gWTzLo58C4aeh4bXcSBHGOz/ClQdhn4HsGIvlpNmdrJmirdh4fNYSIIhLBsxj7CQWtZC9jOQ9TRmPokZT0L6KnYfVstSSFlCTDBpISYtwMR5mDBPJMzF+FkYx1ggRmKJnopRpJbJGKnIjMOwsRg6BkNGYvAIacMxZIQIGy2MEzWSWfJikbW2ecpK77SF/y0iGXC89/9hTXA+oyB8F07fxiNMBndcASLz7B+48V9IKekpIvMTaQYWfQ/zv4XZX8H0z4GwTPqYvWksaeYSjLyIw87D4LMw8BTWHUfdmw7IILMb+uxgVyqSWAq2YP4mzFMetIbVkk1YnsKMJ1B5UOoyYLUQFhLMAkFMEuciMUmYo2OJnYGx0xUTME7BqCkmLBNILRg2BkNHY8goxhI0FAOHYMBgDBgkAgYK/0EicLAWOlqLmqLRG2Y83SJpWUjiXI7VjY2PBmSA4JduWJ+5A580IsE5dQsPXsOdf8G2Pylf4+bfcd1vuPoXXEWaMZP5klwJpnwCEz8AcqXRFGcucjomLIMoK53EAcdlnDlMZKBiL3CQ2cGCKSIsrBbI28BYeq/BnNUo1QKEJWOldCLGAsxkkZSKjLEJc0TcLMFMpovYaUgWMxWjH2cmUZPROAkjJ2DEeF0wkowIHSVYNsN1OP4N6DcQfevQpxZ79Re+tSKgXgsZrkVO1OJmi9RVreLmCsrZRUUPKWd747TtH7Q6cYvgwFmKNjdYNi/+Cc/+AZs4a+MzMmsv/xEWf4/zv8E5X8EM0szHksy7nJgoAg89J8PvSRIM1B6FGpmpK/dD+R4s2wWlL2LJC+xKLJiNjIWlQliewkzJJH0Fpi3DVCmVlEWYzB4ESfOlVGZLqcySUpkmYqaKmMcFMTFOIgcRkRMllnEQrjOB0FEYOpK9KWSkCB4ugoZJ2TSg/yD0r0ffARJODfaqFt5V2KtK+PYXAQ1a2FgRM9uQurJzigxEZkSNjQSs4/6rgqLx67fh5Wuw+wpQPbPxN1j7Kzx9Gam6o9Ju0Xcw/2uc8yXO/AynfkzlHI6/BGOIzAUmQ2XMoJNQd4yxVB3SBcOJaQeWvgjFz0Phs6yZfEpG64D8SGIB8qC05ZLJYglkvkieJ5LmcWBJnIMJszB+BsZNZ/eJnQYxj2P0FMYSNQmilFTGYfhYQUzCRyMFk9CRInQEBJMNl4IhLEOlNzVAwCD0qxd+Ck4NelcTFvSuFF4V6FWOXhWCWBGiiPEifoF1zGy/hEl6IGJHa/Te/HuzV27B2btw8CpQsbeFNPMrrua6F5f9gIu+xXlfwazPYcYnMPUjnPw+EJnRb+HI8zj8LAw+DYNOYN2rWHsEq0kw+6B8N/TdyUGGyWzFQo4wwBFmLfZ+BrJ1wQCRSVuqsGCSHlJEwiwyjipx09iiJZPoKRg9WRCTKMo7EzByHESMwQiFhaQyAkOH8zGEbDgEDxPkSkFDMJDjDAlGkGb86oTvAOHTX/goMv3QsxI9y9GzDHv2IROeZYKEROEoYoKIm986eqIuoWksnjZ7/sQLjXD4b3jxD9jwC5HBJ3+CFd/Dkm9xPncBOONTfPxDnPQejH8HxrwFI8/D0DPQcAolGej/MlRTvqastIsEA6XbsOR5KH4OOVlv5NibuwY4wjyJmauAXYnIULylak0G28TZulTiZwBHlccxRgKJnozRkzB6ooieSGTQOB4jx2I4YRnFWMJGAmEJHoYhw0TwUAwZisFDKMgAkQlqYDIB9exNfgMEmW9/KZsq4VVJalFkBJMpxR4l2L0Yu5cIzz7Cp0oLGiKipttETw1KnaTcq8e6H5od/JtjzrZ/4dqfcdX3sPw7WPoNLvwK5n6BM0kzROZdHHcRR78JI84pMlD/Kgw4Av0PYdUBIgM6mRcIC9UwWLAJ8jdAHglmNfZ+GnKehEzCsgzTl3JsSVmIyfPJg6DJgyjSPg4xCgjrBKMmYNR4yWScICwRY6VgzGoZhsESCDMZLAgI22AMpCAzkFyJBeNHrtQfFRmlGZ1MX+zRh7CIHoSlCD0K0aNAuBeIHkXCs6/mX6eFjjHEzukUO1G1Vx2e+0Ucb4Sdv+Na6iK/gUVfwfwvYe5nOPNjnPoBTr4E4y/imPNMZtgZbDiBAyWZ2sNYsx/77cEKIrMd+xAZytebIX895K0DKRjIfhKyVmHmcshYhmmLm7CYBAPxkgwLhshM1kViHEdMWCqR5ESjpVpGsikyIUoqgzG4gY+EJVBJpY7JSFfiIMNYyKQ3Kc14mcmUSsEQmQJ0z0f3PHTrjW65dCK6F2re5VrgEC1mVqvIyY2NjW/VvdXy2ctw4CaspyD8Dc77DGd9jDM/gqnvw+R3YPwFGH0OR5yBoaew4TgOYjJYexCq90G/l6BiJ5YRGWoKnseizViwHvPWkGAg5ylJZgVhAfKjtIWYsgCT52ESh1xIID+i2DJV9yMmM5GlEqXIyKiimBCQMLJhrBYy3YNIJ4MwcCAbYQmoY/MfgH616NefTRcMkelHEVgPMkSmyZWYjPAwkXHNQddsaTnCrbfWs1jzqxXh45uFj/fJnOC54kOrLT/Dc7/Biq9g9scw9T2ccgkmXcRxF3AMkTkNQ09gw6tY/zIMOAT990P1XqhiMtB3G/bZiiXPSTIbiAzkKjJPQOYK8iNIWwypUjDJc0wRZjqH3FjFZJLuQVHj0EhSGS0iR2OEkspw6UFmnQzW1UJYgggLMRnA5l+L/hKIPAq/GvStYcH49JNkKsBLhV8LMuxKhVIzuVIzRCYLXbKwWyZ2y0DXTOGaRdw07wotaKhVxES76FGdV32lbfsLVlOD8DFMJiznYcw5GHUGh5+EIceg4SjWH8ba/Vj9ElbtgoodWL4N+m7F0uewZDMWbcJC0swzmPs0UoTJWgmZyzF9CaYuwlQpGMrRSUTGLJjJGEPhZYKZCbsP20gMHyHCh0upDMXQIRgyxALIQAis10WisLBOiEZVk/lUUWjVBcP5WrrSQ5opbPImBYdk45KNLkQmHZ3TdHNJ19yytR4koXotcnI749iOT3wBW6/AEir23obRr8PwEzjkGDa8ggMPY91BHLAPa3ZjxYtY/gKWPY+lzxIWKNrIWArWAJN5CnOewOyVmLEU0xdLV5qHyXMxeTYmzjKReZw1E0tkpFoiRwMBkUxYKmHDdSahgzFERRXCMgh0nVB9W0tHXSp+1ehbrYCgT6Uy4VOBvSpIMOhNZCQWT5mYPEtQRmDBsslHtzwOMibZCNdMdMlg2TgTn1ThlIxOKeiUKlwyNPd8rVe1FjGxjXF0l9VfwvrLOPt9GHcOhrwKjOUA1u7F6t1YvRMrtzGWPluwdCMWb8CidWDG0vsJzFmJ2csxaylmLCbBCCYzB5NnYdJMTJzBgombzK4UM1EnYxyNkYwFwoeRSSyDpSkmAzF4IAbVY2AdBg6QTGpYJ2YmbP3YfQgLAelVzuZdhl5lfPTuy3AIS0/CUoQ9CjnOKNkwnN5SM70Fy4bIZAqGw2RINkLnk4SOyfxPtxzNq4yyWLuYCW1XfQ5Pfo2TL8Dw41B/APu/BNU7od92LN+KfZ/F0k1YvB4L12DBasx7CvOeBIUlaxlmLsGMJZC+CNLmYwoJZhYkzRSJM0TCNBH/uCRjxiJdichEjEB2IsYCIQ0QzEAE2yAM1rEIHUu1xKKAMA0wA+lVLnqVMQrvPuglzbNUWgmTUUy6F+hYzN7kJoMwhRqXDCEdSjCZVNIMkRFMJkk4JiKZc4pwzdY8S6kraRs9Xlv0ESz5BEZRPbNPCmYrlj2LfTZjCallDeY/jflPYu+VmLMcs5exVDJJLYswfSGmzWMsKbMxaRarJWEqEpb4KRg3SSgy0eMwasyjZMIotpBaBkJQPQTVYVCdCJJqYTIUaWuEXz9m4ltpEkkZ9uortaGjAJ0GWTH2LNaPPYskmQLsns9YPCQWd8KSrecmJiODcLd00S2NIRAWR8KSKLEkCHXikID0fXIxqoUCG1qGjxbz3odZ78Igapq2Y98tWLKesEDB05BPalmFvVdgzlLIXIwZC9jSFmDqPEhRTjQDE6dhgmQSL8OLwhIzTmpmDHsTx5nhSK4kNSPJDJIeNACDiEktBvbHAFKL1ImflIqP0kmZzoRUwaYgFFM8AUJB7kPHnoXsRD2kWroXiO75wiNPeOSyVJS5ZoMUjB5nSDZEhsyJZMPeJJkkCId4dIgXbAl0wsSIYfcCzX+gNaXRmZTNz0P1bijdBOREpJZcqZacpZi1BDMXQfo8SJ3DOklRTKZjwjTJZBLGTtAthtUioseKqNGCg8wojBzBKYnzEQsGggdBMAsGOLDIjExYAqrRv4ql4lvBWHwkFiZjicUSRYFuJBKzKal4SLWYBAOuWeCS+RAWTk8pHIGddW+SJgVjHy/s49A+ls0hTufjUWDwHWBFJfq0izDmFJQ9h/lPQc5yYCxSLenzMI2wzMTkGZg8HZOmSqlMJvfB2Ik6k6ix7EFRo9E4ikyQH0WOECSYiGEiXLpS6GARMkgLGWgIHaiF1hmCBxiC+2uBNYLI+Flg8TFh8SpFrxIGQmQ8lTbysUc+dM9jeXTPoxNGQUw88pqYuPcWLJhsLmYoK/HREouMMwRH8hG6bBKVWlg2jCUW7WLQPobOhWO81i1Vc8/TfPo3Iz6T3oChL2PxOsxZpmNJVVh0JiJBSiV+IsaRVMZDzFiMbmLCOiFjJuRHkknYEBE2xBA+xBBGmqkD3yrwLAePPuBWDK6F4FIA7oVAbuLVR/iWa34VgsNLqSRDTKRUehboR0kD3HuDR29wy+ajB9HIYSMaytyzdTJuEovyJhfpR87Kj0xmijZERkjNsDnECvsYhmMXwydSQhSaNPfelOKbUa867jQM3MuJKYPi7QxMmsZYEqdgwmRMkFhiZUiJGcvuEz1GRBGW4RjJIlFGUmFjMg0YMsjAx4HgWQnupZSL7ROHR5ROzR64qO+olRVjVpWMWJZaPcs3a/Rjgf3AuTc4ZkGPAq1XqVBkPAvYeuQrMti9N0ogBKd1r0LBQBSHTHRTxv8U6jsMJ13HwmpJloJRWVv6kW7xTMCesehHu2hhL80umiREWmI+1Gt4VzULHiJGHMOaHeRTQIIhIIpJ3HiMZSYYPRoJSNRIQWYcwRYpmUQMxXACMpiZkBOFcQ0jQgdppBlPKuwrostmLt146PylL/66er3xH19379775odfdxx8vd+Y5W38+4J9GmERSjDdc5mJRw56ZLORPNyz0CntpUNnAtMa0DZRc5MozOaSLlzTlWCgW4rOxFmakynIOCosMg6bQo3kQ0yihJ1R2EdJU6CITyI3Gj7V7F9DjkD5s4JCDQkmdgzGjJFMRqJxBIuEaFD2IRQRZIMxXAJhGoMosCDbQLbgehFSr5E3efSJ6Tvj6Ol3HwHy4MGD+/elPXjwyI+++PrHgRNXgXMmuGYLEgzRcDdhccsydM+BznHJpePolU9v3gftozT3TNaJK/cCZj8SSjPdzN6UZPImXTYUVVg2pA12qFgONXZSOYqPjkjxiWEfVHxChuPAg1iyjt2K1GIcLuUxpEkbYYMwdKBuIfXS6tiCB4jgAXTkNB1UKwL7a0E14FEyeckL9+7d10Vy7z4B4a9/6Ie+Rd++xy/QX/zS4dc7eheAU5ronmOCwzoRbunCLuHU2Uv0+r+v3fCMqcKucRrDIRqpJksWzpZkEsjA0Zy1yWSoYc3EmhCZ4TzCRx4dEzTi4zvAOmQk1uzFgqc5AlNUCSNPGYRhRMOEgiHUSghk/QmFPPYXfFKDgdVC5mgtsBrcCuev2aOkYkZkqR+CQd9XTCyZ0T/u3rtHJ6+/+UHb7jmUWzUPgsO+Y/DIgo6x2f14HObOXX7N+ucOQNsIzZUEQ0xS9DjTLUk4JwkVZ0zeJBzjUMfCskEFxz5WY2M4GvORZBQl+yjTic5H86uzDh+LlbuA6kCKwOQ7IQMkAQWBb58twHQMqDKbIPOniq4S/Cq0wCrolt9v3CqlmUf0cu/e/f9CQISF3a0J4507d+n4/O5j0DWB+AhWCLWKKQa7+LMXPpDvfI/e+cbNW96x/bBztNZNFnhOiegkmVDEcEoQUjl6nDF5EyrlsDcpPkQm6iHlPGRRnMUcEzVqMfzqrcPGioqd2Hs5Z2rSDHOoAv9K1K0C/Sq4UOFjOZvvI1YmfMvAs6RLeM3lX/9UQeYR2aiTb3/89djpd/a/cu7w8Qtvv//Fn3/9baZk9rh7UkW9qx+HDkaDa6rBPY1O8moeN79MyXLTCwehTahGmnGM5+qX/IjMST8nLChN56PLJkbTQ7HuU2gJxzZS2CmTXka/RfpxyaT62SZyApZvx8zFwG3RANZMQD/iA37l4FumCKBPX7ZefaBXH/2crQ/2KqW6xcqvDBwyxy/YbL5+/X5NJ4eOvZlWNvkx3xKOwA5p4JimueXYhZaX1s9+7dx7loik0h689sa7wi6e9ENZycoh8cLbH/OPpNJkLHtw89Ytn7h+0DHS4KTgUMWraMQpn0JznNGTVIyequyjLGKOzkdTiBwIS7S0WGD5JQmXLMlnoui7jfoIiBmF3uXglgeuueCaBx4F4F0Kvn3Bv5yNROJDfAhIMXiX0JFrOa9C4VWE3kXCrffrb31kGXaUkChXjZq+GuxSwT6VajzsmYc9c6F7b3DPhm4Z0Dle2CUtfOpFRYYIUIRR0Sk4rR7s4qFDVHHddEuA8pWssWdfPAxtgjXnRMkhzhxbhGoQHsJihsNkyLNYSMTBkZIU/W402kVi5zBsG4gtfbCFDz7mh50ikBzcI88QOJj4aBXbIG6a9tR+ceZDWHMIZm7C+vmQMxJC+4Enlbs54JwF3XLAPQ96FgLx8SFuVPiVMBnvIrpxe2PNX1evWXqTuqNRM9ZA+3jNs0DzpB6BymBOTFaeeZyePLINPahXyoAOMftfOfuIS9aPW4LtjTbOKRff/VS+2/1HEt+tW7cDEvpBhzCNBCOLOuEgOdjF6AnaZJoKQY6yg3CgItmIncOxXTC08jPRCEXXBIwpxT6jcfxyWLlDnHpHW/6CsE8xBA22MU7GshcwcSYmjMLP/4S7jXBF2q/34MNf8PTHuPUEzH0WB87DjBEYVgndc8EpQ7pJBlCF6UUAs4Ozht/X9d9o9oUDr54H2xQDkenOZTA1jM175HaProYuCVTVgGsmuGRoVP51iTPmDPv+x1+Pn764Yu2u/iMXhqbVt/fNg7bh5Q2zHoFjKaGtO1+G1oHCidQii14+RsvQQdUdhSN2OhZS10iigS2JRi9s5YsdQ7BnCkb1wfKx+PgTuPEgnnwX3/8J6X6vNsLfjXC/Eb/8C4NKhVOGFjTEOnIilm7F9AXYowx6j8Ufr8PPd+HH+/BzI/zeCH81wvVGuNFIv4s/38PP/8BTH8CWV2DuZqifg+lDtIA+hCsoa5jyLOajFzb3IvJGoUMaKYc7ph69oWsiVXd7D5/J6juRQpDiAy7pZMIlvY1XLtjGU+KGtpHQOQYcEmycEt794HNLPuYTJaHbt+8EJlZCuxDNMRYIjhPLA0hLncKxdSC09AWi0SGYtUE0Ksbg1Cdw/R489jZ+9jtevscobspbuyLv9HIj3/VPd/HnG5g8ANuECY/eWuAQa+M0np1Jnk11DqkCR69E+sUf78HPD+Cn+2x0rv55Wb7PFfmeNxg1/nJPfPATRNfYB5f99fcNc5FDJ29e+pTrz555mmeetXeB5pAaVzTGLICyhjnQKU5zzwIX6gikOaaAS6rmmm5wTWvmkQFtwqqGznmYyYN/SujFl16BxwKEcxzYGrGlL7YNAoonwXlQMARGL8anduDhN/C9H/GXu3BN0rjJHzTfxS+N8NMD+PGuNHmbP9+HH+7itUYcsQha+AlKjlT/BA2ziZomSD/kX379KJ6AbYLY+AreaoTv7/Dv0m9dftBkDO2e/p58/oD8EYctER3iz779iYrPqtJb8/whaEcySIVO8eRQ0Cx49Zb99P1r129SaJr3xAvQ1mhwz1R8qM4xuGcIl1SgAs85GRwTWrumfPDRlzLINznX+x99fvPmraYg9eABlUwhyVXwmJ/mk4kLNuD2E/jGF/jdDYZwWxph+VPSoKv9UV45XX/TTUks6o6+v0N3LTYepndjV6XyieqfoGHW0dNF0bM8LupbgT0LSPPYI1scuYR3pGfR+//xz/eXoMgBf7gL1x8YthyFFmHDZq4xl3B08vufV069fmn7vlNPbNw7YcGGyoa5H3/2jWpL6RhfOBo6xZJaoFsqOJMlQ7tI8i+NJOSSQpGnoGaKWTyqQ7ly9Vo3n8zDR8+aqwgloZ17j5ErCedYfO87eNAI/zJpg5V/Vyr/vv7Jsplo0PfpNb/Ku7vG7oB3G8Ur77CTUvSmUE/9mhvzsYmZJfI28pyUTwX1zuCRDU4p0CMbxy7HNQfE4Yv46e9w+S5eeVifDOce8/nlPn7xJwb2ecwt68PPv3ukBPpnz84V8s6j0DGayhuGQ+aY9FiP7EHjltj750PrUGoTKGu3cEyYNu8ZBUcJcsGKzQBuGaUjKb7p5TiXDw/u3r0bllEL4G4oHwdXH8D3Fpr/WTrOT/dMIaIRfpPXf4sN6eTyPfHpb+LQeXxqJ46cB5TdOoRQ+uPSkSortxwteGTz2DkiZx1P7/Yq47EF7p0z+LI7xUCXODbCFV6OpRNw8mrY8DKe/gi//Rv/aMTrEhcF8DuNYs1BsAkJzR52RWZ54mDutriikSWN6p5On7vUlhoH6qzJm5xTSELYMSostZ5+9PPl34dPWAodjUA1jFM8WPtOX7BWqeiHn37p2COFC7n2wUePv2EWjzruOXACHvMXXcLx5Afwl0SkFHJZyskUh/ma6cpPvYdr9uK4pZjXAL6Z0IESfS+25t6U6LmEplBGeZDHN0g/I5rHzRNZz/CgulepHImiljmdDLpn0vVjxhAcvBgiq8AtE9oZoUUItDeCZy6kD8ahi+DpPXDqA/zyD7z+QBu9DNoYE4rH/nT5d3VT9yyqOqWc469d7EDw7ROQwg43lSnkUNA2bO/h0+bX7tzz6mOyubZyTqD0feDl0/TNwWMXUsxs5kLf8U/IHfTggXmQ5IESWERmLaC7oXI8fVicam82ogLy1Z+cvldtx/rpGFeOzjHYrAdAN2zWE7qGg18uDpiOSdXQKYQCO3UZSMWAbRTHHzm+oQWNtI5bIDKe4Pkpz2IeknKTQ3DEh/TvnAK+heLcd+zRb/+Kxz8Sm47ClLVQOBYCSymSQ6swaBMJ9OLUgdh/huadD7aJPaKqDr76hqVP6blmz7FWTslgn8ieJeOwwTUFWgVNmrPa1Ks+UBh37z+hdQw3dIuHNkExmXXvvv9pc8cYtFWdUTS0CTj8yplHJLTv8EmKq3SDhl3H8dTbOHc91kwCI11kJFp1R3DF1r7YMxUy63H8SrHugDj2Hly8TPclzn+HPVK5KKJXksn+1MQnWwsZax23UKQu4xlw4kNlrRpxYksFt3ToHAvBZeLjK/iLrBD+kvYbCfU2vvkD7ngd52+F8scxuA/YJ4NdgiB/JGitI3pXTj722kWzKp5av1vQWzlS0pRJqluy6JYMLYNGTlqmxGZO33fuchc/eNxCaOVPLYC1c5x7WCF0DgeHKLCL1ByjSULRGbX35ciSbPJYS/TPKJJQKz+DvRFsvChSYZsA9M6AohE4ewO+cAIvfEvXrNcnVziG4+VG8ekV8M/FVj7ci3WNQFsyblF1/3LrrYVOsIldoCUuFOEjeGDcLUsOx6WCS4ocfUpBQtTBiEXjBUW2Hx7A57fgi9vwzQP4oVEvhyh7/koyvoXnv4fd52DxDjFyGWYPhy7xhCssbeCqdbunL9pInZScdONoLChDOZI2wqbNXWNKT5aDHvzvr7754THSjy3FoijoFEbKATujtEhqJOEx332HTjwioYNHXoM2gYKU0DALDpxBEsZ3dzk9XTEltR8b4dv78OVt+PwmfP9A/KtRFI6EFr1Yll0ihK2ySPonD9Q7JQn3XC10vE3cYl5cHTqUx8aJjxqOc6FjiuCx3GR2tI5GHLkcv7/O4vlD/qGv78GXd+HLe/Ctrit2+TuNlOa0L/40HL7QLH8sOCRzeKeo1TFavm0KKYcDTiejTdfoNZv3qCGvfw6XqfPUwiHQOkCjLlKODCNfNvPRiE9r//DUqrt375kkxBmN3iQ2dyCgm1XDbHFfZtjv6Trv83V+cYftq3v8sUpi+OMNHLEYWvZih+pqAcdWjf9EcwZR+klYyk8oBDfwpJtbJt2IcJEm70jNGVFlC52jILICxqzAHWfgs6tcOZCivr8P7/0LjryvrXtZTHoGisZBUCkrp3kIuRgFKOvuWZprGsuGOLNbpUC7iO7BRRcvfdz433/dk0XUhJlPQAsfg1MMyM+Uw4IKEXQjhKiV7869Rx+R0JFjZ6GNv+gQiC+/A78SGWJylxH9KKVOOv/sKu54DUcuwpACfMyX39lWuVWE0J1L+pcdxx/iI8Im2yQs14yTRdBASu7CJU04k2woOKTofOQ5HYHihi2JIQI6R0NgMdTMgNo5kFgH3nnkR2DlD80CrDpG2/vkxeYMrRm1cPnanVt3vtLFN58CslIOjw93iYlIq3/11JsffvLVm+98dPHdT94me+/TN9/+8MfLv5mVo6L00qe2Mh/HaBWZlX54LEK5WFv/4MSK23fuPjANb6tx7sT8BgBXQ98x+BdLiI/kWRd/gg2HReUk4ZMp2gYKalTbB/EbmrAwGXW04CPccjXik7hCCx8rAuupHaMPGp2T2LolS/+iiCFNORrdJhd1KTwy0z6SjO4X7ONbdM+aumTzrsOn3//067/+bprKmbv8WWgTruldQxLYx3XyzCypmdKxRwapUbOP0WyjNdsoa2q3m/tOW7hWld9mPsuf1vnwNatxLa7cjPSh8+fuYISWPtt2vfyIhI4eP4dt/LXOIVb7L8D5L2H+Fswdgi5x2NqPmnfRMVQlQQknUiizU3Ai+IPQP4sYySdHi5hik7hKhIwQ/rXCvTdHCcXHOZFHvJV4XJIpVitE8kfJLCpXGaNkvG3ZPeP3P/56eB7n/uVf/tXRm1ryOMH9VKK0BI1Kmo6R0DUKHKjjJuN2W3OMgxa+0xeta+IjjzMWrYXmvaxYP5H64DmPZclAzR5nhLYBAbF9bt26bSkhikbJhQ3QwtvQIxEdorC5l6B+qnMEs+XBH+LcpBaVrRQfXUh2ik8sj/a752jh5F8rRfBQ4VfN89e85EMOdzsnCkKkpth0LSlLlrMGajKFSZK6SEi7D5yiD12pXd3d7oOnKGdx8HGWMwvOPHiOjvHUO2g8KBqnscWSWXeLF638Zy3dYCZDpRD3+HWTTf6l89FDtG2EMvayFr2ee+HAIxI6ceq8aBfA5TQFXgrvkqolk4eUYx5/5u8bTVVWjOTTW4RPtUlYoQUNlnyy5cxjIso7UnD4ZYqJpGROarrMnJKsKC61DmkYu9g8LKbucfys1WBFATCWshV0ioSOEdLCoUOYyUKhfQgb1TbYfdqitZbt7c1bt7uHFkC7INJJ033ZRVDwMThEGRzZmjlHGzoEk4SoBXtIQo2NaYWDKYAbHKLN9242fPifJvHI9+8qESn/ok/fLVdETrdJelILaBC+VZJPspmPTkaaLiRSlz5BmWSevdXIfeziunhn//r7H8qzVNM9bcE6d99c39gKr8i+XpF9pJWarIQtolhakW9Uqbt3+tMbd+qj0BLR0RPnyH04GnPy5YsnwRAfVk4L7pWkeUErHwCHJas2WzT1fDx15i2tbYD53vXEzfJ4CJRlZEalHw7Oko+z5GOc3TxjreZXp/lUCrcslg1PlCQI5wQhM47QyViem6KQWkXjlGRgCYWOn/m0ufpVUr915+6df89u3bljGp7V3TOzZDgJgEodlVNQz8LhVvbGvrUTBwyfNXDU3CHjFoyYtHjo2PkrV299aLZRFu2ZpcMogJOE9KpY8bEz4j+8zPI7evxxkHzc87XoeTbpa7VeNZpPBS+BcNL5MCKebksUFlqSgUhXlHJA9SOSkHBMtLGNfe31d2T2udv4n36pKcIt2/YTHPIs7BrO1898wg2O1B336jtg0v/6JkpCp8++rVEUMgVe8V+opelH+l8xT6RSg0wCcM8X0XOap6/TelUJ777UrqKzmY+ajrRA1M3sbqaI5KTQMSUDNSNdYhy8sj/4+EuJ6L5p3v3f/ZKDIfeUa7SxjxSdw1g2xKdrOFcp7CkRNl3D3vvws/ty2FDNUyt//OcAvpJQTt8RhNRAejD3Vo8iskDHnmXUJxAlH+FBfOY1z9igeVUIrz7CLZPvV61UdDbpR/LRmlQkTWFRDmjKaAbZONh5Zhw8csbcScmL/y+XJ8jGUsYrc0zmKYntB9tRVuoQQp8mdJUJl/h0DdccOVXVDJnWNFH4v0mI3vLs+Utau0BuH7pGmtuHh6pBS1ZN+pGzRRRsPQo15rNJeJYLrxLNNUPGH+Vcio9OSaM47JTU5Gsmz2rKbtLFDC6J0CWK8lT98LmffPr1I6s11IjQP7st9XXx7Q/7VI+H1n7QKYRrmy7hfEeESH700CXMpmv4hx9/yQNuclHI//x1zzRU0rtsJNh4WzlECb1Ulu/ZJJ4mXQl9cEONb8RI/RSIqDnNMzdrnmXCs0S4pMviJ14FH80pUc31myglSTO5mxmXOnEylTdOPNsLrQJbOSeU9J+8dfvhL778TkWVf35du37j0vufPrNxZ1bx0GZdw0ghqErZrqaGqGs4JSwDi8dnwrQV/0FA+/DjL1rRW3UJ1+xMEurKeVw0/aFH4o/Oh0cb3POEcaZN5iatR6nwLGY+vJooXp/0l3wYlKwVLdwtUacnTa6dSFCqU+vWqPAzUJ1sGw2tAqCVf0vnOO/IkrTCIRRaB4ycXT9mftXgaYX9xsZm1roEZBsIC2Xqlr7QNUyzV95kESvM+ukUSiVNv4FTymonlA+YxFb3iE0ur5/MRzb9mxV1k+hX2rknQscQYRehj/Co91Sp3/xBmEZ+5OCPyu/J1H8h1T+ZG4mP5lnEzSndspzi1ymxJBI0hciEq8nv1NIsuaREk6av6+Np3FjBlEhOsdwudQiBx/wo21K/wDRaeHMNQ+1z+yCg2GIfaVCpygynqykgSC8AhYhKHRsvchZ5NBm/lRcXQnpF5G16f9M5vaZTiHSrcGkRsqCK0McBHurc9bUcsv6JZT7uuRgxtXnmBgPx6VmksX4SJJw4BadJSMp0dck1Nko5TgkgGaL6JrONN5CLmea7iZXmEGNwjDE4xVg5x1o5xlA/ZeUQbXAwEhNN1TZcFRv5sruayKhBPG5LTc1R13BrxyhrJ/nrjlEUT6wcjHykKpq/Hy3/GUnVEZ84kkU3o78lXyYeijO6hEQTH72KRtMSRJT5i1sJt1yImEJ8tB4lTXz0VSKST1OgNiOSHOzjoLORjRsHahnC5VG2D21CoF0YBzG5olitK+YOol0wNQv6x2Rr1MsSSlIdQ6BtILT1o4BskWrNS3FUc0TdZSS09mcJtfGD1r7QJpB/q7U8Jx229JVvSPLjqoDeil/2mA//Sht/+TJ/+Vv+/Ivka7bmdGZRWutL7GTyoiKnWxrld4ic2jxrA/tXTxV/THwYURMfcy3E3USXaI/QohOnLpw6ffG11y+efePS2TfepePr596hkmzPgVO9+44mGrIJJS3F0SWNnLT4tdNvHT7ymmtAFl2eJge7NAcjtOo1auLCU6fffPnIqe5B2dA+2GAe4THxocvWeEzeP7F3/Y5dLx8/cfbkaxdeO3PxtTNvnXrtwvET5/YfOlnTMB3a+mv2RoMcek3IqTt5+sKx42fpIo8eP3f02NlXj5+jpvXYiTfoF/PLR8Fj/lQUqYZU/7wYTrQcQomR4k/gZ1i6F5r49NF6lkj9xJuWL0pETpa5ns3QLYVkE5jQz5wgrly9/vfVv6/9ff2qnH/nsufevfC0WsryBsdYK+d4aOm3bvNL6ke+xiJCR3dB10ONOdh4bti8U/0oOKYI2gTwZdupJkh3MU2WQ37RpTdv3FSvvHHz5q1bt27fvkM9rPkySqg2eMzf2jkGWngWlA2jBH+L2huLmcrbt+/evHmHThpGzSG9kfeJpoKQ15LpbuUgV31QH+GagT2LIHJa8+wNmme55tlHEDHmE6PWUEk+8fhwTDa4JEPnKL/Y8mvXblAVMmfpFrD2w87holM42Pin5w+hVE7FTc3gaXQNBIf109J/1TMv0IuvXr3WK6IQOgRrsq2mzoii9JNrttGP6N38jfnUkMqP1WgRKiOtnOiWvfoNnKR6ulHjF7TpGtbVK72rV0ZbB2NecQPBor+4/MnN0MyDAg7YGm2c4217JHVyjXbzS/v6mx+pZLrw5ntd3WO69Ei165XZwjmWopxp/WG0PpujVs7zOrR4jqvdUnl9vmcpRM1o3nuT5l2leZcL10zJx7TA1SGmKVA76YWQ0o9/XPlt+dnt2P1yQfGw0voZxTUT8osaFq3YqAr7sgFTKLNbOScwnxZ+T63hFWLXr91QfAxmPs29n17LPyJFBMUUi/aBFFc5brNFqeBjRRmwpU9Z/7GqpMymvpWSIAeZUOrRvEPzb0hdLVm5iV5G8Z8iOf+Iwlr7gJb24V9+xVPe5y68C+38oWMwz5ZS5fnQatUYOdsuF6EpOE7J/HiCRx72qsTYWc1zN2k+/UWvSubjEC990KivIddzPQtJLvNLMDgnURNBfLgJ/W9K/Hfe+cjWOwu7RmsOsVI/TXy8wws4yNhH6/5FfNZJPjdueoXmUhEIncL41qge6BAKXTi5WLHMvMtqxys+WcVUD/vQjzjmt/L1DM65cZ39etHyjfRuXCdzSxvBpVSXsHausV99/QP99I3zlwydg3mpob0p1JjWmCk4anmnHNtJ5tXmbtn8XIxvf4yd3Tx3s+ZbJ3wq2b8ICK/Qk4sV2dHidEdjFbGQDM5Ua4X7x/S9fv0mqX3foZOV1WNrhs6qGT63//C5NcNmF/ab2No1BTqFC7l2i0ogqhKfWL2NXnzlyt9eYXnQPsTAq+AoNceSEtZu2kXtAGkgp7jB3iPe1Te9m0+GS0Cua2AeFZbQOYzSNzT3rKybqMalx05eZucS6+qXQWbnnlBcPpK0R+iWrdoE1j2s5GJCFduhc2ibbsbPv/iO/vTrb7wjOoeCHIdEO3Vr+ipxVZPIllyNuqfxcy7d8/jxVf86iJvXPPdZ5tOrUiNRKT62rD1eJGyvVu7JRaFymaiBCp4OYcFxZfoI/KJ1AE7QNgweC2JrRTk3GOTzQSjlZ0U8WwZsfHZvU3wmPnRhzCeGPKJ2yNT/rjWopqzUwsfaOZayv19Y7s0bt/6HPqKkaiJnJR4vkimPOrjOYe1cjL/99gcvHPrgM61zCPDKzBh9paJa8momIxcDcIXsmsmRp2chO1fQEEhcaEN8/Eg/VcIlk/nYRpnXk/PyclXGOEr3lFUxdDF2C8hbv2Xvc9tf7ls/w9DZaO2SZOWUQNGGaJDA1GMOcvk61c8J0D6sbvjcnS+9+ty2w05+OdA5Qq5DloGRPugukf2HzHr+xYO79xx9ae+rL9Fxz9FdLx3Zu/94Um4DlS7cN1Hx0z4kIWfQluf37t13bN+B4/sPntx34CSd79l79PltB0qqxpJL8jWb6ivm0zWipUvcui179u0/vnDpeo5L9ip9x0gyCfowjj7jkMoT626Zwj2bxeNVyg8Fh46AxKXN854z+NYZfGs0tywTn0iLleTmpaGxesnnEAd2MdA6iKXS0cg9hVpSa2mOOh/+mCgEUd2oXt+V0yjqbxslJyOiKECptYLcgLD1kkdf6BjGYuiqKlsjZX/+0WP+/MpWfhT/5dGXoxbVh6oe4ErPFHvto8EuGtoG8S9Sdcqr6GNQL29UqOFoI9RksYTDyqGw3LOIn+4MGIDhYyH1qVYlOzTfARrxIXQcn6PMzYhcOC0XharJEfWQnSSgcW8VrxYem5jENx3ViaOK6nqQ1xzlFeplmM6H7ogSGWd89miZs+xVnW8UduZRPq63eVhert/WHNRcD5vGrQqbPnaqd08q/MpQQ5+sU6wKhmz8eZl9Si4w4MUqGTqcHvn8WKtXH34SNmgQGqdA1oY25S81D6gXrJ8cfkxVH/CXKjVJSF9LrJKgbvo5qBDnEK8XDyYTpqP+VJFcsI0mk+dRFs8WRZmajkhz8Y+mCRdUg1qm5tH0aIBZJ2pe1VTmmSOMkoq++DmuiYyz8qkUnrzjlU6ZcklYb36Kk8IOeZZPBfj1570+YmdB7ra2/fZ2CBuEfgM091zO76br1GwtH/kxLbR2fMiPLHDFmzUj21V1ore6+oJ2pUD9RN6F8jVzhW9rfHS0XI34WTi7MlnRRakFz6gWwzuYmZhStu7mlmSSoCnapEnZZPEzzh4KjlROrwr0rYbAgbyXTsJCLN77WOW+dkG1WmADP+7tlMyfadPckPmpuii9InKMUQ8KmT4aScbxvzKnpsci1ItNTwfLRewWC/6Vl5m8w2gaqtL10/TwkYmPCYsKJsyc04f6Q466CXPONQdhff5ORhslGyaTw0suexSAguNTwTsSBNRhyDDe6i11FZYfa1NxuG1Af0PwMM2zL7dgMsXrKtI/tShLFQlzlDOHYuVETjoZUJ7lZH5CzTQiZG8JSn/YU29/LPmY+i81oKeHFH3+NFov7B2UTuS7OZpjXQI6mYcd4oUaCNVnXlJMmlFksjjadO/NAceziJ8i71XGz90znFrePCdiDMbPwZwtovJU+8qD7f2rrIKGaD79NLdsHuSRT42hbdNTdWgRhUxwmsKyaOKj+tmHhaTHcFWPxegBgT/3aPlAloobpp5UzSPYGi1Gy1XI1S+A/rrmqN5BDjEp35GjLsKZpcIzC2pmXC47UYsE5JOY8klV90z5QGtvTuI9Cni3AQo4lK0oIPvXiMA6XucTNhyjp2DyMijYZag43rVyT/ew/tYB9VpAneaRxy5mH6OGGVUHhPZG0+VFW3yCsaLJwS2isf7BmfnowVyVi/p9SVBNjzfaRik/0ktfFZDNQ3m6eNSfNqUJx4dDrmlCyrS4gpeamFwpTX+G100+0+qhyKhoUyIDjlJODQbWiZDBvBdT5DjeRTDzGej7ilX5q92H7D0RO625f70IHmbgLj6dn7YzP9JrF6UnXHmCdhZPsHIVKlXkZHr8Snd5lbPi9QDuGPdwyJKsHnnw09bsVlFNfNih5GiwXbQp90Wb+Mi3ld7E+cipaU2OUg64SG9yS+flpooMayZXZvBCXmnpVSq8+wKlKt8q3jMnsJ731SHlRIyB6Md598X8bVB1vkXZ0Ua5BWIbv/6G0FEG32petGByMfHQqKxp2MGURJoQyU9Tj8Om8CiVY6q6VW3mYI5gMvuYsZjmDlCfIld8LBK3+kNNBViTeIRe5pn5pPKySRWBuaQhywaPHH4mWpdNIQccko13mXSraqCAQ3CCB/N2VRGjIWoSJMzFzLXQ57Cofa9txStq/zrX8Crr4CEaRaGepVRScrX8UJTWB6yEWmpiKlDNfPRGzxSUzHx0V3Iw1Txcbaobj2oCbme5NqBJSE3pW/6hpqBnLrSc4y0ahBRTEE7Xtw5QD4lzhsqVO1QUSDKlvIUFkfHpB35V4F9LqRyCh5BbCYrJxgm86WLaKizYCdVvWFWf61GzR229igAtgxq08HFUSLOE6O/aRzfxsVgKojWNXz2STfScInOr+RlzFWrkvgR2et2iR11bcyFqGgQ2Tz/p48AKS4wpquv+K5yaZsB1z3LmFVwy1KSZHEqZ3IxCl02xJMPRRvhWy91R6rhIDhkKYSOp2hHGibxFZ/ISkfscVpyEQR+3qnkN9W1p2cUcA+qsgkaIoKHCq4xHXymAsNR5kF8z8dGU2RpNPZpcs6RnFnn7io9DTNMza3qH0lT0ymgc+c81A5bp0kI2Meioy0aO98arUd9Hwg4HHBVtpE/J7RdyLXyqmLfKUXnKr0YEDOAKkPJ46FDeC44CMiWs2Jm8lXTWOig9DLXvWNVedO53xLxtLyEiVq39BxjCx2j+9VqPYt6OgG6QBRNOfDS7CGEXockUo1muvGqaczTJSUUYewu12Fu0A3YWi0zsmlaVmKsdvSlWxbA60UdpVLaSWxg1uZX0LL0YztQdisj0yNN3OPEiMqVAyvGu4K2oSDa871A9BA8GKgLDR2PkeIYTP4t3TqawU7wXqs7hkK9a173x8F7iRGlaZGRN88B6Q9gozadG657Pc9B0syyhcE2Oy5mmRaSo7CyeibY1N0eWz1DrTa7WNAyuXvmIbMxkTG9iKo9B91lTwJFuZeKjyKhiOF0v+Txks8BwCk2FH8sGfCrBV9V+9dKnOODwIwMUcChbxc2CpMWQsQYK9xAcGPyZTe35tKHEZ9rDW0DzjtkOQVXNAgZpocMNPlWahwxE3HHw/KNmWketyXPN7He2kdojPmKe5CI45sCij22a4/xDHVZTk2XX1GSBCsuqiZODEkLPVol6G9UtzZSqFB/ZSekZvET5FPj1AxVtyKcoT4UMxfCRcmfOCawcKnWSlkAWwdmNlaeh4SOrQe85154waeaRLw5EnYMHNAsaYggZavCuEO45vEjMTi6SJAl1CZdwlJzI7yLk6pEIiS7S4il7kyl6j/JRdXKEOkc7c4o0teGmqIUmPhadlEXCcklTj9Lo4tGrYr28YeVwP1UldJ+SsqEkHibhRE3iXbUVnMx1UETKOQuDPzEM+qBL1ZH/cZd+RmQbVGkdNNgQOsJATYdHHi+q575MzQKHaWRdwumEEOlGxGz1CW6zA6oFKprZBy1OTL1nZFPZ3NSh65O8Ktpj08yCuUhW62ktOk19gCJPiqeId2/jPMVwZMDR8xRvVWoOOHEzeDfytJWQswVLD0L1ORjyudWg9zvXn5YM/uf/CIMROfv1swkcaEXhmvoOqqtds3gWzD5aXznTJVyf8TfxsTgxP84gzy3DlDnI2Jq2dFBrJpsWBjxcXDmYRwBUc/eQeEAPy9nSs3KhOz+eTzEHvPQKhzcJlMoBBSdiHO++TrKJnwMpyyhVYeFuqDoJ9Zdg2Nc29e+41R3lu4/9d/4LDEYUG9u7dUhDs5BhWvhoza9G88jn0pHn32PUoIS+7JzXFZjJmCulCH0m/aHaxtJ0z1LVssnYs0Df5CpWmMOyviIiSRWB/FSvSwa4yvLYPQc4YRXILctkzJHRmGIOcL85mIeRw6n2m4gx03n7+pTlSA6VvwP6HoHaCzDsC8PAS63rzkeUb/k//kcz09TWx3bBA1qGDLYidwsZTpR4A0byd14pnaD35vbmCkd1sg81s+bhGn2ySd276qfkll/6uBADUWNreuEHanesbuZNftKZCW+olS23I5MNOHkTXY8nZfAyIMH41oB/He91HDQUWDAUZyZD7ExIWgRpT2Dmeszbyhm87FWoeQvqP9Jq32xef96p+rD4z/8XHp2SU1htm9BBNoF1zfxqDNSs9erH2zN2LxQeubwwmHekTGN16cvs+fEf/TkgnjRJF64ZPP/olslH3bKEa7Zwy+Zy3T2XF2t5FPJGsrxndancI7RMbQvPR+9K3tq6VxXvWuw3gPd5DhgIgQ0QNJQ3mQ8dSYEFIsZD1BSInso9QsJ8SF4C6U9i9nrI3wolL0HZEag8BdXnsfqCVn7KpvJkm/4nnKpeFub/VqbxP/1fnEz/cQ///01paa4hNR2CatoHVrcN6t/av9Laq8SqR7HBo4DCuOaeq3nk8tFNHj3yDGQ98rUeRVrPEkPPUq1nH61nX4NnueZdaehVZfCpM/gNtAoYZhU8yipkbLPwSVaRU62MM62Mc6yiF1jFLDTELraKXWyIW8KWsMyQuFxLXqklrdSSl2tJy0TiMi1xiUhcgomLMXkp/48qqSu4e0p/GrPWY84mzH2eOimtaI+hZG+LikNtq4+0qTjUoeJAt8o9DUVPoLnw+99k8/8AmR4G+g==',alpha:'eNrtmk1oE0EUx9/OVEXQIhQVqYJWpAhWU+zFHjwVb1IEwZOICMWDHgVRCooUBBXrSQKCH9iD4EFyUkFBqhep1I9KERQ/IFJJCqvNZpPszHvOJKlpExF09x2E+R/C7rD5vTf/2WVg3gNoSEjzs7z34PCNJ1Nf8/6PQhAEYRgWw6qKQf1iseYHC7Mfn14/ObjeIKQHv5EnANoH029DiqNc5shqE6EVb4a2jHywj6BWGhH/loz2f/Yie24tiKYpmPuNV76bhyKNsfJHpYg+HTbEpuSPzRDV4scVmghjHQs9ktCZMXSkhKQVTXY1ZiBh27sE6VYRvd88H0DAjqwZSFYRve7wvBp+w+fE8TbAneqH4Mmlj0kljjdvIg3ZNRYwzJC9XWTMdXpCeFsDjRx8Y8olkAJucbhTm0B+HUB3iDzp2wkcBzjLlb79YB96SyaQjY/kd/WGxGWP1YEhTryiM2k++y3/9jPSfHxN498YzTfWZ0vEqoCZX6gw5/+f8wuO7/iO7/iO7/hu/3X7u+M7vuM7vuM7vuM7vuP/mV9m5nOfv4WcdKSZWU6+pokpzvNhTfczvOfD6Qu8/FOHGP0x5P3bi3wBkPxNbS846yPjEkYY+XQaoKfM5Q9isRsE3OWagKIxW9Lvq/DU71CXUiZ9CZd56o8RXbT1TU+sfMXhkKI37dUqv4CefPIBNPmpegFbwsBc0gEUhXt/Vfgl7MkluwaK5vYtaCCQkJpMsH9AaZreBW2L+h9WjRqHovhvKmprxLU1TS0iZiX679lKHqoYMeoNIg8GWjtQbHfLzvMvY2/30fRoP7S0n9RbUGBZ39Grj76E5cq/qOQ/v3li9wrbktCg/gSf6j6n'};
async function toolPdfHeaderImage(){
 try{return await loadTechnicalHeaderImage();}catch(error){return null;}
}
function makeToolPdfPage(kind,title,background){
 const page={content:pdfFill(.10,.16,.27)+pdfRect(0,742,595,100),images:[],checkboxes:[]};
 if(background){
  page.images.push({...background});
  page.content+='q 595 0 0 100 0 742 cm /Im1 Do Q\n';
 }
 const samples=value=>Uint8Array.from(atob(value),character=>character.charCodeAt(0));
 page.images.push({bytes:samples(pilotToolboxLogo.rgb),alpha:samples(pilotToolboxLogo.alpha),width:96,height:96});
 page.content+=`q 57 0 0 57 506 766 cm /Im${page.images.length} Do Q\n`;
 page.content+=pdfAccentFill()+pdfRect(0,742,595,3)+pdfFill(1,1,1)+pdfText(36,813,10,kind.toUpperCase(),true);
 const lines=pdfHeaderTitleLines(title);
 lines.forEach((line,i)=>{page.content+=pdfText(36,788-i*22,20,line,true);});
 page.content+=pdfFill(.88,.92,1)+pdfText(36,751,8,'S2A Production - S2A Pilot '+APP_VERSION);
 return page;
}
async function buildStageToolPdf(){
 const plan=clone(pilotTools.stagePlan),title=showTitle.value.trim()||tr('Plan de scène');
 const canvas=document.createElement('canvas');canvas.width=1680;canvas.height=1180;
 const ctx=canvas.getContext('2d');ctx.scale(2,2);drawStageTool(ctx,plan);
 const page=makeToolPdfPage(tr('Plan de scène'),title,await toolPdfHeaderImage());
 page.images.push({bytes:dataUrlToBytes(canvas.toDataURL('image/jpeg',.96)),width:canvas.width,height:canvas.height});
 page.content+=pdfFill(.13,.20,.32)+pdfText(36,708,12,tr('Implantation du plateau - vue du dessus'),true);
 page.content+=`q 523 0 0 367.35 36 322 cm /Im${page.images.length} Do Q\n`;
 page.content+=pdfFill(.34,.38,.45)+pdfText(36,299,9,tr('Plateau')+' : '+plan.width+' × '+plan.depth+' m'+(plan.grid?' - '+tr('Grille de 1 m'):''));
 pdfPageFooter(page,0,1);
 return buildPdfDocument([page]);
}
function lightingIsScenery(type){return ['leg','backdrop','spider'].includes(type);}
function lightingBannerSource(value){
 return typeof value==='string'&&value.length<=2000000&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)?value:'';
}
const lightingImageCache=new Map();
function lightingLoadImages(plan,repaint=true){
 const sources=new Set(plan.items.filter(item=>item.type==='spider'&&item.cover==='banner').map(item=>item.bannerImage).filter(Boolean));
 for(const key of lightingImageCache.keys())if(!sources.has(key))lightingImageCache.delete(key);
 return Promise.all([...sources].map(source=>{
  if(!lightingImageCache.has(source)){
   const record={image:null};
   record.promise=new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{
     record.image=image;resolve(image);
     if(repaint&&$('lightingPlanDialog').open&&pilotTools.lightingPlan.items.some(item=>item.bannerImage===source))paintLightingPlan();
    };
    image.onerror=()=>resolve(null);image.src=source;
   });
   lightingImageCache.set(source,record);
  }
  return lightingImageCache.get(source).promise;
 }));
}
// An affine mesh maps the banner onto its projected rectangular frame.
function lightingDrawBanner(ctx,image,point,width,height){
 const drawTriangle=(source,destination)=>{
  const [a,b,c]=source,[u,v,w]=destination;
  ctx.save();ctx.beginPath();ctx.moveTo(...u);ctx.lineTo(...v);ctx.lineTo(...w);ctx.closePath();ctx.clip();
  const determinant=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
  const ax=((v[0]-u[0])*(c[1]-a[1])-(w[0]-u[0])*(b[1]-a[1]))/determinant;
  const bx=((v[1]-u[1])*(c[1]-a[1])-(w[1]-u[1])*(b[1]-a[1]))/determinant;
  const ay=((w[0]-u[0])*(b[0]-a[0])-(v[0]-u[0])*(c[0]-a[0]))/determinant;
  const by=((w[1]-u[1])*(b[0]-a[0])-(v[1]-u[1])*(c[0]-a[0]))/determinant;
  ctx.transform(ax,bx,ay,by,u[0]-ax*a[0]-ay*a[1],u[1]-bx*a[0]-by*a[1]);
  ctx.drawImage(image,0,0);ctx.restore();
 };
 const cols=8,rows=6;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const left=col/cols,right=(col+1)/cols,top=row/rows,bottom=(row+1)/rows;
  const source=[[left,top],[right,top],[right,bottom],[left,bottom]].map(([u,v])=>[u*image.naturalWidth,v*image.naturalHeight]);
  const dest=[[left,top],[right,top],[right,bottom],[left,bottom]].map(([u,v])=>point((u-.5)*width,(1-v)*height));
  drawTriangle([source[0],source[1],source[2]],[dest[0],dest[1],dest[2]]);
  drawTriangle([source[0],source[2],source[3]],[dest[0],dest[2],dest[3]]);
 }
}
function drawLightingScenery(ctx,plan,item,projection,{view='3d',scenic=false,paper=false}={}){
 const angle=item.angle*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
 const width=item.objectWidth??(item.type==='backdrop'?plan.width:item.type==='leg'?2:3);
 const height=Math.min(item.objectHeight??(item.type==='spider'?2:plan.height),plan.height-item.z);
 const point=(u,z)=>projection.point(item.x+u*cos,item.y+u*sin,item.z+z);
 const shape=points=>{
  ctx.beginPath();points.forEach((v,index)=>index?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();
 };
 const line=(a,b,color,size=1)=>{
  ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=color;ctx.lineWidth=size;ctx.stroke();
 };
 const a=point(-width/2,0),b=point(width/2,0),topA=point(-width/2,height),topB=point(width/2,height);
 if(view==='2d'){
  line(a,b,paper?'#202b3d':'#adbbd2',5);
  const normal=[Math.cos(angle+Math.PI/2)*.12,Math.sin(angle+Math.PI/2)*.12];
  line(a,projection.point(item.x-width/2*cos+normal[0],item.y-width/2*sin+normal[1],item.z),'#a0a9bb');
  return point(0,0);
 }
 const corners=[a,b,topB,topA];
 shape(corners);ctx.fillStyle=paper?'#202734':'#080a10';ctx.fill();
 const banner=item.type==='spider'&&item.cover==='banner';
 const image=banner&&lightingImageCache.get(item.bannerImage)?.image;
 if(image){
  ctx.save();shape(corners);ctx.clip();lightingDrawBanner(ctx,image,point,width,height);ctx.restore();
  if(scenic){shape(corners);ctx.fillStyle='rgba(8,15,28,.12)';ctx.fill();}
 }else{
  const folds=Math.max(12,Math.ceil(width*9));
  for(let fold=0;fold<folds;fold++){
   const left=-width/2+fold*width/folds,right=left+width/folds;
   shape([point(left,0),point(right,0),point(right,height),point(left,height)]);
   const shade=Math.round((paper?24:8)+Math.sin(fold*1.35)**2*(paper?14:19));
   ctx.fillStyle='rgb('+shade+','+(shade+1)+','+(shade+5)+')';ctx.fill();
  }
 }
 if(scenic&&projection.beams)lightingIlluminatePanel(ctx,item,projection,projection.beams);
 const stroke=paper?'#8290a4':'#627189';
 for(let side=0;side<4;side++)line(corners[side],corners[(side+1)%4],stroke,.7);
 if(item.type==='spider'){
  const normal=[-sin,cos],front=projection.depth(item.x+normal[0]*.1,item.y+normal[1]*.1,item.z)<projection.depth(item.x,item.y,item.z);
  if(!front||!image){
   const columns=Math.max(1,Math.round(width)),rows=2;
   for(let col=0;col<columns;col++)for(let row=0;row<rows;row++){
    const left=-width/2+col*width/columns,right=left+width/columns,low=row*height/rows,high=(row+1)*height/rows;
    line(point(left,low),point(right,high),'#97a5b6',1.1);
    line(point(right,low),point(left,high),'#617087',1.1);
   }
  }
  for(const side of [-1,1]){
   const base=point(side*width*.4,0);
   line([base[0]-7,base[1]+2],[base[0]+7,base[1]+2],stroke,3);
  }
 }
 return point(0,height/2);
}
async function lightingImportBanner(file){
 const epoch=copilotProjectEpoch,id=lightingSelection,item=pilotTools.lightingPlan.items.find(device=>device.id===id);
 if(item?.type!=='spider'||!file)return;
 const status=$('lightingBannerStatus'),picker=$('lightingBannerFile');
 picker.disabled=true;setShowText(status,tr('Chargement du visuel…'));
 let url;
 try{
  if(file.size>20*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error(tr('Choisissez une image JPG, PNG ou WebP de moins de 20 Mo.'));
  url=URL.createObjectURL(file);
  const image=await new Promise((resolve,reject)=>{
   const value=new Image();value.onload=()=>resolve(value);value.onerror=()=>reject(Error(tr('Impossible de lire cette image.')));value.src=url;
  });
  const scale=Math.min(1,1400/image.naturalWidth,1400/image.naturalHeight);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#111722';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/jpeg',.86);
  if(!lightingBannerSource(data))throw Error(tr('Le visuel est trop volumineux.'));
  if(epoch!==copilotProjectEpoch||!pilotTools.lightingPlan.items.includes(item))return;
  pushHistory();item.bannerImage=data;item.cover='banner';savePilotTools();
  await lightingLoadImages(pilotTools.lightingPlan);
  if(epoch===copilotProjectEpoch){updateLightingPlan();setShowText(status,tr('Visuel enregistré avec le spectacle.'));}
 }catch(error){if(epoch===copilotProjectEpoch)setShowText(status,error.message);}
 finally{if(url)URL.revokeObjectURL(url);picker.value='';picker.disabled=false;}
}

function lightingIsSupport(type){return type==='stand'||type==='totem';}
function lightingCanPatch(item){return lightingCatalog[item?.type]?.group==='Projecteurs';}
function lightingPatchNumber(value,min,max){
 return Number.isSafeInteger(value)&&value>=min&&value<=max?value:null;
}
function lightingCircuit(value){
 return typeof value==='string'?value.replace(/[\r\n\t]+/g,' ').trim().slice(0,32):'';
}
function lightingChannels(item){return lightingPatchNumber(item?.dmxChannels,1,512)??1;}
function lightingPatchRange(item){
 const universe=lightingPatchNumber(item?.dmxUniverse,0,Number.MAX_SAFE_INTEGER);
 const start=lightingPatchNumber(item?.dmxAddress,1,512);
 return lightingCanPatch(item)&&universe!==null&&start!==null?{universe,start,end:start+lightingChannels(item)-1}:null;
}
function lightingNextPatch(plan,type,selected){
 const patched=plan.items.filter(item=>lightingPatchRange(item));
 const reference=patched.find(item=>item.id===selected)||patched[patched.length-1];
 const previous=[...plan.items].reverse().find(item=>item.type===type);
 const channels=lightingChannels(previous);
 let universe=reference?.dmxUniverse??1;
 const inUniverse=patched.filter(item=>item.dmxUniverse===universe);
 let address=inUniverse.reduce((next,item)=>Math.max(next,lightingPatchRange(item).end+1),1);
 // A fixture occupies a contiguous block within one universe.
 while(true){
  if(address+channels-1>512){
   if(universe===Number.MAX_SAFE_INTEGER)return {dmxChannels:channels};
   universe++;address=1;
  }
  const ranges=patched.map(lightingPatchRange).filter(range=>range.universe===universe);
  const overlap=ranges.find(range=>address<=range.end&&address+channels-1>=range.start);
  if(!overlap)return {dmxUniverse:universe,dmxAddress:address,dmxChannels:channels};
  address=overlap.end+1;
 }
}
function lightingPatchWarnings(plan){
 const warnings=[];
 const patched=plan.items.map((item,index)=>({item,index,range:lightingPatchRange(item)})).filter(entry=>entry.range);
 const label=entry=>(entry.index+1)+' · '+lightingLabel(entry.item);
 for(let i=0;i<patched.length;i++){
  const current=patched[i],range=current.range;
  if(range.end>512)warnings.push({
   text:tr('Univers {universe} - {device} dépasse le canal 512 ({start} à {end}).',
    {universe:range.universe,device:label(current),start:range.start,end:range.end}),ids:[current.item.id]
  });
  for(let j=i+1;j<patched.length;j++){
   const other=patched[j];
   if(range.universe!==other.range.universe||range.start>other.range.end||other.range.start>range.end)continue;
   warnings.push({
    text:tr('Univers {universe} - chevauchement des canaux {start} à {end}.',
     {universe:range.universe,start:Math.max(range.start,other.range.start),end:Math.min(range.end,other.range.end)}),
    ids:[current.item.id,other.item.id],labels:[label(current),label(other)]
   });
  }
 }
 return warnings;
}
function updateLightingPatchWarnings(){
 const warnings=lightingPatchWarnings(pilotTools.lightingPlan),container=$('lightingPatchWarnings'),list=$('lightingPatchWarningList');
 container.hidden=!warnings.length;list.replaceChildren();
 for(const warning of warnings){
  const row=document.createElement('li'),text=document.createElement('span');
  text.textContent=warning.text;row.append(text);
  warning.ids.forEach((id,index)=>{
   if(!warning.labels)return;
   const button=document.createElement('button');button.type='button';button.textContent=warning.labels[index];
   button.onclick=()=>{lightingSelection=id;updateLightingPlan();$('lightingItemFields').scrollIntoView({block:'nearest'});};
   row.append(button);
  });
  list.append(row);
 }
}

function normalizeLightingPlan(saved){
 const width=toolClamp(saved?.width,1,60,10),depth=toolClamp(saved?.depth,1,60,7),height=toolClamp(saved?.height,.5,30,5);
 const ids=new Set();
 const items=(Array.isArray(saved?.items)?saved.items:[]).slice(0,100).filter(item=>Object.prototype.hasOwnProperty.call(lightingCatalog,item?.type)).map(item=>{
  const id=typeof item.id==='string'&&item.id.length<=80&&item.id&&!ids.has(item.id)?item.id:uuid();
  ids.add(id);
  const device={id,type:item.type,name:String(item.name||'').slice(0,42),x:toolClamp(item.x,0,width,width/2),y:toolClamp(item.y,0,depth,depth/2),
   z:toolClamp(item.z,0,height,0),angle:toolClamp(item.angle,0,359.99,0),mount:typeof item.mount==='string'?item.mount:''};
  if(lightingCanPatch(device)){
   const universe=lightingPatchNumber(item.dmxUniverse,0,Number.MAX_SAFE_INTEGER),address=lightingPatchNumber(item.dmxAddress,1,512);
   const circuit=lightingCircuit(item.circuit);
   if(universe!==null)device.dmxUniverse=universe;
   if(address!==null)device.dmxAddress=address;
   if(circuit)device.circuit=circuit;
   device.dmxChannels=lightingChannels(item);
   const color=normalizeGoCueColor(item.beamColor);
   if(color)device.beamColor=color;
   if(lightingManualTilt(item))device.tilt=item.tilt;
  }
  if(lightingIsScenery(item.type)){
   device.objectWidth=toolClamp(item.objectWidth,.2,60,item.type==='backdrop'?width:item.type==='leg'?2:3);
   device.objectHeight=toolClamp(item.objectHeight,.1,height,Math.min(item.type==='spider'?2:height,height));
   if(item.type==='spider'){
    device.cover=item.cover==='banner'?'banner':'black';
    const image=lightingBannerSource(item.bannerImage);
    if(image)device.bannerImage=image;
   }
  }
  return device;
 });
 const supports=new Set(items.filter(item=>lightingIsSupport(item.type)).map(item=>item.id));
 for(const item of items)if(lightingIsSupport(item.type)||!supports.has(item.mount))item.mount='';
 return {width,depth,height,grid:saved?.grid!==false,renderPalette:saved?.renderPalette==='blue-amber'?'blue-amber':'custom',items};
}
function lightingPosition(plan,item){
 const support=item.mount&&plan.items.find(candidate=>candidate.id===item.mount);
 return support?{x:support.x,y:support.y,z:support.z}:item;
}
function lightingLabel(item){return item.name.trim()||tr(lightingCatalog[item.type].label);}
function lightingDimensions(plan){return plan.width+' × '+plan.depth+' × '+plan.height+' m';}
function lightingProjection(plan,view,quarter){
 const w=840,h=530;
 if(view==='2d'){
  const scale=Math.min((w-108)/plan.width,(h-124)/plan.depth);
  const x=(w-plan.width*scale)/2,y=(h-plan.depth*scale)/2;
  return {scale,x,y,point:(u,v)=>[x+u*scale,y+v*scale]};
 }
 const angle=Math.PI/6+quarter*Math.PI/2,cos=Math.cos(angle),sin=Math.sin(angle);
 const raw=(x,y,z)=>[x*cos-y*sin,(x*sin+y*cos)*.49-z*.87];
 const corners=[raw(0,0,0),raw(plan.width,0,0),raw(plan.width,plan.depth,0),raw(0,plan.depth,0)];
 const minX=Math.min(...corners.map(point=>point[0])),maxX=Math.max(...corners.map(point=>point[0]));
 const floorTop=Math.min(...corners.map(point=>point[1])),floorBottom=Math.max(...corners.map(point=>point[1]));
 const minY=floorTop-plan.height*.87;
 const scale=Math.min((w-110)/(maxX-minX),(h-122)/(floorBottom-minY));
 const offsetX=(w-(minX+maxX)*scale)/2,offsetY=(h-(minY+floorBottom)*scale)/2;
 return {point:(x,y,z=0)=>{const [u,v]=raw(x,y,z);return [offsetX+u*scale,offsetY+v*scale];},depth:(x,y)=>x*sin+y*cos,
  ray:(x,y)=>{
   const z=plan.height+Math.hypot(plan.width,plan.depth)*3,u=(x-offsetX)/scale,v=((y-offsetY)/scale+z*.87)/.49;
   return {origin:[u*cos+v*sin,-u*sin+v*cos,z],direction:[-.87/.49*sin,-.87/.49*cos,-1]};
  }};
}
function drawLightingSymbol(ctx,fixture,x,y,angle,selected,paper){
 ctx.save();ctx.translate(x,y);
 const color=paper?'#213b60':fixture.color;
 if(selected){
  ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fillStyle='#564481';ctx.fill();
  ctx.strokeStyle='#dec6ff';ctx.lineWidth=2;ctx.stroke();
 }
 ctx.save();ctx.rotate(angle);
 ctx.beginPath();
 switch(fixture.shape){
  case 'moving':ctx.rect(-9,-7,18,14);ctx.moveTo(6,0);ctx.arc(0,0,6,0,Math.PI*2);break;
  case 'par':ctx.arc(0,0,9,0,Math.PI*2);break;
  case 'profile':ctx.moveTo(-7,-8);ctx.lineTo(7,-8);ctx.lineTo(10,9);ctx.lineTo(-10,9);ctx.closePath();break;
  case 'bar':ctx.rect(-15,-5,30,10);for(const x of [-7,0,7]){ctx.moveTo(x,-5);ctx.lineTo(x,5);}break;
  case 'stand':ctx.moveTo(0,0);ctx.lineTo(0,-10);ctx.moveTo(0,0);ctx.lineTo(-9,7);ctx.moveTo(0,0);ctx.lineTo(9,7);break;
  case 'totem':ctx.rect(-8,-8,16,16);ctx.moveTo(-8,-8);ctx.lineTo(8,8);ctx.moveTo(8,-8);ctx.lineTo(-8,8);break;
  case 'speaker':ctx.moveTo(-8,-7);ctx.lineTo(8,-7);ctx.lineTo(11,8);ctx.lineTo(-11,8);ctx.closePath();break;
  default:ctx.rect(-8,-8,16,16);ctx.moveTo(-5,5);ctx.lineTo(5,-5);
 }
 ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
 if(fixture.group==='Projecteurs'||fixture.shape==='speaker'){
  ctx.beginPath();ctx.moveTo(0,12);ctx.lineTo(0,19);ctx.lineTo(-3,15);ctx.moveTo(0,19);ctx.lineTo(3,15);ctx.stroke();
 }
 ctx.restore();ctx.restore();
}
// Procedural stage preview. Coordinates stay in metres and share the plan's fixture positions.
function lightingRenderColor(plan,item){
 if(item.type==='pc')return '#fff7ec';
 if(plan.renderPalette==='blue-amber'){
  const index=plan.items.filter(lightingCanPatch).findIndex(device=>device.id===item.id);
  return index%2===0?'#429cff':'#ffb547';
 }
 return item.beamColor||lightingCatalog[item.type].color;
}
let lightingAimPick='';
function lightingPickSurface(plan,projection,point){
 if(!projection.ray)return null;
 const {origin,direction}=projection.ray(point.x,point.y);
 let closest=Infinity,chosen=null;
 if(Math.abs(direction[2])>1e-9){
  const t=-origin[2]/direction[2],x=origin[0]+direction[0]*t,y=origin[1]+direction[1]*t;
  if(t>0&&x>=0&&x<=plan.width&&y>=0&&y<=plan.depth){closest=t;chosen=[x,y,0];}
 }
 for(const item of plan.items.filter(item=>lightingIsScenery(item.type))){
  const a=item.angle*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a),nx=-sin,ny=cos;
  const denominator=direction[0]*nx+direction[1]*ny;
  if(Math.abs(denominator)<1e-9)continue;
  const t=((item.x-origin[0])*nx+(item.y-origin[1])*ny)/denominator;
  if(t<=0||t>=closest)continue;
  const hit=origin.map((value,index)=>value+direction[index]*t);
  const across=(hit[0]-item.x)*cos+(hit[1]-item.y)*sin;
  if(Math.abs(across)>item.objectWidth/2||hit[2]<item.z||hit[2]>item.z+Math.min(item.objectHeight,plan.height-item.z))continue;
  closest=t;chosen=hit;
 }
 return chosen;
}
function lightingAimAtPoint(plan,item,target){
 const beam=lightingScenicBeams(plan).get(item.id);
 if(!beam||!target)return false;
 const [x,y,z]=target.map((value,index)=>value-beam.source[index]);
 if(Math.hypot(x,y,z)<.05)return false;
 const angle=(Math.atan2(-x,y)*180/Math.PI+360)%360;
 item.angle=(Math.round(angle*100)/100)%360;
 item.tilt=Math.round(Math.atan2(z,Math.hypot(x,y))*180/Math.PI*100)/100;
 return true;
}

function lightingManualTilt(item){
 return typeof item?.tilt==='number'&&Number.isFinite(item.tilt)&&item.tilt>=-90&&item.tilt<=90;
}
function lightingBeamTilt(beam){
 return Math.atan2(beam.target[2]-beam.source[2],Math.hypot(beam.target[0]-beam.source[0],beam.target[1]-beam.source[1]))*180/Math.PI;
}
function lightingScenicBeams(plan){
 const panels=plan.items.filter(item=>lightingIsScenery(item.type)),beams=new Map();
 for(const item of plan.items.filter(lightingCanPatch)){
  const at=lightingPosition(plan,item),angle=item.angle*Math.PI/180;
  const source=[at.x,at.y,at.z+(lightingCatalog[item.type].shape==='moving'?.44:.26)];
  const reach=Math.min(plan.depth*.45,Math.max(1,at.z*.55));
  let target=[Math.max(0,Math.min(plan.width,at.x-Math.sin(angle)*reach)),
   Math.max(0,Math.min(plan.depth,at.y+Math.cos(angle)*reach)),at.z>.5?.02:Math.min(plan.height*.8,Math.max(1.2,plan.height*.6))];
  let hit=null,best=Infinity,surface='air';
  if(lightingManualTilt(item)){
   const tilt=item.tilt*Math.PI/180,direction=[-Math.sin(angle)*Math.cos(tilt),Math.cos(angle)*Math.cos(tilt),Math.sin(tilt)];
   let length=Math.hypot(plan.width,plan.depth,plan.height)*1.5;
   for(const [axis,bound] of [[0,0],[0,plan.width],[1,0],[1,plan.depth],[2,plan.height]]){
    if(Math.abs(direction[axis])<1e-9||axis===2&&direction[2]<=0)continue;
    const distance=(bound-source[axis])/direction[axis];
    if(distance>.0001&&distance<length)length=distance;
   }
   if(direction[2]<-1e-9){
    const floorDistance=-source[2]/direction[2];
    if(floorDistance>0&&floorDistance<=length+.0001){length=floorDistance;surface='floor';}
   }
   target=source.map((value,index)=>value+direction[index]*length);
  }else if(at.z<.5){
   // Preserve the automatic uplight placement of existing projects.
   for(const panel of panels){
    const a=panel.angle*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a),dx=at.x-panel.x,dy=at.y-panel.y;
    const distance=Math.abs(-dx*sin+dy*cos),across=dx*cos+dy*sin;
    if(distance>.7||Math.abs(across)>panel.objectWidth/2+.1||distance>=best)continue;
    const height=Math.min(panel.objectHeight,plan.height-panel.z);
    if(height<.2)continue;
    best=distance;hit=panel;
    const local=Math.max(-panel.objectWidth/2,Math.min(panel.objectWidth/2,across));
    target=[panel.x+cos*local,panel.y+sin*local,panel.z+height*.78];
   }
  }else surface='floor';
  let nearest=hit?1:Infinity;
  for(const panel of panels){
   const a=panel.angle*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a);
   const nx=-sin,ny=cos,denominator=(target[0]-source[0])*nx+(target[1]-source[1])*ny;
   if(Math.abs(denominator)<1e-7)continue;
   const t=((panel.x-source[0])*nx+(panel.y-source[1])*ny)/denominator;
   if(t<.00001||t>1.000001||t>=nearest)continue;
   const point=source.map((value,index)=>value+(target[index]-value)*t);
   const across=(point[0]-panel.x)*cos+(point[1]-panel.y)*sin;
   if(Math.abs(across)>panel.objectWidth/2||point[2]<panel.z||point[2]>panel.z+Math.min(panel.objectHeight,plan.height-panel.z))continue;
   nearest=t;hit=panel;
  }
  if(hit&&nearest<1)target=source.map((value,index)=>value+(target[index]-value)*nearest);
  if(hit)surface='panel';
  const vector=target.map((value,index)=>value-source[index]),length=Math.hypot(...vector);
  const direction=vector.map(value=>value/(length||1));
  const radius=item.type==='profile'?1:item.type==='beam'?Math.max(.035,length*.026):
   item.type==='spot'?Math.max(.1,length*.13):Math.max(.22,Math.min(2.7,length*.38));
  beams.set(item.id,{item,source,target,hit,surface,direction,length,radius,color:lightingRenderColor(plan,item)});
 }
 return beams;
}
function lightingBeamOutline(projection,beam,width=1){
 const direction=beam.direction,sideLength=Math.hypot(direction[0],direction[1]);
 const u=sideLength>1e-6?[direction[1]/sideLength,-direction[0]/sideLength,0]:[1,0,0];
 const v=[direction[1]*u[2]-direction[2]*u[1],direction[2]*u[0]-direction[0]*u[2],direction[0]*u[1]-direction[1]*u[0]];
 const points=[projection.point(...beam.source)];
 for(let index=0;index<24;index++){
  const a=index*Math.PI/12,r=beam.radius*width;
  const world=beam.target.map((value,axis)=>value+r*(Math.cos(a)*u[axis]+Math.sin(a)*v[axis]));
  // Intersect the rim rays with the receiving plane, retaining the oblique footprint.
  let numerator,denominator;
  if(beam.surface==='floor'){
   numerator=-beam.source[2];denominator=world[2]-beam.source[2];
  }else if(beam.hit){
   const angle=beam.hit.angle*Math.PI/180,nx=-Math.sin(angle),ny=Math.cos(angle);
   numerator=(beam.hit.x-beam.source[0])*nx+(beam.hit.y-beam.source[1])*ny;
   denominator=(world[0]-beam.source[0])*nx+(world[1]-beam.source[1])*ny;
  }
  if(Math.abs(denominator)>1e-8){
   const distance=Math.max(0,Math.min(8,numerator/denominator));
   for(let axis=0;axis<3;axis++)world[axis]=beam.source[axis]+(world[axis]-beam.source[axis])*distance;
  }
  points.push(projection.point(...world));
 }
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const hull=[];
 for(const point of points){
  while(hull.length>1&&cross(hull[hull.length-2],hull[hull.length-1],point)<=0)hull.pop();
  hull.push(point);
 }
 const lower=hull.length;
 for(let i=points.length-2;i>=0;i--){
  const point=points[i];
  while(hull.length>lower&&cross(hull[hull.length-2],hull[hull.length-1],point)<=0)hull.pop();
  hull.push(point);
 }
 hull.pop();return hull;
}

function lightingIlluminatePanel(ctx,panel,projection,beams){
 const a=panel.angle*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a),nx=-sin,ny=cos;
 const point=(x,z)=>projection.point(panel.x+x*cos,panel.y+x*sin,panel.z+z);
 const height=Math.min(panel.objectHeight??2,30),width=panel.objectWidth??3;
 const outline=[point(-width/2,0),point(width/2,0),point(width/2,height),point(-width/2,height)];
 ctx.save();ctx.beginPath();outline.forEach((v,index)=>index?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();ctx.clip();
 ctx.globalCompositeOperation='screen';
 for(const beam of beams.values()){
  if(beam.hit!==panel)continue;
  const sourceSide=(beam.source[0]-panel.x)*nx+(beam.source[1]-panel.y)*ny;
  const cameraSide=projection.depth(panel.x+nx*.1,panel.y+ny*.1,panel.z)<projection.depth(panel.x,panel.y,panel.z)?1:-1;
  if(Math.abs(sourceSide)>.015&&sourceSide*cameraSide<0)continue;
  const dx=beam.target[0]-panel.x,dy=beam.target[1]-panel.y,across=dx*cos+dy*sin;
  const fromFloor=!lightingManualTilt(beam.item)&&beam.source[2]<.8;
  const centerZ=fromFloor?height*.52:beam.target[2]-panel.z;
  const radiusX=beam.radius;
  const incidence=Math.max(.15,Math.abs(beam.direction[0]*nx+beam.direction[1]*ny));
  const radiusZ=fromFloor?height*.60:Math.min(height*1.5,radiusX/incidence);
  const center=point(across,centerZ),h=point(across+radiusX,centerZ),v=point(across,centerZ+radiusZ);
  ctx.save();ctx.transform(h[0]-center[0],h[1]-center[1],v[0]-center[0],v[1]-center[1],...center);
  const gradient=ctx.createRadialGradient(0,0,0,0,0,1);
  const rgb=parseInt(beam.color.slice(1),16),base=(rgb>>16)+','+((rgb>>8)&255)+','+(rgb&255);
  gradient.addColorStop(0,'rgba('+base+',.7)');gradient.addColorStop(.35,'rgba('+base+',.38)');gradient.addColorStop(1,'rgba('+base+',0)');
  ctx.fillStyle=gradient;ctx.fillRect(-1,-1,2,2);ctx.restore();
 }
 ctx.restore();
}

function lightingRenderProjection(plan,quarter){
 const radius=Math.hypot(plan.width,plan.depth)+plan.height,angle=.15+quarter*Math.PI/2;
 const target=[plan.width/2,plan.depth/2,plan.height*.30];
 const eye=[target[0]+Math.sin(angle)*radius*1.45,target[1]+Math.cos(angle)*radius*1.45,plan.height*.38+radius*.12];
 const unit=v=>{const length=Math.hypot(...v);return v.map(value=>value/length);};
 const forward=unit(target.map((value,index)=>value-eye[index])),right=unit([-forward[1],forward[0],0]);
 const up=[-right[1]*forward[2],right[0]*forward[2],right[1]*forward[0]-right[0]*forward[1]];
 const raw=(x,y,z)=>{
  const v=[x-eye[0],y-eye[1],z-eye[2]],depth=v.reduce((sum,value,index)=>sum+value*forward[index],0);
  return [v.reduce((sum,value,index)=>sum+value*right[index],0)/depth,-v.reduce((sum,value,index)=>sum+value*up[index],0)/depth,depth];
 };
 const bounds=[];
 for(const x of [0,plan.width])for(const y of [0,plan.depth])for(const z of [0,plan.height])bounds.push(raw(x,y,z));
 const minX=Math.min(...bounds.map(p=>p[0])),maxX=Math.max(...bounds.map(p=>p[0]));
 const minY=Math.min(...bounds.map(p=>p[1])),maxY=Math.max(...bounds.map(p=>p[1]));
 const scale=Math.min(730/(maxX-minX),426/(maxY-minY));
 const dx=420-(minX+maxX)*scale/2,dy=265-(minY+maxY)*scale/2;
 return {point:(x,y,z=0)=>{const p=raw(x,y,z);return [dx+p[0]*scale,dy+p[1]*scale];},depth:(x,y,z=0)=>raw(x,y,z)[2],
  ray:(x,y)=>({origin:eye,direction:unit(forward.map((value,index)=>value+right[index]*(x-dx)/scale-up[index]*(y-dy)/scale))})};
}
function drawLightingScenic(ctx,plan,{quarter=0,selected=''}={}){
 const projection=lightingRenderProjection(plan,quarter),p=projection.point,w=840,h=530;
 projection.beams=lightingScenicBeams(plan);
 const rgba=(color,alpha)=>{
  const hex=color.slice(1);
  return 'rgba('+parseInt(hex.slice(0,2),16)+','+parseInt(hex.slice(2,4),16)+','+parseInt(hex.slice(4,6),16)+','+alpha+')';
 };
 const polygon=(points,fill,stroke)=>{
  ctx.beginPath();points.forEach((point,index)=>index?ctx.lineTo(...point):ctx.moveTo(...point));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8;ctx.stroke();}
 };
 const line=(a,b,color,width=1)=>{
  ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
 };
 const glow=(at,radius,color,alpha)=>{
  if(radius<=0)return;
  const gradient=ctx.createRadialGradient(...at,0,...at,radius);
  gradient.addColorStop(0,rgba(color,alpha));gradient.addColorStop(.2,rgba(color,alpha*.6));gradient.addColorStop(1,rgba(color,0));
  ctx.fillStyle=gradient;ctx.fillRect(at[0]-radius,at[1]-radius,radius*2,radius*2);
 };
 const disk=(x,y,z,radius,color,alpha,gobo=false,hard=false,stretch=1,angle=0)=>{
  const at=p(x,y,z),across=p(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius,z);
  const along=p(x-Math.sin(angle)*radius*stretch,y+Math.cos(angle)*radius*stretch,z);
  ctx.save();
  ctx.transform(across[0]-at[0],across[1]-at[1],along[0]-at[0],along[1]-at[1],at[0],at[1]);
  const gradient=ctx.createRadialGradient(0,0,0,0,0,1);
  gradient.addColorStop(0,rgba(color,alpha));
  gradient.addColorStop(hard?.93:.38,rgba(color,alpha*.9));
  gradient.addColorStop(hard?.98:.85,rgba(color,alpha*.2));
  gradient.addColorStop(1,rgba(color,0));
  ctx.beginPath();
  for(let step=0;step<96;step++){
   const a=step*Math.PI/48,edge=gobo?(step%16<8?.65:1):1;
   const x=Math.cos(a)*edge,y=Math.sin(a)*edge;
   if(step)ctx.lineTo(x,y);else ctx.moveTo(x,y);
  }
  ctx.closePath();ctx.fillStyle=gradient;ctx.fill();ctx.restore();
  if(gobo){
   for(let petal=0;petal<7;petal++){
    const a=petal*Math.PI*2/7,points=[];
    for(let i=0;i<20;i++){
     const b=i*Math.PI/10;
     points.push(p(x+Math.cos(a)*radius*.5+Math.cos(b)*radius*.12,y+Math.sin(a)*radius*.5+Math.sin(b)*radius*.12,z));
    }
    polygon(points,'rgba(6,10,19,.68)');
   }
  }
 };
 const body=(x,y,z,width,depth,height,angle=0,light=false)=>{
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const at=(u,v,k)=>p(x+u*cos-v*sin,y+u*sin+v*cos,z+k);
  const vertices=[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]];
  const walls=vertices.map(([u,v],index)=>{
   const next=vertices[(index+1)%4];
   return {index,points:[at(u,v,0),at(...next,0),at(...next,height),at(u,v,height)],
    distance:projection.depth(x+(u+next[0])/2,y+(v+next[1])/2,z)};
  }).sort((a,b)=>b.distance-a.distance);
  for(const wall of walls)polygon(wall.points,['#18212e','#293447','#0b111b','#354157'][wall.index],'#4d5c7180');
  const lid=vertices.map(([u,v])=>at(u,v,height));
  polygon(lid,light?'#26354a':'#172335','#8296ad70');
  line(lid[0],lid[1],'#b7c7d577',.7);
  line(lid[1],lid[2],'#dce6ed55',.5);
 };

 const background=ctx.createLinearGradient(0,0,0,h);
 background.addColorStop(0,'#050711');background.addColorStop(.65,'#111a2b');background.addColorStop(1,'#03060c');
 ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
 const floor=[[0,0],[plan.width,0],[plan.width,plan.depth],[0,plan.depth]];
 // Draped rear wall with narrow folds, and a raised front edge.
 for(let fold=0;fold<64;fold++){
  const x=plan.width*fold/64,next=plan.width*(fold+1)/64,value=Math.round(11+Math.sin(fold*.93)**2*12);
  polygon([p(x,0,0),p(next,0,0),p(next,0,plan.height),p(x,0,plan.height)],'rgb('+value+','+(value+2)+','+(value+10)+')');
 }
 for(const [a,b] of [[[0,0],[0,plan.depth]],[[plan.width,0],[plan.width,plan.depth]],[[0,plan.depth],[plan.width,plan.depth]]]){
  polygon([p(...a,0),p(...b,0),p(...b,-.16),p(...a,-.16)],'#141c2b','#354052');
 }
 const floorPoints=floor.map(v=>p(...v));
 const floorGradient=ctx.createLinearGradient(0,160,0,480);
 floorGradient.addColorStop(0,'#273246');floorGradient.addColorStop(1,'#0c1421');
 polygon(floorPoints,floorGradient,'#48596b');
 ctx.save();polygon(floorPoints);ctx.clip();
 const step=Math.max(.25,plan.width/80);
 for(let x=0;x<plan.width;x+=step)line(p(x,0),p(x,plan.depth),'#8399b20c',.6);
 for(let plank=0;plank<32;plank++){
  const y=plan.depth*plank/32;
  line(p(0,y),p(plan.width,y),plank%4===0?'#02060a35':'#8ba4c108',.6);
 }
 for(const item of plan.items){
  const at=lightingPosition(plan,item);
  if(at.z>.5||lightingIsScenery(item.type))continue;
  const center=p(at.x,at.y,.004),across=p(at.x+.42,at.y,.004),along=p(at.x,at.y+.32,.004);
  ctx.save();ctx.transform(across[0]-center[0],across[1]-center[1],along[0]-center[0],along[1]-center[1],...center);
  const shadow=ctx.createRadialGradient(0,0,0,0,0,1);
  shadow.addColorStop(0,'rgba(0,0,0,.7)');shadow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=shadow;ctx.fillRect(-1,-1,2,2);ctx.restore();
 }
 const patches=plan.items.filter(item=>lightingCanPatch(item));
 ctx.globalCompositeOperation='screen';
 for(const item of patches){
  const at=lightingPosition(plan,item),angle=item.angle*Math.PI/180,color=lightingRenderColor(plan,item);
  const beam=projection.beams.get(item.id);
  if(beam.hit||beam.target[2]>.1)continue;
  const [x,y]=beam.target;
  const radius=beam.radius,stretch=Math.min(4,1/Math.max(.18,Math.abs(beam.direction[2])));
  // A profile's illustrative floor pool has a two-metre diameter.
  disk(x,y,.006,radius,color,item.type==='profile'?.85:.62,item.type==='spot',item.type==='profile',stretch,angle);
 }
 ctx.restore();

 const haze=plan.items.some(item=>item.type==='fog');
 ctx.save();ctx.globalCompositeOperation='screen';
 let seed=416;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let cloud=0;cloud<(haze?42:10);cloud++){
  const at=p(random()*plan.width,random()*plan.depth,random()*Math.min(plan.height,2));
  glow(at,42+random()*90,'#a5bbda',haze?.055:.018);
 }
 ctx.restore();

 const hits=[],objects=plan.items.map((item,index)=>({item,index,position:lightingPosition(plan,item)}));
 objects.sort((a,b)=>{
  const beamA=projection.beams.get(a.item.id),beamB=projection.beams.get(b.item.id);
  if(beamA?.hit===b.item&&projection.depth(...beamA.source)<=projection.depth(b.position.x,b.position.y,b.position.z))return 1;
  if(beamB?.hit===a.item&&projection.depth(...beamB.source)<=projection.depth(a.position.x,a.position.y,a.position.z))return -1;
  return projection.depth(b.position.x,b.position.y,b.position.z)-projection.depth(a.position.x,a.position.y,a.position.z);
 });
 for(const {item,index,position} of objects){
  const {x,y,z}=position,fixture=lightingCatalog[item.type],angle=item.angle*Math.PI/180;
  if(lightingIsScenery(item.type)){
   const at=drawLightingScenery(ctx,plan,item,projection,{scenic:true});
   if(item.id===selected){
    ctx.fillStyle='#efdcff';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText((index+1)+' · '+lightingLabel(item),...at);
   }
   hits.push({item,x:at[0],y:at[1]});continue;
  }
  const color=lightingRenderColor(plan,item),at=p(x,y,z+.2),isSupport=lightingIsSupport(item.type);
  if(isSupport){
   const base=p(x,y,0),top=p(x,y,z);
   if(item.type==='totem'){
    for(const offset of [-.12,.12])line(p(x+offset,y,0),p(x+offset,y,z),'#95a9c0',2);
    for(let rung=0;rung<z;rung+=.35){
     line(p(x-.12,y,rung),p(x+.12,y,Math.min(z,rung+.35)),'#728ba8',1.4);
     line(p(x+.12,y,rung),p(x-.12,y,Math.min(z,rung+.35)),'#c6d4df',.6);
    }
    body(x,y,0,.45,.45,.05);
   }else{
    line(base,top,'#a0aabb',2.5);
    for(const a of [0,2.094,4.189])line(p(x,y,.16),p(x+Math.cos(a)*.4,y+Math.sin(a)*.4,.02),'#798ea6',2);
   }
  }else{
   const bar=fixture.shape==='bar',size=bar?1:item.type==='speaker'?.5:.3;
   body(x,y,z,size,bar?.13:.32,item.type==='speaker'?.7:.24,angle,lightingCanPatch(item));
   if(fixture.shape==='moving'){
    const head=p(x,y,z+.43),base=p(x,y,z+.15);
    line([base[0]-6,base[1]], [head[0]-6,head[1]-2],'#778397',3);
    line([base[0]+6,base[1]], [head[0]+6,head[1]-2],'#536579',3);
    const gradient=ctx.createRadialGradient(head[0]-2,head[1]-3,1,...head,10);
    gradient.addColorStop(0,'#66758b');gradient.addColorStop(.45,'#303e55');gradient.addColorStop(1,'#080e18');
    ctx.beginPath();ctx.arc(...head,9,0,Math.PI*2);ctx.fillStyle=gradient;ctx.fill();
   }
  }
  ctx.save();ctx.globalCompositeOperation='screen';
  if(lightingCanPatch(item)){
   const diffuse=['wash','par','bar','sun','pc'].includes(item.type);
   const beamPath=projection.beams.get(item.id),originZ=beamPath.source[2];
   const source=p(...beamPath.source),[tx,ty,targetZ]=beamPath.target,target=p(...beamPath.target);
   const radius=beamPath.radius,layers=diffuse?16:10,density=haze?1.35:.8;
   for(let layer=layers;layer>0;layer--){
    const width=.1+layer/layers*.9,beam=ctx.createLinearGradient(...source,...target);
    beam.addColorStop(0,rgba(color,(diffuse?.46:.82)*density/layers));
    beam.addColorStop(.45,rgba(color,(diffuse?.18:.36)*density/layers));
    beam.addColorStop(1,rgba(color,.035*density/layers));
    polygon(lightingBeamOutline(projection,beamPath,width),beam);
   }
   if(item.type==='spot'&&beamPath.surface==='floor'){
    for(let ring=1;ring<=3;ring++)for(let dot=0;dot<ring*8;dot++){
     const a=dot*Math.PI*2/(ring*8),r=radius*ring/3;
     const center=p(tx+Math.cos(a)*r,ty+Math.sin(a)*r,.012);
     const gradient=ctx.createRadialGradient(...center,0,...center,2.7);
     gradient.addColorStop(0,rgba(color,.9));gradient.addColorStop(1,rgba(color,0));
     ctx.fillStyle=gradient;ctx.fillRect(center[0]-3,center[1]-3,6,6);
    }
   }
   if(item.type==='sun'){
    for(let lamp=0;lamp<10;lamp++){
     const offset=(lamp/9-.5)*.9,location=p(x+Math.cos(angle)*offset,y+Math.sin(angle)*offset,z+.27);
     glow(location,10,color,.6);ctx.fillStyle='#fff8e8';ctx.beginPath();ctx.arc(...location,2,0,Math.PI*2);ctx.fill();
    }
   }else if(item.type==='bar'){
    const a=p(x-.45*Math.cos(angle),y-.45*Math.sin(angle),z+.27),b=p(x+.45*Math.cos(angle),y+.45*Math.sin(angle),z+.27);
    line(a,b,rgba(color,.16),13);line(a,b,rgba(color,.48),6);line(a,b,color,2.8);
   }else{
    const lens=p(x,y,originZ);
    glow(lens,18,color,.8);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(...lens,2,0,Math.PI*2);ctx.fill();
   }
  }else if(item.type==='spark'){
   for(let particle=0;particle<80;particle++){
    const height=.1+random()*Math.min(2.8,plan.height-z),spread=height*.12;
    const px=x+(random()-.5)*spread,py=y+(random()-.5)*spread;
    const a=p(px,py,z+height),b=p(px+.01,py,z+Math.max(0,height-.06-random()*.12));
    line(a,b,random()>.5?'#fff6d2':'#ffb558',.7+random());
    if(particle%5===0)glow(a,7,'#ffb65b',.38);
   }
  }else if(item.type==='snow'){
   for(let flake=0;flake<130;flake++){
    const dz=random()*Math.max(.1,plan.height-z),spread=.5+dz*.5;
    const px=x+(random()-.5)*spread,py=y+(random()-.5)*spread;
    const at=p(Math.max(0,Math.min(plan.width,px)),Math.max(0,Math.min(plan.depth,py)),z+dz);
    line(at,[at[0]-.7,at[1]+1+random()*2],'rgba(235,246,255,.76)',.6+random());
   }
  }else if(item.type==='geyser'){
   const limit=Math.min(plan.height-z,3.2);
   for(let cloud=0;cloud<16;cloud++){
    const height=limit*cloud/16,at=p(x+(random()-.5)*height*.15,y,z+height);
    glow(at,8+cloud*1.8,'#c8def5',.10);
   }
  }
  ctx.restore();
  if(item.id===selected){
   ctx.beginPath();ctx.arc(...at,17,0,Math.PI*2);ctx.strokeStyle='#decaff';ctx.lineWidth=1.5;ctx.stroke();
   ctx.fillStyle='#f5ecff';ctx.font='bold 12px Arial';ctx.textAlign='left';ctx.fillText((index+1)+' · '+lightingLabel(item),Math.max(10,Math.min(620,at[0]+20)),Math.max(45,at[1]-8));
  }
  hits.push({item,x:at[0],y:at[1]});
 }
 // Soft camera vignette.
 const vignette=ctx.createRadialGradient(420,265,160,420,265,460);
 vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,2,8,.72)');
 ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#b5c4dc';ctx.font='12px Arial';ctx.textAlign='left';
 ctx.fillText(tr('Rendu scénique')+' · '+lightingDimensions(plan),22,26);
 return {projection,hits};
}

function drawLightingPlan(ctx,plan,{view='2d',quarter=0,selected='',paper=false}={}){
 if(view==='render')return drawLightingScenic(ctx,plan,{quarter,selected});
 const projection=lightingProjection(plan,view,quarter),p=projection.point,w=840,h=530;
 const ink=paper?'#233653':'#d5e2f6';
 const line=(a,b,color,width=1)=>{
  ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
 };
 const polygon=(points,fill,stroke)=>{
  ctx.beginPath();points.forEach((point,index)=>index?ctx.lineTo(...point):ctx.moveTo(...point));ctx.closePath();
  ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1.4;ctx.stroke();
 };
 const text=(value,x,y,size,color=ink,align='center',bold=false)=>{
  ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=(bold?'bold ':'')+size+'px Arial';ctx.fillText(value,x,y);
 };
 ctx.fillStyle=paper?'#f6f8fc':'#111926';ctx.fillRect(0,0,w,h);
 const edge=paper?'#647b98':'#627a9d',grid=paper?'#c8d4e3':'#354662';
 const corners=[[0,0],[plan.width,0],[plan.width,plan.depth],[0,plan.depth]];
 if(view==='3d'){
  ctx.setLineDash([5,5]);
  corners.forEach(([x,y],index)=>{
   const next=corners[(index+1)%4];
   line(p(x,y),p(x,y,plan.height),grid);
   line(p(x,y,plan.height),p(...next,plan.height),grid);
  });
  ctx.setLineDash([]);
 }
 if(view==='3d'){
  const slab=Math.min(.25,plan.height*.08);
  corners.forEach(([x,y],index)=>{
   const [u,v]=corners[(index+1)%4];
   polygon([p(x,y),p(u,v),p(u,v,-slab),p(x,y,-slab)],paper?'#d6e1ee':'#263953',edge);
  });
 }
 polygon(corners.map(point=>p(...point)),paper?'#fff':'#1b2a40',edge);
 if(plan.grid){
  for(let x=1;x<plan.width;x++)line(p(x,0),p(x,plan.depth),grid);
  for(let y=1;y<plan.depth;y++)line(p(0,y),p(plan.width,y),grid);
 }
 if(view==='2d'){
  const [left,top]=p(0,0),[right,bottom]=p(plan.width,plan.depth);
  text(tr('FOND DE SCÈNE'),(left+right)/2,top-15,14);
  text(tr('PUBLIC'),(left+right)/2,bottom+19,14);
  text(plan.width+' m',(left+right)/2,bottom+39,13);
  ctx.save();ctx.translate(left-16,(top+bottom)/2);ctx.rotate(-Math.PI/2);text(plan.depth+' m',0,0,13);ctx.restore();
  if(plan.grid){
   const step=projection.scale>=34?1:5;
   for(let x=0;x<=plan.width;x+=step)text(String(x),p(x,0)[0],top-4,10,edge);
   for(let y=0;y<=plan.depth;y+=step)text(String(y),left+8,p(0,y)[1],10,edge);
  }
 }else{
  const [x,y]=p(plan.width/2,plan.depth);
  text(tr('PUBLIC'),x,y+24,14);
 }
 text(lightingDimensions(plan)+(plan.grid?' · '+tr('Grille de 1 m'):''),24,22,14,ink,'left',true);

 const items=plan.items.map((item,index)=>({item,index,position:lightingPosition(plan,item)}));
 if(view==='3d')items.sort((a,b)=>projection.depth(a.position.x,a.position.y)-projection.depth(b.position.x,b.position.y)||a.position.z-b.position.z);
 const hits=[];
 for(const {item,index,position} of items){
  const {x,y,z}=position,fixture=lightingCatalog[item.type],isSupport=lightingIsSupport(item.type);
  if(lightingIsScenery(item.type)){
   const at=drawLightingScenery(ctx,plan,item,projection,{view,paper});
   text(String(index+1)+' '+lightingLabel(item),at[0],at[1]+19,12,ink,'center',true);
   hits.push({item,x:at[0],y:at[1]});continue;
  }
  const chosen=item.id===selected,angle=item.angle*Math.PI/180;
  let at=p(x,y,z);
  if(view==='3d'){
   const floor=p(x,y);
   const color=paper?'#49678a':fixture.color;
   if(isSupport){
    const gap=item.type==='totem'?6:2;
    for(const side of [-1,1])line([floor[0]+side*gap,floor[1]],[at[0]+side*gap,at[1]],color,2);
    if(item.type==='totem'){
     for(let level=0;level<z;level+=.45){
      const a=p(x,y,level),b=p(x,y,Math.min(level+.45,z));
      line([a[0]-gap,a[1]],[b[0]+gap,b[1]],color);
     }
    }else{
     for(const offset of [-12,0,12])line(floor,[floor[0]+offset,floor[1]+7],color,2);
    }
    at=[at[0],at[1]+(plan.items.some(device=>device.mount===item.id)?14:0)];
   }else if(z>0&&!item.mount)line(floor,at,grid);
   const aimed=p(x-Math.sin(angle),y+Math.cos(angle),z);
   const projectedAngle=Math.atan2(aimed[1]-p(x,y,z)[1],aimed[0]-p(x,y,z)[0])-Math.PI/2;
   if(!isSupport){
    const body=fixture.shape==='bar'?.34:.19,base=Math.max(0,z-.10);
    const point=(u,v,h)=>p(x+u*Math.cos(angle)-v*Math.sin(angle),y+u*Math.sin(angle)+v*Math.cos(angle),h);
    const lower=[point(-body,-.13,base),point(body,-.13,base),point(body,.13,base),point(-body,.13,base)];
    const upper=[point(-body,-.13,z+.14),point(body,-.13,z+.14),point(body,.13,z+.14),point(-body,.13,z+.14)];
    for(let side=0;side<4;side++){
     const next=(side+1)%4;
     polygon([lower[side],lower[next],upper[next],upper[side]],paper?'#d2dce9':'#33465e',edge);
    }
    polygon(upper,paper?'#e9eff6':'#425570',edge);
   }
   drawLightingSymbol(ctx,fixture,...at,projectedAngle,chosen,paper);
  }else{
   // Keep a mounted fixture legible while retaining the support's exact position.
   if(item.mount){
    const mounted=items.filter(entry=>entry.item.mount===item.mount),slot=mounted.findIndex(entry=>entry.item===item);
    const theta=slot*Math.PI/4,radius=26+Math.floor(slot/8)*24;
    const offset=[at[0]+Math.cos(theta)*radius,at[1]+Math.sin(theta)*radius];
    line(at,offset,edge);at=offset;
   }
   drawLightingSymbol(ctx,fixture,...at,angle,chosen,paper);
  }
  text(String(index+1)+(view==='2d'?' '+fixture.mark:''),at[0]+13,at[1]-12,12,chosen&&!paper?'#ead6ff':ink,'left',true);
  if(chosen)text(lightingLabel(item),at[0],at[1]+32,13,ink,'center',true);
  hits.push({item,x:at[0],y:at[1]});
 }
 const selectedFixture=plan.items.find(item=>item.id===selected&&lightingCanPatch(item));
 if(selectedFixture){
  const beam=lightingScenicBeams(plan).get(selected),target=projection.point(...beam.target),source=projection.point(...beam.source);
  ctx.save();ctx.setLineDash([4,4]);line(source,target,paper?'#6e568c':'#dec1ff',1.3);ctx.restore();
  line([target[0]-5,target[1]],[target[0]+5,target[1]],paper?'#6e568c':'#dec1ff',1.5);
  line([target[0],target[1]-5],[target[0],target[1]+5],paper?'#6e568c':'#dec1ff',1.5);
 }
 return {projection,hits};
}
let lightingSelection='',lightingView='2d',lightingQuarter=0,lightingDrag=null,lightingDraw=null;
function paintLightingPlan(){
 const canvas=$('lightingCanvas');
 lightingLoadImages(pilotTools.lightingPlan);
 const ctx=canvas.getContext('2d');ctx.setTransform(2,0,0,2,0,0);
 lightingDraw=drawLightingPlan(ctx,pilotTools.lightingPlan,{view:lightingView,quarter:lightingQuarter,selected:lightingSelection});
 $('lightingView2d').setAttribute('aria-pressed',String(lightingView==='2d'));
 $('lightingView3d').setAttribute('aria-pressed',String(lightingView==='3d'));
 $('lightingViewRender').setAttribute('aria-pressed',String(lightingView==='render'));
 $('lightingRotate').hidden=lightingView==='2d';
 $('lightingAimPick').hidden=lightingView==='2d';
 $('lightingAimPick').disabled=!lightingCanPatch(pilotTools.lightingPlan.items.find(item=>item.id===lightingSelection));
 $('lightingAimPick').setAttribute('aria-pressed',String(!!lightingAimPick));
 canvas.classList.toggle('lightingPickArmed',!!lightingAimPick);
 $('lightingPaletteLabel').hidden=lightingView!=='render';
 $('lightingPalette').value=pilotTools.lightingPlan.renderPalette||'custom';
 const hint=lightingAimPick?'Cliquez sur le sol ou un décor pour viser ce point. Échap pour annuler.':lightingView==='render'?'Rendu illustratif des faisceaux et effets. Tournez la vue pour explorer la scène.':
  lightingView==='2d'?'Glissez un appareil sur le plan ou saisissez sa position en mètres.':'Tournez la vue pour vérifier les hauteurs et l’implantation.';
 setShowText($('lightingHint'),tr(hint));
}
function updateLightingPlan(){
 const plan=pilotTools.lightingPlan,item=plan.items.find(device=>device.id===lightingSelection);
 const position=item?lightingPosition(plan,item):null;
 for(const [id,key] of [['lightingWidth','width'],['lightingDepth','depth'],['lightingHeight','height']])$(id).value=plan[key];
 $('lightingGrid').checked=plan.grid;
 $('lightingItems').replaceChildren(new Option(tr('Aucun objet sélectionné'),''));
 plan.items.forEach((device,index)=>$('lightingItems').add(new Option((index+1)+' · '+lightingLabel(device),device.id)));
 $('lightingItems').value=item?.id||'';
 $('lightingItemFields').disabled=!item;
 $('lightingAdd').disabled=plan.items.length>=100;
 $('lightingName').value=item?.name||'';$('lightingAngle').value=item?.angle??'';
 for(const [id,key,max] of [['lightingX','x',plan.width],['lightingY','y',plan.depth],['lightingZ','z',plan.height]]){
  $(id).max=max;$(id).value=position?.[key]??'';$(id).disabled=!!item?.mount;
 }
 const support=item&&lightingIsSupport(item.type);
 setShowText($('lightingZLabel'),tr(support?'Hauteur du support (m)':'Hauteur de pose (m)'));
 $('lightingMountLabel').hidden=!item||support;
 $('lightingMount').replaceChildren(new Option(tr('Sans support'),''));
 plan.items.forEach((device,index)=>{
  if(lightingIsSupport(device.type))$('lightingMount').add(new Option((index+1)+' · '+lightingLabel(device),device.id));
 });
 $('lightingMount').value=item?.mount||'';
 $('lightingPatch').hidden=!lightingCanPatch(item);
 $('lightingUniverse').value=item?.dmxUniverse??'';
 $('lightingAddress').value=item?.dmxAddress??'';
 $('lightingCircuit').value=item?.circuit||'';
 $('lightingBeamColorLabel').hidden=!lightingCanPatch(item)||item.type==='pc';
 $('lightingBeamColor').value=item?.beamColor||lightingCatalog[item?.type]?.color||'#75abff';
 $('lightingChannels').value=item&&lightingCanPatch(item)?lightingChannels(item):'';
 $('lightingAimFields').hidden=!lightingCanPatch(item);
 if(lightingCanPatch(item)){
  const beam=lightingScenicBeams(plan).get(item.id);
  const tilt=lightingManualTilt(item)?item.tilt:Math.round(lightingBeamTilt(beam)*10)/10;
  $('lightingTilt').value=tilt;$('lightingTiltRange').value=tilt;
  setShowText($('lightingAimStatus'),tr(lightingManualTilt(item)?'Visée manuelle':'Visée automatique'));
  const target=beam.target.map(value=>value.toFixed(2));
  setShowText($('lightingAimTarget'),tr('Point éclairé - X {x} m · Y {y} m · H {z} m',{x:target[0],y:target[1],z:target[2]}));
 }
 const scenery=item&&lightingIsScenery(item.type);
 $('lightingSceneryFields').hidden=!scenery;
 $('lightingObjectWidth').value=scenery?item.objectWidth:'';
 $('lightingObjectHeight').value=scenery?item.objectHeight:'';
 $('lightingObjectHeight').max=Math.max(.1,plan.height-(item?.z||0));
 $('lightingBannerFields').hidden=item?.type!=='spider';
 $('lightingCover').value=item?.cover||'black';
 $('lightingBannerUpload').hidden=item?.cover!=='banner';
 $('lightingBannerRemove').hidden=!item?.bannerImage;
 $('lightingMountLabel').hidden=!item||support||scenery;
 const range=lightingPatchRange(item);
 setShowText($('lightingChannelRange'),range?tr('Canaux utilisés : {start} à {end}',{start:range.start,end:range.end}):'');
 updateLightingPatchWarnings();
 paintLightingPlan();
}
function initLightingPlan(){
 const dialog=$('lightingPlanDialog'),canvas=$('lightingCanvas');
 $('lightingPlanOpen').onclick=()=>openToolDialog('lightingPlanDialog',()=>{
  lightingSelection='';lightingView='2d';lightingQuarter=0;lightingDrag=null;
  setShowText($('lightingPdfStatus'),'');
  const groups=new Map();
  for(const [type,fixture] of Object.entries(lightingCatalog)){
   if(!groups.has(fixture.group)){
    const group=document.createElement('optgroup');group.label=tr(fixture.group);groups.set(fixture.group,group);
   }
   groups.get(fixture.group).append(new Option(tr(fixture.label),type));
  }
  $('lightingCatalog').replaceChildren(...groups.values());
  updateLightingPlan();
 });
 dialog.querySelector('.pilotToolClose').onclick=()=>dialog.close();
 for(const [id,view] of [['lightingView2d','2d'],['lightingView3d','3d'],['lightingViewRender','render']])$(id).onclick=()=>{lightingAimPick='';lightingView=view;paintLightingPlan();};
 $('lightingRotate').onclick=()=>{lightingQuarter=(lightingQuarter+1)%4;paintLightingPlan();};
 $('lightingPdf').onclick=()=>downloadToolPdf($('lightingPdf'),$('lightingPdfStatus'),buildLightingPlanPdf,'plan-de-feu');
 $('lightingItems').onchange=event=>{lightingAimPick='';lightingSelection=event.target.value;updateLightingPlan();};
 $('lightingAimPick').onclick=()=>{lightingAimPick=lightingAimPick?'':lightingSelection;paintLightingPlan();};
 dialog.addEventListener('close',()=>{lightingAimPick='';});
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&lightingAimPick){event.preventDefault();lightingAimPick='';paintLightingPlan();}});

 const change=edit=>{
  const plan=pilotTools.lightingPlan,item=plan.items.find(device=>device.id===lightingSelection);
  pushHistory();edit(plan,item);savePilotTools();updateLightingPlan();
 };
 $('lightingAdd').onclick=()=>{
  if(pilotTools.lightingPlan.items.length>=100)return;
  change(plan=>{
   const type=$('lightingCatalog').value,id=uuid();
   const offset=plan.items.length%8;
   plan.items.push({id,type,name:'',x:Math.round(plan.width*(.27+(offset%4)*.15)*100)/100,
    y:Math.round(plan.depth*(.4+Math.floor(offset/4)*.22)*100)/100,z:lightingIsSupport(type)?Math.min(plan.height,2):0,angle:0,mount:'',
    ...(lightingCanPatch({type})?lightingNextPatch(plan,type,lightingSelection):{})});
   const added=plan.items[plan.items.length-1];
   if(lightingIsScenery(type)){
    added.objectWidth=type==='backdrop'?plan.width:Math.min(plan.width,type==='leg'?2:3);
    added.objectHeight=type==='spider'?Math.min(plan.height,2):plan.height;
    added.z=0;added.x=plan.width/2;added.y=type==='backdrop'?0:plan.depth*.3;
    if(type==='leg'){added.x=0;added.angle=90;}
    if(type==='spider')added.cover='black';
   }
   lightingSelection=id;
  });
 };
 $('lightingGrid').onchange=event=>change(plan=>{plan.grid=event.target.checked;});
 for(const [id,key,min,max] of [['lightingWidth','width',1,60],['lightingDepth','depth',1,60],['lightingHeight','height',.5,30]]){
  $(id).onchange=event=>change(plan=>{
   plan[key]=toolClamp(event.target.valueAsNumber,min,max,plan[key]);
   for(const item of plan.items){
    if(item.type==='backdrop'&&key==='width'){item.objectWidth=plan.width;item.x=plan.width/2;}
    item.x=Math.min(item.x,plan.width);item.y=Math.min(item.y,plan.depth);item.z=Math.min(item.z,plan.height);
    if(lightingIsScenery(item.type))item.objectHeight=Math.min(item.objectHeight,Math.max(.1,plan.height-item.z));
   }
  });
 }
 for(const [id,key,max] of [['lightingX','x','width'],['lightingY','y','depth'],['lightingZ','z','height'],['lightingAngle','angle',359.99]]){
  $(id).onchange=event=>change((plan,item)=>{
   if(item&&(key==='angle'||!item.mount)){
    if(key==='angle'&&lightingCanPatch(item)&&!lightingManualTilt(item))item.tilt=Math.round(lightingBeamTilt(lightingScenicBeams(plan).get(item.id))*10)/10;
    item[key]=toolClamp(event.target.valueAsNumber,0,plan[max]??max,item[key]);
    if(key==='z'&&lightingIsScenery(item.type))item.objectHeight=Math.min(item.objectHeight,Math.max(.1,plan.height-item.z));
   }
  });
 }
 for(const [id,key] of [['lightingObjectWidth','objectWidth'],['lightingObjectHeight','objectHeight']]){
  $(id).onchange=event=>change((plan,item)=>{
   if(lightingIsScenery(item?.type))item[key]=toolClamp(event.target.valueAsNumber,.1,key==='objectHeight'?Math.max(.1,plan.height-item.z):60,item[key]);
  });
 }
 $('lightingCover').onchange=event=>change((plan,item)=>{
  if(item?.type==='spider')item.cover=event.target.value==='banner'?'banner':'black';
 });
 $('lightingBannerFile').onchange=event=>lightingImportBanner(event.target.files?.[0]);
 $('lightingBannerRemove').onclick=()=>change((plan,item)=>{
  if(item?.type==='spider')delete item.bannerImage;
  setShowText($('lightingBannerStatus'),'');
 });
 $('lightingName').onchange=event=>change((plan,item)=>{if(item)item.name=event.target.value.trim();});
 for(const [id,key,min,max] of [['lightingUniverse','dmxUniverse',0,Number.MAX_SAFE_INTEGER],['lightingAddress','dmxAddress',1,512],['lightingChannels','dmxChannels',1,512]]){
  $(id).onchange=event=>{
   const input=event.target;
   if(input.validity.badInput||!input.reportValidity())return;
   const value=lightingPatchNumber(input.valueAsNumber,min,max);
   change((plan,item)=>{
    if(!lightingCanPatch(item))return;
    if(value===null&&key==='dmxChannels')item[key]=1;
    else if(value===null)delete item[key];
    else item[key]=value;
   });
  };
 }
 $('lightingTilt').onchange=event=>change((plan,item)=>{
  if(lightingCanPatch(item))item.tilt=toolClamp(event.target.valueAsNumber,-90,90,0);
 });
 let tiltGesture=null;
 $('lightingTiltRange').oninput=event=>{
  const item=pilotTools.lightingPlan.items.find(device=>device.id===lightingSelection);
  if(!lightingCanPatch(item))return;
  if(tiltGesture!==item){pushHistory();tiltGesture=item;}
  item.tilt=toolClamp(Number(event.target.value),-90,90,0);
  $('lightingTilt').value=item.tilt;paintLightingPlan();savePilotTools();
 };
 $('lightingTiltRange').onpointerdown=()=>{tiltGesture=null;};
 $('lightingTiltRange').onchange=()=>{tiltGesture=null;updateLightingPlan();};
 $('lightingAimAuto').onclick=()=>change((plan,item)=>{if(item)delete item.tilt;});
 for(const button of document.querySelectorAll('[data-lighting-tilt]')){
  button.onclick=()=>change((plan,item)=>{if(lightingCanPatch(item))item.tilt=Number(button.dataset.lightingTilt);});
 }
 $('lightingPalette').onchange=event=>change(plan=>{plan.renderPalette=event.target.value==='blue-amber'?'blue-amber':'custom';});
 for(const button of document.querySelectorAll('[data-lighting-color]')){
  button.onclick=()=>change((plan,item)=>{if(lightingCanPatch(item))item.beamColor=button.dataset.lightingColor;});
 }
 $('lightingBeamColor').onchange=event=>change((plan,item)=>{
  if(lightingCanPatch(item))item.beamColor=normalizeGoCueColor(event.target.value)||lightingCatalog[item.type].color;
 });
 $('lightingCircuit').onchange=event=>change((plan,item)=>{
  if(!lightingCanPatch(item))return;
  const value=lightingCircuit(event.target.value);
  if(value)item.circuit=value;
  else delete item.circuit;
 });
 $('lightingMount').onchange=event=>change((plan,item)=>{
  if(!item||lightingIsSupport(item.type))return;
  Object.assign(item,lightingPositionSnapshot(plan,item));
  item.mount=event.target.value;
 });
 $('lightingRemove').onclick=()=>change((plan,item)=>{
  if(!item)return;
  for(const device of plan.items){
   if(device.mount===item.id)Object.assign(device,lightingPositionSnapshot(plan,device),{mount:''});
  }
  plan.items=plan.items.filter(device=>device!==item);lightingSelection='';
 });
 canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||lightingDrag)return;
  const point=stageToolPoint(event,canvas);
  if(lightingAimPick){
   const item=pilotTools.lightingPlan.items.find(device=>device.id===lightingAimPick),target=lightingPickSurface(pilotTools.lightingPlan,lightingDraw.projection,point);
   if(!item||!target){setShowText($('lightingHint'),tr('Cliquez sur une surface du sol ou d’un décor.'));return;}
   pushHistory();
   if(lightingAimAtPoint(pilotTools.lightingPlan,item,target)){lightingAimPick='';savePilotTools();updateLightingPlan();}
   return;
  }
  const hit=[...lightingDraw.hits].reverse().find(marker=>Math.hypot(marker.x-point.x,marker.y-point.y)<21);
  lightingSelection=hit?.item.id||'';
  if(hit&&lightingView==='2d'&&!hit.item.mount){
   const projection=lightingDraw.projection;
   lightingDrag={id:event.pointerId,item:hit.item,projection,dx:point.x-hit.x,dy:point.y-hit.y,moved:false};
   canvas.setPointerCapture(event.pointerId);
  }
  updateLightingPlan();
 });
 canvas.addEventListener('pointermove',event=>{
  if(lightingDrag?.id!==event.pointerId)return;
  const {item,projection,dx,dy}=lightingDrag,plan=pilotTools.lightingPlan;
  const point=stageToolPoint(event,canvas);
  if(!lightingDrag.moved){pushHistory();lightingDrag.moved=true;}
  item.x=Math.round(toolClamp((point.x-dx-projection.x)/projection.scale,0,plan.width,item.x)*100)/100;
  item.y=Math.round(toolClamp((point.y-dy-projection.y)/projection.scale,0,plan.depth,item.y)*100)/100;
  paintLightingPlan();
 });
 const endDrag=event=>{
  if(lightingDrag?.id!==event.pointerId)return;
  if(lightingDrag.moved)savePilotTools();
  lightingDrag=null;updateLightingPlan();
 };
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,endDrag);
}
function lightingPositionSnapshot(plan,item){
 const {x,y,z}=lightingPosition(plan,item);
 return {x,y,z};
}
async function buildLightingPlanPdf(){
 const plan=clone(pilotTools.lightingPlan),title=showTitle.value.trim()||tr('Plan de feu');
 const includeRender=lightingView==='render',quarter=lightingQuarter,background=await toolPdfHeaderImage();
 const page=makeToolPdfPage(tr('Plan de feu'),title,background),pages=[page];
 const canvas=document.createElement('canvas');canvas.width=1680;canvas.height=1060;
 const ctx=canvas.getContext('2d');ctx.scale(2,2);
 await lightingLoadImages(plan,false);
 page.content+=pdfFill(.13,.20,.32)+pdfText(36,715,11,lightingDimensions(plan)+(plan.grid?' - '+tr('Grille de 1 m'):''),true);
 for(const [view,label,top] of [['2d','Vue 2D',690],['3d','Vue 3D',374]]){
  drawLightingPlan(ctx,plan,{view,paper:true});
  page.images.push({bytes:dataUrlToBytes(canvas.toDataURL('image/jpeg',.96)),width:canvas.width,height:canvas.height});
  page.content+=pdfFill(.13,.20,.32)+pdfText(36,top,11,tr(label),true);
  page.content+='q 465 0 0 293.39 65 '+(top-304)+' cm /Im'+page.images.length+' Do Q\n';
 }
 if(includeRender){
  const scenic=makeToolPdfPage(tr('Rendu scénique'),title,background);pages.push(scenic);
  drawLightingPlan(ctx,plan,{view:'render',quarter});
  scenic.images.push({bytes:dataUrlToBytes(canvas.toDataURL('image/jpeg',.96)),width:canvas.width,height:canvas.height});
  scenic.content+='q 523 0 0 330 36 347 cm /Im'+scenic.images.length+' Do Q\n';
  scenic.content+=pdfFill(.13,.20,.32)+pdfText(36,705,12,tr('Rendu scénique'),true);
  scenic.content+=pdfFill(.25,.32,.43)+pdfText(36,324,9,tr('Visualisation illustrative des faisceaux et effets.'));
 }
 const devicesPerPage=10;
 for(let start=0;start<plan.items.length;start+=devicesPerPage){
  const sheet=makeToolPdfPage(tr('Plan de feu'),title,background);pages.push(sheet);
  sheet.content+=pdfFill(.13,.20,.32)+pdfText(36,713,13,tr('Liste des appareils'),true);
  plan.items.slice(start,start+devicesPerPage).forEach((item,i)=>{
   const position=lightingPosition(plan,item),y=684-i*60;
   const support=plan.items.findIndex(device=>device.id===item.mount);
   const label=lightingLabel(item)+(item.name.trim()?' - '+tr(lightingCatalog[item.type].label):'');
   sheet.content+=pdfFill(.13,.20,.32)+pdfText(36,y,10,(start+i+1)+' · '+label,true);
   sheet.content+=pdfFill(.25,.32,.43)+pdfText(36,y-14,9,
    'X '+position.x.toFixed(2)+' m    Y '+position.y.toFixed(2)+' m    H '+position.z.toFixed(2)+' m    '+item.angle+'°'+
    (support>=0?'    '+tr('Support')+' '+(support+1):'')+
    (lightingManualTilt(item)?'    '+tr('Inclinaison')+' '+item.tilt+'°':''));
   const patch=[];
   if(item.dmxUniverse!==undefined)patch.push(tr('Univers DMX')+' '+item.dmxUniverse);
   if(item.dmxAddress!==undefined)patch.push(tr('Adresse DMX')+' '+item.dmxAddress);
   if(lightingCanPatch(item))patch.push(tr('Nombre de canaux')+' '+lightingChannels(item));
   if(patch.length)sheet.content+=pdfText(36,y-28,8,patch.join('    |    '));
   const range=lightingPatchRange(item),details=[];
   if(range)details.push(tr('Canaux utilisés : {start} à {end}',{start:range.start,end:range.end}));
   if(item.circuit)details.push(tr('Circuit')+' '+item.circuit);
   if(lightingIsScenery(item.type))details.push(tr('Dimensions')+' '+item.objectWidth+' × '+item.objectHeight+' m');
   if(details.length)sheet.content+=pdfText(36,y-41,8,details.join('    |    '));
  });
  sheet.content+=pdfFill(.25,.32,.43)+pdfText(36,73,8,tr('X depuis la gauche vue du public, Y depuis le fond, H depuis le plateau.'));
 }
 pages.forEach((sheet,index)=>pdfPageFooter(sheet,index,pages.length));
 return buildPdfDocument(pages);
}

function checklistPdfIcon(key,x,y){
 let content=pdfStroke(.32,.22,.57)+'1.1 w 1 J 1 j\n';
 for(const line of checklistIconLines(key)){
  content+=line.map(([u,v],i)=>(x+u*.78).toFixed(1)+' '+(y-v*.78).toFixed(1)+(i?' l':' m')).join(' ')+' S\n';
 }
 return content;
}
function checklistPdfSections(data,keys){
 return data.sections.map(section=>({...section,items:section.items.filter(item=>item.text.trim()&&checklistItemMatchesAct(item,keys))}))
  .filter(section=>section.items.length);
}
function checklistSummarySections(data,acts){
 const usage=actChecklistUsage(acts),seen=new Map();
 return checklistPdfSections(data,usage).map(section=>({...section,items:section.items.flatMap(item=>{
  const key=checklistTextKey(item.text),previous=seen.get(key);
  if(previous){previous.checked=previous.checked||item.checked;previous.itemIds.push(item.id);return [];}
  const entry={...item,usedBy:usage.get(key),itemIds:[item.id]};
  seen.set(key,entry);return [entry];
 })})).filter(section=>section.items.length);
}
async function buildChecklistToolPdf({act,keys}=currentChecklistActFilter()){
 const data=clone(pilotTools.checklist),show=showTitle.value.trim(),title=data.title.trim()||tr('Checklist');
 const sections=checklistPdfSections(data,keys),projectId=copilotProjectId;
 if(!sections.length)throw new Error(tr(act?'Aucun élément de checklist pour ce numéro.':'Ajoutez au moins un élément à la checklist.'));
 return renderChecklistPdf({sections,show,title,act,background:await toolPdfHeaderImage(),projectId});
}
function renderChecklistPdf({sections,show,title,act,summaryActs,background,projectId}){
 const pages=[];
 let page,y;
 function newPage(){
  page=makeToolPdfPage(tr('Checklist'),title,background);pages.push(page);y=715;
  if(show&&show!==title){page.content+=pdfFill(.34,.38,.45)+pdfText(36,y,10,pdfHeaderTitleLines(show)[0]||'');y-=19;}
  if(act){
   for(const line of pdfHeaderTitleLines(act.label)){
    page.content+=pdfFill(.16,.18,.30)+pdfText(36,y,11,line,true);
    y-=16;
   }
   y-=3;
  }
 }
 function heading(section){
  page.content+=pdfFill(.92,.91,.97)+pdfRoundedRect(36,y-26,523,27,5);
  page.content+=checklistPdfIcon(section.icon,45,y-4);
  page.content+=pdfFill(.16,.18,.30)+pdfText(73,y-16,11,pdfHeaderTitleLines(section.title.trim()||tr('Rubrique'))[0],true);
  y-=33;
 }
 newPage();
 if(summaryActs){
  page.content+=pdfFill(.16,.18,.30)+pdfText(36,y,11,tr('Numéros sélectionnés'),true);y-=17;
  for(const act of summaryActs){
   for(const line of wrapPdfText(act.label,75)){
    if(y<75)newPage();
    page.content+=pdfFill(.16,.18,.30)+pdfText(36,y,10,line);y-=14;
   }
  }
  y-=10;
 }
 if(!sections.length){
  if(y<75)newPage();
  page.content+=pdfFill(.34,.38,.45)+pdfText(36,y,10,tr(summaryActs?'Aucun élément de checklist pour ces numéros.':'Aucun élément de checklist pour ce numéro.'));
 }
 for(const section of sections){
  const items=section.items.map(item=>({
   ...item,lines:wrapPdfText(item.text.trim(),50),
   usageLines:item.usedBy?.length>1?wrapPdfText(tr('Utilisé par {acts}',{acts:item.usedBy.join(', ')}),80):[]
  }));
  const textHeight=item=>Math.max(25,item.lines.length*14+10);
  const startHeight=item=>textHeight(item)+(item.usageLines.length?12:0);
  if(y-33-startHeight(items[0])<61)newPage();
  heading(section);
  for(const item of items){
   if(y-startHeight(item)<61){newPage();heading(section);}
   const ids=item.itemIds||[item.id];
   const name=projectId&&ids.every(id=>typeof id==='string')?checklistPdfFieldPrefix+pdfUnicodeHex(JSON.stringify([projectId,checklistTextKey(item.text),ids])):undefined;
   page.checkboxes.push({x:47,y:y-18,checked:item.checked,label:item.text,name});
   page.content+=pdfFill(.10,.14,.23);
   item.lines.forEach((line,i)=>{page.content+=pdfText(73,y-15-i*14,10,line);});
   y-=textHeight(item);
   for(const line of item.usageLines){
    if(y-12<61){newPage();heading(section);}
    page.content+=pdfFill(.34,.38,.45)+pdfText(73,y-4,9,line);
    y-=12;
   }
   page.content+=pdfStroke(.88,.89,.92)+pdfLine(44,y+2,550,y+2,.5);
  }
  y-=8;
 }
 pages.forEach((page,index)=>pdfPageFooter(page,index,pages.length));
 return buildPdfDocument(pages);
}
const checklistPdfFieldPrefix='s2a-checklist-v1-';
let checklistPdfReaderPromise=null;
function loadChecklistPdfReader(){
 if(window.PDFLib)return Promise.resolve(window.PDFLib);
 if(!checklistPdfReaderPromise)checklistPdfReaderPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='./pdf-assets/pdf-lib.min.js?v=1.17.1';
  script.onload=()=>window.PDFLib?resolve(window.PDFLib):reject(new Error(tr('Lecteur PDF indisponible.')));
  script.onerror=()=>{script.remove();reject(new Error(tr('Lecteur PDF indisponible.')));};
  document.head.append(script);
 }).catch(error=>{checklistPdfReaderPromise=null;throw error;});
 return checklistPdfReaderPromise;
}
function readChecklistPdfField(field,PDFCheckBox){
 const name=field.getName(),hex=name.slice(checklistPdfFieldPrefix.length);
 if(!(field instanceof PDFCheckBox)||!name.startsWith(checklistPdfFieldPrefix)||!hex||hex.length%4||!/^[0-9a-f]+$/i.test(hex))return null;
 try{
  let json='';
  for(let offset=0;offset<hex.length;offset+=4)json+=String.fromCharCode(parseInt(hex.slice(offset,offset+4),16));
  const [projectId,key,ids]=JSON.parse(json);
  if(typeof projectId!=='string'||typeof key!=='string'||!Array.isArray(ids)||!ids.length||
   ids.some(id=>typeof id!=='string'))return null;
  return {projectId,key,ids,checked:field.isChecked()};
 }catch(error){return null;}
}
let checklistImportPreview=null,checklistImportRequest=0;
function checklistImportNote(skipped){
 return skipped?' '+tr('{count} ligne(s) modifiée(s) ou supprimée(s) ignorée(s).',{count:skipped}):'';
}
function closeChecklistImportPreview(restoreFocus=false){
 checklistImportPreview=null;
 checklistImportRequest++;
 $('checklistImportPreview').hidden=true;
 $('checklistImportChanges').replaceChildren();
 $('checklistImportPriorityField').hidden=true;
 $('checklistImportPriority').replaceChildren();
 $('checklistImportUseOrder').onclick=null;
 $('checklistImportConflictsOnly').checked=false;
 if(restoreFocus&&$('checklistDialog').open)$('checklistSummaryImport').focus();
}
function selectedChecklistImportChanges(entries){
 return entries.flatMap(entry=>{
  const choice=entry.control;
  const checked=choice.tagName==='SELECT'
   ?choice.value===''?entry.previous:choice.value==='check'
   :choice.checked?entry.checked:entry.previous;
  return checked===entry.previous?[]:[{...entry,checked}];
 });
}
function renderChecklistImportOrder(sources,conflicts,updateApply){
 const list=$('checklistImportPriority'),use=$('checklistImportUseOrder');
 const controls=new Map();
 for(const [id,label] of [...sources].sort(([a],[b])=>a-b)){
  const row=document.createElement('li'),name=document.createElement('span');
  const up=document.createElement('button'),down=document.createElement('button');
  row.dataset.sourceId=String(id);name.textContent=label;
  for(const [button,direction,symbol] of [[up,-1,'↑'],[down,1,'↓']]){
   button.type='button';button.textContent=symbol;
   button.setAttribute('aria-label',tr(direction<0?'Monter le PDF':'Descendre le PDF')+' · '+label);
   button.onclick=()=>{
    const adjacent=direction<0?row.previousElementSibling:row.nextElementSibling;
    if(!adjacent)return;
    if(direction<0)list.insertBefore(row,adjacent);
    else list.insertBefore(adjacent,row);
    updateBoundaries();
    (button.disabled?(direction<0?down:up):button).focus();
   };
  }
  controls.set(row,{up,down});
  row.append(name,up,down);list.append(row);
 }
 function updateBoundaries(){
  for(const [row,{up,down}] of controls){
   up.disabled=!row.previousElementSibling;
   down.disabled=!row.nextElementSibling;
  }
 }
 updateBoundaries();
 use.onclick=()=>{
  const order=Array.from(list.children,row=>Number(row.dataset.sourceId));
  if(checklistImportPreview)checklistImportPreview.order=order.map(id=>sources.get(id));
  for(const {bySource,selectSource} of conflicts){
   const id=order.find(id=>bySource.has(id));
   if(id!==undefined)selectSource(sources.get(id),bySource.get(id)?'check':'uncheck');
  }
  updateApply();
  conflicts[0].control.focus();
 };
}
function showChecklistImportPreview(changes,skipped,epoch,files){
 const rows=$('checklistImportChanges'),apply=$('checklistImportApply');
 const sections=new Map();
 for(const section of pilotTools.checklist.sections)for(const item of section.items)sections.set(item,section.title);
 const entries=[],conflicts=[],sources=new Map();
 const updateApply=()=>{apply.disabled=!selectedChecklistImportChanges(entries).length;};
 for(const [item,{votes,checked}] of changes){
  const conflict=votes.size>1;
  const label=document.createElement('label'),control=document.createElement(conflict?'select':'input');
  const description=document.createElement('span'),action=document.createElement('strong');
  const context=document.createElement('small');
  let provenance;
  description.textContent=item.text;
  context.textContent=sections.get(item)||'';
  description.append(context);
  if(conflict){
   label.className='checklistImportConflict';
   action.textContent=tr('Conflit entre PDF');
   description.append(action);
   const options=[
    ['',tr('Garder la coche actuelle')],
    ['check',tr('Cocher')],
    ['uncheck',tr('Décocher')]
   ];
   for(const [value,text] of options){
    const option=document.createElement('option');option.value=value;option.textContent=text;control.append(option);
   }
   const bySource=new Map();
   for(const value of [true,false]){
    const files=document.createElement('small');
    const documents=[...votes.get(value)];
    files.textContent=tr(value?'Cocher':'Décocher')+' · '+documents.map(document=>document.label).join(', ');
    for(const document of documents){sources.set(document.id,document.label);bySource.set(document.id,value);}
    description.append(files);
   }
   const badge=document.createElement('small');
   badge.className='checklistImportProvenance';
   badge.hidden=true;
   let suggestion=null;
   const updateProvenance=()=>{
    const manual=suggestion?control.value!==suggestion.value:control.value!=='';
    badge.hidden=!manual&&!suggestion;
    badge.classList.toggle('isManual',manual);
    badge.textContent=manual
     ?suggestion?tr('Choix manuel · PDF proposé {file}',{file:suggestion.file}):tr('Choix manuel')
     :suggestion?tr('PDF retenu · {file}',{file:suggestion.file}):'';
   };
   conflicts.push({control,bySource,selectSource(file,value){
    suggestion={file,value};
    control.value=value;
    updateProvenance();
   }});
   control.onchange=()=>{updateProvenance();updateApply();};
   provenance=()=>({manual:!suggestion||control.value!==suggestion.value,files:suggestion?[suggestion.file]:[]});
   label.append(description,control,badge);
  }else{
   control.type='checkbox';control.checked=true;
   action.textContent=tr(checked?'Cocher':'Décocher');
   action.className=checked?'checklistImportCheck':'checklistImportUncheck';
   label.append(control,description,action);
   control.onchange=updateApply;
   provenance=()=>({manual:false,files:[...votes.get(checked)].map(source=>source.label)});
  }
  rows.append(label);
  entries.push({item,text:item.text,section:sections.get(item)||'',previous:item.checked,revision:item.checkRevision,checked,control,provenance});
 }
 $('checklistImportPriorityField').hidden=!conflicts.length;
 if(conflicts.length)renderChecklistImportOrder(sources,conflicts,updateApply);
 checklistImportPreview={entries,skipped,epoch,files,order:[]};
 $('checklistImportBulk').hidden=entries.every(entry=>entry.control.tagName==='SELECT');
 $('checklistImportConflictsFilter').hidden=!conflicts.length;
 $('checklistImportConflictsOnly').onchange=()=>{
  const filtered=$('checklistImportConflictsOnly').checked;
  for(const entry of entries)entry.control.closest('label').hidden=filtered&&entry.control.tagName!=='SELECT';
  $('checklistImportBulk').hidden=filtered||entries.every(entry=>entry.control.tagName==='SELECT');
 };
 for(const [id,checked] of [['checklistImportSelectAll',true],['checklistImportSelectNone',false]]){
  $(id).onclick=()=>{
   for(const entry of entries)if(entry.control.tagName==='INPUT')entry.control.checked=checked;
   updateApply();
  };
 }
 $('checklistImportPreview').hidden=false;
 updateApply();(conflicts.length?$('checklistImportUseOrder'):entries[0].control).focus();
}
function applyChecklistImportPreview(event){
 event.preventDefault();
 const preview=checklistImportPreview;
 if(!preview||preview.epoch!==copilotProjectEpoch||locked){closeChecklistImportPreview();return;}
 const selected=selectedChecklistImportChanges(preview.entries);
 if(!selected.length)return;
 const current=new Set(checklistItems()),valid=selected.filter(({item,text,previous,revision})=>current.has(item)&&item.text===text&&item.checked===previous&&item.checkRevision===revision);
 if(valid.length){
  pushHistory();
  for(const {item,checked} of valid)setChecklistItemChecked(item,checked);
  pilotTools.checklistImportHistory=normalizeChecklistImportHistory([{
   at:Date.now(),files:preview.files,order:preview.order,
   changes:valid.map(({item,text,section,checked,previous,provenance})=>({itemId:item.id,revision:item.checkRevision,text,section,checked,previous,...provenance()}))
  },...pilotTools.checklistImportHistory]);
  $('checklistHistorySearch').value='';
  $('checklistHistoryManual').checked=false;
  renderChecklistTool();
  $('checklistHistorySelect').value='0';
  renderChecklistHistoryRecord();
  $('checklistImportHistory').open=true;
  savePilotTools();
 }
 const status=tr('{count} case(s) mise(s) à jour.',{count:valid.length});
 closeChecklistImportPreview(!valid.length);
 if(valid.length)$('checklistImportHistory').querySelector('summary').focus();
 setShowText($('checklistToolStatus'),status+checklistImportNote(preview.skipped+selected.length-valid.length));
}
async function readChecklistPdfFile(file,reader,projectId){
 if(file.size>64*1024*1024)throw new Error(tr('Le PDF dépasse 64 Mo.'));
 let fields;
 try{
  const pdf=await reader.PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false});
  fields=pdf.getForm().getFields().map(field=>readChecklistPdfField(field,reader.PDFCheckBox));
 }catch(error){
  throw new Error(tr('Impossible de lire les cases interactives de ce PDF.'));
 }
 if(!fields.length||fields.some(field=>!field))throw new Error(tr('Choisissez un PDF de checklist compatible exporté par Pilot.'));
 if(fields.some(field=>field.projectId!==projectId))throw new Error(tr('Ce PDF appartient à un autre spectacle.'));
 const ids=new Set();
 for(const field of fields)for(const id of field.ids){
  if(ids.has(id))throw new Error(tr('Impossible de lire les cases interactives de ce PDF.'));
  ids.add(id);
 }
 return fields;
}
function combineChecklistPdfChanges(documents){
 const items=new Map(checklistItems().map(item=>[item.id,item])),proposals=new Map(),skipped=new Set();
 for(const {source,fields} of documents)for(const {key,ids,checked} of fields){
  const matching=[];
  for(const id of ids){
   const item=items.get(id);
   if(!item||checklistTextKey(item.text)!==key){skipped.add(id);continue;}
   matching.push(item);
  }
  // A checked summary can represent multiple duplicate rows.
  const changesGroup=matching.some(item=>item.checked)!==checked;
  for(const item of matching){
   if(!proposals.has(item))proposals.set(item,{votes:new Map(),changes:false,checked});
   const proposal=proposals.get(item);
   if(!proposal.votes.has(checked))proposal.votes.set(checked,new Set());
   proposal.votes.get(checked).add(source);
   proposal.changes=proposal.changes||(changesGroup&&item.checked!==checked);
  }
 }
 for(const [item,proposal] of proposals)if(proposal.votes.size===1&&!proposal.changes)proposals.delete(item);
 return {changes:proposals,skipped:skipped.size};
}
async function importChecklistSummaryPdfs(files){
 const button=$('checklistSummaryImport'),status=$('checklistToolStatus'),epoch=copilotProjectEpoch;
 if(button.disabled||locked)return;
 closeChecklistImportPreview();closeChecklistRestorePreview();
 const request=checklistImportRequest,projectId=copilotProjectId;
 const active=()=>epoch===copilotProjectEpoch&&request===checklistImportRequest&&!locked&&$('checklistDialog').open;
 button.disabled=true;setShowText(status,tr('Lecture des PDF…'));
 try{
  const reader=await loadChecklistPdfReader(),documents=[],counts=new Map();
  for(const file of files)counts.set(file.name,(counts.get(file.name)||0)+1);
  for(const [id,file] of files.entries()){
   if(!active())return;
   const label=counts.get(file.name)>1?(id+1)+' · '+file.name:file.name;
   try{documents.push({source:{id,label},fields:await readChecklistPdfFile(file,reader,projectId)});}
   catch(error){throw new Error(file.name+' - '+error.message);}
  }
  if(!active())return;
  const {changes,skipped}=combineChecklistPdfChanges(documents);
  if(changes.size){
   showChecklistImportPreview(changes,skipped,epoch,documents.map(document=>document.source.label));
   setShowText(status,checklistImportNote(skipped).trim());
  }else setShowText(status,tr('Aucun changement à appliquer.')+checklistImportNote(skipped));
 }catch(error){if(active())setShowText(status,error.message);}
 finally{button.disabled=false;}
}
let checklistZipEpoch=null;
function checklistZipChoices(){
 return Array.from($('checklistActZipChoices').querySelectorAll('input[type=checkbox]'));
}
function updateChecklistZipSubmit(){
 const empty=!checklistZipChoices().some(input=>input.checked);
 $('checklistActZipSubmit').disabled=empty;
 $('checklistActSummaryDownload').disabled=empty;
}
function closeChecklistZipPicker(restoreFocus=false){
 $('checklistActZipForm').hidden=true;
 $('checklistActZipDownload').setAttribute('aria-expanded','false');
 if(restoreFocus&&$('checklistDialog').open)$('checklistActZipDownload').focus();
}
function openChecklistZipPicker(){
 if(conductType!=='manual')return;
 const acts=actsForChecklist();
 if(!acts.length)return;
 if(!$('checklistActZipForm').hidden){closeChecklistZipPicker();return;}
 checklistZipEpoch=copilotProjectEpoch;
 const list=$('checklistActZipChoices');
 list.replaceChildren();
 for(const {id,label} of acts){
  const option=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
  input.type='checkbox';input.value=id;input.checked=true;input.onchange=updateChecklistZipSubmit;
  text.textContent=label;option.append(input,text);list.append(option);
 }
 setShowText($('checklistToolStatus'),'');
 $('checklistActZipForm').hidden=false;
 $('checklistActZipDownload').setAttribute('aria-expanded','true');
 updateChecklistZipSubmit();checklistZipChoices()[0]?.focus();
}
async function downloadChecklistActSelection(summaryOnly=false){
 const button=$('checklistActZipDownload'),status=$('checklistToolStatus'),fields=$('checklistActZipFields');
 if(fields.disabled||conductType!=='manual'||checklistZipEpoch!==copilotProjectEpoch)return;
 const selected=new Set(checklistZipChoices().filter(input=>input.checked).map(input=>input.value));
 const acts=actsForChecklist().filter(act=>selected.has(act.id));
 if(!acts.length)return;
 const epoch=copilotProjectEpoch,data=clone(pilotTools.checklist),projectId=copilotProjectId;
 const show=showTitle.value.trim(),title=data.title.trim()||tr('Checklist');
 button.disabled=true;fields.disabled=true;setShowText(status,tr(summaryOnly?'Création du PDF…':'Création du ZIP…'));
 try{
  const background=await toolPdfHeaderImage();
  if(epoch!==copilotProjectEpoch)return;
  const summaryTitle=tr('Checklist récapitulative');
  const summary={
   name:safeFileName(summaryTitle)+'.pdf',
   data:renderChecklistPdf({sections:checklistSummarySections(data,acts),show,title:summaryTitle,summaryActs:acts,background,projectId})
  };
  if(summaryOnly){
   downloadBlob(new Blob([summary.data],{type:'application/pdf'}),summary.name);
  }else{
   const files=acts.map(act=>({
    name:safeFileName(act.label)+'.pdf',
    data:renderChecklistPdf({sections:checklistPdfSections(data,checklistActKeys(act)),show,title,act,background,projectId})
   }));
   const zip=await makeZip([summary,...files]);
   if(epoch!==copilotProjectEpoch)return;
   downloadBlob(zip,safeFileName(show||tr('Projet S2A Pilot'))+'-checklists.zip');
  }
  closeChecklistZipPicker();
  setShowText(status,tr(summaryOnly?'PDF prêt.':'ZIP prêt.'));
 }catch(error){if(epoch===copilotProjectEpoch)setShowText(status,error.message);}
 finally{
  fields.disabled=false;button.disabled=false;
  if(epoch===copilotProjectEpoch&&$('checklistActZipForm').hidden&&$('checklistDialog').open)button.focus();
 }
}
async function downloadToolPdf(button,status,build,suffix){
 const epoch=copilotProjectEpoch,title=showTitle.value.trim()||tr('Projet S2A Pilot');
 button.disabled=true;setShowText(status,tr('Création du PDF…'));
 try{
  const bytes=await build();
  if(epoch!==copilotProjectEpoch)return;
  downloadBlob(new Blob([bytes],{type:'application/pdf'}),safeFileName(title)+'-'+suffix+'.pdf');
  setShowText(status,tr('PDF prêt.'));
 }catch(error){setShowText(status,error.message);}
 finally{button.disabled=false;}
}

// K-weighting at 48 kHz, and integrated loudness over 400 ms blocks with a 100 ms hop.
const levelMatchFilters=[
 [1.53512485958697,-2.69169618940638,1.19839281085285,-1.69065929318241,.73248077421585],
 [1,-2,1,-1.99004745483398,.99007225036621]
];
let levelMatchRun=null;
function levelMatchAvailable(){
 return !locked&&!pilotOutputInUse();
}
function levelMatchActions(){return allMediaActions().filter(item=>item.action.kind==='audio').map(item=>item.action);}
function updateLevelMatchButtons(){
 const tracks=levelMatchActions(),disabled=!!levelMatchRun||!levelMatchAvailable();
 $('levelMatchApply').disabled=disabled||!tracks.length;
 $('levelMatchReset').disabled=disabled||!tracks.some(track=>track.levelMatchDb);
}
async function measureToolLevel(buffer,action,isCurrent){
 if(buffer.numberOfChannels>2||buffer.sampleRate!==48000)throw new Error('unsupported-audio');
 const start=Math.max(0,Math.round((Number(action.inPoint)||0)*buffer.sampleRate));
 const end=Math.min(buffer.length,Math.round(start+mediaSegmentDuration(action)*buffer.sampleRate));
 if(end<=start)throw new Error('empty-audio');
 const first=buffer.getChannelData(0),second=buffer.numberOfChannels===2?buffer.getChannelData(1):null;
 const fold=second&&normalizeTrackPan(action.pan)!==0,channels=second&&!fold?2:1;
 const states=Array.from({length:channels},()=>levelMatchFilters.map(()=>({z1:0,z2:0})));
 const hop=4800,hops=[];let sum=0,peak=0;
 for(let i=start;i<end;i++){
  const left=first[i],right=second?second[i]:0;
  peak=Math.max(peak,Math.abs(left),Math.abs(right),fold?Math.abs(left+right):0);
  for(let ch=0;ch<channels;ch++){
   let sample=fold?left+right:ch?right:left;
   for(let filter=0;filter<levelMatchFilters.length;filter++){
    const [b0,b1,b2,a1,a2]=levelMatchFilters[filter],state=states[ch][filter];
    const output=b0*sample+state.z1;
    state.z1=b1*sample-a1*output+state.z2;state.z2=b2*sample-a2*output;
    sample=output;
   }
   sum+=sample*sample;
  }
  const count=i-start+1;
  if(count%hop===0){hops.push(sum);sum=0;}
  if(count%(hop*80)===0){
   await new Promise(resolve=>setTimeout(resolve,0));
   if(!isCurrent())return null;
  }
 }
 const energies=[];
 if(end-start<4*hop)energies.push((hops.reduce((a,b)=>a+b,0)+sum)/(end-start));
 else for(let index=3;index<hops.length;index++)energies.push((hops[index]+hops[index-1]+hops[index-2]+hops[index-3])/(hop*4));
 const absolute=Math.pow(10,(-70+.691)/10),gated=energies.filter(value=>value>absolute);
 if(!gated.length||!peak)throw new Error('silent-audio');
 const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
 const relative=mean(gated)/10,energy=mean(gated.filter(value=>value>relative));
 if(!Number.isFinite(energy)||!Number.isFinite(peak)||!(energy>0))throw new Error('invalid-audio');
 return {loudness:-.691+10*Math.log10(energy),peakDb:20*Math.log10(peak)};
}
function describeLevelMatchFailure(error){
 if(error.message==='silent-audio'||error.message==='empty-audio')return tr('Passage silencieux ou vide');
 if(error.message==='unsupported-audio')return tr('Piste mono ou stéréo requise');
 return tr('Piste illisible dans ce navigateur');
}
async function runToolLevelMatch(){
 if(levelMatchRun||!levelMatchAvailable())return;
 const tracks=levelMatchActions(),Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
 const status=$('levelMatchStatus'),skipped=$('levelMatchSkipped');skipped.replaceChildren();
 if(!tracks.length||!Offline){setShowText(status,tr('Analyse audio indisponible.'));return;}
 const epoch=copilotProjectEpoch,run={},snapshot=tracks.map(action=>({action,data:{...action}}));
 levelMatchRun=run;updateLevelMatchButtons();
 const current=()=>levelMatchRun===run&&epoch===copilotProjectEpoch&&$('levelMatchDialog').open&&!locked;
 const measured=[];
 try{
  const context=new Offline(2,1,48000);
  for(let i=0;i<snapshot.length;i++){
   if(!current())return;
   const {action,data}=snapshot[i];
   setShowText(status,tr('Analyse des pistes {current}/{total}',{current:i+1,total:snapshot.length}));
   try{
    const asset=await getAsset(data.assetKey);if(!asset)throw new Error('missing-audio');
    const bytes=await asset.arrayBuffer();
    const buffer=await new Promise((resolve,reject)=>context.decodeAudioData(bytes,resolve,reject));
    if(!current())return;
    const result=await measureToolLevel(buffer,data,current);
    if(!current())return;
    measured.push({action,data,...result});
   }catch(error){
    if(!current())return;
    const entry=document.createElement('li');entry.textContent=data.name+' - '+describeLevelMatchFailure(error);skipped.append(entry);
   }
  }
  if(!current())return;
  if(!measured.length){setShowText(status,tr('Aucune piste n’a pu être équilibrée.'));return;}
  const latest=new Map(levelMatchActions().map(track=>[track.id,track]));
  const unchanged=snapshot.length===latest.size&&snapshot.every(({action,data})=>{
   const track=latest.get(data.id);
   return track===action&&['assetKey','inPoint','outPoint','duration','gainDb','pan','levelMatchDb'].every(key=>track[key]===data[key]);
  });
  if(!unchanged||!levelMatchAvailable()){setShowText(status,tr('Le projet a changé. Relancez l’analyse.'));return;}
  const target=Math.max(-30,Math.min(-18,...measured.map(item=>item.loudness+Math.min(12,-3-item.peakDb))));
  const changes=measured.map(item=>{
   const requested=target-item.loudness,ceiling=-3-item.peakDb;
   const applied=Math.max(-60,Math.floor(Math.min(requested,12,ceiling)*10)/10);
   return {action:item.action,db:normalizeLevelMatch(applied-normalizeTrackGain(item.action.gainDb)),limited:Math.abs(applied-requested)>.15};
  });
  if(changes.some(({action,db})=>normalizeLevelMatch(action.levelMatchDb)!==db)){
   pushHistory();
   for(const {action,db} of changes)action.levelMatchDb=db||undefined;
   renderCues(false);savePilotTools();
  }
  const limit=changes.filter(item=>item.limited).length;
  setShowText(status,tr('{count} piste(s) équilibrée(s) · cible {target} LUFS',{count:measured.length,target:target.toFixed(1)})+
   (limit?' · '+tr('{count} piste(s) limitée(s)',{count:limit}):'')+
   (skipped.children.length?' · '+tr('{count} piste(s) ignorée(s)',{count:skipped.children.length}):''));
 }catch(error){
  if(current())setShowText(status,tr('Analyse audio indisponible.'));
 }finally{
  if(levelMatchRun===run){levelMatchRun=null;updateLevelMatchButtons();}
 }
}

function openToolDialog(id,prepare){
 $('pilotToolboxDialog').close();
 prepare();
 $(id).showModal();
}
let showCheckBusy=false;
function renderShowCheck(){
 const media=allMediaActions(),failures=mediaPreflightFailures();
 const ready=media.filter(item=>preparedRecord(item)).length;
 $('showCheckMedia').textContent=media.length?tr('{ready} / {total} médias prêts',{ready,total:media.length}):tr('Aucun média dans ce projet.');
 $('showCheckFailures').hidden=!failures.length;
 renderMediaPreflightFailures($('showCheckFailures'),failures);
 const audio=pilotOutputId?(pilotOutputName||tr('Carte son sélectionnée')):tr('Sortie système');
 $('showCheckAudio').textContent=pilotOutputId&&!pilotOutputReady?audio+' · '+tr('Indisponible'):audio;
 const ltc=media.filter(item=>ltcPreparationKey(item)).length;
 $('showCheckLtc').textContent=ltc?tr('{count} piste(s) avec LTC. Testez le signal dans les réglages audio.',{count:ltc}):tr('Aucune piste avec LTC.');
 $('showCheckRun').disabled=showCheckBusy||!media.length||pilotOutputInUse();
}
let pilotOscStartEpoch=null;
const pilotLocalGateway=['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='8092';
window.S2APilotLocalInfo=async()=>{
 if(!pilotLocalGateway)return null;
 const response=await fetch('./pilot-local/info',{cache:'no-store'});
 if(!response.ok)throw Error(tr('Lancez Pilot depuis le lanceur local.'));
 return response.json();
};
const pilotOscKey='s2a-pilot-osc-destination';
const pilotOscDestination=readLocalSetting(pilotOscKey)||{};
let pilotOscEnabled=false,pilotOscInfo=null;
const pilotOscHistory=[];
function parsePilotOsc(text){
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 if(lines.length>8)throw Error(tr('Maximum de huit messages OSC par Cue.'));
 return lines.map(line=>{
  const parts=line.match(/^(\/[-A-Za-z0-9_.:/+]{1,119})(?:\s+(.*))?$/);
  if(!parts)throw Error(tr('Adresse OSC invalide.'));
  const args=parts[2]?JSON.parse(parts[2]):[];
  if(!Array.isArray(args)||args.length>8||args.some(value=>!['number','string','boolean'].includes(typeof value)))throw Error(tr('Arguments OSC invalides.'));
  return {address:parts[1],args};
 });
}
function makeCueOscEditor(cue){
 const panel=document.createElement('details');panel.className='cueOscEditor';
 const summary=document.createElement('summary');summary.textContent='OSC';
 const input=document.createElement('textarea');input.rows=2;input.maxLength=2000;
 input.value=cue.osc||'';input.placeholder='/cue/1/start';input.setAttribute('aria-label',tr('Messages OSC de la Cue'));
 const help=document.createElement('small');help.textContent=tr('Un message par ligne. Arguments facultatifs au format JSON.');
 const status=document.createElement('small');status.setAttribute('role','status');
 input.onchange=()=>{
  try{parsePilotOsc(input.value);}
  catch(error){status.textContent=tr('Vérifiez le format des messages OSC.');input.value=cue.osc||'';return;}
  status.textContent='';
  if(locked||input.value===(cue.osc||''))return;
  pushHistory();cue.osc=input.value;scheduleAutosave();
 };
 panel.append(summary,input,help,status);
 return panel;
}
async function sendPilotOsc(messages,ip,port){
 const info=pilotOscInfo||await window.S2APilotLocalInfo();
 if(!info?.key)throw Error(tr('Lancez Pilot depuis le lanceur local.'));
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),1500);
 try{
  const response=await fetch('./pilot-local/osc',{method:'POST',headers:{'Content-Type':'application/json','X-Pilot-Key':info.key},body:JSON.stringify({ip,port,messages}),signal:controller.signal});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||tr('Envoi OSC indisponible.'));
 }finally{clearTimeout(timeout);}
}
function logPilotOsc(text){
 pilotOscHistory.unshift(new Date().toLocaleTimeString()+' · '+text);
 if(pilotOscHistory.length>30)pilotOscHistory.pop();
 const list=$('pilotOscHistory');
 list.replaceChildren(...pilotOscHistory.map(line=>{const item=document.createElement('li');item.textContent=line;return item;}));
}
function dispatchCueOsc(cue){
 if(!locked||!pilotOscEnabled||!cue.osc)return;
 let messages;
 try{messages=parsePilotOsc(cue.osc);}catch(error){logPilotOsc(cue.name+' · '+tr('Messages OSC invalides.'));return;}
 if(!messages.length)return;
 sendPilotOsc(messages,pilotOscDestination.ip,pilotOscDestination.port)
  .then(()=>logPilotOsc(cue.name+' · '+tr('Envoyé en UDP')))
  .catch(error=>logPilotOsc(cue.name+' · '+error.message));
}
function initPilotIntegrations(){
 const osc=$('pilotOscDialog'),status=$('pilotOscStatus');
 osc.querySelector('.pilotToolClose').onclick=()=>osc.close();
 $('pilotOscOpen').onclick=()=>openToolDialog('pilotOscDialog',()=>{
  $('pilotOscIp').value=pilotOscDestination.ip||'127.0.0.1';$('pilotOscPort').value=String(pilotOscDestination.port||53000);
  $('pilotOscEnable').checked=pilotOscEnabled;
  status.textContent=pilotLocalGateway?'':tr('Lancez Pilot depuis le lanceur local.');
 });
 $('pilotOscEnable').onchange=async event=>{
  const toggle=event.target;
  if(!toggle.checked){pilotOscEnabled=false;return;}
  toggle.disabled=true;
  try{
   const ip=$('pilotOscIp'),port=$('pilotOscPort');
   if(!ip.reportValidity()||!port.reportValidity())return;
   const address=ip.value.trim(),number=port.valueAsNumber;
   pilotOscInfo=await window.S2APilotLocalInfo();
   if(!pilotOscInfo?.key)throw Error(tr('Lancez Pilot depuis le lanceur local.'));
   if(address!==ip.value.trim()||number!==port.valueAsNumber)return;
   pilotOscDestination.ip=address;pilotOscDestination.port=number;
   writeLocalSetting(pilotOscKey,pilotOscDestination);
   pilotOscEnabled=true;status.textContent=tr('Envoi automatique actif en Live.');
  }catch(error){status.textContent=error.message;}
  finally{toggle.disabled=false;toggle.checked=pilotOscEnabled;}
 };
 for(const id of ['pilotOscIp','pilotOscPort'])$(id).oninput=()=>{
  pilotOscEnabled=false;$('pilotOscEnable').checked=false;
  status.textContent=tr('Réactivez l’envoi pour utiliser cette destination.');
 };
 $('pilotOscForm').onsubmit=async event=>{
  event.preventDefault();
  try{
   const messages=parsePilotOsc($('pilotOscTest').value);
   if(!messages.length)return;
   await sendPilotOsc(messages,$('pilotOscIp').value.trim(),$('pilotOscPort').valueAsNumber);
   status.textContent=tr('Envoyé en UDP');logPilotOsc(status.textContent);
  }catch(error){status.textContent=error.message;logPilotOsc(error.message);}
 };
}
function initPilotToolbox(){
 initLightingPlan();
 initPilotIntegrations();
 const check=$('showCheckDialog'),status=$('showCheckStatus');
 $('showCheckOpen').onclick=()=>openToolDialog('showCheckDialog',()=>{
  status.textContent='';renderShowCheck();
 });
 check.querySelector('.pilotToolClose').onclick=()=>check.close();
 $('showCheckAudioSettings').onclick=()=>{check.close();$('shortcutSettingsButton').click();};
 $('showCheckRun').onclick=async()=>{
  if(showCheckBusy||pilotOutputInUse())return;
  const project=copilotProjectEpoch;
  showCheckBusy=true;status.textContent=tr('Vérification des médias…');renderShowCheck();
  try{
   await prepareShowMedia();
   if(project!==copilotProjectEpoch)return;
   const media=allMediaActions();
   status.textContent=tr(media.every(item=>preparedRecord(item))?'Tous les médias sont prêts.':'Certains médias restent indisponibles.');
  }catch(error){
   if(project===copilotProjectEpoch)status.textContent=tr('La vérification des médias a échoué.');
  }finally{
   showCheckBusy=false;if(check.open)renderShowCheck();
  }
 };
 const toolbox=$('pilotToolboxDialog'),stage=$('stagePlanDialog'),checklist=$('checklistDialog'),levels=$('levelMatchDialog');
 $('pilotToolboxButton').onclick=()=>{
  $('levelMatchOpen').disabled=locked;
  toolbox.showModal();
 };
 for(const dialog of [toolbox,stage,checklist,levels]){
  dialog.querySelector('.pilotToolClose').onclick=()=>{
   if(dialog===levels){levelMatchRun=null;updateLevelMatchButtons();}
   dialog.close();
  };
 }
 $('stagePlanOpen').onclick=()=>openToolDialog('stagePlanDialog',()=>{
  stageToolSelection=-1;setShowText($('stageToolStatus'),'');updateStageTool();
 });
 $('checklistOpen').onclick=()=>openToolDialog('checklistDialog',()=>{
  closeChecklistZipPicker();closeChecklistImportPreview();closeChecklistRestorePreview();
  $('checklistPreparation').open=false;$('checklistPdfMenu').open=false;
  $('checklistImportHistory').open=false;$('checklistHistorySelect').value='';
  $('checklistHistorySearch').value='';$('checklistHistoryManual').checked=false;
  setShowText($('checklistToolStatus'),'');setShowText($('checklistTemplateStatus'),'');$('checklistTemplateName').value='';updateChecklistTemplates();renderChecklistTool();
 });
 $('levelMatchOpen').onclick=()=>openToolDialog('levelMatchDialog',()=>{
  $('levelMatchSkipped').replaceChildren();
  setShowText($('levelMatchStatus'),!levelMatchActions().length?tr('Aucune piste audio dans ce projet.'):
   !levelMatchAvailable()?tr('Mettez la lecture en pause avant d’équilibrer les pistes.'):'');
  updateLevelMatchButtons();
 });
 levels.addEventListener('close',()=>{
  if(!levels.open){levelMatchRun=null;updateLevelMatchButtons();}
 });
 $('levelMatchApply').onclick=runToolLevelMatch;
 $('levelMatchReset').onclick=()=>{
  if(!levelMatchAvailable()||levelMatchRun)return;
  const actions=levelMatchActions().filter(track=>track.levelMatchDb);
  if(!actions.length)return;
  pushHistory();for(const track of actions)delete track.levelMatchDb;
  renderCues(false);savePilotTools();updateLevelMatchButtons();
  $('levelMatchSkipped').replaceChildren();
  setShowText($('levelMatchStatus'),tr('Mise à niveau retirée.'));
 };
 $('stageAudience').onchange=event=>{
  pushHistory();pilotTools.stagePlan.audience=event.target.value;
  paintStageTool();savePilotTools();
 };
 for(const button of $('stageShapes').querySelectorAll('button')){
  button.onclick=()=>{
   const objects=pilotTools.stagePlan.objects;if(objects.length>=200)return;
   pushHistory();const offset=(objects.length%7)*16;
   objects.push({shape:button.dataset.stageShape,name:'',color:'#6452ad',x:420+offset,y:270+offset,size:54,angle:0});
   stageToolSelection=objects.length-1;updateStageTool();savePilotTools();$('stageObjectName').focus();
  };
 }
 $('stageObjectPicker').onchange=event=>{
  stageToolSelection=event.target.value===''?-1:Number(event.target.value);updateStageTool();
 };
 $('stageObjectName').onchange=event=>{
  const item=selectedStageObject();if(!item)return;
  pushHistory();item.name=event.target.value;updateStageTool();savePilotTools();
 };
 $('stageObjectColor').onchange=event=>{
  const item=selectedStageObject();if(!item)return;
  pushHistory();item.color=normalizeGoCueColor(event.target.value)||item.color;paintStageTool();savePilotTools();
 };
 for(const [id,key,min,max] of [['stageObjectSize','size',12,180],['stageObjectAngle','angle',0,359]]){
  $(id).onchange=event=>{
   const item=selectedStageObject();if(!item)return;
   pushHistory();item[key]=Math.round(toolClamp(event.target.valueAsNumber,min,max,item[key]));
   placeStageToolObject(item,item.x,item.y);updateStageTool();savePilotTools();
  };
 }
 for(const [id,axis,length] of [['stageObjectX','x',840],['stageObjectY','y',590]]){
  $(id).onchange=event=>{
   const item=selectedStageObject();if(!item)return;
   const value=toolClamp(event.target.valueAsNumber,0,100,item[axis]*100/length)*length/100;
   pushHistory();placeStageToolObject(item,axis==='x'?value:item.x,axis==='y'?value:item.y);
   updateStageTool();savePilotTools();
  };
 }
 for(const [id,key] of [['stageWidth','width'],['stageDepth','depth']]){
  $(id).onchange=event=>{
   const plan=pilotTools.stagePlan,value=toolClamp(event.target.valueAsNumber,1,60,plan[key]);
   if(value!==plan[key]){pushHistory();plan[key]=value;savePilotTools();}
   updateStageTool();
  };
 }
 $('stageGrid').onchange=event=>{pushHistory();pilotTools.stagePlan.grid=event.target.checked;paintStageTool();savePilotTools();};
 $('stageObjectRemove').onclick=()=>{
  if(!selectedStageObject())return;
  pushHistory();pilotTools.stagePlan.objects.splice(stageToolSelection,1);
  stageToolSelection=-1;updateStageTool();savePilotTools();
 };
 const canvas=$('stagePlanCanvas');
 canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||stageToolDrag)return;
  const point=stageToolPoint(event,canvas),objects=pilotTools.stagePlan.objects,ctx=canvas.getContext('2d');
  stageToolSelection=-1;
  for(let index=objects.length-1;index>=0;index--)if(stageToolHit(ctx,objects[index],point)){stageToolSelection=index;break;}
  const item=selectedStageObject();
  if(item){
   stageToolDrag={id:event.pointerId,item,dx:point.x-item.x,dy:point.y-item.y,moved:false};
   canvas.setPointerCapture(event.pointerId);
  }
  updateStageTool();
 });
 canvas.addEventListener('pointermove',event=>{
  const drag=stageToolDrag;if(drag?.id!==event.pointerId)return;
  const point=stageToolPoint(event,canvas);
  if(!drag.moved){pushHistory();drag.moved=true;}
  placeStageToolObject(drag.item,point.x-drag.dx,point.y-drag.dy);paintStageTool();
 });
 const stopStageDrag=event=>{
  if(stageToolDrag?.id!==event.pointerId)return;
  if(stageToolDrag.moved)savePilotTools();
  stageToolDrag=null;updateStageTool();
 };
 canvas.addEventListener('pointerup',stopStageDrag);canvas.addEventListener('pointercancel',stopStageDrag);
 canvas.addEventListener('lostpointercapture',stopStageDrag);
 $('stagePdfDownload').onclick=()=>downloadToolPdf($('stagePdfDownload'),$('stageToolStatus'),buildStageToolPdf,'plan-de-scene');
 checklist.addEventListener('click',event=>{
  if(!event.target.closest('.checklistIconTrigger,.checklistIconGallery'))closeChecklistIconGallery?.();
 });
 $('checklistName').oninput=event=>{pilotTools.checklist.title=event.target.value;savePilotTools();};
 $('checklistAddSection').onclick=()=>{
  const sections=pilotTools.checklist.sections;if(sections.length>=50)return;
  pushHistory();sections.push({title:'',icon:'controle',items:[newChecklistItem()]});
  renderChecklistTool(sections.length-1);savePilotTools();
 };
 initChecklistTemplates();
 $('sequenceSheetDialog').querySelector('.pilotToolClose').onclick=()=>$('sequenceSheetDialog').close();
 $('checklistActZipDownload').onclick=openChecklistZipPicker;
 $('checklistActZipForm').onsubmit=event=>{event.preventDefault();downloadChecklistActSelection();};
 $('checklistActSummaryDownload').onclick=()=>downloadChecklistActSelection(true);
 $('checklistSummaryImport').onclick=()=>$('checklistSummaryFile').click();
 $('checklistDialog').addEventListener('close',()=>{closeChecklistImportPreview();closeChecklistRestorePreview();});
 $('checklistImportPreview').onsubmit=applyChecklistImportPreview;
 $('checklistHistorySelect').onchange=()=>{closeChecklistRestorePreview();renderChecklistHistoryRecord();};
 $('checklistHistoryRestore').onclick=showChecklistRestorePreview;
 $('checklistRestoreCancel').onclick=()=>closeChecklistRestorePreview(true);
 $('checklistRestoreForm').onsubmit=applyChecklistRestore;
 $('checklistHistorySearch').oninput=renderChecklistHistoryRecord;
 $('checklistHistoryManual').onchange=renderChecklistHistoryRecord;
 $('checklistHistoryCsv').onclick=downloadChecklistImportCsv;
 $('checklistImportCancel').onclick=()=>{
  closeChecklistImportPreview(true);setShowText($('checklistToolStatus'),'');
 };
 $('checklistSummaryFile').onchange=event=>{
  const input=event.currentTarget,files=Array.from(input.files);input.value='';
  if(files.length)importChecklistSummaryPdfs(files);
 };
 $('checklistActZipCancel').onclick=()=>closeChecklistZipPicker(true);
 for(const [id,checked] of [['checklistActZipSelectAll',true],['checklistActZipSelectNone',false]]){
  $(id).onclick=()=>{for(const input of checklistZipChoices())input.checked=checked;updateChecklistZipSubmit();};
 }
 $('checklistPdfDownload').onclick=()=>{
  const filter=currentChecklistActFilter();
  const suffix=filter.act?'checklist-'+safeFileName(filter.act.label):'checklist';
  downloadToolPdf($('checklistPdfDownload'),$('checklistToolStatus'),()=>buildChecklistToolPdf(filter),suffix);
 };
}
let checklistRestorePreview=null;
function closeChecklistRestorePreview(restoreFocus=false){
 checklistRestorePreview=null;
 $('checklistRestoreForm').hidden=true;
 $('checklistRestoreRows').replaceChildren();
 if(restoreFocus&&$('checklistDialog').open)$('checklistHistoryRestore').focus();
}
function checklistRestoreStatus(change,item){
 if(change.restored)return tr('Déjà restaurée');
 if(!change.itemId||!change.revision||typeof change.previous!=='boolean')return tr('Import antérieur à la restauration');
 if(!item)return tr('Ligne supprimée');
 if(item.text!==change.text||item.checked!==change.checked||item.checkRevision!==change.revision)return tr('Modifiée depuis l’import');
 return '';
}
function showChecklistRestorePreview(){
 const record=checklistHistoryRecord();
 if(!record||locked)return;
 closeChecklistRestorePreview();closeChecklistImportPreview();
 const list=$('checklistRestoreRows'),button=$('checklistRestoreApply'),entries=[];
 const items=new Map(checklistItems().map(item=>[item.id,item]));
 const update=()=>{button.disabled=!entries.some(entry=>entry.control.checked);};
 for(const change of record.changes){
  const reason=checklistRestoreStatus(change,items.get(change.itemId));
  const row=document.createElement(reason?'div':'label'),text=document.createElement('span'),detail=document.createElement('small');
  row.className='checklistRestoreRow';text.textContent=change.text;
  detail.textContent=[change.section,reason||tr(change.previous?'Cocher':'Décocher')].filter(Boolean).join(' · ');
  text.append(detail);
  if(!reason){
   const control=document.createElement('input');
   control.type='checkbox';control.checked=true;control.onchange=update;
   row.append(control);entries.push({change,control});
  }
  row.append(text);list.append(row);
 }
 checklistRestorePreview={record,epoch:copilotProjectEpoch,entries};
 $('checklistRestoreForm').hidden=false;
 update();
 (entries[0]?.control||$('checklistRestoreCancel')).focus();
}
function applyChecklistRestore(event){
 event.preventDefault();
 const preview=checklistRestorePreview;
 if(!preview||preview.epoch!==copilotProjectEpoch||preview.record!==checklistHistoryRecord()||locked){
  closeChecklistRestorePreview();return;
 }
 const selected=preview.entries.filter(entry=>entry.control.checked);
 if(!selected.length)return;
 const items=new Map(checklistItems().map(item=>[item.id,item]));
 const valid=selected.filter(({change})=>!checklistRestoreStatus(change,items.get(change.itemId)));
 if(valid.length){
  pushHistory();
  for(const {change} of valid){
   setChecklistItemChecked(items.get(change.itemId),change.previous);
   change.restored=true;
  }
  renderChecklistTool();savePilotTools();
 }
 closeChecklistRestorePreview(true);
 const updated=tr('{count} case(s) restaurée(s).',{count:valid.length});
 const skipped=selected.length-valid.length;
 setShowText($('checklistToolStatus'),updated+(skipped?' '+tr('{count} changement(s) récent(s) protégé(s).',{count:skipped}):''));
}
function checklistHistoryRecord(){
 return pilotTools.checklistImportHistory[Number($('checklistHistorySelect').value)];
}
function checklistHistoryProvenance(change){
 if(change.manual)return change.files.length
  ?tr('Choix manuel · PDF proposé {file}',{file:change.files.join(', ')}):tr('Choix manuel');
 return tr('PDF retenu · {file}',{file:change.files.join(', ')});
}
function renderChecklistHistoryRecord(){
 const record=checklistHistoryRecord();
 if(!record)return;
 const checked=record.changes.filter(change=>change.checked).length;
 $('checklistHistoryCounts').textContent=tr('{checked} cochée(s) · {unchecked} décochée(s) · {manual} choix manuel(s)',{
  checked,unchecked:record.changes.length-checked,manual:record.changes.filter(change=>change.manual).length
 });
 $('checklistHistoryFiles').textContent=tr('PDF importés · {files}',{files:record.files.join(', ')});
 $('checklistHistoryOrder').hidden=!record.order.length;
 $('checklistHistoryOrder').textContent=tr('Ordre utilisé · {files}',{files:record.order.join(' → ')});
 const query=checklistTextKey($('checklistHistorySearch').value),manualOnly=$('checklistHistoryManual').checked;
 const rows=$('checklistHistoryRows');
 rows.replaceChildren();
 for(const change of record.changes){
  if(manualOnly&&!change.manual)continue;
  if(query&&!checklistTextKey([change.text,change.section,...change.files].join(' ')).includes(query))continue;
  const row=document.createElement('li'),title=document.createElement('strong'),details=document.createElement('small');
  title.textContent=tr(change.checked?'Cocher':'Décocher')+' · '+change.text;
  details.textContent=[change.section,checklistHistoryProvenance(change),change.restored?tr('Déjà restaurée'):''].filter(Boolean).join(' · ');
  row.append(title,details);rows.append(row);
 }
 $('checklistHistoryEmpty').hidden=rows.children.length>0;
}
function renderChecklistImportHistory(){
 const history=pilotTools.checklistImportHistory,select=$('checklistHistorySelect');
 $('checklistImportHistory').hidden=!history.length;
 const previous=select.value;
 select.replaceChildren();
 history.forEach((record,index)=>{
  const option=document.createElement('option');option.value=String(index);
  option.textContent=new Date(record.at).toLocaleString(S2ALanguage.locale);
  select.append(option);
 });
 select.value=history[Number(previous)]?previous||'0':'0';
 renderChecklistHistoryRecord();
}
function downloadChecklistImportCsv(){
 const record=checklistHistoryRecord();
 if(!record)return;
 const rows=[[tr('Élément de checklist'),tr('Rubrique'),tr('Modification'),tr('Source')]];
 for(const change of record.changes)rows.push([change.text,change.section,tr(change.checked?'Cocher':'Décocher'),checklistHistoryProvenance(change)]);
 const cell=value=>'"'+(/^[\s]*[=+@-]|^[\t\r\n]/.test(value)?"'":'')+value.replace(/"/g,'""')+'"';
 const csv=rows.map(row=>row.map(cell).join(';')).join('\r\n');
 downloadBlob(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}),safeFileName(showTitle.value.trim()||tr('Checklist'))+'-import-checklist.csv');
}
const checklistTemplatesKey='s2a-pilot-checklist-templates';
function checklistItems(){return pilotTools.checklist.sections.flatMap(section=>section.items);}
function pruneSequenceLinks(){
 pilotTools.sequenceSheets=normalizeSequenceSheets(pilotTools.sequenceSheets,pilotTools.checklist);
}
function readChecklistTemplates(){
 try{
  const templates=JSON.parse(localStorage.getItem(checklistTemplatesKey)||'[]');
  return Array.isArray(templates)?templates.filter(item=>typeof item?.id==='string'&&typeof item.name==='string'): [];
 }catch(error){return [];}
}
function writeChecklistTemplates(templates){
 try{localStorage.setItem(checklistTemplatesKey,JSON.stringify(templates));return true;}
 catch(error){return false;}
}
function updateChecklistProgress(element,items,label){
 const named=items.filter(item=>item.text.trim());
 element.hidden=!named.length;
 if(!named.length)return;
 const checked=named.filter(item=>item.checked).length,meter=element.querySelector('progress');
 const count=tr('{done} / {total}',{done:checked,total:named.length});
 meter.max=named.length;meter.value=checked;
 meter.setAttribute('aria-label',label);
 element.querySelector('span').textContent=count;
}
let checklistFilterEpoch=null,checklistFilterActs=[];
function refreshChecklistActFilter(acts){
 const select=$('checklistActFilter');
 const previous=checklistFilterEpoch===copilotProjectEpoch?select.value:'';
 checklistFilterEpoch=copilotProjectEpoch;
 checklistFilterActs=conductType==='manual'?acts:[];
 select.replaceChildren();
 const all=document.createElement('option');
 all.value='';all.textContent=tr('Tous les numéros');select.append(all);
 for(const {id,label} of checklistFilterActs){
  const option=document.createElement('option');
  option.value=id;option.textContent=label;select.append(option);
 }
 select.value=checklistFilterActs.some(act=>act.id===previous)?previous:'';
 $('checklistActFilterField').hidden=!checklistFilterActs.length;
 $('checklistActZipDownload').hidden=!checklistFilterActs.length;
}
function currentChecklistActFilter(){
 const act=checklistFilterEpoch===copilotProjectEpoch&&conductType==='manual'
  ?checklistFilterActs.find(act=>act.id===$('checklistActFilter').value):null;
 return {act,keys:act?checklistActKeys(act):null};
}
function checklistActKeys({preparation}){
 return new Set([...preparation.equipment,...preparation.setup].map(checklistTextKey));
}
function checklistItemMatchesAct(item,keys){
 return !keys||keys.has(checklistTextKey(item.text));
}
function updateChecklistControls(){
 const {keys}=currentChecklistActFilter();
 const items=[],cards=$('checklistSections').children;
 pilotTools.checklist.sections.forEach((section,index)=>{
  const card=cards[index];
  if(!card)return;
  const rows=card.querySelectorAll('.checklistItem'),visible=[];
  section.items.forEach((item,itemIndex)=>{
   const matches=checklistItemMatchesAct(item,keys);
   rows[itemIndex].hidden=!matches;rows[itemIndex].classList.toggle('isChecked',item.checked);
   if(matches)visible.push(item);
  });
  items.push(...visible);
  card.hidden=!!keys&&!visible.length;
  card.querySelector('.checklistAddItem').hidden=!!keys;
  card.querySelector('.checklistSectionHeader .checklistDelete').hidden=!!keys;
  updateChecklistProgress(card.querySelector('.checklistProgress'),visible,section.title.trim()||tr('Rubrique'));
 });
 $('checklistActFilterEmpty').hidden=!keys||items.length>0;
 $('checklistAddSection').hidden=!!keys;
 $('checklistUncheckAll').hidden=!!keys;
 $('checklistUncheckAll').disabled=!items.some(item=>item.checked);
 updateChecklistProgress($('checklistProgress'),items,tr('Avancement de la checklist'));
}
const preparationChecklist=[
 ['Matériel à emporter',['Préparer les accessoires et costumes','Vérifier le microphone et la télécommande','Emporter les câbles et adaptateurs audio']],
 ['Installation sur place',['Positionner les accessoires','Brancher la sonorisation et vérifier le retour','Connecter la télécommande et tester les déclenchements']],
 ['Vérifications avant spectacle',['Vérifier les médias hors connexion','Vérifier les batteries','Contrôler la sortie et le niveau audio','Contrôler les cues et tester le GO']]
];
function checklistTextKey(value){return value.trim().replace(/\s+/g,' ').toLowerCase();}
function checklistTranslationKeys(text){
 return new Set([text,...Object.values(window.S2ATranslations[text]||{})].map(checklistTextKey));
}
function mergePreparationChecklist(groups,{translate=false,empty,done,source}){
 const sections=pilotTools.checklist.sections;
 // A manually added item may already be checked in a custom section.
 const shared=translate?null:new Set(checklistItems().map(item=>checklistTextKey(item.text)));
 const additions=groups.map(([title,items])=>{
  const titles=checklistTranslationKeys(title);
  const matching=sections.filter(section=>titles.has(checklistTextKey(section.title)));
  const existing=shared||new Set(matching.flatMap(section=>section.items.map(item=>checklistTextKey(item.text))));
  const missing=[];
  for(const item of items){
   const keys=translate?checklistTranslationKeys(item):[checklistTextKey(item)];
   if([...keys].some(key=>existing.has(key)))continue;
   for(const key of keys)existing.add(key);
   missing.push(translate?tr(item):item);
  }
  return {section:matching[0],title,missing};
 }).filter(addition=>addition.missing.length);
 const status=$('checklistToolStatus');
 if(!additions.length){setShowText(status,tr(empty));return;}
 const tooManySections=sections.length+additions.filter(item=>!item.section).length>50;
 const tooManyItems=additions.some(({section,missing})=>(section?.items.length||0)+missing.length>120);
 if(tooManySections||tooManyItems){setShowText(status,tr('La checklist a atteint sa limite de rubriques ou d’éléments.'));return;}
 pushHistory();
 for(const {section,title,missing} of additions){
  const target=section||{title:tr(title),icon:'',items:[]};
  if(!section)sections.push(target);
  for(const text of missing){
   const item=newChecklistItem(text);
   if(source)item.preparationSource=source;
   target.items.push(item);
  }
 }
 renderChecklistTool();savePilotTools();
 setShowText(status,tr(done));
}
function addPreparationChecklist(){
 mergePreparationChecklist(preparationChecklist,{
  translate:true,empty:'Les éléments de préparation sont déjà présents.',done:'Éléments de préparation ajoutés.'
 });
}
function actsForChecklist(){
 if(conductType==='manual')return manualMusics().map((cue,index)=>({
  id:cue.id,label:(index+1)+' · '+cue.name,preparation:normalizeActPreparation(cue.actPreparation)
 }));
 return [{label:showTitle.value.trim()||tr('Numéro visuel'),preparation:normalizeActPreparation(pilotTools.actPreparation)}];
}
function actChecklistUsage(acts){
 const usage=new Map();
 for(const {label,preparation} of acts){
  const keys=new Set([...preparation.equipment,...preparation.setup].map(checklistTextKey));
  for(const key of keys){
   if(!usage.has(key))usage.set(key,[]);
   usage.get(key).push(label);
  }
 }
 return usage;
}
function actChecklistGroups(){
 const preparation=actsForChecklist().map(act=>act.preparation);
 return [
  ['Matériel à emporter',preparation.flatMap(act=>act.equipment)],
  ['Installation sur place',preparation.flatMap(act=>act.setup)]
 ];
}
function preparationChecklistSource(){return conductType==='manual'?'show':'act';}
function requiredActChecklistKeys(){
 return new Set(actChecklistGroups().flatMap(([,items])=>items.map(checklistTextKey)));
}
function pruneGeneratedChecklist(){
 const source=preparationChecklistSource();
 const sections=pilotTools.checklist.sections;
 if(!sections.some(section=>section.items.some(item=>item.preparationSource===source)))return;
 const needed=requiredActChecklistKeys();
 let removed=false;
 for(const section of sections){
  const remaining=section.items.filter(item=>item.preparationSource!==source||needed.has(checklistTextKey(item.text)));
  if(remaining.length===section.items.length)continue;
  section.items=remaining;removed=true;
 }
 if(removed)pruneSequenceLinks();
}
function addActsToChecklist(){
 const groups=actChecklistGroups();
 if(!groups.some(([,items])=>items.length)){
  setShowText($('checklistToolStatus'),tr('Aucun matériel ni aucune consigne renseignés.'));
  return;
 }
 mergePreparationChecklist(groups,{source:preparationChecklistSource(),empty:'La checklist contient déjà les éléments des numéros.',done:'Checklist complétée à partir des numéros.'});
}
const actPreparationDialog=$('actPreparationDialog');
let actPreparationTarget=null;
function openActPreparation(cue=null){
 if(locked||transportPlaying||(cue?!isManualCueEditor(cue):conductType==='manual'))return;
 actPreparationTarget={cue,epoch:copilotProjectEpoch};
 const data=normalizeActPreparation(cue?cue.actPreparation:pilotTools.actPreparation);
 $('actPreparationName').textContent=cue?.name||showTitle.value.trim();
 $('actEquipment').value=data.equipment.join('\n');
 $('actSetup').value=data.setup.join('\n');
 $('actPreparationStatus').textContent='';
 actPreparationDialog.showModal();
}
$('actPreparationOpen').onclick=()=>openActPreparation();
$('actPreparationClose').onclick=()=>actPreparationDialog.close();
$('actPreparationForm').onsubmit=event=>{
 event.preventDefault();
 if(!actPreparationTarget||locked||transportPlaying)return;
 const {cue,epoch}=actPreparationTarget;
 if(epoch!==copilotProjectEpoch||(cue?!cues.includes(cue)||conductType!=='manual':conductType==='manual')){
  actPreparationDialog.close();return;
 }
 const lines=id=>$(id).value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const data={equipment:lines('actEquipment'),setup:lines('actSetup')};
 if(Object.values(data).some(items=>items.length>120||items.some(item=>item.length>240))){
  $('actPreparationStatus').textContent=tr('Maximum : 120 lignes par champ et 240 caractères par ligne.');
  return;
 }
 const previous=normalizeActPreparation(cue?cue.actPreparation:pilotTools.actPreparation);
 if(JSON.stringify(previous)!==JSON.stringify(data)){
  pushHistory();
  if(cue)cue.actPreparation=data;
  else pilotTools.actPreparation=data;
  pruneGeneratedChecklist();
  savePilotTools();
 }
 actPreparationDialog.close();
};
let selectedChecklistTemplate='';
function selectChecklistTemplate(id){
 selectedChecklistTemplate=id;
 for(const card of $('checklistTemplateCards').children){
  card.classList.toggle('isSelected',card.querySelector('input').value===id);
 }
 $('checklistTemplateApply').disabled=!id;
 $('checklistTemplateDelete').disabled=!id;
}
function updateChecklistTemplates(selected=''){
 const cards=$('checklistTemplateCards'),templates=readChecklistTemplates();
 cards.replaceChildren();$('checklistTemplateEmpty').hidden=templates.length>0;
 for(const template of templates){
  const card=document.createElement('label'),radio=document.createElement('input'),info=document.createElement('span');
  const name=document.createElement('strong'),counts=document.createElement('small');
  card.className='checklistTemplateCard';info.className='checklistTemplateInfo';
  radio.type='radio';radio.name='pilot-checklist-template';radio.value=template.id;
  radio.checked=template.id===selected;radio.onchange=()=>selectChecklistTemplate(template.id);
  name.textContent=template.name;
  const sections=Array.isArray(template.data?.sections)?template.data.sections:[];
  const items=sections.reduce((count,section)=>count+(Array.isArray(section?.items)?section.items.length:0),0);
  counts.textContent=tr(sections.length===1?'1 rubrique':'{count} rubriques',{count:sections.length})+' · '+
   tr(items===1?'1 élément':'{count} éléments',{count:items});
  info.append(name,counts);card.append(radio,info);cards.append(card);
 }
 selectChecklistTemplate(templates.some(template=>template.id===selected)?selected:'');
}
function initChecklistTemplates(){
 $('checklistAddPreparation').onclick=addPreparationChecklist;
 $('checklistAddActs').onclick=addActsToChecklist;
 $('checklistActFilter').onchange=updateChecklistControls;
 const status=$('checklistTemplateStatus');
 const say=text=>setShowText(status,tr(text));
 $('checklistTemplateSave').onclick=()=>{
  const name=$('checklistTemplateName').value.trim()||pilotTools.checklist.title.trim();
  if(!name){say('Donnez un nom au modèle.');$('checklistTemplateName').focus();return;}
  const data=normalizeChecklist(pilotTools.checklist,true),templates=readChecklistTemplates();
  data.sections=data.sections.filter(section=>{
   section.items=section.items.filter(item=>item.text.trim());return section.items.length;
  });
  if(!data.sections.length){say('Ajoutez au moins un élément à la checklist.');return;}
  if(templates.some(template=>template.name.toLowerCase()===name.toLowerCase())){say('Un modèle porte déjà ce nom.');return;}
  if(templates.length>=30){say('La bibliothèque contient déjà 30 modèles.');return;}
  const id=uuid();templates.push({id,name,data});
  if(!writeChecklistTemplates(templates)){say('Impossible d’enregistrer les modèles sur cet appareil.');return;}
  $('checklistTemplateName').value='';updateChecklistTemplates(id);say('Modèle enregistré.');
 };
 $('checklistTemplateApply').onclick=()=>{
  const template=readChecklistTemplates().find(item=>item.id===selectedChecklistTemplate);
  if(!template)return;
  const target=pilotTools.checklist,data=normalizeChecklist(normalizeChecklist(template.data,true));
  if(!data.sections.length)return;
  if(target.sections.length+data.sections.length>50){say('Ce modèle dépasse la limite de 50 rubriques.');return;}
  pushHistory();target.sections.push(...data.sections);
  if(!target.title.trim())target.title=data.title||template.name;
  renderChecklistTool();savePilotTools();say('Modèle ajouté à la checklist.');
 };
 $('checklistTemplateDelete').onclick=()=>{
  const template=readChecklistTemplates().find(item=>item.id===selectedChecklistTemplate);
  if(!template||!confirm(tr('Supprimer ce modèle ?')))return;
  if(!writeChecklistTemplates(readChecklistTemplates().filter(item=>item.id!==template.id))){
   say('Impossible d’enregistrer les modèles sur cet appareil.');return;
  }
  updateChecklistTemplates();say('Modèle supprimé.');
 };
 $('checklistUncheckAll').onclick=()=>{
  const checked=checklistItems().filter(item=>item.checked);
  if(!checked.length)return;
  pushHistory();for(const item of checked)setChecklistItemChecked(item,false);
  renderChecklistTool();savePilotTools();setShowText($('checklistToolStatus'),tr('Toutes les cases ont été décochées.'));
 };
}
function sequenceSheetFor(cue,create=false){
 let sheet=pilotTools.sequenceSheets.find(item=>item.cueId===cue.id);
 if(!sheet&&create){sheet={cueId:cue.id,notes:'',itemIds:[]};pilotTools.sequenceSheets.push(sheet);}
 return sheet;
}
function sequenceSheetList(element,lines,empty){
 element.replaceChildren();
 for(const line of lines.length?lines:[tr(empty)]){
  const li=document.createElement('li');li.textContent=line;element.append(li);
 }
}
function renderSequenceChecklist(cue){
 const chosen=new Set(sequenceSheetFor(cue)?.itemIds),linked=$('sequenceSheetLinked'),choices=$('sequenceSheetChoices');
 linked.replaceChildren();choices.replaceChildren();
 for(const section of pilotTools.checklist.sections){
  const items=section.items.filter(item=>item.text.trim());
  if(!items.length)continue;
  const title=section.title.trim()||tr('Rubrique'),fieldset=document.createElement('fieldset'),legend=document.createElement('legend');
  legend.textContent=title;fieldset.append(legend);
  for(const item of items){
   if(chosen.has(item.id)){
    const box=document.createElement('input');box.type='checkbox';box.checked=item.checked;
    box.onchange=()=>{pushHistory();setChecklistItemChecked(item,box.checked);savePilotTools();};
    const row=document.createElement('label');row.append(box,document.createTextNode(item.text));
    row.title=title;linked.append(row);
   }
   const link=document.createElement('input');link.type='checkbox';link.checked=chosen.has(item.id);link.dataset.checklistLink=item.id;
   link.onchange=()=>{
    const enabled=link.checked;pushHistory();
    const sheet=sequenceSheetFor(cue,true);
    if(enabled)sheet.itemIds.push(item.id);
    else sheet.itemIds=sheet.itemIds.filter(id=>id!==item.id);
    renderSequenceChecklist(cue);
    Array.from(choices.querySelectorAll('input')).find(input=>input.dataset.checklistLink===item.id)?.focus({preventScroll:true});
    savePilotTools();
   };
   const row=document.createElement('label');row.append(link,document.createTextNode(item.text));fieldset.append(row);
  }
  choices.append(fieldset);
 }
 if(!linked.childElementCount)linked.textContent=tr('Aucun élément lié.');
 if(!choices.childElementCount)choices.textContent=tr('Ajoutez d’abord des éléments à la checklist.');
}
function openSequenceSheet(cue){
 if(!isManualCueEditor(cue))return;
 window.S2APilotDiagnostics?.step?.('sequence-sheet');
 const children=manualChildren(cue),notes=$('sequenceSheetNotes'),dialog=$('sequenceSheetDialog');
 setShowText($('sequenceCueName'),'Cue '+cueViewNumber(cue)+' - '+cue.name);
 sequenceSheetList($('sequenceSheetChildren'),children.map(child=>
  'Cue '+cueViewNumber(child)+' · +'+fmt(child.relativeTime)+' · '+child.name+' · '+manualCueLabel(child)
 ),'Aucune sous-Cue.');
 const media=[cue,...children].flatMap(owner=>(owner.mediaActions||[]).filter(action=>action.kind==='audio'||action.kind==='video').map(action=>
  'Cue '+cueViewNumber(owner)+' · '+tr(action.kind==='audio'?'AUDIO':'VIDÉO')+' · '+action.name+' · '+fmt(mediaSegmentDuration(action))
 ));
 sequenceSheetList($('sequenceSheetMedia'),media,'Aucun média.');
 notes.value=sequenceSheetFor(cue)?.notes||'';
 let recorded=false;
 notes.onblur=()=>{recorded=false;};
 notes.oninput=()=>{
  if(!recorded){pushHistory();recorded=true;}
  sequenceSheetFor(cue,true).notes=notes.value;savePilotTools();
 };
 $('sequenceSheetLinkPicker').open=false;
 renderSequenceChecklist(cue);dialog.showModal();
}

window.S2APilotDiagnosticContext=()=>{
 const actions=allMediaActions();
 return {ui:locked?'live':'edit',mode:conductType==='manual'?'spectacle':'visual',
  playback:transportPlaying?'playing':(runtimeAudio.size||runtimeVideo||manualPausedAt!==null)?'paused':'stopped',
  output:pilotOutputId?'external':'system',ltc:actions.some(item=>item.action.ltc)?'on':'off',
  cues:cues.length,audio:actions.filter(item=>item.action.kind==='audio').length,
  video:actions.filter(item=>item.action.kind==='video').length};
};
initPilotToolbox();
