// Low-cost progressive navigation: browser-native cross-document view transitions.
// We intentionally do not replace the document or intercept links: login, privacy,
// SEO, history and existing page-specific listeners keep their native behavior.
(() => {
  'use strict';
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
