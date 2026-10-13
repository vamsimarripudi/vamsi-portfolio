import assert from 'node:assert/strict';
import path from 'node:path';

export async function verifyAnalyticsPopups({page,origin,screenshots,firstDate,lastDate}){
 const url=origin+'/corner/admin?ar=custom&start='+firstDate+'&end='+lastDate+'&cmp=none#analytics';
 await page.goto(url);await page.getByText('Report loaded.',{exact:true}).waitFor();
 assert.equal(await page.locator('.ax-google').count(),0);assert.equal(await page.locator('.au-metrics .admin-kpi').count(),4);
 assert.equal(await page.locator('.au-tools button').count(),6);assert.equal(await page.locator('.au-tools button[aria-label]').count(),6);
 assert.equal(await page.locator('#au-popup').getAttribute('aria-labelledby'),'au-popup-title');
 const names=['Audience overview','Devices','Export report','More options','Date range and filters'];let checks=0;
 for(const width of [320,390,600,768,1024,1366,1920]){
  await page.setViewportSize({width,height:width<768?844:900});await page.evaluate(()=>scrollTo(0,0));
  for(const name of names){
   const button=page.getByRole('button',{name,exact:true});await button.click();
   const popup=page.locator('#au-popup');assert.equal(await popup.evaluate(d=>d.open),true,name);assert.equal(await button.getAttribute('aria-expanded'),'true');
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const geometry=await popup.evaluate(d=>{const r=d.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:d.scrollWidth,client:d.clientWidth,focus:d.contains(document.activeElement)}});
   assert.ok(geometry.left>=-1&&geometry.right<=width+1&&geometry.top>=-1&&geometry.bottom<=geometry.height+6,name+' fits '+width+' '+JSON.stringify(geometry));
   assert.ok(geometry.scroll<=geometry.client+1,name+' no horizontal dialog overflow '+width);assert.equal(geometry.focus,true);
   await page.keyboard.press('Tab');assert.equal(await popup.evaluate(d=>d.contains(document.activeElement)),true,'Focus remains in popup');
   if(name==='Audience overview')assert.match(await popup.innerText(),/short-lived tabs, not unique people/);
   if(name==='Devices'){assert.equal(await popup.locator('[data-popup-panel=devices] .au-donut').count(),1);assert.equal(await popup.locator('[data-kind=devices]').count(),3)}
   if([390,1366].includes(width)&&['Devices','Audience overview','Export report'].includes(name))await page.screenshot({path:path.join(screenshots,'popup-'+name.toLowerCase().replaceAll(' ','-')+'-'+width+'.png')});
   await page.keyboard.press('Escape');assert.equal(await popup.evaluate(d=>d.open),false);assert.equal(await button.getAttribute('aria-expanded'),'false');assert.equal(await button.evaluate(b=>document.activeElement===b),true,'Focus restored');checks++;
  }
  if([390,1366].includes(width))await page.screenshot({path:path.join(screenshots,'approved-analytics-'+width+'.png'),fullPage:true});
 }
 // Inside padding never acts as a backdrop; outside click is a deliberate close.
 await page.setViewportSize({width:1366,height:900});await page.getByRole('button',{name:'Devices',exact:true}).click();
 const popup=page.locator('#au-popup'),box=await popup.boundingBox();await page.mouse.click(box.x+6,box.y+6);assert.equal(await popup.evaluate(d=>d.open),true);await page.mouse.click(10,10);assert.equal(await popup.evaluate(d=>d.open),false);
 // Existing settings remain functional; modal inspection pauses opt-in auto refresh.
 await page.getByRole('button',{name:'More options',exact:true}).click();await page.getByLabel('Refresh every minute').check();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Devices',exact:true}).click();let fetches=0;const watch=req=>{if(req.url().includes('/api/admin/analytics/reading?'))fetches++};page.on('request',watch);await page.clock.fastForward(60010);assert.equal(fetches,0,'No refresh while any popup is open');page.off('request',watch);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'More options',exact:true}).click();await page.getByLabel('Refresh every minute').uncheck();await page.keyboard.press('Escape');
 // Optional dark rail is confined to this screen; remounts leave a single utility dialog.
 await page.locator('[data-admin-view=posts]').click();await page.locator('#new-post').waitFor();assert.equal(await page.locator('[data-analytics-look]').count(),0);
 await page.locator('[data-admin-view=analytics]').click();await page.getByText('Report loaded.',{exact:true}).waitFor();assert.equal(await page.locator('#au-popup').count(),1);
 // No visible old aggregate reports remain actionable after an error or expired session.
 await page.route('**/api/admin/analytics/reading?**',r=>r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{message:'Expired'}})}));await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('alert').waitFor();
 for(const name of ['Audience overview','Devices','Export report'])assert.equal(await page.getByRole('button',{name,exact:true}).isDisabled(),true,name+' disabled after failure');
 assert.equal(await page.locator('.au-metrics').count(),0);await page.unroute('**/api/admin/analytics/reading?**');await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByText('Report loaded.',{exact:true}).waitFor();
 console.log('PASS '+checks+' popup layouts, native focus/Escape/outside-click, privacy-safe real metrics, refresh pause, scoped rail and session-error cleanup');
 return checks;
}
