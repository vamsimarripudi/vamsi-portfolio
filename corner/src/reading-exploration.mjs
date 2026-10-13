// Read-only advanced analysis of already-consented observations. No new collection or identity.
import {httpError} from './domain.mjs';
const DAY=86400000,MIN=5;
const hiddenRate=(n,d,subjects,positiveSubjects,negativeSubjects)=>{const r=conversion(n,d,subjects);return small(positiveSubjects)||small(negativeSubjects)?{...r,value:null,numerator:null,interval:null,quality:'withheld'}:r};
const day=at=>new Date(Date.parse(at)+19800000).toISOString().slice(0,10);
const dateShift=(d,n)=>new Date(Date.parse(d)+n*DAY).toISOString().slice(0,10);
const unique=rows=>new Set(rows.map(r=>r.journey_key)).size;
const small=n=>n>0&&n<MIN;
const count=(n,people=n)=>small(n)||people<MIN&&n>0?null:n;
const quantile=(values,p)=>{if(values.length<MIN)return null;const a=[...values].sort((x,y)=>x-y),i=(a.length-1)*p;return Math.round(a[Math.floor(i)]+(a[Math.ceil(i)]-a[Math.floor(i)])*(i%1))};
export function conversion(n,total,subjects=total){
 if(!Number.isInteger(n)||!Number.isInteger(total)||n<0||total<0||n>total)throw new TypeError('Invalid conversion counts');
 const hidden=subjects<MIN||total<MIN||small(n)||small(total-n);
 if(hidden)return {value:null,numerator:null,denominator:count(total,subjects),interval:null,quality:total?'withheld':'unavailable'};
 const value=n/total,z=1.959963984540054,a=1+z*z/total,c=(value+z*z/(2*total))/a,h=z*Math.sqrt(value*(1-value)/total+z*z/(4*total*total))/a;
 return {value,numerator:n,denominator:total,interval:total>=30?[Math.max(0,c-h),Math.min(1,c+h)]:null,quality:total<30?'small sample':'directional'};
}
function protectedFunnel(counts,labels){
 const hidden=counts.some(small)||counts.slice(1).some((n,i)=>small(counts[i]-n));
 return {suppressed:hidden,steps:labels.map((label,i)=>({label,value:hidden?null:counts[i],drop:hidden||i===counts.length-1?null:counts[i]-counts[i+1],rate:hidden||i===counts.length-1||!counts[i]?null:counts[i+1]/counts[i],interval:hidden||i===counts.length-1?null:conversion(counts[i+1],counts[i]).interval}))};
}
export function advancedReading(store,range,now,{source='all',entry='all'}={}){
 if(!['all','direct','internal','search','social','referral'].includes(source)||!['all','feed','story'].includes(entry))throw httpError(400,'Choose supported source and entry filters.','INVALID_RANGE');
 const from=range.previous?.from||range.from,lower=new Date(Date.parse(from)-DAY).toISOString(),upper=new Date(Math.min(now.getTime()+1,Date.parse(range.to)+DAY)).toISOString();
 const raw=store.all('SELECT r.*,p.title,p.slug FROM reading_views r LEFT JOIN posts p ON p.id=r.post_id AND p.state=\'published\' WHERE r.started_at>=? AND r.started_at<? ORDER BY r.started_at,r.view_key LIMIT 50001',lower,upper);
 if(raw.length>50000)throw httpError(413,'Select a shorter interval. Advanced reports never silently sample.','REPORT_TOO_LARGE');
 const context=new Map();for(const r of raw){if(!context.has(r.journey_key))context.set(r.journey_key,[]);context.get(r.journey_key).push(r)}
 const eligible=new Set([...context].filter(([,rows])=>{const first=rows[0];return (range.device==='all'||first.device===range.device)&&(source==='all'||first.source===source)&&(entry==='all'||first.page===entry)}).map(([id])=>id));
 const firstAt=store.one('SELECT min(started_at) at FROM reading_views').at,firstDate=firstAt?day(firstAt):null;
 const cutoff=new Date(now.getTime()-1800000).toISOString();
 const select=r=>raw.filter(x=>x.started_at>=r.from&&x.started_at<r.to&&eligible.has(x.journey_key));
 const current=select(range),previous=range.previous?select(range.previous):[];
 const reached=(r,level,end)=>r['reached'+level+'_at']&&r['reached'+level+'_at']<end;
 const aggregate=(rows,r)=>{
  const stories=rows.filter(x=>x.page==='story'),subjects=unique(rows),storySubjects=unique(stories),complete=stories.filter(x=>reached(x,90,r.to));
  return {visits:count(rows.length,subjects),journeys:count(subjects),stories:count(stories.length,storySubjects),completed:count(complete.length,unique(complete)),failures:count(rows.filter(x=>x.request_failed||x.media_failed).length,unique(rows.filter(x=>x.request_failed||x.media_failed))),completion:hiddenRate(complete.length,stories.length,storySubjects,unique(complete),unique(stories.filter(x=>!reached(x,90,r.to)))),failureRate:hiddenRate(rows.filter(x=>x.request_failed||x.media_failed).length,rows.length,subjects,unique(rows.filter(x=>x.request_failed||x.media_failed)),unique(rows.filter(x=>!x.request_failed&&!x.media_failed))),medianSeconds:storySubjects>=MIN?quantile(stories.map(x=>x.active_ms/1000),.5):null,p75Seconds:storySubjects>=MIN?quantile(stories.map(x=>x.active_ms/1000),.75):null};
 };
 const totals=aggregate(current,range),prior=aggregate(previous,range.previous||range);
 const comparisonAvailable=!!previous.length&&!!range.previous&&!range.retentionLimited&&Date.parse(range.previous.from)>=now.getTime()-90*DAY&&(!firstAt||range.previous.start>=firstDate)&&!range.partial;
 const bucketDays=rows=>{const bins=new Map();for(const r of rows){const key=day(r.started_at);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(r)}return bins};
 const currentDays=bucketDays(current),previousDays=bucketDays(previous),series=[];
 for(let i=0;i<range.days;i++){
  const d=dateShift(range.start,i),pd=range.previous?dateShift(range.previous.start,i):null;
  const todayRows=currentDays.get(d)||[],prevRows=pd?(previousDays.get(pd)||[]):[];
  const unavailable=!firstDate||d<firstDate||Date.parse(d)+DAY<now.getTime()-90*DAY;
  const previousUnavailable=!pd||!firstDate||pd<firstDate||Date.parse(pd)+DAY<now.getTime()-90*DAY;
  const a=aggregate(todayRows,range),b=aggregate(prevRows,range.previous||range);
  series.push({day:d,previousDay:pd,visits:unavailable?null:a.visits,completed:unavailable?null:a.completed,failures:unavailable?null:a.failures,previousVisits:previousUnavailable?null:b.visits,previousCompleted:previousUnavailable?null:b.completed,previousFailures:previousUnavailable?null:b.failures,status:unavailable?'unavailable':a.visits===null?'withheld':'observed'});
 }
 const groups=new Map();for(const r of current){if(!groups.has(r.journey_key))groups.set(r.journey_key,[]);groups.get(r.journey_key).push(r)}
 const matured=[...groups].filter(([id])=>context.get(id).every(r=>r.updated_at<cutoff));
 const feeds=matured.filter(([id,rows])=>context.get(id)[0].started_at>=range.from&&rows[0].page==='feed');
 const discovery=[feeds.length,0,0,0];
 for(const [,rows] of feeds){const stories=rows.filter(r=>r.page==='story');if(!stories.length)continue;discovery[1]++;const complete=stories.filter(r=>reached(r,90,range.to));if(!complete.length)continue;discovery[2]++;if(complete.some(r=>r.engaged_at&&r.engaged_at>=r.reached90_at&&r.engaged_at<range.to))discovery[3]++}
 const direct=matured.filter(([,rows])=>rows.some(r=>r.page==='story'));
 const depthCounts=[direct.length,...[25,50,75,90].map(level=>direct.filter(([,rows])=>rows.some(r=>r.page==='story'&&reached(r,level,range.to))).length)];
 const funnel={...protectedFunnel(discovery,['Feed visit','Open a story','Reach 90% + 10 seconds','Interact after reading']),activeJourneys:count(groups.size-matured.length),definition:'Closed feed-entry journeys, inactive for 30 minutes. All steps observed within the selected window; any completed story may supply the later interaction.'};
 const readingFunnel={...protectedFunnel(depthCounts,['Open a story','Reach 25% + 10 seconds','Reach 50% + 10 seconds','Reach 75% + 10 seconds','Reach 90% + 10 seconds']),definition:'All inactive journeys with a story visit, including direct arrivals. One journey per stage; reading does not establish comprehension.'};
 const breakdown=kind=>{
  const values=kind==='device'?['mobile','tablet','desktop']:['direct','internal','search','social','referral'];
  return values.map(id=>{const filter=rows=>rows.filter(r=>context.get(r.journey_key)[0][kind]===id),a=aggregate(filter(current),range),b=aggregate(filter(previous),range.previous||range);return {id,label:id,...a,previousCompletion:comparisonAvailable?b.completion.value:null,changePoints:comparisonAvailable&&a.completion.value!==null&&b.completion.value!==null?(a.completion.value-b.completion.value)*100:null}});
 };
 const devices=breakdown('device'),sources=breakdown('source');
 const grouped=(rows,key,labels={})=>{const map=new Map();for(const r of rows){const k=typeof key==='function'?key(r):r[key];if(!k)continue;if(!map.has(k))map.set(k,[]);map.get(k).push(r)}return [...map].map(([id,items])=>({id,label:labels[id]||id,value:count(items.length,unique(items))})).sort((a,b)=>(b.value??-1)-(a.value??-1))};
 const stories=current.filter(r=>r.page==='story'),matureStories=stories.filter(r=>r.updated_at<cutoff);
 const depthGroups=rows=>grouped(rows,r=>r.depth<25?'before25':r.depth<50?'25to49':r.depth<75?'50to74':r.depth<90?'75to89':'90plus',{before25:'Before 25%', '25to49':'25–49%', '50to74':'50–74%', '75to89':'75–89%', '90plus':'90% or beyond'});
 const reasonNames={finished:'Finished what I needed',return_later:'Will return later',not_relevant:'Not relevant',too_long:'Too long',hard_to_read:'Hard to read',slow_or_broken:'Slow or broken',other:'Other'};
 const paths=reverse=>{
  const map=new Map();for(const [,rows] of matured){const reduced=rows.filter((r,i)=>!i||r.page!==rows[i-1].page||r.post_id!==rows[i-1].post_id);const labels=(reverse?[...reduced].reverse():reduced).slice(0,5).map(r=>r.page);const key=labels.join(' → ');if(!map.has(key))map.set(key,{nodes:labels,journeys:0});map.get(key).journeys++}
  return [...map.values()].filter(p=>p.journeys>=MIN).sort((a,b)=>b.journeys-a.journeys).slice(0,12);
 };
 const topMap=new Map();for(const r of stories){if(!r.title||!r.slug)continue;if(!topMap.has(r.post_id))topMap.set(r.post_id,[]);topMap.get(r.post_id).push(r)}
 const content=[...topMap].filter(([,rows])=>unique(rows)>=MIN).sort((a,b)=>b[1].length-a[1].length).slice(0,20).map(([id,rows])=>{
  const summary=aggregate(rows,range),old=aggregate(previous.filter(r=>r.post_id===id),range.previous||range),finished=rows.filter(r=>reached(r,90,range.to));
  return {title:rows[0].title,slug:rows[0].slug,...summary,changePoints:comparisonAvailable&&summary.completion.value!==null&&old.completion.value!==null?(summary.completion.value-old.completion.value)*100:null,elapsedTo90:unique(finished)>=MIN?quantile(finished.map(r=>(Date.parse(r.reached90_at)-Date.parse(r.started_at))/1000),.5):null,lastDepth:depthGroups(rows.filter(r=>r.updated_at<cutoff)),reasons:grouped(rows,'reason',reasonNames)};
 });
 const clockBins=Array.from({length:28},()=>[]);for(const row of stories){const d=new Date(Date.parse(row.started_at)+19800000);clockBins[((d.getUTCDay()+6)%7)*4+Math.floor(d.getUTCHours()/6)].push(row)}
 const clock=Array.from({length:7},(_,weekday)=>Array.from({length:4},(_,block)=>{
  const rows=clockBins[weekday*4+block];
  return {weekday,block,...aggregate(rows,range)};
 })).flat();
 const findings=[];
 if(!current.length)findings.push({level:'setup',title:'No observations in this selection',evidence:'Nothing to compare yet.',action:'Check dates and existing reader opt-in. No historical traffic is fabricated.'});
 else if((totals.journeys||0)<30)findings.push({level:'sample',title:'Not enough journeys for a stable comparison',evidence:'Use the withheld/sample labels before interpreting rates.',action:'Collect more consented traffic. Do not weaken the privacy threshold.'});
 for(const segment of devices){if(segment.completion.denominator>=30&&segment.changePoints!==null&&Math.abs(segment.changePoints)>=10&&comparisonAvailable)findings.push({level:'investigate',title:segment.label+' reading rate shifted',evidence:segment.changePoints.toFixed(1)+' percentage points versus the previous interval.',action:'Compare content mix and failure signals, then reproduce the page. This is a directional flag, not causal proof.'})}
 if(totals.failureRate.numerator>=5&&totals.failureRate.denominator>=30&&totals.failureRate.value>=.1)findings.push({level:'investigate',title:'Failure signals deserve inspection',evidence:totals.failureRate.numerator+' affected visits out of '+totals.failureRate.denominator+'.',action:'Reproduce requests and media on mobile. The signal contains no error text or personal input.'});
 if(!findings.length)findings.push({level:'observed',title:'No configured diagnostic rule fired',evidence:'Rules require 30 observations and privacy-safe counts.',action:'This is not an all-clear: review the content and paths panels and compare source/device segments.'});
 const pairedMetric=(id,label,key)=>({id,label,value:totals[key],previous:comparisonAvailable?prior[key]:null,suppressed:totals[key]===null,change:comparisonAvailable&&totals[key]!==null&&prior[key]>0?(totals[key]-prior[key])/prior[key]*100:null});
 const basic=store.all("SELECT date(occurred_at,'+330 minutes') day,type,count(*) n FROM analytics_events WHERE occurred_at>=? AND occurred_at<? AND type IN ('page_view','post_open','share') GROUP BY day,type ORDER BY day",range.from,range.to);
 return {source:'corner-first-party',generatedAt:now.toISOString(),range,metrics:[pairedMetric('visits','Consented page visits','visits'),pairedMetric('journeys','Recorded browser journeys','journeys'),pairedMetric('stories','Story visits','stories'),pairedMetric('reached90','Reached 90% + 10 seconds','completed'),pairedMetric('issues','Visits with failures','failures'),pairedMetric('median','Median active seconds','medianSeconds')],funnel,reading:[['Opened',stories.length],...[25,50,75,90].map(n=>[n+'% + 10 sec',stories.filter(r=>reached(r,n,range.to)).length])].map(([label,n])=>({label,value:count(n,unique(stories))})),lastDepth:depthGroups(matureStories),lastPages:grouped(matured.map(([,rows])=>rows.at(-1)),'page',{feed:'Feed',story:'Story'}),reasons:grouped(stories,'reason',reasonNames),failures:[{label:'Interaction request',value:count(current.filter(r=>r.request_failed).length,unique(current.filter(r=>r.request_failed)))},{label:'Image or video',value:count(current.filter(r=>r.media_failed).length,unique(current.filter(r=>r.media_failed)))}],devices:devices.map(r=>({label:r.label,value:r.visits})),sources:sources.map(r=>({label:r.label,value:r.journeys})),topStories:content.map(r=>({title:r.title,slug:r.slug,visits:r.visits,reached90:r.completed,activeSeconds:r.medianSeconds,stoppedBefore50:null})),
  basic:{events:basic.map(r=>({day:r.day,type:r.type,value:count(r.n)})),label:'Legacy basic counts; not the consented journey denominator',deviceFilterApplied:false},
  quality:{hasData:current.length>0,firstObservedAt:firstDate,privacyMinimum:MIN,rawRetentionDays:90,retentionLimited:range.retentionLimited,collection:'Existing first-party consent only. No new collector, tracking scope or Google transmission.',comparisonAvailable},
  warnings:['Journeys are short-lived browser tabs, not identified people.','Paths show observed page types, not full navigation, individual sessions or confirmed exits.','Time and depth snapshots describe selected visits as last received, not an as-of historical reconstruction. Milestone rates use only milestones before the range end.','95% Wilson intervals assume independent binomial trials; repeated visitors may violate this. Use for diagnostics, not causal claims or experiment decisions.','Minimum-five protections and complementary rate suppression are not differential privacy.','Missing, withheld, zero-observed and collection-disabled data are different states.'],
  nextActions:findings.map(f=>({evidence:f.evidence,action:f.action})),
  exploration:{version:2,filters:{source,entry},series,totals,devices,sources,funnels:{discovery:funnel,reading:readingFunnel},paths:{forward:paths(false),reverse:paths(true)},content,clock,findings,observedLast5m:count(new Set(current.filter(r=>Date.parse(r.updated_at)>=now.getTime()-300000).map(r=>r.journey_key)).size),collectionEnabled:process.env.CORNER_READING_ANALYTICS!=='0',scope:'Source, device and entry filters follow the first retained observation of each journey, with a 24-hour context window. Charts are visit-start cohorts; prior dates align by interval position.'}};
}
