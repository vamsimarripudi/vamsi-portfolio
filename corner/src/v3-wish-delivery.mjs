import crypto from 'node:crypto';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {now,uid,sha,httpError} from './domain.mjs';

const schema=fs.readFileSync(new URL('./v3-wish-delivery-schema.sql',import.meta.url),'utf8');
const VERSION='v3-0004-wish-delivery';
const secretKey=env=>{
 const secret=String(env.CORNER_V3_FOLLOW_KEY||'');
 if(secret.length<32)throw httpError(503,'A stable email-following key is required.','FOLLOW_KEY_UNAVAILABLE');
 return crypto.createHash('sha256').update('corner:v3:follow:v1:'+secret).digest();
};
const decrypt=(encoded,env)=>{
 const [iv,tag,body]=String(encoded||'').split('.');
 if(!iv||!tag||!body)throw Error('Invalid follower address');
 const cipher=crypto.createDecipheriv('aes-256-gcm',secretKey(env),Buffer.from(iv,'base64url'));
 cipher.setAuthTag(Buffer.from(tag,'base64url'));
 return cipher.update(Buffer.from(body,'base64url'),undefined,'utf8')+cipher.final('utf8');
};
const validTopics=value=>{
 try{const topics=JSON.parse(value);return Array.isArray(topics)&&topics.some(t=>t==='all'||t==='wishes')}catch{return false}
};
const escapeHTML=(s)=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const weeklyAt=stamp=>{
 const d=new Date(stamp);
 d.setUTCHours(8,0,0,0);
 const days=(8-d.getUTCDay())%7;
 d.setUTCDate(d.getUTCDate()+days);
 if(d<=new Date(stamp))d.setUTCDate(d.getUTCDate()+7);
 return d.toISOString();
};
const expireIn=(days)=>new Date(Date.now()+days*86400000).toISOString();
const owner=(user)=>{if(user?.role!=='owner')throw httpError(403,'Owner access required.','OWNER_REQUIRED')};

/** Opt-in only. Publication and scheduling NEVER send mail or enqueue automatically.
 * An authenticated owner must explicitly confirm every outbound campaign.
 */
