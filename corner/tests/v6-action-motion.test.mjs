import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {adminPage,basePage} from '../src/ui.mjs';
import {accountPage} from '../src/identity-ui.mjs';
import {wishesStudioPage} from '../src/v3-wishes-ui.mjs';
import {Store} from '../src/store.mjs';
import {WishesStudio} from '../src/v3-wishes.mjs';

const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const js=read('v6-action-motion.js'),css=read('v6-action-motion.css');

test('Corner Motion is loaded before Studio and account/Wishes scripts without public bundle',()=>{
 const studio=adminPage({owner:{id:'owner',role:'owner'}});
 assert.match(studio,/v6-action-motion\.js\?v=2/);
 assert.match(studio,/v6-action-motion\.css\?v=2/);
 assert.ok(studio.indexOf('/v6-action-motion.js')<studio.indexOf('/admin.js'));
 const account=accountPage({type:'/settings/profile',user:{id:'reader',role:'member',displayName:'Reader',email:'reader@test.local'}});
 assert.match(account,/v6-action-motion\.js\?v=2/);
 assert.ok(account.indexOf('/v6-action-motion.js')<account.indexOf('/account.js'));
 const store=new Store(':memory:');
 try{
  const wishes=new WishesStudio(store,{env:{CORNER_V3_WISHES:'1'}});
  const wish=wishesStudioPage(wishes,{id:'owner',role:'owner'});
  assert.match(wish,/v6-action-motion\.js\?v=2/);
  assert.match(wish,/v6-action-motion\.css\?v=2/);
 }finally{store.close()}
 const publicPage=basePage({title:'Public story',path:'/',initial:{page:'feed'}});
 assert.doesNotMatch(publicPage,/v6-action-motion\.(?:js|css)/);
});

test('Real operation and exact triggering target decide success; no URL-matching or global click hijacking',()=>{
 assert.match(js,/const active=new WeakMap\(\),targets=new Map\(\)/);
 assert.match(js,/targetId\?action\+':'.*targetId/);
 assert.match(js,/const result=await execute\(/);
 assert.match(js,/confirm\(result\)!==true/);
 assert.match(js,/onSuccess&&trigger\.isConnected/);
 assert.match(js,/if\(active\.has\(trigger\)\)/);
 assert.doesNotMatch(js,/document\.addEventListener\('click'/);
 assert.doesNotMatch(js,/pathname.*success|pathMatches|corner:action-result/);
});

test('All action metaphors and Reduced Motion are present without false percentages',()=>{
 for(const kind of ['draft.save','post.schedule','post.archive','post.restore',
  'media.upload','media.order','media.edit','media.delete',
  'comment.approve','comment.hide','comment.delete','comment.reply',
  'profile.save','account.preferences','wish.save','wish.schedule','wish.publish','wish.notify']){
  assert.ok(js.includes("'"+kind+"'"),'Action supported '+kind);
 }
 assert.match(css,/cm-paper/);assert.match(css,/cm-clock/);assert.match(css,/cm-lift/);
 assert.match(css,/cm-card-out/);assert.match(css,/cm-ink/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(js,/Math\.random|fakeProgress|fakePercentage/);
 assert.match(js,/Keep retry\/error visible long enough/);
 assert.match(js,/setTimeout\(resolve,420\)/);
});

test('Studio mutating operations use scoped motion, preserve draft versions and worker status',()=>{
 const editor=read('admin.js');
 assert.match(editor,/async function actionMotion/);
 assert.match(editor,/editorRevision\+\+/);
 assert.match(editor,/Earlier edits saved/);
 assert.match(editor,/action:'draft.save'/);
 assert.match(editor,/action:'post.schedule'/);
 assert.match(editor,/action:'media.upload'/);
 assert.match(editor,/action:'comment.approve'|\+operation/);
 assert.match(editor,/status\.textContent=step;progress\(step\)/);
 assert.match(editor,/Video is still being processed/);
 assert.match(read('account.js'),/action:'profile.save'|\?'profile.save'/);
 assert.match(read('v3-wishes.js'),/action:'wish.save'/);
 assert.match(read('v3-wishes.js'),/action:'wish.schedule'/);
});


test('Owner Motion Lab is explicitly preview-only and makes no API requests',()=>{
 const admin=read('admin.js');
 const css=read('v6-action-motion.css');
 assert.match(admin,/STUDIO \/ MOTION LAB/);
 assert.match(admin,/Preview only · no data will be saved, published or sent/);
 assert.match(admin,/data-motion-preview/);
 assert.match(admin,/preview:true/);
 assert.match(admin,/no data was changed/);
 assert.match(css,/corner-motion-lab-grid/);
});
