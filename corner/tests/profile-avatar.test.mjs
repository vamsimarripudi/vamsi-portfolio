import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {Store} from '../src/store.mjs';
import {IdentityService} from '../src/identity.mjs';

test('private member avatar rejects invalid files, strips metadata and persists a small WebP', async t=>{
  const store=new Store(':memory:');
  t.after(()=>store.close());
  const service=new IdentityService(store,{env:{NODE_ENV:'test',SESSION_SECRET:'test-session-secret-'.repeat(3)}});
  const id='usr_avatar_contract';
  const stamp=new Date().toISOString();
  store.exec('INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
    id,'profile-photo@example.test','Profile Example','member','unused-test-hash',stamp,stamp);
  store.exec('INSERT INTO identity_profiles(user_id,verified_at,created_at,updated_at) VALUES(?,?,?,?)',id,stamp,stamp,stamp);
  const actor={id,role:'member'};
  const source=await sharp({create:{width:800,height:400,channels:3,background:'#9b674f'}}).png().toBuffer();
  await assert.rejects(()=>service.saveAvatar(actor,Buffer.from('not an image'),'image/png'),err=>err.status===415);
  await assert.rejects(()=>service.saveAvatar(actor,source,'image/jpeg'),err=>err.status===415);
  await assert.rejects(()=>service.saveAvatar(actor,Buffer.alloc(3*1024*1024+1),'image/png'),err=>err.status===413);
  const saved=await service.saveAvatar(actor,source,'image/png');
  assert.equal(saved.hasAvatar,true);
  const record=service.avatar(actor);
  assert.ok(record.image_webp.length<256*1024);
  const metadata=await sharp(record.image_webp).metadata();
  assert.equal(metadata.format,'webp');
  assert.equal(metadata.width,320);
  assert.equal(metadata.height,320);
  assert.equal(metadata.exif,undefined,'embedded metadata must not survive image transformation');
  assert.equal(service.safeMe(service.account(id)).hasAvatar,true);
  assert.equal(service.safeMe(service.account(id)).avatarUrl,'/api/v1/me/avatar');
  const strangerId='usr_different_member';
  store.exec('INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',strangerId,'stranger@example.test','A different member','member','unused-test-hash',stamp,stamp);
  assert.equal(service.avatar({id:strangerId}),null,'avatar is restricted to the session user');
  assert.equal(service.deleteAvatar(actor).hasAvatar,false);
  assert.equal(service.avatar(actor),null);
  assert.equal(service.safeMe(service.account(id)).hasAvatar,false);
});

test('private avatar routing and upload UI enforce signed-in actor identity',async()=>{
 const {readFileSync}=await import('node:fs');
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 assert.match(read('src/identity-routes.mjs'),/if\(path==='\/api\/me\/avatar'\)/);
 assert.match(read('src/identity-routes.mjs'),/const user=requireUser\(req\)/);
 assert.match(read('src/identity-routes.mjs'),/readBody\(req,3\*1024\*1024\)/);
 assert.match(read('src/identity-ui.mjs'),/data-avatar-file/);
 assert.match(read('public/account.js'),/CornerImageCrop\.open/);
 assert.match(read('public/account.js'),/api\/v1\/me\/avatar/);
});
