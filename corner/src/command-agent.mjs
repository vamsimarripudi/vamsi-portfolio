import {httpError,pureText} from './domain.mjs';

const responseText=response=>{
  if(typeof response?.output_text==='string'&&response.output_text.trim())return response.output_text.trim();
  const parts=[];
  for(const item of response?.output||[]){
    for(const content of item?.content||[]){
      if((content?.type==='output_text'||content?.type==='text')&&typeof content.text==='string')parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
};

export class CommandAgent{
  constructor({apiKey='',enabled=false,model='gpt-6.1-sol',fetchImpl=globalThis.fetch}={}){
    this.apiKey=String(apiKey||'');
    this.enabled=enabled===true;
    this.model=String(model||'gpt-6.1-sol');
    this.fetch=fetchImpl;
  }

  ready(){return this.enabled&&this.apiKey.length>20}

  async ask({question,summary,items=[]}={}){
    if(!this.ready())throw httpError(503,'Command AI is not connected yet.','COMMAND_AI_DISABLED');
    const prompt=pureText(question,2400);
    if(prompt.length<2)throw httpError(400,'Ask a clear owner question.');
    const context={
      generatedAt:new Date().toISOString(),
      counts:summary?.counts||{},
      items:items.slice(0,60).map(item=>({
        id:item.id,workspace:item.workspace,project:item.project,kind:item.kind,title:item.title,detail:item.detail,
        priority:item.priority,state:item.state,evidenceStatus:item.evidenceStatus,evidenceNote:item.evidenceNote,
        sourceRef:item.sourceRef,authority:item.authority,needsApproval:item.needsApproval,dueAt:item.dueAt
      }))
    };
    const response=await this.fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer '+this.apiKey},
      body:JSON.stringify({
        model:this.model,
        store:false,
        reasoning:{effort:'medium'},
        max_output_tokens:1400,
        instructions:`You are Vamsi Command, a private owner operating assistant.
Use ONLY the supplied command context as factual evidence. Never invent current revenue, deployment, legal, tax, compliance, customer, provider or financial facts.
Evidence meanings are strict: VERIFIED = directly confirmed; REPORTED = supplied but not independently checked; UNVERIFIED = not checked; BLOCKED = evidence unavailable.
Preserve workspace separation: KRAVIA PRIVATE LIMITED corporate operations must not use personal venture money, credentials, branding, accounts or customer records; personal ventures must not use KRAVIA resources without an explicit policy change.
Every external or state-changing action requires explicit owner approval before execution. This includes reversible writes, messages, publishing, deploys, merges, scheduling changes, provider actions, money movement, charging, contracts, legal filings, credential/security changes, deletion and any irreversible action. You may analyze, summarize and draft, but never claim authority to execute.
Be concise. Prefer five headings: NOW, DECISIONS, MONEY, RISKS, NEXT. If evidence is insufficient, say BLOCKED instead of guessing.`,
        input:[{
          role:'user',
          content:[{type:'input_text',text:'OWNER QUESTION\n'+prompt+'\n\nCOMMAND CONTEXT\n'+JSON.stringify(context)}]
        }]
      })
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok){
      const message=body?.error?.message||'Command AI request failed.';
      throw httpError(response.status===429?429:502,pureText(message,300),'COMMAND_AI_ERROR');
    }
    const text=responseText(body);
    if(!text)throw httpError(502,'Command AI returned no usable answer.','COMMAND_AI_EMPTY');
    return {text,model:this.model,responseId:body.id||null};
  }
}

export {responseText};
