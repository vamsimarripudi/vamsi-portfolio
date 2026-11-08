import {leafAngle,pointerProgress,settleTarget} from './stories-motion.mjs';
/**
 * Vamsi's Corner / Stories — production reader controller.
 * Real DOM-based chapter pagination, pointer-following 3D page turns and licensed
 * user-supplied paper audio. Sound is strictly opt-in. No network analytics.
 */
const $ = id => document.getElementById(id);
const bootEl = $('storyBootstrap');
if (!bootEl) throw new Error('The story reader was opened without chapter data.');
const boot = JSON.parse(bootEl.textContent || '{}');
const book = boot.book;
const BASE_PATH = document.body.dataset.basePath || '';
if (!book?.slug || !Array.isArray(book.chapters) || !boot.chapter) throw new Error('Invalid book data.');
const el = {
  stage:$('readerStage'), book:$('readerBook'), left:$('leftPage'), right:$('rightPage'),
  leaf:$('readerLeaf'), front:$('leafFront'), back:$('leafBack'), touch:$('touchIndicator'),
  prev:$('prevPage'),next:$('nextPage'),hint:$('gestureHint'),chapter:$('chapterLabel'),
  fill:$('progressFill'),label:$('progressLabel'),live:$('readerAnnouncer'),
  sound:$('soundButton'),theme:$('themeButton'),size:$('sizeButton'),accessible:$('accessibleButton'),
  tocButton:$('tocButton'),toc:$('tocDialog'),tocList:$('readerToc'),
  settings:$('settingsDialog'),fontSize:$('fontSize'),fontOutput:$('fontOutput'),
  continuous:$('continuousReader'),continuousText:$('continuousContent')
};
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 900px)');
const SETTINGS_KEY = 'corner.stories.preferences.v1';
const progressKey = `corner.stories.progress.v1:${book.id}`;
const initialChapterNumber = Number(boot.chapter.number) || 1;
const storage = {
  get(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}},
  set(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* private mode or quota */}}
};
const savedSettings=storage.get(SETTINGS_KEY)||{};
const prefs={theme:['paper','sepia','night'].includes(savedSettings.theme)?savedSettings.theme:'paper',
  font:Number.isInteger(savedSettings.font)&&savedSettings.font>=15&&savedSettings.font<=25?savedSettings.font:18,
  sound:false,continuous:false};
const chapters=book.chapters;
let chapterIndex=Math.max(0,Math.min(chapters.length-1,initialChapterNumber-1));
let chapter=boot.chapter;
let pages=[];
let basePage=0;
let isLoading=false;
let activeTurn=null;
let frame=0;
let frameTime=0;
let resizeTimer=0;
const fetched=new Map([[chapterIndex,chapter]]);
const chapterRequests=new Map();

