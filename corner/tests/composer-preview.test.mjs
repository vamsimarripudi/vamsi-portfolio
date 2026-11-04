import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/store.mjs';
import {JournalSeries} from '../src/journal-series.mjs';
import {composerPreview} from '../src/composer-preview.mjs';
import {config} from '../src/config.mjs';

function fixture(t){
  const store=new Store(':memory:');
  t.after(()=>store.close());
  store.exec("INSERT INTO users(id,email,display_name,role,password_hash,created_at,updated_at) VALUES('owner','owner@preview.test','Preview Owner','owner','hash',datetime('now'),datetime('now'))");
  const journal=new JournalSeries(store);
  const create=(fields={})=>store.createPost({type:'tech_note',title:'Saved title',excerpt:'Saved summary',body:'Saved writing.',allowComments:true,allowReactions:true,...fields},'owner');
  return {store,journal,create};
}
const changes=store=>store.one('SELECT total_changes() AS count').count;
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const previewSource=(fields={})=>({type:'tech_note',title:'My unsaved title',excerpt:'My unsaved summary',body:'My unsaved writing.',allowComments:true,allowReactions:true,...fields});

test('preview renders current unsaved writing and leaves saved content and input intact',t=>{
  const {store,journal,create}=fixture(t);
  const saved=create();
  const source=Object.freeze(previewSource({body:'తెలుగులో నా ఆలోచన.\n\nA second paragraph with <literal markup> & punctuation.\nA deliberate line break.'}));
  const input=Object.freeze({postId:saved.id,post:source});
  const before=changes(store);
  const result=composerPreview(store,journal,input);
  assert.equal(result.private,true);
  assert.equal(result.previewOnly,true);
  assert.equal(result.mediaCount,0);
  assert.match(result.feedHtml,/>My unsaved title</);
  assert.match(result.feedHtml,/>My unsaved summary</);
  assert.match(result.fullHtml,/<div class="post-body"><p>తెలుగులో నా ఆలోచన\.<\/p><p>A second paragraph with &lt;literal markup&gt; &amp; punctuation\.<br>A deliberate line break\.<\/p>/);
  assert.doesNotMatch(result.feedHtml,/Saved title|Saved summary/);
  assert.doesNotMatch(result.fullHtml,/Saved writing\./);
  assert.deepEqual(store.adminPost(saved.id),saved);
  assert.equal(input.post,source);
  assert.equal(changes(store),before,'Preview must not write any database record');
});

test('preview preserves the full supported title, summary and 25,000-character writing range',t=>{
  const {store,journal}=fixture(t);
  const title='T'.repeat(142)+'TITLEEND';
  const excerpt='S'.repeat(350)+' — complete summary';
  const body='Writing. '.repeat(2600)+'\n\nThe final paragraph must remain visible.';
  assert.equal(title.length,150);
  assert.ok(excerpt.length>280&&excerpt.length<=380);
  assert.ok(body.length>20000&&body.length<=25000);
  const before=changes(store);
  const result=composerPreview(store,journal,{post:previewSource({title,excerpt,body})});
  assert.ok(result.feedHtml.includes(escape(title)),'The preview must include the accepted 150-character title');
  assert.ok(result.feedHtml.includes(escape(excerpt)),'The preview must include the full accepted summary');
  assert.ok(result.fullHtml.includes('<p>The final paragraph must remain visible.</p>'),'Long writing must not silently lose its final paragraphs');
  assert.equal(changes(store),before);
  assert.equal(store.allAdminPosts().length,0,'An unsaved preview must not create a draft');
});

