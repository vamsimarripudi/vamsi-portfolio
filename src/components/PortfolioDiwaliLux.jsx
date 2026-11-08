import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isDiwali2026Active, nextDiwali2026Boundary } from '../festivals/diwali2026.js';
import './PortfolioDiwaliLux.css';

const SEEN_KEY = 'vm_diwali_2026_lux_intro_seen';
const REDUCED = '(prefers-reduced-motion: reduce)';
const GOLD = ['#ffe4a2','#ffb75e','#fcd283','#ffefc1','#d88a42'];
const FIRE_COLORS = ['#f6c56b','#ff89a7','#c9a0ff','#86b8f7','#f99d56','#fff0bd'];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

function useToday(){
  const [active,setActive] = useState(false);
  useEffect(()=>{
    let timer = 0;
    const check = ()=>{
      setActive(isDiwali2026Active());
      if(timer) clearTimeout(timer);
      const next = nextDiwali2026Boundary();
      if(next !== null) timer = setTimeout(check,Math.max(1,next-Date.now()+20));
    };
    check();
    document.addEventListener('visibilitychange',check);
    window.addEventListener('pageshow',check);
    window.addEventListener('focus',check);
    return ()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',check);
      window.removeEventListener('pageshow',check);window.removeEventListener('focus',check);};
  },[]);
  return active;
}
function Toranam(){
  const points = [100,300,500,700,900,1100];
  const front = 'M0 8 Q100 74 200 8 Q300 74 400 8 Q500 74 600 8 Q700 74 800 8 Q900 74 1000 8 Q1100 74 1200 8';
  const back = 'M0 14 Q100 47 200 14 Q300 47 400 14 Q500 47 600 14 Q700 47 800 14 Q900 47 1000 14 Q1100 47 1200 14';
  return <svg viewBox="0 0 1200 132" preserveAspectRatio="none" className="vm-diwali-lux__toranam" focusable="false" aria-hidden="true">
    <defs>
      <linearGradient id="vm-lux-thread" x1="0" x2="1">
        <stop stopColor="#a96c32"/><stop offset=".25" stopColor="#ffe5a0"/>
        <stop offset=".55" stopColor="#bf823a"/><stop offset=".8" stopColor="#ffdf99"/>
        <stop offset="1" stopColor="#9d602d"/>
      </linearGradient>
      <radialGradient id="vm-lux-glimmer"><stop stopColor="#fff5cd"/><stop offset=".3" stopColor="#f6c16b"/><stop offset="1" stopColor="#efa753" stopOpacity="0"/></radialGradient>
    </defs>
    <path d={front} className="vm-lux-thread"/><path d={back} className="vm-lux-thread vm-lux-thread--back"/>
    <path d={front} className="vm-lux-thread-pulse"/><path d={back} className="vm-lux-thread-pulse vm-lux-thread-pulse--back"/>
    {points.map((x,i)=><g key={x} transform={'translate('+x+' 57)'} className="vm-lux-leaf" style={{animationDelay:(-i*.54)+'s'}}>
      <path d="M0 0 V12" fill="none" stroke="#ddaa60" strokeWidth="2.4"/>
      <circle cx="0" cy="10" r="4.4" fill="#fff0bb"/>
      <path d="M0 16 Q-19 29 0 57 Q19 29 0 16 Z" fill="#a46a34" stroke="#ffdfa1" strokeWidth="2.5"/>
      <path d="M0 22 V49 M-8 31 L0 38 L8 31" stroke="#ffe8b3" strokeWidth="1.5" fill="none"/>
      <circle cx="0" cy="58" r="3" fill="#ffdda3"/>
    </g>)}
    {Array.from({length:14},(_,i)=>{const x=23+i*88;return <g key={i} transform={'translate('+x+' '+(i%2?22:12)+')'} className="vm-lux-twinkle" style={{animationDelay:(-i*.27)+'s'}}>
      <circle r="18" fill="url(#vm-lux-glimmer)"/><path d="M-11 0 H11 M0 -11 V11 M-6 -6 L6 6 M6 -6 L-6 6" stroke="#ffdf9c" strokeWidth="2" strokeLinecap="round"/><circle r="2.9" fill="#fff9d9"/>
    </g>})}
  </svg>;
}
function Muggu({corner}){
  return <svg className={'vm-lux-muggu vm-lux-muggu--'+corner} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <g transform="translate(50 50)" fill="none" stroke="#d3944d">
      <circle r="37" strokeWidth="1.4" strokeDasharray="2.5 5" />
      <circle r="26" stroke="#f7c982" strokeWidth="1.3"/>
      {Array.from({length:8},(_,i)=><path key={i} d="M0 -45 C12 -32 13 -19 0 -9 C-13 -19 -12 -32 0 -45 Z" transform={'rotate('+(i*45)+')'} stroke={i%2?'#d48a39':'#f8d58e'} strokeWidth="2"/>)}
      <path d="M0 -14 L14 0 L0 14 L-14 0Z M0 -7 L7 0 L0 7 L-7 0Z" stroke="#fff1bd" strokeWidth="1.7"/>
      <circle r="3.2" fill="#ffdc87" stroke="none"/>
    </g>
  </svg>;
}
function Diya({index}){
  return <svg viewBox="0 0 90 94" className="vm-lux-diya" focusable="false" aria-hidden="true" style={{animationDelay:(-index*.29)+'s'}}>
    <ellipse cx="45" cy="76" rx="37" ry="12" fill="#f4b44e" opacity=".15"/>
    <circle cx="45" cy="40" r="25" fill="#f7b253" opacity=".18" className="vm-lux-diya-halo"/>
    <g className="vm-lux-diya-flame">
      <path d="M45 7 C31 26 38 40 45 43 C60 32 56 20 45 7 Z" fill="#e68e28"/>
      <path d="M45 18 C40 29 41 37 45 39 C51 34 51 25 45 18 Z" fill="#fff4b9"/>
    </g>
    <path d="M12 51 Q45 76 78 51 Q72 77 45 78 Q18 77 12 51Z" fill="#9e5428" stroke="#f7c680" strokeWidth="2"/>
    <path d="M12 51 Q45 64 78 51" fill="none" stroke="#ffe1a0" strokeWidth="4" strokeLinecap="round"/>
    <path d="M24 65 Q45 73 66 65" fill="none" stroke="#ffcd7b" strokeWidth="2"/>
    {[23,34,45,56,67].map(x=><circle key={x} cx={x} cy="61" r="1.7" fill="#fff0ad"/>)}
  </svg>;
}
function Chakra({reverse=false}){
 const host=useRef(null),canvas=useRef(null);
 useEffect(()=>{
   const el=host.current, surface=canvas.current;
   const ctx=surface?.getContext('2d',{alpha:true});
   if(!el||!ctx||window.matchMedia(REDUCED).matches||navigator.connection?.saveData)return undefined;
   const resolution=220,dpr=Math.min(devicePixelRatio||1,1.5);
   surface.width=resolution*dpr;surface.height=resolution*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
   const sparks=[];let active=false,frame=0,last=0;
   function paint(t){
     frame=0;
     const dt=last?Math.min(2,(t-last)/16.66):1;last=t;
     ctx.clearRect(0,0,resolution,resolution);
     ctx.save();ctx.globalCompositeOperation='lighter';
     const angle=t/3000*Math.PI*2*(reverse?-1:1);
     for(let i=0;i<4;i++){
       const theta=angle+i*.31+(Math.random()-.5)*.2;
       const x=110+Math.cos(theta)*66,y=110+Math.sin(theta)*66;
       const tangent=theta+(reverse?-Math.PI/2:Math.PI/2)+(Math.random()-.5)*.8;
       const speed=1.9+Math.random()*3.4,life=15+Math.random()*19;
       sparks.push({x,y,vx:Math.cos(tangent)*speed,vy:Math.sin(tangent)*speed,life,max:life});
     }
     while(sparks.length>110)sparks.shift();
     for(let i=sparks.length-1;i>=0;i--){
       const s=sparks[i];s.life-=dt;
       if(s.life<=0){sparks.splice(i,1);continue;}
       const px=s.x,py=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=.984;s.vy+=.027*dt;
       ctx.globalAlpha=s.life/s.max;ctx.strokeStyle=s.life>12?'#ffe6a2':'#bb7637';
       ctx.lineWidth=s.life>12?1.8:1;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(s.x,s.y);ctx.stroke();
     }
     ctx.restore();
     if(active&&!document.hidden)frame=requestAnimationFrame(paint);
   }
   const start=()=>{if(active||document.hidden)return;active=true;last=0;frame=requestAnimationFrame(paint);};
   const stop=()=>{active=false;cancelAnimationFrame(frame);frame=0;ctx.clearRect(0,0,resolution,resolution);};
   const watch=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)start();else stop();},{threshold:.06});
   watch.observe(el);const onVisibility=()=>{if(document.hidden)stop();else if(el.getBoundingClientRect().top<innerHeight)start();};
   document.addEventListener('visibilitychange',onVisibility);
   return ()=>{stop();watch.disconnect();document.removeEventListener('visibilitychange',onVisibility);};
 },[reverse]);
 return <div ref={host} className={'vm-lux-chakra'+(reverse?' vm-lux-chakra--reverse':'')}>
   <svg className="vm-lux-chakra-wheel" viewBox="0 0 220 220" aria-hidden="true">
    <circle cx="110" cy="110" r="65" stroke="#dc9c55" strokeDasharray="2 6" strokeWidth="1.5" fill="none"/>
    <circle cx="110" cy="110" r="45" stroke="#ffdd97" strokeWidth="2" fill="none"/>
    <circle cx="110" cy="110" r="19" stroke="#c4884d" strokeWidth="1.6" fill="none"/>
    {Array.from({length:20},(_,i)=><path key={i} d="M110 91 Q132 71 148 62" transform={'rotate('+(i*18)+' 110 110)'} stroke={i%3?'#b8793b':'#ffe6a7'} strokeWidth={i%3?1.5:2.6} fill="none" strokeLinecap="round"/>)}
    <circle cx="110" cy="110" r="5" fill="#fff0b8"/>
   </svg>
   <canvas ref={canvas} className="vm-lux-chakra-sparks" aria-hidden="true"/>
 </div>;
}
function Rockets(){
 const canvas=useRef(null);
 useEffect(()=>{
  const el=canvas.current,ctx=el?.getContext('2d',{alpha:true});if(!ctx)return undefined;
  let width=1,height=1,dpr=1,frame=0,last=0,sent=0;const rockets=[],embers=[];
  const calls=[{time:90,x:.18,y:.32,c:0},{time:270,x:.77,y:.3,c:2},
    {time:620,x:.45,y:.18,c:1},{time:890,x:.26,y:.46,c:3},
    {time:1190,x:.69,y:.39,c:4},{time:1510,x:.13,y:.24,c:5},
    {time:1800,x:.83,y:.22,c:1},{time:2140,x:.55,y:.33,c:0}];
  const resize=()=>{width=innerWidth;height=innerHeight;dpr=clamp(devicePixelRatio||1,1,1.5);
   el.width=Math.ceil(width*dpr);el.height=Math.ceil(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
  const burst=(x,y,color)=>{
   const max=width<650?220:480,n=width<650?30:58;
   for(let i=0;i<n&&embers.length<max;i++){
    const theta=2*Math.PI*i/n+(Math.random()-.5)*.17,speed=2.2+Math.random()*4.4,life=38+Math.random()*34;
    embers.push({x,y,vx:Math.cos(theta)*speed,vy:Math.sin(theta)*speed,life,max:life,color:FIRE_COLORS[(color+(i%8===0?2:0))%FIRE_COLORS.length]});
   }
  };
  const begin=performance.now();
  const draw=t=>{
   if(!last)last=t;
   const dt=Math.min(2,(t-last)/16.66||1),elapsed=t-begin;last=t;
   ctx.clearRect(0,0,width,height);ctx.save();ctx.globalCompositeOperation='lighter';
   while(sent<calls.length&&elapsed>=calls[sent].time){
     const c=calls[sent++];rockets.push({x:width*c.x,from:height+20,to:height*c.y,started:t,duration:490+Math.random()*230,previous:height+20,color:c.c});
   }
   for(let i=rockets.length-1;i>=0;i--){
     const r=rockets[i],f=clamp((t-r.started)/r.duration,0,1),y=r.from+(r.to-r.from)*(1-(1-f)*(1-f));
     const g=ctx.createLinearGradient(r.x,r.previous+25,r.x,y);
     g.addColorStop(0,'#ffaf6200');g.addColorStop(1,FIRE_COLORS[r.color]);
     ctx.strokeStyle=g;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(r.x,r.previous+25);ctx.lineTo(r.x,y);ctx.stroke();
     ctx.fillStyle='#fff3c6';ctx.beginPath();ctx.arc(r.x,y,3.5,0,Math.PI*2);ctx.fill();r.previous=y;
     if(f===1){burst(r.x,y,r.color);rockets.splice(i,1);}
   }
   for(let i=embers.length-1;i>=0;i--){
     const s=embers[i];s.life-=dt;if(s.life<=0){embers.splice(i,1);continue;}
     const px=s.x,py=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=.989;s.vy+=.05*dt;
     ctx.strokeStyle=s.color;ctx.globalAlpha=Math.min(1,s.life/s.max*1.5);
     ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(s.x,s.y);ctx.stroke();
   }
   ctx.restore();
   if(elapsed<3300&&!document.hidden)frame=requestAnimationFrame(draw);
  };
  resize();addEventListener('resize',resize,{passive:true});frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);};
 },[]);
 return <canvas ref={canvas} className="vm-lux-rockets" aria-hidden="true"/>;
}
function Introduction(){
 const [phase,setPhase]=useState('none');
 const close=useRef(null);
 useEffect(()=>{
   try{if(sessionStorage.getItem(SEEN_KEY)==='1')return undefined;sessionStorage.setItem(SEEN_KEY,'1');}catch{/* Session storage may be blocked. */}
   const motion=window.matchMedia(REDUCED).matches||navigator.connection?.saveData;
   setPhase(motion?'greeting':'rockets');
   return undefined;
 },[]);
 useEffect(()=>{if(phase!=='rockets')return undefined;const id=setTimeout(()=>setPhase('greeting'),3500);return()=>clearTimeout(id);},[phase]);
 useEffect(()=>{
   if(phase!=='greeting')return undefined;
   const prior=document.activeElement;close.current?.focus({preventScroll:true});
   const id=setTimeout(()=>setPhase('none'),10000);
   return()=>{clearTimeout(id);if(prior instanceof HTMLElement&&prior.isConnected)prior.focus({preventScroll:true});};
 },[phase]);
 if(phase==='none')return null;
 const key=e=>{
  if(e.key==='Escape'){setPhase('none');return;}
  if(e.key!=='Tab'||phase!=='greeting')return;
  const buttons=Array.from(e.currentTarget.querySelectorAll('button'));
  if(!buttons.length)return;
  if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[buttons.length-1].focus();}
  if(!e.shiftKey&&document.activeElement===buttons[buttons.length-1]){e.preventDefault();buttons[0].focus();}
 };
 return <div className={'vm-lux-intro vm-lux-intro--'+phase} onKeyDown={key}>
  {phase==='rockets'?<div className="vm-lux-night">
    <Rockets/><span className="vm-lux-festival-label">A FESTIVAL OF LIGHTS · 2026</span>
    <button type="button" onClick={()=>setPhase('greeting')} className="vm-lux-skip">Skip fireworks</button>
  </div>:<div className="vm-lux-frost">
    <section role="dialog" aria-modal="true" aria-labelledby="vm-lux-title" aria-describedby="vm-lux-message" className="vm-lux-greeting">
     <div className="vm-lux-refraction" aria-hidden="true"/>
     <button type="button" ref={close} onClick={()=>setPhase('none')} className="vm-lux-close" aria-label="Close Diwali greeting">×</button>
     <div className="vm-lux-greeting-stars" aria-hidden="true">✦ &nbsp; ✧ &nbsp; ✦</div>
     <p className="vm-lux-greeting-eyebrow">FESTIVAL OF LIGHTS · 2026</p>
     <h2 id="vm-lux-title">Happy Diwali!</h2>
     <p id="vm-lux-message">May the coming year bring bright ideas, meaningful connections, and new beginnings.</p>
     <div className="vm-lux-signature"><img src="/vm-mark.svg" width="27" height="27" alt=""/>Warm wishes from Vamsi Marripudi</div>
     <button type="button" className="vm-lux-continue" onClick={()=>setPhase('none')}>Explore my portfolio <span aria-hidden="true">↗</span></button>
     <div className="vm-lux-progress" aria-hidden="true"><span/></div>
     <small>Automatically closes in 10 seconds</small>
    </section>
  </div>}
 </div>;
}
/** Home-only decorations; no global palette changes or impact on original hero/canvas motion. */
export default function PortfolioDiwaliLux(){
 const active=useToday();
 const [portalHost,setPortalHost]=useState(null);
 useEffect(()=>setPortalHost(document.body),[]);
 useEffect(()=>{
  if(!active)return undefined;
  const hero=document.querySelector('main#main > section.hero.hero-identity');
  if(!hero||!window.IntersectionObserver)return undefined;
  const flag='vm-diwali-hero-on-screen';
  const observer=new IntersectionObserver(entries=>{
    document.documentElement.classList.toggle(flag,Boolean(entries[0]?.isIntersecting));
  },{threshold:0,rootMargin:'-16% 0px -10% 0px'});
  observer.observe(hero);
  return()=>{observer.disconnect();document.documentElement.classList.remove(flag);};
 },[active]);
 if(!active)return null;
 return <>
  <div className="portfolio-diwali-lux" data-portfolio-diwali-lux="2026" aria-hidden="true">
   <div className="vm-lux-gold-frame"/>
   <div className="vm-lux-border-light vm-lux-border-light--left"/>
   <div className="vm-lux-border-light vm-lux-border-light--right"/>
   <div className="vm-lux-border-light vm-lux-border-light--top"/>
   <div className="vm-lux-border-light vm-lux-border-light--bottom"/>
   <Toranam/>
   <Muggu corner="tl"/><Muggu corner="tr"/><Muggu corner="bl"/><Muggu corner="br"/>
   <div className="vm-lux-wheel vm-lux-wheel--left"><Chakra/></div>
   <div className="vm-lux-wheel vm-lux-wheel--right"><Chakra reverse/></div>
   <div className="vm-lux-diyas vm-lux-diyas--left"><Diya index={0}/><Diya index={1}/></div>
   <div className="vm-lux-diyas vm-lux-diyas--right"><Diya index={2}/><Diya index={3}/></div>
  </div>
  {portalHost?createPortal(<Introduction/>,portalHost):null}
 </>;
}
