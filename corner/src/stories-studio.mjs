/** Vamsi's Corner Stories: authenticated editorial workflow on the EXISTING post/series store.
 * All writes remain inside the established Studio permission, audit and publication mechanisms.
 */
import {httpError, pureText, zoneLocalToUtc} from './domain.mjs';
import {FICTION_TAGS,normalizeTags,wordCount,STORY_GENRES,storyCoverTone} from './stories-model.mjs';
import {renderStoriesStudio} from './stories-studio-ui.mjs';
const STATES=['draft','scheduled','published','archived'];
const isStory=p=>Boolean(p&&p.type==='journal'&&normalizeTags(p.tags).some(t=>FICTION_TAGS.has(t.toLowerCase())));
const clean=(s,max)=>pureText(s,max);
const cleanGenre=g=>STORY_GENRES.find(v=>v.toLowerCase()===String(g||'').toLowerCase())||'Literary';
const safeSlug=s=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(s||''))&&String(s).length<=100;
const stateRank={draft:0,scheduled:1,published:2,archived:3};
const genreFrom=p=>normalizeTags(p?.tags).find(t=>STORY_GENRES.some(g=>g.toLowerCase()===t.toLowerCase()))||'Literary';
function tagsFor(genre,other=[]){return ['Fiction',cleanGenre(genre),...normalizeTags(other).filter(v=>!FICTION_TAGS.has(v.toLowerCase())&&!STORY_GENRES.some(g=>g.toLowerCase()===v.toLowerCase()))].slice(0,6);}
const tiny=p=>({id:p.id,slug:p.slug,title:p.title,excerpt:p.excerpt||'',state:p.state,genre:genreFrom(p),version:p.version,words:wordCount(p.body),publishedAt:p.published_at||null,scheduledAt:p.scheduled_at||null,updatedAt:p.updated_at||null});
export function createStoriesStudio({store,journalSeries,basePath='',siteUrl='',timezone='Asia/Kolkata'}){
 function assertStory(id){const p=store.adminPost(id);if(!isStory(p))throw httpError(404,'Story not found.','NOT_FOUND');return p;}
 function assertVersion(post,version){if(version===undefined||Number(version)!==Number(post.version))throw httpError(409,'A newer version exists. Reload before continuing.','VERSION_CONFLICT');}
 function seriesRows(slug){return store.all('SELECT p.* FROM journal_series_parts s JOIN posts p ON p.id=s.post_id WHERE s.series_slug=? ORDER BY s.part_number ASC',slug);}
 function safeSeries(slug){
  if(!safeSlug(slug))throw httpError(404,'Book not found.','NOT_FOUND');
  const series=store.one('SELECT slug,title,summary,status,updated_at FROM journal_series WHERE slug=?',slug);
  if(!series)throw httpError(404,'Book not found.','NOT_FOUND');
  const rows=seriesRows(slug);
  if(!rows.length||rows.some(row=>!isStory(row)))throw httpError(404,'Story book not found.','NOT_FOUND');
  return {series,rows};
 }
 function cover(p){return (store.listMedia?.(p.id)||[]).find(m=>m.mime_type?.startsWith('image/'))||null;}
 function list(){
  // Avoid the main Studio's 200-post dashboard limit: fiction can span years.
  const rows=store.all("SELECT * FROM posts WHERE type='journal' ORDER BY updated_at DESC LIMIT 5001");
  const posts=rows.slice(0,5000).filter(isStory);
  const books=new Map();
  for(const p of posts){
    const assignment=journalSeries.assignment(p.id);
    const id=assignment?.slug?'series:'+assignment.slug:'standalone:'+p.id;
    if(!books.has(id)){
      const meta=assignment?.slug?store.one('SELECT slug,title,summary FROM journal_series WHERE slug=?',assignment.slug):null;
      books.set(id,{id,kind:meta?'series':'standalone',slug:meta?.slug||p.slug,title:meta?.title||p.title,
        description:meta?.summary||p.excerpt||'',genre:genreFrom(p),coverTone:storyCoverTone(meta?.slug||p.slug),chapters:[],cover:null});
    }
    const b=books.get(id);b.chapters.push({...tiny(p),partNumber:assignment?.partNumber||1});
  }
  for(const b of books.values()){
    b.chapters.sort((a,c)=>a.partNumber-c.partNumber||String(a.id).localeCompare(String(c.id)));
    b.cover=cover(assertStory(b.chapters[0].id));
    b.publishedCount=b.chapters.filter(x=>x.state==='published').length;
    b.state=b.publishedCount?'published':b.chapters.some(x=>x.state==='scheduled')?'scheduled':b.chapters.every(x=>x.state==='archived')?'archived':'draft';
    b.updatedAt=b.chapters.reduce((latest,c)=>c.updatedAt>latest?c.updatedAt:latest,'');
    b.wordCount=b.chapters.reduce((n,c)=>n+c.words,0);
    b.chapterCount=b.chapters.length;
  }
  const result=[...books.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  return {books:result,truncated:rows.length>5000,counts:{all:result.length,draft:result.filter(x=>x.state==='draft').length,scheduled:result.filter(x=>x.state==='scheduled').length,published:result.filter(x=>x.state==='published').length,archived:result.filter(x=>x.state==='archived').length}};
 }
 function details(id){
  const p=assertStory(id),series=journalSeries.assignment(p.id);
  return {post:p,genre:genreFrom(p),series,media:store.listMedia?.(p.id)||[],book:series?(()=>{const {series:info,rows}=safeSeries(series.slug);return {...info,chapters:rows.map(tiny)};})():null};
 }
 function create(data,actor){
  const title=clean(data.title,150),excerpt=clean(data.excerpt,380),body=clean(data.body,25000);
  if(!title)throw httpError(400,'Enter a story title.','TITLE_REQUIRED');
  const kind=data.kind==='series'?'series':'standalone';
  const chapterTitle=kind==='series'?clean(data.chapterTitle,150)||'Chapter One':title;
  const post=store.createPost({type:'journal',title:chapterTitle,excerpt,body,tags:tagsFor(data.genre,data.tags),
    emoji:'✦',allowComments:false,allowReactions:true,clientRequestId:data.clientRequestId},actor.id);
  if(kind==='series'){
    const assigned=journalSeries.createForPost(post.id,actor.id);
    const name=title,summary=excerpt;
    store.exec('UPDATE journal_series SET title=?, summary=?, updated_at=? WHERE slug=?',name,summary,new Date().toISOString(),assigned.slug);
    store.audit(actor.id,'story.book.created','series',assigned.slug,{postId:post.id});
    return {...details(post.id),created:true};
  }
  store.audit(actor.id,'story.created','post',post.id);return {...details(post.id),created:true};
 }
 function addChapter(slug,data,actor){
  safeSeries(slug);
  const title=clean(data.title,150)||'Untitled chapter';
  const post=store.createPost({type:'journal',title,excerpt:clean(data.excerpt,380),body:clean(data.body,25000),
    tags:tagsFor(data.genre,data.tags),emoji:'✦',allowComments:false,allowReactions:true,clientRequestId:data.clientRequestId},actor.id);
  const assigned=journalSeries.assignNext(post.id,slug,actor.id);
  store.audit(actor.id,'story.chapter.created','post',post.id,{series:slug,partNumber:assigned.partNumber});
  return details(post.id);
 }
 function update(id,data,actor){
  const prev=assertStory(id);assertVersion(prev,data.version);
  if(!['draft','scheduled','published'].includes(prev.state))throw httpError(409,'Restore this chapter before editing.','ARCHIVED');
  const tags=tagsFor(data.genre||genreFrom(prev),data.tags||prev.tags);
  const values={type:'journal',title:clean(data.title??prev.title,150),excerpt:clean(data.excerpt??prev.excerpt,380),
    body:clean(data.body??prev.body,25000),tags,version:prev.version,emoji:prev.emoji||'✦',
    featured:!!prev.featured,pinned:!!prev.pinned,allowComments:!!prev.allow_comments,allowReactions:!!prev.allow_reactions,
    milestone:!!prev.milestone,timezone:prev.timezone||timezone};
  if(!values.title)throw httpError(400,'Story title cannot be empty.','TITLE_REQUIRED');
  store.savePost(id,values,actor.id);return details(id);
 }
 function editSeries(slug,data,actor){
  const {series}=safeSeries(slug);
  const title=clean(data.title,150),summary=clean(data.summary,380);
  if(!title)throw httpError(400,'Book title is required.','TITLE_REQUIRED');
  if(data.updatedAt!==series.updated_at)throw httpError(409,'Book details changed in another tab. Reload to continue.','VERSION_CONFLICT');
  const stamp=new Date(Math.max(Date.now(),(Date.parse(series.updated_at)||0)+1)).toISOString();
  store.exec('UPDATE journal_series SET title=?,summary=?,updated_at=? WHERE slug=? AND updated_at=?',title,summary,stamp,slug,series.updated_at);
  store.audit(actor.id,'story.book.updated','series',slug);return safeSeries(slug).series;
 }
 function convertToSeries(id,actor){
  const p=assertStory(id);const current=journalSeries.assignment(id);if(current)return {series:current,post:p};
  const next=journalSeries.createForPost(id,actor.id);
  store.audit(actor.id,'story.serialized','post',p.id,{series:next.slug});return {series:next,post:p};
 }
 function action(id,which,data,actor){
  const p=assertStory(id);assertVersion(p,data.version);
  if(which==='publish'){
    if(p.state==='archived')throw httpError(409,'Restore this chapter before publishing.');
    if(p.state==='published')return details(id);
    if(!String(p.body||'').trim())throw httpError(400,'Write the chapter before publishing.','BODY_REQUIRED');
    const result=store.publish(id,actor.id);store.audit(actor.id,'story.chapter.published','post',id);return {...details(id),published:true,publicUrl:(basePath||'')+'/stories'};
  }
  if(which==='schedule'){
    if(p.state==='published'||p.state==='archived')throw httpError(409,'Only unpublished chapters can be scheduled.');
    let when;try{when=zoneLocalToUtc(data.localTime,data.timezone||timezone)}catch{throw httpError(400,'Enter a valid local date and time.','INVALID_TIME');}
    store.schedule(id,{version:p.version,scheduledAt:when,timezone:data.timezone||timezone,recurrence:'none'},actor.id);return details(id);
  }
  if(which==='unschedule'){
    if(p.state!=='scheduled')throw httpError(409,'This chapter is not scheduled.');
    store.unschedule(id,{version:p.version},actor.id);return details(id);
  }
  if(which==='archive'){
    if(p.state==='archived')return details(id);store.archive(id,actor.id);return details(id);
  }
  if(which==='restore'){
    if(p.state!=='archived')throw httpError(409,'This chapter is not archived.');store.restore(id,actor.id);return details(id);
  }
  throw httpError(404,'Unknown Story action.','NOT_FOUND');
 }
 async function handleApi({req,res,pathName,owner,method,readJSON,ok}){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(pathName==='/api/admin/posts/stories'){
    if(method==='GET')return ok(res,list());
    if(method==='POST')return ok(res,create(await readJSON(req,32000),owner));
  }
  const seriesPath=pathName.match(/^\/api\/admin\/posts\/stories\/series\/([a-z0-9-]{1,100})(?:\/(chapters))?$/);
  if(seriesPath){
    const [,slug,command]=seriesPath;
    if(!command&&method==='GET'){const {series,rows}=safeSeries(slug);return ok(res,{series,chapters:rows.map(tiny)});}
    if(!command&&method==='PATCH')return ok(res,editSeries(slug,await readJSON(req,2000),owner));
    if(command==='chapters'&&method==='POST')return ok(res,addChapter(slug,await readJSON(req,32000),owner));
  }
  const postPath=pathName.match(/^\/api\/admin\/posts\/stories\/([A-Za-z0-9_-]+)(?:\/(publish|schedule|unschedule|archive|restore|serialize))?$/);
  if(postPath){const [,id,command]=postPath;
    if(!command&&method==='GET')return ok(res,details(id));
    if(!command&&method==='PATCH')return ok(res,update(id,await readJSON(req,32000),owner));
    if(command&&method==='POST'){
      const data=await readJSON(req,2500);
      if(command==='serialize'){const p=assertStory(id);assertVersion(p,data.version);return ok(res,convertToSeries(id,owner));}
      return ok(res,action(id,command,data,owner));
    }
  }
  res.setHeader('Allow','GET, POST, PATCH');throw httpError(405,'Story Studio action not supported.','METHOD_NOT_ALLOWED');
 }
 return {list,details,create,addChapter,update,editSeries,convertToSeries,action,handleApi,html:actor=>renderStoriesStudio(actor,{basePath,timezone,siteUrl})};
}
