import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SITE_URL,SITE_IDENTITY,staticRouteMeta} from '../src/seo.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('canonical homepage metadata identifies .me as the authoritative site',()=>{
 const html=read('index.html');
 assert.equal(SITE_URL,'https://vamsimarripudi.me');
 assert.equal(SITE_IDENTITY.name,'Vamsi Marripudi');
 assert.match(html,/<link rel="canonical" href="https:\/\/vamsimarripudi\.me\/"/);
 assert.match(html,/<meta property="og:url" content="https:\/\/vamsimarripudi\.me\/"/);
 assert.match(html,/"@type":"Person"/);
 assert.match(html,/"url":"https:\/\/vamsimarripudi\.me\/"/);
 assert.doesNotMatch(html,/vamsimarripudi\.tech/i);
});
test('sitemap and robots expose the new canonical site without leaking private routes',()=>{
 const xml=read('public/sitemap.xml');
 const robots=read('public/robots.txt');
 assert.match(xml,/<loc>https:\/\/vamsimarripudi\.me\/<\/loc>/);
 assert.doesNotMatch(xml,/vamsimarripudi\.tech/i);
 assert.doesNotMatch(xml,/<loc>[^<]+\/track<\/loc>/,'Tracker stays absent from the public sitemap');
 assert.match(robots,/Sitemap: https:\/\/vamsimarripudi\.me\/sitemap\.xml/);
 assert.doesNotMatch(robots,/vamsimarripudi\.tech/i);
 assert.equal(staticRouteMeta['/track'].noindex,true);
});
