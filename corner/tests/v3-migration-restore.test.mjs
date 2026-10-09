import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {V3Memories} from '../src/v3-memories.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const env={SESSION_SECRET:'phase2-isolated-migration-restore-test-secret',CORNER_V3_MEMORIES:'1'};
test('isolated backup restores a synthetic Phase 1 database then upgrades without data loss',t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'v3-restored-upgrade-'));
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const live=path.join(tmp,'source'),snapshot=path.join(tmp,'snapshot'),isolated=path.join(tmp,'isolated');
 fs.mkdirSync(live,{recursive:true});fs.mkdirSync(isolated,{recursive:true});
 const s=new Store(path.join(live,'corner.sqlite'));
 new V3Engagement(s,{env});
 const post=s.createPost({title:'Content before upgrade',body:'Keep this published story',type:'moment'},'owner');
 s.publish(post.id,'owner');
 const media=crypto.randomBytes(96),key='test-'+crypto.randomBytes(10).toString('hex')+'.png';
 fs.mkdirSync(path.join(live,'uploads'),{recursive:true});
 fs.writeFileSync(path.join(live,'uploads',key),media);
 // Roll back Phase 2 schema only in this disposable fixture to simulate its Phase 1 predecessor.
 s.db.exec('DROP TABLE IF EXISTS v3_now_history; DROP TABLE IF EXISTS v3_album_items; DROP TABLE IF EXISTS v3_collection_items; DROP TABLE IF EXISTS v3_albums; DROP TABLE IF EXISTS v3_collections; DROP TABLE IF EXISTS v3_milestones;');
 s.exec("DELETE FROM v3_schema_migrations WHERE version='v3-0003-memories'");
 assert.equal(s.one('SELECT count(*) AS n FROM v3_schema_migrations').n,2);
 s.close();
 const run=(script,args,data)=>JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts',script),...args],{
  cwd:root,encoding:'utf8',timeout:30000,
  env:{...process.env,NODE_ENV:'test',DB_PATH:path.join(data,'corner.sqlite'),DATA_DIR:data}
 }).trim());
 const backup=run('backup.mjs',[snapshot],live);
 assert.equal(backup.ok,true);assert.equal(backup.verified,true);
 assert.equal(run('restore.mjs',[snapshot,'--confirm'],isolated).ok,true);
 const restored=new Store(path.join(isolated,'corner.sqlite'));
 new V3Engagement(restored,{env});
 assert.equal(restored.one('SELECT count(*) AS n FROM v3_schema_migrations').n,3);
 assert.ok(restored.getPost(post.slug),'Published post survives upgrade');
 assert.equal(restored.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 assert.deepEqual(fs.readFileSync(path.join(isolated,'uploads',key)),media);
 assert.equal(new V3Memories(restored,{env}).milestone({id:'owner',role:'owner'},{title:'After safe upgrade',occurredOn:'2026-10-09',state:'published'}).state,'published');
 restored.close();
});