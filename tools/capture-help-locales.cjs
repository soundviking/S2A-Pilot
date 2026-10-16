// Capture the real app in each supported language; no reconstructed interface.
const {chromium}=require(process.env.S2A_PLAYWRIGHT||'playwright'),fs=require('fs'),path=require('path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.S2A_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
for(const lang of ['fr','en','es','de']){
 const context=await browser.newContext({locale:{fr:'fr-FR',en:'en-GB',es:'es-ES',de:'de-DE'}[lang],viewport:{width:1180,height:1250}}),page=await context.newPage();
 page.on('pageerror',e=>console.log('PAGEERROR '+lang+': '+e.message));await page.addInitScript(lang=>{localStorage.setItem('s2a-language',lang);localStorage.setItem('s2a-quick-help-seen','1');localStorage.setItem('showcue-install-dismissed-at',String(Date.now()))},lang);
 await page.goto(process.env.S2A_TEST_URL||'http://127.0.0.1:8906/');await page.waitForFunction(()=>window.s2aBootReady&&!S2AStartup.isActive());
 await page.locator('.projectCard').screenshot({path:`PWA/assets/help/${lang}-create.png`});
 const data=lang==='fr'?['Gala S2A','Ouverture du rideau','Entrée de l’artiste','Ambiance bleue','Salut final','Noir salle','Ouvrir le rideau. Lancer les lumières de face.']:lang==='en'?['S2A Gala','Curtain opening','Artist entrance','Blue lighting','Final bow','House blackout','Open the curtain. Bring up the front lights.']:lang==='es'?['Gala S2A','Apertura del telón','Entrada del artista','Ambiente azul','Saludo final','Oscuro en sala','Abrir el telón. Encender las luces frontales.']:['S2A-Gala','Vorhang auf','Auftritt des Künstlers','Blaues Licht','Schlussapplaus','Saal dunkel','Vorhang öffnen. Frontlicht einschalten.'];
 await page.locator('#globalMediaFile').setInputFiles('../../outputs/Mode-emploi-S2A-Pilot/edition-1.0-complete/medias-demo/Ouverture-du-spectacle.wav');await page.waitForFunction(()=>cues.length===1);
 const photo='data:image/png;base64,'+fs.readFileSync('../../outputs/Mode-emploi-S2A-Pilot/edition-1.0-complete/medias-demo/stage-0.png').toString('base64');
 await page.evaluate(({data,photo})=>{const audio=cues[0].mediaActions;showTitle.value=data[0];cues=[0,35,70,110,180].map((time,i)=>({...newBaseCue(),id:'help-'+i,time,name:data[i+1],description:i<2?data[6]:'',imageDataUrl:photo,mediaActions:i===0?audio:[]}));showDurationOverride=200;expandedCueId=cues[0].id;renderCues()}, {data,photo});
 await page.locator('.cueAccordion.expanded').screenshot({path:`PWA/assets/help/${lang}-cue.png`});await page.locator('#showModeBtn').click();await page.evaluate(()=>seekTransport(80));
 for(const layout of ['maverick','iceman']){await page.evaluate(layout=>setShowLayout(layout,false),layout);await page.locator('.showCueOverview').screenshot({path:`PWA/assets/help/${lang}-${layout}.png`});}
 await page.evaluate(()=>setShowLayout('maverick',false));const tl=await page.locator('.timelineCard').boundingBox(),list=await page.locator('.showCueOverview').boundingBox();await page.screenshot({path:`PWA/assets/help/${lang}-show.png`,clip:{x:tl.x,y:tl.y,width:tl.width,height:list.y+list.height-tl.y}});
 await context.close();console.log('Captured '+lang);
}
await browser.close();const images={};for(const name of fs.readdirSync('PWA/assets/help').sort())if(/^(fr|en|es|de)-(create|cue|show|maverick|iceman)\.png$/.test(name))images[name]='data:image/png;base64,'+fs.readFileSync('PWA/assets/help/'+name).toString('base64');fs.writeFileSync('PWA/help-images.js','/* Offline copies of real help screenshots. */\nwindow.S2AHelpImages='+JSON.stringify(images)+';\n');
})().catch(e=>{console.error(e);process.exit(1)});
