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
 const service=new CommandC¶»§q«^