import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExplorer,boundedRate,wilson} from '../src/reading-explorer.mjs';
import {ReadingAnalytics} from '../src/reading-analytics.mjs';
import {Store} from '../src/store.mjs';
const NOW=new Date('2026-10-13T10:00:00Z');
const RANGE={start:'2026-10-12',end:'2026-10-12',from:'2026-10-11T18:30:00.000Z',to:'2026-10-12T18:30:00.000Z',previous:{from:'2026-10-10T18:30:00.000Z',to:'2026-10-11T18:30:00.000Z'}};
function sample({n=40,opens=30,reads=20,engaged=10,offset=0,direct=false}={}){
 const rows=[];let id=0;const stamp=s=>new Date(Date.parse('2026-10-12T05:00:00Z')+s*1000+offset).toISOString();
 for(let i=0;i<n;i++){
  const base={journey_key:'journey_'+i,device:i%2?'mobile':'desktop',source:'search',updated_at:stamp(100),active_ms:0,depth:0};
  if(!direct)rows.push({...base,view_key:'view_'+id++,page:'feed',started_at:stamp(0)});
  if(i<opens||direct)rows.push({...base,view_key:'view_'+id++,page:'story',post_id:'post-example',started_at:stamp(10),active_ms:20000,reached90_at:i<reads?stamp(30):null,engaged_at:i<engaged?stamp(40):null});
 }
 return rows;
}
const report=(current=sample(),previous=sample({offset:-86400000}),extra={})=>buildExplorer({current,previous,range:RANGE,now:NOW,...extra});
test('Wilson intervals are bounded and match the documented score formula',()=>{
 const r=wilson(50,100);assert.ok(Math.abs(r.low-.4038315303659956)<1e-10);assert.ok(Math.abs(r.high-.5961684696340044)<1e-10);
 assert.equal(wilson(1,0),null);assert.equal(wilson(11,10),null);assert.ok(wilson(0,50).low>=0);assert.ok(wilson(50,50).high<=1);
});
test('rates require adequate sample and suppress rare outcomes and complements',()=>{
 assert.equal(boundedRate(0,0).status,'empty');assert.equal(boundedRate(5,10).rate,null);assert.equal(boundedRate(5,20).rate,.25);
 for(const [s,n] of [[1,30],[28,30],[0,3]])assert.deepEqual(boundedRate(s,n),{status:'suppressed',total:null,success:null,rate:null,interval:null});
 assert.throws(()=>boundedRate(50,10),TypeError);
});
test('feed and story entry have distinct ordered denominators, timings and comparison deltas',()=>{
 const r=report();assert.deepEqual(r.modes.feed.current.steps.map(s=>s.count),[40,30,20,10]);assert.deepEqual(r.modes.story.current.steps.map(s=>s.count),[30,20,10]);
 assert.equal(r.modes.feed.current.conversion.rate,.25);assert.equal(r.modes.story.current.conversion.rate,1/3);assert.equal(r.modes.feed.deltaPoints,0);
 assert.deepEqual(r.modes.feed.current.steps.map(s=>s.medianSeconds),[null,10,20,10]);assert.equal(r.trend[0].total,30);assert.equal(r.trend[0].success,20);
 const improved=report(sample({engaged:20}),sample({offset:-86400000}));assert.equal(improved.modes.feed.deltaPoints,25);assert.ok(improved.priorities.some(p=>p.kind==='period_change'));
});
test('direct story arrivals enter only the story-entry funnel',()=>{
 const r=report(sample({n:20,opens:20,reads:10,engaged:5,direct:true}),null);
 assert.deepEqual(r.modes.feed.current.steps.map(s=>s.count),[0,0,0,0]);assert.deepEqual(r.modes.story.current.steps.map(s=>s.count),[20,10,5]);
});
test('engagement on a later substantially read story is not lost',()=>{
 const rows=sample({n:20,opens:20,reads:20,engaged:0});
 for(let i=0;i<10;i++)rows.push({...rows.find(r=>r.journey_key==='journey_'+i&&r.page==='story'),view_key:'later_'+i,started_at:'2026-10-12T05:02:00Z',reached90_at:'2026-10-12T05:02:20Z',engaged_at:'2026-10-12T05:02:30Z',updated_at:'2026-10-12T05:02:40Z'});
 assert.equal(report(rows,null).modes.feed.current.steps[3].count,10);
});
test('carry-over, prior-entry, mixed-device, invalid and active records are diagnosed not silently reinterpreted',()=>{
 const rows=sample({n:20,opens:20,reads:10,engaged:5});
 for(const row of rows.filter(r=>r.journey_key==='journey_0'))row.updated_at='2026-10-12T19:00:00Z';
 rows.find(r=>r.journey_key==='journey_1'&&r.page==='story').device='tablet';
 for(const row of rows.filter(r=>r.journey_key==='journey_2'))row.updated_at='2026-10-12T18:10:00Z';
 rows.push({page:'admin',journey_key:'bad',view_key:'bad',started_at:'invalid'});
 const r=report(rows,null,{priorCurrent:new Set(['journey_3'])});assert.equal(r.quality.eligibleJourneys,16);
 for(const id of ['boundaryJourneys','mixedDeviceJourneys','activeJourneys','invalidVisits','priorEntryJourneys'])assert.equal(r.diagnostics.find(d=>d.id===id).count,null);
});
test('future or pre-open milestones cannot manufacture progressed journeys',()=>{
 const rows=sample({n:20,opens:20,reads:20,engaged:10});rows.filter(r=>r.page==='story').forEach(r=>r.reached90_at='2026-10-14T00:00:00Z');
 assert.equal(report(rows,null).modes.feed.current.steps[2].count,0);
});
test('privacy applies to entire small-drop funnel and complementary segment partitions',()=>{
 const r=report(sample({n:30,opens:29,reads:20,engaged:10}),null);assert.equal(r.modes.feed.current.suppressed,true);assert.ok(r.modes.feed.current.steps.every(s=>s.count===null&&s.rate===null&&s.medianSeconds===null));
 const rows=sample();for(const row of rows.filter(r=>r.journey_key==='journey_0'))row.device='tablet';const grouped=report(rows,null).segments.devices;
 assert.equal(grouped.suppressed,true);assert.ok(grouped.rows.every(s=>s.rate===null&&s.total===null&&s.medianActiveSeconds===null));
});
test('aggregate paths and transitions never expose identities, URLs or content',()=>{
 const r=report();assert.ok(r.paths.rows.some(p=>p.label==='Feed → Story'&&p.count===30));assert.equal(r.transitions.rows[0].count,30);
 const serialized=JSON.stringify(r);for(const key of ['journey_key','view_key','post_id','journey_0','view_1','post-example'])assert.ok(!serialized.includes(key),key);
 const rows=sample();rows.push({...rows[0],view_key:'rare_tail',started_at:'2026-10-12T05:03:00Z',updated_at:'2026-10-12T05:03:20Z'});assert.equal(report(rows,null).paths.suppressed,true);
});
test('empty/absent comparison and missing days remain unavailable instead of zero conversion',()=>{
 const range={...RANGE,end:'2026-10-13',to:'2026-10-13T18:30:00.000Z',previous:null};const r=report([],null,{range});assert.equal(r.modes.feed.previous,null);assert.equal(r.modes.feed.deltaPoints,null);assert.equal(r.trend.length,2);assert.ok(r.trend.every(p=>p.rate===null));
});
test('existing owner endpoint includes advanced reports without a schema migration or write',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());const reading=new ReadingAnalytics(store,{secret:'test',clock:()=>NOW});const count=store.one('SELECT count(*) n FROM reading_views').n;
 const r=reading.report({role:'owner'},{range:'7d'});assert.equal(r.explorer.version,1);assert.equal(store.one('SELECT count(*) n FROM reading_views').n,count);assert.throws(()=>reading.report({role:'editor'},{range:'7d'}),e=>e.status===403);
});
test('large bounded snapshot inputs remain finite and serialize no raw records',()=>{
 const start=performance.now(),r=report(sample({n:5000,opens:4000,reads:2000,engaged:1000}),null);
 assert.equal(r.modes.feed.current.steps[0].count,5000);assert.ok(performance.now()-start<5000);assert.ok(JSON.stringify(r).length<50000);
});
