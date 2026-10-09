(() => {
 const current=window.location.pathname.startsWith('/corner')?'/corner':'';
 const dialog=document.querySelector('[data-v3m-lightbox]');
 if(dialog){
  let opener;
  document.querySelectorAll('[data-v3m-photo]').forEach(b=>b.addEventListener('click',()=>{
   opener=b;
   const image=dialog.querySelector('img'),label=dialog.querySelector('figcaption');
   image.src=b.dataset.src;image.alt=b.dataset.alt||'Photograph';
   label.textContent=b.dataset.caption||'';
   if(!dialog.open)dialog.showModal();
   dialog.querySelector('[data-v3m-close]').focus();
  }));
  dialog.querySelector('[data-v3m-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{dialog.querySelector('img').removeAttribute('src');opener?.focus()});
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
 }
 document.querySelectorAll('[data-v3m-form]').forEach(form=>{
  const resource=form.dataset.v3mForm;
  form.addEventListener('submit',async event=>{
   event.preventDefault();const btn=form.querySelector('[type=submit]'),msg=form.querySelector('[role=status]');
   if(!form.reportValidity())return;
   const data=Object.fromEntries(new FormData(form));
   if(resource==='albums')data.mediaIds=Array.from(form.elements.mediaIds.selectedOptions).map(o=>o.value);
   if(resource==='collections')data.postIds=Array.from(form.elements.postIds.selectedOptions).map(o=>o.value);
   if(resource==='milestones'&&!data.postId)data.postId=null;
   const id=form.dataset.editId||'',url=current+'/api/v1/admin/v3/'+resource+(id?'/'+encodeURIComponent(id):'');
   btn.disabled=true;msg.textContent='Saving…';
   try{
    const res=await fetch(url,{method:id?'PATCH':'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
    const json=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(json.error?.message||'Unable to save.');
    msg.textContent='Saved. Refreshing…';window.location.reload();
   }catch(e){msg.textContent=e.message;btn.disabled=false}
  });
 });
 document.querySelectorAll('[data-v3m-edit]').forEach(b=>b.addEventListener('click',()=>{
  const name=b.dataset.v3mEdit,form=document.querySelector('[data-v3m-form="'+name+'"]');if(!form)return;
  const obj=JSON.parse(b.dataset.fields||'{}');form.dataset.editId=b.dataset.id;
  for(const field of ['title','summary','state','kind','postId','occurredOn']){
   const input=form.elements[field];
   if(input)input.value=obj[field]??obj[({occurredOn:'occurred_on',postId:'post_id'})[field]]??'';
  }
  const select=name==='albums'?form.elements.mediaIds:name==='collections'?form.elements.postIds:null;
  if(select){const selected=new Set(name==='albums'?obj.mediaIds:obj.postIds);Array.from(select.options).forEach(o=>o.selected=selected.has(o.value))}
  form.querySelector('[type=submit]').textContent='Update ↗';
  form.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  form.elements.title.focus({preventScroll:true});
 }));
})();
