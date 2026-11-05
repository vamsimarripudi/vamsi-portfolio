import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {renderLegalPdf} from './legal-pdf-core.mjs';
import {PRIVACY,privacySections} from '../src/privacy.js';
import {termsSections} from '../src/terms.js';
import {cookieInformationSections} from '../src/cookies.js';

const mark=await readFile(new URL('../public/vm-mark.svg',import.meta.url),'utf8');
for(const line of [
  'viewBox="0 0 100 100"',
  'M14 20h17l19 44 19-44h17L57 80H43L14 20Z',
  'm55 58 15-29h16L69 62 61 78H45l10-20Z'
])if(!mark.includes(line))throw Error('VM mark changed; PDF artwork requires explicit revalidation');
const out=new URL('../dist/legal-pdf/',import.meta.url);
await mkdir(out,{recursive:true});
const documents=[
  {name:'privacy',title:'Privacy Notice',kind:'Existing portfolio privacy notice',
    summary:'A clear account of what this personal site collects, why it is used, and how to ask a privacy question.',
    sections:privacySections,operator:PRIVACY.operator,version:PRIVACY.version,lastUpdated:PRIVACY.lastUpdated},
  {name:'terms',title:'Terms of Use',kind:'Existing portfolio terms of use',
    summary:'Clear expectations for using this public portfolio and its contact paths.',
    sections:termsSections.map(([title,body])=>({title,body}))},
  {name:'cookies',title:'Cookies and Analytics',kind:'Factual website information; not an approved new policy',
    summary:'A factual guide to browser preferences and optional first-party website analytics, including withdrawal.',
    sections:cookieInformationSections}
];
for(const {name,...definition} of documents){
  const pdf=renderLegalPdf(definition);
  if(pdf.length<900 || !pdf.subarray(0,8).toString('latin1').startsWith('%PDF-1.4'))throw Error('Invalid PDF generation: '+name);
  await writeFile(new URL(name+'.pdf',out),pdf);
  console.log('[legal-pdf] generated',name+'.pdf',pdf.length,'bytes');
}
