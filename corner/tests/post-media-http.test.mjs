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
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/V3sAAAAASUVORK5CYII=','base64');
test('real HTTP: owner uploads two captioned images, draft stays private, public gallery updates safely',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-photo-publication-'));
 const port=58600+Math.floor(Math.random()*500),origin='http://127.0.0.1:'+port,base=origin+'/corner';
 const email='owner@photos.test',password=crypto.randomBytes(32).toString('base64url');
 const env={...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,
  DB_PATH:path.join(dir,'db.sqlite'),SITE_URL:base,CORNER_BASE_PATH:'/corner',
  ADMIN_EMAIL:email,ADMIN_PASSWORD_HASH:passwordHash(password),SESSION_SECRET:crypto.randomBytes(48).toString('hex'),
  DEMO_CONTENT:'0'};
 const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 const logs=[];child.stderr.on('data',chunk=>logs.push(String(chunk)));
 t.after(async()=>{child.kill('SIGTERM');await wait(180);fs.rmSync(dir,{recursive:true,force:true})});
 let running=false;
 for(let i=0;i<85;i++){
  if(child.exitCode!==null)break;
  try{if((await fetch(base+'/api/health')).ok){running=true;break}}catch{}
  await wait(95);
 }
 assert.equal(running,true,logs.join('').slice(0,300));
 const send=async(uri,{method='GET',cookie,json,originHeader=true}={})=>{
  const headers={accept:'application/json'};
  if(cookie)headers.cookie=cookie;
  if(json!==undefined)headers['content-type']='application/json';
  if(method!=='GET'&&originHeader)headers.origin=origin;
  return fetch(base+uri,{method,headers,body:json===undefined?undefined:JSON.stringify(json),redirect:'manual'});
 };
 const login=await send('/api/v1/auth/admin/login',{method:'POST',json:{email,password}});
 assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie')?.split(';')[0];
 assert.ok(cookie?.startsWith('corner_session='));
 const create=await send('/api/v1/admin/posts',{method:'POST',cookie,json:{
  title:'Captioned photograph test',type:'moment',body:'A set of photographs with individual captions.'}});
 assert.equal(create.status,201);
 const {data:post}=await create.json();
 const upload=async(caption,alt)=>fetch(base+'/api/admin/media/upload?'+new URLSearchParams({
  postId:post.id,caption,alt}).toString(),{
  method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'image/png'},body:png});
 assert.equal((await upload('No description','')).status,400,'Every image requires alt text');
 const first=await upload('The first photograph.','Sunlit window');
 const second=await upload('Second <moment> & a quiet room','A quiet room');
 assert.equal(first.status,200);assert.equal(second.status,200);
 const firstMedia=(await first.json()).data,secondMedia=(await second.json()).data;
 assert.notEqual(firstMedia.storage_key,secondMedia.storage_key);
 assert.equal(firstMedia.caption,'The first photograph.');
 assert.equal(secondMedia.caption,'Second <moment> & a quiet room');
 const unpublished=await fetch(base+'/post/'+encodeURIComponent(post.slug));
 assert.equal(unpublished.status,404,'Draft story cannot be opened publicly');
 assert.equal((await fetch(base+'/media/'+firstMedia.storage_key)).status,404,'Draft photo is private');
 assert.equal((await fetch(base+'/media/'+firstMedia.storage_key,{headers:{Cookie:cookie}})).status,200,'Owner can preview draft media');
 const list=await send('/api/admin/posts/'+post.id,{cookie});
 assert.equal(list.status,200);
 const attached=(await list.json()).data.media;
 assert.equal(attached.length,2,'Both images attached to same post');
 assert.equal(attached[0].width,1);assert.equal(attached[0].height,1);
 const publish=await send('/api/admin/posts/'+post.id+'/publish',{method:'POST',cookie,json:{}});
 assert.equal(publish.status,200);
 const page=await fetch(base+'/post/'+encodeURIComponent(post.slug));
 assert.equal(page.status,200);
 const html=await page.text();
 assert.equal((html.match(/data-post-photo /g)||[]).length,2);
 assert.match(html,/The first photograph\./);
 assert.match(html,/Second &lt;moment&gt; &amp; a quiet room/);
 assert.doesNotMatch(html,/Second <moment> & a quiet room/);
 assert.match(html,/data-post-lightbox/);
 assert.match(html,/post-gallery\.js/);
 assert.equal((await fetch(base+'/post-gallery.js')).status,200);
 assert.equal((await fetch(base+'/post-media.css')).status,200);
 assert.equal((await fetch(base+'/media/'+firstMedia.storage_key)).status,200);
 const edited=await send('/api/admin/media/'+secondMedia.id,{method:'PATCH',cookie,json:{
  caption:'Updated caption with details',altText:'A quiet updated photograph'}});
 assert.equal(edited.status,200);
 const next=await (await fetch(base+'/post/'+encodeURIComponent(post.slug))).text();
 assert.match(next,/Updated caption with details/);
 assert.match(next,/A quiet updated photograph/);
 const injected=await send('/api/admin/media/'+firstMedia.id,{method:'PATCH',cookie,json:{
  caption:'<script>bad()</script>',altText:'Portrait'}});
 assert.equal(injected.status,200);
 const protectedHtml=await (await fetch(base+'/post/'+encodeURIComponent(post.slug))).text();
 assert.match(protectedHtml,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);
 assert.doesNotMatch(protectedHtml,/<script>bad\(\)<\/script>/);
 assert.equal((await send('/api/admin/media/'+secondMedia.id,{method:'PATCH',cookie:'',json:{caption:'spoof'}})).status,401);
});
