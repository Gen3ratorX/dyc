import { getStaffUser } from '../../../lib/staff-auth';
import { roles } from '../../../lib/domain';
import { runtime,RequestError,secureHeaders,rateLimit,failure } from '../../../lib/server-security';
export const dynamic='force-dynamic';
export async function context(){
 const user=await getStaffUser();if(!user)throw new RequestError('401:Sign in to continue.');
 const db=runtime().DB;if(!db)throw new RequestError('503:Database unavailable.');
 const email=user.email.trim().toLowerCase();
 let own=await db.prepare("SELECT value FROM settings WHERE key='owner'").first<{value:string}>();
 if(!own){
  const administrator=runtime().BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if(!administrator||email!==administrator)throw new RequestError('403:The camp administrator must complete initial setup.');
  await db.batch([db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('owner',?)").bind(user.userId),db.prepare("INSERT OR IGNORE INTO members (email,role,groups_json,active,user_id) VALUES (?,'medical_lead','[]',1,?)").bind(email,user.userId)]);
  own=await db.prepare("SELECT value FROM settings WHERE key='owner'").first<{value:string}>();
 }
 const owner=own?.value===user.userId;
 let member=await db.prepare('SELECT * FROM members WHERE email=?').bind(email).first<{role:string;groups_json:string;active:number;user_id:string|null}>();
 if(!member||member.active!==1||!roles.includes(member.role as any))throw new RequestError('403:Your account is not approved for this camp. Contact the administrator.');
 if(member.user_id&&member.user_id!==user.userId)throw new RequestError('403:Your staff identity changed. Contact the administrator.');
 if(!member.user_id){await db.prepare('UPDATE members SET user_id=? WHERE email=? AND user_id IS NULL').bind(user.userId,email).run();member=await db.prepare('SELECT * FROM members WHERE email=?').bind(email).first<typeof member>();if(member?.user_id!==user.userId)throw new RequestError('403:Your staff identity could not be verified.');}
 const groups=JSON.parse(member.groups_json) as string[];
 if(!Array.isArray(groups)||groups.some(g=>!/^Group [A-T]$/.test(g)))throw new RequestError('403:Your group assignment needs administrator review.');
 return {db,user,owner,email,role:member.role,groups};
}
export {failure};
export async function GET(){try{
 const {db,user,owner,email,role,groups}=await context();
 await rateLimit(db,user.userId,'read',120);
 const all=['medical_lead','coordinator','analyst'].includes(role);const isClinical=['medical_lead','doctor','nurse','mentor'].includes(role);
 let warriors=(await db.prepare('SELECT * FROM warriors ORDER BY group_name,name').all()).results as any[];
 if(!all)warriors=warriors.filter(w=>groups.includes(w.group_name));if(role==='administrator')warriors=[];
 const ids=new Set(warriors.map(w=>w.id));
 const entries=isClinical||role==='analyst'?(await db.prepare('SELECT * FROM entries ORDER BY measured_at DESC').all()).results.filter((e:any)=>ids.has(e.warrior_id)).map((e:any)=>({...e,payload:JSON.parse(e.payload)})):[];
 const reviews=isClinical?(await db.prepare('SELECT * FROM reviews ORDER BY created_at DESC').all()).results.filter((e:any)=>ids.has(e.warrior_id)):[];
 const regimens=['medical_lead','doctor','nurse'].includes(role)?(await db.prepare('SELECT * FROM regimens ORDER BY version DESC').all()).results.filter((e:any)=>ids.has(e.warrior_id)):[];
 if(['coordinator','analyst'].includes(role))for(const w of warriors)delete w.allergies;
 if(role==='analyst')warriors=warriors.map((w:any,i:number)=>({...w,name:`Participant ${i+1}`,guardian:undefined,contact:undefined,room:''}));
 return Response.json({mode:runtime().APP_MODE==='demo'?'demo':'production',authProvider:runtime().APP_MODE==='demo'||runtime().APP_AUTH_PROVIDER==='sites'?'sites':'supabase',offlineExpiresAt:new Date(Date.now()+8*3600000).toISOString(),user:{email,name:user.displayName,role,groups,owner,id:user.userId},warriors,entries:role==='analyst'?entries.filter((e:any)=>e.kind==='reading').map((e:any)=>({...e,author:'',author_id:undefined,payload:{value:e.payload.value,unit:e.payload.unit,slot:e.payload.slot,method:e.payload.method}})):entries,reviews,regimens,members:role==='medical_lead'?(await db.prepare('SELECT * FROM members').all()).results.map((m:any)=>({email:m.email,role:m.role,groups:JSON.parse(m.groups_json),active:m.active===1})):[],serverTime:new Date().toISOString()},{headers:secureHeaders});
 }catch(e){return failure(e);}}
