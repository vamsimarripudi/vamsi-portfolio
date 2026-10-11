import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Store} from '../src/store.mjs';
import {IdentityService} from '../src/identity.mjs';
import {passwordHash,passwordVerify} from '../src/auth.mjs';
import {accountPage} from '../src/identity-ui.mjs';

const minimum=['A','a','4','!','x','Y'].join('');
const maximum=['Ma','9!','xyz','2026','X'].join('');
const tooLong=maximum+'Q';
const ownerValue=crypto.randomBytes(27).toString('base64url');
const legacyValue=crypto.randomBytes(23).toString('base64url');

const context=t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const sent=[],env={NODE_ENV:'test',SITE_URL:'https://vamsimarripudi.me/corner',
  CORNER_AUTH_REGISTRATION_ENABLED:'1',CORNER_AUTH_TEST_OUTBOX:'isolated',
  SESSION_SECRET:crypto.randomBytes(48).toString('hex'),
  CORNER_MEMBER_SHORT_PASSWORDS:'1'};
 store.bootstrap('owner@policy.example',passwordHash(ownerValue));
 const identity=new IdentityService(store,{env,sendEmail:async message=>sent.push(message)});
 return {store,sent,identity,env};
};
const lastToken=messages=>decodeURIComponent(messages.at(-1)?.text.match(/#token=([A-Za-z0-9_-]+)/)?.[1]||'');

test('enabled compact member policy accepts exactly 6 and 12 characters, rejects weaker and overlong inputs',async t=>{
 const {identity}=context(t);
 assert.equal(minimum.length,6);assert.equal(maximum.length,12);
 await identity.registerMember({name:'Short Test',email:'member-short@testing.example',password:minimum});
 assert.ok(identity.findByEmail('member-short@testing.example'));
 await identity.registerMember({name:'Long Test',email:'member-maximum@testing.example',password:maximum});
 assert.ok(identity.findByEmail('member-maximum@testing.example'));
 const rejected=[
  ['too-short@testing.example',minimum.slice(1)],
  ['too-long@testing.example',tooLong],
  ['digits-only@testing.example','1'.repeat(6)],
  ['letters-only@testing.example','A'.repeat(6)],
  ['common@testing.example',['qwerty','1'].join('')]
 ];
 for(const [email,password] of rejected)
  await assert.rejects(identity.registerMember({name:'Invalid Password',email,password}),{code:'WEAK_PASSWORD'},email);
});
test('verified members can use compact changes; long legacy account passwords still authenticate',async t=>{
 const {store,identity,sent}=context(t);
 await identity.registerMember({name:'Test Reader',email:'reader@testing.example',password:minimum});
 identity.verifyEmail({token:lastToken(sent)});
 const user=identity.findByEmail('reader@testing.example');
 store.exec('UPDATE users SET password_hash=? WHERE id=?',passwordHash(legacyValue),user.id);
 assert.equal(identity.loginMember({email:user.email,password:legacyValue}).user.role,'member');
 const changed=identity.changePassword(user,{currentPassword:legacyValue,newPassword:maximum});
 assert.equal(changed.changed,true);
 assert.ok(passwordVerify(maximum,identity.account(user.id).password_hash));
 assert.throws(()=>identity.changePassword(user,{currentPassword:maximum,newPassword:tooLong}),{code:'WEAK_PASSWORD'});
 assert.equal(identity.loginMember({email:user.email,password:maximum}).user.role,'member');
});
test('short passwords cannot replace owner credentials; failed reset preserves one-time token',async t=>{
 const {identity,sent}=context(t);
 await identity.forgotPassword({email:'owner@policy.example'});
 const raw=lastToken(sent);assert.ok(raw.length>25);
 assert.throws(()=>identity.resetPassword({token:raw,password:minimum}),{code:'WEAK_PASSWORD'});
 const next=crypto.randomBytes(25).toString('base64url');
 assert.equal(identity.resetPassword({token:raw,password:next}).changed,true);
 assert.throws(()=>identity.resetPassword({token:raw,password:next}),{code:'TOKEN_INVALID'});
 assert.ok(passwordVerify(next,identity.findByEmail('owner@policy.example').password_hash));
});
test('feature OFF preserves legacy long-password enrollment; UI only presents compact rules when enabled',async t=>{
 const {identity,env}=context(t);
 env.CORNER_MEMBER_SHORT_PASSWORDS='0';
 await identity.registerMember({name:'Old Policy',email:'standard@testing.example',password:legacyValue});
 assert.ok(identity.findByEmail('standard@testing.example'));
 const old=process.env.CORNER_MEMBER_SHORT_PASSWORDS;
 try{
  process.env.CORNER_MEMBER_SHORT_PASSWORDS='1';
  const active=accountPage({type:'/register',registrationOpen:true});
  assert.match(active,/minlength="6" maxlength="12"/);
  const login=accountPage({type:'/login'});
  assert.match(login,/minlength="1" maxlength="512"/);
  process.env.CORNER_MEMBER_SHORT_PASSWORDS='0';
  const legacy=accountPage({type:'/register',registrationOpen:true});
  assert.match(legacy,/minlength="12" maxlength="128"/);
 }finally{if(old===undefined)delete process.env.CORNER_MEMBER_SHORT_PASSWORDS;else process.env.CORNER_MEMBER_SHORT_PASSWORDS=old}
});
