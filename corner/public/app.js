(() => {
  'use strict';
  const initial=window.__CORNER__||{};
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const safe=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const toastStack=$('#toast-stack');
  function toast(message,variant='info'){
    if(!toastStack)return;
    const el=document.createElement('div');el.className='toast '+variant;
    const text=document.createElement('span');text.textContent=message;
    const button=document.createElement('button');button.textContent='×';button.setAttribute('aria-label','Dismiss notification');button.addEventListener('click',()=>el.remove());
    el.append(text,button);toastStack.append(el);setTimeout(()=>el.remove(),4500);
  }
  async function request(url,body,method='POST'){
    const options=body===undefined?{}:{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)};
    let response=await fetch(url,{credentials:'same-origin',...options});
    let result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error?.message||'Something went wrong.');
    return result.data;
  }
  const dialog=$('#search-dialog'), searchInput=$('#search-input'), results=$('#search-results');
  $('[data-search-open]')?.addEventListener('click',()=>{if(!dialog)return;dialog.showModal();searchInput?.focus()});
  $('[data-search-close]')?.addEventListener('click',()=>dialog?.close());
  dialog?.addEventListener('click',(event)=>{if(event.target===dialog)dialog.close()});
  let searchWait;
  searchInput?.addEventListener('input',()=>{clearTimeout(searchWait);let q=searchInput.value.trim();if(!q){results.innerHTML='<p>Start with a word.</p>';return;}
    searchWait=setTimeout(async()=>{try{let posts=await request('/corner/api/search?q='+encodeURIComponent(q));
      if(q!==searchInput.value.trim())return;
      results.innerHTML=posts.length?posts.map(p=>`<a class="search-result" href="/corner/post/${encodeURIComponent(p.slug)}"><small>${safe(p.type?.replaceAll('_',' ').toUpperCase()||'UPDATE')}</small><strong>${safe(p.title)}</strong><p>${safe(p.excerpt||'')}</p></a>`).join(''):'<p>No matching notes just yet.</p>';
    }catch{results.innerHTML='<p>Search is unavailable right now.</p>'}},190);
  });
  $$('.reactions button').forEach(button=>{
    button.setAttribute('aria-pressed','false');button.addEventListener('click',async()=>{
      const wrapper=button.closest('.reactions');if(!wrapper)return;
      button.disabled=true;
      try{let response=await request(`/corner/api/posts/${encodeURIComponent(wrapper.dataset.postId)}/reactions`,{reaction:button.dataset.reaction});
        $$('.reactions button').forEach(b=>{b.querySelector('span').textContent=response.counts[b.dataset.reaction]||0;b.setAttribute('aria-pressed',String(response.yours===b.dataset.reaction))});
      }catch(err){toast(err.message,'error');}finally{button.disabled=false}
    });
  });
  $('[data-copy-url]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('Link copied.','success');request('/corner/api/analytics/event',{type:'share',postId:initial.postId,path:location.pathname,device:innerWidth<768?'mobile':'desktop'}).catch(()=>{});}catch{toast('Select the address to copy.','error')} });
  $('#comment-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;
    try{const result=await request(`/corner/api/posts/${encodeURIComponent(form.dataset.postId)}/comments`,{name:form.elements.name.value,body:form.elements.body.value});toast(result.message||'Comment sent for review.','success');form.reset();}
    catch(err){toast(err.message,'error')}finally{button.disabled=false}
  });
  const loadMore=$('[data-load-more]');
  function renderCard(p){return `<article class="story story-${safe(p.type)}" data-id="${safe(p.id)}" data-version="${Number(p.version)||1}"><div class="story-top"><span class="meta category">${safe(p.type.replaceAll('_',' ').toUpperCase())}</span><span class="status-tag">UPDATE</span></div><div class="story-copy"><p class="story-count">${safe((p.published_at||'').slice(0,10))}</p><h2><a href="/corner/post/${encodeURIComponent(p.slug)}">${safe(p.title)}</a></h2><p class="story-excerpt">${safe(p.excerpt||'')}</p><div class="story-bottom"><span class="read-meta">READ UPDATE</span><a class="read-link" href="/corner/post/${encodeURIComponent(p.slug)}">Read ↗</a></div></div></article>`}
  loadMore?.addEventListener('click',async()=>{
    loadMore.disabled=true;loadMore.textContent='Loading…';
    try{let response=await fetch('/corner/api/posts?category='+encodeURIComponent(initial.category||'Latest')+'&cursor='+encodeURIComponent(loadMore.dataset.cursor));let data=await response.json();if(!response.ok)throw Error('Load failed');const container=$('#stories');container?.insertAdjacentHTML('beforeend',data.data.map(renderCard).join(''));if(data.meta.nextCursor){loadMore.dataset.cursor=data.meta.nextCursor;loadMore.textContent='More from the corner ↓';loadMore.disabled=false;}else loadMore.remove();}
    catch{toast('Could not load more updates. Try again.','error');loadMore.textContent='Try again ↓';loadMore.disabled=false;}
  });
  let pending=0;const badge=$('[data-new-updates]');
  const revealButton=$('[data-apply-updates]');
  function showUpdate(message){pending++;if(badge){badge.hidden=false;$('span',badge).textContent=`${pending} new ${pending===1?'update':'updates'}`;}else if(!initial.demo&&message)toast(message)}
  revealButton?.addEventListener('click',()=>{pending=0;badge.hidden=true;location.assign((initial.category&&initial.category!=='Latest')?'/corner/category/'+initial.category.toLowerCase():'#feed');if(initial.category==='Latest')location.reload()});
  if(window.EventSource&&initial.page==='feed'&&!initial.demo){let stream=new EventSource('/corner/api/realtime/stream?since='+encodeURIComponent(initial.eventCursor||0));let lastByEntity=new Map();
    const onEvent=(event)=>{try{const data=JSON.parse(event.data),key=data.entityId;let previous=lastByEntity.get(key)||0;if(data.version<previous)return;lastByEntity.set(key,data.version);
      if(data.type==='post.published'||data.type==='post.updated'||data.type==='post.archived')showUpdate('A new note is ready.');
      if(data.type==='status.updated'){const status=data.payload?.status;let current=$('.now-status strong');if(current)current.textContent=status?.label||'Keeping a little corner alive.';}
    }catch{/* ignore malformed or non-critical browser events */} };
    ['post.published','post.updated','post.archived','status.updated'].forEach(kind=>stream.addEventListener(kind,onEvent));
    window.addEventListener('pagehide',()=>stream.close(),{once:true});
  }
  const postId=initial.postId;
  if(initial.page==='detail'&&!initial.demo&&postId){let stream=new EventSource('/corner/api/realtime/stream?since='+encodeURIComponent(initial.eventCursor||0));stream.addEventListener('reaction.updated',event=>{try{let r=JSON.parse(event.data);if(r.entityId!==postId)return;$$('.reactions button').forEach(button=>{let n=$('span',button);if(n)n.textContent=r.payload?.counts?.[button.dataset.reaction]||0})}catch{/* ignore malformed or non-critical browser events */}});stream.addEventListener('comment.created',event=>{try{if(JSON.parse(event.data).entityId===postId)toast('The conversation was updated.')}catch{/* ignore malformed or non-critical browser events */}});window.addEventListener('pagehide',()=>stream.close(),{once:true});}
  // First-party, short-retention statistics. The identifier cookie is only used for abuse reduction.
  if(initial.page==='feed'||initial.page==='detail')request('/corner/api/analytics/event',{type:initial.page==='detail'?'post_open':'page_view',path:location.pathname,postId:postId||null,device:innerWidth<768?'mobile':innerWidth<1024?'tablet':'desktop'}).catch(()=>{});
})();
