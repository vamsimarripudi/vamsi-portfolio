import {TrackError} from '../api/lib/track.js';
import {resolveRange,datesBetween,REPORT_TIME_ZONE} from '../shared/track-analytics.mjs';
import {SITE_PAGES,SOURCES,WEBSITE} from '../public/site-analytics-contract.mjs';
import {websiteDatabase,ensureWebsiteSchema} from './site-analytics-store.js';
const DAY=86400000, MIN=5;
const time=v=>v==null?null:new Date(v).getTime();
const unique=rows=>new Set(rows.map(r=>r.journey_key)).size;
const safe=(n,subjects=n)=>n===0?0:n<MIN||subjects<MIN?null:n;
const date=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
const bounds=r=>({from:Date.parse(r.start)-330*60000,to:Date.parse(r.end)+DAY-330*60000});
const median=rows=>{if(unique(rows)<MIN)return null;const values=rows.map(r=>r.active_ms/1000).sort((a,b)=>a-b),i=Math.floor(values.length/2);return values.length%2?values[i]:(values[i-1]+values[i])/2};
const rate=(part,all)=>{const members=new Set(part),a=unique(part),b=unique(all),other=unique(all.filter(r=>!members.has(r)));return !b||b<MIN||(a>0&&a<MIN)||(other>0&&other<MIN)?null:part.length/all.length};
export function websiteRange(input,now=new Date()){
 const range=resolveRange(input,now,REPORT_TIME_ZONE);
 if(range.days>90)throw new TrackError(400,'Website analytics supports up to 90 days.','INVALID_RANGE');
 if(!['all','mobile','tablet','desktop'].includes(input.device||'all')||!['all',...SOURCES].includes(input.trafficSource||'all'))throw new TrackError(400,'Choose a supported website filter.','INVALID_QUERY');
 return {...range,device:input.device||'all',trafficSource:input.trafficSource||'all'};
}
export async function loadWebsiteAnalytics(input,{sql=websiteDatabase(),now=new Date(),initialize=ensureWebsiteSchema}={}){
 const range=websiteRange(input,now);await initialize(sql);
 const cur=bounds(range),prev=range.previous?bounds(range.previous):cur,min=Math.max(now.getTime()-90*DAY,Math.min(cur.from,prev.from)-DAY),max=Math.min(now.getTime()+1,cur.to+DAY);
 const rows=await sql.query('SELECT * FROM site_analytics_views WHERE started_at >= $1 AND started_at < $2 ORDER BY started_at,view_key LIMIT 50001',[new Date(min).toISOString(),new Date(max).toISOString()]);
 if(rows.length>50000)throw new TrackError(413,'Choose a shorter period. The report is not silently sampled.','WEBSITE_TOO_LARGE');
 const [first]=await sql.query('SELECT MIN(started_at) AS first FROM site_analytics_views',[]);
 return websiteReport(rows,range,now,first?.first||null);
}
export function websiteReport(raw,range,now=new Date(),firstAt=null){
 const all=raw.filter(r=>typeof r.path==='string'&&Object.hasOwn(SITE_PAGES,r.path)),context=new Map();
 for(const row of all){if(!context.has(row.journey_key))context.set(row.journey_key,[]);context.get(row.journey_key).push(row)}
 for(const rows of context.values())rows.sort((a,b)=>time(a.started_at)-time(b.started_at));
 const eligible=rows=>rows.filter(row=>{const entry=context.get(row.journey_key)[0];return (range.device==='all'||entry.device===range.device)&&(range.trafficSource==='all'||entry.source===range.trafficSource)});
 const select=r=>{const {from,to}=bounds(r);return eligible(all.filter(x=>time(x.started_at)>=from&&time(x.started_at)<to))};
 const current=select(range),previous=range.previous?select(range.previous):[],end=bounds(range).to,cutoff=Math.min(now.getTime(),end)-1800000;
 const observed=(r,key,last=end)=>time(r[key])!==null&&time(r[key])<last&&time(r[key])>=time(r.started_at);
 const stats=(rows,r)=>{const b=bounds(r),engaged=rows.filter(x=>observed(x,'engaged_at',b.to));return {views:safe(rows.length,unique(rows)),journeys:safe(unique(rows)),engagedRate:rate(engaged,rows),medianSeconds:median(rows),contact:safe(rows.filter(x=>observed(x,'contact_success_at',b.to)).length,unique(rows.filter(x=>observed(x,'contact_success_at',b.to))))}};
 const totals=stats(current,range),prior=stats(previous,range.previous||range),first=time(firstAt),comparison=!!range.previous&&!range.partial&&first!==null&&bounds(range.previous).from>=first&&bounds(range.previous).from>=now.getTime()-90*DAY;
 const metrics=[['views','Page views','number','Consented website page visits, including repeat visits.'],['journeys','Browser journeys','number','Short-lived tab journeys; not identified people.'],['engagedRate','Engaged visits','percent','At least 10 visible active seconds, not the GA4 engagement definition.'],['medianSeconds','Active time','seconds','Median seconds per observed page visit, not time to enquiry.']].map(([id,label,format,description])=>({id,label,format,description,value:totals[id],previous:comparison?prior[id]:null}));
 const pages=Object.keys(SITE_PAGES).flatMap(path=>{const rows=current.filter(r=>r.path===path);return rows.length?[{path,label:SITE_PAGES[path],...stats(rows,range)}]:[]}).sort((a,b)=>(b.views??-1)-(a.views??-1));
 const groups=(values,key)=>values.map(value=>{const rows=current.filter(r=>context.get(r.journey_key)[0][key]===value);return {label:value,value:safe(rows.length,unique(rows))}});
 const byJourney=new Map();for(const row of current){if(!byJourney.has(row.journey_key))byJourney.set(row.journey_key,[]);byJourney.get(row.journey_key).push(row)}
 const settled=[...byJourney].filter(([key])=>context.get(key).every(r=>time(r.updated_at)<cutoff&&time(r.updated_at)<end));
 const funnel=(title,labels,counts,definition)=>{const withheld=counts.some(n=>n>0&&n<MIN)||counts.slice(1).some((n,i)=>counts[i]-n>0&&counts[i]-n<MIN);return {title,definition,withheld,steps:labels.map((label,i)=>({label,value:withheld?null:counts[i],drop:i===counts.length-1||withheld?null:counts[i]-counts[i+1],rate:i===counts.length-1||withheld||counts[i]<20?null:counts[i+1]/counts[i]}))}};
 const discover=[0,0,0,0],contact=[0,0,0];
 for(const [key,rows] of settled){
  const contacts=rows.filter(r=>r.path==='/contact');if(contacts.length){contact[0]++;if(contacts.some(r=>observed(r,'contact_start_at'))){contact[1]++;if(contacts.some(r=>observed(r,'contact_start_at')&&observed(r,'contact_success_at')&&time(r.contact_success_at)>=time(r.contact_start_at)))contact[2]++}}
  if(context.get(key)[0].path!=='/'||context.get(key)[0]!==rows[0])continue;discover[0]++;
  const work=rows.find(r=>r.path==='/work'||r.path.startsWith('/work/'));if(!work)continue;discover[1]++;
  const lead=contacts.find(r=>time(r.started_at)>=time(work.started_at));if(!lead)continue;discover[2]++;if(observed(lead,'contact_success_at'))discover[3]++;
 }
 const groupCount=(rows,fn)=>{const map=new Map();for(const r of rows){const key=fn(r);if(!map.has(key))map.set(key,[]);map.get(key).push(r)}return [...map].map(([label,items])=>({label,value:safe(items.length,unique(items))})).sort((a,b)=>(b.value??-1)-(a.value??-1))};
 const last=settled.map(([,rows])=>[...rows].sort((a,b)=>time(b.updated_at)-time(a.updated_at))[0]);
 const paths=groupCount(settled.map(([,rows])=>({...rows[0],sequence:rows.filter((r,i)=>!i||r.path!==rows[i-1].path).slice(0,5).map(r=>SITE_PAGES[r.path]).join(' → ')})),r=>r.sequence).filter(r=>r.value!==null).slice(0,12);
 const lastPages=groupCount(last,r=>SITE_PAGES[r.path]),lastDepth=groupCount(last,r=>r.depth<25?'Before 25%':r.depth<50?'25–49%':r.depth<75?'50–74%':r.depth<90?'75–89%':'90% or beyond');
 const priorDays=range.previous?datesBetween(range.previous.start,range.previous.end):[];
 const points=datesBetween(range.start,range.end).map((day,i)=>{const rows=current.filter(r=>date(time(r.started_at))===day),old=previous.filter(r=>date(time(r.started_at))===priorDays[i]);return {date:day,value:first===null||Date.parse(day)+DAY<first?null:safe(rows.length,unique(rows)),previousDate:priorDays[i]||null,previous:!comparison?null:safe(old.length,unique(old))}});
 const starts=current.filter(r=>observed(r,'contact_start_at')),success=current.filter(r=>observed(r,'contact_success_at'));
 return {source:'website',sourceLabel:WEBSITE+' · Website analytics',scope:'Public website including portfolio pages and public Corner route groups; excludes /track, sign-in, admin, APIs and personal share links.',status:'ready',range,generatedAt:now.toISOString(),metrics,trend:{label:'Page views',points},pages,
  audience:{journeys:totals.journeys,views:totals.views,notice:'No named people, fingerprinting or cross-device identity.'},devices:groups(['mobile','tablet','desktop'],'device'),sources:groups(SOURCES,'source'),
  funnels:[funnel('Discovery to enquiry',['Home entry','Work / case study','Contact page','Accepted enquiry'],discover,'Ordered, home-entry journeys inactive for 30 minutes. Direct arrivals are excluded from this funnel.'),funnel('Contact form',['Contact visit','Form started','Accepted enquiry'],contact,'All inactive contact journeys, including direct arrivals. Acceptance is the successful contact-service response, not email delivery.')],
  paths,lastPages,lastDepth,lastSections:groupCount(last,r=>r.section),outcomes:[{label:'Contact form started',value:safe(starts.length,unique(starts))},{label:'Enquiry accepted',value:safe(success.length,unique(success))},{label:'Contact submission failed',value:safe(current.filter(r=>r.contact_failed).length,unique(current.filter(r=>r.contact_failed)))},{label:'Resume download link clicked',value:safe(current.filter(r=>r.resume_click).length,unique(current.filter(r=>r.resume_click)))},{label:'External profile link clicked',value:safe(current.filter(r=>r.profile_click).length,unique(current.filter(r=>r.profile_click)))}],
  failures:[{label:'Request failed',value:safe(current.filter(r=>r.request_failed).length,unique(current.filter(r=>r.request_failed)))},{label:'Media failed',value:safe(current.filter(r=>r.media_failed).length,unique(current.filter(r=>r.media_failed)))}],
  quality:{firstObservedAt:firstAt,retentionDays:90,minimum:MIN,comparisonAvailable:comparison,collectionEnabled:process.env.WEBSITE_ANALYTICS!=='0',hasData:current.length>0,activeJourneys:safe(byJourney.size-settled.length)},
  warnings:['This source measures vamsimarripudi.me, not only the Corner and not the enquiry database. Existing Corner reading history is not relabelled as website history.','Only opted-in observations are included. Missing or withheld is not zero traffic. Public Corner stories are grouped without storing their slugs.','Last observed page, section and depth are not proof of exit or motive. Active tabs, blockers and network loss can hide subsequent activity.','Snapshots show the latest received depth/time of selected visits, not a historical replay. Funnels exclude visits still active or extending beyond the period.','Small counts require at least five distinct browser journeys; rates also withhold small complements. This is not differential privacy.','Accepted enquiries here are consented observed contact successes. The Enquiries tab remains the authoritative record; do not add these counts to GA4 or Corner statistics.']};
}
