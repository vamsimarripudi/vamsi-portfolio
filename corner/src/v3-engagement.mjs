import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { uid, now, sha, pureText, httpError, clamp } from './domain.mjs';
import { publicPost } from './store.mjs';

const schema=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'v3-schema.sql'),'utf8');
const emailRule=/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const safeEmail=(v)=>{
  const value=String(v??'').trim().toLowerCase();
  if(value.length>254||!emailRule.test(value))throw httpError(400,'Enter a valid email address.','INVALID_EMAIL');
  return value;
};
const hashToken=(v)=>sha('corner:v3:follow:'+v);
const dateAfter=(hours)=>new Date(Date.now()+hours*3600000).toISOString();
const validTopics=['all','notes','moments','wishes','builds'];
const flag=(env,name)=>env[name]==='1';
const content=(v,len)=>pureText(v,len).replace(/\s+/g,' ').trim();
const emailKey=(env)=>crypto.createHash('sha256').update('v3-follow-storage:'+String(env.CORNER_V3_FOLLOW_ENCRYPTION_KEY||'')).digest();
const normalizedHash=(mail,env)=>crypto.createHmac('sha256',emailKey(env)).update(mail).digest('hex');
const encrypt=(mail,env)=>{
  const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',emailKey(env),nonce);
  const body=Buffer.concat([cipher.update(mail,'utf8'),cipher.final()]);
  return [nonce.toString('base64url'),cipher.getAuthTag().toString('base64url'),body.toString('base64url')].join('.');
};

