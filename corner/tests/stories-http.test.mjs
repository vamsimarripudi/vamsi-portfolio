/** HTTP integration smoke, runs against isolated fixture with no production access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const fixture=join(dirname(fileURLToPath(import.meta.url)),'stories-fixture-server.mjs');
const PORT=48233;
const base=`http://127.0.0.1:${PORT}`;
async function waitForServer(proc){
 for(let i=0;i<60;i++){
  if(proc.exitCode!==null)throw new Error(`fixture terminated with ${proc.exitCode}`);
  try{const r=await fetch(base+'/stories');if(r.ok)return;}catch{}
  await new Promise(r=>setTimeout(r,80));
 }
 throw new Error('Fixture did not start');
}
test('complete story routes, chapter transport, and static audio without a deployment',async t=>{
 const proc=spawn(process.execPath,[fixture],{env:{...process.env,TEST_PORT:String(PORT)},stdio:'ignore'});
 t.after(()=>{if(proc.exitCode===null)proc.kill('SIGTERM');});
 await waitForServer(proc);
 const shelf=await fetch(base+'/stories');assert.equal(shelf.status,200);
 const shelfText=await shelf.text();assert.match(shelfText,/The House That Remembered Rain/);
 assert.doesNotMatch(shelfText,/Private unfinished chapter/);
 const overview=await fetch(base+'/stories/book/the-house-that-remembered-rain');assert.equal(overview.status,200);
 assert.match(await overview.text(),/CHAPTER 03/);
 const reading=await fetch(base+'/stories/read/the-house-that-remembered-rain?chapter=2');assert.equal(reading.status,200);
 const html=await reading.text();assert.match(html,/The Garden at Noon/);assert.match(html,/storyBootstrap/);
 const chapter=await fetch(base+'/api/stories/books/the-house-that-remembered-rain/chapters/2');
 const payload=await chapter.json();assert.equal(chapter.status,200);assert.equal(payload.data.chapter.title,'The Garden at Noon');
 assert.ok(payload.data.chapter.body.length>2000);
 assert.equal((await fetch(base+'/api/stories/books/the-house-that-remembered-rain/chapters/4')).status,404);
 assert.equal((await fetch(base+'/stories/book/a-nonexistent-book')).status,404);
 const audio=await fetch(base+'/stories-paper.mp3');assert.equal(audio.status,200);
 assert.match(audio.headers.get('content-type'),/audio\/mpeg/);
 assert.ok((await audio.arrayBuffer()).byteLength>25000);
 const geometry=await fetch(base+'/stories-motion.mjs');assert.equal(geometry.status,200);
 assert.match(await geometry.text(),/leafAngle/);
 const css=await fetch(base+'/stories-reader.css');assert.equal(css.status,200);
 assert.match(await css.text(),/reader-leaf/);
});
