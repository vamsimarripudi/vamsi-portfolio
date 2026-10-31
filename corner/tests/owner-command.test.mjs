import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Store} from '../src/store.mjs';
import {OwnerCommand} from '../src/owner-command.mjs';
import {studioSidebar} from '../src/studio-ui.mjs';

test('owner command keeps evidence, authority, workspace and approval state explicit',t=>{
  const store=new Store(':memory:');t.after(()=>store.close());
  store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('owner','owner@command.test','Owner','owner','hash',datetime('now'),datetime('now'))");
  const command=new OwnerCommand(store);
  const first=command.create({
    workspace:'personal',project:'PakkaFollow',kind:'decision',title:'Choose launch date',
    detail:'Do not charge live customers before verified tests.',priority:'now',evidenceStatus:'verified',
    evidenceNote:'Exact-head CI and provider checks required.',sourceRef:'PR #123',
    authority:'money',needsApproval:true
  },'owner');
  assert.equal(first.workspace,'personal');
  assert.equal(first.kind,'decision');
  assert.equal(first.priority,'now');
  assert.equal(first.evidenceStatus,'verified');
  assert.equal(first.authority,'money');
  assert.equal(first.needsApproval,true);
  assert.equal(first.version,1);

  const second=command.create({
    workspace:'kravia',project:'VidyaLuma',kind:'risk',title:'External approval gate',
    detail:'Founder-level routing only; corporate records remain in KRAVIA systems.',
    priority:'next',evidenceStatus:'blocked',authority:'legal',needsApproval:false
  },'owner');
  assert.equal(second.workspace,'kravia');
  assert.equal(second.needsApproval,true,'Owner approval is mandatory even when a caller tries to disable it');

  const summary=command.summary();
  assert.equal(summary.counts.now,1);
  assert.equal(summary.counts.decisions,1);
  assert.equal(summary.counts.risks,1);
  assert.equal(summary.counts.approvals,2);
  assert.equal(summary.counts.personal,1);
  assert.equal(summary.counts.kravia,1);

  const updated=command.update(first.id,{state:'waiting',version:first.version},'owner');
  assert.equal(updated.state,'waiting');
  assert.equal(updated.version,2);
  assert.throws(()=>command.update(first.id,{state:'done',version:1},'owner'),{status:409});
  const done=command.update(first.id,{state:'done',version:updated.version},'owner');
  assert.ok(done.resolvedAt);

  const audits=store.all("SELECT action,entity_id FROM audit_events WHERE entity_type='owner_command' ORDER BY occurred_at");
  assert.ok(audits.some(row=>row.action==='owner.command.created'&&row.entity_id===first.id));
  assert.ok(audits.some(row=>row.action==='owner.command.updated'&&row.entity_id===first.id));
});

test('owner command rejects invalid evidence, authority and dates',t=>{
  const store=new Store(':memory:');t.after(()=>store.close());
  const command=new OwnerCommand(store);
  assert.throws(()=>command.create({workspace:'personal',kind:'task',title:'x',priority:'now'},'owner'),{status:400});
  assert.throws(()=>command.create({workspace:'personal',kind:'task',title:'Valid title',priority:'urgent'},'owner'),{status:400});
  assert.throws(()=>command.create({workspace:'personal',kind:'task',title:'Valid title',evidenceStatus:'certain'},'owner'),{status:400});
  assert.throws(()=>command.create({workspace:'personal',kind:'task',title:'Valid title',authority:'transfer_money'},'owner'),{status:400});
  assert.throws(()=>command.create({workspace:'personal',kind:'task',title:'Valid title',dueAt:'not-a-date'},'owner'),{status:400});
});

test('Command navigation is owner-only and Studio defaults owner into Command',()=>{
  const owner=studioSidebar({role:'owner'},{interactive:true});
  const admin=studioSidebar({role:'admin'},{interactive:true});
  const editor=studioSidebar({role:'editor'},{interactive:true});
  const js=fs.readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../public/command-center.css',import.meta.url),'utf8');
  const server=fs.readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
  assert.match(owner,/data-admin-view="command"/);
  assert.doesNotMatch(admin,/data-admin-view="command"/);
  assert.doesNotMatch(editor,/data-admin-view="command"/);
  assert.match(js,/initial\.ownerRole==='owner'\?'command'/);
  assert.match(js,/Which series does this Journal belong to\?/);
  assert.match(js,/Boundary lock/);
  assert.match(js,/Owner approval required/);
  assert.doesNotMatch(js,/name="needsApproval"/);
  assert.match(js,/Built by a backbencher + AI/);
  assert.match(css,/command-kpis/);
  assert.match(css,/max-width:1050px/);
  assert.match(server,/Only the owner can access the command center/);
});
