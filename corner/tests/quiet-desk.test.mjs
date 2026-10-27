import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {accountPage} from '../src/identity-ui.mjs';
import {header} from '../src/ui.mjs';

const asset=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const person={
  id:'synthetic-verified-member',role:'member',email:'verified@example.test',displayName:'Vamsi',
  bio:'A little space for real stories.',locale:'en',emailUpdates:false,
  hasAvatar:true,mfaEnabled:false
};
const owner={...person,id:'synthetic-owner',role:'owner',email:'owner@example.test'};
const page=(route,user=person)=>accountPage({type:route,user,registrationOpen:true});
const privateRoutes=['/profile','/settings/profile','/saved','/settings/preferences','/settings/security','/settings/privacy'];

test('Quiet Desk is a coherent private six-screen account workspace with real user data',()=>{
  for(const route of privateRoutes){
    const html=page(route);
    assert.match(html,/class="account-shell account-shell--quiet"/,route);
    assert.match(html,/data-account-workspace/,route);
    assert.match(html,/aria-label="My account sections"/,route);
    assert.match(html,/href="\/account-quiet\.css\?v=quiet1"/,route);
    assert.match(html,/src="\/account\.js\?v=quiet1"/,route);
    assert.match(html,/verified@example\.test/,route);
    assert.match(html,/Private account · Signed in/,route);
    assert.doesNotMatch(html,/class="quiet-session-note"[^>]*>[^<]*Signed in as/, 'Account status should not repeat the email on every screen');
    assert.match(html,/role="navigation"|<nav class="quiet-navigation"/,route);
    assert.match(html,/src="\/mark\.svg\?v=vm-20261027"/,route);
    assert.doesNotMatch(html,/12 Stories|8 Moments|5 Saved/,'Never inject mockup counts');
    assert.doesNotMatch(html,/class="account-intro"/,'Legacy tall layout must be removed');
    assert.doesNotMatch(html,/href="\/admin"/,'Members cannot see Studio access');
    for(const destination of privateRoutes)assert.ok(html.includes('href="'+destination+'"'),'Navigation route '+destination+' on '+route);
  }
});

test('Quiet Desk overview has one private profile hero and actions that open proper screens',()=>{
  const html=page('/profile');
  assert.match(html,/data-quiet-screen="overview"/);
  assert.match(html,/quiet-profile-hero/);
  assert.match(html,/A little space for real stories\./);
  assert.match(html,/src="\/api\/v1\/me\/avatar"/);
  assert.match(html,/class="quiet-edit-pill"/);
  assert.match(html,/href="\/saved"/);
  assert.match(html,/href="\/settings\/preferences"/);
  assert.match(html,/href="\/settings\/security"/);
  assert.match(html,/href="\/settings\/privacy"/);
  assert.doesNotMatch(html,/data-account-form="profile"/,'Editing is a separate screen');
  assert.doesNotMatch(html,/data-bookmark-count/,'Overview does not claim to have fetched bookmark totals');
});

test('Edit Profile retains private image crop and name/bio fields, with separate preferences',()=>{
  const html=page('/settings/profile');
  assert.match(html,/data-quiet-screen="edit"/);
  assert.match(html,/data-account-avatar/);
  assert.match(html,/data-avatar-file/);
  assert.match(html,/data-avatar-remove/);
  assert.match(html,/data-account-form="profile"/);
  assert.match(html,/name="displayName"/);
  assert.match(html,/name="bio"/);
  assert.match(html,/maxlength="280"/);
  assert.match(html,/data-bio-count/);
  assert.match(html,/Save changes/);
  assert.doesNotMatch(html,/name="emailUpdates"/);
  assert.doesNotMatch(html,/name="locale"/);
});

