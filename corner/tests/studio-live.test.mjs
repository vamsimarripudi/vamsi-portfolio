import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {studioSidebar,studioFrame} from '../src/studio-ui.mjs';
const asset=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('shared Studio navigation preserves roles, feature gates and accessible icon labels',()=>{
 const old=process.env.CORNER_V3_WISHES;
 try{
  process.env.CORNER_V3_WISHES='1';
  const owner=studioSidebar({role:'owner'},{active:'wishes'});
  assert.match(owner,/href="\/admin\/v3\/wishes"[^>]*aria-current="page"/);
  assert.match(owner,/aria-label="Collapse sidebar"/);
  assert.match(owner,/aria-label="Sign out"/);
  assert.match(owner,/class="studio-nav-label">Wishes/);
  const editor=studioSidebar({role:'editor'},{interactive:true});
  assert.match(editor,/data-admin-view="posts"/);assert.match(editor,/data-admin-view="media"/);
  assert.doesNotMatch(editor,/data-admin-view="settings"|\/admin\/v3\/wishes/);
  const moderator=studioSidebar({role:'moderator'},{interactive:true});
  assert.match(moderator,/data-admin-view="comments"/);assert.doesNotMatch(moderator,/data-admin-view="posts"/);
  process.env.CORNER_V3_WISHES='0';assert.doesNotMatch(studioSidebar({role:'owner'}),/\/admin\/v3\/wishes/);
 }finally{if(old===undefined)delete process.env.CORNER_V3_WISHES;else process.env.CORNER_V3_WISHES=old}
});
test('private frame supplies one sidebar without replacing trusted content',()=>{
 const html=studioFrame({role:'owner'},'memories','<main id="content">Existing private form</main>');
 assert.equal((html.match(/<aside /g)||[]).length,1);assert.match(html,/<main id="content">Existing private form<\/main>/);
 assert.doesNotMatch(html,/class="site-header"|class="site-footer"/);
});
test('sidebar is viewport-fixed, content is top-aligned, and mobile navigation becomes a labeled swipe rail',()=>{
 const css=asset('studio.css'),command=asset('command-center.css');assert.match(css,/\.admin-sidebar\{position:fixed/);
 assert.match(css,/\.admin-main\{[^}]*margin:0/);assert.match(css,/\.admin-nav\{[^}]*overflow-y:auto/);
 assert.match(css,/@media\(max-width:767px\)/);assert.match(css,/position:sticky;[\s\S]*top:0/);
 assert.match(css,/flex:0 0 64px!important/);
 assert.match(css,/studio-nav-label[\s\S]*display:block!important/);
 assert.match(command,/command-section-switch/);assert.match(command,/command-overview-card/);
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/data-studio-collapsed=true/);
});
test('live wish input renders text locally and cannot publish as a preview side effect',()=>{
 const js=asset('v3-wishes.js'),preview=js.slice(js.indexOf('const syncPreview='),js.indexOf('const changed='));
 assert.match(preview,/\.textContent=value/);assert.doesNotMatch(preview,/innerHTML|fetch\(|call\(/);
 assert.match(js,/addEventListener\('input',changed\)/);assert.match(js,/revision!==started/);
 assert.match(js,/Save your edits before publishing/);assert.match(js,/beforeunload/);
 assert.doesNotMatch(js,/call\('\/preview'|location\.reload\(/);
});
test('optional motion stays local, lazy and bounded without increasing the baseline asset budgets',()=>{
 const js=asset('studio-motion.js');assert.match(js,/gsap-3\.15\.0\.min\.js/);
 assert.match(js,/prefers-reduced-motion: reduce/);assert.match(js,/sessionStorage/);
 assert.match(js,/aria-hidden','true'/);assert.match(js,/pagehide/);
 assert.doesNotMatch(js,/https?:\/\/[^'" ]+(?:cdn|gsap)/);
 assert.ok(Buffer.byteLength(js)<12000);assert.ok(Buffer.byteLength(asset('studio.css'))<13000);
 const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.dependencies.gsap,'3.15.0');
 const distribution=fs.readFileSync(new URL(import.meta.resolve('gsap/dist/gsap.min.js')),'utf8');assert.match(distribution,/3\.15\.0/);
});
