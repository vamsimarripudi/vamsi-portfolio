/* V7 Journal Series hub. Editorial presentation uses real published posts only. */
import {basePage,header,footer,searchDialog,escapeHtml} from './ui.mjs';
import {config} from './config.mjs';
const e=escapeHtml;
const chapterLabel=p=>'Part '+String(p).padStart(2,'0');
const imageFor=media=>media?.storage_key?'/media/'+encodeURIComponent(media.storage_key):null;
const postHref=post=>'/post/'+encodeURIComponent(post.slug);
const short=post=>post?.excerpt&&post.excerpt.length<=125?post.excerpt:'A chapter in a personal journal about learning and doing.';
export function journalSeriesPage({series}){
 const first=series.parts.find(c=>c.published);
 const photo=imageFor(series.cover);
 const cover=photo?
  '<div class="journal-series-cover"><img src="'+photo+'" alt="'+e(series.cover.alt_text||'Series cover photograph')+'">'+
   '<div class="journal-series-cover-shade"><span>CHAPTERS FROM AN OPEN NOTEBOOK</span><strong>'+e(series.slug==='learning-everything-doing-nothing'?'What if I’m confusing learning with progress?':series.subtitle)+'</strong></div></div>':
  '<div class="journal-series-cover journal-series-cover-empty" aria-hidden="true"><span>LEARNING / BECOMING / BEGINNING</span><strong>✳</strong></div>';
 const items=series.parts.map((part,index)=>{
  const content='<span class="journal-series-chapter-number">'+String(part.part).padStart(2,'0')+'</span>'+
   (part.published&&part.part===1&&photo?'<img src="'+photo+'" loading="lazy" alt="">':
    '<span class="journal-series-chapter-art journal-series-chapter-art-'+((index%4)+1)+'" aria-hidden="true"><span>'+String(part.part).padStart(2,'0')+'</span></span>')+
   '<span class="journal-series-chapter-copy"><strong>'+e(part.title)+'</strong>'+
   '<span>'+e(part.published?short(part.post):['','The excitement of starting is a powerful trap.','Ideas, courses, notebooks, and endless tabs.','What really stops me from starting?','A simpler way forward.'][index]||'A new chapter is in the works.')+'</span>'+
   '<small class="'+(part.published?'is-published':'is-upcoming')+'">'+
   (part.published?'●  Published':'○  Coming soon')+'</small></span>'+
   (part.published?'<span class="journal-series-chapter-open" aria-hidden="true">↗</span>':'');
  return part.published?
   '<a class="journal-series-chapter" href="'+postHref(part.post)+'" aria-label="Read '+chapterLabel(part.part)+': '+e(part.title)+'">'+content+'</a>':
   '<div class="journal-series-chapter is-unpublished" aria-label="'+chapterLabel(part.part)+': '+e(part.title)+', coming soon">'+content+'</div>';
 }).join('');
 const seriesUrl='/series/'+encodeURIComponent(series.slug);
 const published=series.parts.filter(c=>c.published);
 const structured={'@context':'https://schema.org','@type':'CreativeWorkSeries',name:series.title,description:series.subtitle,url:config.siteUrl.replace(/\/$/,'')+seriesUrl,
  hasPart:published.map(part=>({'@type':'BlogPosting',name:part.title,position:part.part,url:config.siteUrl.replace(/\/$/,'')+postHref(part.post)}))};
 const structuredHtml='<script type="application/ld+json">'+JSON.stringify(structured).replaceAll('<','\\u003c')+'</script>';
 const html=header('Journal')+
  '<main id="content" class="journal-series-page">'+
  '<div class="journal-series-back"><a href="/category/journal">← Journal Series</a><span>VAMSI’S CORNER / THE JOURNAL</span></div>'+
  '<section class="journal-series-intro" aria-labelledby="journal-series-name">'+cover+
  '<div class="journal-series-intro-body"><p class="journal-series-kicker">A JOURNAL SERIES</p>'+
  '<h1 id="journal-series-name">'+e(series.title)+'<span>.</span></h1>'+
  '<p class="journal-series-subtitle">'+e(series.subtitle)+'</p>'+
  '<div class="journal-series-meta"><span>▣ '+series.total+' parts</span><span>✧ Personal series</span><span>◷ Ongoing</span></div>'+
  (first?'<a class="journal-series-start" href="'+postHref(first.post)+'">Start reading <span aria-hidden="true">↗</span></a>':'<p class="journal-series-coming">The first chapter is coming soon.</p>')+
  (series.slug==='learning-everything-doing-nothing'?'<blockquote class="journal-series-quote"><span aria-hidden="true">“</span><p>Learning gives me a sense of accomplishment. Execution demands proof.</p></blockquote>':'')+'</div></section>'+
  '<section class="journal-series-index" aria-labelledby="journal-series-parts"><div class="journal-series-index-heading"><span>THE COMPLETE JOURNAL</span><h2 id="journal-series-parts">Series chapters<span>.</span></h2><p>Read each part in order. New chapters will appear here when they are published.</p></div>'+
  '<div class="journal-series-chapters">'+items+'</div></section>'+
  '<section class="journal-series-about"><p class="journal-series-kicker">ABOUT THIS STORY</p><h2>Some beginnings take time.</h2><p>'+e(series.description)+'</p><a href="/category/journal">Explore more Journal stories <span aria-hidden="true">↗</span></a></section>'+
  '</main>'+footer()+searchDialog()+'<div class="toast-stack" id="toast-stack" aria-live="polite"></div>'+structuredHtml;
 return basePage({title:series.title+' — Journal Series',description:series.subtitle,path:seriesUrl,content:html,initial:{page:'series',seriesSlug:series.slug},socialImage:photo?config.siteUrl.replace(/\/$/,'')+photo:''});
}
