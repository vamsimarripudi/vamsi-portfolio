import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {feedPage,hero,card} from '../src/ui.mjs';

const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const when=new Date('2026-10-26T09:00:00Z').toISOString();
const posts=[
 {id:'post_1',slug:'celebrating-a-little-thing',type:'wish',title:'A lovely little day',excerpt:'A real celebration.',body:'A note of thanks',published_at:when,featured:true,version:1},
 {id:'post_2',slug:'a-new-tool',type:'build',title:'Working on a tool',excerpt:'Progress in public',body:'A working prototype',published_at:when,version:1}
];

test('home uses approved editorial hero and six working category links',()=>{
 const html=feedPage({posts,status:{label:'Working on something interesting.',detail:'Learning and sharing.',updatedAt:when},featured:posts[0]});
 assert.match(html,/A little bit of life,/);
 assert.match(html,/one story at a time\./);
 assert.match(html,/corner-home-shell/);
 assert.match(html,/corner-home-hero/);
 assert.match(html,/id="corner-explore-title"/);
 assert.match(html,/class="corner-explore-grid"/);
 assert.equal((html.match(/class="corner-explore-tile /g)||[]).length,6);
 for(const href of ['/','/category/wishes','/category/builds','/category/notes','/category/journal','/category/moments'])
   assert.ok(html.includes('href="'+href+'"'),'Working category destination: '+href);
 assert.match(html,/corner-journal-layout/);
 assert.match(html,/corner-home-spotlight/);
 assert.match(html,/Working on something interesting\./);
 assert.match(html,/A lovely little day/);
 assert.doesNotMatch(html,/Working on a tool/,'The Latest panel shows exactly one newest story');
 assert.match(html,/href="\/post\/celebrating-a-little-thing"/);
 assert.doesNotMatch(html,/sample-a-small-new-beginning/);
});

test('empty public feed stays honest instead of injecting mockup stories',()=>{
 const html=feedPage({posts:[]});
 assert.match(html,/Nothing here yet\./);
 assert.match(html,/Your next story starts here\./);
 assert.doesNotMatch(html,/Morning thoughts/);
 assert.doesNotMatch(html,/Working on something new/);
 assert.match(html,/href="\/about">About Corner/);
});

test('homepage latest card shows first-party media and escaped text',()=>{
 const hostile={...posts[0],title:'<script>unsafe</script>'};
 const html=feedPage({posts:[hostile],featured:hostile,mediaByPost:{post_1:[{
  storage_key:'saved-photo.png',mime_type:'image/png',alt_text:'A birthday photo',focal_x:.42,focal_y:.6
 }]}});
 assert.match(html,/src="\/media\/saved-photo\.png"/);
 assert.match(html,/alt="A birthday photo"/);
 assert.match(html,/object-position:42% 60%/);
 assert.match(html,/&lt;script&gt;unsafe&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>unsafe<\/script>/);
});

test('category pages retain the existing feed type without homepage-only sections',()=>{
 const html=feedPage({active:'Builds',posts:[posts[1]]});
 assert.match(html,/THE CORNER \/ COLLECTIONS/);
 assert.match(html,/Small steps, real progress\./);
 assert.doesNotMatch(html,/class="corner-explore-grid"/);
 assert.doesNotMatch(html,/corner-home-spotlight/);
 assert.match(html,/href="\/post\/a-new-tool"/);
});

test('approved paper and six-item bottom dock are route-scoped and accessible',()=>{
 const css=read('landing.css'),server=fs.readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
 const home=feedPage({posts:[]});
 assert.match(home,/href="\/landing\.css\?v=editorial1"/);
 assert.match(css,/corner-home-hero/);
 assert.match(css,/corner-explore-grid/);
 assert.match(css,/corner-journal-layout/);
 assert.match(css,/corner-home-spotlight/);
 assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(css,/backdrop-filter:blur\(24px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/forced-colors:active/);
 assert.match(css,/corner-orbit-dock/);
 assert.match(server,/\/landing\.css/);
});
