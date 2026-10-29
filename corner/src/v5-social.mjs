/** V5 social activity is additive: existing published posts and moderated comments remain intact. */
import {uid,now,pureText,httpError} from './domain.mjs';

const stickers=new Set(['heart','sparkle','celebrate','wave','thanks','wow']);
const animations=new Set(['hearts','confetti','stars']);
const privileged=new Set(['owner','admin','editor','moderator']);

export class CornerSocial {
 constructor(store){
  this.store=store;
  store.db.exec(
    "CREATE TABLE IF NOT EXISTS corner_v5_comment_meta(comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,parent_id TEXT REFERENCES comments(id) ON DELETE SET NULL,author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,sticker_id TEXT,gif_id TEXT,created_at TEXT NOT NULL);"+
    "CREATE INDEX IF NOT EXISTS idx_corner_v5_parent ON corner_v5_comment_meta(parent_id);"+
    "CREATE TABLE IF NOT EXISTS corner_v5_comment_likes(comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(comment_id,actor_user_id));"+
    "CREATE TABLE IF NOT EXISTS corner_v5_notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(user_id,kind,comment_id));"+
    "CREATE INDEX IF NOT EXISTS idx_corner_v5_notice ON corner_v5_notifications(user_id,read_at,created_at DESC);"+
    "CREATE TABLE IF NOT EXISTS corner_v5_reports(id TEXT PRIMARY KEY,comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,reason TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(comment_id,reporter_id));"
  );
 }
 authorized(actor){if(!actor?.id)throw httpError(401,'Sign in to participate.','AUTH_REQUIRED');return actor}
 published(postId){
  const post=this.store.one("SELECT id,state,slug,allow_comments FROM posts WHERE id=?",String(postId||''));
  if(!post||post.state!=='published')throw httpError(404,'Story unavailable.','NOT_FOUND');return post;
 }
 create(postId,actor,{body='',parentId=null,stickerId=null,gifId=null}={}){
  this.authorized(actor);
  const post=this.published(postId);if(!post.allow_comments)throw httpError(403,'Comments are closed.','COMMENTS_CLOSED');
  if(stickerId!=null&&!stickers.has(stickerId))throw httpError(400,'Sticker unavailable.','INVALID_STICKER');
  if(gifId!=null&&!animations.has(gifId))throw httpError(400,'Animation unavailable.','INVALID_GIF');
  if(stickerId&&gifId)throw httpError(400,'Choose one attachment.','INVALID_MEDIA');
  const text=pureText(body,1001);
  if(text.length>1000||(text.length<3&&!stickerId&&!gifId))throw httpError(400,'Write at least three characters or choose a sticker.','INVALID_COMMENT');
  let parent=null;
  if(parentId){
   const row=this.store.one("SELECT id,post_id,state FROM comments WHERE id=?",String(parentId));
   if(!row||row.post_id!==postId||row.state!=='approved')throw httpError(404,'Reply target unavailable.','PARENT_NOT_FOUND');
   // Display no more than two levels; deeper replies stay under the root thread.
   parent=this.store.one('SELECT parent_id FROM corner_v5_comment_meta WHERE comment_id=?',row.id)?.parent_id||row.id;
  }
  const id=uid('comment'),stamp=now(),state=actor.role==='owner'?'approved':'pending';
  this.store.transaction(()=>{
   this.store.exec('INSERT INTO comments(id,post_id,author_name,body,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
    id,post.id,pureText(actor.display_name||'Reader',60)||'Reader',text,state,stamp,stamp);
   this.store.exec('INSERT INTO corner_v5_comment_meta(comment_id,parent_id,author_user_id,sticker_id,gif_id,created_at) VALUES(?,?,?,?,?,?)',
    id,parent,actor.id,stickerId,gifId,stamp);
   this.store.audit(actor.id,'v5.comment.created','comment',id,{parent:!!parent,attachment:!!(stickerId||gifId)});
  });
  if(state==='approved'){this.afterModeration(id);this.store.emit('comment.created',post.id,1,{commentId:id})}
  return {id,parentId:parent,state,message:state==='approved'?'Your reply is live.':'Comment submitted for review.'};
 }
 approved(postId,{actorId=null,limit=250}={}){
  const post=this.store.one("SELECT id FROM posts WHERE id=? AND state='published'",String(postId||''));
  if(!post)return [];
  const entries=this.store.all(
   "SELECT c.id,c.post_id,c.author_name,c.body,c.state,c.created_at,c.updated_at,m.parent_id,m.author_user_id,m.sticker_id,m.gif_id,u.role AS role,"+
   "(SELECT COUNT(*) FROM corner_v5_comment_likes l WHERE l.comment_id=c.id) AS likes,"+
   "(SELECT COUNT(*) FROM corner_v5_comment_likes l WHERE l.comment_id=c.id AND l.actor_user_id=?) AS mine "+
   "FROM comments c LEFT JOIN corner_v5_comment_meta m ON m.comment_id=c.id LEFT JOIN users u ON u.id=m.author_user_id "+
   "WHERE c.post_id=? AND (c.state='approved' OR (c.state='deleted' AND EXISTS(SELECT 1 FROM corner_v5_comment_meta r JOIN comments rc ON rc.id=r.comment_id WHERE r.parent_id=c.id AND rc.state='approved'))) "+
   "ORDER BY c.created_at,c.id LIMIT ?",String(actorId||''),post.id,Math.max(1,Math.min(300,Number(limit)||250))
  );
  const ids=new Set(entries.map(x=>x.id));
  return entries.map(c=>({id:c.id,postId:c.post_id,parentId:ids.has(c.parent_id)?c.parent_id:null,
   authorName:c.state==='deleted'?'Deleted comment':c.author_name,
   authorBadge:c.state==='deleted'?null:c.role==='owner'?'Author':privileged.has(c.role)?'Team':null,
   body:c.state==='deleted'?'This comment was removed.':c.body,
   deleted:c.state==='deleted',stickerId:c.state==='deleted'?null:c.sticker_id,gifId:c.state==='deleted'?null:c.gif_id,
   createdAt:c.created_at,updatedAt:c.updated_at,edited:c.updated_at!==c.created_at,
   reactions:Number(c.likes||0),liked:!!c.mine,own:!!actorId&&c.author_user_id===actorId}));
 }
 like(commentId,actor){
  this.authorized(actor);
  const c=this.store.one('SELECT id,post_id,state FROM comments WHERE id=?',String(commentId||''));
  if(!c||c.state!=='approved'||!this.store.getPostById(c.post_id))throw httpError(404,'Comment unavailable.','NOT_FOUND');
  const row=this.store.one('SELECT 1 FROM corner_v5_comment_likes WHERE comment_id=? AND actor_user_id=?',c.id,actor.id);
  this.store.transaction(()=>{
   if(row)this.store.exec('DELETE FROM corner_v5_comment_likes WHERE comment_id=? AND actor_user_id=?',c.id,actor.id);
   else this.store.exec('INSERT INTO corner_v5_comment_likes(comment_id,actor_user_id,created_at) VALUES(?,?,?)',c.id,actor.id,now());
  });
  return {commentId:c.id,liked:!row,count:Number(this.store.one('SELECT COUNT(*) n FROM corner_v5_comment_likes WHERE comment_id=?',c.id)?.n||0)};
 }
 update(commentId,actor,{body}={}){
  this.authorized(actor);
  const c=this.store.one('SELECT c.*,m.author_user_id FROM comments c LEFT JOIN corner_v5_comment_meta m ON m.comment_id=c.id WHERE c.id=?',String(commentId||''));
  if(!c||c.state==='deleted')throw httpError(404,'Comment unavailable.','NOT_FOUND');
  if(actor.role!=='owner'&&c.author_user_id!==actor.id)throw httpError(403,'Only your own comments can be edited.','ROLE_FORBIDDEN');
  const text=pureText(body,1001);if(text.length<3||text.length>1000)throw httpError(400,'Use 3–1000 characters.','INVALID_COMMENT');
  const state=actor.role==='owner'?'approved':'pending';
  this.store.exec('UPDATE comments SET body=?,state=?,updated_at=? WHERE id=?',text,state,now(),c.id);
  this.store.audit(actor.id,'v5.comment.edited','comment',c.id,{state});
  return {id:c.id,state,message:state==='pending'?'Edit submitted for review.':'Comment updated.'};
 }
 remove(commentId,actor){
  this.authorized(actor);
  const c=this.store.one('SELECT c.*,m.author_user_id FROM comments c LEFT JOIN corner_v5_comment_meta m ON m.comment_id=c.id WHERE c.id=?',String(commentId||''));
  if(!c)throw httpError(404,'Comment unavailable.','NOT_FOUND');
  if(actor.role!=='owner'&&c.author_user_id!==actor.id)throw httpError(403,'Only your own comments can be deleted.','ROLE_FORBIDDEN');
  this.store.exec("UPDATE comments SET state='deleted',body='',deleted_at=?,updated_at=? WHERE id=?",now(),now(),c.id);
  this.store.audit(actor.id,'v5.comment.deleted','comment',c.id);
  this.store.emit('comment.removed',c.post_id,1,{commentId:c.id});
  return {id:c.id,deleted:true};
 }
 report(commentId,actor,{reason='inappropriate'}={}){
  this.authorized(actor);
  const c=this.store.one("SELECT c.id FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=? AND c.state='approved' AND p.state='published'",String(commentId||''));
  if(!c)throw httpError(404,'Comment unavailable.','NOT_FOUND');
  if(!['spam','harassment','inappropriate','other'].includes(reason))throw httpError(400,'Choose a reporting reason.','INVALID_REASON');
  this.store.exec('INSERT OR IGNORE INTO corner_v5_reports(id,comment_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?)',uid('report'),c.id,actor.id,reason,now());
  return {submitted:true};
 }
 afterModeration(commentId){
  const c=this.store.one('SELECT id,post_id,state FROM comments WHERE id=?',String(commentId||''));
  if(c?.state!=='approved')return;
  const m=this.store.one('SELECT parent_id,author_user_id FROM corner_v5_comment_meta WHERE comment_id=?',c.id);
  if(!m?.parent_id)return;
  const parent=this.store.one('SELECT author_user_id FROM corner_v5_comment_meta WHERE comment_id=?',m.parent_id);
  if(!parent?.author_user_id||parent.author_user_id===m.author_user_id)return;
  this.store.exec("INSERT OR IGNORE INTO corner_v5_notifications(id,user_id,kind,post_id,comment_id,created_at) VALUES(?,?,'reply',?,?,?)",
   uid('notice'),parent.author_user_id,c.post_id,c.id,now());
 }
 notifications(actor,{markRead=false}={}){
  this.authorized(actor);
  const entries=this.store.all("SELECT n.id,n.kind,n.created_at,n.read_at,p.slug,p.title,c.author_name,c.id AS comment_id FROM corner_v5_notifications n JOIN posts p ON p.id=n.post_id JOIN comments c ON c.id=n.comment_id WHERE n.user_id=? AND p.state='published' AND c.state='approved' ORDER BY n.created_at DESC LIMIT 50",actor.id);
  if(markRead)this.store.exec('UPDATE corner_v5_notifications SET read_at=? WHERE user_id=? AND read_at IS NULL',now(),actor.id);
  return entries.map(x=>({id:x.id,kind:x.kind,at:x.created_at,read:!!x.read_at,storyTitle:x.title,authorName:x.author_name,href:'/post/'+encodeURIComponent(x.slug)+'#comment-'+encodeURIComponent(x.comment_id)}));
 }
}