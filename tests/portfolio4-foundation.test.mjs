import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyPublicLegalDocuments } from '../src/legalPublicDocs.js';
import { staticRouteMeta } from '../src/seo.js';
const read = p => readFileSync(new URL('../' + p, import.meta.url),'utf8');

test('only existing portfolio documents appear in legal index before policy review',()=>{
  assert.deepEqual(legacyPublicLegalDocuments.map(d=>d.href),['/privacy','/terms']);
  assert.equal(new Set(legacyPublicLegalDocuments.map(d=>d.id)).size,legacyPublicLegalDocuments.length);
  assert.ok(legacyPublicLegalDocuments.every(d=>d.description&&d.category));
  assert.equal(staticRouteMeta['/legal'].noindex,true);
  assert.doesNotMatch(read('public/sitemap.xml'),/\/legal<\/loc>/);
});
test('legal directory has working search and existing support routes, no unverified approvals',()=>{
  const src=read('src/LegalCenter.jsx');
  assert.match(src,/setQuery\(event\.target\.value\)/);
  assert.match(src,/results\.map\(doc=>/);
  assert.match(src,/to=\{doc\.href\}/);
  assert.match(src,/to="\/contact"/);
  assert.match(src,/role="status"/);
  assert.match(src,/noindex, follow/);
  assert.doesNotMatch(src,/FileBloom|Avenfolio Press|VidyaLuma|KRAVIA/i);
  assert.doesNotMatch(src,/Approved (privacy|terms|policy)/i);
});
test('living engineering canvas keeps animation decorative, accessible and low power',()=>{
  const jsx=read('src/components/LivingEngineeringCanvas.jsx');
  const css=read('src/components/LivingEngineeringCanvas.css');
  const app=read('src/App.jsx');
  assert.match(jsx,/aria-hidden="true"/);
  assert.match(jsx,/prefers-reduced-motion: no-preference/);
  assert.match(jsx,/navigator\.connection\?\.saveData/);
  assert.match(jsx,/cancelAnimationFrame/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/pointer:coarse/);
  assert.match(app,/<LivingEngineeringCanvas\/>/);
  assert.match(app,/path="\/legal" element=\{<LegalCenter\/>\}/);
  assert.match(app,/to="\/legal">Legal center/);
});
