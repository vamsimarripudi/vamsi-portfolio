import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {ImageDerivatives,PHOTO_VARIANTS} from '../src/v3-image-derivatives.mjs';
import {imageHasPrivateMetadata} from '../src/media-privacy.mjs';

test('real JPEG converts to bounded metadata-free WebP and deduplicates requests',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v3-derivatives-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'sample.jpg');
 fs.writeFileSync(file,await sharp({create:{width:2400,height:1600,channels:3,background:'#bfdaf2'}}).jpeg({quality:90}).toBuffer());
 let reads=0;
 const d=new ImageDerivatives({readFile:async name=>{reads++;return fs.promises.readFile(name)}});
 for(const variant of Object.keys(PHOTO_VARIANTS)){
  const [a,b]=await Promise.all([d.preview({filename:file,key:'sample.jpg',variant}),d.preview({filename:file,key:'sample.jpg',variant})]);
  assert.equal(a,b,'Concurrent identical work returns the same result');
  assert.equal(a.mime,'image/webp');
  assert.ok(a.bytes.length<=PHOTO_VARIANTS[variant].maxBytes,'Variant has a strict byte budget');
  assert.equal(imageHasPrivateMetadata(a.bytes,'image/webp'),false,'Private metadata removed');
  const info=await sharp(a.bytes).metadata();
  assert.ok(info.width<=PHOTO_VARIANTS[variant].width,'Width never exceeds preset');
  assert.ok(info.height>0);
 }
 assert.equal(reads,3);
 await d.preview({filename:file,key:'sample.jpg',variant:'tile'});
 assert.equal(reads,3,'Cached requests do not read original again');
 fs.writeFileSync(file,await sharp({create:{width:600,height:400,channels:3,background:'#ff3300'}}).jpeg().toBuffer());
 await d.preview({filename:file,key:'sample.jpg',variant:'tile'});
 assert.equal(reads,4,'Source change invalidates derivative cache');
 await assert.rejects(d.preview({filename:file,key:'sample.jpg',variant:'100000'}),{code:'INVALID_VARIANT'});
});
test('EXIF-containing originals cannot be transformed or published as previews',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v3-private-photo-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'private.jpg');
 fs.writeFileSync(file,await sharp({create:{width:120,height:80,channels:3,background:'#ff00ff'}}).jpeg().withExif({IFD0:{Copyright:'private'}}).toBuffer());
 await assert.rejects(new ImageDerivatives().preview({filename:file,key:'private.jpg',variant:'tile'}),{code:'PRIVATE_IMAGE'});
});
