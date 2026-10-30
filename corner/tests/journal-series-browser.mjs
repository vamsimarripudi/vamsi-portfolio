/* Chapter page visual checks against a completely isolated synthetic test fixture. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const origin=process.env.CORNER_TEST_ORIGIN||'http://127.0.0.1:4144';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [320,375,390,430,768,1366]){
  const page=await browser.newPage({viewport:{width,height:width<500?844:900},
   isMobile:width<768,hasTouch:width<768});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto(origin+'/corner/series/learning-everything-doing-nothing',{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200,'Series hub is routed at '+width);
  await page.locator('#journal-series-name').waitFor();
  assert.equal(await page.locator('.journal-series-chapter').count(),5);
  assert.match(await page.locator('#journal-series-name').textContent(),/Learning Everything/);
  assert.ok((await page.locator('.journal-series-chapter.is-unpublished').count())>=1);
  const geo=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(geo.documentWidth<=geo.viewport+1,'No series horizontal overflow '+width+' '+JSON.stringify(geo));
  assert.equal(await page.locator('link[href="/corner/journal-series.css?v=1"]').count(),1);
  if(width===390||width===1366){
   fs.mkdirSync('screenshots/journal-series',{recursive:true});
   await page.screenshot({path:'screenshots/journal-series/hub-'+width+'.png',fullPage:true,animations:'disabled'});
  }
  assert.deepEqual(errors,[],'No series page errors at '+width);
  await page.close();
 }
 const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await reduced.goto(origin+'/corner/series/learning-everything-doing-nothing',{waitUntil:'domcontentloaded'});
 const motion=await reduced.locator('.journal-series-chapter').first().evaluate(el=>getComputedStyle(el).transitionDuration);
 assert.equal(motion,'0s','Reduced Motion disables chapter hover transitions');
 await reduced.close();
 console.log('PASS six Journal Series viewports + reduced motion + chapter privacy');
}finally{await browser.close()}
