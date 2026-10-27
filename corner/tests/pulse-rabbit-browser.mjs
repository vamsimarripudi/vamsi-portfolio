/** Isolated interaction fixture; uses exact production JS/CSS with no production data. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const read=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const app=read('app.js'),pulse=read('companion.js'),style=read('companion.css');
const base="*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 12% 0%,#f6dfce,transparent 65%),#faf7f3;color:#26202a;font:16px/1.6 system-ui}header.site-header{margin:0 100px;border-bottom:1px solid #dcd2ca;height:85px;display:flex;align-items:center;justify-content:space-between}header a{font-weight:750;text-decoration:none;color:#211927}header button{width:44px;height:44px;min-height:44px;border:0;border-radius:13px;color:#fff;background:#221d25}.corner-profile-wrap{position:relative;display:flex;gap:8px}.corner-profile-card{position:absolute;right:0;top:55px;width:240px;background:#fff;border:1px solid #ddd;padding:18px;border-radius:16px;z-index:110}.corner-profile-card[hidden]{display:none}.corner-rail{position:fixed;left:16px;top:170px;display:grid;gap:7px;padding:9px;border:1px solid #ded5cb;border-radius:18px;background:#ffffffb8;width:64px;z-index:100}.corner-rail a{display:grid;place-items:center;min-height:44px;font-size:13px;color:#302733;text-decoration:none;border-radius:12px}.corner-rail a:first-child{background:#211b22;color:#fff}.corner-rail-toggle{display:none}main{max-width:760px;margin:45px auto;padding:0 25px;min-height:1000px}h1{font:500 48px/1.1 Georgia;color:#342b32;max-width:600px}h1 em{color:#af6f53}p{max-width:560px}section.story{padding:25px;border:1px solid #e6d8cc;border-radius:20px;background:#fffcf9;margin:24px 0}.hero-cta{display:flex;align-items:center;justify-content:space-between;gap:14px}main a{color:#70452f}footer.site-footer{padding:20px 100px 140px;display:flex;gap:10px}button{cursor:pointer}.actions{display:flex;gap:10px;margin-top:22px}.reactions button,#comment-form button{min-height:44px;padding:10px 14px;border:1px solid #c8bab0;border-radius:13px;background:#fff;color:#30252d}#comment-form{margin-top:40px;padding-top:20px}textarea{width:100%;min-height:95px}.toast-stack{position:fixed;left:12px;bottom:12px}.corner-rail-backdrop{display:none}dialog:not([open]){display:none}html:has(dialog[open]){overflow:hidden}.corner-rail-heading,.corner-rail-foot{display:none}@media(max-width:900px){header.site-header{margin:0 18px;height:74px}.corner-rail{top:auto;bottom:12px;left:12px;right:12px;width:auto;display:grid;grid-template-columns:repeat(6,1fr);padding:8px;height:72px}.corner-rail a{font-size:10px;min-width:0}main{margin:25px auto;min-height:1080px}h1{font-size:34px}section.story{padding:20px}.site-footer{padding:12px 12px 130px!important}.header-now{display:none}}\n";
const html="<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\"><title>Corner Pulse — isolated implementation QA</title></head><body class=\"corner-comfort\"><header class=\"site-header corner-public-header\"><a href=\"/corner/\">VM. &nbsp; Vamsi’s Corner</a><div class=\"corner-profile-wrap\"><button data-search-open aria-label=\"Search\">⌕</button><button data-corner-profile-toggle aria-controls=\"corner-profile-card\" aria-expanded=\"false\" aria-label=\"Profile\">♙</button><div id=\"corner-profile-card\" data-corner-profile-card hidden><div data-profile-member hidden><a href=\"/corner/profile\">My profile</a></div><a href=\"/corner/login\" data-auth-open=\"login\">Sign in</a></div></div></header><button class=\"corner-rail-toggle\" data-corner-rail-toggle aria-expanded=\"false\"></button><nav id=\"corner-rail-nav\" class=\"corner-rail\"><button data-corner-rail-close hidden>Close</button><a href=\"/corner/\">Latest</a><a href=\"/corner/category/wishes\">Wishes</a><a href=\"/corner/category/builds\">Builds</a><a href=\"/corner/category/notes\">Notes</a><a href=\"/corner/category/journal\">Journal</a><a href=\"/corner/category/moments\">Moments</a></nav><div data-corner-rail-backdrop hidden></div><main id=\"content\"><h1>A little bit of life,<br><em>one story at a time.</em></h1><p>Thoughts, things I’m building, learning, feeling and celebrating.</p><div class=\"hero-cta\"><a href=\"#feed\">Explore the stories ↗</a></div><div data-new-updates hidden><button data-apply-updates><span>New story</span></button></div><section id=\"feed\" class=\"story\" data-id=\"p1\"><h2>A small moment worth keeping.</h2><p>This is an isolated browser-test fixture. The new character and welcome dialog use the actual implementation, not an image mockup.</p><div class=\"reactions\" data-post-id=\"p1\"><button data-reaction=\"love\">Love <span>0</span></button><button data-reaction=\"like\">Like <span>0</span></button></div></section><form id=\"comment-form\" data-post-id=\"p1\"><label>Comment<textarea name=\"body\"></textarea></label><button type=\"submit\">Send for review</button></form></main><footer class=\"site-footer\"><div class=\"footer-links\"><a href=\"/corner/privacy\">Privacy</a></div></footer><dialog id=\"search-dialog\"><button data-search-close>Close</button><input id=\"search-input\"><div id=\"search-results\"></div></dialog><div id=\"toast-stack\"></div></body></html>";
const boot="window.__CORNER__={page:'detail',postId:'p1',eventCursor:10};window.__sources=[];window.__fetches=[];window.__fail=false;window.__selected=false;window.EventSource=class extends EventTarget{constructor(url){super();this.url=url;this.closed=false;window.__sources.push(this);setTimeout(()=>this.dispatchEvent(new Event('open')),60)}close(){this.closed=true}emit(type,data){this.dispatchEvent(new MessageEvent(type,{data:JSON.stringify(data),lastEventId:String(data.seq)}))}};window.fetch=async(url,options={})=>{window.__fetches.push({url,method:options.method||'GET'});const json=(data,status=200)=>new Response(JSON.stringify({data}),{status,headers:{'content-type':'application/json'}});if(String(url).includes('/reactions')){if(window.__fail)return new Response(JSON.stringify({error:{message:'Test failure'}}),{status:500});window.__selected=!window.__selected;return json({counts:{love:window.__selected?1:0,like:0},yours:window.__selected?'love':null})}if(String(url).includes('/comments'))return json({state:'pending',message:'Comment awaiting review'});if(String(url).endsWith('/api/status'))return json({status:{label:'Building the little Corner.',detail:'Real response fixture.'}});if(String(url).includes('/api/posts?'))return json([{id:'p1',slug:'small-moment',title:'A small moment worth keeping.'}]);return json({})};";
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
fs.mkdirSync('screenshots/pulse-v2',{recursive:true});
try{
 for(const [width,height] of [[320,640],[390,844],[430,932],[768,1024],[1366,850],[1920,1080]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://pulse.example/**',route=>route.fulfill({status:200,contentType:route.request().url().includes('/mark.svg')?'image/svg+xml':'text/html',headers:{'set-cookie':'corner_reading_consent=deny; Path=/'},body:route.request().url().includes('/mark.svg')?read('mark.svg'):html}));
  await page.goto('https://pulse.example/corner/');
  await page.addStyleTag({content:base+'\n'+style});
  await page.addScriptTag({content:boot});await page.addScriptTag({content:app});await page.addScriptTag({content:pulse});
  const letter=page.locator('.pulse-welcome-modal');
  await letter.waitFor({state:'visible'});
  assert.equal(await letter.evaluate(el=>el.matches(':modal')),true,'Native modal makes background inert');
  const bounds=await letter.boundingBox();
  assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y>=0&&bounds.y+bounds.height<=height+1,'Letter fits viewport');
  for(const selector of ['[data-letter-dismiss]','[data-letter-explore]','[data-letter-join]']){
   const b=await page.locator(selector).boundingBox();assert.ok(b&&b.y+b.height<=height,'Action not clipped '+selector);
  }
  assert.equal(await letter.evaluate(el=>getComputedStyle(el,'::backdrop').backdropFilter),'blur(8px)');
  for(let n=0;n<6;n++){await page.keyboard.press('Tab');assert.equal(await letter.evaluate(el=>el.contains(document.activeElement)),true,'Focus stays in letter');}
  if(width===390||width===1366)await page.screenshot({path:'screenshots/pulse-v2/welcome-'+width+'.png'});
  await page.keyboard.press('Escape');await letter.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('corner-welcome-letter-v2')),'seen');
  await page.locator('[data-corner-profile-toggle]').click();await page.locator('#corner-profile-card .pulse-text-control').click();
  await page.waitForFunction(()=>document.querySelector('[data-orbit-status]').textContent==='Building the little Corner.');
  assert.equal(await page.locator('[data-orbit-story]').getAttribute('href'),'/corner/post/small-moment');
  assert.equal(await page.evaluate(()=>__sources.filter(source=>!source.closed).length),1,'No duplicate live connection');
  await page.locator('[data-pulse-mode="paused"]').click();await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>CornerPulse.snapshot().mode),'paused');
  await page.locator('[data-corner-profile-toggle]').click();await page.locator('#corner-profile-card .pulse-text-control').click();
  await page.locator('[data-pulse-mode="hidden"]').click();
  await page.waitForFunction(()=>!document.querySelector('.pulse-controls').open);
  assert.equal(await page.locator('.pulse-pet').isVisible(),false);
  await page.locator('[data-pulse-restore]').click();await page.locator('[data-pulse-mode="playful"]').click();await page.keyboard.press('Escape');
  await page.evaluate(()=>{scrollTo(0,0);document.activeElement?.blur();});await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>CornerPulse.snapshot().mode),'playful');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  const snapshot=await page.evaluate(()=>CornerPulse.snapshot());
  if(snapshot.visible){
   const collision=await page.locator('.pulse-pet').evaluate(el=>{
    const r=el.getBoundingClientRect();
    return [...document.querySelectorAll('a,button,input,textarea,nav')].filter(t=>!el.contains(t)&&!t.closest('dialog')).some(t=>{
     const b=t.getBoundingClientRect();return b.width&&b.height&&r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;
    });
   });assert.equal(collision,false,'Resting rabbit does not cover actionable controls');
  }
  if(width===390||width===1366)await page.screenshot({path:'screenshots/pulse-v2/rabbit-'+width+'.png'});
  await page.locator('textarea').focus();await page.waitForTimeout(400);
  assert.equal(await page.locator('.pulse-pet').isVisible(),false,'Typing pauses and hides the companion');
  await page.locator('textarea').blur();
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.pulse-eyes').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.deepEqual(errors,[],'No JS errors '+width);
  console.log('PASS Pulse modal, focus, controls, collision, SSE & reduced motion '+width);
  await page.close();
 }
 // Actual locomotion test, with a controlled clock (not just a CSS selector).
 for(const [width,height,expected] of [[390,844,'run'],[1366,850,'walk']]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('https://pulse.example/**',route=>route.fulfill({status:200,contentType:'text/html',headers:{'set-cookie':'corner_reading_consent=deny; Path=/'},body:html}));
  await page.goto('https://pulse.example/corner/');await page.clock.install();
  await page.addStyleTag({content:base+'\n'+style});
  await page.addScriptTag({content:boot+"localStorage.setItem('corner-welcome-letter-v2','seen');Math.random=()=>.5;"});
  await page.addScriptTag({content:app});await page.addScriptTag({content:pulse});
  await page.locator('[data-corner-profile-toggle]').click();await page.locator('#corner-profile-card .pulse-text-control').click();
  await page.locator('[data-pulse-mode="playful"]').click();await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.activeElement===document.querySelector('.corner-orbit-toggle'));
  await page.evaluate(()=>document.activeElement.blur());await page.mouse.move(0,0);
  const poses=[],positions=[];
  for(let i=0;i<30;i++){await page.clock.runFor(1000);const snap=await page.evaluate(()=>CornerPulse.snapshot());poses.push(snap.pose);positions.push(JSON.stringify(snap.position));}
  assert.ok(poses.includes(expected),'Actual '+expected+' gait at '+width+' '+poses.join(','));
  assert.ok(new Set(positions).size>1,'Character actually changes position at '+width);
  await page.locator('[data-corner-profile-toggle]').click();await page.locator('#corner-profile-card .pulse-text-control').click();
  await page.locator('[data-pulse-mode="paused"]').click();await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.activeElement===document.querySelector('.corner-orbit-toggle'));
  const still=await page.evaluate(()=>CornerPulse.snapshot().position);await page.clock.runFor(30000);
  assert.deepEqual(await page.evaluate(()=>CornerPulse.snapshot().position),still,'Pause freezes locomotion');
  await page.close();console.log('PASS actual '+expected+' + Pause '+width);
 }
}finally{await browser.close();}
