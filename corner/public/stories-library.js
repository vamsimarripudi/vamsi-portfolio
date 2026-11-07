/** Accessible, progressive-enhancement filtering; all book data is server rendered. */
const input=document.getElementById('storySearch');
if(input){
  const cards=[...document.querySelectorAll('[data-story-card]')];
  const empty=document.getElementById('noResults');
  input.addEventListener('input',()=>{
    const needle=input.value.trim().toLocaleLowerCase().slice(0,80);
    let visible=0;
    for(const card of cards){
      const show=!needle||(card.dataset.search||'').includes(needle);
      card.hidden=!show; if(show)visible++;
    }
    if(empty)empty.hidden=visible!==0;
  });
}
