import {verifyAnalyticsPopups} from './analytics-popup-acceptance.mjs';
import {verifyAdvancedAnalytics} from './advanced-analytics-acceptance.mjs';
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
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'reading-analytics-'));
const screenshots=path.join(root,'screenshots','reading-analytics');await fs.mkdir(screenshots,{recursive:true});
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
try{
 const origin=await ready;browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const admin=await browser.newContext({reducedMotion:'reduce'}),ownerPage=await admin.newPage();
 await ownerPage.goto(origin+'/corner/admin');await ownerPage.locator('#admin-login input[name=email]').fill(owner);await ownerPage.locator('#admin-login input[name=password]').fill(secret);await ownerPage.locator('#admin-login button[type=submit]').click();await ownerPage.locator('#admin-view').waitFor();
 const postRequest=await admin.request.post(origin+'/corner/api/admin/posts',{headers:{Origin:origin},data:{type:'tech_note',title:'Analytics isolated article',body:Array(35).fill('A readable public paragraph for a temporary automated test.').join('\n\n'),allow_reactions:true,allow_comments:true}});
 assert.equal(postRequest.status(),200);const post=(await postRequest.json()).data;
 const published=await admin.request.post(origin+'/corner/api/admin/posts/'+post.id+'/publish',{headers:{Origin:origin}});assert.equal(published.status(),200);
 const guest=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await guest.newPage(),sent=[],exceptions=[];
 page.on('pageerror',error=>exceptions.push(error.message));page.on('request',r=>{if(r.url().endsWith('/api/analytics/reading'))sent.push({method:r.method(),body:r.postDataJSON()})});
 await page.goto(origin+'/corner');
 await page.locator('#reading-preferences').waitFor({state:'attached'});
 assert.equal(await page.locator('#reading-preferences').isVisible(),false,'Analytics consent controls are hidden on the reading feed');
 assert.equal(sent.length,0);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('corner-reading-journey-v1')),null,'No journey ID before consent');
 await page.goto(origin+'/corner/privacy');
 await page.locator('#reading-preferences').waitFor({state:'visible'});
 await page.locator('#reading-preferences summary').click();
 await page.locator('[data-reading-allow]').click();
 await page.goto(origin+'/corner');
 await page.waitForFunction(()=>document.querySelector('[data-reading-choice]')?.textContent==='On');
 await page.waitForRequest(r=>r.url().endsWith('/api/analytics/reading')&&r.method()==='POST',{timeout:1000}).catch(()=>{});
 assert.ok(sent.length>=1);
 const first=sent[0].body;assert.equal(first.page,'feed');assert.ok(first.view&&first.journey);
 await page.goto(origin+'/corner/post/'+post.slug);await page.locator('[data-reading-feedback]').waitFor();await page.evaluate(()=>scrollTo(0,document.querySelector('.post-body').getBoundingClientRect().bottom+scrollY-innerHeight+20));
 await new Promise(r=>setTimeout(r,11500));await page.evaluate(()=>dispatchEvent(new Event('scroll')));
 await page.waitForFunction(()=>document.querySelector('[data-reading-choice]').textContent==='On');
 assert.ok(sent.some(r=>r.body?.page==='story'&&r.body?.journey===first.journey));assert.ok(sent.some(r=>r.body?.depth===90&&r.body?.activeMs>=10000),'Observed article depth with visible active time');
 await page.locator('[data-reading-feedback] summary').click();await page.getByLabel('Reading experience').selectOption('too_long');await page.getByRole('button',{name:'Send optional feedback'}).click();assert.ok(sent.some(r=>r.body?.reason==='too_long'));
 for(const r of sent.filter(r=>r.method==='POST')){assert.deepEqual(Object.keys(r.body).sort(),['action','activeMs','depth','device','issue','journey','page','post','reason','source','v','view'].sort());assert.ok(!JSON.stringify(r.body).includes('A readable public paragraph'))}
 // Real API failures must not accept arbitrary personal data or private content.
 const hostile=await guest.request.post(origin+'/corner/api/analytics/reading',{headers:{Origin:origin},data:{...first,email:'must-not-collect@example.test'}});assert.equal(hostile.status(),400);
 const badOrigin=await guest.request.post(origin+'/corner/api/analytics/reading',{headers:{Origin:'https://not-the-site.example'},data:first});assert.equal(badOrigin.status(),403);
 const unauthorized=await guest.request.get(origin+'/corner/api/admin/analytics/reading');assert.equal(unauthorized.status(),401);
 await page.goto(origin+'/corner/privacy');
 await page.locator('#reading-preferences').waitFor({state:'visible'});
 await page.locator('#reading-preferences summary').click();
 await page.locator('[data-reading-deny]').click();
 await page.waitForFunction(()=>document.querySelector('[data-reading-choice]').textContent==='Off');
 const count=sent.filter(r=>r.method==='POST').length;
 await page.goto(origin+'/corner');await page.evaluate(()=>dispatchEvent(new Event('scroll')));
 await new Promise(r=>setTimeout(r,1200));
 assert.equal(sent.filter(r=>r.method==='POST').length,count);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('corner-reading-journey-v1')),null);assert.ok(sent.some(r=>r.method==='DELETE'));
 const {Store}=await import('../corner/src/store.mjs');const fixtureStore=new Store(path.join(dir,'corner.sqlite'));
 assert.equal(fixtureStore.one('SELECT count(*) n FROM reading_views').n,0,'Revoking current tab removes its observations');
 // Seed synthetic cohorts in the isolated test DB only; never production statistics.
 const {ReadingAnalytics}=await import('../corner/src/reading-analytics.mjs');let stamp=new Date(Date.now()-7200000);const localReading=new ReadingAnalytics(fixtureStore,{secret:env.SESSION_SECRET,clock:()=>stamp}),token=n=>n.toString(16).padStart(32,'0');
 for(let i=1;i<=40;i++){
  stamp=new Date(Date.now()-7200000);const base={v:1,view:token(i),journey:token(i+1000),page:'feed',post:null,device:i%2?'mobile':'desktop',source:'search',depth:0,activeMs:0};localReading.collect(base);
  if(i<=30){stamp=new Date(stamp.getTime()+60000);const story={...base,view:token(i+100),page:'story',post:post.id,source:'internal'};localReading.collect(story);if(i<=20){stamp=new Date(stamp.getTime()+20000);localReading.collect({...story,depth:90,activeMs:20000})}if(i<=10){stamp=new Date(stamp.getTime()+1000);localReading.collect({...story,depth:90,activeMs:21000,action:'share',reason:'finished'})}}
 }
 const firstDate=new Date(Date.now()-7200000+330*60000).toISOString().slice(0,10),lastDate=new Date(Date.now()+330*60000).toISOString().slice(0,10);
 const reportResponse=await admin.request.get(origin+'/corner/api/admin/analytics/reading?range=custom&start='+firstDate+'&end='+lastDate+'&compare=none');assert.equal(reportResponse.status(),200);assert.equal(reportResponse.headers()['cache-control'],'private, no-store');const report=(await reportResponse.json()).data;
 assert.deepEqual(report.funnel.steps.map(s=>s.value),[40,30,20,10]);assert.ok(!JSON.stringify(report).includes('journey_key'));assert.ok(!JSON.stringify(report).includes('view_key'));
 await ownerPage.goto(origin+'/corner/admin?ar=custom&start='+firstDate+'&end='+lastDate+'&cmp=none#analytics');
 await ownerPage.locator('.corner-reading-details[open]').waitFor();
 await ownerPage.getByText('Report loaded.',{exact:true}).waitFor();
 assert.equal(await ownerPage.locator('.ca-step').count(),4);
 for(const width of [320,390,600,768,834,1024,1366,1920]){
  await ownerPage.setViewportSize({width,height:width<768?844:800});await ownerPage.evaluate(()=>scrollTo(0,0));
  const geom=await ownerPage.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,sidebar:getComputedStyle(document.querySelector('.admin-sidebar')).position,h1:parseFloat(getComputedStyle(document.querySelector('h1')).fontSize)}));
  assert.ok(geom.scroll<=width+1,'No report overflow '+width);assert.ok(geom.h1<=32);if(width>=768)assert.equal(geom.sidebar,'fixed');
  if([390,1366].includes(width))await ownerPage.screenshot({path:path.join(screenshots,'analytics-'+width+'.png'),fullPage:true});console.log('PASS reading report viewport '+width);
 }
 const advancedLayouts=await verifyAdvancedAnalytics({page:ownerPage,admin,origin,screenshots,firstDate,lastDate});
 await verifyAnalyticsPopups({page:ownerPage,origin,screenshots,firstDate,lastDate});
 await ownerPage.getByRole('button',{name:'Export report',exact:true}).click();
 const downloadPromise=ownerPage.waitForEvent('download');await ownerPage.getByRole('button',{name:'Export CSV'}).click();const download=await downloadPromise;const csv=await fs.readFile(await download.path(),'utf8');assert.ok(csv.includes('Feed visit')&&csv.includes('40'));assert.ok(!csv.includes('journey_key'));await ownerPage.keyboard.press('Escape');
 await ownerPage.getByRole('button',{name:'Date range and filters',exact:true}).click();await ownerPage.getByLabel('Reading period').selectOption('custom');await ownerPage.getByLabel('Reading start date').fill('2026-10-10');await ownerPage.getByLabel('Reading end date').fill('2026-10-01');await ownerPage.getByRole('button',{name:'Apply',exact:true}).click();await ownerPage.getByRole('alert').waitFor();assert.equal(await ownerPage.locator('[data-export]').isDisabled(),true);
 // Deterministic failure state: no stale stats are presented as current numbers.
 await ownerPage.route('**/api/admin/analytics/reading?**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Temporary report failure.'}})}));await ownerPage.getByRole('button',{name:'Refresh',exact:true}).click();await ownerPage.getByText(/Temporary report failure/).waitFor();assert.equal(await ownerPage.locator('.ca-step').count(),0);
 // Browser privacy signals prevent IDs and collection even if a consent cookie exists.
 const dnt=await browser.newContext({extraHTTPHeaders:{DNT:'1'},reducedMotion:'reduce'});await dnt.addCookies([{name:'corner_reading_consent',value:'allow',domain:'127.0.0.1',path:'/corner'}]);await dnt.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'}));const d=await dnt.newPage();let dn=0;d.on('request',r=>{if(r.url().endsWith('/api/analytics/reading'))dn++});await d.goto(origin+'/corner/post/'+post.slug);await d.locator('[data-reading-allow]').waitFor({state:'attached'});assert.equal(await d.locator('[data-reading-allow]').isDisabled(),true);assert.equal(dn,0);assert.equal(await d.evaluate(()=>sessionStorage.getItem('corner-reading-journey-v1')),null);await dnt.close();
 fixtureStore.close();assert.deepEqual(exceptions,[]);await fs.writeFile(path.join(screenshots,'evidence.json'),JSON.stringify({viewports:8,advancedLayouts,orderedFunnel:[40,30,20,10],defaultOff:true,withdrawal:true,dnt:true,privateAPI:true,noPersonalFields:true,readerSnapshots:true,csv:true,failureState:true},null,2));
 console.log('PASS reading consent, observation, withdrawal, DNT, owner report, 40→30→20→10 funnel, CSV and safe error states');
}finally{await browser?.close();await vite?.close();child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1500))]);if(child.exitCode===null)child.kill('SIGKILL');await fs.rm(dir,{recursive:true,force:true})}
