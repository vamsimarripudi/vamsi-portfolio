(() => {
'use strict';
const readingSignal=detail=>document.dispatchEvent(new CustomEvent('corner:reading-action',{detail}));
// UI-only: no text or identity in character signals.
const pulseAction=(type,target,extra={})=>document.dispatchEvent(new CustomEvent('corner:pulse-action',{detail:{type,target,...extra}}));
const initial=window.__CORNER__||{};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const safe=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const toastStack=$('#toast-stack');
let reactionPending=0;
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
button.disabled=true;reactionPending++;
try{let response=await request(`/corner/api/posts/${encodeURIComponent(wrapper.dataset.postId)}/reactions`,{reaction:button.dataset.reaction});
$$('.reactions button',wrapper).forEach(b=>{b.querySelector('span').textContent=response.counts[b.dataset.reaction]||0;window.CornerMotion?.count(b.querySelector('span'));b.setAttribute('aria-pressed',String(response.yours===b.dataset.reaction))});
window.CornerMotion?.react(button,response.yours===button.dataset.reaction);if(response.yours===button.dataset.reaction)readingSignal('react');
pulseAction('reaction',button,{active:response.yours===button.dataset.reaction});
}catch(err){readingSignal('request_failed');toast(err.message,'error');pulseAction('error',button);}finally{button.disabled=false;reactionPending--}
});
});
$('[data-copy-url]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('Link copied.','success');window.CornerReaderMotion?.share($('[data-copy-url]'));readingSignal('share');request('/corner/api/analytics/event',{type:'share',postId:initial.postId,path:location.pathname,device:innerWidth<768?'mobile':'desktop'}).catch(()=>{
});}catch{toast('Select the address to copy.','error')} });
$('#comment-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=$('button[type="submit"]',form);button.disabled=true;
try{const result=await request(`/corner/api/posts/${encodeURIComponent(form.dataset.postId)}/comments`,{body:form.elements.body.value});toast(result.message||'Comment sent for review.','success');readingSignal('comment_success');form.reset();window.CornerReaderMotion?.comment(button,result?.state==='pending');pulseAction('comment',button);}
catch(err){readingSignal('request_failed');toast(err.message,'error');pulseAction('error',button);}finally{button.disabled=false}
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
const postId=initial.postId;
// Optional companion owns the shared live connection; core keeps UI effects.
window.CornerPublicLive=Object.freeze({reactionPending:()=>reactionPending>0,apply(data){
   if(initial.page==='feed'){
    if(['post.published','post.updated','post.archived'].includes(data.type))showUpdate('A new note is ready.');
    if(data.type==='status.updated')window.CornerPulse?.apply?.(data.payload?.status||null);
   }
    if(data.type==='reaction.updated'&&initial.page==='detail'&&data.entityId===postId)$$('.reactions button').forEach(button=>{const n=$('span',button);if(n){n.textContent=data.payload?.counts?.[button.dataset.reaction]||0;window.CornerMotion?.count(n)}});
   if(initial.page==='detail'&&data.type==='comment.created'&&data.entityId===postId)toast('The conversation was updated.');
}});
// Optional member bookmarks.
const bookmark=$('[data-bookmark-post]');
if(bookmark&&initial.page==='detail'&&!initial.demo&&postId){
const getJson=async(url,init={})=>{const reply=await fetch(url,{credentials:'same-origin',cache:'no-store',...init});const body=await reply.json().catch(()=>({}));if(!reply.ok)throw Error(body.error?.message||'Could not update bookmarks');return body.data};
getJson('/corner/api/v1/auth/session').then(async session=>{
if(!session?.authenticated||session.scope!=='member')return;
bookmark.hidden=false;
const saved=await getJson('/corner/api/v1/me/bookmarks');
let active=saved.some(p=>p.id===postId);
const draw=()=>{bookmark.textContent=active?'Saved to your profile ★':'Save for later ☆';bookmark.setAttribute('aria-pressed',String(active))};
draw();
bookmark.addEventListener('click',async()=>{
bookmark.disabled=true;
try{
if(active)await getJson('/corner/api/v1/me/bookmarks/'+encodeURIComponent(postId),{method:'DELETE'});
else await getJson('/corner/api/v1/me/bookmarks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({postId})});
active=!active;draw();window.CornerReaderMotion?.bookmark(bookmark,active);
}catch(err){toast(err.message,'error')}finally{bookmark.disabled=false}
});
}).catch(()=>{});
}
// First-party, short-retention statistics. The identifier cookie is only used for abuse reduction.
if(!navigator.globalPrivacyControl&&navigator.doNotTrack!=='1'&&!document.cookie.includes('corner_reading_consent=deny')&&(initial.page==='feed'||initial.page==='detail'))request('/corner/api/analytics/event',{type:initial.page==='detail'?'post_open':'page_view',path:location.pathname,postId:postId||null,device:innerWidth<768?'mobile':innerWidth<1024?'tablet':'desktop'}).catch(()=>{});
})();
