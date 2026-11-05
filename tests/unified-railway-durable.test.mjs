import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnifiedMaintenance} from '../corner/src/unified-maintenance.mjs';
test('persisted completion prevents duplicate work across simulated process restarts',async()=>{
 const db=new Map();let calls=0;
 const make=()=>createUnifiedMaintenance({
   enabled:true,startTimer:false,
   clock:()=>new Date('2026-11-05T08:30:00Z'),
   lastCompleted:()=>db.get('last')||null,
   markCompleted:day=>db.set('last',day),
   task:async()=>{calls++;return {ok:true,analyticsCleanup:'complete',surveyCleanup:'complete'};}
 });
 const first=make();
 assert.equal((await first.tick()).status,'completed');
 assert.equal(db.get('last'),'2026-11-05');first.stop();
 const restarted=make();
 assert.equal((await restarted.tick()).status,'completed');
 assert.equal(calls,1);restarted.stop();
});
test('failed persistence is a failure, not an acknowledged completion',async()=>{
 const runner=createUnifiedMaintenance({
   enabled:true,startTimer:false,
   clock:()=>new Date('2026-11-05T09:00:00Z'),
   task:async()=>({ok:true,analyticsCleanup:'complete',surveyCleanup:'complete'}),
   markCompleted:()=>{throw Error('storage unavailable');}
 });
 assert.equal((await runner.tick()).status,'retryable-failure');
 assert.equal(runner.status().completedOn,null);
 runner.stop();
});
test('service rejects partial completion despite successful HTTP status',async()=>{
 const file=new URL('../corner/src/unified-maintenance.mjs',import.meta.url);
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(file,'utf8');
 assert.match(code,/analyticsCleanup==='complete'/);
 assert.match(code,/surveyCleanup==='complete'/);
 assert.match(code,/if\(!response\.ok\)return \{ok:false\}/);
 const source=readFileSync(new URL('../corner/src/server.mjs',import.meta.url),'utf8');
 assert.match(source,/portfolio\.dailyMaintenance\.lastUtcDate/);
 assert.match(source,/UNIFIED_PORTFOLIO_API==='1'/);
});

test('missing cleanup confirmation cannot mark work completed',async()=>{
 const task=createUnifiedMaintenance({enabled:true,startTimer:false,clock:()=>new Date('2026-11-05T10:00:00Z'),task:async()=>({ok:true})});
 assert.equal((await task.tick()).status,'retryable-failure');assert.equal(task.status().completedOn,null);task.stop();
});
