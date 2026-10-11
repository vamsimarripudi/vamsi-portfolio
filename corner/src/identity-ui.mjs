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
const profile=form('profile',field('displayName','Display name','text','name','maxlength="60"')+'<label class="account-field"><span>Short bio</span><textarea name="bio" maxlength="280" rows="3"></textarea></label><label class="account-field"><span>Language</span><select name="locale"><option value="en">English</option><option value="te">Telugu</option><option value="hi">Hindi</option></select></label><label class="account-check"><input type="checkbox" name="emailUpdates"><span>Allow optional account updates</span></label>','Save profile');
const profileOverview=(user)=>{
  const locale=({en:'English',te:'Telugu',hi:'Hindi'})[user.locale]||'English';
  return '<section class="account-profile-overview" data-profile-summary>'+
    '<p class="eyebrow">YOUR PRIVATE ACCOUNT</p>'+
    '<h2>'+h(user.displayName||'Your account')+'</h2>'+
    (user.bio?'<p class="account-profile-bio">'+h(user.bio)+'</p>':'<p class="account-profile-bio">Your private profile is ready.</p>')+
    '<dl><div><dt>Language</dt><dd>'+h(locale)+'</dd></div>'+
    '<div><dt>Updates</dt><dd>'+(user.emailUpdates?'Enabled':'Off')+'</dd></div></dl>'+
    '<a class="account-cta-link" href="/settings/profile">Edit in Settings <span aria-hidden="true">↗</span></a>'+
    '</section>';
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
  const top=`<div class="account-top"><a class="account-brand" href="/"><span>✳</span><b>Vamsi's Corner</b></a><a class="account-back" href="/">← Back to stories</a></div>`;
  const body=`<div class="account-shell" data-account-page="${h(type)}" data-signed-in="${user?'true':'false'}">${top}<main id="content" class="account-main"><section class="account-intro"><p class="eyebrow">${details.kicker}</p><h1>${details.title}</h1><p>${details.subtitle}</p><div class="account-geometry" aria-hidden="true"><span></span><span></span><span></span></div></section><section class="account-card">${user&&type==='/profile'?`<p class="account-status"><span>●</span> Signed in as ${h(user.email)}</p>`:''}${inner}${details.foot}${extra}${sessions}${user?'<button type="button" class="account-text-button" data-account-logout>Sign out</button>':''}</section></main><footer class="account-bottom"><span>PRIVATE BY DEFAULT</span><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer><script src="/account.js" defer></script></div>`;
  return basePage({path:type,title:details.title,noindex:true,content:body,initial:{page:'account',authenticated:!!user,account:user,memberCompactPasswords:compactMemberPasswords()}});
}
