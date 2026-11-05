import test from 'node:test';
import assert from 'node:assert/strict';
import {checkUnifiedReadiness} from '../server/railway/dispatch.mjs';

const cfg={DATABASE_URL:'postgresql://invalid.example/db',TRACK_SESSION_SECRET:'synthetic',RESEND_API_KEY:'synthetic',CONTACT_FROM_EMAIL:'connect@example.test',CRON_SECRET:'synthetic'};

test('missing credentials fail closed',async()=>{
 let calls=0;
 const res=await checkUnifiedReadiness({environment:{UNIFIED_BACKEND_CUTOVER_VERIFIED:'1'},probe:async()=>{calls++;return true;}});
 assert.equal(res.status,503);assert.equal(res.body.missingConfigurationCount,5);assert.equal(calls,0);
});
test('mere presence of secrets does not bypass release gate',async()=>{
 let calls=0;
 const res=await checkUnifiedReadiness({environment:cfg,probe:async()=>{calls++;return true;}});
 assert.equal(res.status,503);assert.equal(res.body.cutoverApprovalPresent,false);assert.equal(calls,0);
});
test('connectivity failure keeps readiness unavailable',async()=>{
 const env={...cfg,UNIFIED_BACKEND_CUTOVER_VERIFIED:'1'};
 const res=await checkUnifiedReadiness({environment:env,probe:async()=>{throw Error('offline');}});
 assert.equal(res.status,503);assert.equal(res.body.databaseConnectivityVerified,false);
});
test('readiness requires release authorization and a positive database probe',async()=>{
 const env={...cfg,UNIFIED_BACKEND_CUTOVER_VERIFIED:'1'};
 const ok=await checkUnifiedReadiness({environment:env,probe:async()=>true});
 const no=await checkUnifiedReadiness({environment:env,probe:async()=>false});
 assert.equal(ok.status,200);assert.equal(ok.body.databaseConnectivityVerified,true);
 assert.equal(no.status,503);assert.equal(no.body.databaseConnectivityVerified,false);
});
