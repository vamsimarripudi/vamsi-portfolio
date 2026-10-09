import crypto from 'node:crypto';
import {httpError} from './domain.mjs';

const fail=()=>httpError(401,'Resend webhook could not be authenticated.','INVALID_WEBHOOK_SIGNATURE');

/** Verify signed Resend/Svix raw bytes. Do not parse and reserialize before HMAC. */
export function verifyResendWebhook(payload,headers={},secret='',clock=()=>Date.now()){
 const id=String(headers['svix-id']||'');
 const stamp=String(headers['svix-timestamp']||'');
 const supplied=String(headers['svix-signature']||'');
 if(!/^whsec_[A-Za-z0-9+/=_-]{20,}$/.test(secret)||!/^msg_[A-Za-z0-9_-]{6,120}$/.test(id)||
    !/^\d{10,12}$/.test(stamp)||!supplied)throw fail();
 const seconds=Number(stamp);
 if(!Number.isSafeInteger(seconds)||Math.abs(clock()-seconds*1000)>5*60*1000)throw fail();
 const key=Buffer.from(secret.slice(6).replaceAll('-','+').replaceAll('_','/'),'base64');
 if(key.length<20)throw fail();
 const raw=Buffer.isBuffer(payload)?payload:Buffer.from(payload||'');
 if(raw.length<2||raw.length>65536)throw fail();
 const signed=Buffer.concat([Buffer.from(id+'.'+stamp+'.'),raw]);
 const expected=crypto.createHmac('sha256',key).update(signed).digest();
 const matches=supplied.split(/\s+/).some(value=>{
  if(!value.startsWith('v1,'))return false;
  let signature;
  try{signature=Buffer.from(value.slice(3),'base64')}catch{return false}
  return signature.length===expected.length&&crypto.timingSafeEqual(signature,expected);
 });
 if(!matches)throw fail();
 let data;try{data=JSON.parse(raw.toString('utf8'))}catch{throw httpError(400,'Malformed provider event.','INVALID_WEBHOOK_PAYLOAD')}
 if(!data||typeof data!=='object'||Array.isArray(data))throw httpError(400,'Malformed provider event.','INVALID_WEBHOOK_PAYLOAD');
 const supported=new Set(['email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained']);
 if(!supported.has(data.type))return {id,type:null,emailId:null,ignored:true};
 const emailId=String(data.data?.email_id||'');
 if(!/^[A-Za-z0-9_-]{8,128}$/.test(emailId))throw httpError(400,'Missing provider message identifier.','INVALID_WEBHOOK_PAYLOAD');
 return {id,type:data.type,emailId,ignored:false};
}
