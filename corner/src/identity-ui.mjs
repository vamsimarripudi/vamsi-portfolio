import { basePage } from './ui.mjs';

const h=(value)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const field=(name,title,type='text',autocomplete='',extra='')=>`<label class="account-field"><span>${title}</span><input name="${name}" type="${type}" ${autocomplete?`autocomplete="${autocomplete}"`:''} ${extra} required></label>`;
const compactMemberPasswords=()=>process.env.CORNER_MEMBER_SHORT_PASSWORDS==='1';
const password=(name='password',autocomplete='current-password',mode='login')=>{
  const member=mode==='member-new'&&compactMemberPasswords();
  const login=mode==='login',recovery=mode==='recovery';
  const min=login?1:member||recovery?6:12,max=login?512:member?12:128;
  const hint=member?'6–12 characters. Use letters and numbers or symbols.':
    recovery&&compactMemberPasswords?'Members: 6–12 characters. Studio: 12 or more.':
    login?'Existing passwords continue to work.':'12 characters minimum. Passphrases work well.';
  const label=name==='newPassword'?'New password':name==='currentPassword'?'Current password':'Password';
  return '<label class="account-field"><span>'+label+'</span><span class="account-pass-wrap">'+
   '<input name="'+name+'" type="password" autocomplete="'+autocomplete+'" minlength="'+min+
   '" maxlength="'+max+'" required><button type="button" class="account-reveal" '+
   'data-toggle-password aria-label="Show password">Show</button></span><small>'+hint+'</small></label>';
};
const action=(label)=>`<button class="account-submit" type="submit">${label}<span aria-hidden="true">↗</span></button>`;
const form=(kind,fields,button,options='')=>`<form data-account-form="${kind}" ${options} novalidate>${fields}${action(button)}<p class="account-response" data-account-response role="status" aria-live="polite"></p></form>`;
const links=(items)=>`<nav class="account-footer-links" aria-label="Account navigation">${items.map(([label,url])=>`<a href="${h(url)}">${h(label)}</a>`).join('')}</nav>`;
const signIn=form('login',field('email','Email address','email','email',`inputmode="email" maxlength="254"`)+password('password','current-password','login'),'Sign in to your account');
const register=(open)=>open?form('register',field('name','Display name','text','name','maxlength="60"')+field('email','Email address','email','email','maxlength="254"')+password('password','new-password','member-new'),'Create member account'):'<div class="account-disabled" role="status"><strong>Registration is not open yet.</strong><p>Reading and public reactions still work without an account. Signups will open after verified email delivery is configured.</p></div>';
const forgot=form('forgot',field('email','Registered email','email','email','maxlength="254"'),'Send reset instructions');
const resend=form('resend',field('email','Registration email','email','email','maxlength="254"'),'Resend verification');
const reset=form('reset',password('password','new-password','recovery')+'<input type="hidden" name="token" data-fragment-token>','Reset password');
const verify=form('verify','<input type="hidden" name="token" data-fragment-token><p class="account-help">Select verify to activate your account. The link expires after 30 minutes.</p>','Verify email');
const confirmEmail=form('confirm-email','<input type="hidden" name="token" data-fragment-token><p class="account-help">Confirm the new email address. You will then sign in again.</p>','Confirm email change');
const changeEmail=form('email-change',field('newEmail','New email address','email','email','maxlength="254"')+password('currentPassword'),'Request verified email change');
const adminRegister=form('admin-register',field('name','Display name','text','name','maxlength="60"')+field('email','Invitation email','email','email','maxlength="254"')+password('password','new-password')+'<input type="hidden" name="token" data-fragment-token>','Accept invitation');
const mfa=form('mfa-activate','<div class="account-secret" data-mfa-secret hidden><p class="eyebrow">AUTHENTICATOR KEY</p><code data-secret></code><p>Save this key in your authenticator app. Your 6-digit code will update every 30 seconds.</p></div>'+field('code','Six-digit authenticator code','text','one-time-code','inputmode="numeric" maxlength="6" pattern="[0-9]{6}"'),'Finish secure setup');
const invite=form('invite',field('email','Invitee email','email','off','maxlength="254"')+'<label class="account-field"><span>Studio role</span><select name="role"><option value="admin">Admin</option><option value="editor">Editor</option><option value="moderator">Moderator</option></select></label>','Email invitation');
const change=form('password-change',password('currentPassword','current-password','login')+password('newPassword','new-password','recovery'),'Change password');
const profile=form('profile',
 '<section class="account-editor-section" aria-labelledby="edit-personal-title">'+
  '<header class="account-editor-heading"><p class="account-overline">PERSONAL DETAILS</p><h2 id="edit-personal-title">Make it yours.</h2><p>Your name and a few words about you.</p></header>'+
  field('displayName','Display name','text','name','maxlength="60"')+
  '<label class="account-field"><span>Short bio <small>Optional</small></span><textarea name="bio" maxlength="280" rows="3" placeholder="A few things about yourself…"></textarea><small>Up to 280 characters. You can leave this blank.</small></label>'+
 '</section>'+
 '<section class="account-editor-section" id="account-preferences" aria-labelledby="edit-preferences-title">'+
  '<header class="account-editor-heading"><p class="account-overline">PREFERENCES</p><h2 id="edit-preferences-title">Just how you like it.</h2><p>Only the settings this space supports today.</p></header>'+
  '<label class="account-field"><span>Language</span><select name="locale"><option value="en">English</option><option value="te">Telugu</option><option value="hi">Hindi</option></select></label>'+
  '<label class="account-switch-row"><span><strong>Optional email updates</strong><small>Receive account and Corner updates when available.</small></span><input type="checkbox" role="switch" name="emailUpdates" aria-label="Allow optional email updates"><span class="account-switch-track" aria-hidden="true"></span></label>'+
 '</section>',
 'Save changes');
