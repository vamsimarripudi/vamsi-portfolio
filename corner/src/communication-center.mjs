/**
 * Owner-only Corner communication reporting + opt-in campaign queue.
 * Manual activation and manual per-campaign confirmation. Never delivers an
 * email as a side-effect of user signup or post publication.
 * Existing V3 verified encrypted subscriber records remain the only audience.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {renderStoryAlert,renderWeeklyDigest,CATEGORIES,TEMPLATE_VERSION,CORNER_URL} from './communication-templates.mjs';
const SCHEMA=fs.readFileSync(new URL('./communication-schema.sql',import.meta.url),'utf8');
const VERSION='corner-communications-0001';
const now=()=>new Date().toISOString();
const uid=prefix=>prefix+'_'+crypto.randomUUID();
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const fail=(code,message,status=400)=>Object.assign(new Error(message),{code,status});
const owner=actor=>{if(actor?.role!=='owner')throw fail('OWNER_REQUIRED','Owner account required',403)};
const topicsOf=value=>{try{const a=JSON.parse(value);return Array.isArray(a)?a.filter(t=>['all','notes','builds','wishes','moments','journal'].includes(t)):[]}catch{return []}};
const safeCategory=category=>{if(!CATEGORIES.includes(category))throw fail('INVALID_CATEGORY','Choose a Corner category');return category};
const digestAllowed=(topic,cat)=>topic.includes('all')||topic.includes(cat.toLowerCase());
const validIds=ids=>Array.isArray(ids)&&ids.length>0&&ids.length<=8&&ids.every(id=>/^post_[0-9a-f-]{36}$/i.test(String(id)))&&new Set(ids).size===ids.length;
const keyFor=env=>{const k=String(env.CORNER_V3_FOLLOW_KEY||'');if(k.length<32)throw fail('FOLLOW_KEY_UNAVAILABLE','Stable follower key required',503);return crypto.createHash('sha256').update('corner:v3:follow:v1:'+k).digest()};
const decrypt=(ciphertext,env)=>{const [iv,tag,data]=String(ciphertext||'').split('.');if(!iv||!tag||!data)throw Error('Invalid follower encrypted address');const d=crypto.createDecipheriv('aes-256-gcm',keyFor(env),Buffer.from(iv,'base64url'));d.setAuthTag(Buffer.from(tag,'base64url'));return d.update(Buffer.from(data,'base64url'),undefined,'utf8')+d.final('utf8')};
const verifiedRestore=(store)=>{
 const iso=String(store.setting?.('v3.phase4.restoreAuditLastSuccess','')||store.setting?.('v3.phase2.restoreAuditLastSuccess','')||'');
 const ts=Date.parse(iso);
 return Number.isFinite(ts)&&ts<=Date.now()&&Date.now()-ts<=36*3600000;
};

export class CommunicationCenter {
 constructor(store,{env=process.env,sendMail,withMigrations=true}={}){
  this.store=store;this.env=env;this.sendMail=sendMail;this.busy=false;
  this.active=env.CORNER_COMMUNICATIONS_ENABLED==='1';
  if(this.active&&withMigrations){
   if(env.CORNER_V3_FOLLOW!=='1')throw fail('FOLLOW_DISABLED','Verified follower subscriptions must be enabled',503);
   keyFor(env);
   if(typeof sendMail!=='function')throw fail('SENDER_DISABLED','A verified email sender is required',503);
   if(env.NODE_ENV==='production'){
    if(!env.CORNER_AUTH_RESEND_API_KEY||!env.CORNER_AUTH_FROM_EMAIL)throw fail('SENDER_UNVERIFIED','Configured sender required',503);
    if(!env.CORNER_V3_RESEND_WEBHOOK_SECRET)throw fail('WEBHOOK_UNVERIFIED','Signed provider callbacks required',503);
    if(!verifiedRestore(store))throw fail('RESTORE_REQUIRED','A fresh real offsite restore rehearsal is required',503);
   }
   store.db.exec('CREATE TABLE IF NOT EXISTS corner_comm_migrations(version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)');
   const checksum=digest(SCHEMA),prior=store.one('SELECT checksum FROM corner_comm_migrations WHERE version=?',VERSION);
   if(prior&&prior.checksum!==checksum)throw Error('Communications schema mismatch; do not mutate historical migrations');
   if(!prior)store.transaction(()=>{store.db.exec(SCHEMA);store.exec('INSERT INTO corner_comm_migrations(version,checksum,applied_at) VALUES(?,?,?)',VERSION,checksum,now());});
  }
 }
 tableExists(name){return !!this.store.one('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=?',name)}
 status(actor){
  owner(actor);
  const s=this.store;
  const n=(sql,...args)=>Number(s.one(sql,...args)?.n||0);
  const memberCount=n("SELECT COUNT(*) n FROM users WHERE role='member' AND disabled_at IS NULL");
  const verifiedCount=this.tableExists('identity_profiles')?n("SELECT COUNT(*) n FROM users u JOIN identity_profiles p ON p.user_id=u.id WHERE u.role='member' AND u.disabled_at IS NULL AND p.verified_at IS NOT NULL"):0;
  const comments=Object.fromEntries(['pending','approved','hidden','deleted'].map(state=>[state,n('SELECT COUNT(*) n FROM comments WHERE state=?',state)]));
  const followers=this.tableExists('v3_follows')?{active:n("SELECT COUNT(*) n FROM v3_follows WHERE state='active'"),pending:n("SELECT COUNT(*) n FROM v3_follows WHERE state='pending'"),unsubscribed:n("SELECT COUNT(*) n FROM v3_follows WHERE state='unsubscribed'"),bounced:n("SELECT COUNT(*) n FROM v3_follows WHERE state='bounced'")}:{active:0,pending:0,unsubscribed:0,bounced:0};
  const outbox=this.tableExists('corner_comm_outbox')?Object.fromEntries(['queued','sending','retry','sent','failed','cancelled'].map(state=>[state,n('SELECT COUNT(*) n FROM corner_comm_outbox WHERE state=?',state)])):{queued:0,sending:0,retry:0,sent:0,failed:0,cancelled:0};
  const provider=this.tableExists('corner_comm_outbox')?Object.fromEntries(['accepted','unconfirmed','delivered','delayed','bounced','complained'].map(state=>[state,n('SELECT COUNT(*) n FROM corner_comm_outbox WHERE provider_state=?',state)])):{accepted:0,unconfirmed:0,delivered:0,delayed:0,bounced:0,complained:0};
  const campaignHistory=this.tableExists('corner_comm_campaigns')?s.all(`SELECT c.id,c.kind,c.category,c.created_at AS createdAt,c.template_version AS templateVersion,
   COUNT(o.id) AS recipients, SUM(CASE WHEN o.state='sent' THEN 1 ELSE 0 END) AS sent,
   SUM(CASE WHEN o.state='failed' THEN 1 ELSE 0 END) AS failed,
   SUM(CASE WHEN o.state='cancelled' THEN 1 ELSE 0 END) AS cancelled
   FROM corner_comm_campaigns c LEFT JOIN corner_comm_outbox o ON o.campaign_id=c.id
   GROUP BY c.id ORDER BY c.created_at DESC,c.id DESC LIMIT 30`).map(r=>({...r,recipients:Number(r.recipients),sent:Number(r.sent),failed:Number(r.failed),cancelled:Number(r.cancelled)})):[];
  const reading=this.tableExists('reading_views')?n('SELECT COUNT(*) n FROM reading_views'):null;
  const analytics=this.tableExists('analytics_events')?Object.fromEntries(['page_view','post_open','share'].map(type=>[type,n('SELECT COUNT(*) n FROM analytics_events WHERE type=?',type)])):{page_view:0,post_open:0,share:0};
  const recentComments=s.all("SELECT c.id,c.author_name AS enteredName,c.body,c.state,c.created_at AS createdAt,p.title AS storyTitle,p.slug AS storySlug FROM comments c JOIN posts p ON p.id=c.post_id ORDER BY c.created_at DESC LIMIT 35").map(r=>({...r,identityVerified:false}));
  const registrations=s.all("SELECT u.id,u.display_name AS displayName,u.email,u.created_at AS createdAt,u.last_login_at AS lastLoginAt,p.verified_at AS verifiedAt FROM users u LEFT JOIN identity_profiles p ON p.user_id=u.id WHERE u.role='member' AND u.disabled_at IS NULL ORDER BY u.created_at DESC LIMIT 50");
  const recentAudit=s.all('SELECT action,entity_type AS entityType,entity_id AS entityId,occurred_at AS occurredAt FROM audit_events ORDER BY occurred_at DESC LIMIT 35');
  const availableStories=s.all("SELECT id,title,category,published_at AS publishedAt FROM posts WHERE state='published' ORDER BY published_at DESC,id DESC LIMIT 100");
  const topStories=s.all("SELECT p.title,p.slug,COUNT(*) views FROM analytics_events a JOIN posts p ON p.id=a.post_id WHERE a.type='post_open' AND p.state='published' GROUP BY p.id ORDER BY views DESC LIMIT 10").map(x=>({...x,views:Number(x.views),label:'Measured opens, not named viewers'}));
  return {generatedAt:now(),enabled:this.active,posts:{published:n("SELECT COUNT(*) n FROM posts WHERE state='published'")},members:{total:memberCount,verified:verifiedCount,unverified:memberCount-verifiedCount,records:registrations},comments:{...comments,recent:recentComments},follows:followers,communications:{...outbox,provider,campaigns:campaignHistory,providerDeliveryNotGuaranteed:true},analytics:{...analytics,consentedReadingVisits:reading,knownReaders:false,topStories,warning:'Activity is aggregated; do not infer the real identity of individual visitors.'},recentAudit,availableStories,privacy:{ownerOnly:true,noCrossDeviceViewerIdentification:true,noUnconsentedCampaigns:true,commenterNameSelfDeclared:true}};
 }
 selectPosts(postIds){
  if(!validIds(postIds))throw fail('INVALID_POSTS','Select one to eight distinct published posts');
  return postIds.map(id=>{const p=this.store.one('SELECT id,slug,title,excerpt,body,category,state,version,published_at FROM posts WHERE id=?',id);if(!p||p.state!=='published')throw fail('UNPUBLISHED_POST','Draft or archived stories cannot be emailed',409);return p});
 }
 candidates({kind,category,posts}){
  const rows=this.store.all("SELECT id,topics,frequency FROM v3_follows WHERE state='active' ORDER BY id LIMIT 501");
  if(rows.length>500)throw fail('RECIPIENT_LIMIT','Campaign exceeds reviewed 500-subscriber batch limit',409);
  return rows.filter(row=>row.frequency===(kind==='digest'?'weekly':'instant')&&(
   kind!=='digest'?digestAllowed(topicsOf(row.topics),category):posts.some(p=>digestAllowed(topicsOf(row.topics),p.category))
  ));
 }
 preview(actor,{kind='story',category,postIds,unsubscribeUrl=CORNER_URL+'/follow/unsubscribe#token=PRIVATE-PREVIEW'}={}){
  owner(actor);if(!['story','update','digest'].includes(kind))throw fail('INVALID_KIND','Select story, update or digest');
  const posts=this.selectPosts(postIds);
  if(kind!=='digest'&&posts.length!==1)throw fail('INVALID_POSTS','One story per instant notification');
  if(kind!=='digest'&&category&&category!==posts[0].category&&category!=='Latest')throw fail('CATEGORY_MISMATCH','Category does not match published story');
  const cat=safeCategory(category||(kind==='digest'?'Latest':posts[0].category));
  const data=kind!=='digest'?renderStoryAlert({post:posts[0],category:cat,unsubscribeUrl,update:kind==='update'}):renderWeeklyDigest({posts,unsubscribeUrl});
  const audience=this.tableExists('v3_follows')?this.candidates({kind,category:cat,posts}):[];
  return {kind,category:cat,postIds:posts.map(p=>p.id),subject:data.subject,html:data.html,text:data.text,recipientCount:audience.length,deliveryWindow:kind==='digest'?'Manual weekly digest':'Manual instant campaign',automatic:false,previewOnly:true};
 }
 enqueue(actor,{kind='story',category,postIds,confirm=false}={}){
  owner(actor);
  if(!this.active)throw fail('DELIVERY_DISABLED','Mail campaigns are disabled',503);
  if(confirm!==true)throw fail('CONFIRM_REQUIRED','Explicit confirmation required to queue mail');
  const preview=this.preview(actor,{kind,category,postIds});
  const posts=this.selectPosts(preview.postIds),audience=this.candidates({kind,category:preview.category,posts});
  // The older Wishes campaign engine remains separate: never double-send.
  if(this.env.CORNER_V3_WISH_DELIVERY==='1'&&posts.some(post=>post.category==='Wishes'))throw fail('WISH_CAMPAIGN_OVERLAP','Disable the legacy Wishes delivery engine before queuing Wishes in the unified center',409);
  const campaignKey=digest([kind,preview.category,...posts.map(p=>p.id+':'+p.version)].join('|'));
  const existing=this.store.one('SELECT id FROM corner_comm_campaigns WHERE campaign_key=?',campaignKey);
  if(existing)return {alreadyQueued:true,campaignId:existing.id,queued:0,automatic:false};
  const id=uid('campaign'),stamp=now();let queued=0;
  this.store.transaction(()=>{
   this.store.exec('INSERT INTO corner_comm_campaigns(id,campaign_key,kind,category,post_ids,post_versions,created_by,created_at,template_version) VALUES(?,?,?,?,?,?,?,?,?)',id,campaignKey,kind,preview.category,JSON.stringify(posts.map(p=>p.id)),JSON.stringify(posts.map(p=>p.version)),actor.id,stamp,TEMPLATE_VERSION);
   for(const sub of audience){const mailId=uid('comm');this.store.exec("INSERT INTO corner_comm_outbox(id,campaign_id,follow_id,next_attempt_at,provider_reference,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",mailId,id,sub.id,stamp,'corner-comm-'+mailId,stamp,stamp);this.event(mailId,'queued');queued++}
   this.store.exec('INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,metadata,occurred_at) VALUES(?,?,?,?,?,?,?)',uid('audit'),actor.id,'communication.campaign.queued','campaign',id,JSON.stringify({kind,category:preview.category,queued}),stamp);
  });
  return {campaignId:id,queued,skipped:Math.max(0,audience.length-queued),automatic:false};
 }
 event(outboxId,event){this.store.exec('INSERT INTO corner_comm_events(id,outbox_id,event,recorded_at) VALUES(?,?,?,?)',uid('event'),outboxId,event,now());}
 unsubscribeLink(followId){
  const token=crypto.randomBytes(32).toString('base64url'),time=now();
  const hash=digest('corner:v3:follow:'+token);
  this.store.exec("INSERT INTO v3_follow_tokens(id,follow_id,purpose,token_hash,expires_at,created_at) VALUES(?,?,'unsubscribe',?,?,?)",uid('token'),followId,hash,new Date(Date.now()+90*86400000).toISOString(),time);
  return String(this.env.SITE_URL||CORNER_URL).replace(/\/$/,'')+'/follow/unsubscribe#token='+encodeURIComponent(token);
 }
 async drain({limit=6}={}){
  if(!this.active||this.busy)return {processed:0,sent:0,skipped:0};
  this.busy=true;let processed=0,sent=0,skipped=0;
  try{
   for(let n=0;n<Math.max(1,Math.min(10,Math.trunc(limit)||6));n++){
    const stamp=now();
    const row=this.store.one("SELECT * FROM corner_comm_outbox WHERE (state IN ('queued','retry') AND next_attempt_at<=?) OR (state='sending' AND lease_until<?) ORDER BY next_attempt_at,id LIMIT 1",stamp,stamp);
    if(!row)break;
    processed++;
    const lease=new Date(Date.now()+120000).toISOString();
    this.store.exec("UPDATE corner_comm_outbox SET state='sending',attempts=attempts+1,lease_until=?,updated_at=? WHERE id=?",lease,stamp,row.id);this.event(row.id,'attempt');
    const follow=this.store.one('SELECT * FROM v3_follows WHERE id=?',row.follow_id);
    const campaign=this.store.one('SELECT * FROM corner_comm_campaigns WHERE id=?',row.campaign_id);
    let posts=[];
    try{posts=this.selectPosts(JSON.parse(campaign?.post_ids||'[]'));}catch{}
    const topicList=topicsOf(follow?.topics);
    const unchanged=campaign&&JSON.stringify(posts.map(p=>p.version))===campaign.post_versions;
    const eligible=follow?.state==='active'&&follow?.verified_at&&campaign&&unchanged&&posts.length&&(
     campaign.kind!=='digest'?follow.frequency==='instant'&&digestAllowed(topicList,campaign.category):follow.frequency==='weekly'&&posts.some(p=>digestAllowed(topicList,p.category))
    );
    if(!eligible){this.store.exec("UPDATE corner_comm_outbox SET state='cancelled',lease_until=NULL,updated_at=? WHERE id=?",now(),row.id);this.event(row.id,'cancelled');skipped++;continue}
    try{
     const selected=campaign.kind==='digest'?posts.filter(p=>digestAllowed(topicList,p.category)):posts;
     const to=decrypt(follow.email_cipher,this.env);
     const url=this.unsubscribeLink(follow.id);
     const letter=campaign.kind!=='digest'?renderStoryAlert({post:selected[0],category:campaign.category,unsubscribeUrl:url,update:campaign.kind==='update'}):renderWeeklyDigest({posts:selected,unsubscribeUrl:url});
     const response=await this.sendMail({to,subject:letter.subject,text:letter.text,html:letter.html,reference:row.provider_reference});
     const providerId=typeof response?.id==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(response.id)?response.id:null;
     this.store.exec("UPDATE corner_comm_outbox SET state='sent',lease_until=NULL,provider_message_id=?,provider_state=?,sent_at=?,updated_at=? WHERE id=?",providerId,providerId?'accepted':'unconfirmed',now(),now(),row.id);this.event(row.id,'sent');sent++;
    }catch{
     const attempt=Number(this.store.one('SELECT attempts n FROM corner_comm_outbox WHERE id=?',row.id)?.n||0);
     const failed=attempt>=5,delay=new Date(Date.now()+Math.min(6*3600,60*2**attempt)*1000).toISOString();
     this.store.exec('UPDATE corner_comm_outbox SET state=?,lease_until=NULL,next_attempt_at=?,last_error=?,updated_at=? WHERE id=?',failed?'failed':'retry',delay,'DELIVERY_RETRY',now(),row.id);this.event(row.id,failed?'failed':'retry');
    }
   }
   return {processed,sent,skipped};
  }finally{this.busy=false}
 }
 /** ONLY feed this verified events; the signed webhook verifier is external. */
 reconcileVerifiedProviderEvent(event){
  if(!this.active||!event||typeof event.emailId!=='string')return {updated:0};
  const type=event.type||'';
  const mapping={'email.delivered':'delivered','email.delivery_delayed':'delayed','email.bounced':'bounced','email.complained':'complained'};
  const status=mapping[type];if(!status)return {updated:0};
  const rows=this.store.all('SELECT id,follow_id,provider_state FROM corner_comm_outbox WHERE provider_message_id=?',event.emailId);
  let count=0;
  for(const row of rows){
   if(['bounced','complained'].includes(row.provider_state)&&!['bounced','complained'].includes(status))continue;
   if(row.provider_state===status)continue;
   this.store.exec('UPDATE corner_comm_outbox SET provider_state=?,updated_at=? WHERE id=?',status,now(),row.id);this.event(row.id,status);count++;
   if(status==='bounced'||status==='complained')this.store.exec("UPDATE v3_follows SET state='bounced',updated_at=?,revoked_at=? WHERE id=? AND state='active'",now(),now(),row.follow_id);
  }
  return {updated:count};
 }
}
