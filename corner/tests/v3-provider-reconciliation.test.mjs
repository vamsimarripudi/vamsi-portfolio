import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {WishesStudio} from '../src/v3-wishes.mjs';
import {WishDelivery} from '../src/v3-wish-delivery.mjs';
const key=crypto.randomBytes(32),secret='whsec_'+key.toString('base64');
const env={NODE_ENV:'test',CORNER_V3_FOLLOW:'1',CORNER_V3_WISHES:'1',CORNER_V3_WISH_DELIVERY:'1',
 CORNER_V3_FOLLOW_KEY:'stable-follow-key-for-provider-test-longer-than-32',
 SESSION_SECRET:'stable-session-secret-provider-test-long-enough',
 CORNER_V3_RESEND_WEBHOOK_SECRET:secret,SITE_URL:'https://vamsimarripudi.me/corner'};
const owner={id:'owner',role:'owner'};
test('provider delivered→bounce events reconcile and suppress opt-ins without PII leakage',async t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const sent=[];
 const follow=new V3Engagement(store,{env,sendMail:async mail=>{sent.push(mail);return {id:'verify_mock_123456'}}});
 const wishes=new WishesStudio(store,{env});
 const delivery=new WishDelivery(store,{env,sendMail:async mail=>{sent.push(mail);return {id:'provider_email_123456'}}});
 await follow.follow({email:'reader@example.test',topics:['wishes'],frequency:'instant',consent:true});
 const token=sent[0].text.match(/#token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);follow.verifyFollow(token);
 const draft=wishes.create(owner,{title:'Provider test wish',body:'A controlled synthetic test'});
 wishes.publish(owner,draft.id);
 delivery.enqueue(owner,draft.id,{confirm:true});
 assert.equal((await delivery.drain()).sent,1);
 assert.equal(delivery.snapshot(owner).accepted,1);
 const timestamp=String(Math.floor(Date.now()/1000));
 const event=(name,id)=>{
  const raw=Buffer.from(JSON.stringify({type:name,data:{email_id:'provider_email_123456'}}));
  const headers={'svix-id':id,'svix-timestamp':timestamp,
   'svix-signature':'v1,'+crypto.createHmac('sha256',key).update(id+'.'+timestamp+'.').update(raw).digest('base64')};
  return [raw,headers];
 };
 let [raw,headers]=event('email.delivered','msg_delivered_123456');
 assert.equal(delivery.reconcileWebhook(raw,headers).reconciled,1);
 assert.equal(delivery.snapshot(owner).delivered,1);
 assert.equal(delivery.reconcileWebhook(raw,headers).duplicate,true);
 [raw,headers]=event('email.bounced','msg_bounced_123456');
 assert.equal(delivery.reconcileWebhook(raw,headers).reconciled,1);
 assert.equal(delivery.snapshot(owner).bounced,1);
 assert.equal(store.one("SELECT state FROM v3_follows LIMIT 1").state,'bounced');
 [raw,headers]=event('email.delivered','msg_delivered_late_98765');
 delivery.reconcileWebhook(raw,headers);
 assert.equal(delivery.snapshot(owner).bounced,1,'Out-of-order delivered event does not undo bounce');
 const next=wishes.create(owner,{title:'Suppressed wish',body:'No email should go out'});
 wishes.publish(owner,next.id);
 assert.equal(delivery.enqueue(owner,next.id,{confirm:true}).queued,0);
 assert.ok(!JSON.stringify(store.all('SELECT * FROM v3_wish_provider_events')).includes('reader@example.test'));
});
