import {studioSidebar} from './studio-ui.mjs';
import { config } from './config.mjs';
import { typeLabels, CATEGORIES, REACTIONS, statuses, now } from './domain.mjs';
export function escapeHtml(value=''){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
const e=escapeHtml;
const dateLabel=(value)=>value?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:config.timezone}).format(new Date(value)):'';
const icon=(name)=>({arrow:'↗',right:'→',down:'↓',more:'···',search:'⌕',plus:'＋',close:'×'}[name]||name);
export const samples=()=>[
 {id:'sample-1',slug:'sample-a-small-new-beginning',type:'announcement',title:'A small new beginning.',excerpt:'A quiet space for what matters next.',body:'A place to collect short updates, ideas, and good things worth remembering. This is illustrative sample copy for local preview only.',emoji:'✳',published_at:new Date(Date.now()-2*3600000).toISOString(),featured:true,pinned:false,allow_comments:true,allow_reactions:true,version:1,tags:['Sample','Corner'],demo:true},
 {id:'sample-2',slug:'sample-here-is-to-good-news',type:'wish',title:'Here’s to good news. ✨',excerpt:'For the little wins, and all the ones still coming.',body:'A short example wish. Scheduling will automatically publish real wishes at the exact selected time.',emoji:'✨',published_at:new Date(Date.now()-22*3600000).toISOString(),featured:false,pinned:false,allow_comments:false,allow_reactions:true,version:1,tags:['Sample'],demo:true},
 {id:'sample-3',slug:'sample-build-note-001',type:'build',title:'It starts small.',excerpt:'01 / Building the corner',body:'An illustrative build note for the interface preview.',emoji:'↗',published_at:new Date(Date.now()-2*86400000).toISOString(),featured:false,pinned:false,allow_comments:false,allow_reactions:true,version:1,tags:['Sample','Building'],demo:true},
 {id:'sample-4',slug:'sample-simple-systems',type:'tech_note',title:'Simple systems age well.',excerpt:'A tiny idea worth keeping.',body:'Good systems make the hard things possible without making the easy things complicated. This text is an example.',emoji:'⌘',published_at:new Date(Date.now()-4*86400000).toISOString(),featured:false,pinned:false,allow_comments:false,allow_reactions:true,version:1,tags:['Sample','Notes'],demo:true},
 {id:'sample-5',slug:'sample-one-little-moment',type:'moment',title:'One little moment.',excerpt:'Some things deserve a space of their own.',body:'A sample moment card. Published moments can have real images or video, with focal points and captions.',emoji:'☼',published_at:new Date(Date.now()-8*86400000).toISOString(),featured:false,pinned:false,allow_comments:true,allow_reactions:true,version:1,tags:['Sample'],demo:true},
 {id:'sample-6',slug:'sample-reflection',type:'journal',title:'On noticing more.',excerpt:'Finding meaning in quieter details.',body:'An example journal entry. Long-form writing belongs inside the post, not all over the feed.',emoji:'✺',published_at:new Date(Date.now()-16*86400000).toISOString(),featured:false,pinned:false,allow_comments:false,allow_reactions:true,version:1,tags:['Sample'],demo:true},
];
const safeLink=(slug)=>'/post/'+encodeURIComponent(slug);
export function renderStoryBody(body=''){
  return String(body||'').split(/\n{2,}/).map((section,index)=>{
    if(index===0&&/^>\s+\S/.test(section)){
      const words=section.replace(/^>\s*/, '').trim();
      return '<figure class="corner-quote"><span aria-hidden="true">“</span><blockquote>'+e(words)+'</blockquote></figure>';
    }
    return '<p>'+e(section).replace(/\n/g,'<br>')+'</p>';
  }).join('');
}
export function renderMedia(media=[]){if(!media.length)return '';const m=media[0],src='/media/'+encodeURIComponent(m.storage_key);return m.mime_type.startsWith('video/')?`<div class="card-media"><video controls preload="none" playsinline aria-label="${e(m.alt_text||'Video')}"><source src="${src}" type="${e(m.mime_type)}"></video></div>`:`<div class="card-media"><img src="${src}" loading="lazy" alt="${e(m.alt_text||'Post image')}" style="object-position:${Number(m.focal_x||.5)*100}% ${Number(m.focal_y||.5)*100}%"></div>`}

