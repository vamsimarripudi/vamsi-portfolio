import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inDiwali2026Window,shouldPreloadDiwali2026,DIWALI_2026_END} from '../corner/src/diwali-window.mjs';

const source=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('merged Corner UI preserves seasonally gated assets and existing living-motion design',()=>{
 const ui=source('corner/src/ui.mjs');
 assert.match(ui,/import \{shouldPreloadDiwali2026\} from '\.\/diwali-window\.mjs'/);
 assert.match(ui,/const diwaliPublic=!studioPrivate&&!noindex/);
 assert.match(ui,/shouldPreloadDiwali2026\(diwaliNow\)/);
 assert.match(ui,/diwaliPublic\?'<link rel="stylesheet" href="\/diwali-2026\.css\?v=1">/);
 assert.match(ui,/diwaliPublic\?'<script src="\/diwali-2026\.js\?v=1" defer><\/script>/);
 assert.match(ui,/corner-living-motion\.css/);
});
test('seasonal promotion is inactive after the expiry boundary',()=>{
 assert.equal(inDiwali2026Window(DIWALI_2026_END-1),true);
 assert.equal(inDiwali2026Window(DIWALI_2026_END),false);
 assert.equal(shouldPreloadDiwali2026(DIWALI_2026_END),false);
});
test('Track export keeps spreadsheet formula injection escaped without corrupting CSV',()=>{
 const ui=source('src/TrackPf3Operations.jsx');
 const csv=ui.split('\n').find(line=>line.includes('String(record[key]'));
 assert.ok(csv);
 assert.ok(csv.includes(String.raw`replace(/^[=+@-]/,value=>'\u2019'+value)`));
 assert.ok(!csv.includes('const metrics'));
});
