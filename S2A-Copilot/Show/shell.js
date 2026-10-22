(function(){
'use strict';
let latest=null,content=null,lastFlow='',previousFocus=null;
let editing=null,editPending=null,editFocus=null;
const editor=document.getElementById('editor'),editName=document.getElementById('editName'),editDescription=document.getElementById('editDescription');
function notify(message){window.webkit?.messageHandlers.bridgeShow.postMessage(message);}
function openEditor(target){
 if(!latest||editor.open||zoom&&!zoom.hidden)return;
 editFocus=document.activeElement;editing={...target,workspaceID:latest.workspaceID};editPending=null;
 const l=latest.labels;document.getElementById('editTitle').textContent=l.editTitle||'Modifier la Cue';
 document.getElementById('editHelp').textContent=target.kind==='pilot'?l.pilotEdit:l.qlabEdit;
 document.getElementById('editNameLabel').textContent=l.name||'Nom';document.getElementById('editDescriptionLabel').textContent=l.description||'Description';
 document.getElementById('editCancel').textContent=l.cancel||'Annuler';document.getElementById('editSave').textContent=l.save||'Enregistrer';
 document.getElementById('editError').textContent='';editName.value=target.name;editDescription.value=target.description;
 updateEditorControls(false);editor.showModal();editName.focus();
}
function closeEditor(){if(editPending)return;editor.close();editing=null;editFocus?.focus();}
function updateEditorControls(disabled){for(const id of ['editName','editDescription','editSave','editCancel'])document.getElementById(id).disabled=disabled;}
function openRootEditor(id){const cue=latest.roots.find(x=>x.id===id);if(cue&&!latest.lost)openEditor({kind:'qlab',cueID:id,name:cue.qName??cue.name,description:cue.notes??''});}
function openShowEditor(id,contentID){
 if(!content||contentID!==content.id)return;const cue=content.cues.find(x=>x.id===id);if(!cue)return;
 if(content.generic){openRootEditor(id);return;}
 openEditor({kind:'pilot',groupID:content.id,cueID:id,name:cue.editName??cue.name,description:cue.editDescription??cue.description??''});
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
  const conflict=current&&(name!==editing.name||description!==editing.description);
  const unavailable=editing.kind==='qlab'&&(!current||state.lost);
  document.getElementById('editSave').disabled=!!(conflict||unavailable||state.editBusy);
  if(conflict)document.getElementById('editError').textContent=state.labels.changed;
 }
}
document.getElementById('editForm').addEventListener('submit',event=>{
 event.preventDefault();if(!editing||editPending||document.getElementById('editSave').disabled)return;
 editPending=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 updateEditorControls(true);document.getElementById('editError').textContent=latest.labels.saving||'Enregistrement…';
 notify({type:'edit',requestID:editPending,workspaceID:editing.workspaceID,kind:editing.kind,cueID:editing.cueID,groupID:editing.groupID??null,
 name:editName.value,description:editDescription.value,expectedName:editing.name,expectedDescription:editing.description});
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
 const hiddenSelection=!!state.selectedID&&state.roots.some(item=>item.id===state.selectedID)&&!visible.some(item=>item.id===state.selectedID);
 const notice=document.getElementById('filterNotice');notice.hidden=!hiddenSelection;
 notice.querySelector('span').textContent=state.labels.selectionHidden||'La Cue sélectionnée est masquée par le filtre.';
 document.getElementById('showAll').textContent=state.labels.showAll||'Tout afficher';
 const key=JSON.stringify([visible,state.selectedID,state.lost,state.editBusy,filter,state.language]);
 if(key!==lastFlow){
  lastFlow=key;const host=document.getElementById('flow');if(host.dataset.filter!==filter){delete host.dataset.follow;host.dataset.filter=filter;}const focused=document.activeElement?.dataset?.id;host.replaceChildren();
  for(const item of visible){
   const row=document.createElement('button');row.type='button';row.disabled=state.lost;
   const selected=item.id===state.selectedID;
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
  const selected=host.querySelector('.active');if(selected&&host.dataset.follow!==state.selectedID){host.dataset.follow=state.selectedID;selected.scrollIntoView({block:'center',behavior:'instant'});}
  if(!selected)delete host.dataset.follow;
  if(!visible.length)host.textContent=state.roots.length?(state.labels.noMatch||'Aucune Cue pour ce filtre.'):state.labels.wait;
 }
 updateEditor(state);send();}};
frame.addEventListener('load',send);
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;if(event.data?.type==='s2a-show-ready'){send();return;}if(event.data?.type==='s2a-show-edit'){openShowEditor(event.data.id,event.data.contentID);return;}if(event.data?.type==='s2a-show-zoom'&&event.data.src){previousFocus=document.activeElement;zoom.querySelector('img').src=event.data.src;zoom.querySelector('img').alt=event.data.title||'';zoom.querySelector('button').textContent=latest.labels.close;zoom.querySelector('.hint').textContent=latest.labels.zoomBack;zoom.hidden=false;document.querySelector('.workspace').inert=true;zoom.querySelector('button').focus();window.webkit?.messageHandlers.bridgeShow.postMessage({type:'zoom',open:true,src:event.data.src,title:event.data.title||''});}});
zoom.addEventListener('click',()=>closeZoom());document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!zoom.hidden){e.preventDefault();closeZoom();}});
})();
