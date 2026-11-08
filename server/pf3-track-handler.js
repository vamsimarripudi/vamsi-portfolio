import {createHmac,timingSafeEqual} from 'node:crypto';
import {json,query,requireOwner} from '../api/lib/track.js';

// Product events are an allowlisted operational summary, not an access path to customer records.
const TYPES=new Set(['settings.updated','message.drafted','message.approved','message.accepted','message.failed','message.uncertain','automation.granted','automation.revoked']);
const ROLES=new Set(['creator','freelancer','consultant','solo_business','agency','other']);
const KEYS=['eventId','eventType','occurredAt','role','schemaVersion','source','workspaceRef'].sort().join(',');
const PATTERN_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET=()=>process.env.PF3_TRACK_SHARED_SECRET||'';
export function validTrackPf3Envelope(body){
 return !!body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).sort().join(',')===KEYS&&
  body.schemaVersion===1&&body.source==='pakkafollow'&&PATTERN_UUID.test(body.eventId)&&
  TYPES.has(body.eventType)&&ROLES.has(body.role)&&/^[a-f0-9]{24}$/.test(body.workspaceRef)&&
  typeof body.occurredAt==='string'&&Number.isFinite(Date.parse(body.occurredAt))&&
  body.occurredAt===new Date(body.occurredAt).toISOString();
}
export function verifyTrackPf3Envelope(body,timestamp,signature,secret,now=Date.now()){
 const t=Number(timestamp);
 if(!validTrackPf3Envelope(body)||!Number.isSafeInteger(t)||Math.abs(now-t)>300000||
  typeof secret!=='string'||secret.length<32||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))return false;
 const expected=createHmac('sha256',secret).update(String(timestamp)+'.'+JSON.stringify(body)).digest();
 const actual=Buffer.from(signature,'hex');
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
async function ensureTable(db){
 await db`CREATE TABLE IF NOT EXISTS pf3_track_events(
  event_id uuid PRIMARY KEY,event_type text NOT NULL,role text NOT NULL,
  workspace_ref varchar(24) NOT NULL,occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
 )`;
 await db`CREATE INDEX IF NOT EXISTS pf3_track_events_recent ON pf3_track_events(received_at DESC,event_id DESC)`;
}
function error(res,status,code,message){return json(res,status,{ok:false,code,message});}
export async function ingestPf3Event(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return error(res,405,'METHOD_NOT_ALLOWED','POST required.');
 const secret=SECRET();
 if(secret.length<32)return error(res,503,'PF3_TRACK_DISABLED','Verified event ingestion is not configured.');
 if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')return error(res,415,'CONTENT_TYPE','JSON body required.');
 const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
 if(Buffer.byteLength(raw)>4096)return error(res,413,'EVENT_SIZE','Operational event is too large.');
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return error(res,400,'EVENT_JSON','Invalid event payload.');}
 if(!verifyTrackPf3Envelope(body,req.headers['x-pf3-timestamp'],req.headers['x-pf3-signature'],secret))
  return error(res,403,'EVENT_SIGNATURE','Signature, timestamp or event contract was not accepted.');
 try{
  const db=query();await ensureTable(db);
  const rows=await db`INSERT INTO pf3_track_events(event_id,event_type,role,workspace_ref,occurred_at)
   VALUES(${body.eventId},${body.eventType},${body.role},${body.workspaceRef},${body.occurredAt})
   ON CONFLICT(event_id) DO NOTHING RETURNING event_id`;
  return json(res,200,{ok:true,accepted:true,duplicate:rows.length===0});
 }catch(err){
  console.error('pf3.track.ingest.failed',{code:err?.code||'INTERNAL'});
  return error(res,503,'EVENT_STORE_UNAVAILABLE','Operational event ingestion is temporarily unavailable.');
 }
}
export async function readPf3Operations(req,res){
 if(req.method!=='GET')return error(res,405,'METHOD_NOT_ALLOWED','GET required.');
 const owner=await requireOwner(req,res);if(!owner)return;
 res.setHeader('Cache-Control','no-store');
 try{
  const db=query();
  const [rows,recent]=await Promise.all([
   db`SELECT count(*)::int AS events,
    count(*) FILTER (WHERE event_type='message.drafted')::int AS message_drafts,
    count(*) FILTER (WHERE event_type='message.accepted')::int AS provider_accepted,
    count(*) FILTER (WHERE event_type='message.failed')::int AS message_failed,
    count(*) FILTER (WHERE event_type='message.uncertain')::int AS delivery_uncertain,
    count(*) FILTER (WHERE event_type='automation.granted')::int AS grants_saved,
    max(received_at) AS last_received_at FROM pf3_track_events`,
   db`SELECT event_id,event_type,role,occurred_at,received_at FROM pf3_track_events ORDER BY received_at DESC LIMIT 40`
  ]);
  return json(res,200,{ok:true,connected:true,source:'signed_pakkafollow_outbox',
   asOf:new Date().toISOString(),metrics:rows[0],events:recent,
   revenue:{status:'unavailable',amountMinor:null,reason:'Requires separately reconciled subscription and refund ledgers.'},
   invoices:{status:'unavailable',count:null,reason:'Customer invoices are not PakkaFollow platform revenue.'}});
 }catch(err){
  if(err?.code==='42P01')return json(res,200,{ok:true,connected:false,source:'awaiting_verified_events',
   asOf:new Date().toISOString(),metrics:null,events:[],
   revenue:{status:'unavailable',amountMinor:null},invoices:{status:'unavailable',count:null}});
  console.error('pf3.track.read.failed',{code:err?.code||'INTERNAL'});
  return error(res,503,'TRACK_EVENTS_UNAVAILABLE','Operational reporting is unavailable; no zero-activity assumption was made.');
 }
}
