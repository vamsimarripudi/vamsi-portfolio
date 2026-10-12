import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
test('editorial hierarchy and whitespace stay responsive and compact',()=>{
 const css=read('magic.css');
 assert.match(css,/Compact responsive editorial hierarchy/);
 assert.match(css,/\.hero-content h1\{font-size:clamp\(2rem,6\.4vw,2\.9rem\)/);
 assert.match(read('post-media.css'),/\.admin-top h1\{font-size:clamp\(1\.45rem,5vw,1\.85rem\)/);
 assert.match(read('post-media.css'),/\.admin-main\{padding:14px var\(--corner-gutter\) 23px\}/);
 assert.match(css,/\.feed-heading h2\{font-size:clamp\(1\.35rem,4\.6vw,2rem\)/);
 assert.match(css,/@media\(max-width:767px\)/);
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
