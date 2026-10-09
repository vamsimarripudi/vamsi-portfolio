import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('live signed Resend webhook bypasses browser Origin only after signature verification',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v3-resend-route-'));
 const port=57900+Math.floor(Math.random()*700),base='http://127.0.0.1:'+port;
 const key=crypto.randomBytes(32),secret='whsec_'+key.toString('base64');
 const env={...process.env,NODE_ENV:'test',DEMO_CONTENT:'0',HOST:'127.0.0.1',PORT:String(port),
  SITE_URL:base+'/corner',CORNER_BASE_PATH:'/corner',
  DB_PATH:path.join(dir,'corner.sqlite'),DATA_DIR:dir,SESSION_SECRET:crypto.randomBytes(48).toString('hex'),
  CORNER_V3_FOLLOW_KEY:'long-independent-follow-key-for-provider-http-test',
  CORNER_V3_WISHES:'1',CORNER_V3_FOLLOW:'1',CORNER_V3_WISH_DELIVERY:'1',CORNER_V3_RESEND_WEBHOOK_SECRET:secret};
 const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 const stderr=[];child.stderr.on('data',b=>stderr.push(String(b)));
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 t.after(async()=>{child.kill('SIGTERM');await sleep(150);fs.rmSync(dir,{recursive:true,force:true})});
 let ready=false;
 for(let n=0;n<85;n++){
  if(child.exitCode!==null)break;
  try{if((await fetch(base+'/corner/api/health')).ok){ready=true;break}}catch{}
  await sleep(100);
 }
 assert.equal(ready,true,stderr.join('').slice(0,400));
 const url=base+'/corner/api/v1/webhooks/resend';
 const body=JSON.stringify({type:'email.delivered',data:{email_id:'unmatched_email_provider_1234'}});
 const id='msg_http_signed_987654',timestamp=String(Math.floor(Date.now()/1000));
 const signature='v1,'+crypto.createHmac('sha256',key).update(id+'.'+timestamp+'.'+body).digest('base64');
 const headers={'content-type':'application/json','svix-id':id,'svix-timestamp':timestamp,'svix-signature':signature};
 assert.equal((await fetch(url,{method:'GET'})).status,405);
 assert.equal((await fetch(url,{method:'POST',headers,body:'{tampered:true}'})).status,401);
 const ok=await fetch(url,{method:'POST',headers,body});
 assert.equal(ok.status,200,'Valid provider callback passes without browser Origin');
 assert.equal((await ok.json()).data.reconciled,0,'Unmatched email identifier is safely ignored');
 assert.equal((await (await fetch(url,{method:'POST',headers,body})).json()).data.duplicate,true);
 assert.equal((await fetch(base+'/corner/api/v1/admin/v3/wishes',{method:'POST',body:'{}',headers:{'content-type':'application/json'}})).status,403);
});
