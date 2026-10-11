import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {passwordHash} from '../src/auth.mjs';

const cwd=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('compact member registration and login work over real HTTP without modifying owner credentials',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'member-short-http-')),mailbox=path.join(dir,'mail.jsonl');
 fs.writeFileSync(mailbox,'');
 const port=53100+Math.floor(Math.random()*500),origin='http://127.0.0.1:'+port;
 const ownerValue=crypto.randomBytes(26).toString('base64url');
 const value=['A','b','3','!','x','Y'].join('');
 const env={...process.env,HOST:'127.0.0.1',PORT:String(port),NODE_ENV:'test',
  CORNER_BASE_PATH:'/corner',SITE_URL:origin+'/corner',DB_PATH:path.join(dir,'corner.sqlite'),DATA_DIR:dir,
  CORNER_AUTH_REGISTRATION_ENABLED:'1',CORNER_AUTH_TEST_OUTBOX:mailbox,
  CORNER_MEMBER_SHORT_PASSWORDS:'1',
  ADMIN_EMAIL:'owner@compact.test',ADMIN_PASSWORD_HASH:passwordHash(ownerValue),
  SESSION_SECRET:crypto.randomBytes(48).toString('hex')};
 const server=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd,env,stdio:['ignore','pipe','pipe']});
 const errors=[];server.stderr.on('data',b=>errors.push(String(b)));
 t.after(async()=>{server.kill('SIGTERM');await wait(120);fs.rmSync(dir,{recursive:true,force:true})});
 let ready=false;
 for(let j=0;j<85;j++){
  if(server.exitCode!==null)break;
  try{if((await fetch(origin+'/corner/api/health')).ok){ready=true;break}}catch{}
  await wait(90);
 }
 assert.equal(ready,true,errors.join('').slice(0,290));
 const call=(name,{method='GET',cookie,data}={})=>{
  const headers={accept:'application/json'};
  if(cookie)headers.cookie=cookie;
  if(method!=='GET')headers.origin=origin;
  if(data)headers['content-type']='application/json';
  return fetch(origin+'/corner'+name,{method,headers,body:data?JSON.stringify(data):undefined,redirect:'manual'});
 };
 const form=await (await call('/register')).text();
 assert.match(form,/minlength="6" maxlength="12"/);
 const accepted=await call('/api/v1/auth/register',{method:'POST',data:{name:'Compact Member',email:'compact@example.test',password:value}});
 assert.equal(accepted.status,202);
 const email=JSON.parse(fs.readFileSync(mailbox,'utf8').trim().split('\n')[0]);
 const link=email.text.match(/https?:\/\/[^\s]+/)?.[0],token=new URLSearchParams(new URL(link).hash.slice(1)).get('token');
 assert.ok(token);
 assert.equal((await call('/api/v1/auth/email/verify',{method:'POST',data:{token}})).status,200);
 const logged=await call('/api/v1/auth/login',{method:'POST',data:{email:'compact@example.test',password:value}});
 assert.equal(logged.status,200);
 const cookie=logged.headers.get('set-cookie').split(';')[0];
 assert.equal((await call('/login',{cookie})).status,302,'Account link retains member session');
 const owner=await call('/api/v1/auth/admin/login',{method:'POST',data:{email:'owner@compact.test',password:ownerValue}});
 assert.equal(owner.status,200,'Studio accepts existing long owner phrase');
 const tooShort=await call('/api/v1/auth/register',{method:'POST',data:{
  name:'Other',email:'other@example.test',password:value.slice(0,5)}});
 assert.equal(tooShort.status,400,'Shorter than six refused');
});
