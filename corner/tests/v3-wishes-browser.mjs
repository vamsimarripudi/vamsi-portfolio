import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {passwordHash} from '../src/auth.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-wish-visual-'));
const port=55400+Math.floor(Math.random()*700),origin='http://127.0.0.1:'+port;
const email='wishes-browser@example.test',password='Super-Strong-Wishes-Owner-Passphrase-2026!';
const env={...process.env,NODE_ENV:'test',DEMO_CONTENT:'0',DATA_DIR:dir,DB_PATH:path.join(dir,'db.sqlite'),
 SITE_URL:origin+'/corner',CORNER_BASE_PATH:'/corner',HOST:'127.0.0.1',PORT:String(port),
 CORNER_V3_WISHES:'1',CORNER_V3_WISH_DELIVERY:'0',CORNER_V3_FOLLOW:'0',
 ADMIN_EMAIL:email,ADMIN_PASSWORD_HASH:passwordHash(password),SESSION_SECRET:crypto.randomBytes(48).toString('hex')};
const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
const stderr=[];child.stderr.on('data',chunk=>stderr.push(String(chunk)));
let browser;
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
try{
 let ready=false;
 for(let i=0;i<90;i++){if(child.exitCode!==null)break;try{if((await fetch(origin+'/corner/api/health')).ok){ready=true;break}}catch{}await sleep(100)}
 assert.equal(ready,true,'Wishes fixture started: '+stderr.join('').slice(0,320));
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const width of [320,375,768,1366,1920]){
  const context=await browser.newContext({viewport:{width,height:width<430?830:900},reducedMotion:'reduce'});
  const page=await context.newPage();
  const auth=await page.request.post(origin+'/corner/api/v1/admin/login',{
   data:{email,password},headers:{origin}});
  assert.equal(auth.status(),200,'Synthetic owner authentication succeeds');
  const r=await page.goto(origin+'/corner/admin/v3/wishes',{waitUntil:'networkidle'});
  assert.equal(r.status(),200);
  await page.locator('[data-wish-studio]').waitFor();
  assert.equal(await page.locator('main h1').count(),1);
  const v=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(v.scroll<=v.width+1,'No Wishes Studio overflow '+width);
  assert.equal(await page.locator('[data-v3w-form]').count(),1);
  assert.equal(await page.locator('[data-v3w-schedule]').count(),1);
  assert.equal(await page.getByText('EMAIL UPDATES OFF').count(),1);
  if(width===375||width===1366)await page.screenshot({path:'/tmp/corner-v3-wishes-'+width+'.png',fullPage:true});
  if(width===375){
   const form=page.locator('[data-v3w-form]');
   await form.locator('[name=title]').fill('A thoughtful wish');
   await form.locator('[name=body]').fill('May the coming days bring good things.');
   await page.locator('[data-v3w-preview]').click();
   await page.getByText('Private preview only. Nothing emailed or published.').waitFor();
   assert.equal(await page.locator('[data-v3w-title]').textContent(),'A thoughtful wish');
   await form.locator('[type=submit]').click();
   await page.getByText('A thoughtful wish').last().waitFor({timeout:12000});
   assert.match(await page.locator('.v3w-item').first().textContent(),/draft/i);
  }
  await context.close();
  console.log('PASS Wishes owner view and minimal responsive design '+width);
 }
}finally{
 await browser?.close();
 child.kill('SIGTERM');await sleep(180);fs.rmSync(dir,{recursive:true,force:true});
}
