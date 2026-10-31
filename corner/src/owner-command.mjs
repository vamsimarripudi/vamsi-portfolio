import {httpError,now,pureText,uid} from './domain.mjs';

const WORKSPACES=new Set(['personal','kravia']);
const KINDS=new Set(['task','decision','risk','idea']);
const PRIORITIES=new Set(['now','next','later']);
const STATES=new Set(['open','waiting','done','dismissed']);
const EVIDENCE=new Set(['verified','reported','unverified','blocked']);
const AUTHORITIES=new Set(['read','draft','write','money','legal','security']);
const priorityOrder={now:0,next:1,later:2};

const clean=(value,max)=>pureText(value,max);
const boolean=value=>value===true||value===1||value==='1';

export class OwnerCommand{
  constructor(store){
    this.store=store;
    store.db.exec(`
      CREATE TABLE IF NOT EXISTS owner_command_items (
        id TEXT PRIMARY KEY,
        workspace TEXT NOT NULL CHECK(workspace IN ('personal','kravia')),
        project TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL CHECK(kind IN ('task','decision','risk','idea')),
        title TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'next' CHECK(priority IN ('now','next','later')),
        state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','waiting','done','dismissed')),
        evidence_status TEXT NOT NULL DEFAULT 'unverified' CHECK(evidence_status IN ('verified','reported','unverified','blocked')),
        evidence_note TEXT NOT NULL DEFAULT '',
        source_ref TEXT NOT NULL DEFAULT '',
        authority TEXT NOT NULL DEFAULT 'read' CHECK(authority IN ('read','draft','write','money','legal','security')),
        needs_approval INTEGER NOT NULL DEFAULT 0,
        due_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_owner_command_open
        ON owner_command_items(state,priority,due_at,updated_at);
      CREATE INDEX IF NOT EXISTS idx_owner_command_workspace
        ON owner_command_items(workspace,state,updated_at);
    `);
  }

  normalize(row){
    if(!row)return null;
    return {
      ...row,
      needsApproval:!!row.needs_approval,
      version:Number(row.version||1),
      dueAt:row.due_at||null,
      createdAt:row.created_at,
      updatedAt:row.updated_at,
      resolvedAt:row.resolved_at||null,
      evidenceStatus:row.evidence_status,
      evidenceNote:row.evidence_note,
      sourceRef:row.source_ref
    };
  }

  validate(data={},existing=null){
    const workspace=String(data.workspace??existing?.workspace??'personal');
    const kind=String(data.kind??existing?.kind??'task');
    const priority=String(data.priority??existing?.priority??'next');
    const state=String(data.state??existing?.state??'open');
    const evidenceStatus=String(data.evidenceStatus??data.evidence_status??existing?.evidence_status??'unverified');
    const authority=String(data.authority??existing?.authority??'read');
    if(!WORKSPACES.has(workspace))throw httpError(400,'Choose Personal or KRAVIA workspace.');
    if(!KINDS.has(kind))throw httpError(400,'Choose task, decision, risk or idea.');
    if(!PRIORITIES.has(priority))throw httpError(400,'Choose now, next or later priority.');
    if(!STATES.has(state))throw httpError(400,'Choose a valid command state.');
    if(!EVIDENCE.has(evidenceStatus))throw httpError(400,'Choose a valid evidence status.');
    if(!AUTHORITIES.has(authority))throw httpError(400,'Choose a valid authority class.');
    const title=clean(data.title??existing?.title,160);
    if(title.length<2)throw httpError(400,'Add a clear command title.');
    const dueRaw=data.dueAt??data.due_at??existing?.due_at??null;
    if(dueRaw&&!Number.isFinite(Date.parse(dueRaw)))throw httpError(400,'Due date is invalid.');
    const dueAt=dueRaw?new Date(dueRaw).toISOString():null;
    return {
      workspace,kind,priority,state,evidenceStatus,authority,title,dueAt,
      project:clean(data.project??existing?.project,100),
      detail:clean(data.detail??existing?.detail,1800),
      evidenceNote:clean(data.evidenceNote??data.evidence_note??existing?.evidence_note,1200),
      sourceRef:clean(data.sourceRef??data.source_ref??existing?.source_ref,600),
      needsApproval:true
    };
  }

  get(id){return this.normalize(this.store.one('SELECT * FROM owner_command_items WHERE id=?',id));}

