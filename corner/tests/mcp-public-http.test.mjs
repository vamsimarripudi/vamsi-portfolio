import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {passwordHash} from '../src/auth.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('public MCP exposes only published Corner content through read-only tools',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-mcp-public-'));
  const port=0;
  let actualPort=null,origin='',base='';
  const email='owner@mcp.test',password=crypto.randomBytes(28).toString('base64url');
  const env={...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,
    DB_PATH:path.join(dir,'corner.sqlite'),SITE_URL:'http://fixture.test/corner',CORNER_BASE_PATH:'/corner',
    ADMIN_EMAIL:email,ADMIN_PASSWORD_HASH:passwordHash(password),SESSION_SECRET:crypto.randomBytes(48).toString('hex'),
    DEMO_CONTENT:'0'};
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
  const login=await send('/api/admin/login',{method:'POST',json:{email,password}});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);

  const draftRes=await send('/api/admin/posts',{method:'POST',cookie,json:{
    type:'journal',title:'Private MCP Draft',body:'This must never appear in the public MCP.',excerpt:'Private draft'
  }});
  const draft=(await draftRes.json()).data;
  assert.equal(draft.state,'draft');

  const publishedRes=await send('/api/admin/posts',{method:'POST',cookie,json:{
    type:'journal',title:'Public MCP Journal',body:'A public story that can be discovered safely through MCP.',excerpt:'Public MCP excerpt.'
  }});
  const published=(await publishedRes.json()).data;
  const seriesRes=await send('/api/admin/posts/'+published.id+'/series',{method:'PUT',cookie,json:{mode:'new'}});
  assert.equal(seriesRes.status,200);
  const series=(await seriesRes.json()).data;
  assert.equal(series.partNumber,1);
  assert.equal((await send('/api/admin/posts/'+published.id+'/publish',{method:'POST',cookie,json:{}})).status,200);

  const options=await fetch(base+'/mcp',{method:'OPTIONS'});
  assert.equal(options.status,204);
  assert.match(options.headers.get('access-control-allow-methods')||'',/POST/);

  const client=new Client({name:'corner-mcp-test',version:'1.0.0'});
  await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp')));
  t.after(()=>client.close().catch(()=>{}));

  const listed=await client.listTools();
  const names=listed.tools.map(tool=>tool.name).sort();
  assert.deepEqual(names,['fetch','list_public_series','list_published_posts','search']);
  for(const tool of listed.tools){
    assert.equal(tool.annotations?.readOnlyHint,true,tool.name+' is read-only');
    assert.equal(tool.annotations?.destructiveHint,false,tool.name+' is non-destructive');
    assert.equal(tool.annotations?.openWorldHint,false,tool.name+' is bounded to Corner');
  }

  const search=await client.callTool({name:'search',arguments:{query:'Public MCP Journal'}});
  assert.notEqual(search.isError,true);
  assert.ok(search.structuredContent.results.length>=1);
  const postHit=search.structuredContent.results.find(item=>item.id==='post:'+published.slug);
  assert.ok(postHit,'Published post is returned by search');
  assert.match(postHit.url,/\/corner\/post\//);
  assert.doesNotMatch(JSON.stringify(search),/Private MCP Draft/);

  const fetched=await client.callTool({name:'fetch',arguments:{id:'post:'+published.slug}});
  assert.match(fetched.structuredContent.text,/public story that can be discovered safely/);
  assert.equal(fetched.structuredContent.metadata.series.chapter,1);
  assert.doesNotMatch(JSON.stringify(fetched),/corner_session|password|owner@mcp\.test/);

  const posts=await client.callTool({name:'list_published_posts',arguments:{category:'journal',limit:10}});
  assert.equal(posts.structuredContent.posts.length,1);
  assert.equal(posts.structuredContent.posts[0].title,'Public MCP Journal');
  assert.doesNotMatch(JSON.stringify(posts),/Private MCP Draft/);

  const seriesList=await client.callTool({name:'list_public_series',arguments:{}});
  assert.equal(seriesList.structuredContent.series.length,1);
  assert.equal(seriesList.structuredContent.series[0].slug,series.slug);
  assert.equal(seriesList.structuredContent.series[0].chapterCount,1);

  const seriesFetch=await client.callTool({name:'fetch',arguments:{id:'series:'+series.slug}});
  assert.match(seriesFetch.structuredContent.text,/Chapter 01: Public MCP Journal/);

  const missing=await client.callTool({name:'fetch',arguments:{id:'post:'+draft.slug}});
  assert.equal(missing.isError,true,'Draft lookup remains unavailable through MCP');
});
