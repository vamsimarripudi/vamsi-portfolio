/* Corner Pulse v3: Doraemon motion, purposeful interactions, opt-in local SFX.
 * One public event stream. No AI inference, private-text analysis, external
 * artwork/audio downloads, tracking, microphone, or new browser storage.
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
  /* Retained public SSE lifecycle: never replay celebrations or expose text. */
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
        document.dispatchEvent(new CustomEvent('corner:realtime',{detail:{id:data.id||String(seq),type:data.type,entityId:data.entityId,fresh,increased,approved:data.type==='comment.created'&&!!data.payload?.commentId}}));
      }catch{/* Invalid or private events must never affect the character. */}
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
    profilePanel.hidden=true;profileButton.setAttribute('aria-expanded','false');if(focus)profileButton.focus();
  };
  toggle?.addEventListener('click',()=>{
    if(rail.classList.contains('is-open')){closeRail(true);return;}
    closeProfile();rail.classList.add('is-open');if(backdrop)backdrop.hidden=false;
    toggle.setAttribute('aria-expanded','true');document.documentElement.classList.add('corner-drawer-open');railClose?.focus();
  });
  railClose?.addEventListener('click',()=>closeRail(true));backdrop?.addEventListener('click',()=>closeRail(true));
  rail.addEventListener('click',event=>{if(event.target.closest('a[href]'))closeRail();});
  profileButton.addEventListener('click',()=>{
    const open=profilePanel.hidden;closeRail();profilePanel.hidden=!open;profileButton.setAttribute('aria-expanded',String(open));
    if(open)all('a,button',profilePanel).find(el=>!el.hidden&&el.getClientRects().length)?.focus();
  });
  profilePanel.addEventListener('click',event=>{if(event.target.closest('a[href]'))closeProfile();});
  document.addEventListener('pointerdown',event=>{if(!profilePanel.hidden&&!profileButton.parentElement.contains(event.target))closeProfile();},{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      if(rail.classList.contains('is-open')){event.preventDefault();closeRail(true);}
      else if(!profilePanel.hidden){event.preventDefault();closeProfile(true);}
    }
    if(event.key!=='Tab'||!narrow.matches||!rail.classList.contains('is-open'))return;
    const items=all('a[href],button:not([disabled])',rail).filter(el=>el.getClientRects().length);if(!items.length)return;
    if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}
    else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}
  });
  narrow.addEventListener('change',()=>closeRail());
  const welcomeKey='corner-welcome-letter-v2';
  const path=location.pathname.replace(/\/$/,'')||'/';
  const welcomeHost=$('.footer-links')||$('.site-footer')||profilePanel;
  const reopen=document.createElement('button');reopen.type='button';reopen.dataset.letterOpen='';
  reopen.className='pulse-text-control';reopen.textContent='Read the welcome letter';welcomeHost.append(reopen);
  let welcome=null,returnFocus=null,memberObserver=null;
  function openWelcome(invoker){
    if(welcome?.open)return;closeProfile();closeRail();returnFocus=invoker||profileButton;
    const letter=document.createElement('dialog');welcome=letter;
    letter.className='corner-welcome-letter pulse-welcome-modal';letter.setAttribute('aria-labelledby','corner-welcome-letter-title');
    letter.innerHTML=`<header class="pulse-letter-header"><img src="${prefix}/mark.svg?v=vm-20261027" width="44" height="44" alt=""><span>A NOTE FROM THE CORNER</span><button type="button" class="corner-letter-close" data-letter-dismiss aria-label="Close welcome letter" autofocus>×</button></header><div class="corner-letter-inner" tabindex="0" aria-label="Welcome letter"><h2 id="corner-welcome-letter-title">A little hello, from me to you.</h2><p>Welcome to Vamsi’s Corner. This is my small place to keep thoughts, projects, celebrations, and memories that are worth sharing.</p><p>There’s no feed to keep up with and no pressure to stay. Explore a story, leave a kind thought, or simply look around whenever you like.</p><p class="corner-letter-signoff">Glad you found your way here.<span>— Vamsi</span></p></div><footer class="corner-letter-actions"><a href="${prefix}/#feed" data-letter-explore>Explore the stories <span aria-hidden="true">↗</span></a><a href="${prefix}/register" data-letter-join>Create profile</a></footer>`;
    const join=$('[data-letter-join]',letter),member=$('[data-profile-member]');
    const syncMember=()=>{const signed=member?.hidden===false;join.textContent=signed?'My profile':'Create profile';join.href=prefix+(signed?'/profile':'/register');};
    syncMember();if(member){memberObserver=new MutationObserver(syncMember);memberObserver.observe(member,{attributes:true,attributeFilter:['hidden']});}
    const dismiss=()=>{try{localStorage.setItem(welcomeKey,'seen');}catch{/* Optional browser capability; the page remains usable. */}if(letter.open)letter.close();else letter.remove();};
    $('[data-letter-dismiss]',letter).addEventListener('click',dismiss);$('[data-letter-explore]',letter).addEventListener('click',dismiss);join.addEventListener('click',dismiss);
    letter.addEventListener('click',event=>{const r=letter.getBoundingClientRect();if(event.target===letter&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dismiss();});
    letter.addEventListener('close',()=>{try{localStorage.setItem(welcomeKey,'seen');}catch{/* Optional browser capability; the page remains usable. */}memberObserver?.disconnect();memberObserver=null;letter.remove();welcome=null;document.documentElement.classList.remove('corner-welcome-open');if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});document.dispatchEvent(new CustomEvent('corner:welcome-closed'));},{once:true});
    document.body.append(letter);
    if(typeof letter.showModal==='function'){document.documentElement.classList.add('corner-welcome-open');letter.showModal();}
    else{letter.setAttribute('open','');letter.classList.add('pulse-letter-inline');$('[data-letter-dismiss]',letter).addEventListener('click',()=>{letter.remove();welcome=null;},{once:true});}
  }
  reopen.addEventListener('click',()=>openWelcome(reopen));
  let seen=false;try{seen=localStorage.getItem(welcomeKey)==='seen';}catch{/* Optional browser capability; the page remains usable. */}
  if((path==='/corner'||path==='/')&&!seen)openWelcome(profileButton);

  // Newly drawn articulated Doraemon artwork; no third-party image/voice files.
  // Rights clearance is a release review item, not implied by this implementation.
  const art=`<svg class="corner-orbit-toy pulse-doraemon" viewBox="0 0 120 144" aria-hidden="true" focusable="false">
    <defs><linearGradient id="pulse-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#24b7ed"/><stop offset=".5" stop-color="#0796d0"/><stop offset="1" stop-color="#087bb3"/></linearGradient><linearGradient id="pulse-white" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#e6f4f8"/></linearGradient><radialGradient id="pulse-bell"><stop stop-color="#ffe98a"/><stop offset="1" stop-color="#edb93a"/></radialGradient></defs>
    <ellipse class="pulse-shadow" cx="60" cy="137" rx="33" ry="4.5" fill="#173e54" opacity=".17"/>
    <g class="pulse-body" stroke="#183b50" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">
      <path d="M85 116q12-1 15-8" fill="none"/><circle cx="102" cy="106" r="5.5" fill="#e84a4d"/>
      <g class="pulse-foot pulse-foot-left"><path d="M35 123q-10 4-8 10q2 6 23 3q9-2 4-11Z" fill="url(#pulse-white)"/></g>
      <g class="pulse-foot pulse-foot-right"><path d="M66 125q-5 10 8 11q20 3 22-3q2-7-10-10Z" fill="url(#pulse-white)"/></g>
      <path d="M34 87q-5 13-4 29q1 13 21 13h8v-7h4v7h13q15-1 15-14q1-18-7-28Z" fill="url(#pulse-blue)"/>
      <g class="pulse-arm pulse-arm-left"><path d="M34 91q-12 4-14 18q1 9 9 10l10-15" fill="url(#pulse-blue)"/><circle cx="23" cy="115" r="9.3" fill="url(#pulse-white)"/></g>
      <g class="pulse-arm pulse-arm-right"><path d="M85 91q12 4 15 18q-1 9-10 10l-10-15" fill="url(#pulse-blue)"/><circle cx="96" cy="115" r="9.3" fill="url(#pulse-white)"/></g>
      <ellipse cx="60" cy="108" rx="22.5" ry="21" fill="url(#pulse-white)"/>
      <path class="pulse-pocket" d="M44 108h32q-1 15-16 15q-15 0-16-15Z" fill="#fff"/>
      <g class="pulse-head"><ellipse cx="60" cy="49" rx="44" ry="43" fill="url(#pulse-blue)"/>
        <path d="M27 25q12-15 27-15" stroke="#75d8f5" opacity=".65" fill="none" stroke-width="2.2"/>
        <ellipse cx="60" cy="60" rx="36" ry="32" fill="url(#pulse-white)"/>
        <g class="pulse-eyes"><ellipse cx="51" cy="39" rx="10" ry="13" fill="#fff"/><ellipse cx="70" cy="39" rx="10" ry="13" fill="#fff"/>
          <g class="pulse-pupils" stroke="none"><ellipse cx="55" cy="41" rx="3.1" ry="5" fill="#172f3d"/><ellipse cx="66" cy="41" rx="3.1" ry="5" fill="#172f3d"/><ellipse cx="54.2" cy="39.5" rx="1" ry="1.4" fill="#fff"/><ellipse cx="65.2" cy="39.5" rx="1" ry="1.4" fill="#fff"/></g></g>
        <g class="pulse-glory" stroke="#e6af34" stroke-width=".5"><path d="m51 31 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#fff3a8"/><path d="m70 31 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#fff3a8"/></g>
        <circle cx="60" cy="53" r="7" fill="#e94848"/><circle cx="58" cy="51" r="2.1" fill="#fff" stroke="none"/>
        <path d="M60 60v14" fill="none"/><g class="pulse-whiskers" fill="none"><path d="m27 55 15 5m-18 6 18 1m-16 11 16-4M94 55l-15 5m18 6-18 1m16 11-16-4"/></g>
        <path class="pulse-mouth" d="M34 73q26 27 52 0" fill="#fff"/><path class="pulse-smile" d="M35 73q25 30 50 0q-5 23-25 23q-20 0-25-23Z" fill="#a53541"/><path class="pulse-tongue" d="M48 91q12-10 24 0q-12 8-24 0" fill="#ed8780" stroke="none"/>
        <ellipse cx="31" cy="73" rx="4.5" ry="2.4" fill="#f1aaa0" stroke="none" opacity=".5"/><ellipse cx="89" cy="73" rx="4.5" ry="2.4" fill="#f1aaa0" stroke="none" opacity=".5"/>
      </g>
      <path d="M34 88q26 7 52 0v6q-26 6-52 0Z" fill="#e84246"/>
      <g class="pulse-bell"><circle cx="60" cy="97" r="7.5" fill="url(#pulse-bell)"/><path d="M53 94h14m-13 2h12" stroke-width="1"/><circle cx="60" cy="99" r="1.8" fill="#704823" stroke="none"/><path d="M60 101v3"/></g>
    </g></svg>`;
  const stage=document.createElement('div');stage.className='pulse-stage';
  const dock=document.createElement('div');dock.className='corner-orbit-dock pulse-pet';dock.dataset.pose='sit';dock.dataset.mode='calm';
  dock.innerHTML=`<button type="button" class="corner-orbit-toggle" aria-label="Open Corner Pulse, latest stories and live updates" aria-haspopup="dialog" aria-expanded="false" aria-controls="corner-orbit-card">${art}</button><span class="pulse-caption" aria-hidden="true"></span>`;
  stage.append(dock);
  const pet=$('.corner-orbit-toggle',dock),caption=$('.pulse-caption',dock);
  const card=document.createElement('dialog');card.id='corner-orbit-card';card.className='corner-orbit-card pulse-controls';card.setAttribute('aria-labelledby','corner-orbit-heading');
  card.innerHTML=`<header class="corner-orbit-head"><div><p class="corner-orbit-kicker">YOUR CORNER COMPANION</p><h2 id="corner-orbit-heading">Hi! How are you?</h2></div><button type="button" class="corner-orbit-close" aria-label="Close Corner Pulse">×</button></header>
    <p class="pulse-intro">Fancy exploring something together?</p>
    <div class="pulse-quick-actions"><button type="button" data-pulse-action="latest">Latest story <span>↗</span></button><button type="button" data-pulse-action="surprise">Surprise me <span>✦</span></button><button type="button" data-pulse-action="tour">Show me around <span>→</span></button><button type="button" data-pulse-action="peek">A little hide &amp; peek <span>☺</span></button></div>
    <section class="pulse-result" aria-live="polite" hidden><p data-result-kicker></p><h3 data-result-title></h3><p data-result-description></p><a data-result-link hidden>Read the story ↗</a><div class="pulse-tour-buttons" hidden><button type="button" data-tour-next>Next</button><button type="button" data-tour-stop>Stop tour</button></div></section>
    <details class="pulse-settings"><summary>Motion &amp; sound</summary><fieldset class="pulse-mode"><legend>How should I behave?</legend><div><button type="button" data-pulse-mode="calm" aria-pressed="true">Calm</button><button type="button" data-pulse-mode="playful" aria-pressed="false">Playful</button><button type="button" data-pulse-mode="paused" aria-pressed="false">Pause</button><button type="button" data-pulse-mode="hidden" aria-pressed="false">Hide</button></div></fieldset><button type="button" data-pulse-sound aria-pressed="false">Enable sound</button><label class="pulse-volume">Sound level <input type="range" min="0" max="40" step="1" value="12" aria-label="Companion sound volume" data-pulse-volume></label><p class="pulse-preference-note">This page only. Sound starts off. Reduced motion takes priority.</p></details>
    <details class="pulse-status"><summary>From the Corner</summary><div class="corner-orbit-reading"><span class="corner-orbit-status-label">CURRENTLY</span><strong data-orbit-status>Checking the Corner…</strong><p data-orbit-detail></p></div><div class="corner-orbit-latest"><span class="corner-orbit-status-label">LATEST STORY</span><a data-orbit-story hidden></a><p data-orbit-story-empty>Checking published stories…</p></div><p class="corner-orbit-live-line" data-orbit-live role="status">Updates on demand</p><p class="corner-orbit-explainer">No AI chat or invented activity. Reactions use confirmed Corner events, not your private messages.</p></details>`;
  const tip=document.createElement('div');tip.className='pulse-greeting';tip.id='pulse-greeting';tip.setAttribute('role','tooltip');tip.textContent='Hi! How are you?';tip.hidden=true;
  document.body.append(stage,card,tip);
  const perch=document.createElement('span');perch.className='pulse-perch';perch.setAttribute('aria-hidden','true');
  ($('.hero-cta')||$('.feed-heading')||$('.story-bottom')||welcomeHost).append(perch);
  const restore=document.createElement('button');restore.type='button';restore.className='pulse-text-control';restore.textContent='Show Pulse';restore.hidden=true;restore.dataset.pulseRestore='';welcomeHost.append(restore);
  const menuControl=document.createElement('button');menuControl.type='button';menuControl.className='pulse-text-control';menuControl.textContent='Pulse controls';profilePanel.append(menuControl);
  const limbs=Object.fromEntries(['body','head','foot-left','foot-right','arm-left','arm-right','bell','shadow'].map(name=>[name,$('.pulse-'+name,dock)]));
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const viewport=()=>{const v=window.visualViewport;return {x:v?.offsetLeft||0,y:v?.offsetTop||0,w:v?.width||innerWidth,h:v?.height||innerHeight,scale:v?.scale||1};};
  const inputSelector='input,textarea,select,[contenteditable="true"]';
  let mode='calm',position=null,motion=null,frame=0,phase=0,velocity=0,poseTimer=0,layoutTimer=0,idleTimer=0,edgeTimer=0,tipTimer=0;
  let lastReaction=-Infinity,quietUntil=0,suspended=false,hovered=false,tipHovered=false,tipSuppressed=false,routeMemory=null,edge=null,greetingCount=0,layoutVersion=0,lastEdge=-Infinity;
  let cache={g:null,blocks:[]},sound=false,audio=null,masterGain=null,volume=.12,lastSound=-Infinity,footIndex=0,turnTimer=0;
  const audioNodes=new Set();
  const otherDialog=()=>all('dialog[open]').some(el=>el!==card);
  const blocked=()=>document.hidden||otherDialog()||!profilePanel.hidden||!!document.activeElement?.matches(inputSelector)||viewport().scale>1.08||viewport().h<innerHeight*.68;
  const canAnimate=()=>!reduced.matches&&mode!=='paused'&&mode!=='hidden'&&!document.hidden;
  const canMove=()=>canAnimate()&&!blocked()&&!card.open&&!hovered&&!tipHovered&&!pet.matches(':focus-visible');
  function geometry(){
    const v=viewport(),w=narrow.matches?64:82,h=narrow.matches?77:98,bar=rail.getBoundingClientRect();
    const floor=narrow.matches&&bar.width>bar.height?Math.min(v.y+v.h-8,bar.top-10):v.y+v.h-12;
    return {x:v.x+8,y:v.y+8,w,h,maxX:v.x+v.w-w-8,maxY:floor-h,screenX:v.x,screenRight:v.x+v.w};
  }
  function obstacles(){
    return all('a,button,input,textarea,select,nav,header,footer,h1,h2,h3,p,blockquote,figure,.card-media,[role="alert"],[role="status"]').filter(el=>!stage.contains(el)&&!card.contains(el)&&!tip.contains(el)&&!el.closest('dialog')&&el!==restore&&el!==reopen&&!el.hidden).map(el=>{
      const r=el.getBoundingClientRect(),visible=r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';
      return {left:r.left-5,right:r.right+5,top:r.top-5,bottom:r.bottom+5,visible};
    }).filter(r=>r.visible&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth);
  }
  const hits=(p,g,b)=>p.x<b.right&&p.x+g.w>b.left&&p.y<b.bottom&&p.y+g.h>b.top;
  const safe=(p,g,blocks)=>p.x>=g.x&&p.y>=g.y&&p.x<=g.maxX&&p.y<=g.maxY&&!blocks.some(b=>hits(p,g,b));
  function clearLine(a,b,g,blocks,outside=false){
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/12));
    for(let i=0;i<=steps;i++){
      const p={x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps};
      if(outside){if(p.y<g.y||p.y>g.maxY||blocks.some(r=>hits(p,g,r)))return false;}
      else if(!safe(p,g,blocks))return false;
    }
    return true;
  }
  function pockets(g,blocks){
    const result=[];
    for(let x=g.x;x<=g.maxX;x+=42)for(let y=g.y;y<=g.maxY;y+=36)if(safe({x,y},g,blocks))result.push({x,y});
    for(const x of [g.x,g.maxX])for(let y=g.y;y<=g.maxY;y+=24)if(safe({x,y},g,blocks))result.push({x,y});
    for(const x of [g.x,g.maxX])if(safe({x,y:g.maxY},g,blocks))result.push({x,y:g.maxY});
    return result;
  }
  function route(a,b,g,blocks){
    if(clearLine(a,b,g,blocks))return [b];
    const cells=pockets(g,blocks),stride=Math.max(1,Math.ceil(cells.length/160));
    const nodes=[a,...cells.filter((_,i)=>i%stride===0),b],end=nodes.length-1,queue=[0],parent=new Map([[0,-1]]);
    for(let q=0;q<queue.length;q++)for(let j=1;j<nodes.length;j++){
      const i=queue[q];if(parent.has(j)||Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y)>145||!clearLine(nodes[i],nodes[j],g,blocks))continue;
      parent.set(j,i);if(j===end){const out=[];for(let k=end;k>0;k=parent.get(k))out.unshift(nodes[k]);return out;}queue.push(j);
    }
    return [];
  }
  function pose(value){clearTimeout(poseTimer);dock.dataset.pose=value;}
  function resetRig(){for(const el of Object.values(limbs))el?.style.removeProperty('transform');}
  function stop(reset=true){
    clearTimeout(turnTimer);clearTimeout(edgeTimer);cancelAnimationFrame(frame);frame=0;motion=null;velocity=0;
    if(reset){pose('sit');resetRig();caption.textContent='';}
  }
  function draw(){
    if(!position)return;const g=cache.g||geometry();
    dock.style.setProperty('--pet-x',position.x+'px');dock.style.setProperty('--pet-y',position.y+'px');dock.style.setProperty('--pet-w',g.w+'px');dock.style.setProperty('--pet-h',g.h+'px');
  }
  // Stride phase comes from pixels travelled, not an unrelated CSS timer.
  function gait(distance){
    phase+=distance/(narrow.matches?39:49)*Math.PI*2;
    const swing=Math.sin(phase),liftL=Math.max(0,Math.cos(phase)),liftR=Math.max(0,-Math.cos(phase));
    const direction=dock.dataset.facing==='left'?-1:1,energy=clamp(velocity/65,.2,1.25);
    limbs['foot-left'].style.transform=`translate(${swing*4}px,${-liftL*4.5}px) rotate(${swing*6}deg)`;
    limbs['foot-right'].style.transform=`translate(${-swing*4}px,${-liftR*4.5}px) rotate(${-swing*6}deg)`;
    limbs['arm-left'].style.transform=`rotate(${-swing*13*energy}deg)`;limbs['arm-right'].style.transform=`rotate(${swing*13*energy}deg)`;
    limbs.body.style.transform=`translateY(${-Math.abs(swing)*1.7*energy}px) rotate(${direction*energy}deg)`;
    limbs.head.style.transform=`rotate(${-direction*1.6+swing*.65}deg)`;limbs.bell.style.transform=`rotate(${Math.sin(phase-.6)*7*energy}deg)`;
    limbs.shadow.style.transform=`scaleX(${1-Math.abs(swing)*.07})`;
    const nextFoot=Math.floor(phase/Math.PI);if(nextFoot>footIndex){footIndex=nextFoot;if(mode==='playful')tone('step');}
  }
  function hideTip(){clearTimeout(tipTimer);tip.hidden=true;pet.removeAttribute('aria-describedby');}
  function positionTip(){
    if(tip.hidden||!position)return;const g=cache.g||geometry(),v=viewport();
    const r=tip.getBoundingClientRect(),left=clamp(position.x+g.w/2-r.width/2,v.x+9,v.x+v.w-r.width-9);
    const top=position.y>r.height+18?position.y-r.height-10:position.y+g.h+7;
    tip.style.left=left+'px';tip.style.top=clamp(top,v.y+8,v.y+v.h-r.height-8)+'px';
  }
  function greet(){
    if(mode==='hidden'||blocked()||card.open||tipSuppressed)return;
    stop();quietUntil=performance.now()+7000;
    if(edge){const g=geometry();position.x=clamp(position.x,g.x,g.maxX);edge=null;dock.dataset.edge='';draw();}
    tip.textContent=greetingCount++%2===0?'Hi! How are you?':'Nice to see you. Shall we explore?';tip.hidden=false;
    pet.setAttribute('aria-describedby',tip.id);positionTip();if(canAnimate())pose('wave');
  }
  function leaveGreeting(){clearTimeout(tipTimer);tipTimer=setTimeout(()=>{if(!hovered&&!tipHovered&&!pet.matches(':focus-visible')){hideTip();pose('sit');idle();}},180);}
  function updateLayout(){
    clearTimeout(layoutTimer);cache={g:geometry(),blocks:obstacles()};const {g,blocks}=cache;
    dock.dataset.suspended=String(blocked());
    if(mode==='hidden'||blocked()){stop();hideTip();dock.hidden=true;restore.hidden=mode!=='hidden';return;}
    pet.tabIndex=edge?.phase==='hidden'?-1:0;
    if(edge){
      // Non-geometric DOM updates must not cancel an explicit peek halfway
      // through. Scroll/resize already clear the sequence in scheduleLayout.
      let previous=position;
      const remaining=!motion||motion.steps.slice(motion.index).every(next=>{
        const clear=clearLine(previous,next,g,blocks,motion.outside);previous=next;return clear;
      });
      if(safe(edge.anchor,g,blocks)&&clearLine(edge.anchor,edge.out,g,blocks,true)&&remaining){draw();return;}
      stop();edge=null;dock.dataset.edge='';pet.tabIndex=0;
    }
    if(motion){let prior=position;if(motion.steps.slice(motion.index).every(p=>{const ok=clearLine(prior,p,g,blocks);prior=p;return ok;})){draw();return;}stop();}
    if(!position||!safe(position,g,blocks)){
      stop();routeMemory=null;const points=pockets(g,blocks),home=perch.getBoundingClientRect(),atHome={x:home.left,y:home.top};
      points.sort((a,b)=>Math.hypot(a.x-g.maxX,a.y-g.maxY)-Math.hypot(b.x-g.maxX,b.y-g.maxY));
      position=safe(atHome,g,blocks)?atHome:points[0]||null;
    }
    dock.hidden=!position;restore.hidden=!!position;restore.textContent=position?'Show Pulse':'Pulse controls';draw();positionTip();
    if(card.open)positionPanel();
  }
  function scheduleLayout(){
    // Freeze during scroll rather than disappear on every scroll event.
    stop();hideTip();routeMemory=null;edge=null;dock.dataset.edge='';quietUntil=performance.now()+1100;layoutVersion++;
    clearTimeout(layoutTimer);layoutTimer=setTimeout(updateLayout,110);
  }
  function walkSteps(steps,done,outside=false){
    if(!canMove()||!position||!steps.length)return false;
    const g=cache.g,blocks=cache.blocks;let previous=position;
    if(!steps.every(p=>{const ok=clearLine(previous,p,g,blocks,outside);previous=p;return ok;}))return false;
    stop();hideTip();const facing=steps[0].x<position.x?'left':'right';dock.dataset.facing=facing;
    dock.style.setProperty('--gaze',facing==='left'?'-1.6px':'1.6px');pose('turn');
    motion={steps:steps.map(p=>({...p})),index:0,last:0,outside};const version=layoutVersion;
    turnTimer=setTimeout(()=>{
      if(!motion||!canMove()){stop();return;}pose(outside?'edge-exit':mode==='playful'?'run':'walk');
      function tick(time){
        if(!motion||version!==layoutVersion)return;
        if(!canMove()){stop();return;}
        const next=motion.steps[motion.index],distance=Math.hypot(next.x-position.x,next.y-position.y);
        const dt=Math.min((time-(motion.last||time))/1000,.04);motion.last=time;
        const cruise=mode==='playful'?(narrow.matches?100:110):62;
        const target=Math.min(cruise,Math.max(18,Math.sqrt(distance*420)));
        velocity+=(target-velocity)*Math.min(1,dt*10);const d=Math.min(distance,velocity*dt);
        if(distance){position={x:position.x+(next.x-position.x)*d/distance,y:position.y+(next.y-position.y)*d/distance};draw();gait(d);}
        if(distance<=.8){position={...next};draw();motion.index++;if(motion.index===motion.steps.length){motion=null;velocity=0;frame=0;resetRig();pose('arrive');poseTimer=setTimeout(()=>{pose('sit');done?.();},170);return;}}
        frame=requestAnimationFrame(tick);
      }
      frame=requestAnimationFrame(tick);
    },160);return true;
  }
  const walk=(target,done)=>{if(!position)return false;return walkSteps(route(position,target,cache.g,cache.blocks),done);};

  function edgeJourney(){
    if(!canMove()||!position||edge)return false;
    cache={g:geometry(),blocks:obstacles()};const {g,blocks}=cache;
    // Only an unobstructed exit lane is eligible; never walk through a rail.
    const options=[];
    for(const side of ['right','left'])for(let y=g.y;y<=g.maxY;y+=26){
      const anchor={x:side==='right'?g.maxX:g.x,y},out={x:side==='right'?g.screenRight+4:g.screenX-g.w-4,y};
      if(safe(anchor,g,blocks)&&clearLine(anchor,out,g,blocks,true))options.push({side,anchor,out});
    }
    options.sort((a,b)=>Math.hypot(position.x-a.anchor.x,position.y-a.anchor.y)-Math.hypot(position.x-b.anchor.x,position.y-b.anchor.y));
    for(const plan of options.slice(0,12)){
      const approach=route(position,plan.anchor,g,blocks);if(!approach.length)continue;
      routeMemory=null;edge={...plan,phase:'approach'};dock.dataset.edge=plan.side;
      const exit=()=>{
        if(!edge||!canMove()){edge=null;return;}
        edge.phase='leaving';
        walkSteps([plan.out],()=>{
          if(!edge)return;edge.phase='hidden';pose('edge-hidden');pet.tabIndex=-1;
          edgeTimer=setTimeout(()=>{
            if(!edge||!canMove())return;
            const peek={x:plan.side==='right'?g.screenRight-g.w*.45:g.screenX-g.w*.55,y:plan.anchor.y};
            edge.phase='returning';
            walkSteps([peek],()=>{
              if(!edge)return;edge.phase='peeking';pose('peek');pet.tabIndex=0;tone('hello');
              edgeTimer=setTimeout(()=>{
                if(!edge||!canMove())return;
                walkSteps([plan.anchor],()=>{edge=null;dock.dataset.edge='';pet.tabIndex=0;quietUntil=performance.now()+3500;idle();},true);
              },1800);
            },true);
          },1200);
        },true);
      };
      if(walkSteps(approach,exit)){lastEdge=performance.now();return true;}edge=null;
    }
    return false;
  }
  function patrol(){
    if(!canMove()||!position||motion||edge)return;
    cache={g:geometry(),blocks:obstacles()};const {g,blocks}=cache;
    if(routeMemory&&safe(routeMemory.a,g,blocks)&&safe(routeMemory.b,g,blocks)){
      const steps=routeMemory.reverse?[...routeMemory.steps.slice(0,-1).reverse(),routeMemory.a]:routeMemory.steps;
      if(walkSteps(steps,()=>{if(routeMemory){routeMemory.reverse=!routeMemory.reverse;routeMemory.trips++;}}))return;
    }
    const limit=mode==='playful'?Math.max(viewport().w,viewport().h):180;
    const candidates=pockets(g,blocks).filter(p=>Math.hypot(p.x-position.x,p.y-position.y)>55&&Math.hypot(p.x-position.x,p.y-position.y)<limit);
    candidates.sort((a,b)=>Math.hypot(b.x-position.x,b.y-position.y)-Math.hypot(a.x-position.x,a.y-position.y));
    for(const target of candidates.slice(0,16)){
      const steps=route(position,target,g,blocks);if(!steps.length)continue;
      routeMemory={a:{...position},b:{...target},steps:steps.map(p=>({...p})),reverse:false,trips:0};
      walkSteps(steps,()=>{if(routeMemory){routeMemory.reverse=true;routeMemory.trips++;}});break;
    }
  }
  function idle(){
    clearTimeout(idleTimer);if(!canAnimate())return;
    idleTimer=setTimeout(()=>{
      if(canMove()&&performance.now()>quietUntil&&!motion&&!edge){
        updateLayout();
        if(mode==='playful'&&performance.now()-lastEdge>45000&&(!routeMemory||routeMemory.trips>=2)){if(!edgeJourney())patrol();}
        else patrol();
      }
      idle();
    },mode==='playful'?11000:27000);
  }
  function tone(kind){
    if(!sound||!audio||audio.state!=='running'||document.hidden||blocked()||volume===0)return;
    const now=performance.now(),interval=kind==='step'?650:900;if(now-lastSound<interval)return;lastSound=now;
    const t=audio.currentTime,step=kind==='step',frequencies=step?[145]:kind==='happy'?[659.25,830.61,987.77]:[587.33,880];
    for(const [index,f] of frequencies.entries()){
      const oscillator=audio.createOscillator(),envelope=audio.createGain();audioNodes.add(oscillator);
      oscillator.type='sine';oscillator.frequency.setValueAtTime(f,t);
      if(step)oscillator.frequency.exponentialRampToValueAtTime(85,t+.07);
      const start=t+index*.055,duration=step?.075:.29;
      envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(step?.055:.14,start+.008);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
      oscillator.connect(envelope);envelope.connect(masterGain);oscillator.start(start);oscillator.stop(start+duration+.025);
      oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();audioNodes.delete(oscillator);};
    }
  }
  function silence(){for(const node of audioNodes){try{node.stop();}catch{/* Optional browser capability; the page remains usable. */}}audioNodes.clear();}
  async function toggleSound(){
    const button=$('[data-pulse-sound]',card);
    if(sound){sound=false;silence();if(audio?.state==='running')void audio.suspend().catch(()=>{});button.setAttribute('aria-pressed','false');button.textContent='Enable sound';return;}
    try{
      // This is the sole audio construction site: only an explicit button click.
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('unsupported');
      if(!audio){audio=new Context();masterGain=audio.createGain();masterGain.gain.value=volume*.42;masterGain.connect(audio.destination);}
      await audio.resume();sound=audio.state==='running';
      button.setAttribute('aria-pressed',String(sound));button.textContent=sound?'Sound on · mute':'Tap to retry sound';
      if(sound){lastSound=-Infinity;tone('hello');}
    }catch{sound=false;button.setAttribute('aria-pressed','false');button.textContent='Sound unavailable';}
  }
  $('[data-pulse-sound]',card).addEventListener('click',toggleSound);
  $('[data-pulse-volume]',card).addEventListener('input',event=>{
    volume=clamp(Number(event.target.value)||0,0,40)/100;
    if(masterGain&&audio)masterGain.gain.setTargetAtTime(volume*.42,audio.currentTime,.025);
  });
  let fetchToken=0,panelController=null,posts=[],lastFetch=0,tourStep=-1,tourElement=null;
  const result=$('.pulse-result',card),resultLink=$('[data-result-link]',card),tourButtons=$('.pulse-tour-buttons',card);
  const tours=[
    {selector:'.corner-explore-grid,.category-tabs',title:'Find your kind of story.',description:'Wishes, Builds, Notes, Journal and Moments each have their own corner.',href:prefix+'/category/builds'},
    {selector:'#feed,.stories',title:'The latest, in one place.',description:'Published stories appear here. Open one to read, react or join the conversation.',href:prefix+'/#feed'},
    {selector:'[data-corner-profile-toggle]',title:'Your own quiet space.',description:'Your profile keeps saved stories and personal settings together. Signing in stays your choice.',href:prefix+'/profile'}
  ];
  function showResult(kicker,title,description,link){
    result.hidden=false;$('[data-result-kicker]',card).textContent=kicker;$('[data-result-title]',card).textContent=title;$('[data-result-description]',card).textContent=description;
    resultLink.hidden=!link;if(link)resultLink.href=link;positionPanel();
  }
  function endTour(){tourElement?.classList.remove('pulse-tour-target');tourElement=null;tourStep=-1;tourButtons.hidden=true;}
  function tour(index){
    endTour();tourStep=index;const step=tours[index];if(!step){showResult('ALL SET','Make yourself at home.','Explore at your own pace. I’m here when you need me.');return;}
    tourElement=$(step.selector);tourElement?.classList.add('pulse-tour-target');
    if(tourElement){const r=tourElement.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)tourElement.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'center'});}
    showResult('A LITTLE TOUR · '+(index+1)+' / '+tours.length,step.title,step.description,step.href);resultLink.textContent='Open this section ↗';tourButtons.hidden=false;
    $('[data-tour-next]',card).textContent=index===tours.length-1?'Finish':'Next';
  }
  $('[data-tour-next]',card).addEventListener('click',()=>tour(tourStep+1));$('[data-tour-stop]',card).addEventListener('click',()=>{endTour();result.hidden=true;positionPanel();});
  async function refresh(){
    const token=++fetchToken;panelController?.abort();const controller=new AbortController();panelController=controller;
    const timeout=setTimeout(()=>controller.abort(),10000);
    const get=async route=>{const response=await fetch(prefix+route,{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('unavailable');return (await response.json()).data;};
    const values=await Promise.allSettled([get('/api/status'),get('/api/posts?limit=12')]);clearTimeout(timeout);
    if(token!==fetchToken||!card.open)return;
    const status=values[0],list=values[1];
    $('[data-orbit-status]',card).textContent=status.status==='fulfilled'?(status.value?.status?.label||'Keeping a little corner alive.'):'Status temporarily unavailable.';
    $('[data-orbit-detail]',card).textContent=status.status==='fulfilled'?(status.value?.status?.detail||'A place for small things worth remembering.'):'Try reopening Pulse.';
    posts=list.status==='fulfilled'&&Array.isArray(list.value)?list.value.filter(p=>typeof p.slug==='string'&&p.slug.length>0):[];lastFetch=list.status==='fulfilled'?Date.now():0;
    const story=$('[data-orbit-story]',card),empty=$('[data-orbit-story-empty]',card);story.hidden=!posts.length;empty.hidden=!!posts.length;
    if(posts.length){story.textContent=posts[0].title||'Latest story';story.href=prefix+'/post/'+encodeURIComponent(posts[0].slug);}
    else empty.textContent=list.status==='fulfilled'?'No published stories yet.':'Stories temporarily unavailable.';
    positionPanel();
  }
  function positionPanel(){
    if(!card.open)return;const v=viewport(),bounds=geometry(),width=Math.min(368,v.w-24);
    card.style.width=width+'px';card.style.maxHeight=Math.max(120,bounds.maxY+bounds.h-v.y-14)+'px';
    const rect=card.getBoundingClientRect(),anchor=position||{x:v.x+v.w-width-12,y:v.y+80};
    const left=clamp(anchor.x-width+Math.min(bounds.w,width),v.x+12,v.x+v.w-width-12);
    const top=clamp(anchor.y-rect.height-10,v.y+12,Math.max(v.y+12,bounds.maxY+bounds.h-rect.height-8));
    card.style.left=left+'px';card.style.top=top+'px';
  }
  function openPanel(){
    stop();hideTip();endTour();closeProfile();closeRail();edge=null;dock.dataset.edge='';pet.tabIndex=0;updateLayout();
    pet.setAttribute('aria-expanded','true');dock.dataset.suspended='true';
    if(!card.open)card.show();positionPanel();$('.corner-orbit-close',card).focus({preventScroll:true});
    if(Date.now()-lastFetch>60000)void refresh();
  }
  function closePanel(focus=true){if(!card.open)return;card.close();if(focus&&position&&!dock.hidden)pet.focus({preventScroll:true});}
  $('.corner-orbit-close',card).addEventListener('click',()=>closePanel());
  card.addEventListener('close',()=>{fetchToken++;panelController?.abort();pet.setAttribute('aria-expanded','false');endTour();quietUntil=performance.now()+3500;updateLayout();idle();});
  card.addEventListener('toggle',positionPanel);
  all('details',card).forEach(el=>el.addEventListener('toggle',positionPanel));
  document.addEventListener('pointerdown',event=>{if(card.open&&!card.contains(event.target)&&!dock.contains(event.target)&&event.target!==menuControl&&event.target!==restore)closePanel(false);},{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    if(card.open){event.preventDefault();closePanel();}
    if(!tip.hidden){event.preventDefault();hideTip();tipSuppressed=true;pose('sit');}
  });
  pet.addEventListener('pointerenter',event=>{if(event.pointerType==='touch')return;hovered=true;tipSuppressed=false;stop();tipTimer=setTimeout(greet,240);});
  pet.addEventListener('pointerleave',()=>{hovered=false;leaveGreeting();});
  tip.addEventListener('pointerenter',()=>{tipHovered=true;clearTimeout(tipTimer);});tip.addEventListener('pointerleave',()=>{tipHovered=false;leaveGreeting();});
  pet.addEventListener('focus',()=>{stop();quietUntil=performance.now()+7000;if(pet.matches(':focus-visible')){tipSuppressed=false;greet();}});
  pet.addEventListener('blur',leaveGreeting);pet.addEventListener('pointerdown',()=>stop());pet.addEventListener('click',openPanel);menuControl.addEventListener('click',openPanel);
  for(const button of all('[data-pulse-mode]',card))button.addEventListener('click',()=>{
    mode=button.dataset.pulseMode;dock.dataset.mode=mode;stop();hideTip();edge=null;routeMemory=null;dock.dataset.edge='';pet.tabIndex=0;
    all('[data-pulse-mode]',card).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pulseMode===mode)));
    if(mode==='hidden'){closePanel(false);dock.hidden=true;restore.hidden=false;restore.textContent='Show Pulse';profileButton.focus({preventScroll:true});}
    else{updateLayout();if(mode==='paused')silence();}
    idle();
  });
  restore.addEventListener('click',()=>{
    if(mode==='hidden'){mode='calm';dock.dataset.mode=mode;all('[data-pulse-mode]',card).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pulseMode===mode)));}
    updateLayout();openPanel();
  });
  for(const button of all('[data-pulse-action]',card))button.addEventListener('click',async()=>{
    const action=button.dataset.pulseAction;endTour();
    if(action==='tour'){tour(0);return;}
    if(action==='peek'){
      if(!canAnimate()){showResult('MOTION IS QUIET','No rush.','Choose Calm or Playful to move. Reduced motion stays respected.');return;}
      // Begin only after the dialog close lifecycle has restored the scene.
      // Starting before close dispatch would cancel the new path immediately.
      card.addEventListener('close',()=>{
        hovered=false;pet.blur();quietUntil=0;updateLayout();
        if(!edgeJourney()){openPanel();showResult('KEEPING THINGS CLEAR','A little wave instead.','This part of the page is too crowded for a safe edge walk. I won’t cover your reading or buttons.');}
      },{once:true});
      closePanel(false);return;
    }
    button.disabled=true;
    try{
      if(!posts.length||Date.now()-lastFetch>60000)await refresh();if(!card.open)return;
      if(!posts.length){showResult('FROM THE CORNER',lastFetch?'No published stories yet.':'Stories are unavailable.','Nothing invented. Try again after a story is published or the connection returns.');return;}
      const item=action==='latest'?posts[0]:posts[Math.floor(Math.random()*posts.length)];
      showResult(action==='latest'?'LATEST STORY':'A STORY FOR YOU',item.title||'A Corner story',String(item.excerpt||'A moment worth keeping.').slice(0,220),prefix+'/post/'+encodeURIComponent(item.slug));
      resultLink.textContent='Read the story ↗';if(canAnimate())pose('pocket');tone('hello');
    }finally{button.disabled=false;}
  });
  function celebrate(type,target){
    if(!canAnimate()||blocked()||card.open||hovered||performance.now()-lastReaction<4500)return;
    lastReaction=performance.now();quietUntil=lastReaction+8000;if(edge){stop();edge=null;dock.dataset.edge='';}updateLayout();if(!position)return;
    const rect=target?.getBoundingClientRect();if(rect)dock.style.setProperty('--gaze',rect.left<position.x?'-1.6px':'1.6px');
    const react=()=>{if(!canAnimate()||blocked()||card.open)return;pose(type==='error'?'curious':type==='comment'?'wave':'happy');caption.textContent=type==='comment'?'Sent for review':type==='post'?'A new story':type==='error'?'Please try again':type==='approved'?'New conversation':'Thank you';if(type!=='error')tone('happy');poseTimer=setTimeout(()=>{pose('sit');caption.textContent='';},2200);};
    if(rect){const center={x:rect.left+rect.width/2,y:rect.top+rect.height/2},choices=pockets(cache.g,cache.blocks).filter(p=>Math.hypot(p.x-center.x,p.y-center.y)<190);choices.sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y));for(const choice of choices.slice(0,4))if(walk(choice,react))return;}
    react();
  }
  document.addEventListener('corner:pulse-action',event=>{const d=event.detail;if(!d||!['reaction','comment','error'].includes(d.type))return;if(d.type==='reaction'&&!d.active)return;celebrate(d.type,d.target instanceof Element?d.target:null);});
  const eventIds=new Set();
  document.addEventListener('corner:realtime',event=>{
    const d=event.detail;if(!d?.fresh||!d.id||eventIds.has(d.id))return;eventIds.add(d.id);if(eventIds.size>200)eventIds.delete(eventIds.values().next().value);
    if(['status.updated','post.published','post.archived'].includes(d.type)){lastFetch=0;if(card.open)void refresh();}
    if(d.type==='post.published')celebrate('post',$('[data-new-updates]')||$('#feed'));
    const target=all('.story[data-id]').find(el=>el.dataset.id===d.entityId)||(window.__CORNER__?.postId===d.entityId?$('.reactions')||$('#comment-form'):null);
    if(target){const r=target.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight){if(d.type==='reaction.updated'&&d.increased)celebrate('reaction',target);if(d.type==='comment.created'&&d.approved)celebrate('approved',target);}}
  });
  document.addEventListener('corner:live-state',event=>{const state=event.detail?.state;$('[data-orbit-live]',card).textContent=state==='open'?'Live Corner updates connected':state==='paused'?'Updates paused while away':state==='error'?'Connection interrupted — retrying':'Updates on demand';});
  document.addEventListener('corner:welcome-closed',()=>{updateLayout();if(canAnimate()&&!dock.hidden){pose('wave');poseTimer=setTimeout(()=>pose('sit'),1600);}});
  const observer=new MutationObserver(records=>{
    if(records.every(r=>stage.contains(r.target)||card.contains(r.target)||r.target===restore||r.target===reopen||r.target===tip))return;
    clearTimeout(layoutTimer);layoutTimer=setTimeout(updateLayout,60);
  });
  const observation={subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden','aria-expanded']};observer.observe(document.body,observation);
  window.addEventListener('resize',scheduleLayout,{passive:true});window.addEventListener('scroll',scheduleLayout,{passive:true});
  window.visualViewport?.addEventListener('resize',scheduleLayout,{passive:true});window.visualViewport?.addEventListener('scroll',scheduleLayout,{passive:true});
  document.addEventListener('focusin',event=>{if(event.target.matches(inputSelector)){scheduleLayout();dock.hidden=true;silence();}});
  document.addEventListener('focusout',event=>{if(event.target.matches(inputSelector))scheduleLayout();});
  reduced.addEventListener('change',()=>{stop();edge=null;updateLayout();idle();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){suspended=true;stop();hideTip();clearTimeout(idleTimer);clearTimeout(layoutTimer);dock.hidden=true;silence();if(audio?.state==='running')void audio.suspend().catch(()=>{});}
    else{suspended=false;sound=false;$('[data-pulse-sound]',card).setAttribute('aria-pressed','false');$('[data-pulse-sound]',card).textContent='Enable sound';quietUntil=performance.now()+2000;updateLayout();idle();}
  });
  window.addEventListener('pagehide',()=>{suspended=true;stop();hideTip();clearTimeout(idleTimer);clearTimeout(layoutTimer);panelController?.abort();observer.disconnect();silence();sound=false;if(audio?.state==='running')void audio.suspend().catch(()=>{});});
  window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;observer.observe(document.body,observation);$('[data-pulse-sound]',card).setAttribute('aria-pressed','false');$('[data-pulse-sound]',card).textContent='Enable sound';updateLayout();idle();}});
  window.CornerPulse=Object.freeze({snapshot:()=>({version:3,character:'Doraemon',mode,pose:dock.dataset.pose,moving:!!motion,position:position?{...position}:null,visible:!dock.hidden,reduced:reduced.matches,suspended,edge:edge?.phase||null,phase,sound,audioState:audio?.state||'not-created',patrolTrips:routeMemory?.trips||0}),open:openPanel});
  updateLayout();idle();
})();