const avatarCard=user=>{
 if(!user)return '';
 const image=user.hasAvatar?'<img data-avatar-image src="/api/v1/me/avatar" width="80" height="80" alt="Your profile photo">':'<span class="account-avatar-monogram" data-avatar-placeholder aria-hidden="true">'+h((user.displayName||'M').slice(0,1).toUpperCase())+'</span>';
 return '<section class="account-avatar-card" data-account-avatar aria-label="Profile photo">'+
  '<div class="account-avatar-visual">'+image+'</div>'+
  '<div class="account-avatar-info"><strong>Your profile photo</strong><p>Private to you. Automatically optimized for every screen.</p>'+
  '<div class="account-avatar-actions"><label class="account-avatar-picker">Choose image<input type="file" data-avatar-file accept="image/jpeg,image/png,image/webp" hidden></label>'+
  '<button type="button" data-avatar-remove'+(!user.hasAvatar?' hidden':'')+'>Remove</button></div>'+
  '<p class="account-avatar-status" data-avatar-status role="status" aria-live="polite"></p></div></section>';
};
const accountGlyphPaths={"overview":"<circle cx=\"12\" cy=\"8\" r=\"3.4\"/><path d=\"M4.8 20v-2.1a7.2 7.2 0 0 1 14.4 0V20\"/>","edit":"<path d=\"m15 5 4 4M4 20l4.5-1 11-11a2 2 0 0 0-4-4l-11 11z\"/>","bookmark":"<path d=\"M5 4h14v17l-7-4.8L5 21z\"/>","settings":"<path d=\"M4 7h16M4 17h16M8 4v6M16 14v6\"/>","lock":"<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V7a4 4 0 0 1 8 0v4\"/>","shield":"<path d=\"M12 22s8-4.2 8-10.1V5l-8-3-8 3v6.9C4 17.8 12 22 12 22Z\"/><path d=\"m9 12 2 2 4-4\"/>","arrow":"<path d=\"M5 12h14M13 6l6 6-6 6\"/>","signout":"<path d=\"M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M14 16l4-4-4-4M8 12h10\"/>"};
const accountIcon=name=>'<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(accountGlyphPaths[name]||accountGlyphPaths.overview)+'</svg>';
const accountAvatar=function accountAvatar(user){
  const initial=h((user.displayName||'M').trim().slice(0,1).toUpperCase()||'M');
  return user.hasAvatar?
    '<img class="account-identity-image" src="/api/v1/me/avatar" width="88" height="88" alt="Your profile photo">':
    `<span class="account-identity-initial" aria-label="Profile initial ${initial}">${initial}</span>`;
};
const accountDashboardNav=function accountDashboardNav(type,user){
  const items=[
   {label:'Overview',href:'/profile',icon:'overview',active:type==='/profile'},
   {label:'Edit profile',href:'/settings/profile',icon:'edit',active:type==='/settings/profile'},
   {label:'Saved stories',href:'/profile#account-saved',icon:'bookmark'},
   {label:'Preferences',href:'/settings/profile#account-preferences',icon:'settings'},
   {label:'Security',href:'/settings/security',icon:'lock',active:type==='/settings/security'},
   {label:'Privacy & data',href:'/profile#account-data',icon:'shield'}
  ];
  const links=items.map(item=>'<a class="account-nav-link'+(item.active?' is-active':'')+'" href="'+item.href+'"'+(item.active?' aria-current="page"':'')+'>'+accountIcon(item.icon)+'<span>'+item.label+'</span></a>').join('');
  const staff=['owner','admin','editor','moderator'].includes(user.role);
  return '<aside class="account-workspace-sidebar"><nav class="account-workspace-nav" aria-label="Account sections">'+links+'</nav>'+
   '<div class="account-workspace-sidebar-bottom">'+(staff?'<a class="account-studio-shortcut" href="/admin">'+accountIcon('arrow')+'<span>Owner Studio</span></a>':'')+
   '<button type="button" class="account-nav-signout" data-account-logout>'+accountIcon('signout')+'<span>Sign out</span></button></div></aside>';
};
const profileOverview=function profileOverview(user){
 const name=h(user.displayName||'Your account'),bio=user.bio?h(user.bio):'A little space for things that matter.';
 const language=({en:'English',te:'Telugu',hi:'Hindi'})[user.locale]||'English';
 const updates=user.emailUpdates?'Enabled':'Off';
 return `<div class="account-overview-content">
   <section class="account-identity-card" aria-labelledby="account-identity-title">
     <div class="account-identity-cover" aria-hidden="true"><span>✦</span></div>
     <div class="account-identity-main">
       <div class="account-identity-avatar">${accountAvatar(user)}</div>
       <div class="account-identity-copy">
         <p class="account-overline">PRIVATE PROFILE</p><h2 id="account-identity-title">${name}</h2>
         <p class="account-identity-bio">${bio}</p><span class="account-identity-email">${h(user.email||'')}</span>
       </div>
       <a class="account-identity-edit" href="/settings/profile">${accountIcon('edit')}<span>Edit profile</span></a>
     </div>
   </section>
   <div class="account-overview-grid">
     <section class="account-section-card account-bookmarks-card" id="account-saved" aria-labelledby="saved-stories-heading">
       <header class="account-section-heading"><div><p class="account-overline">YOUR COLLECTION</p><h2 id="saved-stories-heading">Saved stories</h2></div><span class="account-count" data-account-saved-count hidden></span></header>
       <p class="account-section-sub">Stories you’ve bookmarked to return to later.</p>
       <div data-account-bookmarks aria-live="polite"><p class="account-loading">Loading saved stories…</p></div>
     </section>
     <div class="account-overview-side">
       <section class="account-section-card account-preference-summary" aria-labelledby="account-pref-title">
         <header class="account-section-heading"><div><p class="account-overline">PERSONALIZATION</p><h2 id="account-pref-title">Your preferences</h2></div></header>
         <dl class="account-preference-list"><div><dt>Language</dt><dd>${h(language)}</dd></div><div><dt>Email updates</dt><dd>${updates}</dd></div></dl>
         <a class="account-text-link" href="/settings/profile#account-preferences">Manage preferences ${accountIcon('arrow')}</a>
       </section>
       <section class="account-section-card account-security-summary" aria-labelledby="account-sec-title">
         <header class="account-section-heading"><div><p class="account-overline">SECURITY</p><h2 id="account-sec-title">Account protection</h2></div></header>
         <p class="account-section-sub">Change your password and manage signed-in devices.</p>
         <a class="account-text-link" href="/settings/security">Security settings ${accountIcon('arrow')}</a>
       </section>
     </div>
   </div>
   <section class="account-section-card account-data-card" id="account-data" aria-labelledby="account-data-title">
     <header class="account-section-heading"><div><p class="account-overline">PRIVACY FIRST</p><h2 id="account-data-title">Your data, your choice.</h2></div></header>
     <div class="account-data-actions">
       <button class="account-data-action" type="button" data-account-export>${accountIcon('shield')}<span><strong>Export account data</strong><small>Download a copy of your available account information.</small></span>${accountIcon('arrow')}</button>
       <button class="account-data-action is-danger" type="button" data-account-delete>${accountIcon('shield')}<span><strong>Request account deletion</strong><small>Request review of account removal; this is not instant deletion.</small></span>${accountIcon('arrow')}</button>
     </div>
   </section>
 </div>`;
};
const accountDashboard=function accountDashboard({type,user,top,formHtml,sessions}){
  const onProfile=type==='/profile',onEdit=type==='/settings/profile';
  const title=onProfile?'Your quiet space.':onEdit?'Edit your profile.':'Account security.';
  const intro=onProfile?'Your stories, preferences and account controls in one place.':onEdit?'A few details to make your Corner feel like yours.':'Keep your account safe and review signed-in devices.';
  const body=onProfile?profileOverview(user):
     onEdit?`<section class="account-section-card account-edit-panel" aria-label="Edit your profile"><div class="account-edit-avatar" id="account-avatar">${avatarCard(user)}</div>${formHtml}</section>`:
     `<section class="account-section-card account-security-panel" aria-labelledby="account-password-heading"><header class="account-section-heading"><div><p class="account-overline">PASSWORD</p><h2 id="account-password-heading">Change password</h2></div></header><p class="account-section-sub">Use your current password to keep access secure.</p>${formHtml}</section>${sessions}`;
  return `<div class="account-shell account-shell--dashboard" data-account-page="${h(type)}" data-signed-in="true">
    ${top}<main id="content" class="account-workspace">
      <header class="account-workspace-heading"><div><p class="account-overline">VAMSI’S CORNER / MY ACCOUNT</p><h1>${title}</h1><p>${intro}</p></div>${onProfile?'':'<a class="account-back-mobile" href="/profile">← My profile</a>'}</header>
      <p class="account-session-note"><span class="account-session-dot" aria-hidden="true"></span>Signed in as ${h(user.email||'')}</p>
      <div class="account-workspace-layout">${accountDashboardNav(type,user)}<section class="account-card account-workspace-panel">${body}</section></div>
    </main><footer class="account-bottom"><span>PRIVATE BY DEFAULT</span><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer><script src="/account.js" defer></script>
  </div>`;
};

