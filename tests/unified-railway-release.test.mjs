import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyUnifiedRailway} from '../scripts/verify-unified-railway-release.mjs';

function fake(json,status=200){return {status,json:async()=>json};}
test('safe release probe confirms actual Corner, gateway, DB, auth and CSRF behavior',async()=>{
 const paths=[];
 const replies=[
  fake({data:{database:'connected'}}),
  fake({component:'gateway'}),
  fake({ok:true,databaseConnectivityVerified:true}),
  fake({},401),
  fake({},403)
 ];
 const result=await verifyUnifiedRailway({
  origin:'https://corner-web-production-2600.up.railway.app',
  fetcher:async(url,opts)=>{
   paths.push({url,method:opts.method,headers:opts.headers});
   return replies.shift();
  }
 });
 assert.equal(result.ok,true);
 assert.equal(result.checks.length,5);
 assert.equal(paths[3].method,'GET');
 assert.equal(paths[4].method,'POST');
 assert.equal(paths[4].headers.Origin,'https://unrelated.example');
});
test('fails on unverified database, missing auth or unexpected host',async()=>{
 const origin='https://corner-web-production-2600.up.railway.app';
 const data=[fake({data:{database:'connected'}}),fake({component:'gateway'}),fake({ok:false,databaseConnectivityVerified:false},503)];
 await assert.rejects(
  verifyUnifiedRailway({origin,fetcher:async()=>data.shift()}),
  /not passed the readiness gate/
 );
 await assert.rejects(verifyUnifiedRailway({origin:'https://unapproved.example',fetcher:async()=>{throw Error('never');}}),/verified HTTPS/);
});
