/* Used before startup and by older browsers; no network translation service. */
(function(){'use strict';var supported=['fr','en','es','de'];
function normalize(value){return String(value||'').toLowerCase().split(/[-_]/)[0];}
function language(){var saved;try{saved=localStorage.getItem('s2a-language');}catch(e){}if(supported.indexOf(normalize(saved))>=0)return normalize(saved);var preferred=navigator.languages||[navigator.language];for(var i=0;i<preferred.length;i++){var code=normalize(preferred[i]);if(supported.indexOf(code)>=0)return code;}return 'en';}
function text(key,values,code){var row=window.S2ATranslations[key],template=(row&&row[code||language()]||key);return template.replace(/\{(\w+)\}/g,function(token,name){return values&&values[name]!==undefined?String(values[name]):token;});}
window.S2AStrings={language:language,normalize:normalize,supported:supported,text:text};
})();
