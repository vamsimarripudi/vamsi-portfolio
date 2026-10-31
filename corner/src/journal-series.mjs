import {httpError,slugify,pureText} from './domain.mjs';
import {publicPost} from './store.mjs';

export const FIRST_SERIES_SLUG='learning-everything-doing-nothing';
export const FIRST_PART_SLUG='learning-everything-doing-nothing';
export const SECOND_PART_SLUG='theres-something-beautiful-about-starting-something-new';
export const FIRST_PART_ID='post_fdbce666-5456-40e4-a3bc-1027b881b64e';
export const FIRST_SERIES_TITLE='Learning Everything, Doing Nothing';
export const FIRST_SERIES_SUMMARY='On curiosity, unfinished beginnings, and the distance between knowing and doing.';
const stamp=()=>new Date().toISOString();
const asPartNumber=n=>Number.isInteger(Number(n))&&Number(n)>=1&&Number(n)<=99?Number(n):null;
const validSlug=slug=>typeof slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=80;

export class JournalSeries{
  constructor(store){
    this.store=store;
    // Additive schema: never change an existing article's text, slug or media.
    store.db.exec(`
      CREATE TABLE IF NOT EXISTS journal_series (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'ongoing',
        theme TEXT NOT NULL DEFAULT 'marginalia',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS journal_series_parts (
        post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
        series_slug TEXT NOT NULL REFERENCES journal_series(slug) ON DELETE CASCADE,
        part_number INTEGER NOT NULL CHECK(part_number BETWEEN 1 AND 99),
        UNIQUE(series_slug,part_number)
      );
      CREATE INDEX IF NOT EXISTS idx_journal_series_order ON journal_series_parts(series_slug,part_number);
    `);
    // Only attach the exact, already-published Part 01. Never fabricate or
    // republish content if the real entry does not exist.
    const original=store.one("SELECT id FROM posts WHERE id=? AND slug=? AND type='journal' AND state='published'",
      FIRST_PART_ID,FIRST_PART_SLUG);
    if(original){
      const today=stamp();
      store.exec(`INSERT OR IGNORE INTO journal_series(slug,title,summary,status,theme,created_at,updated_at)
        VALUES(?,?,?,'ongoing','marginalia',?,?)`,FIRST_SERIES_SLUG,FIRST_SERIES_TITLE,FIRST_SERIES_SUMMARY,today,today);
      store.exec(`INSERT OR IGNORE INTO journal_series_parts(series_slug,post_id,part_number)
        VALUES(?,?,1)`,FIRST_SERIES_SLUG,original.id);

      // Chapter 02 was published before the series controls were available in
      // Studio. Link that exact existing post once, without changing its text,
      // media, slug, publication time or any unrelated Journal entry.
      const second=store.one("SELECT id FROM posts WHERE slug=? AND type='journal' AND state='published'",SECOND_PART_SLUG);
      if(second){
        const occupied=store.one('SELECT post_id FROM journal_series_parts WHERE series_slug=? AND part_number=2',FIRST_SERIES_SLUG);
        const assigned=store.one('SELECT series_slug,part_number FROM journal_series_parts WHERE post_id=?',second.id);
        if(!occupied&&!assigned){
          store.exec('INSERT INTO journal_series_parts(series_slug,post_id,part_number) VALUES(?,?,2)',
            FIRST_SERIES_SLUG,second.id);
        }
      }
    }
  }
  adminSeries(){
    return this.store.all(`SELECT s.slug,s.title,s.summary,s.status,s.theme,
      COUNT(p.post_id) AS chapterCount,COALESCE(MAX(p.part_number),0) AS maxPart
      FROM journal_series s LEFT JOIN journal_series_parts p ON p.series_slug=s.slug
      GROUP BY s.slug,s.title,s.summary,s.status,s.theme,s.created_at
      ORDER BY s.created_at,s.slug`).map(row=>{
        const maxPart=Number(row.maxPart||0);
        return {...row,chapterCount:Number(row.chapterCount||0),nextPart:maxPart>=99?null:maxPart+1};
      });
  }
  uniqueSlug(title){
    const base=(slugify(title).slice(0,72)||'journal-series');
    let candidate=base,index=2;
    while(this.store.one('SELECT slug FROM journal_series WHERE slug=?',candidate)){
      const suffix='-'+index++;
      candidate=base.slice(0,80-suffix.length)+suffix;
    }
    return candidate;
  }
  nextPart(slug){
    if(!validSlug(slug)||!this.store.one('SELECT slug FROM journal_series WHERE slug=?',slug))
      throw httpError(404,'Journal series not found');
    const row=this.store.one('SELECT COALESCE(MAX(part_number),0) AS n FROM journal_series_parts WHERE series_slug=?',slug);
    const next=Number(row?.n||0)+1;
    if(next>99)throw httpError(409,'This series already has the maximum number of chapters.');
    return next;
  }
  assignment(postId){
    const row=this.store.one(`SELECT s.slug,s.title,s.summary,p.part_number AS partNumber
      FROM journal_series_parts p JOIN journal_series s ON s.slug=p.series_slug WHERE p.post_id=?`,postId);
    return row||null;
  }
  published(slug){
    if(!validSlug(slug))return null;
    const meta=this.store.one('SELECT slug,title,summary,status,theme FROM journal_series WHERE slug=?',slug);
    if(!meta)return null;
    const rows=this.store.all(`SELECT p.*,s.part_number AS partNumber
      FROM journal_series_parts s JOIN posts p ON p.id=s.post_id
      WHERE s.series_slug=? AND p.state='published' AND p.type='journal'
      ORDER BY s.part_number ASC,p.published_at ASC,p.id ASC`,slug);
    if(!rows.length)return null;
    const parts=rows.map(row=>{
      const post=publicPost(row);
      const media=this.store.listMedia(post.id);
      const cover=media.find(m=>String(m.mime_type||'').startsWith('image/'))||null;
      return {...post,partNumber:row.partNumber,cover};
    });
    return {...meta,parts};
  }
  forPost(id){
    const assigned=this.assignment(id);
    if(!assigned)return null;
    const info=this.published(assigned.slug);
    if(!info)return null;
    const index=info.parts.findIndex(part=>part.id===id);
    if(index<0)return null;
    return {...info,partNumber:info.parts[index].partNumber,previous:info.parts[index-1]||null,next:info.parts[index+1]||null};
  }
  decorate(post){
    if(!post||post.type!=='journal')return post;
    const assignment=this.assignment(post.id);
    if(!assignment)return post;
    return {...post,series:{slug:assignment.slug,title:assignment.title,partNumber:assignment.partNumber}};
  }
  createForPost(postId,actor,{allowMove=false}={}){
    const post=this.store.adminPost(postId);
    if(!post)throw httpError(404,'Post not found');
    if(post.type!=='journal')throw httpError(400,'Choose Journal presentation before starting a series.');
    const current=this.assignment(postId);
    if(current&&!allowMove)return {...current,created:false};
    if(current&&post.state==='published')
      throw httpError(409,'Published chapters keep their current series. Create a new draft to start another series.');
    const title=pureText(post.title,120)||'Untitled Journal';
    const summary=pureText(post.excerpt||'An ongoing journal series.',300);
    const slug=this.uniqueSlug(title),today=stamp();
    this.store.transaction(()=>{
      this.store.exec(`INSERT INTO journal_series(slug,title,summary,status,theme,created_at,updated_at)
        VALUES(?,?,?,'ongoing','marginalia',?,?)`,slug,title,summary,today,today);
      if(current)this.store.exec('DELETE FROM journal_series_parts WHERE post_id=?',postId);
      this.store.exec('INSERT INTO journal_series_parts(series_slug,post_id,part_number) VALUES(?,?,1)',slug,postId);
      this.store.audit(actor,'journal.series.created','series',slug,{postId,title});
      this.store.audit(actor,'journal.series.assigned','post',postId,{slug,partNumber:1});
    });
    return {...this.assignment(postId),created:true};
  }
  assignNext(postId,slug,actor,{allowMove=false}={}){
    const post=this.store.adminPost(postId);
    if(!post)throw httpError(404,'Post not found');
    if(post.type!=='journal')throw httpError(400,'Choose Journal presentation before adding a chapter.');
    if(!validSlug(slug)||!this.store.one('SELECT slug FROM journal_series WHERE slug=?',slug))
      throw httpError(404,'Journal series not found');
    const current=this.assignment(postId);
    if(current?.slug===slug)return {...current,created:false};
    if(current&&!allowMove)
      throw httpError(409,'This chapter already belongs to a series. Use Change series first.');
    if(current&&post.state==='published')
      throw httpError(409,'Published chapters cannot be moved between series.');
    const order=this.nextPart(slug);
    this.store.transaction(()=>{
      if(current)this.store.exec('DELETE FROM journal_series_parts WHERE post_id=?',postId);
      this.store.exec('INSERT INTO journal_series_parts(series_slug,post_id,part_number) VALUES(?,?,?)',slug,postId,order);
      this.store.audit(actor,'journal.series.assigned','post',postId,{slug,partNumber:order,automatic:true});
    });
    return {...this.assignment(postId),created:false};
  }
  organize(postId,data,actor){
    const mode=String(data?.mode||'existing');
    if(mode==='new')return this.createForPost(postId,actor,{allowMove:data?.allowMove===true});
    if(mode==='existing')return this.assignNext(postId,String(data?.slug||''),actor,{allowMove:data?.allowMove===true});
    if(mode==='unlink'){
      const post=this.store.adminPost(postId);
      if(!post)throw httpError(404,'Post not found');
      const current=this.assignment(postId);
      if(!current)return null;
      if(post.state==='published')throw httpError(409,'Published chapters keep their series assignment.');
      this.store.exec('DELETE FROM journal_series_parts WHERE post_id=?',postId);
      this.store.audit(actor,'journal.series.unlinked','post',postId,{slug:current.slug});
      return null;
    }
    throw httpError(400,'Invalid Journal series action.');
  }
  assign(postId,slug,partNumber,actor){
    const post=this.store.adminPost(postId);
    if(!post)throw httpError(404,'Post not found');
    if(slug===''||slug===null){
      this.store.exec('DELETE FROM journal_series_parts WHERE post_id=?',postId);
      this.store.audit(actor,'journal.series.unlinked','post',postId);
      return null;
    }
    if(post.type!=='journal')throw httpError(400,'Choose Journal presentation before adding a chapter.');
    if(!validSlug(slug)||!this.store.one('SELECT slug FROM journal_series WHERE slug=?',slug))
      throw httpError(404,'Journal series not found');
    const order=asPartNumber(partNumber);
    if(order===null)throw httpError(400,'Chapter number must be between 1 and 99');
    const collision=this.store.one('SELECT post_id FROM journal_series_parts WHERE series_slug=? AND part_number=?',slug,order);
    if(collision&&collision.post_id!==postId)throw httpError(409,'That chapter number is already in use.');
    this.store.transaction(()=>{
      this.store.exec('DELETE FROM journal_series_parts WHERE post_id=?',postId);
      this.store.exec('INSERT INTO journal_series_parts(series_slug,post_id,part_number) VALUES(?,?,?)',slug,postId,order);
      this.store.audit(actor,'journal.series.assigned','post',postId,{slug,partNumber:order});
    });
    return this.assignment(postId);
  }
}
