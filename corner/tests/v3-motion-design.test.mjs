import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {basePage} from '../src/ui.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const css=read('public/motion.css'),js=read('public/motion.js');

test('Motion Primitives ship across phases without loading a third-party framework',()=>{
 const html=basePage({title:'Design check',content:'<main id="content"></main>'});
 assert.match(html,/href="\/motion\.css"/);
 assert.match(html,/src="\/motion\.js" defer/);
 assert.ok(html.indexOf('/magic.css')<html.indexOf('/motion.css'),'Only extend the approved design');
 const server=read('src/server.mjs');
 assert.match(server,/\/motion\.css/);
 assert.match(server,/\/motion\.js/);
 assert.doesNotMatch(css,/@import\s+url\s*\(|https?:\/\//i,'No remote stylesheet or animation packages');
 assert.doesNotMatch(js,/\bfetch\(|XMLHttpRequest|navigator\.sendBeacon|\.preventDefault\(/,'No network calls or navigation interception');
});
test('All five phases use one small accessible motion system',()=>{
 for(const selector of ['.v3-explorer','.v3-result','.v3m-event','.v3w-preview','.v3a-kpi','.v3a-locale-row'])
  assert.ok(js.includes(selector),'Motion targets include '+selector);
 for(const token of [
  '--corner-motion-ease','--corner-motion-fast','--corner-motion-medium',
  '--corner-motion-slow','prefers-reduced-motion:no-preference','prefers-reduced-motion:reduce',
  'pointer:coarse','forced-colors:active',':focus-visible'
 ])assert.ok(css.includes(token),'Accessible motion style '+token);
 assert.match(css,/html\[data-corner-motion=active\] \[data-motion-reveal\]/,
  'Never hide content unless JS has explicitly enabled the observer');
 assert.match(js,/IntersectionObserver/);
 assert.match(js,/connection\?\.saveData/);
 assert.match(js,/observer\.unobserve/,'Reveal elements once, without a persistent scroll loop');
 assert.match(js,/addEventListener\('scroll',schedule,\{passive:true\}\)/);
 assert.match(js,/setAttribute\('aria-hidden','true'\)/);
});
test('Gallery supports icon-only accessible navigation, swipe, keyboard and focus return',()=>{
 const layout=read('src/v3-memories-ui.mjs'),interaction=read('public/v3-memories.js');
 for(const token of [
  'data-v3m-prev','data-v3m-next','data-v3m-counter',
  'aria-label="Previous photograph"','aria-label="Next photograph"',
  'aria-live="polite"','aria-haspopup="dialog"'
 ])assert.ok(layout.includes(token),'Accessible markup '+token);
 for(const token of ['ArrowLeft','ArrowRight','touchstart','touchend',
  "dialog.addEventListener('close'",'opener','sequence++'])
  assert.ok(interaction.includes(token),'Gallery interaction '+token);
 assert.doesNotMatch(interaction,/\bfetch\(/,'Visual-only gallery changes');
});
test('Core design assets retain strict uncompressed transfer budgets',()=>{
 const size=f=>fs.statSync(path.join(root,'public',f)).size;
 const totalCss=['style.css','magic.css','v3.css','v3-memories.css','motion.css'].reduce((n,f)=>n+size(f),0);
 const totalJs=['app.js','nav.js','v3.js','v3-memories.js','motion.js'].reduce((n,f)=>n+size(f),0);
 assert.ok(totalCss<90000,'Core CSS under 90 KB (actual '+totalCss+')');
 assert.ok(totalJs<24000,'Core JS under 24 KB (actual '+totalJs+')');
});
