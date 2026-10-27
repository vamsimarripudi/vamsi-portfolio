/** Exact implementation assets, isolated fixtures. Never production accounts or posts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const pulse=read('companion.js'),style=read('companion.css');
import fixture from './pulse-rabbit-fixture.mjs';
const {html,css:base,boot}=fixture;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
fs.mkdirSync('screenshots/pulse-v2',{recursive:true});
async function start(width,height,{clock=false,seen=false}={}){
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://pulse.example/**',route=>route.fulfill({status:200,contentType:route.request().url().includes('/mark.svg')?'image/svg+xml':'text/html; charset=utf-8',body:route.request().url().includes('/mark.svg')?read('mark.svg'):html}));
  await page.goto('https://pulse.example/corner/');if(clock)await page.clock.install();
  await page.addStyleTag({content:base+'\n'+style});
  await page.addScriptTag({content:boot+(seen?"localStorage.setItem('corner-welcome-letter-v2','seen');":"")});
  await page.addScriptTag({content:pulse});return page;
}
async function openMenu(page){
  await page.locator('[data-corner-profile-toggle]').click();
  await page.locator('#corner-profile-card .pulse-text-control').click();
  await page.waitForFunction(()=>document.querySelector('[data-orbit-status]').textContent==='Building the little Corner.');
}
async function settings(page){if(!await page.locator('details.pulse-settings').evaluate(el=>el.open))await page.locator('details.pulse-settings>summary').click();}
try{
  for(const [width,height] of [[320,640],[390,844],[430,932],[768,1024],[1366,850],[1920,1080]]){
    const page=await start(width,height),letter=page.locator('.pulse-welcome-modal');await letter.waitFor({state:'visible'});
    assert.equal(await letter.evaluate(el=>el.matches(':modal')),true);
    assert.equal(await letter.evaluate(el=>getComputedStyle(el,'::backdrop').backdropFilter),'blur(8px)');
    for(const selector of ['[data-letter-dismiss]','[data-letter-explore]','[data-letter-join]']){
      const box=await page.locator(selector).boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=height+1,'Reachable letter control '+width+' '+selector);
    }
    if([390,1366].includes(width))await page.screenshot({path:'screenshots/pulse-v2/welcome-'+width+'.png'});
    await page.keyboard.press('Escape');await letter.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>localStorage.getItem('corner-welcome-letter-v2')),'seen');
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>CornerPulse.snapshot().character),'Doraemon');
    assert.equal(await page.evaluate(()=>CornerPulse.snapshot().audioState),'not-created','No audio context before opt-in');
    assert.equal(await page.evaluate(()=>__sources.filter(s=>!s.closed).length),1);
    await openMenu(page);
    assert.equal(await page.locator('#corner-orbit-card').evaluate(el=>el.matches(':modal')),false,'Casual menu leaves the page usable');
    await page.locator('[data-pulse-action=latest]').click();
    assert.equal(await page.locator('[data-result-link]').getAttribute('href'),'/corner/post/small-moment');
    await page.locator('[data-pulse-action=surprise]').click();
    assert.ok(['/corner/post/small-moment','/corner/post/second-story'].includes(await page.locator('[data-result-link]').getAttribute('href')));
    await page.locator('[data-pulse-action=tour]').click();
    assert.equal(await page.locator('.pulse-tour-target').count(),1);
    await page.locator('[data-tour-next]').click();
    assert.match(await page.locator('[data-result-kicker]').textContent(),/2 \/ 3/);
    await page.locator('[data-tour-stop]').click();assert.equal(await page.locator('.pulse-tour-target').count(),0);
    await settings(page);await page.locator('[data-pulse-mode=paused]').click();await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>CornerPulse.snapshot().mode),'paused');
    await openMenu(page);await settings(page);await page.locator('[data-pulse-mode=hidden]').click();
    assert.equal(await page.locator('.pulse-pet').isVisible(),false);
    await page.locator('[data-pulse-restore]').click();await settings(page);await page.locator('[data-pulse-mode=playful]').click();await page.keyboard.press('Escape');
    await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});await page.waitForTimeout(230);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    if([390,1366].includes(width))await page.screenshot({path:'screenshots/pulse-v2/doraemon-'+width+'.png'});
    const snapshot=await page.evaluate(()=>CornerPulse.snapshot());
    if(snapshot.visible){
      const collision=await page.locator('.pulse-pet').evaluate(el=>{
        const r=el.getBoundingClientRect();return [...document.querySelectorAll('a,button,input,textarea,nav')].filter(t=>!el.contains(t)&&!t.closest('dialog')).some(t=>{const b=t.getBoundingClientRect();return b.width&&b.height&&r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;});
      });assert.equal(collision,false,'Character does not cover a control at '+width);
    }
    await page.locator('textarea').focus();await page.waitForTimeout(200);assert.equal(await page.locator('.pulse-pet').isVisible(),false);
    await page.locator('textarea').blur();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
    assert.equal(await page.locator('.pulse-eyes').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.close();console.log('PASS modal/menu/stories/tour/controls/input safety/reduced motion '+width);
  }
  const greeting=await start(1366,850,{seen:true});await greeting.waitForTimeout(150);
  await greeting.locator('.corner-orbit-toggle').hover();await greeting.waitForTimeout(350);
  assert.equal(await greeting.locator('[role=tooltip]').isVisible(),true);assert.match(await greeting.locator('[role=tooltip]').textContent(),/Hi! How are you/);
  await greeting.keyboard.press('Escape');assert.equal(await greeting.locator('[role=tooltip]').isVisible(),false);
  await greeting.mouse.move(0,0);await openMenu(greeting);await settings(greeting);
  await greeting.locator('[data-pulse-sound]').click();await greeting.waitForTimeout(180);
  assert.equal(await greeting.evaluate(()=>CornerPulse.snapshot().sound),true,'Explicit click unlocks audio');
  await greeting.locator('[data-pulse-sound]').click();assert.equal(await greeting.evaluate(()=>CornerPulse.snapshot().sound),false);
  await greeting.close();console.log('PASS hover/focus greeting, Escape, explicit sound opt-in and mute');
  for(const [width,height] of [[390,844],[1366,850]]){
    const page=await start(width,height,{seen:true,clock:true});
    await openMenu(page);await settings(page);await page.locator('[data-pulse-mode=playful]').click();await page.keyboard.press('Escape');
    await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);
    const snapshots=[];let captured=false;
    for(let i=0;i<65;i++){
      await page.clock.runFor(700);const s=await page.evaluate(()=>CornerPulse.snapshot());snapshots.push(s);
      if(s.pose==='peek'&&width===1366&&!captured){await page.screenshot({path:'screenshots/pulse-v2/peek-desktop.png'});captured=true;}
    }
    const poses=snapshots.map(s=>s.pose);
    assert.ok(new Set(snapshots.map(s=>JSON.stringify(s.position))).size>2,'Moves through real coordinates '+width);
    assert.ok(poses.some(p=>['walk','run','edge-exit'].includes(p)),'Actual stride '+width+' '+poses);
    assert.ok(snapshots.some(s=>s.phase>0),'Phase is distance driven '+width);
    if(width>900){assert.ok(poses.includes('edge-hidden'),'Leaves visible viewport');assert.ok(poses.includes('peek'),'Returns and peeks from edge');}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Offscreen walk does not create overflow');
    await openMenu(page);await settings(page);await page.locator('[data-pulse-mode=paused]').click();await page.keyboard.press('Escape');await page.clock.runFor(200);
    const position=await page.evaluate(()=>CornerPulse.snapshot().position);await page.clock.runFor(30000);
    assert.deepEqual(await page.evaluate(()=>CornerPulse.snapshot().position),position,'Pause freezes actual position');
    await page.close();console.log('PASS distance-driven walk, edge hide/peek, overflow and Pause '+width);
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
