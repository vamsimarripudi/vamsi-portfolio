import {httpError} from './domain.mjs';
export function insightRoutes({insights,requireOwner,ok,limit}){
 return async(req,res,path,url)=>{
  if(path!=='/api/admin/v3/insights')return false;
  if((req.method||'GET')!=='GET')throw httpError(405,'Method not allowed.','METHOD_NOT_ALLOWED');
  const actor=requireOwner(req,'/api/admin/analytics/summary','GET');
  insights.requireOwner(actor);
  limit(req,'v3-insights',100,3600);
  ok(res,insights.summary(actor,{days:url.searchParams.get('days')||7}));
  return true;
 };
}
