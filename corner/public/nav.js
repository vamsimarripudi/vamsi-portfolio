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

// Public icon-first glass rail, mobile drawer, profile popover and first-visit welcome.
(function initCornerNavigation(){
  'use strict';
  const rail=document.getElementById('corner-rail-nav');
  const toggle=document.querySelector('[data-corner-rail-toggle]');
  const railClose=document.querySelector('[data-corner-rail-close]');
  const backdrop=document.querySelector('[data-corner-rail-backdrop]');
  const profileButton=document.querySelector('[data-corner-profile-toggle]');
  const profilePanel=document.querySelector('[data-corner-profile-card]');
  if(!rail||!toggle||!backdrop||!profileButton||!profilePanel)return;
  const profileWrap=profileButton.closest('.corner-profile-wrap');
  const narrow=window.matchMedia('(max-width: 900px)');
  const profileIsOpen=()=>!profilePanel.hidden;
  const closeProfile=(focus=false)=>{
    profilePanel.hidden=true;
    profileButton.setAttribute('aria-expanded','false');
    profileButton.setAttribute('aria-label','Open profile options');
    if(focus)profileButton.focus();
  };
  const closeRail=(focus=false)=>{
    rail.classList.remove('is-open');
    backdrop.hidden=true;
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-label','Open navigation');
    document.documentElement.classList.remove('corner-drawer-open');
    if(focus&&narrow.matches)toggle.focus();
  };
  const openRail=()=>{
    if(!narrow.matches)return;
    closeProfile();
    rail.classList.add('is-open');
    backdrop.hidden=false;
    toggle.setAttribute('aria-expanded','true');
    toggle.setAttribute('aria-label','Close navigation');
    document.documentElement.classList.add('corner-drawer-open');
    railClose?.focus();
  };
  toggle.addEventListener('click',()=>rail.classList.contains('is-open')?closeRail(true):openRail());
  railClose?.addEventListener('click',()=>closeRail(true));
  backdrop.addEventListener('click',()=>closeRail(true));
  rail.addEventListener('click',event=>{if(event.target.closest('a[href]'))closeRail()});
  profileButton.addEventListener('click',()=>{
    const open=!profileIsOpen();
    closeRail();
    profilePanel.hidden=!open;
    profileButton.setAttribute('aria-expanded',String(open));
    profileButton.setAttribute('aria-label',open?'Close profile options':'Open profile options');
    if(open)profilePanel.querySelector('a:not([hidden])')?.focus();
  });
  profilePanel.addEventListener('click',event=>{
    if(event.target.closest('a[href]'))closeProfile();
  });
  document.addEventListener('pointerdown',event=>{
    if(profileIsOpen()&&!profileWrap.contains(event.target))closeProfile();
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      if(rail.classList.contains('is-open')){event.preventDefault();closeRail(true);}
      else if(profileIsOpen()){event.preventDefault();closeProfile(true);}
    }
    if(event.key!=='Tab'||!narrow.matches||!rail.classList.contains('is-open'))return;
    const items=[...rail.querySelectorAll('a[href],button:not([disabled])')].filter(el=>el.getClientRects().length);
    if(!items.length)return;
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  const reset=()=>{if(!narrow.matches)closeRail();};
  narrow.addEventListener?.('change',reset);
  window.addEventListener('pagehide',()=>{closeRail();closeProfile();},{once:true});
  const path=location.pathname.replace(/\/$/,'')||'/';
  const isHome=path==='/corner'||path==='/';
  if(!isHome)return;
  let seen=false;
  try{seen=localStorage.getItem('corner-welcome-v1')==='seen';}catch{seen=false}
  if(seen)return;
  const card=document.createElement('aside');
  card.className='corner-welcome-card';
  card.setAttribute('role','region');
  card.setAttribute('aria-labelledby','corner-welcome-heading');
  card.innerHTML='<button type="button" class="corner-welcome-close" data-welcome-close aria-label="Dismiss welcome card">×</button>'+
   '<p class="corner-welcome-kicker">✳ A LITTLE HELLO</p>'+
   '<h2 id="corner-welcome-heading">Welcome to the Corner.</h2>'+
   '<p>Little stories, good wishes, and moments worth keeping. Take a look around; there’s no rush.</p>'+
   '<div class="corner-welcome-actions"><a href="#feed" data-welcome-explore>Explore stories <span aria-hidden="true">↗</span></a><button type="button" data-auth-open="register">Join the Corner</button></div>';
  const dismiss=()=>{card.remove();try{localStorage.setItem('corner-welcome-v1','seen')}catch{}};
  card.querySelector('[data-welcome-close]').addEventListener('click',dismiss);
  card.querySelector('[data-welcome-explore]').addEventListener('click',dismiss);
  card.querySelector('[data-auth-open]').addEventListener('click',dismiss);
  document.body.append(card);
})();
