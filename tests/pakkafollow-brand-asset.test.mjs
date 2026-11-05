import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const app=()=>read('src/App.jsx').toString('utf8');

test('PakkaFollow mark is the unmodified original logo from its source repository',()=>{
 const logo=read('public/brand/pakkafollow-icon.svg');
 const hash=createHash('sha1').update(Buffer.from('blob '+logo.length+'\\0'.replace('\\0','\\0'))).update(logo).digest('hex');
 assert.equal(hash,'9c1d6946ce11c93032e1e77e95d09b40228e4e2a');
 assert.match(logo.toString('utf8'),/fill="#244c42"/);
 assert.match(logo.toString('utf8'),/fill="#f7f7f2"/);
});
test('authentic PakkaFollow logo appears in hero, work project and project case',()=>{
 const source=app();
 assert.match(source,/logo:'\\/brand\\/pakkafollow-icon\\.svg'/);
 assert.match(source,/className="pakkafollow-brand-mark"/);
 assert.match(source,/className="pakkafollow-brand-work"/);
 assert.match(source,/className="pakkafollow-brand-project"/);
 assert.match(source,/className="pakkafollow-brand-case"/);
 assert.match(source,/src=\\{project\\.logo\\}/);
 assert.match(source,/import '\\.\\/PakkaFollowBrand\\.css'/);
});
test('portfolio retains its independent VM branding',()=>{
 const source=app();
 assert.match(source,/className="wordmark"/);
 assert.ok(read('public/vm-mark.svg').toString('utf8').includes('VM monogram'));
 assert.doesNotMatch(read('public/vm-mark.svg').toString('utf8'),/PakkaFollow/);
});