function announce(text){el.live.textContent='';requestAnimationFrame(()=>{el.live.textContent=text;});}
function safeText(content){return typeof content==='string'?content:'';}
function contentParagraphs(raw){return safeText(raw).replace(/\r\n?/g,'\n').split(/\n\s*\n+/).map(s=>s.trim()).filter(Boolean);}
function createCopy(segments=[],holder){
  const copy=document.createElement('div');copy.className='reader-page-copy';
  if(holder)holder.append(copy);
  for(const segment of segments){
    const p=document.createElement('p');p.textContent=segment.text;
    if(segment.continued)p.className='reader-paragraph-continued';
    copy.append(p);
  }
  return copy;
}
function makePage(container,pg,{pageNumber=null,side='right'}={}){
  container.replaceChildren();
  const paper=document.createElement('div');paper.className='reader-paper-inner';
  const header=document.createElement('div');header.className='reader-paper-header';
  header.textContent=pg&&pageNumber===0?`CHAPTER ${chapterIndex+1} · ${chapter.title}`:(side==='left'?'VAMSI’S CORNER · STORIES':`${book.title}`);
  const copy=createCopy(pg?.segments||[]);
  const foot=document.createElement('div');foot.className='reader-paper-footer';
  const sub=document.createElement('span');sub.textContent=pg?'Original fiction · Vamsi’s Corner':'';
  const number=document.createElement('span');number.textContent=pg&&pageNumber!==null?String(pageNumber+1):'';
  foot.append(sub,number);paper.append(header,copy,foot);container.append(paper);
}
function makeMeasure(){
  const copy=el.right.querySelector('.reader-page-copy');
  const measurement=document.createElement('div');measurement.className='reader-page-copy reader-measure';
  measurement.style.width=`${Math.max(100,copy?.clientWidth||250)}px`;
  measurement.style.height=`${Math.max(100,copy?.clientHeight||350)}px`;
  document.body.append(measurement);
  return measurement;
}
function paginate(body){
  const paragraphs=contentParagraphs(body).map(text=>text.split(/\s+/).filter(Boolean));
  // Establish actual DOM geometry before measuring paragraphs; no hardcoded page lengths.
  makePage(el.right,null);
  if(!narrow.matches)makePage(el.left,null,{side:'left'});
  const measure=makeMeasure();
  const result=[];
  let segments=[],startWord=0,wordOffset=0;
  const fits=(candidate)=>{
    measure.replaceChildren();
    for(const part of candidate){const p=document.createElement('p');p.textContent=part.text;
      if(part.continued)p.className='reader-paragraph-continued';measure.append(p);}
    return measure.scrollHeight<=measure.clientHeight+1;
  };
  const flush=()=>{if(segments.length){result.push({segments,startWord,wordCount:wordOffset-startWord});segments=[];startWord=wordOffset;}};
  try{
    for(const words of paragraphs){
      let cursor=0;
      while(cursor<words.length){
        const remaining=words.length-cursor;
        const isContinued=cursor>0;
        const candidate=n=>[...segments,{text:words.slice(cursor,cursor+n).join(' '),continued:isContinued}];
        let fit=0;
        if(fits(candidate(remaining))) fit=remaining;
        else {
          let low=1,high=remaining;
          while(low<=high){const mid=(low+high)>>1;
            if(fits(candidate(mid))){fit=mid;low=mid+1;}else high=mid-1;}
        }
        if(fit===0){
          if(segments.length){flush();continue;}
          fit=1; // Progress guarantee for unusually long tokens.
        }
        segments.push({text:words.slice(cursor,cursor+fit).join(' '),continued:isContinued});
        cursor+=fit;wordOffset+=fit;
        if(cursor<words.length)flush();
      }
    }
    flush();
  } finally{measure.remove();}
  if(!result.length)result.push({segments:[{text:'This chapter is not available yet.',continued:false}],startWord:0,wordCount:0});
  return result;
}
function pageStep(){return narrow.matches?1:2;}
function alignPage(index){return Math.max(0,Math.floor(Math.max(0,index)/pageStep())*pageStep());}
function currentWord(){return pages[Math.min(basePage,pages.length-1)]?.startWord||0;}
function lastVisibleWord(){const page=pages[Math.min(pages.length-1,basePage+pageStep()-1)];return (page?.startWord||0)+(page?.wordCount||0);}
function totalBookWords(){return chapters.reduce((sum,c)=>sum+Math.max(0,Number(c.words)||0),0)||1;}
function readPercent(){
  let words=0;
  for(let i=0;i<chapterIndex;i++)words+=Math.max(0,Number(chapters[i].words)||0);
  words+=lastVisibleWord();
  return Math.max(0,Math.min(100,Math.round(words/totalBookWords()*100)));
}
function updateControls(){
  const atBeginning=chapterIndex===0&&basePage===0;
  const atEnd=chapterIndex===chapters.length-1&&basePage+pageStep()>=pages.length;
  el.prev.disabled=atBeginning||isLoading;
  el.next.disabled=atEnd||isLoading;
  el.chapter.textContent=`${chapters[chapterIndex]?.title||chapter.title}`;
  el.label.textContent=pageStep()===1?`Page ${basePage+1} of ${pages.length}`:`Pages ${basePage+1}–${Math.min(basePage+pageStep(),pages.length)} of ${pages.length}`;
  el.fill.style.width=readPercent()+'%';
  el.fill.parentElement.setAttribute('role','progressbar');
  el.fill.parentElement.setAttribute('aria-label','Book reading progress');
  el.fill.parentElement.setAttribute('aria-valuemin','0');
  el.fill.parentElement.setAttribute('aria-valuemax','100');
  el.fill.parentElement.setAttribute('aria-valuenow',String(readPercent()));
  el.hint.textContent=narrow.matches?'Drag the right corner to turn. Drag the left corner to go back.':'Drag an outside page edge to turn. Release early to cancel.';
  for(const b of el.tocList.querySelectorAll('button[data-chapter]'))b.setAttribute('aria-current',String(Number(b.dataset.chapter)===chapterIndex));
}
function renderSpread(){
  const step=pageStep();
  if(step===2)makePage(el.left,pages[basePage],{pageNumber:basePage,side:'left'});
  makePage(el.right,pages[basePage+(step===2?1:0)],{pageNumber:basePage+(step===2?1:0)});
  el.leaf.hidden=true;el.leaf.style.removeProperty('--leaf-angle');el.leaf.style.removeProperty('--leaf-bend');
  updateControls();
}
function persistPosition(){
  storage.set(progressKey,{chapter:chapterIndex,word:currentWord(),savedAt:Date.now(),chapterSlug:chapter.slug});
}
function showContinuous(){
  el.continuousText.replaceChildren();
  const h=document.createElement('h1');h.textContent=chapter.title||chapters[chapterIndex].title;
  el.continuousText.append(h);
  for(const text of contentParagraphs(chapter.body)){const p=document.createElement('p');p.textContent=text;el.continuousText.append(p);}
}
function paint(){
  if(prefs.continuous)showContinuous();
  else renderSpread();
}
function turnDestination(direction){
  if(direction==='next' && basePage+pageStep()<pages.length)return {chapter:chapterIndex,page:basePage+pageStep()};
  if(direction==='prev' && basePage>=pageStep())return {chapter:chapterIndex,page:basePage-pageStep()};
  if(direction==='next' && chapterIndex<chapters.length-1)return {chapter:chapterIndex+1,page:0};
  if(direction==='prev' && chapterIndex>0)return {chapter:chapterIndex-1,page:Infinity};
  return null;
}
function prepareLeaf(direction){
  const desktop=!narrow.matches;
  const upcoming=turnDestination(direction);
  if(!upcoming)return false;
  const nextWithin=upcoming.chapter===chapterIndex;
  let front,back,underLeft,underRight;
  if(desktop&&direction==='next'){
    front=pages[basePage+1];back=nextWithin?pages[basePage+2]:null;
    underLeft=pages[basePage];underRight=nextWithin?pages[basePage+3]:null;
  } else if(desktop){
    front=pages[basePage];back=nextWithin?pages[basePage-1]:null;
    underLeft=nextWithin?pages[basePage-2]:null;underRight=pages[basePage+1];
  } else if(direction==='next'){
    front=pages[basePage];back=null;underRight=nextWithin?pages[basePage+1]:null;
  } else {
    front=nextWithin?pages[basePage-1]:null;back=pages[basePage];underRight=pages[basePage];
  }
  if(desktop)makePage(el.left,underLeft,{pageNumber:direction==='prev'?Math.max(0,basePage-2):basePage,side:'left'});
  makePage(el.right,underRight,{pageNumber:direction==='next'?basePage+3:basePage+1});
  makePage(el.front,front,{pageNumber:direction==='next'?basePage+1:basePage-1});
  makePage(el.back,back,{pageNumber:direction==='next'?basePage+2:basePage});
  el.leaf.style.left=desktop && direction==='next'?'50%':'0';
  el.leaf.style.transformOrigin=direction==='next'?'left center':'right center';
  el.leaf.hidden=false;
  return true;
}
function drawLeaf(t){
  const degrees=leafAngle(t.progress,t.direction);
  const vertical=Math.max(-5,Math.min(5,(t.pointerY-t.startY)/(el.stage.clientHeight||1)*6));
  const curl=vertical*Math.sin(t.progress*Math.PI);
  el.leaf.style.setProperty('--leaf-angle',degrees.toFixed(2)+'deg');
  el.leaf.style.setProperty('--leaf-bend',curl.toFixed(2)+'deg');
  el.leaf.style.setProperty('--leaf-shadow',String(Math.max(.04,Math.sin(t.progress*Math.PI)*.75).toFixed(3)));
}
function schedule(){if(!frame)frame=requestAnimationFrame(tick);}
function tick(time){
  frame=0;if(!activeTurn)return;
  const t=activeTurn;
  const dt=Math.min(.035,Math.max(.006,(time-(frameTime||time-16))/1000));frameTime=time;
  if(t.releasing){
    const acceleration=(t.finish-t.progress)*270-t.springVelocity*35;
    t.springVelocity+=acceleration*dt;
    t.progress=Math.max(0,Math.min(1,t.progress+t.springVelocity*dt));
  }else{
    // ~12ms smoothing, responsive at high-refresh-rate touch while removing sampling noise.
    t.progress+=(t.target-t.progress)*(1-Math.exp(-dt/.012));
  }
  drawLeaf(t);
  if(t.releasing){
    if(t.finish===1 && !t.soundLanded && t.progress>=.84){t.soundLanded=true;paperAudio.land();}
    if(Math.abs(t.progress-t.finish)<.002&&Math.abs(t.springVelocity)<.06){
      const committed=t.finish===1;
      const direction=t.direction;
      activeTurn=null;frameTime=0;el.stage.classList.remove('is-dragging');el.touch.style.opacity='0';
      paperAudio.stop();
      if(committed)void commitTurn(direction);
      else {renderSpread();announce('Page turn canceled.');}
      return;
    }
  }
  schedule();
}
function beginTurn(direction,{pointerId=null,startX=0,startY=0}={}){
  if(activeTurn||isLoading||prefs.continuous)return false;
  if(!prepareLeaf(direction))return false;
  activeTurn={direction,pointerId,startX,startY,pointerY:startY,target:0,progress:0,releasing:false,finish:0,
    springVelocity:0,soundLanded:false,lastSample:performance.now(),lastProgress:0,velocity:0};
  frameTime=0;
  drawLeaf(activeTurn);schedule();
  return true;
}
function finishTurn(force=null){
  const t=activeTurn;
  if(!t||t.releasing)return;
  t.finish=force===null?settleTarget(t.target,t.velocity,{mobile:narrow.matches}):(force?1:0);
  t.releasing=true;t.springVelocity=Math.max(-2.2,Math.min(2.2,t.velocity*.45));
  if(t.finish===0)paperAudio.stop();
  if(reduce.matches){
    const committed=t.finish===1;const direction=t.direction;activeTurn=null;
    paperAudio.stop();el.stage.classList.remove('is-dragging');
    if(committed)void commitTurn(direction);else renderSpread();
    return;
  }
  schedule();
}
async function commitTurn(direction){
  const dest=turnDestination(direction);
  if(!dest){renderSpread();return;}
  if(dest.chapter===chapterIndex){
    basePage=alignPage(dest.page);renderSpread();persistPosition();
    announce(`Page ${Math.min(basePage+1,pages.length)} of ${pages.length}.`);
  }else await loadChapter(dest.chapter,dest.page,{announceChange:true});
}
function onPointerDown(event){
  if(event.button!==0||activeTurn||prefs.continuous||isLoading)return;
  const rect=el.stage.getBoundingClientRect();
  const x=event.clientX-rect.left;
  const startForward=x>rect.width*(narrow.matches ? .67 : .80);
  const startBackward=x<rect.width*(narrow.matches ? .33 : .20);
  const direction=startForward?'next':startBackward?'prev':null;
  if(!direction||!beginTurn(direction,{pointerId:event.pointerId,startX:event.clientX,startY:event.clientY}))return;
  el.stage.setPointerCapture(event.pointerId);
  el.stage.classList.add('is-dragging');
  el.touch.style.left=x+'px';el.touch.style.top=(event.clientY-rect.top)+'px';el.touch.style.opacity='.95';
  event.preventDefault();
}
function onPointerMove(event){
  const t=activeTurn;
  if(!t||t.releasing||t.pointerId!==event.pointerId)return;
  const rect=el.stage.getBoundingClientRect();
  const progress=pointerProgress(event.clientX-t.startX,rect.width/(narrow.matches?1:2),t.direction);
  const now=performance.now(),dt=Math.max(8,now-t.lastSample)/1000;
  t.velocity=(progress-t.lastProgress)/dt;
  t.lastSample=now;t.lastProgress=progress;t.target=progress;t.pointerY=event.clientY;
  el.touch.style.left=(event.clientX-rect.left)+'px';el.touch.style.top=(event.clientY-rect.top)+'px';
  paperAudio.move(Math.abs(t.velocity));
  event.preventDefault();
}
function onPointerUp(event){
  if(activeTurn?.pointerId!==event.pointerId)return;
  try{if(el.stage.hasPointerCapture(event.pointerId))el.stage.releasePointerCapture(event.pointerId);}catch{/* Capture may already be released by the browser. */}
  el.stage.classList.remove('is-dragging');el.touch.style.opacity='0';finishTurn();event.preventDefault();
}
function onPointerCancel(event){
  if(activeTurn?.pointerId!==event.pointerId)return;
  el.stage.classList.remove('is-dragging');el.touch.style.opacity='0';finishTurn(false);
}
function automaticTurn(direction){
  if(isLoading||activeTurn)return;
  if(prefs.continuous){
    const index=chapterIndex+(direction==='next'?1:-1);
    if(index>=0&&index<chapters.length)void loadChapter(index,0,{announceChange:true});
    return;
  }
  if(reduce.matches){void commitTurn(direction);return;}
  if(!beginTurn(direction))return;
  paperAudio.move(1.15);
  finishTurn(true);
}

