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
  this.imageEnabled=imageEnabled&&imageModel==='gpt-im¶»§q«^