/** Persistent Light/Dark appearance for private Corner Studio pages only. */
(() => {
  'use strict';
  const root=document.documentElement;
  if(location.pathname.includes('/admin')!==true&&window.__CORNER__?.page!=='account')return;
  const KEY='corner-studio-theme';
  const media=matchMedia('(prefers-color-scheme: dark)');
  const read=()=>{try{const value=localStorage.getItem(KEY);return value==='dark'||value==='light'?value:null}catch{return null}};
  const save=value=>{try{localStorage.setItem(KEY,value)}catch{/* preference storage is optional */}};
  const current=()=>root.dataset.studioTheme==='dark'?'dark':'light';
  const system=()=>media.matches?'dark':'light';
  const color={light:'#f8f7f3',dark:'#0d100e'};
  const syncControls=()=>{
    const dark=current()==='dark';
    document.querySelectorAll('[data-studio-theme-toggle]').forEach(button=>{
      button.setAttribute('aria-pressed',String(dark));
      button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');
      button.title=dark?'Switch to light mode':'Switch to dark mode';
    });
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=color[dark?'dark':'light'];
  };
  const apply=(value,{persist=false,announce=false}={})=>{
    const theme=value==='dark'?'dark':'light';
    root.dataset.studioTheme=theme;
    root.style.colorScheme=theme;
    if(persist)save(theme);
    syncControls();
    if(announce){
      const live=document.querySelector('#toast-stack');
      if(live){const note=document.createElement('div');note.className='toast';note.textContent=theme==='dark'?'Dark mode':'Light mode';live.append(note);setTimeout(()=>note.remove(),1800)}
    }
    window.dispatchEvent(new CustomEvent('corner:themechange',{detail:{theme}}));
    return theme;
  };
  const toggle=()=>apply(current()==='dark'?'light':'dark',{persist:true,announce:true});
  const bind=()=>{
    syncControls();
    document.querySelectorAll('[data-studio-theme-toggle]').forEach(button=>{
      if(button.dataset.themeBound)return;
      button.dataset.themeBound='1';
      button.addEventListener('click',toggle);
    });
  };
  // The inline head bootstrap normally set this before paint; this is the fail-safe.
  if(!root.dataset.studioTheme)apply(read()||system()); else syncControls();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
  window.addEventListener('storage',event=>{if(event.key===KEY)apply(read()||system())});
  media.addEventListener?.('change',()=>{if(!read())apply(system())});
  window.CornerStudioTheme={get:current,set:value=>apply(value,{persist:true}),toggle};
})();
