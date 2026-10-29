import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {feedPage,detailPage} from '../src/ui.mjs';
const css=fs.readFileSync(new URL('../public/v6-ios-fix.css',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../public/v6-ios-fix.js',import.meta.url),'utf8');
test('mobile Safari fix is scoped before the final shared typography contract',()=>{
 const post={id:'post_11111111-1111-4111-8111-111111111111',slug:'story',title:'Story',body:'Body',type:'moment',state:'published'};
 const html=detailPage({post,media:[],comments:[]});
 assert.match(html,/v6-ios-fix.css\?v=1/);assert.match(html,/v6-ios-fix.js\?v=1/);
 assert.ok(html.indexOf('v6-ios-fix.css')<html.indexOf('comfort.css'));
 const styles=[...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(styles.at(-1),'/comfort.css');
});
test('Studio nav is horizontal, snap-aware, and focus mode keeps restore accessible',()=>{
 assert.match(css,/scroll-snap-type:x proximity/);assert.match(css,/v6-reader-show\[hidden\]/);
 assert.match(js,/MutationObserver/);assert.match(js,/aria-current/);
 assert.match(js,/prefers-reduced-motion/);
});
