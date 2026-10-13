import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {ReadingAnalytics} from '../src/reading-analytics.mjs';
import {conversion,advancedReading} from '../src/reading-exploration.mjs';
const token=n=>n.toString(16).padStart(32,'0'),owner={id:'owner',role:'owner'};
function fixture(t){const store=new Store(':memory:');t.after(()=>store.close());let now=new Date('2026-10-12T12:00:00Z');const reading=new ReadingAnalytics(store,{secret:'isolated-report-test',clock:()=>now});const post=store.createPost({title:'Published test story',body:'Example reading content'},owner.id);store.publish(post.id,owner.id);return {store,reading,post,set:x=>now=new Date(x),signal:(id,journey,page='feed',extra={})=>({v:1,view:token(id),journey:token(journey),page,post:page==='story'?post.id:null,device:'mobile',source:'search',depth:0,activeMs:0,...extra})}}
const today={advanced:'1',range:'today',compare:'none'};
test('Wilson intervals are bounded, independently checked, and suppressed for small complements',()=>{
 const c=conversion(50,100);assert.equal(c.value,.5);assert.ok(Math.abs(c.interval[0]-.40383153)<.000001);assert.ok(Math.abs(c.interval[1]-.59616847)<.000001);
 assert.equal(conversion(4,50).value,null);assert.equal(conversion(49,50).interval,null);assert.equal(conversion(10,20).interval,null);assert.equal(conversion(0,0).quality,'unavailable');assert.ok(conversion(0,50).interval[0]>=0);assert.throws(()=>conversion(6,5),TypeError);
});
test('advanced options are owner-only and reject unsupported filters instead of SQL expressions',t=>{
 const {reading}=fixture(t);assert.throws(()=>reading.report({role:'member'},today),e=>e.status===403);
 for(const options of [{...today,source:'sql:select'},{...today,entry:'account'},{...today,advanced:'other'},{...today,group:'name'},{...today,source:['search']}])assert.throws(()=>reading.report(owner,options),e=>e.status===400);
});
test('ordered funnel uses any eligible completed story, not only the first completion',t=>{
 const {reading,store,post,set,signal}=fixture(t);const other=store.createPost({title:'Second public test',body:'More content'},owner.id);store.publish(other.id,owner.id);
 for(let i=1;i<=40;i++){
  set('2026-10-12T06:00:00Z');reading.collect(signal(i,i+1000));if(i>30)continue;
  set('2026-10-12T06:01:00Z');const s=signal(i+100,i+1000,'story',{source:'internal'});reading.collect(s);
  if(i<=20){set('2026-10-12T06:01:20Z');reading.collect({...s,activeMs:20000,depth:90})}
  if(i<=10){set('2026-10-12T06:02:00Z');const second={...s,view:token(i+200),post:other.id};reading.collect(second);set('2026-10-12T06:02:20Z');reading.collect({...second,activeMs:20000,depth:90});set('2026-10-12T06:02:21Z');reading.collect({...second,activeMs:21000,depth:90,action:'share'})}
 }
 set('2026-10-12T08:00:00Z');const r=reading.report(owner,today);assert.deepEqual(r.funnel.steps.map(s=>s.value),[40,30,20,10]);assert.deepEqual(r.exploration.funnels.reading.steps.map(s=>s.value),[30,20,20,20,20]);assert.ok(r.exploration.paths.forward.some(p=>p.nodes.join('/')==='feed/story/story'&&p.journeys===10));assert.ok(r.exploration.paths.reverse.some(p=>p.nodes.join('/')==='story/story/feed'));
 assert.equal(r.exploration.sources.find(s=>s.id==='search').journeys,40);assert.equal(r.exploration.sources.find(s=>s.id==='internal').journeys,0);
 assert.ok(!JSON.stringify(r).includes('journey_key'));assert.ok(!JSON.stringify(r).includes('view_key'));assert.ok(!JSON.stringify(r).includes(token(1)));assert.equal(r.exploration.content.length,2);assert.equal(r.exploration.content.find(c=>c.slug===post.slug).visits,30);
});
test('source and entry filters include all visits in an eligible journey without fabricating new entrances',t=>{
 const {reading,set,signal}=fixture(t);
 for(let i=1;i<=10;i++){set('2026-10-12T06:00:00Z');reading.collect(signal(i,i));set('2026-10-12T06:01:00Z');reading.collect(signal(i+100,i,'story',{source:'internal'}))}
 for(let i=11;i<=15;i++)reading.collect(signal(i+100,i,'story',{source:'direct'}));set('2026-10-12T08:00:00Z');
 const search=reading.report(owner,{...today,source:'search'});assert.equal(search.exploration.totals.visits,20);assert.equal(search.exploration.totals.journeys,10);
 const direct=reading.report(owner,{...today,entry:'story'});assert.equal(direct.exploration.totals.stories,5);assert.equal(direct.funnel.steps[0].value,0);
});
test('milestones beyond the selected end do not inflate historical conversion',t=>{
 const {reading,set,signal}=fixture(t);
 for(let i=1;i<=10;i++){set('2026-10-11T18:29:00Z');const s=signal(i,i,'story');reading.collect(s);set('2026-10-11T18:31:00Z');reading.collect({...s,activeMs:20000,depth:90})}
 set('2026-10-12T08:00:00Z');const r=reading.report(owner,{advanced:'1',range:'custom',start:'2026-10-11',end:'2026-10-11',compare:'none'});assert.equal(r.exploration.totals.stories,10);assert.equal(r.exploration.totals.completed,0);assert.equal(r.exploration.totals.completion.value,0);
});
test('repeated visits from one tab do not evade distinct-journey suppression',t=>{
 const {reading,set,signal}=fixture(t);for(let i=1;i<=20;i++)reading.collect(signal(i,1,'story'));
 const r=reading.report(owner,today);assert.equal(r.exploration.totals.visits,null);assert.equal(r.exploration.totals.completion.value,null);assert.deepEqual(r.exploration.content,[]);set('2026-10-12T13:00:00Z');assert.deepEqual(reading.report(owner,today).exploration.paths.forward,[]);
});
test('prior-context entrants and still-active journeys are not assigned false drop-offs',t=>{
 const {reading,set,signal}=fixture(t);
 for(let i=1;i<=5;i++){set('2026-10-11T18:20:00Z');reading.collect(signal(i,i));set('2026-10-11T18:40:00Z');reading.collect(signal(i+100,i,'story'))}
 set('2026-10-12T11:58:00Z');for(let i=6;i<=10;i++)reading.collect(signal(i,i));set('2026-10-12T12:00:00Z');const r=reading.report(owner,today);assert.equal(r.funnel.steps[0].value,0);assert.equal(r.funnel.activeJourneys,5);
});
test('daily series distinguishes unavailable history, observed zeros and withheld positive samples in IST',t=>{
 const {reading,set,signal}=fixture(t);set('2026-10-10T19:00:00Z');for(let i=1;i<=5;i++)reading.collect(signal(i,i));set('2026-10-12T08:00:00Z');reading.collect(signal(6,6));set('2026-10-13T08:00:00Z');const r=reading.report(owner,{advanced:'1',range:'custom',start:'2026-10-10',end:'2026-10-13',compare:'none'});assert.deepEqual(r.exploration.series.map(d=>d.visits),[null,5,null,0]);assert.deepEqual(r.exploration.series.map(d=>d.status),['unavailable','observed','withheld','observed']);
});
test('archived story titles disappear, no extra data tables or observations are created by advanced reports',t=>{
 const {reading,store,post,signal}=fixture(t);for(let i=1;i<=5;i++)reading.collect(signal(i,i,'story'));const tables=store.all('SELECT name FROM sqlite_master ORDER BY name');const count=store.one('SELECT count(*) n FROM reading_views').n;store.archive(post.id,owner.id);const r=reading.report(owner,today);assert.deepEqual(r.exploration.content,[]);assert.deepEqual(store.all('SELECT name FROM sqlite_master ORDER BY name'),tables);assert.equal(store.one('SELECT count(*) n FROM reading_views').n,count);
});
test('large reports reject rather than returning a sampled or partial result',()=>{
 const fake={all:()=>Array(50001).fill({}),one:()=>({at:null})};assert.throws(()=>advancedReading(fake,{from:'2026-10-01T00:00:00Z',to:'2026-10-12T00:00:00Z'},new Date('2026-10-12')),e=>e.status===413);
});

test('advanced assets remain lazy, bounded and do not add collection',async()=>{
 const {readFileSync}=await import('node:fs');const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
 const entry=read('../public/analysis-studio.js'),ui=read('../public/analysis-explore.js'),css=read('../public/analysis-explore.css');
 assert.ok(Buffer.byteLength(entry)<1200);assert.ok(Buffer.byteLength(ui)<27000);assert.ok(Buffer.byteLength(css)<9500);
 assert.doesNotMatch(ui,/analytics\/reading'|googletagmanager\.com|google-analytics\.com/);
 assert.match(ui,/events\.abort\(\)/);assert.match(ui,/document\.hidden/);assert.match(ui,/query\(\)\.toString\(\)!==lastQuery/);
 // Verify the exact CSV function used by the browser, not a duplicate implementation.
 const {runInNewContext}=await import('node:vm');const source=ui.slice(ui.indexOf(' const cell='),ui.indexOf('\n let dispose='));const csv=runInNewContext(source+'\ncell');
 assert.equal(csv('=SUM(A1:A2)'),`"'=SUM(A1:A2)"`);assert.equal(csv('\u0001\t+123'),`"'\u0001\t+123"`);assert.equal(csv('ordinary "text"'),'"ordinary ""text"""');
});
