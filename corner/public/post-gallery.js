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
    const minimal=()=>window.CornerMotionPolicy?.isReduced?.()??reduced.matches;
    let active=0,scrollTimer=0;
    const clampIndex=i=>Math.max(0,Math.min(slides.length-1,i));
    const update=i=>{
      active=clampIndex(i);
      if(counter)counter.textContent=(active+1)+' / '+slides.length;
      dots.forEach((dot,n)=>dot.setAttribute('aria-current',String(n===active)));
      if(previous)previous.disabled=active===0;
      if(next)next.disabled=active===slides.length-1;
    };
    const go=(i,behavior=minimal()?'auto':'smooth')=>{
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
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const minimal=()=>window.CornerMotionPolicy?.isReduced?.()??reduced.matches;
    let index=0,returnFocus=null,gesture=null,ignoreClickUntil=0;
    const releaseDrag=()=>{
      photograph.style.transform='';photograph.style.opacity='';
      photograph.style.transition='';
    };
    const display=(i,swipeDirection=0)=>{
      if(!triggers.length)return;
      releaseDrag();
      index=(i+triggers.length)%triggers.length;
      const trigger=triggers[index],source=$('img',trigger);
      if(!source)return;
      photograph.src=source.currentSrc||source.src;
      photograph.alt=source.alt;
      caption.textContent=trigger.dataset.caption||'';
      gallery.setAttribute('aria-label','Photograph '+(index+1)+' of '+triggers.length);
      if(swipeDirection&&!minimal()&&typeof photograph.animate==='function'){
        photograph.animate([
          {opacity:.72,transform:'translateX('+(swipeDirection>0?12:-12)+'px)'},
          {opacity:1,transform:'translateX(0)'}
        ],{duration:180,easing:'ease-out'});
      }
    };
    const close=()=>{if(gallery.open)gallery.close()};
    triggers.forEach((trigger,i)=>trigger.addEventListener('click',()=>{
      returnFocus=trigger;display(i);
      if(typeof gallery.showModal==='function'){
        if(!gallery.open)gallery.showModal();
        gallery.focus({preventScroll:true});
      }else{
        window.open($('img',trigger).src,'_blank','noopener');
      }
    }));
    // The viewer is deliberately chrome-free; direct taps dismiss it.
    // Pointer movement distinguishes a horizontal swipe from a closing tap.
    gallery.addEventListener('pointerdown',event=>{
      if(!gallery.open)return;
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY};
    });
    gallery.addEventListener('pointermove',event=>{
      if(!gesture||gesture.id!==event.pointerId||minimal())return;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
      if(Math.abs(dx)<7||Math.abs(dx)<Math.abs(dy)*1.15)return;
      const translate=Math.max(-62,Math.min(62,dx*.48));
      photograph.style.transition='none';
      photograph.style.transform='translate3d('+translate+'px,0,0)';
      photograph.style.opacity=String(1-Math.min(.17,Math.abs(translate)/360));
    });
    gallery.addEventListener('pointerup',event=>{
      if(!gesture||gesture.id!==event.pointerId)return;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
      gesture=null;
      releaseDrag();
      if(Math.abs(dx)>44&&Math.abs(dx)>Math.abs(dy)*1.2){
        ignoreClickUntil=performance.now()+450;
        if(triggers.length>1)display(index+(dx<0?1:-1),dx<0?1:-1);
        event.preventDefault();
      }else if(Math.abs(dx)>12||Math.abs(dy)>12){
        ignoreClickUntil=performance.now()+250;
      }
    });
    gallery.addEventListener('pointercancel',()=>{gesture=null;releaseDrag()});
    gallery.addEventListener('click',event=>{
      if(performance.now()<ignoreClickUntil){event.preventDefault();return}
      close();
    });
    gallery.addEventListener('keydown',event=>{
      if(event.key==='ArrowLeft'){
        event.preventDefault();display(index-1,-1);
      }else if(event.key==='ArrowRight'){
        event.preventDefault();display(index+1,1);
      }
      // The native dialog also supports Escape, including for assistive technology.
    });
    gallery.addEventListener('close',()=>{
      gesture=null;ignoreClickUntil=0;releaseDrag();
      photograph.removeAttribute('src');
      returnFocus?.focus({preventScroll:true});
    });
    photograph.addEventListener('error',()=>{caption.textContent='Photograph temporarily unavailable.'});
  }
})();