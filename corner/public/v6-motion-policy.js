/* Vamsi's Corner: one first-party, cross-page motion preference.
   Never captures identity, events, analytics, or data from the user's content. */
(()=>{
 'use strict';
 const valid=new Set(['minimal','balanced','playful']);
 const system=matchMedia('(prefers-reduced-motion: reduce)');
 const store='corner-motion-mode';
 const read=(kind,key)=>{
  try{return window[kind]?.getItem(key)||null}catch{return null}
 };
 const write=(kind,key,value)=>{
  try{window[kind]?.setItem(key,value)}catch{/* Optional device-only preference. */}
 };
 const normalized=value=>value==='off'?'minimal':value==='subtle'?'balanced':valid.has(value)?value:null;
 const legacy=read('sessionStorage','corner-motion-off')==='1'?'minimal':null;
 let selected=normalized(read('localStorage',store))||legacy||'balanced';
 const blocked=()=>system.matches||!!navigator.connection?.saveData;
 const reduced=()=>blocked()||selected==='minimal';
 const status=()=>blocked()?'Device accessibility or data-saving settings limit animations.':
  selected==='minimal'?'Minimal motion is active on this device.':
  selected==='playful'?'Playful motion is active. Decorative effects still require separate permission.':
  'Balanced motion is active.';
 function syncControl(){
  const panel=document.querySelector('[data-corner-motion-preferences]');
  if(!panel)return;
  for(const item of panel.querySelectorAll('input[name=cornerMotionPreference]'))
   item.checked=item.value===selected;
  const note=panel.querySelector('[data-corner-motion-status]');
  if(note)note.textContent=status();
 }
 function apply(announce=true){
  const root=document.documentElement;
  root.dataset.cornerMotionPreference=selected;
  root.dataset.cornerMotionLevel=reduced()?'minimal':selected;
  syncControl();
  if(announce)document.dispatchEvent(new CustomEvent('corner:motion-preference-change',{
   detail:{mode:selected,reduced:reduced()}
  }));
 }
 function setMode(value){
  if(!valid.has(value))return false;
  selected=value;
  write('localStorage',store,value);
  // Compatibility with the existing Studio motion switch.
  write('sessionStorage','corner-motion-off',value==='minimal'?'1':'0');
  apply();
  return true;
 }
 document.addEventListener('change',event=>{
  const field=event.target.closest?.('[data-corner-motion-preferences] input[name=cornerMotionPreference]');
  if(!field)return;
  if(field.checked)setMode(field.value);
 });
 system.addEventListener?.('change',()=>apply());
 navigator.connection?.addEventListener?.('change',()=>apply());
 window.addEventListener('pageshow',event=>{if(event.persisted)apply(false)});
 window.CornerMotionPolicy=Object.freeze({
  mode:()=>selected,isReduced:reduced,canAnimate:()=>!reduced(),setMode,
  get status(){return status()}
 });
 apply(false);
})();