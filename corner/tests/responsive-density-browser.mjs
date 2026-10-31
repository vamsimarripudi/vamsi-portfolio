import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {basePage,adminPage} from '../src/ui.mjs';

const origin='http://127.0.0.1:4141';
const sizes=[
 [320,720],[360,780],[375,812],[390,844],[430,932],[600,900],
 [768,1024],[820,1180],[1024,768],[1280,800],[1366,768],[1920,1080]
];
const screenshotWidths=new Set([320,390,768,1366,1920]);
const asHosted=html=>html
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'')
 .replace(/(href|src)=(["'])\/(?!\/)/g,(_,attr,quote)=>attr+'='+quote+'/corner/');
const sample=(content,initial={},route='/test-layout')=>asHosted(basePage({
 title:'Responsive design check',path:route,content,initial
}));
const modules=[
 {name:'memories',html:sample('<main id="content" class="shell v3m-studio"><header class="v3m-hero"><p class="eyebrow">Memories</p><h1>Timeline and moments</h1><p>Public records and milestones.</p></header><div class="v3m-content"><div class="v3m-empty"><h2>More to remember</h2></div></div></main>'),heading:'.v3m-hero h1'},
 {name:'wishes',html:sample('<main id="content" class="shell v3w-page"><div class="v3w-heading"><p>OWNER / WISHES</p><h1>Wishes</h1><p>Private scheduling tools.</p></div><div class="v3w-grid"><form class="v3w-form"><h2>Write a wish</h2><label>Title<input></label></form><section class="v3w-panel"><h2>Private preview</h2></section></div></main>',{page:'wishes'}),heading:'.v3w-heading h1'},
 {name:'insights',html:sample('<main id="content" class="shell v3a-page"><h1>Insights</h1><p class="v3a-lead">Aggregated privacy-safe activity.</p><section class="v3a-kpis"><article class="v3a-kpi"><span>Visits</span><strong>12</strong></article></section></main>',{page:'insights'}),heading:'.v3a-page h1'},
 {name:'languages',html:sample('<main id="content" class="shell v3a-page"><h1>Languages</h1><section class="v3a-layout"><div class="v3a-panel"><h2>Reviewed language versions</h2></div></section></main>',{page:'languages'}),heading:'.v3a-page h1'},
 {name:'search',html:sample('<main id="content" class="shell simple-page"><h1>Explore</h1><div class="v3-explorer"><p>Search public writing and stories.</p></div></main>'),heading:'.simple-page h1'}
];

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
fs.mkdirSync('screenshots',{recursive:true});
try{
 for(const [width,height] of sizes){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  const noOverflow=async label=>{
   const size=await page.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,
    visible:innerWidth
   }));
   if(size.scroll>size.visible+1){
     const offenders=await page.evaluate(()=>[...document.body.querySelectorAll('*')].map(el=>{
       const r=el.getBoundingClientRect(),c=getComputedStyle(el);
       return {tag:el.tagName.toLowerCase(),className:String(el.className).slice(0,85),
         width:Math.round(r.width),left:Math.round(r.left),right:Math.round(r.right),
         display:c.display,position:c.position,overflowX:c.overflowX}
     }).filter(el=>el.right>innerWidth+2&&el.position!=='fixed'&&el.display!=='none')
       .sort((a,b)=>b.right-a.right).slice(0,18));
     assert.fail(label+' at '+width+'px document overflow: '+JSON.stringify({size,offenders}));
   }
  };
  const fontPx=selector=>page.locator(selector).first().evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
  const maxPublic=width<=430?53:width<=820?92:115;
  const maxInner=width<=430?52:width<=820?88:100;
  const home=await page.goto(origin+'/corner',{waitUntil:'domcontentloaded'});
  assert.equal(home.status(),200,'Home '+width);
  await noOverflow('Home');
  assert.ok(await page.locator('.hero-content h1').count(),'Home hero '+width);
  const heroSize=await fontPx('.hero-content h1');
  assert.ok(heroSize<=maxPublic,'Hero too large '+width+'px: '+heroSize);
  const heading=await page.locator('.hero-content h1').boundingBox();
  assert.ok(heading&&heading.y<height*.57,'Hero must appear in first screen '+width);
  if(screenshotWidths.has(width))
   await page.screenshot({path:'screenshots/density-'+width+'-home.png',fullPage:true,animations:'disabled'});
  for(const [name,url,selector] of [
   ['about','/corner/about','.simple-page h1'],
   ['account','/corner/login','.account-intro h1'],
   ['owner-sign-in','/corner/admin','.signin-box h1']
  ]){
   const response=await page.goto(origin+url,{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200,name+' '+width);
   await noOverflow(name);
   assert.ok(await page.locator(selector).count(),name+' heading '+width);
   const px=await fontPx(selector);
   assert.ok(px<=maxInner,name+' title oversized at '+width+': '+px);
   if(name==='account'&&width<=430){
    const card=await page.locator('.account-card').boundingBox();
    assert.ok(card&&card.y<height*.65,'Account form starts too low '+width+': '+card?.y);
   }
  }
  const studio=asHosted(adminPage({owner:{id:'synthetic-layout',role:'owner',email:'layout@example.test'}}));
  await page.goto(origin+'/corner',{waitUntil:'domcontentloaded'});
  await page.setContent(studio,{waitUntil:'load'});
  await noOverflow('Owner Studio');
  const studioSize=await fontPx('.admin-top h1');
  assert.ok(studioSize<=(width<=430?43:width<=820?58:65),
    'Studio heading too large at '+width+': '+studioSize);
  const logout=page.locator('#admin-logout');
  assert.equal(await logout.getAttribute('aria-label'),'Sign out');
  const logoutRect=await logout.boundingBox();
  assert.ok(logoutRect&&logoutRect.height>=44&&logoutRect.width>=44,
    'Sign-out touch target '+width+': '+JSON.stringify(logoutRect));
  if(width<=767){
   const boxes=await page.evaluate(()=>{
    const rect=sel=>document.querySelector(sel)?.getBoundingClientRect();
    const nav=document.querySelector('.admin-nav');
    const active=document.querySelector('.admin-nav [aria-current=page]');
    const label=active?.querySelector('.studio-nav-label');
    return {sidebar:rect('.admin-sidebar'),nav:rect('.admin-nav'),active:rect('.admin-nav [aria-current=page]'),
      navDisplay:nav?getComputedStyle(nav).display:null,labelDisplay:label?getComputedStyle(label).display:null,main:rect('.admin-main')};
   });
   assert.ok(boxes.sidebar.height<145,'Studio mobile chrome too tall '+width+': '+boxes.sidebar.height);
   assert.equal(boxes.navDisplay,'flex','Mobile Studio rail stays reachable '+width);
   assert.ok(boxes.nav&&boxes.nav.height<=64,'Mobile Studio rail stays compact '+width+': '+boxes.nav.height);
   assert.ok(boxes.active&&boxes.active.width>=60&&boxes.active.height>=56,'Active mobile section has a touch-sized labeled target '+width+': '+JSON.stringify(boxes.active));
   assert.equal(boxes.labelDisplay,'block','Active mobile section label is visible '+width);
   assert.ok(boxes.main.top<165,'Studio content too far down '+width+': '+boxes.main.top);
  }
  if(screenshotWidths.has(width))
   await page.screenshot({path:'screenshots/density-'+width+'-studio.png',fullPage:false,animations:'disabled'});
  for(const module of modules){
   await page.setContent(module.html,{waitUntil:'load'});
   await noOverflow(module.name);
   assert.ok(await page.locator(module.heading).count(),module.name+' heading '+width);
   const px=await fontPx(module.heading);
   assert.ok(px<=maxInner,module.name+' heading too large at '+width+': '+px);
  }
  await page.close();
  console.log('PASS '+width+'x'+height+' home/about/account/Studio/Memories/Wishes/Insights/Languages/Search');
 }
}finally{await browser.close()}
