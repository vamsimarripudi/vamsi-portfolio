import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {IdentityService,identityInternals} from '../src/identity.mjs';
import {passwordHash} from '../src/auth.mjs';
import fs from 'node:fs';

test('owner Studio session expires after 30 days while staff remains short-lived',()=>{
  const store=new Store(':memory:');
  try{
    store.bootstrap('owner@example.com',passwordHash('Owner-Strong-Passphrase-2026!'));
    const identity=new IdentityService(store,{env:{NODE_ENV:'test',SESSION_SECRET:'x'.repeat(64)}});
    const owner=identity.loginAdmin({email:'owner@example.com',password:'Owner-Strong-Passphrase-2026!'});
    const ownerExpiry=Date.parse(owner.expires)-Date.now();
    assert.ok(ownerExpiry>29*86400000&&ownerExpiry<=30*86400000+60000,'Owner session is bounded to about 30 days');

    const ownerRecord=store.owner();
    const setup=identity.beginMfa({actor:ownerRecord});
    const otp=identityInternals.totpAt(setup.secret,Math.floor(Date.now()/30000));
    identity.activateMfa({challenge:setup.challenge,code:otp});

    const inviteId='invite_editor';
    const now=new Date().toISOString(),future=new Date(Date.now()+3600000).toISOString();
    store.exec("INSERT INTO identity_invitations(id,email,role,token_hash,invited_by,expires_at,created_at) VALUES(?,?,?,?,?,?,?)",
      inviteId,'editor@example.com','editor','unused',ownerRecord.id,future,now);
    store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      'editor','editor@example.com','Editor','editor',passwordHash('Editor-Strong-Passphrase-2026!'),now,now);
    store.exec("INSERT INTO identity_profiles(user_id,verified_at,created_at,updated_at) VALUES(?,?,?,?)",'editor',now,now,now);
    const staff=identity.loginAdmin({email:'editor@example.com',password:'Editor-Strong-Passphrase-2026!'});
    assert.equal(staff.mfaSetupRequired,true,'Staff still follows the existing short privileged-session path');
  }finally{store.close()}
});

test('owner cookies and DODO policy describe monthly re-auth and approval-only execution',()=>{
  const server=fs.readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
  const routes=fs.readFileSync(new URL('../src/identity-routes.mjs',import.meta.url),'utf8');
  const agent=fs.readFileSync(new URL('../src/command-agent.mjs',import.meta.url),'utf8');
  const dodo=fs.readFileSync(new URL('../../.agents/plugins/vamsi-command/skills/dodo-steward/SKILL.md',import.meta.url),'utf8');
  assert.match(server,/30\*24\*3600/);
  assert.match(routes,/30\*24\*3600/);
  assert.match(agent,/Every external or state-changing action requires explicit owner approval/);
  assert.match(dodo,/observe -> verify -> prepare -> ask/);
  assert.match(dodo,/must not execute any external or state-changing action/);
});
