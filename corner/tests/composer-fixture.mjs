/** Disposable local Studio data. Uses normal authentication; never connects to production. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {passwordHash} from '../src/auth.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function startComposerFixture({port=0,host='127.0.0.1',seed=false,chat=false,mockChat=false}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'corner-studio-fixture-'));
 const email='studio-owner@fixture.test';
 const password='Corner-Local-Review-20261104!';
 const env={...process.env,NODE_ENV:'test',HOST:host,PORT:String(port),DATA_DIR:directory,
  DB_PATH:path.join(directory,'corner.sqlite'),SITE_URL:`http://127.0.0.1:${port||4141}/corner`,CORNER_BASE_PATH:'/corner',
  SITE_TIMEZONE:'Asia/Kolkata',ADMIN_EMAIL:email,ADMIN_PASSWORD_HASH:passwordHash(password),SESSION_SECRET:crypto.randomBytes(48).toString('hex'),
  DEMO_CONTENT:'0',CORNER_COMMAND_CHAT:chat?'1':'0',CORNER_COMMAND_AI:'0',OPENAI_API_KEY:'',CORNER_BACKUP_ENABLED:'0',
  CORNER_COMPANION_ENABLED:'0',CORNER_AUTH_REGISTRATION_ENABLED:'0',CORNER_AUTH_TEST_OUTBOX:path.join(directory,'mail.outbox'),
  CORNER_AUTH_RESEND_API_KEY:'',CORNER_AUTH_FROM_EMAIL:'',CORNER_COMMUNICATIONS_ENABLED:'0',
  CORNER_V3_WISH_DELIVERY:'0',CORNER¶»§q«^