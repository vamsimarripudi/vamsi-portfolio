import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cookieInformationSections} from '../src/cookies.js';
import {staticRouteMeta} from '../src/seo.js';
import {websitePath,CONSENT_COOKIE} from '../public/site-analytics-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('cookie information route and links exist without inventing approved product terms',()=>{
 assert.equal(staticRouteMeta['/cookies'].noindex,true);
 assert.equal(websitePath('/cookies'),'/cookies');
 assert.equal(CONSENT_COOKIE,'vm_site_analytics');
 assert.ok(cookieInformationSections.length>=6);
 assert.ok(cookieInformationSections.some(x=>/consent cookie/i.test(x.title)));
 assert.ok(cookieInformationSections.some(x=>/withdraw/i.test(x.title)));
 const app=read('src/App.jsx');
 assert.match(app,/path="\/cookies" element=\{<Cookies\/>\}/);
 assert.match(app,/to="\/cookies">Cookies/);
 assert.match(app,/to="\/track">\/track/);
 const idx=read('src/legalPublicDocs.js');
 assert.match(idx,/href: '\/cookies'/);
});
test('single analytics chooser links to cookie info and protected owner /track',()=>{
 const js=read('public/website-analytics.js');
 assert.match(js,/Cookie details<\/a>/);
 assert.match(js,/href="\/track"/);
 assert.match(js,/data-consent-allow/);
 assert.match(js,/data-consent-deny/);
 assert.match(js,/document\.cookie=CONSENT_COOKIE/);
 assert.match(js,/privacyBlocked/);
 const css=read('public/website-analytics.css');
 assert.match(css,/bottom:max\(20px/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
