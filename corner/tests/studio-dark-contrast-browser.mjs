/** Dark Studio contrast acceptance at the mobile viewport reported by the owner. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {expect} from 'playwright/test';
import {startComposerFixture} from './composer-fixture.mjs';

const f=await startComposerFixture({chat:true,seed:true});
const output=path.resolve('screenshots/studio-dark');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',reducedMotion:'reduce'});
await context.addInitScript(()=>localStorage.setItem('corner-studio-theme','dark'));
const [cookieName,cookieValue]=f.cookie.split('=');
await context.addCookies([{name:cookieName,value:cookieValue,url:f.origin}]);
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const rgb=value=>{const m=String(value).match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/);return m?[+m[1],+m[2],+m[3]]:[0,0,0]};
const brightness=value=>rgb(value).reduce((a,n)=>a+n,0)/3;
const checkText=async(selector,label,min=145)=>{
 const nodes=page.locator(selector);const count=await nodes.count();assert.ok(count>0,label+' exists');
 for(let i=0;i<count;i++){const color=await nodes.nth(i).evaluate(el=>getComputedStyle(el).color);assert.ok(brightness(color)>=min,label+' readable '+color)}
};
const checkDarkSurface=async(selector,label,max=90)=>{
 const node=page.locator(selector).first();await expect(node).toBeVisible();const bg=await node.evaluate(el=>getComputedStyle(el).backgroundColor);assert.ok(brightness(bg)<=max,label+' dark surface '+bg);
};
const fit=async label=>{const x=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(x.scroll<=x.width+1,label+' no overflow '+JSON.stringify(x))};
try{
 await page.goto(f.base+'/admin#overview',{waitUntil:'networkidle'});
 await expect(page.locator('html')).toHaveAttribute('data-studio-theme','dark');
 await expect(page.locator('.admin-kpi')).toHaveCount(4);
 await checkDarkSurface('.admin-kpi','Overview metric');
 await checkText('.admin-kpi p','Overview metric label',130);
 await checkText('.admin-kpi strong','Overview metric value',180);
 await checkText('.admin-section h2','Overview section heading',180);
 await checkText('.admin-surface h3','Overview card title',180);
 await checkText('.admin-surface p:not(.eyebrow)','Overview card copy',125);
 await checkDarkSurface('.admin-surface','Overview card');
 const vars=await page.evaluate(()=>{const s=getComputedStyle(document.body);return ['--bg','--surface','--ink','--ink-2','--muted'].map(k=>[k,s.getPropertyValue(k).trim()])});
 assert.deepEqual(Object.fromEntries(vars),{'--bg':'#0d100e','--surface':'#151916','--ink':'#f2f5f2','--ink-2':'#cbd4cc','--muted':'#9ba69d'});
 await checkDarkSurface('.admin-top .studio-owner-link','Mobile communications shortcut',90);
 await checkText('.admin-top .studio-owner-link','Mobile communications shortcut icon',145);
 await checkText('.admin-nav :is(button,.admin-v3-link)','Mobile Studio navigation',115);
 await fit('Overview 390x844');
 await page.screenshot({path:path.join(output,'overview-390.png'),fullPage:false,animations:'disabled'});
 console.log('PASS Overview uses shared dark tokens and readable metric/card text');

 await page.locator('[data-admin-view="comments"]').click();
 await expect(page.getByRole('heading',{name:'Conversations and moderation.',exact:true})).toBeVisible();
 await checkText('.admin-section h2','Comments heading',180);
 const filters=page.locator('.v5-comment-filters button');assert.equal(await filters.count(),4);
 for(let i=0;i<4;i++){
   const style=await filters.nth(i).evaluate(el=>({bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
   assert.ok(brightness(style.bg)<100,'Moderation filter is dark '+JSON.stringify(style));
   assert.ok(brightness(style.color)>145,'Moderation filter icon/text is readable '+JSON.stringify(style));
 }
 await checkDarkSurface('.admin-empty','Comments empty state');
 await checkText('.admin-empty h3','Comments empty title',180);
 await checkText('.admin-empty p','Comments empty copy',125);
 await page.screenshot({path:path.join(output,'comments-390.png'),fullPage:false,animations:'disabled'});
 console.log('PASS Comments filters and empty state have dark surfaces with readable icons/text');

 await page.locator('[data-admin-view="posts"]').click();
 await expect(page.getByRole('heading',{name:'All your notes.',exact:true})).toBeVisible();
 await checkText('.admin-table-head h2','Posts heading',180);
 const rowTitle=page.locator('.admin-table td strong').first();if(await rowTitle.count())await checkText('.admin-table td strong','Post titles',170);
 const rowMeta=page.locator('.admin-table td small').first();if(await rowMeta.count())await checkText('.admin-table td small','Post metadata',120);
 console.log('PASS Posts inherit corrected dark typography tokens');

 await page.locator('[data-admin-view="media"]').click();
 await expect(page.locator('.corner-media-library')).toBeVisible();
 await checkDarkSurface('.corner-library-surface','Media library surface');
 await checkText('.corner-library-heading h2','Media library heading',180);
 await checkText('.corner-library-heading p:not(.eyebrow)','Media library description',120);
 await page.screenshot({path:path.join(output,'media-390.png'),fullPage:false,animations:'disabled'});
 console.log('PASS Media library explicit light-only surfaces are corrected');

 await page.setViewportSize({width:320,height:844});await fit('Studio dark 320x844');
 assert.deepEqual(errors,[]);
}finally{await context.close();await browser.close();await f.close()}
