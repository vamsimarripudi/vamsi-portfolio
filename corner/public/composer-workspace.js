/* Small, dependency-free helpers for the private Corner composer. */
(()=>{
  'use strict';
  const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
  const characters=value=>segmenter?[...segmenter.segment(String(value||''))].map(part=>part.segment):Array.from(String(value||''));
  const short=(value,length)=>characters(value).slice(0,length).join('');
  const summary=body=>short(String(body||'').replace(/\s+/gu,' ').trim(),280);
  const title=body=>{
    const first=String(body||'').trim().split(/\r?\n/u).map(line=>line.trim()).find(Boolean)||'';
    const sentence=first.replace(/^(?:>\s*|#{1,6}\s+)/u,'').split(/(?<=[.!?।])\s+/u)[0].replace(/[.!?।]+$/u,'');
    if(!sentence)return 'A moment in pictures';
    // Keep combining marks and joined emoji together when shortening a title.
    if(characters(sentence).length<=95&&sentence.length<=145)return sentence;
    let clipped=short(sentence,90);
    while(clipped.length>140)clipped=characters(clipped).slice(0,-1).join('');
    const boundary=clipped.lastIndexOf(' ');
    if(boundary>clipped.length*.6)clipped=clipped.slice(0,boundary);
    return clipped.trimEnd()+'…';
  };
  const type=(body,mediaCount=0)=>{
    const text=String(body||'').trim().toLowerCase();
    if(/\b(birthday|congratulations|festival|celebrate|anniversary|best wishes)\b|పుట్టిన\s*రోజు|శుభాకాంక్ష|जन्मदिन|शुभकामना/u.test(text))return 'wish';
    if(/\b(shipped|launched|building|release|programming|developer|project|api|code|product)\b/u.test(text))return 'build';
    if(characters(text).length>650)return 'journal';
    if(mediaCount>0||/\b(photo|picture|rain|sunset|moment|beautiful sky|video|photograph)\b/u.test(text))return 'moment';
    return 'tech_note';
  };
  const validZone=zone=>{try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();return zone}catch{return 'Asia/Kolkata'}};
  const localInput=(date,zone='Asia/Kolkata')=>{
    if(!date||!Number.isFinite(new Date(date).getTime()))return '';
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:validZone(zone),hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(date)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    return parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;
  };
  const selectedTime=(local,zone='Asia/Kolkata')=>{
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(local)))return 'Choose a date and time.';
    // This is a label for already-local fields, not a local-to-UTC conversion.
    const display=new Intl.DateTimeFormat('en-IN',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(local+'Z'));
    return display+' · '+validZone(zone);
  };
  const scheduledTime=(date,zone='Asia/Kolkata')=>{
    if(!date||!Number.isFinite(new Date(date).getTime()))return '';
    return new Intl.DateTimeFormat('en-IN',{timeZone:validZone(zone),day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(date))+' · '+validZone(zone);
  };
  const requestId=()=>{
    if(typeof crypto?.randomUUID==='function')return crypto.randomUUID();
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
    return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  };
  const recovery=(ownerId,storage)=>{
    const prefix=ownerId?'corner:studio:draft:'+encodeURIComponent(ownerId)+':':null;
    const key=id=>prefix+(id||'new');
    const remove=id=>{if(!prefix)return;try{storage.removeItem(key(id))}catch{ /* Device storage can be disabled. */ }};
    return Object.freeze({
      read(id){
        if(!prefix)return null;
        try{
          const value=JSON.parse(storage.getItem(key(id))||'null');
          if(!value||typeof value!=='object'||!value.source||typeof value.source.body!=='string'||value.source.body.length>25000||!Number.isFinite(value.savedAt)||Date.now()-value.savedAt>7*86400000){remove(id);return null}
          return value;
        }catch{return null}
      },
      write(id,value){
        if(!prefix)return false;
        try{storage.setItem(key(id),JSON.stringify({...value,savedAt:Date.now()}));return true}catch{return false}
      },
      remove,
      clear(){if(!prefix)return;try{const keys=[];for(let i=0;i<storage.length;i++){const name=storage.key(i);if(name?.startsWith(prefix))keys.push(name)}for(const name of keys)storage.removeItem(name)}catch{ /* Sign-out remains available without device storage. */ }}
    });
  };
  window.CornerComposer=Object.freeze({title,summary,type,localInput,selectedTime,scheduledTime,requestId,recovery});
})();
