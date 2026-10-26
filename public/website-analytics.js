import {websitePath,CONSENT_COOKIE,SECTIONS} from './site-analytics-contract.mjs';
// Runs on public website routes only; no raw page URL, input contents or identity is sent.
const ENDPOINT='/api/website/events',KEY='vm_site_journey_v1';
const cookies=()=>Object.fromEntries(document.cookie.split(';').map(p=>{const i=p.indexOf('=');return [p.slice(0,i).trim(),p.slice(i+1).trim()]}));
const privacyBlocked=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.doNotTrack==='1';
const permitted=()=>cookies()[CONSENT_COOKIE]==='allow'&&!privacyBlocked()&&!cookies().vm_track_session&&!cookies().corner_session;
const allowedHost=()=>['vamsimarripudi.me','www.vamsimarripudi.me','localhost','127.0.0.1'].includes(location.hostname);
const token=()=>crypto.randomUUID().replaceAll('-','');
let current=null,rawPath='',timer=null,lastTick=0,lastAction=0,lastSend=0,lastDepth=-1,engaged=false,panel=null,contactStarted=false,consentCard=null;
const source=()=>{try{if(!document.referrer)return 'direct';const host=new URL(document.referrer).hostname;if(host===location.hostname)return 'internal';if(/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/.test(host))return 'search';if(/(^|\.)(facebook\.com|instagram\.com|linkedin\.com|t\.co|x\.com|reddit\.com)$/.test(host))return 'social';return 'referral'}catch{return 'direct'}};
function stateUI(message){if(!panel)return;panel.querySelector('[data-site-choice]').textContent=permitted()?'On':'Off';panel.querySelector('[data-site-allow]').disabled=privacyBlocked();if(message)panel.querySelector('[role=status]').textContent=message;if(privacyBlocked())panel.querySelector('[role=status]').textContent='Your browser privacy signal keeps website analytics off.'}
function post(body,method='POST'){return fetch(ENDPOINT,{method,credentials:'same-origin',cache:'no-store',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(async response=>{const result=await response.json().catch(()=>({}));return response.ok&&result.ok===true&&result.accepted===true}).catch(()=>false)}
function send(action='',issue=''){
 if(!current||!permitted()||!websitePath(location.pathname))return Promise.resolve(false);
 const {created,...payload}=current;void created;
 lastSend=Date.now();lastDepth=current.depth;
 try{sessionStorage.setItem(KEY,JSON.stringify({id:current.journey,created:current.created,seen:lastSend,device:current.device,source:current.source}))}catch{/* no durable tab state; current page still works */}
 return post({...payload,action,issue});
}
function choicePrompt(){
 const cookie=cookies();
 const eligible=websitePath(location.pathname)&&!location.pathname.startsWith('/corner')&&allowedHost()&&!privacyBlocked()&&!cookie.vm_track_session&&!cookie.corner_session;
 const decided=cookie[CONSENT_COOKIE]==='allow'||cookie[CONSENT_COOKIE]==='deny';
 let deferred=false;try{deferred=sessionStorage.getItem('vm_site_consent_deferred')==='1'}catch{/* Optional session hint only. */}
 if(!eligible||decided||deferred){consentCard?.remove();consentCard=null;return}
 if(consentCard?.isConnected)return;
 const style='website-analytics.css';
 if(!document.querySelector('link[data-site-preferences-style]')){
   const link=document.createElement('link');link.rel='stylesheet';link.href='/'+style;link.dataset.sitePreferencesStyle='';document.head.append(link);
 }
 const card=document.createElement('aside');
 card.className='website-analytics-consent';
 card.setAttribute('aria-label','Optional website analytics preference');
 card.innerHTML='<p class="site-consent-kicker">YOUR PRIVACY, YOUR CHOICE</p>'+
  '<h2>Help improve this website?</h2>'+
  '<p>Allow optional first-party page and reading signals. No personal profiles, typed text, advertising trackers or Google transmission.</p>'+
  '<div class="site-consent-actions"><button type="button" data-consent-allow>Allow analytics</button><button type="button" data-consent-deny>Keep off</button></div>'+
  '<div class="site-consent-foot"><a href="/privacy">Read privacy details</a><button type="button" data-consent-later>Not now</button></div>';
 const end=()=>{card.remove();if(consentCard===card)consentCard=null};
 card.querySelector('[data-consent-allow]').addEventListener('click',()=>{end();void choose('allow')});
 card.querySelector('[data-consent-deny]').addEventListener('click',()=>{end();void choose('deny')});
 card.querySelector('[data-consent-later]').addEventListener('click',()=>{try{sessionStorage.setItem('vm_site_consent_deferred','1')}catch{/* Non-persistent fallback is fine. */}end()});
 document.body.append(card);consentCard=card;
}
function stop(){clearInterval(timer);timer=null;current=null;rawPath='';contactStarted=false}
function measure(){
 if(!current)return;const main=document.querySelector('main');if(!main)return;const r=main.getBoundingClientRect();
 const progress=r.height>0?Math.max(0,Math.min(100,(innerHeight-r.top)/r.height*100)):0;current.depth=Math.max(current.depth,...[0,25,50,75,90].filter(n=>progress>=n));
 for(const el of document.querySelectorAll('[data-site-section]')){const b=el.getBoundingClientRect();if(b.top<innerHeight*.65&&b.bottom>0&&SECTIONS.includes(el.dataset.siteSection))current.section=el.dataset.siteSection}
}
function tick(){
 if(!current)return;if(!permitted()){stop();stateUI();return}
 const now=Date.now(),delta=Math.max(0,Math.min(1500,now-lastTick));lastTick=now;
 if(document.hidden||now-lastAction>30000)return;
 current.activeMs=Math.min(1800000,current.activeMs+Math.round(delta));measure();
 if((!engaged&&current.activeMs>=10000)||(current.depth>lastDepth&&current.activeMs>=10000)||now-lastSend>=30000){engaged=current.activeMs>=10000;send()}
}
export function route(){
 const path=websitePath(location.pathname);if(!path||!allowedHost()){if(current)send();stop();panel?.remove();panel=null;consentCard?.remove();consentCard=null;return}
 const slot=document.querySelector('[data-website-preferences]');
 if(slot&&(!panel||!panel.isConnected)){
  panel=document.createElement('details');panel.className='website-preferences';panel.id='website-analytics-preferences';
  panel.innerHTML='<summary>Website analytics <span data-site-choice>Off</span></summary><p>Allow optional analytics for vamsimarripudi.me: public pages, broad source/device groups, reading depth, active time and contact-flow success or failure. No names, form text, full URLs, advertising or Google transmission.</p><p>Short-lived tab IDs group visits across public pages. Records expire after 90 days. Turning this off also requests deletion of the current tab journey. Corner reading preferences are separate.</p><div><button type="button" data-site-allow>Allow website analytics</button><button type="button" data-site-deny>Keep website analytics off</button></div><p role="status"></p>';
  slot.append(panel);panel.querySelector('[data-site-allow]').onclick=()=>choose('allow');panel.querySelector('[data-site-deny]').onclick=()=>choose('deny');
  if(!document.querySelector('link[data-site-preferences-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/website-analytics.css';css.dataset.sitePreferencesStyle='';document.head.append(css)}
 }
 stateUI();choicePrompt();if(!permitted()||!crypto.randomUUID)return;
 if(current&&rawPath===location.pathname)return;
 if(current)send();stop();let journey;
 try{journey=JSON.parse(sessionStorage.getItem(KEY)||'null');if(!journey||typeof journey.id!=='string'||!/^[a-f0-9]{32}$/.test(journey.id)||Date.now()-journey.seen>=1800000||Date.now()-journey.created>=86400000)journey=null}catch{journey=null/* No session storage in this browser; measure this page in memory only. */}
 journey ||= {id:token(),created:Date.now(),device:innerWidth<768?'mobile':innerWidth<1024?'tablet':'desktop',source:source()};
 current={v:1,view:token(),journey:journey.id,created:journey.created,path,device:journey.device,source:journey.source,depth:0,activeMs:0,section:'main'};rawPath=location.pathname;lastTick=lastAction=Date.now();lastDepth=-1;engaged=false;send();timer=setInterval(tick,1000);
}
async function choose(choice){
 let journey=current?.journey;try{journey ||= JSON.parse(sessionStorage.getItem(KEY)||'null')?.id||sessionStorage.getItem('vm_site_pending_delete')}catch{/* no prior state */}
 document.cookie=CONSENT_COOKIE+'='+choice+'; Path=/; Max-Age=15552000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
 consentCard?.remove();consentCard=null;
 if(choice==='allow'){route();stateUI('Website analytics is allowed. You can turn it off here at any time.');return}
 stop();try{sessionStorage.removeItem(KEY)}catch{/* optional storage */}stateUI('Website analytics is off.');
 if(journey){const deleted=await post({journey},'DELETE');if(deleted){try{sessionStorage.removeItem('vm_site_pending_delete')}catch{/* Storage is optional. */}}stateUI(deleted?'Off. The current tab journey was removed; older tab journeys follow retention.':'Off. Deletion could not be confirmed; retry Keep website analytics off while online.');if(!deleted){try{sessionStorage.setItem('vm_site_pending_delete',journey)}catch{/* report limitation shown */}}}
}
function activity(){if(current&&Date.now()-lastAction>=1800000){send();stop();route()}lastAction=Date.now()}
for(const name of ['pointerdown','scroll','keydown','touchstart'])addEventListener(name,activity,{passive:true});
addEventListener('vm:site-route',route);addEventListener('popstate',()=>queueMicrotask(route));
addEventListener('pagehide',()=>{send();stop()});addEventListener('pageshow',event=>{if(event.persisted)route()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)send();else{lastTick=Date.now();activity();route()}});
document.addEventListener('focusin',event=>{if(!current||current.path!=='/contact'||contactStarted||!event.target.closest('[data-site-contact]'))return;contactStarted=true;send('contact_start')});
document.addEventListener('vm:site-action',event=>{if(!current)return;if(['contact_success','contact_failed'].includes(event.detail)&&current.path==='/contact')send(event.detail,event.detail==='contact_failed'?'request_failed':'')});
document.addEventListener('click',event=>{if(!current)return;const a=event.target.closest('a');if(!a)return;try{const u=new URL(a.href,location.origin);if(a.hasAttribute('download')&&u.origin===location.origin&&u.pathname.endsWith('.pdf'))send('resume_click');else if(['github.com','www.linkedin.com','x.com'].includes(u.hostname))send('profile_click')}catch{/* no URL is persisted */}});
document.addEventListener('error',event=>{if(current&&['IMG','VIDEO'].includes(event.target?.tagName))send('','media_failed')},true);
window.VMWebsiteAnalytics={route,leave:()=>{send();stop();panel?.remove();panel=null}};
route();
