(()=>{
 'use strict';
 const root=document.querySelector('[data-wish-studio]');if(!root)return;
 const prefix=location.pathname.startsWith('/corner')?'/corner':'';
 const endpoint=prefix+'/api/v1/admin/v3/wishes',editor=root.querySelector('[data-v3w-form]'),schedule=root.querySelector('[data-v3w-schedule]'),preview=root.querySelector('.v3w-preview');
 const editorStatus=editor.querySelector('[role=status]'),scheduleStatus=schedule.querySelector('[role=status]');
 let dirty=false,revision=0,saving=false;
 const notes=(node,message)=>{node.textContent=String(message)};
 const call=async(path='',method='GET',payload)=>{
  const res=await fetch(endpoint+path,{method,credentials:'same-origin',cache:'no-store',headers:payload===undefined?{}:{'content-type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error?.message||'Request could not be completed.');return data.data;
 };
 const model=()=>({title:editor.elements.title.value.trim(),body:editor.elements.body.value.trim(),excerpt:editor.elements.excerpt.value.trim(),emoji:editor.elements.emoji.value,timezone:editor.elements.timezone.value.trim(),upcomingPublic:editor.elements.upcomingPublic.checked});
 // Local plain-text render: no API call, HTML parsing, save, email, or publication.
 const syncPreview=()=>{
  for(const key of ['title','body','excerpt','emoji']){
   const value=editor.elements[key].value;
   preview.querySelector('[data-v3w-'+key+']').textContent=value||(key==='title'?'Your wish appears here':key==='emoji'?'✳':'');
  }
  preview.dataset.live='true';
  notes(preview.querySelector('[data-preview-state]'),dirty?'Unsaved edits':'Live preview');
 };
 const changed=()=>{revision++;if(!dirty)notes(editorStatus,'Unsaved edits · save when ready.');dirty=true;syncPreview()};
 editor.addEventListener('input',changed);editor.addEventListener('change',changed);editor.addEventListener('compositionend',syncPreview);
 editor.addEventListener('reset',()=>queueMicrotask(changed));
 const fill=(obj={})=>{
  editor.elements.id.value=obj.id||'';editor.elements.version.value=obj.version||'';
  for(const key of ['title','body','excerpt','emoji','timezone'])editor.elements[key].value=obj[key]??(key==='timezone'?'Asia/Kolkata':key==='emoji'?'✳':'');
  editor.elements.upcomingPublic.checked=!!(obj.upcomingPublic??obj.upcoming_public);
  dirty=false;revision++;editor.querySelector('[data-save-label]').textContent=obj.id?'Save edits':'Save draft';
  notes(editorStatus,obj.id?'Editing saved wish · version '+obj.version:'');notes(scheduleStatus,'');syncPreview();
 };
 const confirmDiscard=()=>!dirty||confirm('Discard unsaved wish edits?');
 const iconPaths={edit:'m16 3 5 5-12 12-6 1 1-6z M13 6l5 5',duplicate:'M9 9h12v12H9z M15 9V3H3v12h6',archive:'M3 3h18v5H3z M5 8v13h14V8 M10 12h4'};
 function actionButton(action,record){
  const button=document.createElement('button');button.type='button';button.dataset['v3w'+action[0].toUpperCase()+action.slice(1)]=action==='edit'?JSON.stringify(record):record.id;
  const label=({edit:'Edit',duplicate:'Duplicate',archive:'Archive',publish:'Publish',notify:'Notify opt-ins'})[action];
  button.setAttribute('aria-label',label+' '+record.title);button.title=label;
  if(iconPaths[action]){button.className='studio-icon-action';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','18');svg.setAttribute('height','18');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.classList.add('studio-icon');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',iconPaths[action]);svg.append(path);button.append(svg)}else button.textContent=label;
  return button;
 }
 async function refreshLibrary(){
  const records=await call(),list=root.querySelector('[data-v3w-list]'),fragment=document.createDocumentFragment();
  for(const p of records){
   const item=document.createElement('article');item.className='v3w-item';const text=document.createElement('div'),state=document.createElement('span'),title=document.createElement('h3'),time=document.createElement('small'),actions=document.createElement('div');
   state.className='v3w-state';state.textContent=p.state;title.textContent=p.title;time.textContent=p.scheduled_at||p.published_at||'Not scheduled';text.append(state,title,time);actions.className='v3w-item-actions';
   const names=['edit','duplicate'];if(['draft','scheduled'].includes(p.state))names.push('publish');if(p.state==='published'&&root.dataset.deliveryAvailable==='true')names.push('notify');if(p.state!=='archived')names.push('archive');
   for(const name of names)actions.append(actionButton(name,p));item.append(text,actions);fragment.append(item);
  }
  if(!records.length){const empty=document.createElement('p');empty.className='v3w-empty';empty.textContent='No wishes yet. Save your first draft.';fragment.append(empty)}
  list.replaceChildren(fragment);notes(root.querySelector('[data-v3w-total]'),records.length+' total');
  root.querySelectorAll('[data-v3w-count]').forEach(node=>{node.textContent=records.filter(p=>p.state===node.dataset.v3wCount).length;window.CornerMotion?.count(node)});
 }
 editor.addEventListener('submit',async event=>{
  event.preventDefault();if(saving||!editor.reportValidity())return;
  saving=true;const button=editor.querySelector('[type=submit]'),started=revision,id=editor.elements.id.value;button.disabled=true;editor.setAttribute('aria-busy','true');notes(editorStatus,'Saving…');
  try{
   const saved=await call(id?'/'+encodeURIComponent(id):'',id?'PATCH':'POST',id?{...model(),version:Number(editor.elements.version.value)}:model());
   // A slow response must never overwrite newer typing or mark those edits saved.
   editor.elements.id.value=saved.id;editor.elements.version.value=saved.version;editor.querySelector('[data-save-label]').textContent='Save edits';dirty=revision!==started;
   notes(editorStatus,dirty?'Saved earlier edits. Newer edits are not saved yet.':'Saved privately.');syncPreview();
   try{await refreshLibrary()}catch{notes(editorStatus,'Saved. Library refresh failed; reload after saving any newer edits.')}
  }catch(e){notes(editorStatus,e.message)}finally{saving=false;button.disabled=false;editor.removeAttribute('aria-busy')}
 });
 root.querySelector('[data-v3w-new]')?.addEventListener('click',()=>{if(saving||!confirmDiscard())return;fill();editor.elements.title.focus()});
 root.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.hasAttribute('data-v3w-edit')){
   if(saving||!confirmDiscard())return;
   try{fill(JSON.parse(button.dataset.v3wEdit));editor.scrollIntoView({behavior:'instant',block:'start'});editor.elements.title.focus({preventScroll:true})}catch{notes(editorStatus,'Unable to load this wish. Refresh the page.')}
   return;
  }
  const action=['duplicate','publish','archive','notify'].find(name=>button.hasAttribute('data-v3w-'+name));if(!action)return;
  const id=button.dataset['v3w'+action[0].toUpperCase()+action.slice(1)];
  if(['publish','notify'].includes(action)&&id===editor.elements.id.value&&dirty){notes(editorStatus,'Save your edits before publishing or notifying subscribers.');return}
  if(action==='archive'&&!confirm('Archive this wish?'))return;
  if(action==='publish'&&!confirm('Publish this wish publicly now? This does not send email.'))return;
  if(action==='notify'&&!confirm('Queue this published wish for verified opt-in subscribers only?'))return;
  button.disabled=true;
  try{const data=await call('/'+encodeURIComponent(id)+'/'+action,'POST',action==='notify'?{confirm:true}:undefined);
   if(action==='notify')notes(editorStatus,data.queued+' opted-in deliveries queued.');
   else{if(id===editor.elements.id.value&&!dirty&&data?.id)fill(data);await refreshLibrary();notes(editorStatus,action==='publish'?'Published. No email sent.':action==='archive'?'Archived.':'Private copy created.')}
  }catch(e){notes(editorStatus,e.message)}finally{button.disabled=false}
 });
 schedule.addEventListener('submit',async event=>{
  event.preventDefault();if(!schedule.reportValidity())return;
  const id=editor.elements.id.value,version=Number(editor.elements.version.value);
  if(!id||!version||dirty||saving){notes(scheduleStatus,'Save or select a saved wish before scheduling.');return}
  const action=schedule.querySelector('[type=submit]');if(action.disabled)return;action.disabled=true;
  try{const data=await call('/'+encodeURIComponent(id)+'/schedule','POST',{localTime:schedule.elements.localTime.value,timezone:editor.elements.timezone.value,recurrence:schedule.elements.recurrence.value,recurrenceEndYear:schedule.elements.recurrenceEndYear.value||null,version});if(data?.version)editor.elements.version.value=data.version;notes(scheduleStatus,'Scheduled.');await refreshLibrary()}
  catch(e){notes(scheduleStatus,e.message)}finally{action.disabled=false}
 });
 addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
 fill();
})();
