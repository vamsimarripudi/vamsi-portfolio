/* Publish action animation based on owner-supplied Click → done reference.
   The progress ring is indeterminate; green is shown only after the real API succeeds. */
(()=>{
 'use strict';
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const minimal=()=>window.CornerMotionPolicy?.isReduced?.()??reduce.matches;
 const nap=milliseconds=>new Promise(resolve=>setTimeout(resolve,Math.max(0,milliseconds)));
 const staticSVG='<svg viewBox="0 0 60 60" aria-hidden="true" focusable="false">'+
  '<circle class="v6-publish-ring-track" cx="30" cy="30" r="24"/>'+
  '<circle class="v6-publish-ring-active" cx="30" cy="30" r="24"/>'+
  '<path class="v6-publish-arrow" d="M30 41V22M22 30l8-8 8 8"/>'+
  '<path class="v6-publish-check" d="m18 31 8 8 17-18"/>'+
  '</svg>';
 const checkSVG='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+
  '<path d="m4 12 5 5L20 6"/></svg>';
 function mount(button){
  if(!button)return null;
  if(button.__cornerPublishMotion)return button.__cornerPublishMotion;
  const slot=document.createElement('span');slot.className='v6-publish-slot';
  button.before(slot);slot.append(button);
  button.classList.add('v6-publish-button');
  const original=button.textContent;
  button.innerHTML='<span class="v6-publish-label" aria-hidden="true">Publish</span>'+
    '<span class="v6-publish-orb" aria-hidden="true">'+staticSVG+'</span>'+
    '<span class="v6-publish-done" aria-hidden="true">'+checkSVG+'Published</span>';
  const label=button.querySelector('.v6-publish-label');
  const announcer=document.createElement('span');announcer.className='v6-publish-announcer';
  announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');
  announcer.setAttribute('aria-atomic','true');
  slot.append(announcer);
  let phase='idle',token=0,startAt=0,destroyed=false;
  const state=(next,announcement)=>{
   if(destroyed)return;
   phase=next;button.dataset.v6PublishState=next;
   const busy=next==='pending'||next==='confirmed'||next==='success';
   button.disabled=busy;
   button.setAttribute('aria-busy',String(next==='pending'||next==='confirmed'));
   button.setAttribute('aria-label',
     next==='pending'?'Publishing story':
     next==='confirmed'||next==='success'?'Story published successfully':
     next==='error'?'Retry publishing story':'Publish story');
   if(next==='pending')label.textContent='Publishing…';
   else if(next==='error')label.textContent='Try again';
   else label.textContent='Publish';
   if(announcement)announcer.textContent=announcement;
  };
  state('idle','');
  const alive=run=>!destroyed&&run===token&&button.isConnected;
  const api={
   start(){
    if(destroyed||phase==='pending'||phase==='confirmed'||phase==='success')return false;
    token++;startAt=performance.now();state('pending','Publishing story…');return true;
   },
   async success(){
    if(phase!=='pending')return false;
    const run=token;
    if(!minimal())await nap(Math.max(0,420-(performance.now()-startAt)));
    if(!alive(run))return false;
    state('confirmed','Your story is published.');
    if(!minimal())await nap(230);
    if(!alive(run))return false;
    state('success','Published successfully.');
    await nap(minimal()?0:1150);
    return alive(run);
   },
   failure(message='Could not publish. Please try again.'){
    if(destroyed)return;
    token++;state('error',message);
    if(document.activeElement!==button)button.focus({preventScroll:true});
   },
   cancel(){
    token++;destroyed=true;
    // If a route change unmounts the editor, cancel animation without leaving a disabled source button.
    const keepSuccess=phase==='success';
    if(!keepSuccess)button.disabled=false;
    button.removeAttribute('aria-busy');
    delete button.__cornerPublishMotion;
    if(!keepSuccess&&button.isConnected){
      button.classList.remove('v6-publish-button');button.removeAttribute('data-v6-publish-state');
      button.textContent=original;slot.before(button);slot.remove();
    }
   },
   get state(){return phase}
  };
  button.__cornerPublishMotion=api;
  return api;
 }
 window.CornerPublishMotion=Object.freeze({mount});
})();
