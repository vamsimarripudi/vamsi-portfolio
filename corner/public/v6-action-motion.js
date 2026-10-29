/* Non-invasive action micro-feedback. The real API response is the only success source.
   Publish has its own richer controller and is excluded here. */
(()=>{
 'use strict';
 const patterns=[
  {selector:'#save-post',kind:'save'},
  {selector:'[data-restore-draft]',kind:'restore'},
  {selector:'[data-delete-draft]',kind:'archive'},
  {selector:'[data-moderate="approve"]',kind:'approve'},
  {selector:'[data-moderate="hide"]',kind:'archive'},
  {selector:'[data-moderate="delete"]',kind:'archive'},
  {selector:'#editor-upload button[type="submit"]',kind:'upload'},
  {selector:'#schedule-form button[type="submit"]',kind:'schedule'},
  {selector:'#settings-editor button[type="submit"]',kind:'save'},
  {selector:'#now-form button[type="submit"]',kind:'save'}
 ];
 const live=new Map();
 const match=target=>patterns.find(p=>target.closest?.(p.selector));
 document.addEventListener('click',event=>{
  if(event.defaultPrevented)return;
  const button=event.target.closest?.('button');
  if(!button||button.disabled)return;
  const found=match(button);if(!found)return;
  const form=button.closest('form');
  if(form&&button.type==='submit'&&!form.checkValidity())return;
  // Confirmation dialogs must finish before the backend request starts.
  if(found.kind==='archive'&&button.matches('[data-delete-draft],[data-moderate="delete"]'))return;
  const prior=live.get(button);if(prior)clearTimeout(prior);
  button.dataset.v6ActionKind=found.kind;
  button.dataset.v6ActionMotion='pending';
  live.set(button,setTimeout(()=>{if(button.isConnected&&button.dataset.v6ActionMotion==='pending')delete button.dataset.v6ActionMotion;live.delete(button)},16000));
 },true);
 const pathMatches=(path,kind)=>{
  if(kind==='save')return /\/posts(?:\/[^/]+)?$|\/settings$|\/status$/.test(path);
  if(kind==='schedule')return /\/schedule$/.test(path);
  if(kind==='upload')return /\/media\/upload/.test(path);
  if(kind==='approve')return /\/comments\/[^/]+\/approve$/.test(path);
  if(kind==='restore')return /\/posts\/[^/]+\/restore$/.test(path);
  if(kind==='archive')return /\/posts\/[^/]+$|\/comments\/[^/]+\/(?:hide|delete)$/.test(path);
  return false;
 };
 document.addEventListener('corner:action-result',event=>{
  const {path,success}=event.detail||{};
  if(!path)return;
  for(const [button,timer] of [...live]){
   if(!button.isConnected){clearTimeout(timer);live.delete(button);continue}
   if(!pathMatches(path,button.dataset.v6ActionKind))continue;
   clearTimeout(timer);live.delete(button);
   button.dataset.v6ActionMotion=success?'success':'error';
   const state=button.dataset.v6ActionMotion;
   setTimeout(()=>{if(button.isConnected&&button.dataset.v6ActionMotion===state)delete button.dataset.v6ActionMotion},success?850:1400);
  }
 });
 window.addEventListener('pagehide',()=>{for(const t of live.values())clearTimeout(t);live.clear()});
})();
