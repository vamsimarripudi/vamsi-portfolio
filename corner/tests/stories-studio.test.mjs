import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoriesStudio} from '../src/stories-studio.mjs';
import {createStoriesService} from '../src/stories-service.mjs';

function fixture(){
 const posts=new Map(),series=new Map(),assignments=new Map(),audit=[];
 const media=new Map();let n=0,clock=0;
 const post=id=>{const p=posts.get(id);if(!p)throw Error('post not found');return p;};
 const copy=p=>({...p,tags:[...p.tags]});
 const store={
  allAdminPosts:()=>[...posts.values()].map(copy), adminPost:id=>posts.has(id)?copy(post(id)):null,
  all:(sql,slug)=>sql.includes('journal_series_parts')?[...posts.values()].filter(p=>assignments.get(p.id)?.slug===slug).sort((a,b)=>(assignments.get(a.id).partNumber-assignments.get(b.id).partNumber)).map(copy):sql.includes("WHERE type='journal'")?[...posts.values()].filter(p=>p.type==='journal').map(copy):[...posts.values()].filter(p=>p.state==='published'&&p.type==='journal').map(copy),
  one:(sql,slug)=>series.get(slug)?{...series.get(slug)}:null,
  exec:(sql,...args)=>{if(sql.includes('UPDATE journal_series')){const [title,summary,time,slug]=args;const record=series.get(slug);record.title=title;record.summary=summary;record.updated_at=time;}},
  listMedia:id=>media.get(id)||[],
  createPost:(input,actor)=>{const id='post_'+ ++n;const p={id,slug:'fiction-'+n,state:'draft',type:input.type,title:input.title,excerpt:input.excerpt,body:input.body,tags:input.tags,version:1,updated_at:new Date().toISOString(),created_at:new Date().toISOString(),allow_comments:false,allow_reactions:true,timezone:'Asia/Kolkata'};posts.set(id,p);return copy(p)},
  savePost:(id,input)=>{const p=post(id);if(input.version!==p.version)throw Object.assign(Error('conflict'),{status:409});Object.assign(p,{...input,version:p.version+1,updated_at:new Date(Date.now()+ ++clock).toISOString()});return copy(p)},
  publish:id=>{const p=post(id);p.state='published';p.published_at='2026-11-07T12:00:00.000Z';p.version++;return copy(p)},
  archive:id=>{post(id).state='archived';post(id).version++;return copy(post(id))},
  restore:id=>{post(id).state=post(id).published_at?'published':'draft';post(id).version++;return copy(post(id))},
  schedule:(id,data)=>{post(id).state='scheduled';post(id).scheduled_at=data.scheduledAt;post(id).version++;return copy(post(id))},
  unschedule:id=>{post(id).state='draft';post(id).scheduled_at=null;post(id).version++;return copy(post(id))},
  audit:(...a)=>audit.push(a)
 };
 const journalSeries={
  assignment:id=>assignments.get(id)||null,
  createForPost:id=>{const slug='fiction-series-'+id.replaceAll('_','-');const p=post(id);series.set(slug,{slug,title:p.title,summary:p.excerpt,status:'ongoing',updated_at:'2026-11-07T12:00:00Z'});const a={slug,partNumber:1,title:p.title};assignments.set(id,a);return a},
  assignNext:(id,slug)=>{assert.ok(series.has(slug));const count=[...assignments.values()].filter(v=>v.slug===slug).length+1;const a={slug,partNumber:count};assignments.set(id,a);return a},
  published:slug=>({slug,...series.get(slug),parts:[...posts.values()].filter(p=>assignments.get(p.id)?.slug===slug&&p.state==='published')}),
 };
 const studio=createStoriesStudio({store,journalSeries,basePath:'/corner',timezone:'Asia/Kolkata',siteUrl:'https://example.org/corner'});
 const publicStories=createStoriesService({store,journalSeries,siteUrl:'https://example.org/corner',basePath:'/corner'});
 return {studio,store,journalSeries,publicStories,posts,series,assignments,audit,media};
}
const OWNER={id:'owner-1',role:'owner'};
test('Studio creates a private standalone draft with protected fiction taxonomy',()=>{
 const {studio,publicStories}=fixture();const result=studio.create({title:'Paper Bird',excerpt:'A quiet tale',body:'One day the bird returned.',genre:'Mystery'},OWNER);
 assert.equal(result.post.state,'draft');assert.deepEqual(result.post.tags,['Fiction','Mystery']);assert.equal(studio.list().books[0].title,'Paper Bird');
 assert.equal(publicStories.books().length,0,'unpublished writing must not leak onto public shelf');
});
test('serial novel has independent book metadata and chapter titles, including later private chapters',()=>{
 const {studio,publicStories}=fixture();const book=studio.create({title:'The Narrow Street',chapterTitle:'The Arrival',kind:'series',excerpt:'A town with a secret.',body:'The first stranger arrived.',genre:'Thriller'},OWNER);
 assert.equal(book.book.title,'The Narrow Street');assert.equal(book.post.title,'The Arrival');
 const added=studio.addChapter(book.series.slug,{title:'The Whisper',body:'The second stranger disappeared.',genre:'Thriller'},OWNER);
 assert.equal(added.series.partNumber,2);const found=studio.list().books[0];
 assert.equal(found.chapterCount,2);assert.deepEqual(found.chapters.map(c=>c.title),['The Arrival','The Whisper']);
 assert.equal(publicStories.books().length,0);
});
test('publishing one serial chapter reveals only that chapter in the public reader',()=>{
 const {studio,publicStories}=fixture();const created=studio.create({title:'The Bell Tower',chapterTitle:'The Silence',kind:'series',body:'First sound.',excerpt:'Bells and secrets'},OWNER);
 studio.addChapter(created.series.slug,{title:'The Rumour',body:'Still private'},OWNER);
 studio.action(created.post.id,'publish',{version:created.post.version},OWNER);
 const live=publicStories.books();assert.equal(live.length,1);assert.equal(live[0].title,'The Bell Tower');assert.equal(live[0].chapterCount,1);assert.equal(live[0].chapters[0].title,'The Silence');
 assert.equal(studio.list().books[0].publishedCount,1);
});
test('optimistic concurrency stops stale chapter saves and stale publication',()=>{
 const {studio}=fixture();const p=studio.create({title:'Rain',body:'The rain arrived.'},OWNER).post;
 const updated=studio.update(p.id,{title:'Rain Again',body:'It was raining again.',version:1},OWNER);
 assert.equal(updated.post.version,2);
 assert.throws(()=>studio.update(p.id,{title:'Stale',version:1},OWNER),e=>e.status===409);
 assert.throws(()=>studio.action(p.id,'publish',{version:1},OWNER),e=>e.status===409);
});
test('book metadata requires matching revision and never overwrites chapter manuscript',()=>{
 const {studio}=fixture();const created=studio.create({title:'A Title',chapterTitle:'One',kind:'series',body:'Some text'},OWNER);
 const title=studio.editSeries(created.series.slug,{title:'New Book Title',summary:'A new promise',updatedAt:created.book.updated_at},OWNER);
 assert.equal(title.title,'New Book Title');assert.equal(studio.details(created.post.id).post.title,'One');
 assert.throws(()=>studio.editSeries(created.series.slug,{title:'Stale Title',updatedAt:created.book.updated_at},OWNER),e=>e.status===409);
});
test('scheduled stories remain private until existing scheduler publishes',()=>{
 const {studio,publicStories,posts}=fixture();const p=studio.create({title:'Next Monday',body:'Coming soon'},OWNER).post;
 const next=studio.action(p.id,'schedule',{version:p.version,localTime:'2027-01-10T19:30',timezone:'Asia/Kolkata'},OWNER);
 assert.equal(next.post.state,'scheduled');assert.match(posts.get(p.id).scheduled_at,/2027-01-10T14:00/);
 assert.equal(publicStories.books().length,0);
 studio.action(p.id,'unschedule',{version:next.post.version},OWNER);assert.equal(studio.details(p.id).post.state,'draft');
});
test('archiving hides published content immediately and restores it correctly',()=>{
 const {studio,publicStories}=fixture();let p=studio.create({title:'The Orchard',body:'Trees and secrets'},OWNER).post;
 p=studio.action(p.id,'publish',{version:p.version},OWNER).post;
 assert.equal(publicStories.books().length,1);
 p=studio.action(p.id,'archive',{version:p.version},OWNER).post;assert.equal(publicStories.books().length,0);
 studio.action(p.id,'restore',{version:p.version},OWNER);assert.equal(publicStories.books().length,1);
});
test('the new Studio API enforces story-only resources and prohibits arbitrary methods',async()=>{
 const {studio,store}=fixture();const foreign=store.createPost({type:'journal',title:'A private note',excerpt:'',body:'Not fiction',tags:['Journal']},OWNER.id);
 assert.throws(()=>studio.details(foreign.id),e=>e.status===404);
 let result=null,headers={};await studio.handleApi({req:{},res:{setHeader:(k,v)=>headers[k]=v},pathName:'/api/admin/posts/stories',owner:OWNER,method:'GET',readJSON:async()=>({}),ok:(res,data)=>{result=data;return data;}});
 assert.equal(result.counts.all,0);assert.equal(headers['Cache-Control'],'private, no-store');
 await assert.rejects(()=>studio.handleApi({req:{},res:{setHeader:()=>{}},pathName:'/api/admin/posts/stories',owner:OWNER,method:'DELETE',readJSON:async()=>({}),ok:()=>{}}),e=>e.status===405);
});
test('new Story Studio HTML uses Studio sidebar and safely escapes bootstrap data',()=>{
 const {studio}=fixture();const html=studio.html(OWNER);assert.match(html,/STORIES STUDIO|Stories Studio/);assert.match(html,/id="ssBooks"/);assert.match(html,/stories-studio\.js/);assert.match(html,/studio-sidebar|admin-sidebar/);assert.match(html,/noindex,nofollow/);
});
