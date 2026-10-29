/* Corner V5 public interactions: local relative time, threaded comments and consent-aware UI. */
(()=>{
'use strict';
const prefix=location.pathname.startsWith('/corner')?'/corner':'';
const $=(q,r=document)=>r.querySelector(q),$$=(q,r=document)=>[...r.querySelectorAll(q)];
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const relative=stamp=>{
 const n=Date.parse(stamp);if(!Number.isFinite(n))return '';
 const d=Math.max(0,Math.floor((Date.now()-n)/1000));
 if(d<5)return 'Just now';
 if(d<60)return d+' sec ago';
 if(d<3600)return Math.floor(d/60)+' min ago';
 if(d<86400)return Math.floor(d/3600)+' hr ago';
 if(d<604800){const v=Math.floor(d/86400);return v+' day'+(v===1?'':'s')+' ago'}
 if(d<2592000){const v=Math.floor(d/604800);return v+' week'+(v===1?'':'s')+' ago'}
 if(d<31536000){const v=Math.floor(d/2592000);return v+' month'+(v===1?'':'s')+' ago'}
 const v=Math.floor(d/31536000);return v+' year'+(v===1?'':'s')+' ago';
};
function updateTimes(scope=document){$$('time[data-relative]',scope).forEach(el=>{
 const timestamp=el.getAttribute('datetime');if(!timestamp)return;
 el.textContent=relative(timestamp);const d=new Date(timestamp);
 if(!Number.isNaN(d.getTime()))el.title=d.toLocaleString(undefined,{dateStyle:'full',timeStyle:'short'});
})}
updateTimes();const ticker=setInterval(()=>{if(!document.hidden)updateTimes()},15000);
addEventListener('pagehide',()=>clearInterval(ticker),{once:true});
window.CornerRelativeTime=Object.freeze({format:relative,update:updateTimes});
const flash=button=>{if(reduce.matches||navigator.connection?.saveData)return;
 button.classList.remove('v5-heart-burst');void button.offsetWidth;button.classList.add('v5-heart-burst');
 button.addEventListener('animationend',()=>button.classList.remove('v5-heart-burst'),{once:true});
};
document.addEventListener('corner:pulse-action',event=>{
 const d=event.detail||{};if(d.type==='reaction'&&d.active&&d.target?.matches?.('[data-v5-like]'))flash(d.target);
});
const request=async(endpoint,method='GET',data)=>{
 const r=await fetch(prefix+endpoint,{method,credentials:'same-origin',cache:'no-store',
  headers:data===undefined?undefined:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error?.message||'This action could not be completed.');return j.data;
};
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-v5-share-post]');if(!b)return;
 const url=new URL(prefix+b.dataset.v5SharePost,location.origin).href;
 try{if(navigator.share)await navigator.share({url});else await navigator.clipboard.writeText(url)}catch{}
});
$$('.reactions[data-post-id]').forEach(async wrapper=>{
 try{const data=await request('/api/v5/posts/'+encodeURIComponent(wrapper.dataset.postId)+'/like-state');if(!data)return;
  const b=$('button[data-reaction="❤️"]',wrapper);if(b){b.setAttribute('aria-pressed',String(data.liked));const n=$('span',b);if(n)n.textContent=data.count}
 }catch{}
});
const article=$('.post-article');
if(article){
 const progress=document.createElement('div');progress.className='v5-read-progress';progress.setAttribute('aria-hidden','true');document.body.append(progress);
 let frame=0;const update=()=>{frame=0;const bounds=article.getBoundingClientRect();const range=Math.max(1,bounds.height-innerHeight);progress.style.width=(Math.min(1,Math.max(0,-bounds.top/range))*100).toFixed(1)+'%'};
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});update();
}
const initial=window.__CORNER__||{};
if('EventSource' in window&&!initial.demo&&!document.querySelector('script[src*="/companion.js"]')&&['feed','detail'].includes(initial.page)){
 let stream=null,cursor=Math.max(0,Number(initial.eventCursor)||0);
 const types=['post.published','post.updated','post.archived','status.updated','reaction.updated','comment.created','comment.removed'];
 const emit=event=>{try{
   const data=JSON.parse(event.data),id=Number(data.seq||event.lastEventId);
   if(!types.includes(data.type)||data.type!==event.type||!Number.isSafeInteger(id)||id<=cursor)return;
   cursor=id;window.CornerPublicLive?.apply(data);
   document.dispatchEvent(new CustomEvent('corner:realtime',{detail:{type:data.type,entityId:data.entityId,approved:data.type==='comment.created'}}));
  }catch{}};
 const connect=()=>{if(stream||document.hidden)return;stream=new EventSource(prefix+'/api/realtime/stream?since='+encodeURIComponent(cursor));types.forEach(name=>stream.addEventListener(name,emit))};
 const disconnect=()=>{stream?.close();stream=null};
 addEventListener('pagehide',disconnect);document.addEventListener('visibilitychange',()=>document.hidden?disconnect():connect());connect();
}
// Keep public profile and navigation functional even when the companion is disabled.
if(!document.querySelector('script[src*="/companion.js"]')){
 const button=$('[data-corner-profile-toggle]'),panel=$('[data-corner-profile-card]');
 const nav=$('[data-corner-rail-toggle]'),rail=$('#corner-rail-nav'),backdrop=$('[data-corner-rail-backdrop]');
 const closeProfile=focus=>{if(!panel)return;panel.hidden=true;button?.setAttribute('aria-expanded','false');if(focus)button?.focus()};
 const closeRail=()=>{rail?.classList.remove('is-open');if(backdrop)backdrop.hidden=true;nav?.setAttribute('aria-expanded','false');document.documentElement.classList.remove('corner-drawer-open')};
 button?.addEventListener('click',()=>{const open=panel.hidden;closeRail();panel.hidden=!open;button.setAttribute('aria-expanded',String(open))});
 document.addEventListener('pointerdown',event=>{if(!panel?.hidden&&!button?.parentElement?.contains(event.target))closeProfile(false)},{passive:true});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!panel?.hidden)closeProfile(true);else if(rail?.classList.contains('is-open'))closeRail()}});
 panel?.addEventListener('click',event=>{if(event.target.closest('a[href]'))closeProfile(false)});
 nav?.addEventListener('click',()=>{const open=!rail?.classList.contains('is-open');closeProfile(false);if(open){rail?.classList.add('is-open');if(backdrop)backdrop.hidden=false;nav.setAttribute('aria-expanded','true');document.documentElement.classList.add('corner-drawer-open')}else closeRail()});
 backdrop?.addEventListener('click',closeRail);
 rail?.addEventListener('click',event=>{if(event.target.closest('a[href]'))closeRail()});
}
const root=$('[data-v5-threads]');if(!root)return;
const postId=root.dataset.postId,note=$('[data-v5-comment-status]');
const state={items:[],member:false,replyTo:null,replyText:'',asset:null};
const say=msg=>{if(note)note.textContent=String(msg||'')};
const assets={heart:'💗',sparkle:'✨',celebrate:'🎉',wave:'👋',thanks:'🙏',wow:'🤩'};
const animations={hearts:'💞',confetti:'🎊',stars:'🌟'};
const attachment=c=>c.stickerId?'<span class="v5-animated-sticker" role="img" aria-label="'+esc(c.stickerId)+' sticker">'+assets[c.stickerId]+'</span>':
 c.gifId?'<span class="v5-animated-sticker" role="img" aria-label="'+esc(c.gifId)+' animation">'+animations[c.gifId]+'</span>':'';
