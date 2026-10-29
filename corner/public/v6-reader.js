/* Corner V6: distraction-free reading without remounting, scroll traps, or route interception. */
(()=>{
 'use strict';
 const article=document.querySelector('article.post-article');
 const content=article?.querySelector('.post-body');
 const heading=article?.querySelector('.post-heading');
 if(!article||!content||!heading)return;
 const mobile=matchMedia('(max-width:900px)');
 const dock=document.querySelector('.corner-public-header .category-tabs.corner-rail');
 const root=document.documentElement;
 const controls=document.createElement('div');controls.className='v6-reader-controls';
 const toggle=document.createElement('button');toggle.type='button';toggle.className='v6-reader-toggle';
 toggle.setAttribute('aria-pressed','false');toggle.setAttribute('aria-label','Enter distraction-free reading mode');
 toggle.textContent='Focus reading';toggle.title='Focus reading';
 controls.append(toggle);heading.append(controls);
 const restore=document.createElement('button');restore.type='button';restore.className='v6-reader-show';
 restore.textContent='Show controls';restore.setAttribute('aria-label','Exit distraction-free reading');
 restore.hidden=true;document.body.append(restore);
 const inputSelector='input:not([type=hidden]),textarea,select,[contenteditable="true"]';
 let active=false,manuallyFocused=false,lastY=Math.max(0,window.scrollY);
 let streak=0,frame=0;
 const focusedControl=()=>document.activeElement?.matches?.(inputSelector);
 const dialogOpen=()=>!!document.querySelector('dialog[open]');
 const insideReading=()=>{
  // Start focus while viewing a story's cover, not only after its text begins.
  // End before post reactions/conversation so those controls remain discoverable.
  const start=article.querySelector('.post-carousel,.post-photo,.post-gallery')||content;
  const mediaBox=start.getBoundingClientRect();
  const bodyBox=content.getBoundingClientRect();
  return mediaBox.top<innerHeight*.64&&bodyBox.bottom>innerHeight*.55;
 };
 function change(next){
  if(active===next)return;
  active=next;
  if(next)root.dataset.v6Reading='focus';else delete root.dataset.v6Reading;
  if(dock&&mobile.matches)dock.inert=next?true:dock.classList.contains('v51-dock-hidden');
  toggle.setAttribute('aria-pressed',String(next));
  toggle.setAttribute('aria-label',next?'Exit distraction-free reading mode':'Enter distraction-free reading mode');
  toggle.textContent=next?'Exit focus':'Focus reading';toggle.title=next?'Exit focus':'Focus reading';
  restore.hidden=!next;
  document.dispatchEvent(new CustomEvent('corner:v6-reading',{detail:{active:next}}));
 }
 function update(){
  frame=0;
  const now=Math.max(0,window.scrollY),dy=now-lastY;lastY=now;
  if(!mobile.matches||dialogOpen()||focusedControl()||now<85){
   streak=0;if(!manuallyFocused||!mobile.matches||dialogOpen()||focusedControl())change(false);
   return;
  }
  if(!insideReading()){manuallyFocused=false;change(false);streak=0;return}
  if(manuallyFocused){change(true);return;}
  if(Math.abs(dy)<3)return;
  streak=dy>0?Math.max(0,streak)+dy:Math.min(0,streak)+dy;
  if(streak>27){change(true);streak=0}
  else if(streak< -13){change(false);streak=0}
 }
 const onScroll=()=>{if(!frame)frame=requestAnimationFrame(update)};
 toggle.addEventListener('click',()=>{
  manuallyFocused=!active;
  change(manuallyFocused);
  if(!manuallyFocused)streak=0;
 });
 restore.addEventListener('click',()=>{
  manuallyFocused=false;change(false);toggle.focus({preventScroll:true});
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&active){manuallyFocused=false;change(false);return;}
  if(event.key==='Tab'&&active){manuallyFocused=false;change(false);}
 },true);
 document.addEventListener('focusin',event=>{
  if(active&&event.target!==restore&&event.target!==toggle&&event.target.closest('a,button,input,textarea,select,[contenteditable]')){
   manuallyFocused=false;change(false);
  }
 },true);
 document.addEventListener('corner:v6-modal',event=>{
  if(event.detail?.open){manuallyFocused=false;change(false)}
 });
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){manuallyFocused=false;change(false)}
 });
 window.addEventListener('scroll',onScroll,{passive:true});
 window.addEventListener('resize',()=>{manuallyFocused=false;change(false);lastY=scrollY;streak=0},{passive:true});
 window.addEventListener('pagehide',()=>{
  if(frame)cancelAnimationFrame(frame);manuallyFocused=false;change(false);
 },{once:true});
 window.addEventListener('pageshow',event=>{if(event.persisted){lastY=scrollY;change(false)}});
})();
