// Low-cost progressive navigation: browser-native cross-document view transitions.
// We intentionally do not replace the document or intercept links: login, privacy,
// SEO, history and existing page-specific listeners keep their native behavior.
(() => {
  'use strict';
  // Independent profile menu when the optional archived companion is disabled.
  const profileToggle=document.querySelector('[data-corner-profile-toggle]');
  const profileCard=document.querySelector('[data-corner-profile-card]');
  const companionLoaded=!!document.querySelector('script[src*="/companion.js"]');
  if(profileToggle&&profileCard&&!companionLoaded){
    const close=(focus=false)=>{
      profileCard.hidden=true;profileToggle.setAttribute('aria-expanded','false');
      if(focus)profileToggle.focus({preventScroll:true});
    };
    profileToggle.addEventListener('click',()=>{
      const opening=profileCard.hidden;
      profileCard.hidden=!opening;
      profileToggle.setAttribute('aria-expanded',String(opening));
      if(opening){
        const visible=[...profileCard.querySelectorAll('a[href],button')].find(el=>!el.hidden&&el.getClientRects().length);
        visible?.focus({preventScroll:true});
      }
    });
    profileCard.addEventListener('click',event=>{
      if(event.target.closest('a[href]'))close();
    });
    document.addEventListener('pointerdown',event=>{
      if(!profileCard.hidden&&!profileToggle.parentElement.contains(event.target))close();
    },{passive:true});
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!profileCard.hidden){event.preventDefault();close(true)}
    });
  }
  const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  if(connection?.saveData)return;
  const warmed=new Set();
  const budget=4;
  let timer;
  const eligible=(a)=>{
    if(!a||a.target==='_blank'||a.hasAttribute('download')||a.rel.includes('external'))return null;
    let url;try{url=new URL(a.href,location.href)}catch{return null}
    if(url.origin!==location.origin||!url.pathname.startsWith('/corner'))return null;
    const part=url.pathname.slice('/corner'.length)||'/';
    if(!(/^\/(?:$|about$|now$|privacy$|terms$|category\/[^/]+$|post\/[^/]+$)/).test(part))return null;
    if(url.pathname===location.pathname||warmed.has(url.pathname)||warmed.size>=budget)return null;
    return url;
  };
  document.addEventListener('pointerover',event=>{
    if(event.pointerType!=='mouse')return;
    const link=eligible(event.target.closest?.('a[href]'));
    clearTimeout(timer);
    if(!link)return;
    timer=setTimeout(()=>{
      if(warmed.size>=budget||warmed.has(link.pathname))return;
      warmed.add(link.pathname);
      const node=document.createElement('link');node.rel='prefetch';node.as='document';node.href=link.pathname;document.head.append(node);
    },130);
  },{passive:true});
  document.addEventListener('pointerout',()=>clearTimeout(timer),{passive:true});
})();
