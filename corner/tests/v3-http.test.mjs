import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
test('V3 HTTP guestbook, search and no unauthenticated moderation',async t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'corner-v3-http-'));
 const port=49200+Math.floor(Math.random()*550),origin='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:path.resolve(dir,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',SITE_URL:origin+'/corner',CORNER_BASE_PATH:'/corner',DB_PATH:tmp+'/db.sqlite',DATA_DIR:tmp,NODE_ENV:'test',CORNER_V3_SEARCH:'1',CORNER_V3_GUESTBOOK:'1',SESSION_SECRET:'test-only-corner-v3-long-secret-for-http-requests'},stdio:'ignore'});
 t.after(()=>{child.kill('SIGTERM');fs.rmSync(tmp,{recursive:true,force:true})});
 let ready=false;for(let n=0;n<60;n++){try{if((await fetch(origin+'/corner/api/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
 assert.equal(ready,true);
 for(const path of ['/corner/search','/corner/archive','/corner/guestbook'])assert.equal((await fetch(origin+path)).status,200,path);
 const send=async(route,data)=>fetch(origin+'/corner/api/v1/'+route,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await send('guestbook',{name:'QA',message:'A thoughtful hello from the test suite.',consent:true})).status,200);
 const publicList=await(await fetch(origin+'/corner/api/v1/guestbook')).json();assert.equal(publicList.data.length,0);
 assert.equal((await fetch(origin+'/corner/api/v1/admin/v3/guestbook')).status,401);
 const search=await(await fetch(origin+'/corner/api/v1/search/advanced?q=hello')).json();assert.ok(Array.isArray(search.data.items));
 const legacy=await(await fetch(origin+'/corner/api/v1/search?q=hello')).json();assert.ok(Array.isArray(legacy.data),'Legacy search shape unchanged');
 assert.equal((await send('guestbook',{name:'QA',message:'A second message',consent:true})).status,200);
 const csrf=await fetch(origin+'/corner/api/v1/guestbook',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
 console.log('PASS: SSR + v3 HTTP moderation, legacy search compatibility, origin enforcement');
});
