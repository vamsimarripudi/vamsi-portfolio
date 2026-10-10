/* Corner V3 native Motion Primitives: progressive design only, no network calls. */
(()=>{
 'use strict';
 const main=document.querySelector('main#content');
 if(!main)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
 const canAnimate=()=>!reduced.matches&&!connection?.saveData&&(!navigator.hardwareConcurrency||navigator.hardwareConcurrency>=4);
 let observer;
 if(canAnimate()&&'IntersectionObserver' in window){
  const nodes=main.querySelectorAll(
   '.signin-box,.v3-explorer,.v3-result,.v3-year,.v3m-event,.v3m-album,.v3m-collection,'+
   '.v3m-series-item,.v3m-now-item,.v3m-form,.v3m-admin-list,'+
   '.v3w-form,.v3w-preview,.v3w-item,.v3a-kpi,.v3a-panel,.v3a-locale-row'
  );
  observer=new IntersectionObserver(entries=>{
   for(const item of entries)if(item.isIntersecting){
    item.target.classList.add('is-visible');observer.unobserve(item.target);
   }
  },{threshold:.04,rootMargin:'0px 0px -12px 0px'});
  nodes.forEach((node,index)=>{
   node.setAttribute('data-motion-reveal','');
   node.style.setProperty('--motion-delay',Math.min(index%4,3)*35+'ms');
   observer.observe(node);
  });
  document.documentElement.dataset.cornerMotion='active';
 }
 reduced.addEventListener?.('change',()=>{
  if(reduced.matches){observer?.disconnect();delete document.documentElement.dataset.cornerMotion;}
 });
 // A passive, purely decorative reading-progress bar on long-form stories.
 if(main.querySelector('.post-article')){
  const bar=document.createElement('div');
  bar.className='corner-reading-progress';
  bar.setAttribute('aria-hidden','true');
  document.body.appendChild(bar);
  let pending=false;
  const update=()=>{
   const height=Math.max(1,document.documentElement.scrollHeight-innerHeight);
   bar.style.transform='scaleX('+Math.max(0,Math.min(1,scrollY/height))+')';
   pending=false;
  };
  const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(update)}};
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  schedule();
 }
 // Preview animation never changes data, URL, focus or screen-reader status.

})();
