import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DIWALI_2026_START, DIWALI_2026_END,
  isDiwali2026Active, nextDiwali2026Boundary,
} from '../src/festivals/diwali2026.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the portfolio decorations activate at exactly midnight IST on 8 November and expire at midnight IST on 9 November 2026', () => {
  assert.equal(new Date(DIWALI_2026_START).toISOString(), '2026-11-07T18:30:00.000Z');
  assert.equal(new Date(DIWALI_2026_END).toISOString(), '2026-11-08T18:30:00.000Z');
  assert.equal(DIWALI_2026_END - DIWALI_2026_START, 24 * 60 * 60 * 1000);
  assert.equal(isDiwali2026Active(DIWALI_2026_START - 1), false);
  assert.equal(isDiwali2026Active(DIWALI_2026_START), true);
  assert.equal(isDiwali2026Active(DIWALI_2026_END - 1), true);
  assert.equal(isDiwali2026Active(DIWALI_2026_END), false);
  assert.equal(isDiwali2026Active(Number.NaN), false);
});
test('open tabs cross both time boundaries and stop scheduling after the festival', () => {
  assert.equal(nextDiwali2026Boundary(DIWALI_2026_START - 1), DIWALI_2026_START);
  assert.equal(nextDiwali2026Boundary(DIWALI_2026_START), DIWALI_2026_END);
  assert.equal(nextDiwali2026Boundary(DIWALI_2026_END - 1), DIWALI_2026_END);
  assert.equal(nextDiwali2026Boundary(DIWALI_2026_END), null);
  assert.equal(nextDiwali2026Boundary(Number.NaN), null);
});
test('portfolio identity, layout and palette remain unchanged; the festival exists only on Home', () => {
  const app = read('src/App.jsx');
  const palette = read('src/App.css');
  const decoration = read('src/components/PortfolioDiwali.jsx');
  const styles = read('src/components/PortfolioDiwali.css');
  assert.match(app, /import PortfolioDiwali from '\.\/components\/PortfolioDiwali\.jsx'/);
  assert.match(app, /function Home\(\)[\s\S]*?return <main id="main">\s*<PortfolioDiwali \/>/);
  assert.equal((app.match(/<PortfolioDiwali \/>/g) || []).length, 1);
  assert.match(palette, /:root\{--bg:#f7f6f2;--surface:#efeee9;--ink:#171816;--muted:#686a63;--line:#cfcec5;--accent:#db4c2f;--lime:#bedb57/);
  assert.doesNotMatch(styles, /:root\s*\{|#root\s*\{|\.site-header\s*\{|\.hero\s*\{|html\s*\{|body\s*\{/);
  assert.match(styles, /#main:has\(> \.portfolio-diwali\)/);
  assert.match(styles, /pointer-events:none/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /max-width:620px/);
  assert.match(styles, /min-width:2400px/);
  assert.doesNotMatch(decoration, /Happy Diwali|Diwali greetings|festival wishes/i);
  assert.match(decoration, /aria-hidden="true"/);
});
test('self-hosted vector decorations have sharp viewBoxes and no external dependences', () => {
  const svgPaths = ['garland.svg','lantern.svg','diya.svg','rangoli.svg'];
  const css = read('src/components/PortfolioDiwali.css');
  const jsx = read('src/components/PortfolioDiwali.jsx');
  for (const p of svgPaths) {
    const content = read('public/diwali-2026/' + p);
    assert.match(content, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="/);
    assert.doesNotMatch(content, /<script|<image|<foreignObject|https:\/\/(?!www\.w3\.org\/2000\/svg)/i);
    assert.match(jsx + css, new RegExp(p.replace('.','\\.')));
  }
  assert.match(jsx, /navigator\.connection/);
  assert.match(jsx, /document\.hidden/);
  assert.match(jsx, /cancelAnimationFrame/);
  assert.match(jsx, /9_000_000/);
  assert.match(jsx, /prefers-reduced-motion/);
  assert.match(jsx, /setTimeout\(tick/);
  assert.doesNotMatch(jsx, /fetch\(|XMLHttpRequest|sendBeacon|new Audio|AudioContext/);
});
