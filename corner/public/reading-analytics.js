/* Optional first-party reading observations. No Google tag, content capture or user profile. */
(()=>{
 'use strict';
 const initial=window.__CORNER__||{},prefix=location.pathname.startsWith('/corner')?'/corner':'',endpoint=prefix+'/api/analytics/reading';
 if(location.pathname.startsWith(prefix+'/admin')||initial.demo)return;
 const eligible=['feed','detail'].includes(initial.page),body=document.querySelector('.post-body');
 const consent=()=>document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('corner_reading_consent='))?.split('=')[1]||'';
 const blocked=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.doNotTrack==='1';
 const allowed=()=>consent()==='allow'&&!blocked();
 const key='corner-reading-journey-v1',uuid=()=>crypto.randomUUID().replaceAll('-','');
 let state=null,interval=null,lastTick=0,lastActivity=Date.now(),lastSent=0,lastDepth=0;
 const source=()=>{try{if(!document.referrer)return'direct';const host=new URL(document.referrer).hostname;if(host===location.hostname)return'internal';if(/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/.test(host))return'search';if(/(^|\.)(facebook\.com|instagram\.com|linkedin\.com|t\.co|x\.com|reddit\.com)$/.test(host))return'social';return'referral'}catch{return'direct'}};
 const touch=()=>{if(!state)return;try{sessionStorage.setItem(key,JSON.stringify({id:state.journey,created:state.created,device:state.device,seen:Date.now()}))}catch{stop()}};
 function start(force=false){
  if(!eligible||!allowed()||!crypto.randomUUID||(!force&&state))return;
  stop();let journey;
  try{journey=JSON.parse(sessionStorage.getItem(key)||'null');if(!journey||!(/^[a-f0-9]{32}$/).test(journey.id)||Date.now()-journey.seen>1800000||Date.now()-journey.created>86400000)journey={id:uuid(),created:Date.now()};sessionStorage.setItem(key,JSON.stringify({...journey,seen:Date.now()}))}catch{return}
  state={v:1,view:uuid(),journey:journey.id,created:journey.created,page:initial.page==='detail'?'story':'feed',post:initial.page==='detail'?initial.postId:null,device:journey.device||(innerWidth<768?'mobile':innerWidth<1024?'tablet':'desktop'),source:source(),depth:0,activeMs:0,reason:''};
  lastTick=lastActivity=Date.now();lastSent=0;lastDepth=0;send();interval=setInterval(tick,1000);updateUI();
 }
 function stop(){clearInterval(interval);interval=null;state=null}
 function measure(){
  if(!state||state.page!=='story'||!body)return;
  const rect=body.getBoundingClientRect();if(rect.height<=0)return;
  const percent=Math.max(0,Math.min(100,(innerHeight-rect.top)/rect.height*100));
  state.depth=Math.max(state.depth,...[0,25,50,75,90].filter(n=>percent>=n));
 }
 function send(action='',issue=''){
  if(!state||!allowed()){if(state)stop();return}
  const {created,...payload}=state;void created;
  fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},cache:'no-store',keepalive:true,body:JSON.stringify({...payload,action,issue})}).catch(()=>{});
  lastSent=Date.now();lastDepth=state.depth;touch();
 }
 function tick(){
  if(!allowed()){stop();updateUI();return}
  const at=Date.now(),delta=Math.max(0,Math.min(1500,at-lastTick));lastTick=at;
  if(document.visibilityState!=='visible'||at-lastActivity>30000)return;
  state.activeMs=Math.min(1800000,Math.round(state.activeMs+delta));measure();
  if((state.depth>lastDepth&&state.activeMs>=10000)||at-lastSent>=15000)send();
 }
 function activity(){const now=Date.now();if(state&&now-lastActivity>1800000)start(true);lastActivity=now}
 for(const event of ['pointerdown','scroll','keydown','touchstart'])addEventListener(event,activity,{passive:true});
 addEventListener('scroll',()=>{if(state&&document.visibilityState==='visible'){measure();if(state.activeMs>=10000&&state.depth>lastDepth)send()}},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(state){if(document.visibilityState==='hidden')send();else{lastTick=Date.now();activity()}}});
 addEventListener('pagehide',()=>{if(state)send();stop()});addEventListener('pageshow',event=>{if(event.persisted)start()});
 document.addEventListener('click',event=>{if(state?.page==='feed'&&event.target.closest('a[href*="/post/"]'))send('story_click')});
 document.addEventListener('corner:reading-action',event=>{if(!state)return;const action=event.detail;if(['react','share','comment_success'].includes(action)&&state.page==='story')send(action);else if(action==='request_failed')send('','request_failed')});
 document.querySelector('#comment-form')?.addEventListener('focusin',()=>{if(state?.page==='story')send('comment_start')},{once:true});
 document.addEventListener('error',event=>{if(state&&['IMG','VIDEO'].includes(event.target?.tagName)&&!event.target.closest('.admin-shell'))send('','media_failed')},true);
 const panel=document.createElement('details');panel.className='reading-preferences';panel.id='reading-preferences';
 panel.innerHTML='<summary>Reading analytics <span data-reading-choice>Off</span></summary><p>Help improve the Corner with optional reading depth, visible active time and broad interaction signals. No typed text, screen recordings or visitor profiles. Nothing is sent to Google.</p><p>Short-lived tab identifiers group a reading journey. Raw observations expire after 90 days; reports with fewer than five observations are withheld.</p><div class="reading-choice-actions"><button type="button" data-reading-allow>Allow reading analytics</button><button type="button" data-reading-deny>Keep reading analytics off</button></div><p role="status" data-reading-status></p>';
 const footer=document.querySelector('.site-footer');if(footer)footer.before(panel);else document.querySelector('main')?.append(panel);
 function updateUI(){
  panel.querySelector('[data-reading-choice]').textContent=allowed()?'On':'Off';
  panel.querySelector('[data-reading-allow]').disabled=blocked();
  if(blocked())panel.querySelector('[data-reading-status]').textContent='Your browser privacy preference keeps analytics off.';
  document.querySelector('[data-reading-feedback]')?.toggleAttribute('hidden',!allowed());
 }
 const choice=async value=>{
  let journey=state?.journey;try{journey||=JSON.parse(sessionStorage.getItem(key)||'null')?.id}catch{/* no prior tab storage */}
  document.cookie='corner_reading_consent='+value+'; Path='+(prefix||'/')+'; Max-Age=15552000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
  if(value==='allow'){start();panel.querySelector('[data-reading-status]').textContent=allowed()?'Reading analytics is on for this browser. You can turn it off here at any time.':'Analytics remains off.'}
  else{stop();try{sessionStorage.removeItem(key)}catch{/* no storage */}if(journey)await fetch(endpoint,{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({journey})}).catch(()=>{});panel.querySelector('[data-reading-status]').textContent='Reading analytics is off. Deletion of the current tab journey was requested; older expired tab journeys follow the 90-day lifecycle.'}
  updateUI();
 };
 panel.querySelector('[data-reading-allow]').onclick=()=>choice('allow');panel.querySelector('[data-reading-deny]').onclick=()=>choice('deny');
 if(eligible&&initial.page==='detail'&&body){
  const feedback=document.createElement('details');feedback.className='reading-preferences reading-feedback';feedback.dataset.readingFeedback='';feedback.hidden=!allowed();
  feedback.innerHTML='<summary>Optional: how was this read?</summary><label>What best describes your experience?<select aria-label="Reading experience"><option value="">Choose a reason</option><option value="finished">Finished what I needed</option><option value="return_later">I will return later</option><option value="not_relevant">Not relevant to me</option><option value="too_long">Too long</option><option value="hard_to_read">Hard to read</option><option value="slow_or_broken">Slow or broken</option><option value="other">Other</option></select></label><button type="button">Send optional feedback</button><p role="status"></p>';
  body.after(feedback);feedback.querySelector('button').onclick=()=>{const reason=feedback.querySelector('select').value;if(!state||!reason)return;state.reason=reason;send();feedback.querySelector('[role=status]').textContent='Feedback queued. Thank you.'};
 }
 updateUI();start();
})();
