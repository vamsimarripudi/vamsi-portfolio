import { uid,now,pureText,slugify,httpError,clamp } from './domain.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {config} from './config.mjs';
import {imageHasPrivateMetadata} from './media-privacy.mjs';
const kinds=['personal','build','work','learning','celebration'];
const states=['draft','published','archived'];
const clean=(v,max=300)=>pureText(v,max).replace(/\s+/g,' ').trim();
const idRule=/^[a-z]+_[0-9a-f-]{36}$/i;
const isoDay=(v)=>{
 const text=String(v||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||Number.isNaN(Date.parse(text+'T00:00:00.000Z'))||
 new Date(text+'T00:00:00.000Z').toISOString().slice(0,10)!==text)throw httpError(400,'Choose a valid date.','INVALID_DATE');
 return text;
};
const stateOf=(v)=>{const s=String(v||'draft');if(!states.includes(s))throw httpError(400,'Invalid visibility.','INVALID_STATE');return s};
const asIds=(value,max=40)=>{
 if(!Array.isArray(value)||value.length>max||value.some(x=>typeof x!=='string'||!idRule.test(x)))throw httpError(400,'Choose valid items.','INVALID_ITEMS');
 return [...new Set(value)];
};
export class V3Memories{
 constructor(store,{env=process.env}={}){this.store=store;this.env=env}
 enabled(){return this.env.CORNER_V3_MEMORIES==='1'}
 check(){if(!this.enabled())throw httpError(404,'Feature is unavailable.','FEATURE_DISABLED')}
 owner(user){this.check();if(user?.role!=='owner')throw httpError(403,'Owner access required.','OWNER_REQUIRED')}
 uniqueSlug(table,title){
  const stem=slugify(title).slice(0,70)||'memory';let slug=stem,n=2;
  while(this.store.one('SELECT id FROM '+table+' WHERE slug=?',slug))slug=stem+'-'+n++;
  return slug;
 }
 timeline({year='',kind='',limit=100}={}){
  this.check();
  const y=String(year||''),k=String(kind||'');
  if(y&&!/^(19|20)\d{2}$/.test(y))throw httpError(400,'Invalid year.','INVALID_YEAR');
  if(k&&!kinds.includes(k))throw httpError(400,'Invalid category.','INVALID_KIND');
  const items=this.store.all("SELECT m.id,m.title,m.summary,m.occurred_on AS occurredOn,m.kind,p.slug AS postSlug FROM v3_milestones m LEFT JOIN posts p ON p.id=m.post_id WHERE m.state='published' AND (m.post_id IS NULL OR p.state='published') AND (?='' OR substr(m.occurred_on,1,4)=?) AND (?='' OR m.kind=?) ORDER BY m.occurred_on DESC,m.id DESC LIMIT ?",y,y,k,k,clamp(Number(limit)||100,1,100));
  const years=this.store.all("SELECT substr(m.occurred_on,1,4) year,count(*) total FROM v3_milestones m LEFT JOIN posts p ON p.id=m.post_id WHERE m.state='published' AND (m.post_id IS NULL OR p.state='published') GROUP BY year ORDER BY year DESC LIMIT 40");
  return {items,years};
 }
 adminMilestones(user){this.owner(user);return this.store.all('SELECT * FROM v3_milestones ORDER BY occurred_on DESC,created_at DESC LIMIT 200')}
 milestone(user,data={},id=''){
  this.owner(user);
  const existing=id?this.store.one('SELECT * FROM v3_milestones WHERE id=?',id):null;
  if(id&&!existing)throw httpError(404,'Milestone not found.','NOT_FOUND');
  const title=clean(data.title??existing?.title,130),summary=clean(data.summary??existing?.summary,350);
  if(title.length<2)throw httpError(400,'Add a milestone title.','INVALID_TITLE');
  const occurred=isoDay(data.occurredOn??existing?.occurred_on);
  const kind=String(data.kind??existing?.kind??'personal');
  if(!kinds.includes(kind))throw httpError(400,'Invalid category.','INVALID_KIND');
  const state=stateOf(data.state??existing?.state);
  const postId=data.postId===null?'':String(data.postId??existing?.post_id??'').trim();
  if(postId){const linked=this.store.one('SELECT state FROM posts WHERE id=?',postId);if(!linked||state==='published'&&linked.state!=='published')throw httpError(400,'Link a published story.','POST_NOT_PUBLIC');}
  const stamp=now(),key=existing?.id||uid('milestone');
  this.store.transaction(()=>{
   if(existing)this.store.exec('UPDATE v3_milestones SET title=?,summary=?,occurred_on=?,kind=?,post_id=?,state=?,updated_at=?,published_at=CASE WHEN ?=\'published\' THEN COALESCE(published_at,?) ELSE published_at END WHERE id=?',title,summary,occurred,kind,postId||null,state,stamp,state,stamp,key);
   else this.store.exec('INSERT INTO v3_milestones(id,title,summary,occurred_on,kind,post_id,state,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?,?,?,?)',key,title,summary,occurred,kind,postId||null,state,stamp,stamp,state==='published'?stamp:null);
   this.store.audit(user.id,existing?'v3.milestone.updated':'v3.milestone.created','milestone',key);
  });
  return this.store.one('SELECT * FROM v3_milestones WHERE id=?',key);
 }
 allowedMedia(mediaId){
  const media=this.store.one("SELECT m.id,m.storage_key,m.mime_type,m.alt_text,m.caption,m.focal_x,m.focal_y,p.slug AS post_slug FROM media m JOIN posts p ON p.id=m.owner_id WHERE m.id=? AND m.owner_type='post' AND p.state='published' AND m.mime_type IN ('image/jpeg','image/png','image/webp')",mediaId);
  if(!media)return null;
  if(this.store.location===':memory:')return media;
  if(!/^[A-Za-z0-9_-]{6,80}\.(?:jpg|png|webp)$/.test(media.storage_key))return null;
  const file=path.join(config.uploads,media.storage_key);
  try{if(!fs.existsSync(file)||imageHasPrivateMetadata(fs.readFileSync(file),media.mime_type))return null;}catch{return null}
  return media;
 }
 allowedPost(postId){return this.store.getPostById(postId)}
 albumImages(id){
  return this.store.all("SELECT m.id,m.storage_key AS storageKey,m.mime_type AS mimeType,m.alt_text AS alt,m.caption,m.focal_x AS focalX,m.focal_y AS focalY,p.slug AS postSlug FROM v3_album_items a JOIN media m ON m.id=a.media_id JOIN posts p ON p.id=m.owner_id WHERE a.album_id=? AND m.owner_type='post' AND p.state='published' AND m.mime_type IN ('image/jpeg','image/png','image/webp') ORDER BY a.sort_order,a.media_id LIMIT 60",id).filter(m=>this.allowedMedia(m.id));
 }
 collectionPosts(id){
  return this.store.all("SELECT p.id,p.slug,p.title,p.excerpt,p.category,p.published_at AS publishedAt FROM v3_collection_items c JOIN posts p ON p.id=c.post_id WHERE c.collection_id=? AND p.state='published' ORDER BY c.sort_order,c.post_id LIMIT 60",id);
 }
 albums(){
  this.check();
  const rows=this.store.all("SELECT * FROM v3_albums WHERE state='published' ORDER BY published_at DESC,id DESC LIMIT 100");
  return rows.map(a=>({...a,images:this.albumImages(a.id)})).filter(a=>a.images.length);
 }
 album(slug){
  this.check();const row=this.store.one("SELECT * FROM v3_albums WHERE slug=? AND state='published'",String(slug||''));
  if(!row)throw httpError(404,'Album not found.','NOT_FOUND');
  const images=this.albumImages(row.id);
  if(!images.length)throw httpError(404,'Album is unavailable.','NOT_FOUND');
  return {...row,images};
 }
 adminAlbums(user){this.owner(user);return this.store.all("SELECT * FROM v3_albums ORDER BY created_at DESC LIMIT 150").map(a=>({...a,mediaIds:this.store.all('SELECT media_id FROM v3_album_items WHERE album_id=? ORDER BY sort_order',a.id).map(x=>x.media_id)}))}
 albumWrite(user,data={},id=''){
  this.owner(user);const old=id?this.store.one('SELECT * FROM v3_albums WHERE id=?',id):null;
  if(id&&!old)throw httpError(404,'Album not found.','NOT_FOUND');
  const title=clean(data.title??old?.title,110),summary=clean(data.summary??old?.summary,350),state=stateOf(data.state??old?.state);
  if(title.length<2)throw httpError(400,'Add an album title.','INVALID_TITLE');
  const mediaIds=data.mediaIds!==undefined?asIds(data.mediaIds):old?this.store.all('SELECT media_id FROM v3_album_items WHERE album_id=? ORDER BY sort_order',id).map(x=>x.media_id):[];
  for(const mid of mediaIds)if(!this.store.one('SELECT id FROM media WHERE id=?',mid)||state==='published'&&!this.allowedMedia(mid))throw httpError(400,'Published albums require public story images.','MEDIA_NOT_PUBLIC');
  if(state==='published'&&!mediaIds.length)throw httpError(400,'Add at least one public image.','EMPTY_ALBUM');
  const key=old?.id||uid('album'),slug=old?.slug||this.uniqueSlug('v3_albums',title),stamp=now();
  this.store.transaction(()=>{
   if(old)this.store.exec('UPDATE v3_albums SET title=?,summary=?,state=?,updated_at=?,published_at=CASE WHEN ?=\'published\' THEN COALESCE(published_at,?) ELSE published_at END WHERE id=?',title,summary,state,stamp,state,stamp,key);
   else this.store.exec('INSERT INTO v3_albums(id,slug,title,summary,state,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?,?)',key,slug,title,summary,state,stamp,stamp,state==='published'?stamp:null);
   this.store.exec('DELETE FROM v3_album_items WHERE album_id=?',key);
   mediaIds.forEach((mid,i)=>this.store.exec('INSERT INTO v3_album_items(album_id,media_id,sort_order) VALUES(?,?,?)',key,mid,i));
   this.store.audit(user.id,old?'v3.album.updated':'v3.album.created','album',key);
  });
  return {id:key,slug,state,mediaIds};
 }
 collections(){
  this.check();return this.store.all("SELECT * FROM v3_collections WHERE state='published' ORDER BY published_at DESC,id DESC LIMIT 100").map(c=>({...c,posts:this.collectionPosts(c.id)})).filter(c=>c.posts.length);
 }
 collection(slug){
  this.check();const c=this.store.one("SELECT * FROM v3_collections WHERE slug=? AND state='published'",String(slug||''));
  if(!c)throw httpError(404,'Collection not found.','NOT_FOUND');
  const posts=this.collectionPosts(c.id);
  if(!posts.length)throw httpError(404,'Collection unavailable.','NOT_FOUND');
  return {...c,posts};
 }
 adminCollections(user){this.owner(user);return this.store.all('SELECT * FROM v3_collections ORDER BY created_at DESC LIMIT 150').map(c=>({...c,postIds:this.store.all('SELECT post_id FROM v3_collection_items WHERE collection_id=? ORDER BY sort_order',c.id).map(x=>x.post_id)}))}
 collectionWrite(user,data={},id=''){
  this.owner(user);const old=id?this.store.one('SELECT * FROM v3_collections WHERE id=?',id):null;
  if(id&&!old)throw httpError(404,'Collection not found.','NOT_FOUND');
  const title=clean(data.title??old?.title,110),summary=clean(data.summary??old?.summary,350),state=stateOf(data.state??old?.state);
  if(title.length<2)throw httpError(400,'Add a collection title.','INVALID_TITLE');
  const postIds=data.postIds!==undefined?asIds(data.postIds):old?this.store.all('SELECT post_id FROM v3_collection_items WHERE collection_id=? ORDER BY sort_order',id).map(x=>x.post_id):[];
  for(const postId of postIds)if(!this.store.one('SELECT id FROM posts WHERE id=?',postId)||state==='published'&&!this.allowedPost(postId))throw httpError(400,'Published collections require public stories.','POST_NOT_PUBLIC');
  if(state==='published'&&!postIds.length)throw httpError(400,'Add at least one published story.','EMPTY_COLLECTION');
  const key=old?.id||uid('collection'),slug=old?.slug||this.uniqueSlug('v3_collections',title),stamp=now();
  this.store.transaction(()=>{
   if(old)this.store.exec('UPDATE v3_collections SET title=?,summary=?,state=?,updated_at=?,published_at=CASE WHEN ?=\'published\' THEN COALESCE(published_at,?) ELSE published_at END WHERE id=?',title,summary,state,stamp,state,stamp,key);
   else this.store.exec('INSERT INTO v3_collections(id,slug,title,summary,state,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?,?)',key,slug,title,summary,state,stamp,stamp,state==='published'?stamp:null);
   this.store.exec('DELETE FROM v3_collection_items WHERE collection_id=?',key);
   postIds.forEach((pid,i)=>this.store.exec('INSERT INTO v3_collection_items(collection_id,post_id,sort_order) VALUES(?,?,?)',key,pid,i));
   this.store.audit(user.id,old?'v3.collection.updated':'v3.collection.created','collection',key);
  });
  return {id:key,slug,state,postIds};
 }
 nowHistory({limit=40}={}){
  this.check();return this.store.all("SELECT version,label,detail,icon,changed_at AS changedAt FROM v3_now_history WHERE is_active=1 AND label<>'' AND (active_from IS NULL OR active_from<=?) AND (active_until IS NULL OR active_until>?) ORDER BY changed_at DESC LIMIT ?",now(),now(),clamp(Number(limit)||40,1,100));
 }
 adminNowHistory(user){this.owner(user);return this.store.all('SELECT * FROM v3_now_history ORDER BY version DESC LIMIT 100')}
 recordNow(user,data){
  this.owner(user);
  return this.store.transaction(()=>{
   const current=this.store.updateStatus(data,user.id);
   const snapshot=this.store.one('SELECT * FROM site_status WHERE id=1'),id=uid('now');
   this.store.exec('INSERT INTO v3_now_history(id,version,label,detail,icon,is_active,active_from,active_until,changed_at,actor_id) VALUES(?,?,?,?,?,?,?,?,?,?)',id,snapshot.version,snapshot.label,snapshot.detail,snapshot.icon,snapshot.is_active,snapshot.active_from,snapshot.active_until,now(),user.id);
   return current;
  });
 }
}
