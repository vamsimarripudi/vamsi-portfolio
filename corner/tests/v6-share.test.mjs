import test from 'node:test';
import assert from 'node:assert/strict';
import {detailPage,basePage} from '../src/ui.mjs';
const post={id:'post_11111111-1111-4111-8111-111111111111',slug:'storm-memory',
 type:'moment',title:'A storm memory',excerpt:'Grey skies and palms',
 body:'A story about coconut trees.',published_at:'2026-10-29T06:00:00.000Z',
 allow_comments:true,allow_reactions:true,version:1};
test('Story social metadata uses a real published first-party image',()=>{
 const html=detailPage({post,media:[{storage_key:'cover.jpg',mime_type:'image/jpeg',alt_text:'Coconut palms in heavy wind'}]});
 assert.match(html,/property="og:image" content="https:\/\/[^"]+\/media\/cover\.jpg"/);
 assert.match(html,/name="twitter:image" content="https:\/\/[^"]+\/media\/cover\.jpg"/);
 assert.match(html,/property="og:image:alt" content="Coconut palms in heavy wind"/);
 assert.match(html,/property="article:published_time" content="2026-10-29T06:00:00.000Z"/);
 assert.doesNotMatch(html,/property="og:image" content="http:\/\/[^"]+/);
});
test('Generic public pages keep the existing branded fallback',()=>{
 const html=basePage({path:'/about',title:'About'});
 assert.match(html,/property="og:image" content="[^"]+\/og\.svg"/);
 assert.doesNotMatch(html,/article:published_time/);
});
