const {chromium}=require(process.env.S2A_PLAYWRIGHT||'playwright');
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.S2A_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1500,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.nativeMessages=[];window.webkit={messageHandlers:{bridgeShow:{postMessage:x=>nativeMessages.push(x)}}}});
 await page.goto('file://'+path.resolve('S2A-Copilot/build/S2A Pilot Bridge.app/Contents/Resources/Show/index.html'));
 const image='data:image/png;base64,'+fs.readFileSync('PWA/icons/s2a-pilot-512.png').toString('base64');
 const state={language:'fr',status:'Lecture',lost:false,elapsed:20,running:true,currentID:'show',standbyID:'final',selectedID:'final',labels:{flow:'Déroulé du spectacle',wait:'En attente',close:'Fermer',zoomBack:'Cliquer pour revenir',zoom:'Agrandir',noVisual:'Aucun visuel',countdown:'Décompte',native:'Cue QLab — prochain GO'},roots:[{id:'intro',number:'1.20',kind:'Audio',name:'Accueil du public',running:true},{id:'show',number:'2',pilot:true,name:'Démonstration Pilot',running:true},{id:'final',number:'',kind:'Audio',name:'Sortie du public',running:false}]};
 const content={id:'show',title:'Démonstration Pilot',duration:200,generic:false,cues:[0,25,55,80,120,150,180].map((time,i)=>({id:String(i),time,name:['Ouverture','Entrée des artistes','Lumière ambre','Solo','Retour ensemble','Salut','Sortie'][i],description:'Consigne de scène '+i,image}))};
 fs.writeFileSync('/tmp/s2a-bridge-show-fixture.json',JSON.stringify({state,content}));
 const render=(s,c=null)=>page.evaluate(({s,c})=>S2ABridge.render(s,c),{s,c});
 await render(state,content);
 const frame=page.frames().find(f=>f.url().endsWith('show.html'));
 await frame.waitForSelector('.isActive');
 assert.equal(await frame.locator('.isActive .overviewName').innerText(),'Ouverture');
 assert.equal(await frame.locator('.isNext .overviewName').innerText(),'Entrée des artistes');
 assert.equal(await frame.locator('.showCountdownClock').innerText(),'00:05');
 assert.equal(await frame.locator('#position').count(),0);
 assert.equal(await page.locator('.flowItem.active .name').innerText(),'Sortie du public');
 assert.equal(await page.locator('.flowItem.active .play').count(),0);
 assert.equal(await page.locator('.flowItem .play').count(),2);
 assert.deepEqual(await page.locator('.number').allTextContents(),['1.20','2','']);
 assert.equal(await page.locator('.standby').count(),0);
 assert.equal(await page.evaluate(()=>nativeMessages.length),0); // reading state sends no selection
 const boxes=await frame.locator('.isActive,.isNext').evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}}));
 assert.ok(boxes[1].x>boxes[0].x);assert.equal(boxes[0].y,boxes[1].y);
 await page.locator('[data-id="show"]').click();
 assert.deepEqual(await page.evaluate(()=>nativeMessages.at(-1)),{type:'select',id:'show'});
 await render({...state,selectedID:'show'});
 assert.equal(await page.locator('.flowItem.active .play').count(),1); // selection and play coexist
 assert.equal(await page.evaluate(()=>nativeMessages.length),1); // QLab echo produces no new command
 await frame.locator('.isActive .overviewVisual button').click();
 await page.locator('#zoom:not([hidden])').waitFor();
 assert.equal(await page.evaluate(()=>nativeMessages.at(-1).open),true);
 assert.equal(await page.locator('#zoom img').getAttribute('src'),image);
 await render({...state,elapsed:30});
 await frame.waitForFunction(()=>document.querySelector('.isActive .overviewName').textContent==='Entrée des artistes');
 assert.equal(await page.locator('#zoom').getAttribute('hidden'),null);
 await page.keyboard.press('Escape');
 assert.ok(await page.locator('#zoom').getAttribute('hidden')!==null);
 assert.equal(await page.evaluate(()=>nativeMessages.at(-1).open),false);
 await render({...state,lost:true,status:'Synchronisation perdue'});
 await page.waitForTimeout(1100);
 assert.equal(await frame.locator('.showCountdownClock').innerText(),'00:05');
 assert.equal(await frame.locator('body.nextCueUrgent').count(),0);
 assert.ok(await page.locator('.flowItem').first().isDisabled());
 await render({...state,elapsed:0});
 await frame.waitForFunction(()=>document.querySelector('.showCountdownClock').textContent==='00:25');
 await render({...state,currentID:'intro'},{id:'intro',title:'Musique QLab',duration:200,generic:true,cues:[{id:'intro',time:0,name:'Accueil',description:'Notes',image:''},{id:'final',time:null,name:'Sortie',description:'Consigne suivante',image:''}]});
 await frame.waitForFunction(()=>document.querySelector('#showNextCountdown').hidden);
 assert.ok(!await frame.locator('#showNextCountdown').isVisible());
 assert.equal(await frame.locator('body.nextCueUrgent').count(),0);
 assert.equal(await frame.locator('body.showLayoutIceman').count(),1);
 assert.equal(await frame.locator('.isNext .showCountdownClock').count(),0);
 const stacked=await frame.locator('.isActive,.isNext').evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}}));
 assert.equal(stacked[0].x,stacked[1].x);assert.ok(stacked[1].y>stacked[0].y);assert.equal(stacked[0].width,stacked[1].width);
 for(const width of [1500,1100,820]){
  await page.setViewportSize({width,height:900});
  const rects=await frame.locator('.isNext .overviewHeading,.isNext .overviewDescription').evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect();return {y:r.y,bottom:r.bottom}}));
  assert.ok(rects[1].y>=rects[0].bottom-1,'Next cue description must not overlap its heading');
  assert.ok(!await frame.locator('#showNextCountdown').isVisible());
  await page.screenshot({path:'/tmp/s2a-bridge-iceman-'+width+'.png'});
 }
 await page.setViewportSize({width:1500,height:950});
 const modeMessages=await page.evaluate(()=>nativeMessages.length);
 await render({...state,currentID:'intro',selectedID:'show',running:false}); // paused generic cue keeps Iceman
 assert.equal(await frame.locator('body.showLayoutIceman').count(),1);
 await render({...state,currentID:'',selectedID:'show',running:false},content); // standby selection cannot switch layouts
 assert.equal(await frame.locator('body.showLayoutIceman').count(),1);
 await render({...state,currentID:'show',lost:true});
 assert.equal(await frame.locator('body.showLayoutIceman').count(),1); // do not switch on an unconfirmed snapshot
 await render(state,content); // actual Pilot playback restores Maverick and its countdown
 await frame.waitForFunction(()=>!document.body.classList.contains('showLayoutIceman'));
 assert.ok(await frame.locator('#showNextCountdown').isVisible());
 assert.equal(await frame.locator('.showCountdownClock').innerText(),'00:05');
 assert.equal(await page.evaluate(()=>nativeMessages.length),modeMessages);
 // A paused cue must not display a green Play.
 await render({...state,roots:state.roots.map(x=>({...x,paused:true}))},content);
 assert.equal(await page.locator('.play').count(),0);
 await render(state);
 for(const width of [1500,1100,820]){
  await page.setViewportSize({width,height:900});
  await page.screenshot({path:'/tmp/s2a-bridge-show-'+width+'.png'});
  assert.ok(await frame.locator('.isActive .overviewName').isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 // Auto-scroll follows selection and never dispatches commands.
 const roots=Array.from({length:80},(_,i)=>({id:'cue-'+i,number:String(i),name:'Cue '+i,kind:'Audio',running:i===10}));
 const before=await page.evaluate(()=>nativeMessages.length);
 await render({...state,roots,selectedID:'cue-79'});
 const selectedBox=await page.locator('.active').boundingBox();
 assert.ok(selectedBox.y>0&&selectedBox.y+selectedBox.height<=900);
 assert.equal(await page.evaluate(()=>nativeMessages.length),before);
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS Bridge Show: automatic QLab Iceman / Pilot Maverick, selection/paused/lost guards, no QLab countdown, responsive Iceman, Maverick, timeline, independent selection/play, real numbers, no selection echo, auto-scroll, Pilot-only countdown, loss, pause/seek, zoom and 3 window widths');
})().catch(e=>{console.error(e);process.exit(1)});
