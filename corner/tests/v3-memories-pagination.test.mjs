import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {V3Memories} from '../src/v3-memories.mjs';
import {timelinePage} from '../src/v3-memories-ui.mjs';

test('published Timeline cursor pagination retains year/category and has no duplicates',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 new V3Engagement(store,{env:{SESSION_SECRET:'long-enough-timeline-test-session-secret-2026'}});
 const memories=new V3Memories(store,{env:{CORNER_V3_MEMORIES:'1'}});
 const owner={id:'owner',role:'owner'};
 for(let n=0;n<76;n++)memories.milestone(owner,{title:'Timeline '+n,occurredOn:'2026-09-09',kind:n%2?'build':'personal',state:'published'});
 memories.milestone(owner,{title:'Private draft',occurredOn:'2026-09-09',kind:'build',state:'draft'});
 const first=memories.timeline({year:'2026',kind:'build',limit:10});
 assert.equal(first.items.length,10);assert.ok(first.nextCursor);
 let ids=new Set(first.items.map(x=>x.id)),cursor=first.nextCursor;
 while(cursor){
  const next=memories.timeline({year:'2026',kind:'build',limit:10,cursor});
  for(const m of next.items){assert.equal(ids.has(m.id),false);ids.add(m.id)}
  cursor=next.nextCursor;
 }
 assert.equal(ids.size,38);
 assert.equal(memories.timeline({kind:'personal'}).items.length,30);
 assert.ok(memories.timeline({kind:'personal'}).nextCursor);
 const html=timelinePage(memories,{year:'2026',kind:'build'});
 assert.match(html,/name="year" value="2026"/);
 assert.match(html,/year=2026&amp;kind=build/);
 assert.match(html,/rel="next"/);
 assert.doesNotMatch(html,/Private draft/);
 assert.throws(()=>memories.timeline({cursor:'bad'}),{code:'INVALID_CURSOR'});
 assert.throws(()=>memories.timeline({year:'2026 OR 1=1'}),{code:'INVALID_YEAR'});
});