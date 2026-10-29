const {chromium}=require(process.env.S2A_PLAYWRIGHT||'playwright');
const assert=require('assert/strict'),path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.S2A_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.nativeMessages=[];window.webkit={messageHandlers:{bridgeShow:{postMessage:x=>nativeMessages.push(x)}}}});
 await page.goto('file://'+path.resolve(process.env.S2A_BRIDGE_SHOW||'S2A-Copilot/build/S2A Pilot Bridge.app/Contents/Resources/Show/index.html'));
 const labels={flow:'Déroulé',wait:'En attente',edit:'Modifier',editTitle:'Modifier la Cue',name:'Nom',description:'Description',save:'Enregistrer',cancel:'Annuler',saving:'Enregistrement…',pilotEdit:'Repère Pilot : titre et description sauvegardés dans Bridge.',qlabEdit:'Nom et notes synchronisés avec QLab.',changed:'La Cue a été modifiée ailleurs.',workspaceChanged:'Le workspace a changé.'};
 const state={workspaceID:'workspace',language:'fr',status:'Lecture',elapsed:10,running:true,lost:false,currentID:'group',selectedID:'group',standbyID:'group',labels,editBusy:false,roots:[{id:'group',number:'2',name:'Titre QLab',qName:'Titre QLab',notes:'Notes\noriginales',kind:'Group',pilot:true,running:true},{id:'audio',number:'3',name:'Musique',qName:'',notes:'',kind:'Audio'}]};
 const content={id:'group',title:'Titre QLab',duration:90,generic:false,cues:[{id:'7',time:0,name:'Repère identique',description:'Consigne',editName:'Repère identique',editDescription:'  Consigne\noriginale  ',image:''},{id:'8',time:20,name:'Repère identique',description:'Deuxième repère',image:''}]};
 const render=(s,c=null)=>page.evaluate(({s,c})=>S2ABridge.render(s,c),{s,c});
 await render(state,content);
 const frame=page.frames().find(f=>f.url().endsWith('show.html'));
 await frame.waitForSelector('.editCue');
 await page.locator('.editFlow').first().click();
 assert.equal(await page.locator('#editName').inputValue(),'Titre QLab');
 assert.equal(await page.locator('#editDescription').inputValue(),'Notes\noriginales');
 assert.equal(await page.evaluate(()=>nativeMessages.length),0); // opening editor does not select or play
 await page.locator('#editName').fill('Nouveau <script> 音');
 await page.locator('#editDescription').fill('Ligne 1\nLigne 2 "été"');
 for(let i=0;i<4;i++)await render({...state,elapsed:11+i});
 assert.equal(await page.locator('#editName').inputValue(),'Nouveau <script> 音');
 assert.equal(await page.locator('#editDescription').inputValue(),'Ligne 1\nLigne 2 "été"');
 await page.locator('#editSave').click();
 let request=await page.evaluate(()=>nativeMessages.at(-1));
 assert.equal(request.type,'edit');assert.equal(request.kind,'qlab');assert.equal(request.cueID,'group');
 assert.equal(request.workspaceID,'workspace');assert.equal(request.expectedName,'Titre QLab');assert.equal(request.expectedDescription,'Notes\noriginales');
 assert.equal(request.description,'Ligne 1\nLigne 2 "été"');
 assert.ok(await page.locator('#editSave').isDisabled());
 await page.keyboard.press('Escape');assert.ok(await page.locator('#editor').isVisible());
 // Failed save retains the draft and allows retry.
 await render({...state,editReply:{requestID:request.requestID,success:false,message:'Connexion perdue'}});
 assert.equal(await page.locator('#editName').inputValue(),request.name);
 assert.equal(await page.locator('#editError').innerText(),'Connexion perdue');
 await page.locator('#editSave').click();
 const retry=await page.evaluate(()=>nativeMessages.at(-1));assert.notEqual(retry.requestID,request.requestID);
 const renamed={...state,roots:[{...state.roots[0],name:request.name,qName:request.name,notes:request.description},state.roots[1]]};
 await render({...renamed,editReply:{requestID:retry.requestID,success:true,message:'Enregistré'}},{...content,title:request.name});
 assert.ok(!await page.locator('#editor').isVisible());
 assert.equal(await page.locator('.flowItem .name').first().innerText(),request.name);
 // An incoming QLab edit is visible without overwriting text being typed.
 await page.locator('.editFlow').first().click();await page.locator('#editName').fill('Mon brouillon');
 await render({...renamed,roots:[{...renamed.roots[0],qName:'Modification externe',name:'Modification externe'},renamed.roots[1]]});
 assert.equal(await page.locator('#editName').inputValue(),'Mon brouillon');
 assert.ok(await page.locator('#editSave').isDisabled());assert.equal(await page.locator('#editError').innerText(),labels.changed);
 await page.locator('#editCancel').click();
 // Pilot cues keep their group/index identity even with identical names.
 await render(state,content);
 await frame.waitForFunction(()=>document.querySelector('.showOverviewRow')?.dataset.id==='7');
 await frame.locator('.editCue').first().click();
 assert.equal(await page.locator('#editDescription').inputValue(),'  Consigne\noriginale  ');
 await page.locator('#editDescription').fill('Consigne sauvegardée\n新');
 await page.locator('#editSave').click();
 request=await page.evaluate(()=>nativeMessages.at(-1));
 assert.equal(request.kind,'pilot');assert.equal(request.groupID,'group');assert.equal(request.cueID,'7');
 assert.equal(request.expectedDescription,'  Consigne\noriginale  ');
 await render({...state,editReply:{requestID:request.requestID,success:true,message:'Enregistré'}},{...content,cues:[{...content.cues[0],description:request.description,editDescription:request.description},content.cues[1]]});
 await frame.waitForFunction(()=>document.querySelector('.overviewDescription').textContent==='Consigne sauvegardée\n新');
 // Changing workspace preserves a copyable draft and blocks saving to the new workspace.
 await frame.locator('.editCue').first().click();await page.locator('#editName').fill('Brouillon à conserver');
 await render({...state,workspaceID:'other'});
 assert.ok(await page.locator('#editor').isVisible());assert.equal(await page.locator('#editName').inputValue(),'Brouillon à conserver');
 assert.ok(await page.locator('#editSave').isDisabled());assert.ok(!await page.locator('#editCancel').isDisabled());
 await page.screenshot({path:'/tmp/s2a-bridge-editor.png'});
 await page.locator('#editCancel').click();
 // No accidental playback or selection commands from any editor operation.
 assert.ok((await page.evaluate(()=>nativeMessages)).every(x=>x.type==='edit'));
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS Bridge editor: explicit save/cancel, multiline text, draft preservation during polling/errors, conflict protection, ID targeting, duplicate names, workspace change and no transport commands');
})().catch(e=>{console.error(e);process.exit(1)});
