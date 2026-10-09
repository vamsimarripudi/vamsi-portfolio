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
export function followPage(){
  const body='<section class="v3-follow"><h2>Follow this corner</h2><p>Updates you choose, only after email confirmation. Unsubscribe any time.</p><form data-v3="follow"><label>Email<input type="email" name="email" maxlength="254" required></label><label>Frequency<select name="frequency"><option value="weekly">Weekly</option><option value="instant">On publication</option></select></label><label><input name="consent" type="checkbox" required> I opt in to publication updates.</label><button type="submit">Confirm my email ↗</button><p class="v3-feedback" role="status"></p></form><hr><form data-v3="unsub-request"><label>Email<input type="email" name="email" required></label><button type="submit">Send an unsubscribe link</button><p class="v3-feedback" role="status"></p></form></section>';
  return simplePage({title:'Follow',lead:'Stay close to the little things.',path:'/follow',body});
}
export function followConfirmPage(){
  return simplePage({title:'Confirm following',lead:'Finish the email opt-in.',path:'/follow/confirm',body:'<section data-v3-confirm><button type="button" data-v3-verify>Confirm subscription ↗</button><p class="v3-feedback" role="status"></p></section>'});
}
export function unsubscribePage(){
  return simplePage({title:'Unsubscribe',lead:'Choose which notes reach your inbox.',path:'/follow/unsubscribe',body:'<section data-v3-unsubscribe><p>Use the link from your email to confirm.</p><button type="button" data-v3-unsubscribe-button>Unsubscribe ↗</button><p class="v3-feedback" role="status"></p></section>'});
}
