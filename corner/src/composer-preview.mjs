import {card, detailPage, basePage} from './ui.mjs';
import {TYPES, typeCategories, pureText, httpError} from './domain.mjs';
import {config} from './config.mjs';

// Use the public renderers, but never run public analytics, reactions or navigation
// inside a private preview. No post, revision, series or delivery record is written.
function previewDocument(page, body, mode) {
  const head=page.match(/<head>([\s\S]*?)<\/head>/)?.[1]||'';
  const safeHead=head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  const content=body.replace(/<a\b([^>]*)\bhref=(["'])[^"']*\2([^>]*)>/gi,'<a $1$3 tabindex="-1" aria-disabled="true">')
    .replace(/<button\b/gi,'<button disabled tabindex="-1"')
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi,'');
  const html='<!doctype html><html lang="en"><head>'+safeHead+
    '<meta name="robots" content="noindex,nofollow">'+
    '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; connect-src \'none\'; form-action \'none\'; object-src \'none\'">'+
    '<style>html,body{min-height:0!important;scroll-behavior:auto!important}body{margin:0!important;background:transparent!important}*{animation:none!important;transition:none!important}.composer-document>.shell{width:100%;max-width:840px;margin:0 auto;padding:24px 20px}.composer-document .feed-section{padding:0;margin:0}.composer-document .stories{display:block;margin:0}.composer-document .story{margin:0;box-shadow:none}.composer-document .article-shell{padding-top:24px}.composer-document .crumb{margin-top:0}.composer-document a{pointer-events:none}.composer-document .post-actions,.composer-document #conversation{pointer-events:none}.composer-document .post-heading h1{overflow-wrap:anywhere}.composer-document .post-media-carousel .post-carousel-frame{max-height:none}.composer-document .post-photo{opacity:1!important;cursor:default!important}.composer-document [hidden]{display:none!important}.composer-document button:disabled{opacity:1!important;cursor:default!important}@media(max-width:480px){.composer-document>.shell{padding:18px 14px}.composer-document .post-heading h1{font-size:clamp(1.7rem,7vw,2.5rem)}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style></head><body class="corner-comfort composer-document composer-document--'+mode+'">'+content+'</body></html>';
  // Templates contain unprefixed asset paths. Apply the same mount as page(), once.
  return config.basePath?html.replace(/(href|src|poster|action)=(["'])\/(?!\/)/g,(_,attr,quote)=>attr+'='+quote+config.basePath+'/'):html;
}

export function composerPreview(store,journalSeries,input={}) {
  const source=input.post;
  if(!source||typeof source!=='object'||Array.isArray(source))throw httpError(400,'Provide the post to preview.');
  const postId=input.postId?String(input.postId):null;
  const existing=postId?store.adminPost(postId):null;
  if(postId&&!existing)throw httpError(404,'Post not found.');
  const type=TYPES.includes(source.type)?source.type:'tech_note';
  const post={
    id:existing?.id||'private-preview',slug:existing?.slug||'private-preview',type,category:typeCategories[type],
    title:pureText(source.title,150)||'Your next story.',body:pureText(source.body,25000),
    excerpt:pureText(source.excerpt,380),emoji:pureText(source.emoji,8)||'✳',
    allow_comments:source.allowComments!==false,allow_reactions:source.allowReactions!==false,
    featured:source.featured===true,pinned:source.pinned===true,milestone:source.milestone===true,
    published_at:existing?.published_at||null,updated_at:existing?.updated_at||null,
    version:existing?.version||1,tags:[]
  };
  const media=postId?store.listMedia(postId):[];
  let series=null;
  const current=postId?journalSeries.assignment(postId):null;
  const choice=input.seriesChoice===undefined?current?.slug:String(input.seriesChoice||'');
  if(type==='journal'&&choice&&choice!=='__none__'&&choice!=='__standalone__') {
    const catalog=journalSeries.adminSeries();
    const selected=catalog.find(item=>item.slug===choice);
    if(selected) {
      const partNumber=current?.slug===choice?current.partNumber:selected.nextPart||1;
      const published=journalSeries.published(choice);
      const parts=published?.parts||[];
      series={...selected,parts,partNumber,
        previous:parts.filter(item=>item.partNumber<partNumber).at(-1)||null,
        next:parts.find(item=>item.partNumber>partNumber)||null};
    } else if(choice==='__new__') {
      series={slug:'private-preview',title:post.title,summary:post.excerpt,partNumber:1,parts:[],previous:null,next:null};
    }
  }
  if(series)post.series={slug:series.slug,title:series.title,partNumber:series.partNumber};
  const feedBody='<main class="shell corner-home-shell"><section class="feed-section"><div class="stories">'+card(post,0,{media,editorial:true})+'</div></section></main>';
  const feedPage=basePage({title:'Private post preview',path:'/',content:feedBody,noindex:true,initial:{page:'feed'}});
  const detail=detailPage({post,media,series});
  const main=detail.match(/<main id="content" class="shell article-shell">[\s\S]*?<\/main>/)?.[0];
  if(!main)throw httpError(500,'Could not prepare the reading preview.');
  return {feedHtml:previewDocument(feedPage,feedBody,'feed'),fullHtml:previewDocument(detail,main,'full'),
    private:true,previewOnly:true,mediaCount:media.length};
}
