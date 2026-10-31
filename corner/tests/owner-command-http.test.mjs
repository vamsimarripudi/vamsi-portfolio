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
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('owner command HTTP is private, owner-controlled and AI fails closed when disabled',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'owner-command-http-'));
  const port=0;
  let actualPort=null,origin='',base='';
  const email='owner@command-http.test',password=crypto.randomBytes(28).toString('base64url');
  const env={...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,
    DB_PATH:path.join(dir,'corner.sqlite'),SITE_URL:'http://fixture.test/corner',CORNER_BASE_PATH:'/corner',
    ADMIN_EMAIL:email,ADMIN_PASSWORD_HASH:passwordHash(password),SESSION_SECRET:crypto.randomBytes(48).toString('hex'),
    DEMO_CONTENT:'0',CORNER_COMMAND_AI:'0',OPENAI_API_KEY:''};
  const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  const errors=[],output=[];child.stderr.on('data',chunk=>errors.push(String(chunk)));
  child.stdout.on('data',chunk=>{const text=String(chunk);output.push(text);const match=text.match(/running at http:\/\/[^:]+:(\d+)/);if(match)actualPort=Number(match[1])});
  t.after(async()=>{child.kill('SIGTERM');await wait(180);fs.rmSync(dir,{recursive:true,force:true})});

  for(let i=0;i<100&&!actualPort;i++){if(child.exitCode!==null)break;await wait(50)}
  assert.ok(actualPort,'Server did not bind an OS-assigned port. '+errors.join('').slice(0,300)+' '+output.join('').slice(0,300));
  origin='http://127.0.0.1:'+actualPort;base=origin+'/corner';
  let ready=false;
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)break;
    try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}
    await wait(50);
  }
  assert.equal(ready,true,errors.join('').slice(0,500));

  const send=async(uri,{method='GET',cookie,json}={})=>{
    const headers={accept:'application/json'};
    if(cookie)headers.cookie=cookie;
    if(json!==undefined)headers['content-type']='application/json';
    if(method!=='GET')headers.origin=origin;
    return fetch(base+uri,{method,headers,body:json===undefined?undefined:JSON.stringify(json)});
  };

  assert.equal((await send('/api/admin/command/summary')).status,401);

  const login=await send('/api/admin/login',{method:'POST',json:{email,password}});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);

  const initial=await send('/api/admin/command/summary',{cookie});
  assert.equal(initial.status,200);
  const initialBody=(await initial.json()).data;
  assert.equal(initialBody.counts.open,0);
  assert.equal(initialBody.agent.ready,false);

  const createdResponse=await send('/api/admin/command/items',{method:'POST',cookie,json:{
    workspace:'personal',project:'FileBloom',kind:'decision',title:'Choose the next paid pilot',
    detail:'Need verified buyer evidence before changing scope.',priority:'now',
    evidenceStatus:'unverified',authority:'money',needsApproval:true
  }});
  assert.equal(createdResponse.status,200);
  const created=(await createdResponse.json()).data;
  assert.equal(created.needsApproval,true);
  assert.equal(created.authority,'money');

  const summary=await send('/api/admin/command/summary',{cookie});
  const summaryBody=(await summary.json()).data;
  assert.equal(summaryBody.counts.open,1);
  assert.equal(summaryBody.counts.now,1);
  assert.equal(summaryBody.counts.decisions,1);
  assert.equal(summaryBody.counts.approvals,1);

  const updated=await send('/api/admin/command/items/'+created.id,{method:'PATCH',cookie,json:{state:'waiting',version:created.version}});
  assert.equal(updated.status,200);
  assert.equal((await updated.json()).data.state,'waiting');

  const ai=await send('/api/admin/command/ask',{method:'POST',cookie,json:{question:'What should I do next?'}});
  assert.equal(ai.status,503);
  const aiBody=await ai.json();
  assert.equal(aiBody.error.code,'COMMAND_AI_DISABLED');
});
