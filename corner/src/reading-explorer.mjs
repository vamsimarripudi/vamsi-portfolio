/** Aggregate-only exploration over already-consented snapshots. No new collection. */
const MIN = 5, RATE_MIN = 20, DAY = 86400000, IDLE = 1800000;
const time = v => typeof v === 'string' ? Date.parse(v) : NaN;
const hidden = n => n > 0 && n < MIN;
const safe = n => hidden(n) ? null : n;
const day = ms => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
const median = xs => { const a = [...xs].sort((x,y) => x-y), i = Math.floor(a.length/2); return a.length < MIN ? null : Math.round(a.length % 2 ? a[i] : (a[i-1]+a[i])/2); };
const eventAt = (row, field, end) => {
 const v = time(row[field]); return Number.isFinite(v) && v >= time(row.started_at) && v <= time(row.updated_at) && v < end ? v : null;
};
/** Wilson score interval, not a correction for opt-in or repeated-person bias. */
export function wilson(success, total) {
 if (!Number.isInteger(total) || !Number.isInteger(success) || total < 1 || success < 0 || success > total) return null;
 const z = 1.959963984540054, p = success/total, d = 1 + z*z/total;
 const center = (p + z*z/(2*total))/d, half = z*Math.sqrt(p*(1-p)/total + z*z/(4*total*total))/d;
 return { low: Math.max(0,center-half), high: Math.min(1,center+half), level: .95 };
}
export function boundedRate(success, total) {
 if (!Number.isInteger(success) || !Number.isInteger(total) || success < 0 || success > total) throw new TypeError('Invalid aggregate count');
 if (!total) return { status:'empty', total:0, success:0, rate:null, interval:null };
 if (hidden(total) || hidden(success) || hidden(total-success)) return { status:'suppressed', total:null, success:null, rate:null, interval:null };
 return { status:total<RATE_MIN?'small_sample':'available', total, success, rate:total<RATE_MIN?null:success/total, interval:total<RATE_MIN?null:wilson(success,total) };
}
function cohort(rows, range, now, prior = new Set()) {
 const from = time(range.from), to = Math.min(time(range.to), now), groups = new Map();
 const quality = { invalidVisits:0, activeJourneys:0, boundaryJourneys:0, priorEntryJourneys:0, mixedDeviceJourneys:0 };
 for (const row of rows) {
  if (!['feed','story'].includes(row.page) || !row.journey_key || !row.view_key || !Number.isFinite(time(row.started_at)) || !Number.isFinite(time(row.updated_at)) || time(row.started_at)<from || time(row.started_at)>=to || time(row.updated_at)<time(row.started_at)) { quality.invalidVisits++; continue; }
  if (!groups.has(row.journey_key)) groups.set(row.journey_key, []);
  groups.get(row.journey_key).push(row);
 }
 const journeys = [];
 for (const [key, list] of groups) {
  const sorted = [...list].sort((a,b)=>time(a.started_at)-time(b.started_at)||String(a.view_key).localeCompare(String(b.view_key)));
  if (prior.has(key)) { quality.priorEntryJourneys++; continue; }
  // Snapshots cannot reconstruct historical intermediate state. Exclude carry-over,
  // rather than silently attributing future depth/engagement to a past date range.
  if (sorted.some(r=>time(r.updated_at)>=time(range.to)||time(r.updated_at)>now)) { quality.boundaryJourneys++; continue; }
  if (sorted.some(r=>time(r.updated_at)>=to-IDLE)) { quality.activeJourneys++; continue; }
  if (new Set(sorted.map(r=>r.device)).size>1) { quality.mixedDeviceJourneys++; continue; }
  const first=sorted[0], stories=sorted.filter(r=>r.page==='story');
  const reads=stories.map(row=>({row,at:eventAt(row,'reached90_at',to)})).filter(x=>x.at!==null && x.row.active_ms>=10000).sort((a,b)=>a.at-b.at);
  // A later qualifying story may be the one engaged with; never only inspect the first read.
  const engagement=reads.map(x=>({...x,engaged:eventAt(x.row,'engaged_at',to)})).filter(x=>x.engaged!==null&&x.engaged>=x.at).sort((a,b)=>a.engaged-b.engaged)[0];
  const storyAt=stories.length?time(stories[0].started_at):null;
  journeys.push({ firstAt:time(first.started_at), device:first.device, source:first.source, entry:first.page, pages:sorted.map(r=>r.page), storyAt, readAt:reads[0]?.at??null, engagedAt:engagement?.engaged??null,
   activeMs:stories.reduce((n,r)=>n+Math.max(0,Math.min(1800000,Number(r.active_ms)||0)),0), failed:sorted.some(r=>r.request_failed||r.media_failed) });
 }
 return { journeys, quality, end:to };
}
const labels={feed:['Feed entry','Story open','Substantial read','Subsequent interaction'],story:['Story entry','Substantial read','Subsequent interaction']};
function progress(journey, entry) {
 return entry==='feed' ? [journey.firstAt,journey.storyAt,journey.readAt,journey.engagedAt] : [journey.storyAt,journey.readAt,journey.engagedAt];
}
export function funnelFor(journeys, entry='feed') {
 const selected=journeys.filter(j=>entry==='feed'?j.entry==='feed':j.storyAt!==null);
 const counts=labels[entry].map((_,i)=>selected.filter(j=>progress(j,entry).slice(0,i+1).every(t=>t!==null)).length);
 const suppressed=counts.some(hidden)||counts.slice(1).some((n,i)=>hidden(counts[i]-n));
 const steps=labels[entry].map((label,i)=>{
  const pairs=i?selected.map(j=>progress(j,entry)).filter(p=>p.slice(0,i+1).every(t=>t!==null)).map(p=>(p[i]-p[i-1])/1000):[];
  const count=suppressed?null:counts[i],base=i?counts[i-1]:counts[0];
  const estimate=suppressed?{rate:null,interval:null,status:'suppressed'}:boundedRate(counts[i],base);
  return {label,count,drop:i===0||suppressed?null:base-counts[i],rate:i===0?null:estimate.rate,interval:i===0?null:estimate.interval,medianSeconds:suppressed||!i?null:median(pairs),status:suppressed?'suppressed':estimate.status};
 });
 const conversion=suppressed?{status:'suppressed',total:null,success:null,rate:null,interval:null}:boundedRate(counts.at(-1),counts[0]);
 return {entry,steps,conversion,suppressed};
}
function segments(journeys,field,values) {
 const rows=values.map(id=>{const entries=journeys.filter(j=>j.storyAt!==null&&j[field]===id);return {id,...boundedRate(entries.filter(j=>j.readAt!==null).length,entries.length),medianActiveSeconds:median(entries.map(j=>j.activeMs/1000))};});
 // Complementary suppression prevents deriving a rare segment by subtraction from totals.
 const suppressed=rows.some(r=>r.status==='suppressed');
 return { suppressed, rows:rows.map(r=>suppressed?{id:r.id,status:'suppressed',total:null,success:null,rate:null,interval:null,medianActiveSeconds:null}:r) };
}
function distribution(journeys,key,label) {
 const groups=new Map();for(const j of journeys){const v=key(j);if(v===null)continue;groups.set(v,(groups.get(v)||0)+1)}
 const sorted=[...groups].sort((a,b)=>b[1]-a[1]), head=sorted.slice(0,8), tail=sorted.slice(8).reduce((n,[,v])=>n+v,0);if(tail)head.push(['Other sequences',tail]);
 const suppressed=[...groups.values()].some(hidden);
 return {suppressed,rows:head.map(([id,n])=>({label:label(id),count:suppressed?null:n}))};
}
export function buildExplorer({current,previous,range,now=new Date(),priorCurrent=new Set(),priorPrevious=new Set()}) {
 const at=now.getTime(), a=cohort(current,range,at,priorCurrent), b=range.previous&&previous?cohort(previous,range.previous,at,priorPrevious):null;
 const modes={};for(const entry of ['feed','story']){
  const active=funnelFor(a.journeys,entry),baseline=b?funnelFor(b.journeys,entry):null;
  modes[entry]={current:active,previous:baseline,deltaPoints:active.conversion.rate!==null&&baseline?.conversion.rate!=null?(active.conversion.rate-baseline.conversion.rate)*100:null};
 }
 const points=[];for(let date=range.start;date<=range.end;date=new Date(Date.parse(date)+DAY).toISOString().slice(0,10)){
  const rows=a.journeys.filter(j=>j.storyAt!==null&&day(j.storyAt)===date),estimate=boundedRate(rows.filter(j=>j.readAt!==null).length,rows.length);
  points.push({date,...estimate});
 }
 const devices=segments(a.journeys,'device',['mobile','tablet','desktop']),sources=segments(a.journeys,'source',['direct','internal','search','social','referral']);
 const paths=distribution(a.journeys,j=>j.pages.slice(0,4).join(' → ')+(j.pages.length>4?' → …':''),s=>s.replaceAll('feed','Feed').replaceAll('story','Story'));
 const transitionCounts=new Map();
 for(const j of a.journeys){const seen=new Set();for(let i=1;i<j.pages.length;i++)seen.add(j.pages[i-1]+' → '+j.pages[i]);for(const edge of seen)transitionCounts.set(edge,(transitionCounts.get(edge)||0)+1)}
 const transitions={suppressed:[...transitionCounts.values()].some(hidden),rows:[...transitionCounts].map(([label,count])=>({label:label.replaceAll('feed','Feed').replaceAll('story','Story'),count}))};
 if(transitions.suppressed)transitions.rows.forEach(r=>r.count=null);
 const diagnostics=Object.entries(a.quality).map(([id,n])=>({id,count:safe(n)}));
 const priorities=[];
 for(const mode of Object.values(modes)){if(mode.deltaPoints!==null&&Math.abs(mode.deltaPoints)>=10&&mode.current.conversion.total>=30&&mode.previous.conversion.total>=30)priorities.push({kind:'period_change',title:(mode.current.entry==='feed'?'Feed-entry':'Story-entry')+' conversion changed',evidence:mode.deltaPoints.toFixed(1)+' percentage points versus the selected prior period.',action:'Compare sources, device mix and content. This exploratory change is not an A/B test or proof of causality.'});}
 if(!devices.suppressed){const eligible=devices.rows.filter(r=>r.rate!==null&&r.total>=30).sort((x,y)=>x.rate-y.rate);if(eligible.length>1&&eligible.at(-1).rate-eligible[0].rate>=.15)priorities.push({kind:'device_gap',title:'Device reading gap',evidence:eligible[0].id+' has a lower observed substantial-read rate than '+eligible.at(-1).id+'.',action:'Reproduce the reading flow on both devices; inspect content mix and media before attributing the difference to layout.'});}
 if(!priorities.length)priorities.push({kind:'insufficient_signal',title:'No strong investigation trigger',evidence:'No comparison met the documented sample and change thresholds.',action:'Use the tables to inspect observations. Do not interpret a low sample or missing baseline as good or bad performance.'});
 return {version:1,modes,trend:points,segments:{devices,sources},paths,transitions,diagnostics,priorities,
  quality:{eligibleJourneys:safe(a.journeys.length),collectionEnabled:process.env.CORNER_READING_ANALYTICS!=='0',analysis:'Same-window, settled, complete-entry cohorts. Snapshots continuing past the window are excluded, not reconstructed.',comparison:b?'same_rules':'not_requested',sampleMinimum:MIN,rateMinimum:RATE_MIN},
  caveats:['This exploration reuses existing consented snapshots; it adds no collection, cookies or personal profiles.','Feed-entry and story-entry funnels have different denominators. Story-entry includes direct arrivals and stories opened after the feed.','Daily points are grouped by first story start in Asia/Kolkata; blank rates are unavailable, not zero.','Paths are coarse page-type sequences, not individual trails or click-level event streams. A transition counts once per journey; transition totals may overlap.','Wilson 95% intervals assume independent Bernoulli observations; consent selection and repeated people can violate those assumptions. They are not population guarantees.','Positive groups or complements below five are withheld; rates require at least 20 entries. This is not differential privacy.','Engagement time uses the last retained qualifying interaction timestamp, not an exact time-to-first action.']};
}
