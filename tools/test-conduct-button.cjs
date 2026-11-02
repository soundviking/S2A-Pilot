const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{for(const engine of[chromium,webkit]){
 const b=await engine.launch({headless:true,...(engine===chromium?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})}),p=await b.newPage({viewport:{width:1024,height:900}});
 await p.addInitScript(()=>{localStorage.setItem('s2a-quick-help-seen','1');localStorage.setItem('showcue-install-dismissed-at',Date.now()+'')});await p.goto(process.env.S2A_TEST_URL||'http://127.0.0.1:8919/');await p.waitForFunction(()=>window.s2aBootReady&&!S2AStartup.isActive());
 const button=p.locator('#conductType');assert.equal(await button.evaluate(el=>el.tagName),'BUTTON');assert.equal(await p.locator('.conductSelector select').count(),0);
 for(const language of['fr','en','es','de']){
  await p.selectOption('#languageSelect',language);assert.equal(await button.getAttribute('aria-pressed'),'false');const automatic=await button.evaluate(el=>getComputedStyle(el).backgroundImage);assert(automatic.includes('gradient'));
  await button.click();assert.equal(await p.evaluate(()=>conductType),'manual');assert.equal(await button.getAttribute('aria-pressed'),'true');await p.waitForFunction(previous=>getComputedStyle(document.getElementById('conductType')).backgroundImage!==previous,automatic);assert.notEqual(await button.evaluate(el=>getComputedStyle(el).backgroundImage),automatic);assert((await button.innerText()).length>0);
  await button.focus();await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>conductType),'autopilot');assert.equal(await p.evaluate(()=>transportPlaying),false);
 }
 await p.selectOption('#languageSelect','fr');assert.equal(await button.innerText(),'Autopilote');await button.click();assert.equal(await button.innerText(),'Mode Go');
 for(const width of[390,768,1024]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.setViewportSize({width:1024,height:900});await p.screenshot({path:'/tmp/pilot-conduct-button-'+engine.name()+'.png',fullPage:true});
 await p.locator('#showModeBtn').click();assert(await button.isDisabled());assert.equal(await p.evaluate(()=>conductType),'manual');console.log('PASS',engine.name(),'single beveled toggle, purple manual theme, four languages, keyboard, responsive layout and Show lock');await b.close();
}})().catch(e=>{console.error(e);process.exit(1)});
