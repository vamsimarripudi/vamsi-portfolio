import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Store } from '../src/store.mjs';
import { V3Engagement } from '../src/v3-engagement.mjs';
import { applyV3Migrations } from '../src/v3-migrations.mjs';
import { guestbookModerationPage,followPage,searchPage } from '../src/v3-ui.mjs';
import { passwordHash } from '../src/auth.mjs';

const flags={SESSION_SECRET:'test-only-phase1-session-key-longer-than-32-characters',CORNER_V3_SEARCH:'1',CORNER_V3_GUESTBOOK:'1',CORNER_V3_READING:'1',CORNER_V3_FOLLOW:'1',CORNER_V3_FOLLOW_KEY:'test-stable-follow-key-of-sufficient-length-2026',SESSION_SECRET:'strong-session-secret-for-unit-test-2026'};
const seed=store=>{
  const p=store.createPost({title:'Published memory',body:'Publicly readable note',type:'tech_note',tags:['Life']},'test');
  store.publish(p.id,'test');return p;
};
test('versioned V3 migrations retain rows, repeat safely and fail closed on mismatch',t=>{
  const s=new Store(':memory:');t.after(()=>s.close());
  const p=seed(s),v=new V3Engagement(s,{env:flags});
  assert.equal(v.search({q:'Published'}).total,1);
  assert.equal(s.one('SELECT count(*) n FROM v3_schema_migrations').n,2);
  applyV3Migrations(s);assert.equal(s.one('SELECT count(*) n FROM posts').n,1);
  s.exec("UPDATE v3_schema_migrations SET checksum='corrupt' WHERE version='v3-0001-engagement'");
  assert.throws(()=>applyV3Migrations(s),/checksum mismatch/);
});
test('published-only cursor search excludes private drafts and prevents duplicates',t=>{
  const s=new Store(':memory:');t.after(()=>s.close());
  const v=new V3Engagement(s,{env:flags});
  for(let n=0;n<5;n++)seed(s);
  s.createPost({title:'Private unpublished',body:'secret',type:'tech_note'},'test');
  let cursor='',ids=[];
  for(let n=0;n<3;n++){
    const page=v.search({q:'Published',limit:2,cursor});
    assert.equal(page.total,5);ids.push(...page.items.map(x=>x.id));
    cursor=page.nextCursor||'';
  }
  assert.equal(ids.length,5);assert.equal(new Set(ids).size,5);
  assert.equal(v.search({q:'unpublished'}).total,0);
  assert.throws(()=>v.search({cursor:'garbage'}),{code:'INVALID_CURSOR'});
  assert.throws(()=>v.search({year:'2026 OR 1=1'}),{code:'INVALID_YEAR'});
  assert.doesNotMatch(searchPage(v,{q:'" autofocus onfocus=alert(1)'}),/value="" autofocus/);
});
test('private reading progress integrates with bookmarks without erasing them',t=>{
  const s=new Store(':memory:');t.after(()=>s.close());
  const v=new V3Engagement(s,{env:flags}),p=seed(s),at=new Date().toISOString();
  s.exec('INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)','r1','r1@example.org','Reader','member','hash',at,at);
  const reader={id:'r1',role:'member'};
  assert.equal(v.reading(reader,p.id,47).progress,47);
  assert.equal(s.one('SELECT progress FROM identity_bookmarks WHERE user_id=? AND post_id=?','r1',p.id).progress,47);
  assert.equal(v.reading(reader,p.id,null).progress,0);
  assert.equal(s.one('SELECT count(*) n FROM identity_bookmarks').n,1);
  assert.throws(()=>v.reading({id:'owner',role:'owner'},p.id,50),{code:'AUTH_REQUIRED'});
});
test('moderation page escapes notes, follow topics are configurable, missing key fails closed',async t=>{
  const s=new Store(':memory:');t.after(()=>s.close());
  const v=new V3Engagement(s,{env:flags,sendMail:async()=>{}});
  v.submitGuestbook({name:'<svg onload=alert(1)>',message:'A friendly little note',consent:true});
  const html=guestbookModerationPage(v,{id:'owner',role:'owner'});
  assert.match(html,/&lt;svg/);assert.doesNotMatch(html,/<svg onload/);
  assert.match(html,/data-v3-moderate="approved"/);
  assert.match(followPage(),/name="topics"/);
  const locked=new V3Engagement(s,{env:{CORNER_V3_FOLLOW:'1',SESSION_SECRET:'strong-session-secret-for-unit-test-2026'},sendMail:async()=>{}});
  await assert.rejects(locked.follow({email:'user@example.org',consent:true}),{code:'FOLLOW_KEY_UNAVAILABLE'});
});
test('real HTTP V3: CSRF, moderation, hidden pending notes and one-use email opt-in',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-v3-http-')),mailbox=path.join(dir,'outbox.jsonl');
  fs.writeFileSync(mailbox,'');
  const port=52000+Math.floor(Math.random()*1000),base='http://127.0.0.1:'+port;
  const env={...process.env,...flags,HOST:'127.0.0.1',PORT:String(port),NODE_ENV:'test',SITE_URL:base+'/corner',CORNER_BASE_PATH:'/corner',
    DB_PATH:path.join(dir,'corner.sqlite'),DATA_DIR:dir,DEMO_CONTENT:'0',CORNER_AUTH_TEST_OUTBOX:mailbox,CORNER_AUTH_REGISTRATION_ENABLED:'0',
    ADMIN_EMAIL:'owner@example.org',ADMIN_PASSWORD_HASH:passwordHash('Owner-Strong-Passphrase-2026#'),SESSION_SECRET:crypto.randomBytes(44).toString('hex')};
  const cwd=path.dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
  const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd,env,stdio:['ignore','pipe','pipe']});
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const errors=[];child.stderr.on('data',buf=>errors.push(String(buf)));
  t.after(async()=>{child.kill('SIGTERM');await pause(140);fs.rmSync(dir,{recursive:true,force:true})});
  let ready=false;for(let n=0;n<80;n++){if(child.exitCode!==null)break;try{if((await fetch(base+'/corner/api/health')).ok){ready=true;break}}catch{}await pause(85)}
  assert.equal(ready,true,errors.join('').slice(0,300));
  const request=(resource,method='GET',data,session='',origin=true)=>{
    const headers={};if(data!==undefined)headers['content-type']='application/json';
    if(session)headers.cookie=session;if(origin&&method!=='GET')headers.origin=base;
    return fetch(base+'/corner'+resource,{method,headers,body:data===undefined?undefined:JSON.stringify(data),redirect:'manual'});
  };
  assert.equal((await request('/search?year=2026&category=Notes')).status,200);
  assert.equal((await request('/api/v1/search/advanced?cursor=broken')).status,400);
  assert.equal((await request('/api/v1/guestbook','POST',{name:'Test',message:'A kind new note',consent:true},'',false)).status,403);
  assert.equal((await request('/api/v1/guestbook','POST',{name:'Test',message:'A kind new note',consent:true})).status,200);
  assert.equal((await (await request('/api/v1/guestbook')).json()).data.length,0);
  assert.equal((await request('/admin/v3/guestbook')).status,401);
  const login=await request('/api/admin/login','POST',{email:env.ADMIN_EMAIL,password:'Owner-Strong-Passphrase-2026#'});
  assert.equal(login.status,200);const session=login.headers.get('set-cookie').split(';')[0];
  const list=(await (await request('/api/v1/admin/v3/guestbook','GET',undefined,session)).json()).data;
  assert.equal(list.length,1);
  assert.equal((await request('/api/v1/admin/v3/guestbook/'+list[0].id,'PATCH',{state:'approved'},session)).status,200);
  assert.equal((await (await request('/api/v1/guestbook')).json()).data.length,1);
  const followed=await request('/api/v1/follow','POST',{email:'subscriber@example.org',consent:true,topics:['wishes'],frequency:'weekly'});
  assert.equal(followed.status,200);
  const sent=JSON.parse(fs.readFileSync(mailbox,'utf8').trim().split('\n').at(-1));
  const token=new URLSearchParams(new URL(sent.text.match(/https?:\/\/\S+/)[0]).hash.slice(1)).get('token');
  assert.equal((await request('/api/v1/follow/verify','POST',{token})).status,200);
  assert.equal((await request('/api/v1/follow/verify','POST',{token})).status,400);
});


