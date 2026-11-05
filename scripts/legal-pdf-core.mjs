import {deflateSync} from 'node:zlib';

const A4={width:595.28,height:841.89};
const SPECIAL=new Map(Object.entries({
  '€':0x80,'‚':0x82,'ƒ':0x83,'„':0x84,'…':0x85,'†':0x86,'‡':0x87,'ˆ':0x88,'‰':0x89,'Š':0x8a,'‹':0x8b,'Œ':0x8c,'Ž':0x8e,
  '‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'–':0x96,'—':0x97,'˜':0x98,'™':0x99,'š':0x9a,'›':0x9b,'œ':0x9c,'ž':0x9e,'Ÿ':0x9f
}));
const asciiize=s=>String(s).replace(/₹/g,'INR ').replace(/\u00a0/g,' ').replace(/[\u200b-\u200d\ufeff]/g,'');
function cp1252(s){const b=[];for(const c of asciiize(s)){const n=c.codePointAt(0);if((n>=32&&n<=126)||(n>=160&&n<=255))b.push(n);else if(SPECIAL.has(c))b.push(SPECIAL.get(c));else if(c==='\n'||c==='\r'||c==='\t')b.push(32);else b.push(63);}return Buffer.from(b);}
const pdfText=s=>cp1252(s).toString('hex').toUpperCase();
const metric=c=>{if('il.,:;!|\'`'.includes(c))return .23;if('fjrt()[]{}'.includes(c))return .34;if('mwMW@%'.includes(c))return .85;if('ABCDEFGHKLNOPQRSUVXYZ'.includes(c))return .67;if('0123456789'.includes(c))return .56;return .53;};
function measured(s,size=9.3,bold=false){return [...asciiize(s)].reduce((w,c)=>w+metric(c)*(bold?1.08:1)*size,0);}
function wrap(text,size,width,bold=false){const words=String(text).replace(/\s+/g,' ').trim().split(' '),lines=[];let line='';
 for(let word of words){if(!word)continue;const trial=line?line+' '+word:word;if(measured(trial,size,bold)<=width){line=trial;continue;}if(line){lines.push(line);line='';}
 while(measured(word,size,bold)>width){let cut=1;while(cut<word.length&&measured(word.slice(0,cut+1),size,bold)<=width)cut++;lines.push(word.slice(0,cut));word=word.slice(cut);}line=word;
 }if(line)lines.push(line);return lines;}
const fmt=n=>Number(n).toFixed(2).replace(/\.00$/,'');
const rgb=(r,g,b)=>[r,g,b].map(n=>fmt(n/255)).join(' ');
const colors={ink:[34,38,35],muted:[94,99,92],rust:[195,71,47],green:[36,76,66],gray:[194,200,194],cream:[248,248,242]};
function paint(c){return rgb(...(colors[c]||c));}
function drawText(text,x,y,size=9.3,font='F1',color='ink'){
 return `${paint(color)} rg BT /${font} ${fmt(size)} Tf 1 0 0 1 ${fmt(x)} ${fmt(y)} Tm <${pdfText(text)}> Tj ET`;
}
function drawLine(x1,y1,x2,y2,color='gray',width=.5){return `${paint(color)} RG ${fmt(width)} w ${fmt(x1)} ${fmt(y1)} m ${fmt(x2)} ${fmt(y2)} l S`;}
function vmLogo(x,y,size,opacity=.06){const scale=size/100,top=y+size;return [
  `q /GS1 gs ${fmt(scale)} 0 0 -${fmt(scale)} ${fmt(x)} ${fmt(top)} cm`,
  `${paint('ink')} rg`,
  '12 0 m 88 0 l 94.63 0 100 5.37 100 12 c 100 88 l 100 94.63 94.63 100 88 100 c 12 100 l 5.37 100 0 94.63 0 88 c 0 12 l 0 5.37 5.37 0 12 0 c h f',
  `${paint('cream')} rg 14 20 m 31 20 l 50 64 l 69 20 l 86 20 l 57 80 l 43 80 l 14 20 l h f`,
  `${paint('rust')} rg 55 58 m 70 29 l 86 29 l 69 62 l 61 78 l 45 78 l 55 58 l h f`,
  'Q'
].join('\n').replace('/GS1 gs',opacity===1?'/GS2 gs':'/GS1 gs');}
const gradientStops=[[213,70,45],[233,149,57],[188,206,75],[51,132,145],[69,85,143]];
function gradientText(text,x,y,size=28){const width=measured(text,size,true);const cmds=[`q BT /F2 ${fmt(size)} Tf 1 0 0 1 ${fmt(x)} ${fmt(y)} Tm 7 Tr <${pdfText(text)}> Tj ET`];
 const steps=80,dx=width/steps;for(let i=0;i<steps;i++){const frac=i/(steps-1)*4,lo=Math.min(3,Math.floor(frac)),z=frac-lo;const col=gradientStops[lo].map((v,k)=>Math.round(v+(gradientStops[lo+1][k]-v)*z));cmds.push(`${rgb(...col)} rg ${fmt(x+i*dx)} ${fmt(y-size*.22)} ${fmt(dx+.45)} ${fmt(size*1.24)} re f`);}cmds.push('Q');return cmds.join('\n');}
