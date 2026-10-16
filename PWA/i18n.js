const S2ALanguage=(()=>{
 let language=S2AStrings.language();
 const originals=new WeakMap(),attributes=new WeakMap(),catalog=window.S2ATranslations;
 const protectedContent='script,style,input,textarea,#showTitle,.cueSummaryName,.cueSummaryDescription,.overviewName,.overviewDescription,.overviewTitle,#showTransportTitle,#transportShowTitle,.cueBubbleText,#activeCueName,#activeCueDescription,#nextName,#nextCueDescription,.mediaActionName,.projectMediaBar,#cueDeleteName,#pdfPreviewTitle,#pdfPreviewPages,[data-no-i18n]';
 const reverse=new Map();for(const [key,row] of Object.entries(catalog)){reverse.set(key,key);for(const value of Object.values(row))if(!reverse.has(value))reverse.set(value,key);}
 function tr(text,values){return S2AStrings.text(text,values,language);}
 function translate(value,previous){
  const source=previous&&previous.rendered===value?previous.source:(reverse.get(value.trim())?value.replace(value.trim(),reverse.get(value.trim())):value);
  const key=source.trim(),rendered=Object.prototype.hasOwnProperty.call(catalog,key)?source.replace(key,tr(key)):tr(source);
  return {source,rendered};
 }
 function localize(root=document.body){
  document.documentElement.lang=language;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){const node=walker.currentNode;if(node.parentElement?.closest(protectedContent))continue;const record=translate(node.textContent,originals.get(node));originals.set(node,record);if(node.textContent!==record.rendered)node.textContent=record.rendered;}
  for(const element of root.querySelectorAll('[title],[aria-label],[placeholder]')){
   if(element.closest('.timelineCueBubble,.projectMediaBar,.cueSummaryName,.overviewName,[data-no-i18n]'))continue;
   let map=attributes.get(element);if(!map){map={};attributes.set(element,map);}
   for(const name of ['title','aria-label','placeholder'])if(element.hasAttribute(name)){const record=translate(element.getAttribute(name),map[name]);map[name]=record;element.setAttribute(name,record.rendered);}
  }
  const manifest=document.querySelector('link[rel=manifest]');if(manifest)manifest.href=language==='fr'?'./manifest.webmanifest':`./manifest.${language}.webmanifest`;
  const select=document.getElementById('languageSelect');if(select)select.value=language;
 }
 function setLanguage(next){next=S2AStrings.normalize(next);if(!S2AStrings.supported.includes(next))return;language=next;try{localStorage.setItem('s2a-language',next);}catch{}localize();window.dispatchEvent(new Event('s2a-language-change'));}
 return {tr,localize,setLanguage,get language(){return language;},get locale(){return {fr:'fr-FR',en:'en-GB',es:'es-ES',de:'de-DE'}[language];}};
})();
function tr(text,values){return S2ALanguage.tr(text,values);}
