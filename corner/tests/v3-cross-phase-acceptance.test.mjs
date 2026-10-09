import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {V3Memories} from '../src/v3-memories.mjs';
import {WishesStudio} from '../src/v3-wishes.mjs';
import {WishDelivery} from '../src/v3-wish-delivery.mjs';
import {V3Languages} from '../src/v3-languages.mjs';
import {V3Insights} from '../src/v3-insights.mjs';
import {renderSyndication} from '../src/v3-syndication.mjs';
const env={
 NODE_ENV:'test',SITE_URL:'https://vamsimarripudi.me/corner',
 SESSION_SECRET:'test-full-lifecycle-session-secret-is-strong-enough',
 CORNER_V3_FOLLOW_KEY:'test-full-lifecycle-dedicated-stable-follow-key-v3',
 CORNER_V3_MEMORIES:'1',CORNER_V3_SEARCH:'1',
 CORNER_V3_FOLLOW:'1',CORNER_V3_WISHES:'1',CORNER_V3_WISH_DELIVERY:'1',
 CORNER_V3_INSIGHTS:'1',CORNER_V3_LANGUAGES:'1'
};
const owner={id:'owner',role:'owner'};

test('Phases 3+4 integrate: owner wish → published feed → approved locale → opt-in mail → unsubscribe → private insight',async t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const sent=[],mailer=async message=>{sent.push(message);return {accepted:true}};
 const follow=new V3Engagement(store,{env,sendMail:mailer});
 const memories=new V3Memories(store,{env});
 const wishes=new WishesStudio(store,{env});
 const delivery=new WishDelivery(store,{env,sendMail:mailer});
 const languages=new V3Languages(store,{env});
 const insight=new V3Insights(store,{env});
 assert.ok(memories.enabled());
 for(const version of ['v3-0003-memories','v3-0004-wish-delivery','v3-0005-languages'])
  assert.ok(store.one('SELECT version FROM v3_schema_migrations WHERE version=?',version),version+' schema applied');
 const preview=wishes.preview(owner,{title:'A kind wish',body:'Good moments are worth keeping'});
 assert.match(preview.reminder,/Preview only/,'Preview explicitly remains private and unsent');
 assert.equal(sent.length,0,'Preview does not send mail');
 const draft=wishes.create(owner,{title:'A kind wish',body:'Good moments are worth keeping',timezone:'Asia/Kolkata'});
 assert.equal(draft.state,'draft');
 const rssBefore=renderSyndication(store,{format:'rss',baseUrl:env.SITE_URL}).xml;
 assert.doesNotMatch(rssBefore,/A kind wish/,'Draft stays out of public feeds');
 assert.equal(sent.length,0,'Draft save does not contact recipients');
 const published=wishes.publish(owner,draft.id);
 assert.equal(published.state,'published');
 assert.equal(sent.length,0,'Publishing does not automatically notify subscribers');
 const rss=renderSyndication(store,{format:'rss',baseUrl:env.SITE_URL}).xml;
 const atom=renderSyndication(store,{format:'atom',baseUrl:env.SITE_URL}).xml;
 assert.match(rss,/A kind wish/);
 assert.match(atom,/A kind wish/);
 const translation=languages.save(owner,{postId:published.id,language:'te',title:'శుభాకాంక్షలు',body:'అందమైన రోజులు'});
 assert.equal(languages.localize(store.getPost(published.slug),'te').language,'en','Unapproved translation stays private');
 assert.throws(()=>languages.review(owner,published.id,'te',{publish:true,revision:translation.revision}),{code:'REVIEW_REQUIRED'});
 const approved=languages.review(owner,published.id,'te',{publish:true,confirm:true,revision:translation.revision});
 assert.equal(approved.state,'published');
 assert.equal(languages.localize(store.getPost(published.slug),'te').language,'te');
 await follow.follow({email:'lifecycle@example.test',topics:['wishes'],frequency:'instant',consent:true});
 assert.equal(sent.length,1,'Subscription starts only with a verification email');
 const confirmation=sent.at(-1).text.match(/#token=([A-Za-z0-9_-]+)/)?.[1];
 assert.ok(confirmation,'Verification token is present');
 follow.verifyFollow(confirmation);
 assert.throws(()=>follow.verifyFollow(confirmation),{code:'TOKEN_INVALID'},'Verification token is one-time');
 assert.equal(delivery.enqueue(owner,published.id,{confirm:true}).queued,1);
 assert.equal(delivery.enqueue(owner,published.id,{confirm:true}).queued,0,'Campaign is idempotent');
 assert.equal(sent.length,1,'Queue does not bypass delivery worker');
 const dispatch=await delivery.drain({limit:5});
 assert.equal(dispatch.sent,1);
 assert.equal(sent.length,2);
 assert.equal(sent[1].to,'lifecycle@example.test');
 assert.match(sent[1].text,/Unsubscribe:/);
 const unsub=sent[1].text.match(/\/follow\/unsubscribe#token=([A-Za-z0-9_-]+)/)?.[1];
 assert.ok(unsub,'Delivered mail includes an opt-out token');
 assert.deepEqual(follow.unsubscribeFollow(unsub),{unsubscribed:true});
 assert.throws(()=>follow.unsubscribeFollow(unsub),{code:'TOKEN_INVALID'},'Opt-out token is one-time');
 const second=wishes.create(owner,{title:'Another wish',body:'A happy afternoon'});
 wishes.publish(owner,second.id);
 assert.equal(delivery.enqueue(owner,second.id,{confirm:true}).queued,0,'Unsubscribed recipient is suppressed');
 for(let i=0;i<7;i++)store.exec(
  'INSERT INTO analytics_events(id,type,post_id,path,occurred_at) VALUES(?,?,?,?,?)',
  'phase4_insight_'+i,'post_open',published.id,'/post/'+published.slug,new Date().toISOString()
 );
 const stats=insight.summary(owner,{days:7});
 assert.equal(stats.privacy.firstPartyOnly,true);
 assert.equal(stats.privacy.individualSessionsExposed,false);
 assert.ok(stats.topPublishedStories.some(x=>x.slug===published.slug));
 const serialized=JSON.stringify(stats)+JSON.stringify(delivery.snapshot(owner));
 assert.doesNotMatch(serialized,/lifecycle@example.test|token=/,'No email or one-time token leaked through private aggregate APIs');
 store.archive(published.id,owner.id);
 assert.equal(languages.localize(store.getPost(published.slug),'te'),null,'Archived source and its translation are not publicly accessible');
 assert.doesNotMatch(renderSyndication(store,{format:'rss',baseUrl:env.SITE_URL}).xml,/A kind wish/);
});
