import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import postgres from 'npm:postgres@3.4.8';
import {databaseTLS} from '../../../lib/database-tls.ts';
import {StaffInputError} from '../../../lib/staff-account-input.ts';
import {provisionStaff,StaffAccountError} from '../../../lib/staff-account-service.ts';
const headers={'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(request:Request)=>{
 if(request.method!=='POST')return reply(405,{error:'Use POST.'});
 const authorization=request.headers.get('authorization')||'',sessionId=request.headers.get('x-dyc-staff-session')||'';
 if(!authorization.startsWith('Bearer ')||! /^[a-f0-9]{64}$/.test(sessionId))return reply(401,{error:'A signed-in staff session is required.'});
 let sql:ReturnType<typeof postgres>|undefined;
 try{
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,database=Deno.env.get('SUPABASE_DB_URL')!;
  if(!url||!key||!database)return reply(503,{error:'Account creation is awaiting server setup.'});
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await auth.auth.getUser(authorization.slice(7));
  if(error||!data.user?.id)return reply(401,{error:'Sign in again before creating accounts.'});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'Use a JSON request.'});
  const text=await request.text();if(text.length>8192)return reply(413,{error:'Account details are too large.'});
  let input;try{input=JSON.parse(text);}catch{return reply(400,{error:'Enter valid account details.'});}
  sql=postgres(database,{prepare:false,max:1,connect_timeout:10,idle_timeout:5,ssl:databaseTLS(database)});
  let createdId:string|undefined,completed=false;
  try{
   const result=await sql.begin(async tx=>{
    await tx.unsafe('SET LOCAL ROLE dyc_app');
    await tx.unsafe('SET LOCAL search_path TO dyc, pg_catalog');
    await tx.unsafe("SELECT pg_advisory_xact_lock(hashtext('dyc-camp-write'))");
    const userId=data.user.id,now=Date.now();
    return await provisionStaff(input,{
     actor:async()=>{
      const rows=await tx.unsafe('SELECT m.role,m.active,coalesce(o.value=$1,false) AS owner,s.id AS session_id FROM members m LEFT JOIN settings o ON o.key=\'owner\' JOIN staff_sessions s ON s.user_id=m.user_id AND s.id=$2 AND s.revoked=0 AND s.expires_at>$3 AND s.last_seen>$4 WHERE m.user_id=$1 FOR SHARE OF m,s',[userId,sessionId,now,now-15*60000]);
      const row=rows[0];return row?{role:String(row.role),active:row.active===1,owner:row.owner===true,sessionValid:true}:null;
     },
     rateLimit:async()=>{
      const minute=Math.floor(now/60000),bucket=`account-create:${userId}:${minute}`;
      const rows=await tx.unsafe('INSERT INTO request_buckets (id,requests,"window") VALUES ($1,1,$2) ON CONFLICT(id) DO UPDATE SET requests=request_buckets.requests+1 WHERE request_buckets.requests<10 RETURNING requests',[bucket,minute]);
      if(!rows.length)throw new StaffAccountError(429,'Too many accounts created at once. Wait one minute.');
     },
     linkedAccount:async email=>Boolean((await tx.unsafe('SELECT user_id FROM members WHERE email=$1 AND user_id IS NOT NULL',[email])).length),
     create:async account=>{
      const result=await auth.auth.admin.createUser({email:account.email,password:account.password,email_confirm:true,user_metadata:{full_name:account.fullName}});
      createdId=result.data.user?.id;return {id:createdId,code:result.error?.code};
     },
     link:async(account,id)=>{await tx.unsafe('INSERT INTO members (email,role,groups_json,active,user_id) VALUES ($1,$2,$3,1,$4) ON CONFLICT(email) DO UPDATE SET role=excluded.role,groups_json=excluded.groups_json,active=1,user_id=excluded.user_id',[account.email,account.role,JSON.stringify(account.groups),id]);},
     removeCreated:async id=>{const result=await auth.auth.admin.deleteUser(id);if(result.error)throw result.error;createdId=undefined;},
    });
   });
   completed=true;return reply(201,{ok:true,account:result});
  }finally{
   if(createdId&&!completed)await auth.auth.admin.deleteUser(createdId).catch(()=>{});
  }
 }catch(error){
  if(error instanceof StaffAccountError)return reply(error.status,{error:error.message});
  if(error instanceof StaffInputError)return reply(400,{error:error.message});
  // Do not log request bodies, passwords, provider errors or connection strings.
  console.error('Staff account creation failed',{kind:error instanceof Error?error.name:'Unknown'});
  return reply(503,{error:'Account creation is temporarily unavailable. Try again.'});
 }finally{if(sql)await sql.end({timeout:3}).catch(()=>{});}
});
