import {simplePage,basePage,header,footer,escapeHtml} from './ui.mjs';
const e=escapeHtml;
const asset=(key)=>'/media/'+encodeURIComponent(key);
const empty=(title)=>'<div class="v3m-empty"><span class="v3m-tile" aria-hidden="true">✳</span><h2>'+e(title)+'</h2><p>More memories will find their place here.</p></div>';
const hero=(kicker,title,lead)=>'<header class="v3m-hero"><p class="eyebrow">'+e(kicker)+'</p><h1>'+e(title)+'<span>.</span></h1><p>'+e(lead)+'</p></header>';
export function timelinePage(memories,query={}){
 const data=memories.timeline(query);
 const years='<nav class="v3m-years" aria-label="Years"><a href="/timeline"'+(!query.year?' aria-current="page"':'')+'>All</a>'+data.years.map(y=>'<a href="/timeline?year='+e(y.year)+'"'+(query.year===y.year?' aria-current="page"':'')+'>'+e(y.year)+'</a>').join('')+'</nav>';
 const kinds=['personal','build','work','learning','celebration'];
 const filters='<form action="/timeline" method="get" class="v3m-filters"><label>Category<select name="kind"><option value="">All moments</option>'+kinds.map(k=>'<option value="'+k+'"'+(k===query.kind?' selected':'')+'>'+e(k.slice(0,1).toUpperCase()+k.slice(1))+'</option>').join('')+'</select></label><button type="submit">Filter ↗</button></form>';
 const items=data.items.map(m=>'<article class="v3m-event"><time datetime="'+e(m.occurredOn)+'">'+e(m.occurredOn)+'</time><div><span class="v3m-kind">'+e(m.kind)+'</span><h2>'+e(m.title)+'</h2>'+(m.summary?'<p>'+e(m.summary)+'</p>':'')+(m.postSlug?'<a href="/post/'+encodeURIComponent(m.postSlug)+'">Read story ↗</a>':'')+'</div></article>').join('');
 return simplePage({path:'/timeline',title:'Life Timeline',lead:'A living record of the moments that mattered.',body:'<div class="v3m-content">'+years+filters+'<section class="v3m-timeline" aria-label="Published milestones">'+(items||empty('A little ahead of us'))+'</section></div>'});
}
export function albumsPage(memories){
 const rows=memories.albums().map(a=>{
  const first=a.images[0];
  return '<a class="v3m-album" href="/moments/'+encodeURIComponent(a.slug)+'"><img loading="lazy" decoding="async" src="'+asset(first.storageKey)+'" alt="'+e(first.alt||a.title)+'"><div><span>'+a.images.length+' photos</span><h2>'+e(a.title)+'</h2><p>'+e(a.summary)+'</p></div></a>';
 }).join('');
 return simplePage({title:'Moments Gallery',path:'/moments',lead:'Photographs and little memories.',body:'<div class="v3m-content">'+'<section class="v3m-albums" aria-label="Public albums">'+(rows||empty('More to remember'))+'</section></div>'});
}
export function albumPage(memories,slug){
 const a=memories.album(slug);
 const items=a.images.map((m,i)=>'<button type="button" class="v3m-photo" data-v3m-photo data-src="'+e(asset(m.storageKey))+'" data-alt="'+e(m.alt||a.title)+'" data-caption="'+e(m.caption||'')+'" aria-label="Enlarge '+e(m.alt||'photo '+(i+1))+'"><img loading="lazy" decoding="async" src="'+asset(m.storageKey)+'" alt="'+e(m.alt||a.title)+'"></button>').join('');
 const dialog='<dialog class="v3m-lightbox" data-v3m-lightbox aria-label="Photograph"><button type="button" data-v3m-close aria-label="Close photograph">×</button><figure><img alt=""><figcaption></figcaption></figure></dialog>';
 return simplePage({title:a.title,path:'/moments/'+a.slug,lead:a.summary||'Moments worth holding close.',body:'<div class="v3m-content"><a class="v3m-back" href="/moments">← All albums</a>'+'<div class="v3m-gallery" aria-label="Album photographs">'+items+'</div>'+dialog+'</div>'});
}
export function collectionsPage(memories){
 const rows=memories.collections().map(c=>'<a class="v3m-collection" href="/collections/'+encodeURIComponent(c.slug)+'"><span class="v3m-tile" aria-hidden="true">↗</span><div><small>'+c.posts.length+' STORIES</small><h2>'+e(c.title)+'</h2><p>'+e(c.summary)+'</p></div></a>').join('');
 return simplePage({title:'Collections',path:'/collections',lead:'Stories that belong together.',body:'<div class="v3m-content">'+'<section class="v3m-collections">'+(rows||empty('A series starts here'))+'</section></div>'});
}
export function collectionPage(memories,slug){
 const c=memories.collection(slug);
 const items=c.posts.map((p,i)=>'<article class="v3m-series-item"><span>'+String(i+1).padStart(2,'0')+'</span><div><small>'+e(p.category)+'</small><h2><a href="/post/'+encodeURIComponent(p.slug)+'">'+e(p.title)+'</a></h2><p>'+e(p.excerpt||'')+'</p></div><a href="/post/'+encodeURIComponent(p.slug)+'" aria-label="Read '+e(p.title)+'">↗</a></article>').join('');
 return simplePage({title:c.title,path:'/collections/'+c.slug,lead:c.summary||'Read in order.',body:'<div class="v3m-content"><a class="v3m-back" href="/collections">← All collections</a>'+'<section class="v3m-series">'+items+'</section></div>'});
}
export function nowHistoryPage(memories,current){
 const rows=memories.nowHistory().map(x=>'<article class="v3m-now-item"><time>'+e(x.changedAt.slice(0,10))+'</time><span aria-hidden="true">'+e(x.icon)+'</span><div><h2>'+e(x.label)+'</h2><p>'+e(x.detail)+'</p></div></article>').join('');
 return simplePage({title:'Now',path:'/now',lead:current?.label||'What is happening in this little corner.',body:'<div class="v3m-content">'+'<section class="v3m-now-history"><h2>Earlier updates</h2>'+(rows||empty('The first update is coming'))+'</section></div>'});
}
const option=(value,name,selected='')=>'<option value="'+e(value)+'"'+(value===selected?' selected':'')+'>'+e(name)+'</option>';
const kindOptions=['personal','build','work','learning','celebration'].map(x=>option(x,x)).join('');
const stateOptions=['draft','published','archived'].map(x=>option(x,x)).join('');
const adminEntry=(label,items,type)=>{
 const name={milestones:'occurred_on',albums:'slug',collections:'slug'}[type];
 return '<section class="v3m-admin-list"><h2>'+e(label)+' <small>'+items.length+'</small></h2>'+items.map(x=>'<article><div><strong>'+e(x.title)+'</strong><small>'+e(x.state)+' · '+e(x[name]||'')+'</small></div><button type="button" data-v3m-edit="'+type+'" data-id="'+e(x.id)+'" data-fields="'+e(JSON.stringify(x))+'">Edit ↗</button></article>').join('')+'</section>';
};
export function memoriesStudioPage(memories,user){
 memories.owner(user);
 const milestones=memories.adminMilestones(user),albums=memories.adminAlbums(user),collections=memories.adminCollections(user);
 const published=memories.store.all("SELECT id,title FROM posts WHERE state='published' ORDER BY published_at DESC LIMIT 120");
 const media=memories.store.all("SELECT m.id,m.alt_text,p.title FROM media m JOIN posts p ON p.id=m.owner_id WHERE m.owner_type='post' AND p.state='published' AND m.mime_type LIKE 'image/%' ORDER BY m.created_at DESC LIMIT 120");
 const milestone='<form class="v3m-form" data-v3m-form="milestones"><h2>Milestone</h2><label>Title<input name="title" maxlength="130" required></label><label>Date<input name="occurredOn" type="date" required></label><label>Category<select name="kind">'+kindOptions+'</select></label><label>Story (optional)<select name="postId">'+option('','None')+published.map(p=>option(p.id,p.title)).join('')+'</select></label><label>Short note<textarea name="summary" maxlength="350"></textarea></label><label>Visibility<select name="state">'+stateOptions+'</select></label><button type="submit">Save milestone ↗</button><p role="status"></p></form>';
 const album='<form class="v3m-form" data-v3m-form="albums"><h2>Photo album</h2><label>Title<input name="title" maxlength="110" required></label><label>Short note<textarea name="summary" maxlength="350"></textarea></label><label>Published story images<select name="mediaIds" multiple size="6">'+media.map(m=>option(m.id,m.alt_text||m.title)).join('')+'</select></label><small>Hold Ctrl / Cmd to choose multiple. Only publicly published story media is eligible.</small><label>Visibility<select name="state">'+stateOptions+'</select></label><button type="submit">Save album ↗</button><p role="status"></p></form>';
 const collection='<form class="v3m-form" data-v3m-form="collections"><h2>Reading series</h2><label>Title<input name="title" maxlength="110" required></label><label>Short note<textarea name="summary" maxlength="350"></textarea></label><label>Published stories<select name="postIds" multiple size="6">'+published.map(p=>option(p.id,p.title)).join('')+'</select></label><small>Selected stories appear in selection order; reorder through the API.</small><label>Visibility<select name="state">'+stateOptions+'</select></label><button type="submit">Save collection ↗</button><p role="status"></p></form>';
 const history=memories.adminNowHistory(user);
 const body=header()+'<main id="content" class="shell v3m-studio"><div class="v3m-content"><a href="/admin" class="v3m-back">← Studio</a>'+hero('STUDIO / MEMORIES','Memories Studio','Timeline, albums and reading series.')+'<div class="v3m-form-grid">'+milestone+album+collection+'</div><div class="v3m-admin-grids">'+adminEntry('Milestones',milestones,'milestones')+adminEntry('Albums',albums,'albums')+adminEntry('Collections',collections,'collections')+'</div><section class="v3m-admin-list"><h2>Now history</h2><p>Use the existing Studio status editor to publish Now updates.</p>'+history.slice(0,25).map(x=>'<article><strong>'+e(x.label||'Inactive')+'</strong><small>'+e(x.updated_at||x.changed_at)+'</small></article>').join('')+'</section></div></main>'+footer();
 return basePage({title:'Memories Studio',path:'/admin/v3/memories',content:body,noindex:true});
}