/* Short recorded rustle and landing segments, both from the user's original MP3. */
class RecordedPaperAudio {
  constructor(){this.enabled=false;this.ctx=null;this.buffer=null;this.loading=null;this.rustle=null;this.rustleGain=null;this.impactPlayed=false;}
  async enable(){
    if(this.enabled)return true;
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return false;
    try{
      this.ctx ||= new Context();
      await this.ctx.resume(); // user-initiated button click satisfies autoplay requirements
      this.loading ||= fetch(`${BASE_PATH}/stories-paper.mp3`,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}).then(b=>this.ctx.decodeAudioData(b));
      this.buffer=await this.loading;
      this.enabled=true;
      return true;
    }catch{this.enabled=false;this.loading=null;return false;}
  }
  move(speed){
    if(!this.enabled||!this.ctx||!this.buffer||reduce.matches)return;
    if(!this.rustle){
      const s=this.ctx.createBufferSource(),g=this.ctx.createGain();
      s.buffer=this.buffer;s.loop=true;s.loopStart=.10;s.loopEnd=Math.min(.56,this.buffer.duration-.08);
      g.gain.value=0;s.connect(g).connect(this.ctx.destination);
      s.start(0,.12);this.rustle=s;this.rustleGain=g;this.impactPlayed=false;
    }
    const volume=Math.min(.105,Math.max(.004,Math.abs(speed)*.035));
    this.rustleGain.gain.setTargetAtTime(volume,this.ctx.currentTime,.055);
    this.rustle.playbackRate.setTargetAtTime(Math.max(.85,Math.min(1.3,.88+speed*.08)),this.ctx.currentTime,.07);
  }
  land(){
    if(this.impactPlayed||!this.enabled||!this.ctx||!this.buffer||reduce.matches)return;
    this.impactPlayed=true;
    this.stop();
    const s=this.ctx.createBufferSource(),g=this.ctx.createGain();
    s.buffer=this.buffer;g.gain.value=.09;s.connect(g).connect(this.ctx.destination);
    // 0.79s contains the first paper contact in the supplied source recording.
    const offset=Math.min(.69,Math.max(0,this.buffer.duration-.3));
    s.start(0,offset,Math.min(.3,this.buffer.duration-offset));
  }
  stop(){
    if(this.rustle){
      try{this.rustleGain.gain.setTargetAtTime(0,this.ctx.currentTime,.025);this.rustle.stop(this.ctx.currentTime+.1);}catch{/* This short-lived sound can already be stopped. */}
      this.rustle=null;this.rustleGain=null;
    }
  }
  disable(){this.enabled=false;this.stop();}
}
const paperAudio=new RecordedPaperAudio();

