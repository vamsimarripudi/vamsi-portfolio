export const journalSeriesUrl=slug=>'/series/'+encodeURIComponent(slug);
const escapeHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const partsNumber=n=>String(n||1).padStart(2,'0');
const storyHref=post=>'/post/'+encodeURIComponent(post.slug);
const chapterTitle=(post,number)=>{
  const match=String(post.body||'').match(new RegExp('(?:^|\\n)Part\\s+'+number+'\\s*[—–:-]\\s*([^\\n]+)','i'));
  return (match?.[1]?.trim()||post.title||'An untitled chapter').slice(0,140);
};
export const getChapterTitle=chapterTitle;
export function seriesStoryBody(post,series){
  const raw=String(post.body||'').split(/\n{2,}/).map(s=>s.trim()).filter(Boolean);
  // Part 01 already contains the series title and chapter title as text.
  // Remove *only their duplicate display* beneath the separate chapter header;
  // the database body and source text remain unchanged.
  if(raw[0]?.toLocaleLowerCase()===String(series.title).toLocaleLowerCase())raw.shift();
  if(/^Part\s+\d+\s*[—–:-]/i.test(raw[0]||'')&&new RegExp('^Part\\s+'+series.partNumber+'\\s*[—–:-]','i').test(raw[0]))raw.shift();
  return raw.map((section,i)=>{
    const text=section.replace(/^>\s*/,'');
    if(/^>\s+/.test(section)||text==='What if I’m confusing learning with progress?'){
      return '<figure class="series-pull-quote"><span aria-hidden="true">“</span><blockquote>'+escapeHtml(text)+'</blockquote></figure>';
    }
    const className=i===0?' class="series-opening-paragraph"':
      text==='Learning gives me a sense of accomplishment. Execution demands proof.'?' class="series-emphasis"':'';
    return '<p'+className+'>'+escapeHtml(section).replace(/\n/g,'<br>')+'</p>';
  }).join('');
}
export function seriesChapterPrelude(series,post){
  if(!series)return '';
  const n=partsNumber(series.partNumber);
  return '<section class="series-chapter-prelude" aria-label="Journal series chapter">'+
    '<div class="series-chapter-series"><span class="series-monogram" aria-hidden="true">✳</span>'+
    '<div><span class="series-small-label">A JOURNAL SERIES / ONGOING</span>'+
    '<a class="series-chapter-name" href="'+journalSeriesUrl(series.slug)+'">'+escapeHtml(series.title)+'<span aria-hidden="true"> ↗</span></a></div></div>'+
    '<div class="series-chapter-indicator"><span>CHAPTER</span><strong>'+n+'</strong><span class="series-chapter-line" aria-hidden="true"></span></div>'+
    '<p class="series-chapter-subline">An open notebook about curiosity, unfinished beginnings, and the work of actually doing.</p>'+
  '</section>';
}
export function seriesChapterFooter(series){
  if(!series)return '';
  const slug=journalSeriesUrl(series.slug);
  const next=series.next?'<a class="series-chapter-next" href="'+storyHref(series.next)+'"><small>UP NEXT · CHAPTER '+partsNumber(series.next.partNumber)+'</small><strong>'+escapeHtml(chapterTitle(series.next,series.next.partNumber))+'</strong><span>Continue reading ↗</span></a>':
    '<div class="series-chapter-next series-chapter-upcoming"><small>NEXT CHAPTER</small><strong>Part '+(series.partNumber+1)+' is in progress.</strong><span>New chapters will appear here after publication.</span></div>';
  const previous=series.previous?'<a class="series-chapter-previous" href="'+storyHref(series.previous)+'">← Chapter '+partsNumber(series.previous.partNumber)+'</a>':'<span class="series-chapter-previous">You’re at the beginning.</span>';
  return '<section class="series-chapter-footer" aria-label="Continue this journal series">'+
    '<div class="series-chapter-footer-top"><p class="series-small-label">THE STORY CONTINUES</p><a href="'+slug+'">All chapters ↗</a></div>'+
    '<div class="series-chapter-continue">'+previous+next+'</div></section>';
}
export function seriesHubContent(series){
  const cover=series.parts[0]?.cover;
  const image=cover?'<div class="series-cover-photo"><img loading="eager" fetchpriority="high" src="/media/'+encodeURIComponent(cover.storage_key)+'" alt="'+escapeHtml(cover.caption||'Photograph from the first chapter')+'"></div>':'';
  const chapters=series.parts.map((post,index)=>{
    const n=partsNumber(post.partNumber);
    return '<li class="series-toc-item"><a href="'+storyHref(post)+'"><span class="series-toc-number">'+n+'</span>'+
      '<span class="series-toc-copy"><small>CHAPTER '+n+' · '+Math.max(1,Math.ceil(String(post.body||'').split(/\s+/).length/220))+' MIN READ</small>'+
      '<strong>'+escapeHtml(chapterTitle(post,post.partNumber))+'</strong><span>'+escapeHtml((post.excerpt||'').replace(/^Learning Everything, Doing Nothing\s*Part\s*\d+\s*[—–:-]\s*/i,'').slice(0,135))+'</span></span>'+
      '<span class="series-toc-arrow" aria-hidden="true">↗</span></a></li>';
  }).join('');
  return '<div class="series-hub">'+
    '<nav class="series-hub-breadcrumb" aria-label="Breadcrumb"><a href="/category/journal">← Journal</a><span>/</span><span>Series</span></nav>'+
    '<section class="series-cover" aria-labelledby="series-title"><div class="series-cover-copy"><p class="series-small-label">VAMSI’S CORNER / THE MARGINALIA SERIES</p>'+
    '<span class="series-cover-seal" aria-hidden="true">01 <i>◌</i></span>'+
    '<h1 id="series-title">'+escapeHtml(series.title)+'<span>.</span></h1>'+
    '<p class="series-cover-deck">'+escapeHtml(series.summary)+'</p>'+
    '<div class="series-cover-meta"><span>'+series.parts.length+' '+(series.parts.length===1?'CHAPTER':'CHAPTERS')+' PUBLISHED</span><span class="series-cover-status">ONGOING SERIES</span></div>'+
    '<a class="series-start-button" href="'+storyHref(series.parts[0])+'">Start with Chapter '+partsNumber(series.parts[0].partNumber)+' <span aria-hidden="true">↗</span></a></div>'+
    image+
    '</section>'+
    '<section class="series-introduction"><p class="series-small-label">ABOUT THIS NOTEBOOK</p><p>Some questions don’t fit into a single entry. This series follows the space between collecting knowledge and putting it into practice—one honest chapter at a time.</p></section>'+
    '<section id="chapters" class="series-toc" aria-labelledby="series-toc-title"><div class="series-toc-heading"><p class="series-small-label">THE TABLE OF CONTENTS</p><h2 id="series-toc-title">The chapters<span>.</span></h2></div><ol>'+chapters+'</ol>'+
    '<p class="series-toc-tail">A new chapter appears here only after it is published.</p></section>'+
    '<a class="series-return-link" href="/category/journal">← Back to Journal</a>'+
  '</div>';
}
