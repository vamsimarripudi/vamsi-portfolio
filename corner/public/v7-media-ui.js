/* Studio V7, progressive enhancement: photo-first library and select → options → add.
   Existing first-party upload pipeline remains authoritative. */
(()=>{
 'use strict';
 const styles={original:'',warm:'sepia(.18) hue-rotate(-9deg) saturate(1.1)',film:'sepia(.24) contrast(1.12) saturate(.8)',mono:'grayscale(1)',dream:'sepia(.08) saturate(1.25)'};
 function mountLibrary(root){
  const grid=root?.querySelector('.corner-library-grid');if(!grid||grid.dataset.v7Library)return;
  grid.dataset.v7Library='true';
  for(const card of grid.querySelectorAll('.media-thumb--library')){
   card.classList.add('v7-library-tile');
   const view=card.querySelector('.media-view-link'),edit=card.querySelector('[data-media-edit]');
   if(view&&edit){
    view.removeAttribute('target');view.removeAttribute('rel');
    view.setAttribute('aria-label','Open photo or video details');
    view.addEventListener('click',event=>{event.preventDefault();edit.click()});
   }
  }
 }
 function mountAttachment(section,form){
  if(!section||!form||form.dataset.v7Enhanced)return;
  form.dataset.v7Enhanced='true';form.dataset.v7Stage='select';
  const input=form.elements.files,previews=form.querySelector('[data-upload-previews]'),button=form.querySelector('button[type=submit]');
  const status=form.querySelector('[data-upload-status]');
  if(!input||!previews||!button)return;
  const header=document.createElement('div');header.className='v7-stage-heading';header.hidden=true;
  header.innerHTML='<button type="button" class="v7-stage-back">← Back</button><span>STEP 2 OF 2</span>'+
   '<h3>Make it yours.</h3><p>Crop or adjust your photos. Captions and descriptions are optional.</p>';
  const tabs=document.createElement('div');tabs.className='v7-media-tabs';tabs.setAttribute('aria-label','Selected media');
  header.append(tabs);previews.before(header);
  let activeIndex=0;
  const safeNumber=(value,def)=>{const n=Number(value);return Number.isFinite(n)?n:def};
  const adorn=card=>{
   if(card.dataset.v7Decorated)return;
   card.dataset.v7Decorated='true';
   const figure=card.querySelector('figure'),fields=card.children[1];
   if(!figure||!fields)return;
   fields.classList.add('v7-photo-options');
   const alt=fields.querySelector('input[name=alt]'),caption=fields.querySelector('input[name=caption]');
   if(alt)alt.required=false;
   const more=document.createElement('details');more.className='v7-more-options';
   const summary=document.createElement('summary');summary.textContent='More options · Caption and description';
   more.append(summary);
   for(const label of [alt?.closest('label'),caption?.closest('label')])if(label)more.append(label);
   fields.append(more);
   const image=figure.querySelector('img');
   if(image){
    const panel=document.createElement('div');panel.className='v7-image-tuning';
    panel.innerHTML='<label>Look <select name="v7-preset">'+
      '<option value="original">Original</option><option value="warm">Warm</option><option value="film">Film</option>'+
      '<option value="mono">Black & white</option><option value="dream">Dreamy</option></select></label>'+
      '<label>Rotate <select name="v7-rotation"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>'+
      '<label>Brightness <input type="range" name="v7-brightness" min="0.6" max="1.4" step=".05" value="1"></label>'+
      '<label>Contrast <input type="range" name="v7-contrast" min="0.6" max="1.4" step=".05" value="1"></label>'+
      '<label>Color <input type="range" name="v7-saturation" min="0" max="2" step=".05" value="1"></label>';
    fields.insertBefore(panel,fields.firstChild);
    const adjust=()=>{
     const read=name=>panel.querySelector('[name='+name+']')?.value;
     image.style.filter=(styles[read('v7-preset')]||'')+' brightness('+safeNumber(read('v7-brightness'),1)+') contrast('+safeNumber(read('v7-contrast'),1)+') saturate('+safeNumber(read('v7-saturation'),1)+')';
     image.style.transform='rotate('+safeNumber(read('v7-rotation'),0)+'deg)';
    };
    panel.addEventListener('input',adjust);panel.addEventListener('change',adjust);adjust();
   }
  };
  const selectedCards=()=>[...previews.querySelectorAll('.upload-preview-card')];
  const refresh=()=>{
   const cards=selectedCards();
   cards.forEach(adorn);
   tabs.replaceChildren();
   cards.forEach((card,index)=>{
    const tab=document.createElement('button');tab.type='button';
    tab.className='v7-media-tab';tab.textContent='Photo '+(index+1);
    tab.setAttribute('aria-pressed',String(index===activeIndex));
    tab.onclick=()=>{activeIndex=index;refresh()};
    tabs.append(tab);
    card.hidden=form.dataset.v7Stage==='options'&&index!==activeIndex;
   });
   if(form.dataset.v7Stage==='select')button.textContent=cards.length===1?'Attach selected file →':'Attach '+cards.length+' selected files →';
   else button.textContent='Add '+cards.length+(cards.length===1?' file':' files')+' to post ✓';
  };
  const changeStage=stage=>{
   form.dataset.v7Stage=stage;header.hidden=stage!=='options';
   activeIndex=Math.min(activeIndex,Math.max(0,selectedCards().length-1));
   refresh();
   if(stage==='options')header.querySelector('.v7-stage-back').focus({preventScroll:true});
   else input.focus({preventScroll:true});
  };
  const observer=new MutationObserver(()=>{if(form.dataset.v7Stage==='select')refresh()});
  observer.observe(previews,{childList:true});
  header.querySelector('.v7-stage-back').onclick=()=>changeStage('select');
  form.addEventListener('submit',event=>{
   if(form.dataset.v7Stage!=='select')return;
   if(!selectedCards().length)return;
   event.preventDefault();event.stopImmediatePropagation();
   changeStage('options');if(status)status.textContent='Review your adjustments, then choose Add to post.';
  },true);
  section.addEventListener('close',()=>observer.disconnect(),{once:true});
  refresh();
 }
 window.CornerMediaV7=Object.freeze({mountLibrary,mountAttachment});
})();
