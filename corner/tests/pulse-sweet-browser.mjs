import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import fixture from './pulse-rabbit-fixture.mjs';
const source=fs.readFileSync(new URL('../public/companion.js',import.meta.url),'utf8');
const css=fixture.css+'\n'+fs.readFileSync(new URL('../public/companion.css',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];fs.mkdirSync('screenshots/pulse-v2',{recursive:true});
async function start(width=390,height=844,permission='granted'){
 const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://sweet.example/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture.html}));
 await page.goto('https://sweet.example/corner/');await page.clock.install();await page.addStyleTag({content:css});
 await page.addScriptTag({content:fixture.boot+"localStorage.setItem('corner-welcome-letter-v2','seen');window.__motionRequests=0;window.DeviceMotionEvent=class extends Event{static async requestPermission(){window.__motionRequests++;return '"+permission+"'}};"});
 await page.addScriptTag({content:source});return page;
}
async function menu(page){await page.evaluate(()=>CornerPulse.open());await page.locator('#corner-orbit-card').waitFor({state:'visible'});}
async function play(page,kind){
 await menu(page);if(!await page.locator('.pulse-play').evaluate(el=>el.open))await page.locator('.pulse-play summary').click();
 await page.locator('[data-pulse-play="'+kind+'"]').click();
 const first={highfive:'A tiny high five',surprise:'Oh! What happened',joke:'pocket',balance:'Steady'}[kind];
 await page.waitForFunction(text=>document.querySelector('.pulse-greeting')?.textContent.includes(text),first);
 await page.clock.runFor(100);
}
async function emit(page,values){for(const value of values){await page.clock.runFor(120);await page.evaluate(v=>{const event=new Event('devicemotion');Object.defineProperty(event,'acceleration',{value:{x:v,y:0,z:0}});window.dispatchEvent(event);},value);}}
try{
 for(const [width,height] of [[320,720],[390,844],[430,932],[768,1024],[1366,850],[1920,1080]]){
  const page=await start(width,height);
  assert.equal(await page.evaluate(()=>CornerPulse.snapshot().release),'sweet-20261027');
  assert.equal(await page.evaluate(()=>__motionRequests),0,'No unsolicited motion permission');
  await play(page,'highfive');await page.clock.runFor(1600);
  assert.match(await page.locator('.pulse-greeting').textContent(),/lovely high five/);
  await page.clock.runFor(2200);
  if(width===390||width===1366)await page.screenshot({path:'screenshots/pulse-v2/sweet-'+width+'.png',animations:'disabled'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.clock.runFor(1000);
  await play(page,'surprise');await page.clock.runFor(1300);
  assert.match(await page.locator('.pulse-greeting').textContent(),/whiskers/);
  assert.equal(await page.locator('.pulse-body').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.close();console.log('PASS sweet play, reduced-motion and viewport '+width);
 }
 const phone=await start();await menu(phone);await phone.locator('.pulse-phone summary').click();await phone.locator('[data-pulse-motion]').click();
 await phone.waitForFunction(()=>CornerPulse.snapshot().motionPermission==='waiting');
 assert.equal(await phone.evaluate(()=>__motionRequests),1);
 await emit(phone,[0,0,0,0]);assert.equal(await phone.evaluate(()=>CornerPulse.snapshot().motionPermission),'active');
 await phone.locator('.corner-orbit-close').click();await phone.waitForFunction(()=>document.querySelector('.corner-orbit-toggle').getAttribute('aria-expanded')==='false');
 await phone.clock.runFor(300);await phone.evaluate(()=>document.activeElement.blur());await phone.mouse.move(0,0);
 await emit(phone,[14,-14,14]);assert.equal(await phone.evaluate(()=>CornerPulse.snapshot().pose),'startled');
 await phone.clock.runFor(1800);assert.match(await phone.locator('.pulse-greeting').textContent(),/whiskers/);
 await emit(phone,[-16,16,-16,16]);assert.notEqual(await phone.evaluate(()=>CornerPulse.snapshot().pose),'startled','Cooldown prevents repeating scenes');
 await menu(phone);await phone.locator('.pulse-settings summary').click();await phone.locator('[data-pulse-mode="paused"]').click();
 assert.equal(await phone.evaluate(()=>CornerPulse.snapshot().motionListening),false,'Pause removes sensor listener');
 await phone.locator('[data-pulse-motion]').click();assert.equal(await phone.evaluate(()=>CornerPulse.snapshot().motionEnabled),false);
 await phone.close();
 for(const permission of ['denied','granted']){
  const page=await start(390,844,permission);await menu(page);await page.locator('.pulse-phone summary').click();await page.locator('[data-pulse-motion]').click();
  if(permission==='denied')await page.waitForFunction(()=>CornerPulse.snapshot().motionPermission==='denied');
  else{await page.waitForFunction(()=>CornerPulse.snapshot().motionPermission==='waiting');await page.clock.runFor(4800);assert.equal(await page.evaluate(()=>CornerPulse.snapshot().motionPermission),'unavailable');}
  assert.equal(await page.evaluate(()=>CornerPulse.snapshot().motionListening),false);await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS motion consent/readiness/denial/timeout, cooldown and disable');
}finally{await browser.close();}