test('anonymous guestbook entry stays pending until moderator approval',t=>{
  const store=new Store(':memory:');t.after(()=>store.close());
  const v3=new V3Engagement(store,{env:flags});
  const result=v3.submitGuestbook({message:'A thoughtful unsigned visitor note',consent:true});
  assert.equal(result.state,'pending');
  assert.equal(v3.listGuestbook().length,0);
  const pending=v3.reviewQueue({id:'owner',role:'owner'});
  assert.equal(pending[0].name,'Guest');
  v3.manageGuestbook({id:'owner',role:'owner'},{id:pending[0].id,state:'approved'});
  assert.equal(v3.listGuestbook()[0].name,'Guest');
});

test('archive cursor pages through more than forty published entries without repeats',t=>{
  const store=new Store(':memory:');t.after(()=>store.close());
  const v3=new V3Engagement(store,{env:flags});
  for(let n=0;n<45;n++){
    const post=store.createPost({title:'Archive story '+n,body:'Public content',type:'tech_note'},'owner');
    store.publish(post.id,'owner');
  }
  store.createPost({title:'Private archive entry',body:'Not public',type:'tech_note'},'owner');
  const year=new Date().getUTCFullYear().toString();
  const first=v3.archive(year);
  assert.equal(first.items.length,40);
  assert.ok(first.nextCursor);
  const second=v3.archive(year,first.nextCursor);
  assert.equal(second.items.length,5);
  assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.items,...second.items].map(p=>p.id)).size,45);
});

test('bounced follower addresses stay suppressed and are not sent another email',async t=>{
  const store=new Store(':memory:');t.after(()=>store.close());
  const emails=[];
  const v3=new V3Engagement(store,{env:flags,sendMail:async mail=>emails.push(mail)});
  await v3.follow({email:'bounced@example.invalid',topics:['notes'],consent:true});
  assert.equal(emails.length,1);
  store.exec("UPDATE v3_follows SET state='bounced'");
  const response=await v3.follow({email:'bounced@example.invalid',topics:['notes'],consent:true});
  assert.equal(response.accepted,true);
  assert.equal(store.one('SELECT state FROM v3_follows').state,'bounced');
  assert.equal(emails.length,1);
  await assert.rejects(v3.follow({email:'new@example.invalid',topics:['all','notes'],consent:true}),{code:'INVALID_TOPICS'});
});
