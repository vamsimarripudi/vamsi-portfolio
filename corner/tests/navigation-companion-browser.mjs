/** Browser acceptance for original glass navigation, scrolling and real-data Pulse companion.
 * Runs against an isolated local Corner fixture (no production credentials or data). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

const origin=process.env.CORNER_TEST_ORIGIN||'http://127.0.0.1:4141';
const viewportList=[[320,720],[390,844],[768,1024],[900,820],[901,820],[1366,780],[1920,1080]];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
fs.mkdirSync('screenshots',{recursive:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 page.on('pageerror',error=>errors.push(error.message));
 for(const [width,height] of viewportList){
   await page.setViewportSize({width,height});
   const res=await page.goto(origin+'/corner/',{waitUntil:'domcontentloaded'});
   assert.equal(res.status(),200,'Corner home '+width);
   if(width===320){
     const welcome=page.locator('.corner-welcome-letter');
     await welcome.waitFor({state:'visible',timeout:10000});
     assert.match(await welcome.innerText(),/A little hello, from me to you/);
     assert.match(await welcome.innerText(),/Glad you found your way here/);
     assert.equal(await welcome.locator('[data-letter-explore]').count(),1);
     await welcome.locator('[data-letter-dismiss]').click();
     assert.equal(await page.evaluate(()=>localStorage.getItem('corner-welcome-letter-v2')),'seen');
   }else{
     assert.equal(await page.locator('.corner-welcome-letter').count(),0,'Dismissed welcome does not reappear');
   }
   const vm=page.locator('.brand-mark--vm img.corner-brand-image');
   await vm.waitFor({state:'visible'});
   const logo=await vm.evaluate(async img=>{
     await img.decode();
     const rect=img.getBoundingClientRect();
     return {complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,width:rect.width,height:rect.height,url:img.getAttribute('src')};
   });
   assert.equal(logo.complete,true,'Uploaded VM logo loads on '+width);
   assert.equal(logo.naturalWidth,96,'VM logo renders from the uploaded artwork on '+width);
   assert.ok(logo.width>=28&&logo.width<=64,'VM logo remains compact without distortion '+width);
   assert.ok(Math.abs(logo.width-logo.height)<1,'VM logo retains its square proportions '+width);
   assert.ok(logo.url.includes('/corner/mark.svg?v=vm-20261027'),'Logo is served from Corner, not an external URL');

   const details=await page.evaluate(()=>({
     scrollWidth:document.documentElement.scrollWidth,
     viewport:innerWidth,scrollbar:getComputedStyle(document.documentElement).scrollbarWidth,
     rail:document.querySelector('#corner-rail-nav')?.getBoundingClientRect().toJSON(),
     toggle:getComputedStyle(document.querySelector('[data-corner-rail-toggle]')).display
   }));
   assert.ok(details.scrollWidth<=width+1,'No Corner horizontal overflow '+width+': '+JSON.stringify(details));
   assert.equal(details.scrollbar,'none','Visual scrollbar removed, scrolling preserved '+width);
   assert.ok(details.rail,'A navigation rail exists '+width);
   if(width<=900){
     const toy=page.locator('.corner-orbit-toggle');
     await toy.waitFor({state:'visible'});
     const pulse=await toy.boundingBox(),dock=await page.locator('#corner-rail-nav').boundingBox();
     assert.ok(pulse&&dock&&pulse.y+pulse.height<=dock.y-5,'Pulse is visibly above the bottom dock '+width);
   }
   if(width<=900){
     assert.equal(details.toggle,'none','Mobile uses a bottom dock, not a hamburger '+width);
     const rail=page.locator('#corner-rail-nav');
     const layout=await rail.evaluate(element=>{
       const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
       const pulse=document.querySelector('.corner-orbit-dock')?.getBoundingClientRect();
       return {position:style.position,display:style.display,visibility:style.visibility,
         columns:style.gridTemplateColumns.split(' ').filter(Boolean).length,
         width:rect.width,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
         pulseBottom:pulse?.bottom,pulseTop:pulse?.top};
     });
     assert.equal(layout.position,'fixed','Mobile dock floats above content '+width);
     assert.equal(layout.display,'grid','Six-column mobile dock '+width);
     assert.equal(layout.visibility,'visible','Bottom dock stays visible '+width);
     assert.equal(layout.columns,6,'One icon per category '+width);
     assert.ok(layout.width<=width&&layout.left>=-1&&layout.right<=width+1,'Glass dock inside viewport '+width+' '+JSON.stringify(layout));
     assert.ok(layout.top>height-160&&layout.bottom<=height+1,'Dock is at screen bottom '+width);
     assert.equal(await rail.locator('.corner-rail-link').count(),6,'All category links stay accessible');
     assert.equal(await page.locator('[data-corner-rail-backdrop]').isVisible(),false,'No side drawer backdrop');
     await page.locator('#corner-rail-nav a[href$="/category/builds"]').focus();
     assert.equal(await page.locator('#corner-rail-nav a[href$="/category/builds"]').evaluate(el=>el===document.activeElement),true,'Mobile nav keyboard focus');
   }else{
     assert.equal(details.toggle,'none','Desktop toggle hidden '+width);
     const rail=page.locator('#corner-rail-nav');
     await page.locator('.corner-rail-link').first().hover();
     await page.waitForFunction(()=>document.querySelector('#corner-rail-nav')?.getBoundingClientRect().width>=196);
     const visible=await rail.locator('.corner-rail-label').first().evaluate(e=>getComputedStyle(e).visibility);
     assert.equal(visible,'visible','Hover reveals navigation text');
   }
   if([320,390,1366].includes(width)){
     await page.screenshot({path:'screenshots/corner-rail-'+width+'.png',fullPage:false,animations:'disabled'});
   }
   const avatar=page.locator('[data-corner-profile-toggle]');
   await avatar.click();
   assert.equal(await avatar.getAttribute('aria-expanded'),'true','Profile card opens '+width);
   assert.equal(await page.locator('#corner-profile-card').isVisible(),true,'Profile floating card '+width);
   assert.equal(await page.locator('nav.category-tabs [data-profile-link]').count(),0,'No sidebar profile item');
   await page.keyboard.press('Escape');
   assert.equal(await avatar.getAttribute('aria-expanded'),'false','Profile closes by Escape');
   assert.equal(await avatar.evaluate(e=>e===document.activeElement),true,'Profile focus restored');

   // Opening native auth dialog must freeze background scroll without creating a scrollbar.
   await avatar.click();
   await page.locator('#corner-profile-card [data-auth-open="login"]').click();
   await page.locator('#corner-auth-dialog').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden','Sign-in freezes background scroll');
   await page.locator('[data-auth-close]').click();
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow!=='hidden'),true,'Scroll restored on auth close');
   // The search dialog stays a regular centered pop-up on every viewport.
   const searchTrigger=page.locator('[data-search-open]');
   await searchTrigger.click();
   const searchDialog=page.locator('#search-dialog');
   await searchDialog.waitFor({state:'visible'});
   const search=await searchDialog.evaluate(dialog=>{
     const b=dialog.getBoundingClientRect();
     return {x:b.x,width:b.width,height:b.height,center:b.x+b.width/2,
       backdrop:getComputedStyle(dialog,'::backdrop').backdropFilter,
       paper:getComputedStyle(dialog).backgroundColor};
   });
   assert.ok(Math.abs(search.center-width/2)<=3,'Search dialog is horizontally centered '+width+': '+JSON.stringify(search));
   assert.ok(search.x>=-1&&search.x+search.width<=width+1,'Search dialog fits screen '+width);
   assert.ok(search.height<=height-8,'Search dialog is a normal compact popup '+width);
   assert.equal(search.backdrop,'none','Search overlay does not blur the entire website');
   assert.equal(search.paper,'rgb(255, 255, 255)','Search popup keeps a normal white background');
   await page.keyboard.press('Escape');
   assert.equal(await searchDialog.evaluate(el=>el.open),false,'Escape closes the centered search popup');
   assert.equal(await page.locator('.corner-welcome-letter').count(),0,'Welcome dismissal persists');
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.mouse.wheel(0,500);
   await page.waitForFunction(()=>scrollY>0);
   assert.ok((await page.evaluate(()=>scrollY))>0,'Page still scrolls with scrollbar invisible '+width);
   await page.evaluate(()=>window.scrollTo(0,0));
   console.log('PASS Corner rail, profile, auth, scrollbar and scrolling '+width+'x'+height);
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/corner/',{waitUntil:'domcontentloaded'});
 const toy=page.locator('.corner-orbit-toggle');
 await toy.waitFor();
 assert.equal(await page.locator('#corner-orbit-card').isVisible(),false,'Pulse is unobtrusive when closed');
 await toy.click();
 await page.locator('#corner-orbit-card').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('[data-orbit-status]')?.textContent!=='Checking the Corner…',null,{timeout:10000});
 assert.equal(await toy.getAttribute('aria-expanded'),'true');
 const status=await page.evaluate(async()=>{let r=await fetch('/corner/api/status');return (await r.json()).data?.status?.label});
 const shown=await page.locator('[data-orbit-status]').textContent();
 assert.equal(shown,status||'Keeping a little corner alive.','The toy displays current real backend status');
 assert.ok((await page.locator('.corner-orbit-explainer').textContent()).includes('No AI chat'));
 await page.screenshot({path:'screenshots/corner-pulse-390.png',fullPage:false,animations:'disabled'});
 await page.keyboard.press('Escape');
 assert.equal(await toy.getAttribute('aria-expanded'),'false');
 assert.equal(await toy.evaluate(el=>el===document.activeElement),true);
 const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 reduced.on('pageerror',error=>errors.push(error.message));
 await reduced.goto(origin+'/corner/',{waitUntil:'domcontentloaded'});
 const animation=await reduced.locator('.corner-orbit-toy').evaluate(el=>getComputedStyle(el).animationName);
 assert.equal(animation,'none','No mascot animation for reduced-motion');
 await reduced.close();
 // Policy UX regression: the public Legal & Trust Center stays readable and
 // route-complete at phone, tablet and desktop sizes without accepting consent.
 for(const [width,height] of [[320,720],[390,844],[768,1024],[1366,850]]){
   await page.setViewportSize({width,height});
   for(const route of ['/policies','/privacy','/cookies','/dpdp','/terms','/viewership','/disclaimer','/grievances']){
     const res=await page.goto(origin+'/corner'+route,{waitUntil:'domcontentloaded'});
     assert.equal(res.status(),200,'Legal document route '+route+' at '+width);
     await page.locator('.legal-hero h1').waitFor({state:'visible'});
     const bounds=await page.evaluate(()=>{
       const main=document.querySelector('#content'),article=document.querySelector('.legal-article'),mainRect=main.getBoundingClientRect();
       return {scroll:document.documentElement.scrollWidth,width:innerWidth,mainLeft:mainRect.left,mainRight:mainRect.right,
          articleLeft:article?.getBoundingClientRect().left,articleRight:article?.getBoundingClientRect().right};
     });
     assert.ok(bounds.scroll<=width+1,'Legal document has no horizontal overflow '+route+' '+width+' '+JSON.stringify(bounds));
     assert.ok(bounds.mainLeft>=-1&&bounds.mainRight<=width+2,'Policy shell fits device '+route+' '+width);
     if(route!=='/policies')assert.ok(bounds.articleLeft>=-1&&bounds.articleRight<=width+2,'Legal article fits viewport '+route+' '+width);
     if(route==='/cookies'){
       const table=page.locator('.legal-table-scroll');
       await table.waitFor({state:'visible'});
       assert.equal(await table.locator('tbody tr').count(),8,'Exact cookie/storage inventory remains visible');
       assert.equal(await page.locator('.legal-choice-panel a[href="#reading-preferences"]').count(),1,'Can access optional reader consent');
     }
     if(route==='/privacy'){
       await page.locator('#reading-preferences').waitFor({state:'visible'});
       assert.equal(await page.locator('.reading-preferences [data-reading-choice]').count(),1,'Existing reading consent controls are retained');
     }
     if(width===390&&['/policies','/privacy','/cookies','/terms'].includes(route))
       await page.screenshot({path:'screenshots/legal-'+route.slice(1)+'-390.png',animations:'disabled',fullPage:false});
   }
   console.log('PASS original policy hub, DPDP, rights & consent '+width+'x'+height);
 }
 assert.deepEqual(errors,[],'No Corner navigation/companion browser errors');
 console.log('PASS floating toy real status, latest story action, Escape and reduced motion');
}finally{await browser.close()}
