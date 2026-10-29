import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {basePage,adminPage} from '../src/ui.mjs';
const read=path=>fs.readFileSync(new URL('../public/'+path,import.meta.url),'utf8');
test('Toast service loads before public and Studio actions, with escaped text and bounded queue',()=>{
 const html=basePage({title:'Test',path:'/'});
 assert.ok(html.indexOf('/v6-toast.js')<html.indexOf('/v5.js'));
 assert.match(html,/v6-mobile-ui\.css/);
 const source=read('v6-toast.js');
 assert.match(source,/body\.textContent=text/);
 assert.match(source,/maxVisible=3/);
 assert.match(source,/aria-label','Dismiss notification/);
 assert.doesNotMatch(source,/innerHTML/);
});
test('Studio mobile moderation has icon-only accessible controls',()=>{
 const admin=read('admin.js'),css=read('v6-mobile-ui.css');
 assert.match(admin,/aria-label="Moderation filters"/);
 assert.match(admin,/aria-pressed=/);
 assert.match(admin,/aria-label="Approve comment"/);
 assert.match(admin,/aria-label="Delete comment"/);
 assert.match(admin,/window\.CornerToast\?\.show/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/min-height:48px/);
 assert.match(css,/studio-nav-label/);
 assert.match(adminPage({owner:{role:'owner',id:'owner'}}),/admin\.js\?v=20261029-icons1/);
});
test('Focus reading remains icon-based only on phones, with accessible name',()=>{
 const reader=read('v6-reader.js'),css=read('v6-mobile-ui.css');
 assert.match(reader,/aria-label','Enter distraction-free reading mode/);
 assert.match(css,/v6-reader-toggle:before/);
 assert.match(css,/v6-focus-icon\.svg/);
});
