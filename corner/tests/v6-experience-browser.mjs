/* Corner V6 motion QA: synthetic data only, no production writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const origin=process.env.CORNER_TEST_ORIGIN||'http://127.0.0.1:4144';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
fs.mkdirSync('screenshots',{recursive:true});
try{
 for(const width of [320,375,390,430,768,1366]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const res=await page.goto(origin+'/corner/',{waitUntil:'domcontentloaded'});
  assert.equal(res.status(),200,'Home loads at '+width);
  await page.locator('.corner-home-hero').waitFor();
  await page.locator('script[src="/corner/v6-motion.js"]').waitFor({state:'attached'});
  const layout=await page.evaluate(()=>({
   scroll:document.documentElement.scrollWidth,width:innerWidth,
   motion:!!document.querySelector('link[href="/corner/v6-motion.css"]'),
   gravity:!!document.querySelector('script[src="/corner/v6-gravity.js"]')
  }));
  assert.ok(layout.scroll<=layout.width+1,'No viewport overflow '+width+': '+JSON.stringify(layout));
  assert.equal(layout.motion,true,'Home participates in public navigation');
  assert.equal(layout.gravity,true,'Dedicated test fixture has explicitly enabled gravity');
  if(width===390){
   const star=page.locator('.hero-spark[data-v6-gravity]');
   await star.waitFor();
   const play=page.locator('.v6-gravity-play');
   await play.waitFor({state:'visible'});
   assert.equal(await page.locator('.v6-gravity-ghost').count(),0,'No autoplay');
   await play.click();
   await page.locator('.v6-gravity-ghost').waitFor({state:'visible'});
   await page.evaluate(()=>window.scrollBy(0,120));
   await page.locator('.v6-gravity-ghost').waitFor({state:'detached'});
   assert.notEqual(await star.evaluate(el=>getComputedStyle(el).visibility),'hidden','Original star restored');
   await page.screenshot({path:'screenshots/corner-v6-home-390.png',animations:'disabled'});
   const mockPostId='post_11111111-1111-4111-8111-111111111111';
   let pending=false;
   await page.route('**/api/v5/posts/**/threads',async route=>{
    if(route.request().method()==='POST'){
      pending=true;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{state:'pending',message:'Awaiting review'}})});
    }
    const rows=[{id:'comment_22222222-2222-4222-8222-222222222222',postId:mockPostId,
      authorName:'Sample reader',body:'A thoughtful local test reply.',createdAt:'2026-10-29T06:00:00Z',
      parentId:null,pending:false,reactions:2,liked:false,own:false}];
    if(pending)rows.push({id:'comment_33333333-3333-4333-8333-333333333333',postId:mockPostId,
      authorName:'Synthetic member',body:'This is only visible to its author.',createdAt:'2026-10-29T06:01:00Z',
      parentId:null,pending:true,reactions:0,liked:false,own:true});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:rows})});
   });
   await page.route('**/api/v1/auth/session',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({data:{authenticated:true}})
   }));
   const link=page.locator('.story .v5-card-actions a[data-v6-conversation]').first();
   await link.evaluate((el,id)=>el.dataset.postId=id,mockPostId);
   await link.click();
   const dialog=page.locator('dialog.v6-conversation-sheet');
   await dialog.waitFor({state:'visible'});
   assert.equal(await dialog.locator('.v6-sheet-comment').count(),1,'Approved thread visible');
   assert.match(await dialog.getByText('A thoughtful local test reply.').textContent(),/thoughtful/);
   await dialog.locator('textarea').fill('My own pending synthetic reply.');
   await dialog.locator('button[type="submit"]').click();
   await dialog.getByText('Awaiting review.',{exact:false}).first().waitFor();
   assert.equal(await dialog.locator('.v6-sheet-comment[data-pending="true"]').count(),1,'Own pending item visible');
   await dialog.locator('.v6-sheet-close').click();
   assert.equal(await dialog.evaluate(el=>el.open),false,'Native modal closed');
   assert.ok(await link.evaluate(el=>document.activeElement===el),'Focus returns to opener');
   await page.screenshot({path:'screenshots/corner-v6-dialog-closed-390.png',animations:'disabled'});
  }
  await page.goto(origin+'/corner/post/sample-a-small-new-beginning',{waitUntil:'domcontentloaded'});
  const reader=page.locator('article.post-article .v6-reader-toggle');
  await reader.waitFor({state:'visible'});
  await reader.click();
  assert.equal(await page.locator('html').getAttribute('data-v6-reading'),'focus','Manual immersive reading active');
  assert.equal(await page.locator('.v6-reader-show').isVisible(),true,'Exit control is accessible');
  await page.locator('.v6-reader-show').click();
  assert.equal(await page.locator('html').getAttribute('data-v6-reading'),null,'Reading returns to normal');
  const contentHeight=await page.locator('article.post-article').evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(contentHeight>0);
  assert.deepEqual(errors,[],'No uncaught page errors at '+width);
  await page.close();
  console.log('PASS V6 motion, focus, mobile layout '+width);
 }
 const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await reduced.goto(origin+'/corner/',{waitUntil:'domcontentloaded'});
 assert.equal(await reduced.locator('.v6-gravity-play').count(),0,'Reduced motion disables gravity');
 const css=await reduced.locator('link[href="/corner/v6-motion.css"]').count();
 assert.equal(css,1,'Native page transitions remain progressive; CSS reduces animation duration');
 await reduced.goto(origin+'/corner/login',{waitUntil:'domcontentloaded'});
 assert.equal(await reduced.locator('link[href="/corner/v6-motion.css"]').count(),0,'Private and account pages opt out');
 await reduced.close();
 console.log('PASS V6 reduced motion and account route isolation');
}finally{await browser.close()}
