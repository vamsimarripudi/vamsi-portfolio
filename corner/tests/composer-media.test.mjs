import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Store} from '../src/store.mjs';
import {CornerMediaJobs,normalizeVideoRecipe} from '../src/v5-media.mjs';
import {renderMedia,renderPostGallery} from '../src/ui.mjs';

function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'corner-composer-media-'));
 const store=new Store(':memory:'),jobs=new CornerMediaJobs(store,{uploads:directory});
 jobs.busy=true;
 const post=store.createPost({title:'An isolated media draft',body:'Original draft writing.'},'owner');
 t.after(()=>{jobs.busy=true;store.close();fs.rmSync(directory,{recursive:true,force:true})});
 return {directory,store,jobs,post};
}
function insertJob({store,jobs,post},{state='failed',mediaId=null,sourceBytes=Buffer.from('isolated source'),recipe=null}={}){
 const id='vjob_'+crypto.randomUUID(),source=id+'.mp4',stamp=new Date().toISOString();
 fs.writeFileSync(path.join(jobs.queueDir,source),sourceBytes);
 store.exec('INSERT INTO corner_v5_media_jobs(id,post_id,source_key,source_mime,state,media_id,created_at,updated_at,applied_recipe) VALUES(?,?,?,?,?,?,?,?,?)',id,post.id,source,'video/mp4',state,mediaId,stamp,stamp,recipe?JSON.stringify(recipe):null);
 return {id,source};
}

test('failed uploads can be retried or removed only in their exact post scope',t=>{
 const f=fixture(t),{id,source}=insertJob(f);
 assert.throws(()=>f.jobs.retry(id,'another-post','owner'),{status:404});
 assert.throws(()=>f.jobs.discardJob(id,'another-post','owner'),{status:404});
 assert.equal(f.jobs.status(id,f.post.id).state,'failed');
 const retried=f.jobs.retry(id,f.post.id,'owner');
 assert.equal(retried.state,'queued');
 assert.throws(()=>f.jobs.retry(id,f.post.id,'owner'),{code:'MEDIA_JOB_NOT_FAILED'});
 assert.throws(()=>f.jobs.discardJob(id,f.post.id,'owner'),{code:'MEDIA_JOB_BUSY'});
 f.store.exec("UPDATE corner_v5_media_jobs SET state='failed' WHERE id=?",id);
 const discarded=f.jobs.discardJob(id,f.post.id,'owner');
 assert.equal(discarded.discarded,true);
 assert.equal(discarded.mediaPreserved,false);
 assert.equal(fs.existsSync(path.join(f.jobs.queueDir,source)),false);
 assert.equal(f.jobs.list(f.post.id).length,0);
 assert.equal(f.store.publish(f.post.id,'owner').state,'published');
 assert.equal(f.store.one("SELECT COUNT(*) n FROM audit_events WHERE action='media.processing.discarded'").n,1);
});

test('discarding a failed video edit restores the last good recipe and preserves original/output',t=>{
 const f=fixture(t),mediaId='media_'+crypto.randomUUID(),output='working-video.mp4';
 f.store.addMedia({id:mediaId,ownerId:f.post.id,storageKey:output,mimeType:'video/mp4',size:20});
 fs.writeFileSync(path.join(f.directory,output),'working playable output');
 const recipe={start:1,end:4,muted:false,posterAt:0.5};
 const {id,source}=insertJob(f,{mediaId,recipe});
 f.store.exec('UPDATE corner_v5_media_jobs SET trim_start=?,trim_end=?,muted=?,poster_at=? WHERE id=?',6,12,1,2,id);
 const result=f.jobs.discardJob(id,f.post.id,'owner');
 assert.equal(result.mediaPreserved,true);
 const restored=f.jobs.videoRecipe(mediaId);
 assert.equal(restored.state,'ready');
 assert.equal(restored.start,1);assert.equal(restored.end,4);
 assert.equal(restored.muted,false);assert.equal(restored.posterAt,0.5);
 assert.equal(fs.existsSync(path.join(f.jobs.queueDir,source)),true);
 assert.equal(fs.readFileSync(path.join(f.directory,output),'utf8'),'working playable output');
 assert.equal(f.store.listMedia(f.post.id).length,1);
});

test('video trim, sound and poster input reject invalid or out-of-range choices',()=>{
 assert.deepEqual(normalizeVideoRecipe({start:1,end:3,muted:true,posterAt:0.2}),{start:1,end:3,muted:true,posterAt:0.2});
 for(const request of [{start:-1},{end:181},{start:2,end:1},{start:2,end:4,posterAt:2},{muted:'false'},{posterAt:Infinity}]){
  assert.throws(()=>normalizeVideoRecipe(request),error=>error.status===400);
 }
});

test('legacy videos without generated posters keep their normal playback presentation',t=>{
 const f=fixture(t),mediaId='media_'+crypto.randomUUID();
 f.store.addMedia({id:mediaId,ownerId:f.post.id,storageKey:'legacy-video.webm',mimeType:'video/webm',size:100});
 const media=f.store.listMedia(f.post.id);
 assert.equal(media[0].has_poster,false);
 assert.match(renderMedia(media),/<video\b/);
 assert.doesNotMatch(renderMedia(media),/\bposter=/);
 assert.doesNotMatch(renderPostGallery(media),/\bposter=/);
});

