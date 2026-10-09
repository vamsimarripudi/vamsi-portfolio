import {simplePage,basePage,header,footer,escapeHtml} from './ui.mjs';
const e=escapeHtml;
const categories=['Latest','Wishes','Builds','Notes','Journal','Moments'];
const articles=items=>items.length?'<div class="v3-content">'+items.map(p=>'<article class="v3-note"><small>'+e(p.category)+' · '+e((p.published_at||'').slice(0,10))+'</small><h2><a href="/post/'+encodeURIComponent(p.slug)+'">'+e(p.title)+'</a></h2>'+(p.excerpt?'<p>'+e(p.excerpt)+'</p>':'')+'</article>').join('')+'</div>':'<p class="v3-empty">No public stories match these filters.</p>';

export function searchPage(v3,query={}){
  const result=v3.search(query),category=String(query.category||'Latest');
  const options=categories.map(c=>'<option value="'+e(c)+'"'+(category===c?' selected':'')+'>'+e(c==='Latest'?'All':c)+'</option>').join('');
  const form='<form action="/search" method="get" role="search" class="v3-filter">'+
    '<label>Search<input name="q" type="search" maxlength="100" value="'+e(query.q||'')+'" placeholder="A word, a memory…"></label>'+
    '<label>Year<input name="year" type="text" inputmode="numeric" pattern="(19|20)[0-9]{2}" maxlength="4" value="'+e(query.year||'')+'" placeholder="Any year"></label>'+
    '<label>Category<select name="category">'+options+'</select></label>'+
    '<label>Tag<input name="tag" maxlength="35" value="'+e(query.tag||'')+'" placeholder="Any tag"></label>'+
    '<button type="submit">Explore ↗</button></form>';
  const params=new URLSearchParams({q:String(query.q||''),category,year:String(query.year||''),tag:String(query.tag||''),cursor:result.nextCursor||''});
  const more=result.nextCursor?'<a class="v3-next" rel="next" href="/search?'+e(params.toString())+'">More stories ↓</a>':'';
  return simplePage({title:'Explore',lead:'Discover public stories, memories, ideas.',path:'/search',body:form+'<h2 class="v3-results-heading">'+result.total+' '+(result.total===1?'story':'stories')+'</h2>'+articles(result.items)+more});
}
export function archivePage(v3,year='',cursor=''){
  const result=v3.archive(year,cursor);
  const years=result.years.map(y=>'<a href="/archive?year='+encodeURIComponent(y.year)+'"'+(y.year===year?' aria-current="page"':'')+'>'+e(y.year)+' <small>'+Number(y.total)+'</small></a>').join('');
  const more=result.nextCursor?'<a class="v3-next" rel="next" href="/archive?year='+encodeURIComponent(year)+'&amp;cursor='+encodeURIComponent(result.nextCursor)+'">More memories ↓</a>':'';
  return simplePage({title:'Archive',lead:'What happened, and when.',path:'/archive',body:'<nav class="v3-years" aria-label="Publication years">'+(years||'<p>More moments to come.</p>')+'</nav>'+(year?articles(result.items)+more:'<p>Choose a year to explore the archive.</p>')});
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
