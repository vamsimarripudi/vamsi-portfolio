import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {basePage,renderPostGallery,detailPage,renderMedia} from '../src/ui.mjs';
const one={storage_key:'photo_01.png',mime_type:'image/png',alt_text:'Sunset on a ridge',
 caption:'First quiet evening',width:800,height:600,focal_x:.4,focal_y:.6};
const two={storage_key:'photo_02.webp',mime_type:'image/webp',alt_text:'Second <moment> & kind sky',
 caption:'<script>alert("x")</script> & morning',width:1300,height:900,focal_x:.5,focal_y:.5};
const video={storage_key:'video_03.mp4',mime_type:'video/mp4',alt_text:'Short recorded scene',
 caption:'A short video memory.'};
test('published article displays every attached image and video with escaped captions',()=>{
 assert.equal(renderPostGallery([]),'');
 const markup=renderPostGallery([one,two,video]);
 assert.equal((markup.match(/data-post-photo /g)||[]).length,2);
 assert.match(markup,/data-post-lightbox/);
 assert.match(markup,/Swipe left or right to change photos/);
 assert.match(markup,/Tap anywhere to close/);
 assert.match(markup,/Close photographs/,'Screen readers retain a named dismiss action');
 assert.doesNotMatch(markup,/data-post-prev|data-post-next|data-post-counter|post-lightbox-controls/,'No visible modal navigation chrome');
 assert.match(markup,/aria-label="Previous media"/,'In-article carousel controls remain independent');
 assert.match(markup,/width="800" height="600"/);
 assert.match(markup,/First quiet evening/);
 assert.match(markup,/&lt;script&gt;alert/);
 assert.doesNotMatch(markup,/<script>alert\("x"\)<\/script>/);
 assert.match(markup,/Second &lt;moment&gt; &amp; kind sky/);
 assert.match(markup,/video controls playsinline/);
 assert.match(markup,/A short video memory/);
});
test('story cards stay lightweight while detail has accessible captioned gallery',()=>{
 const card=renderMedia([one,two]);
 assert.match(card,/<div class="card-media">/);
 assert.doesNotMatch(card,/photo_02/);
 const post={id:'post_test',slug:'captioned-story',type:'moment',
  title:'A day with photographs',excerpt:'A story with two photos',body:'A captioned story.',
  published_at:'2026-10-12T08:00:00.000Z',allow_reactions:false,allow_comments:false};
 const html=detailPage({post,media:[one,two]});
 assert.match(html,/data-post-lightbox/);
 assert.match(html,/post-media\.css/);
 assert.match(html,/post-gallery\.js/);
 assert.match(html,/First quiet evening/);
 assert.match(html,/&lt;script&gt;alert/);
 assert.equal((html.match(/data-post-photo /g)||[]).length,2);
 const home=basePage({initial:{page:'feed'},content:'<main id="content">Home</main>'});
 assert.doesNotMatch(home,/post-media\.css|post-gallery\.js/);
 const owner=basePage({initial:{page:'admin'},content:'<main id="content"></main>'});
 assert.match(owner,/post-media\.css/);
 assert.doesNotMatch(owner,/post-gallery\.js/);
});
test('gallery interaction and server routes are local, user-accessible and script-free in initial markup',()=>{
 const js=fs.readFileSync(new URL('../public/post-gallery.js',import.meta.url),'utf8');
 const server=fs.readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
 assert.match(js,/gallery\.showModal\(\)/);
 assert.match(js,/const triggers=\$\$\('\[data-post-photo\]'\)/);
 assert.match(js,/caption\.textContent=/);
 assert.match(js,/ArrowLeft/);assert.match(js,/ArrowRight/);
 assert.match(js,/gallery\.addEventListener\('close'/);
 assert.match(server,/\/post-gallery\.js/);
 assert.match(server,/img-src 'self' data: blob:/,'Local image preview URLs are allowed by CSP');
 assert.match(server,/media-src 'self' blob:/,'Local video preview URLs are allowed by CSP');
 assert.match(server,/\/post-media\.css/);
 assert.doesNotMatch(js,/fetch\(|localStorage|innerHTML\s*=/,'Viewer needs no API calls or HTML insertion');
});
