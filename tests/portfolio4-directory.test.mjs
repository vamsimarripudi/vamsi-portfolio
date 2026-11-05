import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {personalProductStages} from '../src/legalProductStages.js';
import {legacyPublicLegalDocuments} from '../src/legalPublicDocs.js';
test('six personal projects are classified without fictional operative policies',()=>{
 assert.equal(personalProductStages.length,6);
 assert.equal(new Set(personalProductStages.map(p=>p.id)).size,6);
 assert.doesNotMatch(JSON.stringify(personalProductStages),/KRAVIA|VidyaLuma/i);
 for(const p of personalProductStages){
   assert.ok(p.name&&p.stage&&p.description);
   assert.ok(Array.isArray(p.documents));
   for(const id of p.documents)assert.ok(legacyPublicLegalDocuments.some(d=>d.id===id));
 }
 assert.ok(personalProductStages.filter(p=>p.id!=='portfolio').every(p=>p.documents.length===0));
});
test('user can filter public product metadata without server-side case access',()=>{
 const ui=readFileSync(new URL('../src/LegalCenter.jsx',import.meta.url),'utf8');
 assert.match(ui,/aria-label="Filter by personal product"/);
 assert.match(ui,/setProductId\(product.id\)/);
 assert.match(ui,/matchingProducts\.map/);
 assert.match(ui,/Product-specific documents are not yet consolidated/);
 assert.doesNotMatch(ui,/fetch\(|axios\(|\/api\/legal/);
});
