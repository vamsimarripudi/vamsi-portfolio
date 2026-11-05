import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {personalProductStages} from '../src/legalProductStages.js';
import {legacyPublicLegalDocuments} from '../src/legalPublicDocs.js';
test('public legal directory lists announced personal products only',()=>{
 assert.deepEqual(personalProductStages.map(p=>p.id),['portfolio','corner','pakkafollow']);
 assert.doesNotMatch(JSON.stringify(personalProductStages),/KRAVIA|VidyaLuma|FileBloom|Avenfolio|Living Calendar/i);
 for(const p of personalProductStages){
   assert.ok(p.name&&p.stage&&p.description);
   assert.ok(Array.isArray(p.documents));
   for(const id of p.documents)assert.ok(legacyPublicLegalDocuments.some(d=>d.id===id));
 }
 assert.ok(personalProductStages.filter(p=>p.id!=='portfolio').every(p=>p.documents.length===0));
});
test('public product filters never imply legal review or remote case access',()=>{
 const ui=readFileSync(new URL('../src/LegalCenter.jsx',import.meta.url),'utf8');
 assert.match(ui,/aria-label="Filter by personal product"/);
 assert.match(ui,/setProductId\(product.id\)/);
 assert.match(ui,/matchingProducts\.map/);
 assert.match(ui,/Product-specific documents are not yet consolidated/);
 assert.doesNotMatch(ui,/fetch\(|axios\(|\/api\/legal/);
});
