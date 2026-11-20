(function(){
'use strict';
let latest=null,content=null,lastFlow='',previousFocus=null;
let editing=null,editPending=null,editFocus=null;
const editTime=document.getElementById('editTime');
const editor=document.getElementById('editor'),editName=document.getElementById('editName'),editDescription=document.getElementById('editDescription');
function notify(message){window.webkit?.messageHandlers.bridgeShow.postMessage(message);}
function parseCueTime(value){
 const text=value.trim().replace(',','.');
 if(!/^(?:\d+:)?\d+(?:\.\d{1,3})?$/.test(text))return null;
 const parts=text.split(':'),seconds=Number(parts.at(-1));
 if(parts.length>1&&seconds>=60)return null;
 const time=(parts.length>1?Number(parts[0])*60:0)+seconds;
 return Number.isFinite(time)&&time>=0&&time<=864000?Math.round(time*1000)/1000:null;
}
function formatCueTime(time){const ms=Math.round(time*1000);return String(Math.floor(ms/60000)).padStart(2,'0')+':'+String(Math.floor(ms/1000)%60).padStart(2,'0')+'.'+String(ms%1000).padStart(3,'0');}
function openEditor(target){
 if(!latest||editor.open||zoom&&!zoom.hidden)return;
 editFocus=document.activeElement;editing={...target,workspaceID:latest.workspaceID};editPending=null;
 const l=latest.labels;document.getElementById('editTitle').textContent=l.editTitle||'Modifier la Cue';
 document.getElementById('editHelp').textContent=target.kind==='pilot'?l.pilotEdit:l.qlabEdit;
 document.getElementById('editNameLabel').textContent=l.name||'Nom';document.getElementById('editDescriptionLabel').textContent=l.description||'Description';
 document.getElementById('editCancel').textContent=l.cancel||'Annuler';document.getElementById('editSave').textContent=l.save||'Enregistrer';
 document.getElementById('editError').textContent='';editName.value=target.name;editDescription.value=target.description;
 document.getElementById('editTimeField').hidden=target.kind!=='pilot';
 document.getElementById('editTimeLabel').textContent=l.cueTime||'Temps du repère';
 document.getElementById('editTimeHelp').textContent=l.cueTimeHelp||'Recale le repère dans Bridge et Copilot. Les médias QLab conservent leur programmation.';
 editTime.value=target.kind==='pilot'?formatCueTime(target.time):'';
 updateEditorControls(false);editor.showModal();editName.focus();
}
function closeEditor(){if(editPending)return;editor.close();editing=null;editFocus?.focus();}
function updateEditorControls(disabled){for(const id of ['editName','editTime','editDescription','editSave','editCancel'])document.getElementById(id).disabled=disabled;}
function openRootEditor(id){const cue=latest.roots.find(x=>x.id===id);if(cue&&!latest.lost)openEditor({kind:'qlab',cueID:id,name:cue.qName??cue.name,description:cue.notes??''});}
function openShowEditor(id,contentID){
 if(!content||contentID!==content.id)return;const cue=content.cues.find(x=>x.id===id);if(!cue)return;
 if(content.generic){openRootEditor(id);return;}
 openEditor({kind:'pilot',groupID:content.id,cueID:id,name:cue.editName??cue.name,description:cue.editDescription??cue.description??'',time:cue.time,duration:content.duration});
}
function updateEditor(state){
 if(!editing)return;
 if(editing.workspaceID!==state.workspaceID){editPending=null;updateEditorControls(false);document.getElementById('editSave').disabled=true;document.getElementById('editError').textContent=state.labels.workspaceChanged;return;}
 const reply=state.editReply;
 if(editPending&&reply?.requestID===editPending){
  editPending=null;updateEditorControls(false);
  if(reply.success){closeEditor();return;}
  document.getElementById('editError').textContent=reply.message;
 }
 if(!editPending){
  const current=editing.kind==='qlab'?state.roots.find(x=>x.id===editing.cueID):content?.id===editing.groupID?content.cues.find(x=>x.id===editing.cueID):null;
  const name=editing.kind==='qlab'?(current?.qName??current?.name):(current?.editName??current?.name);
  const description=editing.kind==='qlab'?(current?.notes??''):(current?.editDescription??current?.description??'');
  const conflict=current&&(name!==editing.name||description!==editing.description||(editing.kind==='pilot'&&Math.abs(current.time-editing.time)>=.0005));
  const unavailable=editing.kind==='qlab'&&(!current||state.lost);
  document.getElementById('editSave').disabled=!!(conflict||unavailable||state.editBusy);
  if(conflict)document.getElementById('editError').textContent=state.labels.changed;
 }
}
document.getElementById('editForm').addEventListener('submit',event=>{
 event.preventDefault();if(!editing||editPending||document.getElementById('editSave').disabled)return;
 const time=editing.kind==='pilot'?(editTime.value===formatCueTime(editing.time)?editing.time:parseCueTime(editTime.value)):null;
 if(editing.kind==='pilot'&&(time===null||Number(editing.duration)>0&&time>Number(editing.duration))){document.getElementById('editError').textContent=latest.labels.invalidTime||'Temps invalide : utilisez un repère entre le début et la fin du numéro.';editTime.focus();return;}
 editPending=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 updateEditorControls(true);document.getElementById('editError').textContent=latest.labels.saving||'Enregistrement…';
 notify({type:'edit',requestID:editPending,workspaceID:editing.workspaceID,kind:editing.kind,cueID:editing.cueID,groupID:editing.groupID??null,
 name:editName.value,description:editDescription.value,expectedName:editing.name,expectedDescription:editing.description,...(editing.kind==='pilot'?{time,expectedTime:editing.time}:{})});
});
document.getElementById('editCancel').onclick=closeEditor;
editor.addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
const frame=document.getElementById('show'),zoom=document.getElementById('zoom');
function send(){if(latest&&frame.contentWindow)frame.contentWindow.postMessage({type:'s2a-bridge-state',state:latest,content},'*');}
function closeZoom(notify=true){if(zoom.hidden)return;zoom.hidden=true;document.querySelector('.workspace').inert=false;zoom.querySelector('img').removeAttribute('src');if(notify)window.webkit?.messageHandlers.bridgeShow.postMessage({type:'zoom',open:false});previousFocus?.focus();}
const flowFilter=document.getElementById('flowFilter'),filterTypes=['audio','video','pilot','network','other'];
function chooseFilters(values){
 if(!latest)return;
 const filters=filterTypes.filter(type=>values.includes(type));
 window.S2ABridge.render({...latest,filters},null);
 notify({type:'filters',values:filters});
}
flowFilter.onchange=()=>chooseFilters([...flowFilter.querySelectorAll('input:checked')].map(input=>input.value));
function showAll(){chooseFilters(filterTypes);document.getElementById('filterSummary').focus();}
document.getElementById('showAll').onclick=showAll;
document.getElementById('allTypes').onclick=showAll;
window.S2ABridge={closeZoom,render(state,newContent){latest=state;if(newContent)content=newContent;document.documentElement.lang=state.language;document.getElementById('status').textContent=state.status;document.getElementById('status').classList.toggle('lost',state.lost);document.getElementById('flowTitle').textContent=state.labels.flow;
 const filters=filterTypes.filter(type=>(state.filters??filterTypes).includes(type)),filter=[...filters].sort().join(',');
 document.getElementById('filterLabel').textContent=state.labels.filter||'Type de Cue';
 const optionLabels={audio:state.labels.audio||'Audio',video:state.labels.video||'Vidéo',pilot:'S2A Pilot',network:'Network',other:state.labels.other||'Autres'};
 for(const input of flowFilter.querySelectorAll('input')){input.checked=filters.includes(input.value);input.nextElementSibling.textContent=optionLabels[input.value];}
 document.getElementById('filterSummary').textContent=filters.length===filterTypes.length?(state.labels.allTypes||'Tous les types'):filters.length?filters.map(type=>optionLabels[type]).join(', '):(state.labels.noTypes||'Aucun type sélectionné');
 document.getElementById('allTypes').textContent=state.labels.showAll||'Tout afficher';
 const visible=state.roots.filter(item=>filters.length===filterTypes.length||filters.includes(item.category));
 const focusID=[state.currentID,state.standbyID,state.selectedID].find(id=>state.roots.some(item=>item.id===id))||'';
 const hiddenSelection=!!focusID&&!visible.some(item=>item.id===focusID);
 const notice=document.getElementById('filterNotice');notice.hidden=!hiddenSelection;
 notice.querySelector('span').textContent=state.labels.selectionHidden||'La Cue sélectionnée est masquée par le filtre.';
 document.getElementById('showAll').textContent=state.labels.showAll||'Tout afficher';
 const key=JSON.stringify([visible,focusID,state.lost,state.editBusy,filter,state.language]);
 if(key!==lastFlow){
  lastFlow=key;const host=document.getElementById('flow');if(host.dataset.filter!==filter){delete host.dataset.follow;host.dataset.filter=filter;}const focused=document.activeElement?.dataset?.id;host.replaceChildren();
  for(const item of visible){
   const row=document.createElement('button');row.type='button';row.disabled=state.lost;
   const selected=item.id===focusID;
   row.className='flowItem'+(selected?' active':'')+(item.paused?' paused':'');row.dataset.id=item.id;
   row.setAttribute('aria-pressed',String(selected));
   const kind=document.createElement('div');kind.className='kind';kind.textContent=item.pilot?'S2A Pilot':item.kind;
   const title=document.createElement('div');title.className='rowTitle';
   if(item.running&&!item.paused){const play=document.createElement('span');play.className='play';play.textContent='▶';play.setAttribute('aria-label',state.labels.playing||'Lecture');title.append(play);}
   const number=document.createElement('span');number.className='number';number.textContent=item.number||'';
   const name=document.createElement('span');name.className='name';name.textContent=item.name;title.append(number,name);row.append(kind,title);
   row.onclick=()=>notify({type:'select',id:item.id});
   const wrapper=document.createElement('div');wrapper.className='flowRow';
   const edit=document.createElement('button');edit.type='button';edit.className='editFlow';edit.textContent='✎';edit.disabled=state.lost||state.editBusy;
   edit.setAttribute('aria-label',(state.labels.edit||'Modifier')+' — '+item.name);edit.onclick=()=>openRootEditor(item.id);
   wrapper.append(row,edit);host.append(wrapper);
   if(focused===item.id)row.focus({preventScroll:true});
  }
  const selected=host.querySelector('.active');if(selected&&host.dataset.follow!==focusID){host.dataset.follow=focusID;selected.scrollIntoView({block:'center',behavior:'instant'});}
  if(!selected)delete host.dataset.follow;
  if(!visible.length)host.textContent=state.roots.length?(state.labels.noMatch||'Aucune Cue pour ce filtre.'):state.labels.wait;
 }
 shareElement('bridgeRemoteAllowedLabel').textContent=state.labels.allowRemote||'Autoriser les télécommandes';
 shareElement('bridgeRemotePinLabel').textContent=state.labels.remoteCode||'Code télécommande';
 shareElement('bridgeRemoteSave').textContent=state.labels.apply||'Appliquer';
 updateEditor(state);send();}};
let confirmedRemotePin='';
const shareElement=id=>document.getElementById(id);
function saveRemoteSettings(){notify({type:'remoteSettings',pin:shareElement('bridgeRemotePin').value,enabled:shareElement('bridgeRemoteEnabled').checked});}
shareElement('bridgeRemoteSave').onclick=saveRemoteSettings;
shareElement('bridgeRemoteEnabled').onchange=saveRemoteSettings;
const shareDialog=shareElement('copilotDialog'),shareLink=shareElement('copilotLink'),shareQR=shareElement('copilotQr');
shareElement('shareBridge').onclick=()=>{shareDialog.showModal();notify({type:'share'});};
for(const [id,type] of Object.entries({copilotStart:'share',copilotCopy:'copyShare',copilotStop:'stopShare',copilotLock:'lockShare',copilotHealth:'healthShare',copilotDiagnostic:'diagnoseShare'})){
 shareElement(id).onclick=()=>notify({type});
}
shareElement('copilotClose').onclick=()=>shareDialog.close();
shareDialog.addEventListener('click',e=>{
 if(e.target!==shareDialog)return;
 const r=shareDialog.getBoundingClientRect();
 if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)shareDialog.close();
});
shareElement('copilotSetup').querySelector('a').onclick=e=>{e.preventDefault();notify({type:'hostingHelp'});};
window.S2ABridge.shareStatus=({message,link,active,remotePin='',remoteEnabled=false,remoteSettingsBusy=false})=>{
 if(remotePin!==confirmedRemotePin){shareElement('bridgeRemotePin').value=remotePin;confirmedRemotePin=remotePin;}
 shareElement('bridgeRemoteEnabled').checked=remoteEnabled;
 for(const id of ['bridgeRemoteSave','bridgeRemoteEnabled','bridgeRemotePin'])shareElement(id).disabled=remoteSettingsBusy||!active;
 const status=shareElement('copilotStatus');status.textContent=message;
 const prefix=['Partage actif','Partage arrêté'].find(text=>message.startsWith(text));
 if(prefix){
  const strong=document.createElement('strong');strong.className=prefix==='Partage actif'?'shareActive':'shareStopped';strong.textContent=prefix;
  status.replaceChildren(strong,message.slice(prefix.length));
 }
 shareElement('copilotSharing').hidden=!active;shareElement('copilotSetup').hidden=active;
 shareElement('shareBridge').classList.toggle('copilotLive',active);
 if(link===shareLink.value)return;
 shareLink.value=link;shareQR.replaceChildren();
 if(link){
  new QRCode(shareQR,{text:link,width:220,height:220,correctLevel:QRCode.CorrectLevel.H});
  const logo=document.createElement('img');logo.className='copilotQrLogo';logo.src='copilot-logo.png';logo.alt='S2A Copilot';shareQR.append(logo);
 }
};
window.S2ABridge.shareMembers=({viewers,locked,now})=>{
 const members=viewers.filter(v=>!Number(v.revoked));
 const connected=v=>now-v.seen<8;
 shareElement('copilotCount').textContent=members.filter(connected).length+' écran(s) connecté(s) · '+members.length+' autorisé(s)';
 shareElement('copilotLock').textContent=locked?'Autoriser de nouveaux écrans':'Fermer les nouvelles connexions';
 const list=shareElement('copilotMembers');list.replaceChildren();
 for(const member of members){
  const row=document.createElement('li'),label=document.createElement('span'),status=document.createElement('span'),button=document.createElement('button');
  let hash=0;for(const char of member.id)hash=(Math.imul(31,hash)+char.charCodeAt(0))>>>0;
  row.style.setProperty('--member-hue',hash%360);
  status.className=connected(member)?'copilotMemberConnected':'copilotMemberDisconnected';
  status.textContent=connected(member)?'connecté':'déconnecté';
  label.append(member.name+' · '+(member.role==='remote'?'Télécommande':member.role==='backstage'?'Backstage':'Régie')+' · ',status);
  button.type='button';button.textContent='Retirer';button.onclick=()=>notify({type:'revokeShare',id:member.id});
  row.append(label,button);list.append(row);
 }
};
frame.addEventListener('load',send);
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;if(event.data?.type==='s2a-show-ready'){send();return;}if(event.data?.type==='s2a-show-edit'){openShowEditor(event.data.id,event.data.contentID);return;}if(event.data?.type==='s2a-show-zoom'&&event.data.src){previousFocus=document.activeElement;zoom.querySelector('img').src=event.data.src;zoom.querySelector('img').alt=event.data.title||'';zoom.querySelector('button').textContent=latest.labels.close;zoom.querySelector('.hint').textContent=latest.labels.zoomBack;zoom.hidden=false;document.querySelector('.workspace').inert=true;zoom.querySelector('button').focus();window.webkit?.messageHandlers.bridgeShow.postMessage({type:'zoom',open:true,src:event.data.src,title:event.data.title||''});}});
zoom.addEventListener('click',()=>closeZoom());document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!zoom.hidden){e.preventDefault();closeZoom();}});
})();
