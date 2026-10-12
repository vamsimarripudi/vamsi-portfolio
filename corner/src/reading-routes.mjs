import {httpError} from './domain.mjs';
import {READING_CONSENT} from './reading-analytics.mjs';
export function readingRoutes({reading,store,readJSON,ok,limit,requireOwner,cookieHeader}){
 const privateHeaders=res=>{res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Vary','Cookie')};
 return async(req,res,path,url)=>{
  if(!['/api/analytics/reading','/api/admin/analytics/reading'].includes(path))return false;
  privateHeaders(res);
  if(path==='/api/admin/analytics/reading'){
   if(req.method!=='GET'){res.setHeader('Allow','GET');throw httpError(405,'Method not allowed.')}
   const owner=requireOwner(req,'/api/admin/analytics/summary','GET');limit(req,'reading-reports',60,60);
   if([...url.searchParams.keys()].some(k=>url.searchParams.getAll(k).length!==1))throw httpError(400,'Duplicate report parameters.','INVALID_RANGE');
   ok(res,reading.report(owner,Object.fromEntries(url.searchParams)));return true;
  }
  if(!['POST','DELETE'].includes(req.method)){res.setHeader('Allow','POST, DELETE');throw httpError(405,'Method not allowed.')}
  limit(req,'reading-signals',90,60);
  const payload=await readJSON(req,4000),cookies=cookieHeader(req);
  if(req.method==='DELETE'){
   if(Object.keys(payload).length!==1||!Object.hasOwn(payload,'journey'))throw httpError(400,'Invalid deletion request.');
   ok(res,reading.forget(payload.journey));return true;
  }
  let token='';try{token=decodeURIComponent(cookies.corner_session||'')}catch{/* invalid session is not a staff identity */}
  const user=store.session(token);
  const skip=process.env.CORNER_READING_ANALYTICS==='0'||cookies[READING_CONSENT]!=='allow'||req.headers.dnt==='1'||req.headers['sec-gpc']==='1'||['owner','admin','editor','moderator'].includes(user?.role)||/bot\b|crawler|spider/i.test(req.headers['user-agent']||'');
  if(skip){ok(res,{accepted:false});return true}
  ok(res,reading.collect(payload));return true;
 };
}
