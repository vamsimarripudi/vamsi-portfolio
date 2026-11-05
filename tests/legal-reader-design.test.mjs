import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('legal redesign preserves complete source notice bodies without replacing policy text',()=>{
 const doc=read('src/LegalDocument.jsx'),app=read('src/App.jsx');
 assert.match(doc,/<p>\{entry\.body\}<\/p>/);
 assert.match(doc,/entries\.map\(\(entry\) => \(/);
 assert.match(app,/sections=\{privacySections\}/);
 assert.match(app,/termsSections\.map/);
});
test('legal reader has real accessible ToC filtering, print, overview and mobile/print styles',()=>{
 const doc=read('src/LegalDocument.jsx'),css=read('src/LegalDocument.css');
 assert.match(doc,/Summary of key topics/);
 assert.match(doc,/TABLE OF CONTENTS/);
 assert.match(doc,/filteredHeadings\.map/);
 assert.match(doc,/aria-valuenow=\{currentPosition\}/);
 assert.match(doc,/window\.print\(\)/);
 assert.match(doc,/to="\/legal"/);
 assert.match(css,/@media print/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(doc,/termly-embed|termly\.io|iframe/i);
});
