/* Private owner interface. Only renders authenticated server responses. */
(()=>{
 'use strict';
 const root=document.querySelector('[data-communications]');if(!root)return;
 const $=(selector,parent=root)=>parent.querySelector(selector);
 const prefix=location.pathname.startsWith('/corner')?'/corner':'';
 const api=prefix+'/api/v1/admin/communications';
 const state=$('[data-comm-state]'),form=$('[data-comm-form]'),formStatus=$('[data-comm-form-state]');
 const refresh=$('[data-comm-refresh]'),preview=$('[data-comm-preview]'),queue=$('[data-comm-queue]');
 const choices=$('[data-comm-story-choices]'),showEmail=$('[data-comm-show-email]');
 const frame=$('[data-comm-iframe]'),empty=$('[data-comm-preview-empty]');
 let snapshot=null,selected=[],previewInfo=null,pending=false;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n};
 const fmt=date=>{if(!date)return 'Not recorded';const d=new Date(date);return Number.isFinite(d.getTime())?d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Unknown date'};
 const mask=value=>{const [local,domain]=String(value||'').split('@');if(!domain)return 'Private';return local.slice(0,1)+'•••@'+domain};
 const number=value=>value==null?'—':Number(value).toLocaleString('en-IN');
 const append=(target,...children)=>{target.replaceChildren(...children)};
 const notice=(text,error=false)=>{state.textContent=text;state.dataset.error=String(error)};
 const item=(title,detail,meta,badge)=>{const art=node('article',null,'comm-item');const head=node('div');head.append(node('strong',title));if(badge)head.append(node('span',badge,'comm-pill'));art.append(head,node('p',detail));if(meta)art.append(node('small',meta));return art};
 async function request(path,{method='GET',data}={}){
  const r=await fetch(api+path,{method,credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
  const payload=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(payload.error?.message||'Connection error. No changes made.');
  return payload.data;
 }
 const renderStatus=()=>{
  if(!snapshot)return;
  const s=snapshot;
  const cards=[['Published stories',s.posts?.published],['Registered members',s.members?.total],['Verified subscriptions',s.follows?.active],['Comments awaiting review',s.comments?.pending],['Observed story opens',s.analytics?.post_open],['Consented reading visits',s.analytics?.consentedReadingVisits],['Queued emails',(s.communications?.queued||0)+(s.communications?.retry||0)],['Failed emails',s.communications?.failed]];
  append($('[data-comm-kpis]'),...cards.map(([label,value])=>{const a=node('div',null,'comm-kpi');a.append(node('strong',number(value)),node('span',label));return a}));
  const comments=s.comments?.recent||[];
  append($('[data-comm-comments]'),...(comments.length?comments.slice(0,15).map(c=>item(c.enteredName||'Name not provided',c.body||'No message',fmt(c.createdAt)+' · '+c.storyTitle,c.state)): [node('p','No comments in the current database.','comm-muted')]));
  const view=s.analytics?.topStories||[];
  append($('[data-comm-views]'),...(view.length?view.slice(0,8).map(v=>item(v.title,number(v.views)+' measured opens','Not unique visitors or verified personal identities')):[node('p','No measured story opens in the current report.','comm-muted')]));
  const audit=s.recentAudit||[];
  append($('[data-comm-audit]'),...(audit.length?audit.slice(0,30).map(a=>item(a.action,a.entityType||'Application activity',fmt(a.occurredAt))):[node('p','No audit records available.','comm-muted')]));
  const members=s.members?.records||[];
  append($('[data-comm-members]'),...(members.length?members.map(m=>item(m.displayName||'Member',showEmail.checked?(m.email||'Private email'):mask(m.email),fmt(m.createdAt)+' · '+(m.verifiedAt?'Verified':'Not verified')+' · Last sign-in: '+fmt(m.lastLoginAt))):[node('p','No registered members in the database.','comm-muted')]));
  const delivery=s.communications||{};
  const active=s.enabled;
  append($('[data-comm-delivery]'),node('h3',active?'Campaign engine configured (review required)':'Campaign sending is paused'),node('p','Queued: '+number(delivery.queued)+' · Sending: '+number(delivery.sending)+' · Retrying: '+number(delivery.retry)+' · Sent (sender-accepted): '+number(delivery.sent)+' · Failed: '+number(delivery.failed)+' · Cancelled: '+number(delivery.cancelled),'comm-muted'),node('p','Provider confirmations — delivered: '+number(delivery.provider?.delivered)+', delayed: '+number(delivery.provider?.delayed)+', bounced: '+number(delivery.provider?.bounced)+', complaints: '+number(delivery.provider?.complained),'comm-muted'),node('p','Subscriber states — active: '+number(s.follows?.active)+', pending verification: '+number(s.follows?.pending)+', unsubscribed: '+number(s.follows?.unsubscribed)+', bounced: '+number(s.follows?.bounced),'comm-muted'));
  const campaigns=delivery.campaigns||[];
  const destination=$('[data-comm-delivery]');
  const history=node('div',null,'comm-campaign-history');
  history.append(node('h3','Recent campaigns'));
  history.append(...(campaigns.length?campaigns.slice(0,12).map(c=>item(c.category+' · '+c.kind,number(c.recipients)+' verified recipients · '+number(c.sent)+' accepted · '+number(c.failed)+' failed · '+number(c.cancelled)+' cancelled',fmt(c.createdAt))):[node('p','No campaigns have been queued.','comm-muted')]));
  destination.append(history);
  queue.disabled=!active||!previewInfo||!(previewInfo.recipientCount>0);
  const list=s.availableStories||[];
  if(!selected.length)drawChoices(list);
  notice('Live private records loaded · '+fmt(s.generatedAt)+' · No named reader tracking');
 };
 const drawChoices=list=>{
  const allowed=new Set(list.map(p=>p.id));selected=selected.filter(id=>allowed.has(id));
  const k=form.elements.kind.value;
  const items=list.map(p=>{
   const label=node('label',null,'comm-story-choice'),radio=node('input');radio.type=k==='digest'?'checkbox':'radio';radio.name='comm-post-choice';radio.value=p.id;radio.checked=selected.includes(p.id);
   radio.addEventListener('change',()=>{if(k!=='digest')selected=radio.checked?[p.id]:[];else if(radio.checked){if(selected.length>=8){radio.checked=false;formStatus.textContent='A digest can contain up to eight stories.';return;}selected.push(p.id)}else selected=selected.filter(x=>x!==p.id);previewInfo=null;queue.disabled=true;frame.hidden=true;empty.hidden=false;drawChoices(list);});
   const text=node('span');text.append(node('strong',p.title||'Untitled'),node('small',p.category+' · '+fmt(p.publishedAt)));label.append(radio,text);return label;
  });
  append(choices,...(items.length?items:[node('p','No published stories found.','comm-muted')]));
 };
 const load=async()=>{if(pending)return;pending=true;refresh.disabled=true;notice('Refreshing authenticated Corner records…');try{snapshot=await request('/status');renderStatus();drawChoices(snapshot.availableStories||[])}catch(e){notice(e.message,true)}finally{pending=false;refresh.disabled=false}};
 refresh.addEventListener('click',load);
 showEmail.addEventListener('change',renderStatus);
 form.elements.kind.addEventListener('change',()=>{selected=[];previewInfo=null;frame.hidden=true;empty.hidden=false;queue.disabled=true;drawChoices(snapshot?.availableStories||[])});
 form.elements.category.addEventListener('change',()=>{previewInfo=null;queue.disabled=true});
 preview.addEventListener('click',async()=>{
  if(pending)return;if(!selected.length){formStatus.textContent='Choose at least one published story.';return}
  pending=true;preview.disabled=true;queue.disabled=true;formStatus.textContent='Preparing private preview…';
  try{
   const category=form.elements.kind.value==='digest'?'Latest':(snapshot.availableStories.find(p=>p.id===selected[0])?.category||'Latest');
   form.elements.category.value=category;
   const result=await request('/preview',{method:'POST',data:{kind:form.elements.kind.value,category,postIds:selected}});
   previewInfo=result;
   frame.srcdoc=result.html;frame.hidden=false;empty.hidden=true;
   formStatus.textContent='Preview ready. '+result.recipientCount+' verified opted-in recipients match. Nothing has been sent.';
   queue.disabled=!snapshot.enabled||result.recipientCount===0;
  }catch(error){formStatus.textContent=error.message}finally{pending=false;preview.disabled=false}
 });
 queue.addEventListener('click',async()=>{
  if(pending||!previewInfo||!snapshot?.enabled||previewInfo.recipientCount<1)return;
  const count=previewInfo.recipientCount;
  if(!confirm('Queue this exact reviewed campaign for '+count+' opted-in subscriber'+(count===1?'':'s')+'? This will allow the configured background worker to deliver the email.'))return;
  pending=true;queue.disabled=true;formStatus.textContent='Queuing recipients after confirmation…';
  try{
   const result=await request('/campaigns',{method:'POST',data:{kind:previewInfo.kind,category:previewInfo.category,postIds:previewInfo.postIds,confirm:true}});
   formStatus.textContent=result.alreadyQueued?'This campaign was previously queued; duplicate sends were prevented.':'Queued '+result.queued+' opted-in recipients. Delivery happens only when the worker is enabled.';
   previewInfo=null;pending=false;await load();
  }catch(e){formStatus.textContent=e.message}finally{pending=false}
 });
 load();
})();
