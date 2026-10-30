import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {adminPage,basePage} from '../src/ui.mjs';
const source=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('Photo comparison assets load only in Studio and before the editor handler',()=>{
 const html=adminPage({owner:{id:'owner',role:'owner'}});
 assert.match(html,/v6-photo-compare\.css\?v=1/);
 assert.match(html,/v6-photo-compare\.js\?v=1/);
 assert.ok(html.indexOf('/v6-photo-compare.js')<html.indexOf('/admin.js'));
 assert.ok(html.indexOf('/v6-photo-compare.css')<html.indexOf('/comfort.css'));
 const publicPage=basePage({path:'/post/example',title:'Story',initial:{page:'detail'}});
 assert.doesNotMatch(publicPage,/v6-photo-compare\.(css|js)/);
});

test('Comparison uses the unchanged first-party image and purely local preview',()=>{
 const js=source('v6-photo-compare.js'),css=source('v6-photo-compare.css');
 assert.match(js,/encodeURIComponent\(media\.storage_key\)/);
 assert.match(js,/form\.prepend\(panel\)/);
 assert.match(js,/form\.addEventListener\('input',update\)/);
 assert.match(js,/range\.addEventListener\('input',update\)/);
 assert.match(js,/filters\[/);
 assert.match(js,/--corner-compare-reveal/);
 assert.match(css,/clip-path:inset/);
 assert.match(css,/data-photo-crop/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
});

test('Media edits and restore are gated on authoritative server operations',()=>{
 const admin=source('admin.js');
 const start=admin.indexOf('function mediaEdit('),end=admin.indexOf('async function comments()',start);
 assert.ok(start>=0&&end>start);
 const editor=admin.slice(start,end);
 assert.match(editor,/CornerPhotoCompare\?\.mount/);
 assert.match(editor,/action:'media\.edit'/);
 assert.match(editor,/confirm:result=>result\?\.saved===true/);
 assert.match(editor,/detailsSaved=true/);
 assert.match(editor,/photo adjustments did not finish/);
 assert.ok(editor.indexOf("await api('/corner/api/admin/media/'+encodeURIComponent(id),'PATCH'")<
  editor.indexOf("await api('/corner/api/admin/media/'+encodeURIComponent(id)+'/edits','POST'"));
 assert.match(editor,/execute:\(\)=>api\('\/corner\/api\/admin\/media\/'\+encodeURIComponent\(id\)\+'\/edits','DELETE'\)/);
});
