import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnifiedMaintenance} from '../server/railway/maintenance.mjs';

test('default gate never runs without explicitly enabled rollout flags',async()=>{
 const wasA=process.env.UNIFIED_PORTFOLIO_API,wasB=process.env.UNIFIED_MAINTENANCE_ENABLED;
 try{
   delete process.env.UNIFIED_PORTFOLIO_API;delete process.env.UNIFIED_MAINTENANCE_ENABLED;
   let calls=0;const tick=createUnifiedMaintenance({fetchRequest:()=>{calls++;throw Error('should not call');}});
   assert.equal((await tick()).status,'disabled');assert.equal(calls,0);
 }finally{
   if(wasA===undefined)delete process.env.UNIFIED_PORTFOLIO_API;else process.env.UNIFIED_PORTFOLIO_API=wasA;
   if(wasB===undefined)delete process.env.UNIFIED_MAINTENANCE_ENABLED;else process.env.UNIFIED_MAINTENANCE_ENABLED=wasB;
 }
});
test('UTC scheduling runs once after 08:00 with durable completion marker',async()=>{
 let date='2026-11-05T07:59:00.000Z',completed='',calls=0;
 const tick=createUnifiedMaintenance({
   enabled:()=>true,now:()=>new Date(date),lastCompleted:()=>completed,
   markCompleted:d=>{completed=d;},secret:()=> 'synthetic-test-secret',port:()=>4141,
   fetchRequest:async(url,opts)=>{
     calls++;assert.equal(url,'http://127.0.0.1:4141/api/track/cron/followups');
     assert.equal(opts.headers.Authorization,'Bearer synthetic-test-secret');
     return {ok:true,json:async()=>({ok:true,processed:2,analyticsCleanup:'complete',surveyCleanup:'complete'})};
   }
 });
 assert.equal((await tick()).status,'before-window');
 date='2026-11-05T08:00:00.000Z';
 assert.equal((await tick()).status,'completed');
 assert.equal(completed,'2026-11-05');assert.equal((await tick()).status,'complete');assert.equal(calls,1);
});
test('incomplete cleanup never advances persisted day; backoff prevents flooding',async()=>{
 let date='2026-11-05T08:00:00.000Z',persisted='',calls=0,failures=[];
 const tick=createUnifiedMaintenance({
   enabled:()=>true,now:()=>new Date(date),lastCompleted:()=>persisted,
   markCompleted:x=>{persisted=x;},onFailure:x=>failures.push(x),
   secret:()=> 'synthetic',port:()=>4141,retryMs:15*60*1000,
   fetchRequest:async()=>{calls++;return {ok:true,json:async()=>({ok:true,processed:0,analyticsCleanup:'failed'})};}
 });
 assert.equal((await tick()).status,'failed');
 assert.equal((await tick()).status,'retry-backoff');
 date='2026-11-05T08:16:00.000Z';
 assert.equal((await tick()).status,'failed');
 assert.equal(persisted,'');assert.equal(calls,2);
 assert.deepEqual(failures,['CLEANUP_INCOMPLETE','CLEANUP_INCOMPLETE']);
});
test('in-flight guard avoids duplicate concurrent runs',async()=>{
 let resolveFetch;let calls=0;
 const tick=createUnifiedMaintenance({
   enabled:()=>true,now:()=>new Date('2026-11-05T10:00:00.000Z'),secret:()=> 'synthetic',
   fetchRequest:()=>{calls++;return new Promise(resolve=>{resolveFetch=resolve;});}
 });
 const first=tick();
 assert.equal((await tick()).status,'in-flight');
 resolveFetch({ok:true,json:async()=>({ok:true})});
 assert.equal((await first).status,'completed');assert.equal(calls,1);
});
test('gate rejects missing secret and invalid local port without network',async()=>{
 const a=createUnifiedMaintenance({enabled:()=>true,now:()=>new Date('2026-11-05T10:00:00Z')});
 assert.equal((await a()).status,'not-configured');
 const b=createUnifiedMaintenance({enabled:()=>true,now:()=>new Date('2026-11-05T10:00:00Z'),secret:()=> 'x',port:()=>99999});
 assert.equal((await b()).status,'invalid-port');
});
