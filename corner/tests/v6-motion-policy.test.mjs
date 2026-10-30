import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {basePage} from '../src/ui.mjs';
import {accountPage} from '../src/identity-ui.mjs';

const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const member={
 id:'synthetic-member',role:'member',email:'member@example.test',
 displayName:'Corner Reader',bio:'Quiet reading.',locale:'en',emailUpdates:false,
 hasAvatar:false,mfaEnabled:false
};
test('Motion policy is a first-party, early-loaded global accessibility resource',()=>{
 for(const page of ['feed','detail','admin','account','wishes']){
  const path=page==='admin'?'/admin':page==='account'?'/settings/preferences':'/';
  const html=basePage({title:'Corner',path,initial:{page}});
  assert.match(html,/v6-motion-policy\.css\?v=1/);
  assert.match(html,/v6-motion-policy\.js\?v=1/);
  assert.ok(html.indexOf('/v6-motion-policy.js')<html.indexOf('/app.js'));
  assert.ok(html.indexOf('/v6-motion-policy.css')<html.indexOf('/comfort.css'));
 }
 const policy=read('v6-motion-policy.js');
 assert.match(policy,/prefers-reduced-motion: reduce/);
 assert.match(policy,/navigator\.connection\?\.saveData/);
 assert.match(policy,/corner-motion-off/);
 assert.match(policy,/corner:motion-preference-change/);
 assert.match(policy,/cornerMotionPreference/);
 assert.doesNotMatch(policy,/fetch\(|XMLHttpRequest|sendBeacon|Math\.random/);
});
test('Private preferences offer a standalone device-local motion choice independent of mail consent',()=>{
 const html=accountPage({type:'/settings/preferences',user:member,registrationOpen:false});
 assert.match(html,/data-corner-motion-preferences/);
 assert.match(html,/cornerMotionPreference" value="minimal"/);
 assert.match(html,/cornerMotionPreference" value="balanced"/);
 assert.match(html,/cornerMotionPreference" value="playful"/);
 assert.match(html,/data-corner-motion-status/);
 assert.match(html,/Device|device/);
 const formStart=html.indexOf('data-account-form="preferences"'),formEnd=html.indexOf('</form>',formStart);
 const motionStart=html.indexOf('data-corner-motion-preferences');
 assert.ok(motionStart>formEnd,'Motion controls do not silently change server or email preferences');
 assert.match(html,/name="emailUpdates"/);
 assert.doesNotMatch(html,/data-corner-motion-preferences[\s\S]*?Subscribed successfully/);
});
test('Every significant motion channel respects the same minimal preference',()=>{
 for(const file of ['studio-motion.js','v6-action-motion.js','v6-publish-motion.js',
  'v6-reader-motion.js','post-gallery.js','v6-photo-compare.js','v6-gravity.js']){
  const src=read(file);
  assert.match(src,/CornerMotionPolicy/,file+' must respect the unified motion policy');
 }
 const css=read('v6-motion-policy.css');
 for(const className of ['corner-motion-visual','corner-reader-motion-mark',
  'v6-publish-button','v6-gravity-ghost','v6-reader-toggle']){
  assert.ok(css.includes(className),'Reduced-motion CSS is present for '+className);
 }
 assert.match(css,/::view-transition-old\(root\)/);
 assert.match(css,/quiet-motion-options/);
 assert.match(css,/data-corner-motion-level="minimal"/);
});
test('System Reduce Motion and Data Saver override in-product playful preference',()=>{
 const policy=read('v6-motion-policy.js');
 assert.match(policy,/system\.matches\|\|!!navigator\.connection\?\.saveData/);
 assert.match(policy,/blocked\(\)\|\|selected==='minimal'/);
 assert.match(policy,/root\.dataset\.cornerMotionLevel=reduced\(\)\?'minimal':selected/);
 assert.match(policy,/valid\.has\(value\)/);
});
