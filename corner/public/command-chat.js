/** Private, owner-scoped Command workspace. No model output is treated as HTML or authority. */
(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const paths={plus:'M12 5v14M5 12h14',send:'m5 12 7-7 7 7M12 5v14',history:'M3 11a9 9 0 1 1 2.3 7M3 4v7h7M12 7v5l3 2',more:'M5 12h.01M12 12h.01M19 12h.01',close:'m6 6 12 12M6 18 18 6',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',image:'M4 4h16v16H4ZM4 16l5-5 4 4 3-3 4 4M15 8h.01',clip:'m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8',queue:'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',check:'m5 12 4 4L19 6',down:'m6 9 6 6 6-6',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',edit:'m15 4 5 5-11 11H4v-5ZM13 6l5 5',stop:'M6 6h12v12H6Z',copy:'M8 8h12v12H8ZM4 16V4h12',archive:'M3 4h18v4H3ZM5 8v12h14V8M9 12h6',download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4'};
 const icon=name=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
 const button=(action,label,name=action)=>`<button type="button" class="cc-icon" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}">${icon(name)}</button>`;
 const key=()=>crypto.randomUUID();
 let current=null;
 const storage={get(k){try{return JSON.parse(sessionStorage.getItem('corner.chat.'+k))}catch{return¶»§q«^