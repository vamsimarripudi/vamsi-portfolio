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
  assert.match(header(), /class="brand-mark brand-mark--vm"/);
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


test('original uploaded VM image replaces the old Corner star in every brand location',()=>{
  const mark=readFileSync(fileURLToPath(new URL('../public/mark.svg',import.meta.url)),'utf8');
  const page=basePage({path:'/',initial:{page:'feed'}});
  const headerHtml=header();
  const ui=readFileSync(fileURLToPath(new URL('../src/ui.mjs',import.meta.url)),'utf8');
  const studio=readFileSync(fileURLToPath(new URL('../src/studio-ui.mjs',import.meta.url)),'utf8');
  const account=readFileSync(fileURLToPath(new URL('../src/identity-ui.mjs',import.meta.url)),'utf8');
  const styles=readFileSync(fileURLToPath(new URL('../public/refresh.css',import.meta.url)),'utf8');
  assert.match(mark,/<image x="0" y="0" width="96" height="96" href="data:image\/jpeg;base64,/);
  assert.doesNotMatch(mark,/<path/,'Original SVG star artwork must be gone');
  assert.match(headerHtml,/class="brand-mark brand-mark--vm"/);
  assert.match(headerHtml,/class="corner-brand-image" src="\/mark\.svg\?v=vm-20261027"/);
  assert.doesNotMatch(headerHtml,/class="brand-mark" aria-hidden="true">✳/);
  assert.match(page,/rel="icon" href="\/mark\.svg\?v=vm-20261027"/);
  assert.match(ui,/class="admin-signin-mark admin-signin-mark--vm"/);
  assert.match(studio,/class="studio-brand-mark--vm"/);
  assert.match(account,/class="account-brand-mark--vm"/);
  assert.match(styles,/\.corner-brand-image/);
  assert.match(styles,/object-fit:cover/);
  assert.match(styles,/\.brand-mark\.brand-mark--vm/);
});
