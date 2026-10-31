import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Store} from '../src/store.mjs';
import {IdentityService} from '../src/identity.mjs';
import {passwordHash} from '../src/auth.mjs';
const cwd=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const wait=ms=>new Promise(done=>setTimeout(done,ms));
test('member and owner can return from stories to Account without reauthenticating; bio edits live only in Settings',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-account-return-'));
 const db=path.join(dir,'corner.sqlite'),port=50000+Math.floor(Math.random()*800);
 const base='http://127.0.0.1:'+port;
 const ownerEmail='owner@account.test',memberEmail='member@account.test';
 const ownerPassword=crypto.randomBytes(30).toString('base64url');
 const memberPassword=crypto.randomBytes(24).toString('base64url');
 const ownerHash=passwordHash(ownerPassword),memberHash=passwordHash(memberPassword);
 const secret=crypto.randomBytes(48).toString('hex');
 const store=new Store(db);
 store.bootstrap(ownerEmail,ownerHash);
 const env={NODE_ENV:'test',SESSION_SECRET:secret};
 new IdentityService(store,{env});
 const now=new Date().toISOString(),memberId='usr_'+crypto.randomUUID();
 store.exec('INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
 memberId,memberEmail,'Account Tester','member',memberHash,now,now);
 store.exec('INSERT INTO identity_profiles(user_id,verified_at,created_at,updated_at) VALUES(?,?,?,?)',
 memberId,now,now,now);
 const post=store.createPost({title:'Return to account story',body:'A short public test.',type:'tech_note'},store.owner().id);
 store.publish(post.id,store.owner().id);
 store.close();
 const server=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd,env:{
  ...process.env,NODE_ENV:'test',DEMO_CONTENT:'0',HOST:'127.0.0.1',PORT:String(port),
  CORNER_BASE_PATH:'/corner',SITE_URL:base+'/corner',DB_PATH:db,DATA_DIR:dir,
  SESSION_SECRET:secret,ADMIN_EMAIL:ownerEmail,ADMIN_PASSWORD_HASH:ownerHash
 },stdio:['ignore','pipe','pipe']});
 const errors=[];server.stderr.on('data',data=>errors.push(String(data)));
 t.after(async()=>{server.kill('SIGTERM');await wait(160);fs.rmSync(dir,{recursive:true,force:true})});
 let alive=false;
 for(let n=0;n<80;n++){
  if(server.exitCode!==null)break;
  try{if((await fetch(base+'/corner/api/health')).ok){alive=true;break}}catch{}
  await wait(90);
 }
 assert.equal(alive,true,'Corner started: '+errors.join('').slice(0,340));
 const go=(route,{cookie,method='GET',data}={})=>{
  const headers={accept:'application/json'};
  if(cookie)headers.cookie=cookie;
  if(method!=='GET')headers.origin=base;
  if(data!==undefined)headers['content-type']='application/json';
  return fetch(base+'/corner'+route,{method,headers,
   body:data===undefined?undefined:JSON.stringify(data),redirect:'manual'});
 };
 const guest=await go('/login');
 assert.equal(guest.status,200);
 assert.match(await guest.text(),/data-account-form="login"/);
 const member=await go('/api/v1/auth/login',{method:'POST',data:{email:memberEmail,password:memberPassword}});
 assert.equal(member.status,200);
 const memberCookie=member.headers.get('set-cookie').split(';')[0];
 assert.ok(memberCookie.startsWith('corner_member_session='));
 const profile=await go('/profile',{cookie:memberCookie});
 const html=await profile.text();
 assert.equal(profile.status,200);
 assert.match(html,/data-quiet-screen="overview"/);
 assert.match(html,/class="quiet-desk-grid"/);
 assert.match(html,/href="\/corner\/saved"/);
 assert.match(html,/href="\/corner\/settings\/preferences"/);
 assert.doesNotMatch(html,/data-account-form="profile"/);
 assert.match(html,/href="\/corner\/settings\/profile"/);
 const settings=await go('/settings/profile',{cookie:memberCookie});
 assert.equal(settings.status,200);
 assert.match(await settings.text(),/data-account-form="profile"/);
 const prefs=await go('/settings/preferences',{cookie:memberCookie});
 assert.equal(prefs.status,200);
 assert.match(await prefs.text(),/data-account-form="preferences"/);
 const saved=await go('/saved',{cookie:memberCookie});
 assert.equal(saved.status,200);
 assert.match(await saved.text(),/data-account-bookmarks/);
 const newBio='My <private> biography stays escaped';
 const edited=await go('/api/v1/me',{method:'PATCH',cookie:memberCookie,
  data:{displayName:'Account Tester Updated',bio:newBio,locale:'te',emailUpdates:false}});
 assert.equal(edited.status,200);
 const updated=await (await go('/profile',{cookie:memberCookie})).text();
 assert.match(updated,/Account Tester Updated/);
 assert.match(updated,/My &lt;private&gt; biography stays escaped/);
 assert.doesNotMatch(updated,/data-account-form="profile"/);
 assert.equal((await go('/post/'+post.slug,{cookie:memberCookie})).status,200);
 assert.equal((await go('/',{cookie:memberCookie})).status,200);
 const accountReturn=await go('/login',{cookie:memberCookie});
 assert.equal(accountReturn.status,302);
 assert.equal(accountReturn.headers.get('location'),'/corner/profile');
 assert.match(accountReturn.headers.get('cache-control'),/no-store/);
 const owner=await go('/api/v1/auth/admin/login',{method:'POST',data:{email:ownerEmail,password:ownerPassword}});
 assert.equal(owner.status,200);
 const ownerCookie=owner.headers.get('set-cookie').split(';')[0];
 assert.ok(ownerCookie.startsWith('corner_session='));
 assert.equal((await go('/login',{cookie:ownerCookie})).status,302,'Owner keeps same login during site navigation');
 assert.equal((await go('/admin',{cookie:ownerCookie})).status,200);
 const revoke=await go('/api/v1/auth/logout',{method:'POST',cookie:memberCookie,data:{}});
 assert.equal(revoke.status,200);
 assert.equal((await go('/login',{cookie:memberCookie})).status,200,'Logged-out member sees login again');
 assert.equal((await go('/settings/profile',{cookie:memberCookie})).status,200);
 assert.match(await (await go('/settings/profile',{cookie:memberCookie})).text(),/Sign in to access your private information/);
});
test('mobile Studio navigation is labeled, touch-sized, and Command keeps a local Section dropdown',()=>{
 const studio=fs.readFileSync(new URL('../public/studio.css',import.meta.url),'utf8');
 const command=fs.readFileSync(new URL('../public/command-center.css',import.meta.url),'utf8');
 const ui=fs.readFileSync(new URL('../src/ui.mjs',import.meta.url),'utf8');
 assert.match(studio,/position:sticky;[\s\S]*top:0/);
 assert.match(studio,/flex:0 0 64px!important/);
 assert.match(studio,/studio-nav-label[\s\S]*display:block!important/);
 assert.match(studio,/background:#fff1e9!important/);
 assert.match(studio,/studio-section-picker\{display:none!important\}/);
 assert.doesNotMatch(command,/command-section-switch/);
 assert.match(command,/command-filter-panel/);
 assert.match(command,/command-overview-card/);
 assert.match(ui,/id="studio-section-select"/);
});
