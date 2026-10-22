import 'server-only';
import postgres from 'postgres';
import {postgresQuery} from './sql-compat';
import {databaseTLS} from './database-tls';

type Row=Record<string,unknown>;
type QueryResult=Row[]&{count:number};
type Executor={unsafe:(sql:string,values?:any[])=>PromiseLike<QueryResult>};
export type Statement={sql:string;values:any[];bind:(...values:any[])=>Statement;first:<T=Row>()=>Promise<T|null>;all:<T=Row>()=>Promise<{results:T[]}>;run:()=>Promise<{success:boolean;meta:{changes:number}}>};
export type ServerDatabase={prepare:(sql:string)=>Statement;batch:(queries:Statement[])=>Promise<unknown[]>};
let connection:ReturnType<typeof postgres>|undefined;
let instance:ServerDatabase|undefined;

export function database():ServerDatabase|undefined{
 const url=process.env.DATABASE_URL;
 if(!url)return undefined;
 if(instance)return instance;
 // Transaction-pooler compatible; no session state or prepared statements.
 connection=postgres(url,{prepare:false,max:1,idle_timeout:20,connect_timeout:10,ssl:databaseTLS(url)});
 const client=connection;
 async function transaction<T>(run:(tx:Executor)=>Promise<T>,write=false):Promise<T>{
  return await client.begin(async tx=>{
   await tx.unsafe('SET LOCAL ROLE dyc_app');
   await tx.unsafe('SET LOCAL search_path TO dyc, pg_catalog');
   if(write)await tx.unsafe("SELECT pg_advisory_xact_lock(hashtext('dyc-camp-write'))");
   return await run(tx as unknown as Executor);
  }) as T;
 }
 async function execute(tx:Executor,statement:Statement,lastChanges=0){return await tx.unsafe(postgresQuery(statement.sql,lastChanges),statement.values);}
 const prepare=(sql:string):Statement=>{
  const statement:Statement={sql,values:[],bind(...values){return {...statement,values};},
   async first<T>(){const rows=await transaction(tx=>execute(tx,this));return (rows[0] as T)||null;},
   async all<T>(){const rows=await transaction(tx=>execute(tx,this));return {results:Array.from(rows) as T[]};},
   async run(){const rows=await transaction(tx=>execute(tx,this));return {success:true,meta:{changes:rows.count}};},
  };return statement;
 };
 instance={prepare,async batch(queries){return transaction(async tx=>{let changes=0;const results=[];for(const query of queries){const rows=await execute(tx,query,changes);changes=rows.count;results.push({results:Array.from(rows),success:true,meta:{changes}});}return results;},true);}};
 return instance;
}
