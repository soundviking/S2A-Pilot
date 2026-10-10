'use strict';
const {spawn,execFile}=require('child_process'),net=require('net'),path=require('path');
const children=new Set(),root=__dirname;let closing=false;
function stop(code=0){if(closing)return;closing=true;for(const c of children)c.kill('SIGTERM');setTimeout(()=>process.exit(code),300).unref();}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
function child(command,args,options={}){const c=spawn(command,args,{cwd:root,...options,stdio:['ignore','pipe','pipe']});children.add(c);c.on('error',e=>{console.error('Impossible de démarrer la démo : '+e.message);stop(1);});return c;}
async function port(){return new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
async function wait(c,pattern){return new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Le démarrage a pris trop de temps.')),20000);c.stdout.on('data',d=>{text+=d.toString();const m=text.match(pattern);if(m){clearTimeout(timer);resolve(m);}});c.once('exit',()=>{clearTimeout(timer);reject(Error('La démo s’est arrêtée pendant le démarrage.'));});c.stderr.on('data',d=>console.error(d.toString().trim()));});}
(async()=>{
 const sourcePort=await port(),gatePort=await port();
 const server=child(process.execPath,['server.cjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(sourcePort),PILOT_ROOT:process.env.PILOT_ROOT||path.join(root,'../PWA')}});
 await wait(server,/S2A Pilot \+ Copilot/);
 if(process.env.COPILOT_PUBLIC_TUNNEL!=='1'||process.env.COPILOT_LOCAL_ONLY==='1'){const url='http://127.0.0.1:'+sourcePort+(process.env.ENTRY_PATH||'/');console.log('Copilot local · ordinateur uniquement : '+url);execFile('/usr/bin/open',[url],()=>{});server.on('exit',()=>stop(1));return;}
 const gate=child(process.execPath,['gateway.cjs'],{env:{...process.env,PORT:String(gatePort),UPSTREAM_PORT:String(sourcePort)}});
 const key=(await wait(gate,/DEMO_ENTRY_QUERY=demo=([a-f0-9]+)/))[1];
 console.log('\nCréation de l’adresse HTTPS…');
 const ssh=child('/usr/bin/ssh',['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','IdentityFile=none','-o','StrictHostKeyChecking=accept-new','-o','UserKnownHostsFile='+path.join(process.argv[2]||root,'known-hosts'),'-o','ServerAliveInterval=30','-o','ExitOnForwardFailure=yes','-R','80:127.0.0.1:'+gatePort,'nokey@localhost.run']);
 let output='',opened=false;const timeout=setTimeout(()=>{console.error('Adresse HTTPS indisponible. Vérifiez Internet et relancez la démo.');stop(1);},75000);
 ssh.stdout.on('data',d=>{output=(output+d.toString()).slice(-12000);const m=output.match(/https:\/\/[a-z0-9.-]+\.(?:lhr\.life|lhr\.rocks|localhost\.run)/);if(m&&!opened){opened=true;clearTimeout(timeout);const url=m[0]+(process.env.ENTRY_PATH||'/')+'?demo='+key;console.log('\nDÉMO PRÊTE\n'+url+'\n\n1. Scannez le QR affiché sur le Mac avec l’iPad.\n2. Ouvrez le lien dans Safari.\n3. Cliquez sur Lecture ou Cue suivante sur le Mac.\n\nGardez le Mac éveillé et ces deux pages ouvertes.\nLe Mac et l’iPad doivent partager le même Wi-Fi.\nFermez cette fenêtre pour arrêter la démo.\nLe lien est temporaire et expire au plus tard après quatre heures.');execFile('/usr/bin/open',[url],e=>{if(e)console.log('Ouvrez manuellement le lien ci-dessus.');});}});
 ssh.stderr.on('data',d=>{const text=d.toString();if(/error|refused|denied|resolve|timed out/i.test(text))console.error(text.trim());});
 for(const c of[server,gate,ssh])c.on('exit',()=>{if(!closing){console.error('La connexion de démonstration est fermée. Relancez le lanceur et scannez le nouveau QR.');stop(1);}});
})().catch(e=>{console.error(e.message);stop(1);});
