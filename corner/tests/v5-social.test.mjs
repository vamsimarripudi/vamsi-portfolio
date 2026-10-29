import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {Store} from '../src/store.mjs';
import {CornerSocial} from '../src/v5-social.mjs';
import {inspectAppleMedia,normalizeRecipe,transformImage} from '../src/v5-media.mjs';
const fixture=t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('owner','owner@example.test','Vamsi','owner','hash',datetime('now'),datetime('now'))");
 store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('reader','reader@example.test','Reader','member','hash',datetime('now'),datetime('now'))");
 const social=new CornerSocial(store);
 const p=store.createPost({title:'A new memory',body:'The first monsoon rain.',allowComments:true},'owner');
 store.publish(p.id,'owner');
 return {store,social,post:p,owner:{id:'owner',role:'owner',display_name:'Vamsi'},reader:{id:'reader',role:'member',display_name:'Reader'}};
};
test('Legacy moderated comments survive additive V5 schema',t=>{
 const {store,social,post,reader}=fixture(t);
 const old=store.comment(post.id,'Earlier reader','A note from an older post.');
 store.moderate(old.id,'approved','owner');
 assert.equal(social.approved(post.id).length,1);
 const reply=social.create(post.id,reader,{body:'This story is lovely.',parentId:old.id});
 assert.equal(reply.state,'pending');assert.equal(social.approved(post.id).length,1);
 store.moderate(reply.id,'approved','owner');social.afterModeration(reply.id);
 const items=social.approved(post.id,{actorId:reader.id});
 assert.equal(items[1].parentId,old.id);assert.equal(items[1].own,true);
});
test('Owner replies create one private notification after approval',t=>{
 const {store,social,post,owner,reader}=fixture(t);
 const first=social.create(post.id,reader,{body:'This post is moving.'});
 store.moderate(first.id,'approved','owner');social.afterModeration(first.id);
 const reply=social.create(post.id,owner,{body:'Thank you for reading.',parentId:first.id});
 assert.equal(reply.state,'approved');
 assert.equal(social.notifications(reader).length,1);
 social.afterModeration(reply.id);assert.equal(social.notifications(reader).length,1);
});
test('Comment likes are reversible; edits require moderation',t=>{
 const {store,social,post,reader,owner}=fixture(t);
 const first=social.create(post.id,reader,{body:'A beautiful moment.'});
 store.moderate(first.id,'approved','owner');
 assert.deepEqual(social.like(first.id,reader),{commentId:first.id,liked:true,count:1});
 assert.deepEqual(social.like(first.id,reader),{commentId:first.id,liked:false,count:0});
 assert.equal(social.update(first.id,reader,{body:'A more thoughtful version.'}).state,'pending');
 assert.equal(social.approved(post.id).length,0);
 assert.throws(()=>social.update(first.id,{id:'another',role:'member'},{body:'Unauthorized edit'}),{code:'ROLE_FORBIDDEN'});
 store.moderate(first.id,'approved','owner');
 assert.equal(social.remove(first.id,reader).deleted,true);
});
test('Invalid attachments, archived posts, and other users are rejected',t=>{
 const {store,social,post,reader}=fixture(t);
 assert.throws(()=>social.create(post.id,reader,{body:'Hello!',parentId:'comment_unknown'}),{code:'PARENT_NOT_FOUND'});
 assert.throws(()=>social.create(post.id,reader,{gifId:'https://evil.example/file.gif'}),{code:'INVALID_GIF'});
 const sticker=social.create(post.id,reader,{stickerId:'heart'});assert.equal(sticker.state,'pending');
 store.archive(post.id,'owner');
 assert.equal(social.approved(post.id).length,0);
 assert.throws(()=>social.create(post.id,reader,{body:'No longer public.'}),{code:'NOT_FOUND'});
});
test('Image recipes remain local and reversible, supported iPhone media signatures are detected',async()=>{
 assert.throws(()=>normalizeRecipe({rotation:17}),{code:'INVALID_ROTATION'});
 const photo=await sharp({create:{width:240,height:120,channels:3,background:'#b39e87'}}).png().toBuffer();
 const bytes=await transformImage(photo,{preset:'warm',crop:'portrait',brightness:1.12});
 assert.equal((await sharp(bytes).metadata()).format,'webp');
 const mov=Buffer.alloc(32);mov.write('ftyp',4);mov.write('qt  ',8);
 assert.equal(inspectAppleMedia(mov,'video/quicktime').mime,'video/quicktime');
 mov.write('heic',8);assert.equal(inspectAppleMedia(mov,'image/heic').mime,'image/heic');
});
