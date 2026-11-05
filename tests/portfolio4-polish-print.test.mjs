import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('viewport hero is taller than viewport content and retains motion fallbacks',()=>{
 const css=get('src/PortfolioPolish.css');
 assert.match(css,/main \.hero\.hero-identity/);
 assert.match(css,/min-height:calc\(100svh - 100px\)/);
 assert.match(css,/hero-focus-card/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/max-width:720px/);
});
test('work is compact and factual, no giant decorative art',()=>{
 const css=get('src/PortfolioPolish.css'),app=get('src/App.jsx');
 assert.match(css,/\.work-grid \.project-art\{display:none\}/);
 assert.match(css,/\.archive-grid \.project-art\{display:none\}/);
 assert.match(app,/className="p4-work-facts"/);
 assert.match(app,/project\.problem/);
 assert.match(app,/Explore technical case study/);
});
test('legal print uses actual monogram watermark and repeatable footer, without navigation overlays',()=>{
 const jsx=get('src/LegalDocument.jsx'),css=get('src/LegalPrint.css');
 assert.match(jsx,/className="legal-print-watermark"/);
 assert.match(jsx,/src="\/vm-mark\.svg"/);
 assert.match(jsx,/className="legal-print-page-footer"/);
 assert.match(jsx,/className="legal-print-closing"/);
 assert.match(css,/@media print/);
 assert.match(css, /\.mobile-menu/);
 assert.match(css, /\.command-palette/);
 assert.match(css, /break-inside:auto/);
 assert.match(css, /orphans:3;widows:3/);
 assert.match(css, /position:fixed/);
});
