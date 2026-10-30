/* Corner Journal Series: additive, first-party metadata for multipart Journal stories.
   A series does not copy a post or publish an unpublished chapter. */
import {uid,now,pureText,slugify,httpError} from './domain.mjs';

const first={
 id:'series_learning_everything_doing_nothing',
 slug:'learning-everything-doing-nothing',
 title:'Learning Everything, Doing Nothing',
 subtitle:'On curiosity, unfinished beginnings, and the distance between knowing and doing.',
 description:'A personal journal about learning, unfinished beginnings, and putting ideas into practice.',
 planned:['The Illusion of Progress','Addicted to New Beginnings','A Mind Full of Unfinished Things','Fear of Actually Trying','Knowing Less, Doing More']
};
const partOneId='post_fdbce666-5456-40e4-a3bc-1027b881b64e';
const clean=value=>String(value??'').trim();
const plan=row=>{try{const p=JSON.parse(row.planned_parts||'[]');return Array.isArray(p)?p.filter(x=>typeof x==='string').slice(0,30):[]}catch{return []}};
export function installJournalSeries(store){
 store.db.exec("CREATE TABLE IF NOT EXISTS journal_series (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', planned_parts TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)");
 const columns=store.db.prepare('PRAGMA table_info(posts)').all().map(x=>x.name);
 if(!columns.includes('series_id'))store.db.exec('ALTER TABLE posts ADD COLUMN series_id TEXT');
 if(!columns.includes('series_part'))store.db.exec('ALTER TABLE posts ADD COLUMN series_part INTEGER');
 store.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_journal_series_part ON posts(series_id,series_part) WHERE series_id IS NOT NULL AND series_part IS NOT NULL');
 store.db.exec('CREATE INDEX IF NOT EXISTS idx_posts_journal_series_public ON posts(series_id,state,series_part)');
 store.exec('INSERT OR IGNORE INTO journal_series(id,slug,title,subtitle,description,planned_parts,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
  first.id,first.slug,first.title,first.subtitle,first.description,JSON.stringify(first.planned),now(),now());
 // Link ONLY the already-published, verified original Part 01. Do not touch its title,
 // body, media, author, publication date, slug or post version.
 store.exec("UPDATE posts SET series_id=?,series_part=1 WHERE id=? AND slug=? AND type='journal' AND title=? AND series_id IS NULL",
  first.id,partOneId,first.slug,first.title);
}
export function validateJournalMembership(store,fields,type){
 const choice=Object.hasOwn(fields,'seriesId')?fields.seriesId:fields.series_id;
 const id=clean(choice);
 if(!id)return {seriesId:null,seriesPart:null};
 if(type!=='journal')throw httpError(400,'Series chapters must use Journal presentation.');
 const record=store.one('SELECT id FROM journal_series WHERE id=?',id);
 if(!record)throw httpError(400,'Choose an existing Journal series.');
 const raw=Object.hasOwn(fields,'seriesPart')?fields.seriesPart:fields.series_part;
 const part=Number(raw);
 if(!Number.isInteger(part)||part<1||part>99)throw httpError(400,'Choose a chapter number between 1 and 99.');
 const other=store.one('SELECT id FROM posts WHERE series_id=? AND series_part=? AND id<>?',id,part,clean(fields.id));
 if(other)throw httpError(409,'That chapter number is already assigned. Choose another part.','SERIES_PART_TAKEN');
 return {seriesId:id,seriesPart:part};
}
export function createJournalSeries(store,fields,actor){
 const title=pureText(fields.title,150),subtitle=pureText(fields.subtitle,280),description=pureText(fields.description,500);
 if(!title||title.length>110)throw httpError(400,'Enter a series title up to 110 characters.');
 const slug=slugify(fields.slug||title);
 if(!slug||slug.length>90)throw httpError(400,'Choose a shorter series title.');
 if(store.one('SELECT id FROM journal_series WHERE slug=?',slug))throw httpError(409,'Series title already exists.','SERIES_EXISTS');
 const id=uid('series'),stamp=now();
 store.exec('INSERT INTO journal_series(id,slug,title,subtitle,description,planned_parts,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
  id,slug,title,subtitle,description,JSON.stringify([]),stamp,stamp);
 store.audit(actor,'journal_series.created','journal_series',id);
 return {id,slug,title,subtitle,description,plannedParts:[],nextPart:1};
}
export function studioJournalSeries(store){
 return store.all('SELECT * FROM journal_series ORDER BY created_at ASC').map(row=>{
  const last=store.one('SELECT MAX(series_part) AS part FROM posts WHERE series_id=?',row.id);
  return {id:row.id,slug:row.slug,title:row.title,subtitle:row.subtitle,description:row.description,plannedParts:plan(row),nextPart:Math.min(99,Number(last?.part||0)+1)};
 });
}
export function journalSeriesBySlug(store,slug){
 const row=store.one('SELECT * FROM journal_series WHERE slug=?',slug);
 if(!row)return null;
 const published=store.all("SELECT id,slug,title,excerpt,published_at,series_part FROM posts WHERE series_id=? AND type='journal' AND state='published' ORDER BY series_part ASC",row.id);
 const planned=plan(row);
 const total=Math.max(planned.length,...published.map(x=>x.series_part||0),1);
 const parts=Array.from({length:total},(_,index)=>{
  const number=index+1,post=published.find(p=>p.series_part===number)||null;
  return {part:number,title:post?.series_part===1&&row.id===first.id?first.planned[0]:(post?.title||planned[index]||'Chapter '+number),published:!!post,post};
 });
 const coverPost=published[0]||null;
 const photo=coverPost?store.listMedia(coverPost.id).find(m=>m.mime_type?.startsWith('image/'))||null:null;
 return {id:row.id,slug:row.slug,title:row.title,subtitle:row.subtitle,description:row.description,parts,cover:photo?{storage_key:photo.storage_key,alt_text:photo.alt_text,caption:photo.caption}:null,publishedCount:published.length,total};
}
export function journalSeriesForPost(store,post){
 if(!post?.series_id)return null;
 const row=store.one('SELECT slug FROM journal_series WHERE id=?',post.series_id);
 if(!row)return null;
 const series=journalSeriesBySlug(store,row.slug);
 if(!series)return null;
 const current=series.parts.find(p=>p.part===Number(post.series_part));
 if(!current||!current.published||current.post?.id!==post.id)return null;
 const earlier=series.parts.filter(p=>p.part<current.part&&p.published);
 const later=series.parts.filter(p=>p.part>current.part&&p.published);
 return {series,current,previous:earlier.at(-1)||null,next:later[0]||null,upcoming:series.parts.find(p=>p.part>current.part)||null};
}
