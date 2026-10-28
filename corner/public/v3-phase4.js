/* Vamsi's Corner — live, owner-only human-reviewed language workbench.
   All content comes from existing Corner APIs; no invented or automatic translations. */
(()=>{
 'use strict';
 const form=document.querySelector('[data-v3-language-form]');
 if(!form)return;
 const prefix=location.pathname.startsWith('/corner')?'/corner':'';
 const base=prefix+'/api/v1/admin/v3/languages';
 const $=(selector,root=document)=>root.querySelector(selector);
 const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
 const status=$('[data-v3-language-status]');
 const sourcePane=$('[data-v3-language-source]');
 const previewPane=$('[data-v3-language-output]');
 const results=$('[data-v3-language-list]');
 const filterButtons=$$('[data-v3-language-filter]');
 const saveButton=$('[data-v3-language-save]');
 const previewButton=$('[data-v3-language-preview]');
 const refreshButton=$('[data-v3-language-refresh]');
 const sourceLink=$('[data-v3-language-source-link]');
 const pill=$('[data-v3-language-edit-state]');
 const counts={stories:$('[data-v3-count-stories]'),drafts:$('[data-v3-count-drafts]'),live:$('[data-v3-count-live]')};
 const inputs=['title','excerpt','body'];
 const state={sources:[],variants:[],source:null,selected:'',dirty:false,busy:false,filter:'all',requestId:0,lastUpdated:0};
 const field=name=>form.elements.namedItem(name);
 const safeText=value=>String(value??'');
 const make=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=safeText(text);return el};
 const label=lang=>lang==='te'?'Telugu':'Hindi';
 const key=(postId,lang)=>postId+':'+lang;
 const selected=()=>state.variants.find(record=>key(record.postId,record.language)===key(field('postId').value,field('language').value));
 const format=stamp=>{const dt=new Date(stamp);return Number.isFinite(dt.valueOf())?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(dt):'Unknown update time'};
 const announce=(message,type='info')=>{if(!status)return;status.textContent=message;status.dataset.state=type};
 const csrfSafe=async(path='',{method='GET',body,signal}={})=>{
  const response=await fetch(base+path,{
   method,credentials:'same-origin',cache:'no-store',
   ...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)}),
   ...(signal?{signal}:{})
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(payload?.error?.message||'The Corner could not complete this request.');error.status=response.status;throw error}
  return payload.data;
 };
 const current=()=>({postId:field('postId').value,language:field('language').value,
  title:field('title').value.trim(),excerpt:field('excerpt').value.trim(),body:field('body').value.trim(),
  ...(field('revision').value?{revision:Number(field('revision').value)}:{})});
 const busy=value=>{state.busy=value;form.setAttribute('aria-busy',String(value));
  if(saveButton)saveButton.disabled=value||!state.sources.length;
  if(previewButton)previewButton.disabled=value||!state.sources.length;
  if(refreshButton)refreshButton.disabled=value;
  if(results)results.querySelectorAll('button').forEach(button=>button.disabled=value)
 };
 const updateCounts=()=>{
  if(counts.stories)counts.stories.textContent=String(state.sources.length);
  if(counts.drafts)counts.drafts.textContent=String(state.variants.filter(v=>v.state==='draft'||v.needsReview).length);
  if(counts.live)counts.live.textContent=String(state.variants.filter(v=>v.state==='published'&&!v.needsReview).length);
 };
 const textPreview=(data=current())=>{
  if(!previewPane)return;
  previewPane.replaceChildren();
  if(!data.title&&!data.excerpt&&!data.body){previewPane.append(make('p','v3a-placeholder','Write a reviewed translation to see its private preview.'));return}
  previewPane.append(make('small','v3a-preview-kicker','PRIVATE · '+label(data.language)+' · NOT PUBLISHED'));
  previewPane.append(make('h3','v3a-preview-title',data.title||'Untitled translation'));
  if(data.excerpt)previewPane.append(make('p','v3a-preview-excerpt',data.excerpt));
  previewPane.append(make('div','v3a-preview-body',data.body||'Your translated story will appear here.'));
 };
 const showEditState=()=>{
  if(!pill)return;
  const existing=selected();
  pill.textContent=state.dirty?'Unsaved changes':existing?.needsReview?'Source changed · reapproval needed':existing?.state==='published'?'Published · revision '+existing.revision:existing?'Draft · revision '+existing.revision:'New private draft';
  pill.dataset.state=state.dirty?'dirty':existing?.needsReview?'stale':existing?.state||'new';
  if(saveButton)saveButton.textContent=existing?'Save new revision':'Save private draft';
 };
 const showSource=()=>{
  if(!sourcePane)return;
  const source=state.source;
  sourcePane.replaceChildren();
  if(!source){sourcePane.append(make('p','v3a-placeholder',state.sources.length?'Select a published story to read its original text.':'No published stories available. Publish an original story first.'));return}
  const head=make('div','v3a-source-top');head.append(make('strong','',source.title));
  head.append(make('small','',`Source version ${source.version} · ${format(source.publishedAt)}`));
  sourcePane.append(head);
  if(source.excerpt)sourcePane.append(make('p','v3a-source-excerpt',source.excerpt));
  sourcePane.append(make('div','v3a-source-body',source.body||'This published story has no body text.'));
  if(sourceLink){sourceLink.hidden=!source.slug;sourceLink.href=prefix+'/post/'+encodeURIComponent(source.slug)}
 };
 const optionList=()=>{
  const select=field('postId'),previous=select.value;
  select.replaceChildren();
  if(!state.sources.length){select.append(new Option('No published stories available',''));select.disabled=true;return}
  select.disabled=false;
  state.sources.forEach(source=>select.add(new Option(source.title,source.id)));
  select.value=state.sources.some(source=>source.id===previous)?previous:state.sources[0].id;
 };
 const setVariant=()=>{
  const record=selected();
  for(const name of inputs)field(name).value=record?.[name]||'';
  field('revision').value=record?.revision||'';
  const lang=field('language').value;for(const name of inputs)field(name).lang=lang;
  state.selected=key(field('postId').value,lang);state.dirty=false;
  showEditState();textPreview();
 };
 const showError=error=>{const conflict=error?.status===409;announce(conflict?'This version changed. Refresh the workbench before trying again.':error?.message||'Request failed. Try again.', 'error')};
 async function loadSource(){
  const id=field('postId').value,ticket=++state.requestId;
  if(!id){state.source=null;showSource();return}
  state.source=null;showSource();
  try{const source=await csrfSafe('/sources/'+encodeURIComponent(id));if(ticket!==state.requestId||field('postId').value!==id)return;state.source=source;showSource()}
  catch(error){if(ticket!==state.requestId)return;showError(error);sourcePane?.replaceChildren(make('p','v3a-placeholder','Could not retrieve this story. Refresh and try again.'))}
 }
 function renderRows(){
  if(!results)return;results.replaceChildren();
  const records=state.variants.filter(record=>state.filter==='all'||(state.filter==='stale'?record.needsReview:state.filter==='published'?record.state==='published'&&!record.needsReview:record.state==='draft'||record.needsReview));
  const empty=state.variants.length?'No translations match this filter.':'No reviewed translations yet. Save a private draft to start.';
  if(!records.length){results.append(make('p','v3a-placeholder',empty));return}
  for(const record of records){
   const row=make('article','v3a-locale-row');row.dataset.state=record.needsReview?'stale':record.state;
   const copy=make('div','v3a-locale-copy');copy.append(make('strong','',record.title));
   copy.append(make('small','',record.sourceTitle+' · '+label(record.language)+' · '+(record.needsReview?'Source changed — review again':record.state==='published'?'Published':'Private draft')+' · Updated '+format(record.updatedAt)));
   const actions=make('div','v3a-actions');
   const edit=make('button','v3a-action-light','Edit');edit.type='button';edit.setAttribute('aria-label','Edit '+label(record.language)+' translation of '+record.sourceTitle);
   edit.addEventListener('click',()=>{
    if(state.dirty&&!confirm('Discard unsaved changes to open another translation?'))return;
    field('postId').value=record.postId;field('language').value=record.language;
    setVariant();void loadSource();form.scrollIntoView({block:'start',behavior:'instant'});
    field('title').focus({preventScroll:true});announce('Loaded the saved translation. New edits require a fresh review.');
   });actions.append(edit);
   const isPublished=record.state==='published'&&!record.needsReview;
   const action=make('button',isPublished?'v3a-action-light':'',''+(isPublished?'Unpublish':'Review & publish'));
   action.type='button';
   if(record.needsReview){action.disabled=true;action.title='The original story has changed. Edit and save the translation before reviewing it.'}
   else action.addEventListener('click',()=>review(record,isPublished?'revoke':'publish',action));
   actions.append(action);row.append(copy,actions);results.append(row);
  }
 }
 async function review(record,operation,button){
  if(state.busy)return;
  if(state.dirty&&state.selected===key(record.postId,record.language)){announce('Save or discard your unsaved changes before reviewing this translation.','error');return}
  const sentence=operation==='publish'?'You have read and approved every word. Publish this translation publicly?':'Unpublish this translation? Readers will see the original language instead.';
  if(!confirm(record.sourceTitle+' · '+label(record.language)+'\n\n'+sentence))return;
  busy(true);button.disabled=true;
  try{
   await csrfSafe('/'+encodeURIComponent(record.postId)+'/'+record.language+'/'+operation,{method:'POST',body:{confirm:true,revision:record.revision}});
   announce(operation==='publish'?'Reviewed translation is now public.':'Translation unpublished.','success');
   await refreshWorkbench({preserve:true,quiet:true});
  }catch(error){showError(error)}finally{busy(false)}
 }
 async function refreshWorkbench({preserve=false,quiet=false}={}){
  const previousPost=field('postId').value,previousLanguage=field('language').value;
  busy(true);
  try{
   const data=await csrfSafe('/workbench');
   if(!data||!Array.isArray(data.sources)||!Array.isArray(data.variants))throw Error('Unexpected language workbench response.');
   state.sources=data.sources;state.variants=data.variants;state.lastUpdated=Date.now();
   optionList();
   if(preserve&&state.sources.some(s=>s.id===previousPost))field('postId').value=previousPost;
   if(preserve)field('language').value=previousLanguage;
   setVariant();updateCounts();renderRows();await loadSource();
   if(!quiet)announce(state.sources.length?'Loaded '+state.sources.length+' real published '+(state.sources.length===1?'story':'stories')+'. Select a language and write a reviewed draft.':'No published stories exist yet. Publish an original first.');
  }catch(error){showError(error)}finally{busy(false)}
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(state.busy||!form.reportValidity())return;
  const data=current();if(!data.postId)return announce('Choose a published story first.','error');
  busy(true);
  try{
   const saved=await csrfSafe('',{method:'POST',body:data});
   announce('Private draft saved · revision '+saved.revision+'. Publication still requires your approval.','success');
   await refreshWorkbench({preserve:true,quiet:true});
  }catch(error){showError(error)}finally{busy(false)}
 });
 for(const name of inputs)field(name).addEventListener('input',()=>{state.dirty=true;showEditState();textPreview()});
 for(const name of ['postId','language'])field(name).addEventListener('change',event=>{
  const next=key(field('postId').value,field('language').value);
  if(state.dirty&&next!==state.selected&&!confirm('Discard unsaved changes and load another translation?')){
   const split=state.selected.lastIndexOf(':');if(split>=0){field('postId').value=state.selected.slice(0,split);field('language').value=state.selected.slice(split+1)}return;
  }
  setVariant();if(event.target.name==='postId')void loadSource();
 });
 previewButton?.addEventListener('click',async()=>{
  if(state.busy||!form.reportValidity())return;
  busy(true);
  try{const preview=await csrfSafe('/preview',{method:'POST',body:current()});
   if(preview?.previewOnly!==true)throw Error('Preview response could not be verified.');
   textPreview(preview);announce('Server-validated private preview. This does not publish anything.','success');
  }catch(error){showError(error)}finally{busy(false)}
 });
 refreshButton?.addEventListener('click',()=>{
  if(state.dirty&&!confirm('Discard unsaved changes and refresh current stories?'))return;
  void refreshWorkbench({preserve:true});
 });
 filterButtons.forEach(button=>button.addEventListener('click',()=>{
  state.filter=button.dataset.v3LanguageFilter;
  filterButtons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  renderRows();
 }));
 const nav=$('.admin-shell .admin-nav'),active=nav?.querySelector('[aria-current="page"]');
 if(nav&&active&&matchMedia('(max-width:767px)').matches){
  requestAnimationFrame(()=>{nav.scrollLeft=Math.max(0,active.offsetLeft-nav.offsetLeft-(nav.clientWidth-active.offsetWidth)/2)})
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!state.dirty&&!state.busy&&Date.now()-state.lastUpdated>60000)void refreshWorkbench({preserve:true,quiet:true})});
 void refreshWorkbench();
})();
