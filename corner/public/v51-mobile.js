/* V5.1: preserve the 6-item navigation, but release the reading area on iPhone.
   No network, tracking or persistence. Archived companion fixtures stay unchanged. */
(()=>{
 'use strict';
 const dock=document.querySelector('.corner-public-header .category-tabs.corner-rail');
 if(!dock||document.querySelector('script[src*="/companion.js"]'))return;
 const mobile=matchMedia('(max-width:900px)');
 const inputSelector='input:not([type=hidden]),textarea,select,[contenteditable="true"]';
 let hidden=false,lastY=Math.max(0,window.scrollY),accumulated=0,frame=0;
 const hasFocus=()=>!!document.activeElement?.matches?.(inputSelector);
 const show=shouldHide=>{
   const value=mobile.matches&&shouldHide;
   if(value===hidden)return;
   hidden=value;dock.classList.toggle('v51-dock-hidden',value);
   dock.inert=value;
 };
 function update(){
   frame=0;
   const y=Math.max(0,window.scrollY),delta=y-lastY;
   lastY=y;
   if(!mobile.matches||y<72){accumulated=0;show(false);return}
   if(hasFocus()){show(true);return}
   if(Math.abs(delta)<2)return;
   accumulated=delta>0?Math.max(0,accumulated)+delta:Math.min(0,accumulated)+delta;
   if(accumulated>25){show(true);accumulated=0}
   if(accumulated< -12){show(false);accumulated=0}
 }
 const onScroll=()=>{if(!frame)frame=requestAnimationFrame(update)};
 window.addEventListener('scroll',onScroll,{passive:true});
 window.addEventListener('resize',()=>{lastY=Math.max(0,window.scrollY);accumulated=0;show(false)},{passive:true});
 document.addEventListener('focusin',event=>{
   if(event.target.matches?.(inputSelector))show(true);
   else if(dock.contains(event.target))show(false);
 });
 document.addEventListener('keydown',event=>{if(event.key==='Tab'||event.key==='Escape')show(false)},true);
 document.addEventListener('focusout',()=>{if(window.scrollY<72)show(false)});
 window.visualViewport?.addEventListener('resize',()=>{
   if(mobile.matches&&hasFocus())show(true);
 },{passive:true});
 window.addEventListener('pagehide',()=>{if(frame)cancelAnimationFrame(frame)},{once:true});
})();