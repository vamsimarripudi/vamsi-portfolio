import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {basePage,header} from '../src/ui.mjs';

const css=fs.readFileSync(new URL('../public/refresh.css',import.meta.url),'utf8');
const studio=fs.readFileSync(new URL('../public/studio.css',import.meta.url),'utf8');
const locale=fs.readFileSync(new URL('../public/v3-phase4.css',import.meta.url),'utf8');

test('compact public header and account menu have usable mobile and reduced-motion contracts',()=>{
 const markup=header();
 assert.match(markup,/data-corner-profile-toggle/);
 assert.match(markup,/data-profile-dismiss aria-label="Close account menu"/);
 assert.match(markup,/class="icon-button" data-search-open/);
 assert.match(css,/max-height:calc\(100dvh - 191px/);
 assert.match(css,/body\.corner-comfort \.corner-profile-card/);
 assert.match(css,/max-width:44px/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/corner-profile-in/);
 assert.match(studio,/scroll-snap-type:x proximity/);
 assert.match(locale,/font-size:16px/);
});

test('source and translation client remain accessible without an external translation provider',()=>{
 const html=basePage({path:'/admin/v3/languages',initial:{page:'languages'}});
 assert.match(html,/v3-phase4\.js/);
 assert.match(html,/v3-phase4\.css/);
 const js=fs.readFileSync(new URL('../public/v3-phase4.js',import.meta.url),'utf8');
 assert.match(js,/\/workbench/);
 assert.match(js,/\/sources\//);
 assert.match(js,/\/preview/);
 assert.match(js,/confirm\(/);
 assert.doesNotMatch(js,/location\.reload\(/);
 assert.doesNotMatch(js,/api\.openai\.com|translate\.googleapis\.com/);
});
