import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {Store} from '../src/store.mjs';
import {imageHasPrivateMetadata} from '../src/media-privacy.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('public derivatives revalidate published status, byte bounds and ETags after post archival',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-preview-http-'));
 const db=path.join(dir,'corner.sqlite'),upload=path.join(dir,'uploads');
 fs.mkdirSync(upload,{recursive:true});
 const name=crypto.randomBytes(16).toString('base64url')+'.png';
 const png=await sharp({create:{width:1200,height:800,channels:3,background:'#b5d7e9'}}).png().toBuffer();
 fs.writeFileSync(path.join(upload,name),png);
 const store=new Store(db);
 const post=store.createPost({title:'Published image',body:'Photo must stay safe',type:'moment'},'owner');
 store.publish(post.id,'owner');
 store.addMedia({id:'media_'+crypto.randomUUID(),ownerId:post.id,storageKey:name,mimeType:'image/png',size:png.length,alt:'A tranquil scene',width:1200,height:800});
 const port=57000+Math.floor(Math.random()*4700),origin='http://127.0.0.1:'+port;
 const env={...process.env,NODE_ENV:'test',DEMO_CONTENT:'0',HOST:'127.0.0.1',PORT:String(port),
  SITE_URL:origin+'/corner',CORNER_BASE_PATH:'/corner',DATA_DIR:dir,DB_PATH:db,CORNER_V3_MEMORIES:'1',
  SESSION_SECRET:crypto.randomBytes(48).toString('hex')};
 const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 const stderr=[];child.stderr.on('data',buf=>stderr.push(String(buf)));
 const pause=ms=>new Promise(done=>setTimeout(done,ms));
 t.after(async()=>{child.kill('SIGTERM');store.close();await pause(180);fs.rmSync(dir,{recursive:true,force:true})});
 let ready=false;for(let i=0;i<100;i++){
  if(child.exitCode!==null)break;
  try{if((await fetch(origin+'/corner/api/health')).ok){ready=true;break}}catch{}
  await pause(90);
 }
 assert.equal(ready,true,stderr.join('').slice(0,300));
 const url=origin+'/corner/media/'+encodeURIComponent(name);
 for(const [variant,maxWidth,budget] of [['tile',440,160000],['card',720,300000],['viewer',1600,950000]]){
  const resp=await fetch(url+'?variant='+variant);
  assert.equal(resp.status,200);
  assert.match(resp.headers.get('content-type')||'',/^image\/webp/);
  assert.match(resp.headers.get('cache-control')||'',/max-age=0,must-revalidate/);
  const converted=Buffer.from(await resp.arrayBuffer());
  assert.ok(converted.length<=budget);
  assert.equal(imageHasPrivateMetadata(converted,'image/webp'),false);
  assert.ok((await sharp(converted).metadata()).width<=maxWidth);
  const etag=resp.headers.get('etag');assert.ok(etag);
  assert.equal((await fetch(url+'?variant='+variant,{headers:{'if-none-match':etag}})).status,304);
  const head=await fetch(url+'?variant='+variant,{method:'HEAD'});
  assert.equal(head.status,200);
  assert.equal(Number(head.headers.get('content-length')),converted.length);
 }
 assert.equal((await fetch(url+'?variant=unlimited')).status,400);
 assert.equal((await fetch(url)).status,200);
 store.archive(post.id,'owner');
 assert.equal((await fetch(url)).status,404,'Archived original is never served');
 assert.equal((await fetch(url+'?variant=card',{headers:{'if-none-match':'*'}})).status,404,'Cached ETag cannot bypass publication');
});
