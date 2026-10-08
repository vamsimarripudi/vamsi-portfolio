(() => {
  'use strict';
  const root=document.querySelector('[data-account-page]');
  if(!root)return;
  const first=(selector,within=document)=>within.querySelector(selector);
  const many=(selector,within=document)=>[...within.querySelectorAll(selector)];
  const initial=window.__CORNER__||{};
  const base='/corner';
  const endpoints={register:'auth/register',login:'auth/login',verify:'auth/email/verify',resend:'auth/email/resend',forgot:'auth/password/forgot',reset:'auth/password/reset',
    'confirm-email':'auth/email/confirm','email-change':'auth/email/change','admin-register':'auth/admin/register','mfa-activate':'auth/mfa/activate',invite:'admin/invitations',profile:'me','password-change':'auth/password/change'};
  const isEmail=(value)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||''));
  const response=(form,text,wrong=false)=>{const el=first('[data-account-response]',form);if(el){el.textContent=text;el.dataset.error=String(wrong);el.dataset.success=String(!wrong)}};
  let token='';
  try{const params=new URLSearchParams(location.hash.replace(/^#/,''));token=params.get('token')||''}catch{}
  if(location.hash){history.replaceState(history.state,'',location.pathname+location.search)}
  many('[data-fragment-token]').forEach(field=>{field.value=token});
  async function api(name,method='GET',body){
    const options={method,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(18000),headers:{accept:'application/json'}};
    if(body!==undefined){options.headers['content-type']='application/json';options.body=JSON.stringify(body)}
    let result;
    try{const res=await fetch(base+'/api/v1/'+name,options);result=await res.json().catch(()=>({}));if(!res.ok){const ex=new Error(result?.error?.message||'Please try again.');ex.code=result?.error?.code;throw ex}return result?.data}
    catch(error){if(error.name==='TimeoutError')throw new Error('The request timed out. Please try again.');throw error}
  }
  const dataOf=(form)=>Object.fromEntries(new FormData(form).entries());
  many('[data-toggle-password]').forEach(button=>button.addEventListener('click',()=>{
    const input=first('input',button.parentElement);if(!input)return;
    input.type=input.type==='password'?'text':'password';button.textContent=input.type==='text'?'Hide':'Show';button.setAttribute('aria-label',(input.type==='text'?'Hide':'Show')+' password');
  }));
  // Email-first progressive reveal; disabled JS still leaves native fields accessible.
  for(const form of many('form[data-account-form]')){
    const email=first('input[type=email]',form),password=first('input[type=password]',form);
    if(email&&password){
      const field=password.closest('.account-field');
      const update=()=>{const ready=isEmail(email.value)&&email.value.length<=254;field.hidden=!ready;field.setAttribute('aria-hidden',String(!ready))};
      if(!email.value)update();email.addEventListener('input',update);
    }
  }
  let challenge='';
  try{challenge=sessionStorage.getItem('corner-mfa-challenge')||''}catch{}
  const mfaForm=first('form[data-account-form=mfa-activate]');
  if(mfaForm){
    const setup=first('[data-mfa-secret]'),key=first('[data-secret]');
    if(!challenge&&!initial.account?.mfaEnabled&&initial.account?.role==='owner'){
      response(mfaForm,'Preparing your owner authenticator setup.');
    }else if(!challenge)response(mfaForm,'Your setup session has expired. Sign in to the studio again.',true);
    if(challenge||initial.account?.role==='owner')api('auth/mfa/setup','POST',challenge?{challenge}:{challenge:''}).then(result=>{
      setup.hidden=false;key.textContent=result.secret;challenge=result.challenge;
      try{sessionStorage.setItem('corner-mfa-challenge',challenge)}catch{}
    }).catch(error=>response(mfaForm,error.message,true));
  }
  for(const form of many('form[data-account-form]')){
    form.addEventListener('submit',async(event)=>{
      event.preventDefault();
      const kind=form.dataset.accountForm,button=first('button[type=submit]',form),data=dataOf(form);
      if(data.email&&!isEmail(data.email)){response(form,'Enter a valid email address.',true);return}
      if(data.password&&(data.password.length<12||data.password.length>128)){response(form,'Use a password between 12 and 128 characters.',true);return}
      if(data.newPassword&&(data.newPassword.length<12||data.newPassword.length>128)){response(form,'Use a new password between 12 and 128 characters.',true);return}
      if(kind==='verify'&&!data.token){response(form,'This verification link has no token. Request a new email.',true);return}
      if(kind==='confirm-email'&&!data.token){response(form,'Your email-confirmation link is missing or expired.',true);return}
      if(kind==='reset'&&!data.token){response(form,'Your reset link is missing or expired.',true);return}
      if(kind==='admin-register'&&!data.token){response(form,'This invitation link is incomplete or expired.',true);return}
      if(kind==='mfa-activate'&&!challenge){response(form,'Authenticator setup has expired. Sign in again.',true);return}
      button.disabled=true;response(form,'Working securely…');
      try{
        let result;
        if(kind==='mfa-activate')result=await api(endpoints[kind],'POST',{challenge,code:data.code});
        else result=await api(endpoints[kind],kind==='profile'?'PATCH':'POST',kind==='profile'?{
          displayName:data.displayName,bio:data.bio,locale:data.locale,emailUpdates:!!first('input[name=emailUpdates]',form)?.checked
        }:data);
        if(kind==='login'){location.assign(base+'/profile');return}
        if(kind==='admin-register'){
          response(form,'Account created. Sign in to the studio to enrol an authenticator.');
          try{sessionStorage.removeItem('corner-mfa-challenge')}catch{}
          return;
        }
        if(kind==='mfa-activate'){
          try{sessionStorage.removeItem('corner-mfa-challenge')}catch{}
          first('[data-mfa-secret]',form).hidden=false;
          const panel=first('[data-mfa-secret]',form);
          panel.replaceChildren();
          const title=document.createElement('strong');title.textContent='Save your recovery codes now';
          const note=document.createElement('p');note.textContent='These codes are shown only once. Keep them outside your browser.';
          const list=document.createElement('code');list.textContent=(result.recoveryCodes||[]).join('  ·  ');
          panel.append(title,note,list);button.textContent='Continue to the studio';
          button.disabled=false;button.type='button';button.onclick=()=>location.assign(base+'/admin');
          response(form,'Authenticator enabled. Save the codes before continuing.');return;
        }
        if(kind==='register')response(form,'Check your email for a verification link.');
        else if(kind==='resend')response(form,'If eligible, a new verification message is on its way.');
        else if(kind==='email-change')response(form,'Check your new email address to approve this change.');
        else if(kind==='confirm-email'){response(form,'Email updated. Sign in again with the new address.');setTimeout(()=>location.assign(base+'/login'),1200)}
        else if(kind==='invite')response(form,'Invitation request accepted.');
        else if(kind==='forgot')response(form,'If an account exists, you will receive reset instructions.');
        else if(kind==='verify')response(form,'Email verified. You can sign in now.');
        else if(kind==='reset')response(form,'Password changed. Return to sign-in.');
        else if(kind==='password-change'){response(form,'Password changed; your sessions have been revoked. Sign in again.');setTimeout(()=>location.assign(base+'/login'),1200)}
        else if(kind==='profile')response(form,'Profile updated.');
        else response(form,'Saved.');
      }catch(error){response(form,error.message||'Please try again.',true)}
      finally{if(button.type==='submit')button.disabled=false}
    });
  }
  const profileForm=first('form[data-account-form=profile]');
  if(profileForm&&initial.account){
    const p=initial.account;
    for(const key of ['displayName','bio','locale']){const el=profileForm.elements[key];if(el)el.value=p[key]||''}
    profileForm.elements.emailUpdates.checked=!!p.emailUpdates;
  }
  async function displayBookmarks(){const target=first('[data-account-bookmarks]');if(!target)return;
    try{const books=await api('me/bookmarks');target.replaceChildren();if(!books.length){target.textContent='No saved stories yet.';return}
      const list=document.createElement('ul');for(const book of books){const li=document.createElement('li'),a=document.createElement('a');a.href=base+'/post/'+encodeURIComponent(book.slug);a.textContent=book.title;li.append(a);list.append(li)}target.append(list);
    }catch(error){target.textContent=error.message}
  }
  async function displaySessions(){const target=first('[data-account-sessions]');if(!target)return;
    try{const sessions=await api('me/sessions');target.replaceChildren();const list=document.createElement('ul');
      for(const s of sessions.filter(x=>!x.revoked_at)){const li=document.createElement('li'),info=document.createElement('span'),btn=document.createElement('button');info.textContent='Signed in '+new Date(s.created_at).toLocaleDateString();btn.type='button';btn.className='account-text-button';btn.textContent='Revoke';btn.onclick=async()=>{await api('me/sessions/'+encodeURIComponent(s.id),'DELETE');displaySessions()};li.append(info,btn);list.append(li)}target.append(list);
    }catch(error){target.textContent=error.message}
  }
  displayBookmarks();displaySessions();
  first('[data-account-logout]')?.addEventListener('click',async()=>{try{await api('auth/logout','POST',{});location.assign(base+'/login')}catch(error){alert(error.message)}});
  first('[data-account-export]')?.addEventListener('click',async()=>{
    try{const info=await api('me/export','POST',{}),blob=new Blob([JSON.stringify(info,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='corner-account-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}catch(error){alert(error.message)}
  });
  first('[data-account-delete]')?.addEventListener('click',async()=>{
    if(!confirm('Request review of your account deletion? This will not delete your posts or other people’s content.'))return;
    try{await api('me/deletion','POST',{});alert('Deletion review requested.')}catch(error){alert(error.message)}
  });
})();
