/* Local image crop before Corner's existing sanitized upload pipeline. */
(() => {
  'use strict';
  const supported=new Set(['image/jpeg','image/png','image/webp']);
  const originalName=(file,extension)=>file.name.replace(/\.[^.]+$/,'')+'-cropped.'+extension;
  async function open(file){
    if(!file||!supported.has(file.type))throw new Error('Crop JPG, PNG or WebP images. GIF animations keep their original frames.');
    if(typeof createImageBitmap!=='function')throw new Error('Image cropping is unavailable in this browser.');
    const bitmap=await createImageBitmap(file);
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');
      dialog.className='corner-crop-dialog';
      dialog.setAttribute('aria-label','Adjust image crop');
      dialog.innerHTML='<div class="corner-crop-inner">'+
        '<header><div><p class="eyebrow">IMAGE STUDIO</p><h2>Frame the moment.</h2><p>Adjust the focal point before attaching.</p></div><button data-crop-cancel type="button" aria-label="Close crop dialog">×</button></header>'+
        '<canvas width="1200" height="750" aria-label="Live image crop preview"></canvas>'+
        '<fieldset class="corner-crop-ratios"><legend>Image shape</legend><label><input type="radio" name="ratio" value="1.6" checked>Landscape</label><label><input type="radio" name="ratio" value="1">Square</label><label><input type="radio" name="ratio" value="0.8">Portrait</label><label><input type="radio" name="ratio" value="1.7777778">Wide</label></fieldset>'+
        '<div class="corner-crop-controls"><label>Zoom <input type="range" data-crop-zoom min="1" max="2.5" step=".05" value="1"></label>'+
        '<label>Move left / right <input type="range" data-crop-x min="0" max="100" value="50"></label>'+
        '<label>Move up / down <input type="range" data-crop-y min="0" max="100" value="50"></label></div>'+
        '<p class="corner-crop-message" role="status" aria-live="polite">The original image is kept unless you apply the crop.</p>'+
        '<div class="corner-crop-actions"><button type="button" data-crop-cancel class="corner-crop-secondary">Keep original</button><button type="button" data-crop-save>Apply crop ↗</button></div></div>';
      document.body.append(dialog);
      const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d');
      const ratioInputs=[...dialog.querySelectorAll('[name=ratio]')];
      const x=dialog.querySelector('[data-crop-x]'),y=dialog.querySelector('[data-crop-y]'),zoom=dialog.querySelector('[data-crop-zoom]');
      const message=dialog.querySelector('[role=status]'),save=dialog.querySelector('[data-crop-save]');
      let completed=false;
      function paint(){
        const ratio=Number(ratioInputs.find(r=>r.checked)?.value||1.6);
        const width=Math.min(1440,Math.max(640,Math.round(bitmap.width)));
        canvas.width=width;
        canvas.height=Math.round(width/ratio);
        const scale=Math.max(width/bitmap.width,canvas.height/bitmap.height)*Number(zoom.value);
        const destWidth=bitmap.width*scale,destHeight=bitmap.height*scale;
        const left=(width-destWidth)*Number(x.value)/100;
        const top=(canvas.height-destHeight)*Number(y.value)/100;
        ctx.clearRect(0,0,width,canvas.height);
        if(file.type==='image/jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,canvas.height)}
        ctx.drawImage(bitmap,left,top,destWidth,destHeight);
      }
      function cleanup(){
        if(!completed){completed=true;resolve(null)}
        bitmap.close?.();dialog.remove();
      }
      dialog.addEventListener('close',cleanup,{once:true});
      dialog.querySelectorAll('[data-crop-cancel]').forEach(b=>b.addEventListener('click',()=>dialog.close()));
      for(const field of [...ratioInputs,x,y,zoom])field.addEventListener('input',paint);
      save.addEventListener('click',()=>{
        save.disabled=true;message.textContent='Preparing the cropped image…';
        const mime=file.type;
        canvas.toBlob(blob=>{
          if(!blob||blob.size>8*1024*1024){message.textContent='This crop is larger than the 8 MB image limit. Try another shape or keep the original.';save.disabled=false;return}
          const ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp';
          const cropped=new File([blob],originalName(file,ext),{type:mime,lastModified:Date.now()});
          completed=true;resolve(cropped);
          dialog.close();
        },mime,(mime==='image/jpeg'||mime==='image/webp')?0.9:undefined);
      });
      dialog.showModal();
      paint();
    });
  }
  window.CornerImageCrop={open};
})();