// Optional in-process maintenance for the single Railway web service.
// Disabled unless explicitly enabled AFTER the Vercel cron is retired.
// Processes *only* the existing authenticated cron endpoint and preserves its DB idempotency.
const retryMs=15*60*1000;
const utcDay=day=>day.toISOString().slice(0,10);

export function createUnifiedMaintenance({
  enabled=false,
  clock=()=>new Date(),
  task=async()=>({ok:false}),
  logger=()=>{},
  startTimer=true
}={}){
  let completedOn=null;
  let lastAttempt=0;
  let inFlight=false;
  let stopped=false;

  const tick=async()=>{
    if(!enabled||stopped)return {status:'disabled'};
    const current=clock();
    const day=utcDay(current);
    if(current.getUTCHours()<8)return {status:'not-due'};
    if(completedOn===day)return {status:'completed'};
    if(inFlight)return {status:'in-flight'};
    const epoch=current.getTime();
    if(lastAttempt&&epoch-lastAttempt<retryMs)return {status:'retry-delayed'};
    lastAttempt=epoch;
    inFlight=true;
    try{
      const result=await task();
      if(result?.ok){
        completedOn=day;
        logger({state:'success',day});
        return {status:'completed'};
      }
      logger({state:'retryable-failure',day});
      return {status:'retryable-failure'};
    }catch{
      logger({state:'retryable-failure',day});
      return {status:'retryable-failure'};
    }finally{inFlight=false;}
  };
  const timer=startTimer&&enabled?setInterval(()=>void tick(),60*1000):null;
  timer?.unref?.();
  if(timer)void tick();
  return {tick,stop(){stopped=true;if(timer)clearInterval(timer);},status(){return {enabled,completedOn,inFlight};}};
}

export function startUnifiedMaintenance({enabled=false,port}={}){
  const secret=String(process.env.CRON_SECRET||'').trim();
  if(enabled&&!secret)throw new Error('CRON_SECRET required for Railway unified maintenance.');
  return createUnifiedMaintenance({
    enabled,
    task:async()=>{
      const response=await fetch('http://127.0.0.1:'+Number(port||4141)+'/api/track/cron/followups',{
        method:'GET',headers:{authorization:'Bearer '+secret},
        signal:AbortSignal.timeout(120000)
      });
      await response.arrayBuffer().catch(()=>{});
      return {ok:response.ok};
    },
    logger:({state,day})=>console[state==='success'?'info':'error'](JSON.stringify({
      app:'unified-personal-backend',event:'portfolio.daily_maintenance',state,day
    }))
  });
}
