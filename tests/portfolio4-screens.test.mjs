import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('portfolio 4.0 design system is integrated across public pages and reduced-motion safe',()=>{
 const app=read('src/App.jsx'),css=read('src/PortfolioFour.css');
 assert.match(app,/import '\.\/PortfolioFour\.css'/);
 for(const selector of ['.page:not(.legal-page)','.now-item','.resume-layout','.uses-grid','.writing-list','.faq-list','.lab-notebook','.project-card'])assert.ok(css.includes(selector));
 assert.match(css,/max-width:480px/);assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/focus-visible/);assert.match(css,/min-height:44px/);
});
test('earlier Work cards are searchable, sortable and preserve original routes',()=>{
 const app=read('src/App.jsx');
 assert.match(app,/function WorkArchive\(\{records\}\)/);
 assert.match(app,/onChange=\{e=>setQuery\(e.target.value\)\}/);
 assert.match(app,/role="status" aria-live="polite"/);
 assert.match(app,/records\.filter/);
 assert.match(app,/<WorkArchive records=\{archive\}\/>/);
 assert.match(app,/path="\/work\/:slug"/);
});
