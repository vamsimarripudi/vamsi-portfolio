import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('analytics Apply button overrides inherited Studio colors without changing global button colors',()=>{
 const css=readFileSync(new URL('../public/analysis.css',import.meta.url),'utf8');
 assert.match(css,/\.corner-comfort \.admin-shell \.ca-controls button\{background:#111;color:#fff\}/);
 assert.match(css,/\.ca-metrics\{margin-bottom:16px\}/);
});
