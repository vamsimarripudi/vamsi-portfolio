import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.mjs';
import { passwordHash } from '../src/auth.mjs';
import { IdentityService, staffPermission, identityInternals } from '../src/identity.mjs';

const env={NODE_ENV:'test',CORNER_AUTH_REGISTRATION_ENABLED:'1',CORNER_AUTH_TEST_OUTBOX:'/tmp/corner-unit-outbox-unused',SESSION_SECRET:'e'.repeat(64),SITE_URL:'https://vamsimarripudi.me/corner'};
const textToken=(message)=>decodeURIComponent(message.text.match(/#token=([^\s]+)/)?.[1]||'');
const setup=()=>{
  const store=new Store(':memory:');
  const ownerPassword='LongOwnerSecurityPhrase#25';
  store.bootstrap('owner@example.com',passwordHash(ownerPassword));
  const outgoing=[];
  const identity=new IdentityService(store,{env,sendEmail:async mail=>outgoing.push(mail)});
  return {store,identity,outgoing,owner:store.owner(),ownerPassword};
};

test('additive schema preserves owner, defaults fresh users to member and prevents duplicate owner',()=>{
  const {store,identity,owner}=setup();
  try{
    assert.equal(owner.role,'owner');
    assert.equal(identity.safeMe(owner).verified,true);
    assert.equal(store.db.prepare("SELECT dflt_value FROM pragma_table_info('users') WHERE name='role'").get().dflt_value,"'member'");
    assert.throws(()=>store.exec('INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)','another-owner','second@example.com','Someone','owner','hash','now','now'),/owner/i);
    assert.ok(store.one("SELECT name FROM sqlite_master WHERE type='table' AND name='identity_bookmarks'"));
  }finally{store.close()}
});

test('member registration is verification-gated, one-time, private and supports recovery',async()=>{
  const {store,identity,outgoing}=setup();
  try{
    const registered=await identity.registerMember({name:'Reader Name',email:'Reader@Example.com',password:'Bright and long passphrase 2026!'});
    assert.equal(registered.accepted,true);
    assert.equal(outgoing.length,1);
    const before=identity.findByEmail('reader@example.com');
    assert.equal(before.role,'member');
    assert.equal(identity.safeMe(before).verified,false);
    assert.throws(()=>identity.loginMember({email:before.email,password:'Bright and long passphrase 2026!'}),/Verify your email/);
    const token=textToken(outgoing[0]);assert.ok(token.length>25);
    assert.deepEqual(identity.verifyEmail({token}),{verified:true});
    assert.throws(()=>identity.verifyEmail({token}),/expired link/);
    const account=identity.loginMember({email:before.email,password:'Bright and long passphrase 2026!'});
    assert.equal(account.user.role,'member');
    assert.equal(store.session(account.token).role,'member');
    assert.equal(staffPermission('member','/api/admin/posts','GET'),false);
    const updated=identity.updateProfile(store.session(account.token),{displayName:'Reader Updated',bio:'I keep quiet notes.',locale:'te',emailUpdates:true});
    assert.equal(updated.displayName,'Reader Updated');assert.equal(updated.visibility,'private');
    const post=store.createPost({title:'A verified update',type:'tech_note',body:'Private reader bookmarked this post.'},store.owner().id);
    store.publish(post.id,store.owner().id);
    identity.addBookmark(store.session(account.token),post.id);
    identity.addBookmark(store.session(account.token),post.id);
    assert.equal(identity.bookmarks(store.session(account.token)).length,1);
    identity.removeBookmark(store.session(account.token),post.id);
    assert.equal(identity.bookmarks(store.session(account.token)).length,0);
    assert.equal(identity.requestPrivacy(store.session(account.token),'deletion').state,'requested');
    assert.equal(identity.exportData(store.session(account.token)).account.email,'reader@example.com');
    assert.equal((await identity.forgotPassword({email:before.email})).accepted,true);
    const resetToken=textToken(outgoing.at(-1));
    assert.equal(identity.resetPassword({token:resetToken,password:'Another memorable passphrase 2026!'}).changed,true);
    assert.equal(store.session(account.token),null,'reset revokes earlier sessions');
    assert.throws(()=>identity.resetPassword({token:resetToken,password:'Test phrase that is long enough!'}),/expired link/);
    assert.equal(identity.loginMember({email:before.email,password:'Another memorable passphrase 2026!'}).user.verified,true);
  }finally{store.close()}
});

test('invited staff requires MFA and cannot acquire owner permissions; recovery codes are one-use',async()=>{
  const {store,identity,outgoing,owner}=setup();
  try{
    await assert.rejects(identity.invite(owner,{email:'editor@example.com',role:'editor'}),/authenticator/);
    const ownerFirst=identity.loginAdmin({email:'owner@example.com',password:'LongOwnerSecurityPhrase#25'});
    assert.equal(ownerFirst.user.role,'owner','existing owner can enroll authenticator without losing account');
    const ownerSetup=identity.beginMfa({actor:owner});
    const ownerOtp=identityInternals.totpAt(ownerSetup.secret,Math.floor(Date.now()/30000));
    const ownerEnabled=identity.activateMfa({challenge:ownerSetup.challenge,code:ownerOtp});
    assert.equal(ownerEnabled.user.mfaEnabled,true);
    assert.equal((await identity.invite(owner,{email:'editor@example.com',role:'editor'})).sent,true);
    const invite=textToken(outgoing.at(-1));
    assert.equal(identity.registerStaff({name:'Studio Editor',email:'editor@example.com',password:'Studio editor passphrase #2026',token:invite}).mfaSetupRequired,true);
    assert.throws(()=>identity.registerStaff({name:'Studio Editor',email:'editor@example.com',password:'Studio editor passphrase #2026',token:invite}),/invalid or expired/);
    const editor=identity.findByEmail('editor@example.com');
    assert.equal(editor.role,'editor');
    assert.equal(staffPermission(editor.role,'/api/admin/posts','POST'),true);
    assert.equal(staffPermission(editor.role,'/api/admin/ops','GET'),false);
    await assert.rejects(identity.invite(editor,{email:'another@example.com',role:'admin'}),/Owner/);
    const login=identity.loginAdmin({email:'editor@example.com',password:'Studio editor passphrase #2026'});
    assert.equal(login.mfaSetupRequired,true);
    assert.ok(!login.token,'MFA-incomplete staff have no usable session');
    const enrol=identity.beginMfa({challenge:login.challenge});
    assert.match(enrol.otpauth,/^otpauth:\/\/totp\//);
    const code=identityInternals.totpAt(enrol.secret,Math.floor(Date.now()/30000));
    const accepted=identity.activateMfa({challenge:enrol.challenge,code});
    assert.equal(accepted.user.mfaEnabled,true);
    assert.equal(accepted.recoveryCodes.length,8);
    assert.equal(store.session(accepted.token).role,'editor');
    assert.throws(()=>identity.loginAdmin({email:'editor@example.com',password:'Studio editor passphrase #2026'}),/authenticator/);
    const recovery=accepted.recoveryCodes[0];
    const signed=identity.loginAdmin({email:'editor@example.com',password:'Studio editor passphrase #2026',code:recovery});
    assert.ok(signed.token);
    assert.throws(()=>identity.loginAdmin({email:'editor@example.com',password:'Studio editor passphrase #2026',code:recovery}),/already used/);
    assert.throws(()=>identity.loginAdmin({email:'owner@example.com',password:'LongOwnerSecurityPhrase#25'}),/authenticator/,'owner now requires MFA after activation');
  }finally{store.close()}
});

test('production signup is closed without a configured mail provider',async()=>{
  const store=new Store(':memory:');
  try{
    const identity=new IdentityService(store,{env:{NODE_ENV:'production',SESSION_SECRET:'z'.repeat(48)}});
    assert.equal(identity.canRegister(),false);
    await assert.rejects(identity.registerMember({name:'Name',email:'p@example.com',password:'An excellent long passphrase'}),/not open/);
    assert.equal(store.one("SELECT COUNT(*) AS n FROM users WHERE role='member'").n,0);
  }finally{store.close()}
});
