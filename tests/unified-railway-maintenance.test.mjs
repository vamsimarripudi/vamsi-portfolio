import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnifiedMaintenance } from '../corner/src/unified-maintenance.mjs';

test('daily maintenance cannot run by accident',async()=>{
 let count=0;
 const t=createUnifiedMaintenance({enabled:false,startTimer:false,task:async()=>{count++;return {ok:true};}});
 assert.deepEqual(await t.tick(),{status:'disabled'});
 t.stop();assert.equal(count,0);
});
test('exact UTC schedule, no duplicate run per UTC day, and future day allowed',async()=>{
 let now=new Date('2026-11-05T07:59:00.000Z'),count=0;
 const t=createUnifiedMaintenance({enabled:true,startTimer:false,clock:()=>now,task:async()=>{count++;return {ok:true};}});
 assert.equal((await t.tick()).status,'not-due');
 now=new Date('2026-11-05T08:01:00.000Z');
 assert.equal((await t.tick()).status,'completed');
 assert.equal((await t.tick()).status,'completed');
 assert.equal(count,1);
 now=new Date('2026-11-06T08:02:00.000Z');
 assert.equal((await t.tick()).status,'completed');
 assert.equal(count,2);t.stop();
});
test('failures delay retries and do not falsely declare completion',async()=>{
 let now=new Date('2026-11-05T09:00:00.000Z'),count=0;
 const t=createUnifiedMaintenance({enabled:true,startTimer:false,clock:()=>now,task:async()=>{count++;if(count===1)throw Error('test failure');return {ok:true};}});
 assert.equal((await t.tick()).status,'retryable-failure');
 now=new Date('2026-11-05T09:08:00.000Z');assert.equal((await t.tick()).status,'retry-delayed');
 now=new Date('2026-11-05T09:16:00.000Z');assert.equal((await t.tick()).status,'completed');
 assert.equal(count,2);t.stop();
});