/** Render every published post attachment without exposing unpublished drafts. */
export function renderPostGallery(media=[]){
  if(!media.length)return '';
  const photos=media.filter(m=>m.mime_type?.startsWith('image/'));
  let photoNumber=0;
  const slides=media.map((m,index)=>{
    const src='/media/'+encodeURIComponent(m.storage_key),alt=e(m.alt_text||'Post media');
    const caption=m.caption?'<figcaption>'+e(m.caption)+'</figcaption>':'<figcaption class="post-carousel-empty-caption" aria-hidden="true"></figcaption>';
    const width=Number(m.width),height=Number(m.height);
    const size=Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0?' width="'+width+'" height="'+height+'"':'';
    if(m.mime_type?.startsWith('video/')){
      return '<figure class="post-carousel-slide post-gallery-video" data-carousel-slide data-index="'+index+'">'+
        '<video controls playsinline preload="metadata" aria-label="'+alt+'"><source src="'+src+'" type="'+e(m.mime_type)+'"></video>'+caption+'</figure>';
    }
    const positionX=Math.round(Math.min(1,Math.max(0,Number(m.focal_x)||0.5))*100);
    const positionY=Math.round(Math.min(1,Math.max(0,Number(m.focal_y)||0.5))*100);
    const imageIndex=photoNumber++;
    return '<figure class="post-carousel-slide" data-carousel-slide data-index="'+index+'">'+
      '<button type="button" class="post-photo" data-post-photo data-caption="'+e(m.caption||'')+'" aria-haspopup="dialog" aria-label="View photograph '+(imageIndex+1)+' of '+photos.length+': '+alt+'">'+
      '<img src="'+src+'" alt="'+alt+'"'+size+' loading="'+(index===0?'eager':'lazy')+'" decoding="async" style="object-position:'+positionX+'% '+positionY+'%"></button>'+caption+'</figure>';
  }).join('');
  const controls=media.length>1?'<button type="button" class="post-carousel-arrow post-carousel-prev" data-carousel-prev aria-label="Previous media">‹</button>'+
    '<button type="button" class="post-carousel-arrow post-carousel-next" data-carousel-next aria-label="Next media">›</button>'+
    '<span class="post-carousel-count" data-carousel-count aria-live="polite">1 / '+media.length+'</span>'+
    '<div class="post-carousel-dots" role="group" aria-label="Choose media">'+media.map((_,i)=>'<button type="button" data-carousel-dot="'+i+'" aria-label="Show media '+(i+1)+'" aria-current="'+(i===0?'true':'false')+'"></button>').join('')+'</div>':'';
  const lightbox=photos.length?'<dialog class="post-lightbox" data-post-lightbox aria-label="Post photographs">'+
    '<button type="button" class="post-lightbox-close" data-post-close aria-label="Close photograph">×</button>'+
    '<figure><img alt=""><figcaption></figcaption></figure>'+
    '<nav class="post-lightbox-controls" aria-label="Photo navigation">'+
    '<button type="button" data-post-prev aria-label="Previous photograph">←</button><span data-post-counter aria-live="polite"></span><button type="button" data-post-next aria-label="Next photograph">→</button></nav></dialog>':'';
  return '<section class="post-media-gallery post-media-carousel" data-post-carousel aria-label="Story media carousel">'+
    '<div class="post-carousel-frame"><div class="post-carousel-track" data-carousel-track tabindex="0" aria-label="Swipe or use arrow keys to browse media">'+slides+'</div>'+controls+'</div>'+lightbox+'</section>';
}

