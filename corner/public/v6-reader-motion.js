/* V6 reader motion: confirmations are called ONLY after first-party operations succeed. */
(()=>{
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const timers=new WeakMap();
 function confirm(button,kind,state='confirmed'){
  if(!button?.isConnected)return;
  clearTimeout(timers.get(button));
  const existing=button.querySelector(':scope > .corner-reader-motion-mark');
  existing?.remove();
  const mark=document.createElement('span');
  mark.className='corner-reader-motion-mark';
  mark.setAttribute('aria-hidden','true');
  mark.textContent=kind==='bookmark'?(state==='saved'?'✓':'−'):kind==='reply'?(state==='review'?'•':'↗'):'✓';
  button.append(mark);
  button.dataset.cornerReaderMotion=kind;
  button.dataset.cornerReaderState=state;
  const delay=reduced.matches?480:820;
  const timer=setTimeout(()=>{
   if(button.isConnected&&button.querySelector(':scope > .corner-reader-motion-mark')===mark){
    mark.remove();
    delete button.dataset.cornerReaderMotion;
    delete button.dataset.cornerReaderState;
   }
   timers.delete(button);
  },delay);
  timers.set(button,timer);
 }
 // All public effects require an explicit call from the successful handler.
 window.CornerReaderMotion=Object.freeze({
  bookmark:(button,saved)=>confirm(button,'bookmark',saved?'saved':'removed'),
  share:button=>confirm(button,'share','copied'),
  comment:(button,pending=true)=>confirm(button,'reply',pending?'review':'sent'),
  reply:(button,pending=true)=>confirm(button,'reply',pending?'review':'sent')
 });
})();
