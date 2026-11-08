import {useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {FiActivity,FiAlertTriangle,FiBarChart2,FiFileText,FiMail,FiRefreshCw,FiShield} from 'react-icons/fi';
import './TrackPf3Operations.css';

const when=value=>{if(!value)return 'Not received';const t=new Date(value);return Number.isNaN(+t)?'Unverified timestamp':new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(t);};
const count=value=>Number.isInteger(value)?new Intl.NumberFormat('en-IN').format(value):'—';
const inr=value=>Number.isSafeInteger(value)&&value>=0?new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(value/100):'—';
export default function TrackPf3Operations(){
 const [data,setData]=useState(null),[status,setStatus]=useState('loading'),[failure,setFailure]=useState('');
 const [refresh,setRefresh]=useState(0);
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
 const verifiedCollections=revenue&&(revenue.status==='verified_captured_snapshot'||revenue.status==='stale');
 const cards=[
  {key:'events',label:'Verified events',value:count(metrics?.events),Icon:FiActivity,detail:'Deduplicated operational signals'},
  {key:'message_drafts',label:'Message drafts',value:count(metrics?.message_drafts),Icon:FiMail,detail:'Created, not automatically delivered'},
  {key:'provider_accepted',label:'Provider accepted',value:count(metrics?.provider_accepted),Icon:FiMail,detail:'Acceptance is not proof of delivery'},
  {key:'delivery_uncertain',label:'Uncertain sends',value:count(metrics?.delivery_uncertain),Icon:FiAlertTriangle,detail:'Requires manual reconciliation'},
  {key:'message_failed',label:'Send failures',value:count(metrics?.message_failed),Icon:FiAlertTriangle,detail:'Not automatically retried'},
  {key:'grants_saved',label:'Saved grants',value:count(metrics?.grants_saved),Icon:FiShield,detail:'Grant events, not active automation'}
 ];
 return <main className="track-page pf3-track" aria-labelledby="pf3-track-title">
  <header className="pf3-track-heading">
   <div><p className="track-kicker">OWNER WORKSPACE · PAKKAFOLLOW</p><h1 id="pf3-track-title">Operations 3.0</h1>
    <p>Clear status, traceable activity and source-backed reporting.</p></div>
   <button type="button" className="pf3-track-refresh" disabled={status==='loading'} onClick={load}><FiRefreshCw aria-hidden="true"/> Refresh</button>
  </header>
  {status==='loading'&&<p role="status" className="pf3-track-notice">Checking signed operational events…</p>}
  {status==='error'&&<div role="alert" className="pf3-track-notice"><strong>Reporting unavailable</strong><p>{failure}</p><button type="button" onClick={load}>Retry</button></div>}
  {status==='ready'&&<>
   <div className={'pf3-track-connection'+(data.connected?' is-connected':'')} role="status">
    <FiShield aria-hidden="true"/><span>{data.connected?'Signed operational events connected':'Awaiting verified event ingestion'}</span>
    <small>Last event: {when(metrics?.last_received_at)}</small>
   </div>
   <section className="pf3-track-cards" aria-label="Operational counters">{cards.map(({key,label,value,Icon,detail})=><article key={key} className="pf3-track-card">
    <span className="pf3-track-card-icon"><Icon aria-hidden="true"/></span><span>{label}</span><strong>{value}</strong><small>{detail}</small>
   </article>)}</section>
   <section className="pf3-track-ledgers" aria-label="Financial reporting">
    <article><FiBarChart2 aria-hidden="true"/><h2>Captured platform collections</h2>
     <strong>{verifiedCollections?inr(revenue.capturedMinor):'Not reconciled'}</strong>
     {verifiedCollections?<p>Refunds {inr(revenue.refundedMinor)} · Net collections {inr(revenue.netCollectionsMinor)}. <b>{revenue.status==='stale'?'Snapshot stale':'Verified payment ledger snapshot'}</b> through {when(revenue.periodEnd)}.</p>:
     <p>Awaiting a verified payment snapshot. Customer invoices are never counted as platform revenue.</p>}
     <p>Taxes, vendor costs and accounting profit are not verified in this view.</p></article>
    <article><FiFileText aria-hidden="true"/><h2>Customer invoices</h2><strong>Separate ledger</strong><p>Customer-issued documents never count as PakkaFollow revenue. This connector is not activated.</p></article>
   </section>
   <section className="track-panel pf3-track-events" aria-labelledby="pf3-events-title">
    <div className="pf3-track-section-heading"><h2 id="pf3-events-title">Recent operational events</h2><small>Source: {data.source||'unavailable'} · Checked {when(data.asOf)}</small></div>
    {data.events?.length?<div className="pf3-track-table-wrap"><table><thead><tr><th>Event</th><th>Work type</th><th>Occurred</th><th>Ingested</th></tr></thead>
    <tbody>{data.events.map(item=><tr key={item.event_id}><td>{item.event_type}</td><td>{item.role?.replaceAll('_',' ')}</td><td>{when(item.occurred_at)}</td><td>{when(item.received_at)}</td></tr>)}</tbody></table></div>
    :<p>No signed events have been received. This is not evidence that no customer activity occurred.</p>}
   </section>
   <div className="pf3-track-footer-actions">
    <Link to="/track/pakkafollow">Open support inbox</Link><Link to="/track/analytics">Website analytics</Link>
   </div>
  </>}
 </main>;
}
