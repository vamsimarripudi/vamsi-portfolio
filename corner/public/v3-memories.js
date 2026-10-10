(() => {
 const current=window.location.pathname.startsWith('/corner')?'/corner':'';
 const dialog=document.querySelector('[data-v3m-lightbox]');
 if(dialog){
  const photos=[...document.querySelectorAll('[data-v3m-photo]')];
  const photo=dialog.querySelector('figure img'),caption=dialog.querySelector('figcaption');
  const counter=dialog.querySelector('[data-v3m-counter]');
  const previous=dialog.querySelector('[data-v3m-prev]'),next=dialog.querySelector('[data-v3m-next]');
  const close=dialog.querySelector('[data-v3m-close]');
  let opener=null,index=0,sequence=0,touch=null;
  const show=indexToShow=>{
   if(!photos.length)return;
   index=(indexToShow+photos.length)%photos.length;
   const source=photos[index],serial=++sequence;
   dialog.dataset.photoState='loading';
   photo.alt=source.dataset.alt||'Photograph';
   caption.textContent=source.dataset.caption||'';
   counter.textContent=(index+1)+' / '+photos.length;
   previous.disabled=photos.length<2;next.disabled=photos.length<2;
   photo.src=source.dataset.src;
   const decoding=typeof photo.decode==='function'?photo.decode():Promise.resolve();
   decoding.then(()=>{
    if(serial===sequence&&dialog.open)dialog.dataset.photoState='ready';
   }).catch(()=>{
    if(serial===sequence&&dialog.open){
     dialog.dataset.photoState='error';
     caption.textContent='Photograph temporarily unavailable.';
    }
   });
  };
  photos.forEach((button,n)=>button.addEventListener('click',()=>{
   opener=button;
   if(!dialog.open)dialog.showModal();
   show(n);close.focus({preventScroll:true});
  }));
  previous.addEventListener('click',()=>show(index-1));
  next.addEventListener('click',()=>show(index+1));
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',event=>{
   if(event.altKey||event.ctrlKey||event.metaKey||photos.length<2)return;
   if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();show(index+(event.key==='ArrowRight'?1:-1));
   }
  });
  photo.addEventListener('touchstart',event=>{
   const point=event.changedTouches[0];
   if(point)touch={x:point.clientX,y:point.clientY};
  },{passive:true});
  photo.addEventListener('touchend',event=>{
   const point=event.changedTouches[0];if(!touch||!point||photos.length<2)return;
   const x=point.clientX-touch.x,y=point.clientY-touch.y;
   touch=null;
   if(Math.abs(x)>55&&Math.abs(x)>Math.abs(y)*1.25)show(index+(x<0?1:-1));
  },{passive:true});
  dialog.addEventListener('close',()=>{
   sequence++;photo.removeAttribute('src');delete dialog.dataset.photoState;
   const source=opener;opener=null;source?.focus({preventScroll:true});
  });
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
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
