import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('website analytics isolates approved toolbar/tab contrast and full-width mobile sheets from enquiry styles',()=>{
 const css=readFileSync(new URL('../src/WebsiteAnalytics.css',import.meta.url),'utf8');
 assert.match(css,/#root \.track-site-shell \.ws-page button\{[^}]*background:#fff;color:#293241/);
 assert.match(css,/#root \.track-site-shell \.ws-tabs button\[aria-selected=true\]\{background:#eaf0fb;color:#254b9c/);
 assert.match(css,/@media\(max-width:767px\)\{\.ws-popup\{max-width:100vw\}/);
 assert.match(css,/#root \.track-site-shell \.track-logout\{[^}]*background:transparent;color:#f2f5fa/);
});
