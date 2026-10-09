import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {V3Languages} from '../src/v3-languages.mjs';
import {passwordHash} from '../src/auth.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-v3-phase4-visual-'));
const db=path.join(dir,'corner.sqlite'),email='phase4-owner@example.test',
 password='Human-Reviewed-Phase4-Owner-Passphrase#2026';
const port=55600+Math.floor(Math.random()*500),origin='http://127.0.0.1:'+port;
const env={...process.env,NODE_ENV:'test',DATA_DIR:dir,DB_PATH:db,DEMO_CONTENT:'0',
 SITE_URL:origin+'/corner',CORNER_BASE_PATH:'/corner',HOST:'127.0.0.1',PORT:String(port),
 CORNER_V3_INSIGHTS:'1',CORNER_V3_LANGUAGES:'1',SESSION_SECRET:crypto.randomBytes(48).toString('hex'),
 ADMIN_EMAIL:email,ADMIN_PASSWORD_HASH:passwordHash(password)};
const store=new Store(db);
new V3Engagement(store,{env});const languages=new V3Languages(store,{env});
const owner={id:'owner',role:'owner'};
const post=store.createPost({title:'One quiet idea',body:'Words matter when we reflect.',type:'journal'},owner.id);
store.publish(post.id,owner.id);
languages.save(owner,{postId:post.id,language:'hi',title:'एक छोटी कहानी',body:'समय और शब्दों की छोटी कहानी'});
languages.review(owner,post.id,'hi',{confirm:true});
store.close();
const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
const stderr=[];child.stderr.on('data',data=>stderr.push(String(data)));
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
let browser;
try{
 let ready=false;
 for(let n=0;n<90;n++){if(child.exitCode!==null)break;try{if((await fetch(origin+'/corner/api/ready')).ok){ready=true;break}}catch{}await sleep(85)}
 assert.equal(ready,true,'Browser fixture start: '+stderr.join('').slice(0,350));
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const width of [320,375,768,1366,1920]){
  const context=await browser.newContext({viewport:{width,height:width<=375?812:930},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  const login=await page.request.post(origin+'/corner/api/v1/admin/login',{data:{email,password},headers:{origin}});
  assert.equal(login.status(),200);
  for(const route of ['/admin/v3/insights','/admin/v3/languages','/post/'+post.slug+'?lang=hi']){
   const r=await page.goto(origin+'/corner'+route,{waitUntil:'domcontentloaded'});
   assert.equal(r.status(),200,width+' '+route);
   const state=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,heading:document.querySelector('main h1')?.textContent}));
   assert.ok(state.page<=state.viewport+1,'No overflow '+width+' '+route+': '+JSON.stringify(state));
   assert.equal(await page.locator('main h1').count(),1);
   assert.deepEqual(errors,[],width+' '+route+' has no page errors');
   if(route.includes('insights')){
    assert.equal(await page.locator('.v3a-kpi').count(),3);
    assert.equal(await page.locator('link[href="/corner/v3-phase4.css"]').count(),1);
   }
   if(route.includes('languages'))assert.equal(await page.locator('[data-v3-language-form]').count(),1);
   if(route.includes('?lang=hi')){
    assert.equal(await page.locator('html').getAttribute('lang'),'hi-IN');
    assert.equal(await page.locator('.v3a-language-picker a').count(),2);
    assert.equal(await page.locator('link[href="/corner/v3-phase4.css"]').count(),1);
   }
   if((width===375||width===1366)&&route.includes('admin/v3/'))
    await page.screenshot({path:'/tmp/corner-v3-phase4-'+width+(route.includes('insights')?'-insights':'-languages')+'.png',fullPage:true});
  }
  await context.close();
  console.log('PASS Phase 4 responsive '+width);
 }
}finally{await browser?.close();child.kill('SIGTERM');await sleep(180);fs.rmSync(dir,{recursive:true,force:true})}
