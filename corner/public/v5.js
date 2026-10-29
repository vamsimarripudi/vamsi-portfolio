/* V5: relative time, heart particles, threaded conversations, safe local stickers/GIFs. */
(()=>{
 'use strict';
 const prefix=location.pathname.startsWith('/corner')?'/corner':'';
 // V5 owns the public account menu when the archived companion is disabled.
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
   if(opening){const visible=[...profileCard.querySelectorAll('a[href],button')].find(el=>!el.hidden&&el.getClientRects().length);visible?.focus({preventScroll:true});}
  });
  profileCard.addEventListener('click',event=>{if(event.target.closest('a[href]'))close()});
  profileCard.querySelector('[data-profile-dismiss]')?.addEventListener('click',()=>close(true));
  document.addEventListener('pointerdown',event=>{if(!profileCard.hidden&&!profileToggle.parentElement.contains(event.target))close()},{passive:true});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!profileCard.hidden){event.preventDefault();close(true)}});
 }
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 function feedback(message,kind='success'){
  let host=document.querySelector('#toast-stack');
  if(!host){host=document.createElement('div');host.id='toast-stack';host.className='toast-stack';document.body.append(host)}
  const node=document.createElement('div');node.className='toast '+kind;
  node.setAttribute('role','status');node.textContent=String(message);
  host.append(node);setTimeout(()=>node.remove(),4500);
 }
 async function shareLink(url){
  if(navigator.share){
   try{await navigator.share({url});feedback('Shared successfully.');return true}
   catch(error){if(error?.name==='AbortError')return false}
  }
  try{await navigator.clipboard.writeText(url);feedback('Link copied.');return true}
  catch{feedback('Copy was blocked. Use your browser share menu to copy the link.','error');return false}
 }
 const timeText=stamp=>{
  const ms=Date.parse(stamp);if(!Number.isFinite(ms))return '';
  const d=Math.max(0,Math.floor((Date.now()-ms)/1000));
  if(d<5)return 'Just now';if(d<60)return d+' sec ago';
  if(d<3600)return Math.floor(d/60)+' min ago';
  if(d<86400){const h=Math.floor(d/3600);return h+' hr ago';}
  if(d<604800)return Math.floor(d/86400)+(d<172800?' day ago':' days ago');
  if(d<2592000)return Math.floor(d/604800)+(d<1209600?' week ago':' weeks ago');
  if(d<31536000)return Math.floor(d/2592000)+(d<5184000?' month ago':' months ago');
  return Math.floor(d/31536000)+(d<63072000?' year ago':' years ago');
 };
 function updateTimes(root=document){
  $$('time[data-relative]',root).forEach(el=>{
   const stamp=el.getAttribute('datetime');if(!stamp)return;
   el.textContent=timeText(stamp);
   const d=new Date(stamp);if(!Number.isNaN(d.getTime()))el.title=d.toLocaleString(undefined,{dateStyle:'full',timeStyle:'short'});
  });
 }
 updateTimes();const timer=setInterval(()=>{if(!document.hidden)updateTimes()},15000);
 addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 window.CornerRelativeTime=Object.freeze({format:timeText,update:updateTimes});
 const burst=button=>{
  if(reduce.matches||navigator.connection?.saveData)return;
  button.querySelector('.v5-heart-particles')?.remove();
  button.classList.remove('v5-heart-burst');void button.offsetWidth;button.classList.add('v5-heart-burst');
  const particles=document.createElement('img');particles.className='v5-heart-particles';
  particles.src=prefix+'/v5-like-particles.svg#tap-'+Date.now().toString(36);
  particles.setAttribute('aria-hidden','true');particles.alt='';
  button.append(particles);
  setTimeout(()=>{particles.remove();button.classList.remove('v5-heart-burst')},1320);
 };
 document.addEventListener('corner:pulse-action',event=>{
  const {type,target,active}=event.detail||{};
  if(type==='reaction'&&active&&target?.matches?.('[data-v5-like]'))burst(target);
 });
 // Public realtime remains active without the archived floating companion.
 const initial=window.__CORNER__||{};
 if('EventSource' in window&&!initial.demo&&['feed','detail'].includes(initial.page)){
  let connection=null,cursor=Math.max(0,Number(initial.eventCursor)||0);
  const names=['post.published','post.updated','post.archived','status.updated','reaction.updated','comment.created','comment.removed'];
  const handle=event=>{try{
    const data=JSON.parse(event.data),seq=Number(data.seq||event.lastEventId);
    if(!names.includes(data.type)||data.type!==event.type||!Number.isSafeInteger(seq)||seq<=cursor)return;
    cursor=seq;window.CornerPublicLive?.apply(data);
    document.dispatchEvent(new CustomEvent('corner:realtime',{detail:{id:data.id||String(seq),type:data.type,entityId:data.entityId,approved:data.type==='comment.created'}}));
   }catch{/* Invalid real-time events are ignored; no private content is logged. */}};
  const connect=()=>{if(connection||document.hidden)return;connection=new EventSource(prefix+'/api/realtime/stream?since='+encodeURIComponent(cursor));names.forEach(name=>connection.addEventListener(name,handle));};
  const disconnect=()=>{connection?.close();connection=null};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)disconnect();else connect()});
  window.addEventListener('pagehide',disconnect);connect();
 }
 // Non-invasive reading completion indicator; no personal reading history sent by this feature.
 const article=$('.post-article');
 if(article){
  const indicator=document.createElement('div');indicator.className='v5-read-progress';indicator.setAttribute('aria-hidden','true');document.body.append(indicator);
  let frame=0;const update=()=>{frame=0;const rect=article.getBoundingClientRect();const total=Math.max(1,rect.height-innerHeight);const completed=Math.min(1,Math.max(0,-rect.top/total));indicator.style.width=(completed*100).toFixed(1)+'%';};
  const scroll=()=>{if(!frame)frame=requestAnimationFrame(update)};window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',scroll,{passive:true});update();
 }
 // Share published story links from any feed card without tracking recipients.
 document.addEventListener('click',async event=>{
  const share=event.target.closest('[data-v5-share-post]');if(!share)return;
  const path=share.dataset.v5SharePost||'';const url=new URL(path.startsWith(prefix+'/')?path:prefix+path,location.origin).href;
  await shareLink(url);
 });
 // Restore persisted post reactions without exposing reader identity.
 const groups=new Map();
 $$('[data-v5-like]').forEach(button=>{
  const holder=button.closest('.reactions');const id=holder?.dataset.postId;
  if(id){if(!groups.has(id))groups.set(id,[]);groups.get(id).push(holder)}
 });
 groups.forEach(async (holders,id)=>{
  try{
   const response=await fetch(prefix+'/api/posts/'+encodeURIComponent(id)+'/reactions',{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)return;const data=(await response.json()).data;
   for(const holder of holders)holder.querySelectorAll('button[data-reaction]').forEach(button=>{
    const amount=button.querySelector('span');if(amount)amount.textContent=String(data.counts?.[button.dataset.reaction]||0);
    button.setAttribute('aria-pressed',String(data.yours===button.dataset.reaction));
   });
  }catch{/* Existing like state is optional when offline. */}
 });
 const root=$('[data-v5-threads]');
 if(!root)return;
 const postId=root.dataset.postId;const state={comments:[],signedIn:false,ready:false,replyTo:null,replyText:'',sticker:null,gif:null};
 const note=$('[data-v5-comment-status]');
 const say=message=>{if(note)note.textContent=message;};
 const avatar=name=>'<span class="v5-avatar" aria-hidden="true">'+esc(String(name||'R').trim().slice(0,1).toUpperCase()||'R')+'</span>';
 const pickerOptions=(kind)=>{
  if(kind==='sticker')return [['heart','💗'],['sparkle','✨'],['celebrate','🎉'],['wave','👋'],['thanks','🙏'],['wow','🤩']].map(([id,emoji])=>'<button type="button" data-v5-asset="sticker:'+id+'" aria-label="Sticker '+id+'" title="'+id+'">'+emoji+'</button>').join('');
  return [['hearts','Hearts'],['confetti','Celebrate'],['stars','Stars']].map(([id,label])=>'<button type="button" data-v5-asset="gif:'+id+'" aria-label="GIF '+label+'"><img loading="lazy" width="52" height="52" src="'+prefix+'/v5-'+id+'.gif" alt="">'+label+'</button>').join('');
 };
 const assetHtml=(c)=>c.stickerId?'<span class="v5-animated-sticker v5-sticker-'+esc(c.stickerId)+'" role="img" aria-label="'+esc(c.stickerId)+' sticker">'+({heart:'💗',sparkle:'✨',celebrate:'🎉',wave:'👋',thanks:'🙏',wow:'🤩'}[c.stickerId]||'✨')+'</span>':c.gifId?'<img class="v5-comment-gif" loading="lazy" src="'+prefix+'/v5-'+esc(c.gifId)+'.gif" alt="Animated '+esc(c.gifId)+' GIF" width="105" height="105">':'';
 function renderComment(c,depth=0){
  const share=location.origin+prefix+'/post/'+encodeURIComponent(window.__CORNER__?.slug||location.pathname.split('/post/').at(-1)||'')+'#comment-'+encodeURIComponent(c.id);
  const label=c.authorBadge?'<span class="v5-owner-badge">'+esc(c.authorBadge)+'</span>':'';
  const replyCount=state.comments.filter(x=>x.parentId===c.id).length;
  const status=c.pending?'<span class="v6-pending-label" aria-label="Visible only to you while awaiting review">Awaiting review</span>':c.edited?'<span class="v5-edited">Edited</span>':'';
  return '<article id="comment-'+esc(c.id)+'" class="v5-comment'+(depth?' v5-comment-reply':'')+'" data-v5-comment="'+esc(c.id)+'">'+
   '<div class="v5-comment-main">'+
   '<button type="button" class="v5-profile-button" data-v5-profile="'+esc(c.id)+'" aria-label="View '+esc(c.authorName)+' public comment profile">'+avatar(c.authorName)+'</button>'+
   '<div class="v5-comment-copy"><div class="v5-comment-line"><strong>'+esc(c.authorName)+'</strong>'+label+'<time data-relative datetime="'+esc(c.createdAt)+'"></time>'+status+'</div>'+
   (c.body?'<p>'+esc(c.body)+'</p>':'')+assetHtml(c)+
   '<div class="v5-comment-actions">'+
   (c.deleted||c.pending?'':'<button type="button" class="v5-comment-like'+(c.liked?' is-liked':'')+'" data-v5-comment-like="'+esc(c.id)+'" aria-pressed="'+!!c.liked+'" aria-label="Like comment"><img src="'+prefix+'/v5-heart.svg" width="17" height="17" alt=""><span>'+c.reactions+'</span></button>')+
   (c.pending?'':'<button type="button" data-v5-reply="'+esc(c.id)+'">Reply'+(replyCount?' · '+replyCount:'')+'</button>')+
   (c.pending?'':'<button type="button" data-v5-share="'+esc(share)+'">Share</button>')+
   (c.deleted||c.pending?'':'<button type="button" data-v5-report="'+esc(c.id)+'">Report</button>')+
   (c.own?'<button type="button" data-v5-edit="'+esc(c.id)+'">Edit</button><button type="button" data-v5-delete="'+esc(c.id)+'">Delete</button>':'')+'</div>'+
   '<div class="v5-reply-slot" data-v5-reply-slot="'+esc(c.id)+'"></div></div></div></article>';
 }
 function render(){
  const byParent=new Map();for(const c of state.comments){const p=c.parentId||null;if(!byParent.has(p))byParent.set(p,[]);byParent.get(p).push(c)}
  const roots=byParent.get(null)||[];
  root.innerHTML=roots.length?roots.map(c=>'<div class="v5-thread">'+renderComment(c)+
   (byParent.get(c.id)||[]).map(r=>renderComment(r,1)).join('')+'</div>').join(''):'<p class="empty-comments">No approved comments yet. Start a thoughtful conversation.</p>';
  updateTimes(root);
  if(state.replyTo&&root.querySelector('[data-v5-reply-slot="'+CSS.escape(state.replyTo)+'"]'))showReply(state.replyTo);
  if(location.hash.startsWith('#comment-')){
   const target=document.getElementById(location.hash.slice(1));if(target)requestAnimationFrame(()=>target.scrollIntoView({block:'center'}));
  }
 }
 const send=async(url,method='GET',payload)=>{
  const r=await fetch(prefix+url,{method,credentials:'same-origin',cache:'no-store',headers:payload?{'content-type':'application/json'}:undefined,body:payload?JSON.stringify(payload):undefined});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error?.message||'Request failed.');return j.data;
 };
 async function refresh(){
  try{
   const [comments,session]=await Promise.all([send('/api/v5/posts/'+encodeURIComponent(postId)+'/threads'),send('/api/v1/auth/session').catch(()=>null)]);
   state.comments=comments||[];state.signedIn=!!session?.authenticated;state.ready=true;render();
  }catch(error){say(error.message);}
 }
 const replyControls=id=>'<form data-v5-reply-form="'+esc(id)+'" class="v5-reply-form">'+
  '<label for="reply-'+esc(id)+'">Reply to this conversation</label><textarea id="reply-'+esc(id)+'" name="body" rows="2" maxlength="1000" placeholder="Write a thoughtful reply…">'+esc(state.replyText)+'</textarea>'+
  '<div class="v5-reply-tools"><button type="button" data-v5-picker="sticker">😊 Stickers</button><button type="button" data-v5-picker="gif">GIFs</button><button type="button" data-v5-cancel>Cancel</button><button type="submit">Send reply ↗</button></div><div class="v5-picker" data-v5-picker-content hidden></div><p class="v5-selected-asset" data-v5-asset-selected></p></form>';
 function showReply(id){
  const host=root.querySelector('[data-v5-reply-slot="'+CSS.escape(id)+'"]');if(!host)return;
  host.innerHTML=replyControls(id);
  host.querySelector('textarea')?.focus({preventScroll:true});
 }
 root.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-v5-profile')){
   const c=state.comments.find(x=>x.id===b.dataset.v5Profile);if(!c)return;
   let card=root.querySelector('.v5-profile-card');card?.remove();
   card=document.createElement('div');card.className='v5-profile-card';card.setAttribute('role','status');
   card.textContent=c.authorName+(c.authorBadge?' · '+c.authorBadge:'')+' · This is the public comment name. Private account details and reading history remain hidden.';
   b.after(card);setTimeout(()=>card.remove(),8000);return;
  }
  if(b.hasAttribute('data-v5-report')){
   if(!state.signedIn){say('Sign in to report a comment.');return;}
   if(!confirm('Report this comment for moderator review?'))return;
   try{await send('/api/v5/comments/'+encodeURIComponent(b.dataset.v5Report)+'/report','POST',{reason:'inappropriate'});say('Report submitted privately.');}
   catch(error){say(error.message)}return;
  }
  if(b.hasAttribute('data-v5-delete')){
   if(!confirm('Delete your comment? Its replies may remain visible.'))return;
   try{await send('/api/v5/comments/'+encodeURIComponent(b.dataset.v5Delete),'DELETE');await refresh();say('Comment deleted.');}
   catch(error){say(error.message)}return;
  }
  if(b.hasAttribute('data-v5-edit')){
   const c=state.comments.find(x=>x.id===b.dataset.v5Edit);if(!c||!c.own)return;
   const slot=b.closest('.v5-comment-copy')?.querySelector('.v5-reply-slot');if(!slot)return;
   slot.innerHTML='<form class="v5-reply-form" data-v5-edit-form="'+esc(c.id)+'"><label>Edit comment<textarea name="body" maxlength="1000" minlength="3" required>'+esc(c.body)+'</textarea></label><div class="v5-reply-tools"><button type="button" data-v5-cancel>Edit later</button><button type="submit">Save edit</button></div></form>';
   slot.querySelector('textarea')?.focus();return;
  }
  if(b.hasAttribute('data-v5-comment-like')){
   if(!state.signedIn){say('Sign in to like a comment.');return;}
   b.disabled=true;const before=b.getAttribute('aria-pressed')==='true';b.setAttribute('aria-pressed',String(!before));b.classList.toggle('is-liked',!before);
   try{const response=await send('/api/v5/comments/'+encodeURIComponent(b.dataset.v5CommentLike)+'/like','POST',{});
    if(response.liked&&!before)burst(b);
    const c=state.comments.find(x=>x.id===response.commentId);if(c){c.liked=response.liked;c.reactions=response.count}b.classList.toggle('is-liked',response.liked);b.setAttribute('aria-pressed',String(response.liked));b.querySelector('span').textContent=response.count;
   }catch(error){b.classList.toggle('is-liked',before);b.setAttribute('aria-pressed',String(before));say(error.message)}finally{b.disabled=false}return;
  }
  if(b.hasAttribute('data-v5-reply')){
   if(!state.signedIn){say('Sign in to reply.');return;}
   const id=b.dataset.v5Reply;if(state.replyTo===id){state.replyTo=null;const slot=root.querySelector('[data-v5-reply-slot="'+CSS.escape(id)+'"]');if(slot)slot.replaceChildren();}
   else{root.querySelector('.v5-reply-form')?.remove();state.replyTo=id;state.replyText='';state.sticker=null;state.gif=null;showReply(id)}return;
  }
  if(b.hasAttribute('data-v5-share')){
   const url=b.dataset.v5Share;const shared=await shareLink(url);if(shared)say('Comment link shared or copied.');return;
  }
  if(b.hasAttribute('data-v5-cancel')){state.replyTo=null;state.replyText='';state.sticker=null;state.gif=null;b.closest('.v5-reply-form')?.remove();return;}
  if(b.hasAttribute('data-v5-picker')){
   const picker=b.closest('form').querySelector('[data-v5-picker-content]');
   picker.hidden=false;picker.innerHTML=pickerOptions(b.dataset.v5Picker);return;
  }
  if(b.hasAttribute('data-v5-asset')){
   const [kind,id]=b.dataset.v5Asset.split(':');state.sticker=kind==='sticker'?id:null;state.gif=kind==='gif'?id:null;
   const form=b.closest('form');form.querySelector('[data-v5-asset-selected]').textContent='Selected '+kind+': '+id+' · tap again to change';form.querySelector('[data-v5-picker-content]').hidden=true;return;
  }
 });
 root.addEventListener('input',event=>{if(event.target.matches('textarea'))state.replyText=event.target.value});
 root.addEventListener('submit',async event=>{
  const edit=event.target.closest('[data-v5-edit-form]');
  if(edit){event.preventDefault();const save=edit.querySelector('[type=submit]');save.disabled=true;try{const result=await send('/api/v5/comments/'+encodeURIComponent(edit.dataset.v5EditForm),'PATCH',{body:edit.elements.body.value});say(result.message);await refresh();}catch(error){say(error.message);save.disabled=false}return;}
  const form=event.target.closest('[data-v5-reply-form]');if(!form)return;
  event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
  try{const answer=await send('/api/v5/posts/'+encodeURIComponent(postId)+'/threads','POST',{parentId:form.dataset.v5ReplyForm,body:form.elements.body.value,stickerId:state.sticker,gifId:state.gif});
   say(answer.message||'Reply submitted for review.');state.replyTo=null;state.replyText='';state.sticker=null;state.gif=null;form.remove();await refresh();
  }catch(error){say(error.message);button.disabled=false}
 });
 const mainForm=$('#comment-form');
 if(mainForm){const message=mainForm.querySelector('textarea[name=body]');message?.removeAttribute('required');message?.removeAttribute('minlength');}
 mainForm?.addEventListener('submit',async event=>{
  event.preventDefault();event.stopImmediatePropagation();
  const button=mainForm.querySelector('[type=submit]');
  if(!mainForm.elements.body.value.trim()&&!state.sticker&&!state.gif){say('Write a comment or add a sticker.');return;}
  button.disabled=true;
  try{const result=await send('/api/v5/posts/'+encodeURIComponent(postId)+'/threads','POST',{body:mainForm.elements.body.value,stickerId:state.sticker,gifId:state.gif});
   say(result.message||'Comment submitted for review.');mainForm.reset();state.sticker=null;state.gif=null;await refresh();
  }catch(error){say(error.message)}finally{button.disabled=false}
 },true);
 // The top-level form can use the same local sticker/GIF picker as replies.
 const toolsHost=$('[data-v5-main-picker]');
 toolsHost?.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-v5-picker')){const picker=toolsHost.querySelector('[data-v5-picker-content]');picker.hidden=false;picker.innerHTML=pickerOptions(b.dataset.v5Picker);}
  if(b.hasAttribute('data-v5-asset')){const [kind,id]=b.dataset.v5Asset.split(':');state.sticker=kind==='sticker'?id:null;state.gif=kind==='gif'?id:null;toolsHost.querySelector('[data-v5-picker-content]').hidden=true;toolsHost.querySelector('[data-v5-asset-selected]').textContent='Selected '+kind+': '+id;}
 });
 const notify=$('[data-v5-notifications]');
 notify?.addEventListener('click',async()=>{
  if(!state.signedIn){say('Sign in to view your reply notifications.');return;}
  try{const entries=await send('/api/v5/notifications');let panel=$('[data-v5-notification-panel]');
   if(!panel){panel=document.createElement('section');panel.dataset.v5NotificationPanel='';panel.className='v5-notice-panel';notify.after(panel)}
   panel.replaceChildren();const title=document.createElement('strong');title.textContent='Your replies';panel.append(title);
   entries.forEach(entry=>{const a=document.createElement('a');a.href=prefix+entry.href;a.textContent=entry.authorName+' replied to '+entry.storyTitle+' · '+timeText(entry.at);panel.append(a)});
   if(!entries.length){const p=document.createElement('p');p.textContent='No new replies yet.';panel.append(p)}
  }catch(error){say(error.message)}
 });
 document.addEventListener('corner:realtime',event=>{
  if(['comment.created','comment.removed'].includes(event.detail?.type)&&event.detail.entityId===postId)refresh();
 });
 refresh();
})();
