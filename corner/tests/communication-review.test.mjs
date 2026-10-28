import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {
 CATEGORIES,CATEGORY_THEMES,renderStoryAlert,renderWeeklyDigest,renderAccountNotice,
 renderModerationNotice,renderSubscriptionNotice,renderOperationsReport,templateCatalog
} from '../src/communication-templates.mjs';
import {CommunicationCenter} from '../src/communication-center.mjs';
import {communicationRoutes} from '../src/communication-routes.mjs';
const unsub='https://vamsimarripudi.me/corner/follow/unsubscribe#token=test-123';
const post=(cat='Notes',id='post_'+crypto.randomUUID())=>({id,slug:'testing-'+cat.toLowerCase(),title:cat+' with <script>bad()</script>',excerpt:'A useful & genuinely original update.',body:'Private draft body',category:cat,state:'published',version:1,published_at:'2026-10-28T10:00:00.000Z'});
test('six distinct palettes, unique email presentations and escaped source content',()=>{
 const letters=CATEGORIES.map(cat=>renderStoryAlert({post:post(cat),category:cat,unsubscribeUrl:unsub}));
 assert.equal(new Set(CATEGORIES.map(cat=>CATEGORY_THEMES[cat].accent)).size,6);
 assert.equal(new Set(letters.map(x=>x.html)).size,6);
 assert.equal(templateCatalog().filter(x=>x.kind==='story').length,6);
 for(const x of letters){
  assert.ok(x.html.includes('email-vm-mark.png'),x.category);
  assert.ok(x.html.includes('NOTES FROM THE IN-BETWEEN'),x.category);
  assert.ok(x.html.includes('Unsubscribe'),x.category);
  assert.ok(x.text.includes('Unsubscribe:'),x.category);
  assert.ok(x.html.includes('&lt;script&gt;bad()&lt;/script&gt;'),x.category);
  assert.doesNotMatch(x.html,/<script>bad\(\)<\/script>/);
  assert.ok(x.html.includes('max-width:600px'),x.category);
  assert.ok(x.marketing);
 }
});
test('marketing always requires unsubscribe and rejects unsafe destinations and drafts',()=>{
 assert.throws(()=>renderStoryAlert({post:post('Wishes')}),/unsubscribe/i);
 assert.throws(()=>renderStoryAlert({post:{...post('Notes'),state:'draft'},unsubscribeUrl:unsub}),/Draft or archived/);
 assert.throws(()=>renderStoryAlert({post:post('Notes'),unsubscribeUrl:'javascript:alert(1)'}),/HTTPS/);
 assert.throws(()=>renderStoryAlert({post:post('Notes'),unsubscribeUrl:'https://evil.test/unsubscribe'}),/Corner site/);
 assert.throws(()=>renderWeeklyDigest({posts:[post('Notes')]}),/unsubscribe/i);
 assert.throws(()=>renderWeeklyDigest({posts:Array.from({length:9},()=>post('Notes')),unsubscribeUrl:unsub}),/one to eight/);
});
test('weekly dispatch, account, consent, comment, operations templates are distinct',()=>{
 const d=renderWeeklyDigest({posts:[post('Wishes'),post('Journal'),post('Builds')],unsubscribeUrl:unsub});
 assert.match(d.html,/The Corner/);assert.match(d.html,/WISHES/);assert.match(d.html,/JOURNAL/);assert.match(d.html,/BUILDS/);
 for(const type of ['welcome','verify','reset','security','email'])assert.equal(renderAccountNotice({type,actionUrl:'https://vamsimarripudi.me/corner/profile'}).kind,'account');
 assert.match(renderSubscriptionNotice({type:'confirm',actionUrl:'https://vamsimarripudi.me/corner/follow/confirm#token=abc'}).html,/Only if you say yes/);
 assert.match(renderModerationNotice({commenterName:'<img src=x>',commentExcerpt:'<b>secret</b>',storyTitle:'One note'}).html,/&lt;img src=x&gt;/);
 assert.doesNotMatch(renderOperationsReport({metrics:{registered:4,ip:'10.10.10.10'}}).html,/10\.10\.10\.10/);
});
function store(){
 const db=new DatabaseSync(':memory:');db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE users (id TEXT PRIMARY KEY,role TEXT,display_name TEXT,email TEXT,created_at TEXT,last_login_at TEXT,disabled_at TEXT);
 CREATE TABLE identity_profiles (user_id TEXT PRIMARY KEY,verified_at TEXT);
 CREATE TABLE posts(id TEXT PRIMARY KEY,slug TEXT,title TEXT,excerpt TEXT,body TEXT,category TEXT,state TEXT,version INTEGER DEFAULT 1,published_at TEXT);
 CREATE TABLE comments(id TEXT PRIMARY KEY,post_id TEXT,author_name TEXT,body TEXT,state TEXT,created_at TEXT);
 CREATE TABLE analytics_events(type TEXT,post_id TEXT,occurred_at TEXT);
 CREATE TABLE audit_events(id TEXT PRIMARY KEY,actor_user_id TEXT,action TEXT,entity_type TEXT,entity_id TEXT,metadata TEXT,occurred_at TEXT);
 CREATE TABLE v3_follows(id TEXT PRIMARY KEY,email_cipher TEXT,topics TEXT,frequency TEXT,state TEXT,verified_at TEXT);
 CREATE TABLE v3_follow_tokens(id TEXT PRIMARY KEY,follow_id TEXT,purpose TEXT,token_hash TEXT,expires_at TEXT,created_at TEXT);
 `);
 const prepare=(sql)=>db.prepare(sql);
 const s={db,one:(sql,...args)=>prepare(sql).get(...args)||null,all:(sql,...args)=>prepare(sql).all(...args),exec:(sql,...args)=>prepare(sql).run(...args),transaction:cb=>{db.exec('BEGIN IMMEDIATE');try{const result=cb();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}},setting:()=>''};
 s.exec("INSERT INTO users VALUES('u1','member','Registered Reader','reader@example.test','2026-10-28T10:00:00Z',NULL,NULL)");
 s.exec("INSERT INTO identity_profiles VALUES('u1','2026-10-28T10:01:00Z')");
 const p=post('Notes');s.exec('INSERT INTO posts VALUES(?,?,?,?,?,?,?,?,?)',p.id,p.slug,p.title,p.excerpt,p.body,p.category,p.state,p.version,p.published_at);
 s.exec('INSERT INTO comments VALUES(?,?,?,?,?,?)','c1',p.id,'Self declared <name>','I enjoyed this note','pending','2026-10-28T11:00:00Z');
 s.exec('INSERT INTO analytics_events VALUES(?,?,?)','post_open',p.id,'2026-10-28T11:01:00Z');
 return {s,p};
}
const env={NODE_ENV:'test',CORNER_COMMUNICATIONS_ENABLED:'1',CORNER_V3_FOLLOW:'1',CORNER_V3_FOLLOW_KEY:'very-long-independent-test-follow-key-1000000000',SITE_URL:'https://vamsimarripudi.me/corner'};
function encrypt(email){const key=crypto.createHash('sha256').update('corner:v3:follow:v1:'+env.CORNER_V3_FOLLOW_KEY).digest();const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);const buf=Buffer.concat([c.update(email,'utf8'),c.final()]);return [iv.toString('base64url'),c.getAuthTag().toString('base64url'),buf.toString('base64url')].join('.')}
const owner={id:'founder',role:'owner'},visitor={id:'user',role:'member'};
test('owner-only report shows real commenters and registered accounts without identifying viewers',()=>{
 const {s,p}=store();const c=new CommunicationCenter(s,{env:{},withMigrations:false});const result=c.status(owner);
 assert.equal(result.members.total,1);assert.equal(result.members.verified,1);assert.equal(result.comments.pending,1);
 assert.equal(result.comments.recent[0].enteredName,'Self declared <name>');assert.equal(result.comments.recent[0].identityVerified,false);
 assert.equal(result.analytics.post_open,1);assert.equal(result.analytics.topStories[0].views,1);
 assert.equal(result.analytics.knownReaders,false);assert.equal(result.analytics.consentedReadingVisits,null);
 assert.equal(result.communications.sent,0);assert.throws(()=>c.status(visitor),/Owner/);
 s.db.close();
});
test('manual queued notifications honour confirmed topic, frequency and consent',async()=>{
 const {s,p}=store();let sent=[];const sender=async m=>{sent.push(m);return {id:'message_from_provider_123456'}};
 const c=new CommunicationCenter(s,{env,sendMail:sender});
 s.exec('INSERT INTO v3_follows VALUES(?,?,?,?,?,?)','sub1',encrypt('sub1@example.test'),'["notes"]','instant','active','2026-10-28T10:00:00Z');
 s.exec('INSERT INTO v3_follows VALUES(?,?,?,?,?,?)','sub2',encrypt('sub2@example.test'),'["wishes"]','instant','active','2026-10-28T10:00:00Z');
 s.exec('INSERT INTO v3_follows VALUES(?,?,?,?,?,?)','sub3',encrypt('sub3@example.test'),'["all"]','weekly','active','2026-10-28T10:00:00Z');
 s.exec('INSERT INTO v3_follows VALUES(?,?,?,?,?,?)','sub4',encrypt('sub4@example.test'),'["notes"]','instant','pending',null);
 assert.equal(c.preview(owner,{kind:'story',postIds:[p.id]}).recipientCount,1);
 assert.throws(()=>c.enqueue(owner,{kind:'story',postIds:[p.id]}),/confirmation/);
 assert.throws(()=>c.enqueue(visitor,{kind:'story',postIds:[p.id],confirm:true}),/Owner/);
 const queued=c.enqueue(owner,{kind:'story',postIds:[p.id],confirm:true});assert.equal(queued.queued,1);
 assert.equal(c.enqueue(owner,{kind:'story',postIds:[p.id],confirm:true}).alreadyQueued,true);
 const result=await c.drain();assert.equal(result.sent,1);
 assert.equal(sent.length,1);assert.equal(sent[0].to,'sub1@example.test');assert.match(sent[0].html,/Unsubscribe/);
 assert.equal(c.status(owner).communications.sent,1);
 assert.equal(c.status(owner).communications.campaigns.length,1,'campaign history is part of owner activity report');
 assert.equal(s.one("SELECT COUNT(*) AS n FROM v3_follow_tokens WHERE purpose='unsubscribe'").n,1);
 assert.equal(c.reconcileVerifiedProviderEvent({emailId:'message_from_provider_123456',type:'email.delivered'}).updated,1);
 assert.equal(s.one("SELECT provider_state FROM corner_comm_outbox LIMIT 1").provider_state,'delivered');
 s.db.close();
});
test('weekly campaigns filter by recipient categories, and unsubscribed recipients are suppressed at send time',async()=>{
 const {s,p}=store();const wish=post('Wishes');s.exec('INSERT INTO posts VALUES(?,?,?,?,?,?,?,?,?)',wish.id,wish.slug,wish.title,wish.excerpt,wish.body,wish.category,wish.state,wish.version,wish.published_at);
 const sent=[];const c=new CommunicationCenter(s,{env,sendMail:async m=>{sent.push(m);return {id:'provider_msg_'+sent.length+'_12345'}}});
 s.exec('INSERT INTO v3_follows VALUES(?,?,?,?,?,?)','a',encrypt('a@example.test'),'["notes"]','weekly','active','2026-10-28');
 s.exec('INSERT INTO v3_follows VALUES(?,?,?,?,?,?)','b',encrypt('b@example.test'),'["wishes"]','weekly','active','2026-10-28');
 c.enqueue(owner,{kind:'digest',postIds:[p.id,wish.id],confirm:true});
 // Recipient b unsubscribes before this campaign is delivered.
 s.exec("UPDATE v3_follows SET state='unsubscribed' WHERE id='b'");
 const result=await c.drain({limit:5});assert.equal(result.sent,1);assert.equal(result.skipped,1);
 assert.equal(sent[0].to,'a@example.test');assert.ok(sent[0].html.includes('Notes'));assert.ok(!sent[0].html.includes('A little wish:'));
 s.db.close();
});
test('publishing is not an implicit send; paused delivery does not mutate schema',async()=>{
 const {s,p}=store();const c=new CommunicationCenter(s,{env:{...env,CORNER_COMMUNICATIONS_ENABLED:'0'},sendMail:async()=>{throw Error('should never send')}});
 assert.equal(c.status(owner).enabled,false);assert.equal((await c.drain()).processed,0);
 assert.equal(s.one("SELECT name FROM sqlite_master WHERE type='table' AND name='corner_comm_campaigns'"),null);
 assert.throws(()=>c.enqueue(owner,{kind:'story',postIds:[p.id],confirm:true}),/disabled/i);
 s.db.close();
});
test('all communication routes require an owner and use the existing origin/method gates',async()=>{
 const {s}=store();const center=new CommunicationCenter(s,{env:{},withMigrations:false});
 let calls=[];const route=communicationRoutes({center,requireOwner:(_req,_path,_method)=>owner,readJSON:async()=>({}),ok:(_res,data)=>calls.push(data),limit:()=>{}});
 assert.equal(await route({method:'GET'}, {}, '/api/admin/communications/status'),true);assert.ok(calls[0].privacy.ownerOnly);
 assert.equal(await route({method:'GET'}, {}, '/api/admin/communications/templates'),true);assert.equal(calls[1].length,templateCatalog().length);
 const forbidden=communicationRoutes({center,requireOwner:()=>visitor,readJSON:async()=>({}),ok:()=>{},limit:()=>{}});
 await assert.rejects(()=>forbidden({method:'GET'}, {}, '/api/admin/communications/status'),/Owner only/);
 s.db.close();
});

test('substantive updates use distinct subject and cannot send after their source revision changes',async()=>{
 const {s,p}=store(),mail=[];
 const c=new CommunicationCenter(s,{env,sendMail:async m=>{mail.push(m);return {id:'provider_update_12345678'}}});
 s.exec('INSERT INTO v3_follows VALUES(?,?,?,?,?,?)','sub-up',encrypt('revisions@example.test'),'["notes"]','instant','active','2026-10-28');
 const updated=c.preview(owner,{kind:'update',postIds:[p.id]});
 assert.equal(updated.recipientCount,1);assert.match(updated.subject,/Story updated/);assert.match(updated.html,/STORY UPDATE/);
 assert.equal(c.enqueue(owner,{kind:'update',postIds:[p.id],confirm:true}).queued,1);
 s.exec('UPDATE posts SET version=2 WHERE id=?',p.id);
 const result=await c.drain();assert.equal(result.sent,0);assert.equal(result.skipped,1);assert.equal(mail.length,0);
 assert.equal(c.enqueue(owner,{kind:'update',postIds:[p.id],confirm:true}).queued,1,'Revised content requires new campaign approval');
 assert.equal((await c.drain()).sent,1);assert.equal(mail.length,1);
 s.db.close();
});
