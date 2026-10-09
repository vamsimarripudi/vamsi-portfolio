import {simplePage,basePage,header,footer,escapeHtml} from './ui.mjs';
const esc=escapeHtml;
const e=escapeHtml;
function option(value,label,selected=''){
 return '<option value="'+esc(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+esc(label)+'</option>';
}
export function searchPage(v3,query={}){
 const found=v3.search(query),years=v3.archive().years;
 const filters='<form class="v3-explore-form" method="get" action="/search" role="search">'+
 '<label class="v3-wide"><span>Search the Corner</span><input type="search" name="q" maxlength="100" placeholder="A thought, idea, moment…" value="'+esc(query.q||'')+'" /></label>'+
 '<label><span>Collection</span><select name="category">'+option('','All collections',query.category)+['Wishes','Builds','Notes','Journal','Moments'].map(x=>option(x,x,query.category)).join('')+'</select></label>'+
 '<label><span>Year</span><select name="year">'+option('','All years',query.year)+years.map(x=>option(x.year,x.year,query.year)).join('')+'</select></label>'+
 '<label><span>Tag</span><input type="text" name="tag" maxlength="35" placeholder="Optional" value="'+esc(query.tag||'')+'" /></label>'+
 '<button type="submit" class="v3-icon-action" aria-label="Search public stories"><span aria-hidden="true">⌕</span> Explore</button></form>';
 const cards=found.items.map((post,i)=>'<article class="v3-result"><div><span class="v3-result-type">'+esc(post.type.replaceAll('_',' '))+'</span><h3><a href="/post/'+encodeURIComponent(post.slug)+'">'+esc(post.title)+'</a></h3><p>'+esc(post.excerpt||'')+'</p></div><a class="v3-result-arrow" href="/post/'+encodeURIComponent(post.slug)+'" aria-label="Read '+esc(post.title)+'">↗</a></article>').join('');
 const more=found.nextCursor?'<a class="v3-result-more" rel="next" href="/search?q='+encodeURIComponent(query.q||'')+'&category='+encodeURIComponent(query.category||'')+'&year='+encodeURIComponent(query.year||'')+'&tag='+encodeURIComponent(query.tag||'')+'&cursor='+encodeURIComponent(found.nextCursor)+'">More results ↓</a>':'';
 const body='<div class="v3-explorer">'+filters+'<section class="v3-search-results"><header><h2>'+found.total+' '+(found.total===1?'story':'stories')+'</h2><a href="/archive">Browse archive ↗</a></header>'+(cards||'<div class="v3-empty-reader"><span aria-hidden="true">✳</span><h3>Nothing matching yet.</h3><p>Try a different word or explore the archive.</p></div>')+more+'</section></div>';
 return simplePage({title:'Explore',lead:'Find stories, moments and ideas worth keeping.',path:'/search',body});
}
export function archivePage(v3,year='',cursor=''){
 const data=v3.archive(year,cursor);
 const links=data.years.map(x=>'<a class="v3-year" href="/archive?year='+esc(x.year)+'"'+(year===x.year?' aria-current="page"':'')+'><strong>'+esc(x.year)+'</strong><span>'+Number(x.total)+' notes</span><small aria-hidden="true">↗</small></a>').join('');
 const posts=data.items.map(x=>'<a class="v3-archive-post" href="/post/'+encodeURIComponent(x.slug)+'"><span>'+esc(x.title)+'</span><span aria-hidden="true">↗</span></a>').join('');
 const more=data.nextCursor?'<a class="v3-result-more" rel="next" href="/archive?year='+encodeURIComponent(year)+'&cursor='+encodeURIComponent(data.nextCursor)+'">More memories ↓</a>':'';
 return simplePage({title:'Archive',lead:'An intentional record of things worth remembering.',path:'/archive',body:'<div class="v3-explorer"><nav class="v3-year-grid" aria-label="Published years">'+(links||'<p>First memories will be added here.</p>')+'</nav>'+(year?'<section class="v3-archive-list"><h2>'+esc(year)+' in notes</h2>'+(posts||'<p>No public posts in this year.</p>')+more+'</section>':'')+'</div>'});
}
export function guestbookPage(v3){
  const notes=v3.listGuestbook().map(n=>'<article class="v3-note"><p>'+e(n.message)+'</p><small>'+e(n.name)+'</small></article>').join('');
  const form='<form data-v3="guestbook" class="v3-guestbook-form"><h2>Leave a kind word</h2><p>Every note is reviewed before publication.</p>'+
    '<label>Name (optional)<input name="name" maxlength="60" autocomplete="name"></label>'+
    '<label>Message<textarea name="message" minlength="5" maxlength="500" required></textarea></label>'+
    '<div class="v3-trap" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>'+
    '<label class="v3-checkbox"><input name="consent" type="checkbox" required> My note may be published after review.</label>'+
    '<button type="submit">Send note ↗</button><p class="v3-feedback" role="status"></p></form>';
  return simplePage({title:'Guestbook',lead:'A little place for kind words.',path:'/guestbook',body:form+'<section class="v3-guestbook" aria-label="Approved notes">'+(notes||'<p>No notes published yet.</p>')+'</section>'});
}
export function guestbookModerationPage(v3,user){
  const notes=v3.reviewQueue(user);
  const cards=notes.map(n=>'<article class="v3-note" data-v3-review="'+e(n.id)+'"><small>'+e(n.name)+' · '+e(n.createdAt.slice(0,10))+'</small><p>'+e(n.message)+'</p>'+
    '<div class="v3-review-actions"><button type="button" data-v3-moderate="approved" data-v3-id="'+e(n.id)+'">Approve</button>'+
    '<button type="button" data-v3-moderate="hidden" data-v3-id="'+e(n.id)+'">Hide</button></div><p class="v3-feedback" role="status"></p></article>').join('');
  const markup=header()+'<main id="content" class="shell simple-page v3-moderation"><p class="eyebrow">STUDIO / MODERATION</p>'+
    '<h1>Guestbook<span>.</span></h1><p class="simple-lede">Review each public note before publication.</p>'+
    '<a href="/admin">← Studio</a><section aria-label="Pending notes" class="v3-content"><h2>'+notes.length+' awaiting review</h2>'+
    (cards||'<p>Nothing awaiting review.</p>')+'</section></main>'+footer();
  return basePage({title:'Guestbook review',path:'/admin/v3/guestbook',content:markup,noindex:true});
}
export function followPage(){
  const topics='<fieldset class="v3-topics"><legend>Topics</legend>'+[['notes','Notes'],['moments','Moments'],['wishes','Wishes'],['builds','Builds']].map(([id,label])=>
    '<label><input type="checkbox" name="topics" value="'+id+'">'+label+'</label>').join('')+
    '<small>Leave all unchecked for every topic.</small></fieldset>';
  const body='<section class="v3-follow"><h2>Follow this corner</h2><p>Only the topics you select, after email confirmation.</p>'+
    '<form data-v3="follow"><label>Email<input name="email" type="email" maxlength="254" required autocomplete="email"></label>'+topics+
    '<label>Frequency<select name="frequency"><option value="weekly">Weekly</option><option value="instant">On publication</option></select></label>'+
    '<label class="v3-checkbox"><input type="checkbox" name="consent" required> I opt in to publication updates.</label>'+
    '<button type="submit">Confirm my email ↗</button><p class="v3-feedback" role="status"></p></form><hr>'+
    '<form data-v3="unsub-request"><label>Email<input type="email" name="email" required autocomplete="email"></label>'+
    '<button type="submit">Send an unsubscribe link</button><p class="v3-feedback" role="status"></p></form></section>';
  return simplePage({title:'Follow',lead:'Stay close to the little things.',path:'/follow',body});
}
export function followConfirmPage(){
  return simplePage({title:'Confirm following',lead:'Finish the email opt-in.',path:'/follow/confirm',body:'<section data-v3-confirm><button type="button" data-v3-verify>Confirm subscription ↗</button><p class="v3-feedback" role="status"></p></section>'});
}
export function unsubscribePage(){
  return simplePage({title:'Unsubscribe',lead:'Control what reaches your inbox.',path:'/follow/unsubscribe',body:'<section data-v3-unsubscribe><p>Use the link from your email to confirm.</p><button type="button" data-v3-unsubscribe-button>Unsubscribe ↗</button><p class="v3-feedback" role="status"></p></section>'});
}
