import {httpError} from './domain.mjs';

export class V3Insights{
 constructor(store,{env=process.env,clock=()=>new Date()}={}){
  this.store=store;this.env=env;this.clock=clock;
 }
 enabled(){return this.env.CORNER_V3_INSIGHTS==='1'}
 requireOwner(actor){
  if(!this.enabled())throw httpError(404,'Insights unavailable.','FEATURE_DISABLED');
  if(actor?.role!=='owner')throw httpError(403,'Owner permissions required.','OWNER_REQUIRED');
 }
 summary(actor,{days=7}={}){
  this.requireOwner(actor);
  const span=Number(days);
  if(![7,30,90].includes(span))throw httpError(400,'Choose a valid reporting period.','INVALID_PERIOD');
  const end=this.clock(),start=new Date(end.getTime()-span*86400000).toISOString();
  if(!Number.isFinite(end.getTime()))throw Error('Invalid reporting clock');
  const observed=this.store.all("SELECT type,COUNT(*) AS n FROM analytics_events WHERE occurred_at>=? AND occurred_at<=? GROUP BY type",start,end.toISOString());
  const counts=Object.fromEntries(observed.map(x=>[x.type,x.n]));
  const trend=this.store.all("SELECT substr(occurred_at,1,10) AS day,COUNT(*) n FROM analytics_events WHERE occurred_at>=? AND occurred_at<=? GROUP BY substr(occurred_at,1,10) ORDER BY day ASC",start,end.toISOString());
  const ranked=this.store.all("SELECT p.slug,p.title,COUNT(*) n FROM analytics_events a JOIN posts p ON p.id=a.post_id WHERE a.type='post_open' AND a.occurred_at>=? AND a.occurred_at<=? AND p.state='published' GROUP BY p.id HAVING COUNT(*)>=5 ORDER BY n DESC,p.slug LIMIT 8",start,end.toISOString());
  const referrers=this.store.all("SELECT referrer_class category,COUNT(*) n FROM analytics_events WHERE occurred_at>=? AND occurred_at<=? AND referrer_class IS NOT NULL GROUP BY referrer_class HAVING COUNT(*)>=5 ORDER BY n DESC LIMIT 5",start,end.toISOString());
  return {
   window:{days:span,from:start.slice(0,10),to:end.toISOString().slice(0,10)},
   totals:{pageViews:counts.page_view||0,storyOpens:counts.post_open||0,shares:counts.share||0,recordedEvents:observed.reduce((n,r)=>n+r.n,0)},
   daily:trend.map(x=>({day:x.day,events:x.n>=5?x.n:null,suppressed:x.n<5})),
   topPublishedStories:ranked.map(x=>({slug:x.slug,title:x.title,opens:x.n})),
   referrerGroups:referrers.map(x=>({category:x.category,n:x.n})),
   privacy:{firstPartyOnly:true,individualSessionsExposed:false,smallSegmentMinimum:5,rawRetentionDays:90}
  };
 }
}
