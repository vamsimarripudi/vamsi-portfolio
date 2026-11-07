import test from 'node:test';
import assert from 'node:assert/strict';
import {isFictionPost,toPublicChapter,createBook,validateChapterNumber,encodeJsonForHtml,publicBookSummary,paragraphsFromBody} from '../src/stories-model.mjs';
import {createStoriesService} from '../src/stories-service.mjs';

const story=(id,title,props={})=>({id,slug:`story-${id}`,state:'published',type:'journal',tags:'["Fiction"]',title,
 excerpt:`A short description of ${title}`,body:'Once there was a river.\n\nIt knew the names of everyone.',
 published_at:`2026-10-${String(10+Number(id)).padStart(2,'0')}T12:00:00Z`,updated_at:'2026-11-01T00:00:00Z',version:1,...props});
function fixture(){
 const rows=[
  story(1,'Paper House'),
  story(2,'The Second Letter',{tags:['fiction','Mystery'],body:'A new beginning.\n\nMore details here.'}),
  story(3,'Not Fiction',{tags:['Journal']}),
  story(4,'Never publish me',{state:'draft'}),
  story(5,'Private scheduled chapter',{state:'scheduled'}),
  story(6,'Fiction Archived',{state:'archived'}),
  story(7,'Serialized Chapter One'),
  story(8,'Serialized Chapter Two'),
  story(9,'Non-fiction in the series',{tags:['Journal']})
 ];
 const assigned=new Map([[rows[6].id,'the-serial'],[rows[7].id,'the-serial'],[rows[8].id,'the-serial']]);
 const store={
  all(sql){assert.match(sql,/state='published'/);return rows.filter(x=>x.state==='published'&&x.type==='journal');},
  listMedia(id){return id===rows[0].id?[{mime_type:'video/mp4',storage_key:'clip.mp4'},
    {mime_type:'image/jpeg',storage_key:'cover-1.jpg',alt_text:'An original cover'}]:[];}
 };
 const journalSeries={
  assignment(id){return assigned.has(id)?{slug:assigned.get(id)}:null;},
  published(slug){if(slug!=='the-serial')return null;return {slug,title:'A Long Letter',summary:'A serial mystery',
   parts:rows.filter(p=>assigned.has(p.id)&&p.state==='published')};}
 };
 return createStoriesService({store,journalSeries,siteUrl:'https://vamsimarripudi.me/corner',basePath:'/corner'});
}
test('tags are explicit, case-insensitive, and require a journal publication state',()=>{
 assert.equal(isFictionPost(story(1,'Title')),true);
 assert.equal(isFictionPost(story(1,'Title',{tags:['STORIES']})),true);
 for(const state of ['draft','scheduled','archived'])assert.equal(isFictionPost(story(1,'Not public',{state})),false);
 assert.equal(isFictionPost(story(1,'Not a book',{tags:['Travel','Journal']})),false);
 assert.equal(isFictionPost(story(1,'Not a book',{type:'announcement'})),false);
});
test('only safe public post fields are projected into story chapters',()=>{
 const p=toPublicChapter(story(1,'Safe story',{secretToken:'never',privateNotes:'never',email:'secret@domain.invalid'}));
 assert.ok(p);assert.ok(!('secretToken' in p));assert.ok(!('privateNotes' in p));
 assert.ok(!('email' in p));assert.ok(!('state' in p));
});
test('serial chapters are grouped, ordered and untagged entries stay out of fiction library',()=>{
 const books=fixture().books();
 assert.equal(books.length,3);
 const serial=books.find(x=>x.kind==='series');assert.ok(serial);
 assert.equal(serial.title,'A Long Letter');assert.equal(serial.chapterCount,2);
 assert.deepEqual(serial.chapters.map(c=>c.title),['Serialized Chapter One','Serialized Chapter Two']);
 assert.equal(books.filter(x=>x.kind==='standalone').length,2);
 assert.ok(!JSON.stringify(books).includes('Never publish me'));
 assert.ok(!JSON.stringify(books).includes('Private scheduled chapter'));
 assert.ok(!JSON.stringify(books).includes('Fiction Archived'));
 assert.ok(!JSON.stringify(books).includes('Non-fiction in the series'));
});
test('book details expose real links, counts and copyright notice',()=>{
 const html=fixture().html('/stories/book/the-serial');
 assert.match(html,/A Long Letter/);assert.match(html,/CHAPTER 01/);
 assert.match(html,/\/stories\/read\/the-serial\?chapter=2/);
 assert.match(html,/All rights reserved|copyright|Copyright|©/);
 assert.equal(fixture().html('/stories/book/not-published'),null);
});
test('reader renders first published chapter and validates deep-link selection',()=>{
 const service=fixture();
 const html=service.html('/stories/read/the-serial','?chapter=2');
 assert.match(html,/Serialized Chapter Two/);
 assert.match(html,/data-base-path="\/corner"/);
 assert.match(html,/storyBootstrap/);
 assert.match(html,/readerLeaf/);
 assert.equal(service.html('/stories/read/the-serial','?chapter=3'),null);
});
test('API returns one real published chapter only, rejects invalid chapters and slugs',()=>{
 const svc=fixture();
 const one=svc.api('/api/stories/books/the-serial/chapters/1');
 assert.equal(one.status,200);assert.equal(one.data.chapter.title,'Serialized Chapter One');
 assert.equal(one.data.book.chapterCount,2);
 assert.equal(svc.api('/api/stories/books/the-serial/chapters/3').status,404);
 assert.equal(svc.api('/api/stories/books/unknown/chapters/1').status,404);
 assert.equal(svc.api('/api/private-data'),null);
 assert.equal(validateChapterNumber('01',2),null);assert.equal(validateChapterNumber('2',2),2);
});
test('JSON escaping prevents breaking out of embedded bootstrap scripts',()=>{
 const unsafe=story(1,'</script><img src=x onerror=alert(1)>',{body:'a </script><script>alert(1)</script>'});
 const data=createBook({slug:'test',title:unsafe.title,chapters:[unsafe]});
 assert.ok(data);
 const encoded=encodeJsonForHtml({body:unsafe.body,title:unsafe.title});
 assert.ok(!encoded.includes('</script>'));
 assert.ok(!encoded.includes('<img'));
 assert.deepEqual(JSON.parse(encoded),{body:unsafe.body,title:unsafe.title});
});
test('library includes only published fiction and uses safe escaped image paths',()=>{
 const service=fixture();const html=service.html('/stories');
 assert.match(html,/The bookshelf/);assert.match(html,/Paper House/);
 assert.match(html,/cover-1.jpg/);assert.doesNotMatch(html,/Never publish me/);
 assert.doesNotMatch(html,/Not Fiction/);
});
test('paragraph splitting handles Unix, Windows and blank lines consistently',()=>{
 assert.deepEqual(paragraphsFromBody('One\r\n\r\nTwo\n \nThree'),['One','Two','Three']);
 assert.equal(publicBookSummary(fixture().books()[0]).chapters[0].body,undefined);
});
