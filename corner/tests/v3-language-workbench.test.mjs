import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {V3Languages} from '../src/v3-languages.mjs';
import {languageStudioPage} from '../src/v3-languages-ui.mjs';

const actor={id:'owner-review',role:'owner'};
const env={NODE_ENV:'test',CORNER_V3_LANGUAGES:'1',SESSION_SECRET:'test-session-not-a-production-credential'};

test('owner workbench exposes real published story metadata and an individual published source only',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const lang=new V3Languages(store,{env});
 const first=store.createPost({title:'A current published thought',body:'The original long-form content.',excerpt:'Original preview.',type:'journal'},actor.id);
 const draft=store.createPost({title:'Never published',body:'Private body must not leak.',type:'journal'},actor.id);
 const published=store.publish(first.id,actor.id);
 const list=lang.sources(actor);
 assert.equal(list.length,1);
 assert.equal(list[0].id,published.id);
 assert.equal(list[0].title,published.title);
 assert.ok(!Object.hasOwn(list[0],'body'),'Collection endpoint should not download every article body');
 const source=lang.sourceForStudio(actor,published.id);
 assert.equal(source.body,'The original long-form content.');
 assert.equal(source.version,published.version);
 assert.throws(()=>lang.sourceForStudio(actor,draft.id),{code:'SOURCE_NOT_FOUND'});
 assert.throws(()=>lang.sources({id:'member',role:'member'}),{code:'OWNER_REQUIRED'});
 assert.throws(()=>lang.sourceForStudio({id:'member',role:'member'},published.id),{code:'OWNER_REQUIRED'});
 assert.match(languageStudioPage(lang,actor),/data-v3-language-form/);
 assert.match(languageStudioPage(lang,actor),/data-v3-language-source/);
});

test('published locale cannot remain counted as live after original story archive',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const lang=new V3Languages(store,{env});
 const post=store.createPost({title:'One real English story',body:'Original.',type:'journal'},actor.id);
 store.publish(post.id,actor.id);
 const draft=lang.save(actor,{postId:post.id,language:'te',title:'కథ',body:'ఈ కథ తెలుగు లో ఉంది'});
 const reviewed=lang.review(actor,post.id,'te',{confirm:true,revision:draft.revision});
 assert.equal(reviewed.state,'published');
 assert.equal(lang.list(actor)[0].needsReview,false);
 store.archive(post.id,actor.id);
 const stale=lang.list(actor)[0];
 assert.equal(stale.sourceState,'archived');
 assert.equal(stale.needsReview,true,'Archived originals must be excluded from live translation totals');
 assert.equal(lang.sources(actor).length,0);
 assert.throws(()=>lang.sourceForStudio(actor,post.id),{code:'SOURCE_NOT_FOUND'});
});
