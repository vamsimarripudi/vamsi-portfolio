import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {accountPage} from '../src/identity-ui.mjs';
import {header,basePage} from '../src/ui.mjs';

const asset=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const member={
 id:'synthetic-member',role:'member',email:'verified@example.test',displayName:'Vamsi',
 bio:'A little space for real stories.',locale:'en',emailUpdates:false,hasAvatar:true,mfaEnabled:false
};
const owner={...member,id:'synthetic-owner',role:'owner',email:'owner@example.test'};
const page=(type,user=member)=>accountPage({type,user,registrationOpen:true});

test('signed-in member profile uses the approved Quiet Desk and real private identity fields',()=>{
 const html=page('/profile');
 assert.match(html,/class="account-shell account-shell--dashboard"/);
 assert.match(html,/class="account-workspace-layout"/);
 assert.match(html,/aria-label="Account sections"/);
 assert.match(html,/Your quiet space\./);
 assert.match(html,/Signed in as verified@example\.test/);
 assert.match(html,/class="account-identity-card"/);
 assert.match(html,/src="\/api\/v1\/me\/avatar"/);
 assert.match(html,/A little space for real stories\./);
 assert.match(html,/data-account-bookmarks/);
 assert.match(html,/data-account-saved-count/);
 assert.match(html,/data-account-export/);
 assert.match(html,/data-account-delete/);
 assert.match(html,/data-account-logout/);
 assert.match(html,/href="\/profile#account-saved"/);
 assert.match(html,/href="\/settings\/profile#account-preferences"/);
 assert.match(html,/href="\/settings\/security"/);
 assert.match(html,/href="\/account\.css"/);
 assert.match(html,/href="\/account-dashboard\.css\?v=quietdesk1"/);
 assert.doesNotMatch(html,/No saved stories yet\./,'No fabricated bookmark result before the real API responds');
 assert.doesNotMatch(html,/12 Stories|8 Moments|5 Saved/,'No synthetic activity totals');
 assert.doesNotMatch(html,/class="account-profile-overview"/,'Superseded large legacy overview not rendered');
 assert.doesNotMatch(html,/href="\/admin"/,'Member must not see owner Studio navigation');
});

test('profile edit groups details and preferences without changing form/API contracts',()=>{
 const html=page('/settings/profile');
 assert.match(html,/Edit your profile\./);
 assert.match(html,/data-account-avatar/);
 assert.match(html,/data-avatar-file/);
 assert.match(html,/data-avatar-remove/);
 assert.match(html,/data-account-form="profile"/);
 assert.match(html,/name="displayName"/);
 assert.match(html,/name="bio"/);
 assert.match(html,/name="locale"/);
 assert.match(html,/name="emailUpdates"/);
 assert.match(html,/role="switch"/);
 assert.match(html,/id="account-preferences"/);
 assert.match(html,/Save changes/);
 assert.match(html,/href="\/profile"/);
 assert.match(html,/data-account-logout/);
});

test('security keeps existing password, sessions, owner email and MFA behavior',()=>{
 const html=page('/settings/security');
 assert.match(html,/Account security\./);
 assert.match(html,/data-account-form="password-change"/);
 assert.match(html,/name="currentPassword"/);
 assert.match(html,/name="newPassword"/);
 assert.match(html,/Active sessions\./);
 assert.match(html,/data-account-sessions/);
 assert.match(html,/Change email\./);
 assert.match(html,/data-account-form="email-change"/);
 assert.doesNotMatch(html,/Owner email\./);
 const admin=page('/settings/security',owner);
 assert.match(admin,/Owner email\./);
 assert.match(admin,/href="\/admin"/);
 assert.match(admin,/data-account-logout/);
 assert.doesNotMatch(admin,/data-account-form="email-change"/,'Owner email change remains infra-controlled');
 assert.match(admin,/Enable two-factor verification/);
});

test('unsigned members cannot access private dashboard or sensitive content',()=>{
 const html=accountPage({type:'/profile',user:null});
 assert.doesNotMatch(html,/class="account-shell account-shell--dashboard"/);
 assert.match(html,/Sign in to access your private information/);
 assert.match(html,/Member sign-in/);
 assert.doesNotMatch(html,/data-account-bookmarks/);
 assert.doesNotMatch(html,/data-account-export/);
 assert.doesNotMatch(html,/verified@example\.test/);
 const login=accountPage({type:'/login',user:null});
 assert.match(login,/data-account-form="login"/);
 assert.doesNotMatch(login,/account-dashboard\.css/);
 const register=accountPage({type:'/register',user:null,registrationOpen:true});
 assert.match(register,/data-account-form="register"/);
 assert.match(register,/data-account-form="register"[\s\S]*name="password"/);
});

test('all account text is escaped; no user-provided HTML is injected',()=>{
 const attacker={...member,displayName:'<img src=x onerror=alert(1)>',bio:'<script>window.bad=true</script>',
   email:'a<b@example.test'};
 const html=page('/profile',attacker);
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.match(html,/&lt;script&gt;window\.bad=true&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<img src=x onerror/);
 assert.doesNotMatch(html,/<script>window\.bad/);
});

test('public profile menu is compact, guest-first and role-gated by the real session',()=>{
 const markup=header();
 const behavior=asset('public/experience.js');
 const companion=asset('public/companion.js');
 assert.match(markup,/data-corner-profile-card/);
 assert.match(markup,/corner-profile-card--quiet/);
 assert.match(markup,/data-profile-guest/);
 assert.match(markup,/data-profile-member hidden/);
 assert.match(markup,/data-profile-menu-avatar/);
 assert.match(markup,/data-owner-studio href="\/admin" hidden/);
 assert.match(markup,/data-profile-logout/);
 assert.match(markup,/data-auth-open="login"/);
 assert.match(behavior,/loggedIn&&\['owner','admin','editor','moderator'\]/);
 assert.match(behavior,/data-profile-trigger-avatar/);
 assert.match(behavior,/api\/v1\/auth\/logout/);
 assert.match(companion,/\.admin-shell,\.signin-wrap,\.account-shell/,'Pulse is removed from private account pages');
});

test('new account surfaces are responsive and preserve old privacy and bookmark APIs',()=>{
 const css=asset('public/account-dashboard.css');
 const menuCss=asset('public/companion.css');
 const js=asset('public/account.js');
 const server=asset('src/server.mjs');
 assert.match(css,/\.account-workspace-layout/);
 assert.match(css,/account-identity-card/);
 assert.match(css,/account-bookmark-list/);
 assert.match(css,/account-switch-track/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(max-width:430px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(menuCss,/corner-profile-card--quiet/);
 assert.match(server,/\/account-dashboard\.css/);
 assert.match(js,/if\(token&&location\.hash\)/,'Sensitive token hashes are cleared without destroying account deep links');
 assert.match(js,/api\('me\/bookmarks'\)/);
 assert.match(js,/api\('me\/sessions'\)/);
 assert.match(js,/api\('me\/export','POST'/);
 assert.match(js,/api\('me\/deletion','POST'/);
 assert.match(js,/CornerImageCrop\.open/);
 assert.match(js,/data-account-saved-count/);
});
