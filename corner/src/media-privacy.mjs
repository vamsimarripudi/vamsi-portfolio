import {httpError} from './domain.mjs';

// Strip optional photographic metadata before an image reaches public storage.
// Do not alter compressed pixels, ICC color profiles or media the parser cannot safely understand.
const privatePng=new Set(['eXIf','tEXt','iTXt','zTXt','tIME']);
const privateWebp=new Set(['EXIF','XMP ']);
const invalid=()=>{throw httpError(422,'This image cannot be safely prepared.','INVALID_IMAGE')};
const png=(buf,write)=>{
 if(buf.length<20||!buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))invalid();
 const chunks=[buf.subarray(0,8)];let at=8,end=false,found=false;
 while(at+12<=buf.length){
  const len=buf.readUInt32BE(at),next=at+12+len;
  if(len>buf.length||next>buf.length)invalid();
  const type=buf.toString('ascii',at+4,at+8);
  if(privatePng.has(type))found=true;
  else if(write)chunks.push(buf.subarray(at,next));
  if(type==='IEND'){end=true;break}
  at=next;
 }
 if(!end)invalid();
 return write?Buffer.concat(chunks):found;
};
const jpeg=(buf,write)=>{
 if(buf.length<4||buf[0]!==0xff||buf[1]!==0xd8)invalid();
 const parts=[buf.subarray(0,2)];let at=2,found=false,done=false;
 while(at<buf.length){
  const start=at;
  if(buf[at]!==0xff)invalid();
  while(at<buf.length&&buf[at]===0xff)at++;
  if(at>=buf.length)invalid();
  const marker=buf[at++];
  if(marker===0xda||marker===0xd9){
   if(write)parts.push(buf.subarray(start));
   done=true;break;
  }
  if(marker===0xd8||(marker>=0xd0&&marker<=0xd7)||marker===0x01){
   if(write)parts.push(buf.subarray(start,at));
   continue;
  }
  if(at+2>buf.length)invalid();
  const len=buf.readUInt16BE(at),next=at+len;
  if(len<2||next>buf.length)invalid();
  const sensitive=marker===0xe1||marker===0xed||marker===0xfe;
  if(sensitive)found=true;
  else if(write)parts.push(buf.subarray(start,next));
  at=next;
 }
 if(!done)invalid();
 return write?Buffer.concat(parts):found;
};
const webp=(buf,write)=>{
 if(buf.length<20||buf.toString('ascii',0,4)!=='RIFF'||buf.toString('ascii',8,12)!=='WEBP')invalid();
 const expected=buf.readUInt32LE(4)+8;
 if(expected>buf.length||expected<20)invalid();
 const parts=[Buffer.from(buf.subarray(0,12))];let at=12,found=false;
 while(at+8<=expected){
  const type=buf.toString('ascii',at,at+4),len=buf.readUInt32LE(at+4);
  const next=at+8+len+(len%2);
  if(next>expected)invalid();
  if(privateWebp.has(type))found=true;
  else if(write){
   const bytes=Buffer.from(buf.subarray(at,next));
   if(type==='VP8X'&&len>=1)bytes[8]&=~0x0c;
   parts.push(bytes);
  }
  at=next;
 }
 if(at!==expected)invalid();
 if(!write)return found;
 const output=Buffer.concat(parts);
 output.writeUInt32LE(output.length-8,4);
 return output;
};
export function imageHasPrivateMetadata(bytes,mime){
 if(!Buffer.isBuffer(bytes))return true;
 if(mime==='image/jpeg')return jpeg(bytes,false);
 if(mime==='image/png')return png(bytes,false);
 if(mime==='image/webp')return webp(bytes,false);
 // Animated GIFs are not eligible for the privacy-safe Moments Gallery.
 return true;
}
export function sanitizeImage(bytes,mime){
 if(!Buffer.isBuffer(bytes))invalid();
 if(mime==='image/jpeg')return jpeg(bytes,true);
 if(mime==='image/png')return png(bytes,true);
 if(mime==='image/webp')return webp(bytes,true);
 return bytes; // Existing GIF and video uploads keep their historical behavior.
}
