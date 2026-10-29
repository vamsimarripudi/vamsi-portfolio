/* Read-only production-style browser acceptance; only synthetic DEMO_CONTENT=1. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.CORNER_TEST_ORIGIN||'http://127.0.0.1:4143';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
fs.mkdirSync('screenshots',{recursive:true});
try{
 for(const width of [320,375,390,430,768]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const res=await page.goto(origin+'/corner/',{waitUntil:'domcontentloaded'});
  assert.equal(res.status(),200,'Homepage HTTP '+width);
  const actions=page.locator('.story .v5-card-actions').first();
  await actions.waitFor({state:'visible'});
  await page.waitForFunction(()=>!!document.querySelector('link[href*="v51-mobile.css"]'));
  const row=await page.evaluate(()=>{
   const card=document.querySelector('.story'),bar=card?.querySelector('.v5-card-actions');
   const parts=[bar?.querySelector('.reactions'),bar?.querySelector('a[href*="#conversation"]'),bar?.querySelector('button[data-v5-share-post]')];
   const r=parts.map(e=>e?.getBoundingClientRect());
   const media=card.querySelector('.card-media');
   return {scroll:document.documentElement.scrollWidth,width:innerWidth,
    display:bar?getComputedStyle(bar).display:null,parts:r.map(x=>x?{left:x.left,right:x.right,mid:(x.top+x.bottom)/2}:null),
    media:media?{width:media.getBoundingClientRect().width,cardWidth:card.getBoundingClientRect().width,
     objectFit:getComputedStyle(media.querySelector('img,video')).objectFit}:null};
  });
  assert.ok(row.scroll<=row.width+1,'No horizontal overflow '+width+': '+JSON.stringify(row));
  assert.equal(row.display,'flex','Actions form one row at '+width);
  assert.ok(row.parts.every(Boolean),'All three actions exist at '+width);
  assert.ok(Math.max(...row.parts.map(p=>p.mid))-Math.min(...row.parts.map(p=>p.mid))<14,
    'Like, Comment, Share share a baseline '+width+': '+JSON.stringify(row.parts));
  if(row.media){assert.ok(row.media.width>=row.media.cardWidth-2,'Media fills its card');assert.equal(row.media.objectFit,'cover');}
  if(width===390){
   const dock=page.locator('.category-tabs.corner-rail');
   await dock.waitFor({state:'visible'});
   const scrollable=await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight);
   assert.ok(scrollable>200,'Demo page offers a scrollable feed');
   await page.evaluate(()=>scrollTo(0,Math.min(650,document.documentElement.scrollHeight-innerHeight)));
   await page.waitForFunction(()=>document.querySelector('.category-tabs.corner-rail')?.classList.contains('v51-dock-hidden'),null,{timeout:4000});
   assert.equal(await dock.evaluate(el=>el.inert),true,'Hidden dock cannot receive focus');
   await page.evaluate(()=>scrollTo(0,0));
   await page.waitForFunction(()=>!document.querySelector('.category-tabs.corner-rail')?.classList.contains('v51-dock-hidden'),null,{timeout:4000});
   assert.equal(await dock.evaluate(el=>el.inert),false,'Dock returns when scrolling up');
   await page.screenshot({path:'screenshots/v51-home-390.png',animations:'disabled'});
  }
  assert.deepEqual(errors,[],'No browser JS exceptions at '+width);
  await page.close();
  console.log('PASS V5.1 action bar and mobile viewport '+width);
 }
}finally{await browser.close()}