import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {auditLatestOffsiteMigration} from '../src/v3-restore-audit.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const phaseOne={NODE_ENV:'production',CORNER_V3_MEMORIES:'0',SESSION_SECRET:'strong-phase-one-migration-gate-secret'};

test('Phase 2 migration never changes a production database while Memories is OFF',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v3-phase2-flag-off-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const s=new Store(path.join(dir,'safe.sqlite'));
 t.after(()=>s.close());
 new V3Engagement(s,{env:phaseOne});
 assert.equal(s.one('SELECT count(*) n FROM v3_schema_migrations').n,2);
 assert.equal(s.one("SELECT name FROM sqlite_master WHERE name='v3_milestones'"),null);
});
test('offsite rehearsal validates checksum, isolated restore, schema and preserved rows',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v3-offsite-audit-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'live'),snapshot=path.join(dir,'snapshot');
 fs.mkdirSync(source);fs.mkdirSync(path.join(source,'uploads'));
 const store=new Store(path.join(source,'corner.sqlite'));
 new V3Engagement(store,{env:phaseOne});
 const post=store.createPost({title:'Synthetic published content',body:'Preserve these records',type:'moment'},'owner');
 store.publish(post.id,'owner');store.close();
 const media=Buffer.from('Synthetic photo bytes preserved through the backup');
 fs.writeFileSync(path.join(source,'uploads','test-photo.jpg'),media);
 const result=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts','backup.mjs'),snapshot],{
  cwd:root,encoding:'utf8',env:{...process.env,NODE_ENV:'test',DATA_DIR:source,DB_PATH:path.join(source,'corner.sqlite')}
 }));
 assert.equal(result.verified,true);
 const prefix='backups/2026-10-09T08-00-00-000Z/',manifest=fs.readFileSync(path.join(snapshot,'manifest.json'));
 const metadata=JSON.parse(manifest),objects=new Map([[prefix+'manifest.json',manifest]]);
 for(const name of Object.keys(metadata.files))objects.set(prefix+name,fs.readFileSync(path.join(snapshot,name)));
 const storage={list:async()=>[...objects.keys()],get:async key=>objects.get(key)};
 const report=await auditLatestOffsiteMigration({storage,clock:()=>new Date('2026-10-09T09:00:00.000Z')});
 assert.equal(report.verified,true);
 assert.equal(report.dataPreserved,true);
 assert.equal(report.sqliteIntegrity,'ok');
 assert.equal(report.filesVerified,2);
 objects.set(prefix+'uploads/test-photo.jpg',Buffer.from('corrupted bytes'));
 await assert.rejects(auditLatestOffsiteMigration({storage,clock:()=>new Date('2026-10-09T09:00:00.000Z')}),/checksum mismatch/);
 objects.set(prefix+'uploads/test-photo.jpg',media);
 await assert.rejects(auditLatestOffsiteMigration({storage,clock:()=>new Date('2026-10-11T09:00:00.000Z')}),/stale/);
});
