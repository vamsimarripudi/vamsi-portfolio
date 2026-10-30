/* Pure visual/interaction acceptance on an isolated demo server. No real accounts. */
import test from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=process.env.CORNER_TEST_ORIGIN||'http://127.0.0.1:4143';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [320,375,390,430,768]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:width<=430,hasTouch:width<=430});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(origin+'/corner/category/builds',{waitUntil:'domcontentloaded'});
  test.equal(response.status(),200,'Builds category serves '+width);
  const styles=await page.locator('link[href$="/v6-pulse.css?v=1"]').count();
  test.equal(styles,1,'Pulse styles loaded');
  await page.locator('.site-footer').waitFor({state:'visible'});
  await page.evaluate(()=>{
   const link=document.querySelector('.site-footer [data-profile-link]');
   if(!link)return;
   link.hidden=false;
   const img=document.createElement('img');img.src='data:image/gif;base64,R0lGODlhAQABAAAAACw=';
   img.width=26;img.height=26;img.alt='';
   const label=document.createElement('span');label.textContent='A longer reader display name · Profile';
   link.replaceChildren(img,label);
  });
  const position=await page.evaluate(()=>{
   const links=[...document.querySelectorAll('.site-footer .footer-links a')].filter(a=>!a.hidden);
   const rect=links.map(a=>({title:a.textContent.trim(),left:a.getBoundingClientRect().left,
    right:a.getBoundingClientRect().right,top:a.getBoundingClientRect().top,bottom:a.getBoundingClientRect().bottom}));
   let collisions=[];
   for(let i=0;i<rect.length;i++)for(let j=i+1;j<rect.length;j++){
    const x=Math.min(rect[i].right,rect[j].right)-Math.max(rect[i].left,rect[j].left);
    const y=Math.min(rect[i].bottom,rect[j].bottom)-Math.max(rect[i].top,rect[j].top);
    if(x>3&&y>3)collisions.push([rect[i].title,rect[j].title]);
   }
   return {collisions,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
  });
  test.deepEqual(position.collisions,[],'Footer Profile cannot overlap links '+width);
  test.ok(position.scrollWidth<=position.width+1,'No page overflow '+width+': '+JSON.stringify(position));
  if(width<=430){
   await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
   await page.waitForFunction(()=>document.querySelector('.category-tabs.corner-rail')?.classList.contains('v51-dock-hidden'),null,{timeout:4000});
  }
  await page.goto(origin+'/corner/',{waitUntil:'domcontentloaded'});
  const pulse=page.locator('.corner-pulse-card').first();
  await pulse.waitFor({state:'visible'});
  await page.waitForFunction(()=>typeof window.CornerPulse?.apply==='function');
  await page.evaluate(()=>window.CornerPulse.apply({
   label:'A quick Corner thought',detail:'A short-lived test update.',
   expiresAt:new Date(Date.now()+1100).toISOString()
  }));
  test.equal(await pulse.locator('[data-pulse-label]').textContent(),'A quick Corner thought');
  test.equal(await pulse.getAttribute('class').then(c=>c.includes('is-live')),true);
  await page.waitForFunction(()=>document.querySelector('.corner-pulse-card')?.classList.contains('is-idle'),null,{timeout:5000});
  test.equal(await pulse.locator('[data-pulse-label]').textContent(),'No Pulse right now','Expired public text is removed in an open browser');
  test.equal(await pulse.locator('[data-pulse-detail]').textContent().then(x=>x.includes('short-lived test')),false);
  // Simulate a bfcache pagehide/pageshow cycle; future Pulse updates must still
  // render and expire rather than leaving a stale status frozen in a restored tab.
  await page.evaluate(()=>{
   window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
   window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
   window.CornerPulse.apply({label:'Another ephemeral note',detail:'Back-forward cache check',
     expiresAt:new Date(Date.now()+600).toISOString()});
  });
  test.equal(await pulse.locator('[data-pulse-label]').textContent(),'Another ephemeral note');
  await page.waitForFunction(()=>document.querySelector('.corner-pulse-card')?.classList.contains('is-idle'),null,{timeout:5000});
  test.equal(await pulse.locator('[data-pulse-label]').textContent(),'No Pulse right now','bfcache restoration re-arms expiry');
  await page.goto(origin+'/corner/now',{waitUntil:'domcontentloaded'});
  test.match(await page.locator('h1').first().textContent(),/Corner Pulse/);
  test.deepEqual(errors,[],'No browser exception '+width);
  await page.close();
  console.log('PASS Pulse expiry, footer and dock '+width);
 }
}finally{await browser.close()}
