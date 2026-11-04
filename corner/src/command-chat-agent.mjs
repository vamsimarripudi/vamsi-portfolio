import {httpError} from './domain.mjs';
import {responseText} from './command-agent.mjs';

const tool=(name,description,properties)=>({type:'function',name,description,strict:true,parameters:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}});
export const chatTools=[
 tool('queue_list','Read actual queue records from this conversation workspace.',{}),
 tool('signals_list','Read actual attention signals from this conversation workspace.',{}),
 tool('propose_queue_create','Propose a task, idea, risk or decision. Does not create a queue record. The owner must review and confirm.',{title:{type:'string'},detail:{type:'string'},kind:{type:'string',enum:['task','idea','risk','decision']},priority:{type:'string',enum:['now','next','later']},dueAt:{type:['string','null']}}),
 tool('propose_queue_update','Propose a status change for a queue record returned by queue_list. Requires explicit owner confirmation.',{targetId:{type:'string'},version:{type:'integer'},state:{type:'string',enum:['open','waiting','done','dismissed']}})
];
const instructions=`You are Command, the private owner assistant in Vamsi's Corner Studio.
Respond naturally in the user's language. Be clear, practical and concise. Do not force dashboard headings on ordinary answers.
Use only supplied records or tool results as evidence about the owner's business. Distinguish verified, reported, unverified and blocked information. Never invent revenue, legal, financial, deployment or custo¶»§q«^