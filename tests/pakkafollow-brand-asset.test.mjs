import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url));
const app = () => read('src/App.jsx').toString('utf8');

test('PakkaFollow mark is the unmodified official SVG from its product repository', () => {
  const logo = read('public/brand/pakkafollow-icon.svg');
  const header = Buffer.from('blob ' + logo.length + String.fromCharCode(0));
  const gitBlobSha = createHash('sha1').update(header).update(logo).digest('hex');
  assert.equal(gitBlobSha, '9c1d6946ce11c93032e1e77e95d09b40228e4e2a');
  assert.match(logo.toString('utf8'), /fill="#244c42"/);
  assert.match(logo.toString('utf8'), /fill="#f7f7f2"/);
});

test('authentic PakkaFollow logo appears across the portfolio product surfaces', () => {
  const source = app();
  for (const required of [
    "logo:'/brand/pakkafollow-icon.svg'",
    'className="pakkafollow-brand-mark"',
    'className="pakkafollow-brand-work"',
    'className="pakkafollow-brand-project"',
    'className="pakkafollow-brand-case"',
    'src={project.logo}',
    "import './PakkaFollowBrand.css';"
  ]) assert.ok(source.includes(required), 'Missing original logo placement: ' + required);
});

test('the personal portfolio VM site logo remains independent', () => {
  const source = app();
  assert.ok(source.includes('className="wordmark"'));
  const vm = read('public/vm-mark.svg').toString('utf8');
  assert.ok(vm.includes('VM monogram'));
  assert.doesNotMatch(vm, /PakkaFollow/);
});