  list(filters={}){
    const clauses=[],values=[];
    if(filters.workspace&&WORKSPACES.has(filters.workspace)){clauses.push('workspace=?');values.push(filters.workspace)}
    if(filters.state&&STATES.has(filters.state)){clauses.push('state=?');values.push(filters.state)}
    if(filters.kind&&KINDS.has(filters.kind)){clauses.push('kind=?');values.push(filters.kind)}
    const where=clauses.length?'WHERE '+clauses.join(' AND '):'';
    const rows=this.store.all(`SELECT * FROM owner_command_items ${where}
      ORDER BY CASE priority WHEN 'now' THEN 0 WHEN 'next' THEN 1 ELSE 2 END,
      CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,due_at ASC,updated_at DESC LIMIT 200`,...values);
    return rows.map(row=>this.normalize(row));
  }

  summary(){
    const all=this.list({});
    const active=all.filter(item=>['open','waiting'].includes(item.state));
    const nowItems=active.filter(item=>item.priority==='now').slice(0,8);
    const approvals=active.filter(item=>item.needsApproval).slice(0,8);
    const risks=active.filter(item=>item.kind==='risk').slice(0,8);
    const decisions=active.filter(item=>item.kind==='decision').slice(0,8);
    const overdue=active.filter(item=>item.dueAt&&Date.parse(item.dueAt)<Date.now()).slice(0,8);
    const counts={
      open:active.filter(item=>item.state==='open').length,
      waiting:active.filter(item=>item.state==='waiting').length,
      now:active.filter(item=>item.priority==='now').length,
      approvals:active.filter(item=>item.needsApproval).length,
      risks:active.filter(item=>item.kind==='risk').length,
      decisions:active.filter(item=>item.kind==='decision').length,
      personal:active.filter(item=>item.workspace==='personal').length,
      kravia:active.filter(item=>item.workspace==='kravia').length
    };
    return {counts,nowItems,approvals,risks,decisions,overdue,updatedAt:now()};
  }

  create(data,actor){
    const value=this.validate(data),id=uid('cmd'),stamp=now();
    this.store.exec(`INSERT INTO owner_command_items(
      id,workspace,project,kind,title,detail,priority,state,evidence_status,evidence_note,
      source_ref,authority,needs_approval,due_at,version,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id,value.workspace,value.project,value.kind,value.title,value.detail,value.priority,value.state,
      value.evidenceStatus,value.evidenceNote,value.sourceRef,value.authority,value.needsApproval?1:0,
      value.dueAt,1,stamp,stamp);
    this.store.audit(actor,'owner.command.created','owner_command',id,{
      workspace:value.workspace,kind:value.kind,priority:value.priority,authority:value.authority
    });
    return this.get(id);
  }

  update(id,data,actor){
    const existing=this.store.one('SELECT * FROM owner_command_items WHERE id=?',id);
    if(!existing)throw httpError(404,'Command item not found.');
    if(data.version!==undefined&&Number(data.version)!==Number(existing.version))throw httpError(409,'Command item changed. Refresh and retry.');
    const value=this.validate(data,existing),stamp=now(),nextVersion=Number(existing.version||1)+1;
    const resolvedAt=['done','dismissed'].includes(value.state)?(existing.resolved_at||stamp):null;
    this.store.exec(`UPDATE owner_command_items SET workspace=?,project=?,kind=?,title=?,detail=?,priority=?,state=?,
      evidence_status=?,evidence_note=?,source_ref=?,authority=?,needs_approval=?,due_at=?,version=?,updated_at=?,resolved_at=?
      WHERE id=?`,
      value.workspace,value.project,value.kind,value.title,value.detail,value.priority,value.state,
      value.evidenceStatus,value.evidenceNote,value.sourceRef,value.authority,value.needsApproval?1:0,
      value.dueAt,nextVersion,stamp,resolvedAt,id);
    this.store.audit(actor,'owner.command.updated','owner_command',id,{
      workspace:value.workspace,state:value.state,priority:value.priority,authority:value.authority
    });
    return this.get(id);
  }

  resolve(id,state,actor){
    if(!['done','dismissed','open','waiting'].includes(state))throw httpError(400,'Invalid command state.');
    return this.update(id,{state,version:this.get(id)?.version},actor);
  }
}

export const ownerCommandConstants={
  workspaces:[...WORKSPACES],kinds:[...KINDS],priorities:[...PRIORITIES],
  states:[...STATES],evidence:[...EVIDENCE],authorities:[...AUTHORITIES],priorityOrder
};
