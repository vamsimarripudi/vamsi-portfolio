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

test('owner comment and overview reads use the real Corner database and stay Personal-scoped',async t=>{
 const {service,data,c,agent,store}=setup(t);
 const post=store.createPost({title:'Commented story',body:'Story body',allowComments:true},owner.id),stamp=new Date().toISOString();
 for(const [index,state] of ['pending','approved','hidden','deleted'].entries())store.exec('INSERT INTO comments(id,post_id,author_name,body,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)','comment_'+state,post.id,'Reader '+index,'Comment '+state,state,stamp,stamp);
 assert.deepEqual(service.commentSummary(owner,scope),{pending:1,approved:1,hidden:1,deleted:1,total:4});
 const recent=service.comments(owner,scope,{state:'all',limit:10});assert.equal(recent.length,4);assert.equal(recent[0].authorNameSelfDeclared,true);assert.ok(recent.every(row=>row.postTitle==='Commented story'));
 const overview=service.cornerOverview(owner,scope);assert.equal(overview.comments.total,4);assert.equal(overview.posts.drafts,1);
 assert.throws(()=>service.commentSummary(owner,'kravia'),error=>error.status===409&&error.code==='PERSONAL_WORKSPACE_REQUIRED');
 service.setConsent(owner,true);let providerCalls=0;agent.fetch=async()=>{providerCalls++;throw Error('Provider must not be needed for exact comment count')};
 const turn=service.send(owner,c.id,scope,{message:'how many comments we got',mode:'chat',requestKey:key()});await until(()=>data.turn(owner,c.id,scope,turn.turnId).assistant.status==='complete');
 const answer=data.turn(owner,c.id,scope,turn.turnId).assistant;assert.match(answer.content,/4 comments recorded/);assert.match(answer.content,/1 pending/);assert.equal(answer.parts.commentSummary.total,4);assert.equal(providerCalls,0);
});

test('AI read tools can fetch comment counts and overview facts before answering',async t=>{
 const {service,data,c,agent,store}=setup(t);
 const post=store.createPost({title:'Tool story',body:'Body',allowComments:true},owner.id),stamp=new Date().toISOString();
 store.exec('INSERT INTO comments(id,post_id,author_name,body,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)','tool_comment',post.id,'Reader','Hello','pending',stamp,stamp);
 service.setConsent(owner,true);let calls=0;
 agent.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);assert.ok(body.tools.some(tool=>tool.name==='comments_summary'));assert.ok(body.tools.some(tool=>tool.name==='corner_overview'));calls++;
  if(calls===1)return {ok:true,json:async()=>({output:[{type:'function_call',call_id:'comment-read',name:'comments_summary',arguments:'{}'}],usage:{total_tokens:15}})};
  const toolOutput=body.input.find(item=>item.type==='function_call_output');assert.match(toolOutput.output,/"total":1/);
  return {ok:true,json:async()=>({output_text:'There is 1 comment, currently pending.',usage:{total_tokens:15}})};
 };
 const turn=service.send(owner,c.id,scope,{message:'Give me a factual Corner activity answer.',mode:'chat',requestKey:key()});await until(()=>data.turn(owner,c.id,scope,turn.turnId).assistant.status==='complete');assert.equal(calls,2);assert.match(data.turn(owner,c.id,scope,turn.turnId).assistant.content,/1 comment/);
});

