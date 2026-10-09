import crypto from 'node:crypto';
import fs from 'node:fs';
import {httpError} from './domain.mjs';
import {imageHasPrivateMetadata} from './media-privacy.mjs';
// Only server-owned sizes are permitted; no arbitrary transformation requests.
export const PHOTO_VARIANTS=Object.freeze({
 tile:Object.freeze({width:440,quality:74,maxBytes:160_000}),
 card:Object.freeze({width:720,quality:76,maxBytes:300_000}),
 viewer:Object.freeze({width:1600,quality:77,maxBytes:950_000})
});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const invalid=(code,message,status=422)=>httpError(status,message,code);
/** Bounded in-process LRU with deduplicated processing.
 * Never add derivatives to persistent uploads or offsite backups.
 */
export class ImageDerivatives {
 constructor({loadSharp=()=>import('sharp'),readFile=fs.promises.readFile,stat=fs.promises.stat,cacheLimit=32*1024*1024,maxConcurrent=12}={}){
  this.loadSharp=loadSharp;this.readFile=readFile;this.stat=stat;
  this.cacheLimit=cacheLimit;this.maxConcurrent=maxConcurrent;
  this.cache=new Map();this.pending=new Map();this.bytesCached=0;
 }
 async preview({filename,key,variant}){
  const setting=PHOTO_VARIANTS[variant];
  if(!setting)throw invalid('INVALID_VARIANT','Unsupported photo variant.',400);
  const info=await this.stat(filename).catch(()=>null);
  if(!info?.isFile()||info.size<1||info.size>8*1024*1024)throw invalid('MEDIA_UNAVAILABLE','Photograph unavailable.',404);
  const fingerprint=sha([key,variant,info.dev,info.ino,info.size,info.mtimeMs,info.ctimeMs].join('|'));
  const existing=this.cache.get(fingerprint);
  if(existing){this.cache.delete(fingerprint);this.cache.set(fingerprint,existing);return existing;}
  if(this.pending.has(fingerprint))return this.pending.get(fingerprint);
  if(this.pending.size>=this.maxConcurrent)throw invalid('PREVIEW_BUSY','Too many photographs are processing. Try again shortly.',429);
  const job=this.generate(filename,setting).then(result=>{
   if(result.bytes.length<=this.cacheLimit){
    this.cache.set(fingerprint,result);this.bytesCached+=result.bytes.length;
    while(this.bytesCached>this.cacheLimit&&this.cache.size>1){
     const oldest=this.cache.keys().next().value;
     this.bytesCached-=this.cache.get(oldest).bytes.length;this.cache.delete(oldest);
    }
   }
   return result;
  }).finally(()=>this.pending.delete(fingerprint));
  this.pending.set(fingerprint,job);return job;
 }
 async generate(filename,setting){
  const original=await this.readFile(filename);
  // Recheck the bytes; files may change after a previous metadata inspection.
  const kind=original.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))?'image/jpeg':
   original.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':
   original.toString('ascii',0,4)==='RIFF'&&original.toString('ascii',8,12)==='WEBP'?'image/webp':null;
  if(!kind||imageHasPrivateMetadata(original,kind))throw invalid('PRIVATE_IMAGE','Photo contains private metadata or invalid image content.');
  const sharp=(await this.loadSharp()).default;
  if(typeof sharp!=='function')throw new Error('Image processing unavailable.');
  let bytes;
  for(const quality of [setting.quality,Math.max(48,setting.quality-18)]){
   // Sharp strips EXIF and XMP by default. Do not add withMetadata().
   bytes=await sharp(original,{limitInputPixels:40_000_000,failOn:'error'})
    .rotate().resize({width:setting.width,fit:'inside',withoutEnlargement:true})
    .webp({quality,effort:4}).toBuffer();
   if(bytes.length<=setting.maxBytes)break;
  }
  if(bytes.length>setting.maxBytes)throw invalid('PREVIEW_BUDGET','Photo cannot fit the preview byte budget.',413);
  if(imageHasPrivateMetadata(bytes,'image/webp'))throw invalid('PREVIEW_METADATA','Generated photo failed privacy inspection.');
  return {bytes,mime:'image/webp',etag:'"'+sha(bytes)+'"'};
 }
}
