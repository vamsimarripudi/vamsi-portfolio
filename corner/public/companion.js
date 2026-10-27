/* Corner Pulse v2: native welcome modal + original SVG rabbit.
 * Owns the shared /api/realtime/stream via corner:realtime; no second socket,
 * AI inference, analytics, typed text, audio, external assets or new storage.
 */
(() => {
  'use strict';
  if(document.querySelector('.admin-shell,.signin-wrap,.account-shell'))return;
  const prefix=location.pathname.startsWith('/corner')?'/corner':'';
  const $=(s,root=document)=>root.querySelector(s);
  const all=(s,root=document)=>[...root.querySelectorAll(s)];
  const rail=$('#corner-rail-nav'),toggle=$('[data-corner-rail-toggle]');
  const profileButton=$('[data-corner-profile-toggle]'),profilePanel=$('[data-corner-profile-card]');
  if(!rail||!profileButton||!profilePanel)return;
  const narrow=matchMedia('(max-width:900px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  // PULSE_SHARED_STREAM_START
  const initial=window.__CORNER__||{},postId=initial.postId;
/* Shared public SSE lifecycle. Feed, detail and Pulse consume one source.
 * seq/cursor + occurredAt prevent old/replayed events from reanimating Pulse.
 * Hidden tabs disconnect; resuming catches up UI without replay celebrations. */
if(window.EventSource&&!initial.demo&&['feed','detail'].includes(initial.page)){
 let stream=null,cursor=Math.max(0,Number(initial.eventCursor)||0),liveAfter=Date.now()-1000;
 const reactionTotals=new Map();
 if(postId&&$('.reactions'))reactionTotals.set(postId,all('.reactions button span').reduce((n,el)=>n+(Number(el.textContent)||0),0));
 const types=['post.published','post.updated','post.archived','status.updated','reaction.updated','comment.created'];
 const signal=state=>document.dispatchEvent(new CustomEvent('corner:live-state',{detail:{state}}));
 function onEvent(event){
  try{
   const data=JSON.parse(event.data),seq=Number(data.seq||event.lastEventId);
   if(!types.includes(data.type)||data.type!==event.type||!Number.isSafeInteger(seq)||seq<=cursor)return;
   cursor=seq;
   const occurred=Date.parse(data.occurredAt),fresh=Number.isFinite(occurred)&&occurred>=liveAfter&&Math.abs(Date.now()-occurred)<20000;
   let increased=false;
   if(data.type==='reaction.updated'){
    const values=Object.values(data.payload?.counts||{}),total=values.reduce((n,v)=>n+(Number.isFinite(v)&&v>=0?v:0),0);
    const previous=reactionTotals.get(data.entityId);increased=previous!==undefined&&total>previous&&!window.CornerPublicLive?.reactionPending();
    reactionTotals.set(data.entityId,total);if(reactionTotals.size>200)reactionTotals.delete(reactionTotals.keys().next().value);
   }
   window.CornerPublicLive?.apply(data);
   // Only safe event metadata goes to the character. No comment body/author.
   document.dispatchEvent(new CustomEvent('corner:realtime',{detail:{id:data.id||String(seq),type:data.type,entityId:data.entityId,fresh,increased,approved:data.type==='comment.created'&&!!data.payload?.commentId}}));
  }catch{/* A malformed event cannot break the page or invent an interaction. */}
 }
 function connect(){
  if(stream||document.hidden)return;
  stream=new EventSource('/corner/api/realtime/stream?since='+encodeURIComponent(cursor));
  types.forEach(type=>stream.addEventListener(type,onEvent));
  stream.addEventListener('open',()=>signal('open'));stream.addEventListener('error',()=>signal('error'));
 }
 function disconnect(){if(stream){stream.close();stream=null;}signal('paused');}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)disconnect();else{liveAfter=Date.now();connect();}});
 window.addEventListener('pagehide',disconnect);
 window.addEventListener('pageshow',event=>{if(event.persisted){liveAfter=Date.now();connect();}});
 connect();
}
  // PULSE_SHARED_STREAM_END


  const backdrop=$('[data-corner-rail-backdrop]'),railClose=$('[data-corner-rail-close]');
  const closeRail=(focus=false)=>{
    rail.classList.remove('is-open');if(backdrop)backdrop.hidden=true;
    toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open navigation');
    document.documentElement.classList.remove('corner-drawer-open');if(focus)toggle?.focus();
  };
  const closeProfile=(focus=false)=>{
    profilePanel.hidden=true;profileButton.setAttribute('aria-expanded','false');
    if(focus)profileButton.focus();
  };
  toggle?.addEventListener('click',()=>{
    if(rail.classList.contains('is-open')){closeRail(true);return;}
    closeProfile();rail.classList.add('is-open');if(backdrop)backdrop.hidden=false;
    toggle.setAttribute('aria-expanded','true');document.documentElement.classList.add('corner-drawer-open');railClose?.focus();
  });
  railClose?.addEventListener('click',()=>closeRail(true));backdrop?.addEventListener('click',()=>closeRail(true));
  rail.addEventListener('click',event=>{if(event.target.closest('a[href]'))closeRail();});
  profileButton.addEventListener('click',()=>{
    const open=profilePanel.hidden;closeRail();profilePanel.hidden=!open;
    profileButton.setAttribute('aria-expanded',String(open));
    if(open)all('a,button',profilePanel).find(el=>!el.hidden&&el.getClientRects().length)?.focus();
  });
  profilePanel.addEventListener('click',event=>{if(event.target.closest('a[href]'))closeProfile();});
  document.addEventListener('pointerdown',event=>{
    if(!profilePanel.hidden&&!profileButton.parentElement.contains(event.target))closeProfile();
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      if(rail.classList.contains('is-open')){event.preventDefault();closeRail(true);}
      else if(!profilePanel.hidden){event.preventDefault();closeProfile(true);}
    }
    if(event.key!=='Tab'||!narrow.matches||!rail.classList.contains('is-open'))return;
    const items=all('a[href],button:not([disabled])',rail).filter(el=>el.getClientRects().length);
    if(!items.length)return;
    if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}
    else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}
  });
  narrow.addEventListener('change',()=>closeRail());

  /* Keep the existing once-per-browser dismissal. The new presentation must
     not force every returning visitor through another introduction. */
  const welcomeKey='corner-welcome-letter-v2';
  const path=location.pathname.replace(/\/$/,'')||'/';
  const welcomeHost=$('.footer-links')||$('.site-footer')||profilePanel;
  const reopen=document.createElement('button');reopen.type='button';reopen.dataset.letterOpen='';
  reopen.className='pulse-text-control';reopen.textContent='Read the welcome letter';welcomeHost.append(reopen);
  let welcome=null,returnFocus=null,memberObserver=null;
  function openWelcome(invoker){
    if(welcome?.open)return;
    closeProfile();closeRail();
    returnFocus=invoker||profileButton;
    const letter=document.createElement('dialog');welcome=letter;
    letter.className='corner-welcome-letter pulse-welcome-modal';
    letter.setAttribute('aria-labelledby','corner-welcome-letter-title');
    letter.innerHTML=`<header class="pulse-letter-header"><img src="${prefix}/mark.svg?v=vm-20261027" width="44" height="44" alt=""><span>A NOTE FROM THE CORNER</span><button type="button" class="corner-letter-close" data-letter-dismiss aria-label="Close welcome letter" autofocus>×</button></header>
      <div class="corner-letter-inner" tabindex="0" aria-label="Welcome letter"><h2 id="corner-welcome-letter-title">A little hello, from me to you.</h2>
      <p>Welcome to Vamsi’s Corner. This is my small place to keep thoughts, projects, celebrations, and memories that are worth sharing.</p>
      <p>There’s no feed to keep up with and no pressure to stay. Explore a story, leave a kind thought, or simply look around whenever you like.</p>
      <p class="corner-letter-signoff">Glad you found your way here.<span>— Vamsi</span></p></div>
      <footer class="corner-letter-actions"><a href="${prefix}/#feed" data-letter-explore>Explore the stories <span aria-hidden="true">↗</span></a><a href="${prefix}/register" data-letter-join>Create profile</a></footer>`;
    const join=$('[data-letter-join]',letter);
    const syncMember=()=>{
      const signed=$('[data-profile-member]')?.hidden===false;
      join.textContent=signed?'My profile':'Create profile';join.href=prefix+(signed?'/profile':'/register');
    };
    syncMember();
    const member=$('[data-profile-member]');
    if(member){memberObserver=new MutationObserver(syncMember);memberObserver.observe(member,{attributes:true,attributeFilter:['hidden']});}
    function dismiss(){
      try{localStorage.setItem(welcomeKey,'seen');}catch{/* Optional persistence. */}
      if(letter.open)letter.close();else letter.remove();
    }
    $('[data-letter-dismiss]',letter).addEventListener('click',dismiss);
    $('[data-letter-explore]',letter).addEventListener('click',dismiss);
    join.addEventListener('click',dismiss);
    letter.addEventListener('click',event=>{
      const r=letter.getBoundingClientRect();
      if(event.target===letter&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dismiss();
    });
    letter.addEventListener('close',()=>{
      try{localStorage.setItem(welcomeKey,'seen');}catch{/* Storage can be disabled. */}
      memberObserver?.disconnect();memberObserver=null;letter.remove();welcome=null;
      document.documentElement.classList.remove('corner-welcome-open');
      if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
      document.dispatchEvent(new CustomEvent('corner:welcome-closed'));
    },{once:true});
    document.body.append(letter);
    // A native modal makes the entire background inert; only the body scrolls.
    if(typeof letter.showModal==='function'){
      document.documentElement.classList.add('corner-welcome-open');letter.showModal();
    }else{
      // Readable inline fallback, not a fake modal without focus containment.
      letter.setAttribute('open','');letter.classList.add('pulse-letter-inline');
      $('[data-letter-dismiss]',letter).addEventListener('click',()=>{
        try{localStorage.setItem(welcomeKey,'seen');}catch{/* Optional persistence. */}
        letter.remove();welcome=null;
      },{once:true});
    }
  }
  reopen.addEventListener('click',()=>openWelcome(reopen));
  let seen=false;
  try{seen=localStorage.getItem(welcomeKey)==='seen';}catch{/* First visit without storage. */}
  if((path==='/corner'||path==='/')&&!seen)openWelcome(profileButton);

  /* Original layered rabbit: independent limbs, ear pivots, head, pupils,
     seated posture and short-lived happy reflections. */
  const rabbit=`<svg class="corner-orbit-toy pulse-rabbit" viewBox="0 0 120 160" aria-hidden="true" focusable="false">
    <defs><linearGradient id="pulse-fur" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffdf6"/><stop offset=".6" stop-color="#f2e9e4"/><stop offset="1" stop-color="#cfc2d7"/></linearGradient><linearGradient id="pulse-ear" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#edbea9"/><stop offset="1" stop-color="#f7dbd0"/></linearGradient></defs>
    <ellipse class="pulse-shadow" cx="60" cy="150" rx="29" ry="5" fill="#4c354d" opacity=".15"/>
    <g class="pulse-body"><circle cx="87" cy="119" r="11" fill="#f7f0ea" stroke="#d7cad4"/>
    <g class="pulse-foot pulse-foot-left"><path d="M39 130 Q24 137 30 145 Q38 151 53 143 L54 131Z" fill="url(#pulse-fur)" stroke="#cbbcc9"/><path d="M34 141l1 4m5-5 1 4" stroke="#bda4b8" stroke-linecap="round"/></g>
    <g class="pulse-foot pulse-foot-right"><path d="M66 131 Q65 145 81 146 Q95 146 88 138 L78 129Z" fill="url(#pulse-fur)" stroke="#cbbcc9"/><path d="M78 141l1 4m5-5 1 4" stroke="#bda4b8" stroke-linecap="round"/></g>
    <ellipse cx="60" cy="114" rx="24" ry="27" fill="url(#pulse-fur)" stroke="#cabfcb" stroke-width="1.3"/><ellipse cx="60" cy="117" rx="15" ry="18" fill="#fffbf3"/>
    <g class="pulse-arm pulse-arm-left"><ellipse cx="34" cy="115" rx="8" ry="17" transform="rotate(18 34 115)" fill="url(#pulse-fur)" stroke="#cabfcb"/></g>
    <g class="pulse-arm pulse-arm-right"><ellipse cx="85" cy="115" rx="8" ry="17" transform="rotate(-18 85 115)" fill="url(#pulse-fur)" stroke="#cabfcb"/></g>
    <g class="pulse-head"><g class="pulse-ear pulse-ear-left"><path d="M36 61 Q18 28 27 10 Q33 0 42 14 Q54 36 49 61Z" fill="url(#pulse-fur)" stroke="#cdbdcb" stroke-width="1.4"/><path d="M37 52 Q27 23 32 16 Q40 13 43 52Z" fill="url(#pulse-ear)"/></g>
    <g class="pulse-ear pulse-ear-right"><path d="M70 60 Q68 27 84 9 Q91 3 96 15 Q99 36 83 65Z" fill="url(#pulse-fur)" stroke="#cdbdcb" stroke-width="1.4"/><path d="M77 53 Q78 28 89 17 Q94 22 82 56Z" fill="url(#pulse-ear)"/></g>
    <path d="M32 59 Q39 47 60 48 Q85 47 93 65 Q101 91 80 102 Q59 112 39 101 Q19 90 26 71Z" fill="url(#pulse-fur)" stroke="#c9bcc9" stroke-width="1.4"/>
    <ellipse cx="35" cy="89" rx="7" ry="4" fill="#eaa797" opacity=".48"/><ellipse cx="85" cy="89" rx="7" ry="4" fill="#eaa797" opacity=".48"/>
    <g class="pulse-eyes"><g class="pulse-pupils"><ellipse cx="46" cy="78" rx="7.6" ry="10" fill="#33243e"/><ellipse cx="75" cy="78" rx="7.6" ry="10" fill="#33243e"/><ellipse cx="44" cy="75" rx="2.7" ry="3.6" fill="#fff"/><ellipse cx="73" cy="75" rx="2.7" ry="3.6" fill="#fff"/><circle cx="49" cy="82" r="1.5" fill="#d9b2df"/><circle cx="78" cy="82" r="1.5" fill="#d9b2df"/></g></g>
    <g class="pulse-glory"><path d="m46 69 2.1 5.5 5.9 2-5.9 2.1L46 85l-2.1-6.4-5.9-2.1 5.9-2Z" fill="#fff6d0"/><path d="m75 69 2.1 5.5 5.9 2-5.9 2.1L75 85l-2.1-6.4-5.9-2.1 5.9-2Z" fill="#fff6d0"/></g>
    <path d="M55 88 Q60 84 65 88 L60 92Z" fill="#b67470"/><path d="M60 92v3m0-1q-5 7-10 0m10 0q5 7 10 0" fill="none" stroke="#84616d" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M48 104q12 5 25-1l-2 6q-12 5-24-1Z" fill="#b77155"/><path d="m70 107 5 11-10-2Z" fill="#c48366"/>
    </g></g></svg>`;
  const dock=document.createElement('div');dock.className='corner-orbit-dock pulse-pet';
  dock.dataset.pose='sit';dock.dataset.mode='calm';
  dock.innerHTML=`<button type="button" class="corner-orbit-toggle" aria-label="Open Corner Pulse, latest stories and live updates" aria-expanded="false" aria-controls="corner-orbit-card" aria-haspopup="dialog">${rabbit}</button><span class="pulse-caption" aria-hidden="true"></span>`;
  const card=document.createElement('dialog');card.id='corner-orbit-card';card.className='corner-orbit-card pulse-controls';
  card.setAttribute('aria-labelledby','corner-orbit-heading');
  card.innerHTML=`<header class="corner-orbit-head"><div><p class="corner-orbit-kicker">YOUR LITTLE CORNER COMPANION</p><h2 id="corner-orbit-heading">Hello, I’m Pulse.</h2></div><button class="corner-orbit-close" type="button" aria-label="Close Corner Pulse">×</button></header>
    <p class="corner-orbit-explainer">No AI chat or invented activity. I react to confirmed Corner events, not your private messages.</p>
    <fieldset class="pulse-mode"><legend>How should I behave?</legend><div><button type="button" data-pulse-mode="calm" aria-pressed="true">Calm</button><button type="button" data-pulse-mode="playful" aria-pressed="false">Playful</button><button type="button" data-pulse-mode="paused" aria-pressed="false">Pause</button><button type="button" data-pulse-mode="hidden" aria-pressed="false">Hide</button></div></fieldset>
    <p class="pulse-preference-note">This page only. Reduced motion always takes priority.</p>
    <div class="corner-orbit-reading"><span class="corner-orbit-status-label">CURRENTLY</span><strong data-orbit-status>Checking the Corner…</strong><p data-orbit-detail></p></div>
    <div class="corner-orbit-latest"><span class="corner-orbit-status-label">LATEST STORY</span><a data-orbit-story hidden></a><p data-orbit-story-empty>Checking published stories…</p></div>
    <p class="corner-orbit-live-line" data-orbit-live role="status">Updates on demand</p>`;
  document.body.append(dock,card);
  // A tiny inline home perch reserves real layout space on crowded phones.
  const perch=document.createElement('span');perch.className='pulse-perch';perch.setAttribute('aria-hidden','true');
  ($('.hero-cta')||$('.feed-heading')||$('.story-bottom')||welcomeHost).append(perch);
  const pet=$('.corner-orbit-toggle',dock),caption=$('.pulse-caption',dock);
  const restore=document.createElement('button');restore.type='button';restore.className='pulse-text-control';restore.textContent='Show Pulse';restore.hidden=true;restore.dataset.pulseRestore='';welcomeHost.append(restore);
  const menuControl=document.createElement('button');menuControl.type='button';menuControl.className='pulse-text-control';menuControl.textContent='Pulse controls';profilePanel.append(menuControl);
  let mode='calm',position=null,motion=null,frame=0,quietUntil=0,lastReaction=-Infinity,layoutTimer=0,idleTimer=0,poseTimer=0;
  let pathToken=0,fetchToken=0,panelController=null,scanning=false,suspended=false;
  const pauseQueries='input,textarea,select,[contenteditable="true"]';
  const protectedSelector='a,button,input,textarea,select,nav,header,footer,h1,h2,h3,p,blockquote,figure,.card-media,[role="alert"],[role="status"]';
  const viewport=()=>{
    const v=window.visualViewport;
    return {x:v?.offsetLeft||0,y:v?.offsetTop||0,w:v?.width||innerWidth,h:v?.height||innerHeight,scale:v?.scale||1};
  };
  function geometry(){
    const v=viewport(),w=narrow.matches?62:76,h=narrow.matches?84:104;
    const bar=rail.getBoundingClientRect();
    const floor=narrow.matches&&bar.width>bar.height?Math.min(v.y+v.h-8,bar.top-10):v.y+v.h-12;
    return {x:v.x+8,y:v.y+8,w,h,maxX:v.x+v.w-w-8,maxY:floor-h};
  }
  const intersects=(a,b)=>a.x<b.right&&a.x+a.w>b.left&&a.y<b.bottom&&a.y+a.h>b.top;
  function obstacles(){
    return all(protectedSelector).filter(el=>!dock.contains(el)&&!card.contains(el)&&!welcome?.contains(el)&&!el.closest('dialog')&&el!==restore&&el!==reopen&&!el.hidden).map(el=>{
      const r=el.getBoundingClientRect();return {left:r.left-5,right:r.right+5,top:r.top-5,bottom:r.bottom+5,visible:r.width>0&&r.height>0};
    }).filter(r=>r.visible&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth);
  }
  function safe(p,g,blocks){
    return p.x>=g.x&&p.y>=g.y&&p.x<=g.maxX&&p.y<=g.maxY&&!blocks.some(b=>intersects({...p,w:g.w,h:g.h},b));
  }
  function clearLine(a,b,g,blocks){
    const steps=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/14);
    for(let i=0;i<=steps;i++){
      const t=steps?i/steps:0;if(!safe({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},g,blocks))return false;
    }
    return true;
  }
  function pockets(g,blocks){
    const points=[];
    for(let x=g.x;x<=g.maxX;x+=38)for(let y=g.y;y<=g.maxY;y+=38)if(safe({x,y},g,blocks))points.push({x,y});
    for(const x of [g.x,g.maxX])for(let y=g.y;y<=g.maxY;y+=28)if(safe({x,y},g,blocks))points.push({x,y});
    for(const x of [g.x,g.maxX])if(safe({x,y:g.maxY},g,blocks))points.push({x,y:g.maxY});
    return points;
  }
  // Bounded visibility-graph BFS: traverses genuinely empty space rather than
  // walking a straight line across text or teleporting through controls.
  function route(a,b,g,blocks){
    if(clearLine(a,b,g,blocks))return [b];
    const cells=pockets(g,blocks),stride=Math.max(1,Math.ceil(cells.length/240));
    const nodes=[a,...cells.filter((_,i)=>i%stride===0),b],end=nodes.length-1;
    const queue=[0],parent=new Map([[0,-1]]);
    for(let q=0;q<queue.length;q++){
      const i=queue[q];
      for(let j=1;j<nodes.length;j++){
        if(parent.has(j)||Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y)>135)continue;
        if(!clearLine(nodes[i],nodes[j],g,blocks))continue;
        parent.set(j,i);if(j===end){const steps=[];for(let k=end;k>0;k=parent.get(k))steps.unshift(nodes[k]);return steps;}
        queue.push(j);
      }
    }
    return [];
  }
  const canAnimate=()=>!pet.matches(':focus-visible')&&!reduced.matches&&mode!=='paused'&&mode!=='hidden'&&!document.hidden;
  const blocked=()=>document.hidden||!!$('dialog[open]')||!profilePanel.hidden||!!document.activeElement?.matches(pauseQueries)||viewport().scale>1.08||viewport().h<innerHeight*.68;
  function pose(value){clearTimeout(poseTimer);dock.dataset.pose=value;}
  function draw(){
    if(!position)return;
    const g=geometry();dock.style.setProperty('--pet-x',position.x+'px');dock.style.setProperty('--pet-y',position.y+'px');
    dock.style.setProperty('--pet-w',g.w+'px');dock.style.setProperty('--pet-h',g.h+'px');
  }
  function stop(){pathToken++;motion=null;caption.textContent='';cancelAnimationFrame(frame);frame=0;pose('sit');}
  function updateLayout(){
    clearTimeout(layoutTimer);if(scanning)return;scanning=true;
    const g=geometry(),blocks=obstacles();
    // Count/toast updates often land immediately after a successful action.
    // Preserve an in-flight walk if its remaining route is still collision-free.
    if(motion&&!blocked()&&position){
      let previous=position;
      const safeRoute=motion.steps.slice(motion.index).every(next=>{
        const clear=clearLine(previous,next,g,blocks);previous=next;return clear;
      });
      if(safeRoute){draw();scanning=false;return;}
      stop();
    }
    dock.dataset.suspended=String(blocked());
    if(mode==='hidden'){dock.hidden=true;restore.hidden=false;scanning=false;return;}
    if(blocked()){stop();dock.hidden=true;scanning=false;return;}
    if(!position||!safe(position,g,blocks)){
      stop();const points=pockets(g,blocks);
      points.sort((a,b)=>Math.hypot(a.x-g.maxX,a.y-g.maxY)-Math.hypot(b.x-g.maxX,b.y-g.maxY));
      const home=perch.getBoundingClientRect(),atHome={x:home.left,y:home.top};
      position=safe(atHome,g,blocks)?atHome:(points[0]||null);
    }
    dock.hidden=!position;restore.hidden=!!position;
    restore.textContent=position?'Show Pulse':'Pulse controls';draw();scanning=false;
  }
  function scheduleLayout(){
    stop();dock.hidden=true;quietUntil=performance.now()+500;
    clearTimeout(layoutTimer);layoutTimer=setTimeout(updateLayout,350);
  }
  function walk(target,done=()=>pose('sit')){
    if(!canAnimate()||blocked()||!position){done();return false;}
    const g=geometry(),blocks=obstacles(),steps=route(position,target,g,blocks);
    if(!steps.length){done();return false;}
    stop();const token=pathToken;
    const run=narrow.matches&&mode==='playful';pose(run?'run':narrow.matches?'hop':'walk');
    dock.dataset.facing=target.x<position.x?'left':'right';
    motion={steps,index:0,last:0};const speed=run?124:narrow.matches?82:68;
    function tick(time){
      if(!motion||token!==pathToken)return;
      if(blocked()||!canAnimate()){stop();return;}
      const next=motion.steps[motion.index],distance=Math.hypot(next.x-position.x,next.y-position.y);
      const dt=Math.min((time-(motion.last||time))/1000,.04);motion.last=time;
      const step=Math.min(distance,speed*dt);
      if(distance){position={x:position.x+(next.x-position.x)*step/distance,y:position.y+(next.y-position.y)*step/distance};draw();}
      if(distance<=1){position={...next};draw();motion.index++;if(motion.index===motion.steps.length){motion=null;frame=0;done();return;}}
      frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);return true;
  }
  function idle(){
    clearTimeout(idleTimer);
    idleTimer=setTimeout(()=>{
      if(canAnimate()&&!blocked()&&performance.now()>quietUntil&&!motion){
        updateLayout();
        if(position){
          const g=geometry(),blocks=obstacles();
          const distance=mode==='playful'?Math.max(viewport().w,viewport().h):145;
          const near=p=>Math.hypot(p.x-position.x,p.y-position.y);
          const candidates=pockets(g,blocks).filter(p=>near(p)>55&&near(p)<distance).sort((a,b)=>near(a)-near(b));
          // Prefer an actually reachable pocket, not a random destination on
          // the far side of a paragraph. Bound the expensive path checks.
          const reachable=candidates.slice(0,160).filter(p=>clearLine(position,p,g,blocks));
          if(reachable.length)walk(reachable[Math.floor(Math.random()*reachable.length)]);
          else for(const candidate of candidates.slice(0,4))if(walk(candidate))break;
        }
      }
      idle();
    },mode==='playful'?9500:26000);
  }
  function celebrate(type,target){
    if(!canAnimate()||blocked()||performance.now()-lastReaction<4200)return;
    lastReaction=performance.now();quietUntil=lastReaction+6500;updateLayout();
    if(!position)return;
    const g=geometry(),blocks=obstacles(),rect=target?.getBoundingClientRect();
    if(rect)dock.style.setProperty('--gaze',rect.left<position.x?'-2px':'2px');
    const react=()=>{
      if(!canAnimate()||blocked())return;
      pose(type==='error'?'curious':type==='comment'?'wave':'happy');
      caption.textContent=type==='comment'?'Sent for review':type==='post'?'A new story':type==='error'?'Please try again':type==='approved'?'New conversation':'Thank you';
      poseTimer=setTimeout(()=>{pose('sit');caption.textContent='';},2600);
    };
    if(rect){
      const center={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      const choices=pockets(g,blocks).filter(p=>Math.hypot(p.x-center.x,p.y-center.y)<210);
      choices.sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y));
      if(choices.length&&Math.hypot(choices[0].x-position.x,choices[0].y-position.y)<Math.max(viewport().h,viewport().w)){
        walk(choices[0],react);return;
      }
    }
    react();
  }
  async function refresh(){
    const token=++fetchToken;panelController?.abort();panelController=new AbortController();
    const timeout=setTimeout(()=>panelController?.abort(),12000);
    const get=async route=>{
      const response=await fetch(prefix+route,{credentials:'same-origin',cache:'no-store',signal:panelController.signal});
      if(!response.ok)throw Error('Not available');return (await response.json()).data;
    };
    const values=await Promise.allSettled([get('/api/status'),get('/api/posts?limit=1')]);clearTimeout(timeout);
    if(token!==fetchToken||!card.open)return;
    const status=values[0],posts=values[1];
    $('[data-orbit-status]',card).textContent=status.status==='fulfilled'?(status.value?.status?.label||'Keeping a little corner alive.'):'Status temporarily unavailable.';
    $('[data-orbit-detail]',card).textContent=status.status==='fulfilled'?(status.value?.status?.detail||'A place for small things worth remembering.'):'Try reopening Pulse.';
    const item=posts.status==='fulfilled'&&Array.isArray(posts.value)?posts.value[0]:null;
    const story=$('[data-orbit-story]',card),empty=$('[data-orbit-story-empty]',card);
    story.hidden=!item?.slug;empty.hidden=!!item?.slug;
    if(item?.slug){story.textContent=item.title||'Latest story';story.href=prefix+'/post/'+encodeURIComponent(item.slug);}
    else empty.textContent=posts.status==='fulfilled'?'No published stories yet.':'Stories temporarily unavailable.';
  }
  function openPanel(){
    stop();closeProfile();pet.setAttribute('aria-expanded','true');dock.dataset.suspended='true';
    if(!card.open)card.showModal();$('[data-orbit-status]',card).textContent='Checking the Corner…';
    void refresh();$('.corner-orbit-close',card).focus();
  }
  pet.addEventListener('pointerdown',stop);pet.addEventListener('pointerenter',()=>{stop();quietUntil=performance.now()+4000;});pet.addEventListener('focus',()=>{stop();quietUntil=performance.now()+10000;});
  pet.addEventListener('click',openPanel);$('.corner-orbit-close',card).addEventListener('click',()=>card.close());
  card.addEventListener('close',()=>{
    fetchToken++;panelController?.abort();pet.setAttribute('aria-expanded','false');quietUntil=performance.now()+5000;
    updateLayout();(dock.hidden?profileButton:pet).focus({preventScroll:true});
  });
  for(const button of all('[data-pulse-mode]',card))button.addEventListener('click',()=>{
    mode=button.dataset.pulseMode;dock.dataset.mode=mode;stop();
    all('[data-pulse-mode]',card).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pulseMode===mode)));
    if(mode==='hidden'){dock.hidden=true;restore.hidden=false;card.close();profileButton.focus({preventScroll:true});}
    idle();
  });
  menuControl.addEventListener('click',openPanel);
  restore.addEventListener('click',()=>{
    if(mode==='hidden'){mode='calm';dock.dataset.mode=mode;all('[data-pulse-mode]',card).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pulseMode===mode)));}
    openPanel();
  });
  document.addEventListener('corner:pulse-action',event=>{
    const d=event.detail;if(!d||!['reaction','comment','error'].includes(d.type))return;
    if(d.type==='reaction'&&!d.active)return;
    celebrate(d.type,d.target instanceof Element?d.target:null);
  });
  const eventIds=new Set();
  document.addEventListener('corner:realtime',event=>{
    const d=event.detail;if(!d?.fresh||!d.id||eventIds.has(d.id))return;
    eventIds.add(d.id);if(eventIds.size>200)eventIds.delete(eventIds.values().next().value);
    if(card.open&&['status.updated','post.published','post.archived'].includes(d.type))void refresh();
    if(d.type==='post.published')celebrate('post',$('[data-new-updates]')||$('#feed'));
    // Aggregate counts celebrate only a verified increase, never the first
    // snapshot or a removal. comment.created is emitted only after moderation.
    const target=all('.story[data-id]').find(el=>el.dataset.id===d.entityId)||
      (window.__CORNER__?.postId===d.entityId?$('.reactions')||$('#comment-form'):null);
    if(target){
      const r=target.getBoundingClientRect();
      if(r.bottom>0&&r.top<innerHeight){
        if(d.type==='reaction.updated'&&d.increased)celebrate('reaction',target);
        if(d.type==='comment.created'&&d.approved)celebrate('approved',target);
      }
    }
  });
  document.addEventListener('corner:live-state',event=>{
    const label=event.detail?.state;
    $('[data-orbit-live]',card).textContent=label==='open'?'Live Corner updates connected':label==='paused'?'Updates paused while away':label==='error'?'Connection interrupted — retrying':'Updates on demand';
  });
  document.addEventListener('corner:welcome-closed',()=>{
    updateLayout();if(canAnimate()&&!dock.hidden){pose('wave');poseTimer=setTimeout(()=>pose('sit'),1800);}
  });
  const observer=new MutationObserver(records=>{
    if(records.every(r=>r.target===dock||r.target===restore||r.target===reopen||dock.contains(r.target)||card.contains(r.target)))return;
    clearTimeout(layoutTimer);layoutTimer=setTimeout(updateLayout,40);
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden','aria-expanded']});
  window.addEventListener('resize',scheduleLayout,{passive:true});window.addEventListener('scroll',scheduleLayout,{passive:true});
  window.visualViewport?.addEventListener('resize',scheduleLayout,{passive:true});window.visualViewport?.addEventListener('scroll',scheduleLayout,{passive:true});
  document.addEventListener('focusin',event=>{if(event.target.matches(pauseQueries))scheduleLayout();});
  document.addEventListener('focusout',event=>{if(event.target.matches(pauseQueries))scheduleLayout();});
  reduced.addEventListener('change',()=>{stop();updateLayout();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){suspended=true;stop();clearTimeout(idleTimer);clearTimeout(layoutTimer);dock.hidden=true;}
    else{suspended=false;quietUntil=performance.now()+2000;updateLayout();idle();}
  });
  window.addEventListener('pagehide',()=>{suspended=true;stop();clearTimeout(idleTimer);clearTimeout(layoutTimer);panelController?.abort();observer.disconnect();});
  window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden','aria-expanded']});updateLayout();idle();}});
  // Read-only inspection for deterministic QA; cannot manufacture server events.
  window.CornerPulse=Object.freeze({snapshot:()=>({mode,pose:dock.dataset.pose,moving:!!motion,position:position?{...position}:null,visible:!dock.hidden,reduced:reduced.matches,suspended}),open:openPanel});
  updateLayout();idle();
})();
