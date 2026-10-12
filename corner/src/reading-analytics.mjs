import {createHmac} from 'node:crypto';
import {httpError} from './domain.mjs';

const DAY=86400000,MINIMUM=5,RETENTION=90;
export const READING_CONSENT='corner_reading_consent';
export const READING_ACTIONS=['','story_click','react','share','comment_start','comment_success'];
export const READING_ISSUES=['','request_failed','media_failed'];
export const READING_REASONS=['','finished','return_later','not_relevant','too_long','hard_to_read','slow_or_broken','other'];
const uuid=/^[a-f0-9]{32}$/;
const dateOK=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const shift=(date,days)=>new Date(Date.parse(date)+days*DAY).toISOString().slice(0,10);
export function readingRange(input={},now=new Date()){
 const allowed=['range','start','end','device','compare'];
 if(Object.keys(input).some(k=>!allowed.includes(k))||Object.values(input).some(v=>typeof v!=='string'||v.length>16))throw httpError(400,'Invalid analytics filters.','INVALID_RANGE');
 const today=new Date(now.getTime()+330*60000).toISOString().slice(0,10),preset=input.range||'28d';
 if(!['today','7d','28d','90d','custom'].includes(preset)||!['all','mobile','tablet','desktop'].includes(input.device||'all')||!['previous','none'].includes(input.compare||'previous'))throw httpError(400,'Choose supported analytics filters.','INVALID_RANGE');
 const end=preset==='custom'?input.end:preset==='today'?today:shift(today,-1);
 const start=preset==='custom'?input.start:preset==='today'?today:shift(end,1-parseInt(preset));
 if(!dateOK(start)||!dateOK(end)||start>end||end>today)throw httpError(400,'Enter valid inclusive dates, not in the future.','INVALID_RANGE');
 const days=(Date.parse(end)-Date.parse(start))/DAY+1;
 if(days>RETENTION)throw httpError(400,'Select 90 days or fewer.','INVALID_RANGE');
 const bounds=(s,e)=>({start:s,end:e,from:new Date(Date.parse(s)-330*60000).toISOString(),to:new Date(Date.parse(e)+DAY-330*60000).toISOString()});
 return {...bounds(start,end),preset,days,device:input.device||'all',timeZone:'Asia/Kolkata',partial:end===today,
  previous:(input.compare||'previous')==='none'?null:bounds(shift(start,-days),shift(start,-1)),retentionLimited:Date.parse(start)<now.getTime()-RETENTION*DAY};
}
export function normalizeReading(payload){
 const keys=['v','view','journey','page','post','device','source','depth','activeMs','action','issue','reason'];
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(k=>!keys.includes(k)))throw httpError(400,'Unsupported reading payload.','INVALID_READING');
 const p={action:'',issue:'',reason:'',...payload};
 if(p.v!==1||typeof p.view!=='string'||typeof p.journey!=='string'||!uuid.test(p.view)||!uuid.test(p.journey)||!['feed','story'].includes(p.page)||!['mobile','tablet','desktop'].includes(p.device)||!['direct','internal','search','social','referral'].includes(p.source)||![0,25,50,75,90].includes(p.depth)||!Number.isInteger(p.activeMs)||p.activeMs<0||p.activeMs>1800000||!READING_ACTIONS.includes(p.action)||!READING_ISSUES.includes(p.issue)||!READING_REASONS.includes(p.reason))throw httpError(400,'Invalid reading signal.','INVALID_READING');
 if(p.page==='story'?!/^post_[a-f0-9-]{36}$/i.test(p.post||''):p.post!==null)throw httpError(400,'Invalid public content.','INVALID_READING');
 if(p.page==='feed'&&(p.depth!==0||p.reason||['react','share','comment_start','comment_success'].includes(p.action)))throw httpError(400,'Signal does not match the page.','INVALID_READING');
 return p;
}
export class ReadingAnalytics{
 constructor(store,{secret,clock=()=>new Date()}={}){
  if(!secret)throw Error('Reading analytics needs the existing server secret.');
  this.store=store;this.clock=clock;this.secret=secret;
  // Additive, idempotent table. No existing content or analytics tables are replaced.
  store.db.exec(`CREATE TABLE IF NOT EXISTS reading_views(
   view_key TEXT PRIMARY KEY,journey_key TEXT NOT NULL,page TEXT NOT NULL CHECK(page IN ('feed','story')),post_id TEXT,
   device TEXT NOT NULL,source TEXT NOT NULL,started_at TEXT NOT NULL,updated_at TEXT NOT NULL,
   depth INTEGER NOT NULL DEFAULT 0,active_ms INTEGER NOT NULL DEFAULT 0,
   reached25_at TEXT,reached50_at TEXT,reached75_at TEXT,reached90_at TEXT,engaged_at TEXT,
   story_click INTEGER NOT NULL DEFAULT 0,reacted INTEGER NOT NULL DEFAULT 0,shared INTEGER NOT NULL DEFAULT 0,
   comment_started INTEGER NOT NULL DEFAULT 0,comment_success INTEGER NOT NULL DEFAULT 0,
   request_failed INTEGER NOT NULL DEFAULT 0,media_failed INTEGER NOT NULL DEFAULT 0,reason TEXT NOT NULL DEFAULT ''
  );CREATE INDEX IF NOT EXISTS idx_reading_started ON reading_views(started_at);
  CREATE INDEX IF NOT EXISTS idx_reading_journey ON reading_views(journey_key,started_at);
  CREATE INDEX IF NOT EXISTS idx_reading_updated ON reading_views(updated_at);CREATE TABLE IF NOT EXISTS reading_revocations(journey_key TEXT PRIMARY KEY,expires_at TEXT NOT NULL);`);
 }
 key(token){return createHmac('sha256',this.secret).update('reading-v1:'+token).digest('hex')}
 forget(journey){if(typeof journey!=='string'||!uuid.test(journey))throw httpError(400,'Invalid reading preference request.');return this.store.transaction(()=>{this.store.exec('INSERT INTO reading_revocations(journey_key,expires_at) VALUES(?,?) ON CONFLICT(journey_key) DO UPDATE SET expires_at=excluded.expires_at',this.key(journey),new Date(this.clock().getTime()+25*3600000).toISOString());this.store.exec('DELETE FROM reading_views WHERE journey_key=?',this.key(journey));return {accepted:true}})}
 collect(payload){
  const p=normalizeReading(payload),at=this.clock().toISOString(),view=this.key(p.view),journey=this.key(p.journey);
  if(p.post&&!this.store.one("SELECT id FROM posts WHERE id=? AND state='published'",p.post))throw httpError(400,'Only published content can be measured.','INVALID_READING');
  return this.store.transaction(()=>{
   if(this.store.one('SELECT journey_key FROM reading_revocations WHERE journey_key=? AND expires_at>?',journey,at))return {accepted:false};
   const prior=this.store.one('SELECT * FROM reading_views WHERE view_key=?',view);
   if(prior&&(prior.journey_key!==journey||prior.page!==p.page||prior.post_id!==p.post))throw httpError(409,'Reading context changed.','READING_CONFLICT');
   if(prior&&Date.parse(at)-Date.parse(prior.started_at)>DAY)throw httpError(409,'Reading visit expired.','READING_EXPIRED');
   if(!prior){
    // Protect the local volume even when an attacker generates arbitrary client IDs.
    const cutoff=new Date(this.clock().getTime()-DAY).toISOString();
    if(this.store.one('SELECT count(*) n FROM reading_views').n>=100000||this.store.one('SELECT count(*) n FROM reading_views WHERE started_at>=?',cutoff).n>=10000)return {accepted:false,reason:'capacity'};
    this.store.exec('INSERT INTO reading_views(view_key,journey_key,page,post_id,device,source,started_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',view,journey,p.page,p.post,p.device,p.source,at,at);
   }
   const active=Math.min(p.activeMs,Math.max(0,Date.parse(at)-Date.parse(prior?.started_at||at)),1800000);
   const depth=Math.max(prior?.depth||0,p.depth),ms=Math.max(prior?.active_ms||0,active);
   const reached=level=>p.page==='story'&&depth>=level&&ms>=10000?at:null;
   const engaged=['react','share','comment_success'].includes(p.action)?at:null;
   this.store.exec(`UPDATE reading_views SET updated_at=?,depth=?,active_ms=?,
    reached25_at=coalesce(reached25_at,?),reached50_at=coalesce(reached50_at,?),reached75_at=coalesce(reached75_at,?),reached90_at=coalesce(reached90_at,?),
    engaged_at=coalesce(?,engaged_at),story_click=max(story_click,?),reacted=max(reacted,?),shared=max(shared,?),comment_started=max(comment_started,?),comment_success=max(comment_success,?),
    request_failed=max(request_failed,?),media_failed=max(media_failed,?),reason=CASE WHEN ?='' THEN reason ELSE ? END WHERE view_key=?`,
    at,depth,ms,reached(25),reached(50),reached(75),reached(90),engaged,Number(p.action==='story_click'),Number(p.action==='react'),Number(p.action==='share'),Number(p.action==='comment_start'),Number(p.action==='comment_success'),Number(p.issue==='request_failed'),Number(p.issue==='media_failed'),p.reason,p.reason,view);
   return {accepted:true};
  });
 }
 report(actor,input={}){
  if(actor?.role!=='owner')throw httpError(403,'Owner permissions required.','OWNER_REQUIRED');
  const now=this.clock(),range=readingRange(input,now),cutoff=new Date(now.getTime()-30*60000).toISOString();
  const query=(r,extra='')=>this.store.all(`SELECT page,post_id,device,source,depth,active_ms,started_at,updated_at,reached25_at,reached50_at,reached75_at,reached90_at,engaged_at,story_click,reacted,shared,comment_started,comment_success,request_failed,media_failed,reason,journey_key,view_key FROM reading_views WHERE started_at>=? AND started_at<? AND (?='all' OR device=?) ${extra} ORDER BY started_at LIMIT 50001`,r.from,r.to,range.device,range.device);
  const current=query(range),previous=range.previous?query(range.previous):null;
  if(current.length>50000||(previous&&previous.length>50000))throw httpError(413,'Select a shorter period or a device to keep the report accurate.','REPORT_TOO_LARGE');
  const safe=n=>n>0&&n<MINIMUM?null:n;
  const metrics=rows=>{const stories=rows.filter(r=>r.page==='story'),mature=stories.filter(r=>r.updated_at<cutoff);return [
   ['visits','Consented page visits',rows.length],['journeys','Recorded browser journeys',new Set(rows.map(r=>r.journey_key)).size],['stories','Story visits',stories.length],['reached90','Reached 90% + 10 seconds',stories.filter(r=>r.reached90_at).length],['inactive','Inactive story visits',mature.length],['issues','Visits with reported failures',rows.filter(r=>r.request_failed||r.media_failed).length]]};
  const prior=previous?Object.fromEntries(metrics(previous).map(([key,,n])=>[key,n])):{};
  const cards=metrics(current).map(([id,label,n])=>({id,label,value:safe(n),previous:previous?.length?safe(prior[id]):null,suppressed:n>0&&n<MINIMUM,change:previous&&n>=MINIMUM&&prior[id]>=MINIMUM?(n-prior[id])/prior[id]*100:null}));
  // Ordered, closed funnel: cohort starts with its first feed visit in this range.
  // A prior-range page with the same journey key is excluded from this cohort.
  const byJourney=new Map();for(const row of current){if(!byJourney.has(row.journey_key))byJourney.set(row.journey_key,[]);byJourney.get(row.journey_key).push(row)}
  const before=new Set(this.store.all('SELECT DISTINCT journey_key FROM reading_views WHERE started_at<? AND started_at>=?',range.from,new Date(Date.parse(range.from)-DAY).toISOString()).map(r=>r.journey_key));
  const stages=[0,0,0,0];let activeJourneys=0;
  for(const [id,rows] of byJourney){
   if(before.has(id)||rows[0].page!=='feed')continue;
   if(rows.some(r=>r.updated_at>=cutoff)){activeJourneys++;continue}
   stages[0]++;const story=rows.find(r=>r.page==='story'&&r.started_at>=rows[0].started_at);if(!story)continue;stages[1]++;
   const completed=rows.find(r=>r.page==='story'&&r.reached90_at);if(!completed)continue;stages[2]++;
   if(rows.some(r=>r.view_key===completed.view_key&&r.engaged_at&&r.engaged_at>=completed.reached90_at))stages[3]++;
  }
  const suppressFunnel=stages.some(n=>n>0&&n<MINIMUM)||stages.slice(1).some((n,i)=>stages[i]-n>0&&stages[i]-n<MINIMUM);
  const funnel=['Feed visit','Open a story','Reach 90% + 10 seconds','React, share or comment after reading'].map((label,i)=>({label,value:suppressFunnel?null:stages[i],drop:i===3||suppressFunnel?null:stages[i]-stages[i+1],rate:i===3||suppressFunnel||!stages[i]?null:stages[i+1]/stages[i]}));
  const group=(rows,key,labels={})=>{const counts=new Map();for(const row of rows){const k=typeof key==='function'?key(row):row[key];if(k)counts.set(k,(counts.get(k)||0)+1)}return [...counts].map(([id,n])=>({id,label:labels[id]||id,value:safe(n),suppressed:n<MINIMUM})).sort((a,b)=>(b.value??-1)-(a.value??-1))};
  const stories=current.filter(r=>r.page==='story'),mature=stories.filter(r=>r.updated_at<cutoff);
  const depth=level=>stories.filter(r=>r['reached'+level+'_at']).length;
  const reading=[['Opened',stories.length],['25% + 10 sec',depth(25)],['50% + 10 sec',depth(50)],['75% + 10 sec',depth(75)],['90% + 10 sec',depth(90)]].map(([label,n])=>({label,value:safe(n)}));
  const lastDepth=group(mature,r=>r.depth<25?'before25':r.depth<50?'25to49':r.depth<75?'50to74':r.depth<90?'75to89':'90plus',{before25:'Before 25%', '25to49':'25–49%', '50to74':'50–74%', '75to89':'75–89%', '90plus':'90% or beyond'});
  const reasons=group(stories,'reason',{finished:'Finished what I needed',return_later:'Will return later',not_relevant:'Not relevant',too_long:'Too long',hard_to_read:'Hard to read',slow_or_broken:'Slow or broken',other:'Other / not specified'});
  const latest=new Map();for(const rows of byJourney.values()){const sorted=[...rows].sort((a,b)=>b.updated_at.localeCompare(a.updated_at));if(sorted[0].updated_at<cutoff)latest.set(sorted[0].journey_key,sorted[0])}
  const lastPages=group([...latest.values()],'page',{feed:'Feed / category',story:'Story'});
  const failures=[['Failed interaction',current.filter(r=>r.request_failed).length],['Failed image or video',current.filter(r=>r.media_failed).length]].map(([label,n])=>({label,value:safe(n)}));
  const postGroups=new Map();for(const row of stories){if(!postGroups.has(row.post_id))postGroups.set(row.post_id,[]);postGroups.get(row.post_id).push(row)}
  const top=[...postGroups].filter(([,r])=>r.length>=MINIMUM).sort((a,b)=>b[1].length-a[1].length).slice(0,10).flatMap(([id,rows])=>{const post=this.store.one("SELECT title,slug FROM posts WHERE id=? AND state='published'",id);return post?[{title:post.title,slug:post.slug,visits:rows.length,reached90:safe(rows.filter(r=>r.reached90_at).length),activeSeconds:Math.round(rows.reduce((n,r)=>n+r.active_ms,0)/rows.length/1000),inactive:safe(rows.filter(r=>r.updated_at<cutoff).length),stoppedBefore50:safe(rows.filter(r=>r.updated_at<cutoff&&r.depth<50).length)}]:[]});
  const basic=this.store.all("SELECT date(occurred_at,'+330 minutes') day,type,count(*) n FROM analytics_events WHERE occurred_at>=? AND occurred_at<? AND type IN ('page_view','post_open','share') GROUP BY day,type ORDER BY day",range.from,range.to);
  const earliest=this.store.one('SELECT min(started_at) at FROM reading_views').at;
  const result={source:'corner-first-party',generatedAt:now.toISOString(),range,metrics:cards,funnel:{steps:funnel,suppressed:suppressFunnel,activeJourneys:safe(activeJourneys),definition:'Ordered feed-entry journeys inactive for 30 minutes; completed reading and engagement must be on the same story. Direct story arrivals are not feed entrants.'},reading,lastDepth,lastPages,reasons,failures,devices:group(current,'device'),sources:group([...byJourney.values()].map(rows=>rows[0]),'source'),topStories:top,
   basic:{label:'Existing basic event counts — not unique readers and not the consented funnel denominator',events:basic.map(r=>({day:r.day,type:r.type,value:safe(r.n)})),deviceFilterApplied:false},
   quality:{firstObservedAt:earliest,privacyMinimum:MINIMUM,rawRetentionDays:RETENTION,collection:'Optional first-party reading measurement; off until the reader opts in.',retentionLimited:range.retentionLimited||!!(range.previous&&Date.parse(range.previous.from)<now.getTime()-RETENTION*DAY),hasData:current.length>0},
   warnings:['A last observation is not proof of an exit or its cause. Tab closes, blockers and network loss can hide later activity.','Reaching a depth and spending visible active time does not prove comprehension.','Browser journeys are short-lived tab identifiers, not people or cross-device users.','Below-five segments are withheld. These reports are not a formal differential-privacy guarantee.','Google Analytics and first-party counts use different collection rules. Do not add them together.','Consent choices, request limits and storage caps can reduce the observed sample. An unavailable comparison is not proof of zero historical visitors.'],nextActions:[]};
  if(!current.length)result.nextActions.push({evidence:'No consented reading observations in this range.',action:'Check the selected dates and reader opt-in flow; never replace missing data with estimated traffic.'});
  else if(stages[0]<20)result.nextActions.push({evidence:'Insufficient completed feed-entry journeys for a stable bottleneck recommendation.',action:'Collect more consented journeys; inspect individual layout/error tests rather than drawing a causal conclusion.'});
  else if(!suppressFunnel){const drops=funnel.slice(0,3).filter(s=>s.value>=20).sort((a,b)=>b.drop/b.value-a.drop/a.value);if(drops[0])result.nextActions.push({evidence:`Largest observed attrition: ${drops[0].label} (${drops[0].drop} of ${drops[0].value}).`,action:'Treat this as a hypothesis. Compare devices and reader feedback, reproduce errors, and test a targeted change.'})}
  return result;
 }
}
