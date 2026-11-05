import {pathToFileURL} from 'node:url';

const validOrigin=/^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i;
function assertOrigin(origin){
 if(typeof origin!=='string'||!validOrigin.test(origin))throw Error('Expected verified HTTPS Railway service origin');
 return origin;
}
export async function verifyUnifiedRailway({origin,fetcher=globalThis.fetch}={}){
 const base=assertOrigin(origin);
 const calls=[];
 const check=async(path,options={})=>{
  const response=await fetcher(base+path,{
   method:'GET',redirect:'manual',headers:{'Cache-Control':'no-cache'},
   signal:AbortSignal.timeout(12000),...options
  });
  calls.push({path,status:response.status});
  return response;
 };
 const corner=await check('/corner/api/health');
 if(corner.status!==200)throw Error('Corner health requires HTTP 200');
 const cornerJson=await corner.json();
 if(cornerJson?.data?.database!=='connected')throw Error('Corner database is not verified');
 const gateway=await check('/api/unified/health');
 if(gateway.status!==200)throw Error('Unified gateway is not running');
 const gatewayJson=await gateway.json();
 if(gatewayJson?.component!=='gateway')throw Error('Unexpected gateway implementation');
 const ready=await check('/api/unified/ready');
 if(ready.status!==200)throw Error('Portfolio backend has not passed the readiness gate');
 const readyJson=await ready.json();
 if(readyJson?.ok!==true||readyJson?.databaseConnectivityVerified!==true)
  throw Error('Readiness response does not prove live DB access');
 const owner=await check('/api/track/auth/session');
 if(owner.status!==401)throw Error('Unauthenticated owner session was not denied');
 const forbidden=await check('/api/contact',{method:'POST',
  headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},
  body:'{}'});
 if(forbidden.status!==403)throw Error('Forbidden cross-origin contact submission was not blocked');
 return {ok:true,origin:base,checks:calls};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const origin=process.argv[2];
 try{
  const result=await verifyUnifiedRailway({origin});
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
 }catch(error){
  process.stderr.write('Release probe blocked: '+error.message+'\n');
  process.exitCode=1;
 }
}
