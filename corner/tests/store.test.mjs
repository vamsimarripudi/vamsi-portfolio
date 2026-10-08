import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.mjs';

const memory=(t)=>{const store=new Store(':memory:');t.after(()=>store.close());return store;};
const create=(store,p={})=>store.createPost({type:'tech_note',title:'An intentionally small note',body:'A paragraph with real content.',tags:['Engineering'],allowComments:true,allowReactions:true,...p},'owner-test');

test('drafts stay private; lifecycle, version conflicts and restored visibility',t=>{
 const store=memory(t),p=create(store);assert.equal(store.getFeed().items.length,0);
 assert.equal(store.getPost(p.slug),null);
 const saved=store.savePost(p.id,{version:p.version,title:'A revised title'},'owner');assert.equal(saved.version,p.version+1);
 assert.throws(()=>store.savePost(p.id,{version:p.version,title:'Stale overwrite'},'owner'),{code:'VERSION_CONFLICT'});
 const published=store.publish(p.id,'owner');assert.equal(published.state,'published');
 assert.equal(store.getPost(p.slug).title,'A revised title');assert.equal(store.getFeed().items.length,1);
 assert.equal(store.search('revised').length,1);
 store.archive(p.id,'owner');assert.equal(store.getFeed().items.length,0);
 assert.equal(store.getPost(p.slug),null);
 const restored=store.restore(p.id,'owner');assert.equal(restored.state,'published');assert.equal(store.getFeed().items.length,1);
});

test('reactions toggle on same actor; moderated comments never leak',t=>{
 const store=memory(t),post=store.publish(create(store).id,'owner');
 let result=store.changeReaction(post.id,'❤️','persistent-visitor');assert.equal(result.counts['❤️'],1);
 result=store.changeReaction(post.id,'👏','persistent-visitor');assert.deepEqual(result.counts,{'👏':1});
 result=store.changeReaction(post.id,'👏','persistent-visitor');assert.deepEqual(result.counts,{});
 const pending=store.comment(post.id,'A reader','A lovely small note');assert.equal(pending.state,'pending');
 assert.equal(store.getComments(post.id).length,0);
 store.moderate(pending.id,'approved','owner');assert.equal(store.getComments(post.id).length,1);
 store.moderate(pending.id,'hidden','owner');assert.equal(store.getComments(post.id).length,0);
});

test('future scheduled titles stay private until teaser opt-in',t=>{
 const store=memory(t);
 const p=create(store,{type:'wish',title:'A surprise for the future',upcomingPublic:false});
 const next=new Date(Date.now()+3600000).toISOString();store.schedule(p.id,{scheduledAt:next,timezone:'UTC'},'owner');
 assert.equal(store.upcoming(false).length,1);assert.equal(store.upcoming(true).length,0);
 const draft=store.adminPost(p.id);store.savePost(p.id,{version:draft.version,upcomingPublic:true},'owner');
 assert.equal(store.upcoming(true).length,1);
});

test('scheduled publishing is idempotent and retains a single occurrence',t=>{
 const store=memory(t),p=create(store,{type:'wish',title:'A scheduled happy moment'});
 store.schedule(p.id,{scheduledAt:new Date(Date.now()+600000).toISOString(),timezone:'UTC'},'owner');
 store.exec('UPDATE posts SET scheduled_at=? WHERE id=?',new Date(Date.now()-60000).toISOString(),p.id);
 const first=store.tick();assert.equal(first.length,1);
 assert.equal(store.tick().length,0);
 assert.equal(store.one('SELECT count(*) AS n FROM post_occurrences').n,1);
 assert.equal(store.getFeed().items.length,1);
});

test('annual recurring wishes publish once, advance to next year, then stop',t=>{
 const store=memory(t),p=create(store,{type:'wish',title:'Once a year',featured:true,upcomingPublic:true});
 const nextYear=new Date().getUTCFullYear()+1;
 const firstInstant=`${nextYear}-05-12T15:00:00.000Z`;
 store.schedule(p.id,{scheduledAt:firstInstant,localTime:`${nextYear}-05-12T15:00`,recurrence:'yearly',timezone:'UTC',recurrenceEndYear:nextYear},'owner');
 const after=`${nextYear}-05-12T15:00:30.000Z`;
 assert.equal(store.tick(after).length,1);assert.equal(store.tick(after).length,0);
 assert.equal(store.one('SELECT count(*) AS n FROM post_occurrences').n,1);
 assert.equal(store.one("SELECT count(*) AS n FROM posts WHERE state='published'").n,1);
 assert.equal(store.adminPost(p.id).state,'archived');
});

test('media for yearly child inherits original secure media metadata',t=>{
 const store=memory(t),p=create(store,{type:'wish',title:'Photo wish'});
 store.addMedia({id:'media-test',ownerId:p.id,storageKey:'fake-image.png',mimeType:'image/png',size:80,alt:'A landmark'});
 const published=store.publish(p.id,'owner');
 assert.equal(store.listMedia(published.id)[0].alt_text,'A landmark');
 store.exec("INSERT INTO posts(id,parent_post_id,slug,type,title,created_at,updated_at,state,published_at) VALUES(?,?,?,?,?,?,?,?,?)",'post-child',p.id,'child-story','wish','One year later',new Date().toISOString(),new Date().toISOString(),'published',new Date().toISOString());
 assert.equal(store.listMedia('post-child')[0].storage_key,'fake-image.png');
});

test('admin settings and comments reject invalid state',t=>{
 const store=memory(t);
 assert.throws(()=>store.pendingComments('evil'),{status:400});
 assert.throws(()=>create(store,{type:'invalid'}),{status:400});
 assert.throws(()=>create(store,{timezone:'Pluto/West'}),{status:400});
});

test('feature and pin windows activate and expire without unpublishing',t=>{
 const store=memory(t),post=create(store,{title:'Timed spotlight',featured:true,pinned:true});
 const scheduledAt=new Date(Date.now()+60_000).toISOString();
 const startAt=new Date(Date.parse(scheduledAt)+60_000).toISOString();
 const endAt=new Date(Date.parse(scheduledAt)+120_000).toISOString();
 store.schedule(post.id,{scheduledAt,timezone:'UTC',featureStartAt:startAt,featureEndAt:endAt,pinStartAt:startAt,pinEndAt:endAt},'owner');
 store.tick(new Date(Date.parse(scheduledAt)+1_000).toISOString());
 assert.equal(store.getFeatured(),null);
 assert.equal(store.getPin().length,0);
 store.tick(new Date(Date.parse(startAt)+1_000).toISOString());
 assert.equal(store.getFeatured()?.id,post.id);
 assert.equal(store.getPin()[0]?.id,post.id);
 store.tick(new Date(Date.parse(endAt)+1_000).toISOString());
 assert.equal(store.getFeatured(),null);
 assert.equal(store.getPin().length,0);
 assert.equal(store.getPost(post.slug)?.state,undefined); // Public records omit internal state.
 assert.equal(store.getFeed().items.length,1);
});
