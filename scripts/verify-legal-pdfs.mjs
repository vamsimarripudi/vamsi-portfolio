import {readFile} from 'node:fs/promises';
const names=['privacy','terms','cookies'];
for(const name of names){
 const file=await readFile(new URL('../dist/legal-pdf/'+name+'.pdf',import.meta.url));
 const bytes=file.toString('latin1');
 if(!bytes.startsWith('%PDF-1.4') || !bytes.includes('%%EOF') || !bytes.includes('/Type /Page ') || file.length<900 || file.length>2_000_000)
  throw Error('Invalid or unavailable static legal PDF: '+name);
 console.info('[legal-pdf] verified',name+'.pdf',file.length,'bytes');
}
