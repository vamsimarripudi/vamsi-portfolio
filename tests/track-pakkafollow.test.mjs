import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('PakkaFollow lives inside owner-only Track, not public analytics',()=>{
 const shell=read('src/Track.jsx'),api=read('api/lib/track.js'),route=read('vercel.json');
 assert.match(shell,/<Link to="\/track\/pakkafollow"/);
 assert.match(shell,/<Route path="pakkafollow"/);
 assert.match(api,/source = ''/);
 assert.match(api,/e.intent IN \('PakkaFollow Support','PakkaFollow Billing','PakkaFollow Enquiry'\)/);
 const config=JSON.parse(route);
 assert.ok(config.rewrites.some(x=>x.source==='/track/pakkafollow'&&x.destination==='/track/index.html'));
 assert.ok(config.headers.some(x=>x.source==='/track/:path*'&&x.headers.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex'))));
});
test('product inbox has loading, errors, empty, retry and in-track reply links',()=>{
 const ui=read('src/PakkaFollowTrack.jsx'),css=read('src/PakkaFollowTrack.css');
 for(const state of ['loading','error','ready']) assert.ok(ui.includes("'"+state+"'"));
 for(const snippet of ['source:\'pakkafollow\'','Retry','No matching messages','Open & reply','/track/enquiries/','connect@vamsimarripudi.me'])assert.ok(ui.includes(snippet),snippet);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('public customer contact form exposes product categories and preserves original categories',()=>{
 const app=read('src/App.jsx');
 for(const s of ['PakkaFollow Support','PakkaFollow Billing','PakkaFollow Enquiry','Engineering opportunity'])assert.ok(app.includes(s));
 const robots=read('public/robots.txt'),sitemap=read('public/sitemap.xml');
 assert.ok(!sitemap.includes('/track/pakkafollow'));
 assert.match(robots,/Sitemap: https:\/\/vamsimarripudi\.me\/sitemap\.xml/);
});
test('existing email reply remains server-authorized and sends without Gmail UI',()=>{
 const reply=read('api/track/enquiries/[referenceId]/reply.js');
 assert.match(reply,/requireOwner/);
 assert.match(reply,/assertSameOrigin/);
 assert.match(reply,/sendResend/);
 const shell=read('src/Track.jsx');
 assert.match(shell,/Send email reply/);
 assert.match(shell,/track-reply-feedback/);
});
