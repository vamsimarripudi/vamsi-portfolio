import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {sanitizeImage,imageHasPrivateMetadata} from '../src/media-privacy.mjs';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {V3Memories} from '../src/v3-memories.mjs';
import {config} from '../src/config.mjs';

const jpeg=()=>{
 const exif=Buffer.from('457869660000','hex');
 return Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe1,0,8]),exif,Buffer.from([0xff,0xda,0,2,0x12,0x34,0xff,0xd9])]);
};
const pngChunk=(type,bytes=Buffer.alloc(0))=>{
 const head=Buffer.alloc(8);
 head.writeUInt32BE(bytes.length,0);head.write(type,4,4,'ascii');
 return Buffer.concat([head,bytes,Buffer.alloc(4)]);
};
const png=()=>{
 const head=Buffer.alloc(13);head.writeUInt32BE(1,0);head.writeUInt32BE(1,4);head[8]=8;head[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',head),pngChunk('tEXt',Buffer.from('GPS\0secret')),pngChunk('IEND')]);
};
const webp=()=>{
 const vp8x=Buffer.alloc(10);vp8x[0]=0x0c;
 const chunk=(name,payload)=>{const header=Buffer.alloc(8);header.write(name,0,4);header.writeUInt32LE(payload.length,4);return Buffer.concat([header,payload,...(payload.length%2?[Buffer.alloc(1)]:[])])};
 const body=Buffer.concat([chunk('VP8X',vp8x),chunk('EXIF',Buffer.from('GPS data')),chunk('VP8 ',Buffer.from([1,2]))]);
 const head=Buffer.alloc(12);head.write('RIFF');head.writeUInt32LE(body.length+4,4);head.write('WEBP',8);
 return Buffer.concat([head,body]);
};
test('JPEG EXIF and location tags are removed before public upload',()=>{
 const original=jpeg();
 assert.equal(imageHasPrivateMetadata(original,'image/jpeg'),true);
 const clean=sanitizeImage(original,'image/jpeg');
 assert.equal(imageHasPrivateMetadata(clean,'image/jpeg'),false);
 assert.ok(!clean.includes(Buffer.from('Exif')));
 assert.deepEqual(clean.subarray(-4),original.subarray(-4));
 assert.throws(()=>sanitizeImage(Buffer.from([0xff,0xd8,0xff]),'image/jpeg'),{code:'INVALID_IMAGE'});
});
test('PNG text and eXIf metadata are not retained; pixel chunks are preserved',()=>{
 const original=png(),clean=sanitizeImage(original,'image/png');
 assert.equal(imageHasPrivateMetadata(original,'image/png'),true);
 assert.equal(imageHasPrivateMetadata(clean,'image/png'),false);
 assert.ok(!clean.includes(Buffer.from('GPS')));
 assert.ok(clean.includes(Buffer.from('IHDR')));
 assert.ok(clean.includes(Buffer.from('IEND')));
});
test('WebP EXIF/XMP chunks are stripped and RIFF length updated',()=>{
 const original=webp(),clean=sanitizeImage(original,'image/webp');
 assert.equal(imageHasPrivateMetadata(original,'image/webp'),true);
 assert.equal(imageHasPrivateMetadata(clean,'image/webp'),false);
 assert.equal(clean.readUInt32LE(4)+8,clean.length);
 assert.equal(clean[20]&0x0c,0);
 assert.ok(!clean.includes(Buffer.from('EXIF')));
});
test('Legacy media with location metadata is barred from public albums',t=>{
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'corner-privacy-'));
 const db=path.join(workspace,'test.sqlite'),store=new Store(db);
 t.after(()=>{store.close();fs.rmSync(workspace,{recursive:true,force:true})});
 new V3Engagement(store,{env:{SESSION_SECRET:'test-long-v3-secret-for-location-privacy'}});
 const memories=new V3Memories(store,{env:{CORNER_V3_MEMORIES:'1'}});
 const post=store.createPost({title:'A travel note',body:'A memory',type:'moment'},'owner');store.publish(post.id,'owner');
 const id='media_'+crypto.randomUUID(),key=crypto.randomBytes(12).toString('hex')+'.jpg';
 fs.mkdirSync(config.uploads,{recursive:true});const file=path.join(config.uploads,key);
 fs.writeFileSync(file,jpeg());t.after(()=>fs.rmSync(file,{force:true}));
 store.addMedia({id,ownerId:post.id,storageKey:key,mimeType:'image/jpeg',size:fs.statSync(file).size,alt:'Safe scene',width:1,height:1});
 assert.equal(memories.allowedMedia(id),null);
 fs.writeFileSync(file,sanitizeImage(fs.readFileSync(file),'image/jpeg'));
 assert.ok(memories.allowedMedia(id));
});
test('GIF is not eligible for photo albums without metadata stripping',()=>{
 assert.equal(imageHasPrivateMetadata(Buffer.from('GIF89a'),'image/gif'),true);
});