const picker=kind=>(kind==='sticker'?Object.entries(assets):Object.entries(animations)).map(([key,glyph])=>
 '<button type="button" data-v5-asset="'+kind+':'+key+'" aria-label="'+esc(kind+' '+key)+'">'+glyph+'</button>').join('');
const profile=name=>'<span class="v5-avatar" aria-hidden="true">'+esc((name||'R').trim().slice(0,1).toUpperCase()||'R')+'</span>';
function itemHtml(c,nested=false){
 const href=location.origin+location.pathname+'#comment-'+encodeURIComponent(c.id);
 return '<article class="v5-comment'+(nested?' v5-comment-reply':'')+'" id="comment-'+esc(c.id)+'"><div class="v5-comment-main">'+
 '<button class="v5-profile-button" type="button" data-v5-profile="'+esc(c.id)+'" aria-label="View comment author">'+profile(c.authorName)+'</button>'+
 '<div class="v5-comment-copy"><div class="v5-comment-line"><strong>'+esc(c.authorName)+'</strong>'+
 (c.authorBadge?'<span class="v5-owner-badge">'+esc(c.authorBadge)+'</span>':'')+
 '<time data-relative datetime="'+esc(c.createdAt)+'"></time>'+(c.edited?'<span class="v5-edited">Edited</span>':'')+'</div>'+
 '<p>'+esc(c.body||'')+'</p>'+attachment(c)+'<div class="v5-comment-actions">'+
 (c.deleted?'':'<button type="button" class="v5-comment-like'+(c.liked?' is-liked':'')+'" data-v5-comment-like="'+esc(c.id)+'" aria-pressed="'+!!c.liked+'"><img src="'+prefix+'/v5-heart.svg" width="19" height="19" alt=""> Like <span>'+Number(c.reactions||0)+'</span></button>')+
 '<button type="button" data-v5-reply="'+esc(c.id)+'">Reply</button>'+
 '<button type="button" data-v5-share="'+esc(href)+'">Share</button>'+
 (c.deleted?'':'<button type="button" data-v5-report="'+esc(c.id)+'">Report</button>')+
 (c.own?'<button type="button" data-v5-edit="'+esc(c.id)+'">Edit</button><button type="button" data-v5-delete="'+esc(c.id)+'">Delete</button>':'')+
 '</div><div data-v5-slot="'+esc(c.id)+'"></div></div></div></article>';
}
function draw(){
 const parents=new Map();state.items.forEach(c=>{const key=c.parentId||null;if(!parents.has(key))parents.set(key,[]);parents.get(key).push(c)});
 root.innerHTML=(parents.get(null)||[]).map(c=>'<div class="v5-thread">'+itemHtml(c)+(parents.get(c.id)||[]).map(x=>itemHtml(x,true)).join('')+'</div>').join('')||'<p class="empty-comments">No approved comments yet.</p>';
 updateTimes(root);
 if(location.hash.startsWith('#comment-')){const el=document.getElementById(location.hash.slice(1));el?.scrollIntoView({block:'center'})}
}
async function refresh(){try{
 const [items,session]=await Promise.all([request('/api/v5/posts/'+encodeURIComponent(postId)+'/threads'),request('/api/v1/auth/session').catch(()=>null)]);
 state.items=Array.isArray(items)?items:[];state.member=!!session?.authenticated;draw();
}catch(e){say(e.message)}}
function tools(id){
 return '<form data-v5-reply-form="'+esc(id)+'" class="v5-reply-form"><label>Reply<textarea name="body" rows="2" maxlength="1000" placeholder="Write a kind reply…"></textarea></label>'+
 '<div class="v5-reply-tools"><button type="button" data-v5-picker="sticker">Stickers</button><button type="button" data-v5-picker="gif">GIFs</button><button type="button" data-v5-cancel>Cancel</button><button type="submit">Send reply</button></div><div class="v5-picker" data-v5-picker-content hidden></div><p data-v5-asset-selected></p></form>';
}
root.addEventListener('click',async event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.v5Profile){const c=state.items.find(x=>x.id===b.dataset.v5Profile);if(!c)return;root.querySelector('.v5-profile-card')?.remove();
  const div=document.createElement('div');div.className='v5-profile-card';div.textContent=c.authorName+(c.authorBadge?' · '+c.authorBadge:'')+' · Public comment profile only. Personal account details and reading history are private.';b.after(div);return;}
 if(b.dataset.v5CommentLike){if(!state.member){say('Sign in to like comments.');return}
  b.disabled=true;try{const x=await request('/api/v5/comments/'+encodeURIComponent(b.dataset.v5CommentLike)+'/like','POST',{});b.setAttribute('aria-pressed',String(x.liked));b.classList.toggle('is-liked',x.liked);$('span',b).textContent=x.count;if(x.liked)flash(b);const item=state.items.find(q=>q.id===x.commentId);if(item){item.liked=x.liked;item.reactions=x.count}}catch(e){say(e.message)}finally{b.disabled=false}return;}
 if(b.dataset.v5Share){try{if(navigator.share)await navigator.share({url:b.dataset.v5Share});else{await navigator.clipboard.writeText(b.dataset.v5Share);say('Comment link copied.')}}catch{say('Use the browser share menu.')}return;}
 if(b.dataset.v5Report){if(!state.member){say('Sign in to report a comment.');return}if(!confirm('Report this comment privately?'))return;
  try{await request('/api/v5/comments/'+encodeURIComponent(b.dataset.v5Report)+'/report','POST',{reason:'inappropriate'});say('Report received for moderation.')}catch(e){say(e.message)}return;}
 if(b.dataset.v5Delete){if(!confirm('Delete your comment? Replies may stay visible.'))return;try{await request('/api/v5/comments/'+encodeURIComponent(b.dataset.v5Delete),'DELETE');await refresh()}catch(e){say(e.message)}return;}
 if(b.dataset.v5Edit){const item=state.items.find(x=>x.id===b.dataset.v5Edit);if(!item?.own)return;const slot=b.closest('.v5-comment-copy').querySelector('[data-v5-slot]');slot.innerHTML='<form data-v5-edit-form="'+esc(item.id)+'" class="v5-reply-form"><label>Edit comment<textarea required minlength="3" maxlength="1000" name="body">'+esc(item.body)+'</textarea></label><div class="v5-reply-tools"><button type="button" data-v5-cancel>Cancel</button><button type="submit">Save changes</button></div></form>';slot.querySelector('textarea').focus();return;}
 if(b.dataset.v5Reply){if(!state.member){say('Sign in to reply.');return}const slot=root.querySelector('[data-v5-slot="'+CSS.escape(b.dataset.v5Reply)+'"]');root.querySelectorAll('.v5-reply-form').forEach(f=>f.remove());slot.innerHTML=tools(b.dataset.v5Reply);state.asset=null;slot.querySelector('textarea').focus();return;}
 if(b.hasAttribute('data-v5-cancel')){b.closest('form')?.remove();state.asset=null;return;}
 if(b.dataset.v5Picker){const pickerHost=b.closest('form')?.querySelector('[data-v5-picker-content]');if(!pickerHost)return;pickerHost.hidden=false;pickerHost.innerHTML=picker(b.dataset.v5Picker);return;}
 if(b.dataset.v5Asset){const [kind,id]=b.dataset.v5Asset.split(':');state.asset={kind,id};b.closest('form')?.querySelector('[data-v5-asset-selected]')?.replaceChildren(document.createTextNode('Selected '+kind+': '+id));b.closest('[data-v5-picker-content]').hidden=true;}
});
root.addEventListener('submit',async event=>{
 const edit=event.target.closest('[data-v5-edit-form]');if(edit){event.preventDefault();const submit=edit.querySelector('[type=submit]');submit.disabled=true;try{const r=await request('/api/v5/comments/'+encodeURIComponent(edit.dataset.v5EditForm),'PATCH',{body:edit.elements.body.value});say(r.message);await refresh()}catch(e){say(e.message);submit.disabled=false}return;}
 const form=event.target.closest('[data-v5-reply-form]');if(!form)return;event.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;
 try{const data={parentId:form.dataset.v5ReplyForm,body:form.elements.body.value,stickerId:state.asset?.kind==='sticker'?state.asset.id:null,gifId:state.asset?.kind==='gif'?state.asset.id:null};const r=await request('/api/v5/posts/'+encodeURIComponent(postId)+'/threads','POST',data);say(r.message);form.remove();state.asset=null;await refresh()}catch(e){say(e.message);submit.disabled=false}
});
const main=$('#comment-form');main?.addEventListener('submit',async event=>{
 event.preventDefault();event.stopImmediatePropagation();const b=main.querySelector('[type=submit]');b.disabled=true;
 try{const r=await request('/api/v5/posts/'+encodeURIComponent(postId)+'/threads','POST',{body:main.elements.body.value,stickerId:state.asset?.kind==='sticker'?state.asset.id:null,gifId:state.asset?.kind==='gif'?state.asset.id:null});say(r.message);main.reset();state.asset=null;await refresh()}catch(e){say(e.message)}finally{b.disabled=false}
},true);
$('[data-v5-main-picker]')?.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;const panel=$('[data-v5-main-picker]'),target=$('[data-v5-picker-content]',panel);
 if(b.dataset.v5Picker){target.hidden=false;target.innerHTML=picker(b.dataset.v5Picker)}
 if(b.dataset.v5Asset){const [kind,id]=b.dataset.v5Asset.split(':');state.asset={kind,id};target.hidden=true;$('[data-v5-asset-selected]',panel).textContent='Selected '+kind+': '+id}
});
$('[data-v5-notifications]')?.addEventListener('click',async event=>{
 if(!state.member){say('Sign in to view replies.');return}
 try{const entries=await request('/api/v5/notifications');let host=$('[data-v5-notice-panel]');if(!host){host=document.createElement('section');host.className='v5-notice-panel';host.dataset.v5NoticePanel='';event.currentTarget.after(host)}
 host.replaceChildren();const h=document.createElement('strong');h.textContent='Your replies';host.append(h);
 entries.forEach(x=>{const link=document.createElement('a');link.href=prefix+x.href;link.textContent=x.authorName+' replied · '+relative(x.at);host.append(link)});
 if(!entries.length){const p=document.createElement('p');p.textContent='No replies yet.';host.append(p)}
 }catch(e){say(e.message)}
});
document.addEventListener('corner:realtime',event=>{if(['comment.created','comment.removed'].includes(event.detail?.type)&&event.detail.entityId===postId)refresh()});
refresh();
})();