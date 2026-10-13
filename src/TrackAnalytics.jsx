import {lazy,Suspense} from 'react';
import {useSearchParams} from 'react-router-dom';
const WebsiteAnalytics=lazy(()=>import('./WebsiteAnalytics.jsx'));
const SourceReport=lazy(()=>import('./TrackSourceReport.jsx'));
export default function TrackAnalytics(props){
 const [params]=useSearchParams();const external=['ga4','enquiries'].includes(params.get('source'));
 return <Suspense fallback={<main className="track-page"><p role="status">Loading website analytics…</p></main>}>{external?<SourceReport {...props}/>:<WebsiteAnalytics {...props}/>}</Suspense>;
}