export class V3Engagement{
  constructor(store,{env=process.env,sendMail}={}){
    this.store=store;
    this.env=env;
    this.sendMail=sendMail||null;
    if(this.enabled('FOLLOW')&&String(env.CORNER_V3_FOLLOW_ENCRYPTION_KEY||'').length<32)throw new Error('Dedicated CORNER_V3_FOLLOW_ENCRYPTION_KEY (32+ chars) is required before enabling follows');
    store.db.exec(schema);
  }
  enabled(feature){return flag(this.env,'CORNER_V3_'+feature)}
  assertEnabled(feature){if(!this.enabled(feature))throw httpError(404,'This feature is not available.','FEATURE_DISABLED')}
  search({q='',category='',year='',tag='',limit=20,offset=0}={}){
    this.assertEnabled('SEARCH');
    q=content(q,100);category=String(category||'').trim();year=String(year||'').trim();tag=content(tag,35);
    limit=clamp(Number(limit)||20,1,40);offset=clamp(Number(offset)||0,0,5000);
    if(!q&&!category&&!year&&!tag)return {items:[],total:0,nextOffset:null};
    if(category&&!['Latest','Wishes','Builds','Notes','Journal','Moments'].includes(category))throw httpError(400,'Invalid category','INVALID_CATEGORY');
    if(year&&!/^(19|20)\d{2}$/.test(year))throw httpError(400,'Invalid publication year','INVALID_YEAR');
    const filters=["p.state='published'"],args=[];
    const like=(v)=>'%'+v.replace(/[\\%_]/g,'\\$&')+'%';
    if(q){const query=like(q);filters.push("(p.title LIKE ? ESCAPE '\\' OR p.excerpt LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')");args.push(query,query,query);}
    if(category&&category!=='Latest'){filters.push('p.category=?');args.push(category)}
    if(year){filters.push('substr(p.published_at,1,4)=?');args.push(year)}
    if(tag){filters.push('EXISTS(SELECT 1 FROM json_each(p.tags) WHERE value=?)');args.push(tag)}
    const where=filters.join(' AND ');
    const total=Number(this.store.one('SELECT count(*) AS total FROM posts p WHERE '+where,...args)?.total||0);
    const rows=this.store.all('SELECT p.* FROM posts p WHERE '+where+' ORDER BY p.published_at DESC,p.id DESC LIMIT ? OFFSET ?',...args,limit,offset).map(publicPost);
    return {items:rows,total,nextOffset:offset+rows.length<total?offset+rows.length:null};
  }
  archive(year){
    this.assertEnabled('SEARCH');
    if(year!==undefined && year!=='' && !/^(19|20)\d{2}$/.test(String(year)))throw httpError(400,'Invalid year','INVALID_YEAR');
    const years=this.store.all("SELECT substr(published_at,1,4) AS year,count(*) AS total FROM posts WHERE state='published' AND published_at IS NOT NULL GROUP BY year ORDER BY year DESC LIMIT 50");
    return {years,items:year?this.search({year,limit:40}).items:[]};
  }
  listGuestbook({limit=30,offset=0}={}){
    this.assertEnabled('GUESTBOOK');
    const take=clamp(Number(limit)||30,1,50),skip=clamp(Number(offset)||0,0,5000);
    const rows=this.store.all("SELECT id,author_name AS name,message,created_at AS createdAt FROM v3_guestbook WHERE state='approved' ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",take,skip);
    return rows;
  }
  submitGuestbook({name,message,honeypot='',consent=false}={},actor=null){
    this.assertEnabled('GUESTBOOK');
    if(honeypot)return {accepted:true};
    if(consent!==true)throw httpError(400,'Confirm that your note can be displayed after review.','CONSENT_REQUIRED');
    const author=content(name,65),note=content(message,550);
    if(author.length<2||author.length>60||note.length<5||note.length>500)throw httpError(400,'Use a name and message within the limits.','INVALID_GUESTBOOK');
    if(/<[^>]+>|https?:\/\/|www\./i.test(note))throw httpError(400,'Please omit HTML and links.','LINK_NOT_ALLOWED');
    const id=uid('guest'),time=now();
    this.store.exec('INSERT INTO v3_guestbook(id,author_name,message,member_id,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,author,note,actor?.role==='member'?actor.id:null,'pending',time,time);
    return {accepted:true,state:'pending'};
  }
  manageGuestbook(user,{id,state}={}){
    if(!['owner','admin','moderator'].includes(user?.role))throw httpError(403,'Moderation permission required.','ROLE_FORBIDDEN');
    if(!['approved','hidden','deleted'].includes(state))throw httpError(400,'Invalid review action.','INVALID_STATE');
    const row=this.store.one('SELECT id FROM v3_guestbook WHERE id=?',String(id||''));
    if(!row)throw httpError(404,'Note not found.','NOT_FOUND');
    const time=now();
    this.store.exec('UPDATE v3_guestbook SET state=?,updated_at=?,moderated_at=?,moderated_by=? WHERE id=?',state,time,time,user.id,id);
    this.store.audit(user.id,'v3.guestbook.'+state,'guestbook',id);
    return {id,state};
  }
  reviewQueue(user){
    if(!['owner','admin','moderator'].includes(user?.role))throw httpError(403,'Moderation permission required.','ROLE_FORBIDDEN');
    return this.store.all("SELECT id,author_name AS name,message,created_at AS createdAt,state FROM v3_guestbook WHERE state='pending' ORDER BY created_at ASC LIMIT 100");
  }
  async follow({email,topics=['all'],frequency='weekly',consent=false,honeypot=''}={}){
    this.assertEnabled('FOLLOW');
    if(honeypot)return {accepted:true};
    if(consent!==true)throw httpError(400,'Please opt in explicitly to receive updates.','CONSENT_REQUIRED');
    if(!this.sendMail)throw httpError(503,'Following by email is not ready.','MAIL_UNAVAILABLE');
    const address=safeEmail(email);
    if(!Array.isArray(topics)||topics.length<1||topics.length>5||topics.some(x=>!validTopics.includes(x)))throw httpError(400,'Choose valid topics.','INVALID_TOPICS');
    if(!['weekly','instant'].includes(frequency))throw httpError(400,'Invalid frequency.','INVALID_FREQUENCY');
    const normalizedTopics=[...new Set(topics)];
    const emailHash=normalizedHash(address,this.env),existing=this.store.one('SELECT * FROM v3_follows WHERE email_hash=?',emailHash);
    if(existing?.state==='active'||existing?.state==='bounced')return {accepted:true,message:'If eligible, a verification email has been sent.'};
    const id=existing?.id||uid('follow'),token=crypto.randomBytes(32).toString('base64url'),time=now();
    const insert=()=>this.store.exec('INSERT INTO v3_follows(id,email_hash,email_cipher,topics,frequency,state,consent_version,consent_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      id,emailHash,encrypt(address,this.env),JSON.stringify(normalizedTopics),frequency,'pending','v3.0',time,time,time);
    this.store.transaction(()=>{
      if(existing)this.store.exec("UPDATE v3_follows SET state='pending',topics=?,frequency=?,consent_at=?,updated_at=?,revoked_at=NULL WHERE id=?",JSON.stringify(normalizedTopics),frequency,time,time,id);
      else insert();
      this.store.exec("UPDATE v3_follow_tokens SET consumed_at=? WHERE follow_id=? AND purpose='verify' AND consumed_at IS NULL",time,id);
      this.store.exec('INSERT INTO v3_follow_tokens(id,follow_id,purpose,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?)',uid('token'),id,'verify',hashToken(token),dateAfter(1),time);
      this.store.exec('INSERT INTO v3_follow_consent(id,follow_id,event,notice_version,recorded_at) VALUES(?,?,?,?,?)',uid('consent'),id,'requested','v3.0',time);
    });
    const url=(this.env.SITE_URL||'http://localhost:4141').replace(/\/$/,'')+'/follow/confirm#token='+encodeURIComponent(token);
    try {
      await this.sendMail({to:address,subject:"Confirm your Vamsi's Corner updates",text:"Confirm your optional updates by opening "+url+"\nThis link expires in one hour. If you did not request it, ignore this message.",reference:'corner-v3-follow-'+id+'-'+time});
    }catch{
      // Don't reveal provider details or account existence publicly.
      throw httpError(502,'Verification email could not be sent. Please try again.','MAIL_FAILED');
    }
    return {accepted:true,message:'If eligible, a verification email has been sent.'};
  }
  verifyFollow(token){
    this.assertEnabled('FOLLOW');
    const hash=hashToken(String(token||'')),time=now();
    if(String(token||'').length<30)throw httpError(400,'Invalid or expired link.','TOKEN_INVALID');
    let activated;
    this.store.transaction(()=>{
      const row=this.store.one("SELECT * FROM v3_follow_tokens WHERE token_hash=? AND purpose='verify' AND consumed_at IS NULL AND expires_at>?",hash,time);
      if(!row)throw httpError(400,'Invalid or expired link.','TOKEN_INVALID');
      const follow=this.store.one('SELECT * FROM v3_follows WHERE id=?',row.follow_id);
      if(!follow||follow.state!=='pending')throw httpError(400,'Subscription is unavailable.','TOKEN_INVALID');
      this.store.exec('UPDATE v3_follow_tokens SET consumed_at=? WHERE id=? AND consumed_at IS NULL',time,row.id);
      this.store.exec("UPDATE v3_follows SET state='active',verified_at=?,updated_at=? WHERE id=?",time,time,follow.id);
      this.store.exec('INSERT INTO v3_follow_consent(id,follow_id,event,notice_version,recorded_at) VALUES(?,?,?,?,?)',uid('consent'),follow.id,'verified','v3.0',time);
      activated=true;
    });
    return {verified:activated};
  }
  async requestUnsubscribe({email}={}){
    this.assertEnabled('FOLLOW');
    const address=safeEmail(email),idHash=normalizedHash(address,this.env);
    const row=this.store.one("SELECT * FROM v3_follows WHERE email_hash=? AND state='active'",idHash);
    if(!row)return {accepted:true};
    if(!this.sendMail)throw httpError(503,'Email is unavailable.','MAIL_UNAVAILABLE');
    const token=crypto.randomBytes(32).toString('base64url'),time=now();
    this.store.transaction(()=>{
      this.store.exec("UPDATE v3_follow_tokens SET consumed_at=? WHERE follow_id=? AND purpose='unsubscribe' AND consumed_at IS NULL",time,row.id);
      this.store.exec("INSERT INTO v3_follow_tokens(id,follow_id,purpose,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?)",uid('token'),row.id,'unsubscribe',hashToken(token),dateAfter(24),time);
    });
    const link=(this.env.SITE_URL||'http://localhost:4141').replace(/\/$/,'')+'/follow/unsubscribe#token='+encodeURIComponent(token);
    await this.sendMail({to:address,subject:'Manage your Vamsi’s Corner subscription',text:'Open this link to unsubscribe from publication updates: '+link+'\nThe link expires in 24 hours.',reference:'corner-v3-unsubscribe-'+row.id+'-'+time});
    return {accepted:true};
  }
  unsubscribeFollow(token){
    this.assertEnabled('FOLLOW');
    const time=now(),hash=hashToken(String(token||''));
    if(String(token||'').length<30)throw httpError(400,'Invalid or expired link.','TOKEN_INVALID');
    let result;
    this.store.transaction(()=>{
      const row=this.store.one("SELECT * FROM v3_follow_tokens WHERE token_hash=? AND purpose='unsubscribe' AND consumed_at IS NULL AND expires_at>?",hash,time);
      if(!row)throw httpError(400,'Invalid or expired link.','TOKEN_INVALID');
      this.store.exec('UPDATE v3_follow_tokens SET consumed_at=? WHERE id=?',time,row.id);
      this.store.exec("UPDATE v3_follows SET state='unsubscribed',updated_at=?,revoked_at=? WHERE id=?",time,time,row.follow_id);
      this.store.exec("UPDATE v3_follow_tokens SET consumed_at=? WHERE follow_id=? AND consumed_at IS NULL",time,row.follow_id);
      this.store.exec("INSERT INTO v3_follow_consent(id,follow_id,event,notice_version,recorded_at) VALUES(?,?,?,?,?)",uid('consent'),row.follow_id,'unsubscribed','v3.0',time);
      result={unsubscribed:true};
    });
    return result;
  }
  reading(actor,postId,progress){
    this.assertEnabled('READING');
    if(!actor||actor.role!=='member')throw httpError(401,'Member login required.','AUTH_REQUIRED');
    const post=this.store.getPostById(String(postId||''));
    if(!post)throw httpError(404,'Post not found.','NOT_FOUND');
    if(progress===undefined){
      const p=this.store.one('SELECT progress,updated_at AS updatedAt FROM v3_reading_positions WHERE user_id=? AND post_id=?',actor.id,postId);
      return {progress:p?.progress??0,updatedAt:p?.updatedAt||null};
    }
    if(progress===null){this.store.exec('DELETE FROM v3_reading_positions WHERE user_id=? AND post_id=?',actor.id,postId);return {progress:0,updatedAt:null};}
    if(typeof progress!=='number'||!Number.isInteger(progress)||progress<0||progress>100)throw httpError(400,'Progress must be an integer from 0 to 100.','INVALID_PROGRESS');
    const time=now();
    this.store.exec('INSERT INTO v3_reading_positions(user_id,post_id,progress,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,post_id) DO UPDATE SET progress=excluded.progress,updated_at=excluded.updated_at',actor.id,postId,progress,time);
    return {progress,updatedAt:time};
  }
}
