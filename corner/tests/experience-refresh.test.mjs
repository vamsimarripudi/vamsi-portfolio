import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderStoryBody, footer, header, adminPage, detailPage, basePage } from '../src/ui.mjs';
import { studioSidebar } from '../src/studio-ui.mjs';

const asset=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('highlighted quote opens above the normal story body and is safely escaped',()=>{
 const body=renderStoryBody('> A beautiful beginning\n\nThe story continues here.');
 assert.match(body,/<figure class="corner-quote"/);
 assert.match(body,/<blockquote>A beautiful beginning<\/blockquote>/);
 assert.ok(body.indexOf('<figure')<body.indexOf('The story continues'));
 assert.match(renderStoryBody('> <img src=x onerror=alert(1)>\n\nSafe'),
   /&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(renderStoryBody('> <img src=x>\n\nText'),/<img /);
});

test('public navigation has progressive modal auth entry and profile fallback',()=>{
 assert.match(header(),/data-auth-open="login"/);
 assert.match(header(),/data-profile-link/);
 assert.match(footer(),/data-auth-open="register"/);
 assert.match(footer(),/Privacy choices/);
});

test('comment form is locked until a verified session while API remains authoritative',()=>{
 const post={id:'post_test',slug:'a-test',title:'Test',body:'Body',type:'journal',published_at:new Date().toISOString(),allow_comments:true,allow_reactions:false};
 const html=detailPage({post,comments:[]});
 assert.match(html,/data-comments-locked/);
 assert.match(html,/id="comment-form"[^>]* hidden/);
 assert.doesNotMatch(html,/name="name" maxlength="60"/);
 const server=fs.readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
 assert.match(server,/EMAIL_VERIFICATION_REQUIRED/);
 assert.match(server,/store\.comment\(commentMatch\[1\],actor\.display_name,data\.body\)/);
});

test('Studio shell has owner contact shortcut and one Insights destination',()=>{
 const html=adminPage({owner:{role:'owner',email:'owner@example.com'}});
 assert.match(html,/class="studio-owner-link" href="mailto:connect@vamsimarripudi\.me"[^>]*>Vamsi Marripudi/);
 const sidebar=studioSidebar({role:'owner'},{interactive:true});
 assert.match(sidebar,/data-admin-view="analytics"/);
 assert.match(sidebar,/class="studio-nav-label">Insights/);
 assert.equal((sidebar.match(/class="studio-nav-label">Insights/g)||[]).length,1);
});

test('Studio schedule, crop, basic Insights and switches have regression contracts',()=>{
 const admin=asset('admin.js'),crop=asset('image-crop.js'),style=asset('refresh.css'),auth=asset('experience.js');
 assert.match(admin,/corner-schedule-modal/);
 assert.match(admin,/Schedule publication/);
 assert.match(admin,/formSchedule\.elements\.localTime\.value/);
 assert.match(admin,/\.querySelector\('\[data-crop-upload\]'\)/);
 assert.match(crop,/createImageBitmap/);
 assert.match(crop,/canvas\.toBlob/);
 assert.match(auth,/api\/v1\/auth\/session/);
 assert.match(auth,/data-comments-locked/);
 assert.match(admin,/api\/admin\/analytics\/summary/);
 assert.match(style,/prefers-reduced-motion:reduce/);
 assert.match(style,/\.editor-checks input\[type=checkbox\]:checked/);
 assert.match(style,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(admin,/Publish at the right time/);
});


test('media attach opens in a native dialog instead of a bottom card',()=>{
 const admin=asset('admin.js'),style=asset('refresh.css');
 assert.match(admin,/id="open-media-panel" aria-haspopup="dialog"/);
 assert.match(admin,/<dialog id="editor-media" class="corner-media-modal"/);
 assert.doesNotMatch(admin,/<div class="admin-section" id="editor-media"><\/div>/);
 assert.match(admin,/section\.onclose=\(\)=>\{cleanup\(\)/);
 assert.match(admin,/section\.querySelectorAll\('\[data-media-dismiss\]'\)/);
 assert.match(style,/\.corner-media-modal::backdrop/);
 assert.match(style,/\.corner-media-footer/);
 assert.match(style,/button\.corner-media-trigger/);
});


test('glass rail and active V5 work while legacy companion stays disabled by default',()=>{
 const html=header();
 const page=basePage({path:'/',initial:{page:'feed'}});
 const rail=asset('nav.js'),pulse=asset('companion.js'),style=asset('refresh.css'),theme=asset('companion.css');
 assert.match(html,/id="corner-rail-nav"/);
 assert.match(html,/data-corner-rail-toggle/);
 assert.match(html,/data-corner-profile-toggle/);
 assert.match(html,/data-corner-profile-card/);
 assert.match(html,/class="category-tabs corner-rail"/);
 assert.doesNotMatch(html,/class="category-account"/);
 assert.equal((html.match(/data-profile-link/g)||[]).length,1);
 assert.doesNotMatch(page,/href="\/companion\.css"/);
 assert.doesNotMatch(page,/src="\/companion\.js" defer/);
 assert.match(page,/href="\/v5\.css"/);
 assert.match(page,/src="\/v5\.js" defer/);
 assert.match(pulse,/corner-drawer-open/);
 assert.match(pulse,/corner-welcome-letter-v2/);
 assert.match(pulse,/Escape/);
 assert.ok(rail.length<1700,'Keep shared prefetch core lightweight');
 assert.match(pulse,/\/api\/status/);
 assert.match(pulse,/\/api\/posts\?limit=1/);
 assert.match(pulse,/\/api\/realtime\/stream/);
 assert.match(pulse,/No AI chat/);
 assert.match(style,/scrollbar-width:none!important/);
 assert.match(theme,/\.corner-orbit-toy/);
 assert.match(theme,/prefers-reduced-motion:reduce/);
 const server=fs.readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
 assert.match(server,/\/companion\.js/);
 assert.match(server,/\/companion\.css/);
});


test('Media Library has responsive filled columns and clean adjustment actions',()=>{
 const admin=asset('admin.js'),studio=asset('media-library.css');
 assert.match(admin,/class="media-gallery corner-library-grid"/);
 assert.match(admin,/list\.map\(\(x,index\)=>mediaCard\(x,false,index,list\.length\)\)/);
 assert.doesNotMatch(admin,/list\.map\(mediaCard\)/);
 assert.match(admin,/media-thumb--library/);
 assert.match(admin,/Adjust ↗/);
 assert.doesNotMatch(admin,/Image description/);
 assert.doesNotMatch(admin,/Add a caption/);
 assert.doesNotMatch(admin,/media-card-caption/);
 assert.match(studio,/\.corner-library-grid/);
 assert.match(studio,/repeat\(auto-fit,minmax\(min\(100%,280px\),1fr\)\)/);
 assert.match(studio,/@media \(max-width:600px\)/);
});

test('light editorial backdrop and compact centered search retain normal page contrast',()=>{
 const style=asset('refresh.css');
 assert.match(style,/#search-dialog\.search-dialog\[open\]/);
 assert.match(style,/margin:auto!important/);
 assert.match(style,/backdrop-filter:none!important/);
 assert.match(style,/body\.corner-comfort:has\(\.corner-public-header\) #content::before/);
 assert.match(style,/@keyframes corner-paper-glow/);
 assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
 const publicPage=basePage({path:'/',initial:{page:'feed'}});
 const adminPageHtml=basePage({path:'/admin',initial:{page:'admin'}});
 assert.match(publicPage,/href="\/refresh\.css\?v=20261026-clean1"/);
 assert.match(adminPageHtml,/href="\/studio\.css\?v=20261026-clean1"/);
 assert.match(adminPageHtml,/href="\/media-library\.css\?v=20261026-clean1"/);
 const server=fs.readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
 assert.match(server,/\['\.css','\.js'\]\.includes\(extension\)\?'public,max-age=0,must-revalidate'/);
});
