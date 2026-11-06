import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {basePage} from '../src/ui.mjs';
import {
 DIWALI_2026_START,DIWALI_2026_END,DIWALI_2026_PRELOAD,
 inDiwali2026Window,shouldPreloadDiwali2026
} from '../src/diwali-window.mjs';

const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const enabled=now=>basePage({path:'/',initial:{page:'feed'},diwaliNow:now});

test('Diwali 2026 is exactly 24 hours in Asia/Kolkata, inclusive start and exclusive end',()=>{
 assert.equal(new Date(DIWALI_2026_START).toISOString(),'2026-11-07T18:30:00.000Z');
 assert.equal(new Date(DIWALI_2026_END).toISOString(),'2026-11-08T18:30:00.000Z');
 assert.equal(DIWALI_2026_END-DIWALI_2026_START,24*60*60*1000);
 assert.equal(inDiwali2026Window(DIWALI_2026_START-1),false);
 assert.equal(inDiwali2026Window(DIWALI_2026_START),true);
 assert.equal(inDiwali2026Window(DIWALI_2026_END-1),true);
 assert.equal(inDiwali2026Window(DIWALI_2026_END),false);
 assert.equal(inDiwali2026Window(Number.NaN),false);
});
test('SSR preloads only near the celebration and never serves festival assets after expiry',()=>{
 assert.equal(shouldPreloadDiwali2026(DIWALI_2026_PRELOAD-1),false);
 assert.equal(shouldPreloadDiwali2026(DIWALI_2026_PRELOAD),true);
 assert.equal(shouldPreloadDiwali2026(DIWALI_2026_START),true);
 assert.equal(shouldPreloadDiwali2026(DIWALI_2026_END-1),true);
 assert.equal(shouldPreloadDiwali2026(DIWALI_2026_END),false);
 assert.doesNotMatch(enabled(DIWALI_2026_PRELOAD-1),/diwali-2026\.(?:css|js)/);
 assert.match(enabled(DIWALI_2026_START),/\/diwali-2026\.css\?v=1/);
 assert.match(enabled(DIWALI_2026_START),/\/diwali-2026\.js\?v=1/);
 assert.doesNotMatch(enabled(DIWALI_2026_END),/diwali-2026\.(?:css|js)/);
 const last=enabled(DIWALI_2026_END-1);
 assert.ok(last.indexOf('v6-motion-policy.js')<last.indexOf('diwali-2026.js'),'motion policy loads first');
});
test('Owner Studio, accounts and no-index pages stay unchanged',()=>{
 for(const [path,page] of [['/admin','admin'],['/login','account'],['/settings/preferences','account'],['/saved','account']]){
  const html=basePage({path,initial:{page},diwaliNow:DIWALI_2026_START});
  assert.doesNotMatch(html,/diwali-2026\.(?:css|js)/,path);
 }
 assert.doesNotMatch(basePage({path:'/preview',noindex:true,diwaliNow:DIWALI_2026_START}),/diwali-2026\.(?:css|js)/);
});
test('Festive assets are first-party scalable SVGs with bounded canvas and accessible controls',()=>{
 const stylesheet=read('diwali-2026.css');
 const script=read('diwali-2026.js');
 const diya=read('diwali-2026-diya.svg');
 const garland=read('diwali-2026-garland.svg');
 assert.match(diya,/viewBox="0 0 256 256"/);
 assert.match(garland,/viewBox="0 0 360 72"/);
 assert.match(stylesheet,/diwali-2026-garland\.svg/);
 assert.match(stylesheet,/@media\(min-width:2400px\)/);
 assert.match(stylesheet,/@media\(max-width:359px\)/);
 assert.match(stylesheet,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(stylesheet,/pointer-events:none/);
 assert.match(script,/diwali-2026-diya\.svg/);
 assert.match(script,/CornerMotionPolicy\?\.isReduced/);
 assert.match(script,/navigator\.connection/);
 assert.match(script,/document\.hidden/);
 assert.match(script,/10_000_000/);
 assert.match(script,/data-corner-diwali-mode/);
 assert.match(script,/aria-pressed/);
 assert.match(script,/clearTimeout\(tickTimer\)/);
 assert.match(script,/stopCanvas\(\)/);
 for(const src of [script,stylesheet,diya,garland]){
  assert.doesNotMatch(src,/https?:\/\/(?:fonts\.|cdn\.|google|facebook|twitter|unsplash|pexels)/i);
 }
 assert.doesNotMatch(script,/fetch\(|XMLHttpRequest|sendBeacon|Audio\(/);
});
