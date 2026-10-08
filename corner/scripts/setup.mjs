import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { ROOT } from '../src/config.mjs';
import { passwordHash } from '../src/auth.mjs';

const file=path.join(ROOT,'.env.local');
const template=path.join(ROOT,'.env.example');
const args=process.argv.slice(2);
const flag=(name)=>args.indexOf(name);
const emailArg=flag('--email');
const requestedEmail=emailArg>=0?args[emailArg+1]:'';
if(emailArg>=0&&!requestedEmail)throw Error('Usage: npm run setup -- --email you@example.com');
const existing=fs.existsSync(file)?fs.readFileSync(file,'utf8'):fs.readFileSync(template,'utf8');
const settings=new Map();
for(const raw of existing.split(/\r?\n/)){
 const m=raw.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);if(!m)continue;
 const value=m[2].trim();settings.set(m[1],value.startsWith('"')&&value.endsWith('"')?value.slice(1,-1):value);
}
let email=requestedEmail||settings.get('ADMIN_EMAIL')||'';
if((!email||email==='owner@example.com')&&process.stdin.isTTY){const rl=readline.createInterface({input:process.stdin,output:process.stdout});email=(await rl.question('Owner email address: ')).trim();rl.close()}
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email==='owner@example.com')throw Error('Set an actual owner email using --email (no placeholder accounts).');
const replacePassword=args.includes('--rotate-password')||!settings.get('ADMIN_PASSWORD_HASH');
let password=process.env.CORNER_ADMIN_PASSWORD;
if(replacePassword&&!password){
 if(!process.stdin.isTTY)throw Error('Set CORNER_ADMIN_PASSWORD in the local environment for unattended setup. Do not put it in the command history.');
 process.stdout.write('Enter a unique 16+ character owner password (typing hidden): ');
 password=await new Promise((resolve,reject)=>{
  const input=process.stdin;let content='';input.setRawMode?.(true);input.resume();input.setEncoding('utf8');
  function onData(key){if(key==='\r'||key==='\n'){input.setRawMode?.(false);input.off('data',onData);input.pause();process.stdout.write('\n');resolve(content)}
    else if(key==='\u0003'){input.setRawMode?.(false);input.off('data',onData);reject(Error('Setup interrupted'))}
    else if(key==='\u007f'){content=content.slice(0,-1)}else if(key>=' '){content+=key}}
  input.on('data',onData);
 });
}
if(replacePassword){if(password.length<16||Buffer.byteLength(password,'utf8')>512)throw Error('Use a strong owner password of 16–512 UTF-8 bytes');settings.set('ADMIN_PASSWORD_HASH',passwordHash(password));}
settings.set('ADMIN_EMAIL',email.toLowerCase());
if(!settings.get('SESSION_SECRET'))settings.set('SESSION_SECRET',crypto.randomBytes(48).toString('base64url'));
settings.set('DEMO_CONTENT','0');
settings.set('SITE_TIMEZONE',settings.get('SITE_TIMEZONE')||'Asia/Kolkata');
const rendered=existing.split(/\r?\n/).map(line=>{const m=line.match(/^([A-Z_][A-Z0-9_]*)=/);return m&&settings.has(m[1])?m[1]+'='+settings.get(m[1]):line});
for(const [k,v] of settings)if(!rendered.some(line=>line.startsWith(k+'=')))rendered.push(k+'='+v);
fs.writeFileSync(file,rendered.join('\n').replace(/\n*$/,'\n'),{mode:0o600});
fs.chmodSync(file,0o600);
console.log('Setup complete: owner '+email.toLowerCase()+'; local secrets saved in .env.local (0600). Never commit or share this file.');
