import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html=readFileSync(new URL("../public/diwali-siva.html",import.meta.url),"utf8");
const creator=readFileSync(new URL("../public/diwali-create.html",import.meta.url),"utf8");
const scripts=Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/gi),m=>m[1]);
const fireworkScript=scripts.at(-1);

test("only desktop hero scale changes; existing mobile rule and all names remain",()=>{
  assert.match(html,/@media \(min-width: 901px\)[\s\S]*?\.hero h1 \.diwali \{font-size:clamp\(76px,12\.6svh,128px\)/);
  assert.match(html,/@media\(max-width:550px\)\{\.hero\{min-height:100svh;padding:94px 19px 65px\}/);
  assert.match(html,/\.hero h1 \.diwali\{font-size:clamp\(91px,20vw,124px\)/);
  assert.match(html,/<canvas id="diwali-fireworks-layer" aria-hidden="true">/);
  assert.match(html,/pointer-events:none/);
  assert.match(html,/id="diwali-sound-toggle" aria-label="Mute firework sounds"/);
  assert.match(html,/class="dog-body-motion"/);
  assert.match(html,/class="dog-tail-motion"/);
  assert.match(html,/class="dog-diya-flame"/);
  assert.match(html,/Siva Palavalasa/);
  assert.match(html,/href="\/diwali\/create"/);
  assert.doesNotMatch(html,/<article class="precaution"|<img\b/i);
  assert.doesNotMatch(creator,/diwali-fireworks-layer/);
});

test("both inline greeting scripts compile with no third-party dependencies",()=>{
  assert.equal(scripts.length,2);
  for(const script of scripts)assert.doesNotThrow(()=>new vm.Script(script));
  assert.match(fireworkScript,/pointerdown/);
  assert.match(fireworkScript,/pointerup/);
  assert.match(fireworkScript,/pointercancel/);
  assert.match(fireworkScript,/window\.AudioContext\|\|window\.webkitAudioContext/);
  assert.match(fireworkScript,/prefers-reduced-motion/);
  assert.match(fireworkScript,/Math\.hypot\(e\.clientX-old\.x,e\.clientY-old\.y\)/);
  assert.match(fireworkScript,/fountain\(now\)/);
  assert.match(fireworkScript,/handheldSparklers\(now\)/);
  assert.match(fireworkScript,/bloom\(r\.targetX,r\.targetY/);
});

test("touch anywhere launches rocket and synthesizes sound while scroll gestures do not",()=>{
  const handlers=new Map();
  const toggleHandlers=new Map();
  let clock=5000,audioConstructed=0,audioStarted=0,rafCount=0,painted=0;
  const rafCallbacks=new Map();
  class FakeElement{
    closest(selector){return selector==="#diwali-sound-toggle" && this===toggle ? this : null}
  }
  const pen={
    setTransform(){},clearRect(){painted++},save(){},restore(){},
    beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},
  };
  const canvas={width:0,height:0,getContext(){return pen}};
  const wave={setAttribute(){}};
  const label={textContent:"Sound on"};
  const toggle=new FakeElement();
  toggle.addEventListener=(name,fn)=>toggleHandlers.set(name,fn);
  toggle.setAttribute=()=>{};
  toggle.querySelector=selector=>selector===".diwali-sound-label"?label:wave;
  const hero={getBoundingClientRect(){return {top:0,bottom:800}}};
  const document={
    hidden:false,
    getElementById(id){return id==="diwali-fireworks-layer"?canvas:id==="diwali-sound-toggle"?toggle:null},
    querySelector(q){return q===".hero"?hero:null},
    addEventListener(name,fn){handlers.set("document:"+name,fn)},
  };
  function param(){return{setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}}}
  function node(){
    return{gain:param(),frequency:param(),connect(){return this},disconnect(){},start(){audioStarted++},stop(){}};
  }
  class FakeAudio{
    constructor(){audioConstructed++;this.currentTime=0;this.state="running";this.sampleRate=44100;this.destination={}}
    createGain(){return node()}createOscillator(){return node()}
    createBuffer(){return{getChannelData(){return new Float32Array(15000)}}}
    createBufferSource(){return node()}createBiquadFilter(){return node()}
    resume(){return Promise.resolve()}
  }
  const window={
    innerWidth:1380,innerHeight:800,devicePixelRatio:1,AudioContext:FakeAudio,
    matchMedia(){return{matches:false,addEventListener(){}}},
    addEventListener(name,fn){handlers.set(name,fn)},
  };
  const requestAnimationFrame=cb=>{
    const id=++rafCount;rafCallbacks.set(id,cb);return id;
  };
  const cancelAnimationFrame=id=>rafCallbacks.delete(id);
  const context={document,window,Element:FakeElement,performance:{now:()=>clock},
    requestAnimationFrame,cancelAnimationFrame,Math,Map};
  vm.runInNewContext(fireworkScript,context,{timeout:4000});
  assert.equal(rafCallbacks.size,1,"animation boot should have one frame");
  const target=new FakeElement();
  const point={button:0,pointerId:1,clientX:450,clientY:240,target};
  handlers.get("pointerdown")(point);
  clock+=90;handlers.get("pointerup")(point);
  assert.equal(audioConstructed,1,"sound context begins only after direct touch");
  assert.ok(audioStarted>=3,"rocket whistle, pop and low boom generated");
  // Simulated frame: one callback in flight; no double schedule, even on ambient launches.
  const [id,cb]=rafCallbacks.entries().next().value;rafCallbacks.delete(id);clock+=20;cb(clock);
  assert.ok(rafCallbacks.size<=1);
  assert.ok(painted>0);
  // Scroll / finger drag should not launch a second sound effect.
  const pointer2={button:0,pointerId:2,clientX:200,clientY:400,target};
  handlers.get("pointerdown")(pointer2);
  const soundCount=audioStarted;clock+=260;
  handlers.get("pointerup")({...pointer2,clientY:180});
  assert.equal(audioStarted,soundCount);
  // Muting leaves the pointer visual behavior available.
  toggleHandlers.get("click")();
  assert.equal(label.textContent,"Sound off");
  clock+=260;
  const pointer3={button:0,pointerId:3,clientX:280,clientY:160,target};
  handlers.get("pointerdown")(pointer3);clock+=40;handlers.get("pointerup")(pointer3);
  assert.equal(audioStarted,soundCount,"muted taps should draw but never play audio");
});
