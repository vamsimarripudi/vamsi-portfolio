import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('mobile analytics keeps view controls compact without shrinking interactive targets',()=>{
 const css=readFileSync(new URL('../public/analysis-explore.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:767px\)\{\.ax-view-controls\{margin-bottom:8px;gap:6px\}\}/);
 assert.match(css,/min-height:44px/);
 assert.doesNotMatch(css,/html\s*\{[^}]*overflow\s*:\s*hidden/);
});
