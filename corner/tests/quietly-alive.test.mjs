import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createStoriesService} from '../src/stories-service.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const contents=(name)=>fs.readFileSync(path.join(root,name),'utf8');
const fixturePost={id:'published-story-1',slug:'the-quiet-letter',title:'The Quiet Letter',excerpt:'A deeply human story.',body:'Once there was a town.\n\nA letter arrived.',state:'published',type:'journal',tags:['Fiction'],published_at:'2026-11-07T08:00:00Z',updated_at:'2026-11-07T09:00:00Z',version:1};
const stories=createStoriesService({store:{all:()=>[fixturePost],listMedia:()=>[]},journalSeries:{assignment:()=>null},siteUrl:'https://example.org/corner',basePath:'/corner'});
test('library and detail use the same shared Corner header, footer and basePage',()=>{
 const src=contents('src/stories-ui.mjs');
 assert.match(src,/import \{basePage,header,footer,searchDialog\} from '\.\/ui\.mjs'/);
 const lib=stories.html('/stories');const detail=stories.html('/stories/book/the-quiet-letter');
 for(const html of [lib,detail]){
  assert.match(html,/corner-public-header/);assert.match(html,/site-footer/);
  assert.match(html,/class="corner-comfort sb-/);
  assert.match(html,/stories-unified\.css/);
  assert.match(html,/stories-library\.js/);
 }
 assert.match(detail,/stories\/read\/the-quiet-letter/);
});
test('original book animation and sound design remain intact',()=>{
 const code=contents('public/stories-reader.js'),markup=stories.html('/stories/read/the-quiet-letter');
 assert.match(code,/pointerProgress\(/);assert.match(code,/drawLeaf\(/);
 assert.match(code,/paperAudio\.move\(/);assert.match(code,/paperAudio\.land\(/);
 assert.match(markup,/data-corner-icon="sound"/);
 assert.match(markup,/data-corner-icon="page"/);
 const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'public/stories-paper.mp3'))).digest('hex');
 assert.equal(actual,'54fb0207885f8cdf46169c177ee456d2934cf526ea8c9bab5c7b906ce1336b1f');
});
test('ambient washes use 36–42 second cycles and never run in focused reading',()=>{
 const css=contents('public/corner-living-motion.css');
 assert.match(css,/36s/);assert.match(css,/42s/);assert.match(css,/38s/);
 assert.match(css,/data-v6-reading="focus"/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/corner-motion-paused/);
 assert.match(css,/\.reader-leaf,\.story-reader \.reader-book/);
});
test('shared motion durations are exactly the approved values',()=>{
 const css=contents('public/corner-living-motion.css');
 for(const [name,time] of [['fast','180ms'],['card','260ms'],['chapter','340ms'],['book','550ms']])assert.match(css,new RegExp(`--corner-motion-${name}:${time}`));
});
test('Stories Studio only runs confirmation animations after API successes',()=>{
 const s=contents('public/stories-studio.js');
 assert.match(s,/corner:stories:confirmed/);
 assert.ok(s.includes("await request(base+'/'+encodeURIComponent(p.id)+'/'+which,'POST',body)"));
 assert.match(s,/if\(which==='publish'\)motionConfirmed\('published'\)/);
 assert.match(s,/if\(!state\.dirty\)motionConfirmed\('saved'\)/);
 const studio=contents('src/stories-studio-ui.mjs');
 assert.match(studio,/stories-unified\.css/);
 assert.match(studio,/corner-living-motion\.css/);
 assert.match(studio,/data-corner-icon="pen"/);
});
test('no external animation library or external service is introduced',()=>{
 const s=contents('public/corner-living-motion.js');
 assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|WebSocket|new URL\(/);
 assert.match(s,/IntersectionObserver/);
 assert.match(s,/visibilitychange/);
});
test('unified tokens match Corner and still preserve distinctive book jackets',()=>{
 const css=contents('public/stories-unified.css');
 for(const token of ['--bg','#f8f7f3','--ink','#1c211d','--accent','#b96349'])assert.ok(css.includes(token));
 assert.match(css,/\.sb-library \.sb-cover/);
 assert.match(css,/data-studio-theme="dark"/);
});
test('local installer is fail-closed and cannot deploy or push',()=>{
 const installer=contents('../tools/apply-motion-to-repo.mjs');
 assert.match(installer,/expectedGitBlobs/);assert.match(installer,/\.quietly-alive-backup-/);
 assert.doesNotMatch(installer,/execFileSync\('git',\['(?:commit|push)'/);
 assert.doesNotMatch(installer,/execFileSync\('(?:vercel|railway)'/);
});
test('original reader, page-physics, sound, Studio services and book styles are preserved',()=>{
 const installer=contents('../tools/apply-motion-to-repo.mjs');
 assert.match(installer,/preservedGitBlobs/);
 const expected={
  'src/stories-model.mjs':'0cbd3b624231bc201e0614f2cfbd96cf169f8521',
  'src/stories-service.mjs':'7aea5c00db004ef2e2000801aa259c5b87c60ad6',
  'src/stories-studio.mjs':'ec31df3940d6a629e79a4487f9c5d970807701f5',
  'public/stories-studio.css':'8890f0644f90cc718418f363b94b7259f4a657db',
  'public/stories-library.js':'a22f099f054c9ca868dd51727588e763a37b23b0',
  'public/stories-reader.js':'f37916530048e147e75cc29a6e258c334adf506d',
  'public/stories-reader.css':'4afa1a3eeee78388c6794b848b71b87441e68402',
  'public/stories-motion.mjs':'8f28d42bed978519fe9fab41c59f23d1733a4cba',
  'public/stories-paper.mp3':'b2bd45f2565d67b5a801c68ac48c95977a70dd36'
 };
 for(const [relative,blob] of Object.entries(expected)){
  const bytes=fs.readFileSync(path.join(root,relative));
  const sha=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(sha,blob,`${relative} must stay unchanged`);
  assert.ok(installer.includes(blob),`${relative} must be hash-guarded`);
 }
 assert.match(installer,/public\/stories\.css/);
});