test('saved-video trim, mute and poster are encoded from the retained original without replacing media identity',async t=>{
 const f=fixture(t),source=path.join(f.directory,'synthetic-source.mp4');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=128x96:rate=15','-f','lavfi','-i','sine=frequency=880:sample_rate=44100','-t','4','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',source],{timeout:20000});
 const original=fs.readFileSync(source);
 const job=f.jobs.start({postId:f.post.id,buffer:original,mime:'video/mp4',caption:'A synthetic clip.'});
 f.jobs.busy=false;await f.jobs.drain();
 let state=f.jobs.status(job.jobId,f.post.id);
 assert.equal(state.state,'ready',JSON.stringify(state));
 const mediaId=state.mediaId,first=f.store.listMedia(f.post.id)[0];
 assert.equal(first.id,mediaId);
  assert.equal(first.has_poster,true);
  const firstBytes=fs.readFileSync(path.join(f.directory,first.storage_key));
 const retained=f.store.one('SELECT source_key FROM corner_v5_media_jobs WHERE id=?',job.jobId).source_key;
 assert.deepEqual(fs.readFileSync(path.join(f.jobs.queueDir,retained)),original);
 const firstPoster=f.jobs.poster(first);
 assert.equal(firstPoster.mime,'image/jpeg');
 assert.ok(fs.statSync(firstPoster.filename).size>50);

 const editing=f.jobs.editVideo(mediaId,{start:1,end:3,muted:true,posterAt:0.25},'owner');
 assert.equal(editing.state,'queued');
 assert.equal(f.store.listMedia(f.post.id)[0].storage_key,first.storage_key,'usable output remains during processing');
 assert.equal(fs.existsSync(path.join(f.directory,first.storage_key)),true);
 assert.throws(()=>f.jobs.editVideo(mediaId,{start:0,end:2},'owner'),{code:'MEDIA_PROCESSING'});
 await f.jobs.drain();
 state=f.jobs.status(job.jobId,f.post.id);
 assert.equal(state.state,'ready',JSON.stringify(state));
 const edited=f.store.listMedia(f.post.id)[0];
 assert.equal(edited.id,mediaId);
  assert.equal(edited.storage_key,first.storage_key,'public media URLs stay stable after an edit');
  assert.notDeepEqual(fs.readFileSync(path.join(f.directory,edited.storage_key)),firstBytes);
 assert.equal(edited.caption,'A synthetic clip.');
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type','-of','json',path.join(f.directory,edited.storage_key)],{encoding:'utf8',timeout:10000}));
 assert.ok(Math.abs(Number(probe.format.duration)-2)<0.15,'trimmed video duration matches the selected interval');
 assert.equal(probe.streams.filter(stream=>stream.codec_type==='audio').length,0,'mute removes the encoded audio track');
 assert.ok(f.jobs.poster(edited));
 assert.deepEqual(fs.readFileSync(path.join(f.jobs.queueDir,retained)),original,'source bytes survive repeated editing');
 assert.equal(f.store.listMedia(f.post.id).length,1);

  const workingBytes=fs.readFileSync(path.join(f.directory,edited.storage_key)),workingPoster=f.jobs.poster(edited).filename;
  const workingPosterBytes=fs.readFileSync(workingPoster);
  f.store.db.exec("CREATE TRIGGER reject_composer_video_update BEFORE UPDATE OF duration ON media BEGIN SELECT RAISE(ABORT,'synthetic commit failure'); END");
  f.jobs.editVideo(mediaId,{start:0,end:2.5,muted:false,posterAt:0.3},'owner');
  await f.jobs.drain();
  assert.equal(f.jobs.status(job.jobId,f.post.id).state,'failed');
  assert.deepEqual(fs.readFileSync(path.join(f.directory,edited.storage_key)),workingBytes,'a failed database commit restores the previous working video');
  assert.equal(f.jobs.poster(edited).filename,workingPoster);
  assert.deepEqual(fs.readFileSync(workingPoster),workingPosterBytes);
  assert.equal(f.store.listMedia(f.post.id)[0].storage_key,first.storage_key);
  assert.equal(fs.readdirSync(f.jobs.queueDir).some(name=>name.startsWith('rollback-')),false);
  f.store.db.exec('DROP TRIGGER reject_composer_video_update');
  f.jobs.discardJob(job.jobId,f.post.id,'owner');
  assert.equal(f.jobs.videoRecipe(mediaId).muted,true,'discard restores the last successfully applied settings');

 const poster=f.jobs.poster(edited).filename;
 f.jobs.discard(mediaId);
 assert.equal(fs.existsSync(path.join(f.jobs.queueDir,retained)),false);
 assert.equal(fs.existsSync(poster),false);
 assert.equal(f.jobs.list(f.post.id).length,0);
});
