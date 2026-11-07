/**
 * Vamsi's Corner Stories — pure public-book projection.
 * Publishing remains owned by the existing journal composer and JournalSeries.
 * A published Journal post becomes a fictional story only with the Fiction, Story,
 * Stories, or Novel tag (case-insensitive). No drafts or private fields escape.
 */
export const FICTION_TAGS = new Set(['fiction', 'story', 'stories', 'novel']);
export const STORY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_FIELDS = ['id','slug','title','excerpt','body','type','tags','published_at','updated_at','version'];

export function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.filter(tag => typeof tag === 'string').map(tag => tag.trim()).filter(Boolean).slice(0, 20);
  if (typeof tags !== 'string') return [];
  try { return normalizeTags(JSON.parse(tags)); } catch { return []; }
}
export function isFictionPost(post) {
  return Boolean(post && post.type === 'journal' && (!Object.hasOwn(post,'state') || post.state === 'published') && normalizeTags(post.tags).some(t => FICTION_TAGS.has(t.toLowerCase())));
}
export function toPublicChapter(row) {
  if (!isFictionPost(row)) return null;
  const chapter = Object.fromEntries(PUBLIC_FIELDS.filter(k => Object.hasOwn(row,k)).map(k => [k, row[k]]));
  chapter.tags = normalizeTags(row.tags);
  chapter.title = String(chapter.title || 'Untitled chapter').slice(0, 150);
  chapter.excerpt = String(chapter.excerpt || '').slice(0, 380);
  chapter.body = String(chapter.body || '').slice(0, 25000);
  chapter.slug = String(chapter.slug || '');
  if (!STORY_SLUG.test(chapter.slug)) return null;
  return chapter;
}
export function wordCount(content) { return (String(content||'').trim().match(/\S+/g)||[]).length; }
export function estimatedMinutes(chapters) { return Math.max(1, Math.ceil(chapters.reduce((total,p)=>total+wordCount(p.body),0) / 210)); }
export function chapterSynopsis(chapter,index=0) {
  return {number:index+1,slug:chapter.slug,title:chapter.title,excerpt:chapter.excerpt,words:wordCount(chapter.body),version:chapter.version||1};
}
export function createBook({ slug,title,description='',chapters,kind='standalone',cover=null,updatedAt='' }) {
  if (!STORY_SLUG.test(String(slug||'')) || !Array.isArray(chapters)) return null;
  const safe = chapters.map(toPublicChapter).filter(Boolean);
  if (!safe.length) return null;
  const book = {
    id:`${kind}:${slug}`,slug,title:String(title||safe[0].title).slice(0,150),genre:storyGenre(safe[0]),coverTone:storyCoverTone(slug),
    description:String(description||safe[0].excerpt||'').slice(0,380),
    kind,chapters:safe,chapterCount:safe.length,readingMinutes:estimatedMinutes(safe),
    updatedAt:String(updatedAt||safe.at(-1).published_at||''),cover:cover && /^[-\w./]+$/.test(cover.storage_key||'') && /^(image\/)/.test(cover.mime_type||'')
      ? {storage_key:cover.storage_key,alt_text:String(cover.alt_text||cover.caption||'Story cover').slice(0,180)} : null
  };
  return book;
}
export function publicBookSummary(book) {
  return {id:book.id,slug:book.slug,kind:book.kind,title:book.title,description:book.description,genre:book.genre,coverTone:book.coverTone,
    chapterCount:book.chapterCount,readingMinutes:book.readingMinutes,updatedAt:book.updatedAt,cover:book.cover,
    chapters:book.chapters.map(chapterSynopsis)};
}
export function validateChapterNumber(value,total) {
  if (!/^(?:[1-9]\d{0,2})$/.test(String(value||''))) return null;
  const n=Number(value);
  return Number.isSafeInteger(n) && n>=1 && n<=total ? n : null;
}
export function sanitizeBookSlug(value) { return STORY_SLUG.test(String(value||'')) && String(value).length<=100 ? String(value) : null; }
export function encodeJsonForHtml(value){return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,ch=>`\\u${ch.charCodeAt(0).toString(16).padStart(4,'0')}`);}
export function escapeStoryHtml(value=''){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function paragraphsFromBody(body='') {
  return String(body||'').replace(/\r\n?/g,'\n').split(/\n\s*\n+/).map(p=>p.trim()).filter(Boolean);
}
/** Shared editorial taxonomy. Always display the same genre between Studio and the bookshelf. */
export const STORY_GENRES=Object.freeze(['Literary','Mystery','Thriller','Romance','Fantasy','Science Fiction','Horror','Historical','Adventure','Slice of Life']);
export function storyGenre(chapter){const tags=normalizeTags(chapter?.tags).map(t=>t.toLowerCase());return STORY_GENRES.find(g=>tags.includes(g.toLowerCase()))||'Literary';}

/** Stable cover tonality from slug, not a random theme on every page. */
export function storyCoverTone(slug){let n=0;for(const ch of String(slug||''))n=(Math.imul(n,31)+ch.charCodeAt(0))>>>0;return n%6;}
