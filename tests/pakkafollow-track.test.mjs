import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
test('PakkaFollow sidebar remains inside authenticated Track shell',()=>{
 const source=read('src/Track.jsx');
 assert.match(source, /to="\/track\/pakkafollow"/);
 assert.match(source, /Navigate replace to="\/track\/enquiries\?intent=PakkaFollow%20support"/);
 assert.match(source, /if \(session === 'guest'\) return <SignIn/);
});
test('contact intake and AEO reference PakkaFollow without indexing private Track',()=>{
 assert.match(read('src/App.jsx'), /'PakkaFollow support'/);
 assert.match(read('public/llms.txt'), /https:\/\/pakkafollow\.vamsimarripudi\.me\//);
 assert.doesNotMatch(read('public/sitemap.xml'), /\/track\/pakkafollow/);
});