export function card(post,index=0,{featured=false,reactions={},comments=0,media=[],editorial=false}={}){
  const tag=post.demo?'SAMPLE':(statuses(post)[0]||'');
  const isHero=featured||!!post.featured;
  return `<article class="story ${isHero?'story-featured':''} story-${e(post.type)}" data-id="${e(post.id)}" data-version="${post.version||1}">
    <div class="story-top"><span class="meta category">${e(typeLabels[post.type]||'UPDATE')}</span>${tag?`<span class="status-tag">${e(tag)}</span>`:''}</div>
    ${!editorial&&!media.length&&(post.type==='moment'||(isHero&&post.type==='announcement'))?`<div class="story-art art-${e(post.type)}" aria-hidden="true"><span class="art-orbit art-orbit-a"></span><span class="art-orbit art-orbit-b"></span><span class="art-glyph">${e(post.emoji||'✳')}</span><span class="art-caption">${post.demo?'An illustrative visual':'VAMSI’S CORNER'}</span></div>`:''}
    ${editorial&&!media.length?`<div class="corner-story-visual corner-story-visual-${e(post.type)}" aria-hidden="true"><span>${e(post.emoji||'✳')}</span></div>`:''}
    ${renderMedia(media)}
    <div class="story-copy"><p class="story-count"><time datetime="${e(post.published_at||'')}" data-relative>${e(dateLabel(post.published_at))}</time></p>
    <h2><a href="${safeLink(post.slug)}">${e(post.title)}</a></h2>
    ${post.excerpt?`<p class="story-excerpt">${e(post.excerpt)}</p>`:''}
    <div class="story-bottom"><span class="read-meta">${post.type==='journal'?'JOURNAL':post.type==='build'?'BUILD LOG':'READ UPDATE'}</span><a class="read-link" href="${safeLink(post.slug)}" aria-label="Read ${e(post.title)}">Read <span aria-hidden="true">↗</span></a></div></div><div class="v5-card-actions">${post.allow_reactions!==false&&post.allow_reactions!==0?`<div class="reactions" data-post-id="${e(post.id)}"><button type="button" data-reaction="❤️" data-v5-like aria-label="Like story"><img src="/v5-heart.svg" class="v5-like-icon" alt="" width="22" height="22"><span>${Number(reactions['❤️']||0)}</span></button></div>`:''}${post.allow_comments!==false&&post.allow_comments!==0?`<a href="${safeLink(post.slug)}#conversation" data-v6-conversation data-post-id="${e(post.id)}" aria-label="Discuss ${e(post.title)}">Comment ↗</a>`:''}<button type="button" data-v5-share-post="${safeLink(post.slug)}" aria-label="Share ${e(post.title)}">Share ↗</button></div>
  </article>`;
}
export function basePage({title='',description='',path='/',content='',initial={},noindex=false,article=false,language='en',alternates=[],socialImage='',socialImageAlt='',publishedAt=''}){
  const fullTitle=title?title+' — '+config.siteTitle:config.siteTitle;
  const desc=description||'Thoughts, updates & celebrations — a quiet space for things worth keeping.';
  const canonical=config.siteUrl.replace(/\/$/,'')+path;
  const shareImage=socialImage||config.siteUrl.replace(/\/$/,'')+'/og.svg';
  const v6Public=/^\/(?:$|about$|now$|category\/[^/?]+$|post\/[^/?]+(?:\?lang=[^&]+)?$)/.test(path)&&process.env.CORNER_COMPANION_ENABLED!=='1';
  const state=JSON.stringify(initial).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
  return `<!doctype html><html lang="${e(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f8f7f3"><title>${e(fullTitle)}</title><meta name="description" content="${e(desc)}"><link rel="canonical" href="${e(canonical)}">${alternates.map(a=>'<link rel="alternate" hreflang="'+e(a.lang)+'" href="'+e(a.url)+'">').join('')}<meta property="og:type" content="${article?'article':'website'}"><meta property="og:site_name" content="${e(config.siteTitle)}"><meta property="og:title" content="${e(fullTitle)}"><meta property="og:description" content="${e(desc)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:image" content="${e(shareImage)}"><meta property="og:image:alt" content="${e(socialImageAlt||fullTitle)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${e(shareImage)}">${article&&publishedAt?`<meta property="article:published_time" content="${e(publishedAt)}">`:''}${noindex?'<meta name="robots" content="noindex,nofollow">':''}<link rel="alternate" type="application/rss+xml" title="Corner RSS" href="/rss.xml"><link rel="alternate" type="application/atom+xml" title="Corner Atom" href="/atom.xml"><link rel="icon" href="/mark.svg?v=vm-20261027" type="image/svg+xml"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/v5.css"><link rel="stylesheet" href="/v3.css"><link rel="stylesheet" href="/v3-memories.css">${initial.page==='wishes'?'<link rel="stylesheet" href="/v3-wishes.css">':''}${(['insights','languages'].includes(initial.page)||(initial.page==='detail'&&initial.hasLanguages))?'<link rel="stylesheet" href="/v3-phase4.css">':''}<link rel="stylesheet" href="/magic.css"><link rel="stylesheet" href="/motion.css">${(['detail','admin'].includes(initial.page))?'<link rel="stylesheet" href="/post-media.css">':''}${initial.page==='account'?'<link rel="stylesheet" href="/account.css">':''}<link rel="stylesheet" href="/refresh.css?v=20261026-clean1">${process.env.CORNER_COMPANION_ENABLED==='1'&&!path.startsWith('/admin')&&initial.page!=='account'?'<link rel="stylesheet" href="/companion.css">':''}${process.env.CORNER_COMPANION_ENABLED==='1'&&!path.startsWith('/admin')&&initial.page!=='account'?'<link rel="stylesheet" href="/companion.css">':''}${!path.startsWith('/admin')&&initial.page!=='account'?'<link rel="stylesheet" href="/landing.css?v=editorial1">':''}${initial.page==='account'?'<link rel="stylesheet" href="/account-quiet.css?v=quiet1">':''}${initial.page==='legal'?'<link rel="stylesheet" href="/legal.css?v=trust1">':''}${initial.page==='languages'?'<link rel="stylesheet" href="/v3-language-workbench.css">':''}<link rel="stylesheet" href="/v51-mobile.css?v=20261029">${v6Public?'<link rel="stylesheet" href="/v6-public.css"><link rel="stylesheet" href="/v6-motion.css">':''}<link rel="stylesheet" href="/comfort.css">${path.startsWith('/admin')||path==='/privacy'||['feed','detail'].includes(initial.page)?'<link rel="stylesheet" href="/analysis.css">':''}${path.startsWith('/admin')||initial.page==='detail'?'<link rel="stylesheet" href="/studio.css?v=20261026-clean1">':''}${path.startsWith('/admin')?'<link rel="stylesheet" href="/media-library.css?v=20261026-clean1">':''}${initial.page==='communications'?'<link rel="stylesheet" href="/communication-center.css">':''}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':article?'BlogPosting':'WebSite',name:fullTitle,url:canonical,description:desc,...(article?{image:shareImage,datePublished:publishedAt||undefined}: {})}).replaceAll('<','\\u003c')}</script><script>window.__CORNER__=${state}</script><script src="/app.js" defer></script><script src="/v5.js" defer></script><script src="/v51-mobile.js?v=20261029" defer></script>${v6Public?'<script src="/v6-motion.js" defer></script>':''}${v6Public&&initial.page==='feed'?'<script src="/v6-conversation.js" defer></script>':''}${v6Public&&initial.page==='detail'?'<script src="/v6-reader.js" defer></script>':''}${v6Public&&path==='/'&&process.env.CORNER_GRAVITY_ENABLED==='1'?'<script src="/v6-gravity.js" defer></script>':''}${initial.page==='detail'?'<script src="/post-gallery.js" defer></script>':''}<script src="/v3.js" defer></script><script src="/v3-memories.js" defer></script>${initial.page==='wishes'?'<script src="/v3-wishes.js" defer></script>':''}${initial.page==='languages'?'<script src="/v3-language-workbench.js" defer></script>':''}${initial.page==='communications'?'<script src="/communications.js" defer></script>':''}<script src="/nav.js" defer></script><script src="/motion.js" defer></script>${!path.startsWith('/admin')?'<script src="/experience.js" defer></script>':''}${process.env.CORNER_COMPANION_ENABLED==='1'&&!path.startsWith('/admin')&&initial.page!=='account'?'<script src="/companion.js" defer></script>':''}${initial.page==='account'?'<script src="/image-crop.js" defer></script>':''}</head><body class="corner-comfort${['/privacy','/cookies','/dpdp'].includes(path)?' corner-privacy':''}${initial.page==='legal'?' corner-legal':''}"><a class="skip-link" href="#content">Skip to content</a>${content}${!path.startsWith('/admin')?'<script type="module" src="/website-analytics.js"></script>':''}${['/privacy','/cookies','/dpdp'].includes(path)||['feed','detail'].includes(initial.page)?'<script src="/reading-analytics.js" defer></script>':''}${path.startsWith('/admin')||initial.page==='detail'?'<script src="/studio-motion.js" defer></script>':''}</body></html>`;
}
export function header(active='Latest',status=null){
  const paths={
    Latest:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    Wishes:'<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-4 0-6-2-6-4a2 2 0 0 1 4 0c0 2 2 4 2 4Zm0 0c4 0 6-2 6-4a2 2 0 0 0-4 0c0 2-2 4-2 4Z"/>',
    Builds:'<path d="m14 6 4 4M4 20l7-7M16 3l5 5-5 5-5-5zM2 22l7-7"/>',
    Notes:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    Journal:'<path d="M12 7a8 8 0 0 0-9-1v14a8 8 0 0 1 9 1 8 8 0 0 1 9-1V6a8 8 0 0 0-9 1Zm0 0v14"/>',
    Moments:'<path d="M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3.5"/>'
  };
  const railIcon=name=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.Latest}</svg>`;
  return `<header class="site-header corner-public-header"><div class="header-row"><div class="corner-brand-group"><button type="button" class="corner-rail-toggle" data-corner-rail-toggle aria-expanded="false" aria-controls="corner-rail-nav" aria-label="Open navigation"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><a class="brand" href="/" aria-label="Vamsi's Corner — Home"><span class="brand-mark brand-mark--vm" aria-hidden="true"><img class="corner-brand-image" src="/mark.svg?v=vm-20261027" width="46" height="46" alt=""></span><span class="brand-type"><strong>Vamsi’s Corner<span>.</span></strong><small>NOTES FROM THE IN-BETWEEN</small></span></a></div><div class="header-right"><a class="header-now" href="/now"><span class="live-dot"></span>${status?e(status.label):'A place to keep things'}</a><button type="button" class="icon-button" data-search-open aria-label="Open search"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.6 4.6"/></svg></button><div class="corner-profile-wrap"><button type="button" class="header-admin corner-profile-toggle" data-corner-profile-toggle aria-label="Open profile options" aria-expanded="false" aria-controls="corner-profile-card" aria-haspopup="true"><span class="corner-profile-trigger-avatar" data-profile-trigger-avatar hidden aria-hidden="true"></span><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.4 21v-2.2a7.6 7.6 0 0 1 15.2 0V21"/></svg></button><div id="corner-profile-card" class="corner-profile-card corner-profile-card--quiet" data-corner-profile-card aria-label="Account options" hidden><button type="button" class="corner-profile-dismiss" data-profile-dismiss aria-label="Close account menu">×</button>
  <div class="corner-menu-guest" data-profile-guest>
    <p class="corner-profile-kicker">YOUR QUIET SPACE</p><strong class="corner-profile-heading">Make yourself at home.</strong>
    <p class="corner-menu-subtitle">Sign in to save stories and make this space yours.</p>
    <a data-auth-open="login" href="/login">Sign in <span aria-hidden="true">↗</span></a>
    <a data-auth-open="register" href="/register">Create profile <span aria-hidden="true">＋</span></a>
  </div>
  <div class="corner-menu-member" data-profile-member hidden>
    <div class="corner-menu-identity"><span class="corner-menu-avatar" data-profile-menu-avatar aria-hidden="true">M</span><div><p class="corner-profile-kicker">YOUR CORNER</p><strong data-profile-menu-name>My account</strong><small>Private profile</small></div></div>
    <a data-profile-link href="/profile" hidden>My profile</a>
    <a href="/saved">Saved stories <span aria-hidden="true">↗</span></a>
    <a href="/settings/preferences">Preferences <span aria-hidden="true">↗</span></a>
    <a href="/settings/security">Security <span aria-hidden="true">↗</span></a>
    <a data-owner-studio href="/admin" hidden>Studio <span aria-hidden="true">↗</span></a>
    <div class="corner-profile-divider"></div>
    <button type="button" class="corner-menu-signout" data-profile-logout>Sign out <span aria-hidden="true">↗</span></button>
  </div>
  <div class="corner-profile-divider"></div>
  <a href="mailto:connect@vamsimarripudi.me">Say hello <span aria-hidden="true">↗</span></a>
  <p class="corner-menu-notice" data-profile-notice role="status" aria-live="polite"></p>
