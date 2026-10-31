(() => {
  'use strict';
  const initial=window.__CORNER__||{},root=document.querySelector('#admin-view');
  const $=(s,el=document)=>el.querySelector(s),$$=(s,el=document)=>[...el.querySelectorAll(s)];
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const variantTypes=['wish','announcement','tech_note','journal','build','moment'];
  const typeNames={wish:'Wish',announcement:'Announcement',tech_note:'Tech Note',journal:'Journal',build:'Build Log',moment:'Moment'};
  const states=['all','draft','scheduled','published','archived'];
  const active={view:'overview',filter:'all',post:null,saveTimer:null,previewDevice:'laptop',dirty:false};
  const studioIcon=name=>'<svg class="v6-mobile-action-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({"pending":"<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>","approved":"<path d=\"M20 6 9 17l-5-5\"/>","hidden":"<path d=\"M3 3l18 18M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z\"/>","deleted":"<path d=\"M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6\"/>","approve":"<path d=\"M20 6 9 17l-5-5\"/>","hide":"<path d=\"M3 3l18 18M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z\"/>","delete":"<path d=\"M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6\"/>","reply":"<path d=\"M9 17 4 12l5-5M4 12h10a6 6 0 0 1 6 6v1\"/>"}[name]||'')+'</svg>';
  const toastStack=$('#toast-stack');
  function toast(message,variant='info'){
    if(window.CornerToast?.show)return window.CornerToast.show(message,{type:variant});
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
  // Every motion belongs to the exact button, operation and entity; the API
  // remains the only source of truth. When animation is unavailable, actions still work.
  async function actionMotion(options){
    if(window.CornerActionMotion?.run)return window.CornerActionMotion.run(options);
    try{
      const result=await options.execute({progress:()=>{},signal:options.signal});
      if(options.confirm&&options.confirm(result)!==true)throw Error('The operation was not confirmed.');
      await options.onSuccess?.(result);
      return {ok:true,result};
    }catch(error){options.onFailure?.(error);return {ok:false,error}}
  }
  const tag=(state)=>`<span class="admin-tag ${esc(state)}">${esc(state)}</span>`;
  const readable=(value)=>value?new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—';
  function empty(title,sub='Nothing needs attention right now.') {return `<div class="admin-empty"><span class="v6-empty-icon" aria-hidden="true">${studioIcon('approved')}</span><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>`}
  function showView(view){active.editorAbort?.abort();window.CornerAnalysis?.unmount();root.classList.remove('corner-insights-focus');root.removeAttribute('data-advanced-analytics');clearTimeout(active.saveTimer);active.view=view;active.post=null;active.dirty=false;
    const labels={command:'Command',overview:'Overview',posts:'Posts',media:'Media',comments:'Comments',guestbook:'Guestbook',analytics:'Insights',settings:'Settings'};
    history.replaceState(null,'','#'+view);
    active.view=view;$('#admin-heading').innerHTML=(labels[view]||'Overview')+'<span>.</span>';
    $$('[data-admin-view]').forEach(button=>{const selected=button.dataset.adminView===view;button.classList.toggle('is-active',selected);if(selected){button.setAttribute('aria-current','page');if(matchMedia('(max-width:767px)').matches)button.scrollIntoView({block:'nearest',inline:'nearest'});}else button.removeAttribute('aria-current')});
    root.innerHTML='<div class="admin-loading">Updating workspace…</div>';
    ({command,overview,posts,media,comments,guestbook,analytics,settings}[view]||overview)().then(()=>window.CornerMotion?.refresh()).catch(err=>{root.innerHTML=empty('Could not load this section',err.message);toast(err.message,'error')});
  }
  const commandEvidenceLabel={verified:'Verified',reported:'Reported',unverified:'Needs verification',blocked:'Blocked'};
  const commandAuthorityLabel={read:'Read only',draft:'Draft',write:'Change data',money:'Money',legal:'Legal',security:'Security'};
  const commandPriorityLabel={now:'NOW',next:'NEXT',later:'LATER'};
  const commandDue=item=>item.dueAt?new Date(item.dueAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'No due date';
  const commandItem=item=>`<article class="command-item command-priority-${esc(item.priority)}" data-command-id="${esc(item.id)}">
    <div class="command-item-head"><div><span class="command-workspace ${esc(item.workspace)}">${item.workspace==='kravia'?'KRAVIA':'PERSONAL'}</span>
      <span class="command-kind">${esc(item.kind.toUpperCase())}</span></div><span class="command-priority">${esc(commandPriorityLabel[item.priority]||item.priority)}</span></div>
    <h3>${esc(item.title)}</h3>${item.project?'<p class="command-project">'+esc(item.project)+'</p>':''}
    ${item.detail?'<p class="command-detail">'+esc(item.detail)+'</p>':''}
    <div class="command-meta"><span class="evidence-${esc(item.evidenceStatus)}">${esc(commandEvidenceLabel[item.evidenceStatus]||item.evidenceStatus)}</span>
      <span>${esc(commandAuthorityLabel[item.authority]||item.authority)}</span><span>${esc(commandDue(item))}</span>
      ${item.needsApproval?'<strong>Approval required</strong>':''}</div>
    ${item.evidenceNote?'<p class="command-evidence">'+esc(item.evidenceNote)+'</p>':''}
    ${item.sourceRef?'<p class="command-source">Source: '+esc(item.sourceRef)+'</p>':''}
    <div class="command-actions">
      ${item.state!=='done'?'<button type="button" data-command-state="done" data-id="'+esc(item.id)+'" data-version="'+item.version+'">Done</button>':''}
      ${item.state!=='waiting'?'<button type="button" data-command-state="waiting" data-id="'+esc(item.id)+'" data-version="'+item.version+'">Waiting</button>':''}
      ${item.state!=='open'?'<button type="button" data-command-state="open" data-id="'+esc(item.id)+'" data-version="'+item.version+'">Reopen</button>':''}
      ${item.state!=='dismissed'?'<button type="button" data-command-state="dismissed" data-id="'+esc(item.id)+'" data-version="'+item.version+'">Dismiss</button>':''}
    </div></article>`;

  async function command(){
    if(initial.ownerRole!=='owner'){root.innerHTML=empty('Owner access only.');return}
    const [summary,items]=await Promise.all([
      api('/corner/api/admin/command/summary'),
      api('/corner/api/admin/command/items')
    ]);
    const openItems=items.filter(item=>['open','waiting'].includes(item.state));
    const renderList=list=>list.length?list.map(commandItem).join(''):empty('Nothing here.','The command queue is clear.');
    root.innerHTML=`<section class="command-hero">
      <div><p class="eyebrow">OWNER COMMAND / PRIVATE</p><h2>One queue. Clear decisions.</h2>
      <p>Use this as the founder-level control layer. KRAVIA and personal ventures stay operationally separate; this screen keeps only the minimum status needed to decide what you do next.</p></div>
      <div class="command-boundary"><strong>Boundary lock</strong><span>Never mix company and personal money, credentials, branding or customer records.</span></div>
    </section>
    <section class="command-agent admin-surface" data-command-agent>
      <div class="command-agent-head"><div><p class="eyebrow">OWNER AI / ADVISORY</p><h2>Ask Command.</h2>
      <p>${summary.agent?.ready?'Uses only the private command queue below as factual context. High-risk actions still require approval.':'AI is not connected yet. The command queue and decision system still work normally.'}</p></div>
      <span class="command-agent-state ${summary.agent?.ready?'ready':'offline'}">${summary.agent?.ready?'READY':'NOT CONNECTED'}</span></div>
      ${summary.agent?.ready?'<form id="command-agent-form"><label for="command-agent-question">What do you need decided or prioritized?</label><div class="command-agent-compose"><textarea id="command-agent-question" name="question" maxlength="2400" rows="2" required placeholder="What should I focus on next? What is blocked? Which decision has the highest leverage?"></textarea><button type="submit" class="admin-primary">Ask</button></div></form><div class="command-agent-answer" data-command-agent-answer hidden></div>':'<p class="command-agent-offline">Connect the dedicated OpenAI API key and enable <code>CORNER_COMMAND_AI=1</code> to activate this layer. No key is stored in the browser or command database.</p>'}
    </section>
    <section class="command-kpis">
      <article><small>NOW</small><strong>${Number(summary.counts.now||0)}</strong><span>must move</span></article>
      <article><small>DECISIONS</small><strong>${Number(summary.counts.decisions||0)}</strong><span>need judgment</span></article>
      <article><small>RISKS</small><strong>${Number(summary.counts.risks||0)}</strong><span>need control</span></article>
      <article><small>APPROVALS</small><strong>${Number(summary.counts.approvals||0)}</strong><span>cannot auto-run</span></article>
    </section>
    <section class="command-grid">
      <div class="command-column"><div class="command-section-head"><div><p class="eyebrow">FOCUS</p><h2>What needs you now.</h2></div></div>
        <div class="command-list">${renderList(summary.nowItems)}</div>
        ${summary.overdue?.length?'<div class="command-section-head command-subhead"><h3>Overdue</h3></div><div class="command-list">'+renderList(summary.overdue)+'</div>':''}
      </div>
      <aside class="command-capture admin-surface"><p class="eyebrow">CAPTURE ONCE</p><h2>Add to command.</h2>
        <form id="command-capture" class="admin-form">
          <div class="editor-inline"><label>Workspace<select name="workspace"><option value="personal">Personal ventures</option><option value="kravia">KRAVIA founder-level only</option></select></label>
          <label>Type<select name="kind"><option value="task">Task</option><option value="decision">Decision</option><option value="risk">Risk</option><option value="idea">Idea</option></select></label></div>
          <label>Title<input name="title" maxlength="160" required placeholder="What must be decided or moved?"></label>
          <label>Project<input name="project" maxlength="100" placeholder="PakkaFollow, FileBloom, VidyaLuma…"></label>
          <label>Context<textarea name="detail" maxlength="1800" rows="3" placeholder="Only the minimum context needed to act."></textarea></label>
          <div class="editor-inline"><label>Priority<select name="priority"><option value="now">Now</option><option value="next" selected>Next</option><option value="later">Later</option></select></label>
          <label>Evidence<select name="evidenceStatus"><option value="verified">Verified</option><option value="reported">Reported</option><option value="unverified" selected>Needs verification</option><option value="blocked">Blocked</option></select></label></div>
          <label>Evidence note<input name="evidenceNote" maxlength="1200" placeholder="What proves this? What is still unknown?"></label>
          <label>Source / reference<input name="sourceRef" maxlength="600" placeholder="PR, email, document, provider page or note"></label>
          <div class="editor-inline"><label>Authority<select name="authority"><option value="read">Read only</option><option value="draft">Draft</option><option value="write">Change data</option><option value="money">Money</option><option value="legal">Legal</option><option value="security">Security</option></select></label>
          <label>Due<input name="dueAt" type="datetime-local"></label></div>
          <label class="command-approval"><input type="checkbox" name="needsApproval"> Require my approval before execution</label>
          <button type="submit" class="admin-primary">Add to command</button>
        </form>
        <p class="command-scope-note">KRAVIA entries here are routing metadata only. Company records, credentials and finance remain in KRAVIA-controlled systems.</p>
      </aside>
    </section>
    <section class="command-all"><div class="command-section-head"><div><p class="eyebrow">QUEUE</p><h2>Open and waiting.</h2></div><span>${openItems.length} active</span></div>
      <div class="command-list command-list-wide">${renderList(openItems)}</div>
    </section>`;

    const agentForm=$('#command-agent-form');
    if(agentForm)agentForm.onsubmit=async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]'),answer=$('[data-command-agent-answer]');
      button.disabled=true;answer.hidden=false;answer.textContent='Reviewing the verified command context…';
      try{
        const result=await api('/corner/api/admin/command/ask','POST',{question:form.elements.question.value});
        answer.textContent=result.text;
      }catch(error){answer.textContent=error.message;toast(error.message,'error')}
      finally{button.disabled=false}
    };
    $('#command-capture').onsubmit=async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');
      const due=form.elements.dueAt.value?new Date(form.elements.dueAt.value).toISOString():null;
      await actionMotion({action:'command.create',trigger:button,targetId:'owner-command',
        execute:()=>api('/corner/api/admin/command/items','POST',{
          workspace:form.elements.workspace.value,kind:form.elements.kind.value,title:form.elements.title.value,
          project:form.elements.project.value,detail:form.elements.detail.value,priority:form.elements.priority.value,
          evidenceStatus:form.elements.evidenceStatus.value,evidenceNote:form.elements.evidenceNote.value,
          sourceRef:form.elements.sourceRef.value,authority:form.elements.authority.value,
          needsApproval:form.elements.needsApproval.checked,dueAt:due
        }),
        onSuccess:()=>{toast('Added to command.','success');command()},
        onFailure:error=>toast(error.message,'error')});
    };
    $('[data-command-state]').forEach(button=>button.onclick=async()=>{
      const id=button.dataset.id,state=button.dataset.commandState,version=Number(button.dataset.version);
      await actionMotion({action:'command.state',trigger:button,targetId:id,
        execute:()=>api('/corner/api/admin/command/items/'+encodeURIComponent(id),'PATCH',{state,version}),
        onSuccess:()=>command(),onFailure:error=>toast(error.message,'error')});
    });
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
    root.innerHTML=`<section class="admin-table-head"><h2>All your notes.</h2><button id="new-post" class="admin-primary">+ New post</button></section><div class="admin-filter">${states.map(s=>`<button data-filter="${s}" class="${active.filter===s?'is-active':''}">${s[0].toUpperCase()+s.slice(1)}</button>`).join('')}</div>${list.length?`<div class="admin-table-scroller"><table class="admin-table"><thead><tr><th>POST</th><th>TYPE</th><th>STATUS</th><th>UPDATED</th><th>ACTIONS</th></tr></thead><tbody>${list.map(p=>`<tr><td><strong>${esc(p.title)}</strong><small>${esc(p.slug)}</small></td><td>${esc(typeNames[p.type])}</td><td>${tag(p.state)}</td><td>${readable(p.updated_at)}</td><td><button data-edit="${p.id}" type="button">${p.state==='archived'?'View':'Edit'} ↗</button>${p.state==='draft'?`<button data-delete-draft="${p.id}" type="button">Delete</button>`:''}${p.state==='archived'?`<button data-restore-draft="${p.id}" type="button">Restore</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:empty('Nothing here yet.','Create the first post or change the filter.')}`;
    $('#new-post').onclick=()=>editor();$$('[data-filter]').forEach(b=>b.onclick=()=>{active.filter=b.dataset.filter;posts()});$$('[data-edit]').forEach(b=>b.onclick=()=>editor(b.dataset.edit));
    $$('[data-delete-draft]').forEach(button=>button.onclick=async()=>{
      if(!confirm('Move draft to Archived?'))return;
      const id=button.dataset.deleteDraft;
      await actionMotion({action:'post.delete',trigger:button,targetId:id,visualTarget:button.closest('tr'),
        execute:()=>api('/corner/api/admin/posts/'+id,'DELETE'),
        onSuccess:()=>posts(),onFailure:error=>toast(error.message,'error')});
    });
    $$('[data-restore-draft]').forEach(button=>button.onclick=async()=>{
      const id=button.dataset.restoreDraft;
      await actionMotion({action:'post.restore',trigger:button,targetId:id,visualTarget:button.closest('tr'),
        execute:()=>api('/corner/api/admin/posts/'+id+'/restore','POST'),
        onSuccess:()=>posts(),onFailure:error=>toast(error.message,'error')});
    });
  }
  const autoTitle=body=>{
    const lines=String(body||'').trim().split(/[\n.!?]+/).map(s=>s.trim()).filter(Boolean);
    const first=(lines[0]||'A moment in pictures').replace(/^>\s*/,'');
    return first.length<=95?first:first.slice(0,91).replace(/\s+\S*$/,'')+'…';
  };
  const autoType=body=>{
    const text=String(body||'').toLowerCase();
    if(/\b(birthday|congratulations|festival|celebrate|anniversary|best wishes)\b/.test(text))return 'wish';
    if(/\b(shipped|launched|building|release|programming|developer|project|api|code|product)\b/.test(text))return 'build';
    if(/\b(photo|picture|rain|sunset|moment|beautiful sky|video|photograph)\b/.test(text))return 'moment';
    if(text.length>650)return 'journal';return 'tech_note';
  };
  function postFields(p={},seriesList=[]){
    const id=!!p.id,currentSeries=p.series||null;
    const seriesChoice=currentSeries?.slug||'__new__';
    const seriesOptions=seriesList.map(series=>`<option value="${esc(series.slug)}" data-next="${series.nextPart||''}" ${seriesChoice===series.slug?'selected':''}>${esc(series.title)} · ${Number(series.chapterCount||0)} ${Number(series.chapterCount||0)===1?'chapter':'chapters'}</option>`).join('');
    const publishedSeriesLocked=!!(currentSeries&&p.state==='published');
    return `<div class="v5-composer"><div class="v5-editor-surface"><div class="v5-editor-top"><strong>${id?'EDIT YOUR STORY':'YOUR CORNER / NEW STORY'} ${tag(p.state||'draft')}</strong><button type="button" class="v5-editor-menu-button" data-v5-settings-toggle aria-expanded="false" aria-controls="v5-editor-settings" aria-label="More post settings">···</button></div>
    <label class="sr-only" for="v5-story-body">Write your story</label><textarea id="v5-story-body" class="v5-textarea" name="body" maxlength="25000" rows="9" placeholder="What’s on your mind? A thought, a memory, a build, something worth sharing…">${esc(p.body||'')}</textarea>
    <div id="v5-editor-settings" class="v5-settings" data-v5-settings hidden><strong>Story settings</strong>
      <label>Presentation<select name="type" ${publishedSeriesLocked?'disabled aria-describedby="v7-series-lock-note"':''}><option value="auto" ${!id?'selected':''}>Automatically choose</option>${variantTypes.map(t=>`<option value="${t}" ${id&&p.type===t?'selected':''}>${typeNames[t]}</option>`).join('')}</select></label>
      <label>Symbol <input name="emoji" maxlength="8" value="${esc(p.emoji||'✳')}"></label>
      <label>Allow comments <input type="checkbox" name="allowComments" ${p.allow_comments!==false&&p.allow_comments!==0?'checked':''}></label>
      <label>Allow reactions <input type="checkbox" name="allowReactions" ${p.allow_reactions!==false&&p.allow_reactions!==0?'checked':''}></label>
      <label>Featured <input type="checkbox" name="featured" ${p.featured?'checked':''}></label>
      <label>Pinned <input type="checkbox" name="pinned" ${p.pinned?'checked':''}></label>
      <label>Milestone <input type="checkbox" name="milestone" ${p.milestone?'checked':''}></label>
      <label>Public upcoming teaser <input type="checkbox" name="upcomingPublic" ${p.upcoming_public?'checked':''}></label>
      <div class="v7-series-settings" data-journal-series ${p.type==='journal'?'':'hidden'}>
        <span>Journal series</span>
        <p class="v7-series-question">Which series does this Journal belong to?</p>
        <label for="v7-series-select">Series
          <select id="v7-series-select" name="seriesChoice" ${currentSeries?'disabled':''}>
            <option value="__new__" ${seriesChoice==='__new__'?'selected':''}>Start a new series from this Journal</option>
            ${seriesOptions}
          </select>
        </label>
        <p class="v7-series-context" data-series-context aria-live="polite">${currentSeries?esc(currentSeries.title)+' · Chapter '+String(currentSeries.partNumber).padStart(2,'0'):'No existing series selected. Saving starts a new series at Chapter 01 automatically.'}</p>
        ${currentSeries&&!publishedSeriesLocked?'<button type="button" class="admin-secondary v7-series-change" data-change-series>Change series</button>':''}
        ${publishedSeriesLocked?'<small id="v7-series-lock-note">Published chapters keep their series and chapter number stable. Start a new Journal draft for another series.</small>':'<small>Choose an existing series and the next chapter number is assigned automatically. Leave “Start a new series” selected to begin at Chapter 01.</small>'}
      </div>
      <p class="v5-edit-hint">Your title and summary are derived from your writing. Change the presentation only if needed.</p>
    </div><div class="v5-editor-media-actions"><button type="button" class="corner-media-trigger" id="open-media-panel" aria-haspopup="dialog" aria-controls="editor-media">＋ Attach photo or video <span class="corner-media-count" id="media-count" hidden></span></button><span id="save-indicator" class="v5-editor-status">${id?'Last saved '+esc(p.updated_at||''):'Start writing to autosave'}</span></div></div>
    <div class="editor-actions v5-editor-actions"><button type="button" class="secondary" id="save-post">Save draft</button><button type="button" id="publish-post">Publish ↗</button><button type="button" class="secondary" id="schedule-post">Schedule</button>${p.state==='draft'&&id?'<button type="button" class="v5-editor-danger" id="delete-draft">Delete draft</button>':''}${p.state==='published'?'<button type="button" class="warn" id="archive-post">Archive</button>':''}${p.state==='archived'?'<button type="button" id="restore-post">Restore</button>':''}</div></div>`;
  }
  function formValues(form){
    const body=form.elements.body.value,chosen=form.elements.type.value;
    const type=chosen==='auto'?autoType(body):chosen;
    return {type,title:autoTitle(body),emoji:form.elements.emoji.value||'✳',excerpt:String(body||'').replace(/\s+/g,' ').trim().slice(0,280),body,tags:active.post?.tags||[],featured:form.elements.featured.checked,pinned:form.elements.pinned.checked,milestone:form.elements.milestone.checked,allowComments:form.elements.allowComments.checked,allowReactions:form.elements.allowReactions.checked,upcomingPublic:form.elements.upcomingPublic.checked};
  }
  function updatePreview(form){const p=formValues(form),card=$('.preview-card');if(!card)return;
    card.className='preview-card story story-'+p.type;card.dataset.device=active.previewDevice;
    $('.preview-category',card).textContent=typeNames[p.type].toUpperCase();
    $('.preview-title',card).textContent=p.title;
    $('.preview-excerpt',card).textContent=p.excerpt||'A moment taking shape.';
    const quote=$('.preview-story-quote',card);if(quote){quote.hidden=true;quote.textContent='';}
    $('.preview-story-body',card).textContent=p.body;
    $('.preview-symbol',card).textContent=p.emoji;
    $('.preview-status',card).textContent=p.featured?'FEATURED':p.pinned?'PINNED':'PREVIEW';
  }
  function previewHtml(){return `<div class="preview-panel"><div class="admin-surface"><p class="eyebrow">PRIVATE PREVIEW</p><h3>Live preview</h3><div class="preview-devices">${['mobile','tablet','laptop','desktop'].map(d=>`<button data-device="${d}" class="${active.previewDevice===d?'is-active':''}">${d[0].toUpperCase()+d.slice(1)}</button>`).join('')}</div><div class="preview-stage"><article class="preview-card story story-tech_note" data-device="${active.previewDevice}"><div class="story-top"><span class="meta category preview-category">TECH NOTE</span><span class="status-tag preview-status">PREVIEW</span></div><div class="preview-media" data-editor-photo-preview hidden></div><div class="story-copy"><span class="preview-symbol" aria-hidden="true">✳</span><h3 class="preview-title">Your next story.</h3><p class="preview-excerpt">Just enough to invite someone in.</p><blockquote class="preview-story-quote" hidden></blockquote><div class="preview-story-body"></div><div class="story-bottom"><span class="read-meta">READ UPDATE</span><span class="read-link">Read ↗</span></div></div></article></div><p class="admin-hint">Device preview uses the public story CSS. Published cards adapt naturally in the actual feed.</p></div></div>`}
  async function editor(id=null){clearTimeout(active.saveTimer);active.editorAbort?.abort();active.editorAbort=new AbortController();const controller=active.editorAbort,expectedView=active.view;active.post=null;
    const [record,seriesList]=await Promise.all([id?api('/corner/api/admin/posts/'+encodeURIComponent(id)):Promise.resolve(null),api('/corner/api/admin/series')]);
    let p=record?.post||{state:'draft',type:'tech_note',allow_reactions:true,allow_comments:true,tags:[]};
    if(controller.signal.aborted||active.view!==expectedView)return;active.post=p;
    root.innerHTML=`<section class="admin-table-head"><h2>${id?'Edit this story':'A new story.'}</h2><button id="back-posts" class="admin-secondary">← All posts</button></section><div class="admin-two-col"><form class="editor admin-surface" id="post-editor">${postFields(p,seriesList)}</form>${previewHtml()}</div><dialog id="schedule-panel" class="corner-schedule-modal" aria-labelledby="corner-schedule-title"></dialog><dialog id="editor-media" class="corner-media-modal" aria-labelledby="media-editor-title" aria-describedby="media-editor-help"><p class="corner-media-loading" role="status">Loading your files…</p></dialog>`;
    const form=$('#post-editor');
    const publishButton=$('#publish-post');
    const publishMotion=window.CornerPublishMotion?.mount(publishButton);
    controller.signal.addEventListener('abort',()=>publishMotion?.cancel(),{once:true});
    const menu=$('[data-v5-settings]'),toggle=$('[data-v5-settings-toggle]');
    const hideSettings=()=>{if(menu){menu.hidden=true;toggle.setAttribute('aria-expanded','false')}};
    toggle?.addEventListener('click',()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden))});
    document.addEventListener('pointerdown',event=>{if(!menu?.hidden&&!menu.contains(event.target)&&!toggle.contains(event.target))hideSettings()},{signal:active.editorAbort.signal});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu?.hidden){hideSettings();toggle.focus()}},{signal:active.editorAbort.signal});

    const seriesPanel=$('[data-journal-series]',form),seriesSelect=form.elements.seriesChoice,seriesContext=$('[data-series-context]',form);
    const syncSeriesPanel=()=>{
      const values=formValues(form),journal=values.type==='journal';
      if(seriesPanel)seriesPanel.hidden=!journal;
      if(!journal||!seriesSelect||!seriesContext)return;
      if(p.series&&seriesSelect.disabled){
        seriesContext.textContent=p.series.title+' · Chapter '+String(p.series.partNumber).padStart(2,'0');
        return;
      }
      if(seriesSelect.value==='__new__')seriesContext.textContent='No existing series selected. Saving starts a new series at Chapter 01 automatically.';
      else{
        const option=seriesSelect.selectedOptions[0],next=Number(option?.dataset.next||0);
        seriesContext.textContent=next?'This will become Chapter '+String(next).padStart(2,'0')+' automatically.':'This series cannot accept another chapter.';
      }
    };
    $('[data-change-series]',form)?.addEventListener('click',event=>{
      if(!seriesSelect)return;
      seriesSelect.disabled=false;seriesSelect.dataset.moveAllowed='true';event.currentTarget.hidden=true;seriesSelect.focus();syncSeriesPanel();
    });
    let editorRevision=0;
    updatePreview(form);syncSeriesPanel();form.addEventListener('change',event=>{updatePreview(form);syncSeriesPanel();if(event.target===form.elements.type&&formValues(form).type==='journal')requestAnimationFrame(()=>seriesSelect?.focus())});form.addEventListener('input',()=>{
      editorRevision++;active.dirty=true;$('#save-indicator').textContent='Unsaved edits';
      updatePreview(form);syncSeriesPanel();
      if(p.state==='draft'&&form.elements.body.value.trim()){
        clearTimeout(active.saveTimer);active.saveTimer=setTimeout(()=>save(true),1450)
      }
    });
    $$('button[data-device]').forEach(b=>b.onclick=()=>{active.previewDevice=b.dataset.device;$$('button[data-device]').forEach(x=>x.classList.toggle('is-active',x.dataset.device===active.previewDevice));updatePreview(form)});
    let pendingSave=null;
    async function save(quiet=false){
      if(pendingSave)return pendingSave;
      if(!form.elements.body.value.trim()&&!p.id){if(!quiet)toast('Write something or attach media first.','error');return null;}
      clearTimeout(active.saveTimer);$('#save-indicator').textContent='Saving…';
      pendingSave=(async()=>{try{
        const values=formValues(form),savedRevision=editorRevision;
        const stored=p.id?await api('/corner/api/admin/posts/'+p.id,'PATCH',{...values,version:p.version}):await api('/corner/api/admin/posts','POST',values);
        // Journal organization is automatic: every Journal belongs to a series,
        // and chapter numbers are assigned by the server to avoid collisions.
        const previousSeries=p.series||null;
        try{
          if(values.type==='journal'){
            const choice=String(form.elements.seriesChoice?.value||'__new__');
            const sameSeries=previousSeries&&choice===previousSeries.slug;
            stored.series=sameSeries?previousSeries:await api('/corner/api/admin/posts/'+stored.id+'/series','PUT',
              choice==='__new__'
                ?{mode:'new',allowMove:form.elements.seriesChoice?.dataset.moveAllowed==='true'}
                :{mode:'existing',slug:choice,allowMove:form.elements.seriesChoice?.dataset.moveAllowed==='true'});
          }else if(previousSeries){
            stored.series=await api('/corner/api/admin/posts/'+stored.id+'/series','PUT',{mode:'unlink'});
          }else stored.series=null;
        }catch(seriesError){
          p={...stored,series:previousSeries};active.post=p;active.dirty=true;
          throw new Error('Story saved, but Journal series setup failed: '+seriesError.message);
        }
        // Persisted draft is safe, but never apply a stale response to a different Studio view.
        if(controller.signal.aborted)return null;
        p=stored;active.post=p;active.dirty=editorRevision!==savedRevision;
        if(p.series&&seriesSelect){
          let option=[...seriesSelect.options].find(item=>item.value===p.series.slug);
          if(!option){option=new Option(p.series.title,p.series.slug);option.dataset.next=String(Number(p.series.partNumber||0)+1);seriesSelect.add(option)}
          seriesSelect.value=p.series.slug;seriesSelect.disabled=true;delete seriesSelect.dataset.moveAllowed;syncSeriesPanel();
        }
        form.querySelector('#save-indicator').textContent=active.dirty
          ?'Earlier edits saved · newer edits unsaved'
          :'Saved · '+new Date(p.updated_at||Date.now()).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
        if(active.dirty&&p.state==='draft'){
          clearTimeout(active.saveTimer);active.saveTimer=setTimeout(()=>save(true),1450);
        }
        if(!quiet)toast('Draft saved.','success');return p;
      }catch(error){if(!controller.signal.aborted){
        form.querySelector('#save-indicator').textContent=error.status===409?'Edit conflict — refresh':'Save failed';
        if(!quiet)toast(error.message,'error');
      }return null}
      finally{pendingSave=null}})();return pendingSave;
    }
    $('#save-post').onclick=async()=>{
      const button=$('#save-post');
      await actionMotion({action:'draft.save',trigger:button,targetId:p.id||'new-draft',
        signal:controller.signal,execute:()=>save(true),
        confirm:stored=>!!stored&&!active.dirty,
        onSuccess:()=>toast('Draft saved.','success'),
        onFailure:error=>toast(active.dirty?'Earlier edits saved; newer changes remain unsaved.':error.message,'error')});
    };
    let publishing=false,publishFailureNotice=null;
    const lockedControls=new Map();
    const lockWhilePublishing=()=>{
      for(const control of form.querySelectorAll('button,input,textarea,select')){
        if(control===publishButton)continue;
        lockedControls.set(control,control.disabled);control.disabled=true;
      }
    };
    const unlockAfterPublishing=()=>{
      for(const [control,wasDisabled] of lockedControls){
        if(control.isConnected)control.disabled=wasDisabled;
      }
      lockedControls.clear();
    };
    publishButton.onclick=async()=>{
      if(publishing||publishMotion?.start()===false)return;
      // A resolved retry must never leave an old red publish error visible behind green success.
      publishFailureNotice?.dismiss?.();publishFailureNotice=null;
      publishing=true;lockWhilePublishing();
      try{
        // Save the real draft before the actual publish request; never fake success.
        const saved=await save(true);
        if(controller.signal.aborted)return;
        if(!saved){
          publishMotion?.failure('Could not save your story. Review your changes and retry.');
          publishFailureNotice=toast('Could not save your story. Review your changes and retry.','error');
          return;
        }
        const published=await api('/corner/api/admin/posts/'+saved.id+'/publish','POST');
        if(controller.signal.aborted)return;
        p=published;active.post=p;active.dirty=false;
        await publishMotion?.success();
        if(controller.signal.aborted)return;
        toast('Published. Your story is live.','success');
        void editor(p.id);
        // Old editor must not issue another publish while the new editor loads.
        publishButton.disabled=true;
      }catch(err){
        if(!controller.signal.aborted){
          publishMotion?.failure(err.message||'Publishing failed. Please retry.');
          publishFailureNotice=toast(err.message||'Publishing failed. Please retry.','error');
        }
      }finally{
        publishing=false;unlockAfterPublishing();
      }
    };
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
        feedback.textContent='Saving the schedule…';
        await actionMotion({action:'post.schedule',trigger:button,targetId:p.id||'new-schedule',
          signal:controller.signal,execute:async()=>{
            const saved=await save(true);
            if(!saved||active.dirty)throw Error('Save the latest story edits before scheduling.');
            return api('/corner/api/admin/posts/'+saved.id+'/schedule','POST',{
              localTime:formSchedule.elements.localTime.value,
              timezone:formSchedule.elements.timezone.value,
              recurrence:formSchedule.elements.recurrence.value,
              recurrenceEndYear:formSchedule.elements.recurrenceEndYear.value,
              featureStartLocal:formSchedule.elements.featureStartLocal.value,
              featureEndLocal:formSchedule.elements.featureEndLocal.value,
              pinStartLocal:formSchedule.elements.pinStartLocal.value,
              pinEndLocal:formSchedule.elements.pinEndLocal.value
            });
          },
          confirm:result=>!!result?.id&&result.state==='scheduled',
          onSuccess:scheduled=>{
            p=scheduled;feedback.textContent='Scheduled for '+formSchedule.elements.localTime.value;
            if(!controller.signal.aborted){panel.close();toast('Scheduled successfully.','success');void editor(p.id)}
          },
          onFailure:error=>{feedback.textContent=error.message||'Scheduling failed. Please try again.'}
        });
      };
      panel.showModal();
      panel.querySelector('[name=localTime]').focus();
    };
    $('#delete-draft')?.addEventListener('click',async event=>{
      if(!p.id||p.state!=='draft'||!confirm('Move this draft to Archived? You can restore it later.'))return;
      await actionMotion({action:'post.delete',trigger:event.currentTarget,targetId:p.id,signal:controller.signal,
        execute:()=>api('/corner/api/admin/posts/'+p.id,'DELETE'),
        onSuccess:()=>{toast('Draft moved to Archived.','success');showView('posts')},
        onFailure:error=>toast(error.message,'error')});
    });
    $('#archive-post')?.addEventListener('click',async event=>{
      if(!confirm('Archive this story? It will no longer be public.'))return;
      await actionMotion({action:'post.archive',trigger:event.currentTarget,targetId:p.id,signal:controller.signal,
        execute:()=>api('/corner/api/admin/posts/'+p.id+'/archive','POST'),
        onSuccess:()=>{toast('Post archived.','success');showView('posts')},
        onFailure:error=>toast(error.message,'error')});
    });
    $('#restore-post')?.addEventListener('click',async event=>{
      await actionMotion({action:'post.restore',trigger:event.currentTarget,targetId:p.id,signal:controller.signal,
        execute:()=>api('/corner/api/admin/posts/'+p.id+'/restore','POST'),
        onSuccess:()=>{toast('Post restored.','success');void editor(p.id)},
        onFailure:error=>toast(error.message,'error')});
    });
    $('#back-posts').onclick=()=>{if(active.dirty&&!confirm('Leave with unsaved edits?'))return;showView('posts')};
    const mediaPanel=$('#editor-media');
    $('#open-media-panel').onclick=()=>{if(mediaPanel&&!mediaPanel.open)mediaPanel.showModal()};
    mediaPanel?.addEventListener('click',event=>{if(event.target===mediaPanel)mediaPanel.close()});
    window.CornerMotion?.refresh();
    mediaForPost(p.id||null,()=>save(true)).catch(err=>{mediaPanel.dataset.mediaInitError=err.message||String(err);toast(err.message,'error')});
    form.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save(true)}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='p'){event.preventDefault();$('.preview-stage')?.scrollIntoView({behavior:'smooth',block:'nearest'})}});
  }
  const uploadLimit=8;
  const supportedMedia=new Set(['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/webm']);
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
    const badge=$('#media-count');
    if(badge){badge.textContent=String(attachments.length);badge.hidden=!attachments.length}
    section.innerHTML='<div class="corner-media-shell">'+
      '<header class="corner-media-header"><div class="corner-media-heading"><p class="eyebrow">STORY / MEDIA</p><h2 id="media-editor-title">Attach files<span>.</span></h2><p id="media-editor-help">A clean space for your story photos and videos.</p></div><button type="button" class="corner-media-close" data-media-dismiss aria-label="Close media dialog">×</button></header>'+
      '<section class="post-media-editor" aria-label="Current attachments and new uploads">'+
      '<div class="post-media-head"><h3>Story attachments</h3><small class="corner-media-total">'+attachments.length+' '+(attachments.length===1?'file':'files')+'</small></div>'+
      (attachments.length?'<div class="media-gallery">'+attachments.map((x,index)=>mediaCard(x,true,index,attachments.length)).join('')+'</div>':
       '<p class="corner-media-empty">No files attached yet. Select a photo or video below to add it to this story.</p>')+
      '<form id="editor-upload" class="upload-field" aria-label="Upload photographs or a video">'+
      '<label>Select up to '+uploadLimit+' files per batch<input type="file" name="files" multiple accept="image/*,video/mp4,video/quicktime,video/webm,.heic,.heif,.mov" required></label>'+
      '<div class="upload-preview-list" data-upload-previews aria-live="polite"></div>'+
      '<p class="admin-hint">JPG, PNG, HEIC, WebP or GIF up to 12 MB; MP4, MOV/HEVC or WebM up to 75 MB. Clips are optimized before playback.</p>'+
      '<p data-upload-status role="status" aria-live="polite"></p>'+
      '<button type="submit" class="admin-secondary" disabled>Attach selected media ↑</button>'+
      '</form></section>'+
      '<footer class="corner-media-footer"><span>Draft media stays private until you publish.</span><button type="button" class="corner-media-done" data-media-dismiss>Done ↗</button></footer></div>';
    section.querySelectorAll('[data-media-dismiss]').forEach(button=>button.addEventListener('click',()=>section.close()));
    $$('[data-media-edit]',section).forEach(button=>{
      button.onclick=()=>mediaEdit(button.dataset.mediaEdit,attachments,postId);
    });
    $$('[data-media-delete]',section).forEach(button=>{
      button.onclick=async()=>{
        const id=button.dataset.mediaDelete;
        const item=attachments.find(media=>media.id===id);
        if(!item||!confirm('Remove this image or video from the story?'))return;
        await actionMotion({action:'media.delete',trigger:button,targetId:id,
          visualTarget:button.closest('.media-thumb'),
          execute:()=>api('/corner/api/admin/media/'+encodeURIComponent(id),'DELETE'),
          onSuccess:()=>{toast('Media removed.','success');return mediaForPost(postId,ensureDraft)},
          onFailure:error=>toast(error.message,'error')});
      };
    });
    $$('[data-media-move]',section).forEach(button=>{
      button.onclick=async()=>{
        const id=button.dataset.mediaMove,direction=Number(button.dataset.direction)||0;
        const index=attachments.findIndex(item=>item.id===id),next=index+direction;
        if(index<0||next<0||next>=attachments.length)return;
        const ids=attachments.map(item=>item.id);[ids[index],ids[next]]=[ids[next],ids[index]];
        await actionMotion({action:'media.order',trigger:button,targetId:postId,
          visualTarget:button.closest('.media-thumb'),
          execute:()=>api('/corner/api/admin/posts/'+encodeURIComponent(postId)+'/media-order','POST',{ids}),
          onSuccess:()=>{toast('Carousel order updated.','success');return mediaForPost(postId,ensureDraft)},
          onFailure:error=>toast(error.message,'error')});
      };
    });
    const form=$('#editor-upload',section);
    const fileInput=form.elements.files;
    const previewList=$('[data-upload-previews]',form);
    const status=$('[data-upload-status]',form);
    const submit=form.querySelector('button[type=submit]');
    let pending=[];
    const cleanup=()=>{for(const entry of pending)if(entry.url)URL.revokeObjectURL(entry.url)};
    section.onclose=()=>{cleanup();pending=[];fileInput.value='';previewList.replaceChildren();status.textContent='';submit.disabled=true};
    const previewEntry=entry=>{
      const wrapper=document.createElement('div');
      wrapper.className='upload-preview-card';
      const figure=document.createElement('figure');
      const remove=document.createElement('button');remove.type='button';remove.className='upload-preview-remove';remove.setAttribute('aria-label','Remove '+entry.file.name+' from selected uploads');remove.textContent='×';
      remove.onclick=()=>{if(entry.url)URL.revokeObjectURL(entry.url);pending=pending.filter(item=>item!==entry);wrapper.remove();status.textContent=pending.length?pending.length+' selected. Ready to attach.':'No files selected.';submit.disabled=!pending.length;submit.textContent=pending.length===1?'Attach media ↑':'Attach '+pending.length+' files ↑';};
      figure.append(remove);
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
      if(entry.file.type.startsWith('video/')&&entry.file.type!=='video/webm'){
        const videoTrim=document.createElement('div');videoTrim.className='v5-video-trim';
        videoTrim.innerHTML='<label>Trim from (seconds)<input type="number" name="start" min="0" max="179" step="0.5" value="0"></label><label>Trim until (seconds, optional)<input type="number" name="end" min="0" max="180" step="0.5" placeholder="End of clip"></label>';
        fields.append(videoTrim);
        entry.start=videoTrim.querySelector('[name=start]');entry.end=videoTrim.querySelector('[name=end]');
      }

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
              status.textContent='Crop applied. Ready to attach.';
            }
          }catch(error){status.textContent=error.message||'Could not crop this image.'}
          finally{crop.disabled=false}
        };
        fields.append(crop);
      }
      wrapper.append(figure,fields);
      previewList.append(wrapper);
    };
    let selectedSignature='';
    const selectedFiles=()=>{
      const files=[...fileInput.files];
      const signature=files.map(file=>file.name+':'+file.size+':'+file.lastModified).join('|');
      if(signature===selectedSignature&&previewList.children.length)return;
      selectedSignature=signature;
      cleanup();pending=[];previewList.replaceChildren();
      if(files.length>uploadLimit){status.textContent='Choose no more than '+uploadLimit+' files at once.';submit.disabled=true;return}
      if(files.some(file=>!supportedMedia.has(file.type))){status.textContent='Unsupported file type. Use JPG, PNG, HEIC, WebP, GIF, MP4, MOV or WebM.';submit.disabled=true;return}
      status.textContent=files.length?files.length+' selected. Ready to attach.':'';
      for(const file of files){const entry={file,done:false,url:null};pending.push(entry);previewEntry(entry)}
      submit.disabled=!pending.length;
      submit.textContent=pending.length===1?'Attach media ↑':'Attach '+pending.length+' files ↑';
      if(files.length===1&&previewList.querySelector('[data-crop-upload]'))requestAnimationFrame(()=>previewList.querySelector('[data-crop-upload]')?.click());
    };
    fileInput.oninput=selectedFiles;
    fileInput.onchange=selectedFiles;
    fileInput.addEventListener('input',selectedFiles);
    fileInput.addEventListener('change',selectedFiles);
    form.addEventListener('input',event=>{if(event.target===fileInput)selectedFiles()});
    form.addEventListener('change',event=>{if(event.target===fileInput)selectedFiles()});
    form.dataset.mediaReady='true';
    form.onsubmit=async event=>{
      event.preventDefault();
      if(!pending.length)return;
      const total=pending.filter(item=>!item.done).length;
      const result=await actionMotion({action:'media.upload',trigger:submit,targetId:postId||'new-upload-batch',
        visualTarget:previewList,execute:async({progress})=>{
          // The native file transfer has no byte percentage; use truthful stage text,
          // and distinguish upload from video processing until worker reports Ready.
          let sent=0;
          for(const entry of pending.filter(item=>!item.done)){
            const isImage=entry.file.type.startsWith('image/');
            if(!supportedMedia.has(entry.file.type))throw Error('Unsupported file type: '+entry.file.name);
            if(!entry.file.size||entry.file.size>(isImage?12:75)*1024*1024)throw Error('File is too large: '+entry.file.name);
          }
          if(!postId){
            const saved=await ensureDraft?.();
            if(!saved?.id)throw Error('Enter story content and save the draft before attaching media.');
            postId=saved.id;
          }
          for(const entry of pending.filter(item=>!item.done)){
            const message='Uploading '+(sent+1)+' of '+total+' · '+entry.file.name;
            status.textContent=message;progress(message);
            const stored=await upload(entry.file,postId,{start:entry.start?.value||0,end:entry.end?.value||0});
            if(stored?.jobId){
              let complete=false;
              for(let poll=0;poll<110;poll++){
                await new Promise(resolve=>setTimeout(resolve,1600));
                const job=await api('/corner/api/admin/media/jobs/'+encodeURIComponent(stored.jobId)+'?postId='+encodeURIComponent(postId));
                const step='Optimizing video · '+job.state;
                status.textContent=step;progress(step);
                if(job.state==='ready'){complete=true;break}
                if(job.state==='failed')throw Error('Video optimization failed. Try a shorter clip or export H.264.');
              }
              if(!complete)throw Error('Video is still being processed. Reopen media in a moment.');
            }
            entry.done=true;sent++;
          }
          return {sent};
        },
        confirm:value=>value.sent>0,
        successLabel:total===1?'Attached':'Files attached',
        onSuccess:async value=>{
          toast(value.sent===1?'Photo or video attached.':value.sent+' files attached.','success');
          cleanup();pending=[];
          await mediaForPost(postId,ensureDraft);
        },
        onFailure:error=>{
          status.textContent=error.message+' Already attached items are preserved. Retry remaining files.';
          toast(error.message,'error');
        }
      });
      if(result.ok)status.textContent='';
    };
  }
  function mediaCard(x,quickEdit=false,index=0,total=1){
    const src='/corner/media/'+encodeURIComponent(x.storage_key);
    const isImage=x.mime_type.startsWith('image/');
    const preview=isImage?'<img loading="lazy" src="'+src+'" alt="'+esc(x.alt_text||'Image')+'">':
      '<video src="'+src+'" controls preload="none" playsinline></video>';
    const controls='<div class="media-card-controls">'+
      '<button type="button" class="media-delete-x" data-media-delete="'+esc(x.id)+'" aria-label="Remove this media">×</button>'+
      (quickEdit?'<div class="media-order-controls" aria-label="Carousel position">'+
        '<button type="button" data-media-move="'+esc(x.id)+'" data-direction="-1" '+(index===0?'disabled':'')+' aria-label="Move media earlier">←</button>'+
        '<span>'+(index+1)+' / '+total+'</span>'+
        '<button type="button" data-media-move="'+esc(x.id)+'" data-direction="1" '+(index===total-1?'disabled':'')+' aria-label="Move media later">→</button></div>':'')+
      '</div>';
    return '<article class="media-thumb '+(quickEdit?'media-thumb--attached':'media-thumb--library')+'">'+controls+
      '<a class="media-view-link" href="'+src+'" target="_blank" rel="noopener" aria-label="View attached media">'+preview+'</a>'+
      '<small>'+esc(x.mime_type)+' · '+Math.round(x.size_bytes/1024)+' KB</small>'+
      '<button type="button" data-media-edit="'+esc(x.id)+'">'+(quickEdit?'Adjust image ↗':'Adjust ↗')+'</button>'+
      '</article>';
  }
  async function upload(file,postId,trim={}){
    if(!file)throw Error('Choose a file');
    if(!supportedMedia.has(file.type))throw Error('Unsupported file type');
    if(file.size>(file.type.startsWith('image/')?12:75)*1024*1024)throw Error('File is too large');
    const params=new URLSearchParams({postId:String(postId||''),start:String(trim.start||0),end:String(trim.end||0)});
    const response=await fetch('/corner/api/admin/media/upload?'+params.toString(),{
      method:'POST',credentials:'same-origin',headers:{'content-type':file.type},body:file
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error?.message||'Upload failed');
    return result.data;
  }
  async function media(){const list=await api('/corner/api/admin/media');root.innerHTML=`<section class="admin-section corner-media-library"><header class="corner-library-heading"><div><p class="eyebrow">STUDIO / YOUR LIBRARY</p><h2>Media library.</h2><p>Review uploads, crop or reframe photos, and manage files in one place.</p></div><span class="corner-library-count">${list.length} ${list.length===1?'file':'files'}</span></header><div class="admin-surface corner-library-surface">${list.length?`<div class="media-gallery corner-library-grid">${list.map((x,index)=>mediaCard(x,false,index,list.length)).join('')}</div>`:empty('No media here yet.','Add an image to a post to begin.')}</div></section>`;$$('[data-media-edit]').forEach(b=>b.onclick=()=>mediaEdit(b.dataset.mediaEdit,list));$$('[data-media-delete]').forEach(button=>button.onclick=async()=>{
      if(!confirm('Delete this media file? It will be removed from its story.'))return;
      const id=button.dataset.mediaDelete;
      await actionMotion({action:'media.delete',trigger:button,targetId:id,visualTarget:button.closest('.media-thumb'),
        execute:()=>api('/corner/api/admin/media/'+encodeURIComponent(id),'DELETE'),
        onSuccess:()=>{toast('Media deleted.','success');return media()},
        onFailure:error=>toast(error.message,'error')});
    });}
  function mediaEdit(id,list,returnPostId=null){let x=list.find(m=>m.id===id);if(!x)return;root.innerHTML=`<section class="admin-section"><header><h2>Media adjustments.</h2><button class="admin-secondary" id="back-media">← Library</button></header><form class="admin-surface admin-form" id="media-editor"><div class="editor-inline"><label>Focus X (0–1)<input type="number" step=".05" min="0" max="1" name="focalX" value="${x.focal_x}"></label><label>Focus Y (0–1)<input type="number" step=".05" min="0" max="1" name="focalY" value="${x.focal_y}"></label></div>${x.mime_type.startsWith('image/')?`<fieldset class="v5-media-adjust"><legend>Adjust photo · original preserved</legend><label>Filter<select name="preset"><option value="original">Original</option><option value="warm">Warm</option><option value="film">Film</option><option value="mono">Mono</option><option value="dream">Dream</option></select></label><label>Crop<select name="crop"><option value="original">Original</option><option value="square">Square</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><label>Rotate<select name="rotation"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><label>Brightness<input type="range" name="brightness" min="0.6" max="1.4" step="0.05" value="1"></label><label>Contrast<input type="range" name="contrast" min="0.6" max="1.4" step="0.05" value="1"></label><label>Saturation<input type="range" name="saturation" min="0" max="2" step="0.05" value="1"></label></fieldset>`:''}<button type="submit">Save adjustments</button>${x.mime_type.startsWith('image/')?'<button type="button" data-v5-restore-photo>Restore original</button>':''}</form></section>`;
    const editForm=$('#media-editor');
    if(x.mime_type.startsWith('image/'))window.CornerPhotoCompare?.mount(editForm,x);
    const returnToMedia=()=>{if(returnPostId)void editor(returnPostId);else void media()};
    $('#back-media').onclick=returnToMedia;
    editForm.querySelector('[data-v5-restore-photo]')?.addEventListener('click',async event=>{
      await actionMotion({action:'media.edit',trigger:event.currentTarget,targetId:id,
        successLabel:'Original restored',visualTarget:editForm.querySelector('.corner-photo-compare'),
        execute:()=>api('/corner/api/admin/media/'+encodeURIComponent(id)+'/edits','DELETE'),
        onSuccess:()=>{toast('Original restored.','success');returnToMedia()},
        onFailure:error=>toast(error.message,'error')
      });
    });
    editForm.onsubmit=async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const trigger=form.querySelector('button[type="submit"]');
      let detailsSaved=false;
      await actionMotion({action:'media.edit',trigger,targetId:id,
        visualTarget:form.querySelector('.corner-photo-compare'),
        successLabel:'Media saved',
        execute:async({progress})=>{
          await api('/corner/api/admin/media/'+encodeURIComponent(id),'PATCH',{
            focalX:form.elements.focalX.value,focalY:form.elements.focalY.value
          });
          detailsSaved=true;
          if(x.mime_type.startsWith('image/')){
            progress('Saving photo adjustments…');
            await api('/corner/api/admin/media/'+encodeURIComponent(id)+'/edits','POST',{
              preset:form.elements.preset.value,crop:form.elements.crop.value,
              rotation:Number(form.elements.rotation.value),
              brightness:Number(form.elements.brightness.value),
              contrast:Number(form.elements.contrast.value),
              saturation:Number(form.elements.saturation.value)
            });
          }
          return {saved:true};
        },
        confirm:result=>result?.saved===true,
        onSuccess:()=>{toast('Media details saved.','success');returnToMedia()},
        onFailure:error=>{
          toast(detailsSaved?'Image position saved, but photo adjustments did not finish. Retry to complete the edit.':error.message,'error');
        }
      });
    };
  }
  async function comments(){const list=await api('/corner/api/admin/comments?state='+encodeURIComponent(active.commentFilter||'pending'));root.innerHTML=`<section class="admin-section"><header><h2>Conversations and moderation.</h2><div class="v5-comment-filters" role="group" aria-label="Moderation filters">${['pending','approved','hidden','deleted'].map(value=>`<button type="button" data-v5-comment-filter="${value}" aria-label="${value} comments" title="${value} comments" aria-pressed="${(active.commentFilter||'pending')===value}" class="${(active.commentFilter||'pending')===value?'is-active':''}">${studioIcon(value)}<span class="v6-action-label">${value}</span></button>`).join('')}</div></header>${list.length?`<div class="admin-card-list">${list.map(c=>`<article class="admin-comment"><header><div><strong>${esc(c.author_name)}</strong> · <small>${esc(c.post_title)}</small></div><small>${readable(c.created_at)}</small></header><p>${esc(c.body)}</p><footer><button data-moderate="approve" data-comment="${c.id}" aria-label="Approve comment" title="Approve">${studioIcon('approve')}<span class="v6-action-label">Approve</span></button><button data-moderate="hide" data-comment="${c.id}" aria-label="Hide comment" title="Hide">${studioIcon('hide')}<span class="v6-action-label">Hide</span></button><button data-moderate="delete" data-comment="${c.id}" aria-label="Delete comment" title="Delete">${studioIcon('delete')}<span class="v6-action-label">Delete</span></button>${c.state==='approved'?`<button type="button" data-v5-studio-reply="${c.id}" data-v5-studio-post="${c.post_id}" aria-label="Reply to comment" title="Reply">${studioIcon('reply')}<span class="v6-action-label">Reply</span></button>`:''}</footer></article>`).join('')}</div>`:empty('All caught up.','No comments need moderation.')}</section>`;
    $$('[data-v5-comment-filter]').forEach(button=>button.onclick=()=>{active.commentFilter=button.dataset.v5CommentFilter;comments()});
    $$('[data-v5-studio-reply]').forEach(button=>button.onclick=()=>{
      const commentId=button.dataset.v5StudioReply,postId=button.dataset.v5StudioPost;
      const host=button.closest('.admin-comment');if(!host)return;
      host.querySelector('.v5-admin-reply-form')?.remove();
      const reply=document.createElement('form');reply.className='v5-admin-reply-form';
      reply.innerHTML='<label>Reply in this thread<textarea required minlength="3" maxlength="1000" rows="3" placeholder="Write a reply…"></textarea></label><button type="submit">Publish author reply ↗</button>';
      host.append(reply);reply.querySelector('textarea').focus();
      reply.onsubmit=async event=>{
        event.preventDefault();
        const button=reply.querySelector('button'),textarea=reply.querySelector('textarea');
        const body=textarea.value.trim();
        await actionMotion({action:'comment.reply',trigger:button,targetId:commentId,
          visualTarget:host,execute:()=>api('/corner/api/v5/posts/'+postId+'/threads','POST',{body,parentId:commentId}),
          confirm:result=>!!result?.id||result?.state==='approved'||result?.state==='pending',
          onSuccess:result=>{
            if(result?.state==='pending')toast('Reply awaiting review.','success');
            else toast('Your reply is live.','success');
            void comments();
          },onFailure:error=>{toast(error.message,'error');textarea.focus({preventScroll:true})}});
      };
    });
    $$('[data-moderate]').forEach(button=>button.onclick=async()=>{
      const operation=button.dataset.moderate;
      if(operation==='delete'&&!confirm('Delete this comment?'))return;
      const id=button.dataset.comment,host=button.closest('.admin-comment');
      if(host&&(operation==='hide'||operation==='delete'))host.dataset.cornerMotionVisual='exit';
      await actionMotion({action:'comment.'+operation,trigger:button,targetId:id,
        visualTarget:host,execute:()=>api('/corner/api/admin/comments/'+id+'/'+operation,'POST'),
        onSuccess:()=>{
          toast(operation==='approve'?'Comment approved.':operation==='hide'?'Comment hidden.':'Comment deleted.','success');
          void comments();
        },
        onFailure:error=>toast(error.message,'error')});
      if(host?.isConnected)host.removeAttribute('data-corner-motion-visual');
    });
  }
  async function guestbook(){
    const response=await api('/corner/api/v1/admin/v3/guestbook');
    const entries=Array.isArray(response)?response:[];
    root.innerHTML='<section class="admin-section"><header><h2>Guestbook moderation.</h2></header>'+(
      entries.length?'<div class="admin-card-list">'+entries.map(n=>
        '<article class="admin-comment"><strong>'+esc(n.name)+'</strong><p>'+esc(n.message)+'</p><footer>'+
        ['approved','hidden','deleted'].map(state=>'<button type="button" data-guestbook-id="'+esc(n.id)+'" data-guestbook-state="'+state+'">'+(state==='approved'?'Approve':state==='hidden'?'Hide':'Delete')+'</button>').join('')+
        '</footer></article>').join('')+'</div>':empty('No guestbook notes waiting.'))+'</section>';
    $$('[data-guestbook-id]').forEach(button=>button.addEventListener('click',async()=>{
      const id=button.dataset.guestbookId,state=button.dataset.guestbookState;
      await actionMotion({action:'guestbook.review',trigger:button,targetId:id,
        visualTarget:button.closest('.admin-comment'),
        execute:()=>api('/corner/api/v1/admin/v3/guestbook/'+encodeURIComponent(id),'PATCH',{state}),
        onSuccess:()=>{toast('Guestbook note reviewed.','success');return guestbook()},
        onFailure:error=>toast(error.message,'error')});
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
      root.classList.toggle('corner-insights-focus',details.open);
      if(!details.open){root.removeAttribute('data-advanced-analytics');return}
      if(loaded||active.view!=='analytics')return;
      loaded=true;
      try{
        if(!window.CornerAnalysis)await new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          script.src='/corner/analysis-studio.js';script.onload=resolve;
          script.onerror=()=>reject(Error('Reading analysis could not load.'));document.head.append(script);
        });
        if(active.view==='analytics'){
          root.setAttribute('data-advanced-analytics','');
          await window.CornerAnalysis.mount(details.querySelector('[data-reading-report]'));
        }
      }catch(error){loaded=false;const slot=details.querySelector('[data-reading-report]');if(slot)slot.textContent=error.message;}
    });
    // An existing report deep link must open the advanced analysis automatically.
    // Ordinary Studio navigation defaults to the compact, basic Insights summary.
    if(new URLSearchParams(location.search).has('ar'))details.open=true;
  }
  async function settings(){let s=await api('/corner/api/admin/settings');root.innerHTML=`<section class="admin-section"><header><h2>The essentials.</h2></header><form class="admin-form admin-surface" id="settings-editor"><label>Site title<input name="title" value="${esc(s.title)}"></label><label>Short descriptor<input name="descriptor" value="${esc(s.descriptor)}"></label><label>Site timezone<input name="timezone" value="${esc(s.timezone)}"></label><div class="editor-checks"><label><input type="checkbox" name="commentsDefault" ${s.commentsDefault?'checked':''}> Comments by default</label><label><input type="checkbox" name="reactionsDefault" ${s.reactionsDefault?'checked':''}> Reactions by default</label></div><button type="submit">Save settings</button></form></section><section class="admin-section"><header><h2>Site status.</h2></header><button class="admin-secondary" id="settings-status">Update current status ↗</button></section>`;
    if(initial.ownerRole==='owner'){
      // Owner-only visual lab; isolated and explicitly non-persistent.
      const previewActions=[
        ['draft.save','Paper Fold'],['post.schedule','Clock Lock'],
        ['media.upload','Lift & Dock'],['post.archive','Archive'],
        ['post.restore','Unfold'],['comment.approve','Ink Check'],
        ['comment.reply','Reply Bubble'],['wish.publish','Ribbon']
      ];
      const lab=document.createElement('section');lab.className='admin-section corner-motion-lab';
      lab.setAttribute('aria-label','Corner Motion Lab');
      lab.innerHTML='<header><div><p class="eyebrow">STUDIO / MOTION LAB</p>'+
        '<h2>Feel the interactions.</h2><p>Preview only · no data will be saved, published or sent.</p></div></header>'+
        '<div class="corner-motion-lab-grid">'+previewActions.map(([kind,title])=>
          '<button type="button" data-motion-preview="'+kind+'" title="Preview '+title+'">'+title+'</button>').join('')+
        '</div><p class="corner-motion-lab-status" role="status" aria-live="polite">Select any animation to preview it.</p>';
      root.append(lab);
      lab.addEventListener('click',async event=>{
        const button=event.target.closest('[data-motion-preview]');
        if(!button)return;
        const status=lab.querySelector('.corner-motion-lab-status');
        status.textContent='Preview only · no changes will be made.';
        const result=await actionMotion({action:button.dataset.motionPreview,trigger:button,
          targetId:'preview:'+button.dataset.motionPreview,
          execute:()=>new Promise(resolve=>setTimeout(()=>resolve({preview:true}),650)),
          confirm:value=>value.preview===true,successLabel:'Preview complete',
          onSuccess:()=>{status.textContent='Animation complete · no data was changed.'},
          onFailure:error=>{status.textContent=error.message}});
        if(!result.ok&&result.error)status.textContent=result.error.message;
      });
    }
    if(initial.ownerRole==='owner'){const invite=document.createElement('a');invite.className='admin-secondary';invite.textContent='Invite a studio collaborator ↗';invite.href='/corner/admin/invite';invite.style.display='inline-flex';invite.style.marginTop='18px';root.append(invite)}$('#settings-status').onclick=statusEditor;$('#settings-editor').onsubmit=async e=>{
      e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type=submit]');
      await actionMotion({action:'settings.save',trigger:button,targetId:'site-settings',
        execute:()=>api('/corner/api/admin/settings','PUT',{title:form.elements.title.value,
          descriptor:form.elements.descriptor.value,timezone:form.elements.timezone.value,
          commentsDefault:form.elements.commentsDefault.checked,reactionsDefault:form.elements.reactionsDefault.checked}),
        onSuccess:()=>toast('Settings saved.','success'),
        onFailure:error=>toast(error.message,'error')});
    };
  }
  function statusEditor(){let s=initial.status||{};root.innerHTML=`<section class="admin-section"><header><h2>Corner Pulse.</h2><p class="corner-pulse-studio-help">A passing thought that leaves public view after 24 hours. Permanent stories stay in Posts.</p></header><form id="now-form" class="admin-form admin-surface"><div class="editor-inline"><label>Label<input name="label" maxlength="55" placeholder="Building something new" value="${esc(s.label||'')}"></label><label>Symbol<input name="icon" maxlength="8" placeholder="✳" value="${esc(s.icon||'✳')}"></label></div><label>Detail (optional)<textarea name="detail" maxlength="115" placeholder="One line, if needed.">${esc(s.detail||'')}</textarea></label><label><input type="checkbox" name="isActive" checked> Show this Pulse for 24 hours (uncheck to end it)</label><button type="submit">Share Pulse for 24 hours ↗</button></form></section>`;
    $('#now-form').onsubmit=async event=>{
      event.preventDefault();
      const form=event.currentTarget,button=form.querySelector('[type=submit]'),active=!!form.elements.isActive.checked;
      await actionMotion({
        action:'status.save',trigger:button,targetId:'corner-pulse',
        execute:()=>api('/corner/api/admin/status','PUT',{
          label:form.elements.label.value,detail:form.elements.detail.value,
          icon:form.elements.icon.value,isActive:active
        }),
        confirm:data=>active?!(!data||data.durationHours!==24||!data.expiresAt):data===null,
        onSuccess:()=>{toast(active?'Corner Pulse shared for 24 hours.':'Corner Pulse ended.','success');showView('overview')},
        onFailure:error=>toast(error.message,'error')
      });
    };
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
  const requested=location.hash.slice(1);const allowed=$$('[data-admin-view]').map(b=>b.dataset.adminView);showView(allowed.includes(requested)?requested:initial.ownerRole==='owner'?'command':initial.ownerRole==='moderator'?'comments':initial.ownerRole==='editor'?'posts':'overview');
  addEventListener('hashchange',()=>{if(allowed.includes(location.hash.slice(1)))showView(location.hash.slice(1))});
})();
