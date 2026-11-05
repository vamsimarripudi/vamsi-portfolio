/* Unified Railway maintenance. Default OFF until validated external-service cutover. */
export function createUnifiedMaintenance({
 enabled=()=>process.env.UNIFIED_PORTFOLIO_API==='1'&&process.env.UNIFIED_MAINTENANCE_ENABLED==='1',
 now=()=>new Date(),
 fetchRequest=(...args)=>fetch(...args),
 secret=()=>process.env.CRON_SECRET||'',
 lastCompleted=()=>'',markCompleted=()=>{},
 onFailure=()=>{},
 port=()=>Number(process.env.PORT||4141),
 retryMs=15*60*1000
}={}){
  let inFlight=false,lastAttemptAt=-Infinity;
  return async function checkMaintenance(){
    if(!enabled())return {status:'disabled'};
    const current=now();
    if(!(current instanceof Date)||!Number.isFinite(current.getTime()))return {status:'invalid-time'};
    const date=current.toISOString().slice(0,10);
    if(current.getUTCHours()<8)return {status:'before-window'};
    if(lastCompleted()===date)return {status:'complete'};
    if(inFlight)return {status:'in-flight'};
    if(current.getTime()-lastAttemptAt<retryMs)return {status:'retry-backoff'};
    const token=secret();
    if(!token)return {status:'not-configured'};
    const targetPort=Number(port());
    if(!Number.isInteger(targetPort)||targetPort<1||targetPort>65535)return {status:'invalid-port'};
    lastAttemptAt=current.getTime();inFlight=true;
    try{
      const response=await fetchRequest('http://127.0.0.1:'+targetPort+'/api/track/cron/followups',{
        method:'GET',headers:{Authorization:'Bearer '+token},
        signal:AbortSignal.timeout(90000)
      });
      if(!response?.ok)throw Error('request-failed');
      const data=await response.json();
      if(data?.ok!==true||data?.analyticsCleanup==='failed'||data?.surveyCleanup==='failed')
        throw Error('cleanup-incomplete');
      await markCompleted(date);
      return {status:'completed',date,processed:Number(data.processed||0)};
    }catch(error){
      onFailure(error?.message==='cleanup-incomplete'?'CLEANUP_INCOMPLETE':'MAINTENANCE_UNAVAILABLE');
      return {status:'failed'};
    }finally{inFlight=false;}
  };
}
