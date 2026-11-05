import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { dispatchPortfolioRequest,resolvePortfolioRoute } from '../corner/src/unified-dispatch.mjs';

const apiRoutes=['/api/contact','/api/birthday','/api/track/auth/request','/api/track/auth/verify','/api/track/auth/session','/api/track/auth/logout','/api/track/enquiries','/api/track/metrics','/api/track/analytics','/api/track/ev-surveys','/api/track/cron/followups','/api/ev-survey','/api/website/events','/api/track/enquiries/VM-ENQ-2026-ABC123','/api/track/enquiries/VM-ENQ-2026-ABC123/actions','/api/track/enquiries/VM-ENQ-2026-ABC123/reply'];
test('all existing portfolio, Tracker and EV API routes map to audited handlers',()=>{
 for(const path of apiRoutes)assert.ok(resolvePortfolioRoute(path)?.module,path);
 for(const path of ['/corner/api/health','/corner/api/admin/settings','/api/other','/api/track/enquiries/not-a-real-id','/api/track/enquiries/../auth/verify'])assert.equal(resolvePortfolioRoute(path),null);
 assert.equal(resolvePortfolioRoute('/api/birthday').forcedQuery.birthday,'1');
 assert.equal(resolvePortfolioRoute('/api/website/events').forcedQuery.view,'site-events');
});
async function local(handler,cb){
 const s=http.createServer(async(req,res)=>{
   const url=new URL(req.url,'http://localhost');
   const handled=await dispatchPortfolioRequest(req,res,url,{enabled:true,loadHandler:async()=>handler});
   if(!handled){res.statusCode=404;res.end('not found');}
 });
 s.listen(0,'127.0.0.1');await once(s,'listening');
 try{return await cb('http://127.0.0.1:'+s.address().port);}finally{await new Promise(resolve=>s.close(resolve));}
}
test('gateway preserves parsed body, origin and status on forwarded endpoints',async()=>{
 await local(async(req,res)=>{
   assert.deepEqual(req.body,{message:'hello'});
   assert.equal(req.query.view,undefined);
   res.status(201).json({ok:true,ref:'CASE-1'});
 },async base=>{
   const res=await fetch(base+'/api/contact',{method:'POST',headers:{origin:'https://vamsimarripudi.me','content-type':'application/json'},body:JSON.stringify({message:'hello'})});
   assert.equal(res.status,201);
   assert.equal(res.headers.get('cache-control'),'no-store');
   assert.equal((await res.json()).ref,'CASE-1');
 });
});
test('cross-site POST and malformed JSON are rejected before handler execution',async()=>{
 let calls=0;
 await local(async()=>{calls+=1},async base=>{
   const wrong=await fetch(base+'/api/contact',{method:'POST',headers:{origin:'https://outside.invalid','content-type':'application/json'},body:'{}'});
   assert.equal(wrong.status,403);
   const malformed=await fetch(base+'/api/contact',{method:'POST',headers:{origin:'https://vamsimarripudi.me','content-type':'application/json'},body:'{'});
   assert.equal(malformed.status,400);
   const wrongType=await fetch(base+'/api/contact',{method:'POST',headers:{origin:'https://vamsimarripudi.me','content-type':'text/plain'},body:'ok'});
   assert.equal(wrongType.status,415);
 });
 assert.equal(calls,0);
});
test('body limit and route selectors enforce boundaries',async()=>{
 await local(async()=>{},async base=>{
   const huge=await fetch(base+'/api/contact',{method:'POST',headers:{origin:'https://vamsimarripudi.me','content-type':'application/json'},body:JSON.stringify({big:'x'.repeat(300000)})});
   assert.equal(huge.status,413);
   const unknown=await fetch(base+'/api/unknown');
   assert.equal(unknown.status,404);
 });
});
test('canonical URL query aliases override malicious user-supplied view',async()=>{
 await local(async(req,res)=>res.status(200).json({view:req.query.view,case:req.query.referenceId}),async base=>{
   const analytics=await fetch(base+'/api/track/analytics?view=ev-surveys');
   assert.equal((await analytics.json()).view,'analytics');
   const detail=await fetch(base+'/api/track/enquiries/VM-ENQ-2026-ABC123');
   assert.equal((await detail.json()).case,'VM-ENQ-2026-ABC123');
 });
});
test('gateway health is never mislabeled database readiness',async()=>{
 await local(async()=>{},async base=>{
   const r=await fetch(base+'/api/unified/health');
   const data=await r.json();
   assert.equal(r.status,200);
   assert.equal(data.storageVerified,false);
   assert.equal(data.component,'gateway');
 });
});
