(() => {
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const carousel=$('[data-post-carousel]');
  if(carousel){
    const track=$('[data-carousel-track]',carousel),slides=$$('[data-carousel-slide]',carousel);
    const dots=$$('[data-carousel-dot]',carousel),counter=$('[data-carousel-count]',carousel);
    const previous=$('[data-carousel-prev]',carousel),next=$('[data-carousel-next]',carousel);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let active=0,scrollTimer=0;
    const clampIndex=i=>Math.max(0,Math.min(slides.length-1,i));
    const update=i=>{
      active=clampIndex(i);
      if(counter)counter.textContent=(active+1)+' / '+slides.length;
      dots.forEach((dot,n)=>dot.setAttribute('aria-current',String(n===active)));
      if(previous)previous.disabled=active===0;
      if(next)next.disabled=active===slides.length-1;
    };
    const go=(i,behavior=reduced.matches?'auto':'smooth')=>{
      const target=clampIndex(i),slide=slides[target];if(!slide)return;
      track.scrollTo({left:slide.offsetLeft-track.offsetLeft,behavior});update(target);
    };
    previous?.addEventListener('click',()=>go(active-1));
    next?.addEventListener('click',()=>go(active+1));
    dots.forEach((dot,i)=>dot.addEventListener('click',()=>go(i)));
    track?.addEventListener('keydown',event=>{
      if(event.key==='ArrowLeft'){event.preventDefault();go(active-1)}
      if(event.key==='ArrowRight'){event.preventDefault();go(active+1)}
      if(event.key==='Home'){event.preventDefault();go(0)}
      if(event.key==='End'){event.preventDefault();go(slides.length-1)}
    });
    track?.addEventListener('scroll',()=>{
      clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{
        const center=track.scrollLeft+track.clientWidth/2;
        let best=0,distance=Infinity;
        slides.forEach((slide,i)=>{const d=Math.abs(slide.offsetLeft+slide.offsetWidth/2-center);if(d<distance){distance=d;best=i}});
        update(best);
      },80);
    },{passive:true});
    window.addEventListener('resize',()=>go(active,'auto'),{passive:true});
    update(0);
  }

  const gallery=$('[data-post-lightbox]');
  if(gallery){
    const triggers=$$('[data-post-photo]');
    const photograph=$('figure img',gallery),caption=$('figure figcaption',gallery);
    const counter=$('[data-post-counter]',gallery);
    const previous=$('[data-post-prev]',gallery),next=$('[data-post-next]',gallery);
    let index=0,returnFocus=null;
    const display=i=>{
      if(!triggers.length)return;
      index=(i+triggers.length)%triggers.length;
      const trigger=triggers[index],source=$('img',trigger);
      photograph.src=source.currentSrc||source.src;photograph.alt=source.alt;
      caption.textContent=trigger.dataset.caption||'';counter.textContent=(index+1)+' / '+triggers.length;
      previous.disabled=triggers.length<2;next.disabled=triggers.length<2;
    };
    triggers.forEach((trigger,i)=>trigger.addEventListener('click',()=>{returnFocus=trigger;display(i);if(typeof gallery.showModal==='function')gallery.showModal();else window.open($('img',trigger).src,'_blank','noopener')}));
    $('[data-post-close]',gallery)?.addEventListener('click',()=>gallery.close());
    previous?.addEventListener('click',()=>display(index-1));next?.addEventListener('click',()=>display(index+1));
    gallery.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();display(index-1)}if(event.key==='ArrowRight'){event.preventDefault();display(index+1)}});
    gallery.addEventListener('click',event=>{if(event.target===gallery)gallery.close()});
    gallery.addEventListener('close',()=>{photograph.removeAttribute('src');returnFocus?.focus()});
    photograph.addEventListener('error',()=>{caption.textContent='Photograph temporarily unavailable.'});
  }
})();