import {uid,now,pureText,httpError,isValidTimeZone,zoneLocalToUtc} from './domain.mjs';
import {config} from './config.mjs';

const idPattern=/^post_[0-9a-f-]{36}$/i;
const clean=(s,max)=>pureText(s,max).replace(/\s+/g,' ').trim();
const editable=(post)=>{
 if(!post||post.type!=='wish')throw httpError(404,'Wish not found.','WISH_NOT_FOUND');
 return post;
};
export class WishesStudio {
 constructor(store,{env=process.env}={}){this.store=store;this.env=env}
 enabled(){return this.env.CORNER_V3_WISHES==='1'}
 requireOwner(person){
  if(!this.enabled())throw httpError(404,'Wishes Studio is unavailable.','FEATURE_DISABLED');
  if(person?.role!=='owner')throw httpError(403,'Owner access required.','OWNER_REQUIRED');
  return person;
 }
 validate(data={}){
  const title=clean(data.title,141),body=pureText(data.body,5001).trim(),excerpt=clean(data.excerpt,301);
  if(title.length<2||title.length>140)throw httpError(400,'Enter a wish title of 2–140 characters.','WISH_TITLE_INVALID');
  if(body.length<3||body.length>5000)throw httpError(400,'Enter a wish of 3–5000 characters.','WISH_BODY_INVALID');
  const timezone=String(data.timezone||config.timezone);
  if(!isValidTimeZone(timezone))throw httpError(400,'Select a valid timezone.','INVALID_TIMEZONE');
  const emoji=clean(data.emoji||'✳',8);
  const upcomingPublic=data.upcomingPublic===true;
  return {type:'wish',title,body,excerpt,emoji,timezone,allowComments:false,allowReactions:false,upcomingPublic};
 }
 list(actor,{limit=100}={}){
  this.requireOwner(actor);
  const size=Math.max(1,Math.min(Number(limit)||100,200));
  return this.store.all("SELECT id,slug,title,excerpt,body,emoji,state,timezone,recurrence,scheduled_at,recurrence_end_year,upcoming_public,version,created_at,updated_at,published_at FROM posts WHERE type='wish' ORDER BY updated_at DESC,id DESC LIMIT ?",size);
 }
 get(actor,id){
  this.requireOwner(actor);
  if(!idPattern.test(String(id)))throw httpError(404,'Wish not found.','WISH_NOT_FOUND');
  return editable(this.store.adminPost(id));
 }
 create(actor,data){
  this.requireOwner(actor);
  const record=this.validate(data);
  return this.store.createPost(record,actor.id);
 }
 update(actor,id,data){
  const previous=this.get(actor,id);
  if(previous.state==='archived')throw httpError(409,'Restore this wish through Studio before editing.','WISH_ARCHIVED');
  if(previous.state==='published')throw httpError(409,'Duplicate a published wish before making changes.','WISH_ALREADY_PUBLISHED');
  const version=Number(data.version);
  if(!Number.isSafeInteger(version)||version!==Number(previous.version))
    throw httpError(409,'This wish was updated elsewhere. Reload before editing.','VERSION_CONFLICT');
  const record=this.validate(data);
  return this.store.savePost(id,{...record,version},actor.id);
 }
 duplicate(actor,id){
  const source=this.get(actor,id);
  return this.create(actor,{title:source.title+' (copy)',body:source.body,excerpt:source.excerpt,emoji:source.emoji,timezone:source.timezone,upcomingPublic:false});
 }
 schedule(actor,id,data){
  const existing=this.get(actor,id);
  if(existing.state==='archived'||existing.state==='published')throw httpError(409,'Only drafts or scheduled wishes can be scheduled.','WISH_NOT_EDITABLE');
  if(Number(data.version)!==Number(existing.version))throw httpError(409,'This wish changed. Reload before scheduling.','VERSION_CONFLICT');
  const local=String(data.localTime||'');
  const tz=String(data.timezone||existing.timezone||config.timezone);
  if(!isValidTimeZone(tz))throw httpError(400,'Select a valid timezone.','INVALID_TIMEZONE');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw httpError(400,'Choose a valid date and time.','INVALID_TIME');
  let scheduledAt;try{scheduledAt=zoneLocalToUtc(local,tz)}catch{throw httpError(400,'Invalid date or timezone.','INVALID_TIME')}
  const recurrence=data.recurrence==='yearly'?'yearly':data.recurrence==='none'||data.recurrence==null?'none':null;
  if(!recurrence)throw httpError(400,'Invalid repeat option.','INVALID_RECURRENCE');
  return this.store.schedule(id,{scheduledAt,localTime:local,timezone:tz,recurrence,recurrenceEndYear:data.recurrenceEndYear||null},actor.id);
 }
 publish(actor,id){
  const wish=this.get(actor,id);
  if(wish.state==='archived')throw httpError(409,'Restore this wish before publication.','WISH_ARCHIVED');
  return this.store.publish(id,actor.id);
 }
 archive(actor,id){this.get(actor,id);return this.store.archive(id,actor.id)}
 preview(actor,data){
  this.requireOwner(actor);
  const wish=this.validate(data);
  return {title:wish.title,excerpt:wish.excerpt,body:wish.body,emoji:wish.emoji,
   reminder:'Preview only — nothing has been published, scheduled, or emailed.'};
 }
}
