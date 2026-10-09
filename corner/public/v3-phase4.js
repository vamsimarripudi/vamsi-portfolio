(()=>{
 const form=document.querySelector('[data-v3-language-form]');if(!form)return;
 const base=(location.pathname.startsWith('/corner')?'/corner':'')+'/api/v1/admin/v3/languages';
 const msg=form.querySelector('[role=status]'),output=document.querySelector('[data-v3-language-output]');
 const send=async(path='',payload)=>{
  const response=await fetch(base+path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error?.message||'Unable to complete this request.');
  return data.data;
 };
 const values=()=>({
  postId:form.elements.postId.value,language:form.elements.language.value,
  title:form.elements.title.value,excerpt:form.elements.excerpt.value,body:form.elements.body.value,
  ...(form.elements.revision.value?{revision:Number(form.elements.revision.value)}:{})
 });
 const note=text=>{msg.textContent=String(text)};
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const btn=form.querySelector('[type=submit]');btn.disabled=true;
  try{
   const result=await send('',values());
   note('Saved privately as draft · revision '+result.revision+'.');
   location.reload();
  }catch(e){note(e.message);btn.disabled=false}
 });
 document.querySelector('[data-v3-language-preview]')?.addEventListener('click',async()=>{
  try{
   const result=await send('/preview',values());
   output.textContent=result.title+'\n\n'+(result.excerpt?result.excerpt+'\n\n':'')+result.body;
   note('Preview only. Nothing has been published.');
  }catch(e){note(e.message)}
 });
 document.querySelectorAll('[data-v3-language-edit]').forEach(btn=>btn.addEventListener('click',()=>{
  try{
   const record=JSON.parse(btn.dataset.v3LanguageEdit);
   for(const field of ['postId','language','title','excerpt','body','revision'])
    if(form.elements[field])form.elements[field].value=record[field]??'';
   form.scrollIntoView({behavior:'instant',block:'start'});
   form.elements.title.focus({preventScroll:true});
   note('Editing a review draft. Saving will require new approval.');
  }catch{note('Could not load this draft. Please refresh.')}
 }));
 for(const action of ['publish','revoke']){
  document.querySelectorAll('[data-v3-language-'+action+']').forEach(btn=>btn.addEventListener('click',async()=>{
   const [postId,lang]=btn.dataset['v3Language'+action[0].toUpperCase()+action.slice(1)].split(':');
   if(!confirm(action==='publish'?'Publish this reviewed translation?':'Unpublish this translation?'))return;
   btn.disabled=true;
   try{await send('/'+encodeURIComponent(postId)+'/'+lang+'/'+action,{confirm:true,revision:Number(btn.dataset.v3LanguageRevision)});location.reload()}
   catch(e){note(e.message);btn.disabled=false}
  }));
 }
})();