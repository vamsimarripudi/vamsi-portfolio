import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isDiwali2026Active,DIWALI_2026_END} from '../src/festivals/diwali2026.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Diwali premium hero is explicitly homepage-only and retains real portfolio hero and animation',()=>{
 const app=read('src/App.jsx'),lux=read('src/components/PortfolioDiwaliLux.jsx'),css=read('src/components/PortfolioDiwaliLux.css');
 assert.match(app,/import PortfolioDiwaliLux from '\.\/components\/PortfolioDiwaliLux\.jsx'/);
 assert.match(app,/function Home\(\)[\s\S]*?return <main id="main">\s*<PortfolioDiwali \/>\s*<section className="hero hero-motion hero-identity">\s*<PortfolioDiwaliLux \/>/);
 assert.equal((app.match(/<PortfolioDiwaliLux \/>/g)||[]).length,1);
 assert.match(app,/<LivingEngineeringCanvas\/>/);
 assert.match(app,/I build useful products/);
 assert.match(lux,/function Toranam\(/);assert.match(lux,/function Muggu\(/);assert.match(lux,/function Diya\(/);assert.match(lux,/function Chakra\(/);
 assert.match(lux,/function Rockets\(/);assert.match(lux,/function Introduction\(/);
 assert.match(css,/vm-lux-thread-pulse/);assert.match(css,/@keyframes vm-lux-spin/);
 assert.match(css,/@keyframes vm-lux-flame/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(lux,/fetch\(|XMLHttpRequest|sendBeacon|new Audio|AudioContext/);
 assert.equal(isDiwali2026Active(DIWALI_2026_END),false);
});
test('opening is skippable, festive card closes after ten seconds and has dialog semantics',()=>{
 const src=read('src/components/PortfolioDiwaliLux.jsx');
 assert.match(src,/SEEN_KEY/);
 assert.match(src,/phase!=='greeting'/);
 assert.match(src,/setTimeout\(\(\)=>setPhase\('none'\),10000\)/);
 assert.match(src,/setTimeout\(\(\)=>setPhase\('greeting'\),3500\)/);
 assert.match(src,/aria-modal="true"/);
 assert.match(src,/ref=\{close\}/);
 assert.match(src,/Warm wishes from Vamsi Marripudi/);
});


test('mobile festive decorations are isolated inside hero, with natural flow and readable navigation',()=>{
 const source=read('src/App.jsx'),css=read('src/components/PortfolioDiwaliLux.css');
 assert.match(source,/<section className="hero hero-motion hero-identity">\s*<PortfolioDiwaliLux \/>/);
 assert.doesNotMatch(source,/<PortfolioDiwaliLux \/>\s*<section className="hero hero-motion hero-identity">/);
 assert.match(css,/section\.hero\.hero-identity:has\(> \.portfolio-diwali-lux\)/);
 assert.match(css,/\.vm-lux-muggu--tl,\s*main#main > section\.hero\.hero-identity \.vm-lux-muggu--tr\{display:none\}/);
 assert.match(css,/\.hero-actions > a:first-child/);
 assert.match(css,/\.site-header \.header-contact/);
 assert.match(css,/\.vm-lux-gold-frame/);
});


test('full-screen introduction uses a top-level portal, while the mobile hero starts below its separate garland',()=>{
 const component=read('src/components/PortfolioDiwaliLux.jsx');
 const css=read('src/components/PortfolioDiwaliLux.css');
 assert.match(component,/import \{ createPortal \} from 'react-dom'/);
 assert.match(component,/createPortal\(<Introduction\/>,portalHost\)/);
 assert.match(css,/align-content:start!important/);
 assert.match(css,/padding:104px 12px 132px!important/);
 assert.match(css,/\.vm-diwali-lux__toranam\{top:15px;height:57px\}/);
});


test('animated engineering canvas remains behind hero copy, and mobile nav stays accessible after leaving hero',()=>{
 const css=read('src/components/PortfolioDiwaliLux.css');
 const code=read('src/components/PortfolioDiwaliLux.jsx');
 assert.match(css,/\.living-engineering-canvas\{\s*position:absolute!important/);
 assert.match(code,/vm-diwali-hero-on-screen/);
 assert.match(code,/observer\.disconnect\(\)/);
 assert.match(css,/html\.vm-diwali-hero-on-screen:has\(\.portfolio-diwali-lux\) \.mobile-quick-nav/);
});
