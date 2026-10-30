/* Operation-scoped Corner Motion. Never infer API success from a click or pathname. */
(()=>{
 'use strict';
 const active=new WeakMap(),targets=new Map();
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const definitions={
  'draft.save':['paper','Saving…','Saved',320],
  'post.schedule':['clock','Scheduling…','Scheduled',480],
  'post.archive':['archive','Archiving…','Archived',350],
  'post.restore':['restore','Restoring…','Restored',350],
  'post.delete':['archive','Archiving…','Archived',320],
  'media.upload':['upload','Uploading…','Attached',350],
  'media.order':['restore','Reordering…','Reordered',300],
  'media.edit':['paper','Saving media…','Saved',260],
  'media.delete':['archive','Removing…','Removed',300],
  'comment.approve':['check','Approving…','Approved',350],
  'comment.hide':['archive','Hiding…','Hidden',300],
  'comment.delete':['archive','Removing…','Removed',300],
  'comment.reply':['message','Sending…','Replied',350],
  'guestbook.review':['check','Reviewing…','Reviewed',300],
  'settings.save':['check','Saving…','Saved',260],
  'status.save':['check','Updating…','Updated',300],
  'profile.save':['check','Saving…','Updated',280],
  'profile.avatar':['image','Uploading…','Updated',320],
  'account.preferences':['check','Saving…','Saved',260],
  'wish.save':['paper','Saving…','Saved',320],
  'wish.publish':['ribbon','Publishing…','Published',500],
  'wish.schedule':['clock','Scheduling…','Scheduled',400],
  'wish.notify':['message','Queuing…','Queued',300]
 };
 const paths={
  paper:'<rect x="5" y="3" width="14" height="18" rx="2"/><path class="cm-fold" d="M13 3v6h6"/><path class="cm-mark" d="m8 15 2 2 5-5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path class="cm-hand" d="M12 6v6l5 3"/><path class="cm-mark" d="m8 12 3 3 5-6"/>',
  upload:'<path class="cm-tray" d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/><path class="cm-lift" d="M12 17V3m-5 5 5-5 5 5"/><path class="cm-mark" d="m8 12 3 3 5-6"/>',
  archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path class="cm-tray" d="M5 9v11h14V9M10 14h4"/><path class="cm-mark" d="m8 14 3 3 5-6"/>',
  restore:'<path d="M6 6h12v14H6zM9 11h6"/><path class="cm-mark" d="m8 14 3 3 5-6"/>',
  check:'<circle cx="12" cy="12" r="9"/><path class="cm-mark" d="m7 12 3.5 3.5L17 8"/>',
  message:'<path class="cm-lift" d="M20 12a8 8 0 0 1-8 8H4l2-4a8 8 0 1 1 14-4Z"/><path class="cm-mark" d="m8 12 3 3 5-6"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path class="cm-lift" d="m4 17 5-5 4 3 3-4 4 6"/>',
  ribbon:'<path class="cm-fold" d="M6 3h12v17l-6-4-6 4z"/><path class="cm-mark" d="m8 11 3 3 5-6"/>'
 };
 function mount(trigger,action,visualTarget){
  const spec=definitions[action]||definitions['settings.save'];
  const orig={disabled:trigger.disabled,label:trigger.getAttribute('aria-label'),busy:trigger.getAttribute('aria-busy')};
  // Preserve the exact original child nodes, but hide them while the motion layer
  // is active so old Studio styles cannot paint overlapping labels/icons.
  const original=document.createElement('span');original.className='corner-motion-original';
  while(trigger.firstChild)original.append(trigger.firstChild);
  trigger.append(original);
  const visual=document.createElement('span');visual.className='corner-motion-visual';
  visual.setAttribute('aria-hidden','true');
  visual.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">'+(paths[spec[0]]||paths.check)+'</svg><span class="corner-motion-copy"></span>';
  trigger.append(visual);
  const announce=document.createElement('span');announce.className='corner-motion-announcer';
  announce.setAttribute('role','status');announce.setAttribute('aria-live','polite');
  trigger.insertAdjacentElement('afterend',announce);
  let closed=false;
  function state(name,message){
   if(closed)return;
   trigger.dataset.cornerMotionState=name;trigger.dataset.cornerMotionKind=spec[0];
   trigger.setAttribute('aria-busy',String(name==='pending'||name==='processing'));
   trigger.setAttribute('aria-label',message);
   visual.querySelector('.corner-motion-copy').textContent=message;
   announce.textContent=message;
   if(visualTarget?.isConnected)visualTarget.dataset.cornerMotionObject=name;
  }
  trigger.disabled=true;state('pending',spec[1]);
  return {
   progress(message){state('processing',message||spec[1]);},
   async success(label){
    state('success',label||spec[2]);
    if(!reduce.matches)await new Promise(resolve=>setTimeout(resolve,spec[3]));
   },
   failure(error){state('error','Try again');announce.textContent=error?.message||'Action failed.';},
   close(){
    if(closed)return;closed=true;trigger.disabled=orig.disabled;
    if(orig.label===null)trigger.removeAttribute('aria-label');else trigger.setAttribute('aria-label',orig.label);
    if(orig.busy===null)trigger.removeAttribute('aria-busy');else trigger.setAttribute('aria-busy',orig.busy);
    delete trigger.dataset.cornerMotionState;delete trigger.dataset.cornerMotionKind;
    if(visualTarget?.isConnected)delete visualTarget.dataset.cornerMotionObject;
    visual.remove();
    while(original.firstChild)trigger.insertBefore(original.firstChild,original);
    original.remove();announce.remove();
   }
  };
 }
 async function run({trigger,action,execute,confirm,onSuccess,onFailure,targetId,signal,visualTarget,successLabel}={}){
  if(!trigger?.isConnected||typeof execute!=='function')throw Error('Action unavailable.');
  if(active.has(trigger))return active.get(trigger);
  const key=targetId?action+':'+targetId:null;
  if(key&&targets.has(key))return targets.get(key);
  const task=(async()=>{
   let motion=null,aborted=false;
   const onAbort=()=>{aborted=true;motion?.close()};
   signal?.addEventListener('abort',onAbort,{once:true});
   try{
    if(signal?.aborted)throw Error('Operation cancelled.');
    motion=mount(trigger,action,visualTarget);
    const result=await execute({progress:message=>motion.progress(message),signal});
    if(confirm&&confirm(result)!==true)throw Error('Server confirmation was not received.');
    if(!aborted&&trigger.isConnected){
      // The operation has already committed. A failed follow-up refresh must
      // never turn a successful API write into a false failure/retry invitation.
      await motion.success(successLabel);
      if(onSuccess&&trigger.isConnected&&!aborted){
        try{await onSuccess(result)}
        catch(refreshError){
          console.warn('Corner action saved, but presentation refresh failed:',refreshError);
          return {ok:true,result,refreshError};
        }
      }
    }
    return {ok:true,result,stale:aborted};
   }catch(error){
    if(!aborted){
      motion?.failure(error);
      try{onFailure?.(error)}catch{/* Never change the real operation outcome from a toast/feedback error. */}
      // Keep retry/error visible long enough to read; no success is manufactured.
      if(!reduce.matches&&motion&&trigger.isConnected)
        await new Promise(resolve=>setTimeout(resolve,420));
    }
    return {ok:false,error,stale:aborted};
   }finally{
    signal?.removeEventListener('abort',onAbort);
    motion?.close();
   }
  })();
  active.set(trigger,task);if(key)targets.set(key,task);
  try{return await task}
  finally{if(active.get(trigger)===task)active.delete(trigger);if(key&&targets.get(key)===task)targets.delete(key)}
 }
 window.CornerActionMotion=Object.freeze({run});
})();
