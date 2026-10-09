import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Store} from '../src/store.mjs';
import {passwordHash} from '../src/auth.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('Phase 4 actual HTTP: owner-private insights and human-reviewed translations only',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-v3-phase4-http-'));
 const db=path.join(dir,'corner.sqlite'),seed=new Store(db);
 const source=seed.createPost({title:'An English reflection',body:'These are private draft translations until approved.',type:'journal'},'owner');
 const published=seed.publish(source.id,'owner');seed.close();
 const port=55700+Math.floor(Math.random()*500),origin='http://127.0.0.1:'+port;
 const email='reviewer@example.test',password='Strong-Human-Review-Test-Passphrase#2026';
 const env={...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),
  SITE_URL:origin+'/corner',CORNER_BASE_PATH:'/corner',DATA_DIR:dir,DB_PATH:db,
  CORNER_V3_INSIGHTS:'1',CORNER_V3_LANGUAGES:'1',
  ADMIN_EMAIL:email,ADMIN_PASSWORD_HASH:passwordHash(password),
  SESSION_SECRET:crypto.randomBytes(48).toString('hex'),DEMO_CONTENT:'0'};
 const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 const errors=[];child.stderr.on('data',data=>errors.push(String(data)));
 const sleep=ms=>new Promise(done=>setTimeout(done,ms));
 t.after(async()=>{child.kill('SIGTERM');await sleep(180);fs.rmSync(dir,{recursive:true,force:true})});
 let ready=false;
 for(let n=0;n<70;n++){
  if(child.exitCode!==null)break;
  try{if((await fetch(origin+'/corner/api/ready')).ok){ready=true;break}}catch{}
  await sleep(95);
 }
 assert.equal(ready,true,'Server startup: '+errors.join('').slice(0,450));
 const call=(url,{method='GET',body,cookie='',originHeader=true}={})=>fetch(origin+'/corner'+url,{
  method,redirect:'manual',
  headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'}),
   ...(originHeader&&method!=='GET'?{origin}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal((await call('/admin/v3/insights')).status,401);
 assert.equal((await call('/admin/v3/languages')).status,401);
 assert.equal((await call('/api/v1/admin/v3/insights')).status,401);
 assert.equal((await call('/api/v1/admin/v3/languages')).status,401);
 const english=await call('/post/'+published.slug+'?lang=te');
 assert.equal(english.status,200);
 assert.match(await english.text(),/An English reflection/,'Draft locale must not be visible');
 const login=await call('/api/v1/admin/login',{method:'POST',body:{email,password}});
 assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
 const insights=await call('/api/v1/admin/v3/insights?days=7',{cookie});
 assert.equal(insights.status,200);const stats=(await insights.json()).data;
 assert.equal(stats.privacy.firstPartyOnly,true);
 assert.equal(stats.privacy.individualSessionsExposed,false);
 assert.equal((await call('/api/v1/admin/v3/insights?days=999',{cookie})).status,400);
 assert.equal((await call('/admin/v3/insights',{cookie})).status,200);
 assert.equal((await call('/admin/v3/languages',{cookie})).status,200);
 assert.equal((await call('/v3-phase4.css')).status,200);
 const draft={postId:published.id,language:'te',title:'తెలుగు శీర్షిక',body:'ఇది అందమైన తెలుగు వాక్యం'};
 assert.equal((await call('/api/v1/admin/v3/languages',{method:'POST',cookie,body:draft,originHeader:false})).status,403);
 const created=await call('/api/v1/admin/v3/languages',{method:'POST',cookie,body:draft});
 assert.equal(created.status,200);
 const createdData=(await created.json()).data;
 assert.equal(createdData.state,'draft');
 assert.equal(createdData.revision,1);
 const hidden=await call('/post/'+published.slug+'?lang=te');
 assert.doesNotMatch(await hidden.text(),/తెలుగు శీర్షిక/,'Draft must not be in public HTML');
 const review=await call('/api/v1/admin/v3/languages/'+published.id+'/te/publish',
  {method:'POST',cookie,body:{confirm:true,revision:createdData.revision}});
 assert.equal(review.status,200);
 const reviewed=(await review.json()).data;
 assert.equal(reviewed.state,'published');
 assert.equal(reviewed.revision,2);
 assert.equal((await call('/api/v1/admin/v3/languages/'+published.id+'/te/revoke',{method:'POST',cookie,body:{confirm:true,revision:createdData.revision}})).status,409,'A stale tab cannot revoke approved changes');
 const translated=await call('/post/'+published.slug+'?lang=te');
 const html=await translated.text();
 assert.equal(translated.status,200);
 assert.match(html,/lang="te-IN"/,'Correct document language');
 assert.match(html,/తెలుగు శీర్షిక/);
 assert.match(html,/hreflang="te-IN"/);
 assert.match(html,/class="v3a-language-picker"/);
 assert.match(html,/v3-phase4.css/);
 const api=await call('/api/v1/posts/'+published.slug+'?lang=te');
 assert.equal((await api.json()).data.post.title,'తెలుగు శీర్షిక');
 const revoke=await call('/api/v1/admin/v3/languages/'+published.id+'/te/revoke',
  {method:'POST',cookie,body:{confirm:true,revision:reviewed.revision}});
 assert.equal(revoke.status,200);
 const restored=await call('/post/'+published.slug+'?lang=te');
 assert.doesNotMatch(await restored.text(),/తెలుగు శీర్షిక/,'Revocation is immediate');
});
