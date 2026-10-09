import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config,ROOT } from './config.mjs';
import { Store } from './store.mjs';
import { V3Engagement } from './v3-engagement.mjs';
import { v3Routes } from './v3-routes.mjs';
import { searchPage, archivePage, guestbookPage, followPage, followConfirmPage, unsubscribePage } from './v3-ui.mjs';
import { IdentityService, privilegedRole, staffPermission } from './identity.mjs';
import { identityRoutes, isIdentityPath } from './identity-routes.mjs';
import { accountPage } from './identity-ui.mjs';
import { startOffsiteScheduler, backupFresh } from './offsite-backup.mjs';
import { escapeHtml, samples, feedPage, detailPage, simplePage, adminPage } from './ui.mjs';
import { freshToken, passwordVerify } from './auth.mjs';
import { openApiDocument } from './openapi.mjs';
import { CATEGORIES, REACTIONS, typeLabels, zoneLocalToUtc, httpError, pureText, sha, clamp, secureEqual, isValidTimeZone } from './domain.mjs';
const store=new Store();
store.bootstrap(config.adminEmail,config.adminHash);
const identity=new IdentityService(store);
const v3=new V3Engagement(store,{sendMail:(message)=>identity.sender(message)});
if(config.prod&&!config.sessionSecret)throw Error('SESSION_SECRET is required in production');
const DEV_SECRET=crypto.randomBytes(32).toString('hex');
const signKey=config.sessionSecret||DEV_SECRET;
const staticRoot=path.join(ROOT,'public');
const eventCursor=()=>store.one('SELECT COALESCE(MAX(seq),0) AS n FROM realtime_events').n;
const mimeTypes={'.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.mp4':'video/mp4','.webm':'video/webm'};
const jsonType='application/json; charset=utf-8';
const date=()=>new Date().toISOString();
const duration=(start)=>Date.now()-start;
const log=(severity,fields)=>console[severity](JSON.stringify({at:date(),app:'corner',...fields}));
function end(res,status,body,headers={}){res.writeHead(status,headers);res.end(body)}
function json(res,data,status=200,headers={}){end(res,status,JSON.stringify(data),{'content-type':jsonType,'cache-control':'no-store','x-content-type-options':'nosniff',...headers})}
function ok(res,data,meta={}){json(res,{data,meta})}
function created(res,data,location){json(res,{data,meta:{}},201,{location})}
function cookieHeader(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(s=>{let i=s.indexOf('=');return i<0?[]:[s.slice(0,i).trim(),s.slice(i+1).trim()] }).filter(x=>x.length===2))}
const adminCookie=(token,age=8*3600)=>`corner_session=${encodeURIComponent(token)}; Path=${config.basePath||'/'}; HttpOnly; SameSite=Strict; Max-Age=${age}${config.prod?'; Secure':''}`;
const anonCookie=(id)=>`corner_visitor=${id}; Path=${config.basePath||'/'}; HttpOnly; SameSite=Lax; Max-Age=31536000${config.prod?'; Secure':''}`;
function visitor(req,res){let cookies=cookieHeader(req),cookie=cookies.corner_visitor;let actor;
  if(cookie&&/^[a-zA-Z0-9_-]{24,100}\.[a-f0-9]{24}$/.test(cookie)){let [id,signature]=cookie.split('.');if(secureEqual(crypto.createHmac('sha256',signKey).update(id).digest('hex').slice(0,24),signature))actor=id;}
  if(!actor){actor=crypto.randomBytes(20).toString('base64url');let sig=crypto.createHmac('sha256',signKey).update(actor).digest('hex').slice(0,24);res.setHeader('set-cookie',anonCookie(actor+'.'+sig));}
  return actor;
}
function requireOwner(req,pathname,method){let token='';try{token=decodeURIComponent(cookieHeader(req).corner_session||'')}catch{}const user=store.session(token);if(!user)throw httpError(401,'Studio session required','AUTH_REQUIRED');if(!privilegedRole(user.role)||!staffPermission(user.role,pathname,method))throw httpError(403,'This account cannot access that studio action.','ROLE_FORBIDDEN');if(user.role!=='owner'&&!store.one('SELECT enabled_at FROM identity_mfa WHERE user_id=? AND enabled_at IS NOT NULL',user.id))throw httpError(403,'Set up authenticator verification first.','MFA_REQUIRED');return user;}
function sourceIp(req){if(config.trustProxy&&req.headers['x-forwarded-for'])return String(req.headers['x-forwarded-for']).split(',')[0].trim();return req.socket.remoteAddress||'unknown';}
function limit(req,kind,max,seconds){let actor=sha(sourceIp(req)).slice(0,22);if(!store.rateLimit(kind+':'+actor,max,seconds))throw httpError(429,'Please wait before trying again.','RATE_LIMIT');}
function checkOrigin(req){if(!['POST','PATCH','PUT','DELETE'].includes(req.method))return;
  const origin=req.headers.origin,expected=new URL(config.siteUrl).origin;
  const local=!config.prod&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||'');
  if(!origin||!(origin===expected||(local&&origin===`http://${req.headers.host}`)))throw httpError(403,'Request origin was not accepted.','ORIGIN_REJECTED');
}
async function readBody(req,max=110000){
  let declared=Number(req.headers['content-length']||0);if(declared>max)throw httpError(413,'Upload too large');
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw httpError(413,'Request too large');chunks.push(chunk)}return Buffer.concat(chunks)
}
async function readJSON(req,max=110000){if(!(req.headers['content-type']||'').includes('application/json'))throw httpError(415,'Expected JSON');let data;try{data=JSON.parse((await readBody(req,max)).toString('utf8')||'{}')}catch{throw httpError(400,'Malformed JSON')}if(!data||typeof data!=='object'||Array.isArray(data))throw httpError(400,'Expected object');return data}
function page(res,html,status=200,privatePage=false){if(config.basePath)html=html.replace(/(href|src|action)=(["'])\/(?!\/)/g,(_,attr,quote)=>`${attr}=${quote}${config.basePath}/`);end(res,status,html,{'content-type':'text/html; charset=utf-8','cache-control':privatePage?'private, no-store, max-age=0':'public, max-age=0, must-revalidate','vary':'Cookie','x-content-type-options':'nosniff'})}
function isBot(req){return /bot|crawler|spider|preview|curl/i.test(req.headers['user-agent']||'')}
function safetyHeaders(res){
  res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','strict-origin-when-cross-origin');res.setHeader('x-frame-options','DENY');
  res.setHeader('permissions-policy','camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('content-security-policy',"default-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self'; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if(config.prod)res.setHeader('strict-transport-security','max-age=31536000; includeSubDomains');
}
function demoFeed(category){let all=samples();if(category==='Latest')return all;return all.filter(p=>({wish:'Wishes',announcement:'Latest',tech_note:'Notes',journal:'Journal',build:'Builds',moment:'Moments'})[p.type]===category)}
function publicSnapshot(category='Latest',cursor){let feed=store.getFeed({category,cursor});if(config.demo&&!feed.items.length&&!cursor){feed={items:demoFeed(category),nextCursor:null}}return feed}
function postMedia(post){return post?.demo?[]:store.listMedia(post.id)}
function staticFile(res,filepath){
  const rel=decodeURIComponent(filepath).replace(/^\//,'');if(!/^[A-Za-z0-9_./-]+$/.test(rel)||rel.includes('..'))throw httpError(404,'Not found');
  const filename=path.resolve(staticRoot,rel);if(!filename.startsWith(staticRoot+path.sep))throw httpError(404,'Not found');
  if(!fs.existsSync(filename)||!fs.statSync(filename).isFile())throw httpError(404,'Not found');
  const extension=path.extname(filename).toLowerCase();end(res,200,fs.readFileSync(filename),{'content-type':mimeTypes[extension]||'application/octet-stream','cache-control':'public,max-age=3600','x-content-type-options':'nosniff'});
}
function fileMagic(buf,declared){
  if(declared==='image/jpeg'&&buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff)return '.jpg';
  if(declared==='image/png'&&buf.slice(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return '.png';
  if(declared==='image/webp'&&buf.slice(0,4).toString()==='RIFF'&&buf.slice(8,12).toString()==='WEBP')return '.webp';
  if(declared==='image/gif'&&/GIF8[79]a/.test(buf.slice(0,6).toString()))return '.gif';
  if(declared==='video/mp4'&&buf.slice(4,8).toString()==='ftyp')return '.mp4';
  if(declared==='video/webm'&&buf.slice(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))return '.webm';
  return null;
}
function imageDimensions(buf,mime){
  try{
    if(mime==='image/png'&&buf.length>=24)return {width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
    if(mime==='image/gif'&&buf.length>=10)return {width:buf.readUInt16LE(6),height:buf.readUInt16LE(8)};
    if(mime==='image/webp'&&buf.length>=30&&buf.toString('ascii',12,16)==='VP8X')return {width:1+buf.readUIntLE(24,3),height:1+buf.readUIntLE(27,3)};
    if(mime==='image/jpeg'){
      for(let off=2;off<Math.min(buf.length-9,65536);){
        if(buf[off]!==0xff){off++;continue}
        const marker=buf[off+1];if(marker===0xd9||marker===0xda)break;
        if(marker===0x01||(marker>=0xd0&&marker<=0xd7)){off+=2;continue}
        const length=buf.readUInt16BE(off+2);if(length<2||off+2+length>buf.length)break;
        if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {width:buf.readUInt16BE(off+7),height:buf.readUInt16BE(off+5)};
        off+=2+length;
      }
    }
  }catch{}
  return null;
}
function mediaFile(req,res,key){
  if(!/^[a-zA-Z0-9_-]{6,80}\.(png|jpg|webp|gif|mp4|webm)$/.test(key))throw httpError(404,'Not found');
  const media=store.one('SELECT * FROM media WHERE storage_key=?',key);if(!media)throw httpError(404,'Not found');
  const visible=store.one("SELECT id FROM posts WHERE (id=? OR parent_post_id=?) AND state='published' LIMIT 1",media.owner_id,media.owner_id);
  if(!visible){let token='';try{token=decodeURIComponent(cookieHeader(req).corner_session||'')}catch{}const viewer=store.session(token);if(!viewer||!privilegedRole(viewer.role)||!staffPermission(viewer.role,'/api/admin/media','GET'))throw httpError(404,'Not found')}
  const filename=path.resolve(config.uploads,key);
  if(!filename.startsWith(config.uploads+path.sep)||!fs.existsSync(filename))throw httpError(404,'Not found');
  const stat=fs.statSync(filename);
  const headers={'content-type':media.mime_type,'cache-control':visible?'public,max-age=31536000,immutable':'private,no-store','x-content-type-options':'nosniff','accept-ranges':'bytes'};
  const range=req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if(req.headers.range&&!range)throw httpError(416,'Unsupported media range');
  if(range){const start=range[1]?Number(range[1]):Math.max(0,stat.size-Number(range[2]||0));const endByte=range[1]?(range[2]?Number(range[2]):stat.size-1):stat.size-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(endByte)||start<0||endByte>=stat.size||start>endByte)throw httpError(416,'Invalid media range');
    res.writeHead(206,{...headers,'content-range':`bytes ${start}-${endByte}/${stat.size}`,'content-length':endByte-start+1});
    if(req.method==='HEAD')return res.end();fs.createReadStream(filename,{start,end:endByte}).pipe(res);return;
  }
  res.writeHead(200,{...headers,'content-length':stat.size});
  if(req.method==='HEAD')return res.end();fs.createReadStream(filename).pipe(res);
}
function sitemap(){let posts=store.all("SELECT slug,published_at FROM posts WHERE state='published' ORDER BY published_at DESC LIMIT 10000");let urls=['/','/about','/privacy','/terms',...CATEGORIES.filter(c=>c!=='Latest').map(c=>'/category/'+c.toLowerCase()),...posts.map(p=>'/post/'+encodeURIComponent(p.slug))];return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>`<url><loc>${config.siteUrl+u}</loc></url>`).join('')+'</urlset>';}
function adminRouteState(owner){return adminPage({owner:owner&&privilegedRole(owner.role)?owner:null,status:store.currentStatus()})}
const handleIdentity=identityRoutes({identity,store,config,readJSON,ok,json,limit,sourceIp,cookieHeader});
const handleV3=v3Routes({v3,store,identity,readJSON,ok,limit});
async function api(req,res,pathName,url){
  const method=req.method||'GET';
  if(await handleV3(req,res,pathName,url))return;
  if(isIdentityPath(pathName))return handleIdentity(req,res,pathName);
  if(pathName==='/api/health'&&method==='GET')return ok(res,{ok:true,service:'corner-api',database:'connected',time:date()});
  if(pathName==='/api/live'&&method==='GET')return ok(res,{ok:true,service:'corner-api',uptimeSeconds:Math.round(process.uptime())});
  if(pathName==='/api/ready'&&method==='GET'){
    let database=false,storage=false;
    try{database=store.one('SELECT 1 AS ok')?.ok===1;fs.accessSync(path.dirname(config.dbPath),fs.constants.W_OK);storage=true}catch{}
    return json(res,{data:{ready:database&&storage,database,storage,backupFresh:backupFresh(store)},meta:{}},database&&storage?200:503);
  }
  if(pathName==='/api/openapi.json'&&method==='GET')return json(res,openApiDocument(config.siteUrl),200,{'cache-control':'public,max-age=300'});
  if(pathName==='/api/posts'&&method==='GET'){const data=store.getFeed({category:url.searchParams.get('category')||'Latest',cursor:url.searchParams.get('cursor')||'',tag:url.searchParams.get('tag')||'',limit:url.searchParams.get('limit')||15});return ok(res,data.items.map(p=>({...p,media:store.listMedia(p.id)})),{nextCursor:data.nextCursor})}
  if(/^\/api\/posts\/[a-z0-9-]+$/.test(pathName)&&method==='GET'){
    let slug=pathName.split('/').at(-1);let post=store.getPost(slug);if(!post)throw httpError(404,'Post not found');return ok(res,{post,media:store.listMedia(post.id),reactions:store.getReactions(post.id),comments:post.allow_comments?store.getComments(post.id):[]});}
  if(pathName==='/api/search'&&method==='GET'){limit(req,'search',45,60);return ok(res,store.search(url.searchParams.get('q')||''))}
  if(pathName==='/api/status'&&method==='GET')return ok(res,{status:store.currentStatus(),upcoming:store.upcoming(true)});
  if(pathName==='/api/analytics/event'&&method==='POST'){
    limit(req,'analytics',100,60);let body=await readJSON(req,10000),actor=visitor(req,res);let p=String(body.path||'/');if(!/^\/[a-zA-Z0-9/_-]{0,255}$/.test(p))p='/';store.analytics(body.type,body.postId||null,p,sha(actor).slice(0,24),body.device||'unknown');return ok(res,{accepted:true});
  }
  if(pathName==='/api/realtime/stream'&&method==='GET'){
    limit(req,'sse',30,60);
    res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache,no-transform',connection:'keep-alive','x-accel-buffering':'no'});
    const send=(ev)=>{if(res.destroyed||res.writableEnded)return;res.write(`id: ${ev.seq}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`)};
    res.write(': connected\n\n');let last=Number(req.headers['last-event-id']||url.searchParams.get('since')||0)||0;
    for(let event of store.replay(last)){send(event);last=event.seq;}
    const receive=(ev)=>{if(ev.seq>last){send(ev);last=ev.seq}};
    store.events.on('public-event',receive);
    // The DB poll also receives events written by a separate worker process.
    const poll=setInterval(()=>{for(let event of store.replay(last)){send(event);last=event.seq}},5000);
    const heartbeat=setInterval(()=>{if(!res.writableEnded)res.write(': heartbeat\n\n')},20000);
    const close=()=>{store.events.off('public-event',receive);clearInterval(poll);clearInterval(heartbeat);if(!res.writableEnded)res.end()};
    req.on('close',close);return;
  }
  const reactMatch=pathName.match(/^\/api\/posts\/([A-Za-z0-9_-]+)\/reactions$/);
  if(reactMatch&&method==='POST'){limit(req,'reaction',45,60);const data=await readJSON(req,9000),actor=visitor(req,res);return ok(res,store.changeReaction(reactMatch[1],data.reaction,actor));}
  if(reactMatch&&method==='PUT'){limit(req,'reaction',45,60);const data=await readJSON(req,9000),actor=visitor(req,res);return ok(res,store.setReaction(reactMatch[1],data.reaction,actor));}
  if(reactMatch&&method==='DELETE'){limit(req,'reaction',45,60);const actor=visitor(req,res);return ok(res,store.setReaction(reactMatch[1],null,actor));}
  const commentMatch=pathName.match(/^\/api\/posts\/([A-Za-z0-9_-]+)\/comments$/);
  if(commentMatch&&method==='GET')return ok(res,store.getComments(commentMatch[1]));
  if(commentMatch&&method==='POST'){limit(req,'comment',4,3600);const data=await readJSON(req,10000);return ok(res,store.comment(commentMatch[1],data.name,data.body))}
  if(pathName==='/api/admin/login'&&method==='POST'){
    limit(req,'staff-login',7,900);const result=identity.loginAdmin(await readJSON(req,5000),sourceIp(req),req.headers['user-agent']||'');
    if(result.token){res.setHeader('set-cookie',adminCookie(result.token));return ok(res,{authenticated:true,expires:result.expires,user:result.user});}
    return ok(res,result);
  }
  if(pathName==='/api/admin/logout'&&method==='POST'){let token=decodeURIComponent(cookieHeader(req).corner_session||'');if(token)store.revokeSession(token);res.setHeader('set-cookie',adminCookie('',0));return ok(res,{authenticated:false})}
  if(!pathName.startsWith('/api/admin/'))throw httpError(404,'API route not found','NOT_FOUND');
  const owner=requireOwner(req,pathName,method);if(method!=='GET')limit(req,'admin',130,60);
  if(pathName==='/api/admin/overview'&&method==='GET')return ok(res,store.metrics());
  if(pathName==='/api/admin/posts'&&method==='GET')return ok(res,store.allAdminPosts(url.searchParams.get('state')||'all'));
  if(pathName==='/api/admin/posts'&&method==='POST'){
    const data=await readJSON(req),post=store.createPost(data,owner.id);
    if(req.cornerApiV1)return created(res,post,(config.basePath||'')+'/api/v1/admin/posts/'+post.id);
    return ok(res,post);
  }
  const adminPost=pathName.match(/^\/api\/admin\/posts\/([A-Za-z0-9_-]+)(?:\/(publish|archive|restore|schedule|duplicate))?$/);
  if(adminPost){const [,id,action]=adminPost;
    if(method==='GET'&&!action){let p=store.adminPost(id);if(!p)throw httpError(404,'Post not found');return ok(res,{post:p,media:store.listMedia(id)})}
    if(method==='PATCH'&&!action)return ok(res,store.savePost(id,await readJSON(req),owner.id));
    if(method==='DELETE'&&!action)return ok(res,{...store.archive(id,owner.id),softDeleted:true,restorable:true});
    if(method==='POST'&&action==='publish')return ok(res,store.publish(id,owner.id));
    if(method==='POST'&&action==='archive')return ok(res,store.archive(id,owner.id));
    if(method==='POST'&&action==='restore')return ok(res,store.restore(id,owner.id));
    if(method==='POST'&&action==='schedule'){let b=await readJSON(req);
      try{
        if(b.localTime)b.scheduledAt=zoneLocalToUtc(b.localTime,b.timezone||config.timezone);
        for(const [input,output] of [['featureStartLocal','featureStartAt'],['featureEndLocal','featureEndAt'],['pinStartLocal','pinStartAt'],['pinEndLocal','pinEndAt']]){
          if(b[input])b[output]=zoneLocalToUtc(b[input],b.timezone||config.timezone);
        }
      }catch{throw httpError(400,'Invalid local date or timezone')}
      return ok(res,store.schedule(id,b,owner.id));}
    if(method==='POST'&&action==='duplicate'){let p=store.adminPost(id);if(!p)throw httpError(404,'Post not found');let copy=store.createPost({...p,title:p.title+' (copy)',allowComments:p.allow_comments,allowReactions:p.allow_reactions},owner.id);return ok(res,copy)}
  }
  if(pathName==='/api/admin/status'&&method==='PUT')return ok(res,store.updateStatus(await readJSON(req),owner.id));
  if(pathName==='/api/admin/comments'&&method==='GET')return ok(res,store.pendingComments(url.searchParams.get('state')||'pending'));
  const commentResource=pathName.match(/^\/api\/admin\/comments\/([A-Za-z0-9_-]+)$/);
  if(commentResource){
    if(method==='GET'){
      const comment=store.one('SELECT comments.*,posts.title AS post_title FROM comments JOIN posts ON posts.id=comments.post_id WHERE comments.id=?',commentResource[1]);
      if(!comment)throw httpError(404,'Comment not found');return ok(res,comment);
    }
    if(method==='PATCH'){const data=await readJSON(req,4000);return ok(res,store.moderate(commentResource[1],data.state,owner.id))}
    if(method==='DELETE')return ok(res,store.moderate(commentResource[1],'deleted',owner.id));
  }
  const mod=pathName.match(/^\/api\/admin\/comments\/([A-Za-z0-9_-]+)\/(approve|hide|delete)$/);
  if(mod&&method==='POST')return ok(res,store.moderate(mod[1],{approve:'approved',hide:'hidden',delete:'deleted'}[mod[2]],owner.id));
  if(pathName==='/api/admin/analytics/summary'&&method==='GET'){
    let metrics=store.metrics();let top=store.all("SELECT post_id,count(*) AS visits FROM analytics_events WHERE type='post_open' AND post_id IS NOT NULL GROUP BY post_id ORDER BY visits DESC LIMIT 5");return ok(res,{...metrics,top});
  }
  if(pathName==='/api/admin/settings'&&method==='GET')return ok(res,{title:store.setting('title',config.siteTitle),descriptor:store.setting('descriptor','Thoughts, updates & celebrations'),timezone:store.setting('timezone',config.timezone),commentsDefault:store.setting('commentsDefault',false),reactionsDefault:store.setting('reactionsDefault',true)});
  if(pathName==='/api/admin/settings'&&method==='PUT'){let b=await readJSON(req);
    if(b.timezone!==undefined&&!isValidTimeZone(String(b.timezone)))throw httpError(400,'Invalid timezone');
    for(let k of ['title','descriptor','timezone','commentsDefault','reactionsDefault'])if(Object.hasOwn(b,k))store.saveSetting(k,['title','descriptor'].includes(k)?pureText(b[k],130):b[k]);
    store.audit(owner.id,'settings.updated','settings',null);return ok(res,{saved:true})}
  if(pathName==='/api/admin/media'&&method==='GET')return ok(res,store.all('SELECT * FROM media ORDER BY created_at DESC LIMIT 80'));
  if(pathName==='/api/admin/media/upload'&&method==='POST'){
    let mime=String(req.headers['content-type']||'').toLowerCase().split(';')[0];let image=mime.startsWith('image/');let buf=await readBody(req,image?8*1024*1024:25*1024*1024);
    const ext=fileMagic(buf,mime);if(!ext)throw httpError(415,'Unsupported media type or invalid file contents');
    const postId=url.searchParams.get('postId');if(!postId||!store.adminPost(postId))throw httpError(400,'Select an existing post before uploading media');
    if(image&&!pureText(url.searchParams.get('alt'),240))throw httpError(400,'Describe the image with alt text');
    const dimensions=image?imageDimensions(buf,mime):null;
    if(image&&(!dimensions||!dimensions.width||!dimensions.height||dimensions.width*dimensions.height>50_000_000))throw httpError(422,'Unsupported or oversized image dimensions');
    const file=crypto.randomBytes(18).toString('base64url')+ext;fs.mkdirSync(config.uploads,{recursive:true});fs.writeFileSync(path.join(config.uploads,file),buf,{flag:'wx'});
    let item;try{item=store.addMedia({id:'media_'+crypto.randomUUID(),ownerId:postId,storageKey:file,mimeType:mime,size:buf.length,alt:url.searchParams.get('alt')||'',caption:url.searchParams.get('caption')||'',width:dimensions?.width,height:dimensions?.height});}
    catch(err){fs.rmSync(path.join(config.uploads,file),{force:true});throw err}
    store.audit(owner.id,'media.uploaded','media',item.id,{size:item.size_bytes});return ok(res,{...item,url:(config.basePath||'')+'/media/'+file});
  }
  const mediaEdit=pathName.match(/^\/api\/admin\/media\/([A-Za-z0-9_-]+)$/);
  if(mediaEdit&&method==='GET'){
    const record=store.one('SELECT * FROM media WHERE id=?',mediaEdit[1]);
    if(!record)throw httpError(404,'Media not found');return ok(res,record);
  }
  if(mediaEdit&&method==='PATCH')return ok(res,store.updateMedia(mediaEdit[1],await readJSON(req),owner.id));
  if(mediaEdit&&method==='DELETE'){
    const removed=store.deleteMedia(mediaEdit[1],owner.id);
    fs.rmSync(path.join(config.uploads,removed.storage_key),{force:true});return ok(res,{deleted:true,id:removed.id});
  }
  if(pathName==='/api/admin/ops'&&method==='GET')return ok(res,{api:true,database:true,scheduler:{next:store.upcoming()[0]||null,overdue:store.one("SELECT count(*) AS n FROM posts WHERE state='scheduled' AND scheduled_at<=?",date()).n,lastSuccess:store.setting('scheduler.lastSuccess',null),lastError:store.setting('scheduler.lastError',null)},backup:{enabled:process.env.CORNER_BACKUP_ENABLED==='1',lastSuccess:store.setting('backup.lastSuccess',null),lastAttempt:store.setting('backup.lastAttempt',null),lastError:store.setting('backup.lastError',null)},events:store.one('SELECT count(*) AS n FROM realtime_events').n,media:store.one('SELECT count(*) AS n FROM media').n});
  throw httpError(404,'Endpoint not found','NOT_FOUND');
}
async function route(req,res){
  const started=Date.now();safetyHeaders(res);res.setHeader('x-request-id',crypto.randomUUID());let pathname='';
  try{
    if(!req.headers.host)throw httpError(400,'Host header required');
    const url=new URL(req.url||'/',`http://${req.headers.host}`);
    if(config.basePath){if(url.pathname===config.basePath)url.pathname='/';else if(url.pathname.startsWith(config.basePath+'/'))url.pathname=url.pathname.slice(config.basePath.length);else throw httpError(404,'Route not found');}
    pathname=url.pathname;
    if(pathname==='/api/v1'||pathname==='/api/v1/'){
      if(req.method!=='GET')throw httpError(405,'Method not allowed');
      return ok(res,{version:'1',status:'stable',openapi:(config.basePath||'')+'/api/v1/openapi.json',legacySupported:true,storageMode:'single-writer'});
    }
    if(pathname.startsWith('/api/v1/')){req.cornerApiV1=true;pathname='/api/'+pathname.slice('/api/v1/'.length)}
    checkOrigin(req);
    if(pathname.startsWith('/api/'))return await api(req,res,pathname,url);
    if(pathname==='/robots.txt')return end(res,200,`User-agent: *\nDisallow: ${config.basePath}/admin\nDisallow: ${config.basePath}/api/admin/\nSitemap: ${config.siteUrl}/sitemap.xml\n`,{'content-type':'text/plain; charset=utf-8'});
    if(pathname==='/sitemap.xml')return end(res,200,sitemap(),{'content-type':'application/xml; charset=utf-8'});
    if(pathname.startsWith('/media/')){if(!['GET','HEAD'].includes(req.method))throw httpError(405,'Method not allowed');return mediaFile(req,res,pathname.split('/').at(-1));}
    if(['/style.css','/magic.css','/v3.css','/v3.js','/account.css','/app.js','/admin.js','/account.js','/nav.js','/mark.svg','/og.svg'].includes(pathname))return staticFile(res,pathname);
    if(req.method!=='GET'&&req.method!=='HEAD')throw httpError(405,'Method not allowed');
    if(pathname==='/admin'){
      let token='';try{token=decodeURIComponent(cookieHeader(req).corner_session||'')}catch{}
      const session=store.session(token);
      const staff=session&&privilegedRole(session.role)?session:null;
      return page(res,adminRouteState(staff),200,true);
    }
    if(['/login','/register','/verify-email','/resend-verification','/forgot-password','/reset-password','/confirm-email','/profile','/settings/security','/admin/register','/admin/mfa','/admin/invite'].includes(pathname)){
      const cookies=cookieHeader(req);
      const readToken=(name)=>{try{return decodeURIComponent(cookies[name]||'')}catch{return ''}};
      const staff=store.session(readToken('corner_session'));
      const member=store.session(readToken('corner_member_session'));
      const actor=staff&&privilegedRole(staff.role)?staff:member?.role==='member'?member:null;
      const valid=!!actor&&(actor.role==='member'?!!identity.getProfile(actor.id)?.verified_at:privilegedRole(actor.role));
      if(pathname==='/admin/invite'&&(!valid||actor.role!=='owner'))throw httpError(403,'Owner account required.','OWNER_REQUIRED');
      return page(res,accountPage({type:pathname,user:valid?identity.safeMe(identity.account(actor.id)):null,registrationOpen:identity.canRegister()}),200,true);
    }
    if(pathname==='/guestbook'&&v3.enabled('GUESTBOOK'))return page(res,guestbookPage(v3));
    if(pathname==='/follow'&&v3.enabled('FOLLOW'))return page(res,followPage());
    if(pathname==='/follow/confirm'&&v3.enabled('FOLLOW'))return page(res,followConfirmPage());
    if(pathname==='/follow/unsubscribe'&&v3.enabled('FOLLOW'))return page(res,unsubscribePage());
    if(pathname==='/archive'&&v3.enabled('SEARCH'))return page(res,archivePage(v3,url.searchParams.get('year')||''));
    if(pathname==='/search'&&v3.enabled('SEARCH'))return page(res,searchPage(v3,{q:url.searchParams.get('q')||'',category:url.searchParams.get('category')||'',year:url.searchParams.get('year')||'',tag:url.searchParams.get('tag')||'',offset:url.searchParams.get('offset')||0}));
    if(pathname==='/'){let f=publicSnapshot(),featured=store.getFeatured();if(!featured&&f.items.length)featured=f.items.find(p=>p.featured);return page(res,feedPage({posts:f.items,cursor:f.nextCursor,status:store.currentStatus(),featured,onThisDay:store.onThisDay(),eventCursor:eventCursor(),upcoming:store.upcoming(true),mediaByPost:Object.fromEntries(f.items.map(p=>[p.id,postMedia(p)])),demo:config.demo&&store.getFeed().items.length===0}))}
    if(pathname.startsWith('/category/')){let category=CATEGORIES.find(v=>v.toLowerCase()===pathname.slice(10));if(!category||category==='Latest')throw httpError(404,'Page not found');let f=publicSnapshot(category);return page(res,feedPage({posts:f.items,cursor:f.nextCursor,active:category,status:store.currentStatus(),eventCursor:eventCursor(),mediaByPost:Object.fromEntries(f.items.map(p=>[p.id,postMedia(p)])),demo:config.demo&&store.getFeed({category}).items.length===0}))}
    if(pathname.startsWith('/post/')){let slug=decodeURIComponent(pathname.slice(6));let post=store.getPost(slug);if(!post&&config.demo)post=samples().find(x=>x.slug===slug);if(!post)throw httpError(404,'Post not found');let posts=store.getFeed({limit:25}).items;if(config.demo&&!posts.length)posts=samples();let next=posts.find(x=>x.id!==post.id);return page(res,detailPage({post,counts:post.demo?{}:store.getReactions(post.id),comments:post.demo?[]:store.getComments(post.id),media:postMedia(post),next}));}
    if(pathname==='/about')return page(res,simplePage({path:'/about',title:'About this space',lead:'A personal publication. Not a network, not a newsfeed.',body:'<p>Vamsi’s Corner is a place to collect moments, technical notes, updates, and good wishes over time.</p><p>Small cards invite you in. The longer stories stay just one tap away. New updates arrive quietly, without interrupting what you are reading.</p>',}));
    if(pathname==='/privacy')return page(res,simplePage({path:'/privacy',title:'Privacy',lead:'A small footprint, by design.',body:'<p>The site stores pseudonymous first-party identifiers to reduce abusive reactions and measure engagement. Essential private session cookies are used for registered members and authorized Studio accounts. We do not sell visitor data or use advertising trackers.</p><p>Registering an account collects your email address, chosen display name, password hash, verification status, account preferences and bookmarks. Account email is used for verification and recovery through our email processor. Profiles are private by default and public posting rights are not granted to members. Optional V3 features include a moderated guestbook (display name and message), double-opt-in publication subscriptions (encrypted email address and consent history), and reading progress saved only when a verified member requests it. Subscription emails include an opt-out process; account creation alone never enrolls anyone.</p><p>When enabled, comments collect the name and text you submit for moderation and display. Raw pseudonymous analytics are removed after 90 days. Sessions, pending requests, audit logs and backups have separate operational retention requirements.</p><p>Verified account holders can request profile correction, a data export or deletion review through their account. For other requests email <a href="mailto:connect@vamsimarripudi.me">connect@vamsimarripudi.me</a>. Identity verification may be required before removal; statutory timelines depend on the applicable law.</p>'}));
    if(pathname==='/terms')return page(res,simplePage({path:'/terms',title:'Terms',lead:'A few sensible expectations.',body:'<p>This site is a personal publication. Its content is provided for general information, not professional advice. Please do not submit illegal, harassing, automated or misleading comments or attempts to access private areas.</p><p>Members are responsible for protecting their account credentials and the content they submit. Registered profiles are private by default and do not grant publishing or moderation access. Studio access is invitation-only and subject to additional verification.</p><p>External links are outside this site’s control. Content and features may evolve. Questions: <a href="mailto:connect@vamsimarripudi.me">connect@vamsimarripudi.me</a>.</p>'}));
    if(pathname==='/now')return page(res,simplePage({path:'/now',title:'Now',lead:store.currentStatus()?.label||'A little space for what is current.',body:`<p>${escapeHtml(store.currentStatus()?.detail||'When a status is shared it will appear here.')}</p>`}));
    throw httpError(404,'Page not found','NOT_FOUND');
  }catch(err){
    const status=err?.status||500;
    if(status>=500)log('error',{route:pathname,status,error:err?.code||err?.name||'UNKNOWN',timeMs:duration(started)});
    if(pathname.startsWith('/api/'))return json(res,{error:{code:err?.code||'INTERNAL_ERROR',message:status>=500?'The service is temporarily unavailable.':err.message}},status);
    return page(res,simplePage({path:pathname||'/',title:status===404?'Not found':'Temporarily unavailable',lead:status===404?'That page is not here.':'Something got in the way. Please try again.',body:'<p>Head back to the corner and find something good to read.</p>'}),status);
  }
}
export function createServer(){return http.createServer((req,res)=>{route(req,res).catch(err=>{log('error',{where:'unhandled',message:err?.message});if(!res.headersSent)json(res,{error:{code:'INTERNAL_ERROR',message:'Unexpected error'}},500);else res.end()})})}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const server=createServer();server.listen(config.port,config.host,()=>console.log(`Vamsi's Corner running at http://${config.host}:${config.port}`));
  const worker=setInterval(()=>{try{store.tick();store.cleanup();store.saveSetting('scheduler.lastSuccess',date());store.saveSetting('scheduler.lastError',null)}catch(err){store.saveSetting('scheduler.lastError',String(err?.code||err?.message||'ERROR').slice(0,100));log('error',{where:'worker',code:err?.code||'ERROR'})}},15000);
  const stopOffsiteBackups=startOffsiteScheduler(store);
  const shutdown=()=>{stopOffsiteBackups();clearInterval(worker);server.close(()=>{store.close();process.exit(0)})};
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
