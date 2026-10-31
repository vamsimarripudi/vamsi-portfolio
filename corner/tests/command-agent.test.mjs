import test from 'node:test';
import assert from 'node:assert/strict';
import {CommandAgent,responseText} from '../src/command-agent.mjs';

test('Command AI stays disabled without explicit key and feature flag',async()=>{
  const noKey=new CommandAgent({enabled:true,apiKey:''});
  assert.equal(noKey.ready(),false);
  await assert.rejects(()=>noKey.ask({question:'What now?',summary:{},items:[]}),{status:503,code:'COMMAND_AI_DISABLED'});
  const flagOff=new CommandAgent({enabled:false,apiKey:'sk-proj-'+('x'.repeat(40))});
  assert.equal(flagOff.ready(),false);
});

test('Command AI sends only bounded command context and preserves owner rules',async()=>{
  let request=null;
  const fetchImpl=async(url,options)=>{
    request={url,options,body:JSON.parse(options.body)};
    return {ok:true,status:200,json:async()=>({
      id:'resp_test',
      output:[{type:'message',content:[{type:'output_text',text:'NOW\n1. Verify the blocked item.\n\nDECISIONS\nOwner approval required.'}]}]
    })};
  };
  const agent=new CommandAgent({enabled:true,apiKey:'sk-proj-'+('x'.repeat(40)),fetchImpl});
  const result=await agent.ask({
    question:'What should I do next?',
    summary:{counts:{now:1}},
    items:[{
      id:'cmd_1',workspace:'kravia',project:'VidyaLuma',kind:'risk',title:'Provider gate',
      detail:'Awaiting provider confirmation.',priority:'now',state:'open',evidenceStatus:'blocked',
      evidenceNote:'No written approval yet.',sourceRef:'provider email',authority:'legal',needsApproval:true,dueAt:null
    }]
  });
  assert.equal(request.url,'https://api.openai.com/v1/responses');
  assert.equal(request.body.model,'gpt-6.1-sol');
  assert.equal(request.body.store,false);
  assert.match(request.body.instructions,/Use ONLY the supplied command context/);
  assert.match(request.body.instructions,/Every external or state-changing action requires explicit owner approval/);
  assert.match(request.body.instructions,/KRAVIA PRIVATE LIMITED/);
  assert.match(request.body.input[0].content[0].text,/Provider gate/);
  assert.doesNotMatch(request.body.input[0].content[0].text,/sk-proj-/);
  assert.match(result.text,/Owner approval required/);
  assert.equal(result.responseId,'resp_test');
});

test('Command AI parses text robustly and reports provider failures',async()=>{
  assert.equal(responseText({output_text:'  direct  '}),'direct');
  assert.equal(responseText({output:[{content:[{type:'output_text',text:'A'},{type:'output_text',text:'B'}]}]}),'A\nB');
  const agent=new CommandAgent({
    enabled:true,apiKey:'sk-proj-'+('x'.repeat(40)),
    fetchImpl:async()=>({ok:false,status:429,json:async()=>({error:{message:'Rate limited'}})})
  });
  await assert.rejects(()=>agent.ask({question:'Review',summary:{},items:[]}),{status:429,code:'COMMAND_AI_ERROR'});
});