</div></div></div></div><div class="corner-rail-backdrop" data-corner-rail-backdrop hidden></div><nav class="category-tabs corner-rail" id="corner-rail-nav" aria-label="Content categories"><div class="corner-rail-heading"><div><small>VAMSI’S CORNER</small><strong>Explore the space.</strong></div><button type="button" data-corner-rail-close aria-label="Close navigation">×</button></div>${CATEGORIES.map(cat=>`<a href="${cat==='Latest'?'/':'/category/'+encodeURIComponent(cat.toLowerCase())}" class="corner-rail-link${active===cat?' is-active':''}" aria-label="${e(cat)}"${active===cat?' aria-current="page"':''}><span class="corner-rail-icon">${railIcon(cat)}</span><span class="corner-rail-label">${e(cat)}</span></a>`).join('')}<p class="corner-rail-foot">Little notes, worth keeping.</p></nav></header>`;
}
export function footer(){return `<footer class="site-footer"><div><a class="footer-brand" href="/">Vamsi’s Corner<span>.</span></a><p>A small place for big and little things.</p></div><div class="footer-links"><a href="/about">About</a><a data-auth-open="login" href="/login">Sign in</a><a data-auth-open="register" href="/register">Register</a><a data-profile-link href="/profile" hidden>Profile</a>${process.env.CORNER_V3_SEARCH==='1'?'<a href="/search">Explore</a><a href="/archive">Archive</a>':''}${process.env.CORNER_V3_MEMORIES==='1'?'<a href="/timeline">Timeline</a><a href="/moments">Moments</a><a href="/collections">Collections</a>':''}${process.env.CORNER_V3_GUESTBOOK==='1'?'<a href="/guestbook">Guestbook</a>':''}${process.env.CORNER_V3_FOLLOW==='1'?'<a href="/follow">Follow</a>':''}<a href="/policies">Legal & Trust</a><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><a href="/dpdp">India DPDP</a><a href="/terms">Terms</a><a href="/privacy#reading-preferences">Privacy choices</a><a href="mailto:connect@vamsimarripudi.me">Say hello ↗</a></div><p class="footer-meta">Made with care. <span>© ${new Date().getFullYear()} Vamsi Marripudi</span></p><div class="site-preferences-slot" data-website-preferences></div></footer>`}
export function searchDialog(){return `<dialog class="search-dialog" id="search-dialog" aria-labelledby="search-heading"><div class="search-dialog-head"><p id="search-heading">SEARCH THE CORNER</p><button data-search-close aria-label="Close search">×</button></div><label for="search-input" class="sr-only">Search posts and tags</label><div class="search-field"><span aria-hidden="true">⌕</span><input id="search-input" placeholder="An idea, a moment, a word…" autocomplete="off" maxlength="100"></div><div class="search-results" id="search-results"><p>Start with a word.</p></div><p class="search-footer">ESC to close <span>↗</span> ENTER to open</p></dialog>`}
export function hero(status,featured,upcoming=[]){
  return `<section class="hero-intro corner-home-hero" aria-labelledby="hero-title">
    <div class="hero-content">
      <div class="hero-kicker"><span class="hero-star" aria-hidden="true">✳</span> AN OPEN NOTEBOOK <span class="hero-sep">/</span> EST. 2026</div>
      <h1 id="hero-title">A little bit of life,<br><em>one story at a time.</em><span class="hero-spark" data-v6-gravity aria-hidden="true">✦</span></h1>
      <p>Thoughts, things I’m building, learning, feeling and celebrating.<br>A place to keep it all, in one corner.</p>
      <div class="hero-cta"><a href="#feed" class="hero-link">Explore the space <span aria-hidden="true">↗</span></a><span class="hero-quiet"><span aria-hidden="true">✦</span> A quiet feed. Always open.</span></div>
    </div>
    <div class="hero-aside">
      <div class="now-panel"><span class="aside-cap">CURRENTLY <span aria-hidden="true">↗</span></span>
      <div class="now-status"><span class="live-dot"></span><strong>${e(status?.label||'Keeping a little corner alive.')}</strong></div>
      <p>${e(status?.detail||'The space is taking shape, one note at a time.')}</p>
      <span class="aside-rule"></span><span class="aside-bottom">LAST UPDATED <span>${status?e(dateLabel(status.updatedAt)):'WHEN THERE’S SOMETHING TO SAY'}</span></span></div>
      ${upcoming.length?`<div class="next-wish"><span>COMING UP</span><p>${e(upcoming[0].emoji||'✨')} ${e(upcoming[0].title)}</p><small>${e(dateLabel(upcoming[0].scheduled_at))}</small></div>`:''}
    </div>
  </section>`;
}

function homeExploreCategories(){
  const captions={Latest:'Recent updates',Wishes:'Good things, shared',Builds:'What I’m creating',Notes:'Little thoughts',Journal:'Longer stories',Moments:'Captured memories'};
  const art={
    Latest:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    Wishes:'<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-4 0-6-2-6-4a2 2 0 0 1 4 0c0 2 2 4 2 4Zm0 0c4 0 6-2 6-4a2 2 0 0 0-4 0c0 2-2 4-2 4Z"/>',
    Builds:'<path d="m14 6 4 4M4 20l7-7M16 3l5 5-5 5-5-5zM2 22l7-7"/>',
    Notes:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    Journal:'<path d="M12 7a8 8 0 0 0-9-1v14a8 8 0 0 1 9 1 8 8 0 0 1 9-1V6a8 8 0 0 0-9 1Zm0 0v14"/>',
    Moments:'<path d="M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3.5"/>'
  };
  const items=CATEGORIES.map((category,index)=>{
    const slug=category.toLowerCase(),href=category==='Latest'?'/':'/category/'+encodeURIComponent(slug);
    return `<a href="${href}" class="corner-explore-tile corner-explore-${e(slug)}${index===0?' is-active':''}"${index===0?' aria-current="page"':''}>
      <span class="corner-explore-icon"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${art[category]}</svg></span>
      <span class="corner-explore-copy"><strong>${e(category)}</strong><small>${e(captions[category])}</small></span><span class="corner-explore-arrow" aria-hidden="true">↗</span>
    </a>`;
  }).join('');
  return `<section class="corner-explore" aria-labelledby="corner-explore-title"><div class="corner-explore-heading"><h2 id="corner-explore-title">Explore the space</h2></div><div class="corner-explore-grid">${items}</div></section>`;
}

function homeSpotlight(featured,posts,mediaByPost={}){
  const item=featured||posts[0]||null;
  const media=item?(mediaByPost[item.id]||[]).find(m=>m.mime_type?.startsWith('image/')&&m.storage_key):null;
  const image=media?`<img src="/media/${encodeURIComponent(media.storage_key)}" loading="lazy" alt="${e(media.alt_text||item.title)}" style="object-position:${Math.round(Math.min(1,Math.max(0,Number(media.focal_x)||.5))*100)}% ${Math.round(Math.min(1,Math.max(0,Number(media.focal_y)||.5))*100)}%">`:'<span class="corner-spotlight-mark" aria-hidden="true">✳</span>';
  return `<aside class="corner-home-spotlight" aria-labelledby="home-spotlight-title">
    <p class="corner-spotlight-kicker">IN THE SPOTLIGHT</p>
    <div class="corner-spotlight-visual">${image}</div>
    <div class="corner-spotlight-copy"><h3 id="home-spotlight-title">${item?e(item.title):'Your next story starts here.'}</h3>
    <p>${item?e(item.excerpt||'A little moment from the Corner.'): 'Stories, projects and moments will find their place here.'}</p>
    ${item?`<a class="corner-spotlight-link" href="${safeLink(item.slug)}">Read the story <span aria-hidden="true">↗</span></a>`:'<a class="corner-spotlight-link" href="/about">About the Corner <span aria-hidden="true">↗</span></a>'}</div>
  </aside>`;
}

export function feedPage({posts=[],status,active='Latest',featured,upcoming=[],cursor,tag='',demo=false,mediaByPost={},eventCursor=0,onThisDay=[]}){
  const isHome=active==='Latest';
  const visiblePosts=isHome?posts.slice(0,1):posts;
  const categoryHero=`<section class="category-hero"><p class="eyebrow">THE CORNER / COLLECTIONS</p><h1>${e(active)}<span>.</span></h1><p>${active==='Wishes'?'Good things worth celebrating.':active==='Builds'?'Small steps, real progress.':active==='Notes'?'Ideas worth remembering.':active==='Journal'?'A place to slow down and write.':'Scenes and little memories.'}</p></section>`;
  const memories=isHome&&onThisDay.length?`<section class="on-this-day"><p class="eyebrow">ON THIS DAY</p><div><h2>Worth remembering.</h2>${onThisDay.map(p=>`<a href="${safeLink(p.slug)}">${e(p.title)} <span>↗</span></a>`).join('')}</div></section>`:'';
  const stories=visiblePosts.length?`<div class="stories" id="stories">${visiblePosts.map((p,i)=>card(p,i,{featured:!isHome&&i===0&&p.featured,editorial:isHome,media:mediaByPost[p.id]||[]})).join('')}</div>`:
    `<div class="empty-feed"><span aria-hidden="true">✳</span><h3>Nothing here yet.</h3><p>The next note will find its place soon.</p></div>`;
  const spotlight=isHome&&posts.length&&featured&&featured.id!==posts[0]?.id?homeSpotlight(featured,[],mediaByPost):'';
  const feed=`<section id="feed" class="feed-section" aria-labelledby="feed-heading">
    <div class="feed-heading"><div><p class="eyebrow">${isHome?'THE LATEST FROM HERE':e(active.toUpperCase())} ${demo?'<span class="demo-pill">SAMPLE CONTENT</span>':''}</p>
    <h2 id="feed-heading">${isHome?'Latest from here.':e(active)}</h2>${isHome?'<p class="corner-feed-subtitle">A little of everything.</p>':''}</div>
    ${isHome?(process.env.CORNER_V3_SEARCH==='1'?'<a class="corner-feed-view-all" href="/archive">View all <span aria-hidden="true">↗</span></a>':(posts.length?'<a class="corner-feed-view-all" href="#stories">Browse stories <span aria-hidden="true">↓</span></a>':'<a class="corner-feed-view-all" href="/about">About Corner <span aria-hidden="true">↗</span></a>')):`<span class="feed-updated">${posts.length?'FRESHLY PICKED / STORIES':'MORE TO COME'}</span>`}</div>
    <div class="new-updates" data-new-updates hidden><button type="button" data-apply-updates>↑ <span>1 new update</span></button></div>
    ${isHome?`<div class="corner-journal-layout${spotlight?' has-spotlight':''}"><div class="corner-journal-feed">${stories}</div>${spotlight}</div>`:stories}
    ${!isHome&&cursor?`<button class="load-more" data-load-more data-cursor="${e(cursor)}">More from the corner <span>↓</span></button>`:''}
    <p class="end-mark">YOU’VE CAUGHT UP <span>✳</span> MORE SOON</p>
  </section>`;
  const body=`${header(active,status)}<main id="content" class="shell${isHome?' corner-home-shell':''}">${isHome?hero(status,featured,upcoming)+homeExploreCategories():categoryHero}${memories}${feed}<section class="about-stripe"><div><p class="eyebrow">ABOUT THIS SPACE</p><h2>Personal, by design.</h2></div><p>Not a feed to keep up with. Just an archive of things that mattered enough to write down. <a href="/about">A little more about it ↗</a></p></section></main>${footer()}${searchDialog()}<div class="toast-stack" id="toast-stack" aria-live="polite"></div>`;
  return basePage({path:isHome?'/':'/category/'+active.toLowerCase(),title:isHome?'':'The '+active,content:body,initial:{page:'feed',category:active,demo,eventCursor}});
}

export function detailPage({post,comments=[],counts={},next=null,related=[],media=[],languages=[],activeLanguage='en'}){
 const bodyHtml=renderStoryBody(post.body);
 const linkOf=code=>'/post/'+encodeURIComponent(post.slug)+(code==='en'?'':'?lang='+encodeURIComponent(code));
 const labels={en:'English',te:'తెలుగు',hi:'हिन्दी'};
 const languageNav=languages.length>1?'<nav class="v3a-language-picker" aria-label="Read in another language">'+languages.map(code=>'<a href="'+linkOf(code)+'" lang="'+code+'"'+(code===activeLanguage?' aria-current="page"':'')+'>'+e(labels[code]||code)+'</a>').join('')+'</nav>':'';
 let markup=`${header()}<main id="content" class="shell article-shell"><nav class="crumb"><a href="/">CORNER</a><span>/</span><span>${e(typeLabels[post.type])}</span></nav>${languageNav}<article class="post-article" data-post="${e(post.id)}"><header class="post-heading"><div class="post-caps"><span>${e(typeLabels[post.type])}</span>${post.demo?'<span class="demo-pill">SAMPLE</span>':''}<time datetime="${e(post.published_at||'')}" data-relative>${e(dateLabel(post.published_at))}</time></div><h1>${e(post.title)}</h1>${post.excerpt?`<p>${e(post.excerpt)}</p>`:''}<div class="post-byline"><span class="avatar">V.</span><div><strong>Vamsi</strong><span>${Math.max(1,Math.ceil(post.body.split(/\s+/).length/220))} MIN READ</span></div><a href="#share" class="share-link">Share ↗</a></div></header>${post.type==='moment'&&!media.length?`<div class="detail-art" aria-hidden="true">${e(post.emoji||'✺')}</div>`:''}${renderPostGallery(media)}<div class="post-body">${bodyHtml||'<p>A small moment, shared here.</p>'}</div><div class="post-actions"><div><p class="eyebrow">LEAVE A LITTLE REACTION</p>${post.allow_reactions&&!post.demo?`<div class="reactions" data-post-id="${e(post.id)}">${REACTIONS.map(x=>`<button type="button" data-reaction="${e(x)}"${x==='❤️'?' data-v5-like':''} aria-label="React ${e(x)}">${x==='❤️'?'<img src="/v5-heart.svg" class="v5-like-icon" alt="" width="22" height="22">':x} <span>${Number(counts[x]||0)}</span></button>`).join('')}</div>`:'<p class="action-note">A quiet appreciation is enough.</p>'}</div><div id="share" class="post-share"><button type="button" data-bookmark-post data-post-id="${e(post.id)}" hidden>Save for later ☆</button>${process.env.CORNER_V3_READING==='1'&&!post.demo?'<button type="button" data-v3-save-progress data-post-id="'+e(post.id)+'">Save reading position ◇</button>':''}<button type="button" data-copy-url>Copy link ↗</button></div></div>${post.allow_comments&&!post.demo?`<section id="conversation" class="comments" aria-label="Story conversation"><div class="comments-title v5-comments-head"><div><p class="eyebrow">THE CONVERSATION</p><h2>A few words back.</h2></div><button type="button" data-v5-notifications>Your replies ↗</button></div><p role="status" class="v5-comment-status" data-v5-comment-status aria-live="polite"></p><div id="comments-list" class="v5-threads" data-v5-threads data-post-id="${e(post.id)}">${comments.length?comments.map(c=>`<article class="comment"><strong>${e(c.authorName||c.author_name)}</strong><time datetime="${e(c.createdAt||c.created_at||'')}" data-relative>${e(dateLabel(c.createdAt||c.created_at))}</time><p>${e(c.body)}</p></article>`).join(''):'<p class="empty-comments">No comments yet.</p>'}</div><div class="comment-gate" data-comments-locked><p>Join the conversation with your verified profile.</p><button type="button" data-auth-open="login">Sign in to comment ↗</button></div><form id="comment-form" data-post-id="${e(post.id)}" hidden><label for="comment-text">Your note</label><textarea id="comment-text" name="body" required minlength="3" maxlength="1000" placeholder="Something thoughtful, kind, or curious…"></textarea><div data-v5-main-picker class="v5-main-picker"><div><button type="button" data-v5-picker="sticker">Stickers</button><button type="button" data-v5-picker="gif">GIFs</button></div><div class="v5-picker" data-v5-picker-content hidden></div><span data-v5-asset-selected></span></div><button type="submit">Send comment <span>↗</span></button><small>Comments appear after review.</small></form></section>`:''}</article>${next?`<aside class="next-story">${related.length?`<aside class="v5-related"><h2>You might also like</h2><div class="v5-related-list">${related.map(p=>`<a href="${safeLink(p.slug)}"><small>${e(typeLabels[p.type]||'STORY')}</small><strong>${e(p.title)}</strong><time datetime="${e(p.published_at||'')}" data-relative>${e(dateLabel(p.published_at))}</time></a>`).join('')}</div></aside>`:''}<p class="eyebrow">KEEP READING</p><a href="${safeLink(next.slug)}"><span>${e(next.title)}</span><b>↗</b></a></aside>`:''}</main>${footer()}${searchDialog()}<div class="toast-stack" id="toast-stack" aria-live="polite"></div>`;
 return basePage({title:post.title,description:post.excerpt||post.body.slice(0,150),path:linkOf(activeLanguage),content:markup,article:true,socialImage:media.find(m=>m.mime_type?.startsWith('image/')&&m.storage_key)?config.siteUrl.replace(/\/$/,'')+'/media/'+encodeURIComponent(media.find(m=>m.mime_type?.startsWith('image/')&&m.storage_key).storage_key):'',socialImageAlt:media.find(m=>m.mime_type?.startsWith('image/'))?.alt_text||post.title,publishedAt:post.published_at||'',language:activeLanguage==='te'?'te-IN':activeLanguage==='hi'?'hi-IN':'en',alternates:languages.map(code=>({lang:code==='en'?'en':code+'-IN',url:config.siteUrl+linkOf(code)})),initial:{page:'detail',postId:post.id,demo:!!post.demo,hasLanguages:languages.length>1}});
}
export function simplePage({title,lead,body,path}){let html=`${header()}<main id="content" class="shell simple-page"><p class="eyebrow">THE CORNER / ${e(title.toUpperCase())}</p><h1>${e(title)}<span>.</span></h1><p class="simple-lede">${e(lead)}</p><div class="simple-text">${body}</div><a class="back-link" href="/">← Back to the corner</a></main>${footer()}${searchDialog()}<div class="toast-stack" id="toast-stack" aria-live="polite"></div>`;return basePage({title,path,content:html})}
export function adminPage({owner=null,status=null}){
 const login=`<div class="signin-wrap"><div class="signin-box"><div class="admin-signin-mark admin-signin-mark--vm" aria-hidden="true"><img class="corner-brand-image" src="/mark.svg?v=vm-20261027" width="36" height="36" alt=""></div><p class="eyebrow">THE PRIVATE SIDE</p><h1>Welcome back.</h1><p>One small place to make everything happen.</p><form id="admin-login"><label>Email<input type="email" name="email" autocomplete="username" required placeholder="you@example.com"></label><label>Password<input type="password" name="password" autocomplete="current-password" required minlength="12" placeholder="Your secure password"></label><label class="admin-mfa-field"><span>Authenticator code (when enabled)</span><input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="19" placeholder="Six-digit or recovery code"></label><button type="submit">Open the Corner <span>↗</span></button><p class="admin-message" role="status" id="login-message"></p></form><a href="/">← Back to the public site</a></div></div>`;
 const dashboard=`<div class="admin-shell studio-frame">${studioSidebar(owner,{interactive:true})}<main id="content" class="admin-main"><header class="admin-top"><div><p class="eyebrow">STUDIO</p><h1 id="admin-heading">Overview<span>.</span></h1></div><div><span class="admin-owner-dot" aria-hidden="true">●</span> <a class="studio-owner-link" href="mailto:connect@vamsimarripudi.me">Vamsi Marripudi ↗</a></div></header><div id="admin-view" class="admin-view"><div class="admin-loading">Preparing your workspace…</div></div></main></div>`;
 return basePage({title:'Studio',path:'/admin',noindex:true,content:(owner?dashboard:login)+`<div class="toast-stack" id="toast-stack" aria-live="polite"></div><script src="/image-crop.js" defer></script><script src="/admin.js?v=20261026-clean1" defer></script>`,initial:{page:'admin',authenticated:!!owner,status,ownerRole:owner?.role||null}});
}
