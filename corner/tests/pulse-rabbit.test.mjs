// Existing CI entrypoint retained; companion is now the requested Doraemon v3.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const pulse=read('companion.js'),css=read('companion.css');
const app=fs.existsSync(new URL('../public/app.js',import.meta.url))?read('app.js'):null;
test('welcome retains native modality, fixed actions, focus and dismissal',()=>{
  for(const pattern of [/document\.createElement\('dialog'\)/,/letter\.showModal\(\)/,/corner-welcome-letter-v2/,/Read the welcome letter/,/Create profile/,/My profile/])assert.match(pulse,pattern);
  for(const pattern of [/pulse-welcome-modal::backdrop/,/backdrop-filter:blur\(8px\)/,/corner-letter-inner[^}]*overflow-y:auto/,/corner-letter-actions[^}]*flex:none/])assert.match(css,pattern);
});
test('one public stream, freshness and valid reactions stay authoritative',()=>{
  assert.equal((pulse.match(/new EventSource\(/g)||[]).length,1);
  for(const pattern of [/seq<=cursor/,/occurred>=liveAfter/,/previous!==undefined&&total>previous&&!window\.CornerPublicLive\?\.reactionPending/,/approved:data\.type==='comment.created'&&!!data\.payload\?\.commentId/,/eventIds\.has\(d.id\)/,/if\(d.type==='reaction'&&!d.active\)return/])assert.match(pulse,pattern);
  assert.doesNotMatch(pulse,/comment\.body|user\.email|navigator\.sendBeacon|api\/analytics|mediaDevices|getUserMedia/);
});
test('Doraemon has articulated parts, true distance-driven stride and bounded edge routines',()=>{
  for(const name of ['pulse-doraemon','pulse-foot-left','pulse-foot-right','pulse-arm-left','pulse-arm-right','pulse-whiskers','pulse-bell','pulse-pocket','pulse-glory'])assert.ok(pulse.includes(name),name);
  assert.doesNotMatch(pulse,/pulse-rabbit|pulse-ear-left|pulse-ear-right/);
  for(const name of ['walk','run','sit','wave','happy','curious','peek','edge-hidden'])assert.ok(css.includes('data-pose='+name),name);
  for(const mode of ['calm','playful','paused','hidden'])assert.ok(pulse.includes('data-pulse-mode="'+mode+'"'));
  for(const pattern of [/phase\+=distance\//,/function edgeJourney/,/routeMemory\.reverse/,/requestAnimationFrame\(tick\)/,/cancelAnimationFrame/,/clearLine/,/visualViewport/,/\.account-shell/,/dialog\[open\]/])assert.match(pulse,pattern);
  assert.match(css,/pulse-stage[^}]*overflow:hidden/);
  assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/forced-colors:active/);
});
test('hover and focus greetings are dismissible; story menu uses current public data',()=>{
  for(const pattern of [/role','tooltip'/,/Hi! How are you\?/,/aria-describedby/,/tip\.addEventListener\('pointerenter'/,/event\.key!=='Escape'/,/card\.show\(\)/,/api\/posts\?limit=12/,/data-pulse-action="tour"/,/data-pulse-action="surprise"/,/encodeURIComponent\(item.slug\)/])assert.match(pulse,pattern);
  assert.doesNotMatch(pulse,/card\.showModal\(\)/,'A casual companion menu is not a blocking modal');
});
test('audio is opt-in, original local synthesis, bounded volume and lifecycle cleanup',()=>{
  assert.match(pulse,/sound=false,audio=null/);
  assert.equal((pulse.match(/new Context\(/g)||[]).length,1);
  assert.match(pulse,/addEventListener\('click',toggleSound\)/);
  assert.match(pulse,/await audio\.resume\(\)/);assert.match(pulse,/oscillator\.onended/);
  assert.match(pulse,/if\(!sound\|\|!audio/);assert.match(pulse,/max="40"/);
  assert.match(pulse,/visibilitychange/);assert.match(pulse,/pagehide/);
  assert.doesNotMatch(pulse,/speechSynthesis|new Audio\(|\.mp3|\.wav|https:\/\//);
});
test('private page is excluded before any DOM, sound or network initialization',()=>{
  let calls=0;vm.runInNewContext(pulse,{document:{querySelector(selector){calls++;assert.match(selector,/account-shell/);return {};}}},{timeout:1000});assert.equal(calls,1);
});
test('syntax and explicit optional payload budgets',()=>{
  assert.doesNotThrow(()=>new vm.Script(pulse));assert.ok(Buffer.byteLength(pulse)<50000);
  assert.ok(Buffer.byteLength(css)<19000);assert.ok(gzipSync(pulse).length<16000);assert.ok(gzipSync(css).length<5000);
});
test('original core has no second stream and keeps its transfer budget',{skip:!app},()=>{
  assert.equal((app.match(/new EventSource\(/g)||[]).length,0);
  assert.doesNotThrow(()=>new vm.Script(app));assert.ok(Buffer.byteLength(app)+1604+5610+4955+2197<24000);
});
test('stream rejects duplicate/stale/private events and reaction removals',()=>{
  class Doc extends EventTarget {hidden=false;querySelector(){return null;}querySelectorAll(){return [];}}
  const doc=new Doc(),win=new EventTarget();win.__CORNER__={page:'detail',postId:'p1',eventCursor:10};const sources=[];
  class Source extends EventTarget {constructor(url){super();this.url=url;this.closed=false;sources.push(this);}close(){this.closed=true;}}
  win.EventSource=Source;win.CornerPublicLive={apply(){},reactionPending:()=>false};
  const events=[];doc.addEventListener('corner:realtime',e=>events.push(e.detail));
  const sandbox={window:win,document:doc,EventSource:Source,CustomEvent,Event,Date,console};vm.createContext(sandbox);
  const hub=pulse.split('// PULSE_SHARED_STREAM_START')[1].split('// PULSE_SHARED_STREAM_END')[0];
  vm.runInContext("{const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];"+hub+"}",sandbox,{timeout:1000});assert.equal(sources.length,1);
  const emit=(seq,type,payload={},stamp=new Date().toISOString())=>{const e=new Event(type);e.data=JSON.stringify({seq,id:'e'+seq,type,entityId:'p1',occurredAt:stamp,payload});e.lastEventId=String(seq);sources.at(-1).dispatchEvent(e);};
  emit(11,'reaction.updated',{counts:{love:1}});assert.equal(events.at(-1).increased,false);
  emit(12,'reaction.updated',{counts:{love:2}});assert.equal(events.at(-1).increased,true);
  emit(12,'reaction.updated',{counts:{love:2}});assert.equal(events.length,2);
  emit(13,'reaction.updated',{counts:{love:1}});assert.equal(events.at(-1).increased,false);
  emit(14,'comment.pending',{body:'Private pending text'});assert.equal(events.length,3);
  emit(15,'comment.created',{commentId:'c1'});assert.equal(events.at(-1).approved,true);assert.equal('body' in events.at(-1),false);
  emit(16,'post.published',{},new Date(Date.now()-60000).toISOString());assert.equal(events.at(-1).fresh,false);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(sources[0].closed,true);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(sources.length,2);assert.match(sources[1].url,/since=16$/);assert.equal(sources.filter(s=>!s.closed).length,1);
  win.dispatchEvent(new Event('pagehide'));assert.equal(sources[1].closed,true);
});