test('Saved Stories uses real private bookmark API, safe empty state and removal',()=>{
  const html=page('/saved');
  const client=asset('public/account.js');
  assert.match(html,/data-quiet-screen="saved"/);
  assert.match(html,/data-account-bookmarks/);
  assert.match(html,/data-bookmark-count/);
  assert.doesNotMatch(html,/No saved stories yet\./,'Empty state only after API success');
  assert.match(client,/api\('me\/bookmarks'\)/);
  assert.match(client,/api\('me\/bookmarks\/'\+encodeURIComponent\(book\.id\),'DELETE'\)/);
  assert.match(client,/No saved stories yet\./);
  assert.match(client,/quiet-bookmark-remove/);
  assert.match(client,/data-bookmark-count/);
});

test('Preferences use the existing PATCH endpoint and an accessible on/off switch',()=>{
  const html=page('/settings/preferences');
  const client=asset('public/account.js');
  assert.match(html,/data-quiet-screen="preferences"/);
  assert.match(html,/data-account-form="preferences"/);
  assert.match(html,/name="locale"/);
  assert.match(html,/option value="en"/);
  assert.match(html,/option value="te"/);
  assert.match(html,/option value="hi"/);
  assert.match(html,/name="emailUpdates" role="switch"/);
  assert.match(html,/Save preferences/);
  assert.match(client,/preferences:'me\/preferences'/);
  assert.match(client,/kind==='preferences'/);
  assert.match(client,/emailUpdates:!!first\('input\[name=emailUpdates\]'/);
  assert.match(client,/locale:initial\.account\?\.locale\|\|'en'/);
});

test('Security preserves active sessions, owner restrictions, email verification and MFA',()=>{
  const member=page('/settings/security'),admin=page('/settings/security',owner);
  assert.match(member,/data-quiet-screen="security"/);
  assert.match(member,/quiet-current-email/);
  assert.match(member,/verified@example\.test/);
  assert.match(admin,/owner@example\.test/);
  assert.match(member,/data-account-form="password-change"/);
  assert.match(member,/name="currentPassword"/);
  assert.match(member,/name="newPassword"/);
  assert.match(member,/data-account-sessions/);
  assert.match(member,/data-account-form="email-change"/);
  assert.doesNotMatch(member,/href="\/admin"/);
  assert.match(admin,/href="\/admin"/);
  assert.match(admin,/href="\/admin\/mfa"/);
  assert.match(admin,/Changes to the owner address require additional verification/);
  assert.doesNotMatch(admin,/data-account-form="email-change"/);
});

test('Privacy controls retain first-party API actions and require deletion confirmation',()=>{
  const html=page('/settings/privacy'),client=asset('public/account.js');
  assert.match(html,/data-quiet-screen="privacy"/);
  assert.match(html,/data-account-export/);
  assert.match(html,/data-account-delete/);
  assert.match(html,/data-account-delete-dialog/);
  assert.match(html,/data-delete-confirm/);
  assert.match(html,/data-delete-cancel/);
  assert.match(html,/No immediate deletion happens/);
  assert.match(client,/api\('me\/export','POST'/);
  assert.match(client,/api\('me\/deletion','POST'/);
  assert.match(client,/deletionDialog\.showModal\(\)/);
  assert.match(client,/Deletion review requested/);
});

test('Unauthorized visitors cannot access any private account content',()=>{
  for(const route of privateRoutes){
    const html=accountPage({type:route,user:null});
    assert.match(html,/Sign in to access your private information/,route);
    assert.doesNotMatch(html,/data-account-workspace/,route);
    assert.doesNotMatch(html,/data-account-export/,route);
    assert.doesNotMatch(html,/data-account-bookmarks/,route);
    assert.doesNotMatch(html,/verified@example\.test/,route);
  }
  const login=accountPage({type:'/login',user:null});
  assert.match(login,/data-account-form="login"/);
  assert.doesNotMatch(login,/account-shell--quiet/);
  assert.match(accountPage({type:'/register',user:null,registrationOpen:true}),/data-account-form="register"/);
});

test('User-provided text is escaped in private account markup',()=>{
  const dangerous={...person,displayName:'<img src=x onerror=alert(1)>',
    bio:'<script>window.sneaky=true</script>',email:'fake<b>@example.test'};
  const html=page('/profile',dangerous);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html,/&lt;script&gt;window\.sneaky=true&lt;\/script&gt;/);
  const security=page('/settings/security',dangerous);
  assert.match(security,/class="quiet-current-email"/,'Email is shown in Security, not Overview');
  assert.match(security,/fake&lt;b&gt;@example\.test/,'Email markup remains escaped');
  assert.doesNotMatch(html,/<script>window\.sneaky/);
  assert.doesNotMatch(security,/<b>@example\.test/);
});

test('Public profile menu is compact and role-gated by authenticated session',()=>{
  const markup=header(),client=asset('public/experience.js'),nav=asset('public/companion.js');
  assert.match(markup,/corner-profile-card--quiet/);
  assert.match(markup,/data-profile-guest/);
  assert.match(markup,/data-profile-member hidden/);
  assert.match(markup,/data-profile-menu-avatar/);
  assert.match(markup,/data-owner-studio href="\/admin" hidden/);
  assert.match(markup,/href="\/saved"/);
  assert.match(markup,/href="\/settings\/preferences"/);
  assert.match(markup,/data-profile-logout/);
  assert.match(client,/loggedIn&&\['owner','admin','editor','moderator'\]/);
  assert.match(client,/data-profile-trigger-avatar/);
  assert.match(client,/api\/v1\/auth\/logout/);
  assert.match(nav,/\.admin-shell,\.signin-wrap,\.account-shell/,'Pulse does not overlap account screens');
});

test('Quiet Desk is mobile-first and preserves accessibility and account APIs',()=>{
  const css=asset('public/account-quiet.css');
  const js=asset('public/account.js'),server=asset('src/server.mjs');
  assert.match(css,/\.quiet-desk-grid/);
  assert.match(css,/\.quiet-navigation/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/\.quiet-profile-hero/);
  assert.match(css,/\.quiet-bookmarks/);
  assert.match(css,/\.quiet-switch input:focus-visible/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/@media\(max-width:390px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/@media\(forced-colors:active\)/);
  assert.match(server,/\/account-quiet\.css/);
  assert.match(js,/CornerImageCrop\.open/);
  assert.match(js,/api\('me\/sessions'\)/);
  assert.match(js,/data-account-delete-dialog/);
});


test('editing has explicit discard and cancel with guarded navigation and safe save',()=>{
 const account=fs.readFileSync(new URL('../public/account.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../public/account-quiet.css',import.meta.url),'utf8');
 assert.match(account,/const dirtyForms=/);
 assert.match(account,/new WeakMap\(\)/);
 assert.match(account,/new FormData\(form\)/);
 assert.match(account,/window\.addEventListener\('beforeunload'/);
 assert.match(account,/data-discard-cancel/);
 assert.match(account,/data-discard-confirm/);
 assert.match(account,/data-discard-edits/);
 assert.match(account,/data-edit-cancel/);
 assert.match(account,/markClean\(form\);response\(form,'Profile updated\.'/);
 assert.match(account,/markClean\(form\);response\(form,'Preferences saved\.'/);
 assert.match(css,/\.quiet-discard-dialog/);
 assert.match(css,/\.quiet-edit-exit/);
});
test('first-visit letter is a real one-time introduction and not the obsolete note',()=>{
 const js=fs.readFileSync(new URL('../public/companion.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../public/companion.css',import.meta.url),'utf8');
 assert.match(js,/corner-welcome-letter-v2/);
 assert.doesNotMatch(js,/corner-welcome-v1/);
 assert.match(js,/A little hello, from me to you\./);
 assert.match(js,/Glad you found your way here/);
 assert.match(js,/data-letter-explore/);
 assert.match(js,/data-letter-dismiss/);
 assert.match(js,/data-letter-join/);
 assert.match(js,/localStorage\.setItem\(welcomeKey,'seen'\)/);
 assert.match(css,/\.corner-welcome-letter/);
 assert.match(css,/safe-area-inset-bottom/);
});
