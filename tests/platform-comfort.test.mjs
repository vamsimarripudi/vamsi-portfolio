import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {basePage} from '../corner/src/ui.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const shared=read('corner/public/comfort.css');

test('both renderers load one shared typography contract after legacy component styles',()=>{
 assert.match(read('src/main.jsx'),/import '\.\.\/corner\/public\/comfort\.css'/);
 assert.match(read('src/main.jsx'),/import '\.\/Comfort\.css'/);
 for(const page of ['account','wishes','insights','languages','memories']){
  const html=basePage({path:'/test',initial:{page}});
  assert.match(html,/<body class="corner-comfort">/);
  const styles=[...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(styles.filter(s=>s==='/comfort.css').length,1);assert.equal(styles.at(-1),'/comfort.css');
 }
 assert.match(read('corner/src/server.mjs'),/\['\/style.css','\/comfort.css'/);
});
test('title caps preserve rem scaling, readable inputs and keyboard/zoom escape paths',()=>{
 assert.match(shared,/--ui-title: clamp\(1\.5rem, 1\.375rem \+ \.625vw, 2rem\)/);
 assert.match(shared,/--ui-section: clamp\(1\.25rem, 1\.15rem \+ \.4vw, 1\.5rem\)/);
 assert.match(shared,/--ui-body: 1rem/);
 assert.match(shared,/min-block-size:44px/);
 assert.match(shared,/min-height:100dvh/);
 assert.match(shared,/\.signin-box \{[\s\S]*?margin-block:auto;flex-shrink:0/);
 assert.match(shared,/@media\(max-height:600px\)/);
 assert.doesNotMatch(shared,/\bzoom\s*:|transform\s*:\s*scale|font-size\s*:\s*(?:62\.5%|10px)/);
 assert.doesNotMatch(shared,/\b(?:body|html|\.signin-wrap)\s*\{[^}]*\boverflow\s*:\s*(?:hidden|clip)/);
 assert.match(shared,/prefers-reduced-motion:reduce/);
});
test('comfort layer stays local and introduces no font/CDN or tracking dependency',()=>{
 assert.doesNotMatch(shared,/@import|url\(\s*['"]?https?:|@font-face/);
 assert.ok(Buffer.byteLength(shared)<10000,'Shared contract stays below 10KB');
 assert.ok(Buffer.byteLength(read('src/Comfort.css'))<4500,'Portfolio adapters stay below 4.5KB');
});
