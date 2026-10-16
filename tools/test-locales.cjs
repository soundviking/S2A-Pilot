// Real-browser checks for language switching, user content, help, PDF and update notes.
const {chromium,webkit}=require(process.env.S2A_PLAYWRIGHT||'playwright'),assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const catalog=JSON.parse(fs.readFileSync('locales/interface.json','utf8')),base=process.env.S2A_TEST_URL||'http://127.0.0.1:8906/';
for(const [key,row] of Object.entries(catalog))for(const lang of ['en','es','de'])assert.equal([...(row.fr||key).matchAll(/\{\w+\}/g)].map(x=>x[0]).sort().join(),[...row[lang].matchAll(/\{\w+\}/g)].map(x=>x[0]).sort().join(),key);
(async()=>{for(const engine of (process.env.S2A_TEST_ENGINES==='chromium'?[chromium]:[chromium,webkit])){
 const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.S2A_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})}),context=await browser.newContext({serviceWorkers:'block',viewport:{width:1180,height:1000}}),p=await context.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{localStorage.setItem('s2a-quick-help-seen','1');localStorage.setItem('showcue-install-dismissed-at',String(Date.now()))});
 await p.route('**/version.json?*',r=>r.fulfill({json:{version:'9.9.9',releaseNotes:{fr:'Résumé FR',en:'Summary EN',es:'Resumen ES',de:'Neuigkeiten DE'}}}));
 await p.goto(base);await p.waitForFunction(()=>window.s2aBootReady&&!S2AStartup.isActive());
 const user='Nouveau';await p.evaluate(()=>{showTitle.value='Nouveau';cues=[0,30,60].map((time,i)=>({...newBaseCue(),id:'test-language-'+i,time,name:i===0?'Lecture':'Nouveau',description:i===0?'Aucune description':'Fermer',mediaActions:[]}));showDurationOverride=90;expandedCueId=cues[0].id;renderCues();});
 for(const lang of ['en','es','de','fr','de','es','en','fr']){
  await p.locator('#languageSelect').selectOption(lang);
  await p.waitForFunction(lang=>document.documentElement.lang===lang,lang);
  assert.equal(await p.locator('#newProjectBtn').innerText(),lang==='fr'?'Nouveau':catalog.Nouveau[lang]);assert.equal(await p.locator('#showTitle').inputValue(),user);
  assert.equal(await p.locator('.cueSummaryName').first().innerText(),'Lecture');assert.equal(await p.locator('.cueDescription').first().inputValue(),'Aucune description');
  assert.match(await p.locator('#playBtn').getAttribute('aria-label'),new RegExp(lang==='fr'?'Lecture':catalog.Lecture[lang]));
  await p.locator('#quickHelpButton').click();for(let step=0;step<4;step++){assert.match(await p.locator('.quickHelpCounter').innerText(),/\/ 4/);if(step<3)await p.locator('.quickHelpFooter button').nth(1).click();}
  assert.ok((await p.locator('.quickHelpManual').getAttribute('href')).endsWith('-'+lang+'.pdf'));assert.equal(await p.locator('.quickHelpManual').getAttribute('hreflang'),lang);
  await p.waitForFunction(()=>Array.from(document.querySelectorAll('.quickHelpLayouts img')).every(i=>i.complete&&i.naturalWidth>0));const images=await p.locator('.quickHelpLayouts img').evaluateAll(images=>images.map(i=>({ok:i.complete&&i.naturalWidth>0,src:i.src})));assert.ok(images.every(i=>i.ok&&i.src.includes('/'+lang+'-')),JSON.stringify(images));
  await p.locator('.quickHelpClose').click();await p.locator('#showModeBtn').click();await p.evaluate(()=>seekTransport(20));
  assert.equal(await p.locator('#transportShowTitle').innerText(),user);assert.equal(await p.locator('.overviewName').first().innerText(),'Lecture');
  assert.equal(await p.locator('.overviewDescription').first().innerText(),'Aucune description');await p.evaluate(()=>setShowLayout('iceman',false));assert.equal(await p.locator('#showCountdownLabel').innerText(),lang==='fr'?'Décompte':catalog['Décompte'][lang]);
  await p.locator('#editModeBtn').click();await p.evaluate(()=>checkAppVersion(true));await p.waitForFunction(()=>!versionCheckRunning);
  assert.equal(await p.locator('.updateSummary').innerText(),{fr:'Résumé FR',en:'Summary EN',es:'Resumen ES',de:'Neuigkeiten DE'}[lang]);
  const pdf=await p.evaluate(async()=>{const r=await buildTechnicalPdfBytes();const text=r.pages.map(p=>p.content).join('\n');return {pages:r.pages.length,text,decoded:[...text.matchAll(/<([A-F0-9]+)> Tj/g)].map(m=>new TextDecoder('windows-1252').decode(Uint8Array.from(m[1].match(/../g),h=>parseInt(h,16)))).join('\n'),title:r.title}});assert.ok(pdf.pages>0);assert.ok(!pdf.text.includes('undefined'));assert.ok(pdf.decoded.includes(lang==='fr'?'CONDUITE TECHNIQUE':catalog['CONDUITE TECHNIQUE'][lang]));assert.ok(pdf.decoded.includes('Nouveau'));
  await p.locator('#showModeBtn').click();await p.setViewportSize({width:393,height:852});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.setViewportSize({width:1180,height:1000});await p.locator('#editModeBtn').click();
 }
 // Restored language and local project survive a reload.
 await p.locator('#languageSelect').selectOption('de');await p.evaluate(()=>writeAutosave());await p.reload();await p.waitForFunction(()=>window.s2aBootReady&&!S2AStartup.isActive());assert.equal(await p.locator('#showTitle').inputValue(),user);assert.equal(await p.locator('#languageSelect').inputValue(),'de');
 assert.deepEqual(errors,[]);console.log('PASS '+engine.name()+': FR/EN/ES/DE switching, untouched user text, help/screenshots/manual link, countdown, PDF, update notes, iPhone width and reload');await browser.close();
}})().catch(e=>{console.error(e);process.exit(1)});
