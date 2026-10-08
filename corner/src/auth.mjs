import crypto from 'node:crypto';
import { secureEqual } from './domain.mjs';
export function passwordHash(password){
  if(typeof password!=='string'||password.length<12)throw Error('Minimum 12 characters');
  const salt=crypto.randomBytes(24).toString('base64url');
  const derived=crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1}).toString('base64url');
  return `scrypt$16384$${salt}$${derived}`;
}
export function passwordVerify(password,encoded){
  if(typeof encoded!=='string'||!encoded.startsWith('scrypt$'))return false;
  const parts=encoded.split('$');if(parts.length!==4||parts[1]!=='16384')return false;
  try{const actual=crypto.scryptSync(password,parts[2],64,{N:16384,r:8,p:1}).toString('base64url');return secureEqual(parts[3],actual)}catch{return false}
}
export const freshToken=()=>crypto.randomBytes(32).toString('base64url');
