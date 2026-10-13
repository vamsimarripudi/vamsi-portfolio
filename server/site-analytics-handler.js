import {json,TrackError} from '../api/lib/track.js';
import {CONSENT_COOKIE,validateWebsiteSignal} from '../public/site-analytics-contract.mjs';
import {websiteDatabase,websiteSecret,websiteHash,ensureWebsiteSchema,limitWebsite,collectWebsite,revokeWebsite} from './site-analytics-store.js';
export const siteCookies=header=>Object.fromEntries(String(header||'').split(';').flatMap(p=>{const i=p.indexOf('=');return i<0?[]:[[p.slice(0,i).trim(),p.slice(i+1).trim()]]}));
export function createWebsiteCollector({database=websiteDatabase,secret=websiteSecret,initialize=ensureWebsiteSchema,clock=()=>new Date(),env=process.env}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Vary','Cookie');
  if(!['POST','DELETE'].includes(req.method)){res.setHeader('Allow','POST, DELETE');return json(res,405,{ok:false,message:'Method not allowed.'})}
  try{
   const allowed=['https://vamsimarripudi.me','https://www.vamsimarripudi.me'];
   if(env.NODE_ENV==='test'&&/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin||''))allowed.push(req.headers.origin);
   if(!allowed.includes(req.headers.origin)||!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new TrackError(403,'Website event origin rejected.','WEBSITE_ORIGIN');
   const cookies=siteCookies(req.headers.cookie),disabled=env.WEBSITE_ANALYTICS==='0'||(env.VERCEL_ENV&&env.VERCEL_ENV!=='production'&&env.NODE_ENV!=='test');
   if(req.method==='POST'&&(disabled||cookies[CONSENT_COOKIE]!=='allow'||req.headers.dnt==='1'||req.headers['sec-gpc']==='1'||cookies.vm_track_session||cookies.corner_session||/bot\b|crawler|spider/i.test(req.headers['user-agent']||'')))return json(res,200,{ok:true,accepted:false});
   if(Number(req.headers['content-length']||0)>2048)throw new TrackError(413,'Website event too large.','WEBSITE_INVALID');
   let body=req.body;try{if(typeof body==='string')body=JSON.parse(body)}catch{throw new TrackError(400,'Invalid website event.','WEBSITE_INVALID')}
   if(!body||typeof body!=='object'||Buffer.byteLength(JSON.stringify(body))>2048)throw new TrackError(400,'Invalid website event.','WEBSITE_INVALID');
   if(req.method==='POST'){try{body=validateWebsiteSignal(body)}catch{throw new TrackError(400,'Invalid website event.','WEBSITE_INVALID')}}
   else if(Object.keys(body).length!==1||typeof body.journey!=='string'||!/^[a-f0-9]{32}$/.test(body.journey))throw new TrackError(400,'Invalid preference request.','WEBSITE_INVALID');
   const sql=database(),key=secret(),now=clock();await initialize(sql);
   // Provider-supplied address is used only for abuse limiting; no raw address is persisted.
   const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].slice(0,80);
   await limitWebsite(sql,websiteHash('rate:'+ip,key),now,60,60);await limitWebsite(sql,'website-global',now,30000,86400);
   const result=await(req.method==='DELETE'?revokeWebsite(body.journey,{sql,secret:key,now}):collectWebsite(body,{sql,secret:key,now}));
   return json(res,200,{ok:true,...result});
  }catch(error){const known=error instanceof TrackError;if(known&&error.status===429)res.setHeader('Retry-After','60');return json(res,known?error.status:503,{ok:false,code:known?error.code:'WEBSITE_UNAVAILABLE',message:known?error.message:'Website analytics is temporarily unavailable.'})}
 };
}
export default createWebsiteCollector();
