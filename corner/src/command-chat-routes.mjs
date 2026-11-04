import fs from 'node:fs';
import path from 'node:path';
import {httpError} from './domain.mjs';

export function commandChatRoutes({service,enabled,readJSON,readBody,ok,limit}){
 return async(req,res,pathname,url,actor)=>{
  const prefix='/api/admin/command/',sub=pathname.slice(prefix.length),method=req.method;
  if(!pathname.startsWith(prefix)||!(/^(capabilities|consent|transcribe|conversations|search)(\/|$)/.test(sub)))return false;
  if(!enabled)throw httpError(404,'Command Chat is disabled.','FEATURE_DISABLED');
  service.data.actor(actor);
  if(!['GET','POST','PATCH','DELETE'].includes(method))throw httpError(405,'Method not allowed.');
  limit(req,'command-chat-'+(method==='GET'?'read':'write'),method==='GET'?240:90,60);
  const scope=url.searchParams.get('workspace');
  if(sub==='capabilities'&&method==='GET'){ok(res,service.capabilities(actor));return true}
  if(sub==='consent'&&method==='POST'){ok(res,service.setConsent(actor,(await readJSON(req,200)).accepted));return true}
  if(sub==='transcribe'&&method==='POST'){
   limit(req,'command-voice',20,60);const mime=(req.headers['content-type']||'').split(';')[0],filename=url.searchParams.get('name')||'voice-command';
   ok(res,await service.transcribe(actor,scope,{bytes:await readBody(req,8*1024*1024),mime,filename}));return true;
  }
  if((sub==='conversations'||sub==='search')&&method==='GET'){
   ok(res,service.data.list(actor,{workspace:scope,status:url.searchParams.get('status')||'active',query:url.searchParams.get('q')||'',before:url.searchParams.get('before')||'',limit:url.searchParams.get('limit')||30}));return true;
  }
  if(sub==='conversations'&&method==='POST'){ok(res,service.data.create(actor,await readJSON(req,2000)));return true}
  const match=sub.match(/^conversations\/(chat_[a-z0-9-]+)(?:\/(messages|turns|proposals|files|export))?(?:\/([a-z0-9_-]+))?(?:\/(retry|cancel|approve|reject))?$/i);
  if(!match)throw httpError(404,'Unknown Command Chat route.');
  const [,id,resource,recordId,action]=match;
  service.data.conversation(actor,id,scope);
  if(!resource){
   if(method==='GET')ok(res,service.data.data(actor,id,scope,{before:url.searchParams.get('before'),limit:url.searchParams.get('limit')}));
   else if(method==='PATCH')ok(res,service.data.update(actor,id,scope,await readJSON(req,2000)));
   else if(method==='DELETE')ok(res,service.remove(actor,id,scope,await readJSON(req,1000)));
   else throw httpError(405,'Method not allowed.');return true;
  }
  if(resource==='export'&&method==='GET'){ok(res,service.data.export(actor,id,scope));return true}
  if(resource==='messages'&&!recordId){
   if(method==='GET')ok(res,service.data.data(actor,id,scope,{before:url.searchParams.get('before'),limit:url.searchParams.get('limit')}));
   else if(method==='POST')ok(res,service.send(actor,id,scope,await readJSON(req,32000)));
   else throw httpError(405,'Method not allowed.');return true;
  }
  if(resource==='turns'&&recordId&&method==='POST'){
   if(action==='retry')ok(res,service.retry(actor,id,scope,recordId));
   else if(action==='cancel')ok(res,service.cancel(actor,id,scope,recordId));
   else throw httpError(404,'Unknown turn action.');return true;
  }
  if(resource==='proposals'){
   if(!recordId&&method==='POST'){const body=await readJSON(req,7000);ok(res,body.action==='image.generate'?service.imageProposal(actor,id,scope,body.payload?.prompt,null,body.requestKey):service.data.propose(actor,id,scope,body));}
   else if(recordId&&method==='PATCH'&&!action)ok(res,service.data.editProposal(actor,id,scope,recordId,await readJSON(req,7000)));
   else if(recordId&&method==='POST'&&['approve','reject'].includes(action)){
    const p=service.data.getProposal(actor,id,scope,recordId),body=await readJSON(req,1000);
    ok(res,p.action_type==='image.generate'&&action==='approve'?service.approveImage(actor,id,scope,recordId,body):service.data.decide(actor,id,scope,recordId,{...body,reject:action==='reject'}));
   }else throw httpError(405,'Method not allowed.');return true;
  }
  if(resource==='files'){
   if(!recordId&&method==='POST'){
    const mime=(req.headers['content-type']||'').split(';')[0],filename=url.searchParams.get('name')||'Attachment';
    ok(res,await service.upload(actor,id,scope,{bytes:await readBody(req,8*1024*1024),mime,filename}));
   }else if(recordId&&method==='DELETE')ok(res,service.removeFile(actor,id,scope,recordId));
   else if(recordId&&method==='GET'){
    const file=service.data.file(actor,id,scope,recordId),bytes=fs.readFileSync(path.join(service.privateDir,file.storage_key));
    res.writeHead(200,{'content-type':file.mime_type,'content-length':bytes.length,'cache-control':'private,no-store','x-content-type-options':'nosniff',...(url.searchParams.get('download')==='1'?{'content-disposition':'attachment; filename="'+file.filename.replace(/[^a-zA-Z0-9._-]/g,'_')+'"'}:{})});res.end(bytes);
   }else throw httpError(405,'Method not allowed.');return true;
  }
  throw httpError(404,'Unknown Command Chat route.');
 };
}