const kind={
  '/login':{title:'Welcome back.',kicker:'MEMBER SIGN-IN',subtitle:'Your private space for saved posts and a few useful preferences.',form:signIn,foot:links([['Create account','/register'],['Forgot password?','/forgot-password']])},
  '/register':{title:'Keep your corner.',kicker:'MEMBER REGISTRATION',subtitle:'A private member profile. No public feed, no extra noise.',form:register,foot:links([['Already registered? Sign in','/login']])},
  '/verify-email':{title:'Verify your address.',kicker:'EMAIL VERIFICATION',subtitle:'One small step before your account is ready.',form:verify,foot:links([['Sign in','/login'],['Resend verification','/resend-verification']])},
  '/resend-verification':{title:'Check your inbox.',kicker:'EMAIL VERIFICATION',subtitle:'Request a fresh verification link for an unverified account.',form:resend,foot:links([['Sign in','/login']])},
  '/confirm-email':{title:'Confirm the change.',kicker:'EMAIL UPDATE',subtitle:'Prove access to the new email address before it replaces the current one.',form:confirmEmail,foot:links([['Security settings','/settings/security']])},
  '/forgot-password':{title:'Recover access.',kicker:'PASSWORD RECOVERY',subtitle:'We will email a time-limited reset link if the address has an account.',form:forgot,foot:links([['Return to sign in','/login']])},
  '/reset-password':{title:'Choose a new password.',kicker:'SECURE RECOVERY',subtitle:'Your reset link expires after 20 minutes and works only once.',form:reset,foot:links([['Return to sign in','/login']])},
  '/admin/register':{title:'Join the studio.',kicker:'PRIVATE STUDIO INVITE',subtitle:'This registration requires a one-time owner invitation. Authenticator verification follows.',form:adminRegister,foot:links([['Owner sign-in','/admin']])},
  '/admin/mfa':{title:'Protect your studio.',kicker:'AUTHENTICATOR SETUP',subtitle:'Add a six-digit authenticator. Store the one-time recovery codes somewhere secure.',form:mfa,foot:links([['Owner sign-in','/admin']])},
  '/admin/invite':{title:'Invite a collaborator.',kicker:'OWNER CONTROL',subtitle:'Invitations are single-use, last 48 hours and never grant the owner role.',form:invite,foot:links([['Return to studio','/admin']])},
  '/settings/security':{title:'Security settings.',kicker:'ACCOUNT SECURITY',subtitle:'Change your password and inspect active sessions.',form:change,foot:links([['My profile','/profile']])},
  '/profile':{title:'Your quiet space.',kicker:'PRIVATE PROFILE',subtitle:'Your private account and saved stories.',form:'',foot:links([['Edit profile','/settings/profile'],['Account security','/settings/security']])},
  '/settings/profile':{title:'Profile settings.',kicker:'ACCOUNT PREFERENCES',subtitle:'Update your bio, display name, language and preferences.',form:profile,foot:links([['Back to my profile','/profile'],['Account security','/settings/security']])},
};

