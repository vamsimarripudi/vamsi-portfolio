import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.mjs';
const folder=process.argv[2]?path.resolve(process.argv[2]):null;
if(!folder||!process.argv.includes('--confirm'))throw Error('Usage: npm run restore -- /path/to/backup --confirm\nStop the server and worker first. This overwrites database and media.');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
if(manifest.format!=='vamsis-corner-backup-v1')throw Error('Unrecognized backup format');
for(const [name,expected] of Object.entries(manifest.files)){
 if(name.startsWith('/')||name.split(/[\\/]/).includes('..'))throw Error('Unsafe backup entry');
 const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,name))).digest('hex');
 if(actual!==expected)throw Error('Backup checksum failed for '+name);
}
const source=new DatabaseSync(path.join(folder,'corner.sqlite'));
try{if(source.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Invalid database backup')}
finally{source.close()}
if(fs.existsSync(config.dbPath)){
 const guard=Date.now()-fs.statSync(config.dbPath).mtimeMs;
 if(guard<15000&&!process.argv.includes('--force'))throw Error('Target database changed within 15 seconds: stop the app and rerun with --force only if certain.');
}
fs.mkdirSync(path.dirname(config.dbPath),{recursive:true});
for(const suffix of ['-wal','-shm'])try{fs.rmSync(config.dbPath+suffix,{force:true})}catch{}
fs.copyFileSync(path.join(folder,'corner.sqlite'),config.dbPath);
fs.rmSync(config.uploads,{recursive:true,force:true});fs.mkdirSync(config.uploads,{recursive:true});
for(const [name] of Object.entries(manifest.files))if(name.startsWith('uploads/')){
 const dest=path.join(config.uploads,name.slice(8));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(folder,name),dest);
}
console.log(JSON.stringify({ok:true,restoredFrom:folder,database:config.dbPath,files:Object.keys(manifest.files).length}));
