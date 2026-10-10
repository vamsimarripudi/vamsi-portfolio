(()=>{
 const root=document.querySelector('[data-wish-studio]');if(!root)return;
 const prefix=location.pathname.startsWith('/corner')?'/corner':'';
 const endpoint=prefix+'/api/v1/admin/v3/wishes',editor=root.querySelector('[data-v3w-form]'),
  schedule=root.querySelector('[data-v3w-schedule]'),preview=root.querySelector('.v3w-preview');
 const editorStatus=editor.querySelector('[role=status]'),scheduleStatus=schedule.querySelector('[role=status]');
 const notes=(node,message)=>{node.textContent=String(message)};
 const call=async(path='',method='GET',payload)=>{
  const res=await fetch(endpoint+path,{method,credentials:'same-origin',
    headers:payload===undefined?{}:{'content-type':'application/json'},
    body:payload===undefined?undefined:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error?.message||'Request could not be completed.');
  return data.data;
 };
 const model=()=>({
  title:editor.elements.title.value.trim(),body:editor.elements.body.value.trim(),
  excerpt:editor.elements.excerpt.value.trim(),emoji:editor.elements.emoji.value,
  timezone:editor.elements.timezone.value.trim(),
  upcomingPublic:editor.elements.upcomingPublic.checked
 });
 const fill=(obj={})=>{
  editor.elements.id.value=obj.id||'';
  editor.elements.version.value=obj.version||'';
  for(const key of ['title','body','excerpt','emoji','timezone'])
   editor.elements[key].value=obj[key]??(key==='timezone'?'Asia/Kolkata':key==='emoji'?'✳':'');
  editor.elements.upcomingPublic.checked=!!(obj.upcomingPublic??obj.upcoming_public);
  editor.querySelector('[type=submit]').textContent=obj.id?'Update draft ↗':'Save draft ↗';
  notes(editorStatus,obj.id?'Selected draft · version '+obj.version:'');
 };
 const refresh=()=>location.reload();
 editor.addEventListener('submit',async event=>{
  event.preventDefault();if(!editor.reportValidity())return;
  const button=editor.querySelector('[type=submit]');button.disabled=true;notes(editorStatus,'Saving…');
  try{
   const id=editor.elements.id.value;
   const saved=await call(id?'/'+encodeURIComponent(id):'',id?'PATCH':'POST',
     id?{...model(),version:Number(editor.elements.version.value)}:model());
   fill(saved);notes(editorStatus,'Saved privately.');refresh();
  }catch(e){notes(editorStatus,e.message)}finally{button.disabled=false}
 });
 root.querySelector('[data-v3w-preview]')?.addEventListener('click',async()=>{
  notes(editorStatus,'Preparing preview…');
  try{
   const data=await call('/preview','POST',model());
   preview.querySelector('[data-v3w-emoji]').textContent=data.emoji||'✳';
   preview.querySelector('[data-v3w-title]').textContent=data.title;
   preview.querySelector('[data-v3w-excerpt]').textContent=data.excerpt||'';
   preview.querySelector('[data-v3w-body]').textContent=data.body;
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    preview.classList.remove('corner-motion-updated');
    void preview.offsetWidth;preview.classList.add('corner-motion-updated');
   }
   notes(editorStatus,'Private preview only. Nothing emailed or published.');
  }catch(e){notes(editorStatus,e.message)}
 });
 root.querySelector('[data-v3w-new]')?.addEventListener('click',()=>{fill();editor.elements.title.focus()});
 root.querySelectorAll('[data-v3w-edit]').forEach(button=>button.addEventListener('click',()=>{
  try{fill(JSON.parse(button.dataset.v3wEdit));editor.scrollIntoView({behavior:'instant'});editor.elements.title.focus({preventScroll:true})}
  catch{notes(editorStatus,'Unable to load this draft. Refresh the page.')}
 }));
 schedule.addEventListener('submit',async event=>{
  event.preventDefault();if(!schedule.reportValidity())return;
  const id=editor.elements.id.value,version=Number(editor.elements.version.value);
  if(!id||!version){notes(scheduleStatus,'Save or select a draft before scheduling.');return;}
  const action=schedule.querySelector('[type=submit]');action.disabled=true;
  try{
   await call('/'+encodeURIComponent(id)+'/schedule','POST',{
    localTime:schedule.elements.localTime.value,timezone:editor.elements.timezone.value,
    recurrence:schedule.elements.recurrence.value,
    recurrenceEndYear:schedule.elements.recurrenceEndYear.value||null,
    version});
   notes(scheduleStatus,'Scheduled.');refresh();
  }catch(e){notes(scheduleStatus,e.message)}finally{action.disabled=false}
 });
 for(const action of ['duplicate','publish','archive']){
  root.querySelectorAll('[data-v3w-'+action+']').forEach(button=>button.addEventListener('click',async()=>{
   const id=button.dataset['v3w'+action[0].toUpperCase()+action.slice(1)];
   if(action==='archive'&&!confirm('Archive this wish?'))return;
   if(action==='publish'&&!confirm('Publish this wish publicly now? This does not send email.'))return;
   button.disabled=true;
   try{await call('/'+encodeURIComponent(id)+'/'+action,'POST');refresh()}
   catch(e){notes(editorStatus,e.message);button.disabled=false}
  }));
 }

 root.querySelectorAll('[data-v3w-notify]').forEach(button=>button.addEventListener('click',async()=>{
  if(!confirm('Queue this published wish for verified opt-in subscribers only?'))return;
  button.disabled=true;
  try{
   const result=await call('/'+encodeURIComponent(button.dataset.v3wNotify)+'/notify','POST',{confirm:true});
   notes(editorStatus,result.queued+' opted-in deliveries queued. No email is sent without consent.');
   button.textContent='Queued: '+result.queued;
  }catch(e){notes(editorStatus,e.message);button.disabled=false}
 }));
})();