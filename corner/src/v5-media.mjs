/** Corner V5: durable, private iPhone media conversion and non-destructive photo adjustments. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {uid,now,httpError,clamp} from './domain.mjs';
const run=promisify(execFile);
const idRule=/^media_[0-9a-f-]{36}$/i;
const keyRule=/^[A-Za-z0-9_-]{12,100}\.(webp|mp4)$/i;
const safeN=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
export function inspectAppleMedia(buffer,mime=''){
 if(!Buffer.isBuffer(buffer)||buffer.length<16||buffer.toString('ascii',4,8)!=='ftyp')return null;
 const brand=buffer.toString('ascii',8,12);
 if(/^(heic|heix|hevc|hevx|mif1|msf1)$/i.test(brand))return {kind:'image',mime:'image/heic',ext:'.heic'};
 if(brand==='qt  ')return {kind:'video',mime:'video/quicktime',ext:'.mov'};
 if(/^(isom|iso2|mp41|mp42|avc1|hvc1|hev1|M4V )$/i.test(brand))return {kind:'video',mime:'video/mp4',ext:'.mp4'};
 if(['video/quicktime','video/mp4'].includes(mime))return {kind:'video',mime,ext:mime==='video/mp4'?'.mp4':'.mov'};
 return null;
}
export const normalizeRecipe=(x={})=>{
 const preset=String(x.preset||'original'),crop=String(x.crop||'original'),rotation=Number(x.rotation||0);
 if(!['original','warm','film','mono','dream'].includes(preset))throw httpError(400,'Unsupported filter.','INVALID_FILTER');
 if(!['original','square','portrait','landscape'].includes(crop))throw httpError(400,'Unsupported crop.','INVALID_CROP');
 if(![0,90,180,270].includes(rotation))throw httpError(400,'Rotate in 90-degree steps.','INVALID_ROTATION');
 return {preset,crop,rotation,brightness:clamp(safeN(x.brightness,1),.6,1.4),contrast:clamp(safeN(x.contrast,1),.6,1.4),saturation:clamp(safeN(x.saturation,1),0,2)};
};
export async function normalizeHeicImage(bytes){
 try{
  const input=sharp(bytes,{limitInputPixels:50_000_000}),m=await input.metadata();
  if(!m.width||!m.height||m.width*m.height>50_000_000)throw Error('Unsupported image dimensions');
  const output=await sharp(bytes,{limitInputPixels:50_000_000}).rotate().resize({width:2800,height:2800,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer();
  const dimensions=await sharp(output).metadata();
  return {bytes:output,mime:'image/webp',ext:'.webp',width:dimensions.width,height:dimensions.height};
 }catch{throw httpError(415,'HEIC conversion is not available for this file. Export it as JPEG.','HEIC_UNSUPPORTED')}
}
export async function transformImage(bytes,raw){
 const r=normalizeRecipe(raw);
 const m=await sharp(bytes,{limitInputPixels:50_000_000}).metadata();
 if(!m.width||!m.height)throw httpError(415,'Unsupported photograph.','PHOTO_UNSUPPORTED');
 let out=sharp(bytes,{limitInputPixels:50_000_000}).rotate(r.rotation);
 const sizes={square:[1,1],portrait:[4,5],landscape:[16,9]};
 if(sizes[r.crop]){
  const [w,h]=sizes[r.crop];out=out.resize(Math.min(2200,m.width),Math.min(2200,Math.round(m.width*h/w)),{fit:'cover',position:'attention',withoutEnlargement:true});
 }else out=out.resize({width:2200,height:2200,fit:'inside',withoutEnlargement:true});
 if(r.preset==='mono')out=out.greyscale();
 if(r.preset==='warm')out=out.tint({r:246,g:222,b:202});
 if(r.preset==='film')out=out.modulate({saturation:.84}).gamma(1.06);
 if(r.preset==='dream')out=out.blur(.5).modulate({saturation:1.15});
 out=out.modulate({brightness:r.brightness,saturation:r.saturation});
 if(r.contrast!==1)out=out.linear(r.contrast,128*(1-r.contrast));
 return out.webp({quality:83,effort:4}).toBuffer();
}
export class CornerMediaJobs {
 constructor(store,{uploads}={}){
  this.store=store;this.uploads=uploads;
  this.queue=path.join(uploads,'v5-originals');fs.mkdirSync(this.queue,{recursive:true,mode:0o700});
  store.db.exec(
   "CREATE TABLE IF NOT EXISTS corner_v5_video_jobs(id TEXT PRIMARY KEY,post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,source_key TEXT NOT NULL,source_mime TEXT NOT NULL,state TEXT NOT NULL,alt_text TEXT NOT NULL DEFAULT '',caption TEXT NOT NULL DEFAULT '',trim_start REAL NOT NULL DEFAULT 0,trim_end REAL NOT NULL DEFAULT 0,media_id TEXT REFERENCES media(id) ON DELETE SET NULL,error_code TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);"+
   "CREATE INDEX IF NOT EXISTS idx_corner_v5_video_jobs ON corner_v5_video_jobs(state,created_at);"+
   "CREATE TABLE IF NOT EXISTS corner_v5_photo_edits(media_id TEXT PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,recipe TEXT NOT NULL,output_key TEXT,updated_at TEXT NOT NULL);"
  );
  this.busy=false;
  store.exec("UPDATE corner_v5_video_jobs SET state='queued' WHERE state='processing'");
  setImmediate(()=>this.drain().catch(()=>{}));
 }
 start({postId,buffer,mime,alt='',caption='',start=0,end=0}){
  const kind=inspectAppleMedia(buffer,mime);
  if(!kind||kind.kind!=='video')throw httpError(415,'Supported iPhone MOV or MP4 required.','INVALID_VIDEO');
  if(buffer.length>75*1024*1024)throw httpError(413,'Video exceeds 75 MB.','VIDEO_LIMIT');
  if(!this.store.adminPost(postId))throw httpError(404,'Save the draft before uploading video.','POST_NOT_FOUND');
  start=clamp(safeN(start,0),0,179);end=clamp(safeN(end,0),0,180);
  if(end&&end<=start)throw httpError(400,'Trim end must follow trim start.','INVALID_TRIM');
  const total=fs.readdirSync(this.queue).reduce((n,key)=>{try{return n+fs.statSync(path.join(this.queue,key)).size}catch{return n}},0);
  if(total+buffer.length>450*1024*1024)throw httpError(507,'Video storage is full. Try a shorter clip.','STORAGE_LIMIT');
  const id=uid('vjob'),sourceKey=id+kind.ext,time=now();
  fs.writeFileSync(path.join(this.queue,sourceKey),buffer,{flag:'wx',mode:0o600});
  try{this.store.exec("INSERT INTO corner_v5_video_jobs(id,post_id,source_key,source_mime,state,alt_text,caption,trim_start,trim_end,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",id,postId,sourceKey,kind.mime,'queued',String(alt).slice(0,240),String(caption).slice(0,300),start,end,time,time)}
  catch(e){fs.rmSync(path.join(this.queue,sourceKey),{force:true});throw e}
  setImmediate(()=>this.drain().catch(()=>{}));
  return {jobId:id,state:'queued',message:'Converting to widely supported H.264 video.'};
 }
 retrim(mediaId,{start=0,end=0}={}){
  if(!idRule.test(String(mediaId||'')))throw httpError(404,'Video not found.','NOT_FOUND');
  const media=this.store.one("SELECT * FROM media WHERE id=? AND owner_type='post'",mediaId);
  if(!media||!media.mime_type.startsWith('video/'))throw httpError(404,'Video not found.','NOT_FOUND');
  const original=this.store.one("SELECT source_key,source_mime FROM corner_v5_video_jobs WHERE media_id=? AND state='ready' ORDER BY created_at ASC LIMIT 1",mediaId);
  if(!original||!fs.existsSync(path.join(this.queue,original.source_key)))throw httpError(409,'Original video unavailable for editing.','ORIGINAL_UNAVAILABLE');
  start=clamp(safeN(start,0),0,179);end=clamp(safeN(end,0),0,180);
  if(end&&end<=start)throw httpError(400,'Trim end must follow start.','INVALID_TRIM');
  const id=uid('vjob'),time=now();
  this.store.exec("INSERT INTO corner_v5_video_jobs(id,post_id,source_key,source_mime,state,alt_text,caption,trim_start,trim_end,media_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
   id,media.owner_id,original.source_key,original.source_mime,'queued',media.alt_text,media.caption,start,end,mediaId,time,time);
  setImmediate(()=>this.drain().catch(()=>{}));return {jobId:id,state:'queued',postId:media.owner_id};
 }
 photoRecipe(mediaId){
  const row=this.store.one('SELECT recipe FROM corner_v5_photo_edits WHERE media_id=?',mediaId);
  try{return row?JSON.parse(row.recipe):null}catch{return null}
 }
 status(jobId,postId){
  if(!/^vjob_[0-9a-f-]{36}$/i.test(String(jobId||'')))throw httpError(404,'Job not found.','NOT_FOUND');
  const row=this.store.one('SELECT id,post_id,state,error_code,media_id,updated_at FROM corner_v5_video_jobs WHERE id=?',jobId);
  if(!row||row.post_id!==postId)throw httpError(404,'Job not found.','NOT_FOUND');
  return {jobId:row.id,postId:row.post_id,state:row.state,errorCode:row.error_code,mediaId:row.media_id,updatedAt:row.updated_at};
 }
 async editPhoto(mediaId,changes,actor){
  if(!idRule.test(String(mediaId||'')))throw httpError(404,'Photo not found.');
  const record=this.store.one('SELECT * FROM media WHERE id=?',mediaId);
  if(!record?.mime_type.startsWith('image/'))throw httpError(404,'Photo not found.');
  const original=path.resolve(this.uploads,record.storage_key);
  if(!original.startsWith(path.resolve(this.uploads)+path.sep)||!fs.existsSync(original))throw httpError(404,'Original photo unavailable.');
  const recipe=normalizeRecipe(changes),bytes=await transformImage(fs.readFileSync(original),recipe);
  const newKey=crypto.randomBytes(18).toString('base64url')+'.webp';
  fs.writeFileSync(path.join(this.uploads,newKey),bytes,{flag:'wx',mode:0o600});
  const previous=this.store.one('SELECT output_key FROM corner_v5_photo_edits WHERE media_id=?',mediaId);
  try{this.store.transaction(()=>{
   this.store.exec('INSERT INTO corner_v5_photo_edits(media_id,recipe,output_key,updated_at) VALUES(?,?,?,?) ON CONFLICT(media_id) DO UPDATE SET recipe=excluded.recipe,output_key=excluded.output_key,updated_at=excluded.updated_at',
    mediaId,JSON.stringify(recipe),newKey,now());
   this.store.audit(actor,'v5.photo.edited','media',mediaId,{preset:recipe.preset,crop:recipe.crop});
  })}catch(e){fs.rmSync(path.join(this.uploads,newKey),{force:true});throw e}
  if(previous?.output_key&&keyRule.test(previous.output_key))fs.rmSync(path.join(this.uploads,previous.output_key),{force:true});
  return {saved:true,mediaId,recipe};
 }
 resetPhoto(mediaId,actor){
  const row=this.store.one('SELECT output_key FROM corner_v5_photo_edits WHERE media_id=?',mediaId);
  this.store.exec('DELETE FROM corner_v5_photo_edits WHERE media_id=?',mediaId);
  if(row?.output_key&&keyRule.test(row.output_key))fs.rmSync(path.join(this.uploads,row.output_key),{force:true});
  this.store.audit(actor,'v5.photo.reset','media',mediaId);return {restored:true,mediaId};
 }
 displayed(media){
  const row=this.store.one('SELECT output_key FROM corner_v5_photo_edits WHERE media_id=?',media.id);
  if(!row?.output_key||!keyRule.test(row.output_key))return null;
  const filename=path.join(this.uploads,row.output_key);
  return fs.existsSync(filename)?{filename,mime:'image/webp'}:null;
 }
 discard(mediaId){
  const row=this.store.one('SELECT output_key FROM corner_v5_photo_edits WHERE media_id=?',mediaId);
  if(row?.output_key&&keyRule.test(row.output_key))fs.rmSync(path.join(this.uploads,row.output_key),{force:true});
 }
 async drain(){
  if(this.busy)return;this.busy=true;
  try{while(true){
   const job=this.store.one("SELECT * FROM corner_v5_video_jobs WHERE state='queued' ORDER BY created_at LIMIT 1");
   if(!job)break;
   this.store.exec("UPDATE corner_v5_video_jobs SET state='processing',updated_at=? WHERE id=?",now(),job.id);
   const origin=path.join(this.queue,job.source_key),newKey=crypto.randomBytes(18).toString('base64url')+'.mp4',destination=path.join(this.uploads,newKey);
   try{
    if(!fs.existsSync(origin))throw Error('Original file missing');
    const probe=await run('ffprobe',['-v','error','-show_entries','format=duration:stream=width,height,codec_name,color_transfer','-select_streams','v:0','-of','json',origin],{timeout:15000,maxBuffer:100000});
    const information=JSON.parse(probe.stdout),stream=information.streams?.[0]||{},duration=Number(information.format?.duration);
    if(!stream.width||!stream.height||stream.width*stream.height>4096*4096||!Number.isFinite(duration)||duration<=0||duration>181)throw Error('Video resolution or duration exceeds limit');
    const start=job.trim_start,end=job.trim_end||duration,len=Math.min(180,end,duration)-start;
    if(len<=0)throw Error('Invalid video trim');
    const scale='scale=1920:1920:force_original_aspect_ratio=decrease,format=yuv420p';
    const hdr=['smpte2084','arib-std-b67'].includes(stream.color_transfer);
    const vf=hdr?'zscale=t=linear:npl=100,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,'+scale:scale;
    const args=['-y','-hide_banner','-loglevel','error','-ss',String(start),'-i',origin,'-t',String(len),'-map','0:v:0','-map','0:a:0?','-map_metadata','-1','-vf',vf,'-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','112k','-movflags','+faststart',destination];
    try{await run('ffmpeg',args,{timeout:140000,maxBuffer:100000})}
    catch(e){if(!hdr)throw e;args[args.indexOf('-vf')+1]=scale;await run('ffmpeg',args,{timeout:140000,maxBuffer:100000})}
    const bytes=fs.statSync(destination).size;
    if(bytes<100||bytes>75*1024*1024)throw Error('Converted video size is unsupported');
    let mediaId=job.media_id||uid('media'),oldKey=null;
    this.store.transaction(()=>{
     if(job.media_id){
      const previous=this.store.one('SELECT storage_key FROM media WHERE id=? AND owner_id=?',mediaId,job.post_id);
      if(!previous)throw Error('Video target changed during processing');
      oldKey=previous.storage_key;
      this.store.exec("UPDATE media SET storage_key=?,mime_type='video/mp4',size_bytes=?,width=?,height=? WHERE id=?",newKey,bytes,stream.width,stream.height,mediaId);
     }else this.store.addMedia({id:mediaId,ownerId:job.post_id,storageKey:newKey,mimeType:'video/mp4',size:bytes,width:stream.width,height:stream.height,alt:job.alt_text,caption:job.caption});
     this.store.exec("UPDATE corner_v5_video_jobs SET state='ready',media_id=?,error_code=NULL,updated_at=? WHERE id=?",mediaId,now(),job.id);
    });
    if(oldKey&&keyRule.test(oldKey))fs.rmSync(path.join(this.uploads,oldKey),{force:true});
    const p=this.store.one('SELECT state,slug,version FROM posts WHERE id=?',job.post_id);
    if(p?.state==='published')this.store.emit('post.updated',job.post_id,p.version,{slug:p.slug});
   }catch(e){
    fs.rmSync(destination,{force:true});
    const code=e.code==='ENOENT'?'FFMPEG_UNAVAILABLE':'CONVERSION_FAILED';
    this.store.exec("UPDATE corner_v5_video_jobs SET state='failed',error_code=?,updated_at=? WHERE id=?",code,now(),job.id);
   }
  }}finally{this.busy=false}
 }
}