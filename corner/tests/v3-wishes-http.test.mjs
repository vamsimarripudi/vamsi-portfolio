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
test('Phase 3 actual HTTP verifies owner-only wishes CRUD, preview and email OFF',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-wishes-http-'));
 const port=54800+Math.floor(Math.random()*600),origin='http://127.0.0.1:'+port;
 const email='owner-wishes@example.test',password='Super-Strong-Wishes-Owner-Passphrase-2026!';
 const env={...process.env,NODE_ENV:'test',DATA_DIR:dir,DB_PATH:path.join(dir,'db.sqlite'),DEMO_CONTENT:'0',
  HOST:'127.0.0.1',PORT:String(port),SITE_URL:origin+'/corner',CORNER_BASE_PATH:'/corner',
  CORNER_V3_WISHES:'1',CORNER_V3_WISH_DELIVERY:'0',CORNER_V3_FOLLOW:'0',
  ADMIN_EMAIL:email,ADMIN_PASSWORD_HASH:passwordHash(password),SESSION_SECRET:crypto.randomBytes(48).toString('hex')};
 const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 const stderr=[];child.stderr.on('data',chunk=>stderr.push(String(chunk)));
 const sleep=ms=>new Promise(done=>setTimeout(done,ms));
 t.after(async()=>{child.kill('SIGTERM');await sleep(200);fs.rmSync(dir,{recursive:true,force:true})});
 let ready=false;
 for(let i=0;i<80;i++){
  if(child.exitCode!==null)break;
  try{if((await fetch(origin+'/corner/api/ready')).ok){ready=true;break}}catch{}
  await sleep(90);
 }
 assert.equal(ready,true,'Fixture must start: '+stderr.join('').slice(0,400));
 const call=(route,{method='GET',body,cookie='',withOrigin=true}={})=>fetch(origin+'/corner'+route,{
  method,redirect:'manual',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'}),
   ...(withOrigin&&method!=='GET'?{origin}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const guest=await call('/admin/v3/wishes');
 assert.equal(guest.status,401,'Owner studio stays private');
 assert.match(await guest.text(),/signin-box/);
 assert.equal((await call('/api/v1/admin/v3/wishes')).status,401);
 assert.equal((await call('/api/v1/admin/v3/wishes',{method:'POST',body:{title:'No',body:'May not write'}})).status,401);
 const auth=await call('/api/v1/admin/login',{method:'POST',body:{email,password}});
 assert.equal(auth.status,200,'Synthetic owner sign-in');
 const cookie=auth.headers.get('set-cookie')?.split(';')[0];
 assert.ok(cookie);
 const page=await call('/admin/v3/wishes',{cookie});
 assert.equal(page.status,200);
 const rendered=await page.text();
 assert.match(rendered,/Compose a wish/);assert.match(rendered,/EMAIL UPDATES OFF/);
 assert.equal((await call('/v3-wishes.css')).status,200);
 assert.equal((await call('/v3-wishes.js')).status,200);
 const data={title:'A thoughtful wish',body:'May the coming day bring good things.',timezone:'UTC'};
 const preview=await call('/api/v1/admin/v3/wishes/preview',{method:'POST',body:data,cookie});
 assert.equal(preview.status,200);
 assert.match((await preview.json()).data.reminder,/nothing has been published/i);
 const initial=(await (await call('/api/v1/admin/v3/wishes',{cookie})).json()).data;
 assert.equal(initial.length,0,'Preview must not persist a wish');
 const forbidden=await call('/api/v1/admin/v3/wishes',{method:'POST',body:data,cookie,withOrigin:false});
 assert.equal(forbidden.status,403,'CSRF Origin requirement');
 const created=await call('/api/v1/admin/v3/wishes',{method:'POST',body:data,cookie});
 assert.equal(created.status,200);
 const wish=(await created.json()).data;
 assert.equal(wish.state,'draft');
 assert.equal((await call('/api/v1/admin/v3/wishes/delivery',{cookie})).status,200);
 const published=await call('/api/v1/admin/v3/wishes/'+wish.id+'/publish',{method:'POST',cookie});
 assert.equal(published.status,200);
 assert.equal((await (await call('/api/v1/admin/v3/wishes/delivery',{cookie})).json()).data.enabled,false);
 const notify=await call('/api/v1/admin/v3/wishes/'+wish.id+'/notify',{method:'POST',body:{confirm:true},cookie});
 assert.equal(notify.status,503,'Publishing does not turn on email delivery');
 const resource=await call('/api/v1/admin/v3/wishes/'+wish.id,{cookie});
 assert.equal(resource.status,200);
 assert.equal((await resource.json()).data.type,'wish');
 assert.equal((await call('/api/v1/admin/v3/wishes/'+wish.id+'/duplicate',{method:'POST',cookie})).status,200);
});
