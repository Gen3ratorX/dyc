import {getStaffUser} from './staff-auth';
import {roles} from './domain';
import {runtime,RequestError} from './server-security';
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
