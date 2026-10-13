import {createHmac} from 'node:crypto';
import {query,TrackError} from '../api/lib/track.js';
import {validateWebsiteSignal} from '../public/site-analytics-contract.mjs';
export const WEBSITE_SCHEMA = [
 `CREATE TABLE IF NOT EXISTS site_analytics_views (
 view_key text PRIMARY KEY CHECK(length(view_key)=64),journey_key text NOT NULL CHECK(length(journey_key)=64),path text NOT NULL,device text NOT NULL,source text NOT NULL,
 started_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,depth integer NOT NULL DEFAULT 0 CHECK(depth IN (0,25,50,75,90)),active_ms integer NOT NULL DEFAULT 0 CHECK(active_ms BETWEEN 0 AND 1800000),section text NOT NULL DEFAULT 'main',
 engaged_at timestamptz,contact_start_at timestamptz,contact_success_at timestamptz,contact_failed boolean NOT NULL DEFAULT false,resume_click boolean NOT NULL DEFAULT false,profile_click boolean NOT NULL DEFAULT false,request_failed boolean NOT NULL DEFAULT false,media_failed boolean NOT NULL DEFAULT false)`,
 'CREATE INDEX IF NOT EXISTS site_analytics_started ON site_analytics_views(started_at)',
 'CREATE INDEX IF NOT EXISTS site_analytics_journey ON site_analytics_views(journey_key,started_at)',
 'CREATE TABLE IF NOT EXISTS site_analytics_revocations (journey_key text PRIMARY KEY,expires_at timestamptz NOT NULL)',
 'CREATE TABLE IF NOT EXISTS site_analytics_limits (key text PRIMARY KEY,n integer NOT NULL,expires_at timestamptz NOT NULL)'
];
let schemaPromise;
export function websiteDatabase(){return query()}
export function websiteSecret(){const secret=process.env.TRACK_SESSION_SECRET;if(!secret)throw new TrackError(503,'Website measurement is unavailable.','WEBSITE_UNAVAILABLE');return secret}
export const websiteHash=(token,secret)=>createHmac('sha256',secret).update('website-v1:'+token).digest('hex');
export async function ensureWebsiteSchema(sql=websiteDatabase(),isolated=false){
 const run=()=>sql.transaction(WEBSITE_SCHEMA.map(text=>sql.query(text,[])));
 if(isolated)return run();
 if(!schemaPromise)schemaPromise=run().catch(error=>{schemaPromise=null;throw error});return schemaPromise;
}
export async function limitWebsite(sql,key,now=new Date(),limit=60,seconds=60){
 const bucket=Math.floor(now.getTime()/(seconds*1000)),expires=new Date((bucket+2)*seconds*1000).toISOString();
 const rows=await sql.query('INSERT INTO site_analytics_limits(key,n,expires_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET n=site_analytics_limits.n+1 WHERE site_analytics_limits.n<$3 RETURNING n',[key+':'+bucket,expires,limit]);
 if(!rows.length)throw new TrackError(429,'Website measurement is rate limited.','WEBSITE_RATE_LIMIT');
}
export async function collectWebsite(body,{sql=websiteDatabase(),secret=websiteSecret(),now=new Date()}={}){
 const p=validateWebsiteSignal(body),view=websiteHash(p.view,secret),journey=websiteHash(p.journey,secret),at=now.toISOString();
 const results=await sql.transaction([
  sql.query("SELECT pg_advisory_xact_lock(hashtext('website-capacity-v1'))",[]),
  sql.query('SELECT pg_advisory_xact_lock(hashtext($1))',[journey]),
  sql.query(`INSERT INTO site_analytics_views(view_key,journey_key,path,device,source,started_at,updated_at,depth,active_ms,section,contact_start_at,contact_success_at,contact_failed,resume_click,profile_click,request_failed,media_failed)
   SELECT $1,$2,$3,$4,$5,$6,$6,$7,0,$8,CASE WHEN $9='contact_start' THEN $6::timestamptz END,CASE WHEN $9='contact_success' THEN $6::timestamptz END,$9='contact_failed',$9='resume_click',$9='profile_click',$10='request_failed',$10='media_failed'
   WHERE NOT EXISTS(SELECT 1 FROM site_analytics_revocations WHERE journey_key=$2 AND expires_at>$6)
   AND (EXISTS(SELECT 1 FROM site_analytics_views WHERE view_key=$1) OR (SELECT count(*) FROM site_analytics_views)<100000)
   ON CONFLICT(view_key) DO UPDATE SET updated_at=GREATEST(site_analytics_views.updated_at,excluded.updated_at),depth=GREATEST(site_analytics_views.depth,excluded.depth),
    active_ms=GREATEST(site_analytics_views.active_ms,LEAST($11,GREATEST(0,EXTRACT(EPOCH FROM ($6::timestamptz-site_analytics_views.started_at))*1000)::int)),
    section=CASE WHEN excluded.updated_at>=site_analytics_views.updated_at THEN excluded.section ELSE site_analytics_views.section END,
    engaged_at=COALESCE(site_analytics_views.engaged_at,CASE WHEN $11>=10000 AND $6::timestamptz-site_analytics_views.started_at>=INTERVAL '10 seconds' THEN $6::timestamptz END),
    contact_start_at=COALESCE(site_analytics_views.contact_start_at,excluded.contact_start_at),contact_success_at=COALESCE(site_analytics_views.contact_success_at,excluded.contact_success_at),
    contact_failed=site_analytics_views.contact_failed OR excluded.contact_failed,resume_click=site_analytics_views.resume_click OR excluded.resume_click,profile_click=site_analytics_views.profile_click OR excluded.profile_click,
    request_failed=site_analytics_views.request_failed OR excluded.request_failed,media_failed=site_analytics_views.media_failed OR excluded.media_failed
   WHERE site_analytics_views.journey_key=excluded.journey_key AND site_analytics_views.path=excluded.path AND site_analytics_views.device=excluded.device AND $6::timestamptz-site_analytics_views.started_at<INTERVAL '24 hours'
   RETURNING view_key`,[view,journey,p.path,p.device,p.source,at,p.depth,p.section,p.action,p.issue,p.activeMs])
 ]);
 return {accepted:results[2].length===1};
}
export async function revokeWebsite(token,{sql=websiteDatabase(),secret=websiteSecret(),now=new Date()}={}){
 if(typeof token!=='string'||!/^[a-f0-9]{32}$/.test(token))throw new TrackError(400,'Invalid preference request.','WEBSITE_INVALID');
 const key=websiteHash(token,secret);
 await sql.transaction([sql.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]),sql.query('INSERT INTO site_analytics_revocations(journey_key,expires_at) VALUES($1,$2) ON CONFLICT(journey_key) DO UPDATE SET expires_at=excluded.expires_at',[key,new Date(now.getTime()+25*3600000).toISOString()]),sql.query('DELETE FROM site_analytics_views WHERE journey_key=$1',[key])]);return {accepted:true};
}
export async function cleanupWebsite(sql=websiteDatabase()){
 await ensureWebsiteSchema(sql);
 return sql.transaction([sql.query("DELETE FROM site_analytics_views WHERE started_at<NOW()-INTERVAL '90 days'",[]),sql.query('DELETE FROM site_analytics_revocations WHERE expires_at<NOW()',[]),sql.query('DELETE FROM site_analytics_limits WHERE expires_at<NOW()',[])]);
}
