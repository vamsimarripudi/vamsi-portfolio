/** Private persistent media queue and non-destructive photo filters for Corner V5. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import sharp from 'sharp';
import {uid,now,httpError,clamp} from './domain.mjs';
const exec=promisify(execFile);
const mimeToExt={'video/quicktime':'.mov','video/mp4':'.mp4','image/heic':'.heic','image/heif':'.heif'};
const safeReal=(n,fallback)=>Number.isFinite(Number(n))?Number(n):fallback;
const checkMediaId=id=>/^media_[0-9a-f-]{36}$/i.test(String(id||''));
const errorCode=e=>e?.code==='ENOENT'?'PROCESSOR_NOT_INSTALLED':'MEDIA_PROCESSING_FAILED';
const safeFile=name=>/^[a-zA-Z0-9_.-]{4,100}$/.test(name);
export function inspectAppleMedia(bytes,mime=''){
 if(!Buffer.isBuffer(bytes)||bytes.length<16)return null;
 const brand=bytes.toString('ascii',8,12);
 const bmff=bytes.toString('ascii',4,8)==='ftyp';
 if(bmff&&/^(heic|heix|hevc|hevx|mif1|msf1)$/i.test(brand))return {mime:'image/heic',ext:'.heic',kind:'image'};
 if(bmff&&brand==='qt  ')return {mime:'video/quicktime',ext:'.mov',kind:'video'};
 if(bmff&&/^(isom|iso2|mp41|mp42|avc1|hvc1|hev1|M4V |M4A )$/i.test(brand))return {mime:'video/mp4',ext:'.mp4',kind:'video'};
 // Browser may supply video/quicktime for a valid ISO-BMFF brand unknown to older phones.
 if(bmff&&['video/quicktime','video/mp4'].includes(mime))return {mime:'video/quicktime',ext:'.mov',kind:'video'};
 return null;
}
export const normalizeRecipe=(data={})=>{
 const rotation=Number(data.rotation||0);
 if(![0,90,180,270].includes(rotation))throw httpError(400,'Rotate by 90-degree steps.','INVALID_ROTATION');
 const preset=String(data.preset||'original');
 if(!['original','warm','mono','film','dream'].includes(preset))throw httpError(400,'Choose a supported filter.','INVALID_FILTER');
 const crop=String(data.crop||'original');
 if(!['original','square','portrait','landscape'].includes(crop))throw httpError(400,'Choose a supported crop.','INVALID_CROP');
 return {preset,rotation,crop,brightness:clamp(safeReal(data.brightness,1),.6,1.4),
  contrast:clamp(safeReal(data.contrast,1),.6,1.4),saturation:clamp(safeReal(data.saturation,1),0,2)};
};
const ratio={square:[1,1],portrait:[4,5],landscape:[16,9]};
export async function editedPhoto(bytes,rawRecipe){
 const recipe=normalizeRecipe(rawRecipe),img=sharp(bytes,{limitInputPixels:50_000_000}).rotate(recipe.rotation),metadata=await img.metadata();
 if(!metadata.width||!metadata.height)throw httpError(415,'Unsupported image.');
 let out=img;
 const width=recipe.rotation%180?metadata.height:metadata.width,height=recipe.rotation%180?metadata.width:metadata.height;
 if(ratio[recipe.crop]){
  const [a,b]=ratio[recipe.crop],target=Math.min(2200,width),targetHeight=Math.round(target*b/a);
  out=out.resize(target,targetHeight,{fit:'cover',position:'attention',withoutEnlargement:true});
 }else out=out.resize({width:Math.min(2200,width),height:Math.min(2200,height),fit:'inside',withoutEnlargement:true});
 if(recipe.preset==='mono')out=out.greyscale();
 if(recipe.preset==='warm')out=out.tint({r:247,g:224,b:204});
 if(recipe.preset==='film')out=out.modulate({saturation:.82}).gamma(1.08);
 if(recipe.preset==='dream')out=out.blur(.5).modulate({saturation:1.15});
 out=out.modulate({brightness:recipe.brightness,saturation:recipe.saturation});
 if(recipe.contrast!==1){const c=recipe.contrast;out=out.linear(c,128*(1-c));}
 return out.webp({quality:82,effort:4}).toBuffer();
}
export async function normalizeHeicImage(buf){
 try{
  const meta=await sharp(buf,{limitInputPixels:50_000_000}).metadata();
  if(!meta.width||!meta.height||meta.width*meta.height>50_000_000)throw Error('Image dimensions unavailable');
  const bytes=await sharp(buf,{limitInputPixels:50_000_000}).rotate().resize({width:2800,height:2800,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer();
  const info=await sharp(bytes).metadata();
  return {bytes,mime:'image/webp',ext:'.webp',width:info.width,height:info.height};
 }catch{throw httpError(415,'HEIC conversion unavailable on this server. Try exporting as JPEG.','HEIC_UNSUPPORTED')}
}
const videoRange=input=>{
 const start=clamp(safeReal(input.start,0),0,180),end=clamp(safeReal(input.end,0),0,180);
 if(end&&end<=start)throw httpError(400,'Trim end must be after trim start.','INVALID_TRIM');
 return {start,end};
};
export class CornerMediaJobs{
 constructor(store,{uploads}={}){
  this.store=store;this.uploads=uploads;
  this.queueDir=path.join(uploads,'v5-source');
  fs.mkdirSync(this.queueDir,{recursive:true,mode:0o700});
  store.db.exec(`CREATE TABLE IF NOT EXISTS corner_v5_media_jobs(
   id TEXT PRIMARY KEY,post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
   source_key TEXT NOT NULL,source_mime TEXT NOT NULL,state TEXT NOT NULL,
   alt_text TEXT NOT NULL DEFAULT '',caption TEXT NOT NULL DEFAULT '',
   trim_start REAL NOT NULL DEFAULT 0,trim_end REAL NOT NULL DEFAULT 0,
   media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
   error_code TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS idx_corner_v5_media_jobs_status ON corner_v5_media_jobs(state,created_at);
   CREATE TABLE IF NOT EXISTS corner_v5_media_edits(
   media_id TEXT PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
   recipe TEXT NOT NULL,output_key TEXT,updated_at TEXT NOT NULL);`);
  this.busy=false;
  // Restart-safe: resume interrupted queued and processing jobs without losing originals.
  this.store.exec("UPDATE corner_v5_media_jobs SET state='queued' WHERE state='processing'");
  setImmediate(()=>this.drain());
 }
 start({postId,buffer,mime,alt='',caption='',start=0,end=0}){
  const kind=inspectAppleMedia(buffer,mime);
  if(!kind||kind.kind!=='video')throw httpError(415,'Choose a supported MOV or MP4 video.');
  if(buffer.length>75*1024*1024)throw httpError(413,'Video exceeds 75 MB.','VIDEO_LIMIT');
  if(!this.store.adminPost(postId))throw httpError(404,'Save the draft first.','POST_NOT_FOUND');
  const trim=videoRange({start,end}),id=uid('vjob'),file=id+kind.ext;
  const queuedBytes=fs.readdirSync(this.queueDir).reduce((total,key)=>{try{return total+fs.statSync(path.join(this.queueDir,key)).size}catch{return total}},0);
  if(queuedBytes+buffer.length>450*1024*1024)throw httpError(507,'The video processing queue is full. Retry after current uploads finish.','MEDIA_CAPACITY');
  fs.writeFileSync(path.join(this.queueDir,file),buffer,{flag:'wx',mode:0o600});
  const stamp=now();
  try{
   this.store.exec("INSERT INTO corner_v5_media_jobs(id,post_id,source_key,source_mime,state,alt_text,caption,trim_start,trim_end,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    id,postId,file,kind.mime,'queued',String(alt).slice(0,240),String(caption).slice(0,300),trim.start,trim.end,stamp,stamp);
  }catch(error){fs.rmSync(path.join(this.queueDir,file),{force:true});throw error}
  setImmediate(()=>this.drain());return {jobId:id,state:'queued',message:'Converting video for browser playback.'};
 }
 status(id,postId){
  if(!/^vjob_[0-9a-f-]{36}$/i.test(String(id||'')))throw httpError(404,'Job not found.');
  const row=this.store.one('SELECT id,post_id,state,error_code,media_id,created_at,updated_at FROM corner_v5_media_jobs WHERE id=?',id);
  if(!row||row.post_id!==postId)throw httpError(404,'Job not found.');
  return {jobId:row.id,postId:row.post_id,state:row.state,errorCode:row.error_code,mediaId:row.media_id,updatedAt:row.updated_at};
 }
 async editImage(mediaId,request,actor){
  if(!checkMediaId(mediaId))throw httpError(404,'Media not found.');
  const media=this.store.one('SELECT * FROM media WHERE id=?',mediaId);
  if(!media||!media.mime_type.startsWith('image/'))throw httpError(404,'Photo not found.');
  const original=path.join(this.uploads,media.storage_key),recipe=normalizeRecipe(request);
  const result=await editedPhoto(fs.readFileSync(original),recipe);
  const newKey=crypto.randomBytes(20).toString('base64url')+'.webp';
  fs.writeFileSync(path.join(this.uploads,newKey),result,{flag:'wx',mode:0o600});
  const prior=this.store.one('SELECT output_key FROM corner_v5_media_edits WHERE media_id=?',mediaId);
  try{
   this.store.transaction(()=>{
    this.store.exec('INSERT INTO corner_v5_media_edits(media_id,recipe,output_key,updated_at) VALUES(?,?,?,?) ON CONFLICT(media_id) DO UPDATE SET recipe=excluded.recipe,output_key=excluded.output_key,updated_at=excluded.updated_at',mediaId,JSON.stringify(recipe),newKey,now());
    this.store.audit(actor,'media.edited','media',mediaId,{recipe});
   });
  }catch(error){fs.rmSync(path.join(this.uploads,newKey),{force:true});throw error}
  if(prior?.output_key&&safeFile(prior.output_key))fs.rmSync(path.join(this.uploads,prior.output_key),{force:true});
  return {saved:true,mediaId,recipe};
 }
 discard(mediaId){
  if(!checkMediaId(mediaId))return;
  const edit=this.store.one('SELECT output_key FROM corner_v5_media_edits WHERE media_id=?',mediaId);
  const jobs=this.store.all('SELECT id,source_key FROM corner_v5_media_jobs WHERE media_id=?',mediaId);
  this.store.transaction(()=>{
   this.store.exec('DELETE FROM corner_v5_media_edits WHERE media_id=?',mediaId);
   this.store.exec('DELETE FROM corner_v5_media_jobs WHERE media_id=?',mediaId);
  });
  if(edit?.output_key&&safeFile(edit.output_key))fs.rmSync(path.join(this.uploads,edit.output_key),{force:true});
  for(const item of jobs)if(safeFile(item.source_key))fs.rmSync(path.join(this.queueDir,item.source_key),{force:true});
 }
 resetImage(mediaId,actor){
  const row=this.store.one('SELECT output_key FROM corner_v5_media_edits WHERE media_id=?',mediaId);
  this.store.exec('DELETE FROM corner_v5_media_edits WHERE media_id=?',mediaId);
  if(row?.output_key&&safeFile(row.output_key))fs.rmSync(path.join(this.uploads,row.output_key),{force:true});
  this.store.audit(actor,'media.edits.reset','media',mediaId);
  return {reset:true,mediaId};
 }
 displayed(media){
  const row=this.store.one('SELECT output_key FROM corner_v5_media_edits WHERE media_id=?',media.id);
  if(!row?.output_key||!safeFile(row.output_key))return null;
  const target=path.join(this.uploads,row.output_key);
  return fs.existsSync(target)?{filename:target,mime:'image/webp'}:null;
 }
 async drain(){
  if(this.busy)return;this.busy=true;
  try{
   while(true){
    const job=this.store.one("SELECT * FROM corner_v5_media_jobs WHERE state='queued' ORDER BY created_at LIMIT 1");
    if(!job)break;
    this.store.exec("UPDATE corner_v5_media_jobs SET state='processing',updated_at=? WHERE id=?",now(),job.id);
    const source=path.join(this.queueDir,job.source_key),outKey=crypto.randomBytes(20).toString('base64url')+'.mp4',dest=path.join(this.uploads,outKey);
    try{
     if(!fs.existsSync(source))throw Error('Source unavailable');
     const {stdout}=await exec('ffprobe',['-v','error','-show_entries','format=duration:stream=width,height,codec_name,color_transfer','-select_streams','v:0','-of','json',source],{timeout:14000,maxBuffer:100000});
     const metadata=JSON.parse(stdout),stream=metadata.streams?.[0]||{};
     if(!stream.width||!stream.height||stream.width*stream.height>4096*4096)throw Error('Video dimensions unsupported');
     const duration=Number(metadata.format?.duration);
     if(!Number.isFinite(duration)||duration<=0||duration>181)throw Error('Video must be 3 minutes or shorter');
     const trim=videoRange({start:job.trim_start,end:job.trim_end});
     if(trim.start>=duration)throw Error('Trim begins after video ends');
     const len=trim.end?Math.min(duration,trim.end)-trim.start:Math.min(180,duration-trim.start);
     if(len<=0)throw Error('Invalid trimmed duration');
     const baseFilter='scale=1920:1920:force_original_aspect_ratio=decrease,format=yuv420p';
     const hdr=['smpte2084','arib-std-b67'].includes(stream.color_transfer);
     const videoFilter=hdr?'zscale=t=linear:npl=100,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,'+baseFilter:baseFilter;
     const args=['-y','-hide_banner','-loglevel','error','-ss',String(trim.start),'-i',source,'-t',String(len),'-map','0:v:0','-map','0:a:0?','-map_metadata','-1','-vf',videoFilter,'-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','112k','-movflags','+faststart',dest];
     try{await exec('ffmpeg',args,{timeout:125000,maxBuffer:100000})}
     catch(error){if(!hdr)throw error;args[args.indexOf('-vf')+1]=baseFilter;await exec('ffmpeg',args,{timeout:125000,maxBuffer:100000})}
     const stat=fs.statSync(dest);if(stat.size<100||stat.size>75*1024*1024)throw Error('Unexpected output size');
     let mediaId=job.media_id;
     this.store.transaction(()=>{
      if(!mediaId){mediaId=uid('media');this.store.addMedia({id:mediaId,ownerId:job.post_id,storageKey:outKey,mimeType:'video/mp4',size:stat.size,width:stream.width,height:stream.height,alt:job.alt_text,caption:job.caption});}
      else{
       const prior=this.store.one('SELECT storage_key FROM media WHERE id=?',mediaId);
       this.store.exec('UPDATE media SET storage_key=?,mime_type=?,size_bytes=? WHERE id=?',outKey,'video/mp4',stat.size,mediaId);
       if(prior?.storage_key&&safeFile(prior.storage_key))setImmediate(()=>fs.rmSync(path.join(this.uploads,prior.storage_key),{force:true}));
      }
      this.store.exec("UPDATE corner_v5_media_jobs SET state='ready',media_id=?,error_code=NULL,updated_at=? WHERE id=?",mediaId,now(),job.id);
     });
     const post=this.store.one('SELECT slug,version,state FROM posts WHERE id=?',job.post_id);
     if(post?.state==='published')this.store.emit('post.updated',job.post_id,post.version,{slug:post.slug});
    }catch(error){
     fs.rmSync(dest,{force:true});
     this.store.exec("UPDATE corner_v5_media_jobs SET state='failed',error_code=?,updated_at=? WHERE id=?",errorCode(error),now(),job.id);
    }
   }
  }finally{this.busy=false;}
 }
}
