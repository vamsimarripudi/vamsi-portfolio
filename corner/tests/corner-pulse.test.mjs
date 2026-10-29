import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {V3Engagement} from '../src/v3-engagement.mjs';
import {V3Memories} from '../src/v3-memories.mjs';
const hours=24*60*60*1000;

test('Corner Pulse expires server-side 24 hours after publishing and never deletes posts',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const before=Date.now();
 const pulse=store.updateStatus({label:'Building quietly',detail:'A little update for today',icon:'✦',isActive:true},null);
 assert.equal(pulse.label,'Building quietly');
 assert.equal(pulse.durationHours,24);
 assert.ok(Date.parse(pulse.expiresAt)-before>=hours-2000);
 assert.ok(Date.parse(pulse.expiresAt)-before<=hours+2000);
 assert.equal(store.currentStatus()?.label,'Building quietly');
 const data=store.one('SELECT * FROM site_status WHERE id=1');
 assert.ok(data.active_until,'Expiry is persisted in SQLite, not just a browser timer');
 store.exec('UPDATE site_status SET active_until=? WHERE id=1',new Date(Date.now()-1000).toISOString());
 assert.equal(store.currentStatus(),null,'Read hides expired status without cron');
 const legacy=new Date(Date.now()-hours-1000).toISOString();
 store.exec('UPDATE site_status SET active_until=NULL,updated_at=? WHERE id=1',legacy);
 assert.equal(store.currentStatus(),null,'Legacy permanent status also expires after 24 hours');
});
test('Updating Pulse resets the 24h window; owner can hide immediately; expiry cannot be extended',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const a=store.updateStatus({label:'Morning',isActive:true},null);
 const b=store.updateStatus({label:'Evening',isActive:true,activeUntil:new Date(Date.now()+72*60*60*1000).toISOString()},null);
 assert.equal(b.label,'Evening');
 assert.ok(Date.parse(b.expiresAt)<=Date.now()+hours+2000,'Owner input cannot extend expiry past 24h');
 assert.ok(b.version>a.version);
 store.updateStatus({label:'Evening',isActive:false},null);
 assert.equal(store.currentStatus(),null);
});
test('Public Pulse history never discloses expired or replaced updates; owner audit retains records',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 new V3Engagement(store,{env:{SESSION_SECRET:'corner-pulse-review-long-secure-secret'}});
 const memories=new V3Memories(store,{env:{CORNER_V3_MEMORIES:'1'}});
 const owner={id:'owner',role:'owner'};
 store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('owner','owner@fixture.test','Owner','owner','hash',datetime('now'),datetime('now'))");
 memories.recordNow(owner,{label:'First Pulse',detail:'Yesterday',isActive:true});
 memories.recordNow(owner,{label:'Second Pulse',detail:'Right now',isActive:true});
 assert.deepEqual(memories.nowHistory().map(x=>x.label),['Second Pulse'],'Only current is public');
 assert.equal(memories.adminNowHistory(owner).length,2);
 store.exec('UPDATE site_status SET active_until=? WHERE id=1',new Date(Date.now()-1000).toISOString());
 assert.deepEqual(memories.nowHistory(),[],'Expired status is not publicly archived');
 assert.equal(memories.adminNowHistory(owner).length,2,'Private owner audit is still available');
});
