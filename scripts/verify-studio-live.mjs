/** Local-only acceptance: real isolated Corner sign-in, every public page, V3 and reflow.
 * No production database, mailbox, credentials, or session is used by this suite. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer as createVite } from 'vite';
import { passwordHash } from '../corner/src/auth.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'platform-comfort-'));
const screenshots=path.join(root,'screenshots','studio-live');await fs.mkdir(screenshots,{recursive:true});
const owner='comfort-owner@example.test',secret=crypto.randomBytes(30).toString('base64url');
const env={...process.env,NODE_ENV:'test',DEMO_CONTENT:'0',HOST:'127.0.0.1',PORT:'0',SITE_URL:'http://127.0.0.1/corner',CORNER_BASE_PATH:'/corner',
 DATA_DIR:dir,DB_PATH:path.join(dir,'corner.sqlite'),ADMIN_EMAIL:owner,ADMIN_PASSWORD_HASH:passwordHash(secret),SESSION_SECRET:crypto.randomBytes(48).toString('hex'),
 CORNER_AUTH_REGISTRATION_ENABLED:'1',CORNER_AUTH_TEST_OUTBOX:path.join(dir,'mail.jsonl'),CORNER_V3_MEMORIES:'1',CORNER_V3_WISHES:'1',CORNER_V3_INSIGHTS:'1',CORNER_V3_LANGUAGES:'1',CORNER_V3_GUESTBOOK:'1',CORNER_V3_SEARCH:'1'};
const child=spawn(process.execPath,['--no-warnings','--input-type=module','-e',`
 import {config} from './src/config.mjs';import {createServer} from './src/server.mjs';
 const server=createServer();server.listen(0,'127.0.0.1',()=>{config.siteUrl='http://127.0.0.1:'+server.address().port+'/corner';console.log('COMFORT_READY '+server.address().port)});
 process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
`],{cwd:path.join(root,'corner'),env,stdio:['ignore','pipe','pipe']});
const ready=new Promise((resolve,reject)=>{
 let out='',errors='';const timer=setTimeout(()=>reject(new Error('Corner fixture start timed out')),15000);
 child.stderr.on('data',b=>{errors+=String(b)});
 child.stdout.on('data',b=>{out+=String(b);const m=out.match(/COMFORT_READY (\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1])}});
 child.on('exit',code=>{clearTimeout(timer);reject(new Error('Corner fixture exited '+code+' '+errors.slice(-500)))})
});
let vite,browser;
const evidence={viewports:[],routes:new Set(),checks:0};
const widths=[320,390,600,768,834,1024,1366,1920];
try{
 const corner=await ready;console.log('READY fixture');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1366,height:625},reducedMotion:'no-preference'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(corner+'/corner/admin');await page.locator('#admin-login input[name=email]').fill(owner);await page.locator('#admin-login input[name=password]').fill(secret);await page.locator('#admin-login button[type=submit]').click();await page.locator('.admin-shell').waitFor();console.log('SIGNED IN');
 const navigation=async(view,p=page)=>{console.log('NAV',view,p.viewportSize().width);
  await p.locator('[data-admin-view="'+view+'"]').click();
  await p.waitForFunction(view=>document.querySelector('#admin-heading')?.textContent.startsWith(view[0].toUpperCase()+view.slice(1))&&!document.querySelector('.admin-loading'),view);
 };
 const geometry=async(p,label)=>{
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const data=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,main:document.querySelector('.admin-main').getBoundingClientRect().toJSON(),sidebar:document.querySelector('.admin-sidebar').getBoundingClientRect().toJSON(),heading:document.querySelector('h1').getBoundingClientRect().toJSON(),position:getComputedStyle(document.querySelector('.admin-sidebar')).position}));
  assert.ok(data.scrollWidth<=data.width+1,label+' overflows '+JSON.stringify(data));
  if(data.width>=768){assert.equal(data.position,'fixed',label+' fixed rail');assert.ok(data.main.y<=24,label+' vertically centred '+data.main.y);assert.ok(data.heading.y<85,label+' heading starts too low '+data.heading.y)}
  else{assert.ok(data.sidebar.height<=150,label+' mobile header too tall');assert.ok(data.heading.y<225,label+' mobile content too low')}
  evidence.checks++;return data;
 };
 for(const width of widths){
  await page.setViewportSize({width,height:width<768?844:625});await page.evaluate(()=>scrollTo(0,0));
  for(const view of ['posts','media','comments','analytics','settings']){await navigation(view);await geometry(page,view+' '+width)}
  if([390,1366].includes(width))await page.screenshot({path:path.join(screenshots,'studio-'+width+'.png'),fullPage:false});
 }
 await page.setViewportSize({width:1366,height:625});await navigation('posts');await page.locator('#new-post').click();await page.locator('#post-editor').waitFor();
 await page.locator('#post-editor input[name=title]').fill('A live story');await page.locator('#post-editor textarea[name=body]').fill('First line\nSecond line');await page.locator('#post-editor input[name=emoji]').fill('✨');
 assert.equal(await page.locator('.preview-story-body').textContent(),'First line\nSecond line');assert.equal(await page.locator('.preview-symbol').textContent(),'✨');
 await page.locator('#save-post').click();await page.waitForFunction(()=>document.querySelector('#save-indicator').textContent.startsWith('Saved'));
 await page.locator('#post-editor textarea[name=body]').fill('Draft autosave still works.');await page.waitForFunction(()=>document.querySelector('#save-indicator').textContent.startsWith('Saved'));
 const sidebarBefore=await page.locator('.admin-sidebar').boundingBox();await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));assert.ok(await page.evaluate(()=>scrollY)>0);const sidebarAfter=await page.locator('.admin-sidebar').boundingBox();assert.equal(sidebarBefore.y,sidebarAfter.y,'Sidebar anchored while document scrolls');
 await page.locator('[data-studio-collapse]').click();assert.equal(await page.locator('html').getAttribute('data-studio-collapsed'),'true');assert.ok((await page.locator('.admin-sidebar').boundingBox()).width<90);await page.locator('[data-studio-collapse]').click();
 await page.goto(corner+'/corner/admin/v3/wishes');await page.locator('[data-v3w-form]').waitFor();assert.equal(await page.locator('.site-header').count(),0,'No public header in private editor');assert.equal(await page.locator('[data-v3w-preview]').count(),0,'Preview button removed');
 console.log('WISHES START');const requests=[];page.on('request',r=>{if(r.url().includes('/api/v1/admin/v3/wishes'))requests.push({method:r.method(),url:r.url()})});
 const form=page.locator('[data-v3w-form]'),title=form.locator('[name=title]'),body=form.locator('[name=body]'),excerpt=form.locator('[name=excerpt]'),emoji=form.locator('[name=emoji]');
 const live=async(key,value)=>{await form.locator('[name='+key+']').fill(value);assert.equal(await page.locator('[data-v3w-'+key+']').textContent(),value)};
 await live('title','A quiet celebration');await live('body','Hello Vam\nA second line.');await live('excerpt','A short note.');await live('emoji','🎉');
 await live('body','<img src=x onerror="window.previewInjected=true">\nతెలుగు');assert.equal(await page.locator('.v3w-preview img').count(),0,'Preview escapes HTML');assert.equal(await page.evaluate(()=>window.previewInjected),undefined);
 assert.deepEqual(requests,[],'Typing is local; no preview/write requests');
 await live('body','Hello Vam\nA second line.');await form.locator('[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-v3w-form] [role=status]').textContent==='Saved privately.');
 const id=await form.locator('[name=id]').inputValue();assert.ok(id);await page.locator('[data-v3w-edit]').first().waitFor();
 await page.locator('[data-v3w-new]').click();assert.equal(await title.inputValue(),'');assert.equal(await page.locator('[data-v3w-body]').textContent(),'');
 await page.locator('[data-v3w-edit]').first().click();assert.equal(await title.inputValue(),'A quiet celebration');assert.equal(await page.locator('[data-v3w-body]').textContent(),'Hello Vam\nA second line.');
 // Delayed real PATCH response: newer typing must survive and remain explicitly unsaved.
 let release;const held=new Promise(r=>release=r);let sent;const started=new Promise(r=>sent=r);
 await page.route('**/api/v1/admin/v3/wishes/'+id,async route=>{if(route.request().method()!=='PATCH')return route.continue();const response=await route.fetch();sent();await held;await route.fulfill({response})});
 await title.fill('Earlier saved title');await form.locator('[type=submit]').click();await started;await title.fill('Newer unsaved title');release();await form.locator('[type=submit]').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-v3w-form] button[type=submit]').disabled);
 assert.equal(await title.inputValue(),'Newer unsaved title');assert.match(await form.locator('[role=status]').textContent(),/Newer edits are not saved/);assert.equal(await page.locator('[data-v3w-title]').textContent(),'Newer unsaved title');
 await page.unroute('**/api/v1/admin/v3/wishes/'+id);
 await page.route('**/api/v1/admin/v3/wishes/'+id,route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:{message:'Edit conflict. Reload the saved version.'}})}));
 await form.locator('[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-v3w-form] [role=status]').textContent.includes('Edit conflict'));assert.equal(await title.inputValue(),'Newer unsaved title');await page.unroute('**/api/v1/admin/v3/wishes/'+id);
 const beforePublish=requests.filter(r=>r.url.endsWith('/publish')).length;await page.locator('[data-v3w-publish]').first().click();assert.equal(requests.filter(r=>r.url.endsWith('/publish')).length,beforePublish,'Cannot accidentally publish stale edits');
 await form.locator('[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-v3w-form] [role=status]').textContent==='Saved privately.');
 for(const width of widths){await page.setViewportSize({width,height:width<768?844:625});await page.evaluate(()=>scrollTo(0,0));await geometry(page,'Wishes '+width);assert.equal(await page.locator('.v3w-preview').isVisible(),true);if([390,1366].includes(width))await page.screenshot({path:path.join(screenshots,'wishes-'+width+'.png'),fullPage:false})}
 await page.setViewportSize({width:1366,height:625});
 await page.waitForFunction(()=>window.gsap?.version==='3.15.0');assert.equal(await page.locator('html').getAttribute('data-studio-motion'),'on');
 const animation=await page.evaluate(()=>{const n=document.querySelector('[data-v3w-count]');n.textContent='107';window.CornerMotion.count(n);return {semantic:n.querySelector('.motion-final')?.textContent,visual:n.querySelector('.motion-visual')?.getAttribute('aria-hidden')}});assert.equal(animation.semantic,'107');assert.equal(animation.visual,'true');
 await page.locator('[data-motion-toggle]').click();assert.equal(await page.locator('html').getAttribute('data-studio-motion'),'off');assert.equal(await page.locator('[data-v3w-count]').first().textContent(),'107','Pause restores final real value');
 await page.locator('[data-motion-toggle]').click();
 await page.locator('[data-v3w-publish]').first().click();await page.waitForFunction(()=>document.querySelector('.v3w-state')?.textContent==='published');
 assert.equal(requests.filter(r=>r.url.endsWith('/preview')).length,0);assert.equal(requests.filter(r=>r.url.endsWith('/notify')).length,0);
 // Public reaction feedback must follow a real successful mutation, not speculative increments.
 const drafts=await context.request.get(corner+'/corner/api/admin/posts?state=draft');const story=(await drafts.json()).data.find(p=>p.title==='A live story');assert.ok(story);const pub=await context.request.post(corner+'/corner/api/admin/posts/'+story.id+'/publish',{headers:{Origin:corner}});assert.equal(pub.status(),200);const published=(await pub.json()).data;assert.ok(published.slug);
 await page.goto(corner+'/corner/post/'+published.slug);await page.waitForFunction(()=>window.gsap);const reaction=page.locator('.reactions button').first();await reaction.click();await page.waitForFunction(()=>document.querySelector('.reactions button').getAttribute('aria-pressed')==='true');await page.waitForFunction(()=>document.querySelector('.reactions button span').textContent==='1');assert.ok(await reaction.locator('[data-reaction-glyph]').count());
 const reduced=await browser.newContext({storageState:await context.storageState(),reducedMotion:'reduce'}),r=await reduced.newPage();let vendor=0;r.on('request',req=>{if(req.url().includes('/vendor/gsap'))vendor++});await r.goto(corner+'/corner/admin/v3/wishes');await r.locator('[data-v3w-form]').waitFor();await r.locator('[name=title]').fill('Reduced motion still previews');assert.equal(await r.locator('[data-v3w-title]').textContent(),'Reduced motion still previews');assert.equal(vendor,0);assert.equal(await r.locator('html').getAttribute('data-studio-motion'),'off');await reduced.close();
 const fallback=await browser.newContext({storageState:await context.storageState()}),f=await fallback.newPage();await f.route('**/vendor/gsap*',route=>route.abort());await f.goto(corner+'/corner/admin/v3/wishes');await f.locator('[name=title]').fill('Works without animation library');assert.equal(await f.locator('[data-v3w-title]').textContent(),'Works without animation library');await fallback.close();
 assert.deepEqual(errors,[],'No browser exceptions');
 await fs.writeFile(path.join(screenshots,'evidence.json'),JSON.stringify({checks:evidence.checks,widths,localPreview:true,slowSaveSafe:true,conflictSafe:true,sidebarFixed:true,reducedMotion:true,animationFallback:true,realReactions:true},null,2));
 console.log('PASS Studio live preview, saved editing, slow-save/conflict safety, fixed/collapsed rail, 48 geometry checks, real reactions, GSAP/reduced-motion/failure fallback');
}finally{await browser?.close();await vite?.close();child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1500))]);if(child.exitCode===null)child.kill('SIGKILL');await fs.rm(dir,{recursive:true,force:true})}
