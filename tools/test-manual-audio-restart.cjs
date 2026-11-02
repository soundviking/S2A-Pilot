const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const compressed=process.env.S2A_RESTART_MP3?Array.from(fs.readFileSync(process.env.S2A_RESTART_MP3)):null;
(async()=>{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const page=await browser.newPage({viewport:{width:1024,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('s2a-quick-help-seen','1');localStorage.setItem('showcue-install-dismissed-at',Date.now()+'')});
 await page.goto(process.env.S2A_TEST_URL||'http://127.0.0.1:8919/');
 await page.waitForFunction(()=>window.s2aBootReady&&!S2AStartup.isActive());
 await page.evaluate(async compressed=>{
  const count=14*8000,bytes=new Uint8Array(44+count*2),d=new DataView(bytes.buffer),str=(o,s)=>[...s].forEach((c,i)=>bytes[o+i]=c.charCodeAt(0));
  str(0,'RIFF');d.setUint32(4,36+count*2,true);str(8,'WAVEfmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,8000,true);d.setUint32(28,16000,true);d.setUint16(32,2,true);d.setUint16(34,16,true);str(36,'data');d.setUint32(40,count*2,true);
  for(let i=0;i<count;i++)d.setInt16(44+i*2,Math.sin(i*2*Math.PI*(i<24000?220:660)/8000)*2000,true);
  const key=await storeAsset(compressed?new File([new Uint8Array(compressed)],'two-tones.mp3',{type:'audio/mpeg'}):new File([bytes],'two-tones.wav',{type:'audio/wav'}));
  await loadWorkspace({conductType:'manual',cues:[
   {...newBaseCue(),id:'A',name:'Music A',mediaActions:[normalizeMediaAction({id:'a',kind:'audio',assetKey:key,name:'two-tones.wav',duration:14,inPoint:1.5,outPoint:12})]},
   {...newBaseCue(),id:'child',name:'Internal Cue',time:1,parentMusicId:'A',relativeTime:1},
   {...newBaseCue(),id:'B',name:'Music B',time:30,mediaActions:[normalizeMediaAction({id:'b',kind:'audio',assetKey:key,name:'two-tones.wav',duration:14,inPoint:.4,outPoint:12})]}
  ]});locked=true;applyLockState();await prepareShowMedia();window.nativeReloads=[];for(const [id,p] of preparedMedia)p.el.addEventListener('emptied',()=>nativeReloads.push(id));
 },compressed);
 await page.locator('#playBtn').click();await page.waitForFunction(()=>manualCurrentID==='A'&&!manualPending);
 await page.waitForTimeout(700);await page.keyboard.press('Escape');await page.waitForFunction(()=>!transportPlaying);
 const oldTime=await page.evaluate(()=>preparedMedia.get('a').el.currentTime);assert(oldTime>3);
 await page.locator('#playBtn').click();await page.waitForFunction(()=>manualCurrentID==='B'&&!manualPending);
 await page.waitForTimeout(700);await page.keyboard.press('Escape');await page.waitForFunction(()=>!transportPlaying);
 // Delay the actual native seek to expose any audible playback of old buffered samples.
 await page.evaluate(()=>{
  const el=preparedMedia.get('a').el,proto=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime'),seeking=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'seeking');
  window.delayedSeek=true;
  Object.defineProperty(el,'currentTime',{configurable:true,get(){return proto.get.call(this)},set(value){setTimeout(()=>{window.delayedSeek=false;delete el.currentTime;delete el.seeking;proto.set.call(el,value)},650)}});
  Object.defineProperty(el,'seeking',{configurable:true,get(){return window.delayedSeek||seeking.get.call(this)}});
 });
 await page.locator('.showOverviewRow[data-cue-id="A"]').click();await page.locator('#playBtn').click();
 await page.waitForTimeout(180);
 const gated=await page.evaluate(()=>({gain:runtimeAudio.get('a').manualGainValue,pending:manualPending,time:runtimeAudio.get('a').el.currentTime,active:getActiveCue()?.id}));
 assert.equal(gated.gain,0);assert.equal(gated.pending,true);assert(gated.time<1.5,JSON.stringify(gated));assert.notEqual(gated.active,'child');
 await page.waitForFunction(()=>!manualPending&&runtimeAudio.get('a')?.manualGainValue===1);
 const restarted=await page.evaluate(()=>({time:runtimeAudio.get('a').el.currentTime,count:runtimeAudio.size,playing:transportPlaying}));
 assert(restarted.time>=1.45&&restarted.time<2,JSON.stringify(restarted));assert.equal(restarted.count,1);assert.equal(restarted.playing,true);
 await page.waitForTimeout(550);await page.locator('.showOverviewRow[data-cue-id="A"]').click();await page.locator('#playBtn').click();await page.waitForFunction(()=>!manualPending);
 assert((await page.evaluate(()=>runtimeAudio.get('a').el.currentTime))<2);assert.equal(await page.evaluate(()=>runtimeAudio.size),1);
 assert((await page.evaluate(()=>nativeReloads.filter(id=>id==='a').length))>=3);await page.locator('#restartBtn').click();assert.equal(await page.evaluate(()=>manualPending),false);assert.deepEqual(errors,[]);
 console.log('PASS',engine.name(),compressed?'MP3':'WAV','A/Escape/B/Escape/A replay; gain stays zero through delayed seek; exact trim start, no premature child, same-track replay and restart');
 await browser.close();
}})().catch(e=>{console.error(e);process.exit(1)});
