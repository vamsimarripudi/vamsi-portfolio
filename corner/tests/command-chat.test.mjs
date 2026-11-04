import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {Store} from '../src/store.mjs';
import {OwnerCommand} from '../src/owner-command.mjs';
import {CommandAgent} from '../src/command-agent.mjs';
import {CommandChatStore} from '../src/command-chat-store.mjs';
import {CommandChatService} from '../src/command-chat-service.mjs';
import {startComposerFixture} from './composer-fixture.mjs';
const owner={id:'owner'},other={id:'other'},scope='personal',key=()=>crypto.randomUUID();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let n=0;n<100;n++){const v=fn();if(v)return v;await sleep(10)}throw Error('Timed out waiting for test result')}
function setup(t,options={}){
 const store=new Store(':memory:'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'command-chat-test-'));
 for(const [id,role] of [['owner','owner'],['other','owner'],['editor','editor']])store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,datetime('now'),datetime('now'))",id,id+'@chat.test',id,role,'hash');
 const queue=new OwnerCommand(store),agent=new CommandAgent({apiKey:'test-key-not-real-123456789012345',enabled:true,fetchImpl:async()=>({ok:true,json:async()=>({output_text:'A saved test response.',usage:{total_tokens:30}})})});
 const service=new CommandChatService({store,queue,agent,uploads:path.join(dir,'uploads'),...options});
 t.after(()=>{for(const c of service.running.values())c.abort();store.close();fs.rmSync(dir,{recursive:true,force:true})});
 const data=service.data,c=data.create(owner,{workspace:scope,requestKey:key()});return {store,dir,queue,agent,service,data,c};
}
test('additive schema migrates the foundation, reopens safely and preserves authoritative queue',t=>{
 const {store,queue,data}=setup(t);const task=queue.create({title:'Preserve existing task',workspace:'personal'},owner.id);
 const before=store.all('PRAGMA table_info(command_messages)').length;new CommandChatStore(store,queue);assert.equal(store.all('PRAGMA table_info(command_messages)').length,before);assert.equal(queue.get(task.id).title,task.title);assert.equal(data.list(owner,{workspace:scope}).items.length,1);
 const legacy=new Store(':memory:');t.after(()=>legacy.close());const q=new OwnerCommand(legacy);
 legacy.db.exec(`CREATE TABLE command_conversations(id TEXT PRIMARY KEY,owner_user_id TEXT,workspace TEXT,title TEXT,status TEXT,created_at TEXT,updated_at TEXT,last_message_at TEXT);
 CREATE TABLE command_messages(id TEXT PRIMARY KEY,conversation_id TEXT,sequence INTEGER,role TEXT,content TEXT,status TEXT,idempotency_key TEXT,created_at TEXT,completed_at TEXT);
 CREATE TABLE command_action_proposals(id TEXT PRIMARY KEY,conversation_id TEXT,message_id TEXT,action_type TEXT,target_id TEXT,target_version INTEGER,payload_json TEXT,status TEXT,idempotency_key TEXT,expires_at TEXT,approved_at TEXT,executed_at TEXT,created_at TEXT);`);
 new CommandChatStore(legacy,q);assert.ok(legacy.all('PRAGMA table_info(command_messages)').some(c=>c.name==='attempt'));
});
test('owner and workspace isolation, creation deduplication, literal search and version conflicts',t=>{
 const {data,c,store}=setup(t),requestKey=key(),one=data.create(owner,{workspace:'kravia',requestKey,title:'Revenue 100% _verified'});
 assert.equal(data.create(owner,{workspace:'kravia',requestKey}).id,one.id);
 assert.throws(()=>data.create(owner,{workspace:'personal',requestKey}),e=>e.status===409);
 assert.throws(()=>data.conversation(other,c.id,scope),e=>e.status===404);
 assert.throws(()=>data.conversation(owner,c.id,'kravia'),e=>e.status===404);
 assert.throws(()=>data.list({id:'editor'},{workspace:scope}),e=>e.status===403);
 assert.throws(()=>data.list(owner,{workspace:'all'}),e=>e.status===400);
 assert.equal(data.list(owner,{workspace:'kravia',query:'100% _'}).items.length,1);
 assert.equal(data.list(owner,{workspace:scope,query:'%'}).items.length,0);
 const renamed=data.update(owner,c.id,scope,{version:1,title:'One next step'});assert.equal(renamed.version,2);
 assert.throws(()=>data.update(owner,c.id,scope,{version:1,title:'stale'}),e=>e.status===409);
 data.update(owner,c.id,scope,{version:2,status:'archived'});assert.equal(data.list(owner,{workspace:scope}).items.length,0);assert.equal(data.list(owner,{workspace:scope,status:'archived'}).items.length,1);
 assert.throws(()=>data.accept(owner,c.id,scope,{message:'test',requestKey:key()}),e=>e.status===409);
 store.exec("UPDATE users SET disabled_at=datetime('now') WHERE id='owner'");assert.throws(()=>data.conversation(owner,c.id,scope),e=>e.status===403);
});
test('durable turns are idempotent, ordered, bounded and serial per conversation',t=>{
 const {data,c}=setup(t),body={message:'Hello',requestKey:key(),mode:'queue'},turn=data.accept(owner,c.id,scope,body);
 assert.equal(data.accept(owner,c.id,scope,body).turnId,turn.turnId);
 assert.throws(()=>data.accept(owner,c.id,scope,{...body,message:'different'}),e=>e.status===409);
 assert.throws(()=>data.accept(owner,c.id,scope,{message:'another',requestKey:key()}),e=>e.status===409);
 assert.equal(data.data(owner,c.id,scope).messages.length,2);
 data.finish(owner,c.id,scope,turn.turnId,1,{content:'No records.',tokens:0});
 assert.equal(data.data(owner,c.id,scope).messages[1].status,'complete');
 assert.equal(data.data(owner,c.id,scope).messages[0].sequence,1);
 assert.throws(()=>data.accept(owner,c.id,scope,{message:'x'.repeat(6001),requestKey:key()}),e=>e.status===400);
 assert.throws(()=>data.accept(owner,c.id,scope,{message:'x',requestKey:'short'}),e=>e.status===400);
});
test('cancel/retry prevents stale completions and recovers interrupted work',t=>{
 let clock=Date.now();const {data,c}=setup(t,{clock:()=>clock});const turn=data.accept(owner,c.id,scope,{message:'Think',requestKey:key()});
 data.cancel(owner,c.id,scope,turn.turnId);assert.equal(data.finish(owner,c.id,scope,turn.turnId,1,{content:'late'}),false);
 const retried=data.retry(owner,c.id,scope,turn.turnId);assert.equal(retried.assistant.attempt,2);assert.equal(data.finish(owner,c.id,scope,turn.turnId,1,{content:'late'}),false);
 clock+=181000;assert.equal(data.data(owner,c.id,scope).messages[1].error_code,'INTERRUPTED');
 data.retry(owner,c.id,scope,turn.turnId);data.cancel(owner,c.id,scope,turn.turnId);assert.throws(()=>data.retry(owner,c.id,scope,turn.turnId),e=>e.status===429);
});
test('queue proposals require review and execute exactly once; rejection and expiration cannot execute',t=>{
 let clock=Date.now();const {data,c,queue}=setup(t,{clock:()=>clock});const req={action:'queue.create',payload:{title:'Reviewed task',kind:'task',priority:'next'},requestKey:key()};const p=data.propose(owner,c.id,scope,req);
 assert.equal(queue.list().length,0);assert.equal(data.propose(owner,c.id,scope,req).id,p.id);
 assert.throws(()=>data.propose(owner,c.id,scope,{...req,payload:{title:'Other'}}),e=>e.status===409);
 assert.throws(()=>data.decide(owner,c.id,scope,p.id,{version:1}),e=>e.status===400);
 const out=data.decide(owner,c.id,scope,p.id,{confirm:true,version:1});assert.equal(out.status,'executed');assert.equal(queue.list().length,1);
 assert.equal(data.decide(owner,c.id,scope,p.id,{confirm:true,version:1}).result.id,out.result.id);assert.equal(queue.list().length,1);
 const no=data.propose(owner,c.id,scope,{...req,requestKey:key()});data.decide(owner,c.id,scope,no.id,{confirm:true,version:1,reject:true});assert.throws(()=>data.decide(owner,c.id,scope,no.id,{confirm:true,version:1}),e=>e.status===409);
 const old=data.propose(owner,c.id,scope,{...req,requestKey:key()});clock+=16*60000;assert.throws(()=>data.decide(owner,c.id,scope,old.id,{confirm:true,version:1}),e=>e.status===409);assert.equal(queue.list().length,1);
 assert.throws(()=>data.propose(owner,c.id,scope,{action:'email.send',payload:{},requestKey:key()}),e=>e.status===400);
});
test('status proposals reject stale records and cross-workspace changes',t=>{
 const {data,c,queue}=setup(t);const item=queue.create({title:'Versioned task',workspace:scope},owner.id),foreign=queue.create({title:'Other workspace',workspace:'kravia'},owner.id);
 assert.throws(()=>data.propose(owner,c.id,scope,{action:'queue.update',targetId:foreign.id,targetVersion:1,payload:{state:'done'},requestKey:key()}),e=>e.status===404);
 const p=data.propose(owner,c.id,scope,{action:'queue.update',targetId:item.id,targetVersion:1,payload:{state:'done'},requestKey:key()});queue.update(item.id,{state:'waiting',version:1},owner.id);
 assert.throws(()=>data.decide(owner,c.id,scope,p.id,{confirm:true,version:1}),e=>e.status===409);assert.equal(queue.get(item.id).state,'waiting');
 assert.throws(()=>data.propose(owner,c.id,scope,{action:'queue.create',payload:{title:'Cross',workspace:'kravia'},requestKey:key()}),e=>e.status===403);
});
test('history pagination and export are ordered; deleting chat does not delete queue records',t=>{
 const {data,c,queue}=setup(t,{maxRequests:100});for(let n=0;n<25;n++){const turn=data.accept(owner,c.id,scope,{message:'Message '+n,mode:'queue',requestKey:key()});data.finish(owner,c.id,scope,turn.turnId,1,{content:'Answer '+n,tokens:0})}
 const newest=data.data(owner,c.id,scope,{limit:20}),older=data.data(owner,c.id,scope,{before:newest.nextBefore,limit:40});assert.equal(newest.messages.length,20);assert.equal(older.messages.length,30);assert.ok(older.messages.at(-1).sequence<newest.messages[0].sequence);
 assert.equal(data.list(owner,{workspace:scope,query:'Message 24'}).items.length,1);assert.equal(data.export(owner,c.id,scope).messages.length,50);
 const item=queue.create({title:'Keep independent item'},owner.id),version=data.conversation(owner,c.id,scope).version;data.remove(owner,c.id,scope,{confirm:true,version});assert.equal(queue.get(item.id).id,item.id);assert.throws(()=>data.conversation(owner,c.id,scope),e=>e.status===404);
});
test('AI consent cannot be bypassed by omitting mode; provider failures remain durable',async t=>{
 const {service,data,c,agent}=setup(t);assert.throws(()=>service.send(owner,c.id,scope,{message:'No consent',requestKey:key()}),e=>e.status===403);
 service.setConsent(owner,true);agent.fetch=async()=>{throw Error('secret-provider-details')};
 const turn=service.send(owner,c.id,scope,{message:'Help',requestKey:key()});await until(()=>data.turn(owner,c.id,scope,turn.turnId).assistant.status==='failed');const m=data.turn(owner,c.id,scope,turn.turnId).assistant;assert.ok(!m.content.includes('secret'));assert.equal(data.data(owner,c.id,scope).messages.length,2);
});
test('queue and signal tools work without AI and never fabricate cross-workspace data',async t=>{
 const {service,data,c,queue,agent}=setup(t);agent.enabled=false;queue.create({workspace:'kravia',title:'Corporate private record'},owner.id);
 let turn=service.send(owner,c.id,scope,{message:'Queue',mode:'queue',requestKey:key()});await until(()=>data.turn(owner,c.id,scope,turn.turnId).assistant.status==='complete');assert.equal(data.turn(owner,c.id,scope,turn.turnId).assistant.parts.items.length,0);
 turn=service.send(owner,c.id,scope,{message:'Moments',mode:'signals',requestKey:key()});await until(()=>data.turn(owner,c.id,scope,turn.turnId).assistant.status==='complete');assert.equal(data.turn(owner,c.id,scope,turn.turnId).assistant.parts.signals.length,0);
});
test('AI tool loop uses stateless bounded context and returns proposals rather than executing them',async t=>{
 const {service,data,c,agent,queue}=setup(t);service.setConsent(owner,true);let calls=0;
 agent.fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.parallel_tool_calls,false);assert.ok(body.instructions.includes('WORKSPACE: personal'));calls++;return {ok:true,json:async()=>calls===1?{output:[{type:'function_call',call_id:'test-call',name:'propose_queue_create',arguments:JSON.stringify({title:'AI proposal',detail:'Needs approval',kind:'task',priority:'next',dueAt:null})}],usage:{total_tokens:20}}:{output_text:'Review the proposal below.',usage:{total_tokens:20}}}};
 const turn=service.send(owner,c.id,scope,{message:'Prepare a task',mode:'chat',requestKey:key()});await until(()=>data.turn(owner,c.id,scope,turn.turnId).assistant.status==='complete');assert.equal(calls,2);assert.equal(queue.list().length,0);assert.equal(data.data(owner,c.id,scope).proposals.length,1);
});
test('private uploads validate media, sanitize names and cannot be read through another workspace',async t=>{
 const {service,data,c,store}=setup(t);const png=await sharp({create:{width:4,height:4,channels:3,background:'#eee'}}).png().toBuffer();
 const file=await service.upload(owner,c.id,scope,{bytes:png,mime:'image/png',filename:'../../picture.png'});assert.ok(!file.filename.includes('/'));assert.equal(file.mime_type,'image/png');assert.equal(file.storage_key,undefined);
 assert.throws(()=>data.file(owner,c.id,'kravia',file.id),e=>e.status===404);
 await assert.rejects(()=>service.upload(owner,c.id,scope,{bytes:Buffer.from('<script>'),mime:'image/png',filename:'bad.png'}),e=>e.status===400);
 await assert.rejects(()=>service.upload(owner,c.id,scope,{bytes:Buffer.from([0]),mime:'text/plain',filename:'bad.txt'}),e=>e.status===413);
 await assert.rejects(()=>service.upload(owner,c.id,scope,{bytes:Buffer.from('hello'),mime:'image/svg+xml',filename:'bad.svg'}),e=>e.status===415);
 const stored=data.file(owner,c.id,scope,file.id);assert.ok(fs.existsSync(path.join(service.privateDir,stored.storage_key)));service.removeFile(owner,c.id,scope,file.id);assert.equal(store.one('SELECT count(*) n FROM command_chat_files').n,0);
});
test('image generation requires explicit consent and approval and is idempotent',async t=>{
 const {service,data,c,agent}=setup(t);const png=await sharp({create:{width:4,height:4,channels:3,background:'#eee'}}).png().toBuffer();let calls=0;
 agent.fetch=async(url,opt)=>{calls++;assert.ok(url.endsWith('/images/generations'));assert.equal(JSON.parse(opt.body).n,1);return {ok:true,json:async()=>({data:[{b64_json:png.toString('base64')}]})}};
 const p=service.imageProposal(owner,c.id,scope,'A test image',null,key());assert.equal(calls,0);assert.throws(()=>service.approveImage(owner,c.id,scope,p.id,{confirm:true,version:1}),e=>e.status===403);service.setConsent(owner,true);
 assert.throws(()=>service.approveImage(owner,c.id,scope,p.id,{version:1}),e=>e.status===409);
 service.approveImage(owner,c.id,scope,p.id,{confirm:true,version:1});service.approveImage(owner,c.id,scope,p.id,{confirm:true,version:1});
 await until(()=>data.getProposal(owner,c.id,scope,p.id).status==='executed');assert.equal(calls,1);const result=data.getProposal(owner,c.id,scope,p.id).result;assert.ok(data.file(owner,c.id,scope,result.fileId).generated);assert.equal(data.export(owner,c.id,scope).files[0].storage_key,undefined);
});
test('failed image requests are not automatically retried or refunded as if nothing happened',async t=>{
 const {service,data,c,agent}=setup(t);service.setConsent(owner,true);let calls=0;agent.fetch=async()=>{calls++;throw Error('provider unavailable')};const p=service.imageProposal(owner,c.id,scope,'Test',null,key());service.approveImage(owner,c.id,scope,p.id,{confirm:true,version:1});await until(()=>data.getProposal(owner,c.id,scope,p.id).status==='failed');assert.equal(calls,1);assert.throws(()=>service.approveImage(owner,c.id,scope,p.id,{confirm:true,version:1}),e=>e.status===409);
});
test('daily AI and image limits fail closed without blocking history reads',t=>{
 const {service,data,c,store}=setup(t,{maxRequests:1});const turn=data.accept(owner,c.id,scope,{message:'first',requestKey:key()});data.finish(owner,c.id,scope,turn.turnId,1,{content:'done'});assert.throws(()=>data.accept(owner,c.id,scope,{message:'second',requestKey:key()}),e=>e.status===429);assert.equal(data.data(owner,c.id,scope).messages.length,2);
 service.setConsent(owner,true);store.exec('UPDATE command_chat_usage SET image_count=5 WHERE owner_user_id=?',owner.id);const p=service.imageProposal(owner,c.id,scope,'Test',null,key());assert.throws(()=>service.approveImage(owner,c.id,scope,p.id,{confirm:true,version:1}),e=>e.status===429);
});
test('HTTP contracts enforce authentication, CSRF, workspace scope and private file delivery',async t=>{
 const f=await startComposerFixture({chat:true});t.after(()=>f.close());const prefix='/api/admin/command';
 assert.equal((await f.send(prefix+'/capabilities',{cookie:''})).status,401);
 assert.equal((await fetch(f.base+prefix+'/conversations',{method:'POST',headers:{cookie:f.cookie,origin:'https://attacker.invalid','content-type':'application/json'},body:JSON.stringify({workspace:scope,requestKey:key()})})).status,403);
 const created=await f.send(prefix+'/conversations',{method:'POST',json:{workspace:scope,requestKey:key()}});assert.equal(created.status,200);const c=(await created.json()).data;
 const base=prefix+'/conversations/'+c.id;assert.equal((await f.send(base+'?workspace=kravia')).status,404);
 const message=await f.send(base+'/messages?workspace=personal',{method:'POST',json:{message:'Queue',mode:'queue',requestKey:key()}});assert.equal(message.status,200);
 const read=await f.send(base+'?workspace=personal');assert.equal((await read.json()).data.messages.length,2);
 const upload=await f.send(base+'/files?workspace=personal&name=private.txt',{method:'POST',raw:'Private fixture',headers:{'content-type':'text/plain'}});assert.equal(upload.status,200);const file=(await upload.json()).data;
 const download=await f.send(base+'/files/'+file.id+'?workspace=personal');assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'private,no-store');assert.equal(await download.text(),'Private fixture');
 assert.equal((await f.send(base+'/files/'+file.id+'?workspace=personal',{cookie:''})).status,401);
 const ui=await f.send('/admin');assert.ok((await ui.text()).includes('command-chat.js'));
});
test('backup and restore retain private chat files separately from public media',async()=>{
 const {spawnSync}=await import('node:child_process');const root=fs.mkdtempSync(path.join(os.tmpdir(),'chat-backup-')),source=path.join(root,'source'),target=path.join(root,'restored'),snapshot=path.join(root,'snapshot');fs.mkdirSync(source);const db=new Store(path.join(source,'corner.sqlite'));db.close();fs.mkdirSync(path.join(source,'uploads'));fs.mkdirSync(path.join(source,'command-private'));fs.writeFileSync(path.join(source,'command-private','private.txt'),'private content');fs.writeFileSync(path.join(source,'uploads','public.txt'),'public content');
 try{const run=(script,args,dir)=>{const r=spawnSync(process.execPath,['--no-warnings',new URL('../scripts/'+script,import.meta.url).pathname,...args],{encoding:'utf8',env:{...process.env,NODE_ENV:'test',DATA_DIR:dir,DB_PATH:path.join(dir,'corner.sqlite')}});assert.equal(r.status,0,r.stderr)};run('backup.mjs',[snapshot],source);const manifest=JSON.parse(fs.readFileSync(path.join(snapshot,'manifest.json')));assert.ok(manifest.files['command-private/private.txt']);run('restore.mjs',[snapshot,'--confirm'],target);assert.equal(fs.readFileSync(path.join(target,'command-private','private.txt'),'utf8'),'private content');assert.equal(fs.readFileSync(path.join(target,'uploads','public.txt'),'utf8'),'public content');assert.ok(!fs.existsSync(path.join(target,'uploads','private.txt')))}finally{fs.rmSync(root,{recursive:true,force:true})}
});
