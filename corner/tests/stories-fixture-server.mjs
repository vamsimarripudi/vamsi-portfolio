/** Isolated local visual-test fixture. Never connects to production or publishes data. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStoriesService} from '../src/stories-service.mjs';
const PORT=Number(process.env.TEST_PORT||48231);
const publicDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const prose=`The letter had arrived before the rain. Mira found it where her father always left the morning newspaper, folded once and tucked beneath a chipped ceramic mug. There was no address on the envelope, only her name, written as though somebody had practiced the letters until they stopped trembling.\n\nFor a moment she thought of putting it back. The street outside was empty and the kettle had begun to whistle. She turned the envelope over and rubbed a thumb along the seal. Her father had been gone for three summers, but the handwriting belonged to him.\n\nShe opened the window and let the air carry the small, ordinary noises of the city into the room. A bicycle bell rang below. Somewhere a child shouted, and somewhere else another child laughed. None of it seemed to belong to the same morning as the letter.\n\nInside was a single sheet, a recipe, and a key no larger than a fingernail. The first line said: Do not tell your brother until you have seen the garden. She read it twice, then closed her eyes.`;
const longBody=Array.from({length:26},(_,i)=>`${prose}\n\n${i%2?'The old staircase creaked as she stepped toward the door.':'By the time the clock reached eleven, the rain had finally begun.'}`).join('\n\n');
const rows=[1,2,3].map((i)=>({id:`post-${i}`,slug:`chapter-${i}`,state:'published',type:'journal',tags:['Fiction'],title:['The Letter on the Table','The Garden at Noon','After the Storm'][i-1],excerpt:'A mystery told in the spaces between ordinary days.',body:longBody,published_at:`2026-11-0${i}T12:00:00Z`,updated_at:`2026-11-0${i}T13:00:00Z`,version:1}));
rows.push({id:'post-private',slug:'private-chapter',state:'draft',type:'journal',tags:['Fiction'],title:'Private unfinished chapter',body:'unpublished story text'});
const store={all(){return rows.filter(p=>p.state==='published')},listMedia(){return [];}};
const journalSeries={assignment(id){return id.startsWith('post-')&&id!=='post-private'?{slug:'the-house-that-remembered-rain'}:null;},published(){return {slug:'the-house-that-remembered-rain',title:'The House That Remembered Rain',summary:'Three chapters about a letter that should not have existed.',parts:rows.filter(p=>p.state==='published')};}};
const service=createStoriesService({store,journalSeries,siteUrl:`http://127.0.0.1:${PORT}`});
const types={'.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mp3':'audio/mpeg','.svg':'image/svg+xml'};
const httpServer=http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,`http://127.0.0.1:${PORT}`),name=url.pathname;
  if(name==='/mark.svg') {res.writeHead(200,{'content-type':'image/svg+xml'});return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#674736"/><text x="12" y="54" font-size="40" fill="white">V</text></svg>');}
  if(name.startsWith('/api/stories/')){const result=service.api(name);res.writeHead(result?.status||404,{'content-type':'application/json'});return res.end(JSON.stringify({data:result?.data||null}));}
  if(['/stories.css','/stories-reader.css','/stories-library.js','/stories-reader.js','/stories-motion.mjs','/stories-paper.mp3'].includes(name)){const p=path.resolve(publicDir,name.slice(1));res.writeHead(200,{'content-type':types[path.extname(p)]});return res.end(fs.readFileSync(p));}
  const html=service.html(name,url.search);
  if(html){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(html);}
  res.writeHead(404);res.end('Not found');
 }catch(error){console.error(error);res.writeHead(500);res.end(error.message);}
});
httpServer.listen(PORT,'127.0.0.1',()=>console.log(`Isolated stories fixture at http://127.0.0.1:${PORT}/stories`));
