import {basePage,header,footer,escapeHtml} from './ui.mjs';
const e=escapeHtml;
const choice=(v,title)=>'<option value="'+e(v)+'">'+e(title)+'</option>';
export function languageStudioPage(languages,actor){
 languages.owner(actor);
 const posts=languages.store.all("SELECT id,title FROM posts WHERE state='published' ORDER BY published_at DESC LIMIT 150");
 const records=languages.list(actor);
 const form='<form class="v3a-form" data-v3-language-form><h2>Translate with care</h2>'+
  '<label>Published story<select name="postId" required>'+choice('','Choose a story')+posts.map(p=>choice(p.id,p.title)).join('')+'</select></label>'+
  '<label>Language<select name="language" required>'+choice('te','తెలుగు — Telugu')+choice('hi','हिन्दी — Hindi')+'</select></label>'+
  '<input type="hidden" name="revision" value="">'+
  '<label>Title<input name="title" maxlength="150" minlength="2" required></label>'+
  '<label>Excerpt<textarea name="excerpt" maxlength="380" rows="2"></textarea></label>'+
  '<label>Human-reviewed body<textarea name="body" maxlength="12000" minlength="3" rows="9" required></textarea></label>'+
  '<div class="v3a-actions"><button type="submit">Save draft ↗</button><button type="button" data-v3-language-preview>Preview</button></div>'+
  '<p role="status" aria-live="polite"></p></form>';
 const rows=records.map(row=>'<article class="v3a-locale-row"><div><strong>'+e(row.title)+'</strong>'+
  '<small>'+e(row.sourceTitle)+' · '+e(row.language.toUpperCase())+' · '+e(row.state)+(row.needsReview?' · source changed':'')+'</small></div>'+
  '<div class="v3a-actions"><button type="button" data-v3-language-edit="'+e(JSON.stringify(row))+'">Edit</button>'+
  (row.state!=='published'?'<button type="button" data-v3-language-publish="'+e(row.postId)+':'+e(row.language)+'" data-v3-language-revision="'+e(row.revision)+'">Review & publish</button>':'<button type="button" data-v3-language-revoke="'+e(row.postId)+':'+e(row.language)+'" data-v3-language-revision="'+e(row.revision)+'">Unpublish</button>')+'</div></article>').join('');
 const html=header()+'<main id="content" class="shell v3a-page"><a class="v3a-back" href="/admin">← Studio</a>'+
  '<p class="v3a-eyebrow">OWNER / HUMAN REVIEW</p><h1>Languages<span>.</span></h1><p class="v3a-lead">Translate the meaning, then approve every word. Nothing publishes automatically.</p>'+
  '<div class="v3a-layout"><section class="v3a-panel">'+form+'</section>'+
  '<section class="v3a-panel"><h2>Private review</h2><div class="v3a-preview" data-v3-language-output aria-live="polite"></div></section></div>'+
  '<section class="v3a-panel"><h2>Reviewed versions</h2>'+(rows||'<p>No translations yet.</p>')+'</section></main>'+footer();
 return basePage({title:'Language Studio',path:'/admin/v3/languages',content:html,noindex:true,initial:{page:'languages'}});
}
