/* Corner V6 Quick Conversations. Canonical links remain functional without JavaScript. */
(()=>{
 'use strict';
 if(typeof HTMLDialogElement==='undefined'||!('showModal' in HTMLDialogElement.prototype))return;
 const prefix=location.pathname.startsWith('/corner')?'/corner':'';
 const idPattern=/^post_[0-9a-f-]{36}$/i;
 let dialog=null,trigger=null,postId=null,replyTo=null,signedIn=false,busy=false,serial=0;
 const get=(selector)=>dialog?.querySelector(selector);
 const api=async(path,method='GET',payload)=>{
  const response=await fetch(prefix+path,{
   method,credentials:'same-origin',cache:'no-store',
   headers:payload?{'content-type':'application/json'}:undefined,
   body:payload?JSON.stringify(payload):undefined
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error?.message||'Could not contact Corner.');
  return data.data;
 };
 const element=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
 };
 function setup(){
  dialog=document.createElement('dialog');
  dialog.className='v6-conversation-sheet';
  dialog.setAttribute('aria-labelledby','v6-conversation-title');
  dialog.innerHTML=
   '<div class="v6-sheet-shell">'+
   '<header class="v6-sheet-head"><div><small>THE CONVERSATION</small>'+
   '<strong id="v6-conversation-title"></strong></div>'+
   '<button class="v6-sheet-close" type="button" aria-label="Close conversation">×</button></header>'+
   '<section class="v6-sheet-list" role="region" aria-label="Published and personal pending comments" aria-live="polite"></section>'+
   '<form class="v6-sheet-form">'+
   '<label for="v6-comment-text">Your reply</label>'+
   '<textarea id="v6-comment-text" name="body" maxlength="1000" minlength="3" placeholder="Write something thoughtful…" required></textarea>'+
   '<p class="v6-sheet-status" role="status" aria-live="polite"></p>'+
   '<div class="v6-sheet-footer"><a class="v6-sheet-full" href="#">Read full story ↗</a>'+
   '<button type="submit" class="v6-sheet-send">Post reply</button></div></form></div>';
  document.body.append(dialog);
  get('.v6-sheet-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
  dialog.addEventListener('close',()=>{
   document.dispatchEvent(new CustomEvent('corner:v6-modal',{detail:{open:false}}));
   if(trigger?.isConnected)trigger.focus({preventScroll:true});
   trigger=null;postId=null;replyTo=null;busy=false;
  });
  get('.v6-sheet-form').addEventListener('submit',submit);
  get('.v6-sheet-list').addEventListener('click',event=>{
   const reply=event.target.closest('button[data-v6-reply]');
   if(!reply||!signedIn)return;
   replyTo=reply.dataset.v6Reply;
   const author=reply.dataset.v6Author||'reader';
   const field=get('textarea');
   field.placeholder='Reply to '+author+'…';
   get('.v6-sheet-status').textContent='Replying to '+author;
   field.focus({preventScroll:true});
  });
 }
 function announce(message){const node=get('.v6-sheet-status');if(node)node.textContent=message}
 function render(comments){
  const list=get('.v6-sheet-list');if(!list)return;
  list.replaceChildren();
  const published=comments.filter(c=>!c.pending&&!c.deleted);
  const owned=comments.filter(c=>c.pending);
  const header=element('p','v6-sheet-summary',
   published.length+' approved '+(published.length===1?'comment':'comments')+
   (owned.length?' · '+owned.length+' awaiting review (visible only to you)':''));
  list.append(header);
  for(const c of comments.slice(0,18)){
   const row=element('article','v6-sheet-comment');
   row.dataset.pending=String(!!c.pending);
   row.id='v6-comment-'+String(c.id||'');
   const who=element('strong','',String(c.authorName||'Reader'));
   const time=element('small','',c.pending?'Awaiting your author’s review':(window.CornerRelativeTime?.format?.(c.createdAt)||''));
   row.append(who,document.createTextNode(' '),time);
   if(c.body)row.append(element('p','',String(c.body)));
   if(c.stickerId)row.append(element('p','',String(c.stickerId)+' sticker'));
   if(c.gifId)row.append(element('p','','Animated '+String(c.gifId)));
   if(!c.pending&&!c.deleted&&signedIn){
    const reply=element('button','','Reply');
    reply.type='button';reply.dataset.v6Reply=String(c.id);
    reply.dataset.v6Author=String(c.authorName||'reader');
    reply.setAttribute('aria-label','Reply to '+String(c.authorName||'reader'));
    row.append(reply);
   }
   list.append(row);
  }
  if(!comments.length)list.append(element('p','v6-sheet-empty','No approved comments yet. Begin a thoughtful conversation.'));
  if(comments.length>18)list.append(element('p','v6-sheet-summary','Open the full story to read more replies.'));
 }
 async function refresh(requestId){
  try{
   const [comments,session]=await Promise.all([
    api('/api/v5/posts/'+encodeURIComponent(postId)+'/threads'),
    api('/api/v1/auth/session').catch(()=>null)
   ]);
   if(requestId!==serial||!dialog.open)return;
   signedIn=!!session?.authenticated;
   render(Array.isArray(comments)?comments:[]);
   const field=get('textarea'),button=get('.v6-sheet-send'),label=get('.v6-sheet-form label');
   field.disabled=!signedIn;button.disabled=!signedIn;
   label.textContent=signedIn?'Your reply':'Sign in to participate';
   if(!signedIn)announce('Sign in to join the discussion. The full story link stays available.');
   else if(!busy)announce('');
  }catch(error){
   if(requestId===serial&&dialog.open){
    get('.v6-sheet-list').replaceChildren(element('p','v6-sheet-empty','Conversation unavailable. Open the full story to try again.'));
    announce(error.message);
   }
  }
 }
 async function open(link){
  const value=link.dataset.postId;
  if(!idPattern.test(value))return;
  if(!dialog)setup();
  postId=value;replyTo=null;signedIn=false;trigger=link;busy=false;
  const title=link.closest('.story')?.querySelector('h2')?.textContent?.trim()||'Story conversation';
  get('#v6-conversation-title').textContent=title;
  const url=new URL(link.href,location.href);
  const href=get('.v6-sheet-full');href.href=url.href;
  get('.v6-sheet-list').replaceChildren(element('p','v6-sheet-empty','Loading the conversation…'));
  get('textarea').value='';get('textarea').disabled=true;
  get('.v6-sheet-send').disabled=true;announce('');
  const requestId=++serial;
  if(!dialog.open)dialog.showModal();
  document.dispatchEvent(new CustomEvent('corner:v6-modal',{detail:{open:true}}));
  get('.v6-sheet-close').focus({preventScroll:true});
  await refresh(requestId);
 }
 async function submit(event){
  event.preventDefault();
  if(!dialog?.open||!signedIn||busy||!postId)return;
  const field=get('textarea'),body=field.value.trim();
  if(body.length<3){announce('Write at least three characters.');return}
  busy=true;get('.v6-sheet-send').disabled=true;announce('Sending your reply…');
  const id=serial;
  try{
   const payload={body};if(replyTo)payload.parentId=replyTo;
   const sent=await api('/api/v5/posts/'+encodeURIComponent(postId)+'/threads','POST',payload);
   if(id!==serial||!dialog.open)return;
   field.value='';replyTo=null;field.placeholder='Write something thoughtful…';
   await refresh(id);
   announce(sent?.state==='pending'?'Awaiting review. Only you and moderators can see this reply.':
    'Your reply is live.');
  }catch(error){if(id===serial&&dialog.open)announce(error.message)}
  finally{busy=false;if(dialog?.open)get('.v6-sheet-send').disabled=!signedIn}
 }
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[data-v6-conversation][data-post-id]');
  if(!link||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||
    event.button!==0||link.target==='_blank')return;
  if(!idPattern.test(link.dataset.postId))return;
  event.preventDefault();open(link).catch(()=>{location.assign(link.href)});
 });
 document.addEventListener('corner:realtime',event=>{
  if(dialog?.open&&postId===event.detail?.entityId&&['comment.created','comment.removed'].includes(event.detail?.type)){
   refresh(serial);
  }
 });
 window.addEventListener('pagehide',()=>{if(dialog?.open)dialog.close()});
})();