export function accountPage({type,user,registrationOpen=false}){
  const details=kind[type]||kind['/login'];
  const formHtml=typeof details.form==='function'?details.form(registrationOpen):details.form;
  const profileLocked=(type==='/profile'||type==='/settings/profile'||type==='/settings/security')&&!user;
  const inner=profileLocked?`<div class="account-disabled"><p>Sign in to access your private information.</p><a class="account-cta-link" href="/login">Member sign-in ↗</a></div>`:type==='/profile'&&user?profileOverview(user):formHtml;
  const extra=type==='/profile'&&user?`<div class="account-side-section" id="account-saved"><h2>Saved stories.</h2><div data-account-bookmarks><p>Loading saved posts…</p></div></div><div class="account-side-section"><h2>Your information.</h2><button class="account-text-button" type="button" data-account-export>Export account data ↗</button><button class="account-text-button" type="button" data-account-delete>Request account deletion ↗</button></div>`:'';
  const sessions=type==='/settings/security'&&user?`<div class="account-side-section"><h2>Active sessions.</h2><div data-account-sessions>Loading…</div></div>${user.role==='owner'?'<div class="account-side-section"><h2>Owner email.</h2><p>Change the owner address through your Railway identity configuration. This avoids breaking the existing owner record.</p></div>':`<div class="account-side-section"><h2>Change email.</h2>${changeEmail}</div>`}${['owner','admin','editor','moderator'].includes(user.role)&&!user.mfaEnabled?'<div class="account-side-section"><h2>Authenticator security.</h2><a class="account-cta-link" href="/admin/mfa">Enable two-factor verification ↗</a></div>':''}`:'';
  const top=`<div class="account-top"><a class="account-brand" href="/"><span class="account-brand-mark--vm" aria-hidden="true"><img class="corner-brand-image" src="/mark.svg?v=vm-20261027" width="37" height="37" alt=""></span><b>Vamsi's Corner</b></a><a class="account-back" href="/">← Back to stories</a></div>`;
  const isDashboard=!!user&&['/profile','/settings/profile','/settings/security'].includes(type);
  const body=isDashboard?accountDashboard({type,user,top,formHtml,sessions}):`<div class="account-shell" data-account-page="${h(type)}" data-signed-in="${user?'true':'false'}">${top}<main id="content" class="account-main"><section class="account-intro"><p class="eyebrow">${details.kicker}</p><h1>${details.title}</h1><p>${details.subtitle}</p><div class="account-geometry" aria-hidden="true"><span></span><span></span><span></span></div></section><section class="account-card">${user&&type==='/profile'?`<p class="account-status"><span>●</span> Signed in as ${h(user.email)}</p>`:''}${user&&['/profile','/settings/profile'].includes(type)?avatarCard(user):''}${inner}${details.foot}${extra}${sessions}${user?'<button type="button" class="account-text-button" data-account-logout>Sign out</button>':''}</section></main><footer class="account-bottom"><span>PRIVATE BY DEFAULT</span><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer><script src="/account.js" defer></script></div>`;
  return basePage({path:type,title:details.title,noindex:true,content:body,initial:{page:'account',authenticated:!!user,account:user,memberCompactPasswords:compactMemberPasswords()}});
}
