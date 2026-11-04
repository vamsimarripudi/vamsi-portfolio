/** Test-only preload; never imported by application code. No external AI spend. */
import assert from 'node:assert/strict';
import sharp from 'sharp';
if(process.env.NODE_ENV!=='test')throw Error('The provider fixture is test-only.');
const original=globalThis.fetch;
const image=(await sharp({create:{width:128,height:128,channels:3,background:'#b7cabb'}}).png().toBuffer()).toString('base64');
const attempted=new Set();
globalThis.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://api.openai.com/'))return original(url,options);
 const body=JSON.parse(options.body),input=JSON.stringify(body.input||[]);
 const pause=ms=>new Promise((resolve,reject)=>{const id=setTimeout(resolve,ms);options.signal?.addEventListener('abort',()=>{clearTimeout(id);reject(new DOMException('Aborted','AbortError'))},{once:true})});
 if(String(url).endsWith('/images/generations')){await pause(1800);return new Response(JSON.stringify({data:[{b64_json:image}]}),{headers:{'content-type':'application/json'}})}
 assert.equal(body.store,false);assert.ok(body.instructions.includes('WORKSPACE:'));
 if(input.includes('FIXTURE_SLOW'))await pause(5000);else await pause(400);
 if(input.includes('FIXTURE_FAIL_ONCE')&&!attempted.has(input)){attempted.add(input);return new Response(JSON.stringify({error:{message:'Test failure'}}),{status:503})}
 return new Response(JSON.stringify({output_text:'A clear next step.\n\nThis is an isolated test response. **Review before action.**',usage:{total_tokens:40}}),{headers:{'content-type':'application/json'}});
};
