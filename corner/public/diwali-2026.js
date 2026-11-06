/* Diwali 2026: first-party, bounded celebration. Nothing runs beyond
   8 Nov 00:00 — 9 Nov 00:00 IST; no network calls, tracking or sound. */
(()=>{
 'use strict';
 const START=Date.parse('2026-11-07T18:30:00.000Z');
 const END=Date.parse('2026-11-08T18:30:00.000Z');
 const KEY='corner-diwali-2026-mode';
 const root=document.documentElement;
 const pref=window.matchMedia('(prefers-reduced-motion: reduce)');
 const network=navigator.connection;
 let hidden=false;
 try{hidden=localStorage.getItem(KEY)==='off'}catch{}
 let ribbon=null,canvas=null,ctx=null,tickTimer=0,burstTimer=0,raf=0,lastFrame=0;
 let particles=[];
 function validTime(){const now=Date.now();return now>=START&&now<END}
 function reduce(){return pref.matches||!!network?.saveData||window.CornerMotionPolicy?.isReduced?.()===true}
 function canMove(){return validTime()&&!hidden&&!reduce()&&!document.hidden&&root.dataset.v6Reading!=='focus'}
 function stopCanvas(){
  if(burstTimer){clearInterval(burstTimer);burstTimer=0}
  if(raf){cancelAnimationFrame(raf);raf=0}
  particles=[];lastFrame=0;
  if(canvas){canvas.remove();canvas=null;ctx=null}
 }
 function sizeCanvas(){
  if(!canvas||!ctx)return;
  const scale=Math.min(window.devicePixelRatio||1,1.5);
  canvas.width=Math.round(innerWidth*scale);
  canvas.height=Math.round(innerHeight*scale);
  ctx.setTransform(scale,0,0,scale,0,0);
 }
 function paint(timestamp){
  raf=0;
  if(!canMove()||!ctx){stopCanvas();return}
  if(lastFrame&&timestamp-lastFrame<32){raf=requestAnimationFrame(paint);return}
  const step=Math.min(2.5,Math.max(.5,lastFrame?(timestamp-lastFrame)/32:1));
  lastFrame=timestamp;
  ctx.clearRect(0,0,innerWidth,innerHeight);
  const next=[];
  for(const p of particles){
   p.x+=p.vx*step;p.y+=p.vy*step;p.vy+=.028*step;p.age+=step;
   const remaining=1-p.age/p.life;
   if(remaining<=0)continue;
   ctx.globalAlpha=Math.max(0,remaining)*.72;
   ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
   next.push(p);
  }
  ctx.globalAlpha=1;
  particles=next;
  if(particles.length)raf=requestAnimationFrame(paint);
 }
 function burst(x,y){
  if(!canMove()||!ctx)return;
  const count=innerWidth<=640?14:20;
  // Dim, slow, short-lived sparks; never a bright full-screen flash.
  for(let i=0;i<count;i++){
   const angle=(Math.PI*2*i/count)+(Math.random()-.5)*.22;
   const speed=.85+Math.random()*1.45;
   particles.push({
    x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-.2,
    age:0,life:30+Math.random()*20,size:.9+Math.random()*1.7,
    color:['#e7a344','#f4ce7a','#ffe3ad','#c99b55'][i%4]
   });
  }
  if(particles.length>60)particles=particles.slice(-60);
  if(!raf)raf=requestAnimationFrame(paint);
 }
 function startCanvas(){
  if(canvas||!canMove())return;
  canvas=document.createElement('canvas');
  canvas.className='corner-diwali-canvas';
  canvas.setAttribute('aria-hidden','true');
  document.body.appendChild(canvas);
  ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx){stopCanvas();return}
  sizeCanvas();
  burstTimer=setInterval(()=>{
   if(canMove())burst(innerWidth*(Math.random()<.5?.16:.84),Math.max(80,innerHeight*.18));
  },12500);
 }
 function refresh(){
  if(!ribbon)return;
  if(!validTime()){cleanup();return}
  root.dataset.cornerDiwali=hidden?'off':'on';
  root.dataset.cornerDiwaliMotion=canMove()?'on':'off';
  ribbon.classList.toggle('is-muted',hidden);
  const toggle=ribbon.querySelector('[data-corner-diwali-mode]');
  toggle.textContent=hidden?'Diwali mode: off':'Diwali mode: on';
  toggle.setAttribute('aria-pressed',String(!hidden));
  const celebrate=ribbon.querySelector('[data-corner-diwali-celebrate]');
  celebrate.hidden=hidden||reduce();
  if(canMove())startCanvas();
  else stopCanvas();
 }
 function cleanup(){
  if(tickTimer){clearTimeout(tickTimer);tickTimer=0}
  stopCanvas();
  if(ribbon){ribbon.remove();ribbon=null}
  delete root.dataset.cornerDiwali;
  delete root.dataset.cornerDiwaliMotion;
 }
 function mount(){
  if(ribbon||!document.body||!document.querySelector('.corner-public-header'))return;
  ribbon=document.createElement('section');
  ribbon.className='corner-diwali-ribbon';
  ribbon.setAttribute('aria-label','Diwali celebration');
  ribbon.innerHTML=
   '<div class="corner-diwali-ribbon__inner">'+
    '<span class="corner-diwali-lamp" aria-hidden="true">🪔</span>'+
    '<div class="corner-diwali-copy">'+
     '<span class="corner-diwali-kicker">వెలుగుల పండుగ · 8 NOVEMBER</span>'+
     '<strong>Happy Diwali from Vamsi’s Corner</strong>'+
     '<span class="corner-diwali-sub">A little light. A lot of memories.</span>'+
    '</div>'+
    '<div class="corner-diwali-actions">'+
     '<button type="button" data-corner-diwali-celebrate>Celebrate ✦</button>'+
     '<button type="button" data-corner-diwali-mode aria-pressed="true">Diwali mode: on</button>'+
    '</div>'+
   '</div>';
  document.querySelector('.corner-public-header').insertAdjacentElement('afterend',ribbon);
  ribbon.addEventListener('click',event=>{
   if(event.target.closest('[data-corner-diwali-mode]')){
    hidden=!hidden;
    try{localStorage.setItem(KEY,hidden?'off':'on')}catch{}
    refresh();
   }else if(event.target.closest('[data-corner-diwali-celebrate]')){
    burst(innerWidth*.8,Math.max(85,innerHeight*.23));
   }
  });
 }
 function checkWindow(){
  if(tickTimer){clearTimeout(tickTimer);tickTimer=0}
  const now=Date.now();
  if(now>=END){cleanup();return}
  if(now>=START){mount();refresh()}
  else cleanup();
  const boundary=now<START?START:END;
  // An open tab crosses both boundaries automatically. Visibility/pageshow
  // checks also correct timers suspended in a sleeping/background tab.
  const delay=Math.min(boundary-now,2_147_000_000);
  if(delay>0)tickTimer=setTimeout(checkWindow,delay+1);
 }
 document.addEventListener('visibilitychange',checkWindow);
 document.addEventListener('corner:motion-preference-change',refresh);
 window.addEventListener('pageshow',checkWindow);
 window.addEventListener('resize',sizeCanvas,{passive:true});
 pref.addEventListener?.('change',refresh);
 network?.addEventListener?.('change',refresh);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',checkWindow,{once:true});
 else checkWindow();
})();
