import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync, backup } from 'node:sqlite';
import { config, ROOT } from '../src/config.mjs';
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const target=process.argv[2]?path.resolve(process.argv[2]):path.join(ROOT,'backups','corner-'+stamp);
if(!fs.existsSync(config.dbPath))throw Error('Database not initialized yet; start the app first.');
if(fs.existsSync(target))throw Error('Backup destination already exists: '+target);
fs.mkdirSync(target,{recursive:true});
const source=new DatabaseSync(config.dbPath);
try { await backup(source,path.join(target,'corner.sqlite')); }
finally { source.close(); }
const mediaSrc=config.uploads,mediaDest=path.join(target,'uploads');
if(fs.existsSync(mediaSrc))fs.cpSync(mediaSrc,mediaDest,{recursive:true,force:false});
else fs.mkdirSync(mediaDest);
const digest=(file)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const list=(dir,rel='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const loc=path.join(rel,entry.name);return entry.isDirectory()?list(path.join(dir,entry.name),loc):[loc]});
const names=['corner.sqlite',...list(mediaDest).map(s=>'uploads/'+s)];
const manifest={format:'vamsis-corner-backup-v1',createdAt:new Date().toISOString(),files:Object.fromEntries(names.map(name=>[name,digest(path.join(target,name))]))};
fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const check=new DatabaseSync(path.join(target,'corner.sqlite'));
try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup integrity check failed')}finally{check.close()}
console.log(JSON.stringify({ok:true,destination:target,files:names.length,verified:true}));
