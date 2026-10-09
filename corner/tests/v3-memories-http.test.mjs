import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {passwordHash} from '../src/auth.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('Phase 2 real HTTP: private owner APIs, public-only content, CSRF and Now history',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-v3-phase2-'));
 const port=53400+Math.floor(Math.random()*500),origin='http://127.0.0.1:'+port;
 const env={...process.env,HOST:'127.0.0.1',PORT:String(port),SITE_URL:origin+'/corner',CORNER_BASE_PATH:'/corner',
  DATA_DIR:dir,DB_PATH:path.join(dir,'db.sqlite'),NODE_ENV:'test',DEMO_CONTENT:'0',CORNER_V3_MEMORIES:'1',
  CORNER_V3_SEARCH:'1',SESSION_SECRET:crypto.randomBytes(44).toString('hex'),ADMIN_EMAIL:'owner@example.org',ADMIN_PASSWORD_HASH:passwordHash('Track-Strong-Owner-Passphrase-2026!')};
 const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 const errors=[];child.stderr.on('data',x=>errors.push(String(x)));
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 t.after(async()=>{child.kill('SIGTERM');await delay(160);fs.rmSync(dir,{recursive:true,force:true})});
 let ready=false;
 for(let i=0;i<65;i++){if(child.exitCode!==null)break;try{if((await fetch(origin+'/corner/api/v1/ready')).ok){ready=true;break}}catch{}await delay(80)}
 assert.equal(ready,true,errors.join('').slice(0,300));
 const call=(url,method='GET',body,session='',originHeader=true)=>fetch(origin+'/corner'+url,{method,headers:{...(session?{cookie:session}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...(originHeader&&method!=='GET'?{origin}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
 for(const url of ['/timeline','/moments','/collections','/api/v1/memories/timeline','/api/v1/memories/albums','/api/v1/memories/collections','/api/v1/memories/now/history'])assert.equal((await call(url)).status,200,url);
 assert.equal((await call('/admin/v3/memories')).status,401);
 assert.equal((await call('/api/v1/admin/v3/memories')).status,401);
 assert.equal((await call('/api/v1/admin/v3/milestones','POST',{title:'New moment',occurredOn:'2026-10-09',state:'published'})).status,401);
 const auth=await call('/api/v1/admin/login','POST',{email:env.ADMIN_EMAIL,password:'Track-Strong-Owner-Passphrase-2026!'});
 assert.equal(auth.status,200);
 const cookie=auth.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
 assert.equal((await call('/api/v1/admin/v3/milestones','POST',{title:'New moment',occurredOn:'2026-10-09',state:'published'},cookie,false)).status,403);
 const milestone=await call('/api/v1/admin/v3/milestones','POST',{title:'New moment',occurredOn:'2026-10-09',kind:'personal',state:'published'},cookie);
 assert.equal(milestone.status,200);
 const item=(await milestone.json()).data;assert.equal(item.title,'New moment');
 assert.equal((await (await call('/api/v1/memories/timeline')).json()).data.items.length,1);
 assert.equal((await call('/api/v1/admin/v3/milestones/'+item.id,'DELETE',undefined,cookie)).status,200);
 assert.equal((await (await call('/api/v1/memories/timeline')).json()).data.items.length,0);
 assert.equal((await call('/api/v1/admin/v3/albums','POST',{title:'Empty album',state:'published',mediaIds:[]},cookie)).status,400);
 assert.equal((await call('/api/v1/admin/status','PUT',{label:'Currently building',detail:'Quiet experiments',icon:'✳',isActive:true},cookie)).status,200);
 const history=(await (await call('/api/v1/memories/now/history')).json()).data;
 assert.equal(history.length,1);assert.equal(history[0].label,'Currently building');
 const studio=await call('/admin/v3/memories','GET',undefined,cookie);assert.equal(studio.status,200);
 assert.match(await studio.text(),/Memories Studio/);
});
