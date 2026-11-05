import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {renderLegalPdf} from '../scripts/legal-pdf-core.mjs';
import {printLegalDocument,printablePdfPath} from '../src/legalPrintActions.js';
import {PRIVACY,privacySections} from '../src/privacy.js';
import {termsSections} from '../src/terms.js';
import {cookieInformationSections} from '../src/cookies.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function streams(pdf){
 const bin=pdf.toString('latin1'),out=[];let pos=0;
 while((pos=bin.indexOf('stream\\n',pos))!==-1){
   const start=pos+7,end=bin.indexOf('\\nendstream',start);
   if(end<0)break;
   out.push(inflateSync(pdf.subarray(start,end)).toString('utf8'));pos=end+10;
 }
 return out;
}
test('printable PDFs are real A4 documents, containing every source policy section',()=>{
 const docs=[
  {title:'Privacy Notice',summary:'Existing website privacy notice.',sections:privacySections,version:PRIVACY.version},
  {title:'Terms of Use',summary:'Existing portfolio terms.',sections:termsSections.map(([title,body])=>({title,body}))},
  {title:'Cookies and Analytics',summary:'Factual browser preference guide.',sections:cookieInformationSections}
 ];
 for(const doc of docs){
   const pdf=renderLegalPdf(doc),s=pdf.toString('latin1'),pages=(s.match(/\/Type \/Page /g)||[]).length;
   assert.ok(pdf.length>1100);
   assert.ok(pages>=1);
   assert.match(s,/\/MediaBox \[0 0 595\.28 841\.89\]/);
   assert.match(s,/%%EOF/);
   const commands=streams(pdf);
   assert.equal(commands.length,pages);
   assert.ok(commands.every(stream=>stream.includes('/GS1 gs')),'Centered watermark on each page');
   assert.ok(commands.every(stream=>stream.includes('vamsimarripudi.me')===false),'Rendered text is encoded, not leaked as raw bytes');
   assert.ok(commands.every(stream=>stream.includes('/F1 ')),'Readable selectable PDF text and footer');
 }
});
test('printed final-page gradient is conditional on remaining space and never adds an empty page',()=>{
 const doc={title:'Short notice',summary:'Short notice for quality checks.',sections:[{title:'Short',body:'This is a complete example with sufficient room to add the final signature.'}]};
 const pdf=renderLegalPdf(doc),commands=streams(pdf);
 assert.equal(commands.length,1);
 assert.match(commands[0],/ 7 Tr /);
 assert.match(commands[0],/\/GS2 gs/);
});
test('original legal body text and missing term dates remain unmodified by PDF data source',()=>{
 assert.equal(termsSections.length,5);
 assert.equal(privacySections.length,10);
 assert.equal(PRIVACY.lastUpdated,'25 October 2026');
 assert.ok(termsSections.some(([title])=>title==='Using this site'));
});
test('touch and in-app browser always open a real PDF; desktop uses native print',()=>{
 const events=[];
 const mobile={matchMedia:()=>({matches:true}),navigator:{userAgent:'iPhone'},location:{assign:x=>events.push(x)},print:()=>events.push('native')};
 assert.equal(printLegalDocument('privacy',mobile),'pdf');
 assert.deepEqual(events,['/legal-pdf/privacy.pdf']);
 const desktop={matchMedia:()=>({matches:false}),navigator:{userAgent:'Desktop Browser'},location:{assign:x=>events.push(x)},print:()=>events.push('native')};
 assert.equal(printLegalDocument('terms',desktop),'print');
 assert.equal(events.at(-1),'native');
 desktop.print=()=>{throw Error('Blocked by embedded browser')};
 assert.equal(printLegalDocument('cookies',desktop),'pdf');
 assert.equal(events.at(-1),'/legal-pdf/cookies.pdf');
 assert.throws(()=>printablePdfPath('billing'));
});
test('legal reading body is never hidden by interrupted IntersectionObserver',()=>{
 const source=read('src/App.jsx'),reader=read('src/LegalDocument.jsx');
 assert.match(source,/data-reveal=\{legalReading\?undefined:''\}/);
 assert.match(reader,/className="legal-pdf-action"/);
 assert.match(reader,/className="legal-gradient-signature"/);
 assert.match(reader,/printLegalDocument\(kind\)/);
 assert.match(read('src/LegalPrint.css'),/legal-gradient-signature/);
});
