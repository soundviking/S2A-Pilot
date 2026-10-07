/* Build once on a computer; Babel is never loaded by the PWA. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const vendor=path.resolve(process.argv[2]||'../compat-vendor'),root=path.resolve(process.argv[3]||'PWA'),out=path.join(root,'compat');
const babel=require(path.join(vendor,'babel.min.js'));fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(path.join(vendor,'core-js-bundle/LICENSE'),path.join(out,'LICENSE-core-js.txt'));
fs.copyFileSync(path.join(vendor,'whatwg-fetch/LICENSE'),path.join(out,'LICENSE-fetch.txt'));
fs.writeFileSync(path.join(out,'polyfills.js'),fs.readFileSync(path.join(vendor,'core-js-bundle/minified.js'),'utf8')+'\n'+fs.readFileSync(path.join(vendor,'whatwg-fetch/dist/fetch.umd.js'),'utf8'));
const hashes={};
for(const file of ['i18n.js','app.js','technical-preview.js']){
 let source=fs.readFileSync(path.join(root,file),'utf8');hashes[file]=crypto.createHash('sha256').update(source).digest('hex');
 if(file==='app.js'){
 source=source.replace("if(startupSaved&&Array.isArray(startupSaved.cues))","if(!startupSaved){const previous=await S2ACompat.legacyProject();if(previous&&Array.isArray(previous.cues)){await importPackage(new File([JSON.stringify({format:'s2a-legacy-project',project:previous})],'compatibility.s2apilot.json',{type:'application/json'}));return;}}if(startupSaved&&Array.isArray(startupSaved.cues))");
 source=source.replace("{blob:file,name:file.name,mime:file.type||'application/octet-stream',size:file.size,lastModified:file.lastModified||0}","{buffer:await file.arrayBuffer(),name:file.name,mime:file.type||'application/octet-stream',size:file.size,lastModified:file.lastModified||0}");
 source=source.replace("try{rt.el.volume=Math.max(0,Math.min(1,v));}catch{}","S2ACompat.setMediaGain(rt.el,v,audioContext);").replace('rt.el.pause();rt.el.volume=1;','rt.el.pause();S2ACompat.setMediaGain(rt.el,1,audioContext);');
 source=source.replace(/function downloadBlob\(blob,name\)\{[^\n]*\}/,"function downloadBlob(blob,name){S2ACompat.download(blob,name);}");
 source=source.replace('ctx=new(window.AudioContext||window.webkitAudioContext)();','ctx=S2ACompat.decoderContext();').replace('await ctx?.close();','/* Shared decode context: no per-file context leak on Safari 9. */').replace("if(audioContext.state==='suspended')","S2ACompat.unlock(audioContext);if(audioContext.state==='suspended')");
 source=source.replaceAll("'./technical-preview.js'","'./compat/technical-preview.es5.js'").replaceAll("'./technical-header-data.js'","'./compat/technical-header-data.js'").replaceAll("'./assets/conduite-header.webp'","'./compat/conduite-header.jpg'");
 }
 const result=babel.transform(source,{presets:[['env',{targets:{ie:'11'},modules:false}]],sourceType:'script',comments:false,compact:true});
 fs.writeFileSync(path.join(out,file.replace('.js','.es5.js')),result.code+'\n');
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');let css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
const vars={bg:'#111318',panel:'#1b1f27',panel2:'#232936',text:'#f4f6f8',muted:'#9da7b5',accent:'#66a8ff',danger:'#ff6b6b',line:'#3b4352',cue:'#ffd166'};
css=css.replace(/var\(--([\w-]+)(?:,([^)]*))?\)/g,(_,key,fallback)=>vars[key]||fallback||'initial');
css=css.replace(/#([a-fA-F0-9]{8})\b/g,(_,v)=>'rgba('+parseInt(v.slice(0,2),16)+','+parseInt(v.slice(2,4),16)+','+parseInt(v.slice(4,6),16)+','+(parseInt(v.slice(6,8),16)/255).toFixed(3)+')');
css+='\n'+fs.readFileSync(path.join(__dirname,'compat-layout.css'),'utf8');fs.writeFileSync(path.join(out,'compat-ui.css'),css);
fs.writeFileSync(path.join(out,'BUILD.json'),JSON.stringify({compiler:'@babel/standalone 7.28.5',polyfills:['core-js 3.46.0','whatwg-fetch 3.6.20'],target:'ES5 / Safari 9',sourceSHA256:hashes},null,2)+'\n');
console.log('Built local compatibility scripts and CSS');
