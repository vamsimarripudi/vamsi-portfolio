import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {adminPage,basePage} from '../src/ui.mjs';

const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('The animated Publish controller loads in Studio before the editor and remains private',()=>{
 const html=adminPage({owner:{id:'owner',role:'owner'}});
 assert.match(html,/v6-publish-motion\.css\?v=1/);
 assert.match(html,/v6-publish-motion\.js\?v=1/);
 assert.ok(html.indexOf('v6-publish-motion.js')<html.indexOf('admin.js?v=20261029-icons1'));
 assert.ok(html.indexOf('v6-publish-motion.css')<html.indexOf('comfort.css'));
 const publicPage=basePage({title:'Story',path:'/',initial:{page:'feed'}});
 assert.doesNotMatch(publicPage,/v6-publish-motion\.(css|js)/);
});

test('Green Published is only reachable after the real Studio publish API succeeds',()=>{
 const logic=read('v6-publish-motion.js');
 const admin=read('admin.js');
 assert.match(logic,/button\.dataset\.v6PublishState=next/);
 assert.match(logic,/startAt=performance\.now\(\)/);
 assert.match(logic,/phase!=='pending'/);
 assert.match(logic,/aria-busy/);
 assert.match(logic,/Publishing story/);
 assert.match(logic,/Published successfully/);
 const call="const published=await api('/corner/api/admin/posts/'+saved.id+'/publish','POST')";
 assert.ok(admin.includes(call));
 assert.ok(admin.indexOf(call)<admin.indexOf('await publishMotion?.success()'));
 assert.match(admin,/if\(publishing\|\|publishMotion\?\.start\(\)===false\)return/);
 assert.match(admin,/publishMotion\?\.failure/);
 assert.match(admin,/publishButton\.disabled=true/);
});

test('Publish button has circle, progress, completed and retry states plus Reduced Motion',()=>{
 const css=read('v6-publish-motion.css'),js=read('v6-publish-motion.js');
 for(const state of ['pending','confirmed','success','error'])
   assert.ok(css.includes('data-v6-publish-state="'+state+'"'),state+' styling exists');
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/v6-publish-ring-spin/);
 assert.match(css,/inline-size:54px/);
 assert.match(js,/window\.CornerPublishMotion/);
 assert.doesNotMatch(js,/fetch\(|XMLHttpRequest/);
 assert.doesNotMatch(css,/@import|url\(\s*["']?https?:/);
});
