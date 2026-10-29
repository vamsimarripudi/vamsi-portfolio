/* Mobile Safari reading and Studio navigation fixes; never intercept native page links. */
(()=>{
 'use strict';
 const root=document.documentElement;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const studio=document.querySelector('.admin-shell .admin-nav');
 if(studio){
  const active=studio.querySelector('[aria-current="page"],.is-active');
  if(active)requestAnimationFrame(()=>active.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'}));
  studio.addEventListener('click',event=>{
   const tab=event.target.closest('a,button');if(!tab)return;
   requestAnimationFrame(()=>tab.scrollIntoView({block:'nearest',inline:'center',behavior:reduce.matches?'instant':'smooth'}));
  });
 }
 const article=document.querySelector('article.post-article');
 if(!article)return;
 const toggle=document.querySelector('.v6-reader-toggle');
 const restore=document.querySelector('.v6-reader-show');
 if(!toggle||!restore)return;
 const header=document.querySelector('.corner-public-header');
 const dock=header?.querySelector('.category-tabs.corner-rail');
 let previous=0,manual=false;
 const reconcile=()=>{
  const focus=root.dataset.v6Reading==='focus';
  if(dock)dock.inert=focus;
  if(header)header.inert=focus;
  restore.hidden=!focus;
  if(!focus)manual=false;
 };
 const observer=new MutationObserver(reconcile);
 observer.observe(root,{attributes:true,attributeFilter:['data-v6-reading']});
 const enter=()=>{manual=true;root.dataset.v6Reading='focus';reconcile()};
 const exit=()=>{manual=false;delete root.dataset.v6Reading;reconcile()};
 toggle.addEventListener('click',()=>requestAnimationFrame(reconcile));
 restore.addEventListener('click',()=>requestAnimationFrame(reconcile));
 window.addEventListener('pageshow',reconcile);
 window.addEventListener('pagehide',()=>{observer.disconnect();exit()},{once:true});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')exit()},true);
 reconcile();
})();
