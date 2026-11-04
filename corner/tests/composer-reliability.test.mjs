import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../src/store.mjs';
import {JournalSeries} from '../src/journal-series.mjs';

const memory=t=>{const store=new Store(':memory:');t.after(()=>store.close());return store};
const draft=(store,extra={})=>store.createPost({type:'tech_note',title:'A deliberately chosen title',excerpt:'An authored summary.',body:'The original words stay here.',allowComments:true,allowReactions:true,...extra},'owner');
const future=()=>new Date(Date.now()+3600000).toISOString();
const mediaJobs=store=>store.db.exec('CREATE TABLE corner_v5_media_jobs(id TEXT PRIMARY KEY,post_id TEXT,state TEXT)');

test('a lost draft-create response can be retried without duplicate content or audit events',t=>{
 const store=memory(t),key='draft-request-20261104-001';
 const first=draft(store,{clientRequestId:key});
 const replay=draft(store,{clientRequestId:key,body:'Newer words awaiting PATCH.'});
 assert.equal(replay.id,first.id);
 assert.equal(replay.clientRequestReplayed,true);
 assert.equal(replay.body,first.body,'the replay reports what is actually saved');
 assert.equal(store.one('SELECT COUNT(*) n FROM posts').n,1);
 assert.equal(store.one("SELECT COUNT(*) n FROM audit_events WHERE action='post.created'").n,1);
 const saved=store.savePost(replay.id,{version:replay.version,body:'Newer words awaiting PATCH.'},'owner');
 assert.equal(saved.body,'Newer words awaiting PATCH.');
 assert.equal(draft(store,{clientRequestId:key}).version,saved.version);
 const other=store.createPost({title:'Another author draft',body:'Independent writing.',clientRequestId:key},'another-owner');
 assert.notEqual(other.id,first.id,'request keys are scoped to the acting account');
});

