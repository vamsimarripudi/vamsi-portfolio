/** Real local React + PostgreSQL collector/report tests. Only isolated test sessions/data. */
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer as createVite} from 'vite';
import {chromium} from 'playwright';
import {siteDatabase} from '../tests/fixtures/site-db.mjs';
import {createWebsiteCollector,siteCookies} from '../server/site-analytics-handler.js';
import {ensureWebsiteSchema,collectWebsite} from '../server/site-analytics-store.js';
import {loadWebsiteAnalytics} from '../server/site-analytics-report.js';
import {createAnalyticsHandler} from '../server/track-analytics-handler.js';
const {db,sql}=await siteDatabase(),secret=randomBytes(40).toString('hex'),ownerToken=randomBytes(40).toString('hex');
const initialize=s=>ensureWebsiteSchema(s,true);await initialize(sql);
const owner=(req,res)=>{if(siteCookies(req.headers.cookie).vm_track_session===ownerToken)return {owner_email:'connect@vamsimarripudi.me'};res.status(401).json({ok:false,message:'Owner authentication required.'});return null};
const collector=createWebsiteCollector({database:()=>sql,secret:()=>secret,initialize,env:{NODE_ENV:'test'}});
const analytics=createAnalyticsHandler({authorize:owner,website:input=>loadWebsiteAnalytics(input,{sql,initialize})});
const vite=await createVite({server:{middlewareMode:true},appType:'spa'});let contactRequests=0;
const server=http.createServer(async(req,res)=>{
 try{
  res.status=function(code){this.statusCode=code;return this};res.json=function(body){this.setHeader('content-type','application/json');this.end(JSON.stringify(body))};
  const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);
  if(url.pathname.startsWith('/api/')){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000){res.status(413).json({ok:false});return}}try{req.body=raw?JSON.parse(raw):{}}catch{res.status(400).json({ok:false});return}
   if(url.pathname==='/api/website/events')return await collector(req,res);
   if(url.pathname==='/api/track/analytics')return await analytics(req,res);
   if(url.pathname==='/api/track/auth/session'){if(owner(req,res))res.json({ok:true,owner:'connect@vamsimarripudi.me'});return}
   if(url.pathname==='/api/track/auth/logout'){res.setHeader('Set-Cookie','vm_track_session=; Max-Age=0; Path=/');return res.json({ok:true})}
   if(url.pathname==='/api/track/enquiries'){if(owner(req,res))res.json({ok:true,items:[],total:0});return}
   if(url.pathname==='/api/track/metrics'){if(owner(req,res))res.json({ok:true,metrics:{total:0,new_count:0}});return}
   if(url.pathname==='/api/contact'){contactRequests++;return res.json({ok:true,referenceId:'VM-ENQ-TEST',message:'Isolated test acceptance; no email sent.'})}
   return res.status(404).json({ok:false});
  }
  return vite.middlewares(req,res);
 }catch(error){console.error('Fixture failure',error.code||error.message);if(!res.writableEnded)res.status(500).json({ok:false,message:'Test fixture failed.'})}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const screenshots='screenshots/website-analytics';await mkdir(screenshots,{recursive:true});const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1366,height:900}}),page=await context.newPage(),sent=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/website/events'))sent.push({method:r.method(),body:r.postDataJSON()})});
 await page.goto(origin+'/');await page.locator('#website-analytics-preferences').waitFor();assert.equal(sent.length,0);assert.equal(await page.evaluate(()=>sessionStorage.getItem('vm_site_journey_v1')),null);
 await page.locator('#website-analytics-preferences summary').click();const allowed=page.waitForResponse(r=>r.url().endsWith('/api/website/events')&&r.request().method()==='POST');await page.getByRole('button',{name:'Allow website analytics'}).click();assert.equal((await(await allowed).json()).accepted,true);
 const journey=sent[0].body.journey;
 // Actual React navigation: route changes start page visits without a full reload.
 await page.locator('a[href="/work"]').first().click();await page.waitForFunction(()=>location.pathname==='/work');await page.waitForResponse(r=>r.url().endsWith('/api/website/events')&&r.request().postDataJSON()?.path==='/work').catch(()=>{});
 assert.ok(sent.some(r=>r.body?.path==='/work'&&r.body?.journey===journey));
 await page.goto(origin+'/work/nxtwatch');await page.locator('#website-analytics-preferences').waitFor();await page.goto(origin+'/contact');await page.locator('[data-site-contact]').waitFor();
 const form=page.locator('[data-site-contact]');await form.getByLabel('Name',{exact:true}).fill('Private Test Name');await form.getByLabel('Email',{exact:true}).fill('private-test@example.test');await form.getByLabel('Message',{exact:true}).fill('This is a private test contact message, never analytics.');
 const success=page.waitForResponse(r=>r.url().endsWith('/api/website/events')&&r.request().postDataJSON()?.action==='contact_success');await form.getByRole('button',{name:'Send message'}).click();assert.equal((await(await success).json()).accepted,true);assert.equal(contactRequests,1);
 for(const event of sent.filter(x=>x.method==='POST')){const json=JSON.stringify(event.body);assert.ok(!json.includes('Private Test')&&!json.includes('example.test')&&!json.includes('contact message')&&!json.includes('VM-ENQ-TEST'))}
 await page.goto(origin+'/track');await page.getByRole('heading',{name:'Website workspace',exact:true}).waitFor();const before=sent.length;await page.waitForTimeout(200);assert.equal(sent.length,before,'Private route emits no observations');assert.equal(await page.locator('.ws-page').count(),0);
 await page.goto(origin+'/');await page.locator('#website-analytics-preferences summary').click();const erased=page.waitForResponse(r=>r.url().endsWith('/api/website/events')&&r.request().method()==='DELETE');await page.getByRole('button',{name:'Keep website analytics off'}).click();assert.equal((await(await erased).json()).accepted,true);assert.equal((await sql.query('SELECT count(*)::int n FROM site_analytics_views'))[0].n,0);
 console.log('PASS public-site scope, actual SPA navigation, contact outcome, PII exclusion and withdrawal');
 // Seed precise synthetic cohorts solely in the test database, leaving the production database untouched.
 const token=n=>n.toString(16).padStart(32,'0'),base=new Date(Date.now()-7200000),data=(i,j,path,action='')=>({v:1,view:token(i),journey:token(j),path,device:j%2?'mobile':'desktop',source:'search',depth:0,activeMs:0,section:'main',action,issue:''});
 for(let j=1;j<=40;j++){
  await collectWebsite(data(j*10,j,'/'),{sql,secret,now:base});if(j<=30)await collectWebsite(data(j*10+1,j,'/work/nxtwatch'),{sql,secret,now:new Date(+base+1000)});
  if(j<=20){const contact=data(j*10+2,j,'/contact','contact_start');await collectWebsite(contact,{sql,secret,now:new Date(+base+2000)});if(j<=10)await collectWebsite({...contact,action:'contact_success',depth:90,activeMs:15000},{sql,secret,now:new Date(+base+17000)})}
 }
 const first=new Date(+base+330*60000).toISOString().slice(0,10),last=new Date(Date.now()+330*60000).toISOString().slice(0,10),reportURL=origin+'/track?source=website&range=custom&start='+first+'&end='+last+'&compare=none';
 await context.addCookies([{name:'vm_track_session',value:ownerToken,url:origin}]);await page.goto(reportURL);await page.getByRole('heading',{name:'Website analytics',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('.ws-metrics article').length===4);assert.equal(await page.locator('.ws-metrics article').first().locator('strong').innerText(),'90');
 assert.equal(await page.locator('.ws-toolbar a').count(),0,'No Google header link');
 let layouts=0,popups=0;
 for(const width of [320,390,600,768,834,1024,1366,1920]){
  await page.setViewportSize({width,height:width<768?844:900});
  for(const tab of ['Overview','Journeys','Pages','Quality']){await page.getByRole('tab',{name:tab,exact:true}).click();await page.evaluate(()=>scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Website dashboard overflow '+tab+' '+width);layouts++}
  await page.getByRole('tab',{name:'Overview',exact:true}).click();
  if([390,1366].includes(width))await page.screenshot({path:screenshots+'/website-'+width+'.png',fullPage:true});
  for(const name of ['Audience overview','Devices','Export report','Date range and filters','More options']){
   const trigger=page.getByRole('button',{name,exact:true});await trigger.click();const dialog=page.getByRole('dialog');assert.equal(await dialog.evaluate(d=>d.open),true);const box=await dialog.boundingBox();assert.ok(box.x>=-1&&box.x+box.width<=width+1,'Popup fits '+name+' '+width);assert.ok(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+1),'Popup content fits '+name+' '+width);
   if(name==='Devices'&&[390,1366].includes(width))await page.screenshot({path:screenshots+'/devices-'+width+'.png',fullPage:true});
   await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await trigger.evaluate(el=>document.activeElement===el),true,'Focus returns '+name);popups++;
  }
 }
 await page.getByRole('button',{name:'Export report',exact:true}).click();const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const download=await dl;assert.match(download.suggestedFilename(),/vamsimarripudi.me/);await page.keyboard.press('Escape');
 await page.getByRole('link',{name:'Enquiries',exact:true}).click();await page.getByRole('heading',{name:'Incoming enquiries',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/track/enquiries');
 await page.getByRole('link',{name:'Website analytics',exact:true}).click();await page.getByRole('heading',{name:'Website analytics',exact:true}).waitFor();
 await page.route('**/api/track/analytics?**',r=>r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,message:'Expired'})}));await page.getByRole('button',{name:'Refresh analytics',exact:true}).click();await page.getByRole('heading',{name:'Website workspace',exact:true}).waitFor();assert.equal(await page.locator('.ws-metrics').count(),0,'Expired auth clears metrics');
 const dnt=await browser.newContext({extraHTTPHeaders:{DNT:'1'},reducedMotion:'reduce'});await dnt.addCookies([{name:'vm_site_analytics',value:'allow',url:origin}]);await dnt.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'}));const d=await dnt.newPage();let blocked=0;d.on('request',r=>{if(r.url().endsWith('/api/website/events'))blocked++});await d.goto(origin+'/');await d.locator('[data-site-allow]').waitFor({state:'attached'});assert.equal(await d.locator('[data-site-allow]').isDisabled(),true);assert.equal(blocked,0);assert.equal(await d.evaluate(()=>sessionStorage.getItem('vm_site_journey_v1')),null);await dnt.close();
 assert.deepEqual(errors,[]);await writeFile(screenshots+'/evidence.json',JSON.stringify({layouts,popups,websiteScope:true,spa:true,contactFlow:true,piiExcluded:true,withdrawal:true,dnt:true,enquiriesPreserved:true,authFailureClears:true},null,2));console.log('PASS '+layouts+' /track layouts, '+popups+' popups, existing enquiry access and auth/session boundaries');
}finally{await browser.close();await vite.close();await new Promise(r=>server.close(r));await db.close()}
