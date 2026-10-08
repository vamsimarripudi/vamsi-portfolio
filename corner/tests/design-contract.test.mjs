import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basePage, header } from '../src/ui.mjs';

const css = readFileSync(fileURLToPath(new URL('../public/magic.css', import.meta.url)), 'utf8');

test('Corner renders the new stylesheet alongside original CSS without changing routes', () => {
  const page = basePage({ path: '/' });
  assert.match(page, /href="\/style\.css"/);
  assert.match(page, /href="\/magic\.css"/);
  assert.match(header(), /class="brand-mark"/);
  assert.match(header(), /data-search-open/);
});

test('editorial CSS enforces pure black icon tiles with white glyphs and white cards with black copy', () => {
  assert.match(css, /--corner-black:#000/);
  assert.match(css, /--corner-white:#fff/);
  assert.match(css, /--corner-paper:#fff/);
  assert.match(css, /\.brand-mark,.icon-button,.header-admin,/);
  assert.match(css, /background:var\(--corner-black\)!important/);
  assert.match(css, /color:var\(--corner-white\)!important/);
  assert.match(css, /\.story\.story-wish/);
  assert.match(css, /background:var\(--corner-white\)/);
  assert.match(css, /color:var\(--corner-ink\)/);
});

test('editorial CSS adapts to every device and disables decorative motion for accessibility', () => {
  for (const media of [
    '@media(min-width:1600px)',
    '@media(min-width:1024px) and (max-height:820px)',
    '@media(min-width:768px) and (max-width:1023px)',
    '@media(max-width:767px)',
    '@media(max-width:479px)',
    '@media(max-width:359px)',
    '@media(pointer:coarse)',
    '@media(prefers-reduced-motion:reduce)',
  ]) assert.ok(css.includes(media), media);
  assert.match(css, /@supports\(animation-timeline:view\(\)\)/);
  assert.match(css, /@container\(max-width:350px\)/);
  assert.ok(!/@import\s+url\s*\(/i.test(css), 'no remote CSS framework or font network dependency');
});
