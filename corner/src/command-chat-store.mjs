import fs from 'node:fs';
import crypto from 'node:crypto';
import {httpError,uid} from './domain.mjs';

const schema=fs.readFileSync(new URL('./command-chat-schema.sql',import.meta.url),'utf8');
const fail=(status,message,code='CHAT_INVALID')=>{throw httpError(status,message,code)};
export const workspace=value=>['personal','kravia'].includes(value)?value:fail(400,'Choose Personal or KRAVIA.');
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{12,100}$/.test(value)?value:fail(400,'A valid request key is required.');
const text=(value,max)=>typeof value==='string'&&value.trim()&&value.length<=max?value.trim():fail(400,'Enter text within the allowed length.');
const json=value=>JSON.stringify(value);
const parse=value=>JSON.parse(value||'{}');
const hash=value=>crypto.createHash('sha256').update(json(value)).digest('hex');
const states=new Set(['open','waiting','done','dismissed']);
const positive=(v,fallback,max)=>Number.isInteger(Number(v))&&Number(v)>0?Math.min(Number(v),max):fallback;
export class CommandChatStore {
 constructor(store,queue,{clock=Date.now,maxRequests=100,maxTokens=6000000}={}){
  this.store=store;this.queue=queue;this.clock=clock;
  this.maxRequests=positive(maxRequests,100,500);this.maxTokens=positive(maxTokens,6000000,10000000);
  store.transaction(()=>{
   store.db.exec(schema);
   const columns={command_conversations:{version:'INTEGER NOT NULL DEFAULT 1',create_key:'TEXT'},command_messages:{turn_id:'TEXT',parts_json:"TEXT NOT NULL DEFAULT '{}'",request_hash:'TEXT',error_code:'TEXT',attempt:'INTEGER NOT NULL DEFAULT 1',updated_at:'TEXT'},command_action_proposals:{version:'INTEGER NOT NULL DEFAULT 1',result_json:'TEXT',error_code:'TEXT'}};
   for(const [table,fields] of Object.entries(columns)){
    const existing=store.all('PRAGMA table_info('+table+')').map(c=>c.name);
    for(const [field,type] of Object.entries(fields))if(!existing.includes(field))store.db.exec('ALTER TABLE '+table+' ADD COLUMN '+field+' '+type);
   }
   store.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_create_key ON command_conversations(owner_user_id,create_key) WHERE create_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_chat_history ON command_conversations(owner_user_id,workspace,status,updated_at DESC,id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages ON command_messages(conversation_id,sequence);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_pending ON command_messages(conversation_id) WHERE role='assistant' AND status='pending';
    CREATE INDEX IF NOT EXISTS idx_chat_proposals ON command_action_proposals(conversation_id,status,expires_at);
    CREATE INDEX IF NOT EXISTS idx_chat_files ON command_chat_files(conversation_id,message_id);`);
   store.exec('INSERT OR IGNORE INTO command_chat_migrations VALUES(1,?)',this.stamp());
  });
 }
 stamp(){return new Date(this.clock()).toISOString()}
 actor(actor){
  const user=actor?.id&&this.store.one("SELECT id,role,disabled_at FROM users WHERE id=?",actor.id);
  if(!user||user.role!=='owner'||user.disabled_at)fail(403,'Only the owner can access Command Chat.','OWNER_ONLY');
  return user.id;
 }
 conversation(actor,id,scope,write=false){
  const owner=this.actor(actor);workspace(scope);
  const row=this.store.one('SELECT * FROM command_conversations WHERE id=? AND owner_user_id=? AND workspace=?',id,owner,scope);
  if(!row)fail(404,'Conversation not found.','CHAT_NOT_FOUND');
  if(write&&row.status!=='active')fail(409,'Restore this conversation before making changes.','CHAT_ARCHIVED');
  return row;
 }
 create(actor,{workspace:scope,requestKey,title='New conversation'}={}){
  const owner=this.actor(actor);workspace(scope);key(requestKey);title=text(title,100);
  return this.store.transaction(()=>{
   const existing=this.store.one('SELECT * FROM command_conversations WHERE owner_user_id=? AND create_key=?',owner,requestKey);
   if(existing){if(existing.workspace!==scope)fail(409,'Request key belongs to a different workspace.');return existing}
   if(this.store.one('SELECT count(*) n FROM command_conversations WHERE owner_user_id=?',owner).n>=2000)fail(429,'Export and remove old conversations before creating more.');
   const id=uid('chat'),stamp=this.stamp();
   this.store.exec('INSERT INTO command_conversations(id,owner_user_id,workspace,title,created_at,updated_at,create_key) VALUES(?,?,?,?,?,?,?)',id,owner,scope,title,stamp,stamp,requestKey);
   this.store.audit(owner,'command.chat.created','command_conversation',id,{workspace:scope});
   return this.conversation(actor,id,scope);
  });
 }
 list(actor,{workspace:scope,status='active',query='',before='',limit=30}={}){
  const owner=this.actor(actor);workspace(scope);if(!['active','archived'].includes(status))fail(400,'Invalid history filter.');
  if(typeof query!=='string'||query.length>100)fail(400,'Search is too long.');
  const size=positive(limit,30,50),needle=query.trim().replace(/[\\%_]/g,'\\$&'),pattern='%'+needle+'%';
  const rows=this.store.all(`SELECT c.* FROM command_conversations c WHERE c.owner_user_id=? AND c.workspace=? AND c.status=?
   AND (?='' OR c.title LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM command_messages m WHERE m.conversation_id=c.id AND m.content LIKE ? ESCAPE '\\'))
   AND (?='' OR c.updated_at||'|'||c.id<?) ORDER BY c.updated_at DESC,c.id DESC LIMIT ?`,owner,scope,status,needle,pattern,pattern,String(before),String(before),size+1);
  const more=rows.length>size;rows.length=Math.min(rows.length,size);const last=rows.at(-1);
  return {items:rows,nextCursor:more?last.updated_at+'|'+last.id:null};
 }
 update(actor,id,scope,{title,status,version}={}){
  return this.store.transaction(()=>{
   const c=this.conversation(actor,id,scope);if(version!==c.version)fail(409,'This conversation changed in another tab. Reload and retry.','CHAT_CONFLICT');
   if(status!==undefined&&!['active','archived'].includes(status))fail(400,'Invalid conversation state.');
   if(status==='archived'&&this.busy(id))fail(409,'Stop the response or wait for the image job before archiving.');
   const nextTitle=title===undefined?c.title:text(title,100);
   this.store.exec('UPDATE command_conversations SET title=?,status=?,version=version+1,updated_at=? WHERE id=?',nextTitle,status||c.status,this.stamp(),id);
   this.store.audit(actor.id,'command.chat.updated','command_conversation',id,{status:status||c.status});return this.conversation(actor,id,scope);
  });
 }
 busy(id){return !!this.store.one("SELECT id FROM command_messages WHERE conversation_id=? AND status='pending' UNION ALL SELECT id FROM command_action_proposals WHERE conversation_id=? AND status='approved' LIMIT 1",id,id)}
 message(row){return row?{...row,parts:parse(row.parts_json),parts_json:undefined,request_hash:undefined}:null}
 proposal(row){return row?{...row,payload:parse(row.payload_json),result:row.result_json?parse(row.result_json):null,payload_json:undefined,result_json:undefined}:null}
 recover(id=null){
  const cutoff=new Date(this.clock()-180000).toISOString();
  const condition=id?' AND conversation_id=?':'';const args=id?[cutoff,id]:[cutoff];
  this.store.exec("UPDATE command_messages SET status='failed',error_code='INTERRUPTED' WHERE status='pending' AND updated_at<?"+condition,...args);
  this.store.exec("UPDATE command_action_proposals SET status='failed',error_code='IMAGE_UNCONFIRMED' WHERE status='approved' AND approved_at<?"+condition,...args);
  this.store.exec("UPDATE command_action_proposals SET status='expired' WHERE status='proposed' AND expires_at<=?"+(id?' AND conversation_id=?':''),this.stamp(),...(id?[id]:[]));
 }
 data(actor,id,scope,{before=0,limit=40}={}){
  const c=this.conversation(actor,id,scope);this.recover(id);const size=positive(limit,40,100);
  const seq=Number(before)||2147483647;
  if(!Number.isSafeInteger(seq)||seq<=0)fail(400,'Invalid message cursor.');
  const rows=this.store.all('SELECT * FROM command_messages WHERE conversation_id=? AND sequence<? ORDER BY sequence DESC LIMIT ?',id,seq,size+1);
  const more=rows.length>size;rows.length=Math.min(rows.length,size);rows.reverse();
  return {conversation:c,messages:rows.map(row=>this.message(row)),nextBefore:more?rows[0].sequence:null,
   proposals:this.store.all('SELECT * FROM command_action_proposals WHERE conversation_id=? ORDER BY created_at,id',id).map(row=>this.proposal(row)),
   files:this.store.all('SELECT id,conversation_id,message_id,filename,mime_type,size_bytes,generated FROM command_chat_files WHERE conversation_id=?',id)};
 }
 export(actor,id,scope){
  const conversation=this.conversation(actor,id,scope);
  return {version:1,exportedAt:this.stamp(),conversation,messages:this.store.all('SELECT * FROM command_messages WHERE conversation_id=? ORDER BY sequence',id).map(row=>this.message(row)),proposals:this.store.all('SELECT * FROM command_action_proposals WHERE conversation_id=?',id).map(row=>this.proposal(row)),files:this.store.all('SELECT id,filename,mime_type,size_bytes,generated,message_id FROM command_chat_files WHERE conversation_id=?',id)};
 }
 remove(actor,id,scope,{confirm,version}={}){
  return this.store.transaction(()=>{
   const c=this.conversation(actor,id,scope);if(confirm!==true)fail(400,'Confirm deletion explicitly.');
   if(version!==c.version)fail(409,'The conversation changed. Review it again.');if(this.busy(id))fail(409,'Stop pending work before deleting.');
   const files=this.store.all('SELECT storage_key FROM command_chat_files WHERE conversation_id=?',id);
   this.store.exec('DELETE FROM command_conversations WHERE id=?',id);
   this.store.audit(actor.id,'command.chat.deleted','command_conversation',id,{workspace:scope});return files;
  });
 }
 reserve(owner,kind){
  const day=this.stamp().slice(0,10);
  this.store.exec('INSERT OR IGNORE INTO command_chat_usage(owner_user_id,day) VALUES(?,?)',owner,day);
  const used=this.store.one('SELECT * FROM command_chat_usage WHERE owner_user_id=? AND day=?',owner,day),reserved=kind==='chat'?200000:0;
  if(used.requests>=this.maxRequests||used.tokens+reserved>this.maxTokens)fail(429,'Daily Command allowance reached. Your history and queue are still available.','CHAT_LIMIT');
  this.store.exec('UPDATE command_chat_usage SET requests=requests+1,tokens=tokens+? WHERE owner_user_id=? AND day=?',reserved,owner,day);
  return {day,reserved};
 }
 accept(actor,id,scope,{message,requestKey,mode='chat',fields={},fileIds=[]}={}){
  const c=this.conversation(actor,id,scope,true);key(requestKey);message=text(message,6000);
  if(!['chat','queue','signals','capture','image'].includes(mode))fail(400,'Unsupported chat mode.');
  if(!Array.isArray(fileIds)||fileIds.length>3||fileIds.some(v=>typeof v!=='string'))fail(400,'Choose up to three attachments.');
  if(!fields||typeof fields!=='object'||Array.isArray(fields))fail(400,'Invalid capture fields.');
  const digest=hash({message,mode,fields,fileIds});
  return this.store.transaction(()=>{
   const existing=this.store.one("SELECT * FROM command_messages WHERE conversation_id=? AND idempotency_key=?",id,requestKey);
   if(existing){if(existing.request_hash!==digest)fail(409,'Retry key does not match this message.','CHAT_KEY_REUSED');return {...this.turn(actor,id,scope,existing.turn_id),replayed:true}}
   if(this.busy(id))fail(409,'Wait for or stop the current response.','CHAT_BUSY');
   for(const fileId of fileIds){const file=this.file(actor,id,scope,fileId);if(file.message_id)fail(409,'This attachment is already linked to a message.');}
   const n=this.store.one('SELECT COALESCE(MAX(sequence),0) n FROM command_messages WHERE conversation_id=?',id).n;
   if(n>=2000)fail(429,'Start another conversation. This one has reached its message limit.');
   const budget=this.reserve(actor.id,mode),turnId=uid('turn'),userId=uid('msg'),assistantId=uid('msg'),stamp=this.stamp();
   this.store.exec("INSERT INTO command_messages(id,conversation_id,sequence,role,content,status,idempotency_key,created_at,completed_at,turn_id,parts_json,request_hash,updated_at) VALUES(?,?,?,'user',?,'complete',?,?,?,?,?,?,?)",userId,id,n+1,message,requestKey,stamp,stamp,turnId,json({mode,fields,fileIds}),digest,stamp);
   this.store.exec("INSERT INTO command_messages(id,conversation_id,sequence,role,content,status,created_at,turn_id,parts_json,updated_at) VALUES(?,?,?,'assistant','','pending',?,?,?,?)",assistantId,id,n+2,stamp,turnId,json({budget,stage:mode==='image'?'Preparing image brief':'Reviewing your request'}),stamp);
   for(const fileId of fileIds)this.store.exec('UPDATE command_chat_files SET message_id=? WHERE id=?',userId,fileId);
   this.store.exec("UPDATE command_conversations SET title=CASE WHEN title='New conversation' THEN ? ELSE title END,last_message_at=?,updated_at=?,version=version+1 WHERE id=?",message.replace(/\s+/g,' ').slice(0,65),stamp,stamp,id);
   return {...this.turn(actor,id,scope,turnId),replayed:false};
  });
 }
 turn(actor,id,scope,turnId){
  this.conversation(actor,id,scope);
  const rows=this.store.all('SELECT * FROM command_messages WHERE conversation_id=? AND turn_id=? ORDER BY sequence',id,turnId);
  if(rows.length!==2)fail(404,'Message not found.');return {user:this.message(rows[0]),assistant:this.message(rows[1]),turnId};
 }
 retry(actor,id,scope,turnId){
  this.conversation(actor,id,scope,true);
  return this.store.transaction(()=>{
   const turn=this.turn(actor,id,scope,turnId);
   if(turn.assistant.status==='pending'||turn.assistant.status==='complete')return {...turn,replayed:true};
   if(this.busy(id))fail(409,'Another response is running.');
   if(this.store.one('SELECT MAX(sequence) n FROM command_messages WHERE conversation_id=?',id).n!==turn.assistant.sequence)fail(409,'Only the latest interrupted response can be retried. Ask again in a new message.');
   if(turn.assistant.attempt>=3)fail(429,'Retry limit reached. Please send a new message.');
   const budget=this.reserve(actor.id,turn.user.parts.mode);
   this.store.exec("UPDATE command_action_proposals SET status='rejected' WHERE message_id=? AND status='proposed'",turn.assistant.id);
   this.store.exec("UPDATE command_messages SET status='pending',error_code=NULL,attempt=attempt+1,content='',parts_json=?,updated_at=? WHERE id=?",json({budget,stage:'Retrying response'}),this.stamp(),turn.assistant.id);
   return {...this.turn(actor,id,scope,turnId),replayed:false};
  });
 }
 cancel(actor,id,scope,turnId){
  const turn=this.turn(actor,id,scope,turnId);
  this.store.transaction(()=>{
   this.store.exec("UPDATE command_messages SET status='cancelled',completed_at=?,updated_at=? WHERE id=? AND status='pending'",this.stamp(),this.stamp(),turn.assistant.id);
   this.store.exec("UPDATE command_action_proposals SET status='rejected' WHERE message_id=? AND status='proposed'",turn.assistant.id);
  });return this.turn(actor,id,scope,turnId);
 }
 finish(actor,id,scope,turnId,attempt,{content='',parts={},status='complete',code=null,tokens=null}={}){
  this.conversation(actor,id,scope);const turn=this.turn(actor,id,scope,turnId),budget=turn.assistant.parts.budget;
  if(turn.assistant.status!=='pending'||turn.assistant.attempt!==attempt)return false;
  this.store.transaction(()=>{
   this.store.exec('UPDATE command_messages SET content=?,parts_json=?,status=?,error_code=?,completed_at=?,updated_at=? WHERE id=? AND status=\'pending\' AND attempt=?',content.slice(0,20000),json(parts),status,code,this.stamp(),this.stamp(),turn.assistant.id,attempt);
   if(budget?.reserved&&Number.isSafeInteger(tokens)&&tokens>=0)this.store.exec('UPDATE command_chat_usage SET tokens=MAX(0,tokens-?+?) WHERE owner_user_id=? AND day=?',budget.reserved,tokens,actor.id,budget.day);
   this.store.exec('UPDATE command_conversations SET updated_at=?,version=version+1 WHERE id=?',this.stamp(),id);
  });return true;
 }
 event(id,messageId,tool,status){this.store.exec('INSERT INTO command_tool_events VALUES(?,?,?,?,?,?,?)',uid('event'),id,messageId,tool,status,'{}',this.stamp())}
 normalizeCreate(scope,payload){
  if(payload.workspace&&payload.workspace!==scope)fail(403,'A proposal cannot change workspaces.');
  const input={workspace:scope,title:text(payload.title,160),detail:typeof payload.detail==='string'?payload.detail:'',kind:payload.kind||'task',priority:payload.priority||'next',dueAt:payload.dueAt||null,authority:'read',evidenceStatus:'unverified',needsApproval:true};
  if(input.detail.length>1800)fail(400,'Task detail is too long.');return this.queue.validate(input);
 }
 propose(actor,id,scope,{messageId=null,action,payload={},requestKey,targetId=null,targetVersion=null}={}){
  this.conversation(actor,id,scope,true);key(requestKey);
  if(messageId){const m=this.store.one("SELECT * FROM command_messages WHERE id=? AND conversation_id=? AND role='assistant' AND status='pending'",messageId,id);if(!m)fail(409,'This response is no longer active.');}
  if(action==='queue.create')payload=this.normalizeCreate(scope,payload);
  else if(action==='queue.update'){
   const target=this.queue.get(targetId);if(!target||target.workspace!==scope)fail(404,'Queue item not found in this workspace.');
   if(targetVersion!==target.version)fail(409,'Queue item changed. Request a fresh proposal.');
   if(!states.has(payload.state))fail(400,'Invalid state.');payload={state:payload.state,before:target.state,title:target.title};
  }else if(action==='image.generate'){payload={...payload,prompt:text(payload.prompt,2000)}}
  else fail(400,'This action is not executable from Command Chat.');
  return this.store.transaction(()=>{
   const existing=this.store.one('SELECT * FROM command_action_proposals WHERE idempotency_key=?',id+':'+requestKey);
   if(existing){if(existing.action_type!==action||existing.target_id!==targetId||existing.target_version!==targetVersion||existing.payload_json!==json(payload))fail(409,'Proposal request key does not match this action.','CHAT_KEY_REUSED');return this.proposal(existing);}
   if(this.store.one('SELECT count(*) n FROM command_action_proposals WHERE conversation_id=?',id).n>=200)fail(429,'Start another conversation for more proposals.');
   const proposalId=uid('proposal'),stamp=this.stamp();
   this.store.exec("INSERT INTO command_action_proposals(id,conversation_id,message_id,action_type,target_id,target_version,payload_json,idempotency_key,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",proposalId,id,messageId,action,targetId,targetVersion,json(payload),id+':'+requestKey,new Date(this.clock()+15*60000).toISOString(),stamp);
   this.store.audit(actor.id,'command.chat.proposed','command_proposal',proposalId,{workspace:scope,action});return this.proposal(this.store.one('SELECT * FROM command_action_proposals WHERE id=?',proposalId));
  });
 }
 getProposal(actor,id,scope,proposalId){
  this.conversation(actor,id,scope);this.recover(id);
  const row=this.store.one('SELECT * FROM command_action_proposals WHERE id=? AND conversation_id=?',proposalId,id);
  if(!row)fail(404,'Proposal not found.');return this.proposal(row);
 }
 decide(actor,id,scope,proposalId,{confirm,version,reject=false}={}){
  this.conversation(actor,id,scope,true);
  return this.store.transaction(()=>{
   const p=this.getProposal(actor,id,scope,proposalId);
   if(['executed','approved'].includes(p.status))return p;
   if(reject&&p.status==='rejected')return p;
   if(confirm!==true)fail(400,'Explicit confirmation is required.');
   if(p.status!=='proposed')fail(409,'This proposal is no longer actionable.');if(version!==p.version)fail(409,'Proposal changed. Review it again.');
   if(reject){this.store.exec("UPDATE command_action_proposals SET status='rejected',version=version+1 WHERE id=?",proposalId);return this.getProposal(actor,id,scope,proposalId)}
   if(p.action_type==='image.generate')fail(400,'Use the image approval flow.');
   let result;
   if(p.action_type==='queue.create')result=this.queue.create({...p.payload,workspace:scope},actor.id);
   else{
    const item=this.queue.get(p.target_id);if(!item||item.workspace!==scope)fail(404,'Queue item not found.');
    if(item.version!==p.target_version)fail(409,'The queue item changed. Request a new proposal.','STALE_PROPOSAL');
    result=this.queue.update(item.id,{state:p.payload.state,version:p.target_version},actor.id);
   }
   this.store.exec("UPDATE command_action_proposals SET status='executed',approved_at=?,executed_at=?,result_json=?,version=version+1 WHERE id=?",this.stamp(),this.stamp(),json({id:result.id,title:result.title,state:result.state,version:result.version}),proposalId);
   this.store.audit(actor.id,'command.chat.executed','command_proposal',proposalId,{workspace:scope,action:p.action_type,targetId:result.id});return this.getProposal(actor,id,scope,proposalId);
  });
 }
 editProposal(actor,id,scope,proposalId,{version,payload}={}){
  this.conversation(actor,id,scope,true);return this.store.transaction(()=>{
   const p=this.getProposal(actor,id,scope,proposalId);if(p.status!=='proposed'||version!==p.version)fail(409,'Proposal changed or expired.');
   if(p.action_type==='queue.create')payload=this.normalizeCreate(scope,payload||{});
   else if(p.action_type==='image.generate')payload={...p.payload,prompt:text(payload?.prompt,2000)};
   else fail(400,'Request a new status proposal instead.');
   this.store.exec('UPDATE command_action_proposals SET payload_json=?,version=version+1 WHERE id=?',json(payload),proposalId);return this.getProposal(actor,id,scope,proposalId);
  });
 }
 file(actor,id,scope,fileId){this.conversation(actor,id,scope);const file=this.store.one('SELECT * FROM command_chat_files WHERE id=? AND conversation_id=?',fileId,id);if(!file)fail(404,'File not found.');return file}
}
