/* Non-destructive approximate before/after preview. Never writes until Save. */
(()=>{
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const minimal=()=>window.CornerMotionPolicy?.isReduced?.()??reduced.matches;
 const filters={
  original:'',warm:'sepia(.18) hue-rotate(-9deg) saturate(1.09)',
  film:'sepia(.24) contrast(1.12) saturate(.8)',
  mono:'grayscale(1)',dream:'sepia(.08) saturate(1.25) brightness(1.04)'
 };
 const clamp=(number,min,max,otherwise)=>{
  const value=Number(number);
  return Number.isFinite(value)?Math.max(min,Math.min(max,value)):otherwise;
 };
 function mount(form,media){
  if(!form||!media?.mime_type?.startsWith('image/'))return;
  const source='/corner/media/'+encodeURIComponent(media.storage_key);
  const panel=document.createElement('section');
  panel.className='corner-photo-compare';
  panel.setAttribute('aria-label','Original and edited photo comparison');
  const heading=document.createElement('div');heading.className='corner-photo-compare-heading';
  const label=document.createElement('strong');label.textContent='Before / after preview';
  const copy=document.createElement('small');copy.textContent='Approximate preview · original remains unchanged';
  heading.append(label,copy);
  const frame=document.createElement('div');frame.className='corner-photo-compare-frame';
  const original=document.createElement('img');original.src=source;original.alt='Original photograph';original.loading='lazy';
  const changed=document.createElement('img');changed.src=source;changed.alt='Approximate edited preview';changed.loading='lazy';
  changed.className='corner-photo-compare-edited';
  const divider=document.createElement('span');divider.className='corner-photo-compare-divider';divider.setAttribute('aria-hidden','true');
  frame.append(original,changed,divider);
  const revealLabel=document.createElement('label');revealLabel.className='corner-photo-compare-label';
  revealLabel.textContent='Reveal edited version';
  const range=document.createElement('input');range.type='range';range.min='0';range.max='100';range.value='52';
  range.setAttribute('aria-label','Reveal edited photo percentage');
  const pct=document.createElement('output');pct.textContent='52%';pct.setAttribute('aria-live','off');
  revealLabel.append(range,pct);
  panel.append(heading,frame,revealLabel);
  form.prepend(panel);
  const update=()=>{
   const f=form.elements;
   const preset=filters[f.preset?.value]||'';
   const brightness=clamp(f.brightness?.value,.6,1.4,1);
   const contrast=clamp(f.contrast?.value,.6,1.4,1);
   const saturation=clamp(f.saturation?.value,0,2,1);
   const rotation=clamp(f.rotation?.value,0,270,0);
   const crop=f.crop?.value||'original';
   changed.style.filter=[preset,'brightness('+brightness+')','contrast('+contrast+')','saturate('+saturation+')'].join(' ');
   changed.style.transform='rotate('+rotation+'deg)';
   frame.dataset.photoCrop=crop;
   const reveal=clamp(range.value,0,100,52);
   panel.style.setProperty('--corner-compare-reveal',reveal+'%');
   pct.textContent=reveal+'%';
   changed.style.transition=minimal()?'none':'';
  };
  form.addEventListener('input',update);
  form.addEventListener('change',update);
  range.addEventListener('input',update);
  const unavailable=()=>{copy.textContent='Preview unavailable; you can still save or restore your original.'};
  original.addEventListener('error',unavailable,{once:true});
  changed.addEventListener('error',unavailable,{once:true});
  update();
 }
 window.CornerPhotoCompare=Object.freeze({mount});
})();
