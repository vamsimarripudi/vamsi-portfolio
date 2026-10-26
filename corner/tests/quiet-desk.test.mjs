import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {accountPage} from '../src/identity-ui.mjs';
import {header} from '../src/ui.mjs';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const member={
 id:'member_test',role:'member',email:'test.member@example.invalid',
 displayName:'A thoughtful reader',bio:'Keeping a <small> moment & more.',locale:'te',
 emailUpdates:false,hasAvatar:true,mfaEnabled:false,verified:true
};
const staff={...member,id:'owner_test',role:'owner',displayName:'Owner'};
const routes=['/profile','/settings/profile','/saved','/settings/preferences','/settings/security','/settings/privacy'];
const page=(type,user=member)=>accountPage({type,user});

test('all six private pages use exactly one accessible Quiet Desk shell',()=>{
 for(const route of routes){
  const html=page(route);
  assert.match(html,/class="account-shell account-shell--quiet"/,route);
  assert.match(html,/data-account-workspace/,route);
  assert.match(html,/aria-label="My account sections"/,route);
  assert.match(html,/href="\/settings\/preferences"/,route);
  assert.match(html,/href="\/saved"/,route);
  assert.match(html,/href="\/settings\/privacy"/,route);
  assert.match(html,/href="\/account-quiet\.css\?v=quiet1"/,route);
  assert.doesNotMatch(html,/account-dashboard\.css/,route);
  assert.doesNotMatch(html,/corner-orbit-dock/,route);
  assert.match(html,/noindex,nofollow/,route);
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1,'Exactly one selected account section '+route);
 }
});

test('overview is private, uses real identity and does not invent counts or activity',()=>{
 const html=page('/profile');
 assert.match(html,/data-profile-summary/);
 assert.match(html,/A thoughtful reader/);
 assert.match(html,/Keeping a &lt;small&gt; moment &amp; more\./);
 assert.match(html,/data-quiet-screen="overview"/);
 assert.match(html,/href="\/settings\/profile"/);
 assert.match(html,/href="\/saved"/);
 assert.match(html,/Telugu · Email updates off/);
 assert.doesNotMatch(html,/12 stories|5 saved|Recent activity|Drafts|Favorites/);
 assert.doesNotMatch(html,/account-profile-overview/,'Old duplicated overview is not rendered');
 assert.doesNotMatch(html,/href="\/admin"/,'No Studio access shown to a member');
 const owner=page('/profile',staff);
 assert.match(owner,/href="\/admin"/,'Owner has Studio shortcut');
});

test('avatar editing is focused on edit profile, not repeated across pages',()=>{
 const profile=page('/profile'),editor=page('/settings/profile');
 assert.match(profile,/src="\/api\/v1\/me\/avatar"/);
 assert.doesNotMatch(profile,/data-account-avatar/,'No upload controls on overview');
 assert.match(editor,/data-account-avatar/);
 assert.match(editor,/data-avatar-file/);
 assert.match(editor,/data-bio-count/);
 assert.match(editor,/data-account-form="profile"/);
 assert.doesNotMatch(editor,/name="emailUpdates"/,'Updates belong to Preferences');
 assert.doesNotMatch(editor,/name="locale"/,'Language belongs to Preferences');
});

test('saved shelf uses existing bookmarks and preserves honest zero state',()=>{
 const html=page('/saved');
 assert.match(html,/data-account-bookmarks/);
 assert.match(html,/data-bookmark-count/);
 assert.match(html,/Loading saved stories/);
 const script=read('public/account.js');
 assert.match(script,/api\('me\/bookmarks'\)/);
 assert.match(script,/api\('me\/bookmarks\/'\+encodeURIComponent\(book\.id\),'DELETE'\)/);
 assert.match(script,/No saved stories yet/);
 assert.doesNotMatch(html,/<li>Morning thoughts|12 Saved Stories/);
});

test('preferences switch saves via existing dedicated endpoint without resetting profile data',()=>{
 const html=page('/settings/preferences');
 assert.match(html,/data-account-form="preferences"/);
 assert.match(html,/name="locale"/);
 assert.match(html,/name="emailUpdates"/);
 assert.match(html,/class="quiet-switch"/);
 assert.match(html,/Optional email updates/);
 const js=read('public/account.js');
 assert.match(js,/preferences:'me\/preferences'/);
 assert.match(js,/api\(endpoints\.preferences,'PATCH'/);
 assert.match(js,/locale:initial\.account\?\.locale\|\|'en'/);
 assert.match(js,/emailUpdates:initial\.account\?\.emailUpdates===true/);
});

test('security and privacy actions retain reviewable first-party behavior',()=>{
 const security=page('/settings/security');
 assert.match(security,/data-account-form="password-change"/);
 assert.match(security,/data-account-sessions/);
 assert.match(security,/data-account-form="email-change"/);
 const ownerSecurity=page('/settings/security',staff);
 assert.doesNotMatch(ownerSecurity,/data-account-form="email-change"/);
 const privacy=page('/settings/privacy');
 assert.match(privacy,/data-account-export/);
 assert.match(privacy,/data-account-delete-dialog/);
 assert.match(privacy,/data-delete-cancel/);
 assert.match(privacy,/data-delete-confirm/);
 assert.match(privacy,/does not immediately remove/i);
 const code=read('public/account.js');
 assert.match(code,/api\('me\/deletion','POST'/);
 assert.match(code,/api\('me\/export','POST'/);
});

test('signed-out users cannot see account detail and legacy sign-in works',()=>{
 for(const route of routes){
  const html=page(route,null);
  assert.match(html,/Sign in to access your private information/,route);
  assert.doesNotMatch(html,/data-quiet-screen=/,route);
  assert.doesNotMatch(html,/test\.member@example\.invalid/);
 }
 const login=accountPage({type:'/login',user:null,registrationOpen:true});
 assert.match(login,/data-account-form="login"/);
 assert.match(login,/href="\/account\.css"/);
 const publicMenu=header();
 assert.match(publicMenu,/data-profile-guest/);
 assert.match(publicMenu,/data-profile-member hidden/);
 assert.match(publicMenu,/href="\/saved"/);
 assert.match(publicMenu,/href="\/settings\/preferences"/);
 assert.match(publicMenu,/href="\/settings\/privacy"/);
 assert.match(publicMenu,/data-owner-studio.+hidden/);
});

test('original VM mark and reduced-motion/accessible switch styling survive',()=>{
 const css=read('public/account-quiet.css'),profile=page('/profile');
 assert.match(profile,/src="\/mark\.svg\?v=vm-20261027"/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/quiet-switch input:focus-visible\+span/);
 assert.match(css,/quiet-confirm-dialog::backdrop/);
 assert.match(css,/body\.corner-comfort:has\(\.account-shell\) \.corner-orbit-dock/);
});
