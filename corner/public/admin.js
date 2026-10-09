(() => {
  'use strict';
  const initial=window.__CORNER__||{},root=document.querySelector('#admin-view');
  const $=(s,el=document)=>el.querySelector(s),$$=(s,el=document)=>[...el.querySelectorAll(s)];
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const variantTypes=['wish','announcement','tech_note','journal','build','moment'];
  const typeNames={wish:'Wish',announcement:'Announcement',tech_note:'Tech Note',journal:'Journal',build:'Build Log',moment:'Moment'};
  const states=['all','draft','scheduled','published','archived'];
  const active={view:'overview',filter:'all',post:null,saveTimer:null,previewDevice:'laptop',dirty:false};
  const toastStack=$('#toast-stack');
  function toast(message,variant='info'){
    if(!toastStack)return;const el=document.createElement('div');el.className='toast '+variant;
    const text=document.createElement('span');text.textContent=message;
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Dismiss notification');close.onclick=()=>el.remove();el.append(text,close);toastStack.append(el);setTimeout(()=>el.remove(),4700);
  }
  async function api(path,method='GET',payload){
    const options={method,credentials:'same-origin',cache:'no-store',headers:{}};
    if(payload!==undefined){options.headers['content-type']='application/json';options.body=JSON.stringify(payload)}
    const response=await fetch(path,options);const parsed=await response.json().catch(()=>({}));
    if(!response.ok||parsed.error){const err=new Error(parsed.error?.message||'Could not complete that action');err.status=response.status;err.code=parsed.error?.code;throw err}return parsed.data;
  }
  const tag=(state)=>`<span class="admin-tag ${esc(state)}">${esc(state)}</span>`;
  const readable=(value)=>value?new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—';
  function empty(title,sub='Nothing needs attention right now.') {return `<div class="admin-empty"><span>✳</span><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>`}
  function showView(view){clearTimeout(active.saveTimer);active.view=view;active.post=null;
    const labels={overview:'Overview',posts:'Posts',media:'Media',comments:'Comments',guestbook:'Guestbook',analytics:'Analytics',settings:'Settings'};
    active.view=view;$('#admin-heading').innerHTML=(labels[view]||'Overview')+'<span>.</span>';
    $$('[data-admin-view]').forEach(button=>button.classList.toggle('is-active',button.dataset.adminView===view));
    root.innerHTML='<div class="admin-loading">Updating workspace…</div>';
    ({overview,posts,media,comments,guestbook,analytics,settings}[view]||overview)().catch(err=>{root.innerHTML=empty('Could not load this section',err.message);toast(err.message,'error')});
  }
  async function overview(){const summary=await api('/corner/api/admin/overview');
    root.innerHTML=`<section class="admin-grid">${[
      ['Drafts',summary.drafts||0],['Scheduled',summary.scheduled||0],['Published',summary.published||0],['Review comments',summary.pendingComments||0],
    ].map(([label,n])=>`<div class="admin-kpi"><p>${label}</p><strong>${Number(n)}</strong></div>`).join('')}</section>
    <section class="admin-section"><header><h2>Keep the corner moving.</h2><button class="admin-primary" id="create-from-overview">+ Create a post</button></header><div class="admin-two-col"><div class="admin-surface"><p class="eyebrow">COMING UP</p><h3>${summary.upcoming?esc(summary.upcoming.title):'No scheduled wishes yet.'}</h3><p>${summary.upcoming?readable(summary.upcoming.scheduled_at):'Schedule something worth celebrating.'}</p><button class="admin-secondary" id="see-schedules">View posts ↗</button></div><div class="admin-surface"><p class="eyebrow">RIGHT NOW</p><h3>${esc(summary.live?.label||'No live status set')}</h3><p>${esc(summary.live?.detail||'Share a small note about what you are up to.')}</p><button class="admin-secondary" id="edit-now">Update status ↗</button></div></div></section>
    <section class="admin-section"><header><h2>At a glance.</h2></header><div class="admin-surface"><p>${Number(summary.page_view||0)} page views · ${Number(summary.post_open||0)} story opens · ${Number(summary.share||0)} shares in the last 7 days.</p></div></section>`;
    $('#create-from-overview').onclick=()=>editor();$('#see-schedules').onclick=()=>{active.filter='scheduled';showView('posts')};$('#edit-now').onclick=statusEditor;
  }
  async function posts(){const list=await api('/corner/api/admin/posts?state='+encodeURIComponent(active.filter));
    root.innerHTML=`<section class="admin-table-head"><h2>All your notes.</h2><button id="new-post" class="admin-primary">+ New post</button></section><div class="admin-filter">${states.map(s=>`<button data-filter="${s}" class="${active.filter===s?'is-active':''}">${s[0].toUpperCase()+s.slice(1)}</button>`).join('')}</div>${list.length?`<div class="admin-table-scroller"><table class="admin-table"><thead><tr><th>POST</th><th>TYPE</th><th>STATUS</th><th>UPDATED</th><th>ACTIONS</th></tr></thead><tbody>${list.map(p=>`<tr><td><strong>${esc(p.title)}</strong><small>${esc(p.slug)}</small></td><td>${esc(typeNames[p.type])}</td><td>${tag(p.state)}</td><td>${readable(p.updated_at)}</td><td><button data-edit="${p.id}" type="button">Edit ↗</button></td></tr>`).join('')}</tbody></table></div>`:empty('Nothing here yet.','Create the first post or change the filter.')}`;
    $('#new-post').onclick=()=>editor();$$('[data-filter]').forEach(b=>b.onclick=()=>{active.filter=b.dataset.filter;posts()});$$('[data-edit]').forEach(b=>b.onclick=()=>editor(b.dataset.edit));
  }
  function postFields(p={}){return `<div class="editor-topline"><p>${p.id?'Editing '+esc(p.slug):'NEW STORY'} ${p.state?tag(p.state):tag('draft')}</p><span class="admin-hint" id="save-indicator">${p.id?'All edits saved':'Ready to write'}</span></div>
    <div class="editor-inline"><label>Type<select name="type">${variantTypes.map(t=>`<option value="${t}" ${p.type===t?'selected':''}>${typeNames[t]}</option>`).join('')}</select></label><label>Symbol / emoji<input name="emoji" maxlength="8" placeholder="✳" value="${esc(p.emoji||'')}"></label></div>
    <label>Title<input name="title" maxlength="150" required placeholder="A small idea worth keeping." value="${esc(p.title||'')}"></label>
    <label>Short preview<input name="excerpt" maxlength="380" placeholder="One line to draw someone in." value="${esc(p.excerpt||'')}"></label>
    <label>Full story<textarea name="body" minlength="2" maxlength="25000" rows="9" placeholder="Tell the story here, in your own words…">${esc(p.body||'')}</textarea></label>
    <label>Tags <input name="tags" maxlength="200" placeholder="Builds, ideas, things worth sharing" value="${esc((p.tags||[]).join(', '))}"></label>
    <div class="editor-checks"><label><input type="checkbox" name="featured" ${p.featured?'checked':''}> Feature</label><label><input type="checkbox" name="pinned" ${p.pinned?'checked':''}> Pin</label><label><input type="checkbox" name="milestone" ${p.milestone?'checked':''}> Milestone</label><label><input type="checkbox" name="allowComments" ${p.allow_comments?'checked':''}> Comments</label><label><input type="checkbox" name="allowReactions" ${p.allow_reactions!==false&&p.allow_reactions!==0?'checked':''}> Reactions</label><label><input type="checkbox" name="upcomingPublic" ${p.upcoming_public?'checked':''}> Public Coming Up teaser</label></div>
    <div class="editor-actions"><button type="button" class="secondary" id="save-post">Save changes</button><button type="button" id="publish-post">Publish</button><button type="button" class="secondary" id="schedule-post">Schedule</button>${p.state==='published'?'<button type="button" class="warn" id="archive-post">Archive</button>':''}${p.state==='archived'?'<button type="button" id="restore-post">Restore</button>':''}</div>`}
  function formValues(form){return {type:form.elements.type.value,title:form.elements.title.value,emoji:form.elements.emoji.value,excerpt:form.elements.excerpt.value,body:form.elements.body.value,tags:form.elements.tags.value,featured:form.elements.featured.checked,pinned:form.elements.pinned.checked,milestone:form.elements.milestone.checked,allowComments:form.elements.allowComments.checked,allowReactions:form.elements.allowReactions.checked,upcomingPublic:form.elements.upcomingPublic.checked};}
  function updatePreview(form){let p=formValues(form);let card=$('.preview-card');if(!card)return;card.className='preview-card story story-'+p.type;card.dataset.device=active.previewDevice;
    $('.preview-category',card).textContent=typeNames[p.type].toUpperCase();$('.preview-title',card).textContent=p.title||'Your next story.';$('.preview-excerpt',card).textContent=p.excerpt||'Just enough to invite someone in.';
    $('.preview-status',card).textContent=p.featured?'FEATURED':p.pinned?'PINNED':'PREVIEW';
  }
  function previewHtml(){return `<div class="preview-panel"><div class="admin-surface"><p class="eyebrow">THE READER’S VIEW</p><h3>One story. Four screens.</h3><div class="preview-devices">${['mobile','tablet','laptop','desktop'].map(d=>`<button data-device="${d}" class="${active.previewDevice===d?'is-active':''}">${d[0].toUpperCase()+d.slice(1)}</button>`).join('')}</div><div class="preview-stage"><article class="preview-card story story-tech_note" data-device="${active.previewDevice}"><div class="story-top"><span class="meta category preview-category">TECH NOTE</span><span class="status-tag preview-status">PREVIEW</span></div><div class="story-copy"><p class="story-count">JUST NOW</p><h3 class="preview-title">Your next story.</h3><p class="preview-excerpt">Just enough to invite someone in.</p><div class="story-bottom"><span class="read-meta">READ UPDATE</span><span class="read-link">Read ↗</span></div></div></article></div><p class="admin-hint">Device preview uses the public story CSS. Published cards adapt naturally in the actual feed.</p></div></div>`}
  async function editor(id=null){clearTimeout(active.saveTimer);active.post=null;let p=id? (await api('/corner/api/admin/posts/'+encodeURIComponent(id))).post : {state:'draft',type:'tech_note',allow_reactions:true,allow_comments:false,tags:[]};active.post=p;
    root.innerHTML=`<section class="admin-table-head"><h2>${id?'Edit this story':'A new story.'}</h2><button id="back-posts" class="admin-secondary">← All posts</button></section><div class="admin-two-col"><form class="editor admin-surface" id="post-editor">${postFields(p)}</form>${previewHtml()}</div><div class="admin-section" id="schedule-panel" hidden></div><div class="admin-section" id="editor-media"></div>`;
    const form=$('#post-editor');
    updatePreview(form);form.addEventListener('input',()=>{active.dirty=true;$('#save-indicator').textContent='Unsaved edits';updatePreview(form);if(p.id&&p.state==='draft'){clearTimeout(active.saveTimer);active.saveTimer=setTimeout(()=>save(true),1250)}});
    $$('[data-device]').forEach(b=>b.onclick=()=>{active.previewDevice=b.dataset.device;$$('[data-device]').forEach(x=>x.classList.toggle('is-active',x.dataset.device===active.previewDevice));updatePreview(form)});
    async function save(quiet=false){if(!form.elements.title.value.trim()){if(!quiet)toast('Add a title first.','error');return null}clearTimeout(active.saveTimer);$('#save-indicator').textContent='Saving…';try{let value=formValues(form);if(p.id){p=await api('/corner/api/admin/posts/'+p.id,'PATCH',{...value,version:p.version});}else{p=await api('/corner/api/admin/posts','POST',value);active.post=p;}$('#save-indicator').textContent='Saved · v'+p.version;active.dirty=false;if(!quiet)toast('Draft saved.','success');return p;}catch(err){$('#save-indicator').textContent=err.status===409?'Edit conflict — reload':'Could not save';if(!quiet)toast(err.message,'error');return null}}
    $('#save-post').onclick=()=>save();$('#publish-post').onclick=async()=>{let saved=await save(true);if(!saved)return;try{p=await api('/corner/api/admin/posts/'+p.id+'/publish','POST');toast('Published. Your story is live.','success');editor(p.id)}catch(err){toast(err.message,'error')}};
    $('#schedule-post').onclick=()=>{const panel=$('#schedule-panel');panel.hidden=false;panel.innerHTML=`<form id="schedule-form" class="admin-surface admin-form"><p class="eyebrow">SET A MOMENT</p><h2>Publish at the right time.</h2><div class="editor-inline"><label>Date and time<input type="datetime-local" name="localTime" required></label><label>Timezone<input name="timezone" required value="${esc(p.timezone||'Asia/Kolkata')}"></label></div><label>Recurrence<select name="recurrence"><option value="none">One time</option><option value="yearly">Every year (wishes)</option></select></label><label>End recurrence after year (optional)<input type="number" name="recurrenceEndYear" min="2026" max="2200" placeholder="Leave blank for every year"></label><div class="editor-inline"><label>Feature starts (optional)<input type="datetime-local" name="featureStartLocal"></label><label>Feature ends (optional)<input type="datetime-local" name="featureEndLocal"></label></div><div class="editor-inline"><label>Pin starts (optional)<input type="datetime-local" name="pinStartLocal"></label><label>Pin ends (optional)<input type="datetime-local" name="pinEndLocal"></label></div><p class="admin-hint">The server handles scheduling and yearly wishes even when your browser is closed.</p><button type="submit">Confirm schedule →</button></form>`;
      $('#schedule-form').onsubmit=async event=>{event.preventDefault();let saved=await save(true);if(!saved)return;let ff=event.currentTarget;try{p=await api('/corner/api/admin/posts/'+p.id+'/schedule','POST',{localTime:ff.elements.localTime.value,timezone:ff.elements.timezone.value,recurrence:ff.elements.recurrence.value,recurrenceEndYear:ff.elements.recurrenceEndYear.value,featureStartLocal:ff.elements.featureStartLocal.value,featureEndLocal:ff.elements.featureEndLocal.value,pinStartLocal:ff.elements.pinStartLocal.value,pinEndLocal:ff.elements.pinEndLocal.value});toast('Scheduled successfully.','success');editor(p.id)}catch(err){toast(err.message,'error')}};
      panel.scrollIntoView({behavior:'smooth',block:'nearest'});
    };
    $('#archive-post')?.addEventListener('click',async()=>{if(!confirm('Archive this story? It will no longer be public.'))return;try{await api('/corner/api/admin/posts/'+p.id+'/archive','POST');toast('Post archived.','success');showView('posts')}catch(err){toast(err.message,'error')}});
    $('#restore-post')?.addEventListener('click',async()=>{try{await api('/corner/api/admin/posts/'+p.id+'/restore','POST');toast('Post restored.','success');editor(p.id)}catch(err){toast(err.message,'error')}});
    $('#back-posts').onclick=()=>{if(active.dirty&&!confirm('Leave with unsaved edits?'))return;showView('posts')};
    if(p.id)mediaForPost(p.id).catch(err=>toast(err.message,'error'));
    form.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save(true)}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='p'){event.preventDefault();$('.preview-stage')?.scrollIntoView({behavior:'smooth',block:'nearest'})}});
  }
  async function mediaForPost(id){const section=$('#editor-media');if(!section)return;let m=await api('/corner/api/admin/posts/'+id);section.innerHTML=`<div class="admin-surface"><h3>Media for this story</h3>${m.media.length?`<div class="media-gallery">${m.media.map(x=>mediaCard(x)).join('')}</div>`:'<p>No media attached yet.</p>'}<form id="editor-upload" class="upload-field"><label>Add image or video<input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" required></label><label>Alt text<input name="alt" placeholder="Describe meaningful visual details"></label><button type="submit" class="admin-secondary">Attach media ↑</button></form></div>`;$$('[data-media-edit]',section).forEach(button=>button.onclick=()=>mediaEdit(button.dataset.mediaEdit,m.media,id));$('#editor-upload').onsubmit=async e=>{e.preventDefault();const file=e.target.elements.file.files[0],alt=e.target.elements.alt.value;try{await upload(file,id,alt);toast('Media attached.','success');mediaForPost(id)}catch(err){toast(err.message,'error')}};}
  function mediaCard(x){const src='/corner/media/'+encodeURIComponent(x.storage_key);return `<div class="media-thumb">${x.mime_type.startsWith('image/')?`<img src="${src}" alt="${esc(x.alt_text||'Image')}">`:`<video src="${src}" controls preload="none"></video>`}<small>${esc(x.mime_type)}</small><small>${Math.round(x.size_bytes/1024)} KB</small><button type="button" data-media-edit="${x.id}">Edit ↗</button></div>`}
  async function upload(file,postId,alt){if(!file)throw Error('Choose a file');if(file.size>25*1024*1024)throw Error('File is too large');let url='/corner/api/admin/media/upload?postId='+encodeURIComponent(postId||'')+'&alt='+encodeURIComponent(alt||'');let response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'content-type':file.type},body:file});let result=await response.json();if(!response.ok)throw Error(result.error?.message||'Upload failed');return result.data;}
  async function media(){const list=await api('/corner/api/admin/media');root.innerHTML=`<section class="admin-section"><header><h2>Your media library.</h2></header><div class="admin-surface"><p>Images and video stay tied to individual posts. Upload from a post editor to attach files safely.</p>${list.length?`<div class="media-gallery">${list.map(mediaCard).join('')}</div>`:empty('No media here yet.','Add an image to a post to begin.')}</div></section>`;$$('[data-media-edit]').forEach(b=>b.onclick=()=>mediaEdit(b.dataset.mediaEdit,list));}
  function mediaEdit(id,list,returnPostId=null){let x=list.find(m=>m.id===id);if(!x)return;root.innerHTML=`<section class="admin-section"><header><h2>Media details.</h2><button class="admin-secondary" id="back-media">← Library</button></header><form class="admin-surface admin-form" id="media-editor"><label>Alt text<textarea name="alt" maxlength="240">${esc(x.alt_text||'')}</textarea></label><label>Caption<input name="caption" maxlength="300" value="${esc(x.caption||'')}"></label><div class="editor-inline"><label>Focus X (0–1)<input type="number" step=".05" min="0" max="1" name="focalX" value="${x.focal_x}"></label><label>Focus Y (0–1)<input type="number" step=".05" min="0" max="1" name="focalY" value="${x.focal_y}"></label></div><button type="submit">Save media details</button></form></section>`;
    $('#back-media').onclick=()=>returnPostId?editor(returnPostId):media();$('#media-editor').onsubmit=async e=>{e.preventDefault();let f=e.currentTarget;try{await api('/corner/api/admin/media/'+id,'PATCH',{altText:f.elements.alt.value,caption:f.elements.caption.value,focalX:f.elements.focalX.value,focalY:f.elements.focalY.value});toast('Media details saved.','success');returnPostId?editor(returnPostId):media()}catch(err){toast(err.message,'error')}};
  }
  async function comments(){const list=await api('/corner/api/admin/comments?state=pending');root.innerHTML=`<section class="admin-section"><header><h2>Comments awaiting review.</h2></header>${list.length?`<div class="admin-card-list">${list.map(c=>`<article class="admin-comment"><header><div><strong>${esc(c.author_name)}</strong> · <small>${esc(c.post_title)}</small></div><small>${readable(c.created_at)}</small></header><p>${esc(c.body)}</p><footer><button data-moderate="approve" data-comment="${c.id}">Approve ✓</button><button data-moderate="hide" data-comment="${c.id}">Hide</button><button data-moderate="delete" data-comment="${c.id}">Delete</button></footer></article>`).join('')}</div>`:empty('All caught up.','No comments need moderation.')}</section>`;
    $$('[data-moderate]').forEach(b=>b.onclick=async()=>{if(b.dataset.moderate==='delete'&&!confirm('Delete this comment?'))return;try{await api('/corner/api/admin/comments/'+b.dataset.comment+'/'+b.dataset.moderate,'POST');toast('Comment updated.','success');comments()}catch(err){toast(err.message,'error')}});
  }
  async function guestbook(){
    const response=await api('/corner/api/v1/admin/v3/guestbook');
    const entries=Array.isArray(response)?response:[];
    root.innerHTML='<section class="admin-section"><header><h2>Guestbook moderation.</h2></header>'+(
      entries.length?'<div class="admin-card-list">'+entries.map(n=>
        '<article class="admin-comment"><strong>'+esc(n.name)+'</strong><p>'+esc(n.message)+'</p><footer>'+
        ['approved','hidden','deleted'].map(state=>'<button type="button" data-guestbook-id="'+esc(n.id)+'" data-guestbook-state="'+state+'">'+(state==='approved'?'Approve':state==='hidden'?'Hide':'Delete')+'</button>').join('')+
        '</footer></article>').join('')+'</div>':empty('No guestbook notes waiting.'))+'</section>';
    $('[data-guestbook-id]').forEach(button=>button.addEventListener('click',async()=>{
      button.disabled=true;
      try{
        await api('/corner/api/v1/admin/v3/guestbook/'+encodeURIComponent(button.dataset.guestbookId),'PATCH',{state:button.dataset.guestbookState});
        toast('Guestbook note reviewed.','success');await guestbook();
      }catch(error){toast(error.message,'error');button.disabled=false;}
    }));
  }
  async function analytics(){let summary=await api('/corner/api/admin/analytics/summary');root.innerHTML=`<section class="admin-grid">${[['Views',summary.page_view||0],['Story opens',summary.post_open||0],['Shares',summary.share||0],['Published',summary.published||0]].map(([label,value])=>`<div class="admin-kpi"><p>${label}</p><strong>${Number(value)}</strong></div>`).join('')}</section><section class="admin-section"><div class="admin-surface"><h2>Lean by default.</h2><p>Counts from the past 7 days. No third-party analytics tracker and no public visitor leaderboard.</p>${summary.top?.length?`<p>Top stories: ${summary.top.map(x=>esc(x.post_id)+' ('+x.visits+')').join(' · ')}</p>`:''}</div></section>`}
  async function settings(){let s=await api('/corner/api/admin/settings');root.innerHTML=`<section class="admin-section"><header><h2>The essentials.</h2></header><form class="admin-form admin-surface" id="settings-editor"><label>Site title<input name="title" value="${esc(s.title)}"></label><label>Short descriptor<input name="descriptor" value="${esc(s.descriptor)}"></label><label>Site timezone<input name="timezone" value="${esc(s.timezone)}"></label><div class="editor-checks"><label><input type="checkbox" name="commentsDefault" ${s.commentsDefault?'checked':''}> Comments by default</label><label><input type="checkbox" name="reactionsDefault" ${s.reactionsDefault?'checked':''}> Reactions by default</label></div><button type="submit">Save settings</button></form></section><section class="admin-section"><header><h2>Site status.</h2></header><button class="admin-secondary" id="settings-status">Update current status ↗</button></section>`;
    if(initial.ownerRole==='owner'){const invite=document.createElement('a');invite.className='admin-secondary';invite.textContent='Invite a studio collaborator ↗';invite.href='/corner/admin/invite';invite.style.display='inline-flex';invite.style.marginTop='18px';root.append(invite)}$('#settings-status').onclick=statusEditor;$('#settings-editor').onsubmit=async e=>{e.preventDefault();let f=e.currentTarget;try{await api('/corner/api/admin/settings','PUT',{title:f.elements.title.value,descriptor:f.elements.descriptor.value,timezone:f.elements.timezone.value,commentsDefault:f.elements.commentsDefault.checked,reactionsDefault:f.elements.reactionsDefault.checked});toast('Settings saved.','success')}catch(err){toast(err.message,'error')}};
  }
  function statusEditor(){let s=initial.status||{};root.innerHTML=`<section class="admin-section"><header><h2>A short note for right now.</h2></header><form id="now-form" class="admin-form admin-surface"><div class="editor-inline"><label>Label<input name="label" maxlength="55" placeholder="Building something new" value="${esc(s.label||'')}"></label><label>Symbol<input name="icon" maxlength="8" placeholder="✳" value="${esc(s.icon||'✳')}"></label></div><label>Detail (optional)<textarea name="detail" maxlength="115" placeholder="One line, if needed.">${esc(s.detail||'')}</textarea></label><label><input type="checkbox" name="isActive" ${s.label?'checked':''}> Show this on the public site</label><button type="submit">Update right now ↗</button></form></section>`;
    $('#now-form').onsubmit=async e=>{e.preventDefault();let f=e.currentTarget;try{await api('/corner/api/admin/status','PUT',{label:f.elements.label.value,detail:f.elements.detail.value,icon:f.elements.icon.value,isActive:f.elements.isActive.checked});toast('Your status is live.','success');showView('overview')}catch(err){toast(err.message,'error')}};
  }
  const login=$('#admin-login');
  if(login){
    const mfaField=login.querySelector('.admin-mfa-field');
    if(mfaField)mfaField.hidden=true;
    login.onsubmit=async event=>{
      event.preventDefault();const btn=login.querySelector('button[type=submit]');
      btn.disabled=true;$('#login-message').textContent='Checking secure access…';
      try{
        const result=await api('/corner/api/v1/auth/admin/login','POST',{
          email:login.elements.email.value,password:login.elements.password.value,
          code:login.elements.code?.value||''
        });
        if(result.mfaSetupRequired){
          try{sessionStorage.setItem('corner-mfa-challenge',result.challenge)}catch{ /* storage or URL fragment may be unavailable; keep the form usable */ }
          location.assign('/corner/admin/mfa');return;
        }
        if(result.authenticated){location.reload();return}
        throw new Error('Secure sign-in is not complete.');
      }catch(err){
        if(err.code==='MFA_REQUIRED'){
          if(mfaField){mfaField.hidden=false;mfaField.querySelector('input')?.focus();}
          btn.textContent='Verify and open the Corner';
          $('#login-message').textContent='Enter the code from your authenticator app.';
          return;
        }
        $('#login-message').textContent=err.message;
      }finally{btn.disabled=false}
    };return;
  }
  if(!root)return;
  $$('[data-admin-view]').forEach(b=>b.onclick=()=>showView(b.dataset.adminView));
  $('#admin-logout')?.addEventListener('click',async()=>{try{await api('/corner/api/admin/logout','POST');location.reload()}catch(err){toast(err.message,'error')}});
  showView(initial.ownerRole==='moderator'?'comments':initial.ownerRole==='editor'?'posts':'overview');
})();