function escaped(s){return String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7E]/g,'');}
export function renderLegalPdf({title,summary,sections,operator='Vamsi Marripudi',version='',lastUpdated='',kind='Legal notice'}={}){
 if(!title||!summary||!Array.isArray(sections)||!sections.length)throw Error('Complete document required');
 if(sections.some(s=>!s.title||!s.body))throw Error('Partial legal document');
 const W=A4.width,H=A4.height,L=52,R=W-52,MAX=R-L,FLOOR=83;let page,at,pages=[];
 const push=(cmd)=>page.commands.push(cmd);
 const fresh=()=>{page={commands:[]};pages.push(page);at=H-54;push(vmLogo((W-192)/2,(H-192)/2,192,.05));};
 const ensure=needed=>{if(at-needed<FLOOR){fresh();push(drawText(`${title}  /  continued`,L,H-53,8.1,'F1','muted'));at=H-76;}};
 const lines=(text,size=9.3,font='F1',color='ink',leading=14.5,firstGap=0)=>{const items=wrap(text,size,MAX,font==='F2');if(firstGap)at-=firstGap;for(const line of items){ensure(leading);push(drawText(line,L,at,size,font,color));at-=leading;}return items.length;};
 fresh();push(drawText('VAMSI MARRIPUDI  /  PERSONAL WEBSITE',L,at,8.4,'F2','rust'));at-=31;
 push(drawText(title,L,at,22,'F2','ink'));at-=24;
 lines(summary,10,'F1','muted',16);at-=8;
 const meta=[`Operator: ${operator}`,version&&`Version: ${version}`,lastUpdated&&`Last updated: ${lastUpdated}`].filter(Boolean).join('   |   ');
 push(drawText(meta,L,at,8.0,'F1','muted'));at-=12;
 push(drawLine(L,at,R,at,'gray',.8));at-=24;
 sections.forEach((section,index)=>{
   ensure(56);
   push(drawText(`${String(index+1).padStart(2,'0')}.  ${section.title}`,L,at,12,'F2','ink'));at-=19;
   lines(section.body,9.25,'F1','ink',14.3);
   at-=17;
 });
 if(at>FLOOR+64){const t='Vamsi Marripudi',size=27,x=(W-measured(t,size,true))/2;push(drawLine(L,at-5,R,at-5,'gray',.6));push(gradientText(t,x,at-45,size));push(drawText('PERSONAL PORTFOLIO  |  VAMSIMARRIPUDI.ME',L,FLOOR+1,7.8,'F1','muted'));}
 pages.forEach((p,index)=>{
   p.commands.push(drawLine(L,45,R,45,'gray',.5));
   p.commands.push(vmLogo(L,18,19,1));
   p.commands.push(drawText('Vamsi Marripudi   |   vamsimarripudi.me',L+27,27,7.7,'F1','muted'));
   p.commands.push(drawText(`Page ${index+1} of ${pages.length}`,R-70,27,7.7,'F1','muted'));
 });
 const objects=[];const put=body=>{objects.push(body);return objects.length;};
 const catalog=put(null),rootPages=put(null),regular=put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),bold=put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),fade=put('<< /Type /ExtGState /ca 0.05 /CA 0.05 >>'),opaque=put('<< /Type /ExtGState /ca 1 /CA 1 >>');
 const refs=[];
 for(const p of pages){
   const stream=Buffer.from(p.commands.join('\n')+'\n','ascii'),compressed=deflateSync(stream,{level:8});
   const contentRef=put(Buffer.concat([Buffer.from(`<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`,'ascii'),compressed,Buffer.from('\nendstream','ascii')]));
   const pageRef=put(`<< /Type /Page /Parent ${rootPages} 0 R /MediaBox [0 0 ${fmt(W)} ${fmt(H)}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> /ExtGState << /GS1 ${fade} 0 R /GS2 ${opaque} 0 R >> >> /Contents ${contentRef} 0 R >>`);
   refs.push(pageRef);
 }
 objects[catalog-1]=`<< /Type /Catalog /Pages ${rootPages} 0 R >>`;
 objects[rootPages-1]=`<< /Type /Pages /Count ${refs.length} /Kids [${refs.map(x=>x+' 0 R').join(' ')}] >>`;
 const info=put(`<< /Title (${escaped(title)}) /Author (${escaped(operator)}) /Producer (Vamsi Marripudi personal portfolio) /Subject (${escaped(kind)}) >>`);
 const pieces=[Buffer.from('%PDF-1.4\n%\xC2\xA3\xC2\xA5\n','binary')],offsets=[0];let off=pieces[0].length;
 for(let i=0;i<objects.length;i++){offsets.push(off);const obj=Buffer.isBuffer(objects[i])?objects[i]:Buffer.from(objects[i],'ascii');const blob=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`,'ascii'),obj,Buffer.from('\nendobj\n','ascii')]);pieces.push(blob);off+=blob.length;}
 const xref=off;const trailer=['xref',`0 ${objects.length+1}`,'0000000000 65535 f ',...offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n '),'trailer',`<< /Size ${objects.length+1} /Root ${catalog} 0 R /Info ${info} 0 R >>`,'startxref',String(xref),'%%EOF\n'].join('\n');pieces.push(Buffer.from(trailer,'ascii'));
 return Buffer.concat(pieces);
}
