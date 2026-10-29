import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {basePage,detailPage} from '../src/ui.mjs';
const css=fs.readFileSync(new URL('../public/v6-mobile-ui.css',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../public/v6-ios-fix.js',import.meta.url),'utf8');

test('iPhone refinements preserve comfort stylesheet position and assets',()=>{
 const p={id:'post_11111111-1111-4111-8111-111111111111',slug:'story',title:'Story',body:'Body',type:'moment',state:'published'};
 const pages=[basePage({path:'/test',initial:{page:'memories'}}),detailPage({post:p,media:[],comments:[]})];
 for(const html of pages){
  assert.match(html,/v6-ios-fix.css\?v=2/);
  assert.match(html,/v6-ios-fix.js\?v=2/);
  assert.ok(html.indexOf('v6-ios-fix.css')<html.indexOf('comfort.css'));
 }
 const styles=[...pages[0].matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(styles.at(-1),'/comfort.css');
});
test('icon-first Studio navigation remains 44px and restores selected tab without page jump',()=>{
 assert.match(css,/studio-nav-label/);
 assert.match(css,/scroll-snap-type:x proximity/);
 assert.match(css,/min-height:48px/);
 assert.match(css,/safe-area-inset-top/);
 assert.match(js,/nav\.scrollTo/);
 assert.match(js,/aria-current/);
 assert.doesNotMatch(js,/scrollIntoView/);
 assert.match(js,/prefers-reduced-motion/);
});