async function fetchChapter(index){
  if(index<0||index>=chapters.length)throw new Error('Unknown chapter');
  if(fetched.has(index))return fetched.get(index);
  if(chapterRequests.has(index))return chapterRequests.get(index);
  const endpoint=`${BASE_PATH}/api/stories/books/${encodeURIComponent(book.slug)}/chapters/${index+1}`;
  const request=fetch(endpoint,{credentials:'same-origin',headers:{Accept:'application/json'}}).then(async res=>{
    if(!res.ok)throw new Error('Unable to load chapter');
    const json=await res.json();
    const result=json.data?.chapter;
    if(!result||result.slug!==chapters[index].slug||typeof result.body!=='string')throw new Error('Chapter response did not match the book');
    fetched.set(index,result);return result;
  }).finally(()=>chapterRequests.delete(index));
  chapterRequests.set(index,request);return request;
}
function prefetchAdjacent(){
  if(navigator.connection?.saveData)return;
  if(chapterIndex+1<chapters.length){
    if(typeof window.requestIdleCallback==='function')window.requestIdleCallback(()=>fetchChapter(chapterIndex+1).catch(()=>{}));
    else setTimeout(()=>fetchChapter(chapterIndex+1).catch(()=>{}),500);
  }
}
async function loadChapter(index,word=0,{announceChange=false}={}){
  if(isLoading||index<0||index>=chapters.length)return false;
  isLoading=true;updateControls();el.hint.textContent='Opening chapter…';
  const previous={index:chapterIndex,chapter,pages,basePage};
  try{
    const next=await fetchChapter(index);
    chapterIndex=index;chapter=next;
    pages=paginate(chapter.body);
    const desiredWord=word===Infinity?Infinity:Math.max(0,Number(word)||0);
    const found=desiredWord===Infinity?pages.length-1:pages.findIndex((p,i)=>i===pages.length-1||pages[i+1].startWord>desiredWord);
    basePage=alignPage(Math.max(0,found));
    paint();persistPosition();
    if(announceChange)announce(`Chapter ${index+1}, ${chapter.title}.`);
    prefetchAdjacent();
    return true;
  }catch{
    chapterIndex=previous.index;chapter=previous.chapter;pages=previous.pages;basePage=previous.basePage;
    paint();announce('Chapter could not be loaded. Try again.');return false;
  }finally{isLoading=false;updateControls();}
}
function restoreBookmark(){
  const explicit=new URLSearchParams(location.search).get('chapter');
  const resume=storage.get(progressKey);
  if(explicit&&/^\d+$/.test(explicit))return {chapter:Math.min(chapters.length-1,Math.max(0,Number(explicit)-1)),word:0};
  if(resume&&Number.isInteger(resume.chapter)&&resume.chapter>=0&&resume.chapter<chapters.length&&Number.isFinite(resume.word)&&resume.chapterSlug===chapters[resume.chapter].slug)
    return {chapter:resume.chapter,word:Math.max(0,resume.word)};
  return {chapter:chapterIndex,word:0};
}
function renderToc(){
  el.tocList.replaceChildren();
  for(const [index,c] of chapters.entries()){
    const li=document.createElement('li');
    const button=document.createElement('button');button.type='button';button.dataset.chapter=String(index);
    const num=document.createElement('span');num.textContent=String(index+1).padStart(2,'0');
    const info=document.createElement('span');const eyebrow=document.createElement('small');eyebrow.textContent=`CHAPTER ${index+1}`;
    const title=document.createElement('strong');title.textContent=c.title;
    info.append(eyebrow,title);button.append(num,info);li.append(button);el.tocList.append(li);
    button.addEventListener('click',()=>{el.toc.close();void loadChapter(index,0,{announceChange:true});});
  }
}
function setPreferences(){
  document.body.dataset.theme=prefs.theme;
  document.documentElement.style.setProperty('--reader-font',`${prefs.font}px`);
  el.fontSize.value=String(prefs.font);el.fontOutput.value=`${prefs.font}px`;
  el.theme.setAttribute('aria-label',`Theme ${prefs.theme}. Change reading theme.`);
  storage.set(SETTINGS_KEY,{theme:prefs.theme,font:prefs.font});
}
function reflow(){
  if(activeTurn){paperAudio.stop();activeTurn=null;el.stage.classList.remove('is-dragging');}
  const anchor=currentWord();
  pages=paginate(chapter.body);
  const found=pages.findIndex((p,i)=>i===pages.length-1||pages[i+1].startWord>anchor);
  basePage=alignPage(Math.max(0,found));
  paint();persistPosition();
}
function wireEvents(){
  el.stage.addEventListener('pointerdown',onPointerDown);
  el.stage.addEventListener('pointermove',onPointerMove);
  el.stage.addEventListener('pointerup',onPointerUp);
  el.stage.addEventListener('pointercancel',onPointerCancel);
  el.stage.addEventListener('lostpointercapture',event=>{if(activeTurn?.pointerId===event.pointerId&&!activeTurn.releasing)finishTurn(false);});
  el.stage.addEventListener('contextmenu',event=>{if(!prefs.continuous)event.preventDefault();});
  el.stage.addEventListener('copy',event=>{if(!prefs.continuous){event.preventDefault();announce('Please share the book link instead of reproducing its text.');}});
  el.prev.addEventListener('click',()=>automaticTurn('prev'));
  el.next.addEventListener('click',()=>automaticTurn('next'));
  window.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName))return;
    if(el.toc.open||el.settings.open)return;
    if(event.key==='ArrowRight'||event.key==='PageDown'){event.preventDefault();automaticTurn('next');}
    if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();automaticTurn('prev');}
  });
  el.tocButton.addEventListener('click',()=>el.toc.showModal());
  el.theme.addEventListener('click',()=>{
    prefs.theme={paper:'sepia',sepia:'night',night:'paper'}[prefs.theme];setPreferences();
  });
  el.size.addEventListener('click',()=>el.settings.showModal());
  el.fontSize.addEventListener('input',()=>{
    prefs.font=Math.max(15,Math.min(25,Number(el.fontSize.value)||18));setPreferences();
    clearTimeout(resizeTimer);resizeTimer=setTimeout(reflow,110);
  });
  el.sound.addEventListener('click',async()=>{
    if(paperAudio.enabled){paperAudio.disable();prefs.sound=false;}
    else{prefs.sound=await paperAudio.enable();if(!prefs.sound)announce('Audio is unavailable on this device.');}
    el.sound.setAttribute('aria-pressed',String(prefs.sound));
    el.sound.setAttribute('aria-label',prefs.sound?'Mute page sounds':'Enable page sounds');
    el.sound.querySelector('span').textContent=prefs.sound?'Sound on':'Sound off';
  });
  el.accessible.addEventListener('click',()=>{
    if(activeTurn){paperAudio.stop();activeTurn=null;}
    prefs.continuous=!prefs.continuous;
    document.body.classList.toggle('is-continuous',prefs.continuous);
    el.accessible.setAttribute('aria-pressed',String(prefs.continuous));
    if(prefs.continuous){showContinuous();el.continuous.hidden=false;el.stage.setAttribute('aria-hidden','true');}
    else {el.continuous.hidden=true;el.stage.removeAttribute('aria-hidden');reflow();}
    updateControls();
    announce(prefs.continuous?'Continuous text reading enabled. Text selection is available.':'Book page reading enabled.');
  });
  const watcher=new ResizeObserver(()=>{
    clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!prefs.continuous)reflow();},130);
  });watcher.observe(el.book);
  window.addEventListener('pagehide',()=>{paperAudio.stop();watcher.disconnect();clearTimeout(resizeTimer);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)paperAudio.stop();});
}

// Initialize with the real, published chapter provided by the server.
setPreferences();renderToc();wireEvents();
const desired=restoreBookmark();
if(desired.chapter!==chapterIndex)void loadChapter(desired.chapter,desired.word);
else {
  pages=paginate(chapter.body);
  const found=pages.findIndex((p,i)=>i===pages.length-1||pages[i+1].startWord>desired.word);
  basePage=alignPage(Math.max(0,found));renderSpread();persistPosition();prefetchAdjacent();
}
