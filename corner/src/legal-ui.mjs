import { basePage, header, footer, searchDialog } from './ui.mjs';
import { CORE_LEGAL } from './legal-core.mjs';
import { COMMUNITY_LEGAL } from './legal-community.mjs';

/* Public trust center: authored content, semantic navigation and readable policies.
 * No analytics or consent is accepted automatically when viewing a policy.
 * External references are official MeitY/Gazette sources in the policy text.
 */
export const LEGAL_DOCUMENTS=Object.freeze([...CORE_LEGAL,...COMMUNITY_LEGAL]);
export const LEGAL_ROUTES=Object.freeze(['/policies',...LEGAL_DOCUMENTS.map(x=>'/'+x.slug)]);
const INDEX=new Map(LEGAL_DOCUMENTS.map(x=>[x.slug,x]));
const e=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const groups=['Privacy & control','Usage & publishing','Community & support'];
const labels={
 'Privacy & control':{icon:'◈',short:'Your information',desc:'Data, consent, your choices and security'},
 'Usage & publishing':{icon:'↗',short:'Using Corner',desc:'Viewership, publication rights and responsible use'},
 'Community & support':{icon:'✧',short:'People & help',desc:'Respectful interaction, accessibility and support'}
};
const CONTACT='connect@vamsimarripudi.me';
function enriched(value){
 const html=e(value);
 return html.replace(/https:\/\/(?:egazette\.gov\.in|www\.meity\.gov\.in)\/[a-zA-Z0-9_./-]+(?:\.pdf)?/g,m=>
  '<a href="'+m+'" rel="noopener noreferrer" target="_blank" class="legal-external">'+m+' <span aria-hidden="true">↗</span></a>')
  .replaceAll(CONTACT,'<a href="mailto:'+CONTACT+'">'+CONTACT+'</a>');
}
function flagNav(value){
 return groups.map(group=>{
  const docs=LEGAL_DOCUMENTS.filter(doc=>doc.group===group);
  return '<section class="legal-group"><h3>'+e(group)+'</h3><div class="legal-links">'+docs.map(doc=>
   '<a href="/'+e(doc.slug)+'"'+(value===doc.slug?' class="is-active" aria-current="page"':'')+'>'+
   '<span>'+e(doc.title)+'</span><span aria-hidden="true">›</span></a>').join('')+'</div></section>';
 }).join('');
}
function policyNav(slug){
 return '<aside class="legal-sidebar" aria-label="Legal document navigation">'+
   '<div class="legal-sidebar-heading"><span class="legal-sidebar-symbol">✳</span><strong>Legal & trust</strong><small>12 original policy documents</small></div>'+
   '<a class="legal-all-link" href="/policies">← All documents</a>'+flagNav(slug)+
   '<div class="legal-sidebar-contact"><p>Need help with a policy?</p><a href="mailto:'+CONTACT+'">Contact the operator ↗</a></div></aside>';
}
function points(items){
 return '<ul class="legal-points">'+items.map(t=>'<li>'+enriched(t)+'</li>').join('')+'</ul>';
}
function sectionMarkup(section){
 const paragraphs=(section.paragraphs||[]).map(t=>'<p>'+enriched(t)+'</p>').join('');
 const list=section.bullets?.length?points(section.bullets):'';
 const table=section.table?'<div class="legal-table-scroll" tabindex="0" role="region" aria-label="'+e(section.title)+' table">'+
  '<table class="legal-data-table"><thead><tr>'+section.table.headers.map(h=>'<th scope="col">'+e(h)+'</th>').join('')+'</tr></thead>'+
  '<tbody>'+section.table.rows.map(r=>'<tr>'+r.map((v,i)=>i===0?'<th scope="row">'+enriched(v)+'</th>':'<td>'+enriched(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'';
 const note=section.note?'<p class="legal-inline-note">'+enriched(section.note)+'</p>':'';
 return '<section class="legal-section" id="'+e(section.id)+'" aria-labelledby="'+e(section.id)+'-heading"><h2 id="'+e(section.id)+'-heading">'+e(section.title)+'</h2>'+
  paragraphs+list+table+note+'</section>';
}
function toTop(){
 return '<a href="#top" class="legal-backtop">Back to top <span aria-hidden="true">↑</span></a>';
}
function choices(slug){
 if(!['cookies','privacy','dpdp'].includes(slug))return '';
 return '<section class="legal-choice-panel" aria-labelledby="legal-choices-heading" id="privacy-controls">'+
 '<div class="legal-choice-icon" aria-hidden="true">◈</div><div><p class="legal-eyebrow">YOUR CONTROLS</p>'+
 '<h2 id="legal-choices-heading">Make the choice that works for you.</h2>'+
 '<p>Optional reading measurement stays off unless you allow it. Your choice is independent of signing in or receiving emails.</p>'+
 '<div class="legal-choice-actions"><a href="#reading-preferences">Manage Corner reading analytics</a>'+
 '<a href="https://vamsimarripudi.me/privacy#website-analytics-preferences">Portfolio analytics settings <span aria-hidden="true">↗</span></a>'+
 '<a href="/settings/privacy">Account privacy controls</a></div></div></section>';
}
function relatedDocuments(doc){
 const related=LEGAL_DOCUMENTS.filter(d=>d.slug!==doc.slug&&d.group===doc.group).slice(0,3);
 return '<section class="legal-related" aria-labelledby="legal-related-heading"><div class="legal-related-heading"><h2 id="legal-related-heading">Also worth reading.</h2>'+
 '<a href="/policies">All policies <span aria-hidden="true">↗</span></a></div><div class="legal-related-grid">'+related.map(d=>
 '<a class="legal-related-item" href="/'+e(d.slug)+'"><strong>'+e(d.title)+'</strong><span>'+e(d.summary)+'</span>'+
 '<span class="legal-related-arrow" aria-hidden="true">↗</span></a>').join('')+'</div></section>';
}
function policyPage(doc){
 const content=doc.sections.map(sectionMarkup).join('');
 const nav=doc.sections.map(sec=>'<a href="#'+e(sec.id)+'">'+e(sec.title.replace(/^\d+\.\s*/,''))+'</a>').join('');
 const latest='<span class="legal-date">'+e(doc.updated)+'</span>';
 const main='<main class="shell legal-shell" id="content">'+
 '<div class="legal-breadcrumb"><a href="/">Vamsi’s Corner</a><span>/</span><a href="/policies">Legal & trust</a><span>/</span><span>'+e(doc.title)+'</span></div>'+
 '<header class="legal-hero" id="top"><p class="legal-eyebrow">POLICIES & TRANSPARENCY · '+e(doc.group.toUpperCase())+'</p><h1>'+e(doc.title)+'<span>.</span></h1>'+
 '<p class="legal-lede">'+e(doc.summary)+'</p><div class="legal-meta"><span>Prepared '+latest+'</span><span class="legal-meta-dot">·</span>'+
 '<span>About '+e(doc.readingMinutes)+' min read</span><span class="legal-meta-dot">·</span><span>Vamsi’s Corner</span></div></header>'+
 '<div class="legal-content-grid">'+policyNav(doc.slug)+
 '<article class="legal-article">'+
 '<div class="legal-overview"><div class="legal-overview-label"><span aria-hidden="true">✧</span> IN BRIEF</div>'+points(doc.highlights)+'</div>'+
 '<details class="legal-mobile-index"><summary>On this page <span aria-hidden="true">⌄</span></summary><nav aria-label="Policy sections">'+nav+'</nav></details>'+
 content+choices(doc.slug)+toTop()+'</article>'+
 '<aside class="legal-onpage" aria-label="On this page"><span class="legal-onpage-title">IN THIS DOCUMENT</span><nav>'+nav+'</nav>'+
 '<div class="legal-onpage-note"><span aria-hidden="true">✳</span><p>Questions about your rights?</p><a href="/grievances">Request assistance ↗</a></div></aside></div>'+
 relatedDocuments(doc)+'</main>';
 return basePage({path:'/'+doc.slug,title:doc.title,description:doc.summary,content:header()+main+footer()+searchDialog(),
  initial:{page:'legal',policy:doc.slug}});
}
function trustHub(){
 const collections=groups.map(group=>{
  const info=labels[group],docs=LEGAL_DOCUMENTS.filter(doc=>doc.group===group);
  return '<section class="legal-hub-section" aria-labelledby="legal-hub-'+e(group.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-'))+'">'+
    '<div class="legal-hub-section-heading"><span class="legal-hub-icon" aria-hidden="true">'+info.icon+'</span><div><p class="legal-eyebrow">'+e(group.toUpperCase())+'</p>'+
    '<h2 id="legal-hub-'+e(group.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-'))+'">'+e(info.short)+'</h2>'+
    '<p>'+e(info.desc)+'</p></div></div><div class="legal-card-grid">'+docs.map(doc=>
     '<a class="legal-card" href="/'+e(doc.slug)+'"><span class="legal-card-top"><span>'+e(doc.readingMinutes)+' MIN READ</span><span aria-hidden="true">↗</span></span>'+
     '<h3>'+e(doc.title)+'</h3><p>'+e(doc.summary)+'</p><span class="legal-card-footer">Prepared '+e(doc.updated)+'</span></a>').join('')+
    '</div></section>';
 }).join('');
 const main='<main class="shell legal-shell legal-hub-shell" id="content">'+
 '<div class="legal-breadcrumb"><a href="/">Vamsi’s Corner</a><span>/</span><span>Legal & trust</span></div>'+
 '<header class="legal-hero legal-hub-hero" id="top"><p class="legal-eyebrow">INFORMATION YOU CAN ACTUALLY USE</p>'+
 '<h1>A little more <em>clarity.</em><span class="legal-hub-star" aria-hidden="true">✧</span></h1>'+
 '<p class="legal-lede">Privacy, fair use, community standards, data rights and everything that keeps this little corner trustworthy.</p>'+
 '<div class="legal-meta"><span>12 policies</span><span class="legal-meta-dot">·</span><span>Prepared 27 October 2026</span>'+
 '<span class="legal-meta-dot">·</span><span>Plain language, original text</span></div></header>'+
 '<div class="legal-hub-note"><span class="legal-hub-note-icon" aria-hidden="true">◈</span><div><strong>Privacy should be understandable.</strong>'+
 '<p>You can read public stories without a member account. Optional reader analytics is off unless you allow it. Your data requests have a direct contact route.</p></div>'+
 '<a href="/privacy">Read our privacy policy <span aria-hidden="true">↗</span></a></div>'+collections+
 '<section class="legal-hub-contact"><div><p class="legal-eyebrow">STILL HAVE A QUESTION?</p><h2>Talk to a real person.</h2>'+
 '<p>Ask about a policy, report an issue or request assistance with your private account.</p></div>'+
 '<a href="mailto:'+CONTACT+'">Email '+CONTACT+' <span aria-hidden="true">↗</span></a></section></main>';
 return basePage({path:'/policies',title:'Legal & Trust Center',description:'Privacy, cookies, DPDP, terms, viewership, rights and community guidelines for Vamsi’s Corner.',
  content:header()+main+footer()+searchDialog(),initial:{page:'legal',policy:'index'}});
}
export function isLegalPath(path){return path==='/policies'||INDEX.has(path.replace(/^\//,''))}
export function legalPage(path){return path==='/policies'?trustHub():policyPage(INDEX.get(path.replace(/^\//,'')))}
