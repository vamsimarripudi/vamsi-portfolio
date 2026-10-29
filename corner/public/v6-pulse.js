/* Corner Pulse: public 24-hour time trace. Server owns TTL; browser just updates open pages.
   No tracking, no cookies, no feed copies and no permanent status history. */
(()=>{
 'use strict';
 const cards=[...document.querySelectorAll('[data-corner-pulse-card]')];
 const headers=[...document.querySelectorAll('[data-corner-pulse-header]')];
 if(!cards.length&&!headers.length)return;
 const duration=24*60*60*1000;
 const shortRemaining=ms=>{
  const minutes=Math.max(0,Math.ceil(ms/60000));
  if(minutes<60)return minutes+' min left';
  const h=Math.floor(minutes/60),m=minutes%60;
  return h+'h '+String(m).padStart(2,'0')+'m left';
 };
 let timer=0,disposed=false,pulse=null;
 const first=cards[0]||headers[0];
 const expiresAt=first.getAttribute('data-pulse-expires')||'';
 const label=(cards[0]?.querySelector('[data-pulse-label]')?.textContent||headers[0]?.querySelector('[data-pulse-header-label]')?.textContent||'').replace(/^PULSE · /,'');
 const detail=cards[0]?.querySelector('[data-pulse-detail]')?.textContent||'';
 if(expiresAt&&Number.isFinite(Date.parse(expiresAt)))pulse={label,detail,expiresAt};
 function paint(){
  if(disposed)return;
  if(timer){clearTimeout(timer);timer=0}
  const until=Date.parse(pulse?.expiresAt||'');
  const remaining=Number.isFinite(until)?until-Date.now():0;
  const active=remaining>0&&!!pulse?.label;
  for(const card of cards){
   card.classList.toggle('is-live',active);card.classList.toggle('is-idle',!active);
   card.setAttribute('data-pulse-expires',active?pulse.expiresAt:'');
   const heading=card.querySelector('[data-pulse-label]');
   const copy=card.querySelector('[data-pulse-detail]');
   const info=card.querySelector('[data-pulse-meta]');
   if(heading)heading.textContent=active?pulse.label:(card.dataset.pulseEmptyLabel||'No Pulse right now');
   if(copy)copy.textContent=active?(pulse.detail||'A passing thought for today.'):(card.dataset.pulseEmptyDetail||'A passing thought may arrive soon.');
   if(info)info.textContent=active?shortRemaining(remaining)+' · disappears automatically':
     'Only passing moments live here. Permanent stories remain in the archive.';
   const line=card.querySelector('[data-pulse-progress]');
   if(line)line.style.transform='scaleX('+(active?Math.max(0,Math.min(1,remaining/duration)):0)+')';
   card.querySelectorAll('.live-dot').forEach(el=>{el.hidden=!active});
  }
  for(const header of headers){
   header.classList.toggle('is-live',active);
   header.setAttribute('data-pulse-expires',active?pulse.expiresAt:'');
   const text=header.querySelector('[data-pulse-header-label]');
   if(text)text.textContent=active?'PULSE · '+pulse.label:'Corner Pulse';
   const dot=header.querySelector('.live-dot');if(dot)dot.hidden=!active;
  }
  if(!active){pulse=null;return}
  // Switch exactly at the expiry deadline even without a page refresh.
  timer=setTimeout(paint,Math.max(50,Math.min(30000,remaining+30)));
 }
 const apply=status=>{
  if(status&&typeof status.label==='string'&&Number.isFinite(Date.parse(status.expiresAt)))
   pulse={label:status.label,detail:status.detail||'',expiresAt:status.expiresAt};
  else pulse=null;
  paint();
 };
 window.CornerPulse=Object.freeze({apply});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)paint()});
 // A back-forward-cache restoration reuses this page and must re-arm expiry.
 window.addEventListener('pageshow',()=>{disposed=false;paint()});
 window.addEventListener('pagehide',()=>{disposed=true;if(timer){clearTimeout(timer);timer=0}});
 paint();
})();
