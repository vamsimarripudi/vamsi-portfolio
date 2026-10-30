(() => {
  'use strict';
  const root=document.querySelector('[data-account-page]');
  if(!root)return;
  const first=(selector,within=document)=>within.querySelector(selector);
  const many=(selector,within=document)=>[...within.querySelectorAll(selector)];
  const initial=window.__CORNER__||{};
  const base='/corner';
  const endpoints={register:'auth/register',login:'auth/login',verify:'auth/email/verify',resend:'auth/email/resend',forgot:'auth/password/forgot',reset:'auth/password/reset',
    'confirm-email':'auth/email/confirm','email-change':'auth/email/change','admin-register':'auth/admin/register','mfa-activate':'auth/mfa/activate',invite:'admin/invitations',profile:'me',preferences:'me/preferences','password-change':'auth/password/change'};
  const isEmail=(value)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||''));
  const response=(form,text,wrong=false)=>{const el=first('[data-account-response]',form);if(el){el.textContent=text;el.dataset.error=String(wrong);el.dataset.success=String(!wrong)}};
  let token='';
  try{const params=new URLSearchParams(location.hash.replace(/^#/,''));token=params.get('token')||''}catch{ /* storage or URL fragment may be unavailable; keep the form usable */ }
  if(token&&location.hash){history.replaceState(history.state,'',location.pathname+location.search)}
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
  try{challenge=sessionStorage.getItem('corner-mfa-challenge')||''}catch{ /* storage or URL fragment may be unavailable; keep the form usable */ }
  const mfaForm=first('form[data-account-form=mfa-activate]');
  if(mfaForm){
    const setup=first('[data-mfa-secret]'),key=first('[data-secret]');
    if(!challenge&&!initial.account?.mfaEnabled&&initial.account?.role==='owner'){
      response(mfaForm,'Preparing your owner authenticator setup.');
    }else if(!challenge)response(mfaForm,'Your setup session has expired. Sign in to the studio again.',true);
    if(challenge||initial.account?.role==='owner')api('auth/mfa/setup','POST',challenge?{challenge}:{challenge:''}).then(result=>{
      setup.hidden=false;key.textContent=result.secret;challenge=result.challenge;
      try{sessionStorage.setItem('corner-mfa-challenge',challenge)}catch{ /* storage or URL fragment may be unavailable; keep the form usable */ }
    }).catch(error=>response(mfaForm,error.message,true));
  }
  async function actionMotion(options){
    if(window.CornerActionMotion?.run)return window.CornerActionMotion.run(options);
    try{const result=await options.execute({progress:()=>{}});await options.onSuccess?.(result);return {ok:true,result}}
    catch(error){options.onFailure?.(error);return {ok:false,error}}
  }
  for(const form of many('form[data-account-form]')){
    form.addEventListener('submit',async(event)=>{
      event.preventDefault();
      const kind=form.dataset.accountForm,button=first('button[type=submit]',form),data=dataOf(form);
      if(data.email&&!isEmail(data.email)){response(form,'Enter a valid email address.',true);return}
      const compact=initial.memberCompactPasswords===true;
      // Password length on login must not reject existing longer credentials.
      if(kind==='register'&&data.password){
        const min=compact?6:12,max=compact?12:128;
        if(data.password.length<min||data.password.length>max){
          response(form,compact?'Member passwords must contain 6–12 characters.':'Use a password with at least 12 characters.',true);return
        }
      }
      if(kind==='admin-register'&&data.password&&(data.password.length<12||data.password.length>128)){
        response(form,'Studio passwords must contain at least 12 characters.',true);return
      }
      if(kind==='reset'&&data.password&&(data.password.length<6||data.password.length>128)){
        response(form,'Enter a valid new password.',true);return
      }
      if(kind==='password-change'&&data.newPassword){
        const member=initial.account?.role==='member'&&compact;
        if(data.newPassword.length<(member?6:12)||data.newPassword.length>(member?12:128)){
          response(form,member?'Member passwords must contain 6–12 characters.':'Use a password with at least 12 characters.',true);return
        }
      }
      if(kind==='verify'&&!data.token){response(form,'This verification link has no token. Request a new email.',true);return}
      if(kind==='confirm-email'&&!data.token){response(form,'Your email-confirmation link is missing or expired.',true);return}
      if(kind==='reset'&&!data.token){response(form,'Your reset link is missing or expired.',true);return}
      if(kind==='admin-register'&&!data.token){response(form,'This invitation link is incomplete or expired.',true);return}
      if(kind==='mfa-activate'&&!challenge){response(form,'Authenticator setup has expired. Sign in again.',true);return}
      button.disabled=true;response(form,'Working securely…');
      try{
        let result;
        if(kind==='mfa-activate')result=await api(endpoints[kind],'POST',{challenge,code:data.code});
        else if(kind==='profile'||kind==='preferences'){
          // Only ordinary account/profile edits animate; security stays quiet.
          const operation=kind==='profile'?'profile.save':'account.preferences';
          const outcome=await actionMotion({action:operation,trigger:button,targetId:kind,
            visualTarget:form.closest('.account-card')||form,
            execute:()=>kind==='profile'
              ?api(endpoints.profile,'PATCH',{
                displayName:data.displayName,bio:data.bio,
                locale:initial.account?.locale||'en',emailUpdates:initial.account?.emailUpdates===true
               })
              :api(endpoints.preferences,'PATCH',{
                locale:data.locale,emailUpdates:!!first('input[name=emailUpdates]',form)?.checked
               }),
            confirm:value=>!!value,
            onFailure:error=>response(form,error.message,true)});
          if(!outcome.ok)return;
          result=outcome.result;
        }else result=await api(endpoints[kind],'POST',data);
        if(kind==='login'){location.assign(base+'/profile');return}
        if(kind==='admin-register'){
          response(form,'Account created. Sign in to the studio to enrol an authenticator.');
          try{sessionStorage.removeItem('corner-mfa-challenge')}catch{ /* storage or URL fragment may be unavailable; keep the form usable */ }
          return;
        }
        if(kind==='mfa-activate'){
          try{sessionStorage.removeItem('corner-mfa-challenge')}catch{ /* storage or URL fragment may be unavailable; keep the form usable */ }
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
        else if(kind==='profile'){markClean(form);response(form,'Profile updated.');location.assign(base+'/profile');return}
        else if(kind==='preferences'){markClean(form);response(form,'Preferences saved.');}
        else response(form,'Saved.');
      }catch(error){response(form,error.message||'Please try again.',true)}
      finally{if(button.type==='submit')button.disabled=false}
    });
  }
  const profileForm=first('form[data-account-form=profile]');
  if(profileForm&&initial.account){
    const p=initial.account;
    for(const key of ['displayName','bio']){const el=profileForm.elements[key];if(el)el.value=p[key]||''}
    const counter=first('[data-bio-count]',profileForm),bio=profileForm.elements.bio;
    if(counter&&bio){const update=()=>{counter.textContent=bio.value.length+' / 280'};bio.addEventListener('input',update);update()}
    if(profileForm.elements.locale)profileForm.elements.locale.value=p.locale||'en';
    if(profileForm.elements.emailUpdates)profileForm.elements.emailUpdates.checked=!!p.emailUpdates;
  }
  const preferencesForm=first('form[data-account-form=preferences]');
  if(preferencesForm&&initial.account){
    preferencesForm.elements.locale.value=initial.account.locale||'en';
    preferencesForm.elements.emailUpdates.checked=!!initial.account.emailUpdates;
  }

  // Unsaved changes protection: only editable profile/preference forms. Form
  // submission is not blocked. Native beforeunload is used for browser
  // navigation/refresh (browsers do not allow a custom message there).
  const dirtyForms=[profileForm,preferencesForm].filter(Boolean);
  const originals=new WeakMap();
  const formSnapshot=form=>JSON.stringify([...new FormData(form).entries()].sort(([a],[b])=>a.localeCompare(b)));
  function markClean(form){
    if(!form)return;
    originals.set(form,formSnapshot(form));
    form.dataset.unsaved='false';
  }
  const isDirty=form=>form&&originals.has(form)&&formSnapshot(form)!==originals.get(form);
  const anythingDirty=()=>dirtyForms.some(isDirty);
  const markState=form=>{form.dataset.unsaved=String(isDirty(form));};
  const discardDialog=document.createElement('dialog');
  discardDialog.className='quiet-discard-dialog';
  discardDialog.setAttribute('aria-labelledby','quiet-discard-title');
  discardDialog.innerHTML='<div class="quiet-discard-content"><p class="quiet-discard-eyebrow">UNSAVED CHANGES</p><h2 id="quiet-discard-title">Discard your changes?</h2><p>You have edits that have not been saved. Leaving now will lose them.</p><div class="quiet-discard-actions"><button type="button" data-discard-cancel>Keep editing</button><button type="button" data-discard-confirm>Discard changes</button></div></div>';
  if(dirtyForms.length){
    document.body.append(discardDialog);
    for(const form of dirtyForms){
      markClean(form);
      form.addEventListener('input',()=>markState(form));
      form.addEventListener('change',()=>markState(form));
    }
    window.addEventListener('beforeunload',event=>{
      if(!anythingDirty())return;
      event.preventDefault();
      event.returnValue='';
    });
    let pendingHref=null;
    const cancel=discardDialog.querySelector('[data-discard-cancel]');
    const confirm=discardDialog.querySelector('[data-discard-confirm]');
    const openDiscard=href=>{
      pendingHref=href;
      if(typeof discardDialog.showModal==='function')discardDialog.showModal();
      else if(window.confirm('Discard unsaved changes?')){
        dirtyForms.forEach(markClean);
        location.assign(href);
      }
    };
    cancel.addEventListener('click',()=>{pendingHref=null;discardDialog.close();});
    discardDialog.addEventListener('cancel',()=>{pendingHref=null;});
    discardDialog.addEventListener('click',event=>{if(event.target===discardDialog){pendingHref=null;discardDialog.close();}});
    confirm.addEventListener('click',()=>{
      const href=pendingHref;
      pendingHref=null;
      dirtyForms.forEach(markClean);
      discardDialog.close();
      if(href)location.assign(href);
      else{
        for(const form of dirtyForms){form.reset();markClean(form);}
        location.reload();
      }
    });
    document.addEventListener('click',event=>{
      const anchor=event.target.closest('a[href]');
      if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!anythingDirty())return;
      const target=anchor.getAttribute('target');
      if(target&&target!=='_self')return;
      const href=new URL(anchor.href,location.href);
      if(href.origin!==location.origin||href.pathname===location.pathname&&href.search===location.search&&href.hash!==location.hash)return;
      event.preventDefault();
      openDiscard(href.href);
    },true);
    const controls=document.createElement('div');
    controls.className='quiet-edit-exit';
    controls.innerHTML='<button type="button" class="quiet-discard-button" data-discard-edits>Discard edits</button><a href="/corner/profile" data-edit-cancel>Cancel &amp; return</a>';
    const current=dirtyForms[0];
    const responseEl=current.querySelector('[data-account-response]');
    (responseEl?.parentElement||current).append(controls);
    controls.querySelector('[data-discard-edits]').addEventListener('click',()=>{
      if(anythingDirty())openDiscard(null);
      else response(current,'Nothing to discard.');
    });
    // Cancel & return is handled by the document link interceptor if dirty.
  }

  // Profile image: local crop, server-side WebP sanitization and private session access.
  const avatarPanel=first('[data-account-avatar]');
  if(avatarPanel){
    const input=first('[data-avatar-file]',avatarPanel),status=first('[data-avatar-status]',avatarPanel);
    const imageHolder=first('.account-avatar-visual',avatarPanel);
    const remove=first('[data-avatar-remove]',avatarPanel);
    const setBusy=busy=>{input.disabled=busy;remove.disabled=busy;avatarPanel.setAttribute('aria-busy',String(busy))};
    const showImage=()=>{
      imageHolder.replaceChildren();
      const img=document.createElement('img');
      img.dataset.avatarImage='';img.alt='Your profile photo';img.width=80;img.height=80;
      img.src=base+'/api/v1/me/avatar?updated='+Date.now();
      imageHolder.append(img);remove.hidden=false;
    };
    input.addEventListener('change',async()=>{
      const selected=input.files?.[0];
      if(!selected)return;
      setBusy(true);status.textContent='Preparing your image…';
      try{
        if(selected.size>3*1024*1024)throw Error('Choose a photo smaller than 3 MB.');
        if(!['image/jpeg','image/png','image/webp'].includes(selected.type))throw Error('Choose a JPEG, PNG or WebP image.');
        const cropped=window.CornerImageCrop?await window.CornerImageCrop.open(selected):selected;
        if(!cropped){status.textContent='Photo not changed.';return}
        status.textContent='Uploading your cropped photo…';
        const response=await fetch(base+'/api/v1/me/avatar',{
          method:'POST',credentials:'same-origin',cache:'no-store',
          headers:{'content-type':cropped.type},body:cropped,signal:AbortSignal.timeout(20000)
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw Error(data.error?.message||'Photo upload failed.');
        showImage();status.textContent='Your profile photo is saved securely.';
      }catch(error){status.textContent=error.name==='TimeoutError'?'Upload timed out. Try again.':error.message}
      finally{input.value='';setBusy(false)}
    });
    remove.addEventListener('click',async()=>{
      if(!confirm('Remove your profile photo?'))return;
      setBusy(true);status.textContent='Removing your photo…';
      try{
        const response=await fetch(base+'/api/v1/me/avatar',{method:'DELETE',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
        if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.error?.message||'Could not remove the photo.')}
        imageHolder.replaceChildren();
        const letter=document.createElement('span');letter.className='account-avatar-monogram';letter.dataset.avatarPlaceholder='';letter.textContent=(initial.account?.displayName||'M').slice(0,1).toUpperCase();
        imageHolder.append(letter);remove.hidden=true;status.textContent='Profile photo removed.';
      }catch(error){status.textContent=error.message||'Could not remove the photo.'}
      finally{setBusy(false)}
    });
  }
  async function displayBookmarks(){
    const target=first('[data-account-bookmarks]');if(!target)return;
    const count=first('[data-bookmark-count]');
    try{
      const books=await api('me/bookmarks');
      target.replaceChildren();
      if(count)count.textContent=String(books.length)+' saved';
      if(!books.length){
        const empty=document.createElement('div');empty.className='quiet-empty';
        const icon=document.createElement('span');icon.className='quiet-bookmark-icon';icon.textContent='✳';icon.setAttribute('aria-hidden','true');
        const heading=document.createElement('h3');heading.textContent='No saved stories yet.';
        const info=document.createElement('p');info.textContent='When you save a story, it will appear here for easy reading.';
        const link=document.createElement('a');link.className='quiet-action-link';link.href=base+'/';link.textContent='Explore stories ↗';
        empty.append(icon,heading,info,link);target.append(empty);return;
      }
      const list=document.createElement('ul');
      for(const book of books){
        const li=document.createElement('li');
        const art=document.createElement('span');art.className='quiet-bookmark-icon';art.textContent='✳';art.setAttribute('aria-hidden','true');
        const copy=document.createElement('div');copy.className='quiet-bookmark-copy';
        const a=document.createElement('a');a.href=base+'/post/'+encodeURIComponent(book.slug);a.textContent=book.title||'Saved story';
        const date=document.createElement('small');
        const label=book.type?book.type.replace(/_/g,' ')+' · ':'';
        date.textContent=label+(book.saved_at?new Date(book.saved_at).toLocaleDateString(undefined,{dateStyle:'medium'}):'Saved in your Corner');
        copy.append(a,date);
        const remove=document.createElement('button');remove.type='button';remove.className='quiet-bookmark-remove';
        remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+(book.title||'story')+' from saved stories');
        remove.addEventListener('click',async()=>{
          remove.disabled=true;remove.textContent='Removing…';
          try{await api('me/bookmarks/'+encodeURIComponent(book.id),'DELETE');await displayBookmarks()}
          catch(error){remove.disabled=false;remove.textContent='Remove';date.textContent=error.message||'Could not remove this story.'}
        });
        li.append(art,copy,remove);list.append(li);
      }
      target.append(list);
    }catch(error){target.textContent=error.message||'Could not load saved stories.';if(count)count.textContent='—'}
  }
  async function displaySessions(){const target=first('[data-account-sessions]');if(!target)return;
    try{const sessions=await api('me/sessions');target.replaceChildren();const list=document.createElement('ul');
      const active=sessions.filter(x=>!x.revoked_at);if(!active.length){target.textContent='No active sessions found.';return}
      for(const s of active){const li=document.createElement('li'),info=document.createElement('span'),btn=document.createElement('button');info.textContent='Signed in '+new Date(s.created_at).toLocaleDateString();btn.type='button';btn.className='account-text-button';btn.textContent='Revoke';btn.onclick=async()=>{btn.disabled=true;try{await api('me/sessions/'+encodeURIComponent(s.id),'DELETE');await displaySessions()}catch(error){target.textContent=error.message||'Could not revoke this session.'}};li.append(info,btn);list.append(li)}target.append(list);
    }catch(error){target.textContent=error.message}
  }
  displayBookmarks();displaySessions();
  first('[data-account-logout]')?.addEventListener('click',async()=>{try{await api('auth/logout','POST',{});location.assign(base+'/login')}catch(error){alert(error.message)}});
  const exportStatus=first('[data-export-status]')||first('[data-account-data-status]');
  const deletionStatus=first('[data-delete-status]')||first('[data-account-data-status]');
  const setExportStatus=text=>{if(exportStatus)exportStatus.textContent=text};
  const setDeletionStatus=text=>{if(deletionStatus)deletionStatus.textContent=text};
  first('[data-account-export]')?.addEventListener('click',async()=>{
    setExportStatus('Preparing your account export…');
    try{
      const info=await api('me/export','POST',{});
      const blob=new Blob([JSON.stringify(info,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='corner-account-export.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      setExportStatus('Your account export is ready.');
    }catch(error){setExportStatus(error.message||'Could not export your account data.')}
  });
  const deletionDialog=first('[data-account-delete-dialog]');
  const deletionTrigger=first('[data-account-delete]');
  const deletionConfirm=first('[data-account-delete-confirm]')||first('[data-delete-confirm]');
  const deletionMessage=first('[data-account-delete-status]');
  (first('[data-account-delete-cancel]')||first('[data-delete-cancel]'))?.addEventListener('click',()=>deletionDialog?.close());
  deletionDialog?.addEventListener('click',event=>{if(event.target===deletionDialog)deletionDialog.close()});
  const requestDeletion=async()=>{
    if(deletionConfirm)deletionConfirm.disabled=true;
    if(deletionMessage)deletionMessage.textContent='Submitting your request…';
    try{
      await api('me/deletion','POST',{});
      if(deletionDialog?.open)deletionDialog.close();
      setDeletionStatus('Deletion review requested. No immediate account deletion occurs.');
    }catch(error){
      const description=error.message||'Could not submit the deletion request.';
      if(deletionMessage)deletionMessage.textContent=description;
      else setDeletionStatus(description);
    }finally{if(deletionConfirm)deletionConfirm.disabled=false}
  };
  deletionTrigger?.addEventListener('click',()=>{
    if(deletionDialog?.showModal){
      if(deletionMessage)deletionMessage.textContent='';
      deletionDialog.showModal();
      (first('[data-account-delete-cancel]')||first('[data-delete-cancel]'))?.focus();
    }else if(confirm('Request review of your account deletion? This will not delete your posts or other people’s content.')){
      void requestDeletion();
    }
  });
  deletionConfirm?.addEventListener('click',()=>{void requestDeletion()});
})();
