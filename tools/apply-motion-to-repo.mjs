#!/usr/bin/env node
// Offline, fail-closed, local-only installer for approved Corner ambient motion.
// Untouched styling also includes public/stories.css; only the three new ambient assets may be replaced.
// Never changes original Stories reader/Studio implementation or pushes/deploys.
import {readFile,copyFile,mkdir,rename,rm,stat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const corner=path.join(root,'corner');
const expectedGitBlobs=Object.freeze({
 'src/stories-model.mjs':'0cbd3b624231bc201e0614f2cfbd96cf169f8521',
 'src/stories-service.mjs':'7aea5c00db004ef2e2000801aa259c5b87c60ad6',
 'src/stories-studio.mjs':'ec31df3940d6a629e79a4487f9c5d970807701f5',
 'public/stories-studio.css':'8890f0644f90cc718418f363b94b7259f4a657db',
 'public/stories-library.js':'a22f099f054c9ca868dd51727588e763a37b23b0',
 'public/stories-reader.js':'f37916530048e147e75cc29a6e258c334adf506d',
 'public/stories-reader.css':'4afa1a3eeee78388c6794b848b71b87441e68402',
 'public/stories-motion.mjs':'8f28d42bed978519fe9fab41c59f23d1733a4cba',
 'public/stories-paper.mp3':'b2bd45f2565d67b5a801c68ac48c95977a70dd36'
});
const preservedGitBlobs=Object.freeze({...expectedGitBlobs});
const motionFiles=Object.freeze([
 'public/stories-unified.css','public/corner-living-motion.css','public/corner-living-motion.js'
]);
const backupPrefix='.quietly-alive-backup-';
function blobSha(bytes){
 return createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
}
async function verifyOriginals(){
 for(const [relative,expected] of Object.entries(preservedGitBlobs)){
  const actual=blobSha(await readFile(path.join(corner,relative)));
  if(actual!==expected)throw Error('Original Stories file differs from the approved source: '+relative);
 }
}
async function install(sourceDir){
 await verifyOriginals();
 if(!sourceDir)throw Error('Explicit --source is required for --apply.');
 const source=path.resolve(sourceDir);
 if(source===corner||source===root)throw Error('Source and destination must be distinct.');
 const replacements=[];
 for(const relative of motionFiles){
  const from=path.join(source,path.basename(relative));
  const bytes=await readFile(from);
  if(!bytes.length||bytes.length>200000)throw Error('Motion asset is empty or exceeds 200KB: '+relative);
  const dest=path.join(corner,relative);
  const current=await readFile(dest).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  replacements.push({from,dest,relative,current});
 }
 const backup=path.join(root,backupPrefix+Date.now()+'-'+randomUUID());
 await mkdir(backup,{recursive:false});
 const changed=[];
 try{
  for(const item of replacements){
   if(item.current)await copyFile(item.dest,path.join(backup,path.basename(item.dest)));
   const staging=item.dest+'.quietly-alive-stage-'+randomUUID();
   try{await copyFile(item.from,staging);await rename(staging,item.dest);}
   finally{await rm(staging,{force:true}).catch(()=>{});}
   changed.push(item);
  }
  await verifyOriginals();
  process.stdout.write('Ambient assets installed locally. Backup: '+backup+'\n');
 }catch(error){
  for(const item of changed.reverse()){
   if(item.current)await copyFile(path.join(backup,path.basename(item.dest)),item.dest);
   else await rm(item.dest,{force:true});
  }
  throw error;
 }
}
const args=process.argv.slice(2);
if(args.length===0||args.includes('--check')){
 await verifyOriginals();
 for(const relative of motionFiles){
  const file=path.join(corner,relative);
  const info=await stat(file);
  if(!info.isFile())throw Error('Missing motion asset: '+relative);
 }
 process.stdout.write('Original Stories assets and motion files verified. No changes made.\n');
}else if(args[0]==='--apply'&&args[1]==='--source'&&args.length===3){
 await install(args[2]);
}else{
 throw Error('Usage: node tools/apply-motion-to-repo.mjs [--check] | --apply --source <directory>. No automatic push or deploy.');
}
