/** Browser acceptance against disposable local data; never visits production or sends mail. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {startComposerFixture} from './composer-fixture.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const screenshots=path.join(root,'screenshots/studio-live');
await fs.mkdir(screenshots,{recursive:true});
const fixture=await startComposerFixture({seed:true});
const evidence={isolated:true,externalDelivery:false,viewports:[1366,390,320],checks:[],screenshots:[]};
const errors=[],writes=[];
let browser,page;
const record=label=>evidence.checks.push(label);
const getPost=async id=>{
  const response=await fixture.send('/api/admin/posts/'+encodeURIComponent(id));
  assert.equal(response.status,200,'Saved draft can be read');
  return (await response.json()).data;
};
const shot=async name=>{
  const file='composer-'+name+'.png';
  await page.screenshot({path:path.join(screenshots,file),fullPage:true,animations:'disabled'});
  evidence.screenshots.push(file);
};
const noOverflow=async(label,selector)=>{
  const layout=await page.evaluate(selector=>{
    const target=document.querySelector(selector),box=target?.getBoundingClientRect();
    return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,
      left:box?.left,right:box?.right,width:box?.width};
  },selector);
  assert.ok(layout.scroll<=layout.viewport+1,label+' document fits '+JSON.stringify(layout));
  assert.ok(layout.left>=-1&&layout.right<=layout.viewport+1,label+' content fits '+JSON.stringify(layout));
};
const waitSaved=async()=>{
  await page.waitForFunction(()=>/^Saved ·/.test(document.querySelector('#save-indicator')?.textContent||''),null,{timeout:15000});
};
const preview=async mode=>{
  await page.locator('button[data-preview-mode="'+mode+'"]').click();
  await page.waitForFunction(mode=>{
    const frame=document.querySelector('[data-composer-preview-frame]');
    return frame&&!frame.hidden&&frame.contentDocument?.body.classList.contains('composer-document--'+mode);
  },mode,{timeout:15000});
};

try{
  // Synthetic local files give the iframe real private image and video URLs.
  const photograph=path.join(fixture.directory,'review-landscape.png');
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><rect width="960" height="640" fill="#e8d6b7"/><circle cx="730" cy="165" r="74" fill="#bc714b"/><path d="M0 400 260 180 560 480 810 280 960 390V640H0Z" fill="#78886d"/><path d="M0 525 280 350 600 590 780 440 960 540V640H0Z" fill="#3e5b50"/></svg>')).png().toFile(photograph);
  const clip=path.join(fixture.directory,'review-clip.mp4');
  await promisify(execFile)('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=480x320:rate=15','-t','1.5','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-movflags','+faststart',clip],{timeout:30000});
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1366,height:900},deviceScaleFactor:1,timezoneId:'America/Los_Angeles',reducedMotion:'reduce'});
  page=await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  page.on('request',request=>{
    if(!['GET','HEAD'].includes(request.method())&&request.url().includes('/corner/api/'))writes.push({method:request.method(),path:new URL(request.url()).pathname});
  });
  await page.goto(fixture.base+'/admin',{waitUntil:'networkidle'});
  await page.locator('#admin-login input[name=email]').fill(fixture.email);
  await page.locator('#admin-login input[name=password]').fill(fixture.password);
  await page.locator('#admin-login button[type=submit]').click();
  await page.locator('.admin-shell').waitFor();
  await page.locator('[data-admin-view="command"]').click();
  await page.locator('.command-shell').waitFor();
  for(const width of evidence.viewports){
    await page.setViewportSize({width,height:width===1366?900:844});
    await page.evaluate(()=>scrollTo(0,0));
    await noOverflow('Command '+width,'.command-shell');
    const style=await page.locator('.command-overview-card').evaluate(element=>{
      const css=getComputedStyle(element);return {background:css.backgroundColor,radius:parseFloat(css.borderRadius),padding:parseFloat(css.paddingLeft)};
    });
    assert.equal(style.background,'rgb(255, 255, 255)','Command stylesheet is loaded at '+width);
    assert.ok(style.radius>=12&&style.padding>=16,'Command has designed card spacing at '+width);
    assert.equal(await page.locator('#command-queue-list .command-row').count(),2,'Seeded queue items remain visible');
    assert.equal(await page.locator('#command-add-panel .command-tool-icon svg path').count()>0,true,'Add has a real SVG path');
    assert.equal(await page.locator('#command-ai-panel .command-tool-icon svg path').count()>0,true,'Ask has a real SVG path');
    await shot('command-'+width);
  }
  record('Command CSS loads once with styled cards, real icons and no overflow at 1366, 390 and 320');

  await page.setViewportSize({width:1366,height:900});
  await page.locator('[data-admin-view="posts"]').click();
  await page.locator('#new-post').click();
  const body=page.locator('#post-editor textarea[name=body]');
  await body.waitFor();
  assert.equal(await page.locator('#post-editor textarea:visible').count(),1,'One writing field is visible');
  assert.equal(await page.locator('#v5-editor-settings').isVisible(),false,'Optional settings start closed');
  const split=await page.locator('.composer-grid').evaluate(element=>{
    const left=element.querySelector('.composer-editor').getBoundingClientRect();
    const right=element.querySelector('.composer-preview').getBoundingClientRect();
    return {left:left.toJSON(),right:right.toJSON()};
  });
  assert.ok(split.right.left>=split.left.right+12,'Desktop composer has a real editor and preview split');
  const source='Some stories need a little space.\n\nA slower morning, a warm cup of coffee, and one idea worth keeping. I am making room for work that feels useful and words that sound like me.\n\nచిన్న చిన్న క్షణాలు కూడా కథలే.\n\nThis is synthetic review content, saved only in an isolated test workspace.';
  await body.fill(source);
  await page.locator('[data-v5-settings-toggle]').click();
  const settings=page.locator('#v5-editor-settings');
  await settings.locator('select[name=type]').selectOption('journal');
  await settings.locator('input[name=emoji]').fill('🌿');
  assert.equal(await settings.locator('[name=seriesChoice]').inputValue(),'__none__','Journal defaults to standalone');
  assert.equal(await settings.locator('[name=reviewEmail]').isChecked(),false,'Subscriber review is explicitly opt-in');
  await settings.locator('[data-settings-close]').click();
  await waitSaved();
  const id=decodeURIComponent(new URL(page.url()).hash.replace(/^#post\//,''));
  assert.ok(id&&!id.includes('#'),'Autosave creates a reloadable draft URL');
  let saved=await getPost(id);
  assert.equal(saved.post.body,source,'Autosave preserves the original source');
  assert.equal(saved.post.type,'journal');
  assert.equal(saved.post.series,null,'A standalone Journal does not create a series');
  record('Single writing field, optional details, standalone Journal and honest persistent autosave');

  // A late server response cannot label newer typing as saved.
  let releaseSave,announceSave;
  const heldSave=new Promise(resolve=>{releaseSave=resolve});
  const saveStarted=new Promise(resolve=>{announceSave=resolve});
  let holdNext=true;
  const draftRoute='**/corner/api/admin/posts/'+id;
  await page.route(draftRoute,async route=>{
    if(route.request().method()!=='PATCH'||!holdNext)return route.continue();
    holdNext=false;const response=await route.fetch();announceSave();await heldSave;await route.fulfill({response});
  });
  await body.fill(source+'\n\nEarlier save in flight.');
  await Promise.race([saveStarted,new Promise((_,reject)=>setTimeout(()=>reject(Error('Autosave request did not start')),12000))]);
  const latest=source+'\n\nThe latest sentence stays with this draft.';
  await body.fill(latest);
  assert.equal(await page.locator('#save-indicator').getAttribute('data-state'),'unsaved');
  releaseSave();
  await page.waitForFunction(()=>document.querySelector('#save-indicator')?.textContent.includes('newer edits unsaved'));
  await page.locator('#save-post').click();
  await waitSaved();
  await page.unroute(draftRoute);
  assert.equal((await getPost(id)).post.body,latest,'Save flushes the latest writing after a pending request');
  record('Delayed autosave keeps newer edits explicitly unsaved and manual save flushes them');

  // A failed save is recoverable after reload without claiming it reached the server.
  await page.route(draftRoute,route=>route.request().method()==='PATCH'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Synthetic save interruption'}})}):route.continue());
  const recovered=latest+'\n\nA recovered line, safe after a temporary connection problem.';
  await body.fill(recovered);
  await page.waitForFunction(()=>document.querySelector('#save-indicator')?.dataset.state==='error');
  assert.match(await page.locator('#save-indicator').textContent(),/kept in this tab/);
  assert.equal((await getPost(id)).post.body,latest,'Failed save does not change server content');
  await page.unroute(draftRoute);
  await page.reload({waitUntil:'networkidle'});
  await page.locator('[data-draft-recovery]').waitFor({state:'visible'});
  await page.locator('[data-recover-draft]').click();
  await waitSaved();
  assert.equal(await body.inputValue(),recovered);
  assert.equal((await getPost(id)).post.body,recovered);
  record('Failed saves retain writing in the tab and recovery survives a full reload');

  await page.locator('#open-media-panel').click();
  const mediaDialog=page.locator('#editor-media');
  await page.waitForFunction(()=>document.querySelector('#editor-upload')?.dataset.mediaReady==='true');
  await mediaDialog.locator('input[type=file]').setInputFiles([photograph,clip]);
  await mediaDialog.locator('input[type=file]').dispatchEvent('change');
  assert.equal(await mediaDialog.locator('.upload-preview-card').count(),2);
  await mediaDialog.locator('#editor-upload button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-composer-attachments] .composer-attachment').length===2&&!document.querySelector('#publish-post')?.disabled,null,{timeout:60000});
  await mediaDialog.locator('[data-media-dismiss]').last().click();
  await preview('feed');
  await page.waitForFunction(()=>{
    const img=document.querySelector('[data-composer-preview-frame]')?.contentDocument?.querySelector('.card-media img');
    return img?.complete&&img.naturalWidth>0;
  },null,{timeout:20000});
  const frame=page.frameLocator('[data-composer-preview-frame]');
  assert.equal(await frame.locator('.story h2').textContent(),'Some stories need a little space');
  assert.equal(await page.locator('[data-composer-preview-frame]').getAttribute('sandbox'),'allow-same-origin','Private preview allows media credentials without scripts');
  await shot('feed-desktop');
  const imageUrl=await frame.locator('.card-media img').getAttribute('src');
  assert.ok([401,403,404].includes((await fetch(fixture.origin+imageUrl)).status),'Draft image remains unavailable without an owner session');
  await preview('full');
  await page.waitForFunction(()=>{
    const doc=document.querySelector('[data-composer-preview-frame]')?.contentDocument;
    const image=doc?.querySelector('.post-gallery-video video'),photo=doc?.querySelector('.post-photo img');
    return image?.readyState>=1&&image.videoWidth>0&&photo?.complete&&photo.naturalWidth>0;
  },null,{timeout:20000});
  assert.match(await frame.locator('.post-body').innerText(),/A recovered line/);
  assert.equal(await frame.locator('script,form').count(),0,'Preview cannot execute public scripts or submit forms');
  assert.equal(await frame.locator('button:not([disabled])').count(),0,'Public interaction buttons are inert');
  const videoUrl=await frame.locator('.post-gallery-video video source').getAttribute('src');
  assert.ok([401,403,404].includes((await fetch(fixture.origin+videoUrl)).status),'Draft video remains private');
  await shot('full-desktop');
  record('Real sandboxed Feed and Full post previews load private uploaded images and playable video metadata');

  const versionBefore=(await getPost(id)).post.version,writesBefore=writes.length;
  await preview('feed');
  await page.locator('button[data-device=mobile]').click();
  assert.ok((await page.locator('.preview-stage').boundingBox()).width<=391,'Mobile preview constrains the actual reading canvas');
  await page.locator('button[data-device=desktop]').click();
  await preview('full');
  assert.equal((await getPost(id)).post.version,versionBefore,'Preview never saves or revises a post');
  assert.deepEqual(writes.slice(writesBefore).filter(request=>!request.path.endsWith('/posts/preview')),[],'Preview switches send no mutation requests');
  record('Feed/Full and Desktop/Mobile preview switches have no post, publish or delivery side effects');

  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>scrollTo(0,0));
    await page.locator('.composer-mobile-tabs [data-composer-view=write]').click();
    await noOverflow('Composer Write '+width,'.composer-workspace');
    await page.locator('[data-v5-settings-toggle]').click();
    assert.equal(await settings.getAttribute('aria-modal'),'true','Mobile settings has modal keyboard behavior');
    assert.equal(await settings.evaluate(element=>element.contains(document.activeElement)),true,'Opening settings moves focus into the sheet');
    const bounds=await settings.boundingBox();
    assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1&&bounds.y>=0,'Settings sheet fits '+width);
    await shot('settings-'+width);
    await page.keyboard.press('Escape');
    assert.equal(await settings.isVisible(),false);
    assert.equal(await page.locator('[data-v5-settings-toggle]').evaluate(element=>element===document.activeElement),true,'Closing settings restores focus');
    await page.locator('.composer-mobile-tabs [data-composer-view=preview]').click();
    await noOverflow('Composer Preview '+width,'.composer-workspace');
    assert.equal(await body.isVisible(),false,'Mobile Preview hides writing');
    for(const selector of ['#save-post','#schedule-post','#publish-post'])assert.equal(await page.locator(selector).isVisible(),true,'Preview retains '+selector+' at '+width);
    await page.locator('.composer-footer').scrollIntoViewIfNeeded();
    const footer=await page.locator('.composer-footer').boundingBox();
    assert.ok(footer.y>=0&&footer.y+footer.height<=845,'Publishing footer can be reached in Preview '+width+' '+JSON.stringify(footer));
    await shot('preview-'+width);
  }
  record('390px and 320px Write/Preview, settings focus, no overflow and reachable Save/Schedule/Publish footer');

  // Browser is in Los Angeles while the post is scheduled in India.
  await page.setViewportSize({width:1366,height:900});
  await page.locator('#schedule-post').click();
  const schedule=page.locator('#schedule-panel');
  await schedule.waitFor({state:'visible'});
  const future=new Date(Date.now()+48*60*60*1000);future.setUTCSeconds(0,0);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(future).map(part=>[part.type,part.value]));
  const local=parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;
  await schedule.locator('[name=localTime]').fill(local);
  assert.match(await schedule.locator('[data-schedule-summary]').textContent(),/Asia\/Kolkata/);
  await schedule.locator('button[type=submit]').click();
  await page.locator('.composer-scheduled-banner').waitFor({state:'visible'});
  saved=await getPost(id);
  assert.equal(saved.post.state,'scheduled');
  assert.equal(new Date(saved.post.scheduled_at).toISOString(),future.toISOString(),'Server applies the selected timezone exactly once');
  await shot('scheduled-desktop');
  await page.locator('#cancel-schedule').click();
  await page.locator('.composer-scheduled-banner').waitFor({state:'detached'});
  saved=await getPost(id);
  assert.equal(saved.post.state,'draft');
  assert.equal(saved.post.scheduled_at,null);
  assert.equal(saved.post.body,recovered);
  await page.reload({waitUntil:'networkidle'});
  await body.waitFor();
  assert.equal(await body.inputValue(),recovered,'Reopened draft retains original source and settings');
  await page.waitForFunction(()=>document.querySelectorAll('[data-composer-attachments] .composer-attachment').length===2);
  assert.equal(await page.locator('[data-composer-attachments] .composer-attachment').count(),2);
  assert.equal(await page.locator('#schedule-post').textContent(),'Schedule');
  record('Schedule and cancel persist correctly across a reload despite a different browser timezone');

  assert.equal(writes.some(request=>/\/publish$|\/communications\/.+queue|\/send$/.test(request.path)),false,'Review never publishes content or sends subscriber mail');
  assert.deepEqual(errors,[],'No browser exceptions');
  evidence.passed=true;
  console.log('PASS isolated Command and composer: real private media iframe, autosave/recovery, responsive settings/footer, schedule/cancel');
}catch(error){
  evidence.passed=false;evidence.failure=error.message;evidence.browserErrors=errors;
  if(page)await page.screenshot({path:path.join(screenshots,'composer-failure.png'),fullPage:true,animations:'disabled'}).catch(()=>{});
  throw error;
}finally{
  await fs.writeFile(path.join(screenshots,'composer-evidence.json'),JSON.stringify(evidence,null,2));
  await browser?.close();
  await fixture.close();
}
