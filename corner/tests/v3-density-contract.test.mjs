import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
test('editorial hierarchy and whitespace stay responsive and compact',()=>{
 const css=read('comfort.css');
 assert.match(css,/--ui-title: clamp\(1\.5rem, 1\.375rem \+ \.625vw, 2rem\)/);
 assert.match(css,/--ui-section: clamp\(1\.25rem, 1\.15rem \+ \.4vw, 1\.5rem\)/);
 assert.match(css,/font-size:var\(--ui-title\)!important/);
 assert.match(css,/font-size:var\(--ui-section\)!important/);
 assert.match(css,/\.hero-intro \{min-height:0;padding-block:var\(--ui-space\)/);
 assert.match(css,/@media\(max-width:767px\)/);
 assert.match(css,/min-height:100dvh/);

});
test('upload, caption and image-preview interfaces keep usable touch controls and fluid geometry',()=>{
 const css=read('post-media.css');
 assert.match(css,/Responsive gallery\/editor density/);
 assert.match(css,/\.post-gallery-grid\{gap:clamp\(8px,1\.15vw,13px\)\}/);
 assert.match(css,/max-height:min\(65dvh,480px\)/);
 assert.match(css,/\.post-media-editor \.upload-preview-card\{grid-template-columns:minmax\(88px,33%\) minmax\(0,1fr\)\}/);
 assert.match(css,/\.post-media-editor \.media-quick-edit input\{[^}]*height:40px/);
 assert.match(css,/\.post-lightbox-controls button\{width:44px;height:44px/);
 assert.match(css,/\.post-gallery-item figcaption\{/);
});