test('preview is script-free, has no submission or navigation actions, and escapes hostile text',t=>{
  const {store,journal}=fixture(t);
  const source=previewSource({
    title:'<img src=x onerror="alert(1)">',
    excerpt:'</title><script>location="https://example.invalid"</script>',
    body:'<script>alert("preview")</script>\n\n<a href="https://example.invalid">A link as text</a>\n\n<form action="/api/anything"><button>Submit</button></form>',
  });
  const before=changes(store);
  const result=composerPreview(store,journal,{post:source});
  for(const html of [result.feedHtml,result.fullHtml]){
    assert.doesNotMatch(html,/<script\b/i);
    assert.doesNotMatch(html,/<form\b/i);
    assert.doesNotMatch(html,/<a\b[^>]*\bhref\s*=/i);
    for(const tag of html.matchAll(/<[a-z][^>]*>/gi)){
      // Escaped user text is also legal inside aria-label/meta values. Check
      // attribute names, not the harmless words occurring inside those values.
      const attributes=tag[0].replace(/"[^"]*"|'[^']*'/g,'""');
      assert.doesNotMatch(attributes,/\bon(?:error|load|click)\s*=/i);
    }
    assert.doesNotMatch(html,/window\.__CORNER__|website-analytics\.js|reading-analytics\.js|admin\.js/);
    assert.match(html,/script-src 'none'/);
    assert.match(html,/connect-src 'none'/);
    assert.match(html,/form-action 'none'/);
    assert.match(html,/name="robots" content="noindex,nofollow"/);
    for(const button of html.matchAll(/<button\b[^>]*>/gi))assert.match(button[0],/\bdisabled\b/,'Preview buttons cannot invoke live actions');
    assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
  }
  assert.ok(result.fullHtml.includes('&lt;script&gt;alert(&quot;preview&quot;)&lt;/script&gt;'));
  assert.equal(changes(store),before);
});

test('preview includes only selected post media and never reads unrelated posts or comments into its output',t=>{
  const {store,journal,create}=fixture(t);
  const chosen=create({title:'Chosen draft'});
  const unrelated=create({title:'PRIVATE_UNRELATED_TITLE',body:'PRIVATE_UNRELATED_BODY'});
  store.addMedia({id:'selected-image',ownerId:chosen.id,storageKey:'selected-photo.png',mimeType:'image/png',size:80,alt:'Selected photograph',caption:'A selected caption',width:1200,height:900});
  store.addMedia({id:'selected-video',ownerId:chosen.id,storageKey:'selected-video.mp4',mimeType:'video/mp4',size:120,alt:'Selected video'});
  store.addMedia({id:'unrelated-image',ownerId:unrelated.id,storageKey:'PRIVATE_UNRELATED_IMAGE.png',mimeType:'image/png',size:80});
  store.publish(unrelated.id,'owner');
  store.comment(unrelated.id,'PRIVATE_COMMENT_AUTHOR','PRIVATE_COMMENT_BODY');
  const before=changes(store);
  const result=composerPreview(store,journal,{postId:chosen.id,post:previewSource(),media:[{storage_key:'UNTRUSTED_MEDIA.png'}]});
  assert.equal(result.mediaCount,2);
  assert.match(result.feedHtml,/selected-photo\.png/);
  assert.match(result.fullHtml,/selected-photo\.png/);
  assert.match(result.fullHtml,/selected-video\.mp4/);
  assert.match(result.fullHtml,/A selected caption/);
  assert.doesNotMatch(result.feedHtml+result.fullHtml,/PRIVATE_UNRELATED_|PRIVATE_COMMENT_|UNTRUSTED_MEDIA/);
  assert.equal(changes(store),before);
  assert.equal(store.adminPost(chosen.id).state,'draft');
});

