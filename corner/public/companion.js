/* Corner Pulse: original tiny companion. Not a chatbot or simulated user; every update comes from Corner's first-party API. */
(() => {
  'use strict';
  const prefix=location.pathname.startsWith('/corner')?'/corner':'';
  if(!prefix||document.querySelector('.admin-shell,.signin-wrap'))return;
  const dock=document.createElement('div');
  dock.className='corner-orbit-dock';
  dock.innerHTML=
    '<span class="corner-orbit-flow" aria-hidden="true"><i></i><i></i><i></i></span>'+
    '<button type="button" class="corner-orbit-toggle" aria-label="Open Corner Pulse, latest stories and live updates" aria-haspopup="true" aria-controls="corner-orbit-card" aria-expanded="false">'+
      '<span class="corner-orbit-toy" aria-hidden="true"><span class="corner-orbit-sprout">✦</span><span class="corner-orbit-face"><span class="corner-orbit-eye"></span><span class="corner-orbit-eye"></span><span class="corner-orbit-smile"></span></span><span class="corner-orbit-star">✧</span></span>'+
      '<span class="corner-orbit-button-text">Pulse</span>'+
    '</button>'+
    '<section class="corner-orbit-card" id="corner-orbit-card" aria-labelledby="corner-orbit-heading" hidden>'+
      '<div class="corner-orbit-head"><div><p class="corner-orbit-kicker">A LITTLE CORNER PULSE</p><h2 id="corner-orbit-heading">What’s happening?</h2></div><button type="button" class="corner-orbit-close" aria-label="Close Corner Pulse">×</button></div>'+
      '<p class="corner-orbit-explainer">A window into published notes and what’s happening now. No AI chat or invented activity.</p>'+
      '<div class="corner-orbit-reading"><span class="corner-orbit-status-label">CURRENTLY</span><strong data-orbit-status>Checking the Corner…</strong><p data-orbit-detail>Showing real updates from this space.</p></div>'+
      '<div class="corner-orbit-latest"><span class="corner-orbit-status-label">LATEST STORY</span><a data-orbit-story href="/corner/" hidden></a><p data-orbit-story-empty>Looking for the latest published note…</p></div>'+
      '<div class="corner-orbit-actions"><a href="/corner/#feed">Explore stories ↗</a><a href="/corner/category/wishes">Wishes ✦</a></div>'+
      '<div class="corner-orbit-live-line" data-orbit-live aria-live="polite">Updates on demand</div>'+
    '</section>';
  document.body.append(dock);
  const button=dock.querySelector('.corner-orbit-toggle'),card=dock.querySelector('.corner-orbit-card');
  const close=dock.querySelector('.corner-orbit-close'),note=dock.querySelector('[data-orbit-status]');
  const detail=dock.querySelector('[data-orbit-detail]'),story=dock.querySelector('[data-orbit-story]');
  const storyEmpty=dock.querySelector('[data-orbit-story-empty]'),live=dock.querySelector('[data-orbit-live]');
  let stream=null,refreshing=false,queued=false,opened=false;
  const setLine=text=>{live.textContent=text;};
  const get=async(path)=>{
    const response=await fetch(prefix+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Not available');
    const body=await response.json();
    return body.data;
  };
  async function refresh(){
    if(refreshing){queued=true;return}
    refreshing=true;
    try{
      const results=await Promise.allSettled([get('/api/status'),get('/api/posts?limit=1')]);
      if(!opened)return;
      const status=results[0];
      if(status.status==='fulfilled'){
        const current=status.value?.status;
        note.textContent=current?.label||'Keeping a little corner alive.';
        detail.textContent=current?.detail||'A space for small things worth remembering.';
      }else{
        note.textContent='Status is temporarily unavailable.';
        detail.textContent='The rest of the Corner remains open.';
      }
      const feed=results[1];
      if(feed.status==='fulfilled'&&Array.isArray(feed.value)&&feed.value[0]?.slug){
        const item=feed.value[0];
        story.textContent=item.title||'Latest note';
        story.href=prefix+'/post/'+encodeURIComponent(item.slug);
        story.hidden=false;storyEmpty.hidden=true;
      }else{
        story.hidden=true;storyEmpty.hidden=false;
        storyEmpty.textContent=feed.status==='fulfilled'?'No published stories yet.':'Recent stories temporarily unavailable.';
      }
    }finally{
      refreshing=false;
      if(queued){queued=false;if(opened)refresh()}
    }
  }
  function disconnect(){if(stream){stream.close();stream=null;}}
  function connect(){
    if(!window.EventSource)return;
    disconnect();
    const cursor=Math.max(0,Number(window.__CORNER__?.eventCursor)||0);
    stream=new EventSource(prefix+'/api/realtime/stream?since='+cursor);
    stream.addEventListener('open',()=>{if(opened)setLine('Live updates connected · first-party');});
    stream.addEventListener('error',()=>{if(opened)setLine('Live connection interrupted · you can refresh');});
    for(const type of ['status.updated','post.published','post.updated','post.archived'])
      stream.addEventListener(type,()=>{if(opened)refresh()});
  }
  function setOpen(next,returnFocus=false){
    opened=next;card.hidden=!next;
    button.setAttribute('aria-expanded',String(next));
    button.setAttribute('aria-label',next?'Close Corner Pulse':'Open Corner Pulse, latest stories and live updates');
    dock.classList.toggle('is-open',next);
    if(next){
      note.textContent='Checking the Corner…';
      storyEmpty.textContent='Looking for the latest published note…';
      setLine('Checking for fresh updates…');
      refresh();connect();close.focus();
    }else{
      disconnect();setLine('Updates on demand');
      if(returnFocus)button.focus();
    }
  }
  button.addEventListener('click',()=>setOpen(!opened));
  close.addEventListener('click',()=>setOpen(false,true));
  document.addEventListener('pointerdown',event=>{
    if(opened&&!dock.contains(event.target))setOpen(false);
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if(opened&&event.key==='Escape'){
      event.preventDefault();setOpen(false,true);
    }
  });
  document.addEventListener('visibilitychange',()=>{
    if(!opened)return;
    if(document.hidden){disconnect();setLine('Updates paused while away');}
    else{refresh();connect()}
  });
  window.addEventListener('pagehide',disconnect,{once:true});
})();
