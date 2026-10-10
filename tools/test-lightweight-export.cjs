// Run the PHP test server on port 8892. Tests the real PDF/ZIP builder and importer.
const {chromium,webkit}=require(process.env.S2A_PLAYWRIGHT||'playwright'),a=require('assert/strict'),fs=require('fs');
(async()=>{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true,...(engine===chromium&&process.env.S2A_CHROME?{executablePath:process.env.S2A_CHROME}:{})}),context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[],companion=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/companion/'))companion.push(r.url());});
  await page.addInitScript(()=>{localStorage.setItem('s2a-quick-help-seen','1');localStorage.setItem('showcue-install-dismissed-at',String(Date.now()));});
  await page.goto('http://127.0.0.1:8892/');await page.waitForFunction(()=>window.s2aBootReady&&!S2AStartup.isActive());
  const logo='data:image/png;base64,'+fs.readFileSync('PWA/icons/s2a-pilot-192.png').toString('base64');
  await page.evaluate(async logo=>{
   const bytes=new Uint8Array(16044),d=new DataView(bytes.buffer),text=(i,s)=>{for(let j=0;j<s.length;j++)bytes[i+j]=s.charCodeAt(j);};text(0,'RIFF');d.setUint32(4,16036,true);text(8,'WAVEfmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,8000,true);d.setUint32(28,16000,true);d.setUint16(32,2,true);d.setUint16(34,16,true);text(36,'data');d.setUint32(40,16000,true);
   const assetKey=await storeAsset(new File([bytes],'ambiance.wav',{type:'audio/wav'}));showTitle.value='Export réel 1.5.3';setShowLayout('iceman',false);cues=[0,20].map((time,i)=>({...newBaseCue(),time,name:'Tableau '+i,description:'Ouvrir le rideau puis lumière bleue',imageDataUrl:logo,imageName:'repere.png',mediaActions:[normalizeMediaAction({kind:'audio',assetKey,name:'ambiance.wav',mime:'audio/wav',duration:1,size:bytes.length})]}));showDurationOverride=60;renderCues();
   window.savedBlobs=[];window.pickerActivation=[];window.showSaveFilePicker=()=>{pickerActivation.push(navigator.userActivation.isActive);return Promise.resolve({createWritable:async()=>({write:async blob=>savedBlobs.push(blob),close:async()=>{}})});};
  },logo);
  await page.locator('#saveAsBtn').click();await page.waitForFunction(()=>savedBlobs.length===1&&!saveAsBtn.disabled);
  const result=await page.evaluate(async()=>{
   const blob=savedBlobs[0],zip=readStoredZip(await blob.arrayBuffer()),names=[...zip.keys()],manifest=JSON.parse(new TextDecoder().decode(zip.get('conduite.json'))),pdf=names.find(n=>n.endsWith('.pdf'));const info={names,bytes:blob.size,layout:manifest.showLayout,mediaPaths:manifest.cues.map(c=>c.mediaActions[0].path),pdf:new TextDecoder().decode(zip.get(pdf).slice(0,5)),readme:new TextDecoder().decode(zip.get('LISEZ-MOI-Technicien.txt')),activation:pickerActivation};
   await importPackage(new File([blob],'test.s2apilot.zip',{type:'application/zip'}));info.restored={title:showTitle.value,layout:showLayout,cues:cues.map(c=>({time:c.time,description:c.description,image:!!c.imageDataUrl})),assetBytes:(await getAsset(cues[0].mediaActions[0].assetKey)).size};return info;
  });
  a.deepEqual(result.activation,[true]);a.equal(result.layout,'iceman');a.equal(result.pdf,'%PDF-');a.ok(result.bytes<1000000);a.ok(result.names.every(n=>!n.includes('companion')&&!n.includes('.app')));a.equal(result.names.filter(n=>n.startsWith('media/')).length,1);a.equal(result.mediaPaths[0],result.mediaPaths[1]);a.ok(result.readme.includes('github.com'));a.equal(result.restored.layout,'iceman');a.equal(result.restored.title,'Export réel 1.5.3');a.equal(result.restored.assetBytes,16044);a.ok(result.restored.cues.every(c=>c.image&&c.description.startsWith('Ouvrir')));
  // Cancelling the picker must not create or download another package.
  await page.evaluate(()=>{window.showSaveFilePicker=()=>Promise.reject(new DOMException('Cancelled','AbortError'));});await page.locator('#saveAsBtn').click();await page.waitForFunction(()=>!saveAsBtn.disabled);a.equal(await page.evaluate(()=>savedBlobs.length),1);
  // A browser refusing the native picker must still offer a ZIP download.
  await page.evaluate(()=>{window.showSaveFilePicker=()=>Promise.reject(new DOMException('Gesture denied','SecurityError'));});const downloaded=page.waitForEvent('download');await page.locator('#saveAsBtn').click();const file=await downloaded;await file.saveAs('/tmp/s2a-lightweight-export-'+engine.name()+'.zip');a.ok(file.suggestedFilename().endsWith('.s2apilot.zip'));
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(async()=>{const c=await caches.open('s2a-pilot-v1-5-3-app-shell');return !!await c.match('./index.html');});
  const cache=await page.evaluate(async()=>{const keys=await caches.keys();return {keys,urls:(await Promise.all(keys.map(async k=>(await(await caches.open(k)).keys()).map(r=>r.url)))).flat()};});a.ok(cache.urls.every(u=>!u.includes('/companion/')&&!u.includes('copilot-api.php')));
  // WebKit's emulated offline mode also disables in-memory Blob reads; block HTTP instead.
  if(engine===webkit)await context.route('http://127.0.0.1:8892/**',route=>route.abort('internetdisconnected'));else await context.setOffline(true);const offline=await page.evaluate(async()=>{const p=await buildProjectPackage();return [...readStoredZip(await p.blob.arrayBuffer()).keys()];});a.ok(offline.includes('conduite.json'));a.ok(offline.some(n=>n.endsWith('.pdf')));a.deepEqual(errors,[]);a.deepEqual(companion,[]);
  console.log('PASS '+engine.name()+': click activation, real PDF/ZIP, shared audio deduplication, import, cancel, download fallback, offline export, no Bridge or API cache');await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1);});
