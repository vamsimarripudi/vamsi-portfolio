import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SITE_URL, SITE_IDENTITY, faqItems, staticRouteMeta, siteStructuredDataForRoute} from '../src/seo.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const token = 'HmBLPB0vMvd1yk_n2WeTumBnzn0QbPQ5HEQdTT48GEg';

test('both supplied Google verification methods are exact and preserved',()=>{
 const home = read('index.html');
 assert.match(home, new RegExp('<meta name="google-site-verification" content="' + token + '"'));
 assert.equal(read('public/google510099dc96bfffe4.html'), 'google-site-verification: google510099dc96bfffe4.html');
});
test('public creator identity is consistent and uses only explicit official sources',()=>{
 const graph = siteStructuredDataForRoute('/')['@graph'];
 const creator = graph.find(n=>n['@type']==='Person');
 const website = graph.find(n=>n['@type']==='WebSite');
 const home = graph.find(n=>n['@type']==='WebPage');
 assert.equal(creator['@id'], SITE_URL + '/#person');
 assert.equal(creator.name, SITE_IDENTITY.name);
 assert.equal(creator.alternateName,'Vamsi');
 assert.equal(home.mainEntity['@id'],creator['@id']);
 assert.equal(website.publisher['@id'],creator['@id']);
 assert.ok(creator.sameAs.includes('https://github.com/vamsimarripudi'));
 assert.ok(creator.sameAs.includes('https://www.linkedin.com/in/vamsimarripudi/'));
 assert.doesNotMatch(JSON.stringify(graph),/vamsimarripudi\.tech/);
});
test('creator ProfilePage and FAQ answers correspond to the published visible pages',()=>{
 const profile=siteStructuredDataForRoute('/journey')['@graph'].find(n=>n['@type']==='ProfilePage');
 assert.equal(profile.mainEntity['@id'],SITE_URL+'/#person');
 const faq=siteStructuredDataForRoute('/faq')['@graph'].find(n=>n['@type']==='FAQPage');
 assert.equal(faq.mainEntity.length,faqItems.length);
 for(const [index,[q,a]] of faqItems.entries()){
  assert.equal(faq.mainEntity[index].name,q);
  assert.equal(faq.mainEntity[index].acceptedAnswer.text,a);
 }
});
test('indexable routes have stable canonical page records and nested breadcrumbs',()=>{
 for(const [route, meta] of Object.entries(staticRouteMeta)){
  const nodes=siteStructuredDataForRoute(route)['@graph'];
  const webPage=nodes.find(n=>n['@id']===(SITE_URL+(route==='/'?'/':route)+'#webpage'));
  assert.equal(webPage.url,SITE_URL+(route==='/'?'/':route));
  assert.equal(webPage.name,meta.title);
  if(meta.noindex)assert.equal(nodes.some(n=>n['@type']==='BreadcrumbList'),false);
 }
 const breadcrumb=siteStructuredDataForRoute('/work/event-management')['@graph'].find(n=>n['@type']==='BreadcrumbList');
 assert.deepEqual(breadcrumb.itemListElement.map(n=>n.item),[
  SITE_URL+'/', SITE_URL+'/work',SITE_URL+'/work/event-management'
 ]);
});
test('AI reference links are public canonical pages and private services are blocked from index',()=>{
 const llms=read('public/llms.txt');
 const robots=read('public/robots.txt');
 const config=JSON.parse(read('vercel.json'));
 assert.match(llms,/https:\/\/vamsimarripudi\.me\/engineering/);
 assert.doesNotMatch(llms,/vamsimarripudi\.tech\/\]/);
 assert.match(robots,/Disallow: \/api\/track\//);
 assert.ok(config.headers.some(h=>h.source==='/track'&&h.headers.some(x=>x.key==='X-Robots-Tag')));
 assert.ok(config.headers.some(h=>h.source==='/api/track/:path*'&&h.headers.some(x=>x.key==='X-Robots-Tag')));
 const html=read('index.html');
 assert.match(html,/rel="canonical" href="https:\/\/vamsimarripudi\.me\/"/);
 assert.match(html,/property="og:url" content="https:\/\/vamsimarripudi\.me\/"/);
});
test('static metadata build wires page-specific JSON-LD into prerendered HTML',()=>{
 const source=read('scripts/prerender-seo.mjs');
 assert.match(source,/siteStructuredDataForRoute\(route\)/);
 assert.match(source,/jsonLdPattern/);
 assert.match(source,/noindex, follow/);
});
