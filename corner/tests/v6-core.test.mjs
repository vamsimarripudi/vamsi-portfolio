import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {CornerSocial} from '../src/v5-social.mjs';
const fixture=t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('owner','owner@fixture.test','Author','owner','hash',datetime('now'),datetime('now'))");
 store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('reader_a','a@fixture.test','Reader A','member','hash',datetime('now'),datetime('now'))");
 store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('reader_b','b@fixture.test','Reader B','member','hash',datetime('now'),datetime('now'))");
 const social=new CornerSocial(store);
 return {store,social,readerA:{id:'reader_a',display_name:'Reader A',role:'member'},readerB:{id:'reader_b',display_name:'Reader B',role:'member'}};
};
test('Latest is zero-or-one; unrelated collection reads remain paginated',t=>{
 const {store}=fixture(t);
 const first=store.createPost({title:'First public note',body:'First public body'},'owner');
 const later=store.createPost({title:'Second public note',body:'Second public body'},'owner');
 store.publish(first.id,'owner');store.publish(later.id,'owner');
 // Stable chronological ordering independent of millisecond-level fixture ties.
 store.exec('UPDATE posts SET published_at=? WHERE id=?','2026-10-29T11:00:00.000Z',first.id);
 store.exec('UPDATE posts SET published_at=? WHERE id=?','2026-10-29T11:00:01.000Z',later.id);
 const latest=store.getFeed({category:'Latest',limit:30,cursor:'ignored',tag:'any'});
 assert.equal(latest.items.length,1);assert.equal(latest.nextCursor,null);
 assert.equal(latest.items[0].id,later.id);
 assert.equal(store.getFeed({limit:30}).items.length,2);
});
test('Pending comments only visible to original actor, not another member or public',t=>{
 const {store,social,readerA,readerB}=fixture(t);
 const post=store.createPost({title:'A real discussion',body:'Conversations matter.',allowComments:true},'owner');store.publish(post.id,'owner');
 const draft=social.create(post.id,readerA,{body:'A reader comment waiting for review'});
 assert.equal(draft.state,'pending');
 assert.equal(social.approved(post.id).length,0);
 assert.equal(social.approved(post.id,{actorId:readerB.id}).length,0);
 const mine=social.approved(post.id,{actorId:readerA.id});
 assert.equal(mine.length,1);assert.equal(mine[0].pending,true);assert.equal(mine[0].own,true);
 store.moderate(draft.id,'approved','owner');social.afterModeration(draft.id);
 assert.equal(social.approved(post.id).length,1);
 assert.equal(social.approved(post.id)[0].pending,false);
});

test('Cards honor disabled reactions/comments without hiding independent Share',async()=>{
 const {card}=await import('../src/ui.mjs');
 const p={id:'post_example',slug:'example',title:'Story',type:'moment',body:'Text',allow_reactions:false,allow_comments:false};
 const hidden=card(p);
 assert.doesNotMatch(hidden,/data-v5-like|data-v6-conversation/);
 assert.match(hidden,/data-v5-share-post/);
 const allowed=card({...p,allow_reactions:true,allow_comments:true});
 assert.match(allowed,/data-v5-like/);
 assert.match(allowed,/data-v6-conversation/);
});
