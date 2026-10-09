import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-v3-visual-'));
const port=45300+Math.floor(Math.random()*600);
const origin='http://127.0.0.1:'+port;
Object.assign(process.env,{
 NODE_ENV:'test',DEMO_CONTENT:'0',DATA_DIR:dir,DB_PATH:path.join(dir,'browser.sqlite'),
 CORNER_BASE_PATH:'/corner',SITE_URL:origin+'/corner',HOST:'127.0.0.1',PORT:String(port),
 CORNER_V3_MEMORIES:'1',CORNER_V3_SEARCH:'1',CORNER_V3_GUESTBOOK:'0',
 SESSION_SECRET:crypto.randomBytes(44).toString('hex')
});
const {Store}=await import('../src/store.mjs');
const {V3Engagement}=await import('../src/v3-engagement.mjs');
const {V3Memories}=await import('../src/v3-memories.mjs');
const {config}=await import('../src/config.mjs');
const store=new Store(config.dbPath);new V3Engagement(store);const memories=new V3Memories(store);
const owner={id:'owner',role:'owner'};
const posts=[];
for(const title of ['A beginning','A quiet summer','Making things that last']){
 const p=store.createPost({title,body:'A thoughtful story for a quiet corner.',type:'moment'},'owner');
 store.publish(p.id,'owner');posts.push(p);
}
memories.milestone(owner,{title:'A turning point',summary:'A thoughtful afternoon.',occurredOn:'2026-10-09',kind:'personal',postId:posts[0].id,state:'published'});
memories.milestone(owner,{title:'A small win',summary:'Another moment to remember.',occurredOn:'2025-07-09',kind:'build',postId:posts[1].id,state:'published'});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAIAAAABUCAIAAADF86ilAAACo0lEQVR42u2bIU/DQBiGu6MCgcCiZnALGaBAQDAkGBTBAwlyv4FfwF/YFIrMD0dmmBoQQkBgFsQSFCEIJGJkKWy03d193313975u67K1z3Nvr72sleHgKUHcRQEBBEAAAgEQgLhJCgT5WVz4yr58/5yHADfos29a1IBT0Az0S26FAFr6dh1AgD5ZKw4gAFdBmXTbrZyt2wfHcob/+POGE3LF+WJcPnRmGRpnFY8F6KEn1RCLAHP0RBrCF2AXvXUN/AJUGPRtffmsNM1viZkaQIpeowpbu/v/bXq4ueQUoAKjb/5zK5uHbPQ5BDDTZ3Ngaz1OhUefwUH5lrgU4JC+LQeToKe+Gc5ShMDYxc3XAOfDX9RucAsQddjCHWA52nHSGEZct90qvDu7613nf2B1YwcNCDAq+OEvfMfQgIAECL/ekLl7hA1odvoY4M4EjOjDgRsBWe5wwCRgfIadJC7HgcBpQNGNfcwH3ALyKTc7fWggFFASLhyQCDg6beDyVC8pJ/qsg5O9ddA3bYAeffTAjgAT+nBgKsCcPhzoC7BFHw50BNilz+yA4REPWgEU9CPvgZJAP+ZbZSWEfrRVUKLokzoQOAGUEsBMP7YeKIH0KRzIHP4FAhzSj6cHSix9iw7EDv9k6mqoEPRZBwxLp0T/PJy5AdLom/dA8vD/K0AmfZPbNOH0fwmQTD/gaTkdPPeTJDk7b/myx+WnhGqtPjo6itj65krv6sIj+uMUOqjW6l4cyNzr24ePzb19Ga4tL/lO/6cBDD8zeLxnOySP6Cdsj6mOoFBr8At98VKEX4B8pJ/wP6hNUQVP0bsRYFeD1+hdCjDXEAB69wImUebLCAa6LAHBIxZ0FYRAAAQgEAABCARAAAIBEIBAAARAAAIBEIBAQKz5BmnyHkM26UkCAAAAAElFTkSuQmCC','base64');
fs.mkdirSync(config.uploads,{recursive:true});
const id='media_'+crypto.randomUUID(),key=crypto.randomBytes(16).toString('hex')+'.png';
fs.writeFileSync(path.join(config.uploads,key),png);
store.addMedia({id,ownerId:posts[1].id,storageKey:key,mimeType:'image/png',size:png.length,alt:'A small quiet scene',width:128,height:84});
const album=memories.albumWrite(owner,{title:'Scenes from the season',summary:'Pictures from a day.',mediaIds:[id],state:'published'});
const series=memories.collectionWrite(owner,{title:'Small thoughts',summary:'Three little stories.',postIds:posts.map(p=>p.id),state:'published'});
memories.recordNow(owner,{label:'Working on what matters',detail:'Keeping a little record of progress.',isActive:true,icon:'✳'});
store.close();
const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});
const logs=[];child.stderr.on('data',x=>logs.push(String(x)));
let browser;
try{
 let live=false;
 for(let i=0;i<80;i++){if(child.exitCode!==null)break;try{if((await fetch(origin+'/corner/api/ready')).ok){live=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
 assert.equal(live,true,'Fixture startup: '+logs.join('').slice(0,300));
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const urls=['/timeline','/moments','/moments/'+album.slug,'/collections','/collections/'+series.slug,'/now'];
 for(const width of [320,375,768,1366,1920]){
  const context=await browser.newContext({viewport:{width,height:width<=375?820:930},reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const url of urls){
   const response=await page.goto(origin+'/corner'+url,{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200,width+' '+url);
   await page.locator('.v3m-content').first().waitFor();
   const h1=await page.locator('main h1').count();
   assert.equal(h1,1,'Phase 2 page must have exactly one H1 and no repeated hero '+width+' '+url);
   const w=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
   assert.ok(w.scroll<=w.viewport+1,'Horizontal overflow '+width+' '+url+': '+JSON.stringify(w));
   if(url==='/moments'||url==='/moments/'+album.slug){
    const image=page.locator(url==='/moments'?'.v3m-album img':'.v3m-photo img').first();
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(async node=>node.decode());
    const decoded=await image.evaluate(node=>({
     naturalWidth:node.naturalWidth,naturalHeight:node.naturalHeight,
     complete:node.complete,alt:node.getAttribute('alt'),src:node.currentSrc
    }));
    assert.equal(decoded.complete,true,'Gallery image finished loading '+width+' '+url);
    assert.equal(decoded.naturalWidth,128,'Gallery fixture really decoded '+width+' '+url);
    assert.equal(decoded.naturalHeight,84,'Gallery dimensions match fixture '+width+' '+url);
    assert.ok(decoded.alt?.length>3,'Gallery has descriptive alt text '+width+' '+url);
    assert.ok(decoded.src.includes('/corner/media/'),'Gallery uses the media endpoint '+width+' '+url);
    const variant=url==='/moments'?'card':'tile';
    assert.ok(decoded.src.includes('?variant='+variant),'Gallery uses bounded WebP photo variants');
    const encoded=await page.request.get(decoded.src);
    assert.equal(encoded.status(),200);
    assert.match(encoded.headers()['content-type'],/^image\/webp/,'Preview is WebP');
    assert.ok((await encoded.body()).length<=(variant==='card'?300000:160000),'Preview fits byte budget');
   }
   assert.deepEqual(errors,[],width+' '+url+' no JS errors');
   if((width===375||width===1366)&&['/timeline','/moments','/collections'].includes(url)){
    await page.screenshot({path:'/tmp/corner-v3-phase2-'+width+'-'+url.slice(1)+'.png',fullPage:true});
   }
   console.log('PASS Phase 2 '+width+' '+url);
  }
  await page.goto(origin+'/corner/moments/'+album.slug);
  const photo=page.locator('[data-v3m-photo]').first();await photo.focus();await photo.press('Enter');
  assert.equal(await page.locator('[data-v3m-lightbox]').evaluate(x=>x.open),true,'Gallery opens via keyboard');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-v3m-lightbox]').evaluate(x=>x.open),false,'Gallery closes via Escape');
  assert.equal(await photo.evaluate(x=>document.activeElement===x),true,'Focus returns to opener');
  console.log('PASS Phase 2 accessible lightbox '+width);
  await context.close();
 }
}finally{
 await browser?.close();
 child.kill('SIGTERM');
 await new Promise(r=>setTimeout(r,180));
 fs.rmSync(dir,{recursive:true,force:true});
}
