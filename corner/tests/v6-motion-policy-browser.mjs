/* Read-only browser regression for first-party Motion preference. Synthetic fixture only. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=process.env.CORNER_TEST_ORIGIN||'http://127.0.0.1:4144';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 const response=await page.goto(origin+'/corner/',{waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200);
 await page.waitForFunction(()=>!!window.CornerMotionPolicy);
 assert.equal(await page.evaluate(()=>CornerMotionPolicy.mode()),'balanced');
 assert.equal(await page.locator('html').getAttribute('data-corner-motion-level'),'balanced');
 assert.equal(await page.evaluate(()=>CornerMotionPolicy.setMode('minimal')),true);
 assert.equal(await page.evaluate(()=>CornerMotionPolicy.isReduced()),true);
 assert.equal(await page.locator('html').getAttribute('data-corner-motion-level'),'minimal');
 const css=await page.evaluate(()=>getComputedStyle(document.documentElement,'::view-transition-old(root)').animationDuration);
 assert.ok(['1e-05s','0.00001s','0.01ms'].includes(css)||css==='0s'||parseFloat(css)<0.02,
  'Minimal mode overrides public page transitions: '+css);
 await page.goto(origin+'/corner/post/sample-a-small-new-beginning',{waitUntil:'domcontentloaded'});
 assert.equal(await page.evaluate(()=>CornerMotionPolicy.mode()),'minimal',
  'First-party preference persists across real page navigation');
 assert.equal(await page.locator('html').getAttribute('data-corner-motion-level'),'minimal');
 const restore=await page.evaluate(()=>CornerMotionPolicy.setMode('playful'));
 assert.equal(restore,true);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.documentElement.dataset.cornerMotionLevel==='minimal');
 assert.equal(await page.evaluate(()=>CornerMotionPolicy.mode()),'playful',
  'System override never destroys the explicitly chosen preference');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.waitForFunction(()=>document.documentElement.dataset.cornerMotionLevel==='playful');
 await page.goto(origin+'/corner/login',{waitUntil:'domcontentloaded'});
 assert.equal(await page.evaluate(()=>CornerMotionPolicy.mode()),'playful');
 assert.deepEqual(errors,[]);
 console.log('PASS Corner Motion persists, respects device preference, and isolates account actions');
 await page.close();
}finally{await browser.close()}
