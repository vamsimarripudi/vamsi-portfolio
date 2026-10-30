import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {basePage} from '../src/ui.mjs';

const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('Public reader motion assets load on feed and story only, before handlers and shared comfort',()=>{
 for(const page of ['feed','detail']){
  const html=basePage({title:'Corner',initial:{page},path:page==='feed'?'/':'/post/test'});
  assert.match(html,/v6-reader-motion\.css\?v=1/);
  assert.match(html,/v6-reader-motion\.js\?v=1/);
  assert.ok(html.indexOf('v6-reader-motion.css')<html.indexOf('comfort.css'));
  assert.ok(html.indexOf('v6-reader-motion.js')<html.indexOf('app.js'));
 }
 for(const page of ['admin','account','wishes']){
  const html=basePage({title:'Corner',initial:{page},path:page==='admin'?'/admin':page==='account'?'/account':'/wishes'});
  assert.doesNotMatch(html,/v6-reader-motion\.(?:css|js)/);
 }
});

test('Bookmark confirmation is invoked only after the real API succeeds and state changes',()=>{
 const js=read('v6-reader-motion.js'),app=read('app.js');
 assert.match(js,/CornerReaderMotion=Object\.freeze/);
 assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|Math\.random/);
 assert.match(app,/if\(active\)await getJson/);
 assert.match(app,/else await getJson/);
 const confirm=app.indexOf('window.CornerReaderMotion?.bookmark(bookmark,active)');
 assert.ok(confirm>app.indexOf('active=!active;draw()'));
 const start=app.indexOf("bookmark.addEventListener('click'");
 assert.ok(confirm>start&&confirm<app.indexOf('}catch(err){toast',start));
});

test('Share, comment and thread motion requires real successful operation',()=>{
 const app=read('app.js'),thread=read('v6-conversation.js');
 assert.ok(app.indexOf('window.CornerReaderMotion?.share(')>app.indexOf('await navigator.clipboard.writeText(location.href)'));
 assert.ok(app.indexOf('window.CornerReaderMotion?.comment(')>app.indexOf('const result=await request('));
 assert.ok(thread.indexOf('window.CornerReaderMotion?.reply(')>thread.indexOf("const sent=await api('/api/v5/posts/"));
 assert.match(thread,/sent\?\.state==='pending'/);
});

test('Touch photo is finger-following, resets on cancel/close, and retains Reduced Motion',()=>{
 const gallery=read('post-gallery.js'),css=read('v6-reader-motion.css');
 assert.match(gallery,/pointermove/);
 assert.match(gallery,/Math\.max\(-62,Math\.min\(62/);
 assert.match(gallery,/releaseDrag\(\)/);
 assert.match(gallery,/pointercancel/);
 assert.match(gallery,/ignoreClickUntil=performance\.now\(\)\+450/);
 assert.match(gallery,/reduced\.matches/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/corner-reader-confirm/);
 assert.match(css,/corner-reader-reply/);
});
