/** Shared private Light/Dark theme acceptance for My Corner and Studio. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {expect} from 'playwright/test';
import {startComposerFixture} from './composer-fixture.mjs';

const f=await startComposerFixture({seed:true});
const output=path.resolve('screenshots/quiet-desk');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',reducedMotion:'reduce'});
const [cookieName,cookieValue]=f.cookie.split('=');
await context.addCookies([{name:cookieName,value:cookieValue,url:f.origin}]);
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const fit=async label=>{
 const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(layout.scroll<=layout.viewport+1,label+' overflow '+JSON.stringify(layout));
};
try{
 await page.goto(f.base+'/profile',{waitUntil:'networkidle'});
 await expect(page.locator('.account-shell--quiet')).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('data-studio-theme','dark');
 await expect(page.getByRole('button',{name:'Switch to light mode',exact:true})).toBeVisible();
 assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#0d100e');
 const dark=await page.evaluate(()=>{
   const sidebar=document.querySelector('.quiet-sidebar'),nav=document.querySelector('.quiet-navigation'),current=document.querySelector('.quiet-nav-link.is-current'),profile=document.querySelector('.quiet-profile-hero');
   const sc=getComputedStyle(sidebar),nc=getComputedStyle(nav),cc=getComputedStyle(current),pc=getComputedStyle(profile);
   return {
    body:getComputedStyle(document.body).backgroundImage,sidebar:sc.backgroundColor,border:sc.borderTopWidth,
    shadow:sc.boxShadow,navDisplay:nc.display,columns:nc.gridTemplateColumns.split(' ').filter(Boolean).length,
    currentBackground:cc.backgroundColor,text:getComputedStyle(document.querySelector('.quiet-page-heading h1')).color,
    actionsInsideSidebar:!!document.querySelector('.quiet-sidebar .quiet-account-actions'),
    actionsParent:document.querySelector('.quiet-account-actions')?.parentElement?.className,
    profileTop:profile.getBoundingClientRect().top,sidebarTop:sidebar.getBoundingClientRect().top,profileBorder:pc.borderTopWidth,
    profileBackground:pc.backgroundColor,links:nav.querySelectorAll('.quiet-nav-link').length
   };
 });
 assert.match(dark.body,/rgb\(13, 16, 14\)|#0d100e|linear-gradient/i,'Dark body surface is active');
 assert.equal(dark.sidebar,'rgba(0, 0, 0, 0)','Account navigation has no enclosing card background');
 assert.equal(dark.border,'0px','Account navigation has no enclosing card border');
 assert.equal(dark.shadow,'none','Account navigation has no enclosing card shadow');
 assert.equal(dark.navDisplay,'grid');assert.equal(dark.columns,3,'Mobile account sections use a stable 3×2 grid');
 assert.equal(dark.actionsInsideSidebar,false,'Studio and sign-out actions are outside the section navigator');
 assert.equal(dark.actionsParent,'quiet-main');
 assert.ok(dark.profileTop<dark.sidebarTop,'Profile is the first primary surface on mobile '+JSON.stringify(dark));
 assert.equal(dark.profileBorder,'0px','Mobile profile hero is unboxed');
 assert.equal(dark.links,6,'Exactly six primary account destinations remain');
 await fit('390 dark My Corner');
 await page.screenshot({path:path.join(output,'theme-dark-profile-390.png'),fullPage:false,animations:'disabled'});
 console.log('PASS device dark preference resolves My Corner before paint');

 await page.setViewportSize({width:320,height:844});await fit('320 dark My Corner');
 await page.screenshot({path:path.join(output,'theme-dark-profile-320.png'),fullPage:false,animations:'disabled'});
 console.log('PASS My Corner dark mode fits 320px without overflow');

 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-studio-theme','light');
 assert.equal(await page.evaluate(()=>localStorage.getItem('corner-studio-theme')),'light');
 assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#f8f7f3');
 await page.reload({waitUntil:'networkidle'});
 await expect(page.locator('html')).toHaveAttribute('data-studio-theme','light');
 await expect(page.getByRole('button',{name:'Switch to dark mode',exact:true})).toBeVisible();
 console.log('PASS member light preference persists across reload');

 await page.goto(f.base+'/admin#command',{waitUntil:'networkidle'});
 await expect(page.locator('html')).toHaveAttribute('data-studio-theme','light');
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-studio-theme','dark');
 await page.goto(f.base+'/profile',{waitUntil:'networkidle'});
 await expect(page.locator('html')).toHaveAttribute('data-studio-theme','dark');
 await expect(page.getByRole('button',{name:'Switch to light mode',exact:true})).toBeVisible();
 console.log('PASS My Corner and Studio share one private appearance preference');

 await page.goto(f.base+'/',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('html').getAttribute('data-studio-theme'),null,'Public Corner does not inherit private theme attribute');
 assert.equal(await page.locator('link[href*="studio-theme.css"]').count(),0,'Public Corner does not load private theme CSS');
 assert.equal(await page.locator('script[src*="studio-theme.js"]').count(),0,'Public Corner does not load private theme JS');
 console.log('PASS public Corner remains independent from private account theme');

 await context.clearCookies();
 await page.goto(f.base+'/login',{waitUntil:'networkidle'});
 await expect(page.locator('html')).toHaveAttribute('data-studio-theme','dark');
 await expect(page.getByRole('button',{name:'Switch to light mode',exact:true})).toBeVisible();
 await fit('390 signed-out account dark');
 console.log('PASS signed-out account routes also support private light/dark appearance');
 assert.deepEqual(errors,[]);
}finally{
 await context.close();await browser.close();await f.close();
}
