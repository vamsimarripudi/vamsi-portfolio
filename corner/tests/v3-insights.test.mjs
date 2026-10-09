import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {V3Insights} from '../src/v3-insights.mjs';
import {insightsPage} from '../src/v3-insights-ui.mjs';
const owner={id:'owner',role:'owner'},clock=()=>new Date('2026-10-09T14:00:00.000Z');
test('insights is flag gated, owner only and period validated',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const insights=new V3Insights(store,{env:{CORNER_V3_INSIGHTS:'0'},clock});
 assert.throws(()=>insights.summary(owner),{code:'FEATURE_DISABLED'});
 insights.env.CORNER_V3_INSIGHTS='1';
 assert.throws(()=>insights.summary({id:'member',role:'member'}),{code:'OWNER_REQUIRED'});
 assert.throws(()=>insights.summary(owner,{days:15}),{code:'INVALID_PERIOD'});
});
test('privacy: only aggregated eligible public stories and k-minimum segments',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const analytics=new V3Insights(store,{env:{CORNER_V3_INSIGHTS:'1'},clock});
 const published=store.createPost({title:'A published thought',body:'Content'},owner.id);
 const draft=store.createPost({title:'Private content',body:'Hidden'},owner.id);
 store.publish(published.id,owner.id);
 const create=(type,postId,index)=>{
  store.exec('INSERT INTO analytics_events(id,type,post_id,session_key,path,referrer_class,device_class,occurred_at) VALUES(?,?,?,?,?,?,?,?)',
   'test_'+type+'_'+index, type,postId,'unshared-pseudonym-'+index,'/post/hidden','search','mobile','2026-10-09T12:00:00.000Z');
 };
 for(let i=0;i<8;i++)create('post_open',published.id,i);
 for(let i=10;i<13;i++)create('post_open',draft.id,i);
 for(let i=0;i<2;i++)create('share',published.id,i);
 const result=analytics.summary(owner,{days:7});
 assert.equal(result.totals.storyOpens,11);
 assert.deepEqual(result.topPublishedStories.map(x=>x.slug),[published.slug]);
 assert.equal(result.referrerGroups[0].n,13);
 assert.ok(!JSON.stringify(result).includes('unshared-pseudonym'));
 assert.ok(!JSON.stringify(result).includes('Private content'));
 assert.match(insightsPage(analytics,owner),/Privacy minimum/);
});
test('small daily samples are suppressed and current windows exclude old events',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const insights=new V3Insights(store,{env:{CORNER_V3_INSIGHTS:'1'},clock});
 store.exec("INSERT INTO analytics_events(id,type,path,occurred_at) VALUES('old','page_view','/','2026-01-01T00:00:00.000Z')");
 store.exec("INSERT INTO analytics_events(id,type,path,occurred_at) VALUES('new','page_view','/','2026-10-09T09:00:00.000Z')");
 const report=insights.summary(owner,{days:30});
 assert.equal(report.totals.pageViews,1);
 assert.deepEqual(report.daily,[{day:'2026-10-09',events:null,suppressed:true}]);
});
