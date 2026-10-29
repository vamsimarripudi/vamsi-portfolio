import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {passwordHash} from '../src/auth.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'corner-post-media-browser-'));
const port=59000+Math.floor(Math.random()*400);
const origin='http://127.0.0.1:'+port,base=origin+'/corner';
const owner='photo-owner@browser.test',password=crypto.randomBytes(28).toString('base64url');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/V3sAAAAASUVORK5CYII=','base64');
const env={...process.env,HOST:'127.0.0.1',PORT:String(port),NODE_ENV:'test',
 SITE_URL:base,CORNER_BASE_PATH:'/corner',DATA_DIR:dir,DB_PATH:path.join(dir,'corner.sqlite'),
 DEMO_CONTENT:'0',ADMIN_EMAIL:owner,ADMIN_PASSWORD_HASH:passwordHash(password),
 SESSION_SECRET:crypto.randomBytes(48).toString('hex')};
const child=spawn(process.execPath,['--no-warnings','src/server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
const errors=[];child.stderr.on('data',chunk=>errors.push(String(chunk)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 let started=false;
 for(let i=0;i<110;i++){
  if(child.exitCode!==null)break;
  try{if((await fetch(base+'/api/health')).ok){started=true;break}}catch{}
  await sleep(90);
 }
 assert.equal(started,true,'Corner fixture not ready '+errors.join('').slice(0,400));
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 const browserErrors=[];page.on('pageerror',error=>browserErrors.push(error.message));
 await page.goto(base+'/admin',{waitUntil:'networkidle'});
 await page.locator('#admin-login input[name="email"]').fill(owner);
 await page.locator('#admin-login input[name="password"]').fill(password);
 await page.locator('#admin-login button[type="submit"]').click();
 await page.locator('.admin-shell').waitFor({state:'visible',timeout:14000});
 await page.locator('#create-from-overview').click();
 // V5 derives the title automatically from the single story textarea.
 await page.locator('#post-editor textarea[name="body"]').fill('First photo-led Corner story. Two photographs with captions, tested in a real mobile browser.');
 const attachmentDialog=page.locator('dialog#editor-media');
 assert.equal(await attachmentDialog.count(),1,'Uploader is rendered as a native dialog');
 assert.equal(await attachmentDialog.evaluate(element=>element.open),false,'No bottom attachment card is visible before opening');
 assert.equal(await page.locator('#admin-view > .admin-section#editor-media').count(),0,'Old bottom media card removed');
 await page.locator('#open-media-panel').click();
 await attachmentDialog.locator('#editor-upload').waitFor({state:'visible'});
 for(const [width,height] of [[320,720],[390,844],[768,980],[1366,850]]){
   await page.setViewportSize({width,height});
   const bounds=await attachmentDialog.boundingBox();
   assert.ok(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=width+1,'Media modal fits viewport '+width+' '+JSON.stringify(bounds));
   const {scrollWidth,clientWidth}=await attachmentDialog.evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
   assert.ok(scrollWidth<=clientWidth+1,'Media modal content does not overflow horizontally at '+width);
 }
 await page.setViewportSize({width:390,height:844});
 const input=attachmentDialog.locator('#editor-upload input[type="file"]');
 await input.waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#editor-upload')?.dataset.mediaReady==='true',null,{timeout:5000}).catch(async error=>{
   const toastText=await page.locator('#toast-stack').innerText().catch(()=>'');
   const html=await page.locator('#editor-media').innerHTML().catch(()=>'');
   const initError=await page.locator('#editor-media').getAttribute('data-media-init-error').catch(()=>null);
   throw new Error('Uploader initialization did not complete. initError='+initError+' toasts='+toastText+' html='+html.slice(0,500),{cause:error});
 });
 assert.equal(await input.evaluate(el=>typeof el.onchange),'function','Uploader change handler is attached before file selection');
 await input.setInputFiles([
  {name:'photo-one.png',mimeType:'image/png',buffer:png},
  {name:'photo-two.png',mimeType:'image/png',buffer:png},
  {name:'photo-three.png',mimeType:'image/png',buffer:png},
  {name:'photo-remove.png',mimeType:'image/png',buffer:png}
 ]);
 // Chromium CI occasionally retains the FileList without propagating the synthetic chooser event; dispatch change explicitly so the real handler is exercised.
 await input.dispatchEvent('change');
 const cards=page.locator('#editor-upload .upload-preview-card');
 await page.waitForFunction(()=>document.querySelectorAll('#editor-upload .upload-preview-card').length===4,null,{timeout:5000}).catch(async error=>{
   const status=await page.locator('[data-upload-status]').textContent().catch(()=>'');
   const selected=await input.evaluate(el=>({count:el.files?.length||0,onchange:typeof el.onchange,oninput:typeof el.oninput,html:el.outerHTML})).catch(()=>({}));
   const toastText=await page.locator('#toast-stack').innerText().catch(()=>'');
   throw new Error('Pending preview cards did not render. status='+status+' selected='+JSON.stringify(selected)+' toasts='+toastText+' browserErrors='+browserErrors.join(' | '),{cause:error});
 });
 assert.equal(await cards.count(),4,'Every selected file gets a local preview');
 assert.equal(await cards.locator('.upload-preview-remove').count(),4,'Every pending image has a red-X remove control');
 await cards.last().locator('.upload-preview-remove').click();
 assert.equal(await cards.count(),3,'Red X removes only the chosen pending image before upload');
 await cards.nth(0).locator('input[name="alt"]').fill('First little photograph');
 await cards.nth(0).locator('input[name="caption"]').fill('A new Corner beginning.');
 await cards.nth(1).locator('input[name="alt"]').fill('Second little photograph');
 await cards.nth(1).locator('input[name="caption"]').fill('One more quiet moment.');
 await cards.nth(2).locator('input[name="alt"]').fill('Third little photograph');
 await cards.nth(2).locator('input[name="caption"]').fill('Third carousel moment.');
 await page.locator('#editor-upload button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#editor-media .media-thumb').length===3,null,{timeout:18000});
 assert.equal(await page.locator('[data-editor-photo-preview] img').count(),1,'Attached image appears in Studio card preview');
 const inline=page.locator('#editor-media form[data-media-quick-edit]');
 assert.equal(await inline.count(),3,'Every existing image has inline caption editor');
 await inline.nth(1).locator('input[name="caption"]').fill('Second caption updated.');
 await inline.nth(1).locator('button[type="submit"]').click();
 await page.getByText('Caption and description saved.').first().waitFor({timeout:12000});
 assert.equal(await page.locator('#media-count').textContent(),'3','Editor shows current attachment count');
 // Delete an already attached image using the red X.
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#editor-media .media-thumb').first().locator('.media-delete-x').click();
 await page.waitForFunction(()=>document.querySelectorAll('#editor-media .media-thumb').length===2);
 assert.equal(await page.locator('#media-count').textContent(),'2','Attached delete updates the story attachment count');
 // Reorder the remaining pair so the third image becomes the carousel cover.
 const attached=page.locator('#editor-media .media-thumb');
 assert.equal(await attached.locator('[data-media-move]').count(),4,'Attached media exposes previous/next ordering controls');
 await attached.first().locator('[data-media-move][data-direction="1"]').click();
 await page.waitForFunction(()=>document.querySelector('#editor-media .media-thumb .media-card-caption')?.textContent?.includes('Third carousel moment.'));
 assert.equal((await page.locator('#editor-media .media-thumb').first().locator('.media-card-caption').textContent()).trim(),'Third carousel moment.','Reorder endpoint changes the public carousel order');
 await attachmentDialog.locator('[data-media-dismiss]').last().click();
 assert.equal(await attachmentDialog.evaluate(element=>element.open),false,'Done closes the attachment modal');
 await page.locator('#open-media-panel').click();
 assert.equal(await attachmentDialog.locator('.media-thumb').count(),2,'Reopening preserves deletion, order and captions');
 await page.keyboard.press('Escape');
 assert.equal(await attachmentDialog.evaluate(element=>element.open),false,'Escape dismisses the native dialog');
 assert.equal(await page.locator('#open-media-panel').evaluate(element=>element===document.activeElement),true,'Focus returns to the media trigger');
 await page.locator('#publish-post').click();
 await page.waitForFunction(async()=>{
  try{
   const response=await fetch('/corner/api/admin/posts?state=published',{credentials:'same-origin'});
   if(!response.ok)return false;
   const json=await response.json();
   return json.data.some(post=>post.title==='First photo-led Corner story');
  }catch{return false}
 },null,{timeout:15000});

 // The Studio library must show full-width responsive cards, not tiny fixed
 // auto-fill columns that leave most of the panel empty.
 await page.locator('[data-admin-view="media"]').click();
 await page.locator('#admin-view .corner-media-library .corner-library-grid').waitFor({state:'visible',timeout:12000}).catch(async error=>{
   const active=await page.locator('[data-admin-view="media"]').getAttribute('aria-current').catch(()=>null);
   const view=await page.locator('#admin-view').innerText().catch(()=>'No Studio view');
   throw new Error('Media library did not render; active='+active+' view='+view.slice(0,400)+' JS='+browserErrors.join(' | '),{cause:error});
 });
 const libraryCards=page.locator('#admin-view .corner-library-grid .media-thumb--library');
 assert.equal(await libraryCards.count(),2,'Both uploaded assets appear in the clean Studio gallery');
 assert.equal(await libraryCards.locator('[data-media-edit]').count(),2,'Each library card has one edit-details action');
 for(const [width,height] of [[320,720],[390,844],[768,980],[1024,800],[1366,850],[1920,1080]]){
   await page.setViewportSize({width,height});
   const layout=await page.evaluate(()=>{
     const panel=document.querySelector('#admin-view .corner-library-grid');
     const cards=[...panel.querySelectorAll('.media-thumb--library')];
     const p=panel.getBoundingClientRect();
     const r=cards.map(c=>c.getBoundingClientRect());
     return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,panelWidth:p.width,
       cards:r.map(c=>({width:c.width,left:c.left,right:c.right})),
       columns:getComputedStyle(panel).gridTemplateColumns,
       captionClamp:cards.map(c=>getComputedStyle(c.querySelector('.media-card-caption')).webkitLineClamp)};
   });
   assert.ok(layout.scroll<=width+1,'Studio Media must not overflow at '+width+' '+JSON.stringify(layout));
   assert.ok(layout.cards.every(c=>c.left>=-1&&c.right<=width+1),'Media cards inside screen '+width+' '+JSON.stringify(layout));
   assert.ok(layout.cards.every(c=>c.width>=Math.min(235,layout.panelWidth-1)),'No narrow/tall fixed cards '+width+' '+JSON.stringify(layout));
   assert.ok(layout.captionClamp.every(v=>v==='2'),'Long captions are previewed in two readable lines');
   if(width>=1024){
     assert.ok(layout.cards[0].width>=Math.min(260,layout.panelWidth/3),'Gallery fills available workspace '+width);
   }
 }
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('#admin-view .corner-library-grid .media-quick-edit').count(),0,'Library shows no attachment edit forms');
 const captions=(await libraryCards.locator('.media-card-caption').allTextContents()).map(c=>c.trim()).sort();
 assert.deepEqual(captions,['Third carousel moment.','Second caption updated.'].sort(),'Library reflects delete and preserved captions');
 const selectedCaption=(await libraryCards.first().locator('.media-card-caption').textContent()).trim();
 await libraryCards.first().locator('[data-media-edit]').click();
 await page.locator('#media-editor textarea[name="alt"]').waitFor({state:'visible'});
 assert.equal(await page.locator('#media-editor input[name="caption"]').inputValue(),selectedCaption,'Edit details opens selected asset');
 await page.locator('#back-media').click();
 await page.locator('#admin-view .corner-library-grid').waitFor({state:'visible'});
 console.log('PASS Studio media gallery: responsive card widths, captions, details editor and mobile fit');
 const slug=await page.evaluate(async()=>{
  const r=await fetch('/corner/api/admin/posts?state=published',{credentials:'same-origin'});
  const j=await r.json();return j.data.find(p=>p.title==='First photo-led Corner story')?.slug;
 });
 assert.ok(slug,'Test post was published');
 await page.goto(base+'/post/'+encodeURIComponent(slug),{waitUntil:'domcontentloaded'});
 await page.locator('[data-post-carousel]').waitFor({state:'visible',timeout:10000});
 const images=page.locator('[data-carousel-slide] .post-photo');
 assert.equal(await images.count(),2,'Both photos are publicly rendered');
 await page.getByText('Third carousel moment.').waitFor();
 await page.getByText('Second caption updated.').waitFor();
 assert.equal(await page.locator('[data-carousel-count]').textContent(),'1 / 2','Carousel starts at the ordered cover');
 assert.equal(await page.locator('[data-carousel-dot]').count(),2,'Carousel renders one position dot per attachment');
 assert.equal(await page.locator('[data-carousel-dot]').first().getAttribute('aria-current'),'true');
 await page.locator('[data-carousel-next]').click();
 await page.waitForTimeout(400);
 assert.equal(await page.locator('[data-carousel-count]').textContent(),'2 / 2','Next arrow advances the carousel');
 assert.equal(await page.locator('[data-carousel-dot]').nth(1).getAttribute('aria-current'),'true');
 const track=page.locator('[data-carousel-track]');
 await track.focus();await page.keyboard.press('Home');
 assert.equal(await page.locator('[data-carousel-count]').textContent(),'1 / 2','Home key returns to first carousel item');
 await track.evaluate(el=>{el.scrollLeft=el.clientWidth;el.dispatchEvent(new Event('scroll'))});await page.waitForTimeout(140);
 assert.equal(await page.locator('[data-carousel-count]').textContent(),'2 / 2','Horizontal swipe/scroll updates the active counter');
 const overflow=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert.ok(overflow.content<=overflow.viewport+1,'No mobile article horizontal overflow: '+JSON.stringify(overflow));
 await images.first().click();
 const dialog=page.locator('dialog[data-post-lightbox]');
 await dialog.waitFor({state:'visible'});
 assert.equal(await dialog.locator('[data-post-counter],[data-post-prev],[data-post-next]').count(),0,'No viewer arrows or counter');
 const closeStyle=await dialog.locator('[data-post-close]').evaluate(el=>({width:el.getBoundingClientRect().width,clip:getComputedStyle(el).clipPath}));
 assert.ok(closeStyle.width<=1&&closeStyle.clip.includes('inset(50%)'),'Close action stays visually hidden until keyboard-focused '+JSON.stringify(closeStyle));
 assert.equal(await dialog.locator('figcaption').textContent(),'Third carousel moment.');
 await page.keyboard.press('ArrowRight');
 assert.equal(await dialog.locator('figcaption').textContent(),'Second caption updated.','Keyboard navigation works without visible arrows');
 await dialog.locator('figure img').evaluate(el=>{
   el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:17,pointerType:'touch',clientX:240,clientY:250}));
   el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:17,pointerType:'touch',clientX:90,clientY:248}));
 });
 assert.equal(await dialog.locator('figcaption').textContent(),'Third carousel moment.','Swipe left advances to the next photo');
 // Browser-generated click following a swipe must NOT immediately dismiss the viewer.
 await dialog.locator('figure img').dispatchEvent('click');
 assert.equal(await dialog.evaluate(el=>el.open),true,'The swipe completion click cannot close the viewer');
 await page.waitForTimeout(500);
 await dialog.locator('figure img').click();
 await dialog.waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-post-photo')),true,'Tap closes viewer and restores source photo focus');
 await images.first().click();
 await dialog.waitFor({state:'visible'});
 // A tap on the gallery backdrop also dismisses; nothing requires a visible X.
 await dialog.evaluate(el=>el.click());
 await dialog.waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-post-photo')),true,'Backdrop tap restores photo focus');
 await images.first().click();
 await dialog.waitFor({state:'visible'});
 await page.keyboard.press('Escape');
 await dialog.waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-post-photo')),true,'Escape still closes the accessible viewer');

 for(const [width,height] of [[320,720],[360,780],[375,812],[390,844],[430,932],[600,900],[768,1024],[820,1180],[1024,768],[1280,800],[1366,768],[1920,1080]]){
   await page.setViewportSize({width,height});
   // Inactive carousel slides are deliberately off-screen after a swipe.
   // Validate whichever slide is fully visible following each viewport change.
   await page.waitForFunction(()=>{
     const track=document.querySelector('[data-carousel-track]')?.getBoundingClientRect();
     return !!track&&[...document.querySelectorAll('[data-carousel-slide]')].some(slide=>{
       const r=slide.getBoundingClientRect();return r.left>=track.left-2&&r.right<=track.right+2;
     });
   },null,{timeout:4000});
   const layout=await page.evaluate(()=>{
     const rect=element=>{const box=element?.getBoundingClientRect();return box?{left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width}:null};
     const track=document.querySelector('[data-carousel-track]').getBoundingClientRect();
     const slide=[...document.querySelectorAll('[data-carousel-slide]')].find(element=>{
       const r=element.getBoundingClientRect();return r.left>=track.left-2&&r.right<=track.right+2;
     });
     return {
       scroll:document.documentElement.scrollWidth,viewport:innerWidth,
       photo:rect(slide?.querySelector('.post-photo')),
       caption:rect(slide?.querySelector('figcaption')),
       heading:rect(document.querySelector('.post-heading h1'))
     };
   });
   assert.ok(layout.scroll<=layout.viewport+1,'No gallery document overflow '+width+' '+JSON.stringify(layout));
   for(const item of [layout.photo,layout.caption,layout.heading])
     assert.ok(item&&item.left>=-1&&item.right<=width+1,'No gallery element clipping '+width+' '+JSON.stringify(layout));
   assert.equal(await page.locator('[data-carousel-slide]').count(),2,'Both carousel slides rendered '+width);
   if([320,390,768,1366,1920].includes(width)){
     await page.locator('[data-carousel-slide] .post-photo').first().click();
     await dialog.waitFor({state:'visible'});
     const viewer=await dialog.boundingBox();
     assert.ok(viewer&&viewer.x>=-1&&viewer.x+viewer.width<=width+1,'Viewer fits '+width+' '+JSON.stringify(viewer));
     await page.keyboard.press('Escape');
     await dialog.waitFor({state:'hidden'});
   }
   console.log('PASS carousel viewport '+width+'x'+height);
 }
 fs.mkdirSync('screenshots',{recursive:true});
 await page.screenshot({path:'screenshots/corner-photo-post-mobile.png',fullPage:true,animations:'disabled'});
 assert.deepEqual(browserErrors,[],'No client JavaScript runtime errors');
 await page.close();
 console.log('PASS: pending red-X removal, attached delete, ordering, Instagram carousel, swipe, dots, keyboard viewer and security');
}finally{
 await browser.close();
 child.kill('SIGTERM');await sleep(220);
 fs.rmSync(dir,{recursive:true,force:true});
}
