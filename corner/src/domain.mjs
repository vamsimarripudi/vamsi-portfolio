import crypto from 'node:crypto';
export const TYPES=['wish','announcement','tech_note','journal','build','moment'];
export const CATEGORIES=['Latest','Wishes','Builds','Notes','Journal','Moments'];
export const REACTIONS=['❤️','👏','🔥','🎉'];
export const STATES=['draft','scheduled','published','archived'];
export const typeLabels={wish:'WISH',announcement:'ANNOUNCEMENT',tech_note:'TECH NOTE',journal:'JOURNAL',build:'BUILD',moment:'MOMENT'};
export const typeCategories={wish:'Wishes',announcement:'Latest',tech_note:'Notes',journal:'Journal',build:'Builds',moment:'Moments'};
export function uid(prefix='id'){return prefix+'_'+crypto.randomUUID();}
export const now=()=>new Date().toISOString();
export function slugify(s){return String(s||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/[\s-]+/g,'-').slice(0,90)||'update'}
export function pureText(input,max=20000){return String(input??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').trim().slice(0,max)}
export function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
export function parseTags(tags){if(Array.isArray(tags))return [...new Set(tags.map(t=>pureText(t,22)).filter(Boolean))].slice(0,6);return [...new Set(String(tags||'').split(',').map(t=>t.trim()).filter(Boolean))].slice(0,6)}
export function isValidTimeZone(tz){try{new Intl.DateTimeFormat('en',{timeZone:tz}).format();return true}catch{return false}}
const fmtCache=new Map();
function partsAt(date,tz){let fmt=fmtCache.get(tz);if(!fmt){fmt=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});fmtCache.set(tz,fmt)}return Object.fromEntries(fmt.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));}
const ymdhm=(p)=>(((p.year*13+p.month)*32+p.day)*24+p.hour)*60+p.minute;
export function zoneLocalToUtc(local,tz){
  if(!isValidTimeZone(tz))throw Error('Invalid timezone');
  const m=String(local).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if(!m)throw Error('Invalid local date/time');
  const [y,mo,d,h,mi]=m.slice(1).map(Number);
  const naive=Date.UTC(y,mo-1,d,h,mi);
  if(y<1970||y>2100||mo<1||mo>12||d<1||d>31||h>23||mi>59||new Date(Date.UTC(y,mo-1,d)).getUTCDate()!==d)throw Error('Invalid date');
  const target=ymdhm({year:y,month:mo,day:d,hour:h,minute:mi});
  // Bounded search covers all DST fold/gap policies; earliest matching instant wins.
  // On a missing hour, advance to the first valid local minute >= requested time.
  const candidates=[];let gap=null;
  for(let delta=-16*60;delta<=16*60;delta++){
    const epoch=naive+delta*60000, p=partsAt(new Date(epoch),tz),time=ymdhm(p);
    if(time===target)candidates.push(epoch);
    if(time>target && (!gap || time<gap.time || (time===gap.time && epoch<gap.epoch)))gap={time,epoch};
  }
  if(candidates.length)return new Date(Math.min(...candidates)).toISOString();
  if(gap)return new Date(gap.epoch).toISOString();
  throw Error('Cannot resolve requested local time');
}
export function nextYearly(month,day,clock,tz,after){
  const limit=new Date(after).getUTCFullYear()+10;
  for(let year=new Date(after).getUTCFullYear();year<=limit;year++){
    try{const candidate=zoneLocalToUtc(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${clock}`,tz);if(candidate>after)return candidate}catch{}
  }
  throw Error('Unable to schedule next recurrence');
}
export function statuses(post,nowDate=now()){
  const tags=[];
  if(post.featured)tags.push('FEATURED');
  else if(post.pinned)tags.push('PINNED');
  else if(post.milestone)tags.push('MILESTONE');
  else if(post.published_at&&Date.parse(nowDate)-Date.parse(post.published_at)<7*86400000)tags.push('LATEST');
  else if(post.published_at&&post.updated_at&&Date.parse(post.updated_at)-Date.parse(post.published_at)>86400000)tags.push('UPDATED');
  return tags.slice(0,1);
}
export function sha(value){return crypto.createHash('sha256').update(String(value)).digest('hex')}
export function secureEqual(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
export function encodeCursor(row){return Buffer.from(JSON.stringify([row.published_at,row.id])).toString('base64url')}
export function decodeCursor(s){try{let p=JSON.parse(Buffer.from(s||'','base64url').toString('utf8'));if(!Array.isArray(p)||p.length!==2||!/^\d{4}-/.test(p[0])||typeof p[1]!=='string')return null;return p}catch{return null}}
export function httpError(status,message,code='BAD_REQUEST'){const err=new Error(message);err.status=status;err.code=code;return err}
