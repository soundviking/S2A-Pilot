/* On-demand, chromeless tutorial viewer. ES5 for the same browsers as quick help. */
(function(){'use strict';
var layer=document.createElement('div');layer.className='helpVideoOverlay';layer.hidden=true;
var panel=document.createElement('section');panel.className='helpVideoPanel';panel.id='helpVideoDialog';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('tabindex','-1');
var video=document.createElement('video');video.className='helpVideoPlayer';video.controls=true;video.preload='none';video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.setAttribute('tabindex','0');
var close=document.createElement('button');close.type='button';close.className='helpVideoClose';
var status=document.createElement('p');status.className='helpVideoStatus';status.setAttribute('role','status');status.hidden=true;
var retry=document.createElement('button');retry.type='button';retry.className='helpVideoRetry';retry.hidden=true;
panel.appendChild(video);panel.appendChild(close);panel.appendChild(status);panel.appendChild(retry);layer.appendChild(panel);document.body.appendChild(layer);
var opened=false,language='fr',returnFocus=null,priorOverflow='',help=null,priorHelpHidden=null;
function t(key){return window.S2AStrings?S2AStrings.text(key,null,language):key;}
function labels(){panel.setAttribute('aria-label',t('Première prise en main'));video.setAttribute('aria-label',t('Première prise en main'));close.textContent='× '+t('Fermer');retry.textContent=t('Réessayer');}
function failed(){if(!opened)return;status.textContent=t('La vidéo est indisponible. Vérifiez votre connexion puis réessayez.');status.hidden=false;retry.hidden=false;}
function play(){status.hidden=true;retry.hidden=true;video.load();try{var request=video.play();if(request&&request.catch)request.catch(function(){if(opened&&!video.error){status.textContent=t('Appuyez sur Lecture pour démarrer la vidéo.');status.hidden=false;}});}catch(e){failed();}}
function hide(){if(!opened)return;opened=false;video.pause();video.removeAttribute('src');video.load();layer.hidden=true;document.body.style.overflow=priorOverflow;if(help){if(priorHelpHidden===null)help.removeAttribute('aria-hidden');else help.setAttribute('aria-hidden',priorHelpHidden);}if(returnFocus&&document.documentElement.contains(returnFocus))returnFocus.focus();}
function show(lang){if(opened)return;language=/^(fr|en|es|de)$/.test(lang)?lang:'fr';labels();returnFocus=document.activeElement;priorOverflow=document.body.style.overflow;help=document.querySelector('.quickHelpOverlay');priorHelpHidden=help?help.getAttribute('aria-hidden'):null;if(help)help.setAttribute('aria-hidden','true');opened=true;layer.hidden=false;document.body.style.overflow='hidden';close.focus();video.src='assets/tutorials/S2A-Pilot-'+language+'.mp4';play();}
video.addEventListener('error',failed);close.onclick=hide;retry.onclick=play;layer.onclick=function(e){if(e.target===layer)hide();};
document.addEventListener('keydown',function(e){if(!opened)return;e.stopImmediatePropagation();if(e.keyCode===27||e.key==='Escape'){e.preventDefault();hide();return;}if(e.keyCode===9||e.key==='Tab'){var last=retry.hidden?video:retry;if(e.shiftKey&&document.activeElement===close){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();close.focus();}}},true);
window.S2AHelpVideo={open:show,close:hide,isOpen:function(){return opened;}};
})();