export class WishDelivery {
 constructor(store,{env=process.env,sendMail}={}){
  this.store=store;this.env=env;this.sendMail=sendMail;this.busy=false;
  if(this.enabled()){
   secretKey(env);
   if(typeof sendMail!=='function')throw Error('Delivery sender is not available');
   if(env.NODE_ENV==='production'&&!(env.CORNER_AUTH_RESEND_API_KEY&&env.CORNER_AUTH_FROM_EMAIL))
     throw Error('A verified sender is required before enabling opt-in wish delivery');
   const checksum=sha(schema),prior=store.one('SELECT checksum FROM v3_schema_migrations WHERE version=?',VERSION);
   if(prior&&prior.checksum!==checksum)throw Error('Wish delivery migration checksum mismatch');
   if(!prior)store.transaction(()=>{
    store.db.exec(schema);
    store.exec('INSERT INTO v3_schema_migrations(version,checksum,applied_at) VALUES(?,?,?)',VERSION,checksum,now());
   });
  }
 }
 enabled(){return this.env.CORNER_V3_WISHES==='1'&&this.env.CORNER_V3_FOLLOW==='1'&&this.env.CORNER_V3_WISH_DELIVERY==='1'}
 assertReady(){if(!this.enabled())throw httpError(503,'Optional delivery is not enabled.','DELIVERY_DISABLED');secretKey(this.env)}
 snapshot(user){
  owner(user);
  if(!this.enabled())return {enabled:false,queued:0,retry:0,sent:0,failed:0,cancelled:0};
  const statuses=Object.fromEntries(this.store.all("SELECT state,COUNT(*) n FROM v3_wish_outbox GROUP BY state").map(x=>[x.state,x.n]));
  return {enabled:true,queued:(statuses.queued||0)+(statuses.sending||0),retry:statuses.retry||0,
   sent:statuses.sent||0,failed:statuses.failed||0,cancelled:statuses.cancelled||0};
 }
 enqueue(user,postId,{confirm=false}={}){
  owner(user);this.assertReady();
  if(confirm!==true)throw httpError(400,'Confirm the opted-in notification campaign.','CONFIRM_REQUIRED');
  const post=this.store.one("SELECT id,type,state,title,slug FROM posts WHERE id=?",String(postId||''));
  if(!post||post.type!=='wish'||post.state!=='published')throw httpError(409,'Publish the wish before notifying followers.','WISH_NOT_PUBLISHED');
  const candidates=this.store.all("SELECT id,topics,frequency FROM v3_follows WHERE state='active' ORDER BY id LIMIT 501").filter(x=>validTopics(x.topics));
  if(candidates.length>500)throw httpError(409,'This campaign exceeds the safe recipient limit.','RECIPIENT_LIMIT');
  const stamp=now(),weekly=weeklyAt(stamp);
  let queued=0;
  this.store.transaction(()=>{
   for(const follow of candidates){
    const id=uid('mail');
    const next=follow.frequency==='weekly'?weekly:stamp;
    const info=this.store.exec("INSERT OR IGNORE INTO v3_wish_outbox(id,post_id,follow_id,frequency,state,next_attempt_at,provider_reference,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?,?,?)",
     id,post.id,follow.id,follow.frequency,next,'corner-v3-wish-'+id,stamp,stamp);
    if(info.changes){
     queued++;
     this.event(id,'queued',stamp);
    }
   }
   this.store.audit(user.id,'v3.wish.campaign.queued','post',post.id,{queued});
  });
  return {queued,skipped:candidates.length-queued,published:true,automatic:false};
 }
 event(id,type,at,details=''){
  this.store.exec('INSERT INTO v3_wish_delivery_events(id,outbox_id,event,recorded_at,details) VALUES(?,?,?,?,?)',
   uid('delivery'),id,type,at,String(details).slice(0,64));
 }
 unsubscribeUrl(followId,reference){
  const token=crypto.createHmac('sha256',secretKey(this.env)).update('corner:v3:wish:unsubscribe:'+followId+':'+reference).digest('base64url');
  const hash=sha('corner:v3:follow:'+token),stamp=now();
  this.store.exec("INSERT OR IGNORE INTO v3_follow_tokens(id,follow_id,purpose,token_hash,expires_at,created_at) VALUES(?,?,'unsubscribe',?, ?,?)",
    uid('token'),followId,hash,expireIn(90),stamp);
  return String(this.env.SITE_URL||'http://localhost:4141/corner').replace(/\/$/,'')+'/follow/unsubscribe#token='+encodeURIComponent(token);
 }
 render(postRows,unsubscribe){
  const subjects=postRows.map(x=>x.title),links=postRows.map(x=>
   String(this.env.SITE_URL||'http://localhost:4141/corner').replace(/\/$/,'')+'/post/'+encodeURIComponent(x.slug));
  const subject=postRows.length===1?'A new wish from Vamsi’s Corner':'Your weekly wishes from Vamsi’s Corner';
  const text=[subject,'','You requested updates about wishes from Vamsi’s Corner.','',
   ...postRows.flatMap((p,i)=>[p.title,links[i],'']),'Unsubscribe: '+unsubscribe].join('\n');
  const stories=postRows.map((x,i)=>'<p style="margin:0 0 18px"><a style="color:#111;text-decoration:underline" href="'+escapeHTML(links[i])+'">'+escapeHTML(x.title)+'</a></p>').join('');
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;background:#faf9f6;padding:20px;font-family:Arial,sans-serif;color:#111"><main style="max-width:590px;margin:auto;background:white;border:1px solid #d9d4cc;border-radius:15px;padding:32px"><div style="font-size:14px;letter-spacing:1px;font-weight:800">✳ Vamsi’s Corner</div><h1 style="font:normal 34px Georgia,serif">'+escapeHTML(subject)+'</h1><p>You opted in to updates about wishes.</p>'+stories+'<hr style="border:0;border-top:1px solid #ddd"><p style="font-size:12px">Sent only to verified opt-in subscribers. <a href="'+escapeHTML(unsubscribe)+'">Unsubscribe from these updates</a>.</p></main></body></html>';
  return {subject,text,html};
 }
 /** Leased bounded worker; rechecks consent and publication before any send. */
 async drain({clock=now(),limit=8}={}){
  if(!this.enabled()||this.busy)return {processed:0,sent:0,skipped:0};
  this.busy=true;
  let processed=0,sent=0,skipped=0;
  try{
   const take=Math.max(1,Math.min(Number(limit)||8,20));
   for(let i=0;i<take;i++){
    const due=this.store.one("SELECT * FROM v3_wish_outbox WHERE ((state IN ('queued','retry') AND next_attempt_at<=?) OR (state='sending' AND lease_until<?)) ORDER BY next_attempt_at,id LIMIT 1",clock,clock);
    if(!due)break;
    const related=due.frequency==='weekly'?
     this.store.all("SELECT * FROM v3_wish_outbox WHERE follow_id=? AND frequency='weekly' AND state IN ('queued','retry') AND next_attempt_at<=? ORDER BY next_attempt_at,id LIMIT 20",due.follow_id,clock):[due];
    const rows=related.length?related:[due],ids=rows.map(x=>x.id),start=now();
    this.store.transaction(()=>{
     for(const item of rows){
      this.store.exec("UPDATE v3_wish_outbox SET state='sending',attempts=attempts+1,lease_until=?,updated_at=? WHERE id=?",
       new Date(Date.now()+120000).toISOString(),start,item.id);
      this.event(item.id,'attempted',start);
     }
    });
    processed++;
    const follow=this.store.one('SELECT * FROM v3_follows WHERE id=?',due.follow_id);
    const posts=rows.map(x=>this.store.one("SELECT id,title,slug,state,type FROM posts WHERE id=?",x.post_id));
    if(!follow||follow.state!=='active'||!validTopics(follow.topics)||posts.some(p=>!p||p.type!=='wish'||p.state!=='published')){
     this.store.transaction(()=>{
      for(const id of ids){this.store.exec("UPDATE v3_wish_outbox SET state='cancelled',lease_until=NULL,updated_at=? WHERE id=?",start,id);this.event(id,'cancelled',start)}
     });skipped+=rows.length;continue;
    }
    try{
     const recipient=decrypt(follow.email_cipher,this.env);
     const first=rows[0],reference=first.provider_reference;
     const letter=this.render(posts,this.unsubscribeUrl(follow.id,reference));
     await this.sendMail({to:recipient,...letter,reference});
     const stamp=now();
     this.store.transaction(()=>{
      for(const id of ids){this.store.exec("UPDATE v3_wish_outbox SET state='sent',sent_at=?,lease_until=NULL,last_error=NULL,updated_at=? WHERE id=?",stamp,stamp,id);this.event(id,'sent',stamp)}
     });sent+=rows.length;
    }catch(error){
     const stamp=now();
     this.store.transaction(()=>{
      for(const item of rows){
       const count=this.store.one('SELECT attempts FROM v3_wish_outbox WHERE id=?',item.id).attempts;
       const stop=count>=5;
       const delay=new Date(Date.now()+Math.min(6*3600,60*Math.pow(2,count))*1000).toISOString();
       this.store.exec("UPDATE v3_wish_outbox SET state=?,lease_until=NULL,next_attempt_at=?,last_error=?,updated_at=? WHERE id=?",
        stop?'failed':'retry',delay,'DELIVERY_RETRY',stamp,item.id);
       this.event(item.id,stop?'failed':'retry',stamp);
      }
     });
    }
   }
   return {processed,sent,skipped};
  }finally{this.busy=false}
 }
}
