import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const assets=new Set(['diwali-2026.css','diwali-2026.js','diwali-2026-diya.svg','diwali-2026-garland.svg','v6-motion-policy.js']);
const pageHtml=['<!doctype html><html lang="en"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width,initial-scale=1">',
 '<style>*,*::before,*::after{box-sizing:border-box}body{margin:0;font:16px system-ui;background:#fff;color:#201c19}.corner-public-header{min-height:64px;padding:20px;border-bottom:1px solid #ddd}main{width:min(100% - 32px,1100px);margin:32px auto}.story{background:#fff;border:1px solid #ddd;padding:24px}</style>',
 '<link rel="stylesheet" href="/corner/diwali-2026.css">',
 '<script defer src="/corner/v6-motion-policy.js"></script>',
 '<script defer src="/corner/diwali-2026.js"></script></head>',
 '<body class="corner-comfort"><header class="corner-public-header">Vamsi’s Corner</header>',
 '<main id="content"><article class="story">Original article stays readable.</article></main></body></html>'].join('\n');
const server=createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 if(['/corner','/corner/'].includes(name)){res.writeHead(200,{'content-type':'text/html'});res.end(pageHtml);return}
 const asset=name.startsWith('/corner/')?name.slice(8):'';
 if(!assets.has(asset)){res.writeHead(404);res.end();return}
 const mime=asset.endsWith('.css')?'text/css':asset.endsWith('.svg')?'image/svg+xml':'text/javascript';
 res.writeHead(200,{'content-type':mime});res.end(readFileSync(path.join(directory,asset)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/corner';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
async function open(time,viewport={width:390,height:844},motion='no-preference'){
 const context=await browser.newContext({viewport,reducedMotion:motion});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date(time)});
 assert.equal((await page.goto(url,{waitUntil:'networkidle'})).status(),200);
 return {page,context};
}
try{
 const before=await open('2026-11-07T18:29:59.000Z');
 assert.equal(await before.page.locator('.corner-diwali-ribbon').count(),0);
 await before.page.clock.fastForward(1600);
 await before.page.locator('.corner-diwali-ribbon').waitFor();
 await before.context.close();
 for(const viewport of [{width:320,height:720},{width:390,height:844},{width:768,height:1024},{width:1366,height:768},{width:3840,height:2160}]){
  const {page,context}=await open('2026-11-08T07:00:00.000Z',viewport);
  assert.equal(await page.locator('.corner-diwali-ribbon').count(),1);
  assert.equal(await page.locator('.corner-diwali-lamp img').evaluate(el=>el.complete&&el.naturalWidth>0),true);
  assert.equal(await page.locator('.corner-diwali-canvas').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  assert.match(await page.locator('.corner-diwali-lamp img').getAttribute('src'),/\/corner\/diwali-2026-diya.svg$/);
  assert.equal(await page.locator('article').innerText(),'Original article stays readable.');
  const w=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
  assert.ok(w[0]<=w[1]+1,'overflow at '+viewport.width+': '+w);
  await context.close();
  console.log('PASS '+viewport.width+'x'+viewport.height);
 }
 const ending=await open('2026-11-08T18:29:59.000Z');
 assert.equal(await ending.page.locator('.corner-diwali-ribbon').count(),1);
 await ending.page.clock.fastForward(1700);
 await ending.page.locator('.corner-diwali-ribbon').waitFor({state:'detached'});
 assert.equal(await ending.page.locator('.corner-diwali-canvas').count(),0);
 await ending.context.close();
 const after=await open('2026-11-08T18:30:00.000Z');
 assert.equal(await after.page.locator('.corner-diwali-ribbon').count(),0);
 await after.context.close();
 const quiet=await open('2026-11-08T07:00:00.000Z',{width:375,height:812},'reduce');
 assert.equal(await quiet.page.locator('.corner-diwali-ribbon').count(),1);
 assert.equal(await quiet.page.locator('.corner-diwali-canvas').count(),0);
 assert.equal(await quiet.page.locator('[data-corner-diwali-celebrate]').isVisible(),false);
 await quiet.context.close();
 const pref=await open('2026-11-08T07:00:00.000Z');
 await pref.page.locator('[data-corner-diwali-mode]').click();
 assert.equal(await pref.page.locator('html').getAttribute('data-corner-diwali'),'off');
 assert.equal(await pref.page.locator('.corner-diwali-canvas').count(),0);
 await pref.page.reload({waitUntil:'networkidle'});
 assert.equal(await pref.page.locator('html').getAttribute('data-corner-diwali'),'off');
 await pref.page.evaluate(()=>window.CornerMotionPolicy.setMode('minimal'));
 assert.equal(await pref.page.locator('.corner-diwali-canvas').count(),0);
 await pref.context.close();
 assert.deepEqual(errors,[]);
 console.log('PASS Diwali window, 4K responsive, device opt-out and Reduce Motion');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