test('Journal preview keeps the real chapter design and only published neighbouring chapters',t=>{
  const {store,journal,create}=fixture(t);
  const first=create({type:'journal',title:'A notebook of attempts',body:'Opening chapter.'});
  const assignment=journal.organize(first.id,{mode:'new'},'owner');
  store.publish(first.id,'owner');
  const second=create({type:'journal',title:'Second saved chapter',body:'Saved second chapter.'});
  journal.organize(second.id,{mode:'existing',slug:assignment.slug},'owner');
  const hidden=create({type:'journal',title:'PRIVATE_FUTURE_CHAPTER',body:'PRIVATE_FUTURE_WRITING'});
  journal.organize(hidden.id,{mode:'existing',slug:assignment.slug},'owner');
  const fourth=create({type:'journal',title:'A published continuation',body:'Public fourth chapter.'});
  journal.organize(fourth.id,{mode:'existing',slug:assignment.slug},'owner');
  store.publish(fourth.id,'owner');
  const body='A notebook of attempts\n\nPart 2 — Trying one thing\n\nThis is the unsaved second chapter.\n\n> A line worth remembering.';
  const before=changes(store);
  const result=composerPreview(store,journal,{postId:second.id,post:previewSource({type:'journal',title:'Trying one thing',body})});
  assert.match(result.feedHtml,/SERIES · CHAPTER 02/);
  assert.match(result.fullHtml,/class="series-chapter-prelude"/);
  assert.match(result.fullHtml,/class="post-article journal-series-article"/);
  assert.match(result.fullHtml,/<h1>Trying one thing<\/h1>/);
  assert.match(result.fullHtml,/class="series-pull-quote"/);
  assert.match(result.fullHtml,/← Chapter 01/);
  assert.match(result.fullHtml,/UP NEXT · CHAPTER 04/);
  assert.match(result.fullHtml,/A published continuation/);
  assert.doesNotMatch(result.feedHtml+result.fullHtml,/PRIVATE_FUTURE_/);
  assert.equal(store.adminPost(second.id).body,'Saved second chapter.');
  assert.equal(journal.assignment(second.id).partNumber,2);
  assert.equal(changes(store),before,'Preview must not reorganize or publish a Journal');
});

test('new-series and standalone previews are reversible choices without saved series mutations',t=>{
  const {store,journal,create}=fixture(t);
  const post=create({type:'journal',title:'My saved notebook'});
  const assignment=journal.organize(post.id,{mode:'new'},'owner');
  const before=changes(store);
  const source=previewSource({type:'journal',title:'Another notebook',body:'A first page.'});
  const newSeries=composerPreview(store,journal,{postId:post.id,post:source,seriesChoice:'__new__'});
  assert.match(newSeries.fullHtml,/class="series-chapter-prelude"/);
  assert.match(newSeries.feedHtml,/SERIES · CHAPTER 01/);
  assert.match(newSeries.fullHtml,/Another notebook/);
  const standalone=composerPreview(store,journal,{postId:post.id,post:source,seriesChoice:'__none__'});
  assert.doesNotMatch(standalone.fullHtml,/<section class="series-chapter-prelude"/);
  assert.doesNotMatch(standalone.feedHtml,/SERIES · CHAPTER/);
  assert.equal(journal.adminSeries().length,1);
  assert.equal(journal.assignment(post.id).slug,assignment.slug);
  assert.equal(changes(store),before);
});

test('preview assets use the configured mount exactly once and honour disabled reader controls',t=>{
  const {store,journal,create}=fixture(t);
  const post=create();
  store.addMedia({id:'mounted-photo',ownerId:post.id,storageKey:'mounted-photo.png',mimeType:'image/png',size:80});
  const originalMount=config.basePath;
  try{
    for(const mount of ['', '/corner', '/nested/corner']){
      config.basePath=mount;
      const result=composerPreview(store,journal,{postId:post.id,post:previewSource({allowComments:false,allowReactions:false})});
      for(const html of [result.feedHtml,result.fullHtml]){
        assert.ok(html.includes('href="'+mount+'/style.css"'));
        assert.ok(html.includes('src="'+mount+'/media/mounted-photo.png"'));
        if(mount)assert.ok(!html.includes(mount+mount+'/'),'Do not duplicate the deployment mount');
        assert.doesNotMatch(html,/data-reaction=|data-v5-like\b|data-v6-conversation\b|id="conversation"/);
      }
    }
  }finally{config.basePath=originalMount;}
});

test('preview rejects invalid source shapes and unknown post references',t=>{
  const {store,journal}=fixture(t);
  for(const post of [undefined,null,[],1,'text']){
    assert.throws(()=>composerPreview(store,journal,{post}),{status:400});
  }
  assert.throws(()=>composerPreview(store,journal,{postId:'unknown',post:previewSource()}),{status:404});
});
