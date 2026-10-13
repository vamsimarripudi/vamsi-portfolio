import {PGlite} from '@electric-sql/pglite';
/** Neon-compatible lazy query/transaction adapter, backed by real isolated PostgreSQL. */
export async function siteDatabase(){
 const db=new PGlite();await db.waitReady;
 const sql=(parts,...values)=>sql.query(parts.reduce((s,p,i)=>s+p+(i<values.length?'$'+(i+1):''),''),values);
 sql.query=(text,params=[])=>({text,params,then(resolve,reject){return db.query(text,params).then(r=>r.rows).then(resolve,reject)}});
 sql.transaction=queries=>db.transaction(async tx=>{const rows=[];for(const q of queries)rows.push((await tx.query(q.text,q.params)).rows);return rows});
 return {db,sql};
}
