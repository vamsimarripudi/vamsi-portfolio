import {createElement,useCallback,useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {FiActivity,FiAlertTriangle,FiBarChart2,FiDownload,FiFileText,FiMail,FiRefreshCw,FiShield} from 'react-icons/fi';
import './TrackPf3Operations.css';

const when=value=>{if(!value)return 'Not received';const t=new Date(value);return Number.isNaN(+t)?'Unverified timestamp':new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(t);};
const count=value=>Number.isInteger(value)?new Intl.NumberFormat('en-IN').format(value):'—';
const inr=value=>Number.isSafeInteger(value)&&value>=0?new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(value/100):'—';
export default function TrackPf3Operations(){
 const [data,setData]=useState(null),[status,setStatus]=useState('loading'),[failure,setFailure]=useState('');
 const [refresh,setRefresh]=useState(0);
 const [params,setParams]=useSearchParams();
 const views=[
  ['overview','Overview'],['revenue','Revenue'],['invoices','Invoices'],['communications','Communications'],
  ['automation','Workflows'],['ai','AI'],['monitoring','Monitoring'],['audit','Event logs']
 ];
 const view=views.some(([id])=>id===params.get('view'))?params.get('view'):'overview';
 const [filter,setFilter]=useState('all');
 const selectView=id=>{const next=new URLSearchParams(params);if(id==='overview')next.delete('view');else next.set('view',id);setParams(next);};
 
 const load=useCallback(()=>setRefresh(n=>n+1),[]);
 useEffect(()=>{
  const controller=new AbortController();let live=true;setStatus('loading');setFailure('');
  fetch('/api/track/pakkafollow/operations',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async response=>{const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw new Error(result.message||'Operational data is unavailable.');return result;})
   .then(result=>{if(live){setData(result);setStatus('ready');}})
   .catch(error=>{if(live&&error.name!=='AbortError'){setFailure(error.message);setStatus('error');}});
  return()=>{live=false;controller.abort();};
 },[refresh]);
 const metrics=data?.connected?data.metrics:null,revenue=data?.revenue;
 const eventGroups={
  overview:null,revenue:['billing.snapshot'],invoices:['document.drafted','document.finalized'],
  communications:['message.drafted','message.approved','message.accepted','message.failed','message.uncertain'],
  automation:['automation.granted','automation.revoked','automation.task_created','automation.task_completed'],ai:[],monitoring:null,audit:null
 };
 const filteredEvents=(data?.events||[]).filter(event=>{
  const allowed=eventGroups[view];
  return (allowed===null||allowed.includes(event.event_type))&&
   (filter==='all'||event.role===filter||event.event_type===filter);
 });
 const downloadEvents=()=>{
  if(!filteredEvents.length)return;
  const cols=['event_type','role','occurred_at','received_at'];
  const csv=[cols.join(','),...filteredEvents.map(record=>cols.map(key=>
   '"'+String(record[key]||'').replaceAll('"','""').replace(/^[=+@-]/,'\u2019 const metrics=data?.connected?data.metrics:null,revenue=data?.revenue;')+'"').join(','))].join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='pakkafollow-safe-events.csv';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
 };
 
 const verifiedCollections=revenue&&(revenue.status==='verified_captured_snapshot'||revenue.status==='stale');
 const cards=[
  {key:'events',label:'Verified events',value:count(metrics?.events),Icon:FiActivity,detail:'Deduplicated operational signals'},
  {key:'message_drafts',label:'Message drafts',value:count(metrics?.message_drafts),Icon:FiMail,detail:'Created, not automatically delivered'},
  {key:'provider_accepted',label:'Provider accepted',value:count(metrics?.provider_accepted),Icon:FiMail,detail:'Acceptance is not proof of delivery'},
  {key:'delivery_uncertain',label:'Uncertain sends',value:count(metrics?.delivery_uncertain),Icon:FiAlertTriangle,detail:'Requires manual reconciliation'},
  {key:'message_failed',label:'Send failures',value:count(metrics?.message_failed),Icon:FiAlertTriangle,detail:'Not automatically retried'},
  {key:'grants_saved',label:'Saved grants',value:count(metrics?.grants_saved),Icon:FiShield,detail:'Grant events, not active automation'},
  {key:'internal_tasks_created',label:'Internal review tasks',value:count(metrics?.internal_tasks_created),Icon:FiActivity,detail:'Owner-only tasks, no external messages'},
  {key:'document_finalized',label:'Documents finalized',value:count(metrics?.document_finalized),Icon:FiFileText,detail:'Customer-owned documents, not platform revenue'},
  {key:'document_provider_accepted',label:'PDF emails accepted',value:count(metrics?.document_provider_accepted),Icon:FiMail,detail:'Provider accepted, not proof of inbox delivery'},
  {key:'document_delivery_uncertain',label:'Uncertain PDF sends',value:count(metrics?.document_delivery_uncertain),Icon:FiAlertTriangle,detail:'Manual reconciliation required'}
 ];
 return <main className="track-page pf3-track" aria-labelledby="pf3-track-title">
  <header className="pf3-track-heading">
   <div><p className="track-kicker">OWNER WORKSPACE · PAKKAFOLLOW</p><h1 id="pf3-track-title">Operations 3.0</h1>
    <p>Clear status, traceable activity and source-backed reporting.</p></div>
   <button type="button" className="pf3-track-refresh" disabled={status==='loading'} onClick={load}><FiRefreshCw aria-hidden="true"/> Refresh</button>
  </header>
  <nav className="pf3-track-tabs" aria-label="Operational reporting sections">
   {views.map(([id,label])=><button type="button" key={id} aria-current={view===id?'page':undefined} onClick={()=>selectView(id)}>{label}</button>)}
  </nav>
  {status==='loading'&&<p role="status" className="pf3-track-notice">Checking signed operational events…</p>}
  {status==='error'&&<div role="alert" className="pf3-track-notice"><strong>Reporting unavailable</strong><p>{failure}</p><button type="button" onClick={load}>Retry</button></div>}
  {status==='ready'&&<>
   <div className={'pf3-track-connection'+(data.connected?' is-connected':'')} role="status">
    <FiShield aria-hidden="true"/><span>{data.connected?'Signed operational events connected':'Awaiting verified event ingestion'}</span>
    <small>Last event: {when(metrics?.last_received_at)}</small>
   </div>
   {(view==='overview'||view==='communications'||view==='automation'||view==='invoices')&&<section className="pf3-track-cards" aria-label="Operational counters">{cards.map(({key,label,value,Icon,detail})=><article key={key} className="pf3-track-card">
    <span className="pf3-track-card-icon">{createElement(Icon,{'aria-hidden':true})}</span><span>{label}</span><strong>{value}</strong><small>{detail}</small>
   </article>)}</section>}
   {(view==='overview'||view==='revenue'||view==='invoices')&&<section className="pf3-track-ledgers" aria-label="Financial reporting">
    <article><FiBarChart2 aria-hidden="true"/><h2>Captured platform collections</h2>
     <strong>{verifiedCollections?inr(revenue.capturedMinor):'Not reconciled'}</strong>
     {verifiedCollections?<p>Refunds {inr(revenue.refundedMinor)} · Net collections {inr(revenue.netCollectionsMinor)}. <b>{revenue.status==='stale'?'Snapshot stale':'Verified payment ledger snapshot'}</b> through {when(revenue.periodEnd)}.</p>:
     <p>Awaiting a verified payment snapshot. Customer invoices are never counted as platform revenue.</p>}
     <p>Taxes, vendor costs and accounting profit are not verified in this view.</p></article>
    <article><FiFileText aria-hidden="true"/><h2>Customer documents</h2><strong>{data.invoices?.status==='operational_counts_only'?count(data.invoices.finalized):'Separate ledger'}</strong><p>Finalization events only. Customer invoices are excluded from PakkaFollow platform revenue; document amounts and contents are not shared with Track.</p></article>
   </section>}
   {view==='monitoring'&&<section className="track-panel pf3-track-observability"><h2>Event pipeline status</h2><p>Last signed event received: {when(metrics?.last_received_at)}.</p><p>Signed events report a product activity stream; they do not prove API, database or email provider uptime.</p><p>Finance snapshot: {revenue?.status||'unavailable'}.</p></section>}
   {view==='ai'&&<section className="track-panel pf3-track-observability"><h2>AI monitoring</h2><p>AI-specific counters are not instrumented in this event feed. No usage or cost estimate is shown without a verified source.</p></section>}
   <section className="track-panel pf3-track-events" aria-labelledby="pf3-events-title">
    <div className="pf3-track-section-heading"><div><h2 id="pf3-events-title">{view==='audit'?'Signed event journal':'Recent operational events'}</h2><small>Source: {data.source||'unavailable'} · Checked {when(data.asOf)} · Most recent 40 events</small></div>
     <div className="pf3-track-event-controls"><label>Filter
      <select value={filter} onChange={e=>setFilter(e.target.value)}>
       <option value="all">All roles and events</option>
       {['creator','freelancer','consultant','solo_business','agency','other'].map(role=><option key={role} value={role}>{role.replaceAll('_',' ')}</option>)}
      </select></label>
      <button type="button" disabled={!filteredEvents.length} onClick={downloadEvents}><FiDownload aria-hidden="true"/> Export safe CSV</button>
     </div>
    </div>
    {filteredEvents.length?<div className="pf3-track-table-wrap"><table><thead><tr><th>Event</th><th>Work type</th><th>Occurred</th><th>Ingested</th></tr></thead>
    <tbody>{filteredEvents.map(item=><tr key={item.event_id}><td>{item.event_type}</td><td>{item.role?.replaceAll('_',' ')}</td><td>{when(item.occurred_at)}</td><td>{when(item.received_at)}</td></tr>)}</tbody></table></div>
    :<p>No signed events have been received or matched this view. This is not evidence that no customer activity occurred.</p>}
   </section>
   <div className="pf3-track-footer-actions">
    <Link to="/track/pakkafollow">Open support inbox</Link><Link to="/track/analytics">Website analytics</Link>
   </div>
  </>}
 </main>;
}
