/* Local-only browser acceptance for the editorial Journal Series. No real user data. */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {Store} from '../src/store.mjs';
import {JournalSeries,FIRST_PART_ID,FIRST_PART_SLUG,FIRST_SERIES_TITLE,FIRST_SERIES_SLUG} from '../src/journal-series.mjs';
import {journalSeriesPage,detailPage} from '../src/ui.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','public');
const store=new Store(':memory:');
const date='2026-10-29T17:56:24.667Z';
const text=`Learning Everything, Doing Nothing

Part 1 — The Illusion of Progress

I love learning new things.

What if I’m confusing learning with progress?

Learning gives me a sense of accomplishment. Execution demands proof.

To be continued…

Next: Part 2 — Addicted to New Beginnings`;
store.exec(`INSERT INTO posts(id,slug,type,title,body,state,published_at,created_at,updated_at)
 VALUES(?,?,?,?,?,?,?,?,?)`,FIRST_PART_ID,FIRST_PART_SLUG,'journal',FIRST_SERIES_TITLE,text,'published',date,date,date);
store.exec(`INSERT INTO media(id,owner_type,owner_id,storage_key,mime_type,size_bytes,alt_text,caption,created_at)
 VALUES(?,?,?,?,?,?,?,?,?)`,'media_series','post',FIRST_PART_ID,'existing-first-cover.png','image/png',16400,
 'Part 01 cover image','The Pause Between Knowing and Doing.',date);
const series=new JournalSeries(store);
const part=store.getPost(FIRST_PART_SLUG);
const hub=journalSeriesPage({series:series.published(FIRST_SERIES_SLUG)});
const chapter=detailPage({post:part,media:store.listMedia(FIRST_PART_ID),series:series.forPost(FIRST_PART_ID)});
const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
 if(name==='/series/'+FIRST_SERIES_SLUG||name==='/post/'+FIRST_PART_SLUG){
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  return res.end(name.startsWith('/series/')?hub:chapter);
 }
 if(name==='/media/existing-first-cover.png'){
  res.writeHead(200,{'content-type':'image/png'});return res.end(tinyPng);
 }
 if(name.endsWith('.js')){
  // Motion and account scripts are independently exercised by the existing
  // full-server browser suite. This fixture isolates editorial HTML/CSS.
  res.writeHead(200,{'content-type':'application/javascript'});return res.end('');
 }
 if(name.endsWith('.css')||name.endsWith('.svg')){
  const file=path.resolve(root,path.basename(name));
  if(file.startsWith(root+path.sep)&&fs.existsSync(file)){
   res.writeHead(200,{'content-type':name.endsWith('.css')?'text/css':'image/svg+xml'});
   return res.end(fs.readFileSync(file));
  }
 }
 res.writeHead(404);res.end('Not Found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 fs.mkdirSync('screenshots',{recursive:true});
 for(const width of [320,375,390,430,768,1366]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:width<=430,hasTouch:width<=430});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(base+'/series/'+FIRST_SERIES_SLUG,{waitUntil:'load'});
  assert.equal(response.status(),200);
  await page.locator('#series-title').waitFor();
  assert.equal((await page.locator('#series-title').textContent()).trim(),'Learning Everything, Doing Nothing.');
  assert.equal(await page.locator('.series-toc-item').count(),1,'One published original chapter');
  assert.equal(await page.locator('.series-cover-photo img').count(),1,'Real original cover referenced');
  assert.equal(await page.locator('.series-start-button').count(),1);
  const geometry=await page.evaluate(()=>({
   contentWidth:document.documentElement.scrollWidth,
   viewport:innerWidth,
   coverWidth:document.querySelector('.series-cover')?.getBoundingClientRect().width,
   titleWidth:document.querySelector('#series-title')?.getBoundingClientRect().width
  }));
  assert.ok(geometry.contentWidth<=geometry.viewport+1,'No series horizontal overflow '+width+': '+JSON.stringify(geometry));
  assert.ok(geometry.titleWidth>0&&geometry.coverWidth>0,'Series cover visible '+width);
  if(width===390)await page.screenshot({path:'screenshots/marginalia-series-390.png',animations:'disabled',fullPage:true});
  await page.locator('.series-start-button').click();
  await page.waitForURL('**/post/'+FIRST_PART_SLUG);
  assert.equal(await page.locator('article.journal-series-article').count(),1);
  assert.match(await page.locator('article.journal-series-article h1').textContent(),/The Illusion of Progress/);
  assert.equal(await page.locator('.series-chapter-prelude').count(),1);
  assert.match(await page.locator('.post-body').textContent(),/What if I’m confusing learning with progress/);
  assert.equal(await page.locator('.series-chapter-footer .series-chapter-upcoming').count(),1);
  const detailWidth=await page.evaluate(()=>({w:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(detailWidth.w<=detailWidth.viewport+1,'No chapter overflow '+width+': '+JSON.stringify(detailWidth));
  if(width===390)await page.screenshot({path:'screenshots/marginalia-chapter-390.png',animations:'disabled',fullPage:true});
  assert.deepEqual(errors,[],'No browser exceptions '+width);
  await page.close();
  console.log('PASS Marginalia hub and original chapter '+width);
 }
 const calm=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await calm.goto(base+'/series/'+FIRST_SERIES_SLUG,{waitUntil:'load'});
 const animation=await calm.locator('.series-cover-copy').evaluate(el=>getComputedStyle(el).animationName);
 assert.equal(animation,'none','Reduced Motion disables decorative chapter introduction');
 await calm.close();
 console.log('PASS Marginalia reduced motion and semantics');
}finally{
 await browser.close();await new Promise(resolve=>server.close(resolve));store.close();
}
