import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {V3Memories} from '../src/v3-memories.mjs';
import {timelinePage,albumsPage,albumPage,collectionsPage,collectionPage,memoriesStudioPage,nowHistoryPage} from '../src/v3-memories-ui.mjs';

const owner={id:'owner',role:'owner'};
const fixtures=(enabled=true)=>{
 const store=new Store(':memory:');
 new V3Engagement(store,{env:{SESSION_SECRET:'more-than-32-characters-for-local-v3-tests'}});
 const m=new V3Memories(store,{env:{CORNER_V3_MEMORIES:enabled?'1':'0'}});
 return {store,m};
};
const published=(store,title='Public moment')=>{
 const p=store.createPost({title,body:'A quiet story',type:'moment'},'owner');store.publish(p.id,'owner');return p;
};
const image=(store,post,alt='Photograph')=>{
 const id='media_'+crypto.randomUUID();
 store.addMedia({id,ownerId:post.id,storageKey:'img-'+crypto.randomBytes(8).toString('hex')+'.png',mimeType:'image/png',size:100,alt,width:12,height:10});
 return id;
};
test('Phase 2 additive migrations retain posts and replay safely',t=>{
 const {store}=fixtures();t.after(()=>store.close());
 assert.deepEqual(store.all('SELECT version FROM v3_schema_migrations ORDER BY version').map(r=>r.version),['v3-0001-engagement','v3-0002-bookmark-progress','v3-0003-memories']);
 published(store);
 new V3Engagement(store,{env:{SESSION_SECRET:'more-than-32-characters-for-local-v3-tests'}});
 assert.equal(store.one('SELECT count(*) AS n FROM v3_schema_migrations').n,3);
 assert.equal(store.one('SELECT count(*) AS n FROM posts').n,1);
});
test('Feature OFF and member role cannot read or write owner memories',t=>{
 const {store,m}=fixtures(false);t.after(()=>store.close());
 assert.throws(()=>m.timeline(),{code:'FEATURE_DISABLED'});
 assert.throws(()=>m.milestone(owner,{title:'A milestone',occurredOn:'2026-10-09'}),{code:'FEATURE_DISABLED'});
 m.env.CORNER_V3_MEMORIES='1';
 assert.throws(()=>m.milestone({id:'reader',role:'member'},{title:'A milestone',occurredOn:'2026-10-09'}),{code:'OWNER_REQUIRED'});
});
test('Timeline published-only filters and escaping survive archived linked posts',t=>{
 const {store,m}=fixtures();t.after(()=>store.close());
 const p=published(store),draft=store.createPost({title:'Secret',body:'Not published'},'owner');
 const a=m.milestone(owner,{title:'Public milestone',summary:'<img src=x onerror=alert(1)>',occurredOn:'2026-10-09',kind:'build',postId:p.id,state:'published'});
 m.milestone(owner,{title:'Private event',occurredOn:'2026-10-08',state:'draft'});
 assert.throws(()=>m.milestone(owner,{title:'Not allowed',occurredOn:'2026-10-09',postId:draft.id,state:'published'}),{code:'POST_NOT_PUBLIC'});
 assert.throws(()=>m.milestone(owner,{title:'Invalid date',occurredOn:'2026-02-30'}),{code:'INVALID_DATE'});
 assert.equal(m.timeline({kind:'build',year:'2026'}).items.length,1);
 assert.equal(m.timeline({kind:'learning'}).items.length,0);
 assert.doesNotMatch(timelinePage(m,{}),/<img src=x onerror/);
 assert.match(timelinePage(m,{}),/&lt;img/);
 store.archive(p.id,'owner');
 assert.equal(m.timeline().items.length,0);
 assert.equal(m.milestone(owner,{title:a.title,state:'archived'},a.id).state,'archived');
});
test('Album publication requires published images; drafts and archived posts stay private',t=>{
 const {store,m}=fixtures();t.after(()=>store.close());
 const p=published(store),hidden=store.createPost({title:'Draft',body:'Private'},'owner');
 const valid=image(store,p,'A clear day'),privateImage=image(store,hidden,'Secret GPS');
 assert.throws(()=>m.albumWrite(owner,{title:'Unsafe',state:'published',mediaIds:[privateImage]}),{code:'MEDIA_NOT_PUBLIC'});
 const a=m.albumWrite(owner,{title:'Safe album',state:'draft',mediaIds:[valid]});
 assert.equal(m.albums().length,0);
 m.albumWrite(owner,{state:'published'},a.id);
 assert.equal(m.album(a.slug).images[0].alt,'A clear day');
 assert.match(albumPage(m,a.slug),/aria-haspopup="dialog" aria-label="Open photo 1 of 1: A clear day"/);
 assert.match(albumPage(m,a.slug),/data-v3m-prev aria-label="Previous photograph"/);
 assert.match(albumsPage(m),/loading="lazy"/);
 store.archive(p.id,'owner');
 assert.equal(m.albums().length,0);
 assert.throws(()=>m.album(a.slug),{code:'NOT_FOUND'});
});
test('Curated collection respects stored order and published-only read visibility',t=>{
 const {store,m}=fixtures();t.after(()=>store.close());
 const a=published(store,'First'),b=published(store,'Second');
 const draft=store.createPost({title:'Hidden',body:'Secret'},'owner');
 assert.throws(()=>m.collectionWrite(owner,{title:'Not allowed',state:'published',postIds:[draft.id]}),{code:'POST_NOT_PUBLIC'});
 const c=m.collectionWrite(owner,{title:'A series',state:'published',postIds:[b.id,a.id]});
 assert.deepEqual(m.collection(c.slug).posts.map(p=>p.id),[b.id,a.id]);
 assert.match(collectionPage(m,c.slug),/First/);
 assert.match(collectionsPage(m),/A series/);
 store.archive(b.id,'owner');
 assert.deepEqual(m.collection(c.slug).posts.map(p=>p.id),[a.id]);
 store.archive(a.id,'owner');
 assert.equal(m.collections().length,0);
});
test('Now history is private for inactive entries and audited for owner',t=>{
 const {store,m}=fixtures();t.after(()=>store.close());
 m.recordNow(owner,{label:'The start',detail:'A new day',icon:'✳',isActive:true});
 m.recordNow(owner,{label:'Private preview',detail:'Never publish this',icon:'✳',isActive:false});
 assert.equal(m.adminNowHistory(owner).length,2);
 assert.equal(m.nowHistory().length,1);
 assert.doesNotMatch(nowHistoryPage(m,store.currentStatus()),/Private preview/);
 assert.throws(()=>m.recordNow({role:'member',id:'reader'},{label:'No'}),{code:'OWNER_REQUIRED'});
 assert.match(memoriesStudioPage(m,owner),/Memories Studio/);
});
