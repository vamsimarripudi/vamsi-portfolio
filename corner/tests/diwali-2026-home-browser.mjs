/* Real SSR homepage markup with synthetic content; festival clock is browser-controlled.
   No production writes or fabricated actual posts. Used for visual/regression QA. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {feedPage} from '../src/ui.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const festivalDate='2026-11-08T07:00:00.000Z';
const sample={
 id:'preview-only',slug:'diwali-illustrative-example',type:'journal',
 title:'Some lights feel like home.',
 body:'A visual-layout fixture. Not a published Vamsi’s Corner post.',
 excerpt:'A visual-layout fixture with sample copy. The live home will show the actual latest published story.',
 emoji:'🪔',published_at:'2026-11-08T02:00:00.000Z',
 allow_reactions:true,allow_comments:true,version:1,featured:false,demo:true
};
const mime={'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'};
let html=feedPage({posts:[sample],active:'Latest',demo:true,status:null,featured:null,upcoming:[]});
html=html.replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/g,'');
html=html.replace('</head>','<link rel="stylesheet" href="/diwali-2026.css">'+
 '<script defer src="/v6-motion-policy.js"></script>'+
 '<script defer src="/diwali-2026.js"></script></head>');
html=html.replace(/(href|src|poster|action)=(["'])\/(?!\/)/g,(_,attr,quote)=>attr+'='+quote+'/corner/');

const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/corner'||pathname==='/corner/'){
  res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});res.end(html);return;
 }
 if(!pathname.startsWith('/corner/')){res.writeHead(404);res.end();return}
 const filename=path.resolve(root,pathname.slice('/corner/'.length));
 if(!filename.startsWith(root+path.sep)||!existsSync(filename)||!mime[path.extname(filename).toLowerCase()]){
  res.writeHead(404);res.end();return;
 }
 res.writeHead(200,{'content-type':mime[path.extname(filename).toLowerCase()]});
 res.end(readFileSync(filename));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
try{
 mkdirSync('screenshots',{recursive:true});
 for(const width of [320,390,768,1366,1920,3840]){
  const context=await browser.newContext({viewport:{width,height:width===3840?2160:width<600?844:width===768?1024:1080}});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date(festivalDate)});
  const response=await page.goto(origin+'/corner/',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  await page.locator('.corner-diwali-ribbon').waitFor();
  assert.equal(await page.locator('#corner-explore-title').innerText(),'A place for everything.');
  assert.equal(await page.locator('#feed-heading').innerText(),'Recent stories.');
  assert.equal(await page.locator('.corner-explore-tile').count(),6);
  assert.equal(await page.locator('.story').count(),1);
  assert.equal(await page.locator('.story h2').innerText(),sample.title);
  assert.equal(await page.locator('.corner-diwali-quicklinks a').count(),3);
  assert.equal(await page.locator('.corner-diwali-quicklinks a').nth(1).getAttribute('href'),'/corner/category/builds');
  const measure=await page.evaluate(()=>({
   viewport:innerWidth,scroll:document.documentElement.scrollWidth,
   story:getComputedStyle(document.querySelector('.story')).display,
   categories:getComputedStyle(document.querySelector('.corner-explore-grid')).gridTemplateColumns.split(' ').length,
   primary:getComputedStyle(document.querySelector('.corner-home-hero')).gridTemplateColumns.split(' ').length
  }));
  assert.ok(measure.scroll<=measure.viewport+1,'Horizontal overflow at '+width+': '+JSON.stringify(measure));
  assert.equal(measure.categories,width<=900?3:6,'Categories use image-matched grid at '+width);
  assert.equal(measure.story,width<=650?'flex':'grid','Actual SSR story uses reference composition at '+width);
  if(width===390||width===1920||width===3840){
   await page.screenshot({path:'screenshots/diwali-real-home-'+width+'.png',fullPage:true,animations:'disabled'});
  }
  await context.close();
  console.log('PASS reference homepage fidelity '+width+'px '+JSON.stringify(measure));
 }
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date(festivalDate)});
 await page.goto(origin+'/corner/',{waitUntil:'networkidle'});
 assert.equal(await page.locator('.corner-diwali-canvas').count(),0);
 await page.locator('[data-corner-diwali-mode]').click();
 assert.equal(await page.locator('.corner-diwali-quicklinks').count(),0);
 assert.equal(await page.locator('#feed-heading').innerText(),'Latest from here.');
 await page.locator('[data-corner-diwali-mode]').click();
 assert.equal(await page.locator('#feed-heading').innerText(),'Recent stories.');
 await page.clock.fastForward(60*60*12*1000); // 19:00Z: past the 18:30Z exclusive end
 await page.locator('.corner-diwali-ribbon').waitFor({state:'detached'});
 assert.equal(await page.locator('#feed-heading').innerText(),'Latest from here.');
 assert.equal(await page.locator('.corner-diwali-quicklinks').count(),0);
 await context.close();
 assert.deepEqual(errors,[],'No browser JavaScript errors');
 console.log('PASS Diwali mock fidelity, opt-out and expiry in real Corner SSR layout');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
