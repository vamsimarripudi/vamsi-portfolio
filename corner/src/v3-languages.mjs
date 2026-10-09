import fs from 'node:fs';
import {uid,now,pureText,sha,httpError} from './domain.mjs';
export const V3_LANGUAGES=Object.freeze({en:'English',te:'తెలుగు',hi:'हिन्दी'});
const schema=fs.readFileSync(new URL('./v3-language-schema.sql',import.meta.url),'utf8');
const version='v3-0005-languages';
const clean=(s,n)=>pureText(s,n).trim();
const language=code=>{
 const lang=String(code||'en').trim().toLowerCase();
 if(!Object.hasOwn(V3_LANGUAGES,lang))throw httpError(400,'Unsupported language.','INVALID_LANGUAGE');
 return lang;
};
export class V3Languages{
 constructor(store,{env=process.env}={}){
  this.store=store;this.env=env;
  if(this.enabled()){
   const checksum=sha(schema);
   const prior=store.one('SELECT checksum FROM v3_schema_migrations WHERE version=?',version);
   if(prior&&prior.checksum!==checksum)throw Error('Language variant schema has changed after migration');
   if(!prior)store.transaction(()=>{
    store.db.exec(schema);
    store.exec('INSERT INTO v3_schema_migrations(version,checksum,applied_at) VALUES(?,?,?)',version,checksum,now());
   });
  }
 }
 enabled(){return this.env.CORNER_V3_LANGUAGES==='1'}
 check(){if(!this.enabled())throw httpError(404,'Languages unavailable.','FEATURE_DISABLED')}
 owner(actor){this.check();if(actor?.role!=='owner')throw httpError(403,'Owner permissions required.','OWNER_REQUIRED')}
 getSource(postId){
  const source=this.store.one('SELECT id,slug,title,state,version FROM posts WHERE id=?',String(postId||''));
  if(!source)throw httpError(404,'Source story not found.','SOURCE_NOT_FOUND');
  return source;
 }
 normalize(data={}){
  const title=clean(data.title,151),excerpt=clean(data.excerpt,381),body=clean(data.body,12001);
  if(title.length<2||title.length>150)throw httpError(400,'Translation title must be 2–150 characters.','INVALID_TITLE');
  if(body.length<3||body.length>12000)throw httpError(400,'Translation body must be 3–12000 characters.','INVALID_BODY');
  return {title,excerpt,body};
 }
 preview(actor,data){
  this.owner(actor);
  const lang=language(data?.language);
  if(lang==='en')throw httpError(400,'Select an additional language.','INVALID_LANGUAGE');
  const fields=this.normalize(data);
  return {...fields,language:lang,previewOnly:true,published:false};
 }
 list(actor){
  this.owner(actor);
  return this.store.all("SELECT l.*,p.slug AS post_slug,p.title AS source_title,p.state AS source_state,p.version AS latest_source_version FROM v3_language_variants l JOIN posts p ON p.id=l.post_id ORDER BY l.updated_at DESC LIMIT 200").map(r=>({
    id:r.id,postId:r.post_id,postSlug:r.post_slug,sourceTitle:r.source_title,
    language:r.language,title:r.title,excerpt:r.excerpt,body:r.body,
    state:r.state,revision:r.revision,sourceVersion:r.source_version,
    needsReview:r.source_version!==r.latest_source_version,updatedAt:r.updated_at
  }));
 }
 save(actor,{postId,language:requested,revision,...data}={}){
  this.owner(actor);
  const lang=language(requested);
  if(lang==='en')throw httpError(400,'Use a different language.','INVALID_LANGUAGE');
  const post=this.getSource(postId);
  const content=this.normalize(data),stamp=now();
  const prior=this.store.one('SELECT * FROM v3_language_variants WHERE post_id=? AND language=?',post.id,lang);
  if(prior&&(Number(revision)!==prior.revision))throw httpError(409,'This translation changed. Reload before saving.','VERSION_CONFLICT');
  const id=prior?.id||uid('lang');
  this.store.transaction(()=>{
   if(prior)this.store.exec("UPDATE v3_language_variants SET title=?,excerpt=?,body=?,state='draft',reviewed_at=NULL,reviewed_by=NULL,source_version=?,revision=revision+1,updated_at=? WHERE id=?",
     content.title,content.excerpt,content.body,post.version,stamp,id);
   else this.store.exec("INSERT INTO v3_language_variants(id,post_id,language,title,excerpt,body,state,source_version,created_at,updated_at) VALUES(?,?,?,?,?,?,'draft',?,?,?)",
     id,post.id,lang,content.title,content.excerpt,content.body,post.version,stamp,stamp);
   this.store.audit(actor.id,'v3.language.draft_saved','post',post.id,{language:lang});
  });
  return {id,postId:post.id,language:lang,state:'draft',revision:prior?prior.revision+1:1};
 }
 review(actor,postId,requested,{confirm=false,publish=true}={}){
  this.owner(actor);
  if(confirm!==true)throw httpError(400,'Explicit review confirmation required.','REVIEW_REQUIRED');
  const lang=language(requested),post=this.getSource(postId);
  const variant=this.store.one('SELECT * FROM v3_language_variants WHERE post_id=? AND language=?',post.id,lang);
  if(!variant)throw httpError(404,'Translation not found.','VARIANT_NOT_FOUND');
  if(publish&&(post.state!=='published'||variant.source_version!==post.version))
   throw httpError(409,'Review the latest published source before approving this translation.','SOURCE_NOT_REVIEWED');
  const stamp=now();
  this.store.transaction(()=>{
   this.store.exec('UPDATE v3_language_variants SET state=?,reviewed_at=?,reviewed_by=?,updated_at=?,revision=revision+1 WHERE id=?',
    publish?'published':'draft',publish?stamp:null,publish?actor.id:null,stamp,variant.id);
   this.store.audit(actor.id,publish?'v3.language.published':'v3.language.revoked','post',post.id,{language:lang});
  });
  return {id:variant.id,state:publish?'published':'draft',language:lang};
 }
 available(post){
  if(!this.enabled()||!post?.id)return ['en'];
  // Public projection intentionally has no state; verify freshness and publication
  // from the source table instead of relying on a field redacted from publicPost.
  const source=this.store.one("SELECT version FROM posts WHERE id=? AND state='published'",post.id);
  if(!source||Number(source.version)!==Number(post.version))return ['en'];
  const rows=this.store.all("SELECT language FROM v3_language_variants WHERE post_id=? AND state='published' AND source_version=? ORDER BY language",post.id,post.version);
  return ['en',...rows.map(r=>r.language)];
 }
 localize(post,requested='en'){
  if(!post)return null;
  if(!this.enabled())return {post,language:'en',available:['en']};
  const lang=language(requested);
  const available=this.available(post);
  if(lang==='en'||!available.includes(lang))return {post,language:'en',available};
  const row=this.store.one("SELECT title,excerpt,body FROM v3_language_variants WHERE post_id=? AND language=? AND state='published' AND source_version=?",post.id,lang,post.version);
  return row?{post:{...post,title:row.title,excerpt:row.excerpt,body:row.body,language:lang},
   language:lang,available}:{post,language:'en',available};
 }
}
