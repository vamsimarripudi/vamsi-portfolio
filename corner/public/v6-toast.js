/* Shared Corner toast service: safe text only, bounded queue, keyboard dismiss. */
(()=>{
 'use strict';
 const host=document.querySelector('#toast-stack')||(()=>{
  const el=document.createElement('div');el.id='toast-stack';document.body.append(el);return el;
 })();
 host.classList.add('v6-toast-stack');
 host.setAttribute('aria-label','Corner notifications');
 host.setAttribute('aria-relevant','additions');
 const maxVisible=3,defaultDuration=4700;
 let lastMessage='',lastAt=0;
 const icons={success:'✓',error:'!',warning:'!',info:'i'};
 const normalize=type=>Object.hasOwn(icons,type)?type:'info';
 function show(message,{type='info',duration=defaultDuration}={}){
  const text=String(message??'').trim().slice(0,350);
  if(!text)return null;
  const now=Date.now(),kind=normalize(type);
  if(lastMessage===kind+':'+text&&now-lastAt<800)return null;
  lastMessage=kind+':'+text;lastAt=now;
  while(host.querySelectorAll('.v6-toast').length>=maxVisible)host.querySelector('.v6-toast')?.remove();
  const node=document.createElement('div');node.className='v6-toast';node.dataset.type=kind;
  node.setAttribute('role',kind==='error'?'alert':'status');
  const icon=document.createElement('span');icon.className='v6-toast-symbol';icon.setAttribute('aria-hidden','true');icon.textContent=icons[kind];
  const body=document.createElement('span');body.className='v6-toast-message';body.textContent=text;
  const close=document.createElement('button');close.type='button';close.className='v6-toast-close';
  close.setAttribute('aria-label','Dismiss notification');close.textContent='×';
  node.append(icon,body,close);host.append(node);
  let remaining=Math.max(1200,Math.min(15000,Number(duration)||defaultDuration));
  let timer=null,started=0,removed=false;
  const dismiss=()=>{if(removed)return;removed=true;clearTimeout(timer);node.remove()};
  const pause=()=>{if(!timer)return;clearTimeout(timer);timer=null;remaining-=Date.now()-started};
  const resume=()=>{if(removed||document.hidden||node.matches(':hover')||node.contains(document.activeElement))return;
   started=Date.now();timer=setTimeout(dismiss,Math.max(500,remaining))};
  close.addEventListener('click',dismiss);
  node.addEventListener('mouseenter',pause);node.addEventListener('mouseleave',resume);
  node.addEventListener('focusin',pause);node.addEventListener('focusout',()=>queueMicrotask(resume));
  const onVisibility=()=>{if(document.hidden)pause();else resume()};
  document.addEventListener('visibilitychange',onVisibility);
  const cleanup=()=>document.removeEventListener('visibilitychange',onVisibility);
  const originalDismiss=dismiss;
  close.addEventListener('click',cleanup,{once:true});
  const observer=new MutationObserver(()=>{if(!node.isConnected){cleanup();observer.disconnect()}});
  observer.observe(host,{childList:true});
  resume();
  return {dismiss:()=>{cleanup();originalDismiss()},element:node};
 }
 window.CornerToast=Object.freeze({show,success:(text)=>show(text,{type:'success'}),
  error:(text)=>show(text,{type:'error'}),warning:(text)=>show(text,{type:'warning'}),
  info:(text)=>show(text,{type:'info'})});
})();
