import assert from 'node:assert/strict';
import path from 'node:path';

/** Uses only the caller's isolated fixture, authenticated test account and synthetic data. */
export async function verifyAdvancedAnalytics({page,admin,origin,screenshots,firstDate,lastDate}){
 const reportURL=origin+'/corner/admin?ar=custom&start='+firstDate+'&end='+lastDate+'&cmp=none#analytics';
 const loaded=()=>page.getByText('Report loaded.',{exact:true}).waitFor();
 await page.goto(reportURL);await loaded();
 const response=await admin.request.get(origin+'/corner/api/admin/analytics/reading?advanced=1&range=custom&start='+firstDate+'&end='+lastDate+'&compare=none');assert.equal(response.status(),200);
 const report=(await response.json()).data;assert.equal(report.exploration.version,2);assert.deepEqual(report.funnel.steps.map(s=>s.value),[40,30,20,10]);
 assert.equal(report.exploration.content.length,1);assert.equal(report.exploration.devices.find(s=>s.id==='mobile').stories,15);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 let layouts=0;
 for(const width of [320,390,600,768,834,1024,1366,1920]){
  await page.setViewportSize({width,height:width<768?844:900});
  for(const name of ['Overview','Funnels','Paths','Content','Quality']){
   await page.getByRole('tab',{name,exact:true}).click();await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>document.fonts.ready);
   const box=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,h1:parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),sidebar:getComputedStyle(document.querySelector('.admin-sidebar')).position,selected:document.querySelector('[role=tab][aria-selected=true]')?.textContent,panelTop:document.querySelector('[data-tab-panel] h2')?.getBoundingClientRect().top}));
   if(box.scroll>width+1)console.log('OVERFLOW',name,width,await page.evaluate(()=>[...document.querySelectorAll('main *,#admin-view *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,class:el.className,right:el.getBoundingClientRect().right})).slice(0,12)));assert.ok(box.scroll<=width+1,name+' overflow at '+width);assert.ok(box.h1<=32);assert.equal(box.selected,name);if(width>=768)assert.equal(box.sidebar,'fixed');if(width===1366)assert.ok(box.panelTop<(name==='Overview'?720:700),'Actual analysis visible on desktop: '+name+' '+box.panelTop);if(width===390)assert.ok(box.panelTop<(name==='Overview'?850:700),'Actual analysis reachable on mobile: '+name+' '+box.panelTop);layouts++;
   if([390,1366].includes(width)&&['Overview','Funnels','Paths','Content'].includes(name))await page.screenshot({path:path.join(screenshots,'advanced-'+name.toLowerCase()+'-'+width+'.png'),fullPage:true});
  }
  console.log('PASS advanced five views '+width+'px');
 }
 await page.setViewportSize({width:1366,height:900});
 await page.getByRole('button',{name:'Date range and filters',exact:true}).click();
 const colors=await page.getByRole('button',{name:'Apply',exact:true}).evaluate(el=>({text:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));assert.deepEqual(colors,{text:'rgb(255, 255, 255)',bg:'rgb(17, 17, 17)'});await page.keyboard.press('Escape');
 await page.getByRole('tab',{name:'Overview',exact:true}).click();await page.getByRole('tab',{name:'Overview',exact:true}).press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Funnels',exact:true}).getAttribute('aria-selected'),'true');
 await page.getByLabel('Funnel type').selectOption('reading');assert.equal(await page.locator('.ca-step').count(),5);await page.getByLabel('Funnel type').selectOption('discovery');assert.equal(await page.locator('.ca-step').count(),4);
 await page.getByRole('button',{name:'Devices',exact:true}).click();await page.locator('[data-kind=devices][data-segment=mobile]').click();await loaded();assert.equal(await page.locator('select[name=device]').inputValue(),'mobile');assert.ok(new URL(page.url()).searchParams.get('device')==='mobile');
 await page.getByRole('button',{name:'Date range and filters',exact:true}).click();await page.locator('select[name=device]').selectOption('all');await page.getByRole('button',{name:'Apply',exact:true}).click();await loaded();
 await page.getByRole('tab',{name:'Paths',exact:true}).click();assert.ok(await page.locator('.ax-path').count()>0);const forward=await page.locator('.ax-path').first().innerText();assert.ok(forward.startsWith('Feed'));
 await page.getByLabel('Path direction').selectOption('reverse');assert.ok((await page.locator('.ax-path').first().innerText()).startsWith('Story'));
 await page.getByRole('tab',{name:'Content',exact:true}).click();assert.equal(await page.locator('.ax-clock-cell').count(),28);await page.getByLabel('Content ranking').selectOption('completion');await page.locator('[data-story]').first().click();assert.equal(await page.locator('dialog.ax-dialog').evaluate(d=>d.open),true);assert.ok(await page.locator('#ax-detail-title').innerText());await page.keyboard.press('Escape');assert.equal(await page.locator('dialog.ax-dialog').evaluate(d=>d.open),false);
 await page.getByRole('tab',{name:'Overview',exact:true}).click();await page.getByLabel('Trend metric').selectOption('completed');await page.getByLabel('Inspect trend day').fill('0');assert.ok((await page.locator('[data-day-value]').innerText()).includes(firstDate));await page.getByRole('button',{name:'Open selected day'}).click();await loaded();assert.equal(await page.getByLabel('Reading start date').inputValue(),firstDate);assert.equal(await page.getByLabel('Reading end date').inputValue(),firstDate);
 await page.getByRole('button',{name:'More options',exact:true}).click();await page.getByRole('button',{name:'Save view',exact:true}).click();await page.keyboard.press('Escape');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('corner-analytics-views-v2')));assert.ok(Array.isArray(saved)&&saved.length===1);assert.ok(saved[0].includes('advanced=1'));assert.ok(!saved[0].includes('journey_key')&&!saved[0].includes('40'));
 // A tab change cannot apply half-edited filter controls to the report URL.
 await page.getByRole('button',{name:'Date range and filters',exact:true}).click();await page.locator('select[name=source]').selectOption('social');await page.keyboard.press('Escape');await page.getByRole('tab',{name:'Quality',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('src'),'all');
 await page.getByRole('button',{name:'Date range and filters',exact:true}).click();await page.locator('select[name=source]').selectOption('all');await page.keyboard.press('Escape');
 // Repeated mount/unmount must not accumulate document/root event handlers.
 for(let i=0;i<3;i++){await page.locator('[data-admin-view=posts]').click();await page.locator('#new-post').waitFor();await page.locator('[data-admin-view=analytics]').click();await loaded()}
 await page.getByRole('tab',{name:'Overview',exact:true}).click();let fetches=0;const observe=req=>{if(req.url().includes('/api/admin/analytics/reading?'))fetches++};page.on('request',observe);await page.getByRole('tab',{name:'Funnels',exact:true}).click();await page.getByRole('button',{name:'Devices',exact:true}).click();await page.locator('[data-kind=devices][data-segment=mobile]').click();await loaded();assert.equal(fetches,1,'Only one fetch after repeated remount');page.off('request',observe);
 await page.goto(reportURL);await loaded();
 // A late response cannot replace another Studio section, even when the transport completes.
 let release;const barrier=new Promise(r=>release=r);let fetched;const reached=new Promise(r=>fetched=r);
 await page.route('**/api/admin/analytics/reading?**',async route=>{const upstream=await route.fetch();fetched();await barrier;await route.fulfill({response:upstream}).catch(()=>{})});
 await page.getByRole('button',{name:'Refresh',exact:true}).click();await reached;await page.locator('[data-admin-view=posts]').click();release();await page.waitForTimeout(100);assert.ok((await page.locator('#admin-heading').innerText()).startsWith('Posts'));assert.equal(await page.locator('[data-tab-panel]').count(),0);await page.unroute('**/api/admin/analytics/reading?**');
 await page.goto(reportURL);await loaded();assert.equal(await page.getByLabel('Refresh every minute').isChecked(),false);
 await page.clock.install();await page.goto(reportURL);await loaded();await page.bringToFront();let refreshes=0;page.on('request',req=>{if(req.url().includes('/api/admin/analytics/reading?'))refreshes++});await page.getByRole('button',{name:'More options',exact:true}).click();await page.getByLabel('Refresh every minute').check();await page.keyboard.press('Escape');const automatic=page.waitForRequest(req=>req.url().includes('/api/admin/analytics/reading?'));await page.clock.fastForward(60010);await automatic;await loaded();assert.equal(refreshes,1,'Opt-in refresh fires once');
 await page.getByRole('button',{name:'Date range and filters',exact:true}).click();await page.locator('select[name=source]').selectOption('social');await page.keyboard.press('Escape');await page.clock.fastForward(60010);assert.equal(refreshes,1,'Unapplied filter edits prevent automatic refresh');await page.getByRole('button',{name:'More options',exact:true}).click();await page.getByLabel('Refresh every minute').uncheck();await page.keyboard.press('Escape');
 assert.deepEqual(errors,[],'No advanced UI browser exceptions');
 console.log('PASS '+layouts+' advanced layouts; keyboard tabs, both funnels, source attribution, paths, content modal, chart drill, local views, safe refresh, unmount and response race');
 await page.goto(reportURL);await loaded();return layouts;
}
