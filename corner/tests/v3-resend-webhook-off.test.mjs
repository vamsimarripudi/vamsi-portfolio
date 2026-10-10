import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Store} from '../src/store.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('signed Resend event is acknowledged while subscriber mail is off, unsigned event rejected',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'resend-hook-off-'));
 const port=61000+Math.floor(Math.random()*1500),origin='http://127.0.0.1:'+port;
 const key=crypto.randomBytes(32),secret='whsec_'+key.toString('base64');
 const db=path.join(dir,'corner.sqlite');
 const env={...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,DB_PATH:db,
  NODE_ENV:'test',DEMO_CONTENT:'0',SITE_URL:origin+'/corner',CORNER_BASE_PATH:'/corner',
  SESSION_SECRET:crypto.randomBytes(48).toString('hex'),
  CORNER_V3_WISHES:'1',CORNER_V3_FOLLOW:'0',CORNER_V3_WISH_DELIVERY:'0',
  CORNER_V3_RESEND_WEBHOOK_SECRET:secret};
 const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 const errors=[];child.stderr.on('data',x=>errors.push(String(x)));
 const sleep=n=>new Promise(resolve=>setTimeout(resolve,n));
 t.after(async()=>{child.kill('SIGTERM');await sleep(180);fs.rmSync(dir,{recursive:true,force:true})});
 let running=false;
 for(let n=0;n<90;n++){
  if(child.exitCode!==null)break;
  try{if((await fetch(origin+'/corner/api/ready')).ok){running=true;break}}catch{}
  await sleep(85);
 }
 assert.equal(running,true,'Fixture start: '+errors.join('').slice(0,300));
 const url=origin+'/corner/api/v1/webhooks/resend';
 assert.equal((await fetch(url)).status,405,'GET remains prohibited');
 const body=JSON.stringify({type:'email.delivered',data:{email_id:'identity_email_1234567'}});
 const id='msg_signed_during_mail_off_2026',timestamp=String(Math.floor(Date.now()/1000));
 const signature='v1,'+crypto.createHmac('sha256',key).update(id+'.'+timestamp+'.'+body).digest('base64');
 const headers={'content-type':'application/json','svix-id':id,'svix-timestamp':timestamp,'svix-signature':signature};
 assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body})).status,401,'Unsigned event denied');
 assert.equal((await fetch(url,{method:'POST',headers,body:'{"type":"email.sent"}'})).status,401,'Invalid signature denied');
 const response=await fetch(url,{method:'POST',headers,body});
 assert.equal(response.status,200,'Signed event acknowledged while mail sending is OFF');
 assert.deepEqual((await response.json()).data,{accepted:true,ignored:true,deliveryEnabled:false});
 assert.equal((await fetch(url,{method:'POST',headers,body})).status,200,'Retry receives harmless acknowledgement');
 const store=new Store(db);
 try{
  assert.equal(store.one("SELECT name FROM sqlite_master WHERE name='v3_wish_provider_events'"),null,'No provider schema added');
  assert.equal(store.one("SELECT name FROM sqlite_master WHERE name='v3_wish_outbox'"),null,'No outbound campaign schema added');
  assert.equal(store.one("SELECT COUNT(*) AS n FROM posts").n,0,'No posts created');
 }finally{store.close()}
});