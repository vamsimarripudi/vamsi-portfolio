import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {verifyResendWebhook} from '../src/v3-resend-webhook.mjs';
const key=crypto.randomBytes(32);
const secret='whsec_'+key.toString('base64');
const clock=()=>1770400000000;
const stamp=String(Math.floor(clock()/1000));
const sign=(id,body)=>{
 const signature=crypto.createHmac('sha256',key).update(id+'.'+stamp+'.'+body).digest('base64');
 return {'svix-id':id,'svix-timestamp':stamp,'svix-signature':'v1,'+signature};
};
test('Resend signature rejects unsigned, forged, stale and malformed payloads',()=>{
 const id='msg_replay_test_12345',body=Buffer.from(JSON.stringify({type:'email.delivered',data:{email_id:'provider_123456'}}));
 assert.deepEqual(verifyResendWebhook(body,sign(id,body),secret,clock),{id,type:'email.delivered',emailId:'provider_123456',ignored:false});
 assert.throws(()=>verifyResendWebhook(Buffer.from('tampered'),sign(id,body),secret,clock),{code:'INVALID_WEBHOOK_SIGNATURE'});
 assert.throws(()=>verifyResendWebhook(body,{},secret,clock),{code:'INVALID_WEBHOOK_SIGNATURE'});
 assert.throws(()=>verifyResendWebhook(body,sign(id,body),secret,()=>clock()+600000),{code:'INVALID_WEBHOOK_SIGNATURE'});
 const ignored=Buffer.from(JSON.stringify({type:'email.opened',data:{email_id:'provider_123456'}}));
 assert.equal(verifyResendWebhook(ignored,sign('msg_open_test_12345',ignored),secret,clock).ignored,true);
});
