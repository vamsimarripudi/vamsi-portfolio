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
const evidence={isolated:true,externalDelivery:false,viewports:[1366,390,320],shortDesktop:{width:1366,height:530},checks:[],screenshots:[]};
const errors=[],writes=[];
let browser,page;
const record=label=>evidence.checks.push(label);
const getPost=async id=>{
  const response=await fixture.send('/api/admin/posts/'+encodeURIComponent(id));
  assert.equal(response.status,200,'Saved draft can be read');
  return (await response.json()).data;
};
const shot=async(name,{preserveScroll=false}={})=>{
  const file='composer-'+name+'.png';
  if(!preserveScroll){
    await page.evaluate(()=>scrollTo(0,0));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
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
const settledLayout=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const queuePosition=()=>page.locator('.command-queue').evaluate(element=>element.getBoundingClientRect().top+scrollY);
const unchangedQueue=async(top,label)=>assert.ok(Math.abs(await queuePosition()-top)<=1,label+' does not move the Queue in document flow');
const fittedToolCard=async(card,label)=>{
  await settledLayout();
  const bounds=await card.boundingBox(),viewport=page.viewportSize();
  assert.ok(bounds&&bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1,
    label+' floating card stays within the viewport '+JSON.stringify({bounds,viewport}));
  const close=card.locator('[data-command-tool-close]');
  const closeBounds=await close.boundingBox();
  assert.ok(closeBounds&&closeBounds.width>=44&&closeBounds.height>=44,label+' close has a touch-sized target');
  assert.ok(closeBounds.y>=-1&&closeBounds.y+closeBounds.height<=viewport.height+1,label+' close remains reachable');
  assert.ok(await close.getAttribute('aria-label'),label+' close has an accessible name');
};
const openCommandTool=async(id)=>{
  const panel=page.locator('#'+id),summary=panel.locator(':scope > summary'),card=panel.locator('.command-tool-card');
  await summary.click();
  await card.waitFor({state:'visible'});
  await page.waitForFunction(id=>{
    const panel=document.getElementById(id);
    return panel?.open&&panel.querySelector('.command-tool-card')?.contains(document.activeElement);
  },id);
  assert.equal(await page.locator('.command-tools > details[open]').count(),1,'Only one Command tool is open');
  return {panel,summary,card};
};
const closedCommandTool=async(id,{restoreFocus=true}={})=>{
  await page.waitForFunction(id=>!document.getElementById(id)?.open,id);
  if(restoreFocus)await page.waitForFunction(id=>document.getElementById(id)?.querySelector(':scope > summary')===document.activeElement,id);
};
const waitSaved=async()=>{
  await page.waitForFunction(()=>/^Saved ·/.test(document.querySelector('#save-indicator')?.textContent||''),null,{timeout:15000});
};
const preview=async mode=>{
  await page.locator('button[data-preview-mode="'+mode+'"]').click();
  await page.waitForFunction(mode=>{
    const frame=document.querySelector('[data-composer-preview-frame]');
    const doc=frame?.contentDocument;
    // A srcdoc navigation briefly exposes a document without its body. Wait for
    // the requested public renderer to finish loading before inspecting it.
    return frame&&!frame.hidden&&doc?.readyState==='complete'&&doc.body?.classList.contains('composer-document--'+mode);
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
  // Render the real Ask form using synthetic availability while the fixture's
  // server-side AI stays disabled. Opening a tool must never submit a question.
  await page.route('**/corner/api/admin/command/summary',async route=>{
    const response=await route.fetch(),result=await response.json();
    result.data.agent={...result.data.agent,ready:true};
    await route.fulfill({response,json:result});
  });
  await page.goto(fixture.base+'/admin',{waitUntil:'networkidle'});
  await page.locator('#admin-login input[name=email]').fill(fixture.email);
  await page.locator('#admin-login input[name=password]').fill(fixture.password);
  await page.locator('#admin-login button[type=submit]').click();
  await page.locator('.admin-shell').waitFor();
  await page.locator('[data-admin-view="command"]').click();
  await page.locator('.command-shell').waitFor();
  const commandWritesBefore=writes.length;
  const commandViewports=[{width:1366,height:900},{width:390,height:844},{width:320,height:844},evidence.shortDesktop];
  for(const {width,height} of commandViewports){
    const label=width+'x'+height;
    await page.setViewportSize({width,height});
    await page.evaluate(()=>scrollTo(0,0));
    await noOverflow('Command '+label,'.command-shell');
    assert.equal(await page.locator('#studio-section-select,.studio-section-picker').count(),0,'No duplicate Section selector at '+label);
    const style=await page.locator('.command-overview-card').evaluate(element=>{
      const css=getComputedStyle(element);return {background:css.backgroundColor,radius:parseFloat(css.borderRadius),padding:parseFloat(css.paddingLeft)};
    });
    assert.equal(style.background,'rgb(255, 255, 255)','Command stylesheet is loaded at '+width);
    assert.ok(style.radius>=12&&style.padding>=16,'Command has designed card spacing at '+width);
    assert.equal(await page.locator('#command-queue-list .command-row').count(),2,'Seeded queue items remain visible');
    assert.equal(await page.locator('#command-add-panel .command-tool-icon svg path').count()>0,true,'Add has a real SVG path');
    assert.equal(await page.locator('#command-ai-panel .command-tool-icon svg path').count()>0,true,'Ask has a real SVG path');
    assert.equal(await page.locator('.command-tools > details').count(),3,'Command has three tools');
    assert.equal(await page.locator('.command-tools > details[open]').count(),0,'All tools start closed at '+label);
    const actionNames=['Add item','Ask Command','Agentic moments'];
    const controls=await page.locator('.command-tools > details > summary').evaluateAll(summaries=>summaries.map(summary=>({
      name:summary.getAttribute('aria-label'),tooltip:summary.getAttribute('title'),
      box:summary.getBoundingClientRect().toJSON(),icon:summary.querySelector('.command-tool-icon')?.getBoundingClientRect().toJSON()
    })));
    assert.deepEqual(controls.map(control=>control.name),actionNames,'Icon tools keep their accessible action names');
    assert.deepEqual(controls.map(control=>control.tooltip),actionNames,'Icon tools explain their actions on hover');
    assert.equal(await page.locator('.command-tools .command-tool-copy').count(),0,'Tools have no text labels beneath the icons');
    for(const control of controls){
      const {box,icon}=control;
      assert.ok(box.width>=44&&box.width<=48&&box.height>=44&&box.height<=48,'Icon control has a compact 44–48px hit area '+JSON.stringify(control));
      assert.ok(icon&&icon.width>0&&icon.width<=22&&icon.height>0&&icon.height<=22,'Icon remains small inside its touch target '+JSON.stringify(control));
      assert.equal(await page.locator('.command-tools').getByRole('button',{name:control.name,exact:true}).count(),1,'Each icon is discoverable by its accessible name');
    }
    const headingRow=await page.locator('.command-topbar').evaluate(element=>{
      const heading=element.querySelector('h2'),toolbar=element.querySelector('.command-tools');
      return heading&&toolbar?{container:element.getBoundingClientRect().toJSON(),heading:heading.getBoundingClientRect().toJSON(),toolbar:toolbar.getBoundingClientRect().toJSON()}:null;
    });
    assert.ok(headingRow,'Command heading and icon tools share the top bar');
    assert.ok(headingRow.toolbar.left>=headingRow.heading.right-1,'All tools sit to the right of the Command heading at '+label);
    assert.ok(headingRow.toolbar.left>=headingRow.container.left-1&&headingRow.toolbar.right<=headingRow.container.right+1,'Heading toolbar stays within its container at '+label);
    for(const {box} of controls){
      assert.ok(Math.abs(box.top+box.height/2-headingRow.heading.top-headingRow.heading.height/2)<=2,'Each icon aligns with the Command heading on one row at '+label);
    }
    if(width<768){
      const nav=await page.locator('.admin-nav').evaluate(element=>{
        const active=element.querySelector('[aria-current="page"]'),label=active.querySelector('.studio-nav-label');
        return {display:getComputedStyle(element).display,height:element.getBoundingClientRect().height,
          labelDisplay:getComputedStyle(label).display,active:active.getBoundingClientRect().toJSON()};
      });
      assert.equal(nav.display,'flex','Phone navigation keeps its horizontal rail');
      assert.ok(nav.height<=64&&nav.active.width>=44&&nav.active.height>=44,'Phone navigation remains compact and touch-sized');
      assert.equal(nav.labelDisplay,'block','Phone navigation labels remain visible');
    }
    await shot('command-'+label);

    const queueTop=await queuePosition();
    const add=await openCommandTool('command-add-panel');
    assert.equal(await add.card.locator('input[name=title]').evaluate(element=>element===document.activeElement),true,'Add focuses its title');
    await fittedToolCard(add.card,'Add '+label);
    await unchangedQueue(queueTop,'Opening Add '+label);
    const unsent='An unfinished local command at '+label;
    await add.card.locator('input[name=title]').fill(unsent);
    await add.card.locator('.command-form-more > summary').click();
    await add.card.locator('button[type=submit]').scrollIntoViewIfNeeded();
    await fittedToolCard(add.card,'Expanded Add '+label);
    const submitBounds=await add.card.locator('button[type=submit]').boundingBox();
    assert.ok(submitBounds.y>=0&&submitBounds.y+submitBounds.height<=height+1,'The final Add action is reachable through internal scrolling at '+label);
    if(height===530)assert.equal(await add.card.evaluate(element=>element.scrollHeight>element.clientHeight&&element.scrollTop>0),true,'Short desktop uses internal card scrolling');
    await unchangedQueue(queueTop,'Expanding Add details '+label);
    await shot('command-add-'+label,{preserveScroll:true});
    await page.keyboard.press('Escape');
    await closedCommandTool('command-add-panel');
    await unchangedQueue(queueTop,'Closing Add '+label);

    await openCommandTool('command-add-panel');
    assert.equal(await add.card.locator('input[name=title]').inputValue(),unsent,'Closing a card keeps unfinished form values');
    const restoredTitle=await add.card.locator('input[name=title]').boundingBox(),reopenedCard=await add.card.boundingBox();
    assert.ok(restoredTitle.y>=reopenedCard.y&&restoredTitle.y+restoredTitle.height<=reopenedCard.y+reopenedCard.height,
      'Reopening makes the focused title visible after a long form was scrolled');
    // Keyboard activation also works when a floating card overlaps another tile.
    await page.locator('#command-ai-panel > summary').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('#command-ai-panel')?.open&&!document.querySelector('#command-add-panel')?.open);
    const ask=page.locator('#command-ai-panel .command-tool-card');
    await page.waitForFunction(()=>document.querySelector('#command-agent-question')===document.activeElement);
    assert.equal(await page.locator('.command-tools > details[open]').count(),1,'Switching tools closes the previous card');
    await fittedToolCard(ask,'Ask '+label);
    await ask.locator('button[type=submit]').scrollIntoViewIfNeeded();
    await fittedToolCard(ask,'Scrolled Ask '+label);
    await unchangedQueue(queueTop,'Switching to Ask '+label);
    await ask.locator('[data-command-tool-close]').click();
    await closedCommandTool('command-ai-panel');

    const moments=await openCommandTool('command-moments-panel');
    await fittedToolCard(moments.card,'Moments '+label);
    await unchangedQueue(queueTop,'Opening Moments '+label);
    await moments.card.locator('[data-command-tool-close]').click();
    await closedCommandTool('command-moments-panel');

    await openCommandTool('command-add-panel');
    // This existing device-local button is outside every card and keeps focus
    // on pointer dismissal. Toggle it back without navigating or sending data.
    const outside=page.locator('[data-motion-toggle]');
    await outside.click();
    await closedCommandTool('command-add-panel',{restoreFocus:false});
    assert.equal(await outside.evaluate(element=>element===document.activeElement),true,'Outside dismissal keeps focus on the clicked control');
    await outside.click();
    await unchangedQueue(queueTop,'Outside dismissal '+label);
    assert.equal(await page.locator('.command-tools > details[open]').count(),0);
    assert.deepEqual(writes.slice(commandWritesBefore),[],'Opening and dismissing tools sends no writes or AI requests');

    await page.locator('[data-admin-view="posts"]').click();
    await page.locator('#new-post').waitFor();
    assert.equal(await page.locator('#studio-section-select,.studio-section-picker').count(),0,'Posts has no Section selector at '+label);
    assert.equal(await page.locator('[data-admin-view="posts"]').getAttribute('aria-current'),'page','Icon navigation reaches Posts');
    await page.locator('[data-admin-view="command"]').click();
    await page.locator('.command-shell').waitFor();
    assert.equal(await page.locator('[data-admin-view="command"]').getAttribute('aria-current'),'page','Icon navigation returns to Command');
  }
  record('Command keeps three accessible icon-only controls to the right of its heading, labeled navigation and no Section selector at 1366, 390 and 320');
  record('Floating cards fit 1366x900, 390x844, 320x844 and 1366x530 without moving Queue; long forms scroll internally');
  record('Only one tool opens; Escape, close and outside clicks dismiss with correct focus, preserve unfinished input and send no writes');

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
    await shot('preview-'+width,{preserveScroll:true});
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
