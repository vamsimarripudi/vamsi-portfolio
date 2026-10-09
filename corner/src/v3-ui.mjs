import {simplePage,escapeHtml} from './ui.mjs';
export function searchPage(v3,query={}) {
  const matches=v3.search(query);
  const rows=matches.items.map(p=>'<p><a href="/post/'+encodeURIComponent(p.slug)+'">'+escapeHtml(p.title)+'</a></p>').join('');
  const form='<form action="/search" method="get"><label>Find a story <input name="q" maxlength="100" type="search" value="'+escapeHtml(query.q||'')+'"></label> <button type="submit">Search ↗</button></form>';
  return simplePage({title:'Explore',lead:'Discover public stories, memories, ideas.',path:'/search',body:form+'<h2>'+matches.total+' results</h2>'+(rows||'<p>No matching stories.</p>')});
}
export function archivePage(v3,year=''){
  const data=v3.archive(year);
  const years=data.years.map(v=>'<a href="/archive?year='+escapeHtml(v.year)+'">'+escapeHtml(v.year)+'</a>').join(' · ');
  const rows=data.items.map(p=>'<p><a href="/post/'+encodeURIComponent(p.slug)+'">'+escapeHtml(p.title)+'</a></p>').join('');
  return simplePage({title:'Archive',lead:'What happened, and when.',path:'/archive',body:'<nav>'+years+'</nav>'+rows});
}
export function guestbookPage(v3) {
  const messages=v3.listGuestbook().map(note=>'<article class="v3-note"><p>'+escapeHtml(note.message)+'</p><small>'+escapeHtml(note.name)+'</small></article>').join('');
  const form='<h2>Leave a kind word</h2><p>Every note is reviewed before publication.</p><form data-v3="guestbook"><label>Name<input name="name" minlength="2" maxlength="60" required></label><label>Message<textarea name="message" minlength="5" maxlength="500" required></textarea></label><label><input name="consent" type="checkbox" required> My note may be published after review.</label><button type="submit">Send note ↗</button><p class="v3-feedback" role="status"></p></form>';
  return simplePage({title:'Guestbook',lead:'A little place for kind words.',path:'/guestbook',body:form+'<section class="v3-guestbook">'+messages+'</section>'});
}
