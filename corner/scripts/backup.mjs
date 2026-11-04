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
const privateSrc=path.join(path.dirname(config.uploads),'command-private'),privateDest=path.join(target,'command-private');
if(fs.existsSync(privateSrc))fs.cpSync(privateSrc,privateDest,{recursive:true,force:false});
else fs.mkdirSync(privateDest,{mode:0o700});
const names=['corner.sqlite',...list(mediaDest).map(s=¶»§q«^