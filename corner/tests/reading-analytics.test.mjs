import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {ReadingAnalytics,readingRange,normalizeReading} from '../src/reading-analytics.mjs';
import {readingRoutes} from '../src/reading-routes.mjs';
const owner={id:'owner',role:'owner'},id=n=>n.toString(16).padStart(32,'0');
function fixture(t){const store=new Store(':memory:');t.after(()=>store.close());let now=new Date('2026-10-12T06:00:00Z');const reading=new ReadingAnalytics(store,{secret:'isolated-test-secret',clock:()=>now});const post=store.createPost({title:'Published reading example',body:'A public story'},owner.id);store.publish(post.id,owner.id);return {store,reading,post,set:at=>now=new Date(at),advance:ms=>now=new Date(now.getTime()+ms)}}
const payload=(n,post=null,extra={})=>({v:1,view:id(n),journey:id(n+1000),page:post?'story':'feed',post,device:'mobile',source:'direct',depth:0,activeMs:0,...extra});
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},data:null});

test('calendar ranges are inclusive IST dates, bounded and comparable',()=>{
 const r=readingRange({range:'7d'},new Date('2026-10-12T06:00:00Z'));assert.equal(r.start,'2026-10-05');assert.equal(r.end,'2026-10-11');assert.equal(r.from,'2026-10-04T18:30:00.000Z');assert.equal(r.to,'2026-10-11T18:30:00.000Z');assert.equal(r.previous.start,'2026-09-28');
 assert.equal(readingRange({range:'today'},new Date('2026-10-11T19:00:00Z')).start,'2026-10-12');
 for(const input of [{range:'forever'},{range:'custom',start:'2026-02-30',end:'2026-03-01'},{range:'custom',start:'2026-10-10',end:'2026-10-09'},{range:'custom',start:'2026-01-01',end:'2026-10-10'},{range:'custom',start:'2026-10-13',end:'2026-10-14'},{device:'precise-location'},{compare:'last-user'},{range:['7d']},{propertyId:'anything'}])assert.throws(()=>readingRange(input,new Date('2026-10-12')),error=>error.status===400);
});
test('collector rejects personal fields, free text, private references, bad enums and unbounded values',()=>{
 for(const input of [{...payload(1),view:[id(1)]},{...payload(1),email:'private@example.test'},{...payload(1),path:'/admin'},{...payload(1),reason:'Name or secret'},{...payload(1),action:'export-user'},{...payload(1),activeMs:-1},{...payload(1),activeMs:Infinity},{...payload(1),depth:100},{...payload(1),page:'admin'},{...payload(1),post:'secret'},null,[]])assert.throws(()=>normalizeReading(input),error=>error.status===400);
});
test('snapshot upserts deduplicate, hash identifiers, bound active time and preserve monotonic depth',t=>{
 const {store,reading,post,advance}=fixture(t);let p=payload(1,post.id);reading.collect(p);reading.collect(p);assert.equal(store.one('SELECT count(*) n FROM reading_views').n,1);
 advance(12000);p={...p,depth:75,activeMs:12000};reading.collect(p);reading.collect({...p,depth:25,activeMs:9000});const row=store.one('SELECT * FROM reading_views');assert.equal(row.depth,75);assert.equal(row.active_ms,12000);assert.ok(row.reached75_at);assert.equal(row.reached90_at,null);assert.notEqual(row.view_key,p.view);assert.notEqual(row.journey_key,p.journey);
 reading.collect({...p,depth:90,activeMs:999999});assert.equal(store.one('SELECT active_ms FROM reading_views').active_ms,12000);
 assert.throws(()=>reading.collect({...p,journey:id(999)}),error=>error.status===409);
});
test('draft/private posts never enter reading collection and a view cannot be rebound',t=>{
 const {reading,store,post}=fixture(t);const draft=store.createPost({title:'Private draft',body:'Private'},owner.id);assert.throws(()=>reading.collect(payload(1,draft.id)),error=>error.status===400);
 reading.collect(payload(1,post.id));assert.throws(()=>reading.collect(payload(1,null)),error=>error.status===409);
});
test('ordered matured funnel counts 40→30→20→10 and never divides unrelated event totals',t=>{
 const {reading,post,set}=fixture(t);
 for(let n=1;n<=40;n++){
  set('2026-10-12T06:00:00Z');const feed=payload(n);reading.collect(feed);
  if(n>30)continue;
  set('2026-10-12T06:01:00Z');const story=payload(n+100,post.id,{journey:feed.journey,source:'internal'});reading.collect(story);
  if(n<=20){set('2026-10-12T06:01:20Z');reading.collect({...story,depth:90,activeMs:20000})}
  if(n<=10){set('2026-10-12T06:01:21Z');reading.collect({...story,depth:90,activeMs:21000,action:'share'})}
 }
 // A direct story visitor belongs in reading totals, but not the feed-entry funnel.
 set('2026-10-12T06:02:00Z');reading.collect(payload(500,post.id));set('2026-10-12T08:00:00Z');
 const r=reading.report(owner,{range:'today'});assert.deepEqual(r.funnel.steps.map(s=>s.value),[40,30,20,10]);assert.deepEqual(r.funnel.steps.map(s=>s.drop),[10,10,10,null]);assert.equal(r.funnel.steps[0].rate,.75);assert.equal(r.metrics.find(m=>m.id==='stories').value,31);assert.equal(r.reading[4].value,20);assert.equal(r.funnel.activeJourneys,0);assert.ok(r.nextActions.length);
 assert.ok(!JSON.stringify(r).includes('journey_key'));assert.ok(!JSON.stringify(r).includes('view_key'));assert.ok(!JSON.stringify(r).includes(id(1)));
});
test('low funnel stages and small drop-offs suppress the whole funnel, not false precision',t=>{
 const {reading,post,set}=fixture(t);
 for(let n=1;n<=6;n++){set('2026-10-12T06:00:00Z');const feed=payload(n);reading.collect(feed);if(n<=5){set('2026-10-12T06:01:00Z');reading.collect(payload(n+100,post.id,{journey:feed.journey}))}}
 set('2026-10-12T08:00:00Z');const r=reading.report(owner,{range:'today'});assert.equal(r.funnel.suppressed,true);assert.ok(r.funnel.steps.every(s=>s.value===null&&s.drop===null&&s.rate===null));
});
test('ongoing journeys are not premature drop-offs; prior-range entry is excluded',t=>{
 const {reading,set,post}=fixture(t);set('2026-10-11T18:20:00Z');const f=payload(1);reading.collect(f);set('2026-10-11T18:31:00Z');reading.collect(payload(2,post.id,{journey:f.journey}));set('2026-10-12T06:00:00Z');reading.collect(payload(3));
 let r=reading.report(owner,{range:'today'});assert.equal(r.funnel.steps[0].value,0);assert.equal(r.funnel.activeJourneys,null);set('2026-10-12T07:00:00Z');r=reading.report(owner,{range:'today'});assert.equal(r.funnel.suppressed,true);
});
test('deletion and 90-day retention remove new observations, not existing content',t=>{
 const {store,reading,post,set}=fixture(t);reading.collect(payload(1,post.id));reading.forget(payload(1).journey);assert.equal(store.one('SELECT count(*) n FROM reading_views').n,0);assert.ok(store.adminPost(post.id));assert.equal(reading.collect(payload(1,post.id)).accepted,false,'Delayed pre-withdrawal snapshots cannot recreate the revoked journey');
 set('2020-01-01');reading.collect(payload(2));store.cleanup();assert.equal(store.one('SELECT count(*) n FROM reading_views').n,0);new ReadingAnalytics(store,{secret:'isolated-test-secret'});assert.ok(store.adminPost(post.id));
});
test('report requires owner and excludes archived titles from public content ranking',t=>{
 const {reading,store,post}=fixture(t);for(let n=1;n<=6;n++)reading.collect(payload(n,post.id));assert.throws(()=>reading.report({role:'member'},{range:'today'}),error=>error.status===403);store.archive(post.id,owner.id);assert.equal(reading.report(owner,{range:'today'}).topStories.length,0);
});
test('HTTP adapter fails closed without consent, on DNT/GPC, staff activity and disabled collection',async t=>{
 const {reading,store}=fixture(t);let calls=0;const raw=reading.collect.bind(reading);reading.collect=p=>{calls++;return raw(p)};
 const make=(cookies={},user=null)=>readingRoutes({reading,store:{...store,session:()=>user},readJSON:async()=>payload(1),cookieHeader:()=>cookies,ok:(r,data)=>r.data=data,limit:()=>{},requireOwner:()=>owner});
 for(const [cookies,headers,user] of [[{}, {},null],[{corner_reading_consent:'deny'},{},null],[{corner_reading_consent:'allow'},{dnt:'1'},null],[{corner_reading_consent:'allow'},{'sec-gpc':'1'},null],[{corner_reading_consent:'allow'},{},{role:'owner'}]]){const out=res();await make(cookies,user)({method:'POST',headers},out,'/api/analytics/reading',new URL('http://localhost'));assert.deepEqual(out.data,{accepted:false})}
 assert.equal(calls,0);const old=process.env.CORNER_READING_ANALYTICS;try{process.env.CORNER_READING_ANALYTICS='0';const blocked=res();await make({corner_reading_consent:'allow'})({method:'POST',headers:{}},blocked,'/api/analytics/reading',new URL('http://localhost'));assert.equal(blocked.data.accepted,false);assert.equal(calls,0)}finally{if(old===undefined)delete process.env.CORNER_READING_ANALYTICS;else process.env.CORNER_READING_ANALYTICS=old}
 const out=res();await make({corner_reading_consent:'allow'})({method:'POST',headers:{}},out,'/api/analytics/reading',new URL('http://localhost'));assert.equal(out.data.accepted,true);assert.equal(calls,1);assert.equal(out.headers['Cache-Control'],'private, no-store');
});

test('reading source keeps optional transfer costs bounded and the contract contains no Google emitter',async()=>{
 const {readFileSync}=await import('node:fs');const file=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
 assert.ok(Buffer.byteLength(file('reading-analytics.js'))<10000);assert.ok(Buffer.byteLength(file('analysis-studio.js'))<15000);assert.ok(Buffer.byteLength(file('analysis.css'))<6000);
 assert.doesNotMatch(file('reading-analytics.js'),/google-analytics\.com|googletagmanager\.com|gtag\(/);
 assert.match(file('reading-analytics.js'),/globalPrivacyControl/);assert.match(file('reading-analytics.js'),/document.visibilityState/);
});
