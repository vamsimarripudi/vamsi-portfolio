/* GSAP progressive enhancement. Forms and truthful counts work without this file. */
(()=>{
 'use strict';
 const html=document.documentElement,sidebar=document.querySelector('.admin-sidebar');
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const read=key=>{try{return sessionStorage.getItem(key)}catch{return null}};
 const write=(key,value)=>{try{sessionStorage.setItem(key,value)}catch{/* preference storage is optional */}};
 let paused=read('corner-motion-off')==='1',library,viewContext,disposed=false;
 const counters=new Map(),effects=new Set();
 const enabled=()=>!disposed&&!media.matches&&!paused&&!navigator.connection?.saveData;
 const load=()=>{
  if(window.gsap)return Promise.resolve(window.gsap);
  if(!library)library=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=(location.pathname.startsWith('/corner')?'/corner':'')+'/vendor/gsap-3.15.0.min.js';script.async=true;
   const timer=setTimeout(()=>reject(Error('Motion load timed out')),8000);
   script.onload=()=>{clearTimeout(timer);window.gsap?resolve(window.gsap):reject(Error('Motion unavailable'))};
   script.onerror=()=>{clearTimeout(timer);reject(Error('Motion unavailable'))};document.head.append(script);
  });
  return library;
 };
 const cancelCount=node=>{const running=counters.get(node);if(running){running.tween?.kill();running.finish()}};
 function count(node){
  if(!node)return;
  if(counters.has(node)&&node.querySelector('.motion-final'))return;
  const text=node.textContent.trim(),n=Number(text.replaceAll(',',''));
  if(!/^\d[\d,]*(?:\.\d+)?$/.test(text)||!Number.isFinite(n)||n<0)return;
  // External updates replace the node's text first. Kill any old animation without restoring stale data.
  const previous=counters.get(node);if(previous){previous.tween?.kill();counters.delete(node)}
  if(!enabled()||!window.gsap||n===0){node.classList.remove('motion-number');node.textContent=text;return}
  const semantic=document.createElement('span'),visual=document.createElement('span');
  semantic.className='motion-final';semantic.textContent=text;visual.className='motion-visual';visual.setAttribute('aria-hidden','true');visual.textContent='0';
  node.classList.add('motion-number');node.replaceChildren(semantic,visual);
  const state={value:0},decimals=(text.split('.')[1]||'').length;
  const finish=()=>{node.textContent=text;node.classList.remove('motion-number');counters.delete(node)};
  const record={finish,tween:null};counters.set(node,record);
  record.tween=window.gsap.to(state,{value:n,duration:.55,ease:'power2.out',onUpdate:()=>{visual.textContent=state.value.toLocaleString('en-IN',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})},onComplete:finish});
  window.gsap.fromTo(visual,{y:6},{y:0,duration:.3,ease:'power2.out',clearProps:'transform'});
 }
 async function refresh(){
  if(!enabled())return;
  try{const gsap=await load();if(!enabled())return;viewContext?.revert();
   const root=document.querySelector('#admin-view')||document.querySelector('.studio-main');
   if(root)viewContext=gsap.context(()=>{
    const heading=document.querySelector('#admin-heading')||root.querySelector('h1');
    if(heading)gsap.fromTo(heading,{y:7},{y:0,duration:.24,ease:'power2.out',clearProps:'transform'});
    const panels=[...root.querySelectorAll('.admin-kpi,.admin-empty,.v3w-preview,.v3a-kpi')].filter(n=>n.getBoundingClientRect().top<innerHeight).slice(0,8);
    if(panels.length)gsap.fromTo(panels,{y:5},{y:0,duration:.28,stagger:.025,ease:'power2.out',clearProps:'transform'});
   },root);
   html.dataset.studioMotion='on';
   (root||document).querySelectorAll('.admin-kpi strong,.v3a-kpi strong,[data-v3w-count]').forEach(count);
  }catch{html.dataset.studioMotion='unavailable'}
 }
 function react(button,selected){
  if(!selected||!enabled()||!window.gsap)return;
  let glyph=button.querySelector('[data-reaction-glyph]');
  if(!glyph){const text=[...button.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(!text)return;glyph=document.createElement('i');glyph.dataset.reactionGlyph='';glyph.setAttribute('aria-hidden','true');text.replaceWith(glyph);glyph.append(text)}
  const gsap=window.gsap;gsap.killTweensOf(glyph);button.dataset.reactionAnimated='true';
  const tl=gsap.timeline({onComplete:()=>{effects.delete(tl);delete button.dataset.reactionAnimated}});
  effects.add(tl);tl.to(glyph,{scale:1.24,rotation:-10,duration:.12,ease:'power2.out'}).to(glyph,{scale:1,rotation:0,duration:.26,ease:'back.out(2)',clearProps:'transform'});
 }
 function stop(){viewContext?.revert();viewContext=null;for(const node of [...counters.keys()])cancelCount(node);for(const effect of effects){effect.progress(1);effect.kill()}effects.clear();html.dataset.studioMotion='off'}
 function preference(){
  document.querySelectorAll('[data-motion-toggle]').forEach(button=>{button.setAttribute('aria-pressed',String(paused||media.matches));button.setAttribute('aria-label',media.matches?'Reduced motion follows device settings':paused?'Enable animations':'Reduce animations');button.title=button.getAttribute('aria-label')});
  if(enabled())refresh();else stop();
 }
 document.querySelectorAll('[data-motion-toggle]').forEach(button=>button.addEventListener('click',()=>{paused=!paused;write('corner-motion-off',paused?'1':'0');preference()}));
 media.addEventListener?.('change',preference);
 const collapse=document.querySelector('[data-studio-collapse]');
 const applyCollapse=value=>{html.dataset.studioCollapsed=String(value);if(collapse){collapse.setAttribute('aria-expanded',String(!value));collapse.setAttribute('aria-label',value?'Expand sidebar':'Collapse sidebar');collapse.title=collapse.getAttribute('aria-label')}};
 applyCollapse(read('corner-sidebar-collapsed')==='true');
 collapse?.addEventListener('click',()=>{const next=html.dataset.studioCollapsed!=='true';applyCollapse(next);write('corner-sidebar-collapsed',String(next))});
 const size=()=>{if(sidebar)html.style.setProperty('--studio-header-height',(sidebar.getBoundingClientRect().height+10)+'px')};
 const observer=sidebar&&'ResizeObserver' in window?new ResizeObserver(size):null;observer?.observe(sidebar);size();
 const iconPress=event=>{
  const button=event.target.closest('button,a');if(!button||button.disabled||!enabled()||!window.gsap)return;
  const icon=button.querySelector('.studio-icon');if(!icon)return;
  const tween=window.gsap.fromTo(icon,{rotation:-7,scale:.93},{rotation:0,scale:1,duration:.25,ease:'back.out(1.8)',clearProps:'transform',onComplete:()=>effects.delete(tween)});effects.add(tween);
 };
 document.addEventListener('pointerdown',iconPress);document.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key))iconPress(event)});
 // The original admin.js handles its own sign-out; private V3 pages use the same existing endpoint.
 if(sidebar&&!document.querySelector('#admin-view'))document.querySelector('#admin-logout')?.addEventListener('click',async event=>{
  const button=event.currentTarget;button.disabled=true;
  try{const r=await fetch((location.pathname.startsWith('/corner')?'/corner':'')+'/api/admin/logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw Error('Sign-out failed. Please retry.');location.assign((location.pathname.startsWith('/corner')?'/corner':'')+'/admin')}
  catch(error){button.disabled=false;let note=sidebar.querySelector('[role=status]');if(!note){note=document.createElement('p');note.setAttribute('role','status');sidebar.append(note)}note.textContent=error.message}
 });
 window.CornerMotion={refresh,count,react};preference();
 addEventListener('pagehide',()=>{disposed=true;stop();observer?.disconnect();media.removeEventListener?.('change',preference)});
 addEventListener('pageshow',event=>{if(event.persisted){disposed=false;observer?.observe(sidebar);media.addEventListener?.('change',preference);preference()}});
})();
