const{chromium,webkit}=require('playwright'),assert=require('node:assert/strict');
(async()=>{for(const engine of[chromium,webkit]){
 const b=await engine.launch({headless:true,...(engine===chromium?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})}),p=await b.newPage({viewport:{width:1024,height:900}});await p.addInitScript(()=>{localStorage.setItem('s2a-quick-help-seen','1');localStorage.setItem('showcue-install-dismissed-at',Date.now()+'')});await p.goto(process.env.S2A_TEST_URL||'http://127.0.0.1:8920/');await p.waitForFunction(()=>window.s2aBootReady&&!S2AStartup.isActive(),null,{polling:100});
 await p.evaluate(async()=>{await loadWorkspace({title:'Répétition — Mode Go',conductType:'manual',cues:[
 {...newBaseCue(),id:'p1',name:'Ouverture',manualKind:'silent',manualDuration:60,time:0},
 {...newBaseCue(),id:'a1',name:'Entrée de l’artiste',parentMusicId:'p1',relativeTime:35,time:35},
 {...newBaseCue(),id:'a2',name:'Ouverture du rideau',parentMusicId:'p1',relativeTime:2,time:2},
 {...newBaseCue(),id:'p2',name:'Deuxième numéro',manualKind:'silent',manualDuration:60,time:30},
 {...newBaseCue(),id:'b1',name:'Changement lumière',parentMusicId:'p2',relativeTime:10,time:40},
 {...newBaseCue(),id:'p3',name:'Final',manualKind:'silent',manualDuration:60,time:100}]});});
 assert.equal(await p.locator('#conductType').innerText(),'Mode Go');
 const editRows=p.locator('#cueList .cueAccordion');
 assert.deepEqual(await editRows.evaluateAll(els=>els.map(el=>el.dataset.cueId)),['p1','a2','a1','p2','b1','p3']);
 assert.deepEqual(await editRows.locator('.cueNumber').evaluateAll(els=>els.map(el=>el.textContent.replace('⠿','').trim())),['CUE 1','CUE 1.1','CUE 1.2','CUE 2','CUE 2.1','CUE 3']);
 await p.locator('#cueList [data-cue-id="a1"] .cueSummaryName').click();assert.equal(await p.locator('#timeline .selectedCueMarker').getAttribute('data-cue-id'),'a1');
 for(const width of[1024,768,390]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await p.setViewportSize({width:1024,height:900});await p.screenshot({path:'/tmp/pilot-go-edit-tree-'+engine.name()+'.png',fullPage:true});
 const beforeSwitch=await p.evaluate(()=>JSON.stringify(cues));
 await p.locator('#conductType').click();assert.equal(await p.locator('#cueList .cueHierarchyKind').count(),0);
 assert.deepEqual(await editRows.evaluateAll(els=>els.map(el=>el.dataset.cueId)),['p1','a2','p2','a1','b1','p3']);
 assert.deepEqual(await editRows.locator('.cueNumber').evaluateAll(els=>els.map(el=>el.textContent.replace('⠿','').trim())),['CUE 1','CUE 2','CUE 3','CUE 4','CUE 5','CUE 6']);
 assert.equal(await p.evaluate(()=>JSON.stringify(cues)),beforeSwitch);
 await p.locator('#conductType').click();await p.locator('#showModeBtn').click();
 const rows=p.locator('.showOverviewRow');assert.deepEqual(await rows.evaluateAll(els=>els.map(e=>e.dataset.cueId)),['p1','a2','a1','p2','b1','p3']);assert.deepEqual(await rows.locator('.overviewNumber').allTextContents(),['1','1.1','1.2','2','2.1','3']);assert.equal(await p.locator('.manualPrincipalCue').count(),3);assert.equal(await p.locator('.showOverviewRow.manualInternalCue').count(),3);
 assert.equal(await p.locator('[data-cue-id="p1"] .overviewKind').textContent(),'Principale · GO');assert.equal(await p.locator('[data-cue-id="a2"] .overviewKind').textContent(),'Sous-Cue');
 await p.locator('.showOverviewRow[data-cue-id="a2"]').click();assert.equal(await p.evaluate(()=>manualArmExplicit),false);assert.equal(await p.evaluate(()=>transportPlaying),false);
 await p.locator('.showOverviewRow[data-cue-id="p2"]').click();assert.equal(await p.evaluate(()=>manualNextMusic().id),'p2');await p.locator('#playBtn').click();await p.waitForFunction(()=>manualCurrentID==='p2'&&!manualPending);await p.locator('#manualPauseBtn').click();
 for(const width of[1024,768,390]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const parent=await p.locator('.showOverviewRow[data-cue-id="p2"]').boundingBox(),child=await p.locator('.showOverviewRow[data-cue-id="b1"]').boundingBox();assert(child.x-parent.x>=(width<540?24:44));}
 await p.setViewportSize({width:1024,height:900});await p.screenshot({path:'/tmp/pilot-go-show-tree-'+engine.name()+'.png',fullPage:true});await p.locator('#restartBtn').click();await p.locator('#editModeBtn').click();await p.locator('#conductType').click();assert.equal(await p.locator('#conductType').innerText(),'Autopilote');await p.locator('#showModeBtn').click();assert.equal(await p.locator('.manualPrincipalCue').count(),0);assert.equal(await p.locator('.overviewKind').count(),0);
 console.log('PASS',engine.name(),'Edit/Show hierarchy, Auto standard numbering, Mode Go label, grouped hierarchy with overlapping times, 1.1 numbering, root-only arming, responsive branches, Autopilot unchanged');await b.close();
}})().catch(e=>{console.error(e);process.exit(1)});
