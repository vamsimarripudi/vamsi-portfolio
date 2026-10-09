import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {bucketFromEnv} from './s3-client.mjs';
import {Store} from './store.mjs';
import {applyV3Migrations} from './v3-migrations.mjs';
const run=promisify(execFile);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const markerPattern=/^backups\/\d{4}-\d{2}-\d{2}T[0-9-]+Z\/manifest\.json$/;
const safePath=name=>typeof name==='string'&&name.length<=240&&
 (name==='corner.sqlite'||name.startsWith('uploads/'))&&
 !name.startsWith('/')&&!name.includes('\\')&&!name.split('/').includes('..')&&!name.includes('//');
const monitored=['posts','media','users','settings','sessions','identity_bookmarks','audit_events'];
function counts(db){
 const found=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
 return Object.fromEntries(monitored.filter(x=>found.has(x)).map(table=>[table,db.prepare('SELECT COUNT(*) n FROM '+table).get().n]));
}
/** Rehearses a REAL private offsite snapshot without writing to live DB or exporting personal data. */
export async function auditLatestOffsiteMigration({storage=bucketFromEnv(),maxAgeHours=36,maxFiles=3000,maxBytes=512*1024*1024,clock=()=>new Date()}={}){
 const keys=await storage.list('backups/');
 const latest=keys.filter(k=>markerPattern.test(k)).sort().at(-1);
 if(!latest)throw new Error('No complete offsite backup manifest found');
 const prefix=latest.slice(0,-'manifest.json'.length);
 const bytes=await storage.get(latest);
 if(bytes.length>1024*1024)throw new Error('Snapshot manifest exceeds safety limit');
 const manifest=JSON.parse(bytes.toString('utf8'));
 if(manifest.format!=='vamsis-corner-backup-v1'||!manifest.files||typeof manifest.files!=='object'||Array.isArray(manifest.files))throw new Error('Unrecognized offsite manifest');
 const created=Date.parse(manifest.createdAt),age=clock().getTime()-created;
 if(!Number.isFinite(age)||age<0||age>=maxAgeHours*3600000)throw new Error('Latest offsite snapshot is stale');
 const names=Object.keys(manifest.files);
 if(names.length<1||names.length>maxFiles||!names.includes('corner.sqlite'))throw new Error('Unsafe snapshot manifest size');
 for(const name of names)if(!safePath(name)||!/^[a-f0-9]{64}$/.test(manifest.files[name]))throw new Error('Unsafe snapshot entry');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'corner-v3-real-restore-'));
 const snapshot=path.join(tmp,'download'),restored=path.join(tmp,'isolated');
 fs.mkdirSync(snapshot);fs.mkdirSync(restored);
 let transferred=0;
 try{
  for(const name of names){
   const data=await storage.get(prefix+name);
   transferred+=data.length;
   if(transferred>maxBytes)throw new Error('Snapshot exceeds rehearsal byte budget');
   if(hash(data)!==manifest.files[name])throw new Error('Offsite backup checksum mismatch');
   const dest=path.join(snapshot,name);
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.writeFileSync(dest,data,{flag:'wx'});
  }
  fs.writeFileSync(path.join(snapshot,'manifest.json'),bytes,{flag:'wx'});
  await run(process.execPath,[path.join(root,'scripts','restore.mjs'),snapshot,'--confirm'],{
   cwd:root,timeout:180000,maxBuffer:1048576,
   env:{...process.env,NODE_ENV:'test',DB_PATH:path.join(restored,'corner.sqlite'),DATA_DIR:restored}
  });
  const dbPath=path.join(restored,'corner.sqlite');
  const source=new DatabaseSync(dbPath);let before;
  try{
   if(source.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Isolated snapshot SQLite integrity failed');
   before=counts(source);
  }finally{source.close()}
  const upgraded=new Store(dbPath);
  try{
   const versions=applyV3Migrations(upgraded,{env:{NODE_ENV:'test',CORNER_V3_MEMORIES:'1'}});
   if(!versions.includes('v3-0003-memories'))throw new Error('Phase 2 migration not applied');
   if(upgraded.db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Upgraded SQLite integrity failed');
   if(upgraded.db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Upgraded SQLite foreign keys invalid');
   const after=counts(upgraded.db);
   for(const [table,n] of Object.entries(before))if(after[table]!==n)throw new Error('Existing records changed during isolated migration: '+table);
  }finally{upgraded.close()}
  return {verified:true,source:'completed offsite backup',rehearsed:true,phase2Migration:true,
   sqliteIntegrity:'ok',foreignKeys:'ok',dataPreserved:true,filesVerified:names.length,
   bytesVerified:transferred,backupCreatedAt:manifest.createdAt,completedAt:clock().toISOString()};
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
}
