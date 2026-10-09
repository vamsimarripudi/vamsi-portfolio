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