test('idempotency keys survive a database reopen without changing an existing post',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'corner-composer-replay-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const filename=path.join(directory,'corner.sqlite'),key='draft-request-persistence-001';
 let store=new Store(filename);
 const first=draft(store,{clientRequestId:key});
 const published=store.publish(first.id,'owner');
 store.close();
 store=new Store(filename);
 try{
  const replay=draft(store,{clientRequestId:key});
  assert.equal(replay.id,first.id);
  assert.equal(replay.state,'published');
  assert.equal(replay.published_at,published.published_at);
  assert.equal(store.one('SELECT COUNT(*) n FROM posts').n,1);
  assert.equal(store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{store.close()}
});

test('invalid request identifiers cannot create draft records',t=>{
 const store=memory(t);
 for(const key of ['',null,42,'too-short','x'.repeat(129),'valid-length-key/invalid']){
  assert.throws(()=>draft(store,{clientRequestId:key}),{status:400,code:'INVALID_REQUEST_ID'});
 }
 assert.equal(store.one('SELECT COUNT(*) n FROM posts').n,0);
});

test('cancel scheduling preserves the story, media and series and prevents future publication',t=>{
 const store=memory(t),series=new JournalSeries(store);
 const post=draft(store,{type:'journal',tags:['Learning'],clientRequestId:'journal-cancel-schedule-001'});
 const assignment=series.organize(post.id,{mode:'new'},'owner');
 store.addMedia({id:'photo-a',ownerId:post.id,storageKey:'photo-a.jpg',mimeType:'image/jpeg',size:150,caption:'The original caption.'});
 const scheduled=store.schedule(post.id,{scheduledAt:future(),timezone:'Asia/Kolkata',featureStartAt:future(),pinStartAt:future()},'owner');
 assert.throws(()=>store.unschedule(post.id,{version:scheduled.version-1},'owner'),{status:409,code:'VERSION_CONFLICT'});
 assert.equal(store.adminPost(post.id).state,'scheduled');
 const cancelled=store.unschedule(post.id,{version:scheduled.version},'owner');
 assert.equal(cancelled.state,'draft');
 assert.equal(cancelled.scheduled_at,null);
 assert.equal(cancelled.recurrence,'none');
 assert.equal(cancelled.feature_start_at,null);
 assert.equal(cancelled.pin_start_at,null);
 assert.equal(cancelled.title,post.title);
 assert.equal(cancelled.excerpt,post.excerpt);
 assert.equal(cancelled.body,post.body);
 assert.equal(cancelled.slug,post.slug);
 assert.deepEqual(cancelled.tags,post.tags);
 assert.equal(store.listMedia(post.id)[0].caption,'The original caption.');
 assert.equal(series.assignment(post.id).slug,assignment.slug);
 assert.equal(store.tick(new Date(Date.now()+7200000).toISOString()).length,0);
 assert.equal(store.getPost(post.slug),null);
 assert.throws(()=>store.unschedule(post.id,{version:cancelled.version},'owner'),{code:'NOT_SCHEDULED'});
});

test('rescheduling rejects a stale saved version and never silently overwrites it',t=>{
 const store=memory(t),post=draft(store);
 const saved=store.savePost(post.id,{version:post.version,title:'The latest title'},'owner');
 assert.throws(()=>store.schedule(post.id,{version:post.version,scheduledAt:future()},'owner'),{code:'VERSION_CONFLICT'});
 assert.equal(store.adminPost(post.id).state,'draft');
 assert.equal(store.schedule(post.id,{version:saved.version,scheduledAt:future()},'owner').state,'scheduled');
});

test('video processing and failed uploads block publication and scheduling with actionable states',t=>{
 const store=memory(t),post=draft(store);mediaJobs(store);
 store.exec('INSERT INTO corner_v5_media_jobs VALUES(?,?,?)','pending-video',post.id,'queued');
 for(const state of ['queued','processing','failed']){
  store.exec('UPDATE corner_v5_media_jobs SET state=? WHERE id=?',state,'pending-video');
  const code=state==='failed'?'MEDIA_PROCESSING_FAILED':'MEDIA_PROCESSING';
  assert.throws(()=>store.publish(post.id,'owner'),{status:409,code});
  assert.throws(()=>store.schedule(post.id,{scheduledAt:future()},'owner'),{status:409,code});
  assert.equal(store.getFeed().items.length,0);
 }
 store.exec("UPDATE corner_v5_media_jobs SET state='ready' WHERE id='pending-video'");
 const published=store.publish(post.id,'owner');
 assert.equal(published.state,'published');
 assert.equal(store.publish(post.id,'owner').version,published.version,'double publish has no extra transition');
 assert.equal(store.one("SELECT COUNT(*) n FROM realtime_events WHERE type='post.published'").n,1);
});

test('a scheduled post waits when a video was attached later and publishes once after recovery',t=>{
 const store=memory(t),post=draft(store);mediaJobs(store);
 const due=future();
 store.schedule(post.id,{scheduledAt:due},'owner');
 store.exec('INSERT INTO corner_v5_media_jobs VALUES(?,?,?)','late-video',post.id,'processing');
 const after=new Date(Date.parse(due)+1000).toISOString();
 assert.deepEqual(store.tick(after),[]);
 assert.equal(store.adminPost(post.id).state,'scheduled');
 store.exec("UPDATE corner_v5_media_jobs SET state='failed' WHERE id='late-video'");
 assert.deepEqual(store.tick(after),[]);
 store.exec("UPDATE corner_v5_media_jobs SET state='ready' WHERE id='late-video'");
 assert.equal(store.tick(after).length,1);
 assert.deepEqual(store.tick(after),[]);
 assert.equal(store.one('SELECT COUNT(*) n FROM post_occurrences').n,1);
});

test('a media-only draft publishes without fabricated body text',t=>{
 const store=memory(t),post=draft(store,{type:'moment',body:'',excerpt:''});
 assert.throws(()=>store.publish(post.id,'owner'),{status:400});
 store.addMedia({id:'media-only',ownerId:post.id,storageKey:'media-only.jpg',mimeType:'image/jpeg',size:200});
 const published=store.publish(post.id,'owner');
 assert.equal(published.body,'');
 assert.equal(published.excerpt,'');
 assert.equal(store.getPost(post.slug).body,'');
});

test('editing a published post keeps its original URL, publication time and interactions',t=>{
 const store=memory(t),post=draft(store);
 const published=store.publish(post.id,'owner');
 store.changeReaction(post.id,'❤️','a-real-reader');
 const comment=store.comment(post.id,'Reader','A thoughtful response.');
 store.moderate(comment.id,'approved','owner');
 const updated=store.savePost(post.id,{version:published.version,title:'A manually revised title',excerpt:'A manually revised summary',body:'Revised words.'},'owner');
 assert.equal(updated.slug,post.slug);
 assert.equal(updated.published_at,published.published_at);
 assert.equal(updated.title,'A manually revised title');
 assert.equal(updated.excerpt,'A manually revised summary');
 assert.equal(store.getReactions(post.id)['❤️'],1);
 assert.equal(store.getComments(post.id)[0].body,'A thoughtful response.');
});
