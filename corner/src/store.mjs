import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { config } from './config.mjs';
import { uid, now, sha, slugify, pureText, parseTags, TYPES, REACTIONS, typeCategories, encodeCursor, decodeCursor, nextYearly, httpError, clamp, isValidTimeZone } from './domain.mjs';
const SCHEMA=fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'schema.sql'),'utf8');
const bool=(v)=>v?1:0;
const normPost=(r)=>r ? {...r,tags:JSON.parse(r.tags||'[]'),featured:!!r.featured,pinned:!!r.pinned,allow_comments:!!r.allow_comments,allow_reactions:!!r.allow_reactions,milestone:!!r.milestone}:null;
const pubFields=['id','slug','type','title','excerpt','body','emoji','category','tags','published_at','updated_at','featured','pinned','allow_comments','allow_reactions','milestone','version','created_at'];
export const publicPost=(r)=>{const p=normPost(r);if(!p)return null;return Object.fromEntries(pubFields.map(k=>[k,p[k]]));};
export class Store{
  constructor(location=config.dbPath){
    this.location=location;this.events=new EventEmitter();this.events.setMaxListeners(200);
    if(location!==':memory:')fs.mkdirSync(path.dirname(location),{recursive:true});
    this.db=new DatabaseSync(location);this.db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;');
    if(location!==':memory:')this.db.exec('PRAGMA journal_mode=WAL;');
    this.db.exec(SCHEMA);
    // Upgrade earlier local V1 databases in place, without deleting content.
    const columns=this.db.prepare('PRAGMA table_info(posts)').all().map(c=>c.name);
    if(!columns.includes('upcoming_public'))this.db.exec('ALTER TABLE posts ADD COLUMN upcoming_public INTEGER NOT NULL DEFAULT 0');
    if(!columns.includes('recurrence_end_year'))this.db.exec('ALTER TABLE posts ADD COLUMN recurrence_end_year INTEGER');
    this.statements=new Map();
  }
  close(){this.db.close()}
  exec(sql,...values){let stmt=this.statements.get(sql);if(!stmt){stmt=this.db.prepare(sql);this.statements.set(sql,stmt)}return stmt.run(...values)}
  one(sql,...values){let stmt=this.statements.get(sql);if(!stmt){stmt=this.db.prepare(sql);this.statements.set(sql,stmt)}return stmt.get(...values)||null}
  all(sql,...values){let stmt=this.statements.get(sql);if(!stmt){stmt=this.db.prepare(sql);this.statements.set(sql,stmt)}return stmt.all(...values)}
  transaction(work){this.db.exec('BEGIN IMMEDIATE');try{const result=work();this.db.exec('COMMIT');return result}catch(err){this.db.exec('ROLLBACK');throw err}}
  setting(key,fallback=''){const r=this.one('SELECT value FROM settings WHERE key=?',key);return r?JSON.parse(r.value):fallback}
  saveSetting(key,value){this.exec('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',key,JSON.stringify(value),now());return value}
  owner(){return this.one("SELECT * FROM users WHERE role='owner' AND disabled_at IS NULL LIMIT 1")}
  bootstrap(email,hash){
    if(!email||!hash)return false;
    const previous=this.owner();
    if(previous){
      if(previous.email!==email)throw Error('Configured owner email does not match the existing owner. Explicit migration is required.');
      if(previous.password_hash!==hash){
        this.transaction(()=>{
          const stamp=now();
          this.exec('UPDATE users SET password_hash=?,updated_at=? WHERE id=?',hash,stamp,previous.id);
          this.exec('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',stamp,previous.id);
          this.audit(previous.id,'owner.password_rotated','user',previous.id);
        });
      }
      return false;
    }
    const stamp=now();
    this.exec('INSERT INTO users(id,email,display_name,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)',uid('usr'),email,'Vamsi',hash,stamp,stamp);
    return true;
  }
  findOwner(email){return this.one("SELECT * FROM users WHERE role='owner' AND email=? AND disabled_at IS NULL",email)}
  createSession(user,token,ip='',agent=''){
    let stamp=now(),expires=new Date(Date.now()+8*3600000).toISOString();
    this.exec('INSERT INTO sessions(id,user_id,token_hash,created_at,expires_at,ip_hash,user_agent_hash) VALUES(?,?,?,?,?,?,?)',uid('sess'),user.id,sha(token),stamp,expires,sha(ip).slice(0,22),sha(agent).slice(0,22));
    this.exec('UPDATE users SET last_login_at=? WHERE id=?',stamp,user.id);this.audit(user.id,'session.started','session',null);
    return expires;
  }
  session(token){if(!token)return null;return this.one('SELECT users.id,users.email,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.revoked_at IS NULL AND sessions.expires_at>? AND users.disabled_at IS NULL',sha(token),now())}
  revokeSession(token){this.exec('UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL',now(),sha(token))}
  audit(actor,action,type,id,meta={}){this.exec('INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,metadata,occurred_at) VALUES(?,?,?,?,?,?,?)',uid('audit'),actor||null,action,type||null,id||null,JSON.stringify(meta),now())}
  emit(type,entityId,version=1,payload={}){
    const event={id:uid('evt'),type,occurredAt:now(),entityId,version,payload};
    let info=this.exec('INSERT INTO realtime_events(id,type,occurred_at,entity_id,version,payload) VALUES(?,?,?,?,?,?)',event.id,type,event.occurredAt,entityId||null,version,JSON.stringify(payload));
    event.seq=Number(info.lastInsertRowid);this.events.emit('public-event',event);return event;
  }
  replay(lastId){
    const seq=Number(lastId)||0;if(seq<0||seq>Number.MAX_SAFE_INTEGER)return [];
    return this.all('SELECT seq,id,type,occurred_at,entity_id,version,payload FROM realtime_events WHERE seq>? ORDER BY seq ASC LIMIT 80',seq).map(e=>({id:e.id,seq:e.seq,type:e.type,occurredAt:e.occurred_at,entityId:e.entity_id,version:e.version,payload:JSON.parse(e.payload)}));
  }
  currentStatus(){let status=this.one('SELECT * FROM site_status WHERE id=1');if(!status||!status.is_active)return null;let stamp=now();if(status.active_from&&status.active_from>stamp)return null;if(status.active_until&&status.active_until<=stamp)return null;return {label:status.label,detail:status.detail,icon:status.icon,version:status.version,updatedAt:status.updated_at};}
  updateStatus(data,actor){
    const label=pureText(data.label,55), detail=pureText(data.detail,115),icon=pureText(data.icon,8)||'✳';let timestamp=now(),prev=this.one('SELECT version FROM site_status WHERE id=1');const version=(prev?.version||0)+1;
    this.exec('UPDATE site_status SET label=?,detail=?,icon=?,is_active=?,active_from=?,active_until=?,version=?,updated_at=? WHERE id=1',label,detail,icon,bool(data.isActive&&label),data.activeFrom||null,data.activeUntil||null,version,timestamp);
    this.audit(actor,'status.updated','site_status','1');this.emit('status.updated','1',version,{status:this.currentStatus()});return this.currentStatus();
  }
  validatePost(fields,method='draft'){
    let type=String(fields.type||'tech_note');if(!TYPES.includes(type))throw httpError(400,'Choose a valid content type.');
    const title=pureText(fields.title,180),excerpt=pureText(fields.excerpt,380),body=pureText(fields.body,25000),emoji=pureText(fields.emoji,8),tags=parseTags(fields.tags),category=typeCategories[type];
    if(!title||title.length>150)throw httpError(400,'A title of up to 150 characters is required.');
    if(method!=='draft'&&!body&&!Array.isArray(fields.mediaIds))throw httpError(400,'Add some content or media before publishing.');
    const timezone=fields.timezone||config.timezone;
    if(!isValidTimeZone(timezone))throw httpError(400,'Select a valid IANA timezone.');
    return {type,title,excerpt,body,emoji,category,tags,featured:bool(fields.featured),pinned:bool(fields.pinned),allow_comments:bool(fields.allowComments??fields.allow_comments),allow_reactions:fields.allowReactions===false||fields.allowReactions===0?0:fields.allowReactions===undefined&&fields.allow_reactions===0?0:1,milestone:bool(fields.milestone),upcoming_public:bool(fields.upcomingPublic??fields.upcoming_public),timezone};
  }
  uniqueSlug(base,exclude=''){let slug=slugify(base),n=2;while(this.one('SELECT id FROM posts WHERE slug=? AND id<>?',slug,exclude)){slug=slugify(base).slice(0,80)+'-'+n++;}return slug;}
  createPost(payload,actor){
    const data=this.validatePost(payload,'draft'),stamp=now(),id=uid('post'),slug=this.uniqueSlug(payload.slug||data.title);
    this.exec(`INSERT INTO posts(id,slug,type,title,excerpt,body,emoji,category,tags,featured,pinned,allow_comments,allow_reactions,milestone,upcoming_public,timezone,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,id,slug,data.type,data.title,data.excerpt,data.body,data.emoji,data.category,JSON.stringify(data.tags),data.featured,data.pinned,data.allow_comments,data.allow_reactions,data.milestone,data.upcoming_public,data.timezone,stamp,stamp);
    this.audit(actor,'post.created','post',id);return normPost(this.one('SELECT * FROM posts WHERE id=?',id));
  }
  savePost(id,payload,actor){
    const prev=this.one('SELECT * FROM posts WHERE id=?',id);if(!prev)throw httpError(404,'Post not found.');
    if(prev.state==='archived')throw httpError(409,'Restore the post before editing.');
    if(Number(payload.version)!==prev.version)throw httpError(409,'Another edit was saved. Reload before overwriting.','VERSION_CONFLICT');
    const merged={...normPost(prev),...payload};
    if(!Object.hasOwn(merged,'allowComments'))merged.allowComments=!!prev.allow_comments;
    if(!Object.hasOwn(merged,'allowReactions'))merged.allowReactions=!!prev.allow_reactions;
    const data=this.validatePost(merged,'draft'),stamp=now(),version=prev.version+1;
    this.exec(`UPDATE posts SET type=?,title=?,excerpt=?,body=?,emoji=?,category=?,tags=?,featured=?,pinned=?,allow_comments=?,allow_reactions=?,milestone=?,upcoming_public=?,timezone=?,updated_at=?,version=? WHERE id=?`,data.type,data.title,data.excerpt,data.body,data.emoji,data.category,JSON.stringify(data.tags),data.featured,data.pinned,data.allow_comments,data.allow_reactions,data.milestone,data.upcoming_public,data.timezone,stamp,version,id);
    this.audit(actor,'post.updated','post',id);
    if(prev.state==='published')this.emit('post.updated',id,version,{slug:prev.slug});
    return normPost(this.one('SELECT * FROM posts WHERE id=?',id));
  }
  allAdminPosts(state='all'){
    const rows=state==='all'?this.all('SELECT * FROM posts ORDER BY updated_at DESC LIMIT 200'):this.all('SELECT * FROM posts WHERE state=? ORDER BY updated_at DESC LIMIT 200',state);
    return rows.map(normPost);
  }
  adminPost(id){return normPost(this.one('SELECT * FROM posts WHERE id=?',id));}
  publish(id,actor){
    let row=this.one('SELECT * FROM posts WHERE id=?',id);if(!row)throw httpError(404,'Post not found');if(!row.body&&!this.one("SELECT id FROM media WHERE owner_id=? AND owner_type='post' LIMIT 1",id))throw httpError(400,'Add body or media before publishing');
    if(row.state==='published')return normPost(row);
    const stamp=now(),ver=row.version+1;
    this.exec("UPDATE posts SET state='published',published_at=?,scheduled_at=NULL,updated_at=?,version=?,archived_at=NULL WHERE id=?",stamp,stamp,ver,id);
    this.audit(actor,'post.published','post',id);this.emit('post.published',id,ver,{slug:row.slug});return this.adminPost(id);
  }
  archive(id,actor){const row=this.one('SELECT * FROM posts WHERE id=?',id);if(!row)throw httpError(404,'Post not found');if(row.state==='archived')return normPost(row);this.exec("UPDATE posts SET state='archived',archived_at=?,updated_at=?,version=version+1 WHERE id=?",now(),now(),id);this.audit(actor,'post.archived','post',id);if(row.state==='published')this.emit('post.archived',id,row.version+1,{slug:row.slug});return this.adminPost(id)}
  restore(id,actor){let row=this.one('SELECT * FROM posts WHERE id=?',id);if(!row)throw httpError(404,'Post not found');if(row.state!=='archived')throw httpError(409,'Only archived posts can be restored');const state=row.published_at?'published':'draft';this.exec('UPDATE posts SET state=?,archived_at=NULL,version=version+1,updated_at=? WHERE id=?',state,now(),id);this.audit(actor,'post.restored','post',id);if(state==='published')this.emit('post.published',id,row.version+1,{slug:row.slug});return this.adminPost(id)}
  schedule(id,payload,actor){
    const row=this.one('SELECT * FROM posts WHERE id=?',id);if(!row)throw httpError(404,'Post not found');if(!row.body&&!this.one("SELECT id FROM media WHERE owner_id=? AND owner_type='post' LIMIT 1",id))throw httpError(400,'Add content or media before scheduling');
    if(row.state==='archived')throw httpError(409,'Restore the post before scheduling');
    const when=String(payload.scheduledAt||'');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(when)||!Number.isFinite(Date.parse(when))||Date.parse(when)<Date.now()+5000)throw httpError(400,'Choose a valid future schedule');
    const recurrence=payload.recurrence==='yearly'?'yearly':'none',tz=payload.timezone||config.timezone;
    if(!isValidTimeZone(tz))throw httpError(400,'Invalid scheduling timezone');
    if(recurrence==='yearly'&&row.type!=='wish')throw httpError(400,'Yearly recurrence is available for wishes');
    let month=null,day=null,clock=null;
    if(recurrence==='yearly'){
      const m=String(payload.localTime||'').match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}:\d{2})$/);
      if(!m)throw httpError(400,'Use a local date and time for yearly wishes.');month=Number(m[1]);day=Number(m[2]);clock=m[3];
    }
    const recurrenceEndYear=payload.recurrenceEndYear==null||payload.recurrenceEndYear===''?null:Number(payload.recurrenceEndYear);
    if(recurrence==='yearly'&&recurrenceEndYear!==null&&(!Number.isInteger(recurrenceEndYear)||recurrenceEndYear<new Date(when).getUTCFullYear()||recurrenceEndYear>2200))throw httpError(400,'Invalid yearly recurrence end year');
    const windows={};for(const [field,key] of [['featureStartAt','feature_start_at'],['featureEndAt','feature_end_at'],['pinStartAt','pin_start_at'],['pinEndAt','pin_end_at']]){
      const value=payload[field];if(value==null||value===''){windows[key]=null;continue}
      const stamp=Date.parse(value);if(!Number.isFinite(stamp)||!String(value).endsWith('Z'))throw httpError(400,'Invalid UTC date for '+field);windows[key]=new Date(stamp).toISOString();
    }
    if(windows.feature_start_at&&windows.feature_end_at&&windows.feature_end_at<=windows.feature_start_at)throw httpError(400,'Feature window end must be after its start');
    if(windows.pin_start_at&&windows.pin_end_at&&windows.pin_end_at<=windows.pin_start_at)throw httpError(400,'Pin window end must be after its start');
    this.exec("UPDATE posts SET state='scheduled',scheduled_at=?,timezone=?,recurrence=?,recurrence_month=?,recurrence_day=?,recurrence_time=?,recurrence_end_year=?,feature_start_at=?,feature_end_at=?,pin_start_at=?,pin_end_at=?,updated_at=?,version=version+1 WHERE id=?",new Date(when).toISOString(),tz,recurrence,month,day,clock,recurrenceEndYear,windows.feature_start_at,windows.feature_end_at,windows.pin_start_at,windows.pin_end_at,now(),id);
    this.audit(actor,'post.scheduled','post',id,{recurrence});return this.adminPost(id);
  }
  getFeed({category,limit=15,cursor,tag}={}){
    let clauses=["state='published'"],args=[],size=clamp(Number(limit)||15,1,30);
    if(category&&category!=='Latest'){const cat={Wishes:'Wishes',Builds:'Builds',Notes:'Notes',Journal:'Journal',Moments:'Moments'}[category];if(!cat)return {items:[],nextCursor:null};clauses.push('category=?');args.push(cat)}
    if(tag){clauses.push('EXISTS (SELECT 1 FROM json_each(posts.tags) WHERE value=?)');args.push(tag)}
    let parsed=decodeCursor(cursor);if(parsed){clauses.push('(published_at<? OR (published_at=? AND id<?))');args.push(parsed[0],parsed[0],parsed[1]);}
    const records=this.all(`SELECT * FROM posts WHERE ${clauses.join(' AND ')} ORDER BY published_at DESC,id DESC LIMIT ?`,...args,size+1);
    const more=records.length>size,items=records.slice(0,size),last=items.at(-1);
    return {items:items.map(publicPost),nextCursor:more&&last?encodeCursor(last):null};
  }
  getPost(slug){let r=this.one("SELECT * FROM posts WHERE slug=? AND state='published'",slug);return publicPost(r)}
  getPostById(id){let r=this.one("SELECT * FROM posts WHERE id=? AND state='published'",id);return publicPost(r)}
  getFeatured(){let r=this.one("SELECT * FROM posts WHERE state='published' AND featured=1 ORDER BY published_at DESC LIMIT 1");return publicPost(r)}
  getPin(){return this.all("SELECT * FROM posts WHERE state='published' AND pinned=1 ORDER BY published_at DESC LIMIT 2").map(publicPost)}
  onThisDay(){const stamp=now(),today=stamp.slice(5,10),currentYear=Number(stamp.slice(0,4));return this.all("SELECT * FROM posts WHERE state='published' AND substr(published_at,6,5)=? AND CAST(substr(published_at,1,4) AS INTEGER)<? ORDER BY published_at DESC LIMIT 2",today,currentYear).map(publicPost)}
  // Future wishes are private unless the owner explicitly enables a teaser.
  upcoming(publicOnly=false){return this.all(`SELECT title,emoji,scheduled_at,timezone FROM posts WHERE state='scheduled' AND scheduled_at>? ${publicOnly?'AND upcoming_public=1':''} ORDER BY scheduled_at ASC LIMIT 3`,now())}
  search(q,limit=30){q=pureText(q,100);if(!q)return [];const wildcard='%'+q.replace(/[\\%_]/g,'\\$&')+'%';return this.all(`SELECT * FROM posts WHERE state='published' AND (title LIKE ? ESCAPE '\\' OR excerpt LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\') ORDER BY published_at DESC LIMIT ?`,wildcard,wildcard,wildcard,wildcard,clamp(Number(limit)||30,1,60)).map(publicPost)}
  getReactions(postId){return Object.fromEntries(this.all('SELECT reaction_type,count(*) AS total FROM reactions WHERE post_id=? GROUP BY reaction_type',postId).map(r=>[r.reaction_type,r.total]))}
  changeReaction(postId,type,actor){const post=this.getPostById(postId);if(!post||!post.allow_reactions)throw httpError(404,'Reactions unavailable.');if(!REACTIONS.includes(type))throw httpError(400,'Invalid reaction');
    const prev=this.one('SELECT * FROM reactions WHERE post_id=? AND actor_key=?',postId,actor);
    if(prev&&prev.reaction_type===type)this.exec('DELETE FROM reactions WHERE id=?',prev.id);
    else if(prev)this.exec('UPDATE reactions SET reaction_type=?,updated_at=? WHERE id=?',type,now(),prev.id);
    else this.exec('INSERT INTO reactions(id,post_id,reaction_type,actor_key,created_at,updated_at) VALUES(?,?,?,?,?,?)',uid('react'),postId,type,actor,now(),now());
    const counts=this.getReactions(postId);this.emit('reaction.updated',postId,post.version,{counts});return {counts,yours:prev?.reaction_type===type?null:type};
  }
  getComments(postId){if(!this.getPostById(postId))throw httpError(404,'Post not found');return this.all("SELECT id,author_name,body,created_at FROM comments WHERE post_id=? AND state='approved' ORDER BY created_at ASC LIMIT 200",postId)}
  comment(postId,name,body){const post=this.getPostById(postId);if(!post||!post.allow_comments)throw httpError(404,'Comments are closed');const cleanName=pureText(name,60),cleanBody=pureText(body,1000);if(cleanName.length<2||cleanBody.length<3||cleanBody.length>1000)throw httpError(400,'Name and a short comment are required');let id=uid('comment'),stamp=now();this.exec('INSERT INTO comments(id,post_id,author_name,body,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,postId,cleanName,cleanBody,'pending',stamp,stamp);return {id,state:'pending',message:'Thanks. Your comment is awaiting review.'};}
  pendingComments(state='pending'){if(!['pending','approved','hidden','deleted'].includes(state))throw httpError(400,'Invalid moderation filter');return this.all('SELECT comments.*,posts.title AS post_title FROM comments JOIN posts ON posts.id=comments.post_id WHERE comments.state=? ORDER BY comments.created_at DESC LIMIT 100',state)}
  moderate(id,state,actor){if(!['approved','hidden','deleted'].includes(state))throw httpError(400,'Invalid moderation state');let comment=this.one('SELECT * FROM comments WHERE id=?',id);if(!comment)throw httpError(404,'Comment not found');this.exec('UPDATE comments SET state=?,updated_at=?,deleted_at=? WHERE id=?',state,now(),state==='deleted'?now():null,id);this.audit(actor,'comment.'+state,'comment',id);this.emit(state==='approved'?'comment.created':'comment.removed',comment.post_id,1,{commentId:id});return {id,state};}
  addMedia(meta){this.exec('INSERT INTO media(id,owner_type,owner_id,storage_key,mime_type,size_bytes,width,height,alt_text,caption,focal_x,focal_y,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',meta.id,'post',meta.ownerId||null,meta.storageKey,meta.mimeType,meta.size,meta.width??null,meta.height??null,meta.alt||'',meta.caption||'',meta.focalX??.5,meta.focalY??.5,now());return this.one('SELECT * FROM media WHERE id=?',meta.id)}
  listMedia(ownerId){const row=this.one('SELECT parent_post_id FROM posts WHERE id=?',ownerId);return this.all('SELECT id,storage_key,mime_type,size_bytes,alt_text,caption,focal_x,focal_y,created_at FROM media WHERE owner_id=? ORDER BY created_at ASC',ownerId===undefined?null:(row?.parent_post_id||ownerId))}
  updateMedia(id,fields,actor){let row=this.one('SELECT * FROM media WHERE id=?',id);if(!row)throw httpError(404,'Media not found');const alt=pureText(fields.altText??row.alt_text,240),caption=pureText(fields.caption??row.caption,300),focalX=clamp(Number(fields.focalX??row.focal_x),0,1),focalY=clamp(Number(fields.focalY??row.focal_y),0,1);this.exec('UPDATE media SET alt_text=?,caption=?,focal_x=?,focal_y=? WHERE id=?',alt,caption,focalX,focalY,id);this.audit(actor,'media.updated','media',id);return this.one('SELECT * FROM media WHERE id=?',id)}
  deleteMedia(id,actor){const media=this.one('SELECT * FROM media WHERE id=?',id);if(!media)throw httpError(404,'Media not found');
    this.exec('DELETE FROM media WHERE id=?',id);this.audit(actor,'media.deleted','media',id);
    const post=this.one('SELECT slug,state,version FROM posts WHERE id=?',media.owner_id);
    if(post?.state==='published')this.emit('post.updated',media.owner_id,post.version,{slug:post.slug});
    return media;
  }
  analytics(type,postId,path='',visitor='',device='desktop'){
    if(!['page_view','post_open','share'].includes(type))return;
    this.exec('INSERT INTO analytics_events(id,type,post_id,session_key,path,device_class,occurred_at) VALUES(?,?,?,?,?,?,?)',uid('metric'),type,postId||null,visitor||null,pureText(path,300),pureText(device,20),now());
  }
  metrics(){const start=new Date(Date.now()-7*86400000).toISOString();let rows=this.all("SELECT type,count(*) AS n FROM analytics_events WHERE occurred_at>=? GROUP BY type",start);let stats=Object.fromEntries(rows.map(r=>[r.type,r.n]));let posts=this.one("SELECT sum(state='draft') AS drafts,sum(state='scheduled') AS scheduled,sum(state='published') AS published FROM posts");return {...stats,...posts,pendingComments:this.one("SELECT count(*) AS n FROM comments WHERE state='pending'").n,upcoming:this.upcoming()[0]||null,live:this.currentStatus()};}
  cleanup(){const old=new Date(Date.now()-90*86400000).toISOString();this.exec('DELETE FROM analytics_events WHERE occurred_at<?',old);this.exec('DELETE FROM realtime_events WHERE occurred_at<?',new Date(Date.now()-3*86400000).toISOString());this.exec('DELETE FROM sessions WHERE expires_at<?',now());this.exec('DELETE FROM rate_buckets WHERE reset_at<?',now())}
  rateLimit(key,max,seconds){const timestamp=now(),reset=new Date(Date.now()+seconds*1000).toISOString();let row=this.one('SELECT count,reset_at FROM rate_buckets WHERE key=?',key);if(!row||row.reset_at<=timestamp){this.exec('INSERT INTO rate_buckets(key,count,reset_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=1,reset_at=excluded.reset_at',key,1,reset);return true}if(row.count>=max)return false;this.exec('UPDATE rate_buckets SET count=count+1 WHERE key=?',key);return true;}
  tick(at=now()){
    if(!Number.isFinite(Date.parse(at)))throw httpError(400,'Invalid scheduler clock');
    const scheduled=this.all("SELECT * FROM posts WHERE state='scheduled' AND scheduled_at<=? ORDER BY scheduled_at LIMIT 100",at);let fired=[];
    for(const post of scheduled){let out=this.transaction(()=>{
      const live=this.one('SELECT * FROM posts WHERE id=?',post.id);if(!live||live.state!=='scheduled'||live.scheduled_at!==post.scheduled_at)return null;
      const key=live.id+':'+live.scheduled_at; if(this.one('SELECT id FROM post_occurrences WHERE execution_key=?',key))return null;
      const stamp=at,recurring=live.recurrence==='yearly';let publishedId=live.id,publishedSlug=live.slug;
      const featured=live.featured&&(!live.feature_start_at||live.feature_start_at<=stamp)&&(!live.feature_end_at||live.feature_end_at>stamp)?1:0;
      const pinned=live.pinned&&(!live.pin_start_at||live.pin_start_at<=stamp)&&(!live.pin_end_at||live.pin_end_at>stamp)?1:0;
      if(recurring){publishedId=uid('post');publishedSlug=this.uniqueSlug(live.slug+'-'+new Date(live.scheduled_at).getUTCFullYear());
        this.exec(`INSERT INTO posts(id,parent_post_id,slug,type,title,excerpt,body,emoji,category,tags,state,published_at,timezone,recurrence,featured,feature_start_at,feature_end_at,pinned,pin_start_at,pin_end_at,allow_comments,allow_reactions,milestone,version,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,publishedId,live.id,publishedSlug,live.type,live.title,live.excerpt,live.body,live.emoji,live.category,live.tags,'published',stamp,live.timezone,'none',featured,live.feature_start_at,live.feature_end_at,pinned,live.pin_start_at,live.pin_end_at,live.allow_comments,live.allow_reactions,live.milestone,1,stamp,stamp);
        const next=nextYearly(live.recurrence_month,live.recurrence_day,live.recurrence_time,live.timezone,live.scheduled_at);
        const beyondEnd=live.recurrence_end_year&&new Date(next).getUTCFullYear()>live.recurrence_end_year;
        this.exec('UPDATE posts SET state=?,scheduled_at=?,updated_at=?,version=version+1 WHERE id=?',beyondEnd?'archived':'scheduled',beyondEnd?null:next,stamp,live.id);
      }else this.exec("UPDATE posts SET state='published',scheduled_at=NULL,published_at=?,updated_at=?,featured=?,pinned=?,version=version+1 WHERE id=?",stamp,stamp,featured,pinned,live.id);
      this.exec('INSERT INTO post_occurrences(id,post_id,occurrence_at,execution_key,state,published_post_id,published_post_version,processed_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)',uid('occ'),live.id,live.scheduled_at,key,'published',publishedId,recurring?1:live.version+1,stamp,stamp);
      return {id:publishedId,slug:publishedSlug,version:recurring?1:live.version+1};
    });if(out){fired.push(out);this.emit('post.published',out.id,out.version,{slug:out.slug});}}
    // Start limited feature and pin windows exactly once. End windows are handled below.
    const starts=this.all("SELECT * FROM posts WHERE state='published' AND ((featured=0 AND feature_start_at IS NOT NULL AND feature_start_at<=? AND (feature_end_at IS NULL OR feature_end_at>?)) OR (pinned=0 AND pin_start_at IS NOT NULL AND pin_start_at<=? AND (pin_end_at IS NULL OR pin_end_at>?)))",at,at,at,at);
    for(const p of starts){const feature=!p.featured&&p.feature_start_at&&p.feature_start_at<=at&&(!p.feature_end_at||p.feature_end_at>at),pin=!p.pinned&&p.pin_start_at&&p.pin_start_at<=at&&(!p.pin_end_at||p.pin_end_at>at);
      this.exec('UPDATE posts SET featured=?,pinned=?,version=version+1,updated_at=? WHERE id=?',feature?1:p.featured,pin?1:p.pinned,at,p.id);
      this.emit(feature?'post.featured':'post.pinned',p.id,p.version+1,{slug:p.slug});
    }
    // Expire feature/pin windows without hiding the published item.
    const exp=this.all("SELECT * FROM posts WHERE state='published' AND ((feature_start_at IS NOT NULL AND featured=0 AND feature_start_at<=? AND (feature_end_at IS NULL OR feature_end_at>?)) OR (featured=1 AND feature_end_at<=?) OR (pin_start_at IS NOT NULL AND pinned=0 AND pin_start_at<=? AND (pin_end_at IS NULL OR pin_end_at>?)) OR (pinned=1 AND pin_end_at<=?))",at,at,at,at,at,at);
    for(const p of exp){
      const stamp=at,feature=p.feature_start_at&&p.feature_start_at<=stamp&&(!p.feature_end_at||p.feature_end_at>stamp)?1:p.feature_end_at&&p.feature_end_at<=stamp?0:p.featured;
      const pin=p.pin_start_at&&p.pin_start_at<=stamp&&(!p.pin_end_at||p.pin_end_at>stamp)?1:p.pin_end_at&&p.pin_end_at<=stamp?0:p.pinned;
      this.exec('UPDATE posts SET featured=?,pinned=?,version=version+1,updated_at=? WHERE id=?',feature,pin,stamp,p.id);
      this.emit('post.updated',p.id,p.version+1,{slug:p.slug});
    }
    return fired;
  }
}
