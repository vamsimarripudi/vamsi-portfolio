import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {startComposerFixture} from './composer-fixture.mjs';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const data=async response=>{
 const body=await response.json();
 assert.equal(response.ok,true,JSON.stringify(body));
 return body.data;
};

test('the redesigned Studio supports safe preview, replayable drafts, scheduling and private video edits through real HTTP',async t=>{
 const fixture=await startComposerFixture();
 t.after(()=>fixture.close());
 const {send,base,directory}=fixture;

 await t.test('Studio assets resolve once under the mounted Corner path',async()=>{
  const html=await (await send('/admin')).text();
  assert.doesNotMatch(html,/(?:href|src)=["']\/corner\/corner\//);
  const css=[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(match=>match[1]);
  assert.ok(css.some(url=>url.includes('command-center.css')));
  assert.ok(css.some(url=>url.includes('composer-workspace.css')));
  for(const url of css.filter(url=>/command-center|composer-workspace|studio\.css/.test(url))){
   const response=await fetch(fixture.origin+url);
   assert.equal(response.status,200,url);
   assert.match(response.headers.get('content-type'),/^text\/css/);
  }
 });

 let post;
 await t.test('create retries recover one private draft, then preserve explicit title and summary edits',async()=>{
  const payload={title:'An authored title',excerpt:'A carefully chosen summary.',body:'Original writing.',type:'journal',allowComments:true,allowReactions:true,clientRequestId:crypto.randomUUID()};
  const responses=await Promise.all([send('/api/admin/posts',{method:'POST',json:payload}),send('/api/admin/posts',{method:'POST',json:payload})]);
  const created=await Promise.all(responses.map(data));
  assert.equal(created[0].id,created[1].id);
  assert.equal(created.filter(record=>record.clientRequestReplayed).length,1);
  post=created[0];
  post=await data(await send('/api/admin/posts/'+post.id,{method:'PATCH',json:{version:post.version,title:'My manual title',excerpt:'My manual summary',body:'తెలుగులో నా ఆలోచనలు.\n\nA second paragraph in English.'}}));
  assert.equal(post.title,'My manual title');assert.equal(post.excerpt,'My manual summary');
  const records=await data(await send('/api/admin/posts'));
  assert.equal(records.length,1);
  assert.equal((await fetch(base+'/post/'+post.slug)).status,404,'draft never becomes public');
 });

 await t.test('preview is authenticated, inert, escaped and leaves all publishing state untouched',async()=>{
  const unsafe='A thought <script>window.previewLeak=true</script> & a second line.';
  const request={post:{type:'journal',title:'A temporary preview title',body:unsafe,excerpt:'Preview only.',allowComments:true,allowReactions:true},postId:post.id,seriesChoice:'__new__'};
  assert.equal((await send('/api/admin/posts/preview',{method:'POST',cookie:'',json:request})).status,401);
  const db=new DatabaseSync(path.join(directory,'corner.sqlite'),{readOnly:true});
  try{
   const before={posts:db.prepare('SELECT COUNT(*) n FROM posts').get().n,audits:db.prepare('SELECT COUNT(*) n FROM audit_events').get().n,series:db.prepare('SELECT COUNT(*) n FROM journal_series').get().n,events:db.prepare('SELECT COUNT(*) n FROM realtime_events').get().n};
   const preview=await data(await send('/api/admin/posts/preview',{method:'POST',json:request}));
   assert.equal(preview.previewOnly,true);assert.equal(preview.private,true);
   for(const document of [preview.feedHtml,preview.fullHtml]){
    assert.match(document,/<!doctype html>/i);
    assert.match(document,/A temporary preview title/);
    assert.match(document,/script-src 'none'/);
    assert.doesNotMatch(document,/<script\b|<form\b|on(?:click|load|error)=/i);
    assert.doesNotMatch(document,/<a\b[^>]*\bhref=/i,'reader navigation is inert inside private preview');
    assert.doesNotMatch(document,/\/corner\/corner\//);
   }
   assert.match(preview.fullHtml,/&lt;script&gt;window\.previewLeak=true&lt;\/script&gt;/);
   const after={posts:db.prepare('SELECT COUNT(*) n FROM posts').get().n,audits:db.prepare('SELECT COUNT(*) n FROM audit_events').get().n,series:db.prepare('SELECT COUNT(*) n FROM journal_series').get().n,events:db.prepare('SELECT COUNT(*) n FROM realtime_events').get().n};
   assert.deepEqual(after,before);
   assert.equal(db.prepare('SELECT title FROM posts WHERE id=?').get(post.id).title,'My manual title');
  }finally{db.close()}
 });

 await t.test('schedule uses the chosen IANA zone and cancellation rejects stale versions',async()=>{
  const year=new Date().getUTCFullYear()+1;
  let scheduled=await data(await send(`/api/admin/posts/${post.id}/schedule`,{method:'POST',json:{version:post.version,localTime:`${year}-01-23T08:15`,timezone:'Asia/Kolkata',recurrence:'none'}}));
  assert.equal(scheduled.scheduled_at,`${year}-01-23T02:45:00.000Z`);
  assert.equal(scheduled.state,'scheduled');
  const stale=await send(`/api/admin/posts/${post.id}/unschedule`,{method:'POST',json:{version:post.version}});
  assert.equal(stale.status,409);assert.equal((await stale.json()).error.code,'VERSION_CONFLICT');
  post=await data(await send(`/api/admin/posts/${post.id}/unschedule`,{method:'POST',json:{version:scheduled.version}}));
  assert.equal(post.state,'draft');assert.equal(post.scheduled_at,null);
  assert.equal(post.title,'My manual title');assert.equal(post.excerpt,'My manual summary');
  assert.equal(post.body,'తెలుగులో నా ఆలోచనలు.\n\nA second paragraph in English.');
 });

 await t.test('video processing remains private, edits retain identity and posters become public only with the post',async()=>{
  const file=path.join(directory,'synthetic-video.mp4');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=teal:s=96x64:r=12','-f','lavfi','-i','sine=frequency=660:sample_rate=44100','-t','3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',file],{timeout:15000});
  const upload=await data(await send('/api/admin/media/upload?postId='+post.id,{method:'POST',raw:fs.readFileSync(file),headers:{'content-type':'video/mp4'}}));
  assert.match(upload.jobId,/^vjob_/);
  const blocked=await send(`/api/admin/posts/${post.id}/publish`,{method:'POST',json:{}});
  assert.equal(blocked.status,409);assert.equal((await blocked.json()).error.code,'MEDIA_PROCESSING');
  async function untilReady(jobId){
   let job;
   for(let attempt=0;attempt<80;attempt++){
    job=await data(await send(`/api/admin/media/jobs/${jobId}?postId=${post.id}`));
    if(['ready','failed'].includes(job.state))break;
    await wait(100);
   }
   assert.equal(job.state,'ready',JSON.stringify(job));return job;
  }
  const processed=await untilReady(upload.jobId);
  let detail=await data(await send('/api/admin/posts/'+post.id));
  assert.ok(detail.mediaJobs.some(job=>job.jobId===processed.jobId&&job.state==='ready'));
  let video=detail.media.find(item=>item.id===processed.mediaId);
  assert.ok(video);
  const poster='/media/'+video.storage_key+'?poster=1';
  assert.equal((await fetch(base+poster)).status,404);
  assert.match((await send(poster)).headers.get('content-type'),/^image\/jpeg/);
  assert.equal((await send(`/api/admin/media/${video.id}/video-edit`,{cookie:''})).status,401);
  const recipe=await data(await send(`/api/admin/media/${video.id}/video-edit`));
  assert.ok(recipe.sourceDuration>=3);
  const edit=await data(await send(`/api/admin/media/${video.id}/video-edit`,{method:'POST',json:{start:0.5,end:2.5,muted:true,posterAt:0.2}}));
  assert.equal(edit.jobId,upload.jobId);
  const duplicate=await send(`/api/admin/media/${video.id}/video-edit`,{method:'POST',json:{start:0,end:1}});
  assert.equal(duplicate.status,409);
  await untilReady(edit.jobId);
  detail=await data(await send('/api/admin/posts/'+post.id));
  assert.equal(detail.media.length,1);
  assert.equal(detail.media[0].id,video.id);
  assert.equal(detail.media[0].storage_key,video.storage_key,'an edit preserves existing media links');
  assert.equal(detail.media[0].has_poster,true);
  video=detail.media[0];
  const preview=await data(await send('/api/admin/posts/preview',{method:'POST',json:{post,postId:post.id}}));
  assert.ok(preview.fullHtml.includes('/corner/media/'+video.storage_key+'?poster=1'));
  const published=await data(await send(`/api/admin/posts/${post.id}/publish`,{method:'POST',json:{}}));
  const publishedAgain=await data(await send(`/api/admin/posts/${post.id}/publish`,{method:'POST',json:{}}));
  assert.equal(publishedAgain.version,published.version);
  assert.equal((await fetch(base+'/media/'+video.storage_key+'?poster=1')).status,200);
  const publicPage=await (await fetch(base+'/post/'+published.slug)).text();
  assert.match(publicPage,/My manual title/);
  assert.ok(publicPage.includes('/corner/media/'+video.storage_key+'?poster=1'));
  assert.doesNotMatch(publicPage,/\/corner\/corner\//);
  const outbox=path.join(directory,'mail.outbox');
  assert.equal(fs.existsSync(outbox)?fs.readFileSync(outbox,'utf8').trim():'','', 'publishing never sends an unsolicited subscriber email');
 });
});
