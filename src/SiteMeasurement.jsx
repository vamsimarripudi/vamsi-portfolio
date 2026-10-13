import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
let loading;
export default function SiteMeasurement(){
 const {pathname}=useLocation();
 useEffect(()=>{let active=true;
  if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.type='module';script.src='/website-analytics.js';script.onload=resolve;script.onerror=()=>{loading=null;script.remove();reject(Error('Optional measurement unavailable'))};document.head.append(script)});
  loading.then(()=>{if(active)window.VMWebsiteAnalytics?.route()}).catch(()=>{/* Browsing never depends on analytics loading. */});
  return()=>{active=false;window.VMWebsiteAnalytics?.leave()};
 },[pathname]);
 return null;
}
