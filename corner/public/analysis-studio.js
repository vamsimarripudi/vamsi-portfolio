// Private analytics is loaded only when the Studio section is opened.
(()=>{
 let loading,revision=0;
 window.CornerAnalysis={
  async mount(root){const version=++revision;if(!loading)loading=Promise.all(['analysis-widgets.js','analysis-explore.js'].map(file=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/corner/'+file;s.onload=resolve;s.onerror=()=>{loading=null;reject(Error('Analytics could not load. Retry this section.'))};document.head.append(s)})));try{await loading}catch(error){if(version===revision)throw error;return}if(version===revision&&root.isConnected)return window.CornerExplore.mount(root)},
  unmount(){revision++;window.CornerExplore?.unmount()}
 };
})();
