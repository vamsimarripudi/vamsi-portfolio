import {studioFrame} from './studio-ui.mjs';
import {basePage,escapeHtml} from './ui.mjs';
const e=escapeHtml;
const choice=(value,label)=>'<option value="'+e(value)+'">'+e(label)+'</option>';

// Server-side data is genuine even before client JavaScript finishes loading.
// The browser then refreshes the same owner-protected data in place.
export function languageStudioPage(languages,actor){
 languages.owner(actor);
 const sources=languages.sources(actor);
 const records=languages.list(actor);
 const drafts=records.filter(record=>record.state==='draft'||record.needsReview).length;
 const live=records.filter(record=>record.state==='published'&&!record.needsReview).length;
 const form='<form class="v3a-form v3a-language-form" data-v3-language-form aria-busy="false">'+
  '<div class="v3a-workbench-title"><div><p class="v3a-eyebrow">TRANSLATION EDITOR</p><h2>Write with context.</h2></div><span class="v3a-edit-state" data-v3-language-edit-state>New private draft</span></div>'+
  '<label>Published story<select name="postId" required'+(sources.length?'':' disabled')+'>'+(
    sources.length?sources.map(p=>choice(p.id,p.title)).join(''):choice('','No published stories available'))+'</select></label>'+
  '<label>Translate into<select name="language" required>'+choice('te','తెలుగు — Telugu')+choice('hi','हिन्दी — Hindi')+'</select></label>'+
  '<input type="hidden" name="revision" value="">'+
  '<p class="v3a-editor-hint">Original text appears alongside the editor. Write your own translation; nothing is generated or published automatically.</p>'+
  '<label>Reviewed title<input name="title" maxlength="150" minlength="2" required autocomplete="off" placeholder="Enter the translated title"></label>'+
  '<label>Short excerpt<textarea name="excerpt" maxlength="380" rows="3" placeholder="Optional introduction"></textarea></label>'+
  '<label>Full translation<textarea name="body" maxlength="12000" minlength="3" rows="10" required placeholder="Write and review the translated story"></textarea></label>'+
  '<div class="v3a-actions v3a-editor-actions"><button type="submit" data-v3-language-save'+(sources.length?'':' disabled')+'>Save private draft</button><button type="button" data-v3-language-preview'+(sources.length?'':' disabled')+'>Validate preview</button></div>'+
  '<p class="v3a-form-status" role="status" data-v3-language-status aria-live="polite">Loading current stories…</p>'+ 
  '</form>';
 const summary='<section class="v3a-language-summary" aria-label="Actual translation activity">'+
  '<div><strong data-v3-count-stories>'+sources.length+'</strong><span>Published originals</span></div>'+
  '<div><strong data-v3-count-drafts>'+drafts+'</strong><span>Drafts / need review</span></div>'+
  '<div><strong data-v3-count-live>'+live+'</strong><span>Reviewed & live</span></div></section>';
 const recordsHtml=records.map(record=>
  '<article class="v3a-locale-row" data-state="'+e(record.needsReview?'stale':record.state)+'"><div class="v3a-locale-copy"><strong>'+e(record.title)+'</strong><small>'+e(record.sourceTitle)+' · '+e(record.language.toUpperCase())+' · '+e(record.needsReview?'Source changed — review again':record.state)+'</small></div></article>'
 ).join('');
 const html='<main id="content" class="shell v3a-page v3a-language-page">'+
  '<div class="v3a-language-hero"><div><p class="v3a-eyebrow">OWNER / LIVE WORKBENCH</p><h1>Languages<span>.</span></h1><p class="v3a-lead">Translate your real published stories. Save privately, compare against the original, then explicitly review and publish.</p></div>'+ 
  '<button type="button" class="v3a-refresh" data-v3-language-refresh>↻ Refresh stories</button></div>'+summary+
  '<div class="v3a-language-grid"><section class="v3a-panel v3a-editor-panel" aria-label="Translation editor">'+form+'</section>'+ 
  '<aside class="v3a-language-context" aria-label="Story context and private preview">'+
  '<section class="v3a-panel v3a-context-panel"><div class="v3a-context-heading"><h2>Original story</h2><a data-v3-language-source-link href="#" target="_blank" rel="noopener" hidden>View published story ↗</a></div>'+ 
  '<div data-v3-language-source class="v3a-source-text"><p class="v3a-placeholder">Loading original story…</p></div></section>'+ 
  '<section class="v3a-panel v3a-context-panel"><div class="v3a-context-heading"><h2>Private preview</h2><span class="v3a-review-chip">Never public until approved</span></div>'+ 
  '<div class="v3a-preview" data-v3-language-output aria-live="polite"><p class="v3a-placeholder">Write a translation to preview it here.</p></div></section></aside></div>'+ 
  '<section class="v3a-panel v3a-review-queue" aria-labelledby="reviewed-versions-title"><div class="v3a-review-head"><div><p class="v3a-eyebrow">REAL SAVED RECORDS</p><h2 id="reviewed-versions-title">Translation library</h2></div><div class="v3a-filter-row" role="group" aria-label="Filter translations">'+ 
  '<button type="button" data-v3-language-filter="all" aria-pressed="true">All</button>'+ 
  '<button type="button" data-v3-language-filter="draft" aria-pressed="false">Drafts</button>'+ 
  '<button type="button" data-v3-language-filter="published" aria-pressed="false">Published</button>'+ 
  '<button type="button" data-v3-language-filter="stale" aria-pressed="false">Needs review</button></div></div>'+ 
  '<div data-v3-language-list aria-live="polite">'+(recordsHtml||'<p class="v3a-placeholder">No translations saved yet.</p>')+'</div></section></main>';
 return basePage({title:'Language Studio',path:'/admin/v3/languages',content:studioFrame(actor,'languages',html),noindex:true,initial:{page:'languages'}});
}
