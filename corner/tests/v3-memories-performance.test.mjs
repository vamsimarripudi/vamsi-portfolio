import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../src/store.mjs';
import {config} from '../src/config.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {V3Memories} from '../src/v3-memories.mjs';
import {sanitizeImage} from '../src/media-privacy.mjs';
import {albumPage} from '../src/v3-memories-ui.mjs';

const owner={id:'owner',role:'owner'};
const jpegWithExif=()=>Buffer.concat([
 Buffer.from([0xff,0xd8,0xff,0xe1,0,8]),Buffer.from('457869660000','hex'),
 Buffer.from([0xff,0xda,0,2,0x12,0x34,0xff,0xd9])
]);
const memories=store=>{
 new V3Engagement(store,{env:{SESSION_SECRET:'phase2-tests-use-a-strong-dedicated-secret'}});
 return new V3Memories(store,{env:{CORNER_V3_MEMORIES:'1'}});
};
test('image eligibility cache invalidates on metadata edits and post archive',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'v3-image-cache-'));
 const store=new Store(path.join(root,'corner.sqlite'));
 const filename=crypto.randomBytes(16).toString('hex')+'.jpg';
 const filepath=path.join(config.uploads,filename);
 fs.mkdirSync(config.uploads,{recursive:true});
 t.after(()=>{store.close();fs.rmSync(filepath,{force:true});fs.rmSync(root,{recursive:true,force:true})});
 new V3Engagement(store,{env:{SESSION_SECRET:'strong-memories-regression-test-session'}});
 let scans=0;
 const m=new V3Memories(store,{env:{CORNER_V3_MEMORIES:'1'},readImage:file=>{scans++;return fs.readFileSync(file)}});
 const post=store.createPost({title:'A public day',body:'A short memory',type:'moment'},owner.id);
 store.publish(post.id,owner.id);
 const original=jpegWithExif(),clean=sanitizeImage(original,'image/jpeg');
 fs.writeFileSync(filepath,clean);
 const mediaId='media_'+crypto.randomUUID();
 store.addMedia({id:mediaId,ownerId:post.id,storageKey:filename,mimeType:'image/jpeg',size:clean.length,alt:'A photograph',width:120,height:80});
 const album=m.albumWrite(owner,{title:'A safe album',state:'published',mediaIds:[mediaId]});
 assert.equal(scans,1);
 assert.equal(m.album(album.slug).images.length,1);
 assert.equal(m.albums().length,1);
 assert.equal(scans,1,'Repeated reads reuse a verified image fingerprint');
 assert.match(albumPage(m,album.slug),/width="120" height="80"/);
 fs.writeFileSync(filepath,original);
 assert.throws(()=>m.album(album.slug),{code:'NOT_FOUND'});
 assert.equal(scans,2,'EXIF edit invalidates the cache');
 fs.writeFileSync(filepath,clean);
 assert.equal(m.album(album.slug).images.length,1);
 assert.equal(scans,3);
 store.archive(post.id,owner.id);
 assert.throws(()=>m.album(album.slug),{code:'NOT_FOUND'});
 assert.equal(scans,3,'Post access restrictions remain enforced');
});
test('expired public Now updates remain in chronological history',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const m=memories(store),base=Date.now(),days=n=>new Date(base+n*86400000).toISOString();
 m.recordNow(owner,{label:'Public yesterday',detail:'An old public update',icon:'✳',isActive:true,activeFrom:days(-4),activeUntil:days(-1)});
 store.exec('UPDATE v3_now_history SET changed_at=? WHERE label=?',days(-3),'Public yesterday');
 m.recordNow(owner,{label:'Private latest',detail:'Do not show',isActive:false});
 assert.deepEqual(m.nowHistory().map(x=>x.label),['Public yesterday']);
});
test('future scheduled Now update superseded before activation stays private',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const m=memories(store),base=Date.now(),days=n=>new Date(base+n*86400000).toISOString();
 m.recordNow(owner,{label:'Never went live',detail:'Scheduled preview',isActive:true,activeFrom:days(-1),activeUntil:days(3)});
 store.exec('UPDATE v3_now_history SET changed_at=? WHERE label=?',days(-3),'Never went live');
 m.recordNow(owner,{label:'Replaced in advance',detail:'Inactive',isActive:false});
 store.exec('UPDATE v3_now_history SET changed_at=? WHERE label=?',days(-2),'Replaced in advance');
 assert.deepEqual(m.nowHistory(),[]);
});