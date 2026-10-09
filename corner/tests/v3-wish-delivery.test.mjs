import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {WishesStudio} from '../src/v3-wishes.mjs';
import {WishDelivery} from '../src/v3-wish-delivery.mjs';
const env={SESSION_SECRET:'strong-test-session-secret-for-corner-phase3',
 CORNER_V3_FOLLOW_KEY:'stable-follow-key-for-unit-test-longer-than-32',
 CORNER_V3_FOLLOW:'1',CORNER_V3_WISHES:'1',CORNER_V3_WISH_DELIVERY:'1',
 SITE_URL:'http://127.0.0.1:4141/corner',NODE_ENV:'test'};
const owner={id:'owner',role:'owner'};
const setup=t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const sent=[];
 const sendMail=async mail=>{sent.push(mail)};
 const followers=new V3Engagement(store,{env,sendMail});
 const wishes=new WishesStudio(store,{env});
 const delivery=new WishDelivery(store,{env,sendMail});
 return {store,sent,followers,wishes,delivery};
};
const optIn=async(followers,sent,email,frequency='instant')=>{
 await followers.follow({email,topics:['wishes'],frequency,consent:true});
 const confirm=sent.at(-1).text.match(/#token=([a-zA-Z0-9_-]+)/)?.[1];
 assert.ok(confirm);
 followers.verifyFollow(confirm);
};
test('delivery remains entirely OFF without explicit feature flags',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const delivery=new WishDelivery(store,{env:{...env,CORNER_V3_WISH_DELIVERY:'0'}});
 assert.deepEqual(delivery.snapshot(owner),{enabled:false,queued:0,retry:0,sent:0,failed:0,cancelled:0});
 assert.equal(store.one("SELECT name FROM sqlite_master WHERE name='v3_wish_outbox'"),null);
 assert.throws(()=>delivery.enqueue(owner,'post_notreal',{confirm:true}),{code:'DELIVERY_DISABLED'});
});
test('only confirmed subscribers receive manually queued published wishes, exactly once',async t=>{
 const {store,sent,followers,wishes,delivery}=setup(t);
 await optIn(followers,sent,'reader@example.test');
 const draft=wishes.create(owner,{title:'A calm wish',body:'Something to celebrate',timezone:'UTC'});
 assert.throws(()=>delivery.enqueue(owner,draft.id,{confirm:true}),{code:'WISH_NOT_PUBLISHED'});
 wishes.publish(owner,draft.id);
 assert.throws(()=>delivery.enqueue(owner,draft.id,{}),{code:'CONFIRM_REQUIRED'});
 assert.throws(()=>delivery.enqueue({id:'other',role:'member'},draft.id,{confirm:true}),{code:'OWNER_REQUIRED'});
 assert.deepEqual(delivery.enqueue(owner,draft.id,{confirm:true}),{queued:1,skipped:0,published:true,automatic:false});
 assert.equal(delivery.enqueue(owner,draft.id,{confirm:true}).queued,0);
 assert.equal(sent.length,1,'The initial verification email is the only message until drain');
 assert.equal((await delivery.drain()).sent,1);
 assert.equal(sent.length,2);
 assert.match(sent[1].html,/Unsubscribe/);
 assert.match(sent[1].text,/A calm wish/);
 assert.ok(!JSON.stringify(store.all("SELECT * FROM v3_wish_outbox")).includes('reader@example.test'));
 assert.equal(delivery.snapshot(owner).sent,1);
 assert.equal((await delivery.drain()).sent,0);
});
test('unsubscribe or archived content stops queued mail; transient mail failures retry',async t=>{
 const {store,sent,followers,wishes,delivery}=setup(t);
 await optIn(followers,sent,'reader2@example.test');
 const first=wishes.create(owner,{title:'A first wish',body:'For a fine day'});
 wishes.publish(owner,first.id);
 assert.equal(delivery.enqueue(owner,first.id,{confirm:true}).queued,1);
 store.exec("UPDATE v3_follows SET state='unsubscribed'");
 assert.equal((await delivery.drain()).skipped,1);
 assert.equal(sent.length,1,'No unsolicited mail after opt-out');
 store.exec("UPDATE v3_follows SET state='active'");
 const second=wishes.create(owner,{title:'Another lovely wish',body:'For a good morning'});
 wishes.publish(owner,second.id);
 delivery.enqueue(owner,second.id,{confirm:true});
 store.archive(second.id,owner.id);
 assert.equal((await delivery.drain()).skipped,1);
 const third=wishes.create(owner,{title:'A third wish',body:'A welcome celebration'});
 wishes.publish(owner,third.id);
 delivery.enqueue(owner,third.id,{confirm:true});
 let failures=0;
 delivery.sendMail=async()=>{failures++;throw Error('unavailable')};
 assert.equal((await delivery.drain()).sent,0);
 assert.equal(failures,1);
 assert.equal(delivery.snapshot(owner).retry,1);
});
test('weekly opt-in waits until next weekly digest window and retains one recipient',async t=>{
 const {store,sent,followers,wishes,delivery}=setup(t);
 await optIn(followers,sent,'weekly@example.test','weekly');
 const w=wishes.create(owner,{title:'A weekly wish',body:'A note of appreciation'});wishes.publish(owner,w.id);
 assert.equal(delivery.enqueue(owner,w.id,{confirm:true}).queued,1);
 assert.equal((await delivery.drain()).sent,0);
 assert.equal(sent.length,1);
 const due=store.one('SELECT next_attempt_at FROM v3_wish_outbox').next_attempt_at;
 assert.equal((await delivery.drain({clock:new Date(Date.parse(due)+1000).toISOString()})).sent,1);
 assert.equal(sent.length,2);
 assert.match(sent[1].subject,/weekly/i);
});

