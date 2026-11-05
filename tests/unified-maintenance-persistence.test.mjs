import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnifiedMaintenance} from '../corner/src/unified-maintenance.mjs';
test('maintenance completion survives process restart through durable marker',async()=>{
let now=new Date('2026-11-05T08:00:00Z'),stored='',calls=0;
const shared={enabled:true,startTimer:false,clock:()=>now,lastCompleted:()=>stored,markCompleted:d=>{stored=d;},task:async()=>{calls++;return {ok:true,analyticsCleanup:'complete',surveyCleanup:'complete'};}};
const first=createUnifiedMaintenance(shared);assert.equal((await first.tick()).status,'completed');first.stop();
const second=createUnifiedMaintenance(shared);assert.equal((await second.tick()).status,'completed');second.stop();
assert.equal(calls,1);assert.equal(stored,'2026-11-05');
});
test('partial cleanup never persists success and retries after backoff',async()=>{
let now=new Date('2026-11-05T08:00:00Z'),stored='',calls=0;
const task=createUnifiedMaintenance({enabled:true,startTimer:false,clock:()=>now,lastCompleted:()=>stored,markCompleted:d=>{stored=d;},task:async()=>{calls++;return {ok:true,analyticsCleanup:'failed',surveyCleanup:'complete'};}});
assert.equal((await task.tick()).status,'retryable-failure');assert.equal(stored,'');
now=new Date('2026-11-05T08:16:00Z');assert.equal((await task.tick()).status,'retryable-failure');assert.equal(stored,'');assert.equal(calls,2);task.stop();
});
test('failed persistence never pretends cron work completed',async()=>{
const task=createUnifiedMaintenance({enabled:true,startTimer:false,clock:()=>new Date('2026-11-05T10:00:00Z'),markCompleted:()=>{throw Error('database unavailable');},task:async()=>({ok:true,analyticsCleanup:'complete',surveyCleanup:'complete'})});
assert.equal((await task.tick()).status,'retryable-failure');task.stop();
});
