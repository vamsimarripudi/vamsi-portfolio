import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Store} from '../src/store.mjs';
import {JournalSeries,FIRST_SERIES_SLUG,FIRST_PART_ID,FIRST_PART_SLUG,FIRST_SERIES_TITLE} from '../src/journal-series.mjs';
import {journalSeriesPage,detailPage,feedPage,card} from '../src/ui.mjs';
import {getChapterTitle,seriesStoryBody} from '../src/journal-series-ui.mjs';

const firstBody='Learning Everything, Doing Nothing\n\nPart 1 — The Illusion of Progress\n\nI love learning new things.\n\nWhat if I’m confusing learning with progress?\n\nLearning gives me a sense of accomplishment. Execution demands proof.\n\nTo be continued…\n\nNext: Part 2 — Addicted to New Beginnings';
function fixture(t,{first=true,published=true}={}){
 const store=new Store(':memory:');t.after(()=>store.close());
 store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('owner','owner@fixture.test','Owner','owner','hash',datetime('now'),datetime('now'))");
 if(first){
  const date='2026-10-29T17:56:24.667Z';
  store.exec(`INSERT INTO posts(id,slug,type,title,excerpt,body,state,published_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`,FIRST_PART_ID,FIRST_PART_SLUG,'journal',FIRST_SERIES_TITLE,
    'The Pause Between Knowing and Doing.',firstBody,published?'published':'draft',published?date:null,date,date);
  store.exec(`INSERT INTO media(id,owner_type,owner_id,storage_key,mime_type,size_bytes,alt_text,caption,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)`,'media_cover','post',FIRST_PART_ID,'existing-first-cover.png','image/png',14000,'Original chapter photo','The Pause Between Knowing and Doing.',date);
 }
 return store;
}
test('Exact published Part 01 is linked without rewriting original post or media',t=>{
 const store=fixture(t);
 const original=store.one('SELECT id,slug,title,body,version FROM posts WHERE id=?',FIRST_PART_ID);
 const media=store.listMedia(FIRST_PART_ID);
 const series=new JournalSeries(store);
 const published=series.published(FIRST_SERIES_SLUG);
 assert.equal(published.slug,FIRST_SERIES_SLUG);
 assert.equal(published.parts.length,1);
 assert.equal(published.parts[0].id,FIRST_PART_ID);
 assert.equal(published.parts[0].partNumber,1);
 assert.equal(published.parts[0].cover.storage_key,'existing-first-cover.png');
 assert.deepEqual(store.one('SELECT id,slug,title,body,version FROM posts WHERE id=?',FIRST_PART_ID),original);
 assert.deepEqual(store.listMedia(FIRST_PART_ID),media);
 new JournalSeries(store);
 assert.equal(store.one('SELECT count(*) AS n FROM journal_series_parts').n,1,'Startup seeding remains idempotent');
});
test('No fabricated public series exists without the real published Part 01',t=>{
 const store=fixture(t,{first:false});
 const series=new JournalSeries(store);
 assert.equal(series.published(FIRST_SERIES_SLUG),null);
 assert.equal(store.one('SELECT COUNT(*) AS n FROM journal_series').n,0);
});
test('A private draft Part 01 does not activate public series',t=>{
 const store=fixture(t,{published:false});
 const series=new JournalSeries(store);
 assert.equal(series.published(FIRST_SERIES_SLUG),null);
 assert.equal(store.one('SELECT COUNT(*) AS n FROM journal_series_parts').n,0);
});
test('New chapters stay private until published, then previous and next links connect',t=>{
 const store=fixture(t);
 const series=new JournalSeries(store);
 const next=store.createPost({type:'journal',title:'Addicted to New Beginnings',body:'The next chapter.'},'owner');
 const joined=series.assign(next.id,FIRST_SERIES_SLUG,2,'owner');
 assert.equal(joined.partNumber,2);
 assert.equal(series.published(FIRST_SERIES_SLUG).parts.length,1,'Draft chapter must not leak');
 assert.equal(series.forPost(next.id),null,'No private details exposed');
 assert.throws(()=>series.assign(next.id,FIRST_SERIES_SLUG,1,'owner'),{status:409});
 assert.equal(series.assignment(next.id).partNumber,2,'Conflict preserves prior chapter link');
 store.publish(next.id,'owner');
 const live=series.published(FIRST_SERIES_SLUG);
 assert.equal(live.parts.length,2);
 assert.equal(series.forPost(FIRST_PART_ID).next.id,next.id);
 assert.equal(series.forPost(next.id).previous.id,FIRST_PART_ID);
 assert.equal(series.decorate(live.parts[1]).series.partNumber,2);
 const wrong=store.createPost({type:'moment',title:'Not a journal',body:'Photo moment'},'owner');
 assert.throws(()=>series.assign(wrong.id,FIRST_SERIES_SLUG,3,'owner'),{status:400});
});
test('Marginalia series page uses the actual first cover and only published chapter links',t=>{
 const store=fixture(t);const series=new JournalSeries(store);
 const html=journalSeriesPage({series:series.published(FIRST_SERIES_SLUG)});
 assert.match(html,/Learning Everything, Doing Nothing/);
 assert.match(html,/id="series-title"/);
 assert.match(html,/CHAPTER 01/);
 assert.match(html,/The Illusion of Progress/);
 assert.match(html,/media\/existing-first-cover\.png/);
 assert.match(html,/href="\/post\/learning-everything-doing-nothing"/);
 assert.match(html,/CreativeWorkSeries/);
 assert.doesNotMatch(html,/href="\/post\/part-2"/);
 assert.match(html,/journal-series\.css\?v=1/);
 assert.match(html,/rel="canonical" href="[^"]+\/series\/learning-everything-doing-nothing"/);
});
test('Part 01 renders as one editorial chapter; source body remains complete',t=>{
 const store=fixture(t);const series=new JournalSeries(store);
 const post=store.getPost(FIRST_PART_SLUG);
 const html=detailPage({post,media:store.listMedia(FIRST_PART_ID),series:series.forPost(FIRST_PART_ID)});
 assert.equal(getChapterTitle(post,1),'The Illusion of Progress');
 assert.match(html,/class="post-article journal-series-article"/);
 assert.match(html,/class="series-chapter-prelude"/);
 assert.match(html,/<h1>The Illusion of Progress<\/h1>/);
 assert.match(html,/What if I’m confusing learning with progress\?/);
 assert.match(html,/class="series-pull-quote"/);
 assert.match(html,/Part 2 is in progress/);
 assert.match(html,/href="\/series\/learning-everything-doing-nothing"/);
 assert.equal(store.getPost(FIRST_PART_SLUG).body,firstBody,'Persisted original text unchanged');
 const rendered=seriesStoryBody(post,series.forPost(FIRST_PART_ID));
 assert.doesNotMatch(rendered,/^<p>Learning Everything, Doing Nothing<\/p>/);
 assert.doesNotMatch(rendered,/^<p>Part 1 — The Illusion of Progress<\/p>/);
});
test('Journal feed highlights real series while unrelated categories remain unchanged',t=>{
 const store=fixture(t);const series=new JournalSeries(store);
 const post=series.decorate(store.getPost(FIRST_PART_SLUG));
 const journal=feedPage({active:'Journal',posts:[post],featuredSeries:series.published(FIRST_SERIES_SLUG)});
 assert.match(journal,/SERIAL JOURNAL/);
 assert.match(journal,/SERIES · CHAPTER 01/);
 assert.match(journal,/Explore series/);
 assert.doesNotMatch(feedPage({active:'Builds',posts:[]}),/SERIAL JOURNAL/);
 assert.doesNotMatch(card({...post,series:null}),/SERIES · CHAPTER/);
});
test('Mobile layout, reduced motion, and Studio series selectors exist',()=>{
 const css=fs.readFileSync(new URL('../public/journal-series.css',import.meta.url),'utf8');
 const admin=fs.readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
 const server=fs.readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
 assert.match(css,/max-width:760px/);assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/series-cover-photo/);assert.match(css,/journal-series-article/);
 assert.match(admin,/name="seriesSlug"/);assert.match(admin,/name="seriesPart"/);
 assert.match(server,/journalSeries\.assign/);
 assert.match(server,/journalSeriesPage/);
});
