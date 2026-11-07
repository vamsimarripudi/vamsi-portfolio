import {isFictionPost,toPublicChapter,createBook,publicBookSummary,sanitizeBookSlug,validateChapterNumber,chapterSynopsis} from './stories-model.mjs';
import {renderStoriesLibrary,renderBookDetails,renderStoryReader} from './stories-ui.mjs';

/** Read-only integration with existing published Journal posts and JournalSeries. */
export function createStoriesService({store,journalSeries,siteUrl,basePath=''}) {
  function cover(post){
    if(!post?.id || typeof store.listMedia!=='function')return null;
    const media=store.listMedia(post.id);
    return Array.isArray(media)?media.find(m=>String(m.mime_type||'').startsWith('image/'))||null:null;
  }
  function books(){
    // Publication state is checked by SQL, not inferred from user-controlled tags.
    const published=store.all(`SELECT id,slug,title,excerpt,body,type,tags,state,version,published_at,updated_at
      FROM posts WHERE state='published' AND type='journal' ORDER BY published_at DESC,id ASC LIMIT 1500`);
    const fiction=published.filter(isFictionPost).map(toPublicChapter).filter(Boolean);
    const grouped=new Set();
    const results=[];
    for(const post of fiction){
      const assignment=journalSeries.assignment(post.id);
      if(assignment?.slug){
        if(grouped.has(assignment.slug))continue;
        grouped.add(assignment.slug);
        // .published() excludes drafts, scheduled, and archived chapters by construction.
        const publishedSeries=journalSeries.published(assignment.slug);
        const publishedChapters=(publishedSeries?.parts||[]).filter(isFictionPost);
        if(!publishedChapters.length)continue;
        const book=createBook({kind:'series',slug:assignment.slug,title:publishedSeries.title,
          description:publishedSeries.summary,chapters:publishedChapters,cover:publishedChapters.find(p=>p.cover)?.cover||cover(publishedChapters[0]),
          updatedAt:publishedChapters.reduce((m,p)=>String(p.published_at||'')>m?String(p.published_at):m,'')});
        if(book)results.push(book);
      } else {
        const book=createBook({slug:post.slug,title:post.title,description:post.excerpt,chapters:[post],cover:cover(post),
          updatedAt:post.published_at});
        if(book)results.push(book);
      }
    }
    return results.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.title.localeCompare(b.title));
  }
  function find(slug){
    const valid=sanitizeBookSlug(slug);
    if(!valid)return null;
    return books().find(book=>book.slug===valid)||books().find(book=>book.kind==='series'&&book.chapters.some(ch=>ch.slug===valid))||null;
  }
  function readChapter(book,number){
    const parsed=validateChapterNumber(number,book?.chapterCount||0);
    if(!parsed)return null;
    const post=book.chapters[parsed-1];
    return {...chapterSynopsis(post,parsed-1),body:post.body};
  }
  function api(path){
    if(path==='/api/stories/books')return {status:200,data:{books:books().map(publicBookSummary)}};
    const info=path.match(/^\/api\/stories\/books\/([a-z0-9-]{1,100})$/);
    if(info){const book=find(info[1]);return book?{status:200,data:{book:publicBookSummary(book)}}:{status:404,error:'Story not found.'};}
    const match=path.match(/^\/api\/stories\/books\/([a-z0-9-]{1,100})\/chapters\/([0-9]{1,3})$/);
    if(!match)return null;
    const book=find(match[1]);
    if(!book)return {status:404,error:'Story not found.'};
    const chapter=readChapter(book,match[2]);
    if(!chapter)return {status:404,error:'Chapter not found.'};
    return {status:200,data:{book:publicBookSummary(book),chapter}};
  }
  function html(path,search=''){
    if(path==='/stories')return renderStoriesLibrary(books().map(publicBookSummary),{siteUrl,basePath});
    const bookMatch=path.match(/^\/stories\/book\/([a-z0-9-]{1,100})$/);
    if(bookMatch){const book=find(bookMatch[1]);return book?renderBookDetails(book,{siteUrl,basePath}):null;}
    const readMatch=path.match(/^\/stories\/read\/([a-z0-9-]{1,100})$/);
    if(readMatch){
      const book=find(readMatch[1]);if(!book)return null;
      const params=new URLSearchParams(search);
      const number=validateChapterNumber(params.get('chapter')||'1',book.chapterCount);
      if(!number)return null;
      return renderStoryReader(book,book.chapters[number-1],{siteUrl,basePath});
    }
    return undefined;
  }
  return Object.freeze({books,find,readChapter,api,html});
}
