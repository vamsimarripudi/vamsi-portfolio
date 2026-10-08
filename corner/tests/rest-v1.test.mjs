import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { passwordHash } from '../src/auth.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function getPort(){
 const server=net.createServer();
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
 const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;
}
test('REST v1: OpenAPI, CRUD, CSRF, reaction idempotence, legacy support, concurrent health probes', async (t)=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'corner-v1-'));
 const port=await getPort(),host='http://127.0.0.1:'+port,base='/corner';
 const email='v1-owner@example.com',password='SyntheticTestPassword#2026';
 const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{
   cwd:root,stdio:['ignore','pipe','pipe'],
   env:{...process.env,NODE_ENV:'production',PORT:String(port),HOST:'127.0.0.1',
     SITE_URL:host+base,CORNER_BASE_PATH:base,DATA_DIR:directory,TRUST_PROXY:'0',DEMO_CONTENT:'0',
     ADMIN_EMAIL:email,ADMIN_PASSWORD_HASH:passwordHash(password),SESSION_SECRET:crypto.randomBytes(48).toString('hex')},
 });
 let stderr='';child.stderr.on('data',x=>{stderr+=String(x)});
 t.after(async()=>{if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),sleep(2000)])}if(child.exitCode===null)child.kill('SIGKILL');fs.rmSync(directory,{force:true,recursive:true})});
 const call=(route,method='GET',data,cookie)=>fetch(host+base+route,{
   method,headers:{Origin:host,...(data===undefined?{}:{'content-type':'application/json'}),...(cookie?{Cookie:cookie}:{})},
   ...(data===undefined?{}:{body:JSON.stringify(data)}),
 });
 const read=async r=>({status:r.status,result:await r.json()});
 let ok=false;for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error('Server exited: '+stderr);
   try{const response=await call('/api/v1/ready');if(response.status===200){ok=true;break}}catch{}
   await sleep(75);
 }
 assert.ok(ok,'ready while persistent storage writable');
 const index=await call('/api/v1');assert.equal(index.status,200);
 assert.match(index.headers.get('x-request-id'),/^[0-9a-f-]{36}$/i);
 assert.equal((await index.json()).data.legacySupported,true);
 const openapi=await call('/api/v1/openapi.json');
 assert.equal(openapi.status,200);
 const contract=await openapi.json();assert.equal(contract.openapi,'3.1.0');
 assert.equal(contract.servers[0].url,host+base);
 assert.ok(contract.paths['/api/v1/admin/posts/{postId}'].delete);
 assert.ok(contract.paths['/api/v1/posts/{postId}/reactions'].put);
 assert.equal((await call('/api/health')).status,200,'legacy endpoint retained');
 assert.equal((await call('/api/v1/admin/posts')).status,401,'owner privacy');
 const login=await call('/api/v1/admin/login','POST',{email,password});assert.equal(login.status,200);
 const session=login.headers.get('set-cookie')?.split(';')[0];assert.match(session||'',/^corner_session=/);
 const first=await call('/api/v1/admin/posts','POST',{title:'REST-v1 verified entry',body:'Synthetic QA post for REST API verification.',type:'tech_note',allowComments:true},session);
 assert.equal(first.status,201,'v1 creates use 201');
 const post=(await first.json()).data;
 assert.equal(first.headers.get('location'),base+'/api/v1/admin/posts/'+post.id);
 const item='/api/v1/admin/posts/'+post.id;
 assert.equal((await call(item,'GET',undefined,session)).status,200);
 const changed=await read(await call(item,'PATCH',{title:'REST-v1 updated entry',version:post.version},session));
 assert.equal(changed.status,200);
 assert.equal(changed.result.data.title,'REST-v1 updated entry');
 assert.equal((await call(item,'PATCH',{title:'Stale',version:post.version},session)).status,409);
 assert.equal((await fetch(host+base+item,{method:'DELETE',headers:{Origin:'https://evil.invalid',Cookie:session}})).status,403);
 assert.equal((await read(await call(item+'/publish','POST',{},session))).result.data.state,'published');
 assert.equal((await call('/api/v1/posts/'+post.slug)).status,200);
 const reactions='/api/v1/posts/'+post.id+'/reactions';
 const vote=await call(reactions,'PUT',{reaction:'❤️'});assert.equal(vote.status,200);
 const visitor=vote.headers.get('set-cookie')?.split(';')[0];assert.match(visitor||'',/^corner_visitor=/);
 assert.equal((await vote.json()).data.counts['❤️'],1);
 const double=await read(await call(reactions,'PUT',{reaction:'❤️'},visitor));
 assert.equal(double.result.data.counts['❤️'],1,'PUT idempotent');
 assert.equal((await call(reactions,'DELETE',undefined,visitor)).status,200);
 const deleteAgain=await read(await call(reactions,'DELETE',undefined,visitor));
 assert.equal(deleteAgain.result.data.counts['❤️']||0,0,'DELETE idempotent');
 const posted=await read(await call('/api/v1/posts/'+post.id+'/comments','POST',{name:'QA user',body:'This should be moderated.'}));
 const cid=posted.result.data.id;assert.equal(posted.result.data.state,'pending');
 assert.equal((await read(await call('/api/v1/admin/comments/'+cid,'GET',undefined,session))).result.data.state,'pending');
 assert.equal((await read(await call('/api/v1/admin/comments/'+cid,'PATCH',{state:'approved'},session))).result.data.state,'approved');
 assert.equal((await read(await call('/api/v1/admin/comments/'+cid,'DELETE',undefined,session))).result.data.state,'deleted');
 const archived=await read(await call(item,'DELETE',undefined,session));
 assert.equal(archived.result.data.state,'archived');assert.equal(archived.result.data.restorable,true);
 assert.equal((await call('/api/v1/posts/'+post.slug)).status,404,'archive removes public availability');
 assert.equal((await read(await call(item,'DELETE',undefined,session))).result.data.state,'archived','repeat safe');
 assert.equal((await read(await call(item+'/restore','POST',{},session))).result.data.state,'published');
 assert.equal((await call('/api/posts/'+post.slug)).status,200,'legacy frontend still works');
 const requests=await Promise.all(Array.from({length:40},()=>call('/api/v1/health')));
 assert.equal(requests.filter(r=>r.status===200).length,40);
 console.log('PASS REST v1 CRUD, schema, version conflict, CSRF, reactions, moderation, soft-delete, backwards compatibility and 40 parallel health requests');
});
