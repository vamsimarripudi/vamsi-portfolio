import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('PakkaFollow inbox is authenticated, filtered and not indexed',()=>{
 const track=source('src/Track.jsx'),api=source('api/lib/track.js'),config=JSON.parse(source('vercel.json'));
 assert.match(track,/<Route path="pakkafollow"/);
 assert.match(track,/session === 'guest'/);
 assert.match(api,/onlyPakkaFollow = source === 'pakkafollow'/);
 assert.match(api,/e\.intent IN \('PakkaFollow Support','PakkaFollow Billing','PakkaFollow Enquiry'\)/);
 assert.ok(config.rewrites.some(x=>x.source==='/track/pakkafollow'));
 assert.ok(config.headers.some(x=>x.source==='/track/:path*'&&x.headers.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex'))));
 assert.doesNotMatch(source('public/sitemap.xml'),/\/track/);
});
test('email-only support has full states and replies stored in the private conversation',()=>{
 const ui=source('src/PakkaFollowTrack.jsx'),css=source('src/PakkaFollowTrack.css'),track=source('src/Track.jsx'),reply=source('api/track/enquiries/[referenceId]/reply.js');
 for(const v of ['loading','error','ready','No matching messages','Open & reply',"source:'pakkafollow'",'connect@vamsimarripudi.me'])assert.ok(ui.includes(v),v);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(track,/ProductThread/);
 assert.match(track,/Send email reply/);
 assert.match(reply,/requireOwner/);
 assert.match(reply,/assertSameOrigin/);
 assert.match(reply,/providerMessageId, subject, message/);
});
test('public intake provides correct PakkaFollow reasons',()=>{
 const app=source('src/App.jsx');
 for(const reason of ['PakkaFollow Support','PakkaFollow Billing','PakkaFollow Enquiry'])assert.ok(app.includes(reason));
});
