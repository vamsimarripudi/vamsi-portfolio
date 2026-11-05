import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const source=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
test('actual handoff config uses a single Railway backend rewrite and no Vercel Function directory',()=>{
  assert.equal(existsSync(new URL('../api/',import.meta.url)),false);
  const backend=source.rewrites.filter(r=>r.source==='/api/:path*');
  assert.equal(backend.length,1);
  assert.equal(backend[0].destination,'https://corner-web-production-2600.up.railway.app/api/:path*');
  assert.equal(source.rewrites.filter(r=>r.source.startsWith('/api/')&&r.source!=='/api/:path*').length,0);
  assert.equal(source.rewrites.filter(r=>r.source==='/corner'||r.source==='/corner/:path*').length,2);
  assert.ok(source.headers.some(x=>x.source==='/api/track/:path*'&&x.headers.some(y=>y.key==='X-Robots-Tag')));
});
test('existing Vercel cron is preserved until Railway maintenance is actually verified',()=>{
  assert.ok(source.crons.some(job=>job.path==='/api/track/cron/followups'&&job.schedule==='0 8 * * *'));
});
