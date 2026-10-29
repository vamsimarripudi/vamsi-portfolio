import {useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {FiArrowRight,FiClock,FiExternalLink,FiInbox,FiMail,FiRefreshCw,FiSearch} from 'react-icons/fi';
import './PakkaFollowTrack.css';

const SUPPORT_FORM='/contact?reason=PakkaFollow%20Support';
const TYPES=[['','All categories'],['PakkaFollow Support','Support'],['PakkaFollow Billing','Billing'],['PakkaFollow Enquiry','Product enquiries']];
const STATUSES=[['','All statuses'],['NEW','New'],['REVIEWING','Reviewing'],['WAITING_ON_CONTACT','Awaiting reply'],['FOLLOW_UP_DUE','Follow-up due'],['COMPLETED','Completed'],['CLOSED','Closed']];
const stamp=value=>value?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
export default function PakkaFollowTrack(){
 const [urlParams,setUrlParams]=useSearchParams();
 const [data,setData]=useState({items:[],total:0,page:1});
 const [state,setState]=useState('loading');
 const [error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 const filters={q:urlParams.get('q')||'',intent:urlParams.get('intent')||'',status:urlParams.get('status')||'',page:Math.max(1,Number(urlParams.get('page'))||1)};
 const query=useMemo(()=>{const p=new URLSearchParams({source:'pakkafollow',page:String(filters.page)});if(filters.q)p.set('q',filters.q);if(TYPES.some(x=>x[0]===filters.intent)&&filters.intent)p.set('intent',filters.intent);if(STATUSES.some(x=>x[0]===filters.status)&&filters.status)p.set('status',filters.status);return p.toString();},[filters.q,filters.intent,filters.status,filters.page]);
 const update=(key,value)=>{const p=new URLSearchParams(urlParams);if(value)p.set(key,value);else p.delete(key);if(key!=='page')p.delete('page');setUrlParams(p);};
 useEffect(()=>{
  const controller=new AbortController();let live=true;setState('loading');setError('');
  const t=window.setTimeout(async()=>{try{
   const response=await fetch('/api/track/enquiries?'+query,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||result.ok!==true)throw new Error(response.status===401?'Your session expired. Sign in to Track again.':result.message||'Could not load the product inbox.');
   if(live){setData({items:result.items||[],total:result.total||0,page:result.page||1});setState('ready');}
  }catch(e){if(live&&e.name!=='AbortError'){setError(e.message);setState('error');}}},140);
  return()=>{live=false;controller.abort();window.clearTimeout(t);};
 },[query,refresh]);
 const pages=Math.max(1,Math.ceil(data.total/25));
 return <main className="track-page pf-track-page">
  <div className="pf-track-hero">
   <div><p className="track-kicker">Owner workspace / product correspondence</p><h1>PakkaFollow</h1><p className="pf-track-lead">Product support, billing questions and enquiries in one private queue. Reply by email from Track without opening Gmail.</p></div>
   <div className="pf-track-hero-actions"><a href={SUPPORT_FORM} target="_blank" rel="noopener noreferrer"><FiExternalLink/> Customer contact form</a><button type="button" onClick={()=>setRefresh(x=>x+1)} disabled={state==='loading'}><FiRefreshCw className={state==='loading'?'pf-spin':''}/> Refresh</button></div>
  </div>
  <section className="pf-track-summary" aria-label="Inbox overview">
   <div><span className="pf-track-icon"><FiInbox/></span><div><small>Matching messages</small><strong aria-live="polite">{state==='ready'?data.total:'—'}</strong></div></div>
   <p>Only PakkaFollow-labelled correspondence appears here. Other portfolio enquiries remain in the Enquiries section.</p>
  </section>
  <section className="track-panel pf-track-inbox" aria-labelledby="pf-inbox-heading">
   <div className="pf-track-title"><div><p className="track-kicker">Email-only workflow</p><h2 id="pf-inbox-heading">Support & enquiries</h2></div><span className="pf-track-mail"><FiMail/> Replies use connect@vamsimarripudi.me</span></div>
   <div className="pf-track-filters">
    <label><span><FiSearch/> Search</span><input type="search" value={filters.q} onChange={e=>update('q',e.target.value)} placeholder="Customer, reference or subject"/></label>
    <label>Category<select value={filters.intent} onChange={e=>update('intent',e.target.value)}>{TYPES.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
    <label>Status<select value={filters.status} onChange={e=>update('status',e.target.value)}>{STATUSES.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
   </div>
   {state==='loading'?<div className="pf-track-state" role="status"><span className="pf-loader" aria-hidden="true"/>Loading product correspondence…</div>:
    state==='error'?<div className="pf-track-state pf-track-error" role="alert"><strong>Could not load PakkaFollow enquiries.</strong><p>{error}</p><button type="button" onClick={()=>setRefresh(x=>x+1)}>Retry</button><Link to="/track">Back to dashboard</Link></div>:
    data.items.length===0?<div className="pf-track-state pf-track-empty"><FiInbox size={25}/><strong>No matching messages</strong><p>New PakkaFollow submissions will appear here once the contact form is used. Try changing filters.</p><button type="button" onClick={()=>setUrlParams({})}>Clear filters</button></div>:
    <ul className="pf-track-rows">{data.items.map(item=><li key={item.reference_id}>
      <div className="pf-track-row-main"><small>{item.reference_id} · {item.intent.replace('PakkaFollow ','')}</small><h3>{item.subject||item.name}</h3><p>{item.name} · {item.email}</p></div>
      <div className="pf-track-row-state"><span data-status={item.status}>{item.status.replaceAll('_',' ').toLowerCase()}</span><small><FiClock/> {stamp(item.created_at)}</small></div>
      <Link className="pf-track-open" to={'/track/enquiries/'+encodeURIComponent(item.reference_id)} aria-label={'Open and reply to '+item.name}>Open & reply <FiArrowRight/></Link>
     </li>)}</ul>}
   {state==='ready'&&pages>1&&<nav className="pf-track-pagination" aria-label="Inbox pages"><button disabled={filters.page<=1} onClick={()=>update('page',String(filters.page-1))}>Previous</button><span>Page {filters.page} of {pages}</span><button disabled={filters.page>=pages} onClick={()=>update('page',String(filters.page+1))}>Next</button></nav>}
  </section>
  <section className="pf-track-footnote"><strong>Delivery note</strong><p>Sending a reply records email-provider acceptance; it does not prove inbox delivery. Incoming replies sent directly to the mailbox will require mailbox synchronization to appear as new Track activity.</p></section>
 </main>;
}