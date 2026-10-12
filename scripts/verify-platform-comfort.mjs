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
const screenshots=path.join(root,'screenshots','comfort');await fs.mkdir(screenshots,{recursive:true});
const owner='comfort-owner@example.test',secret=crypto.randomBytes(30).toString('base64url');
const env={...process.env,NODE_ENV:'test',DEMO_CONTENT:'1',HOST:'127.0.0.1',PORT:'0',SITE_URL:'http://127.0.0.1/corner',CORNER_BASE_PATH:'/corner',
 DATA_DIR:dir,DB_PATH:path.join(dir,'corner.sqlite'),ADMIN_EMAIL:owner,ADMIN_PASSWORD_HASH:passwordHash(secret),SESSION_SECRET:crypto.randomBytes(48).toString('hex'),
 CORNER_AUTH_REGISTRATION_ENABLED:'1',CORNER_AUTH_TEST_OUTBOX:path.join(dir,'mail.jsonl'),CORNER_V3_MEMORIES:'1',CORNER_V3_WISHES:'1',CORNER_V3_INSIGHTS:'1',CORNER_V3_LANGUAGES:'1',CORNER_V3_GUESTBOOK:'1',CORNER_V3_EXPLORE:'1'};
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
const sizes=process.env.COMFORT_REFLOW_ONLY?[]:[[320,568],[360,640],[375,667],[390,844],[430,932],[600,900],[768,1024],[834,1112],[1024,600],[1280,720],[1366,625],[1440,900],[1920,1080],[844,390]];
try {
 const corner=await ready;
 vite=await createVite({root,server:{host:'127.0.0.1',port:0},logLevel:'error'});await vite.listen();
 const portfolio='http://127.0.0.1:'+vite.httpServer.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const auth=await browser.newContext({reducedMotion:'reduce'}),publicContext=await browser.newContext({reducedMotion:'reduce'});
 const login=await auth.newPage();await login.goto(corner+'/corner/admin');
 await login.locator('#admin-login input[name=email]').fill(owner);await login.locator('#admin-login input[name=password]').fill(secret);
 await login.locator('#admin-login button[type=submit]').click();await login.locator('.admin-shell').waitFor({timeout:12000});await login.close();
 const check=async(page,label,{scale=1,fit=false}={})=>{
  await page.locator('h1').first().waitFor({timeout:10000});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const data=await page.evaluate(()=>{
   const visible=n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
   const headings=[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(n=>({tag:n.tagName,size:parseFloat(getComputedStyle(n).fontSize),text:n.textContent.slice(0,45)}));
   const fields=[...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select')].filter(visible).map(n=>({name:n.name,ui:getComputedStyle(n).getPropertyValue('--ui-body'),size:parseFloat(getComputedStyle(n).fontSize),width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right}));
   const card=document.querySelector('.signin-box'),back=card?.querySelector(':scope>a'),submit=card?.querySelector('button[type=submit]');
   return {rootFont:getComputedStyle(document.documentElement).fontSize,style:document.querySelector('style:last-of-type')?.textContent,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,headings,fields,
    login:card?{height:card.getBoundingClientRect().height,submitBottom:submit.getBoundingClientRect().bottom,backBottom:back.getBoundingClientRect().bottom}:null};
  });
  assert.ok(data.scrollWidth<=data.width+1,label+' horizontal overflow '+JSON.stringify(data));
  for(const h of data.headings)assert.ok(h.size<=({H1:32,H2:24,H3:20}[h.tag])*scale+.1,label+' oversized '+JSON.stringify(h));
  for(const f of data.fields)assert.ok(f.size>=16*scale-.1,label+' small input '+JSON.stringify({f,root:data.rootFont,style:data.style}));
  if(fit){assert.ok(data.login&&data.login.backBottom<=data.height+.5,label+' login back link outside viewport');assert.ok(data.login.submitBottom<=data.height+.5,label+' submit outside viewport');assert.ok(data.scrollHeight<=data.height+1,label+' login unnecessarily scrolls')}
  evidence.routes.add(label.split(' @')[0]);evidence.checks++;return data;
 };
 const publicRoutes=['/','/now','/work','/engineering','/lab','/writing','/journey','/resume','/uses','/contact','/privacy','/terms','/faq','/changelog','/birthday','/not-found','/offline','/error','/maintenance','/rate-limited','/track'];
 const cornerRoutes=['/corner','/corner/about','/corner/admin','/corner/login','/corner/register','/corner/forgot-password','/corner/reset-password','/corner/verify-email','/corner/resend-verification','/corner/admin/register'];
 const privateRoutes=['/corner/admin','/corner/profile','/corner/settings/profile','/corner/settings/security','/corner/admin/v3/memories','/corner/admin/v3/wishes','/corner/admin/v3/insights','/corner/admin/v3/languages'];
 for(const [width,height] of sizes){
  const p=await publicContext.newPage();await p.setViewportSize({width,height});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  // Auth and main compositions at every width; complete route sweep on phone/tablet/laptop.
  const full=[390,768,1366].includes(width);
  for(const route of full?publicRoutes:['/','/contact','/track']){
   await p.goto(portfolio+route,{waitUntil:'domcontentloaded'});await check(p,route+' @'+width);
  }
  for(const route of full?cornerRoutes:['/corner','/corner/admin','/corner/login']){
   await p.goto(corner+route,{waitUntil:'domcontentloaded'});const result=await check(p,route+' @'+width,{fit:route==='/corner/admin'&&height>=568});
   if(route==='/corner/admin'){evidence.viewports.push({width,height,heading:result.headings[0].size,...result.login});
    if([390,1366].includes(width))await p.screenshot({path:path.join(screenshots,'signin-'+width+'.png'),animations:'disabled'});
   }
  }
  // Actual published reader URL is discovered from the demo feed, not invented.
  if(full){await p.goto(corner+'/corner');const href=await p.locator('.story-copy h2 a').first().getAttribute('href');if(href){await p.goto(new URL(href,corner).href);await check(p,'Corner story @'+width)}
   for(const section of ['work','writing']){await p.goto(portfolio+'/'+section);const href=await p.locator(`a[href^="/${section}/"]`).first().getAttribute('href').catch(()=>null);if(href){await p.goto(portfolio+href);await check(p,section+' detail @'+width)}}
  }
  assert.deepEqual(errors,[],'Public browser errors '+width);await p.close();
  const a=await auth.newPage();await a.setViewportSize({width,height});
  for(const route of full?privateRoutes:['/corner/admin']){const response=await a.goto(corner+route,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,route);assert.equal(await a.locator('.signin-box').count(),0,'Owner session required '+route);await check(a,'Private '+route+' @'+width)}
  await a.goto(corner+'/corner/admin');await a.locator('#create-from-overview').click();await a.locator('#post-editor').waitFor();await check(a,'Studio editor @'+width);
  if([390,1366].includes(width))await a.screenshot({path:path.join(screenshots,'editor-'+width+'.png'),animations:'disabled'});
  await a.close();console.log('PASS platform viewport '+width+'x'+height);
 }
 // User text-size overrides (not pinch zoom), 320-CSS-pixel reflow, and WCAG text spacing.
 for(const mode of ['text-200','text-spacing','short-keyboard']){
  // Test-only bypass permits injection of user styles; production CSP is never changed.
  const overrideContext=await browser.newContext({bypassCSP:true,reducedMotion:'reduce'});
  const p=await overrideContext.newPage();await p.setViewportSize({width:mode==='short-keyboard'?390:320,height:mode==='short-keyboard'?360:640});
  for(const route of ['/corner/admin','/corner/login','/','/contact','/track']){
   await p.goto((route.startsWith('/corner')?corner:portfolio)+route,{waitUntil:'domcontentloaded'});await p.locator('h1').first().waitFor();
   if(mode==='text-200')await p.addStyleTag({content:'html{font-size:200%!important}'});
   if(mode==='text-spacing')await p.addStyleTag({content:'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'});
   await check(p,route+' '+mode,{scale:mode==='text-200'?2:1});
   const submit=p.locator('form button[type=submit]').first();if(await submit.count()){await submit.scrollIntoViewIfNeeded();const box=await submit.boundingBox();assert.ok(box&&box.y>=-.5&&box.y+box.height<=p.viewportSize().height+1,'Submit reachable '+route+' '+mode)}
  }await overrideContext.close();console.log('PASS '+mode);
 }
 await fs.writeFile(path.join(screenshots,'evidence.json'),JSON.stringify({...evidence,routes:[...evidence.routes]},null,2));
 console.log('PASS '+evidence.checks+' layout checks across '+evidence.routes.size+' route/state combinations');
}finally{
 await browser?.close();await vite?.close();child.kill('SIGTERM');
 await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,1500))]);if(child.exitCode===null)child.kill('SIGKILL');await fs.rm(dir,{recursive:true,force:true});
}
