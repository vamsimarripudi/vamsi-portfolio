import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {feedPage,detailPage} from '../src/ui.mjs';
const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const at='2026-10-29T06:20:00.000Z';
const post={id:'post_11111111-1111-4111-8111-111111111111',slug:'mobile-layout-check',type:'moment',
 title:'Storm over the palms',excerpt:'A quiet evening.',body:'A memory worth keeping.',
 published_at:at,updated_at:at,allow_comments:true,allow_reactions:true,state:'published',version:1};
test('Latest has one editorial card with a semantic action bar and no blank spotlight',()=>{
 const html=feedPage({posts:[post],featured:post});
 assert.equal((html.match(/<article class="story /g)||[]).length,1);
 assert.match(html,/class="v5-card-actions"/);
 assert.match(html,/data-v5-like/);
 assert.match(html,/data-v5-share-post=/);
 assert.match(html,/href="\/post\/mobile-layout-check#conversation"/);
 assert.doesNotMatch(html,/corner-home-spotlight/);
 assert.match(html,/href="\/v51-mobile.css\?v=20261029"/);
 assert.match(html,/src="\/v51-mobile.js\?v=20261029"/);
});
test('A genuine second featured post can appear without duplicating Latest',()=>{
 const old={...post,id:'post_22222222-2222-4222-8222-222222222222',slug:'earlier',title:'A different featured story'};
 const html=feedPage({posts:[post],featured:old});
 assert.match(html,/corner-home-spotlight/);
 assert.match(html,/A different featured story/);
 assert.equal((html.match(/<article class="story /g)||[]).length,1);
});
test('Detail anchors comments, removes emoji star and keeps reactions',()=>{
 const html=detailPage({post,comments:[],counts:{'❤️':3},media:[]});
 assert.match(html,/id="conversation" class="comments"/);
 assert.match(html,/id="comment-form"/);
 assert.match(html,/data-v5-like/);
 assert.doesNotMatch(html,/<div class="post-end">✳<\/div>/);
});
test('Layout stylesheet is late and has safe-area and reduced motion support',()=>{
 const css=read('v51-mobile.css'),js=read('v51-mobile.js');
 assert.match(css,/v5-card-actions/);
 assert.match(css,/v51-dock-hidden/);
 assert.match(css,/env\(safe-area-inset-bottom/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/min-height:44px/);
 assert.match(js,/requestAnimationFrame/);
 assert.match(js,/inert=value/);
 assert.match(js,/focusin/);
 assert.doesNotMatch(js,/localStorage|sendBeacon|fetch\(/);
});