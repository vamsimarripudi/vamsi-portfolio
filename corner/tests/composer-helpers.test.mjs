import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=fs.readFileSync(new URL('../public/composer-workspace.js',import.meta.url),'utf8');
const scope={window:{},crypto:webcrypto,Intl,Date,Uint8Array};
vm.runInNewContext(source,scope);
const helper=scope.window.CornerComposer;
const storage=()=>{
  const values=new Map();
  return {get length(){return values.size},key:index=>[...values.keys()][index]||null,
    getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
};

test('Titles preserve Indic combining marks and joined emoji within the post title limit',()=>{
  const emoji='👩🏽‍💻';
  const title=helper.title(emoji.repeat(80));
  assert.ok(title.length<=150);
  const graphemes=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(title)].map(part=>part.segment);
  assert.ok(graphemes.every(part=>part===emoji||part==='…'));
  assert.equal(helper.title('రేపటి ఆశలు\n\nఈ రోజు మొదలు.'),'రేపటి ఆశలు');
  assert.equal(helper.title('# A small beginning. A second sentence.'),'A small beginning');
});

test('Presentation uses media and length while retaining a sensible text-only default',()=>{
  assert.equal(helper.type('ఈ రోజు నా ఆలోచన'),'tech_note');
  assert.equal(helper.type('ఈ రోజు నా ఆలోచన',1),'moment');
  assert.equal(helper.type('పుట్టినరోజు శుభాకాంక్షలు!'),'wish');
  assert.equal(helper.type('जन्मदिन की शुभकामनाएँ'),'wish');
  assert.equal(helper.type('A reflection. '.repeat(80),1),'journal');
  assert.equal(helper.type('We shipped a new project.'),'build');
});

test('Schedule input uses the selected timezone rather than the browser or process timezone',()=>{
  assert.equal(helper.localInput('2026-11-04T03:00:00.000Z','Asia/Kolkata'),'2026-11-04T08:30');
  assert.equal(helper.localInput('2026-11-04T03:00:00.000Z','America/Los_Angeles'),'2026-11-03T19:00');
  assert.equal(helper.localInput('bad date','Asia/Kolkata'),'');
  assert.match(helper.selectedTime('2026-11-06T08:30','Asia/Kolkata'),/6 November 2026/);
  assert.match(helper.selectedTime('2026-11-06T08:30','Asia/Kolkata'),/8:30/);
  assert.match(helper.scheduledTime('2026-11-04T03:00:00.000Z','Asia/Kolkata'),/Asia\/Kolkata/);
});

test('Draft recovery is scoped to the authenticated owner and preserves its create request key',()=>{
  const shared=storage(),first=helper.recovery('owner-a',shared),second=helper.recovery('owner-b',shared);
  const key=helper.requestId();
  assert.match(key,/^[a-f0-9-]{32,36}$/i);
  assert.equal(first.write(null,{version:0,clientRequestId:key,source:{body:'Private unfinished writing',type:'auto'}}),true);
  assert.equal(first.read(null).clientRequestId,key);
  assert.equal(first.read(null).source.body,'Private unfinished writing');
  assert.equal(second.read(null),null);
  second.write('post-example',{version:3,source:{body:'Another owner draft'}});
  first.clear();
  assert.equal(first.read(null),null);
  assert.equal(second.read('post-example').source.body,'Another owner draft');
});

test('Malformed, oversized and expired recovery records are rejected without blocking the composer',()=>{
  const local=storage(),draft=helper.recovery('owner',local),key='corner:studio:draft:owner:new';
  local.setItem(key,'not JSON');assert.equal(draft.read(null),null);
  local.setItem(key,JSON.stringify({savedAt:Date.now(),source:{body:'x'.repeat(25001)}}));assert.equal(draft.read(null),null);
  local.setItem(key,JSON.stringify({savedAt:Date.now()-8*86400000,source:{body:'Old writing'}}));assert.equal(draft.read(null),null);
  const unavailable=helper.recovery('owner',{setItem(){throw Error('Storage disabled')},getItem(){throw Error('Storage disabled')},removeItem(){throw Error('Storage disabled')}});
  assert.equal(unavailable.write(null,{source:{body:'Draft'}}),false);
  assert.equal(unavailable.read(null),null);
  assert.equal(helper.recovery(null,local).write(null,{source:{body:'No identity'}}),false);
});
