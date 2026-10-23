import {context} from '../../../lib/camp-context';
import {runtime,secureHeaders,rateLimit,failure} from '../../../lib/server-security';
export const dynamic='force-dynamic';
export async function GET(){try{
 const {db,user,owner,email,role,groups}=await context();
 await rateLimit(db,user.userId,'read',120);
 const all=['medical_lead','coordinator','analyst'].includes(role);const isClinical=['medical_lead','doctor','nurse','mentor'].includes(role);
 let warriors=(await db.prepare('SELECT * FROM warriors ORDER BY group_name,name').all()).results as any[];
 if(!all)warriors=warriors.filter(w=>groups.includes(w.group_name));if(role==='administrator')warriors=[];
 const campOwner=owner||role==='administrator'?await db.prepare("SELECT value FROM settings WHERE key='owner'").first<{value:string}>():null;
 const ids=new Set(warriors.map(w=>w.id));
 const entries=isClinical||role==='analyst'?(await db.prepare('SELECT * FROM entries ORDER BY measured_at DESC').all()).results.filter((e:any)=>ids.has(e.warrior_id)).map((e:any)=>({...e,payload:JSON.parse(e.payload)})):[];
 const reviews=isClinical?(await db.prepare('SELECT * FROM reviews ORDER BY created_at DESC').all()).results.filter((e:any)=>ids.has(e.warrior_id)):[];
 const regimens=['medical_lead','doctor','nurse'].includes(role)?(await db.prepare('SELECT * FROM regimens ORDER BY version DESC').all()).results.filter((e:any)=>ids.has(e.warrior_id)):[];
 if(['coordinator','analyst'].includes(role))for(const w of warriors)delete w.allergies;
 if(role==='analyst')warriors=warriors.map((w:any,i:number)=>({...w,name:`Participant ${i+1}`,guardian:undefined,contact:undefined,room:''}));
 return Response.json({mode:runtime().APP_MODE==='demo'?'demo':'production',authProvider:runtime().APP_MODE==='demo'||runtime().APP_AUTH_PROVIDER==='sites'?'sites':'supabase',offlineExpiresAt:new Date(Date.now()+8*3600000).toISOString(),user:{email,name:user.displayName,role,groups,owner,id:user.userId},warriors,entries:role==='analyst'?entries.filter((e:any)=>e.kind==='reading').map((e:any)=>({...e,author:'',author_id:undefined,payload:{value:e.payload.value,unit:e.payload.unit,slot:e.payload.slot,method:e.payload.method}})):entries,reviews,regimens,members:owner||role==='administrator'?(await db.prepare('SELECT * FROM members').all()).results.map((m:any)=>({email:m.email,role:m.role,groups:JSON.parse(m.groups_json),active:m.active===1,isOwner:m.user_id===campOwner?.value})):[],serverTime:new Date().toISOString()},{headers:secureHeaders});
 }catch(e){return failure(e);}}
