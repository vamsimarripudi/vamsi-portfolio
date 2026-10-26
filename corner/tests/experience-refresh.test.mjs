import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderStoryBody, footer, header, adminPage, detailPage } from '../src/ui.mjs';
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
 assert.match(html,/class="studio-owner-link" href="mailto:connect@vamsimarripudi\.me">Vamsi Marripudi/);
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
