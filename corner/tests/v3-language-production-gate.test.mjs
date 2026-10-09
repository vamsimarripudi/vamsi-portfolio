import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {V3Languages} from '../src/v3-languages.mjs';

const prod={NODE_ENV:'production',CORNER_V3_LANGUAGES:'1',SESSION_SECRET:'language-production-safety-test-secret-2026'};
test('first production language migration refuses unverified or stale backup',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 new V3Engagement(store,{env:{...prod,CORNER_V3_LANGUAGES:'0'}});
 assert.throws(()=>new V3Languages(store,{env:prod}),/requires a fresh verified offsite/);
 assert.equal(store.one("SELECT name FROM sqlite_master WHERE name='v3_language_variants'"),null);
 store.saveSetting('v3.phase4.restoreAuditLastSuccess',new Date(Date.now()-40*3600000).toISOString());
 store.saveSetting('v3.phase4.restoreAuditBackupCreatedAt',new Date(Date.now()-41*3600000).toISOString());
 assert.throws(()=>new V3Languages(store,{env:prod}),/requires a fresh verified offsite/);
 assert.equal(store.one("SELECT name FROM sqlite_master WHERE name='v3_language_variants'"),null);
});
test('fresh real-backup rehearsal permits migration, and safe restarts do not need stale proof',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 new V3Engagement(store,{env:{...prod,CORNER_V3_LANGUAGES:'0'}});
 const now=new Date(),earlier=new Date(Date.now()-3600000);
 store.saveSetting('v3.phase4.restoreAuditLastSuccess',now.toISOString());
 store.saveSetting('v3.phase4.restoreAuditBackupCreatedAt',earlier.toISOString());
 new V3Languages(store,{env:prod});
 assert.ok(store.one("SELECT name FROM sqlite_master WHERE name='v3_language_variants'"));
 assert.ok(store.one("SELECT version FROM v3_schema_migrations WHERE version='v3-0005-languages'"));
 store.saveSetting('v3.phase4.restoreAuditLastSuccess','2001-01-01T00:00:00.000Z');
 new V3Languages(store,{env:prod});
 assert.equal(store.one("SELECT COUNT(*) n FROM v3_schema_migrations WHERE version='v3-0005-languages'").n,1);
});
test('future backup timestamps never authorize production language migrations',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 new V3Engagement(store,{env:{...prod,CORNER_V3_LANGUAGES:'0'}});
 store.saveSetting('v3.phase4.restoreAuditLastSuccess',new Date().toISOString());
 store.saveSetting('v3.phase4.restoreAuditBackupCreatedAt',new Date(Date.now()+60000).toISOString());
 assert.throws(()=>new V3Languages(store,{env:prod}),/verified offsite/);
});
