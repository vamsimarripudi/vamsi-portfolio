import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderUnifiedCutover} from '../scripts/render-unified-vercel-cutover.mjs';
const existing=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const origin='https://corner-web-production-2600.up.railway.app';

test('candidate routes all portfolio APIs into same Railway service, not Vercel Functions',()=>{
  const next=renderUnifiedCutover(existing,{railwayOrigin:origin});
  assert.deepEqual(next.rewrites.slice(0,2),existing.rewrites.slice(0,2));
  assert.ok(next.rewrites.some(r=>r.source==='/api/:path*'&&r.destination===origin+'/api/:path*'));
  assert.equal(next.rewrites.filter(r=>r.source.startsWith('/api/')&&r.source!=='/api/:path*').length,0);
  assert.ok(next.rewrites.some(r=>r.source==='/track/analytics'));
  assert.deepEqual(next.headers,existing.headers);
  assert.deepEqual(next.crons,existing.crons,'Do not silently disable cron during initial cutover');
  assert.deepEqual(existing.rewrites.slice(0,2),next.rewrites.slice(0,2),'Corner stays on existing service');
});
test('cron is removed from candidate only with explicit verified maintenance flag',()=>{
  const next=renderUnifiedCutover(existing,{railwayOrigin:origin,verifiedRailwayMaintenance:true});
  assert.ok(!next.crons.some(r=>r.path==='/api/track/cron/followups'));
  assert.equal(next.rewrites.filter(r=>r.source==='/api/:path*').length,1);
  assert.equal(existing.crons.some(r=>r.path==='/api/track/cron/followups'),true);
});
test('rejected Railway host or incomplete source cannot produce routing changes',()=>{
  for(const host of ['http://insecure.up.railway.app','https://malicious.test','https://example.com/path','https://sub.example.up.railway.app/path']){
    assert.throws(()=>renderUnifiedCutover(existing,{railwayOrigin:host}));
  }
  assert.throws(()=>renderUnifiedCutover({rewrites:[]},{railwayOrigin:origin}));
});
