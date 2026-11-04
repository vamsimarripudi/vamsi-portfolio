/** Disposable local Studio data. Uses normal authentication; never connects to production. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {passwordHash} from '../src/auth.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function startComposerFixture({port=0,host='127.0.0.1',seed=false,chat=false,mockChat=false}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'corner-studio-fixture-'));
 const email='studio-owner@fixture.test';
 const password='Corner-Local-Review-20261104!';
 const env={...process.env,NODE_ENV:'test',HOST:host,PORT:String(port),DATA_DIR:directory,
  DB_PATH:path.join(directory,'corner.sqlite'),SITE_URL:`http://127.0.0.1:${port||4141}/corner`,CORNER_BASE_PATH:'/corner',
  SITE_TIMEZONE:'Asia/Kolkata',ADMIN_EMAIL:email,ADMIN_PASSWORD_HASH:passwordHash(password),SESSION_SECRET:crypto.randomBytes(48).toString('hex'),
  DEMO_CONTENT:'0',CORNER_COMMAND_CHAT:chat?'1':'0',CORNER_COMMAND_AI:'0',OPENAI_API_KEY:'',CORNER_BACKUP_ENABLED:'0',
  CORNER_COMPANION_ENABLED:'0',CORNER_AUTH_REGISTRATION_ENABLED:'0',CORNER_AUTH_TEST_OUTBOX:path.join(directory,'mail.outbox'),
  CORNER_AUTH_RESEND_API_KEY:'',CORNER_AUTH_FROM_EMAIL:'',CORNER_COMMUNICATIONS_ENABLED:'0',
  CORNER_V3_WISH_DELIVERY:'0',CORNER_V3_FOLLOW:'0',CORNER_V3_WISHES:'1',CORNER_V3_MEMORIES:'1',
  CORNER_V3_RESEND_WEBHOOK_SECRET:'',CORNER_V3_PROVIDER_RECONCILIATION:'0'};
 if(mockChat){env.CORNER_COMMAND_AI='1';env.OPENAI_API_KEY='fixture-key-not-real-000000000000000000';}
 const child=spawn(process.execPath,['--no-warnings',...(mockChat?['--import',path.join(root,'tests/command-chat-provider-fixture.mjs')]:[]),'src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 let actualPort=null,ownerCookie='',origin='',base='';const output=[];
 const capture=chunk=>{output.push(String(chunk));if(output.length>40)output.shift()};
 child.stderr.on('data',capture);
 child.stdout.on('data',chunk=>{capture(chunk);const match=String(chunk).match(/running at http:\/\/[^:]+:(\d+)/);if(match)actualPort=Number(match[1])});
 const close=async()=>{
  if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),wait(3000)]);if(child.exitCode===null)child.kill('SIGKILL')}
  fs.rmSync(directory,{recursive:true,force:true});
 };
 const send=async(uri,{method='GET',cookie=ownerCookie,json,raw,headers={}}={})=>{
  // FFmpeg fixture creation can block this test process past the server's idle
  // keepalive timeout. A fresh socket avoids replaying a stale pooled connection.
  const requestHeaders={accept:'application/json',connection:'close',...headers};
  if(cookie)requestHeaders.cookie=cookie;
  if(json!==undefined)requestHeaders['content-type']='application/json';
  if(method!=='GET')requestHeaders.origin=origin;
  try{return await fetch(base+uri,{method,headers:requestHeaders,body:json===undefined?raw:JSON.stringify(json)})}
  catch(error){
   throw new Error('Local Studio request failed: '+method+' '+uri+'; child exit='+child.exitCode+', signal='+child.signalCode+'; recent output: '+output.join('').slice(-1500),{cause:error});
  }
 };
 try{
  for(let i=0;i<150&&!actualPort;i++){if(child.exitCode!==null)break;await wait(50)}
  if(!actualPort)throw Error('Local Studio failed to start. '+output.join('').slice(-1200));
  origin=`http://127.0.0.1:${actualPort}`;base=origin+'/corner';
  const health=await fetch(base+'/api/health');
  if(!health.ok)throw Error('Local Studio health failed.');
  const login=await send('/api/admin/login',{method:'POST',cookie:'',json:{email,password}});
  if(!login.ok)throw Error('Local Studio authentication failed.');
  ownerCookie=login.headers.get('set-cookie')?.split(';')[0]||'';
  if(!ownerCookie)throw Error('Local Studio did not create a session.');
  const seeded={};
  if(seed){
   const first=await send('/api/admin/posts',{method:'POST',json:{type:'journal',title:'Making room for one good idea',excerpt:'A quiet moment before the next beginning.',body:'Some days, the best progress is a little space to think.\n\nI am learning to finish one small thing before opening another. The work feels lighter when it has somewhere to belong.\n\nThis is synthetic local review content.',allowComments:true,allowReactions:true}});
   seeded.journal=(await first.json()).data;
   await send(`/api/admin/posts/${seeded.journal.id}/series`,{method:'PUT',json:{mode:'new'}});
   await send('/api/admin/posts',{method:'POST',json:{type:'moment',title:'The light before a busy day',body:'A simple moment, saved for later.',allowComments:true,allowReactions:true}});
   await send('/api/admin/command/items',{method:'POST',json:{workspace:'personal',project:'Vamsi’s Corner',kind:'decision',title:'Review the new writing workspace',detail:'Check a long Journal, the mobile preview, and draft recovery.',priority:'now',evidenceStatus:'verified',authority:'read',needsApproval:false}});
   await send('/api/admin/command/items',{method:'POST',json:{workspace:'personal',project:'Vamsi’s Corner',kind:'task',title:'Prepare the next chapter',detail:'Use the saved Journal draft after the visual review.',priority:'next',evidenceStatus:'unverified',authority:'draft',needsApproval:false}});
  }
  return {child,directory,origin,base,email,password,cookie:ownerCookie,send,close,seeded};
 }catch(error){await close();throw error}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const fixture=await startComposerFixture({port:Number(process.env.CORNER_FIXTURE_PORT||4147),host:process.env.CORNER_FIXTURE_HOST||'127.0.0.1',seed:true});
 console.log(JSON.stringify({url:fixture.base+'/admin',dataDirectory:fixture.directory,mode:'isolated-local-review',externalDelivery:false}));
 const stop=async()=>{await fixture.close();process.exit(0)};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
