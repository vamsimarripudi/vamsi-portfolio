(() => {
  'use strict';
  const initial=window.__CORNER__||{},root=document.querySelector('#admin-view');
  const $=(s,el=document)=>el.querySelector(s),$$=(s,el=document)=>[...el.querySelectorAll(s)];
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const variantTypes=['wish','announcement','tech_note','journal','build','moment'];
  const typeNames={wish:'Wish',announcement:'Announcement',tech_note:'Tech Note',journal:'Journal',build:'Build Log',moment:'Moment'};
  const states=['all','draft','scheduled','published','archived'];
  const active={view:'overview',filter:'all',post:null,saveTimer:null,previewTimer:null,previewMode:'feed',previewDevice:'desktop',attachments:[],mediaJobs:[],mediaBusy:false,dirty:false,commandFilters:{workspace:'all',kind:'all',priority:'all',evidence:'all',state:'active'}};
  const studioIcon=name=>'<svg class="v6-mobile-action-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({"plus":"<path d=\"M12 5v14M5 12h14\"/>","comments":"<path d=\"M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z\"/>","pending":"<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>","approved":"<path d=\"M20 6 9 17l-5-5\"/>","hidden":"<path d=\"M3 3l18 18M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z\"/>","deleted":"<path d=\"M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6\"/>","approve":"<path d=\"M20 6 9 17l-5-5\"/>","hide":"<path d=\"M3 3l18 18M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z\"/>","delete":"<path d=\"M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6\"/>","reply":"<path d=\"M9 17 4 12l5-5M4 12h10a6 6 0 0 1 6 6v1\"/>"}[name]||'')+'</svg>';
  const toastStack=$('#toast-stack');
  function toast(message,variant='info'){
    if(window.CornerToast?.show)return window.CornerToast.show(message,{type:variant});
    if(!toastStack)return;const el=document.createElement('div');el.className='toast '+variant;
    const text=document.createElement('span');text.textContent=message;
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Dismiss notification');close.onclick=()=>el.remove();el.append(text,close);toastStack.append(el);setTimeout(()=>el.remove(),4700);
  }
  async function api(path,method='GET',payload,extra={}){
    const options={method,credentials:'same-origin',cache:'no-store',headers:{...(extra.headers||{})},signal:extra.signal};
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
  function showView(view){active.commandToolsAbort?.abort();active.editorAbort?.abort();clearTimeout(active.previewTimer);active.previewAbort?.abort();active.mediaBusy=false;active.attachments=[];active.mediaJobs=[];window.CornerAnalysis?.unmount();root.classList.remove('corner-insights-focus');root.removeAttribute('data-advanced-analytics');clearTimeout(active.saveTimer);active.view=view;active.post=null;active.dirty=false;
    const labels={command:'Command',overview:'Overview',posts:'Posts',media:'Media',comments:'Comments',guestbook:'Guestbook',analytics:'Insights',settings:'Settings'};
    history.replaceState(null,'','#'+view);
    active.view=view;document.documentElement.dataset.studioView=view;const studioTop=$('.admin-top');if(studioTop)studioTop.hidden=view==='command';$('#admin-heading').innerHTML=(labels[view]||'Overview')+'<span>.</span>';
    $$('[data-admin-view]').forEach(button=>{const selected=button.dataset.adminView===view;button.classList.toggle('is-active',selected);if(selected){button.setAttribute('aria-current','page');if(matchMedia('(max-width:767px)').matches)button.scrollIntoView({block:'nearest',inline:'nearest'});}else button.removeAttribute('aria-current')});
    root.innerHTML='<div class="admin-loading">Updating workspace…</div>';
    ({command,overview,posts,media,comments,guestbook,analytics,settings}[view]||overview)().then(()=>window.CornerMotion?.refresh()).catch(err=>{root.innerHTML=empty('Could not load this section',err.message);toast(err.message,'error')});
  }
  const commandEvidenceLabel={verified:'Verified',reported:'Reported',unverified:'Needs verification',blocked:'Blocked'};
  const commandAuthorityLabel={read:'Read only',draft:'Draft',write:'Change data',money:'Money',legal:'Legal',security:'Security'};
  const commandPriorityLabel={now:'Now',next:'Next',later:'Later'};
  const commandStateLabel={open:'Open',waiting:'Waiting',done:'Done',dismissed:'Dismissed'};
  const commandDue=item=>item.dueAt?new Date(item.dueAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'No due date';
  const commandStateOptions=item=>Object.entries(commandStateLabel).map(([value,label])=>'<option value="'+value+'" '+(item.state===value?'selected':'')+'>'+label+'</option>').join('');
  const commandItem=item=>{
    const hasDetails=!!(item.detail||item.evidenceNote||item.sourceRef);
    return '<article class="command-row command-priority-'+esc(item.priority)+'" data-command-id="'+esc(item.id)+'">'+
      '<div class="command-row-main"><div class="command-row-copy">'+
      '<div class="command-row-kicker"><span class="command-workspace '+esc(item.workspace)+'">'+(item.workspace==='kravia'?'KRAVIA':'PERSONAL')+'</span>'+
      '<span>'+esc(item.kind)+'</span><span>'+esc(commandPriorityLabel[item.priority]||item.priority)+'</span></div>'+
      '<h3>'+esc(item.title)+'</h3>'+
      '<div class="command-row-meta">'+(item.project?'<span>'+esc(item.project)+'</span>':'')+
      '<span class="evidence-'+esc(item.evidenceStatus)+'">'+esc(commandEvidenceLabel[item.evidenceStatus]||item.evidenceStatus)+'</span>'+
      '<span>'+esc(commandDue(item))+'</span><span>'+esc(commandAuthorityLabel[item.authority]||item.authority)+'</span>'+
      (item.needsApproval?'<span class="command-lock">Approval locked</span>':'')+'</div></div>'+
      '<label class="command-state-control"><span class="sr-only">State for '+esc(item.title)+'</span><select data-command-state-select data-id="'+esc(item.id)+'" data-version="'+item.version+'">'+commandStateOptions(item)+'</select></label></div>'+
      (hasDetails?'<details class="command-row-details"><summary>Details</summary><div>'+
        (item.detail?'<p>'+esc(item.detail)+'</p>':'')+
        (item.evidenceNote?'<p><strong>Evidence:</strong> '+esc(item.evidenceNote)+'</p>':'')+
        (item.sourceRef?'<p><strong>Source:</strong> '+esc(item.sourceRef)+'</p>':'')+
      '</div></details>':'')+
    '</article>';
  };
  const commandMoment=moment=>'<article class="command-moment"><div><span>'+esc(moment.signal)+'</span><strong>'+esc(moment.title)+'</strong></div><p>'+esc(moment.instruction)+'</p><button type="button" data-agentic-prompt="'+esc(moment.prompt)+'">Use prompt</button></article>';
  const commandQuickPrompts=[
    ['What needs me?','What needs my attention right now? Give me at most three items, with evidence and the exact owner decision if one is required.'],
    ['Find weak evidence','Find the weakest evidence in my active queue and tell me exactly what source would verify it.'],
    ['Prepare approvals','Prepare approval packets for every action that is actually ready: evidence, exact action, risk, reversibility, and approval question.'],
    ['DODO next','What can DODO safely prepare next without executing anything?']
  ];
  const commandPromptOptions=()=>'<option value="">Choose a shortcut…</option>'+commandQuickPrompts.map(([label,prompt])=>'<option value="'+esc(prompt)+'">'+esc(label)+'</option>').join('');
  const commandMatches=(item,filters)=>{
    if(filters.state==='active'&&!['open','waiting'].includes(item.state))return false;
    if(filters.state!=='active'&&filters.state!=='all'&&item.state!==filters.state)return false;
    if(filters.workspace!=='all'&&item.workspace!==filters.workspace)return false;
    if(filters.kind!=='all'&&item.kind!==filters.kind)return false;
    if(filters.priority!=='all'&&item.priority!==filters.priority)return false;
    if(filters.evidence!=='all'&&item.evidenceStatus!==filters.evidence)return false;
    return true;
  };
  async function command(){
    if(active.view!=='command')return;
    active.commandToolsAbort?.abort();
    const toolsController=new AbortController();active.commandToolsAbort=toolsController;
    if(initial.ownerRole!=='owner'){root.innerHTML=empty('Owner access only.');return}
    let summary,items;
    try{[summary,items]=await Promise.all([
      api('/corner/api/admin/command/summary','GET',undefined,{signal:toolsController.signal}),
      api('/corner/api/admin/command/items','GET',undefined,{signal:toolsController.signal})
    ])}catch(error){if(toolsController.signal.aborted)return;throw error}
    if(toolsController.signal.aborted)return;
    const filters=active.commandFilters;
    const activeTotal=items.filter(item=>['open','waiting'].includes(item.state)).length;
    root.innerHTML=`<section class="command-shell">
      <section class="command-overview-card">
        <div class="command-topbar">
          <div class="command-title-block"><p class="eyebrow">STUDIO</p><h2>Command<span>.</span></h2><p>One queue for decisions, risks and work that actually needs you.</p></div>
      <section class="command-tools" aria-label="Command tools">
        <details class="command-disclosure command-add" id="command-add-panel">
          <summary id="command-add-trigger" aria-controls="command-add-card" aria-label="Add item" title="Add item"><span class="command-tool-icon">${studioIcon('plus')}</span></summary>
          <div class="command-tool-card" id="command-add-card" role="region" aria-labelledby="command-add-title">
          <header class="command-tool-card-heading"><div><strong id="command-add-title" tabindex="-1">Add item</strong><p>Capture once, then close it.</p></div><button type="button" class="command-tool-close" data-command-tool-close aria-label="Close Add item">×</button></header>
          <form id="command-capture" class="command-form">
            <label class="command-form-title">Title<input name="title" maxlength="160" required placeholder="What needs attention?" data-command-tool-focus></label>
            <label>Project<input name="project" maxlength="100" placeholder="Optional"></label>
            <div class="command-form-grid">
              <label>Workspace<select name="workspace"><option value="personal">Personal</option><option value="kravia">KRAVIA</option></select></label>
              <label>Type<select name="kind"><option value="task">Task</option><option value="decision">Decision</option><option value="risk">Risk</option><option value="idea">Idea</option></select></label>
              <label>Priority<select name="priority"><option value="now">Now</option><option value="next" selected>Next</option><option value="later">Later</option></select></label>
            </div>
            <details class="command-form-more"><summary>More details</summary><div>
              <label>Context<textarea name="detail" maxlength="1800" rows="3" placeholder="Only what is needed to decide or act."></textarea></label>
              <div class="command-form-grid">
                <label>Evidence<select name="evidenceStatus"><option value="verified">Verified</option><option value="reported">Reported</option><option value="unverified" selected>Needs verification</option><option value="blocked">Blocked</option></select></label>
                <label>Authority<select name="authority"><option value="read">Read only</option><option value="draft">Draft</option><option value="write">Change data</option><option value="money">Money</option><option value="legal">Legal</option><option value="security">Security</option></select></label>
                <label>Due<input name="dueAt" type="datetime-local"></label>
              </div>
              <label>Evidence note<input name="evidenceNote" maxlength="1200" placeholder="What proves this?"></label>
              <label>Source / reference<input name="sourceRef" maxlength="600" placeholder="PR, email, document or provider reference"></label>
            </div></details>
            <div class="command-form-footer"><span>Owner approval is required before every execution.</span><button type="submit" class="admin-primary">Add item</button></div>
          </form>
          </div>
        </details>

        <details class="command-disclosure command-ai-panel" id="command-ai-panel">
          <summary id="command-ai-trigger" aria-controls="command-ai-card" aria-label="Ask Command" title="Ask Command"><span class="command-tool-icon">${studioIcon('comments')}</span></summary>
          <div class="command-tool-card" id="command-ai-card" role="region" aria-labelledby="command-ai-title">
          <header class="command-tool-card-heading"><div><strong id="command-ai-title" tabindex="-1">Ask Command</strong><p><i class="command-live-dot ${summary.agent?.ready?'ready':'offline'}" aria-hidden="true"></i>${summary.agent?.ready?'Advisory AI · ready':'Advisory AI · not connected'}</p></div><button type="button" class="command-tool-close" data-command-tool-close aria-label="Close Ask Command">×</button></header>
          ${summary.agent?.ready?'<form id="command-agent-form" class="command-ai-form"><label>Shortcut<select id="command-prompt-preset">'+commandPromptOptions()+'</select></label><label for="command-agent-question">Question<textarea id="command-agent-question" name="question" maxlength="2400" rows="3" required placeholder="Ask what matters, what is blocked, or what needs your approval." data-command-tool-focus></textarea></label><div class="command-form-footer"><span>Advisory only. It cannot execute without approval.</span><button type="submit" class="admin-primary">Ask</button></div></form><div class="command-agent-answer" data-command-agent-answer hidden></div>':'<div class="command-panel-note">The command queue still works normally. AI becomes available only when the private server connection is ready.</div>'}
          </div>
        </details>

        <details class="command-disclosure command-moments-panel" id="command-moments-panel">
          <summary id="command-moments-trigger" aria-controls="command-moments-card" aria-label="Agentic moments" title="Agentic moments"><span class="command-tool-icon command-tool-icon--accent" aria-hidden="true">✦</span></summary>
          <div class="command-tool-card" id="command-moments-card" role="region" aria-labelledby="command-moments-title">
          <header class="command-tool-card-heading"><div><strong id="command-moments-title" tabindex="-1">Agentic moments</strong><p><i class="command-live-dot signal" aria-hidden="true"></i>${(summary.moments||[]).length} current signals</p></div><button type="button" class="command-tool-close" data-command-tool-close aria-label="Close Agentic moments">×</button></header>
          <div class="command-moment-list">${(summary.moments||[]).map(commandMoment).join('')||'<p class="command-panel-note">No agentic intervention is needed right now.</p>'}</div>
          </div>
        </details>
      </section>
        </div>

        <div class="command-status-row">
          <span class="command-ai-status ${summary.agent?.ready?'ready':'offline'}"><i aria-hidden="true"></i>${summary.agent?.ready?'AI ready':'AI offline'}</span>
          <span class="command-boundary-inline">Personal ↔ KRAVIA boundary locked</span>
        </div>

        <div class="command-summary-strip" aria-label="Command summary">
          <span><strong>${activeTotal}</strong><small>Active</small></span>
          <span><strong>${Number(summary.counts.now||0)}</strong><small>Now</small></span>
          <span><strong>${Number(summary.counts.decisions||0)}</strong><small>Decisions</small></span>
          <span><strong>${Number(summary.counts.risks||0)}</strong><small>Risks</small></span>
          <span><strong>${Number(summary.counts.approvals||0)}</strong><small>Approval locked</small></span>
        </div>
      </section>

      <section class="command-queue command-queue-card">
        <div class="command-queue-head">
          <div><h2>Queue</h2><p>Filter first. Open details only when you need context.</p></div>
          <span id="command-visible-count"></span>
        </div>
        <details class="command-filter-panel" id="command-filter-panel">
          <summary><span>Filters</span><small>Workspace · Type · Priority · Evidence · Status</small></summary>
          <div class="command-filterbar">
            <label>Workspace<select data-command-filter="workspace"><option value="all">All</option><option value="personal">Personal</option><option value="kravia">KRAVIA</option></select></label>
            <label>Type<select data-command-filter="kind"><option value="all">All</option><option value="task">Tasks</option><option value="decision">Decisions</option><option value="risk">Risks</option><option value="idea">Ideas</option></select></label>
            <label>Priority<select data-command-filter="priority"><option value="all">All</option><option value="now">Now</option><option value="next">Next</option><option value="later">Later</option></select></label>
            <label>Evidence<select data-command-filter="evidence"><option value="all">All</option><option value="verified">Verified</option><option value="reported">Reported</option><option value="unverified">Needs verification</option><option value="blocked">Blocked</option></select></label>
            <label>Status<select data-command-filter="state"><option value="active">Open + waiting</option><option value="open">Open</option><option value="waiting">Waiting</option><option value="done">Done</option><option value="dismissed">Dismissed</option><option value="all">All</option></select></label>
          </div>
        </details>
        <div class="command-list" id="command-queue-list"></div>
      </section>

      <footer class="command-footer-note">Built by a backbencher + AI · evidence first · approval always.</footer>
    </section>`;

    const toolGroup=$('.command-tools'),toolPanels=$$('.command-tools > .command-disclosure');
    const closeTool=(panel,restoreFocus=false)=>{
      panel.open=false;
      if(restoreFocus)panel.querySelector(':scope > summary')?.focus({preventScroll:true});
    };
    const closeOtherTools=panel=>toolPanels.forEach(other=>{if(other!==panel&&other.open)closeTool(other)});
    const positionToolCards=()=>{
      if(toolsController.signal.aborted||!toolGroup.isConnected||!toolPanels.some(panel=>panel.open))return;
      const bounds=toolGroup.getBoundingClientRect(),below=window.innerHeight-bounds.bottom-24,above=bounds.top-24;
      const placement=below<260&&above>below?'above':'below';
      toolGroup.dataset.commandToolPlacement=placement;
      toolGroup.style.setProperty('--command-tool-space',Math.max(0,Math.min(560,Math.floor(placement==='above'?above:below)))+'px');
    };
    for(const panel of toolPanels){
      const trigger=panel.querySelector(':scope > summary');
      trigger.addEventListener('click',()=>{if(!panel.open)closeOtherTools(panel)},{signal:toolsController.signal});
      panel.addEventListener('toggle',()=>{
        if(!panel.open||!panel.isConnected)return;
        closeOtherTools(panel);positionToolCards();
        panel.querySelector('.command-tool-card').scrollTop=0;
        const target=panel.querySelector('[data-command-tool-focus]')||panel.querySelector('.command-moment button:not([disabled])')||panel.querySelector('.command-tool-card-heading strong');
        target?.focus({preventScroll:true});
      },{signal:toolsController.signal});
      panel.querySelector('[data-command-tool-close]').addEventListener('click',()=>closeTool(panel,true),{signal:toolsController.signal});
    }
    document.addEventListener('keydown',event=>{
      if(event.key!=='Escape'||event.defaultPrevented)return;
      const panel=toolPanels.find(item=>item.open);if(!panel)return;
      event.preventDefault();closeTool(panel,true);
    },{signal:toolsController.signal});
    document.addEventListener('pointerdown',event=>{
      for(const panel of toolPanels)if(panel.open&&!panel.contains(event.target))closeTool(panel);
    },{signal:toolsController.signal});
    window.addEventListener('resize',positionToolCards,{signal:toolsController.signal});
    window.addEventListener('scroll',positionToolCards,{passive:true,signal:toolsController.signal});

    const renderQueue=()=>{
      const visible=items.filter(item=>commandMatches(item,filters));
      const host=$('#command-queue-list');
      if(host)host.innerHTML=visible.length?visible.map(commandItem).join(''):items.length?empty('Nothing matches these filters.','Change a dropdown or add a new command item.'):empty('Your queue is clear.','Add the next decision, risk, or task when it needs your attention.');
      const count=$('#command-visible-count');if(count)count.textContent=visible.length+' shown';
      $$('[data-command-state-select]').forEach(select=>select.onchange=async()=>{
        const id=select.dataset.id,state=select.value,version=Number(select.dataset.version),previous=items.find(item=>item.id===id)?.state;
        select.disabled=true;
        await actionMotion({action:'command.state',trigger:select,targetId:id,
          execute:()=>api('/corner/api/admin/command/items/'+encodeURIComponent(id),'PATCH',{state,version}),
          onSuccess:()=>command(),
          onFailure:error=>{select.value=previous||'open';select.disabled=false;toast(error.message,'error')}});
      });
    };

    const filterPanel=$('#command-filter-panel');if(filterPanel&&matchMedia('(min-width:768px)').matches)filterPanel.open=true;
    $$('[data-command-filter]').forEach(select=>{
      const key=select.dataset.commandFilter;select.value=filters[key]||'all';
      select.onchange=()=>{filters[key]=select.value;renderQueue()};
    });

    const promptPreset=$('#command-prompt-preset');
    if(promptPreset)promptPreset.onchange=()=>{
      const input=$('#command-agent-question');if(!input||!promptPreset.value)return;
      input.value=promptPreset.value;input.focus();
    };
    $$('[data-agentic-prompt]').forEach(button=>button.onclick=()=>{
      const panel=$('#command-ai-panel'),input=$('#command-agent-question');if(!input)return;
      input.value=button.dataset.agenticPrompt||'';
      if(panel){closeOtherTools(panel);panel.open=true;positionToolCards()}
      input.focus({preventScroll:true});
    });

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

    const capture=$('#command-capture');
    if(capture)capture.onsubmit=async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');
      const due=form.elements.dueAt.value?new Date(form.elements.dueAt.value).toISOString():null;
      await actionMotion({action:'command.create',trigger:button,targetId:'owner-command',
        execute:()=>api('/corner/api/admin/command/items','POST',{
          workspace:form.elements.workspace.value,kind:form.elements.kind.value,title:form.elements.title.value,
          project:form.elements.project.value,detail:form.elements.detail.value,priority:form.elements.priority.value,
          evidenceStatus:form.elements.evidenceStatus.value,evidenceNote:form.elements.evidenceNote.value,
          sourceRef:form.elements.sourceRef.value,authority:form.elements.authority.value,
          needsApproval:true,dueAt:due
        }),
        onSuccess:()=>{toast('Added to command.','success');command()},
        onFailure:error=>toast(error.message,'error')});
    };
    renderQueue();
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
  const composer=window.CornerComposer;
  const autoTitle=body=>composer?.title(body)||String(body||'').trim().split(/\r?\n/)[0].slice(0,95)||'A moment in pictures';
  const autoSummary=body=>composer?.summary(body)||String(body||'').replace(/\s+/g,' ').trim().slice(0,280);
  const autoType=body=>composer?.type(body,active.attachments.length)||'tech_note';
  const composerIcon=name=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({
    photo:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    arrow:'<path d="m14 6-6 6 6 6"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18m-12 5h2"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a16 16 0 0 1 0 18 16 16 0 0 1 0-18Z"/>',
    drafts:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    desktop:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    mobile:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 3 4 3 4-3 4-3M8 8h.01M16 8h.01"/>',
    sparkle:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  }[name]||'')+'</svg>';
  function postFields(p={},seriesList=[]){
    const id=!!p.id,currentSeries=p.series||null,archived=p.state==='archived';
    const seriesChoice=currentSeries?.slug||'__none__';
    const seriesOptions=seriesList.map(series=>`<option value="${esc(series.slug)}" data-next="${series.nextPart||''}" ${seriesChoice===series.slug?'selected':''}>${esc(series.title)} · ${Number(series.chapterCount||0)} ${Number(series.chapterCount||0)===1?'chapter':'chapters'}</option>`).join('');
    const publishedSeriesLocked=!!(currentSeries&&p.state==='published');
    const titleOverride=id&&p.title!==autoTitle(p.body)?p.title:'';
    const summaryOverride=id&&p.excerpt!==autoSummary(p.body)?p.excerpt:'';
    return `<div class="composer-editor-inner v5-composer"><div class="composer-author"><span class="composer-avatar" aria-hidden="true">VM<span>.</span></span><div><strong>${esc(initial.siteTitle||'Vamsi’s Corner')}</strong><span>${composerIcon('globe')} Public when published</span></div><span data-composer-state>${tag(p.state||'draft')}</span><button type="button" class="v5-editor-menu-button composer-more" data-v5-settings-toggle aria-expanded="false" aria-controls="v5-editor-settings" aria-label="More post settings" aria-haspopup="dialog">${composerIcon('more')}</button></div>
    <div data-draft-recovery class="composer-recovery" role="status" hidden></div>
    <div class="composer-writing"><label class="sr-only" for="v5-story-body">Write your story</label><textarea id="v5-story-body" class="v5-textarea" name="body" maxlength="25000" rows="10" ${archived?'readonly':''} placeholder="What’s on your mind, Vam?">${esc(p.body||'')}</textarea>
    <div class="composer-writing-tools"><span data-writing-count>0 characters</span><button type="button" class="composer-emoji-trigger" data-composer-emoji aria-label="Add an emoji" aria-expanded="false" aria-controls="composer-emoji">${composerIcon('smile')}</button></div><div id="composer-emoji" class="composer-emoji" hidden>${['✳','✨','❤️','🌿','☀️','🎉','📖','💭','🛠️','🙏','🌧️','😊'].map(emoji=>'<button type="button" data-insert-emoji="'+emoji+'" aria-label="Insert '+emoji+'">'+emoji+'</button>').join('')}</div></div>
    <div id="v5-editor-settings" class="v5-settings composer-settings" data-v5-settings hidden><header><div><span class="eyebrow">MAKE IT YOURS</span><strong>Post settings</strong></div><button type="button" data-settings-close aria-label="Close post settings">×</button></header>
      <section class="composer-setting-section"><h3>Presentation</h3><label>Layout<select name="type" ${publishedSeriesLocked||archived?'disabled aria-describedby="v7-series-lock-note"':''}><option value="auto" ${!id?'selected':''}>Automatically choose</option>${variantTypes.map(t=>`<option value="${t}" ${id&&p.type===t?'selected':''}>${typeNames[t]}</option>`).join('')}</select></label><label>Symbol<input name="emoji" maxlength="8" value="${esc(p.emoji||'✳')}"></label><p>Your words stay exactly as you write them.</p></section>
      <section class="composer-setting-section"><h3>Post details</h3><label>Title override <span>Optional</span><input name="titleOverride" maxlength="150" value="${esc(titleOverride)}" placeholder="Use the opening of your writing"></label><label>Summary override <span>Optional</span><input name="summaryOverride" maxlength="380" value="${esc(summaryOverride)}" placeholder="Use an excerpt from your writing"></label></section>
      <section class="composer-setting-section v7-series-settings" data-journal-series ${p.type==='journal'?'':'hidden'}><h3>Journal series</h3><p class="v7-series-question">Which series does this Journal belong to?</p><label for="v7-series-select">Series<select id="v7-series-select" name="seriesChoice" ${publishedSeriesLocked?'disabled':''}><option value="__none__" ${seriesChoice==='__none__'?'selected':''}>Standalone Journal</option><option value="__new__">Start a new series from this Journal</option>${seriesOptions}</select></label><p class="v7-series-context" data-series-context aria-live="polite">${currentSeries?esc(currentSeries.title)+' · Chapter '+String(currentSeries.partNumber).padStart(2,'0'):'This Journal stands on its own.'}</p>${publishedSeriesLocked?'<small id="v7-series-lock-note">Published chapters keep their series and chapter number stable.</small>':'<small>For an existing series, the next chapter number is assigned automatically when you save.</small>'}</section>
      <section class="composer-setting-section"><h3>Conversation</h3><label class="composer-toggle">Allow comments<input type="checkbox" name="allowComments" ${p.allow_comments!==false&&p.allow_comments!==0?'checked':''}></label><label class="composer-toggle">Allow reactions<input type="checkbox" name="allowReactions" ${p.allow_reactions!==false&&p.allow_reactions!==0?'checked':''}></label></section>
      <section class="composer-setting-section"><h3>Placement</h3><label class="composer-toggle">Featured<input type="checkbox" name="featured" ${p.featured?'checked':''}></label><label class="composer-toggle">Pinned<input type="checkbox" name="pinned" ${p.pinned?'checked':''}></label><label class="composer-toggle">Milestone<input type="checkbox" name="milestone" ${p.milestone?'checked':''}></label><label class="composer-toggle">Public upcoming teaser<input type="checkbox" name="upcomingPublic" ${p.upcoming_public?'checked':''}></label></section>
      ${initial.ownerRole==='owner'?'<section class="composer-setting-section"><h3>Subscriber update</h3>'+(p.state==='published'?'<a class="composer-text-link" href="/corner/admin/communications?post='+encodeURIComponent(p.id)+'">Preview subscriber email ↗</a>':'<label class="composer-toggle">Review subscriber email after publishing<input type="checkbox" name="reviewEmail"></label>')+'<p>Review the category template and opted-in audience before queuing an email.</p></section>':''}
    </div>
    <div class="composer-summary" data-composer-summary aria-live="polite"></div>
    <div class="composer-dropzone" data-composer-dropzone ${archived?'hidden':''}><button type="button" class="corner-media-trigger" id="open-media-panel" aria-haspopup="dialog" aria-controls="editor-media" data-composer-add-media><span class="composer-upload-icon">${composerIcon('photo')}${composerIcon('plus')}</span><strong>Add photos or videos</strong><span>Choose files or drag and drop</span><span class="corner-media-count" id="media-count" hidden></span></button></div>
    <div class="composer-attachments" data-composer-attachments hidden></div><div class="composer-media-jobs" data-composer-media-jobs hidden></div><p class="composer-media-state" data-composer-media-state role="status" hidden></p>
    <p class="composer-source-note">${composerIcon('sparkle')} You write. Your Corner finds its shape.</p></div>
    <footer class="composer-footer editor-actions v5-editor-actions"><div class="composer-save-state"><span id="save-indicator" class="v5-editor-status" role="status" aria-live="polite">${id?'Saved · '+esc(new Date(p.updated_at||Date.now()).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})):'Start writing to autosave'}</span><button type="button" data-save-retry hidden>Retry save</button></div><div class="composer-footer-actions"><button type="button" class="secondary" id="save-post" ${archived||p.state==='published'?'hidden':''}>${p.state==='scheduled'?'Save changes':'Save draft'}</button><button type="button" class="secondary composer-schedule" id="schedule-post" ${archived||p.state==='published'?'hidden':''}>${composerIcon('calendar')}<span>${p.state==='scheduled'?'Reschedule':'Schedule'}</span></button><button type="button" id="publish-post" ${archived?'hidden':''}>${p.state==='published'?'Update post':'Publish'}</button><button type="button" class="v5-editor-danger" id="delete-draft" ${p.state!=='draft'||!id?'hidden':''} aria-label="Archive draft">Delete draft</button>${p.state==='scheduled'?'<button type="button" id="cancel-schedule" class="secondary">Cancel schedule</button>':''}${p.state==='published'?'<button type="button" class="warn" id="archive-post">Archive</button>':''}${archived?'<button type="button" id="restore-post">Restore</button>':''}</div></footer>`;
  }
  function formValues(form){
    const body=form.elements.body.value,chosen=form.elements.type.value;
    const type=chosen==='auto'?autoType(body):chosen;
    return {type,title:form.elements.titleOverride?.value.trim()||autoTitle(body),emoji:form.elements.emoji.value||'✳',excerpt:form.elements.summaryOverride?.value.trim()||autoSummary(body),body,tags:active.post?.tags||[],featured:form.elements.featured.checked,pinned:form.elements.pinned.checked,milestone:form.elements.milestone.checked,allowComments:form.elements.allowComments.checked,allowReactions:form.elements.allowReactions.checked,upcomingPublic:form.elements.upcomingPublic.checked,timezone:active.post?.timezone||initial.timezone||'Asia/Kolkata'};
  }
  function composerSource(form){
    const result={};
    for(const name of ['body','type','emoji','titleOverride','summaryOverride','allowComments','allowReactions','featured','pinned','milestone','upcomingPublic','seriesChoice','reviewEmail']){
      const field=form.elements[name];if(field)result[name]=field.type==='checkbox'?field.checked:field.value;
    }
    return result;
  }
  function updatePreview(form,{immediate=false}={}){
    if(!form?.isConnected)return;
    const p=formValues(form),card=$('.preview-card'),count=$('[data-writing-count]',form),summary=$('[data-composer-summary]',form);
    if(count)count.textContent=Array.from(p.body).length.toLocaleString('en-IN')+' characters';
    if(summary){
      const parts=[(form.elements.type.value==='auto'?'Auto · ':'')+typeNames[p.type]];
      const series=form.elements.seriesChoice;
      if(p.type==='journal'&&series?.value&&series.value!=='__none__')parts.push(series.value==='__new__'?'New series':series.selectedOptions[0]?.textContent.split(' · ')[0]||'Journal series');
      if(!p.allowComments)parts.push('Comments off');if(!p.allowReactions)parts.push('Reactions off');
      if(p.featured)parts.push('Featured');if(p.pinned)parts.push('Pinned');
      if(form.elements.reviewEmail?.checked)parts.push('Review email after publishing');
      summary.replaceChildren(...parts.map(text=>{const span=document.createElement('span');span.textContent=text;return span}));
    }
    if(card){
      card.className='preview-card story story-'+p.type;card.dataset.device=active.previewDevice;
      $('.preview-category',card).textContent=typeNames[p.type].toUpperCase();$('.preview-title',card).textContent=p.title;
      $('.preview-excerpt',card).textContent=p.excerpt||'Your story will appear here.';
      $('.preview-story-body',card).textContent=p.body;$('.preview-story-body',card).hidden=active.previewMode!=='full';
      $('.preview-symbol',card).textContent=p.emoji;$('.preview-status',card).textContent=p.featured?'FEATURED':p.pinned?'PINNED':'PREVIEW';
    }
    const stage=$('.preview-stage');if(stage){stage.dataset.device=active.previewDevice;stage.dataset.previewMode=active.previewMode}
    clearTimeout(active.previewTimer);active.previewAbort?.abort();
    const signal=active.editorAbort?.signal;
    const refresh=async()=>{
      if(signal?.aborted||!form.isConnected)return;
      const controller=new AbortController();active.previewAbort=controller;
      const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
      const status=$('[data-preview-status]'),frame=$('[data-composer-preview-frame]');
      if(status)status.textContent='Updating preview…';
      try{
        const result=await api('/corner/api/admin/posts/preview','POST',{post:formValues(form),postId:active.post?.id||null,seriesChoice:form.elements.seriesChoice?.value||'__none__'},{signal:controller.signal});
        if(controller.signal.aborted||signal?.aborted||!form.isConnected)return;
        active.previewDocuments=result;
        if(frame){frame.srcdoc=active.previewMode==='full'?result.fullHtml:result.feedHtml;frame.hidden=false}
        if(card)card.hidden=true;
        if(status)status.textContent='Live preview · '+(active.previewMode==='full'?'full post':'feed card');
      }catch{
        if(controller.signal.aborted||signal?.aborted)return;
        if(frame)frame.hidden=true;if(card)card.hidden=false;
        if(status)status.textContent='Preview unavailable. Your writing is safe — retry when connected.';
      }finally{signal?.removeEventListener('abort',abort)}
    };
    active.previewTimer=setTimeout(refresh,immediate?0:420);
  }
  function previewHtml(){return `<aside class="composer-preview preview-panel" aria-label="Live post preview"><header class="composer-preview-header"><div><p class="eyebrow">AS YOUR READERS SEE IT</p><h2>Preview</h2></div><div class="preview-devices" role="group" aria-label="Preview device">${['desktop','mobile'].map(device=>'<button type="button" data-device="'+device+'" class="'+(active.previewDevice===device?'is-active':'')+'" aria-label="'+device+' preview" aria-pressed="'+(active.previewDevice===device)+'">'+composerIcon(device)+'<span>'+device[0].toUpperCase()+device.slice(1)+'</span></button>').join('')}</div></header><div class="composer-preview-tabs" role="group" aria-label="Preview presentation"><button type="button" data-preview-mode="feed" aria-pressed="${active.previewMode==='feed'}" class="${active.previewMode==='feed'?'is-active':''}">Feed card</button><button type="button" data-preview-mode="full" aria-pressed="${active.previewMode==='full'}" class="${active.previewMode==='full'?'is-active':''}">Full post</button></div><div class="preview-stage" data-device="${active.previewDevice}" data-preview-mode="${active.previewMode}"><iframe class="composer-preview-frame" data-composer-preview-frame title="Private Corner post preview" sandbox="allow-same-origin" referrerpolicy="no-referrer" hidden></iframe><article class="preview-card story story-tech_note"><div class="story-top"><span class="meta category preview-category">TECH NOTE</span><span class="status-tag preview-status">PREVIEW</span></div><div class="preview-media" data-editor-photo-preview hidden></div><div class="story-copy"><span class="preview-symbol" aria-hidden="true">✳</span><h3 class="preview-title">Your next story.</h3><p class="preview-excerpt">Your story will appear here.</p><div class="preview-story-body" hidden></div></div></article></div><p class="composer-preview-status" data-preview-status role="status">Preparing your preview…</p><p class="composer-preview-note">A private preview. Reactions and sharing stay inactive here.</p></aside>`}
  let recoveryStorage=null;try{recoveryStorage=window.sessionStorage}catch{ /* Server saves work when device storage is disabled. */ }
  const draftRecovery=composer?.recovery(initial.ownerId,recoveryStorage)||{read:()=>null,write:()=>false,remove:()=>{},clear:()=>{}};
  async function editor(id=null){
    active.commandToolsAbort?.abort();clearTimeout(active.saveTimer);clearTimeout(active.previewTimer);active.previewAbort?.abort();active.editorAbort?.abort();
    active.editorAbort=new AbortController();const controller=active.editorAbort;active.view='composer';active.post=null;active.dirty=false;active.attachments=[];active.mediaJobs=[];active.mediaBusy=false;active.previewDocuments=null;
    document.documentElement.dataset.studioView='composer';const studioTop=$('.admin-top');if(studioTop)studioTop.hidden=true;
    history.replaceState(null,'',id?'#post/'+encodeURIComponent(id):'#create');
    $$('[data-admin-view]').forEach(button=>{const selected=button.dataset.adminView==='posts';button.classList.toggle('is-active',selected);if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')});
    root.innerHTML='<div class="admin-loading" role="status">Opening your writing space…</div>';
    let record,seriesList,canManageSeries=true;
    try{[record,seriesList]=await Promise.all([id?api('/corner/api/admin/posts/'+encodeURIComponent(id)):Promise.resolve(null),api('/corner/api/admin/series').catch(error=>{if(error.status===403){canManageSeries=false;return []}throw error})])}
    catch(error){if(!controller.signal.aborted){root.innerHTML=empty('Could not open this post',error.message);toast(error.message,'error')}return}
    if(controller.signal.aborted)return;
    let p=record?.post||{state:'draft',type:'tech_note',allow_reactions:true,allow_comments:true,tags:[],timezone:initial.timezone||'Asia/Kolkata'};
    active.post=p;active.attachments=record?.media||[];active.mediaJobs=record?.mediaJobs||[];
    const recovered=draftRecovery.read(p.id||null);
    let clientRequestId=recovered?.clientRequestId||composer?.requestId()||crypto.randomUUID();
    root.innerHTML=`<section class="composer-workspace" data-composer-view="write"><header class="composer-header"><div><button id="back-posts" type="button" class="composer-back" aria-label="Back to posts">${composerIcon('arrow')}</button><div><p class="eyebrow">YOUR CORNER / STUDIO</p><h2>${id?'Edit post':'Create Post'}</h2></div></div><button type="button" class="composer-drafts" data-open-drafts>${composerIcon('drafts')}<span>Drafts</span></button></header><div class="composer-mobile-tabs" role="group" aria-label="Composer view"><button type="button" data-composer-view="write" aria-pressed="true" class="is-active">Write</button><button type="button" data-composer-view="preview" aria-pressed="false">Preview</button></div>${p.state==='scheduled'?'<p class="composer-scheduled-banner">'+composerIcon('calendar')+' Scheduled for '+esc(composer?.scheduledTime(p.scheduled_at,p.timezone)||p.scheduled_at)+'</p>':''}<div class="composer-grid"><form class="editor composer-editor" id="post-editor" novalidate>${postFields(p,seriesList)}</form>${previewHtml()}</div></section><dialog id="schedule-panel" class="corner-schedule-modal" aria-labelledby="corner-schedule-title"></dialog><dialog id="editor-media" class="corner-media-modal" aria-labelledby="media-editor-title" aria-describedby="media-editor-help"><p class="corner-media-loading" role="status">Loading your files…</p></dialog>`;
    const workspace=$('.composer-workspace'),form=$('#post-editor'),textarea=form.elements.body,indicator=$('#save-indicator'),retry=$('[data-save-retry]',form);
    form.addEventListener('submit',event=>event.preventDefault());
    const publishButton=$('#publish-post'),publishMotion=p.state!=='published'&&p.state!=='archived'?window.CornerPublishMotion?.mount(publishButton):null;
    let editorRevision=0,pendingSave=null,publishing=false,conflictHold=false,deviceSaved=false;
    let lastSource=JSON.stringify(composerSource(form)),publishFailureNotice=null;
    controller.signal.addEventListener('abort',()=>{clearTimeout(active.saveTimer);clearTimeout(active.previewTimer);active.previewAbort?.abort();publishMotion?.cancel()},{once:true});
    const setStatus=(message,kind='saved')=>{if(controller.signal.aborted)return;indicator.textContent=message;indicator.dataset.state=kind;retry.hidden=kind!=='error'&&kind!=='conflict'};
    const persistLocal=()=>{
      deviceSaved=draftRecovery.write(p.id||null,{postId:p.id||null,version:p.version||0,clientRequestId,source:composerSource(form)});
      return deviceSaved;
    };
    const syncActionAvailability=()=>{
      if(controller.signal.aborted||publishing)return;
      const blocked=active.mediaBusy||active.mediaJobs.some(job=>['queued','processing','failed'].includes(job.state));
      if(p.state!=='archived'){publishButton.disabled=blocked;$('#schedule-post').disabled=blocked}
      const mediaState=$('[data-composer-media-state]');
      if(mediaState){mediaState.hidden=!blocked;mediaState.textContent=active.mediaBusy?'Uploading media. You can keep writing.':active.mediaJobs.some(job=>job.state==='failed')?'A video needs attention. Retry or remove it before publishing.':'Preparing your video for playback. You can keep writing.'}
      $('#delete-draft').disabled=active.mediaBusy;
    };
    const menu=$('[data-v5-settings]'),toggle=$('[data-v5-settings-toggle]');
    const hideSettings=()=>{if(menu){menu.hidden=true;menu.removeAttribute('aria-modal');toggle.setAttribute('aria-expanded','false')}};
    toggle?.addEventListener('click',()=>{
      if(!menu.hidden){hideSettings();return}
      menu.hidden=false;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Post settings');
      if(matchMedia('(max-width:767px)').matches)menu.setAttribute('aria-modal','true');
      toggle.setAttribute('aria-expanded','true');menu.querySelector('button:not([disabled]),input:not([disabled]),select:not([disabled])')?.focus({preventScroll:true});
    });
    $('[data-settings-close]',menu)?.addEventListener('click',()=>{hideSettings();toggle.focus()});
    document.addEventListener('pointerdown',event=>{if(!menu?.hidden&&!menu.contains(event.target)&&!toggle.contains(event.target))hideSettings()},{signal:controller.signal});
    document.addEventListener('keydown',event=>{
      if(menu?.hidden)return;
      if(event.key==='Escape'){event.preventDefault();hideSettings();toggle.focus();return}
      if(event.key==='Tab'&&menu.getAttribute('aria-modal')==='true'){
        const focusable=[...menu.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]')].filter(node=>node.getClientRects().length);
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
      }
    },{signal:controller.signal});
    const seriesPanel=$('[data-journal-series]',form),seriesSelect=form.elements.seriesChoice,seriesContext=$('[data-series-context]',form);
    if(!canManageSeries){seriesSelect.disabled=true;if(p.series)form.elements.type.disabled=true}
    const syncSeriesPanel=()=>{
      const values=formValues(form),journal=values.type==='journal';if(seriesPanel)seriesPanel.hidden=!journal;
      if(!journal||!seriesSelect||!seriesContext)return;
      if(!canManageSeries&&!p.series){seriesContext.textContent='This is a standalone Journal. Series management is available to the owner.';return}
      if(p.series&&seriesSelect.value===p.series.slug){seriesContext.textContent=p.series.title+' · Chapter '+String(p.series.partNumber).padStart(2,'0');return}
      if(seriesSelect.value==='__none__')seriesContext.textContent='This Journal stands on its own.';
      else if(seriesSelect.value==='__new__')seriesContext.textContent='Saving starts a new series at Chapter 01.';
      else{const next=Number(seriesSelect.selectedOptions[0]?.dataset.next||0);seriesContext.textContent=next?'This will become Chapter '+String(next).padStart(2,'0')+' automatically.':'This series cannot accept another chapter.'}
    };
    const fitWriting=()=>{textarea.style.height='auto';textarea.style.height=Math.min(Math.max(240,textarea.scrollHeight),Math.max(440,window.innerHeight*.68))+'px'};
    const recordEdit=()=>{
      const source=JSON.stringify(composerSource(form));if(source===lastSource)return;
      lastSource=source;editorRevision++;active.dirty=true;persistLocal();
      setStatus(navigator.onLine===false?(deviceSaved?'Offline · saved in this tab':'Offline · unsaved changes'):'Unsaved edits',navigator.onLine===false?'offline':'unsaved');
      updatePreview(form);syncSeriesPanel();fitWriting();
      clearTimeout(active.saveTimer);
      if(p.state==='draft'&&!conflictHold&&navigator.onLine!==false&&(textarea.value.trim()||p.id))active.saveTimer=setTimeout(()=>save(true),1450);
    };
    form.addEventListener('input',recordEdit);form.addEventListener('change',recordEdit);
    const switchComposerView=view=>{
      workspace.dataset.composerView=view;
      $$('.composer-mobile-tabs [data-composer-view]').forEach(button=>{const selected=button.dataset.composerView===view;button.classList.toggle('is-active',selected);button.setAttribute('aria-pressed',String(selected))});
      if(view==='preview')updatePreview(form,{immediate:true});
    };
    $$('.composer-mobile-tabs [data-composer-view]').forEach(button=>button.onclick=()=>switchComposerView(button.dataset.composerView));
    $$('button[data-device]').forEach(button=>button.onclick=()=>{
      active.previewDevice=button.dataset.device;$$('button[data-device]').forEach(item=>{const selected=item.dataset.device===active.previewDevice;item.classList.toggle('is-active',selected);item.setAttribute('aria-pressed',String(selected))});
      $('.preview-stage').dataset.device=active.previewDevice;
    });
    $$('button[data-preview-mode]').forEach(button=>button.onclick=()=>{
      active.previewMode=button.dataset.previewMode;$$('button[data-preview-mode]').forEach(item=>{const selected=item.dataset.previewMode===active.previewMode;item.classList.toggle('is-active',selected);item.setAttribute('aria-pressed',String(selected))});
      $('.preview-stage').dataset.previewMode=active.previewMode;
      const frame=$('[data-composer-preview-frame]');if(active.previewDocuments&&frame)frame.srcdoc=active.previewMode==='full'?active.previewDocuments.fullHtml:active.previewDocuments.feedHtml;
      updatePreview(form,{immediate:true});
    });
    const emojiPanel=$('#composer-emoji'),emojiButton=$('[data-composer-emoji]');
    emojiButton?.addEventListener('click',()=>{emojiPanel.hidden=!emojiPanel.hidden;emojiButton.setAttribute('aria-expanded',String(!emojiPanel.hidden))});
    $$('[data-insert-emoji]',emojiPanel).forEach(button=>button.onclick=()=>{
      const start=textarea.selectionStart,end=textarea.selectionEnd;
      if(textarea.value.length-(end-start)+button.dataset.insertEmoji.length>textarea.maxLength){toast('This post has reached its writing limit.','error');return}
      textarea.setRangeText(button.dataset.insertEmoji,start,end,'end');emojiPanel.hidden=true;emojiButton.setAttribute('aria-expanded','false');textarea.focus({preventScroll:true});recordEdit();
    });
    const recoveryBanner=$('[data-draft-recovery]');
    if(recovered&&JSON.stringify(recovered.source)!==lastSource&&p.state!=='archived'){
      recoveryBanner.hidden=false;recoveryBanner.innerHTML='<div><strong>Unfinished writing found</strong><p>Saved in this tab on '+esc(new Date(recovered.savedAt).toLocaleString('en-IN'))+'. Review it before saving.</p></div><div><button type="button" data-recover-draft>Restore writing</button><button type="button" data-dismiss-recovery>Use saved post</button></div>';
      $('[data-recover-draft]',recoveryBanner).onclick=()=>{
        for(const [name,value] of Object.entries(recovered.source)){const field=form.elements[name];if(!field||field.disabled)continue;if(field.type==='checkbox')field.checked=value===true;else field.value=String(value??'')}
        if(p.series&&p.state==='published')form.elements.type.value='journal';
        conflictHold=!!(p.id&&Number(recovered.version)!==p.version);recordEdit();
        recoveryBanner.hidden=true;
        setStatus(conflictHold?'Recovered writing · review and save against the latest post':'Recovered writing · waiting to save','unsaved');textarea.focus();
      };
      $('[data-dismiss-recovery]',recoveryBanner).onclick=()=>{draftRecovery.remove(p.id||null);recoveryBanner.hidden=true};
    }else if(recovered)draftRecovery.remove(p.id||null);
    async function save(quiet=false,{allowEmpty=false,review=false}={}){
      if(pendingSave){const result=await pendingSave;if(controller.signal.aborted)return null;if(!result)return null;if(!active.dirty)return result}
      if(controller.signal.aborted||p.state==='archived')return null;
      if(conflictHold&&!review){if(!quiet)toast('Review your recovered writing and choose Save draft.','error');return null}
      if(!textarea.value.trim()&&!p.id&&!allowEmpty&&!form.elements.titleOverride.value.trim()){if(!quiet)toast('Write something or attach media first.','error');return null}
      if(p.id&&!active.dirty)return p;
      clearTimeout(active.saveTimer);setStatus('Saving…','saving');
      const values=formValues(form),savedRevision=editorRevision,snapshot=composerSource(form),previousId=p.id||null;
      persistLocal();
      pendingSave=(async()=>{try{
        let stored=p.id?await api('/corner/api/admin/posts/'+p.id,'PATCH',{...values,version:p.version}):await api('/corner/api/admin/posts','POST',{...values,clientRequestId});
        // If a previous create response was lost, keep the same post and flush the
        // latest source rather than treating the older request as a fresh save.
        if(stored.clientRequestReplayed){
          if(stored.state!=='draft')throw Object.assign(Error('This recovered draft has already changed state. Open the saved post before editing.'),{status:409});
          stored=await api('/corner/api/admin/posts/'+stored.id,'PATCH',{...values,version:stored.version});
        }
        const previousSeries=p.series||null,choice=String(snapshot.seriesChoice||'__none__');
        try{
          if(values.type==='journal'&&choice!=='__none__'){
            const sameSeries=previousSeries&&choice===previousSeries.slug;
            stored.series=sameSeries?previousSeries:await api('/corner/api/admin/posts/'+stored.id+'/series','PUT',choice==='__new__'?{mode:'new',allowMove:!!previousSeries}:{mode:'existing',slug:choice,allowMove:!!previousSeries});
          }else if(previousSeries)stored.series=await api('/corner/api/admin/posts/'+stored.id+'/series','PUT',{mode:'unlink'});
          else stored.series=null;
        }catch(error){p={...stored,series:previousSeries};if(!controller.signal.aborted){active.post=p;active.dirty=true}throw Object.assign(new Error('Post saved, but Journal series setup needs attention: '+error.message),{status:error.status,code:error.code})}
        p=stored;
        const latestBuffer=draftRecovery.read(previousId);
        if(latestBuffer&&JSON.stringify(latestBuffer.source)===JSON.stringify(snapshot))draftRecovery.remove(previousId);
        else if(!previousId&&latestBuffer){draftRecovery.write(p.id,{...latestBuffer,postId:p.id,version:p.version});draftRecovery.remove(null)}
        if(controller.signal.aborted)return p;
        active.post=p;active.dirty=editorRevision!==savedRevision;conflictHold=false;
        if(p.series&&seriesSelect&&seriesSelect.value===choice){
          let option=[...seriesSelect.options].find(item=>item.value===p.series.slug);
          if(!option){option=new Option(p.series.title,p.series.slug);option.dataset.next=String(Number(p.series.partNumber||0)+1);seriesSelect.add(option)}
          seriesSelect.value=p.series.slug;
        }
        lastSource=JSON.stringify(composerSource(form));syncSeriesPanel();
        if(active.dirty)persistLocal();else{draftRecovery.remove(p.id);draftRecovery.remove(null)}
        $('[data-composer-state]',form).innerHTML=tag(p.state);
        $('#delete-draft').hidden=p.state!=='draft';
        history.replaceState(null,'','#post/'+encodeURIComponent(p.id));
        setStatus(active.dirty?'Earlier edits saved · newer edits unsaved':'Saved · '+new Date(p.updated_at||Date.now()).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'}),active.dirty?'unsaved':'saved');
        if(active.dirty&&p.state==='draft'){clearTimeout(active.saveTimer);active.saveTimer=setTimeout(()=>save(true),1450)}
        if(!quiet)toast(p.state==='draft'?'Draft saved.':'Changes saved.','success');
        updatePreview(form);return p;
      }catch(error){
        if(!controller.signal.aborted){
          active.dirty=true;persistLocal();conflictHold=error.status===409;
          setStatus(conflictHold?'A newer version was saved. Your writing is kept in this tab.':deviceSaved?'Couldn’t save online · kept in this tab':'Couldn’t save · retry',conflictHold?'conflict':'error');
          retry.textContent=conflictHold?'Review saved version':'Retry save';
          if(!quiet)toast(error.message,'error');
        }
        return null;
      }finally{pendingSave=null}})();
      return pendingSave;
    }
    async function saveLatest(options={}){
      if(pendingSave){const pending=await pendingSave;if(!pending)return null}
      if(controller.signal.aborted)return null;
      return save(true,{...options,review:true});
    }
    retry.onclick=()=>{if(conflictHold){persistLocal();void editor(p.id||null)}else void save(false,{review:true})};
    $('#save-post').onclick=async()=>{
      const button=$('#save-post');
      await actionMotion({action:'draft.save',trigger:button,targetId:p.id||'new-draft',signal:controller.signal,
        execute:()=>saveLatest(),confirm:stored=>!!stored&&!active.dirty,
        onSuccess:()=>toast(p.state==='draft'?'Draft saved.':'Changes saved.','success'),
        onFailure:error=>toast(active.dirty?'Your latest writing is still here. Retry saving when connected.':error.message,'error')});
    };
    const lockedControls=new Map();
    const lockWhilePublishing=()=>{for(const control of form.querySelectorAll('button,input,textarea,select')){if(control===publishButton)continue;lockedControls.set(control,control.disabled);control.disabled=true}};
    const unlockAfterPublishing=()=>{for(const [control,disabled] of lockedControls){if(control.isConnected)control.disabled=disabled}lockedControls.clear()};
    publishButton.onclick=async()=>{
      if(active.mediaBusy||active.mediaJobs.some(job=>['queued','processing','failed'].includes(job.state))){toast('Finish or remove the pending media before publishing.','error');return}
      if(publishing||publishMotion?.start()===false)return;
      publishFailureNotice?.dismiss?.();publishFailureNotice=null;
      const reviewEmail=!!form.elements.reviewEmail?.checked,updating=p.state==='published';
      publishing=true;lockWhilePublishing();if(!publishMotion){publishButton.disabled=true;publishButton.textContent='Updating…'}
      try{
        const saved=await saveLatest({allowEmpty:active.attachments.length>0});
        if(controller.signal.aborted)return;
        if(!saved||active.dirty)throw Error('Could not save the latest writing. Review your changes and retry.');
        const published=await api('/corner/api/admin/posts/'+saved.id+'/publish','POST');
        if(controller.signal.aborted)return;
        if(published?.state!=='published')throw Error('Publication was not confirmed. Please review this post.');
        p=published;active.post=p;active.dirty=false;draftRecovery.remove(p.id);draftRecovery.remove(null);
        await publishMotion?.success();
        if(controller.signal.aborted)return;
        toast(updating?'Your changes are live.':'Published. Your story is live.','success');
        publishButton.disabled=true;
        controller.abort();
        root.innerHTML='<section class="composer-success"><span class="composer-success-icon">'+composerIcon('check')+'</span><p class="eyebrow">YOUR CORNER</p><h2>'+(updating?'Post updated.':'A little more of you, out in the world.')+'</h2><p>'+esc(p.title)+'</p><div class="composer-success-actions"><a class="admin-primary" href="/corner/post/'+encodeURIComponent(p.slug)+'">View post ↗</a><button type="button" class="admin-secondary" data-compose-another>Create another post</button><button type="button" class="admin-secondary" data-return-posts>All posts</button></div>'+(initial.ownerRole==='owner'?'<div class="composer-success-email"><strong>'+(reviewEmail?'Your subscriber email is ready to review.':'Share it with your subscribers.')+'</strong><p>Check the category template and opted-in audience before queuing delivery.</p><a href="/corner/admin/communications?post='+encodeURIComponent(p.id)+'">Preview subscriber email ↗</a></div>':'')+'</section>';
        $('[data-compose-another]').onclick=()=>editor();$('[data-return-posts]').onclick=()=>showView('posts');
        if(reviewEmail)location.assign('/corner/admin/communications?post='+encodeURIComponent(p.id));
      }catch(error){
        if(!controller.signal.aborted){publishMotion?.failure(error.message);publishFailureNotice=toast(error.message,'error');if(!publishMotion){publishButton.disabled=false;publishButton.textContent=updating?'Update post':'Publish'}}
      }finally{publishing=false;unlockAfterPublishing();syncActionAvailability()}
    };
    $('#schedule-post').onclick=()=>{
      if(active.mediaBusy||active.mediaJobs.some(job=>['queued','processing','failed'].includes(job.state)))return;
      const panel=$('#schedule-panel');if(!panel)return;
      const currentType=formValues(form).type,tz=p.timezone||initial.timezone||'Asia/Kolkata';
      const start=composer?.localInput(p.scheduled_at||Date.now()+3600000,tz)||'';
      const repeat=currentType==='wish'?'<label class="corner-schedule-repeat">Repeat<select name="recurrence"><option value="none">Only this time</option><option value="yearly" '+(p.recurrence==='yearly'?'selected':'')+'>Every year</option></select></label>':'<input type="hidden" name="recurrence" value="none">';
      const localWindow=name=>esc(composer?.localInput(p[name],tz)||'');
      panel.innerHTML='<div class="corner-schedule-inner"><header><div><p class="eyebrow">PUBLISH WHEN IT MATTERS</p><h2 id="corner-schedule-title">Schedule publication</h2><p>Your post will publish even when this browser is closed.</p></div><button type="button" data-schedule-cancel aria-label="Close scheduling dialog">×</button></header><form id="schedule-form" class="corner-schedule-form"><label>Publish on<input type="datetime-local" name="localTime" step="60" required value="'+esc(start)+'" min="'+esc(composer?.localInput(Date.now()+60000,tz)||'')+'"></label><p class="corner-schedule-timezone">Time zone: '+esc(tz)+'</p><input name="timezone" type="hidden" value="'+esc(tz)+'">'+repeat+'<p class="composer-schedule-summary" data-schedule-summary></p><details><summary>Advanced timing (optional)</summary><div class="corner-schedule-advanced"><label>Stop annual repeats after year<input type="number" name="recurrenceEndYear" min="'+new Date().getFullYear()+'" max="2200" value="'+esc(p.recurrence_end_year||'')+'" placeholder="Keep repeating"></label><label>Feature from<input type="datetime-local" name="featureStartLocal" value="'+localWindow('feature_start_at')+'"></label><label>Feature until<input type="datetime-local" name="featureEndLocal" value="'+localWindow('feature_end_at')+'"></label><label>Pin from<input type="datetime-local" name="pinStartLocal" value="'+localWindow('pin_start_at')+'"></label><label>Pin until<input type="datetime-local" name="pinEndLocal" value="'+localWindow('pin_end_at')+'"></label></div></details><p class="corner-schedule-message" role="status" aria-live="polite"></p><div class="corner-schedule-actions"><button type="button" class="corner-schedule-secondary" data-schedule-cancel>Cancel</button><button type="submit">Confirm schedule ↗</button></div></form></div>';
      const scheduleForm=$('#schedule-form',panel),summary=$('[data-schedule-summary]',panel);
      const refreshTime=()=>{summary.textContent='Publish on '+(composer?.selectedTime(scheduleForm.elements.localTime.value,tz)||scheduleForm.elements.localTime.value)};
      scheduleForm.elements.localTime.addEventListener('input',refreshTime);refreshTime();
      panel.querySelectorAll('[data-schedule-cancel]').forEach(button=>button.addEventListener('click',()=>panel.close()));
      let scheduling=false;
      scheduleForm.onsubmit=async event=>{
        event.preventDefault();if(scheduling||!scheduleForm.reportValidity())return;
        scheduling=true;const formSchedule=event.currentTarget,button=formSchedule.querySelector('[type=submit]'),feedback=formSchedule.querySelector('[role=status]');
        feedback.textContent='Saving the schedule…';
        await actionMotion({action:'post.schedule',trigger:button,targetId:p.id||'new-schedule',signal:controller.signal,
          execute:async()=>{
            const saved=await saveLatest({allowEmpty:active.attachments.length>0});
            if(!saved||active.dirty)throw Error('Save the latest story edits before scheduling.');
            return api('/corner/api/admin/posts/'+saved.id+'/schedule','POST',{
              version:saved.version,localTime:formSchedule.elements.localTime.value,timezone:formSchedule.elements.timezone.value,
              recurrence:formSchedule.elements.recurrence.value,recurrenceEndYear:formSchedule.elements.recurrenceEndYear.value,
              featureStartLocal:formSchedule.elements.featureStartLocal.value,featureEndLocal:formSchedule.elements.featureEndLocal.value,
              pinStartLocal:formSchedule.elements.pinStartLocal.value,pinEndLocal:formSchedule.elements.pinEndLocal.value
            });
          },confirm:result=>!!result?.id&&result.state==='scheduled',
          onSuccess:scheduled=>{p=scheduled;active.post=p;draftRecovery.remove(p.id);feedback.textContent='Scheduled for '+formSchedule.elements.localTime.value;if(!controller.signal.aborted){panel.close();toast('Scheduled for '+(composer?.scheduledTime(p.scheduled_at,p.timezone)||p.scheduled_at),'success');void editor(p.id)}},
          onFailure:error=>{feedback.textContent=error.message||'Scheduling failed. Please try again.'}
        });scheduling=false;
      };
      panel.showModal();scheduleForm.elements.localTime.focus();
    };
    $('#cancel-schedule')?.addEventListener('click',async event=>{
      await actionMotion({action:'draft.save',trigger:event.currentTarget,targetId:p.id,signal:controller.signal,
        execute:async()=>{const saved=await saveLatest();if(!saved||active.dirty)throw Error('Save the latest edits before changing the schedule.');return api('/corner/api/admin/posts/'+p.id+'/unschedule','POST',{version:saved.version})},
        confirm:result=>result?.state==='draft',onSuccess:result=>{toast('Schedule cancelled. Your post is saved as a draft.','success');void editor(result.id)},onFailure:error=>toast(error.message,'error')});
    });
    $('#delete-draft')?.addEventListener('click',async event=>{
      if(!p.id||p.state!=='draft'||!confirm('Move this draft to Archived? You can restore it later.'))return;
      await actionMotion({action:'post.delete',trigger:event.currentTarget,targetId:p.id,signal:controller.signal,execute:()=>api('/corner/api/admin/posts/'+p.id,'DELETE'),onSuccess:()=>{draftRecovery.remove(p.id);draftRecovery.remove(null);toast('Draft moved to Archived.','success');showView('posts')},onFailure:error=>toast(error.message,'error')});
    });
    $('#archive-post')?.addEventListener('click',async event=>{
      if(!confirm('Archive this story? It will no longer be public.'))return;
      await actionMotion({action:'post.archive',trigger:event.currentTarget,targetId:p.id,signal:controller.signal,execute:()=>api('/corner/api/admin/posts/'+p.id+'/archive','POST'),onSuccess:()=>{draftRecovery.remove(p.id);toast('Post archived.','success');showView('posts')},onFailure:error=>toast(error.message,'error')});
    });
    $('#restore-post')?.addEventListener('click',async event=>{
      await actionMotion({action:'post.restore',trigger:event.currentTarget,targetId:p.id,signal:controller.signal,execute:()=>api('/corner/api/admin/posts/'+p.id+'/restore','POST'),onSuccess:()=>{toast('Post restored.','success');void editor(p.id)},onFailure:error=>toast(error.message,'error')});
    });
    const leave=filter=>{if(active.mediaBusy&&!confirm('An upload is running. Leave this post?'))return;if(active.dirty&&!deviceSaved&&!confirm('Leave with unsaved writing?'))return;persistLocal();active.filter=filter;showView('posts')};
    $('#back-posts').onclick=()=>leave('all');$('[data-open-drafts]').onclick=()=>leave('draft');
    const mediaPanel=$('#editor-media');
    const mediaContext={signal:controller.signal,current:()=>!controller.signal.aborted&&form.isConnected,updated:(items,jobs)=>{if(controller.signal.aborted)return;active.attachments=items;active.mediaJobs=jobs;showEditorCover(items);updatePreview(form);syncActionAvailability()},busy:value=>{if(controller.signal.aborted)return;active.mediaBusy=value;syncActionAvailability()},save:()=>saveLatest({allowEmpty:true})};
    const mediaReady=mediaForPost(p.id||null,()=>saveLatest({allowEmpty:true}),mediaContext).catch(error=>{if(controller.signal.aborted)return;mediaPanel.dataset.mediaInitError=error.message||String(error);toast(error.message,'error')});
    const openMedia=async files=>{
      if(controller.signal.aborted||p.state==='archived')return;
      if(!mediaPanel.open)mediaPanel.showModal();await mediaReady;if(controller.signal.aborted)return;
      const input=$('#editor-upload input[type=file]',mediaPanel);
      if(files?.length&&input){const transfer=new DataTransfer();for(const file of files)transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))}
    };
    $('#open-media-panel').onclick=()=>openMedia();
    const dropzone=$('[data-composer-dropzone]');
    dropzone.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';dropzone.classList.add('is-dragging')});
    dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('is-dragging'));
    dropzone.addEventListener('drop',event=>{event.preventDefault();dropzone.classList.remove('is-dragging');void openMedia([...(event.dataTransfer?.files||[])])});
    mediaPanel.addEventListener('click',event=>{if(event.target===mediaPanel)mediaPanel.close()});
    form.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void saveLatest()}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='p'){event.preventDefault();switchComposerView('preview');$('.composer-preview')?.scrollIntoView({behavior:'smooth',block:'nearest'})}});
    window.addEventListener('offline',()=>{if(active.dirty){persistLocal();setStatus(deviceSaved?'Offline · saved in this tab':'Offline · unsaved changes','offline')}},{signal:controller.signal});
    window.addEventListener('online',()=>{if(active.dirty&&p.state==='draft'&&!conflictHold)void save(true);updatePreview(form,{immediate:true})},{signal:controller.signal});
    if(p.state==='archived'){form.querySelectorAll('input,textarea,select,[data-composer-emoji]').forEach(control=>control.disabled=true)}
    updatePreview(form,{immediate:true});syncSeriesPanel();syncActionAvailability();fitWriting();window.CornerMotion?.refresh();
  }
  const uploadLimit=8;
  const supportedMedia=new Set(['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/webm']);
  const fileMime=file=>{
    if(supportedMedia.has(file.type))return file.type;
    if(file.type&&file.type!=='application/octet-stream'&&!/heic|heif|quicktime/i.test(file.type))return '';
    return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',heic:'image/heic',heif:'image/heif',mp4:'video/mp4',m4v:'video/mp4',mov:'video/quicktime',webm:'video/webm'})[String(file.name||'').split('.').pop().toLowerCase()]||'';
  };
  function showEditorCover(items){
    const host=$('[data-editor-photo-preview]');if(!host)return;
    const cover=items[0];host.replaceChildren();host.hidden=!cover;if(!cover)return;
    const isVideo=cover.mime_type?.startsWith('video/'),element=document.createElement(isVideo?'video':'img');
    element.src='/corner/media/'+encodeURIComponent(cover.storage_key);
    if(isVideo){element.controls=true;element.playsInline=true;element.preload='metadata';element.muted=true;if(cover.has_poster)element.poster=element.src+'?poster=1'}
    else{element.alt=cover.alt_text||'Story cover photograph';element.loading='lazy';element.style.objectPosition=(Number(cover.focal_x??.5)*100)+'% '+(Number(cover.focal_y??.5)*100)+'%'}
    host.append(element);
  }
  async function mediaForPost(postId,ensureDraft,context={}){
    const section=$('#editor-media');if(!section)return;
    const current=()=>context.current?context.current():section.isConnected;
    const result=postId?await api('/corner/api/admin/posts/'+encodeURIComponent(postId)):null;if(!current())return;
    let attachments=result?.media||[],jobs=result?.mediaJobs||[],pending=[],uploadInFlight=false,jobTimer=null,selectedSignature='';
    const cleanup=()=>{for(const entry of pending)if(entry.url){URL.revokeObjectURL(entry.url);entry.url=null}};
    context.signal?.addEventListener('abort',()=>{clearTimeout(jobTimer);cleanup()},{once:true});
    section.innerHTML='<div class="corner-media-shell"><header class="corner-media-header"><div class="corner-media-heading"><p class="eyebrow">STORY / MEDIA</p><h2 id="media-editor-title">Photos & videos<span>.</span></h2><p id="media-editor-help">Attach, arrange, and make each frame yours.</p></div><button type="button" class="corner-media-close" data-media-dismiss aria-label="Close media dialog">×</button></header><section class="post-media-editor" aria-label="Current attachments and new uploads"><div class="post-media-head"><h3>Story attachments</h3><small class="corner-media-total" data-attached-count></small></div><div data-attached-gallery></div><div class="composer-media-jobs" data-modal-media-jobs hidden></div><form id="editor-upload" class="upload-field" aria-label="Upload photographs or a video"><label>Select up to '+uploadLimit+' files per batch<input type="file" name="files" multiple accept="image/*,video/mp4,video/quicktime,video/webm,.heic,.heif,.mov" required></label><div class="upload-preview-list" data-upload-previews aria-live="polite"></div><p class="admin-hint">JPG, PNG, HEIC, WebP or GIF up to 12 MB; MP4, MOV/HEVC or WebM up to 75 MB. Clips are optimized before playback.</p><p data-upload-status role="status" aria-live="polite"></p><button type="submit" class="admin-secondary" disabled>Attach selected media ↑</button></form></section><footer class="corner-media-footer"><span>Draft media stays private until you publish.</span><button type="button" class="corner-media-done" data-media-dismiss>Done ↗</button></footer></div>';
    section.querySelectorAll('[data-media-dismiss]').forEach(button=>button.addEventListener('click',()=>section.close()));
    const form=$('#editor-upload',section),fileInput=form.elements.files,previewList=$('[data-upload-previews]',form),status=$('[data-upload-status]',form),submit=form.querySelector('button[type=submit]');
    const queuePoll=()=>{clearTimeout(jobTimer);if(current()&&jobs.some(job=>['queued','processing'].includes(job.state)))jobTimer=setTimeout(()=>refreshRemote().catch(()=>queuePoll()),2600)};
    async function refreshRemote(){
      if(!postId||!current())return;
      const record=await api('/corner/api/admin/posts/'+encodeURIComponent(postId));if(!current())return;
      attachments=record.media||[];jobs=record.mediaJobs||[];
      for(const entry of pending){const job=jobs.find(item=>item.jobId===entry.jobId);if(job?.state==='ready'){entry.done=true;entry.state.textContent='Attached'}else if(job?.state==='failed'){entry.failed=true;entry.state.textContent='Needs attention'}}
      if(!uploadInFlight)submit.disabled=!pending.some(item=>!item.done);
      renderAttachments();renderJobs();queuePoll();
    }
    const editAttached=async id=>{
      if(uploadInFlight)return;
      const saved=await (context.save?.()||ensureDraft?.());if(!current()||!saved?.id)return;
      section.close();active.editorAbort?.abort();mediaEdit(id,attachments,saved.id);
    };
    const removeAttached=async(id,button)=>{
      if(uploadInFlight||!attachments.find(media=>media.id===id)||!confirm('Remove this image or video from the story?'))return;
      await actionMotion({action:'media.delete',trigger:button,targetId:id,visualTarget:button.closest('.media-thumb,.composer-attachment'),
        execute:()=>api('/corner/api/admin/media/'+encodeURIComponent(id),'DELETE'),
        onSuccess:async()=>{toast('Media removed.','success');await refreshRemote()},onFailure:error=>toast(error.message,'error')});
    };
    const moveAttached=async(id,direction,button)=>{
      if(uploadInFlight)return;
      const index=attachments.findIndex(item=>item.id===id),next=index+direction;if(index<0||next<0||next>=attachments.length)return;
      const ids=attachments.map(item=>item.id);[ids[index],ids[next]]=[ids[next],ids[index]];
      await actionMotion({action:'media.order',trigger:button,targetId:postId,visualTarget:button.closest('.media-thumb,.composer-attachment'),
        execute:()=>api('/corner/api/admin/posts/'+encodeURIComponent(postId)+'/media-order','POST',{ids}),
        onSuccess:async()=>{toast('Media order updated.','success');await refreshRemote()},onFailure:error=>toast(error.message,'error')});
    };
    const bindAttachmentActions=host=>{
      $$('[data-media-edit]',host).forEach(button=>button.onclick=()=>editAttached(button.dataset.mediaEdit));
      $$('[data-media-delete]',host).forEach(button=>button.onclick=()=>removeAttached(button.dataset.mediaDelete,button));
      $$('[data-media-move]',host).forEach(button=>button.onclick=()=>moveAttached(button.dataset.mediaMove,Number(button.dataset.direction)||0,button));
      if(uploadInFlight)$$('[data-media-edit],[data-media-delete],[data-media-move]',host).forEach(button=>button.disabled=true);
    };
    function renderAttachments(){
      if(!current())return;
      const badge=$('#media-count');if(badge){badge.textContent=String(attachments.length);badge.hidden=!attachments.length}
      $('[data-attached-count]',section).textContent=attachments.length+' '+(attachments.length===1?'file':'files');
      const gallery=$('[data-attached-gallery]',section);
      gallery.innerHTML=attachments.length?'<div class="media-gallery">'+attachments.map((item,index)=>mediaCard(item,true,index,attachments.length)).join('')+'</div>':'<p class="corner-media-empty">No files attached yet. Select a photo or video below.</p>';
      bindAttachmentActions(gallery);
      const inline=$('[data-composer-attachments]');
      if(inline){inline.hidden=!attachments.length;inline.innerHTML=attachments.map((item,index)=>{
        const src='/corner/media/'+encodeURIComponent(item.storage_key),video=item.mime_type.startsWith('video/');
        return '<article class="composer-attachment"><div class="composer-attachment-media">'+(video?'<video src="'+src+'"'+mediaPoster(item)+' preload="metadata" playsinline muted></video><span class="composer-video-label">Video</span>':'<img src="'+src+'" alt="'+esc(item.alt_text||'Attached photograph')+'" loading="lazy">')+'<span class="composer-attachment-position">'+(index===0?'Cover':String(index+1))+'</span></div><div class="composer-attachment-actions"><button type="button" data-media-edit="'+esc(item.id)+'">Edit</button><button type="button" data-media-move="'+esc(item.id)+'" data-direction="-1" aria-label="Move media earlier" '+(index===0?'disabled':'')+'>←</button><button type="button" data-media-move="'+esc(item.id)+'" data-direction="1" aria-label="Move media later" '+(index===attachments.length-1?'disabled':'')+'>→</button><button type="button" data-media-delete="'+esc(item.id)+'" aria-label="Remove attached media">×</button></div></article>';
      }).join('');bindAttachmentActions(inline)}
      $('[data-composer-dropzone]')?.classList.toggle('has-media',attachments.length>0);
      if(context.updated)context.updated(attachments,jobs);else showEditorCover(attachments);
    }
    function renderJobs(){
      if(!current())return;
      const outstanding=jobs.filter(job=>job.state!=='ready');
      for(const host of [$('[data-modal-media-jobs]',section),$('[data-composer-media-jobs]')].filter(Boolean)){
        host.hidden=!outstanding.length;
        host.innerHTML=outstanding.map(job=>'<article class="composer-media-job" data-state="'+esc(job.state)+'"><div><strong>'+(job.state==='failed'?'Video needs attention':'Preparing video')+'</strong><p>'+(job.state==='failed'?(job.errorCode==='PROCESSOR_NOT_INSTALLED'?'The video processor is unavailable. Retry later or remove this upload.':'Processing did not finish. Retry using the saved source or remove this upload.'):'Your video is saved and being prepared for playback.')+'</p></div>'+(job.state==='failed'?'<div><button type="button" data-media-job-retry="'+esc(job.jobId)+'">Retry</button><button type="button" data-media-job-discard="'+esc(job.jobId)+'">Remove</button></div>':'<span role="status">'+esc(job.state==='queued'?'Queued':'Processing…')+'</span>')+'</article>').join('');
        $$('[data-media-job-retry]',host).forEach(button=>button.onclick=async()=>{
          button.disabled=true;try{await api('/corner/api/admin/media/jobs/'+encodeURIComponent(button.dataset.mediaJobRetry)+'/retry','POST',{postId});for(const entry of pending)if(entry.jobId===button.dataset.mediaJobRetry)entry.failed=false;await refreshRemote();toast('Video processing restarted.','success')}catch(error){button.disabled=false;toast(error.message,'error')}
        });
        $$('[data-media-job-discard]',host).forEach(button=>button.onclick=async()=>{
          if(!confirm('Remove this failed processing job? Any previously ready video will remain.'))return;
          button.disabled=true;try{await api('/corner/api/admin/media/jobs/'+encodeURIComponent(button.dataset.mediaJobDiscard)+'?postId='+encodeURIComponent(postId),'DELETE');pending=pending.filter(entry=>{if(entry.jobId!==button.dataset.mediaJobDiscard)return true;if(entry.url)URL.revokeObjectURL(entry.url);entry.wrapper.remove();return false});await refreshRemote();toast('Failed job removed.','success')}catch(error){button.disabled=false;toast(error.message,'error')}
        });
        if(uploadInFlight)$$('button',host).forEach(button=>button.disabled=true);
      }
      if(context.updated)context.updated(attachments,jobs);
    }
    const clearSelections=()=>{cleanup();pending=[];fileInput.value='';previewList.replaceChildren();selectedSignature='';status.textContent='';submit.disabled=true};
    section.onclose=()=>{cleanup();if(!uploadInFlight)clearSelections()};
    const previewEntry=entry=>{
      const wrapper=document.createElement('div');wrapper.className='upload-preview-card';entry.wrapper=wrapper;
      const figure=document.createElement('figure'),remove=document.createElement('button');remove.type='button';remove.className='upload-preview-remove';remove.setAttribute('aria-label','Remove '+entry.file.name+' from selected uploads');remove.textContent='×';
      remove.onclick=()=>{if(uploadInFlight)return;if(entry.url)URL.revokeObjectURL(entry.url);pending=pending.filter(item=>item!==entry);wrapper.remove();status.textContent=pending.length?pending.length+' selected. Ready to attach.':'No files selected.';submit.disabled=!pending.some(item=>!item.done);submit.textContent='Attach selected media ↑'};figure.append(remove);
      const image=entry.file.type.startsWith('image/'),picture=document.createElement(image?'img':'video');entry.url=URL.createObjectURL(entry.file);picture.src=entry.url;
      if(image)picture.alt='Local upload preview: '+entry.file.name;else{picture.controls=true;picture.playsInline=true;picture.preload='metadata'}
      const fallback=document.createElement('span');fallback.className='composer-media-fallback';fallback.hidden=true;fallback.textContent=image?'Photo preview is available after upload.':'Video preview is available after processing.';
      picture.addEventListener('error',()=>{picture.hidden=true;fallback.hidden=false},{once:true});figure.append(picture,fallback);
      const filename=document.createElement('small');filename.textContent=entry.file.name;figure.append(filename);
      const fields=document.createElement('div');
      if(entry.file.type.startsWith('video/')&&entry.file.type!=='video/webm'){
        const trim=document.createElement('div');trim.className='v5-video-trim';trim.innerHTML='<label>Trim from (seconds)<input type="number" name="start" min="0" max="179" step="0.5" value="0"></label><label>Trim until (seconds, optional)<input type="number" name="end" min="0" max="180" step="0.5" placeholder="End of clip"></label>';fields.append(trim);entry.start=trim.querySelector('[name=start]');entry.end=trim.querySelector('[name=end]');
      }
      if(['image/jpeg','image/png','image/webp'].includes(entry.file.type)){
        const crop=document.createElement('button');crop.type='button';crop.dataset.cropUpload='';crop.className='corner-crop-trigger';crop.textContent='Crop / reframe ↗';
        crop.onclick=async()=>{
          if(!window.CornerImageCrop||uploadInFlight)return;crop.disabled=true;
          try{const adjusted=await window.CornerImageCrop.open(entry.file);if(adjusted){if(entry.url)URL.revokeObjectURL(entry.url);entry.file=adjusted;entry.url=URL.createObjectURL(adjusted);picture.src=entry.url;picture.hidden=false;fallback.hidden=true;filename.textContent=adjusted.name;status.textContent='Crop applied. Ready to attach.'}}
          catch(error){status.textContent=error.message||'Could not crop this image.'}finally{crop.disabled=false}
        };fields.append(crop);
      }
      const state=document.createElement('span');state.className='upload-preview-status';state.textContent='Selected';entry.state=state;fields.append(state);wrapper.append(figure,fields);previewList.append(wrapper);
    };
    const selectedFiles=()=>{
      if(uploadInFlight)return;
      const raw=[...fileInput.files],signature=raw.map(file=>file.name+':'+file.size+':'+file.lastModified).join('|');if(signature===selectedSignature&&previewList.children.length)return;
      selectedSignature=signature;cleanup();pending=[];previewList.replaceChildren();
      if(raw.length>uploadLimit){status.textContent='Choose no more than '+uploadLimit+' files at once.';submit.disabled=true;return}
      if(raw.some(file=>!fileMime(file))){status.textContent='Unsupported file type. Use JPG, PNG, HEIC, WebP, GIF, MP4, MOV or WebM.';submit.disabled=true;return}
      const files=raw.map(file=>fileMime(file)===file.type?file:new File([file],file.name,{type:fileMime(file),lastModified:file.lastModified}));
      const invalid=files.find(file=>!file.size||file.size>(file.type.startsWith('image/')?12:75)*1024*1024);
      if(invalid){status.textContent='File is empty or too large: '+invalid.name;submit.disabled=true;return}
      status.textContent=files.length?files.length+' selected. Ready to attach.':'';
      for(const file of files){const entry={file,done:false,url:null,jobId:null};pending.push(entry);previewEntry(entry)}
      submit.disabled=!pending.length;submit.textContent=pending.length===1?'Attach media ↑':'Attach '+pending.length+' files ↑';
      previewList.querySelector('[data-crop-upload]')?.setAttribute('aria-label','Crop the selected photo before uploading');
    };
    fileInput.oninput=selectedFiles;fileInput.onchange=selectedFiles;form.dataset.mediaReady='true';
    form.onsubmit=async event=>{
      event.preventDefault();if(uploadInFlight||!pending.some(item=>!item.done))return;
      uploadInFlight=true;section.dataset.uploadBusy='true';context.busy?.(true);renderAttachments();renderJobs();
      const controls=[...form.querySelectorAll('input,button')].map(control=>[control,control.disabled]);for(const [control] of controls)if(control!==submit)control.disabled=true;
      const total=pending.filter(item=>!item.done).length;
      await actionMotion({action:'media.upload',trigger:submit,targetId:postId||'new-upload-batch',visualTarget:previewList,
        execute:async({progress})=>{
          if(!postId){const saved=await ensureDraft?.();if(!saved?.id)throw Error('Could not save the draft. Your selected files are still here.');postId=saved.id}
          let sent=0;
          for(const entry of pending.filter(item=>!item.done)){
            if(!current())throw Error('Your video continues processing in the saved draft.');
            let stored;
            if(entry.jobId){
              if(entry.failed){await api('/corner/api/admin/media/jobs/'+encodeURIComponent(entry.jobId)+'/retry','POST',{postId});entry.failed=false}
              stored={jobId:entry.jobId};
            }else{
              const message='Uploading '+(sent+1)+' of '+total+' · '+entry.file.name;status.textContent=message;progress(message);entry.state.textContent='Uploading…';
              stored=await upload(entry.file,postId,{start:entry.start?.value||0,end:entry.end?.value||0});entry.jobId=stored?.jobId||null;
              if(!entry.jobId){entry.done=true;entry.state.textContent='Attached';sent++;await refreshRemote();continue}
            }
            if(stored?.jobId){
              await refreshRemote();let complete=false;
              for(let poll=0;poll<110;poll++){
                if(!current())throw Error('Video is still being processed in your saved draft.');
                const job=await api('/corner/api/admin/media/jobs/'+encodeURIComponent(stored.jobId)+'?postId='+encodeURIComponent(postId));
                const step='Optimizing video · '+job.state;status.textContent=step;progress(step);entry.state.textContent=job.state==='ready'?'Attached':'Processing…';
                if(job.state==='ready'){complete=true;break}
                if(job.state==='failed'){entry.failed=true;entry.state.textContent='Needs attention';throw Error('Video processing failed. Retry the saved source or remove the failed job.')}
                await new Promise(resolve=>setTimeout(resolve,1600));
              }
              if(!complete)throw Error('Video is still being processed. You can close this panel and keep writing.');
            }
            entry.done=true;sent++;
          }
          return {sent};
        },confirm:value=>value.sent>0,successLabel:total===1?'Attached':'Files attached',
        onSuccess:async value=>{if(!current())return;toast(value.sent===1?'Photo or video attached.':value.sent+' files attached.','success');clearSelections();await refreshRemote()},
        onFailure:async error=>{if(!current())return;status.textContent=error.message+' Already attached files are preserved.';toast(error.message,'error');await refreshRemote().catch(()=>{})}
      });
      uploadInFlight=false;section.dataset.uploadBusy='false';context.busy?.(false);renderAttachments();renderJobs();for(const [control,disabled] of controls)if(control.isConnected&&control!==submit)control.disabled=disabled;
      submit.disabled=!pending.some(item=>!item.done);submit.textContent=pending.some(item=>item.jobId&&!item.done)?'Check / retry saved video':'Attach remaining files ↑';
      if(!pending.length)submit.textContent='Attach selected media ↑';
    };
    renderAttachments();renderJobs();queuePoll();
  }
  function mediaPoster(item){return item.has_poster?' poster="/corner/media/'+encodeURIComponent(item.storage_key)+'?poster=1"':''}
  function mediaCard(x,quickEdit=false,index=0,total=1){
    const src='/corner/media/'+encodeURIComponent(x.storage_key);
    const isImage=x.mime_type.startsWith('image/');
    const preview=isImage?'<img loading="lazy" src="'+src+'" alt="'+esc(x.alt_text||'Image')+'">':
      '<video src="'+src+'"'+mediaPoster(x)+' controls preload="none" playsinline></video>';
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
      '<button type="button" data-media-edit="'+esc(x.id)+'">'+(quickEdit?(isImage?'Adjust image ↗':'Edit video ↗'):'Adjust ↗')+'</button>'+
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
  function mediaEdit(id,list,returnPostId=null){
    const x=list.find(media=>media.id===id);if(!x)return;
    active.editorAbort?.abort();const controller=new AbortController();active.editorAbort=controller;active.mediaBusy=false;
    const photo=x.mime_type.startsWith('image/'),source='/corner/media/'+encodeURIComponent(x.storage_key);
    const photoControls='<fieldset class="v5-media-adjust"><legend>Adjust photo · original preserved</legend><label>Filter<select name="preset"><option value="original">Original</option><option value="warm">Warm</option><option value="film">Film</option><option value="mono">Mono</option><option value="dream">Dream</option></select></label><label>Crop<select name="crop"><option value="original">Original</option><option value="square">Square</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label><label>Rotate<select name="rotation"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><label>Brightness<input type="range" name="brightness" min="0.6" max="1.4" step="0.05" value="1"></label><label>Contrast<input type="range" name="contrast" min="0.6" max="1.4" step="0.05" value="1"></label><label>Saturation<input type="range" name="saturation" min="0" max="2" step="0.05" value="1"></label></fieldset>';
    const videoControls='<section class="composer-video-editor"><video src="'+source+'"'+mediaPoster(x)+' controls playsinline preload="metadata" data-video-edit-preview></video><p>Current playable version. Trim times refer to your original upload.</p><fieldset class="v5-media-adjust" data-video-controls disabled><legend>Edit video · original preserved</legend><label>Start at (seconds)<input name="videoStart" type="number" min="0" max="179" step="0.1" value="0"></label><label>End at (seconds)<input name="videoEnd" type="number" min="0" max="180" step="0.1" value="0"><small>Use 0 for the end of the clip.</small></label><label>Cover frame (seconds into trimmed clip)<input name="posterAt" type="number" min="0" max="179" step="0.1" value="0"></label><label class="composer-toggle">Mute audio<input name="videoMuted" type="checkbox"></label></fieldset><p class="composer-video-recipe-state" data-video-recipe-state role="status">Loading your video settings…</p></section>';
    root.innerHTML='<section class="admin-section composer-media-editor"><header><div><p class="eyebrow">YOUR CORNER / MEDIA</p><h2>'+(photo?'Make the photo yours.':'Shape your video.')+'</h2></div><button class="admin-secondary" type="button" id="back-media">← '+(returnPostId?'Back to post':'Library')+'</button></header><form class="admin-surface admin-form" id="media-editor">'+(photo?photoControls:videoControls)+'<div class="editor-inline"><label>Focus X (0–1)<input type="number" step=".05" min="0" max="1" name="focalX" value="'+Number(x.focal_x??.5)+'"></label><label>Focus Y (0–1)<input type="number" step=".05" min="0" max="1" name="focalY" value="'+Number(x.focal_y??.5)+'"></label></div><details class="composer-media-metadata"><summary>Caption & accessibility</summary><label>Accessibility text<input name="altText" maxlength="240" value="'+esc(x.alt_text||'')+'"></label><label>Caption <span>Optional</span><textarea name="caption" maxlength="300" rows="2">'+esc(x.caption||'')+'</textarea></label></details><button type="submit" '+(!photo?'disabled':'')+'>Save adjustments</button>'+(photo?'<button type="button" data-v5-restore-photo>Restore original</button>':'')+'</form></section>';
    const editForm=$('#media-editor'),button=editForm.querySelector('button[type=submit]');
    const returnToMedia=()=>{if(returnPostId)void editor(returnPostId);else{active.editorAbort?.abort();void media()}};
    let videoRecipe=null;
    if(photo)window.CornerPhotoCompare?.mount(editForm,x);
    else{
      api('/corner/api/admin/media/'+encodeURIComponent(id)+'/video-edit').then(recipe=>{
        if(controller.signal.aborted||!editForm.isConnected)return;videoRecipe=recipe;
        editForm.elements.videoStart.value=recipe.start||0;editForm.elements.videoEnd.value=recipe.end||0;editForm.elements.posterAt.value=recipe.posterAt||0;editForm.elements.videoMuted.checked=!!recipe.muted;
        const busy=['queued','processing'].includes(recipe.state);$('[data-video-controls]',editForm).disabled=busy;
        $('[data-video-recipe-state]',editForm).textContent=busy?'Your latest edit is processing. Return to the post to follow its progress.':(recipe.sourceDuration?'Original length: '+Number(recipe.sourceDuration).toFixed(1)+' seconds. ':'')+'Changes are prepared in the background after you save.';
        const player=$('[data-video-edit-preview]',editForm);player.muted=!!recipe.muted;button.disabled=false;
      }).catch(error=>{if(controller.signal.aborted||!editForm.isConnected)return;$('[data-video-controls]',editForm).hidden=true;$('[data-video-recipe-state]',editForm).textContent=error.message;button.disabled=false});
      editForm.elements.videoMuted.addEventListener('change',()=>{$('[data-video-edit-preview]',editForm).muted=editForm.elements.videoMuted.checked});
    }
    $('#back-media').onclick=returnToMedia;
    editForm.querySelector('[data-v5-restore-photo]')?.addEventListener('click',async event=>{
      await actionMotion({action:'media.edit',trigger:event.currentTarget,targetId:id,signal:controller.signal,successLabel:'Original restored',visualTarget:editForm.querySelector('.corner-photo-compare'),
        execute:()=>api('/corner/api/admin/media/'+encodeURIComponent(id)+'/edits','DELETE'),onSuccess:()=>{toast('Original restored.','success');returnToMedia()},onFailure:error=>toast(error.message,'error')});
    });
    editForm.onsubmit=async event=>{
      event.preventDefault();if(!editForm.reportValidity())return;
      const form=event.currentTarget,trigger=form.querySelector('button[type="submit"]');let detailsSaved=false;
      const recipe=!photo&&videoRecipe?{start:Number(form.elements.videoStart.value),end:Number(form.elements.videoEnd.value),posterAt:Number(form.elements.posterAt.value),muted:form.elements.videoMuted.checked}:null;
      const changeVideo=recipe&&['start','end','posterAt','muted'].some(key=>recipe[key]!==videoRecipe[key]);
      await actionMotion({action:'media.edit',trigger,targetId:id,signal:controller.signal,visualTarget:form.querySelector('.corner-photo-compare'),successLabel:changeVideo?'Processing':'Media saved',
        execute:async({progress})=>{
          await api('/corner/api/admin/media/'+encodeURIComponent(id),'PATCH',{focalX:form.elements.focalX.value,focalY:form.elements.focalY.value,altText:form.elements.altText.value,caption:form.elements.caption.value});detailsSaved=true;
          if(photo){progress('Saving photo adjustments…');await api('/corner/api/admin/media/'+encodeURIComponent(id)+'/edits','POST',{preset:form.elements.preset.value,crop:form.elements.crop.value,rotation:Number(form.elements.rotation.value),brightness:Number(form.elements.brightness.value),contrast:Number(form.elements.contrast.value),saturation:Number(form.elements.saturation.value)})}
          else if(changeVideo){progress('Preparing video edit…');const job=await api('/corner/api/admin/media/'+encodeURIComponent(id)+'/video-edit','POST',recipe);if(!job?.jobId)throw Error('The video edit was not confirmed.');return {saved:true,queued:true}}
          return {saved:true};
        },confirm:result=>result?.saved===true,
        onSuccess:result=>{toast(result.queued?'Video edit queued. Follow its progress in your post.':'Media details saved.','success');returnToMedia()},
        onFailure:error=>toast(detailsSaved?(photo?'Media details saved, but photo adjustments did not finish. ':'Media details saved; the video edit needs attention. ')+error.message:error.message,'error')});
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
  $('#admin-logout')?.addEventListener('click',async()=>{try{await api('/corner/api/admin/logout','POST');draftRecovery.clear();location.reload()}catch(err){toast(err.message,'error')}});
  const allowed=$$('[data-admin-view]').map(button=>button.dataset.adminView);
  const routeStudio=()=>{
    const requested=location.hash.slice(1);
    if(allowed.includes('posts')&&requested==='create'){void editor();return}
    const editing=requested.match(/^post\/(post_[0-9a-f-]{36})$/i);if(allowed.includes('posts')&&editing){void editor(editing[1]);return}
    showView(allowed.includes(requested)?requested:initial.ownerRole==='owner'?'command':initial.ownerRole==='moderator'?'comments':initial.ownerRole==='editor'?'posts':'overview');
  };
  routeStudio();
  addEventListener('hashchange',()=>{if(active.dirty&&!confirm('Your latest writing is kept in this tab. Leave this post?')){history.replaceState(null,'',active.post?.id?'#post/'+encodeURIComponent(active.post.id):'#create');return}routeStudio()});
  addEventListener('beforeunload',event=>{if(active.dirty||active.mediaBusy){event.preventDefault();event.returnValue=''}});
})();
