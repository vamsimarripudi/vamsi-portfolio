import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
test('FTS5 search ranks published stories and keeps drafts and archives private',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('owner','owner@example.test','Owner','owner','hash',datetime('now'),datetime('now'))");
 const published=store.createPost({title:'Cyclone palms',body:'This story is about a powerful coastal storm and coconut trees.'},'owner');
 const draft=store.createPost({title:'Secret Cyclone experimental draft',body:'Hidden storm text.'},'owner');
 store.publish(published.id,'owner');
 assert.equal(store.ftsEnabled,true,'FTS5 is available in our supported Node/SQLite runtime');
 assert.deepEqual(store.search('Cyclone').map(x=>x.id),[published.id]);
 assert.equal(store.search('Secret').length,0,'No private draft leaks from index');
 assert.equal(store.search('coconut').length,1,'Body is indexed');
 store.archive(published.id,'owner');
 assert.equal(store.search('Cyclone').length,0,'Archive is excluded even before index removal');
 assert.ok(store.one('SELECT COUNT(*) n FROM corner_v6_search').n>=2,'Derived index retains historical rows');
});
test('Unicode query and malicious FTS syntax never escape the published-only boundary',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('owner','owner@example.test','Owner','owner','hash',datetime('now'),datetime('now'))");
 const post=store.createPost({title:'తెలుగు కథ',body:'ఒక మంచి కథ'},'owner');
 store.publish(post.id,'owner');
 const indic=store.search('తెలుగు');
 assert.ok(indic.some(x=>x.id===post.id),'Indic exact term is discoverable');
 assert.doesNotThrow(()=>store.search('" ) OR * ^ !'));
 assert.equal(store.search(''),[]);
});
