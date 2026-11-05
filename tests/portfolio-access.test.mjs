import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/App.jsx'),styles=read('src/App.css');
test('public portfolio keeps four functional visitor paths and useful routes',()=>{
  for(const id of ['hire','collaborate','products','builder'])assert.match(app,new RegExp("id:'"+id+"'"));
  for(const route of ['/resume','/contact','/work/pakkafollow','/now','/engineering','/writing'])assert.ok(app.includes("'"+route+"'"),'missing visitor route '+route);
  assert.match(app,/aria-pressed=\{selected===item.id\}/);
  assert.match(app,/aria-live="polite"/);
  assert.match(app,/function VisitorRoutes\(\)/);
});
test('quick navigation and live work are accessible without changing private routes',()=>{
  assert.match(app,/function MobileQuickNav\(\)/);
  assert.match(app,/aria-label="Quick navigation"/);
  assert.match(app,/id="now" className="now-ledger"/);
  assert.match(app,/Current focus: PakkaFollow/);
  assert.match(app,/In development/);
  assert.match(app,/Planning · Upcoming product/);
  assert.match(app,/path="\/track\/\*"/);
});
test('color identity and reduced-motion safety are preserved',()=>{
  assert.match(styles,/:root\{--bg:#f7f6f2;--surface:#efeee9;--ink:#171816;--muted:#686a63;--line:#cfcec5;--accent:#db4c2f;--lime:#bedb57/);
  assert.match(styles,/prefers-reduced-motion:reduce/);
  assert.match(styles,/\.mobile-quick-nav a\.active/);
  assert.match(styles,/\.visitor-route-options button\.is-selected/);
  assert.match(styles,/focus-visible/);
});