test('consent-filtered campaigns include eligible followers after hundreds of unrelated active subscribers',t=>{
 const {store,wishes,delivery}=setup(t);
 const stamp=new Date().toISOString();
 const insert=store.db.prepare(
  'INSERT INTO v3_follows(id,email_hash,email_cipher,topics,frequency,state,consent_version,consent_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
 for(let n=0;n<510;n++)insert.run(
  'nonwish_'+String(n).padStart(4,'0'),'hash_unrelated_'+n,'encrypted_stub','["notes"]','weekly','active','v3.0',stamp,stamp,stamp);
 insert.run('zzzz_eligible','hash_unique_opt_in','encrypted_stub','["wishes"]','instant','active','v3.0',stamp,stamp,stamp);
 insert.run('zzzz_invalid','hash_invalid_topics','encrypted_stub','not-json','weekly','active','v3.0',stamp,stamp,stamp);
 const post=wishes.create(owner,{title:'A safe greeting',body:'For a special occasion'});
 wishes.publish(owner,post.id);
 const result=delivery.enqueue(owner,post.id,{confirm:true});
 assert.equal(result.queued,1,'The eligible subscriber must not be omitted by unrelated active followers');
 assert.equal(result.skipped,0);
 assert.equal(store.one("SELECT follow_id FROM v3_wish_outbox").follow_id,'zzzz_eligible');
 assert.equal(delivery.snapshot(owner).queued,1);
});
test('campaigns refuse over 500 eligible recipients without partially queuing messages',t=>{
 const {store,wishes,delivery}=setup(t);
 const stamp=new Date().toISOString();
 const insert=store.db.prepare(
  'INSERT INTO v3_follows(id,email_hash,email_cipher,topics,frequency,state,consent_version,consent_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
 for(let n=0;n<501;n++)insert.run(
  'verified_'+String(n).padStart(4,'0'),'eligible_hash_'+n,'encrypted_stub','["all"]','instant','active','v3.0',stamp,stamp,stamp);
 const post=wishes.create(owner,{title:'A happy message',body:'Hope the day goes well'});
 wishes.publish(owner,post.id);
 assert.throws(()=>delivery.enqueue(owner,post.id,{confirm:true}),{code:'RECIPIENT_LIMIT'});
 assert.equal(store.one('SELECT COUNT(*) n FROM v3_wish_outbox').n,0,'Capacity limits must be atomic');
});

