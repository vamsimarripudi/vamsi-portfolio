/** Private, owner-scoped Command workspace. No model output is treated as HTML or authority. */
(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const paths={plus:'M12 5v14M5 12h14',send:'m5 12 7-7 7 7M12 5v14',history:'M3 11a9 9 0 1 1 2.3 7M3 4v7h7M12 7v5l3 2',more:'M5 12h.01M12 12h.01M19 12h.01',close:'m6 6 12 12M6 18 18 6',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',image:'M4 4h16v16H4ZM4 16l5-5 4 4 3-3 4 4M15 8h.01',clip:'m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8',queue:'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',check:'m5 12 4 4L19 6',down:'m6 9 6 6 6-6',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',edit:'m15 4 5 5-11 11H4v-5ZM13 6l5 5',stop:'M6 6h12v12H6Z',copy:'M8 8h12v12H8ZM4 16V4h12',archive:'M3 4h18v4H3ZM5 8v12h14V8M9 12h6',download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',mic:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5 11v1a7 7 0 0 0 14 0v-1 M12 19v3 M8 22h8'};
 const icon=name=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
 const button=(action,label,name=action)=>`<button type="button" class="cc-icon" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}">${icon(name)}</button>`;
 const key=()=>crypto.randomUUID();
 let current=null;
 const storage={get(k){try{return JSON.parse(sessionStorage.getItem('corner.chat.'+k))}catch{return null}},set(k,v){try{sessionStorage.setItem('corner.chat.'+k,JSON.stringify(v))}catch{/* Server history is independent of device storage. */}},del(k){try{sessionStorage.removeItem('corner.chat.'+k)}catch{/* Storage may be unavailable. */}}};
 const inline=s=>esc(s).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`\n]+)`/g,'<code>$1</code>');
 function prose(text){
  return String(text||'').split(/```/).map((part,i)=>i%2?'<pre><code>'+esc(part.replace(/^[a-z0-9_-]*\n/i,''))+'</code></pre>':part.split(/\n\s*\n/).map(block=>{
   if(/^#{1,4} /.test(block))return '<h3>'+inline(block.replace(/^#{1,4} /,''))+'</h3>';
   const lines=block.split('\n');if(lines.every(line=>/^[-*] /.test(line)))return '<ul>'+lines.map(line=>'<li>'+inline(line.slice(2))+'</li>').join('')+'</ul>';
   return '<p>'+lines.map(inline).join('<br>')+'</p>';
  }).join('')).join('');
 }
 const draftKey=s=>s.initial.ownerId+':'+s.scope+':'+(s.conversation?.id||'new');
 function saveDraft(s){if(!s.root?.isConnected)return;const input=s.root.querySelector('#cc-input');if(!input)return;storage.set(draftKey(s),{text:input.value,mode:s.mode,fileIds:s.fileIds,request:s.request,createKey:s.createKey})}
 function restoreDraft(s){const d=storage.get(draftKey(s))||{};s.input.value=typeof d.text==='string'?d.text.slice(0,6000):'';s.mode=['chat','image'].includes(d.mode)?d.mode:'chat';s.fileIds=Array.isArray(d.fileIds)?d.fileIds.filter(v=>typeof v==='string').slice(0,3):[];s.request=d.request||null;s.createKey=d.createKey||key();resizeInput(s);renderComposer(s)}
 function unmount(){if(!current)return;const s=current;if(s.movedFooter)document.querySelector('.admin-sidebar')?.append(s.movedFooter);saveDraft(s);try{if(s.recorder&&s.recorder.state!=='inactive')s.recorder.stop()}catch{/* Recorder may already be inactive during navigation. */};for(const track of s.voiceStream?.getTracks?.()||[])track.stop();clearTimeout(s.voiceTimer);window.speechSynthesis?.cancel?.();s.abort.abort();clearTimeout(s.timer);clearTimeout(s.searchTimer);s.dialogs.forEach(d=>d.remove());s.root.classList.remove('cc-root');s.root.style.removeProperty('height');document.documentElement.classList.remove('cc-active');current=null}
 function clearDrafts(){try{for(const k of Object.keys(sessionStorage))if(k.startsWith('corner.chat.'))sessionStorage.removeItem(k)}catch{/* Optional local storage. */}}
 const live=s=>current===s&&!s.abort.signal.aborted;
 function url(s,suffix='',scope=s.scope){return s.base+suffix+(suffix.includes('?')?'&':'?')+'workspace='+encodeURIComponent(scope)}
 const request=(s,suffix,method='GET',body,scope=s.scope)=>s.api(url(s,suffix,scope),method,body,{signal:s.abort.signal});
 const pending=s=>(s.data.messages||[]).find(m=>m.role==='assistant'&&m.status==='pending');
 const imageBusy=s=>(s.data.proposals||[]).some(p=>p.status==='approved');
 function showError(s,error,retry=null){if(!live(s)||error?.name==='AbortError')return;const el=s.root.querySelector('.cc-error');el.hidden=false;el.querySelector('span').textContent=error?.message||String(error);s.retryAction=retry;el.querySelector('[data-action="retry-error"]').hidden=!retry;}
 function clearError(s){s.root.querySelector('.cc-error').hidden=true;s.retryAction=null}
 function resizeInput(s){s.input.style.height='auto';s.input.style.height=Math.min(s.input.scrollHeight,160)+'px'}
 function viewport(s){if(!live(s))return;const v=window.visualViewport,top=s.root.getBoundingClientRect().top;const bottom=(v?.height||innerHeight)+(v?.offsetTop||0);s.root.style.height=Math.max(230,Math.floor(bottom-top-8))+'px'}
 function renderComposer(s){
  if(!live(s))return;const isPending=!!pending(s),disabled=s.sending||s.uploading||s.voiceBusy||imageBusy(s)||s.conversation?.status==='archived';
  const send=s.root.querySelector('[data-action="send"]');send.innerHTML=icon(isPending?'stop':'send');send.title=isPending?'Stop response':'Send message';send.setAttribute('aria-label',send.title);send.disabled=disabled&&!isPending;
  const voice=s.root.querySelector('[data-action="voice"]');if(voice){const listening=!!s.recorder&&s.recorder.state==='recording';voice.innerHTML=icon(listening?'stop':'mic');voice.title=listening?'Stop listening':'Voice command';voice.setAttribute('aria-label',voice.title);voice.classList.toggle('is-listening',listening);voice.disabled=!listening&&(disabled||!s.caps?.voiceReady||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined');}
  s.input.disabled=s.conversation?.status==='archived';s.input.placeholder=s.mode==='image'?'Describe the image you want to create…':'What’s on your mind?';
  const mode=s.root.querySelector('.cc-mode');mode.hidden=s.mode!=='image';
  s.root.querySelector('.cc-network').textContent=!navigator.onLine?'Offline · draft saved on this device':s.recorder?.state==='recording'?'Listening… tap the mic again to send':s.voiceBusy?'Transcribing voice command…':s.conversation?.status==='archived'?'Archived conversation · restore it from History to continue':s.uploading?'Uploading private attachment…':s.caps&&!s.caps.aiReady?'AI unavailable · your queue and capture tools still work':'Private workspace · you approve every action';
  const files=s.data.files||[];s.root.querySelector('.cc-files').innerHTML=s.fileIds.map(id=>{const f=files.find(f=>f.id===id);return `<span class="cc-file">${icon('clip')}<span>${esc(f?.filename||'Private attachment')}</span><button type="button" data-remove-file="${esc(id)}" aria-label="Remove ${esc(f?.filename||'attachment')}">${icon('close')}</button></span>`}).join('');
  s.root.querySelector('[data-action="tools"]').disabled=disabled;
 }
 function fileUrl(s,fileId,download=false){return url(s,'/conversations/'+s.conversation.id+'/files/'+encodeURIComponent(fileId))+(download?'&download=1':'')}
 function proposalCard(s,p){
  const action=p.action_type,payload=p.payload||{},result=p.result||{},image=action==='image.generate',editable=p.status==='proposed';
  const headings={'image.generate':'Image brief','queue.create':'Add to your queue','queue.update':'Update queue status','post.create':'Create Corner draft','post.update':'Edit Corner post','comment.moderate':'Moderate comment'};
  let body='';
  if(image)body=`<p class="cc-image-brief">${esc(String(payload.prompt||'').slice(0,140))}</p><details class="cc-image-details"><summary>Details</summary><blockquote>${esc(payload.prompt)}</blockquote><dl><div><dt>Provider</dt><dd>${esc(payload.provider)} · ${esc(payload.model)}</dd></div><div><dt>Output</dt><dd>1 image · 1024 × 1024</dd></div><div><dt>Destination</dt><dd>Private conversation</dd></div><div><dt>Allowance</dt><dd>$${Number(payload.allowanceUsd||0).toFixed(2)}</dd></div></dl></details>`;
  else if(action==='post.create'||action==='post.update')body=`<h4>${esc(payload.title)}</h4>${payload.excerpt?`<p>${esc(payload.excerpt)}</p>`:''}<blockquote>${esc(String(payload.body||'').slice(0,1200))}${String(payload.body||'').length>1200?'…':''}</blockquote><div class="cc-meta">${action==='post.create'?'New draft':'Edit existing post'} · ${esc(payload.type||'note')} · comments ${payload.allowComments?'on':'off'} · reactions ${payload.allowReactions?'on':'off'}${payload.beforeState?' · current state '+esc(payload.beforeState):''}</div>`;
  else if(action==='comment.moderate')body=`<h4>${esc(payload.title||'Comment')}</h4><blockquote>${esc(payload.excerpt||'')}</blockquote><div class="cc-meta">${esc(payload.authorName||'Commenter')} · ${esc(payload.before||'current')} → ${esc(payload.state)}</div>`;
  else body=`<h4>${esc(payload.title)}</h4><p>${esc(payload.detail||'')}</p><div class="cc-meta">${esc(payload.kind||'Status')} · ${esc(payload.priority||payload.before||'')} ${payload.state?'→ '+esc(payload.state):''}${payload.dueAt?' · Due '+esc(new Date(payload.dueAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}))+' IST':''}</div>`;
  if(image&&p.status==='approved')body+=`<div class="cc-image-progress" role="status"><span>${icon('spark')}</span><strong>Generating your image</strong><small>Request approved. No second charge will be started by a repeated click.</small></div>`;
  if(image&&p.status==='executed'&&result.fileId)body+=`<a class="cc-generated" href="${fileUrl(s,result.fileId)}" target="_blank" rel="noopener"><img src="${fileUrl(s,result.fileId)}" alt="${esc(payload.prompt.slice(0,200))}" loading="lazy"></a><p class="cc-caption">Generated image · private, not published.</p>`;
  if(!image&&p.status==='executed'){
   const success=action==='post.create'?`Draft created: ${result.title||payload.title}.`:action==='post.update'?`Post updated: ${result.title||payload.title}.`:action==='comment.moderate'?`Comment ${result.state||payload.state}.`:`Confirmed in your ${s.scope} queue: ${result.state}.`;
   body+=`<p class="cc-success">${icon('check')} ${esc(success)}</p>`;
  }
  if(p.status==='failed')body+=`<p class="cc-failure">${image?'No image was confirmed. The provider may have processed the request. Check usage before requesting a new image.':'This action did not complete. The original record remains unchanged unless the result above explicitly says otherwise.'}</p>`;
  if(p.status==='expired')body+='<p class="cc-caption">This approval expired. Request a fresh proposal before making a change.</p>';
  const canImage=s.caps?.imageReady,canEdit=['image.generate','queue.create','post.create','post.update'].includes(action);
  const approveLabel=image?(canImage?'Approve generation':'Image provider unavailable'):action==='post.create'?'Create draft':action==='post.update'?'Apply edit':action==='comment.moderate'?'Apply moderation':'Confirm change';
  const notice=image?'Charges use your configured provider account. Daily generation limit: 5.':action==='post.create'?'Creates a draft only. It does not publish the story.':action==='post.update'?'Applies this exact edit after rechecking the post version. Publishing state is not changed.':action==='comment.moderate'?'Applies only the selected moderation state after rechecking the comment.':'Creates or updates a queue record only; it does not schedule a notification or perform the task.';
  return `<section class="cc-proposal ${image?'cc-proposal--image '+p.status:''}" data-proposal="${esc(p.id)}"><header><span>${icon(image?'image':action.startsWith('post.')?'edit':action==='comment.moderate'?'more':'queue')}${esc(headings[action]||'Review action')}</span><small class="cc-status ${esc(p.status)}">${esc(p.status)}</small></header>${body}${editable?`<div class="cc-card-actions">${canEdit?`<button type="button" data-edit-proposal="${esc(p.id)}">Edit</button>`:''}<button type="button" data-decide="reject" data-id="${esc(p.id)}">Dismiss</button><button type="button" class="cc-primary" data-decide="approve" data-id="${esc(p.id)}" ${image&&!canImage?'disabled':''}>${esc(approveLabel)}</button></div><p class="cc-caption">${esc(notice)}</p>`:''}</section>`;
 }
 function queueCards(items){return `<div class="cc-queue">${items.map(item=>`<article><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p><small>${esc(item.kind)} · ${esc(item.priority)} · ${esc(item.state)} · evidence: ${esc(item.evidenceStatus)}${item.dueAt?' · '+esc(new Date(item.dueAt).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})):''}</small>${item.sourceRef?'<p class="cc-source">Source: '+esc(item.sourceRef)+'</p>':''}</div><button type="button" data-review-item="${esc(item.id)}">Review status</button></article>`).join('')}</div>`}
 function renderMessages(s,older=false){
  const sig=JSON.stringify(s.data);if(sig===s.signature)return;s.signature=sig;const log=s.log,oldHeight=log.scrollHeight,oldTop=log.scrollTop,near=oldHeight-oldTop-log.clientHeight<90;
  const messages=s.data.messages||[],proposals=s.data.proposals||[],files=s.data.files||[];
  s.root.querySelector('.cc-empty').hidden=messages.length>0;
  s.root.querySelector('.cc-conversation-title').textContent=s.conversation?.title==='New conversation'?'Your private workspace':s.conversation?.title||'Your private workspace';
  s.root.querySelector('[data-action="older"]').hidden=!s.data.nextBefore;
  log.querySelector('.cc-messages').innerHTML=messages.map(m=>{
   const parts=m.parts||{},mine=m.role==='user',attached=files.filter(f=>f.message_id===m.id&&!f.generated);
   let body=`<div class="${mine?'cc-user-text':'cc-prose'}">${mine?esc(m.content):prose(m.content)}</div>`;
   if(m.status==='pending')body=`<div class="cc-thinking" role="status"><span class="cc-pulse">${icon('spark')}</span><span>${esc(parts.stage||'Thinking')}<i aria-hidden="true">···</i></span></div>`;
   if(m.status==='cancelled')body+='<p class="cc-caption">Response stopped. Your message is saved.</p>';
   if(['failed','cancelled'].includes(m.status)&&m.sequence===messages.at(-1)?.sequence)body+=`<button type="button" class="cc-retry" data-retry-turn="${esc(m.turn_id)}">Retry response</button>`;
   if(attached.length)body+=`<div class="cc-sent-files">${attached.map(f=>`<a href="${fileUrl(s,f.id,true)}" download>${icon('clip')}${esc(f.filename)}</a>`).join('')}</div>`;
   if(parts.items?.length)body+=queueCards(parts.items);
   if(parts.signals?.length)body+=parts.signals.map(g=>'<h4>'+esc(g.label)+'</h4>'+queueCards(g.items)).join('');
   body+=proposals.filter(p=>p.message_id===m.id).map(p=>proposalCard(s,p)).join('');
   return `<article class="cc-message ${mine?'cc-user':'cc-assistant'}" data-message="${esc(m.id)}"><span class="cc-speaker">${mine?'You':icon('spark')+'Command'}</span>${body}${!mine&&m.status==='complete'&&m.content?`<button type="button" class="cc-copy" data-copy="${esc(m.id)}" aria-label="Copy response" title="Copy response">${icon('copy')}</button>`:''}</article>`;
  }).join('')+proposals.filter(p=>!p.message_id).map(p=>proposalCard(s,p)).join('');
  if(older)log.scrollTop=oldTop+log.scrollHeight-oldHeight;else if(near||s.forceScroll)log.scrollTop=log.scrollHeight;else log.scrollTop=oldTop;
  s.forceScroll=false;s.root.querySelector('[data-action="bottom"]').hidden=log.scrollHeight-log.scrollTop-log.clientHeight<90;
  s.root.querySelector('.cc-announcement').textContent=pending(s)?'Command is responding':imageBusy(s)?'Image generation in progress':messages.length?'Conversation saved':'';
  speakVoiceReply(s,messages);renderComposer(s);
 }
 async function reload(s,{older=false}={}){
  if(!s.conversation||!live(s))return;const epoch=s.epoch,id=s.conversation.id,scope=s.scope;
  const data=await request(s,'/conversations/'+id+(older?'?before='+s.data.nextBefore:''),'GET',undefined,scope);
  if(!live(s)||epoch!==s.epoch)return;
  if(older){const ids=new Set(data.messages.map(m=>m.id));data.messages=[...data.messages,...s.data.messages.filter(m=>!ids.has(m.id))]}
  else if(s.data.messages.length>40){const min=data.messages[0]?.sequence||0;data.messages=[...s.data.messages.filter(m=>m.sequence<min),...data.messages]}
  s.conversation=data.conversation;s.data=data;
  if(s.request&&data.messages.some(m=>m.idempotency_key===s.request.requestKey)){s.request=null;s.input.value='';s.fileIds=[];saveDraft(s)}
  renderMessages(s,older);schedule(s);
 }
 function schedule(s){clearTimeout(s.timer);if(!live(s)||!s.conversation)return;s.timer=setTimeout(async()=>{try{await reload(s)}catch(error){showError(s,error,()=>reload(s));if(live(s))s.timer=setTimeout(()=>schedule(s),4000)}},document.hidden?12000:pending(s)||imageBusy(s)?1500:15000)}
 async function openConversation(s,id){
  saveDraft(s);s.epoch++;clearTimeout(s.timer);s.conversation={id};s.data={messages:[],proposals:[],files:[]};s.signature='';s.forceScroll=true;storage.set(s.initial.ownerId+':last:'+s.scope,id);restoreDraft(s);
  try{await reload(s);restoreDraft(s)}catch(error){showError(s,error,()=>openConversation(s,id))}
 }
 function newChat(s,{discard=false}={}){if(!discard)saveDraft(s);s.sending=false;s.uploading=false;s.epoch++;clearTimeout(s.timer);s.conversation=null;s.data={messages:[],proposals:[],files:[]};s.signature='';s.forceScroll=true;s.request=null;storage.del(s.initial.ownerId+':last:'+s.scope);restoreDraft(s);renderMessages(s);clearError(s);s.input.focus()}
 async function ensureConversation(s){
  if(s.conversation)return s.conversation;const epoch=s.epoch,scope=s.scope;
  if(!s.creating)s.creating=request(s,'/conversations','POST',{workspace:scope,requestKey:s.createKey}).finally(()=>{s.creating=null});
  const c=await s.creating;if(!live(s)||epoch!==s.epoch)throw new DOMException('View changed','AbortError');
  saveDraft(s);const draft=storage.get(draftKey(s));storage.del(draftKey(s));s.conversation=c;storage.set(draftKey(s),draft);storage.set(s.initial.ownerId+':last:'+scope,c.id);return c;
 }
 function dialog(s,{title,body,submit,label='Save',danger=false}){
  const opener=document.activeElement,d=document.createElement('dialog');d.className='cc-dialog';d.innerHTML=`<form><header><h2>${esc(title)}</h2><button type="button" class="cc-icon" data-close aria-label="Close">${icon('close')}</button></header><div class="cc-dialog-body">${body}</div><p class="cc-dialog-error" role="alert"></p>${submit?`<footer><button type="button" data-close>Cancel</button><button type="submit" class="${danger?'cc-danger':'cc-primary'}">${esc(label)}</button></footer>`:''}</form>`;
  s.root.append(d);s.dialogs.add(d);d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.onclick=e=>{if(e.target===d)d.close()};
  d.onclose=()=>{s.dialogs.delete(d);d.remove();const categoryMenu=opener?.closest?.('.cc-category-menu'),target=categoryMenu?s.root.querySelector('[data-action="categories"]'):opener;if(target?.isConnected)target.focus()};
  if(submit)d.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=d.querySelector('[type="submit"]');b.disabled=true;try{await submit(new FormData(e.target),d);d.close()}catch(error){d.querySelector('.cc-dialog-error').textContent=error.message}finally{b.disabled=false}};
  d.showModal();return d;
 }
 function speakVoiceReply(s,messages){
  if(!s.voiceReplyAfter||!('speechSynthesis' in window))return;const msg=[...messages].reverse().find(m=>m.role==='assistant'&&m.status==='complete'&&m.sequence>s.voiceReplyAfter&&m.content);if(!msg||msg.id===s.voiceSpoken)return;s.voiceSpoken=msg.id;s.voiceReplyAfter=0;try{window.speechSynthesis.cancel();const utter=new SpeechSynthesisUtterance(String(msg.content).slice(0,900));utter.rate=1.02;utter.pitch=.96;window.speechSynthesis.speak(utter)}catch{/* Voice playback is optional. */}
 }
 async function voiceCommand(s){
  if(s.recorder&&s.recorder.state==='recording'){s.recorder.stop();return}
  if(!s.caps?.voiceReady)throw Error('Voice transcription is not connected.');if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('Voice recording is not supported in this browser.');
  if(!s.caps.aiConsent){privacy(s,()=>voiceCommand(s));return}
  clearError(s);const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}),types=['audio/webm;codecs=opus','audio/webm','audio/mp4'],mime=types.find(type=>MediaRecorder.isTypeSupported?.(type))||'';
  const recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream),chunks=[];s.voiceStream=stream;s.recorder=recorder;
  recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
  recorder.onerror=()=>showError(s,Error('Voice recording stopped unexpectedly.'));
  recorder.onstop=async()=>{clearTimeout(s.voiceTimer);for(const track of stream.getTracks())track.stop();s.recorder=null;s.voiceStream=null;s.voiceBusy=true;renderComposer(s);try{const blob=new Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'});if(blob.size<16)throw Error('I could not hear a voice command.');const response=await fetch(url(s,'/transcribe?name=voice-command'),{method:'POST',credentials:'same-origin',headers:{'content-type':blob.type||'audio/webm'},body:blob,signal:s.abort.signal});const data=await response.json();if(!response.ok)throw Error(data.error?.message||'Voice transcription failed.');const transcript=String(data.data?.text||'').trim();if(!transcript)throw Error('I could not hear a clear command.');s.input.value=transcript;resizeInput(s);saveDraft(s);s.voiceReplyAfter=Math.max(0,...(s.data.messages||[]).map(m=>Number(m.sequence)||0));await send(s,{message:transcript,mode:'chat'});}catch(error){showError(s,error)}finally{if(live(s)){s.voiceBusy=false;renderComposer(s)}}};
  recorder.start();s.voiceTimer=setTimeout(()=>{try{if(recorder.state==='recording')recorder.stop()}catch{/* Recorder may already have stopped. */}},30000);renderComposer(s);
 }
 function privacy(s,after=null){return dialog(s,{title:'Your private AI workspace',body:`<p>Your messages, selected attachments, microphone recordings you choose to send, and requested owner records—such as queue items, Corner overview metrics, posts and comments—may be sent to OpenAI to produce a response. Voice recordings are transcribed for the command and are not stored by Corner. Personal and KRAVIA conversations remain separate.</p><p>Conversations and private files stay in Corner until you delete them. Archiving does not delete them. Requests use <code>store:false</code>; provider abuse-monitoring retention may still apply.</p><p>Command cannot publish, send email, deploy, or execute your tasks. Queue changes and image generation require your explicit approval.</p>`,label:s.caps.aiConsent&&!after?'Disable AI access':'Allow AI for my workspace',submit:async()=>{const accepted=!!after||!s.caps.aiConsent;await request(s,'/consent','POST',{accepted});s.caps.aiConsent=accepted;if(after)await after()}})}
 async function send(s,{message=s.input.value,mode=s.mode,fields={}}={}){
  if(s.sending||s.uploading||pending(s)||imageBusy(s))return;if(!message.trim())return;
  if(mode==='chat'&&!s.caps?.aiConsent){privacy(s,()=>send(s,{message,mode,fields}));return}
  clearError(s);s.sending=true;renderComposer(s);const epoch=s.epoch;
  try{
   const c=await ensureConversation(s);if(epoch!==s.epoch)return;
   const body={message:message.trim(),mode,fields,fileIds:[...s.fileIds]};
   if(!s.request||JSON.stringify({...s.request,requestKey:undefined})!==JSON.stringify(body))s.request={...body,requestKey:key()};
   // Keep the exact request key until server acceptance is observed, including after reload.
   saveDraft(s);await request(s,'/conversations/'+c.id+'/messages','POST',s.request);
   if(!live(s)||epoch!==s.epoch)return;s.input.value='';s.fileIds=[];s.request=null;saveDraft(s);resizeInput(s);s.forceScroll=true;await reload(s);
  }catch(error){showError(s,error,()=>send(s,{message,mode,fields}))}finally{if(live(s)&&epoch===s.epoch){s.sending=false;renderComposer(s)}}
 }
 function capture(s){dialog(s,{title:'Capture an item',label:'Review proposal',body:`<label>Title<input name="title" maxlength="160" required autocomplete="off"></label><div class="cc-field-row"><label>Kind<select name="kind"><option value="task">Task</option><option value="idea">Idea</option><option value="decision">Decision</option><option value="risk">Risk</option></select></label><label>Priority<select name="priority"><option value="next">Next</option><option value="now">Now</option><option value="later">Later</option></select></label></div><label>Details<textarea name="detail" maxlength="1800" rows="3"></textarea></label><label>Due date and time · IST (optional)<input type="datetime-local" name="due"></label><p class="cc-caption">A due date is not a scheduled reminder.</p>`,submit:async f=>{await send(s,{message:f.get('title'),mode:'capture',fields:{title:f.get('title'),kind:f.get('kind'),priority:f.get('priority'),detail:f.get('detail'),dueAt:f.get('due')?f.get('due')+':00+05:30':null}})}})}
 function editProposal(s,id){
  const p=s.data.proposals.find(p=>p.id===id);if(!p)return;const image=p.action_type==='image.generate',post=p.action_type==='post.create'||p.action_type==='post.update';
  const body=image?`<label>Prompt<textarea name="prompt" maxlength="2000" rows="6" required>${esc(p.payload.prompt)}</textarea></label>`:post?`<label>Title<input name="title" value="${esc(p.payload.title)}" maxlength="150" required></label><label>Summary<textarea name="excerpt" maxlength="380" rows="2">${esc(p.payload.excerpt||'')}</textarea></label><label>Body<textarea name="body" maxlength="25000" rows="10">${esc(p.payload.body||'')}</textarea></label>`:`<label>Title<input name="title" value="${esc(p.payload.title)}" maxlength="160" required></label><label>Details<textarea name="detail" maxlength="1800" rows="4">${esc(p.payload.detail)}</textarea></label>`;
  dialog(s,{title:image?'Edit image brief':post?'Edit post proposal':'Edit queue proposal',label:'Save proposal',body,submit:async f=>{const payload=image?{prompt:f.get('prompt')}:post?{...p.payload,title:f.get('title'),excerpt:f.get('excerpt'),body:f.get('body')}:{...p.payload,title:f.get('title'),detail:f.get('detail')};await request(s,'/conversations/'+s.conversation.id+'/proposals/'+id,'PATCH',{version:p.version,payload});await reload(s)}})
 }
 function reviewItem(s,id){
  const items=s.data.messages.flatMap(m=>[...(m.parts?.items||[]),...(m.parts?.signals||[]).flatMap(g=>g.items)]),item=items.find(i=>i.id===id);if(!item)return;
  dialog(s,{title:'Review status change',label:'Prepare approval',body:`<p><strong>${esc(item.title)}</strong></p><p>Current state: ${esc(item.state)} · ${esc(s.scope)}</p><label>New state<select name="state">${['open','waiting','done','dismissed'].map(v=>`<option ${v===item.state?'selected':''}>${v}</option>`).join('')}</select></label>`,submit:async f=>{await request(s,'/conversations/'+s.conversation.id+'/proposals','POST',{action:'queue.update',targetId:item.id,targetVersion:item.version,payload:{state:f.get('state')},requestKey:key()});await reload(s)}});
 }
 async function decide(s,id,action){
  const p=s.data.proposals.find(p=>p.id===id);if(!p)return;
  if(action==='approve'&&p.action_type==='image.generate'&&!s.caps.aiConsent){privacy(s,()=>decide(s,id,action));return}
  const nodes=s.root.querySelectorAll('[data-proposal="'+CSS.escape(id)+'"] button');nodes.forEach(b=>b.disabled=true);
  try{await request(s,'/conversations/'+s.conversation.id+'/proposals/'+id+'/'+action,'POST',{confirm:true,version:p.version});await reload(s)}catch(error){showError(s,error);s.signature='';await reload(s).catch(()=>{});}
 }
 function history(s){
  const d=dialog(s,{title:'Conversations',body:`<label class="cc-search">Search your ${esc(s.scope)} history<input type="search" name="q" placeholder="Search messages and titles" autocomplete="off"></label><label class="cc-archive-toggle"><input type="checkbox" name="archived"> Show archived conversations</label><div class="cc-history-list" aria-live="polite"></div><button type="button" class="cc-history-more" hidden>Load more</button>`});d.classList.add('cc-history');
  let cursor=null,searchId=0,items=[];const load=async(more=false)=>{const token=++searchId,query=d.querySelector('[name=q]').value,status=d.querySelector('[name=archived]').checked?'archived':'active';
   try{const result=await request(s,'/conversations?q='+encodeURIComponent(query)+'&status='+status+(more&&cursor?'&before='+encodeURIComponent(cursor):''));if(!d.open||token!==searchId)return;items=more?[...items,...result.items]:result.items;cursor=result.nextCursor;d.querySelector('.cc-history-more').hidden=!cursor;d.querySelector('.cc-history-list').innerHTML=items.length?items.map(c=>`<div><button type="button" data-open-chat="${esc(c.id)}"><strong>${esc(c.title)}</strong><small>${esc(new Date(c.updated_at).toLocaleDateString('en-IN'))} · ${esc(c.workspace)}</small></button>${c.status==='archived'?`<button type="button" data-restore="${esc(c.id)}">Restore</button>`:''}</div>`).join(''):'<p class="cc-caption">No conversations found.</p>'}catch(error){d.querySelector('.cc-dialog-error').textContent=error.message}};
  d.querySelector('[name=q]').oninput=()=>{clearTimeout(s.searchTimer);s.searchTimer=setTimeout(()=>load(),250)};d.querySelector('[name=archived]').onchange=()=>load();d.querySelector('.cc-history-more').onclick=()=>load(true);
  d.addEventListener('click',async e=>{const open=e.target.closest('[data-open-chat]'),restore=e.target.closest('[data-restore]');if(open){d.close();await openConversation(s,open.dataset.openChat)}if(restore){const c=items.find(c=>c.id===restore.dataset.restore);restore.disabled=true;try{await request(s,'/conversations/'+c.id,'PATCH',{status:'active',version:c.version});await load()}catch(error){d.querySelector('.cc-dialog-error').textContent=error.message;restore.disabled=false}}});void load();
 }
 function more(s){
  const d=dialog(s,{title:'Conversation',body:`<div class="cc-more-list">${s.conversation?'<button type="button" data-option="rename">Rename conversation</button><button type="button" data-option="archive">'+(s.conversation.status==='archived'?'Restore':'Archive')+' conversation</button><button type="button" data-option="export">Export conversation</button><button type="button" data-option="delete">Delete conversation and private files</button>':''}<button type="button" data-option="privacy">AI privacy and consent</button></div>`});
  d.addEventListener('click',async e=>{const option=e.target.closest('[data-option]')?.dataset.option;if(!option)return;d.close();if(option==='privacy')return privacy(s);const c=s.conversation;if(!c)return;
   if(option==='rename')return dialog(s,{title:'Rename conversation',body:`<label>Name<input name="title" value="${esc(c.title)}" maxlength="100" required></label>`,submit:async f=>{await request(s,'/conversations/'+c.id,'PATCH',{title:f.get('title'),version:c.version});await reload(s)}});
   if(option==='delete')return dialog(s,{title:'Delete this conversation?',label:'Delete permanently',danger:true,body:'<p>This removes the conversation and its private files. Queue records created from it will remain. This cannot be undone.</p><label class="cc-archive-toggle"><input type="checkbox" required> I understand this deletion is permanent.</label>',submit:async()=>{await request(s,'/conversations/'+c.id,'DELETE',{confirm:true,version:c.version});storage.del(draftKey(s));newChat(s,{discard:true})}});
   try{if(option==='archive'){await request(s,'/conversations/'+c.id,'PATCH',{status:c.status==='archived'?'active':'archived',version:c.version});await reload(s)}else if(option==='export'){const data=await request(s,'/conversations/'+c.id+'/export');const link=document.createElement('a'),blob=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));link.href=blob;link.download='command-conversation-'+c.id+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(blob),30000)}}catch(error){showError(s,error)}
  });
 }
 async function upload(s,list){
  if(s.uploading||pending(s))return;s.uploading=true;renderComposer(s);const epoch=s.epoch;
  try{const c=await ensureConversation(s);for(const f of [...list]){if(epoch!==s.epoch)return;if(s.fileIds.length>=3)throw Error('Attach up to three files per message.');const mime=f.type||(/\.md$/i.test(f.name)?'text/markdown':/\.txt$/i.test(f.name)?'text/plain':'');const response=await fetch(url(s,'/conversations/'+c.id+'/files?name='+encodeURIComponent(f.name)),{method:'POST',credentials:'same-origin',headers:{'content-type':mime},body:f,signal:s.abort.signal});const result=await response.json();if(!response.ok)throw Error(result.error?.message||'Upload failed.');if(epoch!==s.epoch)return;s.fileIds.push(result.data.id);s.data.files.push(result.data);saveDraft(s);renderComposer(s)}}catch(error){showError(s,error)}finally{if(live(s)&&epoch===s.epoch){s.uploading=false;renderComposer(s)}}
 }
 async function mount({root,api,initial}){
  unmount();if(initial.ownerRole!=='owner'){root.textContent='Only the owner can access Command Chat.';return}
  const owner=initial.ownerId,scope=storage.get(owner+':workspace')==='kravia'?'kravia':'personal';
  const assetBase=location.pathname.replace(/\/admin\/?$/,'');
  const s={root,api,initial,scope,assetBase,base:assetBase+'/api/admin/command',abort:new AbortController(),dialogs:new Set(),epoch:0,mode:'chat',fileIds:[],request:null,createKey:key(),conversation:null,data:{messages:[],proposals:[],files:[]},caps:null,signature:'',forceScroll:true,recorder:null,voiceStream:null,voiceTimer:null,voiceBusy:false,voiceReplyAfter:0,voiceSpoken:null};current=s;
  root.classList.add('cc-root');document.documentElement.classList.add('cc-active');
  root.innerHTML=`<section class="cc" aria-label="Command Chat"><header class="cc-header" aria-label="Command navigation"><a class="cc-vm-logo" href="#command" aria-label="Vamsi’s Corner Command home"><img src="${esc(s.assetBase)}/mark.svg?v=vm-20261027" alt="VM" width="40" height="40"></a><div class="cc-heading" hidden><h2>Command<span>.</span></h2></div><button class="cc-signal" type="button" data-action="categories" aria-label="Open Studio navigation" aria-expanded="false" aria-controls="cc-category-menu"><span class="cc-signal-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button><div id="cc-category-menu" class="cc-category-menu" hidden><nav aria-label="Studio destinations"><a href="#command" aria-current="page">${icon('spark')} Command</a><a href="#overview">${icon('queue')} Overview</a><a href="#posts">${icon('edit')} Posts</a><a href="#media">${icon('image')} Media</a><a href="#comments">${icon('more')} Comments</a><a href="#insights">${icon('spark')} Insights</a><a href="#settings">${icon('more')} Settings</a></nav><label class="cc-workspace"><span class="cc-dot" aria-hidden="true"></span><select aria-label="Workspace"><option value="personal">Personal workspace</option><option value="kravia">KRAVIA workspace</option></select></label><div class="cc-category-actions">${button('history','Conversation history','history')}${button('new','New conversation','plus')}${button('more','Conversation options','more')}</div><div class="cc-sidebar-actions"></div></div></header><div class="cc-error" role="alert" hidden><span></span><button type="button" data-action="retry-error" hidden>Retry</button>${button('dismiss-error','Dismiss error','close')}</div><div class="cc-scroll" tabindex="0" aria-label="Conversation"><div class="cc-column"><div class="cc-empty"><div class="cc-empty-copy"><h1>Welcome back, Vamsi.</h1><p>What’s on your mind?</p></div></div><button type="button" class="cc-older" data-action="older" hidden>Load earlier messages</button><div class="cc-messages"></div></div></div><div class="cc-bottom"><button type="button" class="cc-jump" data-action="bottom" hidden>${icon('down')}Latest</button><div class="cc-compose-wrap"><p class="cc-conversation-title">Your private workspace</p><form class="cc-composer"><div class="cc-files"></div><button class="cc-mode" type="button" data-action="chat-mode" hidden>${icon('image')} Image brief ${icon('close')}</button><label class="cc-sr" for="cc-input">What’s on your mind?</label><textarea id="cc-input" maxlength="6000" rows="1" placeholder="What’s on your mind?"></textarea><div class="cc-compose-controls"><div>${button('tools','Add tools or attachments','plus')}${button('voice','Voice command','mic')}<span class="cc-input-note">Shift + Enter for a new line</span></div><button type="submit" class="cc-send" data-action="send" aria-label="Send message">${icon('send')}</button></div><div class="cc-tools" hidden><button type="button" data-tool="image">${icon('image')}<span>Create image</span></button><button type="button" data-tool="attach">${icon('clip')}<span>Attach</span></button><button type="button" data-tool="queue">${icon('queue')}<span>Queue</span></button><button type="button" data-tool="capture">${icon('plus')}<span>Capture</span></button><button type="button" data-tool="signals">${icon('spark')}<span>Signals</span></button></div><input type="file" class="cc-upload" accept="image/png,image/jpeg,image/webp,text/plain,text/markdown,.md,.txt" multiple hidden></form><p class="cc-network">Connecting to your private workspace…</p></div></div><p class="cc-sr cc-announcement" role="status" aria-live="polite"></p></section>`;
  const footer=document.querySelector('.admin-sidebar-footer');if(footer){s.movedFooter=footer;root.querySelector('.cc-sidebar-actions').append(footer)}
  s.input=root.querySelector('#cc-input');s.log=root.querySelector('.cc-scroll');const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:s.abort.signal});
  const work=root.querySelector('[aria-label=Workspace]');work.value=scope;
  on(work,'change',async()=>{saveDraft(s);s.scope=work.value;storage.set(owner+':workspace',s.scope);s.epoch++;clearTimeout(s.timer);s.conversation=null;s.data={messages:[],proposals:[],files:[]};s.signature='';s.sending=false;s.uploading=false;s.creating=null;clearError(s);restoreDraft(s);renderMessages(s);const last=storage.get(owner+':last:'+s.scope);if(last)await openConversation(s,last)});
  on(s.input,'input',()=>{s.request=null;resizeInput(s);saveDraft(s)});
  on(s.input,'keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&matchMedia('(pointer:fine)').matches){e.preventDefault();void send(s)}});
  root.querySelector('[data-action=voice]').addEventListener('click',e=>{e.stopPropagation();void voiceCommand(s).catch(error=>showError(s,error))},{capture:true,signal:s.abort.signal});
  on(root.querySelector('.cc-compose-controls'),'pointerdown',e=>{if(s.input===document.activeElement&&e.target.closest('button'))e.preventDefault()});
  on(root.querySelector('form.cc-composer'),'submit',e=>{e.preventDefault();if(pending(s))void request(s,'/conversations/'+s.conversation.id+'/turns/'+pending(s).turn_id+'/cancel','POST',{}).then(()=>reload(s)).catch(e=>showError(s,e));else void send(s)});
  on(root.querySelector('.cc-upload'),'change',e=>{void upload(s,[...e.target.files]);e.target.value=''});
  on(s.log,'scroll',()=>{root.querySelector('[data-action=bottom]').hidden=s.log.scrollHeight-s.log.scrollTop-s.log.clientHeight<90});
  on(root,'click',async e=>{
   const b=e.target.closest('button');if(!b||b.disabled)return;const action=b.dataset.action,tool=b.dataset.tool,starter=b.dataset.starter;
   try{
    if(action==='categories'){const menu=root.querySelector('.cc-category-menu');menu.hidden=!menu.hidden;b.setAttribute('aria-expanded',String(!menu.hidden));}if(action==='new')newChat(s);if(action==='history')history(s);if(action==='more')more(s);
    if(action==='tools'){const menu=root.querySelector('.cc-tools');menu.hidden=!menu.hidden;b.setAttribute('aria-expanded',String(!menu.hidden));}
    if(action==='voice')await voiceCommand(s);
    if(action==='dismiss-error')clearError(s);if(action==='retry-error')await s.retryAction?.();if(action==='older')await reload(s,{older:true});
    if(action==='bottom')s.log.scrollTo({top:s.log.scrollHeight,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
    if(action==='chat-mode'){s.mode='chat';saveDraft(s);renderComposer(s);s.input.focus()}
    if(tool||starter){root.querySelector('.cc-tools').hidden=true;const selected=tool||starter;if(selected==='capture')capture(s);if(selected==='image'){s.mode='image';saveDraft(s);renderComposer(s);s.input.focus()}if(selected==='queue'||selected==='signals')await send(s,{message:selected==='queue'?'Show my queue.':'Show my agentic moments.',mode:selected});if(selected==='plan'){s.input.value='Help me plan my next Corner post.';s.mode='chat';resizeInput(s);saveDraft(s);renderComposer(s);s.input.focus()}if(selected==='attach')root.querySelector('.cc-upload').click()}
    if(b.dataset.editProposal)editProposal(s,b.dataset.editProposal);if(b.dataset.decide)await decide(s,b.dataset.id,b.dataset.decide);if(b.dataset.reviewItem)reviewItem(s,b.dataset.reviewItem);
    if(b.dataset.retryTurn){b.disabled=true;try{await request(s,'/conversations/'+s.conversation.id+'/turns/'+b.dataset.retryTurn+'/retry','POST',{});await reload(s)}finally{b.disabled=false}}
    if(b.dataset.removeFile){await request(s,'/conversations/'+s.conversation.id+'/files/'+b.dataset.removeFile,'DELETE',{});s.fileIds=s.fileIds.filter(id=>id!==b.dataset.removeFile);saveDraft(s);renderComposer(s)}
    if(b.dataset.copy){const m=s.data.messages.find(m=>m.id===b.dataset.copy);await navigator.clipboard.writeText(m.content);b.title='Copied';b.innerHTML=icon('check')}
   }catch(error){showError(s,error)}
  });
  on(document,'click',e=>{if(!e.target.closest('.cc-composer'))root.querySelector('.cc-tools').hidden=true;if(!e.target.closest('.cc-header')){const menu=root.querySelector('.cc-category-menu');if(menu)menu.hidden=true;root.querySelector('[data-action=categories]')?.setAttribute('aria-expanded','false')}});
  on(document,'keydown',e=>{if(e.key==='Escape'){root.querySelector('.cc-tools').hidden=true;const menu=root.querySelector('.cc-category-menu');if(menu)menu.hidden=true;root.querySelector('[data-action=categories]')?.setAttribute('aria-expanded','false')}});
  on(window,'resize',()=>viewport(s));if(window.visualViewport){on(window.visualViewport,'resize',()=>viewport(s));on(window.visualViewport,'scroll',()=>viewport(s))}
  on(window,'online',()=>{renderComposer(s);void reload(s).catch(e=>showError(s,e))});on(window,'offline',()=>renderComposer(s));on(document,'visibilitychange',()=>{if(!document.hidden)void reload(s).catch(e=>showError(s,e))});
  restoreDraft(s);renderMessages(s);viewport(s);requestAnimationFrame(()=>viewport(s));
  try{s.caps=await request(s,'/capabilities');if(!live(s))return;renderComposer(s);const last=storage.get(owner+':last:'+scope);if(last)await openConversation(s,last)}catch(error){showError(s,error,()=>mount({root,api,initial}))}
 }
 window.CornerCommandChat={mount,unmount,clearDrafts};
})();
