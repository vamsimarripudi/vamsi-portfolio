import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {websitePath,validateWebsiteSignal} from '../public/site-analytics-contract.mjs';
import {ensureWebsiteSchema,collectWebsite,revokeWebsite,limitWebsite,websiteHash} from '../server/site-analytics-store.js';
import {createWebsiteCollector} from '../server/site-analytics-handler.js';
import {websiteRange,websiteReport,loadWebsiteAnalytics} from '../server/site-analytics-report.js';
import {createAnalyticsHandler} from '../server/track-analytics-handler.js';
import {siteDatabase} from './fixtures/site-db.mjs';
const id=n=>n.toString(16).padStart(32,'0'),secret='isolated test signing key';
const signal=(view,journey,path='/',more={})=>({v:1,view:id(view),journey:id(journey),path,device:'desktop',source:'search',depth:0,activeMs:0,section:'main',action:'',issue:'',...more});
const response=()=>({headers:{},status(n){this.statusCode=n;return this},setHeader(k,v){this.headers[k.toLowerCase()]=v},json(body){this.body=body;return this}});
const now=new Date('2026-10-13T10:00:00Z');

test('public website scope includes portfolio and grouped Corner, rejects private routes and personal URLs',()=>{
 for(const path of ['/','/work','/work/nxtwatch','/writing','/contact','/resume'])assert.equal(websitePath(path),path);
 assert.equal(websitePath('/corner/post/a-public-post'),'/corner/post/:story');
 for(const path of ['/track','/track/analytics','/track/enquiries/VM-ENQ-PRIVATE','/corner/admin','/corner/profile','/api/track','/birthday/private-id','/contact?email=a','/work%2fnxtwatch','/does-not-exist'])assert.equal(websitePath(path),null,path);
 for(const edit of [{email:'private@example.test'},{path:'/track'},{path:['/']},{view:[id(1)]},{activeMs:Infinity},{depth:37},{section:'private text'},{source:'https://private.example'},{action:'contact_success'}])assert.throws(()=>validateWebsiteSignal({...signal(1,1),...edit}));
});
test('real SQL schema is additive and idempotent, snapshots deduplicate and bound active time',async()=>{
 const {db,sql}=await siteDatabase();try{
  await db.exec('CREATE TABLE track_enquiries(id text); INSERT INTO track_enquiries VALUES (\'preserve\')');
  await ensureWebsiteSchema(sql,true);await ensureWebsiteSchema(sql,true);
  const p=signal(1,1,'/work');assert.equal((await collectWebsite(p,{sql,secret,now})).accepted,true);
  await collectWebsite(p,{sql,secret,now});assert.equal((await sql.query('SELECT count(*)::int n FROM site_analytics_views'))[0].n,1);
  await collectWebsite({...p,depth:75,activeMs:20000},{sql,secret,now:new Date(now.getTime()+12000)});
  const [row]=await sql.query('SELECT * FROM site_analytics_views');assert.equal(row.active_ms,12000);assert.equal(row.depth,75);assert.ok(row.engaged_at);assert.equal(row.view_key,websiteHash(p.view,secret));assert.notEqual(row.view_key,p.view);
  assert.equal((await collectWebsite({...p,path:'/contact'},{sql,secret,now})).accepted,false);
  assert.equal((await sql.query('SELECT id FROM track_enquiries'))[0].id,'preserve');
 }finally{await db.close()}
});
test('current journey withdrawal prevents delayed collection and is independent of content/enquiries',async()=>{
 const {db,sql}=await siteDatabase();try{await ensureWebsiteSchema(sql,true);const p=signal(1,1);await collectWebsite(p,{sql,secret,now});await revokeWebsite(p.journey,{sql,secret,now});assert.equal((await collectWebsite(p,{sql,secret,now:new Date(now.getTime()+1000)})).accepted,false);assert.equal((await sql.query('SELECT count(*)::int n FROM site_analytics_views'))[0].n,0);
  await limitWebsite(sql,'test',now,2);await limitWebsite(sql,'test',now,2);await assert.rejects(limitWebsite(sql,'test',now,2),e=>e.status===429);
 }finally{await db.close()}
});
test('collector rejects unknown origins/PII before DB access and honors DNT/GPC, owner cookies, preview and consent',async()=>{
 let access=0;const handler=createWebsiteCollector({database:()=>{access++;throw Error('should not query')},env:{}});
 const req=(headers={},body=signal(1,1))=>({method:'POST',headers:{origin:'https://vamsimarripudi.me','content-type':'application/json',...headers},body});
 for(const headers of [{},{cookie:'vm_site_analytics=deny'},{cookie:'vm_site_analytics=allow',dnt:'1'},{cookie:'vm_site_analytics=allow','sec-gpc':'1'},{cookie:'vm_site_analytics=allow; vm_track_session=staff'}]){const r=response();await handler(req(headers),r);assert.equal(r.statusCode,200);assert.equal(r.body.accepted,false)}
 let r=response();await handler(req({origin:'https://malicious.example',cookie:'vm_site_analytics=allow'}),r);assert.equal(r.statusCode,403);
 r=response();await handler(req({cookie:'vm_site_analytics=allow'},{...signal(1,1),email:'never'}),r);assert.equal(r.statusCode,400);assert.equal(access,0);
 r=response();await handler({method:'GET',headers:{}},r);assert.equal(r.statusCode,405);assert.equal(r.headers['cache-control'],'private, no-store');
});
test('owner report authorization precedes website schema or data reads',async()=>{
 let read=0;const h=createAnalyticsHandler({authorize:async(req,res)=>{res.status(401).json({ok:false});return null},website:()=>read++});const r=response();await h({method:'GET',headers:{},query:{source:'website'}},r);assert.equal(r.statusCode,401);assert.equal(read,0);
});
test('website report has ordered home→work→contact→success and does not repurpose Corner data',async()=>{
 const {db,sql}=await siteDatabase();try{await ensureWebsiteSchema(sql,true);
  for(let i=1;i<=40;i++){
   const base=new Date('2026-10-12T05:00:00Z');await collectWebsite(signal(i*10,i),{sql,secret,now:base});
   if(i<=30)await collectWebsite(signal(i*10+1,i,'/work/nxtwatch'),{sql,secret,now:new Date(+base+1000)});
   if(i<=20){const p=signal(i*10+2,i,'/contact',{action:'contact_start'});await collectWebsite(p,{sql,secret,now:new Date(+base+2000)});if(i<=10)await collectWebsite({...p,action:'contact_success',activeMs:15000,depth:90},{sql,secret,now:new Date(+base+17000)})}
  }
  const report=await loadWebsiteAnalytics({source:'website',range:'custom',start:'2026-10-12',end:'2026-10-12',compare:'none'},{sql,now,initialize:s=>ensureWebsiteSchema(s,true)});
  assert.deepEqual(report.funnels[0].steps.map(x=>x.value),[40,30,20,10]);assert.deepEqual(report.funnels[1].steps.map(x=>x.value),[20,20,10]);assert.equal(report.metrics[0].value,90);assert.equal(report.audience.journeys,40);assert.ok(report.pages.some(p=>p.path==='/work/nxtwatch'));
  for(const key of ['view_key','journey_key','private@example','vm_track_session'])assert.ok(!JSON.stringify(report).includes(key));assert.equal(report.source,'website');
  const [before]=await sql.query('SELECT count(*)::int n FROM site_analytics_views');await loadWebsiteAnalytics({source:'website',range:'7d'},{sql,now,initialize:s=>ensureWebsiteSchema(s,true)});assert.equal((await sql.query('SELECT count(*)::int n FROM site_analytics_views'))[0].n,before.n);
 }finally{await db.close()}
});
test('small outcomes/period boundaries are withheld and unsupported date spans fail',()=>{
 const range=websiteRange({range:'today',compare:'none'},now),rows=Array.from({length:3},(_,i)=>({view_key:'v'+i,journey_key:'j'+i,path:'/',source:'direct',device:'mobile',started_at:new Date(+now-3600000).toISOString(),updated_at:new Date(+now-3500000).toISOString(),active_ms:0,depth:0,section:'main'}));
 const report=websiteReport(rows,range,now,rows[0].started_at);assert.equal(report.metrics[0].value,null);assert.equal(report.quality.comparisonAvailable,false);assert.equal(report.metrics[2].value,null);
 assert.throws(()=>websiteRange({range:'custom',start:'2026-01-01',end:'2026-10-12'},now),e=>e.status===400);
});
test('route and collector contracts keep /track website-first and enquiries preserved separately',()=>{
 const track=readFileSync(new URL('../src/Track.jsx',import.meta.url),'utf8');assert.match(track,/to="\/track">|to="\/track" aria-current/);assert.match(track,/path="enquiries" element=\{<Dashboard\/>\}/);assert.match(track,/Website analytics/);
 const entry=readFileSync(new URL('../src/TrackAnalytics.jsx',import.meta.url),'utf8');assert.match(entry,/WebsiteAnalytics/);assert.match(entry,/TrackSourceReport/);
 const source=readFileSync(new URL('../public/website-analytics.js',import.meta.url),'utf8');assert.doesNotMatch(source,/google-analytics\.com|googletagmanager\.com|gtag\(/);assert.match(source,/privacyBlocked/);
});
