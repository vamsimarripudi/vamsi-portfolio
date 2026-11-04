import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {httpError,uid} from './domain.mjs';
import {CommandChatStore,workspace} from './command-chat-store.mjs';
import {CommandChatAgent} from './command-chat-agent.mjs';

const imageIntent=s=>/\b(generate|create|make|draw|render|design)\b[\s\S]{0,120}\b(image|picture|illustration|poster|artwork|photo)\b/i.test(s);
const itemView=item=>({id:item.id,title:item.title,detail:item.detail.slice(0,600),project:item.project,workspace:item.workspace,kind:item.kind,priority:item.priority,state:item.state,version:item.version,evidenceStatus:item.evidenceStatus,sourceRef:item.sourceRef,dueAt:item.dueAt});
const safeError=error=>error.name==='TimeoutError'?'The request timed out. Your message is saved.':error.code==='COMMAND_AI_DISABLED'?'AI is not connected. Queue and capture tools still work.':error.status&&error.status<500?error.message:'The response could not finish. Your message is saved; retry when ready.';
export class CommandChatService {
 constructor({store,queue,agent,uploads,clock,maxRequests,maxTokens,imageEnabled=true,imageModel='gpt-image-1.5'}={}){
  this.store=store;this.queue=queue;this.agent=agent;this.ai=new CommandChatAgent(agent);
  this.data=new CommandChatStore(store,queue,{clock,maxRequests,maxTokens});this.running=new Map();
  this.privateDir=path.join(path.dirname(uploads),'command-private');
  this.imageEnabled=imageEnabled&&imageModel==='gpt-image-1.5';this.imageModel=imageModel;
  // Reserve a conservative allowance, not a claim about the final provider invoice.
  this.imageAllowanceUsd=0.10;
 }
 consent(actor){return this.store.setting('command.chat.consent:'+this.data.actor(actor),false)===true}
 setConsent(actor,accepted){if(typeof accepted!=='boolean')throw httpError(400,'Choose whether to use AI.');this.store.saveSetting('command.chat.consent:'+this.data.actor(actor),accepted);if(!accepted)for(const controller of this.running.values())if(controller.ownerId===actor.id)controller.abort();return {accepted}}
 capabilities(actor){this.data.actor(actor);return {enabled:true,aiReady:this.ai.ready(),aiConsent:this.consent(actor),model:this.agent.model,imageReady:this.imageEnabled&&this.ai.ready(),imageModel:this.imageModel,imageAllowanceUsd:this.imageAllowanceUsd,attachmentTypes:['image/png','image/jpeg','image/webp','text/plain','text/markdown'],retention:'Conversations are retained until you delete them. Archived conversations are not deleted. Provider requests use store:false; provider abuse-monitoring retention may still apply.'}}
 queueItems(actor,scope){this.data.actor(actor);workspace(scope);return this.queue.list({workspace:scope}).map(itemView)}
 signals(actor,scope){
  const items=this.queueItems(actor,scope).filter(i=>['open','waiting'].includes(i.state));
  return [
   {label:'Now',items:items.filter(i=>i.priority==='now')},
   {label:'Past due',items:items.filter(i=>i.dueAt&&Date.parse(i.dueAt)<this.data.clock())},
   {label:'Evidence gaps',items:items.filter(i=>['unverified','blocked'].includes(i.evidenceStatus))},
   {label:'Decisions',items:items.filter(i=>i.kind==='decision')}
  ].filter(group=>group.items.length).map(g=>({...g,items:g.items.slice(0,8)}));
 }
 send(actor,id,scope,payload){
  if((payload.mode||'chat')==='chat'&&!this.consent(actor))throw httpError(403,'Review the AI privacy notice before sending.','AI_CONSENT_REQUIRED');
  if((payload.mode==='image'||imageIntent(payload.message||''))&&payload.fileIds?.length)throw httpError(400,'Image mode creates a new image from text. Remove attachments first; reference-image editing is not available.');
  const turn=this.data.accept(actor,id,scope,payload);if(!turn.replayed)this.launch(actor,id,scope,turn);return turn;
 }
 retry(actor,id,scope,turnId){const original=this.data.turn(actor,id,scope,turnId);if(original.user.parts.mode==='chat'&&!this.consent(actor))throw httpError(403,'AI consent is required.');const turn=this.data.retry(actor,id,scope,turnId);if(!turn.replayed)this.launch(actor,id,scope,turn);return turn}
 cancel(actor,id,scope,turnId){const result=this.data.cancel(actor,id,scope,turnId);this.running.get(turnId)?.abort();return result}
 imageProposal(actor,id,scope,prompt,messageId,requestKey){
  return this.data.propose(actor,id,scope,{messageId,requestKey,action:'image.generate',payload:{prompt,provider:'OpenAI',model:this.imageModel,size:'1024x1024',quality:'medium',allowanceUsd:this.imageAllowanceUsd,destination:'Private conversation only',available:this.imageEnabled&&this.ai.ready()}});
 }
 launch(actor,id,scope,turn){
  const controller=new AbortController();controller.ownerId=actor.id;this.running.set(turn.turnId,controller);
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]);
  const attempt=turn.assistant.attempt;
  void (async()=>{
   const user=turn.user,parts={};let content='',tokens=0;
   const requestKey='proposal_'+turn.turnId+'_'+attempt;
   if(user.parts.mode==='queue'){
    parts.items=this.queueItems(actor,scope);content=parts.items.length?'Here is the recorded queue for this workspace. Open a status action to review a change.':'Your queue is clear. There are no recorded items in this workspace.';
   }else if(user.parts.mode==='signals'){
    parts.signals=this.signals(actor,scope);content=parts.signals.length?'These signals come from your recorded queue.':'No active attention signals are recorded in this workspace.';
   }else if(user.parts.mode==='capture'){
    const p=this.data.propose(actor,id,scope,{messageId:turn.assistant.id,action:'queue.create',requestKey,payload:{...user.parts.fields,title:user.parts.fields.title||user.content}});
    parts.proposalIds=[p.id];content='Review this item, then confirm to add it to your queue. A due date does not schedule a notification.';
   }else if(user.parts.mode==='image'||imageIntent(user.content)){
    const p=this.imageProposal(actor,id,scope,user.content.slice(0,2000),turn.assistant.id,requestKey);
    parts.proposalIds=[p.id];content='Review the image brief and generation allowance below. Nothing has been generated or published.';
   }else{
    const history=this.store.all("SELECT role,content FROM command_messages WHERE conversation_id=? AND sequence<=? AND role IN ('user','assistant') AND status='complete' ORDER BY sequence DESC LIMIT 12",id,user.sequence).reverse();
    const attachments=[];
    for(const fileId of user.parts.fileIds||[]){
     const file=this.data.file(actor,id,scope,fileId),bytes=fs.readFileSync(path.join(this.privateDir,file.storage_key));
     attachments.push(file.mime_type.startsWith('image/')?{type:'input_image',image_url:'data:'+file.mime_type+';base64,'+bytes.toString('base64'),detail:'low'}:{type:'input_text',text:'UNTRUSTED ATTACHMENT '+file.filename+'\n'+bytes.toString('utf8').slice(0,12000)});
    }
    let proposed=0;
    const result=await this.ai.respond({workspace:scope,history,attachments,signal,execute:async(name,args,callId)=>{
     signal.throwIfAborted();this.data.conversation(actor,id,scope,true);
     this.store.exec("UPDATE command_messages SET parts_json=?,updated_at=? WHERE id=? AND status='pending' AND attempt=?",JSON.stringify({...turn.assistant.parts,stage:name==='queue_list'?'Reading your queue':name==='signals_list'?'Reviewing recorded signals':'Preparing an approval'}),this.data.stamp(),turn.assistant.id,attempt);
     let value;
     if(name==='queue_list')value={items:this.queueItems(actor,scope)};
     else if(name==='signals_list')value={signals:this.signals(actor,scope)};
     else{
      if(++proposed>3)throw httpError(429,'Review the current proposals before adding more.');
      const p=this.data.propose(actor,id,scope,{messageId:turn.assistant.id,action:name==='propose_queue_create'?'queue.create':'queue.update',payload:args,targetId:args.targetId||null,targetVersion:args.version??null,requestKey:'tool_'+crypto.createHash('sha256').update(turn.turnId+':'+attempt+':'+callId).digest('hex')});
      (parts.proposalIds||=[]).push(p.id);value={proposalId:p.id,status:'proposed',requiresOwnerConfirmation:true};
     }
     this.data.event(id,turn.assistant.id,name,'complete');return value;
    }});
    content=result.content;tokens=result.tokens;
   }
   signal.throwIfAborted();this.data.finish(actor,id,scope,turn.turnId,attempt,{content,parts,tokens});
  })().catch(error=>{
   try{this.data.finish(actor,id,scope,turn.turnId,attempt,{status:controller.signal.aborted?'cancelled':'failed',code:error.code||'CHAT_FAILED',content:safeError(error)});}catch{/* Conversation may have been removed or the owner disabled. */}
  }).finally(()=>{if(this.running.get(turn.turnId)===controller)this.running.delete(turn.turnId)});
 }
 async upload(actor,id,scope,{bytes,mime,filename,generated=false,messageId=null}){
  this.data.conversation(actor,id,scope,true);
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>8*1024*1024)throw httpError(413,'Choose a non-empty file up to 8 MB.');
  if(!['image/png','image/jpeg','image/webp','text/plain','text/markdown'].includes(mime))throw httpError(415,'Supported files: PNG, JPEG, WebP, TXT and Markdown.');
  if(this.store.one('SELECT count(*) n FROM command_chat_files WHERE conversation_id=?',id).n>=30)throw httpError(429,'This conversation has reached its file limit.');
  const total=this.store.one('SELECT COALESCE(SUM(size_bytes),0) n FROM command_chat_files').n;
  if(total+bytes.length>256*1024*1024)throw httpError(429,'Private file storage is full. Delete unused conversations before uploading.');
  if(mime.startsWith('image/')){
   try{const image=sharp(bytes,{limitInputPixels:24000000,animated:false});const meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format))throw Error();bytes=await image.rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).png().toBuffer();mime='image/png'}catch{throw httpError(400,'This image could not be safely decoded.')}
  }else{if(bytes.length>100000||bytes.includes(0))throw httpError(413,'Use a UTF-8 text file up to 100 KB.');try{new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw httpError(400,'The text file must be UTF-8.')}}
  this.data.conversation(actor,id,scope,true);
  if(bytes.length>8*1024*1024)throw httpError(413,'The decoded file is too large.');
  const latest=this.store.one('SELECT COALESCE(SUM(size_bytes),0) n FROM command_chat_files').n;
  if(latest+bytes.length>256*1024*1024||this.store.one('SELECT count(*) n FROM command_chat_files WHERE conversation_id=?',id).n>=30)throw httpError(429,'Private file storage limit reached.');
  const fileId=uid('file'),storageKey=crypto.randomBytes(24).toString('hex')+(mime.startsWith('image/')?'.png':'.txt');
  fs.mkdirSync(this.privateDir,{recursive:true,mode:0o700});fs.writeFileSync(path.join(this.privateDir,storageKey),bytes,{mode:0o600,flag:'wx'});
  try{this.store.exec('INSERT INTO command_chat_files VALUES(?,?,?,?,?,?,?,?,?)',fileId,id,messageId,storageKey,String(filename||'Attachment').replace(/[\r\n/\\]/g,'_').slice(0,100),mime,bytes.length,generated?1:0,this.data.stamp());}
  catch(error){fs.rmSync(path.join(this.privateDir,storageKey),{force:true});throw error}
  const file=this.data.file(actor,id,scope,fileId);return {...file,storage_key:undefined};
 }
 removeFile(actor,id,scope,fileId){const file=this.data.file(actor,id,scope,fileId);if(file.message_id)throw httpError(409,'Delete the conversation to remove a sent attachment.');this.store.exec('DELETE FROM command_chat_files WHERE id=?',fileId);fs.rmSync(path.join(this.privateDir,file.storage_key),{force:true});return {removed:true}}
 remove(actor,id,scope,payload){for(const file of this.data.remove(actor,id,scope,payload))fs.rmSync(path.join(this.privateDir,file.storage_key),{force:true});return {removed:true}}
 approveImage(actor,id,scope,proposalId,{confirm,version}={}){
  this.data.conversation(actor,id,scope,true);
  if(!this.consent(actor))throw httpError(403,'Review the AI privacy notice first.','AI_CONSENT_REQUIRED');
  if(!this.imageEnabled||!this.ai.ready())throw httpError(503,'Image generation is not connected. The brief is saved.','IMAGE_DISABLED');
  let launch=false;
  const proposal=this.store.transaction(()=>{
   const p=this.data.getProposal(actor,id,scope,proposalId);
   if(p.action_type!=='image.generate')throw httpError(400,'Not an image proposal.');
   if(['approved','executed'].includes(p.status))return p;
   if(confirm!==true||version!==p.version||p.status!=='proposed')throw httpError(409,'Review this image proposal again before confirming.');
   if(p.payload.model!==this.imageModel||p.payload.allowanceUsd!==this.imageAllowanceUsd)throw httpError(409,'Generation settings changed. Request a new brief.');
   const day=this.data.stamp().slice(0,10);
   this.store.exec('INSERT OR IGNORE INTO command_chat_usage(owner_user_id,day) VALUES(?,?)',actor.id,day);
   const usage=this.store.one('SELECT * FROM command_chat_usage WHERE owner_user_id=? AND day=?',actor.id,day);
   if(usage.image_count>=5||usage.image_reserved_usd+this.imageAllowanceUsd>0.501)throw httpError(429,'Daily image allowance reached (five images / $0.50 reserved).');
   if(this.store.one("SELECT id FROM command_action_proposals WHERE conversation_id=? AND status='approved'",id))throw httpError(409,'An image is already being prepared.');
   this.store.exec('UPDATE command_chat_usage SET image_count=image_count+1,image_reserved_usd=image_reserved_usd+? WHERE owner_user_id=? AND day=?',this.imageAllowanceUsd,actor.id,day);
   this.store.exec("UPDATE command_action_proposals SET status='approved',approved_at=?,version=version+1 WHERE id=?",this.data.stamp(),proposalId);
   this.store.audit(actor.id,'command.image.approved','command_proposal',proposalId,{workspace:scope,model:this.imageModel,allowanceUsd:this.imageAllowanceUsd});launch=true;return this.data.getProposal(actor,id,scope,proposalId);
  });
  if(launch)void this.generate(actor,id,scope,proposal).catch(()=>{});
  return proposal;
 }
 async generate(actor,id,scope,p){
  try{
   const response=await this.agent.fetch('https://api.openai.com/v1/images/generations',{method:'POST',signal:AbortSignal.timeout(150000),headers:{'content-type':'application/json',authorization:'Bearer '+this.agent.apiKey},body:JSON.stringify({model:this.imageModel,prompt:p.payload.prompt,n:1,size:'1024x1024',quality:'medium',output_format:'png'})});
   const body=await response.json().catch(()=>({}));
   if(!response.ok||!body.data?.[0]?.b64_json)throw httpError(502,'Image generation did not return a usable image.');
   const current=this.data.getProposal(actor,id,scope,p.id);if(current.status!=='approved')return;
   const file=await this.upload(actor,id,scope,{bytes:Buffer.from(body.data[0].b64_json,'base64'),mime:'image/png',filename:'command-generated-image.png',generated:true,messageId:p.message_id});
   this.store.exec("UPDATE command_action_proposals SET status='executed',executed_at=?,result_json=?,version=version+1 WHERE id=? AND status='approved'",this.data.stamp(),JSON.stringify({fileId:file.id}),p.id);
   this.store.audit(actor.id,'command.image.generated','command_proposal',p.id,{fileId:file.id,workspace:scope});
  }catch{
   this.store.exec("UPDATE command_action_proposals SET status='failed',error_code='IMAGE_UNCONFIRMED',version=version+1 WHERE id=? AND status='approved'",p.id);
  }
 }
}
