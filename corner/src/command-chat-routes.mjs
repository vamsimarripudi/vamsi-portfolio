import fs from 'node:fs';
import path from 'node:path';
import {httpError} from './domain.mjs';

export function commandChatRoutes({service,enabled,readJSON,readBody,ok,limit}){
 return async(req,res,pathname,url,actor)=>{
  const prefix='/api/admin/command/',sub=pathname.slice(prefix.length),method=req.method;
  if(!pathname.startsWith(prefix)||!(/^(capabilities|consent|conversations|search)(\/|$)/.test(sub)))return false;
  if(!enabled)throw httpError(404,'Command Chat is disabled.','FEATURE_DISABLED');
  service.data.actor(actor);
  if(!['GET','POST','PATCH','DELETE'].includes(method))throw httpError(405,'Method not allowed.');
  limit(req,'command-chat-'+(method==='GET'?'read':'write'),method==='GET'?240:90,60);
  const scope=url.searchParams.get('workspace');
  if(sub==='capabilities'&&method==='GET'){ok(res,service.capabilities(actor));return true}
  if(sub==='consent'&&method==='POST'){ok(res,service.setConsent(actor,(await readJSON(req,200)).accepted));return true}
  if((sub==='conversations'||sub==='search')&&method==='GET'){
   ok(res,service.data.list(actor,{workspace:scope,status:url.searchParams.get('status')||'active',query:url.searchParams.get('q')||'',before:url.searchParams.get('before')||'',limit:url.searchParams.get('limit')||30}));return true;
  }
  if(sub==='conversations'&&method==='POST'){ok(res,service.data.create(actor,await readJSON(req,2000)));return true}
  const match=sub.match(/^conversations\/(chat_[a-z0-9-]+)(?:\/(messages|turns|proposals|files¶»§q«^