import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SITE_URL,staticRouteMeta,faqItems} from '../src/seo.js';

const dist = new URL('../dist/',import.meta.url);
const googleFile='google510099dc96bfffe4.html';
const googleTag='HmBLPB0vMvd1yk_n2WeTumBnzn0QbPQ5HEQdTT48GEg';
const read=async filename=>readFile(new URL(filename,dist),'utf8');
const graphOf=html=>{
  const match=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  assert.ok(match,'Route JSON-LD is present');
  const value=JSON.parse(match[1]);
  assert.equal(value['@context'],'https://schema.org');
  return value['@graph'];
};
assert.equal(await read(googleFile),'google-site-verification: '+googleFile);
const home=await read('index.html');
assert.ok(home.includes('<meta name="google-site-verification" content="'+googleTag+'"'));
assert.ok(home.includes('<link rel="canonical" href="'+SITE_URL+'/"'));
const person=graphOf(home).find(n=>n['@type']==='Person');
assert.equal(person.name,'Vamsi Marripudi');
assert.equal(person.alternateName,'Vamsi');
for(const [route,meta] of Object.entries(staticRouteMeta)){
  const filename=route==='/'?'index.html':route.slice(1)+'/index.html';
  const html=await read(filename);
  const canonical=SITE_URL+(route==='/'?'/':route);
  assert.ok(html.includes('<link rel="canonical" href="'+canonical+'"'),route+' canonical');
  assert.ok(html.includes('<meta name="google-site-verification" content="'+googleTag+'"'),route+' meta verification');
  const web=graphOf(html).find(n=>n['@id']===canonical+'#webpage');
  assert.ok(web,route+' page identity');
  assert.equal(web.url,canonical,route+' structured URL');
  assert.equal(web.name,meta.title,route+' title');
  if(meta.noindex){
    assert.ok(html.includes('content="noindex, follow"'),route+' private noindex');
    assert.equal(html.includes('<noscript>'),false,route+' no public fallback for private path');
  }else{
    assert.ok(!html.includes('content="noindex, follow"'),route+' should be indexable');
    assert.ok(html.includes('<noscript><main'),route+' factual fallback');
  }
}
const faq=await read('faq/index.html');
const faqEntry=graphOf(faq).find(n=>n['@type']==='FAQPage');
assert.equal(faqEntry.mainEntity.length,faqItems.length);
for(const [q,a] of faqItems){
  assert.ok(faq.includes(q.replaceAll('&','&amp;').replaceAll('"','&quot;')), 'Visible FAQ question: '+q);
  assert.ok(faq.includes(a.replaceAll('&','&amp;').replaceAll('"','&quot;')), 'Visible FAQ answer: '+q);
}
const creator=graphOf(await read('journey/index.html')).find(n=>n['@type']==='ProfilePage');
assert.equal(creator.mainEntity['@id'],SITE_URL+'/#person');
const nested=graphOf(await read('work/event-management/index.html')).find(n=>n['@type']==='BreadcrumbList');
assert.equal(nested.itemListElement.length,3);
const llms=await read('llms.txt');
assert.ok(llms.includes(SITE_URL+'/engineering'));
const sitemap=await read('sitemap.xml');
assert.ok(sitemap.includes('<loc>'+SITE_URL+'/</loc>'));
const robots=await read('robots.txt');
assert.ok(robots.includes('Sitemap: '+SITE_URL+'/sitemap.xml'));
console.log('SEO build acceptance passed: '+Object.keys(staticRouteMeta).length+' pages, verified Google methods, FAQ, ProfilePage, breadcrumbs, noindex and static facts.');
