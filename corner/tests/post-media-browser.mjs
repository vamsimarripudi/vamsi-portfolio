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
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-post-media-browser-'));
const port=59000+Math.floor(Math.random()*400);
const origin='http://127.0.0.1:'+port,base=origin+'/corner';
const owner='photo-owner@browser.test',password=crypto.randomBytes(28).toString('base64url');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/V3sAAAAASUVORK5CYII=','base64');
const env={...process.env,HOST:'127.0.0.1',PORT:String(port),NODE_ENV:'test',
 SITE_URL:base,CORNER_BASE_PATH:'/corner',DATA_DIR:dir,DB_PATH:path.join(dir,'corner.sqlite'),
 DEMO_CONTENT:'0',ADMIN_EMAIL:owner,ADMIN_PASSWORD_HASH:passwordHash(password),
 SESSION_SECRET:crypto.randomBytes(48).toString('hex')};
const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
const errors=[];child.stderr.on('data',chunk=>errors.push(String(chunk)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 let started=false;
 for(let i=0;i<110;i++){
  if(child.exitCode!==null)break;
  try{if((await fetch(base+'/api/health')).ok){started=true;break}}catch{}
  await sleep(90);
 }
 assert.equal(started,true,'Corner fixture not ready '+errors.join('').slice(0,400));
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 const browserErrors=[];page.on('pageerror',error=>browserErrors.push(error.message));
 await page.goto(base+'/admin',{waitUntil:'networkidle'});
 await page.locator('#admin-login input[name="email"]').fill(owner);
 await page.locator('#admin-login input[name="password"]').fill(password);
 await page.locator('#admin-login button[type="submit"]').click();
 await page.locator('.admin-shell').waitFor({state:'visible',timeout:14000});
 await page.locator('#create-from-overview').click();
 await page.locator('#post-editor input[name="title"]').fill('First photo-led Corner story');
 await page.locator('#post-editor textarea[name="body"]').fill('Two photographs with captions, tested in a real mobile browser.');
 const input=page.locator('#editor-upload input[type="file"]');
 await input.waitFor({state:'visible'});
 await input.setInputFiles([
  {name:'photo-one.png',mimeType:'image/png',buffer:png},
  {name:'photo-two.png',mimeType:'image/png',buffer:png}
 ]);
 const cards=page.locator('#editor-upload .upload-preview-card');
 assert.equal(await cards.count(),2,'Both selected files get individual local previews');
 await cards.nth(0).locator('input[name="alt"]').fill('First little photograph');
 await cards.nth(0).locator('input[name="caption"]').fill('A new Corner beginning.');
 await cards.nth(1).locator('input[name="alt"]').fill('Second little photograph');
 await cards.nth(1).locator('input[name="caption"]').fill('One more quiet moment.');
 await page.locator('#editor-upload button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#editor-media .media-thumb').length===2,null,{timeout:18000});
 assert.equal(await page.locator('[data-editor-photo-preview] img').count(),1,'Attached image appears in Studio card preview');
 const inline=page.locator('#editor-media form[data-media-quick-edit]');
 assert.equal(await inline.count(),2,'Every existing image has inline caption editor');
 await inline.nth(1).locator('input[name="caption"]').fill('Second caption updated.');
 await inline.nth(1).locator('button[type="submit"]').click();
 await page.getByText('Caption and description saved.').first().waitFor({timeout:12000});
 await page.locator('#publish-post').click();
 await page.waitForFunction(async()=>{
  try{
   const response=await fetch('/corner/api/admin/posts?state=published',{credentials:'same-origin'});
   if(!response.ok)return false;
   const json=await response.json();
   return json.data.some(post=>post.title==='First photo-led Corner story');
  }catch{return false}
 },null,{timeout:15000});
 const slug=await page.evaluate(async()=>{
  const r=await fetch('/corner/api/admin/posts?state=published',{credentials:'same-origin'});
  const j=await r.json();return j.data.find(p=>p.title==='First photo-led Corner story')?.slug;
 });
 assert.ok(slug,'Test post was published');
 await page.goto(base+'/post/'+encodeURIComponent(slug),{waitUntil:'networkidle'});
 const images=page.locator('.post-gallery-item .post-photo');
 assert.equal(await images.count(),2,'Both photos are publicly rendered');
 await page.getByText('A new Corner beginning.').waitFor();
 await page.getByText('Second caption updated.').waitFor();
 const overflow=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert.ok(overflow.content<=overflow.viewport+1,'No mobile article horizontal overflow: '+JSON.stringify(overflow));
 await images.first().click();
 const dialog=page.locator('dialog[data-post-lightbox]');
 await dialog.waitFor({state:'visible'});
 assert.equal(await dialog.locator('[data-post-counter]').textContent(),'1 / 2');
 assert.equal(await dialog.locator('figcaption').textContent(),'A new Corner beginning.');
 await page.keyboard.press('ArrowRight');
 assert.equal(await dialog.locator('[data-post-counter]').textContent(),'2 / 2');
 assert.equal(await dialog.locator('figcaption').textContent(),'Second caption updated.');
 await page.keyboard.press('Escape');
 await dialog.waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-post-photo')),true,'Keyboard focus returns to selected photo');
 fs.mkdirSync('screenshots',{recursive:true});
 await page.screenshot({path:'screenshots/corner-photo-post-mobile.png',fullPage:true,animations:'disabled'});
 assert.deepEqual(browserErrors,[],'No client JavaScript runtime errors');
 await page.close();
 console.log('PASS: mobile photo selection, draft creation, multi-upload, captions, edit, publish, public gallery, keyboard viewer and security');
}finally{
 await browser.close();
 child.kill('SIGTERM');await sleep(220);
 fs.rmSync(dir,{recursive:true,force:true});
}
