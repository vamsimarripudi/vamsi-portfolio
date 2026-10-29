/** Corner V5 conversations. Additive tables: existing posts, comments and profiles are untouched. */
import {uid,now,pureText,httpError} from './domain.mjs';

const reactions=Object.freeze(['❤️','👏','😂','🔥','🎉','✨']);
const stickerIds=Object.freeze(['heart','sparkle','celebrate','wave','thanks','wow']);
const gifIds=Object.freeze(['hearts','confetti','stars']);
const safe=(value,max)=>pureText(value,max);
const ownerRole=role=>role==='owner';
const staffRoles=new Set(['owner','admin','editor','moderator']);
export const V5_STICKERS=stickerIds;
export const V5_GIFS=gifIds;

export class CornerSocial{
  constructor(store){
    this.store=store;
    // Separate metadata instead of altering historical comment rows.
    store.db.exec(`
      CREATE TABLE IF NOT EXISTS corner_v5_comment_meta(
        comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
        parent_id TEXT REFERENCES comments(id) ON DELETE SET NULL,
        author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        sticker_id TEXT,
        gif_id TEXT,
        created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_corner_v5_parent ON corner_v5_comment_meta(parent_id);
      CREATE TABLE IF NOT EXISTS corner_v5_comment_reactions(
        comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reaction TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
        PRIMARY KEY(comment_id,actor_user_id));
      CREATE TABLE IF NOT EXISTS corner_v5_notifications(
        id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
        comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,read_at TEXT,
        UNIQUE(user_id,kind,comment_id));
      CREATE INDEX IF NOT EXISTS idx_corner_v5_notice ON corner_v5_notifications(user_id,read_at,created_at DESC);
      CREATE TABLE IF NOT EXISTS corner_v5_comment_reports(
        id TEXT PRIMARY KEY,comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,created_at TEXT NOT NULL,
        UNIQUE(comment_id,reporter_id));
    `);
  }
  authenticate(actor){
    if(!actor||!actor.id)throw httpError(401,'Sign in to participate.','AUTH_REQUIRED');
  }
  assertCommentable(postId){
    const post=this.store.one("SELECT id,slug,state,allow_comments FROM posts WHERE id=?",String(postId||''));
    if(!post||post.state!=='published'||!post.allow_comments)throw httpError(404,'Conversation unavailable.','NOT_FOUND');
    return post;
  }
  create(postId,actor,{body='',parentId=null,stickerId=null,gifId=null}={}){
    this.authenticate(actor);this.assertCommentable(postId);
    if(stickerId!=null&&!stickerIds.includes(stickerId))throw httpError(400,'Invalid sticker.','INVALID_STICKER');
    if(gifId!=null&&!gifIds.includes(gifId))throw httpError(400,'Invalid GIF.','INVALID_GIF');
    if(stickerId&&gifId)throw httpError(400,'Choose one attachment.','INVALID_ATTACHMENT');
    const text=safe(body,1000);
    if((text.length<3&&!stickerId&&!gifId)||text.length>1000)throw httpError(400,'Write a short comment or choose a sticker.','INVALID_COMMENT');
    let rootId=null;
    if(parentId){
      const parent=this.store.one('SELECT id,post_id,state FROM comments WHERE id=?',String(parentId));
      if(!parent||parent.post_id!==postId||parent.state!=='approved')throw httpError(404,'Reply target not available.','PARENT_NOT_FOUND');
      // Two visual levels maximum. All deeper replies belong to the same thread.
      rootId=this.store.one('SELECT parent_id FROM corner_v5_comment_meta WHERE comment_id=?',parent.id)?.parent_id||parent.id;
    }
    const id=uid('comment'),created=now(),state=actor.role==='owner'?'approved':'pending';
    this.store.transaction(()=>{
      this.store.exec('INSERT INTO comments(id,post_id,author_name,body,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,postId,safe(actor.display_name||'Reader',60)||'Reader',text,state,created,created);
      this.store.exec('INSERT INTO corner_v5_comment_meta(comment_id,parent_id,author_user_id,sticker_id,gif_id,created_at) VALUES(?,?,?,?,?,?)',id,rootId,actor.id,stickerId,gifId,created);
      this.store.audit(actor.id,rootId?'comment.reply.requested':'comment.created','comment',id,{postId,hasAttachment:!!(stickerId||gifId)});
    });
    if(state==='approved'){this.afterModeration(id);this.store.emit('comment.created',postId,1,{commentId:id});}
    return {id,state,message:state==='approved'?'Your reply is live.':'Your comment was sent for review.',parentId:rootId};
  }
  approved(postId,{actorId=null,limit=250}={}){
    const post=this.store.one("SELECT id FROM posts WHERE id=? AND state='published'",String(postId||''));
    if(!post)return [];
    const rows=this.store.all(`SELECT c.id,c.post_id,c.author_name,c.body,c.state,c.created_at,c.updated_at,
      m.parent_id,m.author_user_id,m.sticker_id,m.gif_id,u.role AS user_role,
      (SELECT COUNT(*) FROM corner_v5_comment_reactions r WHERE r.comment_id=c.id) AS reactions,
      (SELECT COUNT(*) FROM corner_v5_comment_reactions r WHERE r.comment_id=c.id AND r.actor_user_id=?) AS liked
      FROM comments c LEFT JOIN corner_v5_comment_meta m ON m.comment_id=c.id
      LEFT JOIN users u ON u.id=m.author_user_id
      WHERE c.post_id=? AND (c.state='approved' OR (c.state='pending' AND m.author_user_id=? AND ?!='') OR (c.state='deleted' AND EXISTS (SELECT 1 FROM corner_v5_comment_meta replies JOIN comments rc ON rc.id=replies.comment_id WHERE replies.parent_id=c.id AND rc.state='approved'))) ORDER BY c.created_at ASC,c.id ASC LIMIT ?`,String(actorId||''),postId,String(actorId||''),String(actorId||''),Math.min(300,Math.max(1,Number(limit)||250)));
    const ids=new Set(rows.map(r=>r.id));
    // Pending replies are personal: retain their link to an approved parent even
    // if their creation timestamp sorts ahead of that parent within a tie.
    // Never expose another reader's pending comment through this lookup.
    const knownParents=new Set(this.store.all("SELECT id FROM comments WHERE post_id=? AND state='approved'",postId).map(r=>r.id));
    return rows.map(r=>({id:r.id,postId:r.post_id,parentId:ids.has(r.parent_id)||r.state==='pending'&&knownParents.has(r.parent_id)?r.parent_id:null,
      authorName:r.state==='deleted'?'Deleted comment':r.author_name,authorBadge:r.state==='deleted'?null:ownerRole(r.user_role)?'Author':staffRoles.has(r.user_role)?'Team':null,
      deleted:r.state==='deleted',pending:r.state==='pending',body:r.state==='deleted'?'This comment was removed.':r.body,createdAt:r.created_at,updatedAt:r.updated_at,stickerId:r.state==='deleted'?null:r.sticker_id,gifId:r.state==='deleted'?null:r.gif_id,
      reactions:Number(r.reactions||0),liked:!!r.liked,own:!!actorId&&r.author_user_id===actorId,edited:r.updated_at!==r.created_at}));
  }
  toggleLike(commentId,actor){
    this.authenticate(actor);
    const comment=this.store.one('SELECT id,post_id,state FROM comments WHERE id=?',String(commentId||''));
    if(!comment||comment.state!=='approved'||!this.store.getPostById(comment.post_id))throw httpError(404,'Comment unavailable.','NOT_FOUND');
    const prior=this.store.one('SELECT reaction FROM corner_v5_comment_reactions WHERE comment_id=? AND actor_user_id=?',comment.id,actor.id);
    const stamp=now();
    this.store.transaction(()=>{
      if(prior)this.store.exec('DELETE FROM corner_v5_comment_reactions WHERE comment_id=? AND actor_user_id=?',comment.id,actor.id);
      else this.store.exec('INSERT INTO corner_v5_comment_reactions(comment_id,actor_user_id,reaction,created_at,updated_at) VALUES(?,?,?,?,?)',comment.id,actor.id,reactions[0],stamp,stamp);
    });
    return {commentId:comment.id,liked:!prior,count:Number(this.store.one('SELECT COUNT(*) n FROM corner_v5_comment_reactions WHERE comment_id=?',comment.id)?.n||0)};
  }
  update(commentId,actor,{body}={}){
    this.authenticate(actor);
    const comment=this.store.one('SELECT c.*,m.author_user_id FROM comments c LEFT JOIN corner_v5_comment_meta m ON m.comment_id=c.id WHERE c.id=?',String(commentId||''));
    if(!comment||comment.state==='deleted')throw httpError(404,'Comment not found.','NOT_FOUND');
    if(comment.author_user_id!==actor.id&&actor.role!=='owner')throw httpError(403,'You can only edit your own comment.','ROLE_FORBIDDEN');
    const text=safe(body,1000);if(text.length<3)throw httpError(400,'Add at least three characters.','INVALID_COMMENT');
    // Edits to a published reply require a fresh moderation decision unless made by the owner.
    const newState=actor.role==='owner'?'approved':'pending';
    this.store.exec('UPDATE comments SET body=?,state=?,updated_at=? WHERE id=?',text,newState,now(),comment.id);
    this.store.audit(actor.id,'comment.edited','comment',comment.id,{reviewRequired:newState==='pending'});
    return {id:comment.id,state:newState,message:newState==='pending'?'Edit submitted for review.':'Comment updated.'};
  }
  remove(commentId,actor){
    this.authenticate(actor);
    const comment=this.store.one('SELECT c.*,m.author_user_id FROM comments c LEFT JOIN corner_v5_comment_meta m ON m.comment_id=c.id WHERE c.id=?',String(commentId||''));
    if(!comment)throw httpError(404,'Comment not found.','NOT_FOUND');
    if(comment.author_user_id!==actor.id&&actor.role!=='owner')throw httpError(403,'You can only delete your own comment.','ROLE_FORBIDDEN');
    this.store.exec("UPDATE comments SET state='deleted',body='',deleted_at=?,updated_at=? WHERE id=?",now(),now(),comment.id);
    this.store.audit(actor.id,'comment.deleted.by_author','comment',comment.id);
    this.store.emit('comment.removed',comment.post_id,1,{commentId:comment.id});
    return {id:comment.id,deleted:true};
  }
  report(commentId,actor,{reason='inappropriate'}={}){
    this.authenticate(actor);
    const comment=this.store.one("SELECT c.id FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=? AND c.state='approved' AND p.state='published'",String(commentId||''));
    if(!comment)throw httpError(404,'Comment unavailable.','NOT_FOUND');
    const normalized=String(reason||'inappropriate');
    if(!['spam','harassment','inappropriate','other'].includes(normalized))throw httpError(400,'Choose a reporting reason.','INVALID_REASON');
    const id=uid('report');
    this.store.exec('INSERT OR IGNORE INTO corner_v5_comment_reports(id,comment_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?)',id,comment.id,actor.id,normalized,now());
    return {submitted:true};
  }
  afterModeration(commentId){
    const comment=this.store.one('SELECT id,post_id,state FROM comments WHERE id=?',String(commentId||''));
    if(comment?.state!=='approved')return;
    const meta=this.store.one('SELECT parent_id,author_user_id FROM corner_v5_comment_meta WHERE comment_id=?',comment.id);
    if(!meta?.parent_id)return;
    const parent=this.store.one('SELECT author_user_id FROM corner_v5_comment_meta WHERE comment_id=?',meta.parent_id);
    if(!parent?.author_user_id||parent.author_user_id===meta.author_user_id)return;
    this.store.exec(`INSERT OR IGNORE INTO corner_v5_notifications(id,user_id,kind,post_id,comment_id,created_at)
      VALUES(?,?,'reply',?,?,?)`,uid('notice'),parent.author_user_id,comment.post_id,comment.id,now());
  }
  notifications(actor,{markRead=false}={}){
    this.authenticate(actor);
    const rows=this.store.all(`SELECT n.id,n.kind,n.created_at,n.read_at,p.slug,p.title,c.author_name,c.id AS comment_id
      FROM corner_v5_notifications n JOIN posts p ON p.id=n.post_id
      JOIN comments c ON c.id=n.comment_id WHERE n.user_id=? AND p.state='published' AND c.state='approved'
      ORDER BY n.created_at DESC LIMIT 50`,actor.id);
    if(markRead&&rows.length)this.store.exec('UPDATE corner_v5_notifications SET read_at=? WHERE user_id=? AND read_at IS NULL',now(),actor.id);
    return rows.map(r=>({id:r.id,kind:r.kind,at:r.created_at,read:!!r.read_at,
      storyTitle:r.title,authorName:r.author_name,href:'/post/'+encodeURIComponent(r.slug)+'#comment-'+encodeURIComponent(r.comment_id)}));
  }
}
