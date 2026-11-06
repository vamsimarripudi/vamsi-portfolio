/* Exact-date, real built-portfolio smoke. Synthetic time; real markup and palette.
 * Uses Playwright only in CI; does not call APIs or mutate production. */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const port = 4187;
const origin = 'http://127.0.0.1:' + port;
const preview = spawn(process.execPath,
  ['./node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { stdio: ['ignore','pipe','pipe'] });
let serverOutput = '';
for (const stream of [preview.stdout,preview.stderr]) stream.on('data', bytes => {
  serverOutput = (serverOutput + String(bytes)).slice(-4000);
});
let browser;
const failures = [];
async function ready() {
  for (let attempt=0; attempt<50; attempt+=1) {
    if (preview.exitCode !== null) throw new Error('Vite preview exited: ' + serverOutput);
    try { if ((await fetch(origin+'/')).ok) return; } catch { /* preview starting */ }
    await sleep(250);
  }
  throw new Error('Vite preview never became ready: ' + serverOutput);
}
async function open(time, viewport={width:390,height:844}, options={}) {
  const context=await browser.newContext({
    viewport,
    deviceScaleFactor:1,
    reducedMotion:options.reduced?'reduce':'no-preference',
  });
  if(options.dark)await context.addInitScript(() => localStorage.setItem('theme','dark'));
  const page=await context.newPage();
  page.on('pageerror',e=>failures.push(e.message));
  await page.clock.install({time:new Date(time)});
  const response=await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  await page.locator('main#main .hero-title').waitFor();
  return {page,context};
}
async function geometry(page){
  return page.evaluate(()=>{
    const rect=selector=>{
      const r=document.querySelector(selector).getBoundingClientRect();
      return {x:r.x,y:r.y,w:r.width,h:r.height};
    };
    const style=getComputedStyle(document.documentElement);
    return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,
      bg:style.getPropertyValue('--bg').trim(),accent:style.getPropertyValue('--accent').trim(),
      header:rect('.site-header'),hero:rect('.hero.hero-identity')};
  });
}
try {
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  mkdirSync('screenshots/portfolio-diwali',{recursive:true});
  const sizes=[
    {width:320,height:720},{width:390,height:844},{width:768,height:1024},
    {width:1366,height:768},{width:1920,height:1080},{width:3840,height:2160}
  ];
  for(const size of sizes){
    const baseline=await open('2026-11-07T16:00:00.000Z',size);
    assert.equal(await baseline.page.locator('.portfolio-diwali').count(),0);
    const before=await geometry(baseline.page);
    await baseline.context.close();
    const active=await open('2026-11-08T07:30:00.000Z',size);
    await active.page.locator('[data-portfolio-diwali="2026"]').waitFor();
    await active.page.clock.fastForward(1000);
    const during=await geometry(active.page);
    assert.equal(during.bg,before.bg,'background token preserved '+size.width);
    assert.equal(during.accent,before.accent,'accent token preserved '+size.width);
    // The new full-screen hero height is the ONLY approved layout change.
    // Header and hero position/width remain byte-for-byte in the visual layout.
    for(const dim of ['x','y','w','h']){
      assert.ok(Math.abs(during.header[dim]-before.header[dim])<=1,
        'Header moved '+size.width+' '+dim+
        ' before='+JSON.stringify(before.header)+' after='+JSON.stringify(during.header));
    }
    for(const dim of ['x','y','w']){
      assert.ok(Math.abs(during.hero[dim]-before.hero[dim])<=1,
        'Hero content changed horizontal geometry or start position '+size.width+' '+dim);
    }
    const minHero = size.height - (size.width<=620?70:82);
    assert.ok(during.hero.h+1>=minHero,
      'Full-viewport hero does not reach the viewport fold '+size.width+': '+JSON.stringify(during));
    assert.ok(during.hero.h+1>=before.hero.h,
      'Festival cannot shorten the original hero at '+size.width);
    assert.ok(during.hero.y+during.hero.h+1>=size.height,
      'Hero plus header must cover one first screen at '+size.width);
    assert.ok(during.scroll<=during.viewport+1,'horizontal overflow '+size.width+': '+during.scroll);
    assert.equal(await active.page.locator('.portfolio-diwali').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
    assert.equal(await active.page.locator('.portfolio-diwali__garland').count(),1);
    assert.equal(await active.page.locator('.portfolio-diwali__lantern').count(),2);
    assert.equal(await active.page.locator('.portfolio-diwali__diya').count(),2);
    assert.equal(await active.page.locator('.portfolio-diwali__wire span').count(),22);
    assert.equal(await active.page.locator('.portfolio-diwali__gold-frame').count(),1);
    assert.equal(await active.page.locator('.portfolio-diwali__lower-wire').count(),1);
    if(size.width>=1000){
      const lanternAnimation=await active.page.locator('.portfolio-diwali__lantern--left')
        .evaluate(el=>getComputedStyle(el).animationName);
      assert.match(lanternAnimation,/vm-diwali-lantern-arrive/);
      const bulbAnimation=await active.page.locator('.portfolio-diwali__wire span').first()
        .evaluate(el=>getComputedStyle(el).animationName);
      assert.match(bulbAnimation,/vm-diwali-bulb-breathe/);
    }
    assert.doesNotMatch(await active.page.locator('body').innerText(),/Happy Diwali|Diwali greetings/i);
    if([390,1920,3840].includes(size.width)) {
      await active.page.screenshot({path:'screenshots/portfolio-diwali/home-'+size.width+'.png',
        fullPage:false,animations:'disabled'});
    }
    await active.context.close();
    console.log('PASS '+size.width+'x'+size.height+' real homepage, original geometry, colour tokens and festive overlay');
  }

  const pre=await open('2026-11-07T18:29:59.000Z');
  assert.equal(await pre.page.locator('.portfolio-diwali').count(),0);
  await pre.page.clock.fastForward(1300);
  await pre.page.locator('.portfolio-diwali').waitFor();
  await pre.context.close();
  const end=await open('2026-11-08T18:29:59.000Z');
  assert.equal(await end.page.locator('.portfolio-diwali').count(),1);
  await end.page.clock.fastForward(1300);
  await end.page.locator('.portfolio-diwali').waitFor({state:'detached'});
  await end.context.close();
  const expired=await open('2026-11-08T18:30:00.000Z');
  assert.equal(await expired.page.locator('.portfolio-diwali').count(),0);
  await expired.context.close();

  const reduced=await open('2026-11-08T07:30:00.000Z',{width:390,height:844},{reduced:true});
  await reduced.page.locator('.portfolio-diwali').waitFor();
  assert.equal(await reduced.page.locator('.portfolio-diwali__sparks').evaluate(e=>getComputedStyle(e).display),'none');
  assert.equal(await reduced.page.locator('.portfolio-diwali__wire span').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.equal(await reduced.page.locator('.portfolio-diwali__lower-wire').evaluate(e=>getComputedStyle(e,'::after').animationName),'none');
  assert.equal(await reduced.page.locator('.portfolio-diwali__lantern').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  await reduced.context.close();

  const dark=await open('2026-11-08T07:30:00.000Z',{width:1366,height:768},{dark:true});
  assert.equal((await geometry(dark.page)).bg,'#121310');
  assert.equal((await geometry(dark.page)).accent,'#ff7758');
  await dark.page.goto(origin+'/work',{waitUntil:'domcontentloaded'});
  assert.equal(await dark.page.locator('.portfolio-diwali').count(),0,'other routes are undecorated');
  await dark.context.close();

  assert.deepEqual(failures,[],'no browser runtime errors');
  console.log('PASS activation at 8 Nov 00:00 IST, removal at 9 Nov 00:00 IST, open tabs, motion and dark mode');
} finally {
  if(browser)await browser.close();
  preview.kill('SIGTERM');
}