test('post create/edit and comment moderation are explicit versioned proposals',t=>{
 const {service,data,c,store}=setup(t);
 const create=data.propose(owner,c.id,scope,{action:'post.create',payload:{title:'Jarvis draft',body:'Created by a reviewed Command proposal.',excerpt:'Reviewed draft',type:'tech_note',tags:['jarvis'],allowComments:true,allowReactions:true},requestKey:key()});
 assert.equal(store.allAdminPosts('draft').length,0);
 const created=data.decide(owner,c.id,scope,create.id,{confirm:true,version:create.version});
 assert.equal(created.status,'executed');const post=store.allAdminPosts('draft')[0];assert.equal(post.title,'Jarvis draft');
 const update=data.propose(owner,c.id,scope,{action:'post.update',targetId:post.id,targetVersion:post.version,payload:{title:'Jarvis draft updated',body:null,excerpt:'Edited through Command',type:null,tags:null,allowComments:null,allowReactions:null},requestKey:key()});
 const updated=data.decide(owner,c.id,scope,update.id,{confirm:true,version:update.version});assert.equal(updated.status,'executed');const saved=store.adminPost(post.id);assert.equal(saved.title,'Jarvis draft updated');assert.equal(saved.body,'Created by a reviewed Command proposal.');
 const stale=data.propose(owner,c.id,scope,{action:'post.update',targetId:saved.id,targetVersion:saved.version,payload:{title:'Stale title'},requestKey:key()});store.savePost(saved.id,{version:saved.version,title:'Changed elsewhere'},owner.id);assert.throws(()=>data.decide(owner,c.id,scope,stale.id,{confirm:true,version:stale.version}),e=>e.status===409&&e.code==='STALE_PROPOSAL');
 const current=store.adminPost(post.id),stamp=new Date().toISOString();store.exec('INSERT INTO comments(id,post_id,author_name,body,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)','jarvis_comment',post.id,'Reader','Please review me','pending',stamp,stamp);
 const moderation=data.propose(owner,c.id,scope,{action:'comment.moderate',targetId:'jarvis_comment',payload:{state:'approved'},requestKey:key()});assert.equal(store.one('SELECT state FROM comments WHERE id=?','jarvis_comment').state,'pending');data.decide(owner,c.id,scope,moderation.id,{confirm:true,version:moderation.version});assert.equal(store.one('SELECT state FROM comments WHERE id=?','jarvis_comment').state,'approved');
 const kravia=data.create(owner,{workspace:'kravia',requestKey:key()});assert.throws(()=>data.propose(owner,kravia.id,'kravia',{action:'post.create',payload:{title:'No leak',body:'x'},requestKey:key()}),e=>e.status===409&&e.code==='PERSONAL_WORKSPACE_REQUIRED');
});

test('voice transcription is owner-only, consent-gated, bounded and not stored',async t=>{
 const {service,agent}=setup(t);let calls=0;agent.fetch=async(url,options)=>{calls++;assert.ok(String(url).endsWith('/audio/transcriptions'));assert.ok(options.body instanceof FormData);assert.equal(options.body.get('model'),'gpt-transcribe');return {ok:true,json:async()=>({text:'Create a journal draft about today'})}};
 await assert.rejects(()=>service.transcribe(owner,scope,{bytes:Buffer.alloc(64,1),mime:'audio/webm'}),e=>e.status===403);
 service.setConsent(owner,true);const out=await service.transcribe(owner,scope,{bytes:Buffer.alloc(64,1),mime:'audio/webm'});assert.equal(out.text,'Create a journal draft about today');assert.equal(out.audioStored,false);assert.equal(calls,1);
 await assert.rejects(()=>service.transcribe(owner,scope,{bytes:Buffer.alloc(64,1),mime:'audio/ogg'}),e=>e.status===415);
 await assert.rejects(()=>service.transcribe(owner,scope,{bytes:Buffer.alloc(8,1),mime:'audio/webm'}),e=>e.status===400);
});

test('HTTP voice endpoint transcribes a bounded owner recording without persisting audio',async t=>{
 const f=await startComposerFixture({chat:true,mockChat:true});t.after(()=>f.close());
 let response=await f.send('/api/admin/command/consent?workspace=personal',{method:'POST',json:{accepted:true}});assert.equal(response.status,200);
 response=await f.send('/api/admin/command/transcribe?workspace=personal&name=voice',{method:'POST',raw:Buffer.alloc(96,7),headers:{'content-type':'audio/webm'}});assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.text,'how many comments we got');assert.equal(body.data.audioStored,false);
 response=await f.send('/api/admin/command/transcribe?workspace=personal',{method:'POST',raw:Buffer.alloc(96,7),headers:{'content-type':'audio/ogg'}});assert.equal(response.status,415);
});
