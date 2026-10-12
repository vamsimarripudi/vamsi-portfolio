(() => {
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  // Post photographs use a native dialog. Content is always taken from safe
  // server-rendered media; captions are inserted via textContent, never HTML.
  const gallery=$('[data-post-lightbox]');
  if(gallery){
    const triggers=$('[data-post-photo]');
    const photograph=$('figure img',gallery),caption=$('figure figcaption',gallery);
    const counter=$('[data-post-counter]',gallery);
    const previous=$('[data-post-prev]',gallery),next=$('[data-post-next]',gallery);
    let index=0,returnFocus=null;
    const display=i=>{
      if(!triggers.length)return;
      index=(i+triggers.length)%triggers.length;
      const trigger=triggers[index],source=$('img',trigger);
      photograph.src=source.currentSrc||source.src;
      photograph.alt=source.alt;
      caption.textContent=trigger.dataset.caption||'';
      counter.textContent=(index+1)+' / '+triggers.length;
      previous.disabled=triggers.length<2;
      next.disabled=triggers.length<2;
    };
    triggers.forEach((trigger,i)=>trigger.addEventListener('click',()=>{
      returnFocus=trigger;
      display(i);
      if(typeof gallery.showModal==='function')gallery.showModal();
      else window.open($('img',trigger).src,'_blank','noopener');
    }));
    $('[data-post-close]',gallery)?.addEventListener('click',()=>gallery.close());
    previous?.addEventListener('click',()=>display(index-1));
    next?.addEventListener('click',()=>display(index+1));
    gallery.addEventListener('keydown',event=>{
      if(event.key==='ArrowLeft'){event.preventDefault();display(index-1)}
      if(event.key==='ArrowRight'){event.preventDefault();display(index+1)}
    });
    gallery.addEventListener('click',event=>{if(event.target===gallery)gallery.close()});
    gallery.addEventListener('close',()=>{
      photograph.removeAttribute('src');
      returnFocus?.focus();
    });
    photograph.addEventListener('error',()=>{caption.textContent='Photograph temporarily unavailable.'});
  }

})();
