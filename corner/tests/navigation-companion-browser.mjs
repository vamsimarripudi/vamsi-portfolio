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
     assert.notEqual(details.toggle,'none','Mobile drawer toggle available '+width);
     await page.locator('[data-corner-rail-toggle]').click();
     const rail=page.locator('#corner-rail-nav');
     await page.waitForFunction(()=>document.querySelector('#corner-rail-nav').getBoundingClientRect().left>=-1);
     assert.equal(await rail.getAttribute('class'), 'category-tabs corner-rail is-open');
     assert.equal(await page.locator('[data-corner-rail-toggle]').getAttribute('aria-expanded'),'true');
     assert.equal(await page.locator('html').evaluate(e=>e.classList.contains('corner-drawer-open')),true);
     const coords=await rail.boundingBox();
     assert.ok(coords&&coords.x>=-1&&coords.x+coords.width<=width+1,'Drawer within screen '+width);
     await page.keyboard.press('Escape');
     assert.equal(await page.locator('[data-corner-rail-toggle]').getAttribute('aria-expanded'),'false');
     assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('corner-drawer-open')),false);
     assert.equal(await page.locator('[data-corner-rail-toggle]').evaluate(e=>e===document.activeElement),true);
   }else{
     assert.equal(details.toggle,'none','Desktop toggle hidden '+width);
     const rail=page.locator('#corner-rail-nav');
     await page.locator('.corner-rail-link').first().hover();
     await page.waitForFunction(()=>document.querySelector('#corner-rail-nav')?.getBoundingClientRect().width>=196);
     const visible=await rail.locator('.corner-rail-label').first().evaluate(e=>getComputedStyle(e).visibility);
     assert.equal(visible,'visible','Hover reveals navigation text');
   }
   if([320,390,1366].includes(width)){
     if(width<=900)await page.locator('[data-corner-rail-toggle]').click();
     await page.screenshot({path:'screenshots/corner-rail-'+width+'.png',fullPage:false,animations:'disabled'});
     if(width<=900)await page.keyboard.press('Escape');
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
   await page.locator('.corner-welcome-card [data-welcome-close]').click().catch(()=>{});
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
 await page.waitForFunction(()=>document.querySelector('[data-orbit-status]')?.textContent!=='Checking the Corner…',{timeout:10000});
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
 assert.deepEqual(errors,[],'No Corner navigation/companion browser errors');
 console.log('PASS floating toy real status, latest story action, Escape and reduced motion');
}finally{await browser.close()}
