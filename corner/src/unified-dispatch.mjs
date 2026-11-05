import { randomUUID } from 'node:crypto';

const maxBodyBytes = 256 * 1024;
const allowedMethods = new Set(['POST','PATCH','PUT','DELETE']);
const exact = Object.freeze({
  '/api/contact': { module: '../../api/contact.js' },
  '/api/birthday': { module: '../../api/contact.js', forcedQuery: { birthday: '1' } },
  '/api/track/auth/request': { module: '../../api/track/auth/request.js' },
  '/api/track/auth/verify': { module: '../../api/track/auth/verify.js' },
  '/api/track/auth/session': { module: '../../api/track/auth/session.js' },
  '/api/track/auth/logout': { module: '../../api/track/auth/logout.js' },
  '/api/track/enquiries': { module: '../../api/track/enquiries/index.js' },
  '/api/track/metrics': { module: '../../api/track/metrics.js' },
  '/api/track/analytics': { module: '../../api/track/metrics.js', forcedQuery: { view: 'analytics' } },
  '/api/track/ev-surveys': { module: '../../api/track/metrics.js', forcedQuery: { view: 'ev-surveys' } },
  '/api/track/cron/followups': { module: '../../api/track/cron/followups.js' },
  '/api/ev-survey': { module: '../../api/track/metrics.js', forcedQuery: { view: 'ev-public' } },
  '/api/website/events': { module: '../../api/track/metrics.js', forcedQuery: { view: 'site-events' } },
});

export function resolvePortfolioRoute(pathname) {
  if (pathname === '/api/unified/health') return { internal: 'health' };
  if (pathname === '/api/unified/ready') return { internal: 'ready' };
  if (Object.hasOwn(exact, pathname)) return exact[pathname];
  const match = pathname.match(/^\/api\/track\/enquiries\/(VM-ENQ-[0-9]{4}-[A-Z0-9]{6})(?:\/(actions|reply))?$/i);
  if (match) {
    const segment = match[2] ? '/' + match[2] : '';
    return {
      module: '../../api/track/enquiries/[referenceId]' + segment + '.js',
      params: { referenceId: match[1] }
    };
  }
  return null;
}

function responseJson(res,status,payload,headers={}) {
  if(res.writableEnded)return;
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  for(const [key,value] of Object.entries(headers))res.setHeader(key,value);
  res.end(JSON.stringify(payload));
}
class RequestFailure extends Error{
  constructor(status,code,message){super(message);this.status=status;this.code=code;}
}
async function jsonBody(req){
  const kind=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
  if(kind!=='application/json')throw new RequestFailure(415,'JSON_REQUIRED','JSON request body required.');
  const declared=Number(req.headers['content-length']||0);
  if(declared>maxBodyBytes)throw new RequestFailure(413,'BODY_TOO_LARGE','Request body is too large.');
  const chunks=[];let size=0;
  for await(const value of req){
    const chunk=Buffer.isBuffer(value)?value:Buffer.from(value);
    size+=chunk.length;
    if(size>maxBodyBytes)throw new RequestFailure(413,'BODY_TOO_LARGE','Request body is too large.');
    chunks.push(chunk);
  }
  if(size===0)return {};
  try{
    const obj=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Not an object');
    return obj;
  }catch{throw new RequestFailure(400,'INVALID_JSON','The request body must be a JSON object.');}
}
function protectOrigin(req){
  const origin=String(req.headers.origin||'');
  const allowed=new Set(['https://vamsimarripudi.me','https://www.vamsimarripudi.me']);
  for(const candidate of String(process.env.PORTFOLIO_ALLOWED_ORIGINS||'').split(',')){
    const value=candidate.trim();
    if(value && /^https:\/\/[a-z0-9.-]+(?::\d{2,5})?$/i.test(value))allowed.add(value);
  }
  if(!allowed.has(origin))throw new RequestFailure(403,'ORIGIN_REJECTED','Request origin was not accepted.');
}
function adaptResponse(res){
  res.status=function(status){res.statusCode=status;return res;};
  res.json=function(payload){responseJson(res,res.statusCode||200,payload);return res;};
  res.send=function(payload){
    if(res.writableEnded)return res;
    const bytes=typeof payload==='string'||Buffer.isBuffer(payload)?payload:String(payload ?? '');
    if(!res.getHeader('Content-Type'))res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.end(bytes);
    return res;
  };
}
const currentOrigin = () => 'https://vamsimarripudi.me';
export async function dispatchPortfolioRequest(req,res,url,{
  enabled=process.env.UNIFIED_PORTFOLIO_API==='1',
  loadHandler=async route=> (await import(route.module)).default
}={}){
  if(!enabled)return false;
  const route=resolvePortfolioRoute(url.pathname);
  if(!route)return false;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(route.internal){
    if(req.method!=='GET'&&req.method!=='HEAD')responseJson(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});
    else if(route.internal==='health')responseJson(res,200,{ok:true,service:'unified-personal-backend',component:'gateway',storageVerified:false});
    else{
      const required=['DATABASE_URL','TRACK_SESSION_SECRET','RESEND_API_KEY','CRON_SECRET'];
      const missing=required.filter(name=>!process.env[name]);
      responseJson(res,missing.length?503:200,{ok:missing.length===0,component:'configuration',databaseConnectivityVerified:false,missingConfigurationCount:missing.length});
    }
    return true;
  }
  try{
    if(allowedMethods.has(req.method)){
      protectOrigin(req);
      req.body=await jsonBody(req);
    }
    req.query=Object.fromEntries(url.searchParams);
    if(route.params)Object.assign(req.query,route.params);
    if(route.forcedQuery)Object.assign(req.query,route.forcedQuery);
    adaptResponse(res);
    const handle=await loadHandler(route);
    if(typeof handle!=='function')throw new RequestFailure(503,'HANDLER_UNAVAILABLE','The selected service is unavailable.');
    await handle(req,res);
    if(!res.writableEnded)responseJson(res,503,{ok:false,code:'INCOMPLETE_RESPONSE',message:'The selected service is unavailable.'});
  }catch(error){
    if(!res.headersSent)responseJson(res,error?.status||503,{ok:false,code:error?.code||'SERVICE_UNAVAILABLE',message:error?.status?error.message:'This service is temporarily unavailable.',requestId:res.getHeader('x-request-id')||randomUUID()});
    else if(!res.writableEnded)res.end();
  }
  return true;
}
