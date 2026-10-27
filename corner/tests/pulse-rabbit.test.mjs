import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const pulse=read('companion.js'),app=read('app.js'),css=read('companion.css');
test('welcome is a real modal with a sharp scrollable letter and accessible fixed actions',()=>{
  assert.match(pulse,/document\.createElement\('dialog'\)/);
  assert.match(pulse,/letter\.showModal\(\)/);
  assert.match(pulse,/corner-welcome-letter-v2/);
  assert.match(pulse,/Read the welcome letter/);
  assert.match(pulse,/Create profile/);assert.match(pulse,/My profile/);
  assert.match(css,/pulse-welcome-modal::backdrop/);
  assert.match(css,/backdrop-filter:blur\(8px\)/);
  assert.match(css,/corner-letter-inner[^}]*overflow-y:auto/);
  assert.match(css,/corner-letter-actions[^}]*flex:none/);
});
test('one stream is shared by feed, detail and companion, with replay and visibility guards',()=>{
  assert.equal((app.match(/new EventSource\(/g)||[]).length,0);
  assert.equal((pulse.match(/new EventSource\(/g)||[]).length,1);
  assert.match(pulse,/seq<=cursor/);assert.match(pulse,/occurred>=liveAfter/);
  assert.match(pulse,/previous!==undefined&&total>previous&&!window\.CornerPublicLive\?\.reactionPending/);
  assert.match(pulse,/approved:data\.type==='comment.created'&&!!data\.payload\?\.commentId/);
  assert.match(pulse,/visibilitychange/);assert.match(pulse,/pageshow/);
  assert.match(pulse,/eventIds\.has\(d.id\)/);
  assert.match(pulse,/if\(d.type==='reaction'&&!d.active\)return/);
  assert.doesNotMatch(pulse,/comment\.body|user\.email|navigator\.sendBeacon|api\/analytics/);
});
test('character has limbs, native viewport-aware movement and no opaque animation dependency',()=>{
  for(const name of ['pulse-arm-left','pulse-arm-right','pulse-foot-left','pulse-foot-right','pulse-ear-left','pulse-ear-right','pulse-glory'])assert.ok(pulse.includes(name),name);
  for(const name of ['walk','hop','run','sit','wave','happy','curious'])assert.ok(css.includes('data-pose='+name),name);
  for(const name of ['calm','playful','paused','hidden'])assert.ok(pulse.includes('data-pulse-mode="'+name+'"'),name);
  assert.match(pulse,/visualViewport/);assert.match(pulse,/clearLine/);
  assert.match(pulse,/requestAnimationFrame\(tick\)/);assert.match(pulse,/cancelAnimationFrame/);
  assert.match(pulse,/dialog\[open\]/);assert.match(pulse,/\.account-shell/);
  assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/forced-colors:active/);
  assert.doesNotMatch(pulse,/eval\(|new Function|https:\/\//);
});
test('strict private-page guard stops all character, modal and network work',()=>{
  let calls=0;
  const sandbox={document:{querySelector(selector){calls++;assert.match(selector,/account-shell/);return {};}}};
  vm.runInNewContext(pulse,sandbox,{timeout:1000});assert.equal(calls,1);
});
test('front-end enhancement remains syntax-valid and reasonably bounded',()=>{
  assert.doesNotThrow(()=>new vm.Script(pulse));assert.doesNotThrow(()=>new vm.Script(app));
  assert.ok(Buffer.byteLength(pulse)<35000);assert.ok(Buffer.byteLength(css)<19000);
  assert.ok(Buffer.byteLength(app)+1604+5610+4955+2197<24000,'Existing core JS budget remains intact');
});

test('shared public stream rejects duplicates, stale celebrations, removal counts and invalid events',()=>{
  class Doc extends EventTarget {hidden=false;cookie='corner_reading_consent=deny';querySelector(){return null;}querySelectorAll(){return [];}}
  const doc=new Doc(),win=new EventTarget();win.__CORNER__={page:'detail',postId:'p1',eventCursor:10};
  const sources=[];
  class Source extends EventTarget {constructor(url){super();this.url=url;this.closed=false;sources.push(this);}close(){this.closed=true;}}
  win.EventSource=Source;
  const events=[];doc.addEventListener('corner:realtime',event=>events.push(event.detail));
  const sandbox={window:win,document:doc,EventSource:Source,CustomEvent,Event,navigator:{doNotTrack:'1'},location:{pathname:'/corner/post/test'},innerWidth:1200,setTimeout,clearTimeout,console};
  vm.createContext(sandbox);vm.runInContext(app,sandbox,{timeout:1000});
  const hub=pulse.split('// PULSE_SHARED_STREAM_START')[1].split('// PULSE_SHARED_STREAM_END')[0];
  vm.runInContext("{const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];"+hub+"}",sandbox,{timeout:1000});
  assert.equal(sources.length,1);
  const emit=(seq,type,payload={},stamp=new Date().toISOString())=>{
    const event=new Event(type);event.data=JSON.stringify({seq,id:'e'+seq,type,entityId:'p1',occurredAt:stamp,payload});event.lastEventId=String(seq);sources.at(-1).dispatchEvent(event);
  };
  emit(11,'reaction.updated',{counts:{love:1}});
  assert.equal(events.at(-1).increased,false,'First count establishes a baseline');
  emit(12,'reaction.updated',{counts:{love:2}});assert.equal(events.at(-1).increased,true);
  emit(12,'reaction.updated',{counts:{love:2}});assert.equal(events.length,2,'Duplicate sequence discarded');
  emit(13,'reaction.updated',{counts:{love:1}});assert.equal(events.at(-1).increased,false,'Removal does not celebrate');
  emit(14,'comment.pending',{body:'Never expose private pending text'});assert.equal(events.length,3);
  emit(15,'comment.created',{commentId:'c1'});assert.equal(events.at(-1).approved,true);assert.equal('body' in events.at(-1),false);
  emit(16,'post.published',{},new Date(Date.now()-60000).toISOString());assert.equal(events.at(-1).fresh,false);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(sources[0].closed,true);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(sources.length,2);
  assert.match(sources[1].url,/since=16$/);assert.equal(sources.filter(s=>!s.closed).length,1);
  win.dispatchEvent(new Event('pagehide'));assert.equal(sources[1].closed,true);
});
