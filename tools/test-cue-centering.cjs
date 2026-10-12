// Tests Show centering with 200 Cues and Edit selection without interrupting typing.
const {chromium,webkit}=require(process.env.S2A_PLAYWRIGHT||'playwright'),assert=require('assert/strict');
(async()=>{for(const engine of [chromium,webkit]){
 const b=await engine.launch({headless:true,...(engine===chromium?(process.env.S2A_CHROME?{executablePath:process.env.S2A_CHROME}:{}):{})});
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message)});await p.addInitScript(()=>{localStorage.setItem('s2a-quick-help-seen','1');localStorage.setItem('showcue-install-dismissed-at',String(Date.now()))});
 await p.goto((process.env.S2A_TEST_URL||'http://127.0.0.1:8894/'));await p.waitForFunction(()=>window.s2aBootReady&&!S2AStartup.isActive());
 await p.evaluate(()=>{showTitle.value='Essai Iceman — 200 Cues';cues=Array.from({length:200},(_,i)=>({...newBaseCue(),id:'center-'+i,time:i*20,name:'Tableau '+(i+1),description:'Préparer la poursuite et attendre le top lumière du régisseur.'}));showDurationOverride=4000;setShowLayout('iceman',false);renderCues();locked=true;applyLockState()});
 for(const size of [{width:1440,height:1000},{width:768,height:1024},{width:393,height:852}]){
  await p.setViewportSize(size);await p.evaluate(()=>seekTransport(1981));await p.waitForTimeout(180);
  const check=async()=>p.evaluate(()=>{const a=document.querySelector('.isActive').getBoundingClientRect(),n=document.querySelector('.isNext')?.getBoundingClientRect()||a,tl=preflightCard.getBoundingClientRect(),top=(parseFloat(getComputedStyle(preflightCard).top)||0)+tl.height+18,bottom=window.visualViewport?window.visualViewport.offsetTop+window.visualViewport.height:innerHeight;return {top:a.top,bottom:n.bottom,center:(a.top+n.bottom)/2,expected:(top+bottom)/2,available:bottom-top,height:n.bottom-a.top,scroll:scrollY,sticky:tl.top};});
  let r=await check();assert(r.scroll>0);assert(Math.abs(r.sticky)<2);if(r.height<=r.available)assert(Math.abs(r.center-r.expected)<3,JSON.stringify(r));else assert(Math.abs(r.top-(size.height-r.available))<3);
  await p.evaluate(()=>window.scrollBy(0,180));await p.waitForTimeout(50);const manual=await p.evaluate(()=>scrollY);await p.evaluate(()=>{for(let i=0;i<10;i++)updateShowPanels()});await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>scrollY),manual,'Manual scroll should remain possible');
  await p.evaluate(()=>seekTransport(2001));await p.waitForTimeout(150);r=await check();if(r.height<=r.available)assert(Math.abs(r.center-r.expected)<3);
  await p.evaluate(()=>seekTransport(3981));await p.waitForTimeout(120);assert.equal(await p.locator('.isActive .overviewNumber').innerText(),'200');r=await check();if(r.height<=r.available)assert(Math.abs(r.center-r.expected)<3,'Last Cue should also stay centered: '+JSON.stringify(r));
  await p.evaluate(()=>seekTransport(0));await p.waitForTimeout(120);assert.equal(await p.locator('.isActive .overviewNumber').innerText(),'1');
  await p.evaluate(()=>{setShowLayout('maverick',false);seekTransport(1981)});await p.waitForTimeout(120);const count=await p.locator('.showOverviewRow:visible').count();assert.equal(count,5);await p.evaluate(()=>setShowLayout('iceman',false));await p.waitForTimeout(120);assert.equal(await p.locator('.showOverviewRow:visible').count(),200);
  console.log('PASS',engine.name(),size.width,': 200 Cues, centering, manual scroll, next Cue, last/first Cue, layout switch');
 }
 await p.evaluate(()=>{locked=false;applyLockState()});
 for(const size of [{width:1440,height:1000},{width:393,height:852}]){
  await p.setViewportSize(size);const row=p.locator('.cueAccordion[data-cue-id="center-99"]');
  await row.locator('.cueSummary').click();await p.waitForTimeout(150);
  assert.equal(await row.getAttribute('class'),'cueAccordion expanded');
  const position=await row.evaluate(e=>{const r=e.getBoundingClientRect(),v=visualViewport,top=(v?.offsetTop||0)+16,bottom=v?v.offsetTop+v.height:innerHeight,available=bottom-top-16;return{height:r.height,available,center:(r.top+r.bottom)/2,expected:top+available/2,top:r.top,desiredTop:top}});
  if(position.height<=position.available)assert(Math.abs(position.center-position.expected)<3,JSON.stringify(position));else assert(Math.abs(position.top-position.desiredTop)<3,JSON.stringify(position));
  await p.evaluate(()=>scrollBy(0,80));const scroll=await p.evaluate(()=>scrollY);await row.locator('textarea').fill('Nouvelle consigne du régisseur');await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>scrollY),scroll,'Editing text should not trigger automatic recentering');
  await row.locator('.cueSummary').click();await p.waitForTimeout(80);assert.equal(await row.getAttribute('class'),'cueAccordion');
  console.log('PASS',engine.name(),size.width,': Edit selection centered, tall editor aligned, typing does not recenter');
 }
 assert.deepEqual(errors,[]);await b.close();
}})().catch(e=>{console.error(e);process.exit(1)});
