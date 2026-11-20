(function(){
'use strict';let lastContent='',lastRows='',state=null,content=null,pulseSample=null;
const $=id=>document.getElementById(id),fmt=t=>{const s=Math.max(0,Math.floor(t||0));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
function make(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function finishProjection(s,c=content){
 if(s.lost||!c||!c.id)return null;
 // Pilot Show displays one imported number: its finish cannot include later QLab roots.
 const duration=Number(c.duration),elapsed=Math.max(0,Number(s.elapsed)||0);
 if(!Number.isFinite(duration)||duration<=0)return {remaining:null};
 const remaining=Math.max(0,duration-elapsed);
 return remaining>0?{remaining}:null;
}
function showFinishProjection(s){
 if(s.lost)return null;
 const roots=s.roots||[],current=roots.findIndex(c=>c.id===s.currentID);
 let first=current;
 if(first<0)first=roots.findIndex(c=>c.id===s.standbyID);
 if(first<0)first=roots.findIndex(c=>c.id===s.selectedID);
 if(first<0)return null;
 let remaining=0;
 for(let i=first;i<roots.length;i++){
  const cue=roots[i];
  // An imported number is one timeline, even when it contains several media.
  if(!cue.pilot&&cue.category!=='pilot'&&!/^(audio|video)$/i.test(cue.kind||''))continue;
  const duration=Number(cue.duration);
  if(!Number.isFinite(duration)||duration<=0)return {remaining:null};
  remaining+=Math.max(0,duration-(i===current?(Number(s.elapsed)||0):0));
 }
 return remaining>0?{remaining}:null;
}
function renderFinish(s){
 const label=$('liveFinishEstimate'),projection=finishProjection(s);label.hidden=!projection;
 if(!projection)return;
 const formatter=new Intl.DateTimeFormat(s.language,{hour:'numeric',minute:'2-digit'}),now=Date.now();
 const format=remaining=>formatter.format(now+remaining*1000);
 let text=projection.remaining===null?(s.labels.finishUnknown||'Fin indéterminée'):(s.labels.finishEstimate||'Fin estimée : {time}').replace('{time}',format(projection.remaining));
 const show=showFinishProjection(s);
 if(show){
  const total=show.remaining===null?(s.labels.showFinishUnknown||'fin probable du spectacle indéterminée'):(s.labels.showFinishEstimate||'fin probable du spectacle : {time}').replace('{time}',format(show.remaining));
  text+=' ('+total+')';
 }
 label.textContent=text;
}
function countdownPulse(now){
 const sample=pulseSample;
 const remaining=sample?Math.max(0,sample.remaining-(sample.running?(now-sample.at)/1000:0)):Infinity;
 const urgent=!!sample?.running&&remaining>0&&remaining<=10;
 document.body.classList.toggle('nextCueUrgent',urgent);
 $('showNextCountdown').classList.toggle('isUrgent',urgent);
 document.body.style.setProperty('--bridge-cue-beat',String(urgent ? .12+.88*(.5+.5*Math.cos(2*Math.PI*remaining)) : 0));
}
function animateCountdown(now){countdownPulse(now);requestAnimationFrame(animateCountdown);}
let typeSelection=null,typesSignature='';
function typeIds(cue,types){return (cue.cueTypeIds||[cue.cueTypeId]).filter(id=>id!=='none'&&types.has(id));}
function updateTypes(s){
 const definitions=content.cueTypes||[],key=JSON.stringify(definitions),filter=$('cueTypeFilter');filter.hidden=!definitions.length;
 $('cueTypeFilterLabel').textContent=s.labels.filterCues||'Filtrer les Cues';$('cueTypeAll').textContent=s.labels.allCues||'Tout afficher';
 if(key===typesSignature)return;typesSignature=key;$('cueTypeChoices').replaceChildren();
 if(typeSelection&&!definitions.some(type=>typeSelection.has(type.id)))typeSelection=null;
 for(const type of definitions){const label=make('label'),input=make('input');input.type='checkbox';input.value=type.id;input.checked=!typeSelection||typeSelection.has(type.id);const text=make('span','',type.name);text.style.color=type.color;
  input.onchange=()=>{const ids=[...$('cueTypeChoices').querySelectorAll('input:checked')].map(x=>x.value);typeSelection=ids.length===definitions.length?null:new Set(ids);lastRows='';lastContent='';render(state,null);};label.append(input,text);$('cueTypeChoices').append(label);}
}
$('cueTypeAll').onclick=()=>{typeSelection=null;typesSignature='';lastRows='';lastContent='';render(state,null);};
function descriptionLines(cue,types){
 const ids=typeIds(cue,types).filter(id=>!typeSelection||typeSelection.has(id));
 if(cue.typeDescriptions&&ids.length)return ids.map(id=>({id,text:cue.typeDescriptions[id]||''})).filter(line=>line.text.trim());
 return cue.description?.trim()?[{id:ids.length===1?ids[0]:'none',text:cue.description}]:[];
}
function render(s,c){
 state=s;if(c)content=c;if(!content)return;renderFinish(s);updateTypes(s);
 document.documentElement.lang=s.language;document.body.classList.add('showLayoutIceman');document.body.classList.toggle('manualConduct',!!content.manual);
 const allCues=content.cues||[],types=new Map((content.cueTypes||[]).map(type=>[type.id,type]));
 const cues=typeSelection?allCues.filter(cue=>{const ids=typeIds(cue,types);return ids.length?ids.some(id=>typeSelection.has(id)):typeSelection.has('none');}):allCues;
 const t=s.elapsed,d=content.duration||0;let actual=-1;
 for(let i=0;i<allCues.length;i++)if(Number.isFinite(allCues[i].time)&&allCues[i].time<=t+.0001)actual=i;
 const active=cues.findIndex(cue=>cue.id===allCues[actual]?.id);
 const next=content.generic?(cues[active+1]||null):(cues.find(cue=>Number.isFinite(cue.time)&&cue.time>t+.0001)||null);
 const countdown=!content.generic&&(!content.manual||s.running)&&next?Math.max(0,next.time-t):null;
 pulseSample=countdown===null?null:{remaining:countdown,at:performance.now(),running:s.running&&!s.lost};countdownPulse(performance.now());
 document.body.classList.toggle('lost',s.lost);$('title').textContent=content.title||s.labels.wait;$('clock').textContent=fmt(t);$('duration').textContent=d?'/ '+fmt(d):'';$('progress').style.width=(d?Math.min(100,t/d*100):0)+'%';
 $('showNextCountdown').hidden=!!content.generic||(content.manual&&(!s.running||!next))||!next;
 document.querySelector('.showCountdownLabel').textContent=s.labels.countdown;document.querySelector('.showCountdownClock').textContent=countdown===null?'--:--':fmt(Math.ceil(countdown));
 $('standbyNotice').textContent=content.generic?s.labels.native:content.manual&&!s.running?s.status:'';
 const start=active>=0?active:next?Math.max(0,cues.indexOf(next)):Math.max(0,cues.length-5);
 const key=JSON.stringify([content,allCues[actual]?.id,next?.id,s.language,typeSelection?[...typeSelection]:null]);
 if(key!==lastRows){
  lastRows=key;const host=$('showCueOverviewRows');document.querySelector('.showTransportHeader').append($('showNextCountdown'));host.replaceChildren();
  for(let i=start;i<Math.min(cues.length,start+5);i++){
   const cue=cues[i],isActive=i===active,isNext=cue.id===next?.id,row=make('div','showOverviewRow'+(isActive?' isActive':'')+(isNext?' isNext':''));row.dataset.id=cue.id;
   row.append(make('span','overviewNumber',cue.number||String(allCues.indexOf(cue)+1)));if(isActive)row.setAttribute('aria-current','step');
   const visual=make('div','overviewVisual');
   if(cue.image){const button=make('button');button.type='button';button.setAttribute('aria-label',s.labels.zoom+' — '+cue.name);const img=make('img');img.src=cue.image;img.alt=cue.name;button.append(img);button.onclick=()=>parent.postMessage({type:'s2a-show-zoom',src:cue.image,title:cue.name},'*');visual.append(button);}
   else{visual.classList.add('showOverviewPlaceholder');const logo=make('img','pilotCuePlaceholder');logo.src='pilot-placeholder.png';logo.alt='';visual.append(logo);}
   row.append(visual,make('time','overviewTime',content.generic?(isNext?'GO':''):(cue.time===null?'GO':fmt(cue.time))));
   const text=make('div','overviewContent'),heading=make('div','overviewHeading'),name=make('div','overviewName');
   for(const id of typeIds(cue,types)){const badge=make('span','bridgeTypeBadge','● '+types.get(id).name);badge.style.color=types.get(id).color;name.append(badge);}name.append(cue.name);heading.append(name);
   const edit=make('button','editCue','✎');edit.type='button';edit.disabled=s.editBusy||s.lost;edit.setAttribute('aria-label',(s.labels.edit||'Modifier')+' — '+cue.name);edit.onclick=()=>parent.postMessage({type:'s2a-show-edit',id:cue.id,contentID:content.id},'*');row.append(edit);text.append(heading);
   if(isActive||isNext){const desc=make('div','overviewDescription');for(const line of descriptionLines(cue,types)){const node=make('div','',line.text);if(types.has(line.id))node.style.color=types.get(line.id).color;desc.append(node);}if(desc.hasChildNodes())text.append(desc);}
   row.append(text);if(isNext)row.append(make('span','overviewBeat'));host.append(row);
  }
  if(!cues.length)host.append(make('div','muted',s.labels.noCues||s.labels.wait));document.querySelector('.showCueOverview').classList.toggle('hasHiddenCues',cues.length-start>5);
 }
 if(!content.generic&&next){const nextRow=document.querySelector('.isNext');if(nextRow&&$('showNextCountdown').parentElement!==nextRow)nextRow.append($('showNextCountdown'));}
 const timeline=$('timeline'),signature=JSON.stringify([content.id,cues.map(x=>[x.id,x.time,x.cueTypeIds]),allCues[actual]?.id,typeSelection?[...typeSelection]:null,content.cueTypes]);
 if(signature!==lastContent){lastContent=signature;timeline.querySelectorAll('.marker').forEach(x=>x.remove());
  for(const cue of cues.filter(x=>Number.isFinite(x.time)&&x.time>t)){const dot=make('div','marker'),colors=typeIds(cue,types).map(id=>types.get(id).color).filter(color=>/^#[0-9a-f]{6}$/i.test(color));dot.dataset.id=cue.id;dot.style.left=(d?cue.time/d*100:0)+'%';dot.style.backgroundColor=colors[0]||'#aeb8c6';if(colors.length>1)dot.style.backgroundImage='conic-gradient('+colors.map((color,i)=>color+' '+i/colors.length*100+'% '+(i+1)/colors.length*100+'%').join(',')+')';timeline.append(dot);}
 }
 document.querySelectorAll('.editCue').forEach(button=>button.disabled=!!(s.editBusy||s.lost));const image=document.querySelector('.isActive .overviewVisual img');if(image)image.style.opacity=String(countdown!==null&&countdown<=10?Math.max(0,countdown/10):1);
}
window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='s2a-bridge-state')return;render(e.data.state,e.data.content);});parent.postMessage({type:'s2a-show-ready'},'*');
requestAnimationFrame(animateCountdown);
setInterval(()=>{if(state)renderFinish(state);},1000);
})();
