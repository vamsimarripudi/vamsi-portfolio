import {basePage,header,footer,escapeHtml} from './ui.mjs';
const e=escapeHtml;
const metric=(label,value)=>'<article class="v3a-kpi"><span>'+e(label)+'</span><strong>'+Number(value).toLocaleString('en-IN')+'</strong></article>';
export function insightsPage(insights,actor,{days=7}={}){
 const report=insights.summary(actor,{days});
 const link=span=>'<a href="/admin/v3/insights?days='+span+'"'+(report.window.days===span?' aria-current="page"':'')+'>'+span+' days</a>';
 const max=Math.max(5,...report.daily.map(x=>x.events||0));
 const trend='<div class="v3a-trend" role="list" aria-label="Daily event totals; small samples withheld">'+
  report.daily.map(x=>'<div role="listitem" class="v3a-bar" title="'+e(x.day)+'">'+
   '<span class="v3a-pillar" style="height:'+Math.max(5,Math.round((x.events||0)/max*100))+'%"></span>'+
   '<small>'+e(x.day.slice(5))+'</small><span class="v3a-sr">'+(x.suppressed?'Fewer than five events':x.events+' events')+'</span></div>').join('')+'</div>';
 const top=report.topPublishedStories.map((x,i)=>'<li><span>'+String(i+1).padStart(2,'0')+'</span><a href="/post/'+encodeURIComponent(x.slug)+'">'+e(x.title)+'</a><strong>'+x.opens+'</strong></li>').join('');
 const content=header()+'<main id="content" class="shell v3a-page"><a class="v3a-back" href="/admin">← Studio</a>'+
  '<p class="v3a-eyebrow">OWNER / PRIVACY-FIRST INSIGHTS</p><h1>Insights<span>.</span></h1>'+
  '<p class="v3a-lead">Only aggregated first-party signals. No visitor profiles or third-party pixels.</p>'+
  '<nav class="v3a-periods" aria-label="Reporting period">'+[7,30,90].map(link).join('')+'</nav>'+
  '<section class="v3a-kpis" aria-label="Summary">'+metric('Page views',report.totals.pageViews)+
   metric('Story opens',report.totals.storyOpens)+metric('Shares',report.totals.shares)+'</section>'+
  '<div class="v3a-layout"><section class="v3a-panel"><h2>Recent activity</h2>'+trend+
  '<small>Daily groups below five are hidden.</small></section>'+
  '<section class="v3a-panel"><h2>Most read stories</h2><ol class="v3a-top">'+(top||'<li>No story has reached the privacy threshold.</li>')+'</ol></section></div>'+
  '<p class="v3a-privacy">Privacy minimum: five events per reported segment · Raw pseudonymous events retain their existing 90-day lifecycle.</p>'+
  '</main>'+footer();
 return basePage({title:'Private Insights',path:'/admin/v3/insights',content,noindex:true,initial:{page:'insights'}});
}
