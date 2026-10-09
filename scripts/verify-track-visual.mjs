import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const widths=[320,375,390,430,768,1024,1440,1920];
try{
 for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:width<=430?760:900},reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.route('**/api/track/**',async route=>{
    const url=new URL(route.request().url());
    let data={ok:true};
    if(url.pathname.endsWith('/auth/session'))data={ok:true,owner:'connect@example.test',expiresAt:new Date(Date.now()+3600000).toISOString()};
    else if(url.pathname.endsWith('/metrics'))data={ok:true,metrics:{total:1,new_count:1,in_progress_count:0,follow_up_due_count:0,waiting_on_contact_count:0}};
    else if(url.pathname.endsWith('/enquiries'))data={ok:true,items:[{reference_id:'VM-ENQ-2026-ABC123',name:'Example enquiry',email:'example@example.test',intent:'Collaboration',subject:'Example',status:'NEW',priority:'NORMAL',created_at:new Date().toISOString(),last_activity_at:new Date().toISOString()}],total:1,page:1,limit:25};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/track',{waitUntil:'domcontentloaded'});
  await page.locator('.track-kpi').first().waitFor({timeout:10000});
  await page.locator('.track-table-wrap tbody tr').first().waitFor({timeout:10000});
  const state=await page.evaluate(()=>{
    const root=document.documentElement,card=document.querySelector('.track-kpi');
    const title=document.querySelector('.track-page-title h1'),refresh=document.querySelector('.track-page-title .track-icon-button');
    const h=title.getBoundingClientRect(),r=refresh.getBoundingClientRect(),c=card.getBoundingClientRect();
    return {width:innerWidth,scroll:root.scrollWidth,headingWidth:h.width,cardWidth:c.width,headingSize:parseFloat(getComputedStyle(title).fontSize),cardDisplay:getComputedStyle(card).display,background:getComputedStyle(card).backgroundColor,buttonText:getComputedStyle(card.querySelector('small')).color,refreshTop:r.top,titleTop:h.top};
  });
  assert.ok(state.scroll<=state.width+1,'Horizontal overflow '+width+': '+JSON.stringify(state));
  assert.equal(state.cardDisplay,'flex','KPI grid layout should not be overridden by generic buttons');
  assert.ok(state.cardWidth>=110,'Readable KPI at '+width);
  assert.ok(state.headingWidth<=width,'Heading fits viewport '+width);
  assert.ok(state.refreshTop<state.titleTop,'Refresh control stays above heading '+width);
  if(width<=430)assert.ok(state.headingSize<=56,'Mobile heading sizing '+width);
  if(width<=760){
    const cells=await page.locator('.track-table-wrap tbody tr td').count();
    assert.equal(cells,7,'Every field stays on the mobile record card');
    const action=page.locator('.track-table-wrap td[data-label="Action"] button');
    const bounds=await action.boundingBox();
    assert.ok(bounds && bounds.x+44<=width+1,'Mobile open-record action is visible '+width);
    const statusCell=page.locator('.track-table-wrap td[data-label="Status"]');
    const statusBox=await statusCell.boundingBox();
    assert.ok(statusBox && statusBox.width>75,'Mobile status remains readable '+width);
  }
  assert.notEqual(state.background,state.buttonText,'Text must contrast with card background');
  const signout=await page.locator('.track-header .track-logout').evaluate(button=>{
    const rect=button.getBoundingClientRect();
    const header=button.closest('.track-header').getBoundingClientRect();
    const brand=document.querySelector('.track-header .track-brand').getBoundingClientRect();
    const caption=button.querySelector('.track-logout-label');
    return {
      label:caption?.textContent?.trim(),display:getComputedStyle(button).display,
      fontSize:parseFloat(getComputedStyle(button).fontSize),
      labelFontSize:caption?parseFloat(getComputedStyle(caption).fontSize):0,
      x:rect.x,right:rect.right,top:rect.top,width:rect.width,height:rect.height,
      brandRight:brand.right,headerRight:header.right,
    };
  });
  if(width<=760){
    assert.equal(signout.label,'Sign out','Visible mobile action label at '+width);
    assert.equal(signout.display,'flex','Mobile sign out uses centered horizontal layout at '+width);
    assert.ok(signout.labelFontSize>=10,'Sign out text must not be visually hidden at '+width);
    assert.ok(signout.width>=88&&signout.height>=44,'Accessible sign out target at '+width);
    assert.ok(signout.x>=signout.brandRight+6,'Brand and sign out never overlap at '+width);
    assert.ok(signout.right<=width-12,'Sign out respects right screen inset at '+width);
    assert.ok(signout.headerRight<=width+1,'Header does not extend outside viewport at '+width);
    console.log('PASS /track sign out '+width+'px '+JSON.stringify(signout));
  }
  assert.deepEqual(errors,[],'No browser exceptions '+width);
  if([375,1440].includes(width))await page.screenshot({path:'/tmp/track-'+width+'.png',fullPage:true});
  console.log('PASS /track '+width+'px '+JSON.stringify(state));
  await context.close();
 }
}finally{await browser.close();}
