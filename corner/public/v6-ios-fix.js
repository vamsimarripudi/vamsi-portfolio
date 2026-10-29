/* V6.2: keep the selected mobile Studio icon visible without scrolling the document.
   No private data, no network, no focus theft and no interception of navigation. */
(()=>{
 'use strict';
 const nav=document.querySelector('.admin-shell .admin-nav');
 if(!nav)return;
 const narrow=matchMedia('(max-width:767px)');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let frame=0;
 const center=item=>{
  if(!narrow.matches||!item||!nav.contains(item))return;
  const navBox=nav.getBoundingClientRect(),itemBox=item.getBoundingClientRect();
  // Scroll the horizontal navigation only, never move the page.
  const target=nav.scrollLeft+(itemBox.left-navBox.left)-(navBox.width-itemBox.width)/2;
  nav.scrollTo({left:Math.max(0,target),behavior:reduce.matches?'instant':'smooth'});
 };
 const selected=()=>nav.querySelector('[aria-current="page"],.is-active');
 const update=()=>{
  if(frame)cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{frame=0;center(selected())});
 };
 nav.addEventListener('click',event=>{
  const target=event.target.closest('a,button');if(target)requestAnimationFrame(()=>center(target));
 });
 // Studio updates the active tab after async route changes.
 const watch=new MutationObserver(update);
 watch.observe(nav,{subtree:true,attributes:true,attributeFilter:['class','aria-current']});
 window.addEventListener('resize',update,{passive:true});
 window.addEventListener('pagehide',()=>{watch.disconnect();if(frame)cancelAnimationFrame(frame)},{once:true});
 // Initial positioning must not move page Y or steal focus.
 if(narrow.matches&&selected())requestAnimationFrame(()=>center(selected()));
})();
