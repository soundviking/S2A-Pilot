const {chromium}=require(process.env.S2A_PLAYWRIGHT||'playwright');
const assert=require('assert/strict'),path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.S2A_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.nativeMessages=[];window.webkit={messageHandlers:{bridgeShow:{postMessage:x=>nativeMessages.push(x)}}}});
 await page.goto('file://'+path.resolve('S2A-Copilot/build/S2A Pilot Bridge.app/Contents/Resources/Show/index.html'));
 const roots=[['a','audio','Audio'],['v','video','Video'],['p','pilot','Group'],['n','network','Network'],['o','other','Wait']].map(([id,category,kind],i)=>({id,category,kind,name:'Cue '+id,number:String(i+1),running:id==='p',pilot:id==='p'}));
 const state={workspaceID:'test',filters:['audio','video','pilot','network','other'],language:'fr',status:'Lecture',lost:false,elapsed:8,running:true,currentID:'p',selectedID:'p',standbyID:'n',labels:{flow:'Déroulé',filter:'Type de Cue',allTypes:'Tous les types',wait:'En attente',noMatch:'Aucune Cue pour ce filtre.',selectionHidden:'La Cue sélectionnée est masquée par le filtre.',showAll:'Tout afficher'},roots};
 const setFilters=async values=>{if(!await page.locator('#filterMenu').evaluate(x=>x.open))await page.locator('#filterSummary').click();for(const value of ['audio','video','pilot','network','other'])await page.locator('#flowFilter input[value="'+value+'"]').setChecked(values.includes(value));};
 const content={id:'p',title:'Numéro Pilot',duration:100,generic:false,cues:[{id:'1',time:0,name:'Début',description:'Consigne'},{id:'2',time:20,name:'Suite',description:'Suivante'}]};
 const render=(s,c=null)=>page.evaluate(({s,c})=>S2ABridge.render(s,c),{s,c});
 await render(state,content);const frame=page.frames().find(f=>f.url().endsWith('show.html'));await frame.waitForSelector('.isActive');
 assert.equal(await page.locator('header').count(),0);
 assert.equal(await page.locator('.flowItem').count(),5);
 for(const value of ['audio','video','pilot','network','other']){
  await setFilters([value]);
  assert.equal(await page.locator('.flowItem').count(),1);
  assert.equal(await page.locator('.flowItem').getAttribute('data-id'),roots.find(x=>x.category===value).id);
  assert.deepEqual(await page.evaluate(()=>nativeMessages.at(-1)),{type:'filters',values:[value]});
  assert.equal(await frame.locator('.isActive .overviewName').innerText(),'Début');
  assert.equal(await frame.locator('.showCountdownClock').innerText(),'00:12'); // no clock/Show change
 }
 await setFilters(['audio','pilot']);assert.equal(await page.locator('.flowItem').count(),2);assert.deepEqual(await page.locator('.flowItem').evaluateAll(xs=>xs.map(x=>x.dataset.id)),['a','p']);
 await setFilters([]);assert.equal(await page.locator('.flowItem').count(),0);
 assert.ok(await page.locator('#filterNotice').isVisible());
 await page.locator('#showAll').click();assert.equal(await page.locator('.flowItem').count(),5);
 assert.equal(await page.locator('.flowItem.active').getAttribute('data-id'),'p');
 assert.ok(!await page.locator('#filterNotice').isVisible());
 await render({...state,filters:['network'],selectedID:'a',elapsed:9});
 assert.ok(await page.locator('#flowFilter input[value=network]').isChecked());
 assert.ok(await page.locator('#filterNotice').isVisible());
 assert.equal(await page.locator('.active').count(),0);
 await render({...state,filters:['network'],roots:roots.filter(x=>x.id!=='n')});
 assert.equal(await page.locator('.flowItem').count(),0);
 assert.equal(await page.locator('#flow').innerText(),state.labels.noMatch);
 await render({...state,filters:['audio'],workspaceID:'other'});
 assert.ok(await page.locator('#flowFilter input[value=audio]').isChecked());
 // A filter change with the selected cue still visible must re-center it.
 const many=Array.from({length:100},(_,i)=>({id:'x'+i,name:'Cue '+i,number:String(i),category:i%2?'audio':'other',kind:i%2?'Audio':'Wait'}));
 await render({...state,roots:many,selectedID:'x99'});
 await setFilters(['audio']);
 const box=await page.locator('.active').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=850);
 // Filtering never changes the canonical roots used by the editor or dispatches selection/transport.
 assert.ok((await page.evaluate(()=>nativeMessages)).every(x=>x.type==='filters'));
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/s2a-bridge-filters.png'});
 await browser.close();console.log('PASS filters: multiple combined types and empty selection, hidden selection notice, reset, empty state, workspace state, auto-scroll and unchanged Show/clock; no QLab commands');
})().catch(e=>{console.error(e);process.exit(1)});
