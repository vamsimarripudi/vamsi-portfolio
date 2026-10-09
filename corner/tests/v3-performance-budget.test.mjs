import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {basePage} from '../src/ui.mjs';
import {PHOTO_VARIANTS} from '../src/v3-image-derivatives.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const size=filename=>fs.statSync(path.join(root,'public',filename)).size;

test('Corner baseline and optional phases respect strict static transfer budgets',()=>{
 const baselineCSS=['style.css','magic.css','v3.css','v3-memories.css'].reduce((sum,f)=>sum+size(f),0);
 const baselineJS=['app.js','nav.js','v3.js','v3-memories.js'].reduce((sum,f)=>sum+size(f),0);
 const wishes=size('v3-wishes.css')+size('v3-wishes.js');
 const phase4=size('v3-phase4.css')+size('v3-phase4.js');
 assert.ok(baselineCSS<90000,'Core CSS must remain under 90 KB uncompressed, got '+baselineCSS);
 assert.ok(baselineJS<24000,'Core JS must remain under 24 KB uncompressed, got '+baselineJS);
 assert.ok(wishes<18000,'Wishes optional assets must stay under 18 KB uncompressed');
 assert.ok(phase4<13000,'Phase 4 optional assets must remain under 13 KB');
 const publicHTML=basePage({title:'Example',content:'<main id="content">Example</main>'});
 assert.doesNotMatch(publicHTML,/v3-wishes\.js|v3-phase4\.js/,'No owner-only JS on public page');
 assert.doesNotMatch(publicHTML,/google-analytics|googletagmanager|doubleclick|facebook\.net/i,'No third-party analytics scripts');
});

test('Gallery has bounded physical image variants and no arbitrary size API',()=>{
 assert.deepEqual(Object.keys(PHOTO_VARIANTS).sort(),['card','tile','viewer']);
 assert.ok(PHOTO_VARIANTS.tile.maxBytes<=160000);
 assert.ok(PHOTO_VARIANTS.card.maxBytes<=300000);
 assert.ok(PHOTO_VARIANTS.viewer.maxBytes<=950000);
 assert.ok(PHOTO_VARIANTS.viewer.width<=1600);
});
