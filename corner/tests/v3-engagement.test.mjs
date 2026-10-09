import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
test('V3 search filters published items and respects feature gate',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const env={CORNER_V3_SEARCH:'1',SESSION_SECRET:'test-only-secret-longer-than-thirty-two-characters'};
 const v3=new V3Engagement(store,{env});
 const published=store.createPost({title:'A star % moment',body:'Quiet summer notes',type:'tech_note',tags:['Life']},'qa');
 store.publish(published.id,'qa');
 store.createPost({title:'A hidden % note',body:'private',type:'tech_note',tags:['Life']},'qa');
 assert.equal(v3.search({q:'%'}).total,1);
 assert.equal(v3.search({tag:'Life'}).total,1);
 assert.equal(v3.search({tag:'Li'}).total,0);
 assert.equal(v3.archive().years.length,1);
 env.CORNER_V3_SEARCH='0';
 assert.throws(()=>v3.search({q:'star'}),{code:'FEATURE_DISABLED'});
});
test('V3 guestbook submissions are moderated and consent-gated',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const v3=new V3Engagement(store,{env:{CORNER_V3_GUESTBOOK:'1',SESSION_SECRET:'test-only-secret-longer-than-thirty-two-characters'}});
 assert.throws(()=>v3.submitGuestbook({name:'Reader',message:'A quiet word'}),{code:'CONSENT_REQUIRED'});
 const result=v3.submitGuestbook({name:'Reader',message:'A thoughtful little message',consent:true});
 assert.equal(result.state,'pending');
 assert.equal(v3.listGuestbook().length,0);
 const rows=v3.reviewQueue({id:'owner',role:'owner'});
 v3.manageGuestbook({id:'owner',role:'owner'},{id:rows[0].id,state:'approved'});
 assert.equal(v3.listGuestbook().length,1);
});
