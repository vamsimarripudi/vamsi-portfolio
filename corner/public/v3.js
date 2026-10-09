(() => {
  const base=location.pathname.startsWith('/corner')?'/corner':'';
  async function submit(url,data){
    const res=await fetch(base+'/api/v1/'+url,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
    const body=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(body.error?.message||'Try again.');
    return body.data;
  }
  function bind(form,endpoint,fields,success){
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=form.querySelector('button[type=submit]'),label=form.querySelector('.v3-feedback');
      button.disabled=true;label.textContent='Working…';
      try{const result=await submit(endpoint,fields(new FormData(form)));label.textContent=success(result);form.reset();}
      catch(error){label.textContent=error.message;}
      finally{button.disabled=false;}
    });
  }
  const guest=document.querySelector('[data-v3="guestbook"]');
  if(guest)bind(guest,'guestbook',f=>({name:f.get('name'),message:f.get('message'),consent:f.get('consent')==='on'}),()=> 'Thank you. Your note is awaiting review.');
  const follow=document.querySelector('[data-v3="follow"]');
  if(follow)bind(follow,'follow',f=>({email:f.get('email'),frequency:f.get('frequency'),topics:['all'],consent:f.get('consent')==='on'}),data=>data.message||'Check your email.');
  const confirm=document.querySelector('[data-v3-verify]');
  if(confirm)confirm.addEventListener('click',async()=>{
    const status=document.querySelector('[data-v3-confirm] .v3-feedback');
    const token=new URLSearchParams(location.hash.slice(1)).get('token');
    if(!token){status.textContent='Missing verification token.';return;}
    confirm.disabled=true;
    try{await submit('follow/verify',{token});history.replaceState(null,'',location.pathname);status.textContent='You are now following Corner.';}
    catch(error){status.textContent=error.message;}
    finally{confirm.disabled=false;}
  });
  const unsubscribeRequest=document.querySelector('[data-v3="unsub-request"]');
  if(unsubscribeRequest)bind(unsubscribeRequest,'follow/unsubscribe/request',f=>({email:f.get('email')}),()=> 'If subscribed, an unsubscribe link is on its way.');
  const unsubscribe=document.querySelector('[data-v3-unsubscribe-button]');
  if(unsubscribe)unsubscribe.addEventListener('click',async()=>{
    const status=document.querySelector('[data-v3-unsubscribe] .v3-feedback');
    const token=new URLSearchParams(location.hash.slice(1)).get('token');
    if(!token){status.textContent='Missing unsubscribe token.';return;}
    unsubscribe.disabled=true;
    try{await submit('follow/unsubscribe',{token});history.replaceState(null,'',location.pathname);status.textContent='You have been unsubscribed.';}
    catch(error){status.textContent=error.message;}
    finally{unsubscribe.disabled=false;}
  });
  const savePosition=document.querySelector('[data-v3-save-progress]');
  if(savePosition)savePosition.addEventListener('click',async()=>{
    savePosition.disabled=true;
    const id=savePosition.dataset.postId;
    const height=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
    const progress=Math.max(0,Math.min(100,Math.round(window.scrollY/height*100)));
    try{
      const res=await fetch(base+'/api/v1/me/reading/'+encodeURIComponent(id),{
        method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({progress})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(data.error?.message||'Please sign in to save.');
      savePosition.textContent='Saved '+progress+'% ✓';
    }catch(error){savePosition.textContent=error.message;}
    finally{savePosition.disabled=false;}
  });
})();
