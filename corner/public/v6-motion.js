/* Native multi-page continuity: full URLs, real history and no click interception. */
(()=>{
 'use strict';
 if(!document.querySelector('link[href="/v6-motion.css"]'))return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let named=null;
 const clear=()=>{if(named){named.style.viewTransitionName='';named=null}};
 const routeSlug=path=>{
  const segments=path.split('/').filter(Boolean);
  const i=segments.indexOf('post');
  return i>=0&&segments[i+1]&&!segments[i+2]?segments[i+1]:null;
 };
 window.addEventListener('pageswap',event=>{
  clear();if(!event.viewTransition||reduce.matches)return;
  let url;try{url=new URL(event.activation?.entry?.url)}catch{return}
  const slug=routeSlug(url.pathname);if(!slug)return;
  const cards=[...document.querySelectorAll('.story')];
  const card=cards.find(node=>[...node.querySelectorAll('a[href]')].some(link=>{
   try{return routeSlug(new URL(link.href).pathname)===slug}catch{return false}
  }));
  const cover=card?.querySelector('.card-media img');
  if(!cover)return;
  named=cover;named.style.viewTransitionName='corner-v6-cover';
  Promise.resolve(event.viewTransition.finished).finally(clear).catch(clear);
 });
 window.addEventListener('pagereveal',event=>{
  clear();if(!event.viewTransition||reduce.matches)return;
  const cover=document.querySelector('.post-article .post-carousel-slide:first-child .post-photo img');
  if(!cover)return;
  named=cover;named.style.viewTransitionName='corner-v6-cover';
  Promise.resolve(event.viewTransition.finished).finally(clear).catch(clear);
 });
 window.addEventListener('pagehide',clear);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
})();
