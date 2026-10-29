import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {CornerSocial} from '../src/v5-social.mjs';
import {normalizeRecipe,inspectAppleMedia,editedPhoto} from '../src/v5-media.mjs';
import sharp from 'sharp';

const fixture=t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('owner','owner@example.test','Vamsi','owner','hash',datetime('now'),datetime('now'))");
 store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('member','member@example.test','Reader','member','hash',datetime('now'),datetime('now'))");
 const social=new CornerSocial(store);
 const p=store.createPost({title:'A real story',body:'Real story content and feeling.',allowComments:true},'owner');
 store.publish(p.id,'owner');
 return {store,social,post:p,owner:{id:'owner',role:'owner',display_name:'Vamsi'},reader:{id:'member',role:'member',display_name:'Reader'}};
};
test('new V5 tables retain existing legacy comments',t=>{
 const {store,social,post,reader}=fixture(t);
 const legacy=store.comment(post.id,'A legacy reader','A thoughtful legacy note.');
 store.moderate(legacy.id,'approved','owner');
 assert.equal(social.approved(post.id).length,1);
 assert.equal(social.approved(post.id)[0].parentId,null);
 const draft=social.create(post.id,reader,{body:'A new thoughtful reply.',parentId:legacy.id});
 assert.equal(draft.state,'pending');
 assert.equal(social.approved(post.id).length,1,'Pending comments remain hidden');
 store.moderate(draft.id,'approved','owner');social.afterModeration(draft.id);
 const items=social.approved(post.id,{actorId:'member'});
 assert.equal(items.length,2);
 const actualReply=items.find(item=>item.id===draft.id);
 assert.ok(actualReply,'Approved reply is present regardless of tied creation timestamps');
 assert.equal(actualReply.parentId,legacy.id);
 assert.equal(actualReply.authorName,'Reader');
});
test('threaded reply notifications wait for moderation and only target original author',t=>{
 const {store,social,post,owner,reader}=fixture(t);
 const first=social.create(post.id,reader,{body:'My comment with a thoughtful message.'});
 store.moderate(first.id,'approved','owner');social.afterModeration(first.id);
 const reply=social.create(post.id,owner,{parentId:first.id,body:'I appreciate this observation.'});
 assert.equal(reply.state,'approved');
 social.afterModeration(reply.id);
 const notices=social.notifications(reader);assert.equal(notices.length,1);
 assert.equal(notices[0].kind,'reply');assert.match(notices[0].href,/comment-/);
 social.afterModeration(reply.id);assert.equal(social.notifications(reader).length,1,'No duplicate notification');
});
test('comment heart is idempotently reversible per authenticated actor',t=>{
 const {store,social,post,reader}=fixture(t);
 const first=social.create(post.id,reader,{body:'I loved this new entry.'});
 store.moderate(first.id,'approved','owner');
 assert.deepEqual(social.toggleLike(first.id,reader),{commentId:first.id,liked:true,count:1});
 assert.deepEqual(social.toggleLike(first.id,reader),{commentId:first.id,liked:false,count:0});
 assert.throws(()=>social.toggleLike(first.id,null),{code:'AUTH_REQUIRED'});
});
test('invalid reply target, media and unpublished content cannot enter threads',t=>{
 const {store,social,post,reader}=fixture(t);
 assert.throws(()=>social.create(post.id,reader,{body:'Good observation',parentId:'comment_fake'}),{code:'PARENT_NOT_FOUND'});
 assert.throws(()=>social.create(post.id,reader,{body:'fine',gifId:'https://evil.example/x.gif'}),{code:'INVALID_GIF'});
 const mediaOnly=social.create(post.id,reader,{stickerId:'heart'});
 assert.equal(mediaOnly.state,'pending');
 store.archive(post.id,'owner');assert.equal(social.approved(post.id).length,0);
 assert.throws(()=>social.create(post.id,reader,{body:'Visible?'}),{code:'NOT_FOUND'});
});
test('media recipes reject unknown effects, preserve supported formats',async()=>{
 assert.throws(()=>normalizeRecipe({rotation:13}),{code:'INVALID_ROTATION'});
 const cfg=normalizeRecipe({preset:'warm',crop:'portrait',brightness:1.3,contrast:.9});
 assert.equal(cfg.crop,'portrait');
 const png=await sharp({create:{width:240,height:120,channels:3,background:'#c8a78d'}}).png().toBuffer();
 const out=await editedPhoto(png,cfg);
 const info=await sharp(out).metadata();assert.equal(info.format,'webp');assert.ok(info.width>0);
 const mov=Buffer.alloc(40);mov.write('ftyp',4);mov.write('qt  ',8);
 assert.equal(inspectAppleMedia(mov,'video/quicktime').mime,'video/quicktime');
 const heic=Buffer.from(mov);heic.write('heic',8);assert.equal(inspectAppleMedia(heic,'image/heic').mime,'image/heic');
});
