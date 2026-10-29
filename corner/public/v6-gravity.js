/* Corner Gravity V6 — deliberately triggered decorative physics, never story content. */
(()=>{
 'use strict';
 const star=document.querySelector('.hero-spark[data-v6-gravity]');
 const hero=document.querySelector('.corner-home-hero');
 if(!star||!hero)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const limited=n=>Math.max(0,Math.min(1,n));
 const mode=()=>{
  try{return localStorage.getItem('corner-motion-mode')||'subtle'}catch{return 'subtle'}
 };
 if(reduce.matches||mode()==='off'||navigator.connection?.saveData)return;
 const keyboard=document.createElement('button');keyboard.type='button';keyboard.className='v6-gravity-play';
 keyboard.textContent='Play the star';keyboard.title='Play a small falling-star animation';
 keyboard.setAttribute('aria-label','Play the decorative falling star effect');
 (hero.querySelector('.hero-cta')||hero).append(keyboard);
 star.dataset.v6Ready='';
 star.title='Double-tap this star to see it fall';
 let raf=0,ghost=null,active=false,lastTap=null,animation=null,initialY=scrollY;
 const clear=()=>{
  if(raf){cancelAnimationFrame(raf);raf=0}
  if(animation){animation.cancel();animation=null}
  if(ghost){ghost.remove();ghost=null}
  star.style.visibility='';keyboard.disabled=false;active=false;
 };
 const cancel=()=>{if(active)clear()};
 function play(){
  if(active||reduce.matches||mode()==='off'||document.hidden)return;
  if(document.documentElement.dataset.v6Reading==='focus')return;
  const rect=star.getBoundingClientRect();
  if(!rect.width||!rect.height||rect.top>innerHeight||rect.bottom<0)return;
  active=true;initialY=scrollY;keyboard.disabled=true;
  ghost=star.cloneNode(true);ghost.removeAttribute('data-v6-gravity');ghost.removeAttribute('data-v6-ready');
  ghost.removeAttribute('title');ghost.classList.add('v6-gravity-ghost');
  ghost.style.cssText+=';left:'+rect.left+'px;top:'+rect.top+'px;width:'+rect.width+'px;height:'+rect.height+'px;';
  document.body.append(ghost);star.style.visibility='hidden';
  let offset=0,angle=0,spin=(Math.random()<.5?-1:1)*70,velocity=-70,bounces=0;
  const floor=Math.max(40,Math.min(innerHeight-28,Math.max(rect.bottom+80,innerHeight-92)))-rect.bottom;
  let previous=0,started=0,current='translate3d(0,0,0) rotate(0deg)';
  const finish=()=>{
   if(!ghost||!active)return;
   const element=ghost;
   if(typeof element.animate!=='function'){clear();return}
   animation=element.animate([{transform:current,opacity:1},{transform:'translate3d(0,0,0) rotate(0deg)',opacity:.1}],{
    duration:340,easing:'cubic-bezier(.18,.72,.3,1)',fill:'forwards'
   });
   Promise.resolve(animation.finished).catch(()=>{}).finally(clear);
  };
  const step=now=>{
   if(!active||!ghost)return;
   if(!started){started=now;previous=now}
   const dt=Math.min(.032,(now-previous)/1000);previous=now;
   velocity+=1880*dt;
   offset+=velocity*dt;angle+=spin*dt;
   if(offset>=floor&&velocity>0){
    offset=floor;bounces++;velocity=-velocity*.4;spin*=.67;
    if(bounces>=2||Math.abs(velocity)<120){current='translate3d(0,'+offset.toFixed(2)+'px,0) rotate('+angle.toFixed(2)+'deg)';ghost.style.transform=current;raf=0;finish();return}
   }
   const maxRotation=32;angle=Math.max(-maxRotation,Math.min(maxRotation,angle));
   current='translate3d(0,'+Math.max(0,offset).toFixed(2)+'px,0) rotate('+angle.toFixed(2)+'deg)';
   ghost.style.transform=current;
   if(now-started>2050){raf=0;finish();return}
   raf=requestAnimationFrame(step);
  };
  raf=requestAnimationFrame(step);
 }
 star.addEventListener('pointerup',event=>{
  if(event.button!==0&&event.pointerType==='mouse')return;
  const tap={at:performance.now(),x:event.clientX,y:event.clientY,pointer:event.pointerType};
  const previous=lastTap;lastTap=tap;
  if(previous&&tap.pointer===previous.pointer&&tap.at-previous.at<330&&
     Math.hypot(tap.x-previous.x,tap.y-previous.y)<22){
    lastTap=null;play();
  }
 },{passive:true});
 star.addEventListener('pointercancel',()=>{lastTap=null});
 keyboard.addEventListener('click',play);
 document.addEventListener('corner:v6-reading',event=>{if(event.detail?.active)cancel()});
 document.addEventListener('corner:v6-modal',event=>{if(event.detail?.open)cancel()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel()});
 window.addEventListener('scroll',()=>{if(active&&Math.abs(scrollY-initialY)>9)cancel()},{passive:true});
 window.addEventListener('orientationchange',cancel,{passive:true});
 window.addEventListener('pagehide',clear);
 reduce.addEventListener?.('change',()=>{if(reduce.matches){clear();keyboard.hidden=true}});
})();
