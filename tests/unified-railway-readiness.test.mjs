import test from 'node:test';
import assert from 'node:assert/strict';
import {checkUnifiedReadiness} from '../corner/src/unified-dispatch.mjs';
const env={DATABASE_URL:'postgresql://invalid.example/db',TRACK_SESSION_SECRET:'synthetic',RESEND_API_KEY:'synthetic',CONTACT_FROM_EMAIL:'connect@example.test',CRON_SECRET:'synthetic'};
test('missing required config must not be called ready',async()=>{
let n=0;const result=await checkUnifiedReadiness({environment:{UNIFIED_BACKEND_CUTOVER_VERIFIED:'1'},probe:async()=>{n++;return true;}});
assert.equal(result.status,503);assert.equal(result.body.databaseConnectivityVerified,false);assert.equal(n,0);
});
test('configuration alone is not an operator cutover approval',async()=>{
let n=0;const result=await checkUnifiedReadiness({environment:env,probe:async()=>{n++;return true;}});
assert.equal(result.status,503);assert.equal(result.body.cutoverApprovalPresent,false);assert.equal(n,0);
});
test('database errors are fail-closed without leaking exception details',async()=>{
const result=await checkUnifiedReadiness({environment:{...env,UNIFIED_BACKEND_CUTOVER_VERIFIED:'1'},probe:async()=>{throw Error('PRIVATE_CONNECTION_DETAILS');}});
assert.equal(result.status,503);assert.equal(result.body.databaseConnectivityVerified,false);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_CONNECTION_DETAILS/);
});
test('authorized and connected synthetic probe is ready',async()=>{
const result=await checkUnifiedReadiness({environment:{...env,UNIFIED_BACKEND_CUTOVER_VERIFIED:'1'},probe:async()=>true});
assert.equal(result.status,200);assert.equal(result.body.databaseConnectivityVerified,true);
});
test('false probe remains unavailable even with approval and credentials',async()=>{
const result=await checkUnifiedReadiness({environment:{...env,UNIFIED_BACKEND_CUTOVER_VERIFIED:'1'},probe:async()=>false});
assert.equal(result.status,503);assert.equal(result.body.databaseConnectivityVerified,false);
});
