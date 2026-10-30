import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Store} from '../src/store.mjs';
import {installJournalSeries,studioJournalSeries,journalSeriesBySlug,journalSeriesForPost,createJournalSeries} from '../src/journal-series.mjs';
import {journalSeriesPage} from '../src/journal-series-ui.mjs';
import {detailPage,feedPage,adminPage} from '../src/ui.mjs';
const memory=t=>{const store=new Store(':memory:');t.after(()=>store.close());return store};
const seriesSlug='learning-everything-doing-nothing',seriesId='series_learning_everything_doing_nothing';
const sourceBody='Learning Everything, Doing Nothing\n\nPart 1 — The Illusion of Progress\n\nI love learning new things.\n\nWhat if I’m confusing learning with progress?';

test('migration links only the exact original Part 01 without altering writing, image, date, slug or version',t=>{
 const store=memory(t),stamp='2026-10-29T17:56:24.667Z',originalId='post_fdbce666-5456-40e4-a3bc-1027b881b64e';
 store.exec("INSERT INTO posts(id,slug,type,title,body,state,published_at,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
  originalId,seriesSlug,'journal','Learning Everything, Doing Nothing',sourceBody,'published',stamp,4,stamp,stamp);
 store.addMedia({id:'media-original',ownerId:originalId,storageKey:'original.png',mimeType:'image/png',size:1920,alt:'Original image'});
 const before=store.adminPost(originalId);
 installJournalSeries(store);
 installJournalSeries(store);
 const after=store.adminPost(originalId);
 assert.equal(after.series_id,seriesId);assert.equal(after.series_part,1);
 for(const field of ['slug','title','body','published_at','version','updated_at'])
  assert.equal(after[field],before[field],field+' cannot be rewritten');
 assert.equal(store.listMedia(originalId)[0].storage_key,'original.png');
 const series=journalSeriesBySlug(store,seriesSlug);
 assert.equal(series.publishedCount,1);assert.equal(series.cover.storage_key,'original.png');
 assert.equal(series.parts[0].post.id,originalId);
 assert.equal(series.parts[1].published,false);
});

test('a new chapter stays private until published; uniqueness, ordering and type are enforced',t=>{
 const store=memory(t);
 const p=store.createPost({type:'journal',title:'Addicted to New Beginnings',body:'This part is a draft.',
  seriesId,seriesPart:2,allowComments:true},'owner');
 assert.equal(store.adminPost(p.id).series_part,2);
 assert.equal(journalSeriesBySlug(store,seriesSlug).publishedCount,0);
 assert.equal(journalSeriesBySlug(store,seriesSlug).parts[1].published,false);
 assert.throws(()=>store.createPost({type:'journal',title:'Duplicate chapter',body:'Not allowed',
  seriesId,seriesPart:2},'owner'),{status:409});
 assert.throws(()=>store.createPost({type:'tech_note',title:'Wrong category',body:'Not allowed',
  seriesId,seriesPart:3},'owner'),{status:400});
 assert.throws(()=>store.createPost({type:'journal',title:'Wrong series',body:'Not allowed',
  seriesId:'series_missing',seriesPart:3},'owner'),{status:400});
 const published=store.publish(p.id,'owner');
 const context=journalSeriesForPost(store,store.getPost(published.slug));
 assert.equal(context.current.part,2);assert.equal(context.current.title,'Addicted to New Beginnings');
 assert.equal(context.series.parts[1].published,true);
 const fresh=store.savePost(p.id,{version:published.version,body:'New text while keeping chapter membership'},'owner');
 assert.equal(fresh.series_id,seriesId);assert.equal(fresh.series_part,2);
 assert.equal(store.getPost(fresh.slug).series_part,2);
});

test('series hub is true to the original and keeps future chapters visibly unpublished',t=>{
 const store=memory(t);
 const part=store.createPost({type:'journal',title:'Learning Everything, Doing Nothing',body:sourceBody,
  seriesId,seriesPart:1},'owner');
 store.publish(part.id,'owner');
 store.addMedia({id:'media-real',ownerId:part.id,storageKey:'photo.png',mimeType:'image/png',size:1800,alt:'A writing desk'});
 const s=journalSeriesBySlug(store,seriesSlug),html=journalSeriesPage({series:s});
 assert.match(html,/Learning Everything, Doing Nothing/);
 assert.match(html,/The Illusion of Progress/);
 assert.match(html,/Addicted to New Beginnings/);
 assert.match(html,/Coming soon/);
 assert.match(html,/\/series\/learning-everything-doing-nothing/);
 assert.match(html,/\/post\/learning-everything-doing-nothing/);
 assert.match(html,/\/media\/photo.png/);
 assert.match(html,/CreativeWorkSeries/);
 assert.doesNotMatch(html,/href="\/post\/addicted-to-new-beginnings"/);
 const chapter=detailPage({post:store.getPost(part.slug),media:store.listMedia(part.id),
   seriesContext:journalSeriesForPost(store,store.getPost(part.slug))});
 assert.match(chapter,/journal-series-reading/);
 assert.match(chapter,/PART 01 OF 5/);
 assert.match(chapter,/<h1>The Illusion of Progress<\/h1>/);
 assert.match(chapter,/I love learning new things/);
 assert.equal((chapter.match(/data-post-carousel/g)||[]).length>0,true);
 assert.doesNotMatch(chapter,/<div class="post-body"><p>Learning Everything, Doing Nothing<\/p>/);
 assert.match(chapter,/Next · Part 02|NEXT · PART 02/);
});

test('non-series journal stays unchanged and authors can create additional independent series',t=>{
 const store=memory(t),regular=store.createPost({type:'journal',title:'Ordinary journal',body:'A normal journal entry.'},'owner');
 store.publish(regular.id,'owner');
 assert.equal(store.getPost(regular.slug).series_id,null);
 const page=detailPage({post:store.getPost(regular.slug),media:[]});
 assert.doesNotMatch(page,/journal-series-reading/);
 const fresh=createJournalSeries(store,{title:'A Different Series',subtitle:'Another ongoing journal'},'owner');
 assert.equal(fresh.nextPart,1);
 assert.equal(studioJournalSeries(store).length,2);
 assert.throws(()=>createJournalSeries(store,{title:'A Different Series'},'owner'),{status:409});
});

test('Studio exposes series choice and retained chapter number, while Journal has a featured series link',t=>{
 const store=memory(t);
 const form=fs.readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
 assert.match(form,/name="seriesId"/);assert.match(form,/name="seriesPart"/);
 assert.match(form,/\/corner\/api\/admin\/series/);
 const page=adminPage({owner:{role:'owner',id:'owner'}});
 assert.match(page,/admin\.js/);
 const part=store.createPost({type:'journal',title:'Learning Everything, Doing Nothing',body:sourceBody,
  seriesId,seriesPart:1},'owner');
 store.publish(part.id,'owner');
 const series=journalSeriesBySlug(store,seriesSlug);
 const journal=feedPage({posts:[store.getPost(part.slug)],active:'Journal',journalSeries:series});
 assert.match(journal,/journal-series-spotlight/);
 assert.match(journal,/Explore the series/);
});
