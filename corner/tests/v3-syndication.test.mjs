import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Store} from '../src/store.mjs';
import {renderSyndication} from '../src/v3-syndication.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('RSS/Atom publish only public records, escape XML and omit drafts and demo fixtures',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const published=store.createPost({title:'Fresh & <script>alert("1")</script>',body:'Keep <private> & symbols safe',type:'tech_note'},'owner');
 const draft=store.createPost({title:'Never publish this draft',body:'private draft',type:'tech_note'},'owner');
 store.publish(published.id,'owner');
 const opts={baseUrl:'https://example.org/corner',title:'Private & Public',now:new Date()};
 const rss=renderSyndication(store,{...opts,format:'rss'});
 const atom=renderSyndication(store,{...opts,format:'atom'});
 assert.match(rss.xml,/application\/rss\+xml/);
 assert.match(rss.xml,/Fresh &amp; &lt;script&gt;/);
 assert.match(rss.xml,/&lt;private&gt; &amp;/);
 assert.doesNotMatch(rss.xml,/<script>|Never publish this draft/);
 assert.doesNotMatch(atom.xml,/Never publish this draft/);
 assert.match(atom.xml,/xmlns="http:\/\/www.w3.org\/2005\/Atom"/);
 assert.match(atom.xml,/<updated>/);
 assert.equal(rss.items,1);assert.equal(atom.items,1);
 assert.equal(rss.etag,renderSyndication(store,{...opts,format:'rss'}).etag);
 store.archive(published.id,'owner');
 assert.equal(renderSyndication(store,{...opts,format:'rss'}).items,0);
 assert.equal(renderSyndication(store,{...opts,format:'atom'}).items,0);
 assert.notEqual(rss.etag,renderSyndication(store,{...opts,format:'rss'}).etag);
 assert.throws(()=>renderSyndication(store,{...opts,format:'html'}));
});
test('live RSS and Atom support published-only responses, ETags and HEAD after archive',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v3-feeds-http-'));
 const db=path.join(dir,'corner.sqlite');
 const store=new Store(db);
 const post=store.createPost({title:'Syndicated post',body:'Public article',type:'journal'},'owner');
 store.publish(post.id,'owner');
 store.createPost({title:'Private scheduled draft',body:'Invisible article',type:'journal'},'owner');
 const port=52300+Math.floor(Math.random()*4500),base='http://127.0.0.1:'+port;
 const env={...process.env,NODE_ENV:'test',DEMO_CONTENT:'0',HOST:'127.0.0.1',PORT:String(port),
  SITE_URL:base+'/corner',CORNER_BASE_PATH:'/corner',DATA_DIR:dir,DB_PATH:db,
  SESSION_SECRET:crypto.randomBytes(45).toString('hex')};
 const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 const errors=[];child.stderr.on('data',buf=>errors.push(String(buf)));
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 t.after(async()=>{child.kill('SIGTERM');store.close();await pause(160);fs.rmSync(dir,{recursive:true,force:true})});
 let ready=false;for(let i=0;i<80;i++){
  if(child.exitCode!==null)break;
  try{if((await fetch(base+'/corner/api/health')).ok){ready=true;break}}catch{}
  await pause(90);
 }
 assert.equal(ready,true,errors.join('').slice(0,400));
 for(const [pathname,mime] of [['rss.xml','application/rss+xml'],['atom.xml','application/atom+xml']]){
  const url=base+'/corner/'+pathname;
  const response=await fetch(url);
  assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',new RegExp(mime.replaceAll('/','\\/')));
  assert.match(response.headers.get('cache-control')||'',/max-age=0/);
  const xml=await response.text();
  assert.match(xml,/Syndicated post/);assert.doesNotMatch(xml,/Private scheduled draft/);
  assert.match(xml,/corner\/post\//);
  const etag=response.headers.get('etag');assert.ok(etag);
  assert.equal((await fetch(url,{headers:{'if-none-match':etag}})).status,304);
  const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);
  assert.equal(Number(head.headers.get('content-length')),Buffer.byteLength(xml));
  assert.equal((await fetch(url,{method:'POST',headers:{origin:base}})).status,405);
  store.archive(post.id,'owner');
  const after=await fetch(url,{headers:{'if-none-match':etag}});
  assert.equal(after.status,200,'Archival changes the feed ETag immediately');
  assert.doesNotMatch(await after.text(),/Syndicated post/);
  // Restore this post so the second format receives the same fixture.
  store.restore(post.id,'owner');
 }
});
