(function(){
'use strict';
let latest=null,content=null,lastFlow='',previousFocus=null;
const frame=document.getElementById('show'),zoom=document.getElementById('zoom');
function send(){if(latest&&frame.contentWindow)frame.contentWindow.postMessage({type:'s2a-bridge-state',state:latest,content},'*');}
function closeZoom(notify=true){if(zoom.hidden)return;zoom.hidden=true;document.querySelector('.workspace').inert=false;zoom.querySelector('img').removeAttribute('src');if(notify)window.webkit?.messageHandlers.bridgeShow.postMessage({type:'zoom',open:false});previousFocus?.focus();}
window.S2ABridge={closeZoom,render(state,newContent){latest=state;if(newContent)content=newContent;document.documentElement.lang=state.language;document.getElementById('status').textContent=state.status;document.getElementById('status').classList.toggle('lost',state.lost);document.getElementById('flowTitle').textContent=state.labels.flow;
 const key=JSON.stringify([state.roots,state.selectedID,state.lost]);
 if(key!==lastFlow){
  lastFlow=key;const host=document.getElementById('flow'),focused=document.activeElement?.dataset?.id;host.replaceChildren();
  for(const item of state.roots){
   const row=document.createElement('button');row.type='button';row.disabled=state.lost;
   const selected=item.id===state.selectedID;
   row.className='flowItem'+(selected?' active':'')+(item.paused?' paused':'');row.dataset.id=item.id;
   row.setAttribute('aria-pressed',String(selected));
   const kind=document.createElement('div');kind.className='kind';kind.textContent=item.pilot?'S2A Pilot':item.kind;
   const title=document.createElement('div');title.className='rowTitle';
   if(item.running&&!item.paused){const play=document.createElement('span');play.className='play';play.textContent='▶';play.setAttribute('aria-label',state.labels.playing||'Lecture');title.append(play);}
   const number=document.createElement('span');number.className='number';number.textContent=item.number||'';
   const name=document.createElement('span');name.className='name';name.textContent=item.name;title.append(number,name);row.append(kind,title);
   row.onclick=()=>window.webkit?.messageHandlers.bridgeShow.postMessage({type:'select',id:item.id});host.append(row);
   if(focused===item.id)row.focus({preventScroll:true});
  }
  const selected=host.querySelector('.active');if(selected&&host.dataset.follow!==state.selectedID){host.dataset.follow=state.selectedID;selected.scrollIntoView({block:'center',behavior:'instant'});}
  if(!state.selectedID)delete host.dataset.follow;
  if(!state.roots.length)host.textContent=state.labels.wait;
 }
 send();}};
frame.addEventListener('load',send);
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;if(event.data?.type==='s2a-show-ready'){send();return;}if(event.data?.type==='s2a-show-zoom'&&event.data.src){previousFocus=document.activeElement;zoom.querySelector('img').src=event.data.src;zoom.querySelector('img').alt=event.data.title||'';zoom.querySelector('button').textContent=latest.labels.close;zoom.querySelector('.hint').textContent=latest.labels.zoomBack;zoom.hidden=false;document.querySelector('.workspace').inert=true;zoom.querySelector('button').focus();window.webkit?.messageHandlers.bridgeShow.postMessage({type:'zoom',open:true,src:event.data.src,title:event.data.title||''});}});
zoom.addEventListener('click',()=>closeZoom());document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!zoom.hidden){e.preventDefault();closeZoom();}});
})();
