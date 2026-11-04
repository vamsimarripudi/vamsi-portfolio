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
   const columns={command_conversations:{version:'INTEGER NOT NULL DEFAULT 1',create_key:'TEXT'},command_messages:{turn_id:'TEXT',parts_json:"TEXT NOT NULL DEFAULT '{}'¶»§q«^