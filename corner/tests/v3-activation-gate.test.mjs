import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
const env={NODE_ENV:'production',CORNER_V3_MEMORIES:'1',SESSION_SECRET:'a-production-test-key-long-enough-to-be-valid'};
const migrations=s=>s.all('SELECT version FROM v3_schema_migrations ORDER BY version').map(r=>r.version);

test('production Memories first activation fails closed without a verified real restore',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 assert.throws(()=>new V3Engagement(store,{env}),/requires a fresh verified real offsite backup/);
 const present=store.one("SELECT name FROM sqlite_master WHERE name='v3_milestones'");
 assert.equal(present,null,'No Phase 2 migration should run without audit');
});
test('verified fresh snapshot allows first activation; already applied migration survives stale audit',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const now=new Date(),created=new Date(now.getTime()-5*60*60*1000);
 store.saveSetting('v3.phase2.restoreAuditLastSuccess',now.toISOString());
 store.saveSetting('v3.phase2.restoreAuditBackupCreatedAt',created.toISOString());
 new V3Engagement(store,{env});
 assert.deepEqual(migrations(store),['v3-0001-engagement','v3-0002-bookmark-progress','v3-0003-memories']);
 store.saveSetting('v3.phase2.restoreAuditLastSuccess','2000-01-01T00:00:00.000Z');
 new V3Engagement(store,{env});
 assert.equal(store.one("SELECT COUNT(*) AS n FROM v3_schema_migrations").n,3);
});
test('stale or inconsistent offsite proof cannot authorize first activation',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const now=Date.now();
 store.saveSetting('v3.phase2.restoreAuditLastSuccess',new Date(now-48*60*60*1000).toISOString());
 store.saveSetting('v3.phase2.restoreAuditBackupCreatedAt',new Date(now-49*60*60*1000).toISOString());
 assert.throws(()=>new V3Engagement(store,{env}),/fresh verified real offsite/);
 store.saveSetting('v3.phase2.restoreAuditLastSuccess',new Date(now-100000).toISOString());
 store.saveSetting('v3.phase2.restoreAuditBackupCreatedAt',new Date(now+60000).toISOString());
 assert.throws(()=>new V3Engagement(store,{env}),/fresh verified real offsite/);
});
