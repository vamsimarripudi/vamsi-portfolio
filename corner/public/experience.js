/* First-party, progressive enhancement of Corner member authentication. */
(() => {
  'use strict';
  const prefix=location.pathname.startsWith('/corner')?'/corner':'';
  const dialog=document.createElement('dialog');
  dialog.id='corner-auth-dialog';
  dialog.className='corner-auth-dialog';
  dialog.setAttribute('aria-labelledby','corner-auth-title');
  dialog.innerHTML=
    '<div class="corner-auth-shell">'+
    '<header class="corner-auth-head"><div><p class="eyebrow">VAMSI’S CORNER / MEMBERS</p><h2 id="corner-auth-title">Welcome back.</h2></div><button type="button" class="corner-close" data-auth-close aria-label="Close account dialog">×</button></header>'+
    '<p class="corner-auth-description">Sign in to join conversations and keep your favourite stories.</p>'+
    '<div class="corner-auth-tabs" role="group" aria-label="Choose account action"><button type="button" data-auth-tab="login" aria-pressed="true">Sign in</button><button type="button" data-auth-tab="register" aria-pressed="false">Create profile</button></div>'+
    '<form class="corner-auth-form" data-auth-form="login">'+
    '<label>Email address<input name="email" type="email" autocomplete="username" inputmode="email" maxlength="254" required></label>'+
    '<label>Password<input name="password" type="password" autocomplete="current-password" required></label>'+
    '<button type="submit" class="corner-auth-primary">Sign in <span aria-hidden="true">↗</span></button>'+
    '<p><a href="'+prefix+'/forgot-password">Forgot your password?</a></p></form>'+
    '<form class="corner-auth-form" data-auth-form="register" hidden>'+
    '<label>Display name<input name="name" type="text" autocomplete="name" maxlength="60" required></label>'+
    '<label>Email address<input name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required></label>'+
    '<label>Password<input name="password" type="password" autocomplete="new-password" minlength="6" maxlength="128" required></label>'+
    '<button type="submit" class="corner-auth-primary">Create profile <span aria-hidden="true">↗</span></button></form>'+
    '<p class="corner-auth-message" role="status" aria-live="polite"></p>'+
    '<p class="corner-auth-fine">Registration requires email verification. Comments are reviewed before appearing.</p></div>';
  document.body.append(dialog);
  const title=dialog.querySelector('#corner-auth-title');
  const message=dialog.querySelector('.corner-auth-message');
  let lastInvoker=null;
  let loggedIn=false;
  function mode(next){
    const register=next==='register';
    title.textContent=register?'Join the Corner.':'Welcome back.';
    message.textContent='';
    message.removeAttribute('data-error');
    for(const form of dialog.querySelectorAll('[data-auth-form]'))form.hidden=form.dataset.authForm!==(register?'register':'login');
    for(const tab of dialog.querySelectorAll('[data-auth-tab]'))tab.setAttribute('aria-pressed',String(tab.dataset.authTab===next));
    (dialog.querySelector(register?'[data-auth-form=register] input[name=name]':'[data-auth-form=login] input[name=email]'))?.focus();
  }
  function open(kind,trigger){
    lastInvoker=trigger||document.activeElement;
    if(!dialog.open)dialog.showModal();
    mode(kind==='register'?'register':'login');
  }
  dialog.querySelector('[data-auth-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
  dialog.addEventListener('close',()=>{if(lastInvoker?.isConnected)lastInvoker.focus();lastInvoker=null});
  for(const button of dialog.querySelectorAll('[data-auth-tab]'))button.addEventListener('click',()=>mode(button.dataset.authTab));
  document.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-auth-open]');
    if(!trigger)return;
    event.preventDefault();
    open(trigger.dataset.authOpen,trigger);
  });
  async function refreshSession(){
    try{
      const response=await fetch(prefix+'/api/v1/auth/session',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)return;
      const body=await response.json();
      loggedIn=body?.data?.authenticated===true;
      const user=body?.data?.user;
      const guestMenu=document.querySelector('[data-profile-guest]');
      const memberMenu=document.querySelector('[data-profile-member]');
      if(guestMenu)guestMenu.hidden=loggedIn;
      if(memberMenu)memberMenu.hidden=!loggedIn;
      const studio=document.querySelector('[data-owner-studio]');
      const staff=loggedIn&&['owner','admin','editor','moderator'].includes(user?.role);
      if(studio){
        studio.hidden=!staff;
        if(staff){
          const label=user.role==='owner'?'Owner Studio':'Studio';
          studio.replaceChildren(document.createTextNode(label+' '));
          const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';studio.append(arrow);
        }
      }
      const identityName=document.querySelector('[data-profile-menu-name]');
      const menuAvatar=document.querySelector('[data-profile-menu-avatar]');
      const trigger=document.querySelector('[data-corner-profile-toggle]');
      const triggerAvatar=document.querySelector('[data-profile-trigger-avatar]');
      if(identityName&&loggedIn&&user)identityName.textContent=user.displayName||'My profile';
      const updateAvatar=(holder,size)=>{
        if(!holder)return;
        holder.replaceChildren();
        if(loggedIn&&user?.hasAvatar){
          const pic=document.createElement('img');pic.alt='';pic.width=size;pic.height=size;
          pic.src=prefix+'/api/v1/me/avatar';holder.append(pic);
        }else holder.textContent=(user?.displayName||'M').trim().slice(0,1).toUpperCase()||'M';
      };
      if(loggedIn&&user){updateAvatar(menuAvatar,44);updateAvatar(triggerAvatar,30)}
      if(trigger&&triggerAvatar){
        triggerAvatar.hidden=!loggedIn;
        const portraitIcon=trigger.querySelector('svg');
        if(portraitIcon)portraitIcon.hidden=loggedIn;
        trigger.setAttribute('aria-label',loggedIn?'Open my account menu':'Open profile options');
      }
      document.querySelectorAll('[data-auth-open]').forEach(link=>{
        if(!dialog.contains(link))link.hidden=loggedIn;
      });
      document.querySelectorAll('[data-profile-link]').forEach(link=>{
        link.hidden=!loggedIn;
        if(!loggedIn||!user)return;
        link.replaceChildren();
        if(user.hasAvatar){
          const picture=document.createElement('img');
          picture.alt='';picture.width=26;picture.height=26;
          picture.src=prefix+'/api/v1/me/avatar';
          link.append(picture);
        }
        const title=document.createElement('span');
        title.textContent=(user.displayName||'My')+' · Profile';
        title.style.overflow='hidden';title.style.textOverflow='ellipsis';
        link.append(title);
      });
      const gate=document.querySelector('[data-comments-locked]');
      const form=document.querySelector('#comment-form');
      if(gate)gate.hidden=loggedIn;
      if(form)form.hidden=!loggedIn;
      if(form&&user){
        let caption=form.querySelector('[data-comment-identity]');
        if(!caption){
          caption=document.createElement('p');
          caption.dataset.commentIdentity='';
          caption.className='corner-comment-identity';
          form.prepend(caption);
        }
        caption.textContent='Commenting as '+(user.displayName||'Member');
      }
    }catch{
      // The signed-out view is the safe fallback when session checks fail.
    }
  }
  const menuLogout=document.querySelector('[data-profile-logout]');
  menuLogout?.addEventListener('click',async()=>{
    menuLogout.disabled=true;
    const notice=document.querySelector('[data-profile-notice]');
    if(notice)notice.textContent='Signing out…';
    try{
      const response=await fetch(prefix+'/api/v1/auth/logout',{method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('Could not sign out. Please try again.');
      location.assign(prefix+'/');
    }catch(error){
      menuLogout.disabled=false;
      if(notice)notice.textContent=error.message||'Could not sign out.';
    }
  });
  for(const form of dialog.querySelectorAll('[data-auth-form]')){
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(!form.reportValidity())return;
      const kind=form.dataset.authForm,button=form.querySelector('button[type=submit]');
      const values=Object.fromEntries(new FormData(form).entries());
      button.disabled=true;message.removeAttribute('data-error');message.textContent='Checking securely…';
      try{
        const response=await fetch(prefix+'/api/v1/auth/'+kind,{
          method:'POST',credentials:'same-origin',cache:'no-store',
          headers:{'content-type':'application/json'},
          body:JSON.stringify(values)
        });
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body?.error?.message||'Could not complete the request.');
        if(kind==='register'){
          form.reset();
          message.textContent='Profile requested. Check your email for the verification link, then sign in.';
        }else{
          await refreshSession();
          if(!loggedIn)throw new Error('Please refresh the page and sign in again.');
          dialog.close();
          form.reset();
        }
      }catch(error){
        message.textContent=error.message||'Please try again.';
        message.dataset.error='true';
      }finally{button.disabled=false}
    });
  }
  refreshSession();
})();