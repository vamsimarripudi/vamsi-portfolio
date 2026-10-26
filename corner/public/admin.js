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
  function showView(view){window.CornerAnalysis?.unmount();clearTimeout(active.saveTimer);active.view=view;active.post=null;active.dirty=false;
    const labels={overview:'Overview',posts:'Posts',media:'Media',comments:'Comments',guestbook:'Guestbook',analytics:'Insights',settings:'Settings'};
    history.replaceState(null,'','#'+view);
    active.view=view;$('#admin-heading').innerHTML=(labels[view]||'Overview')+'<span>.</span>';
    $$('[data-admin-view]').forEach(button=>{const selected=button.dataset.adminView===view;button.classList.toggle('is-active',selected);if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')});
    root.innerHTML='<div class="admin-loading">Updating workspace…</div>';
    ({overview,posts,media,comments,guestbook,analytics,settings}[view]||overview)().then(()=>window.CornerMotion?.refresh()).catch(err=>{root.innerHTML=empty('Could not load this section',err.message);toast(err.message,'error')});
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
  function postFields(p={}){const lead=String(p.body||'').match(/^> ([^\n]{1,280})(?:\n\n|$)/);const main=lead?String(p.body).slice(lead[0].length):p.body||'';return `<div class="editor-topline"><p>${p.id?'Editing '+esc(p.slug):'NEW STORY'} ${p.state?tag(p.state):tag('draft')}</p><span class="admin-hint" id="save-indicator">${p.id?'All edits saved':'Ready to write'}</span></div>
    <div class="editor-inline"><label>Type<select name="type">${variantTypes.map(t=>`<option value="${t}" ${p.type===t?'selected':''}>${typeNames[t]}</option>`).join('')}</select></label><label>Symbol / emoji<input name="emoji" maxlength="8" placeholder="✳" value="${esc(p.emoji||'')}"></label></div>
    <label>Title<input name="title" maxlength="150" required placeholder="A small idea worth keeping." value="${esc(p.title||'')}"></label>
    <label>Short preview<input name="excerpt" maxlength="380" placeholder="One line to draw someone in." value="${esc(p.excerpt||'')}"></label>
    <label>Opening quote (optional)<textarea name="quote" rows="2" maxlength="280" placeholder="A sentence worth remembering.">${esc(lead?.[1]||'')}</textarea></label>
    <label>Full story<textarea name="body" minlength="2" maxlength="25000" rows="9" placeholder="Tell the story here, in your own words…">${esc(main)}</textarea></label>
    <label>Tags <input name="tags" maxlength="200" placeholder="Builds, ideas, things worth sharing" value="${esc((p.tags||[]).join(', '))}"></label>
    <div class="editor-checks"><label><input type="checkbox" name="featured" ${p.featured?'checked':''}> Feature</label><label><input type="checkbox" name="pinned" ${p.pinned?'checked':''}> Pin</label><label><input type="checkbox" name="milestone" ${p.milestone?'checked':''}> Milestone</label><label><input type="checkbox" name="allowComments" ${p.allow_comments?'checked':''}> Comments</label><label><input type="checkbox" name="allowReactions" ${p.allow_reactions!==false&&p.allow_reactions!==0?'checked':''}> Reactions</label><label><input type="checkbox" name="upcomingPublic" ${p.upcoming_public?'checked':''}> Public Coming Up teaser</label></div>
    <div class="editor-actions"><button type="button" class="secondary" id="save-post">Save changes</button><button type="button" id="publish-post">Publish</button><button type="button" class="secondary" id="schedule-post">Schedule</button>${p.state==='published'?'<button type="button" class="warn" id="archive-post">Archive</button>':''}${p.state==='archived'?'<button type="button" id="restore-post">Restore</button>':''}</div>`}
  function formValues(form){return {type:form.elements.type.value,title:form.elements.title.value,emoji:form.elements.emoji.value,excerpt:form.elements.excerpt.value,body:(form.elements.quote.value.trim()?'> '+form.elements.quote.value.trim()+'\n\n':'')+form.elements.body.value,tags:form.elements.tags.value,featured:form.elements.featured.checked,pinned:form.elements.pinned.checked,milestone:form.elements.milestone.checked,allowComments:form.elements.allowComments.checked,allowReactions:form.elements.allowReactions.checked,upcomingPublic:form.elements.upcomingPublic.checked};}
  function updatePreview(form){let p=formValues(form);let card=$('.preview-card');if(!card)return;card.className='preview-card story story-'+p.type;card.dataset.device=active.previewDevice;
    $('.preview-category',card).textContent=typeNames[p.type].toUpperCase();$('.preview-title',card).textContent=p.title||'Your next story.';$('.preview-excerpt',card).textContent=p.excerpt||'Just enough to invite someone in.';
    const quote=$('.preview-story-quote',card);if(quote){quote.textContent=form.elements.quote.value.trim();quote.hidden=!quote.textContent}
    $('.preview-story-body',card).textContent=form.elements.body.value||'';$('.preview-symbol',card).textContent=p.emoji||'✳';
    $('.preview-status',card).textContent=p.featured?'FEATURED':p.pinned?'PINNED':'PREVIEW';
  }
  function previewHtml(){return `<div class="preview-panel"><div class="admin-surface"><p class="eyebrow">PRIVATE PREVIEW</p><h3>Live preview</h3><div class="preview-devices">${['mobile','tablet','laptop','desktop'].map(d=>`<button data-device="${d}" class="${active.previewDevice===d?'is-active':''}">${d[0].toUpperCase()+d.slice(1)}</button>`).join('')}</div><div class="preview-stage"><article class="preview-card story story-tech_note" data-device="${active.previewDevice}"><div class="story-top"><span class="meta category preview-category">TECH NOTE</span><span class="status-tag preview-status">PREVIEW</span></div><div class="preview-media" data-editor-photo-preview hidden></div><div class="story-copy"><span class="preview-symbol" aria-hidden="true">✳</span><h3 class="preview-title">Your next story.</h3><p class="preview-excerpt">Just enough to invite someone in.</p><blockquote class="preview-story-quote" hidden></blockquote><div class="preview-story-body"></div><div class="story-bottom"><span class="read-meta">READ UPDATE</span><span class="read-link">Read ↗</span></div></div></article></div><p class="admin-hint">Device preview uses the public story CSS. Published cards adapt naturally in the actual feed.</p></div></div>`}
  async function editor(id=null){clearTimeout(active.saveTimer);active.post=null;let p=id? (await api('/corner/api/admin/posts/'+encodeURIComponent(id))).post : {state:'draft',type:'tech_note',allow_reactions:true,allow_comments:false,tags:[]};active.post=p;
    root.innerHTML=`<section class="admin-table-head"><h2>${id?'Edit this story':'A new story.'}</h2><button id="back-posts" class="admin-secondary">← All posts</button></section><div class="admin-two-col"><form class="editor admin-surface" id="post-editor">${postFields(p)}</form>${previewHtml()}</div><dialog id="schedule-panel" class="corner-schedule-modal" aria-labelledby="corner-schedule-title"></dialog><div class="admin-section" id="editor-media"></div>`;
    const form=$('#post-editor');
    updatePreview(form);form.addEventListener('change',()=>updatePreview(form));form.addEventListener('input',()=>{active.dirty=true;$('#save-indicator').textContent='Unsaved edits';updatePreview(form);if(p.id&&p.state==='draft'){clearTimeout(active.saveTimer);active.saveTimer=setTimeout(()=>save(true),1250)}});
    $$('button[data-device]').forEach(b=>b.onclick=()=>{active.previewDevice=b.dataset.device;$$('button[data-device]').forEach(x=>x.classList.toggle('is-active',x.dataset.device===active.previewDevice));updatePreview(form)});
    async function save(quiet=false){if(!form.elements.title.value.trim()){if(!quiet)toast('Add a title first.','error');return null}clearTimeout(active.saveTimer);$('#save-indicator').textContent='Saving…';try{let value=formValues(form);if(p.id){p=await api('/corner/api/admin/posts/'+p.id,'PATCH',{...value,version:p.version});}else{p=await api('/corner/api/admin/posts','POST',value);active.post=p;}$('#save-indicator').textContent='Saved · v'+p.version;active.dirty=false;if(!quiet)toast('Draft saved.','success');return p;}catch(err){$('#save-indicator').textContent=err.status===409?'Edit conflict — reload':'Could not save';if(!quiet)toast(err.message,'error');return null}}
    $('#save-post').onclick=()=>save();$('#publish-post').onclick=async()=>{let saved=await save(true);if(!saved)return;try{p=await api('/corner/api/admin/posts/'+p.id+'/publish','POST');toast('Published. Your story is live.','success');editor(p.id)}catch(err){toast(err.message,'error')}};
    $('#schedule-post').onclick=()=>{
      const panel=$('#schedule-panel');
      if(!panel)return;
      const repeat=p.type==='wish'
        ?'<label class="corner-schedule-repeat">Repeat<select name="recurrence"><option value="none">Only this time</option><option value="yearly">Every year</option></select></label>'
        :'<input type="hidden" name="recurrence" value="none">';
      const tz=esc(p.timezone||'Asia/Kolkata');
      panel.innerHTML='<div class="corner-schedule-inner"><header><div><p class="eyebrow">ONE SIMPLE STEP</p><h2 id="corner-schedule-title">Schedule publication</h2><p>Choose the date and time. We handle the rest.</p></div><button type="button" data-schedule-cancel aria-label="Close scheduling dialog">×</button></header>'+
        '<form id="schedule-form" class="corner-schedule-form"><label>Publish on<input type="datetime-local" name="localTime" step="60" required></label>'+
        '<p class="corner-schedule-timezone">Time zone: '+tz+'</p><input name="timezone" type="hidden" value="'+tz+'">'+repeat+
        '<details><summary>Advanced timing (optional)</summary><div class="corner-schedule-advanced">'+
        '<label>Stop annual repeats after year<input type="number" name="recurrenceEndYear" min="2026" max="2200" placeholder="Keep repeating"></label>'+
        '<label>Feature from<input type="datetime-local" name="featureStartLocal"></label>'+
        '<label>Feature until<input type="datetime-local" name="featureEndLocal"></label>'+
        '<label>Pin from<input type="datetime-local" name="pinStartLocal"></label>'+
        '<label>Pin until<input type="datetime-local" name="pinEndLocal"></label></div></details>'+
        '<p class="corner-schedule-message" role="status" aria-live="polite"></p>'+
        '<div class="corner-schedule-actions"><button type="button" class="corner-schedule-secondary" data-schedule-cancel>Cancel</button><button type="submit">Confirm schedule ↗</button></div></form></div>';
      panel.querySelectorAll('[data-schedule-cancel]').forEach(button=>button.addEventListener('click',()=>panel.close()));
      panel.querySelector('#schedule-form').onsubmit=async event=>{
        event.preventDefault();
        const formSchedule=event.currentTarget,button=formSchedule.querySelector('[type=submit]');
        const feedback=formSchedule.querySelector('[role=status]');
        button.disabled=true;feedback.textContent='Saving the schedule…';
        try{
          const saved=await save(true);if(!saved)throw Error('Save your story and add a title before scheduling.');
          p=await api('/corner/api/admin/posts/'+saved.id+'/schedule','POST',{
            localTime:formSchedule.elements.localTime.value,
            timezone:formSchedule.elements.timezone.value,
            recurrence:formSchedule.elements.recurrence.value,
            recurrenceEndYear:formSchedule.elements.recurrenceEndYear.value,
            featureStartLocal:formSchedule.elements.featureStartLocal.value,
            featureEndLocal:formSchedule.elements.featureEndLocal.value,
            pinStartLocal:formSchedule.elements.pinStartLocal.value,
            pinEndLocal:formSchedule.elements.pinEndLocal.value
          });
          panel.close();toast('Scheduled successfully.','success');editor(p.id);
        }catch(error){feedback.textContent=error.message||'Scheduling failed. Please try again.';button.disabled=false;}
      };
      panel.showModal();
      panel.querySelector('[name=localTime]').focus();
    };
    $('#archive-post')?.addEventListener('click',async()=>{if(!confirm('Archive this story? It will no longer be public.'))return;try{await api('/corner/api/admin/posts/'+p.id+'/archive','POST');toast('Post archived.','success');showView('posts')}catch(err){toast(err.message,'error')}});
    $('#restore-post')?.addEventListener('click',async()=>{try{await api('/corner/api/admin/posts/'+p.id+'/restore','POST');toast('Post restored.','success');editor(p.id)}catch(err){toast(err.message,'error')}});
    $('#back-posts').onclick=()=>{if(active.dirty&&!confirm('Leave with unsaved edits?'))return;showView('posts')};
    window.CornerMotion?.refresh();
    mediaForPost(p.id||null,()=>save(true)).catch(err=>toast(err.message,'error'));
    form.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save(true)}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='p'){event.preventDefault();$('.preview-stage')?.scrollIntoView({behavior:'smooth',block:'nearest'})}});
  }
  const uploadLimit=8;
  const supportedMedia=new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']);
  function showEditorCover(items){
    const host=$('[data-editor-photo-preview]');
    if(!host)return;
    const cover=items.find(item=>item.mime_type?.startsWith('image/'));
    host.replaceChildren();
    host.hidden=!cover;
    if(!cover)return;
    const image=document.createElement('img');
    image.src='/corner/media/'+encodeURIComponent(cover.storage_key);
    image.alt=cover.alt_text||'Story cover photograph';
    image.loading='lazy';
    host.append(image);
  }
  async function mediaForPost(postId,ensureDraft){
    const section=$('#editor-media');
    if(!section)return;
    const result=postId?await api('/corner/api/admin/posts/'+encodeURIComponent(postId)):null;
    const attachments=result?.media||[];
    showEditorCover(attachments);
    section.innerHTML='<section class="admin-surface post-media-editor" aria-labelledby="media-editor-title">'+
      '<div class="post-media-head"><div><p class="eyebrow">STORY PHOTOGRAPHS</p><h3 id="media-editor-title">Images & captions</h3></div>'+
      '<small>'+attachments.length+' attached</small></div>'+
      (attachments.length?'<div class="media-gallery">'+attachments.map(x=>mediaCard(x,true)).join('')+'</div>':
       '<p class="admin-hint">Add photographs to give this story a visual chapter. Only published posts show media to visitors.</p>')+
      '<form id="editor-upload" class="upload-field" aria-label="Upload photographs or a video">'+
      '<label>Select up to '+uploadLimit+' files per batch<input type="file" name="files" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" required></label>'+
      '<div class="upload-preview-list" data-upload-previews aria-live="polite"></div>'+
      '<p class="admin-hint">Add a description for each image and an optional caption. Draft photos stay private. JPG, PNG, WebP or GIF up to 8 MB; MP4/WebM up to 25 MB.</p>'+
      '<p data-upload-status role="status" aria-live="polite"></p>'+
      '<button type="submit" class="admin-secondary" disabled>Attach selected media ↑</button>'+
      '</form></section>';
    $$('[data-media-edit]',section).forEach(button=>{
      button.onclick=()=>mediaEdit(button.dataset.mediaEdit,attachments,postId);
    });
    $$('[data-media-quick-edit]',section).forEach(form=>{
      form.onsubmit=async event=>{
        event.preventDefault();
        const button=form.querySelector('button[type=submit]');
        button.disabled=true;
        try{
          const id=form.dataset.mediaQuickEdit;
          const altText=form.elements.alt.value.trim();
          const caption=form.elements.caption.value.trim();
          const original=attachments.find(item=>item.id===id);
          if(original?.mime_type.startsWith('image/')&&!altText)throw Error('Add an image description.');
          await api('/corner/api/admin/media/'+encodeURIComponent(id),'PATCH',{altText,caption});
          toast('Caption and description saved.','success');
          await mediaForPost(postId,ensureDraft);
        }catch(error){toast(error.message,'error');button.disabled=false}
      };
    });
    const form=$('#editor-upload',section);
    const fileInput=form.elements.files;
    const previewList=$('[data-upload-previews]',form);
    const status=$('[data-upload-status]',form);
    const submit=form.querySelector('button[type=submit]');
    let pending=[];
    const cleanup=()=>{for(const entry of pending)if(entry.url)URL.revokeObjectURL(entry.url)};
    const previewEntry=entry=>{
      const wrapper=document.createElement('div');
      wrapper.className='upload-preview-card';
      const figure=document.createElement('figure');
      const picture=entry.file.type.startsWith('image/')?document.createElement('img'):document.createElement('video');
      entry.url=URL.createObjectURL(entry.file);
      picture.src=entry.url;
      if(picture.tagName==='IMG')picture.alt='Local upload preview: '+entry.file.name;
      else{picture.controls=true;picture.playsInline=true;picture.preload='metadata'}
      figure.append(picture);
      const filename=document.createElement('small');
      filename.textContent=entry.file.name;
      figure.append(filename);
      const fields=document.createElement('div');
      const altLabel=document.createElement('label');
      altLabel.textContent='Image description';
      entry.alt=document.createElement('input');
      entry.alt.name='alt';entry.alt.maxLength=240;
      entry.alt.placeholder='Describe what appears in the photograph';
      entry.alt.required=entry.file.type.startsWith('image/');
      if(!entry.alt.required){altLabel.textContent='Video description (optional)'}
      altLabel.append(entry.alt);
      const captionLabel=document.createElement('label');
      captionLabel.textContent='Caption';
      entry.caption=document.createElement('input');
      entry.caption.name='caption';entry.caption.maxLength=300;
      entry.caption.placeholder='A moment worth remembering…';
      captionLabel.append(entry.caption);
      fields.append(altLabel,captionLabel);
      if(entry.file.type==='image/jpeg'||entry.file.type==='image/png'||entry.file.type==='image/webp'){
        const crop=document.createElement('button');crop.type='button';crop.dataset.cropUpload='';crop.className='corner-crop-trigger';crop.textContent='Crop / reframe ↗';
        crop.onclick=async()=>{
          if(!window.CornerImageCrop)return;
          crop.disabled=true;
          try{
            const adjusted=await window.CornerImageCrop.open(entry.file);
            if(adjusted){
              if(entry.url)URL.revokeObjectURL(entry.url);
              entry.file=adjusted;entry.url=URL.createObjectURL(adjusted);picture.src=entry.url;
              filename.textContent=adjusted.name;
              status.textContent='Crop applied. Add the image description, then attach.';
            }
          }catch(error){status.textContent=error.message||'Could not crop this image.'}
          finally{crop.disabled=false}
        };
        fields.append(crop);
      }
      wrapper.append(figure,fields);
      previewList.append(wrapper);
    };
    fileInput.onchange=()=>{
      cleanup();pending=[];
      previewList.replaceChildren();
      const files=[...fileInput.files];
      if(files.length>uploadLimit){status.textContent='Choose no more than '+uploadLimit+' files at once.';submit.disabled=true;return}
      if(files.some(file=>!supportedMedia.has(file.type))){status.textContent='Unsupported file type. Use a JPG, PNG, WebP, GIF, MP4 or WebM.';submit.disabled=true;return}
      status.textContent=files.length?files.length+' selected. Enter descriptions, then attach them to your story.':'';
      for(const file of files){
        const entry={file,done:false,url:null,alt:null,caption:null};
        pending.push(entry);previewEntry(entry);
      }
      submit.disabled=!pending.length;
      submit.textContent=pending.length===1?'Attach media ↑':'Attach '+pending.length+' files ↑';
      if(files.length===1&&previewList.querySelector('[data-crop-upload]'))requestAnimationFrame(()=>previewList.querySelector('[data-crop-upload]')?.click());
    };
    form.onsubmit=async event=>{
      event.preventDefault();
      if(!pending.length)return;
      submit.disabled=true;
      let sent=0;
      try{
        for(const entry of pending.filter(item=>!item.done)){
          const isImage=entry.file.type.startsWith('image/');
          const alt=entry.alt.value.trim(),caption=entry.caption.value.trim();
          if(!supportedMedia.has(entry.file.type))throw Error('Unsupported file type: '+entry.file.name);
          if(!entry.file.size||entry.file.size>(isImage?8:25)*1024*1024)throw Error('File is too large: '+entry.file.name);
          if(isImage&&!alt)throw Error('Add an image description for: '+entry.file.name);
          if(alt.length>240||caption.length>300)throw Error('Description or caption is too long.');
        }
        if(!postId){
          const saved=await ensureDraft?.();
          if(!saved?.id)throw Error('Enter a story title and save the draft before adding photos.');
          postId=saved.id;
        }
        for(const entry of pending.filter(item=>!item.done)){
          status.textContent='Uploading '+(sent+1)+' of '+pending.filter(item=>!item.done).length+'…';
          await upload(entry.file,postId,entry.alt.value.trim(),entry.caption.value.trim());
          entry.done=true;sent++;
        }
        toast(sent===1?'Photo or video attached.':sent+' files attached.','success');
        cleanup();pending=[];
        await mediaForPost(postId,ensureDraft);
      }catch(error){
        status.textContent=error.message+' Already uploaded files are preserved. Retry the remaining ones.';
        toast(error.message,'error');
        submit.disabled=false;
      }
    };
  }
  function mediaCard(x,quickEdit=false){
    const src='/corner/media/'+encodeURIComponent(x.storage_key);
    const isImage=x.mime_type.startsWith('image/');
    const preview=isImage?'<img loading="lazy" src="'+src+'" alt="'+esc(x.alt_text||'Image')+'">':
      '<video src="'+src+'" controls preload="none" playsinline></video>';
    return '<article class="media-thumb">'+
      '<a class="media-view-link" href="'+src+'" target="_blank" rel="noopener" aria-label="View attached media">'+preview+'</a>'+
      (x.caption?'<p class="media-card-caption">'+esc(x.caption)+'</p>':'')+
      '<small>'+esc(x.mime_type)+' · '+Math.round(x.size_bytes/1024)+' KB</small>'+
      (quickEdit?'<form class="media-quick-edit" data-media-quick-edit="'+esc(x.id)+'">'+
        '<label>Caption<input name="caption" maxlength="300" value="'+esc(x.caption||'')+'" placeholder="Add a caption"></label>'+
        '<label>Image description<input name="alt" maxlength="240" value="'+esc(x.alt_text||'')+'" '+(isImage?'required':'')+'></label>'+
        '<button type="submit">Save details</button></form>':'')+
      '<button type="button" data-media-edit="'+esc(x.id)+'">Advanced settings ↗</button>'+
      '</article>';
  }
  async function upload(file,postId,alt,caption=''){
    if(!file)throw Error('Choose a file');
    if(!supportedMedia.has(file.type))throw Error('Unsupported file type');
    if(file.size>(file.type.startsWith('image/')?8:25)*1024*1024)throw Error('File is too large');
    const params=new URLSearchParams({postId:String(postId||''),alt:String(alt||''),caption:String(caption||'')});
    const response=await fetch('/corner/api/admin/media/upload?'+params.toString(),{
      method:'POST',credentials:'same-origin',headers:{'content-type':file.type},body:file
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error?.message||'Upload failed');
    return result.data;
  }
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
  async function analytics(){
    const summary=await api('/corner/api/admin/analytics/summary');
    if(active.view!=='analytics')return;
    const figures=[['Page views',summary.page_view||0],['Story opens',summary.post_open||0],['Shares',summary.share||0]];
    const diag=summary.diagnostics||{};
    const noData=figures.every(([,n])=>Number(n)===0);
    const observed=diag.basicLastEventAt?new Date(diag.basicLastEventAt).toLocaleString('en-IN'):'No event recorded yet';
    const diagnosticHtml='<section class="corner-diagnostic"><div><strong>Measurement status</strong><p>'+(
      noData?'No first-party events in this seven-day window. That is not a database connectivity failure.':'First-party events are stored and available for this report.'
    )+'</p></div><dl><div><dt>Last basic event</dt><dd>'+esc(observed)+'</dd></div>'+
    '<div><dt>Recorded basic events</dt><dd>'+Number(diag.basicEventsRecorded||0).toLocaleString('en-IN')+'</dd></div>'+
    '<div><dt>Consent-based readings</dt><dd>'+Number(diag.consentedReadingsRecorded||0).toLocaleString('en-IN')+'</dd></div>'+
    '<div><dt>Reading collection</dt><dd>'+(diag.readingCollectionEnabled?'Enabled with visitor permission':'Paused')+'</dd></div></dl>'+
    '<p class="corner-diagnostic-help">Studio staff, browser privacy signals and readers who decline reading consent are excluded where required. Small reading groups remain hidden for privacy.</p></section>';
    root.innerHTML='<section class="corner-insights-intro"><div><p class="eyebrow">A CLEARER PICTURE</p><h2>Insights, together.</h2><p>Verified first-party event counts from the last seven days. Reading depth requires an additional visitor opt-in.</p></div><button type="button" data-insights-refresh>Refresh ↗</button></section>'+
      '<div class="corner-insights-cards">'+figures.map(([label,n])=>'<article><small>'+esc(label)+'</small><strong>'+Number(n).toLocaleString('en-IN')+'</strong></article>').join('')+'</div>'+
      diagnosticHtml+
      '<details class="corner-reading-details"><summary><span>Advanced reading analysis</span><small>Consent-based · private · open to investigate journeys</small></summary><div data-reading-report></div></details>';
    root.querySelector('[data-insights-refresh]').onclick=()=>analytics();
    const details=root.querySelector('.corner-reading-details');
    let loaded=false;
    details.addEventListener('toggle',async()=>{
      if(!details.open||loaded||active.view!=='analytics')return;
      loaded=true;
      try{
        if(!window.CornerAnalysis)await new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          script.src='/corner/analysis-studio.js';script.onload=resolve;
          script.onerror=()=>reject(Error('Reading analysis could not load.'));document.head.append(script);
        });
        if(active.view==='analytics')await window.CornerAnalysis.mount(details.querySelector('[data-reading-report]'));
      }catch(error){loaded=false;const slot=details.querySelector('[data-reading-report]');if(slot)slot.textContent=error.message;}
    });
    // An existing report deep link must open the advanced analysis automatically.
    // Ordinary Studio navigation defaults to the compact, basic Insights summary.
    if(new URLSearchParams(location.search).has('ar'))details.open=true;
  }
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
  $$('[data-admin-view]').forEach(b=>b.onclick=()=>{if(active.dirty&&!confirm('Leave with unsaved edits?'))return;showView(b.dataset.adminView)});
  $('#admin-logout')?.addEventListener('click',async()=>{try{await api('/corner/api/admin/logout','POST');location.reload()}catch(err){toast(err.message,'error')}});
  const requested=location.hash.slice(1);const allowed=$$('[data-admin-view]').map(b=>b.dataset.adminView);showView(allowed.includes(requested)?requested:initial.ownerRole==='moderator'?'comments':initial.ownerRole==='editor'?'posts':'overview');
  addEventListener('hashchange',()=>{if(allowed.includes(location.hash.slice(1)))showView(location.hash.slice(1))});
})();
