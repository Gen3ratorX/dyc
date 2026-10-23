import { cookies } from 'next/headers';
import { runtime } from './server-security';
const COOKIE='__Host-dyc-staff';
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function createStaffSession(userId:string){
 const db=runtime().DB;if(!db)throw Error('Database unavailable');
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const now=Date.now(),expires=now+8*3600000;
 await db.prepare('INSERT INTO staff_sessions (id,user_id,last_seen,expires_at,revoked) VALUES (?,?,?,?,0)').bind(await digest(token),userId,now,expires).run();
 (await cookies()).set(COOKIE,token,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:8*3600});
}
export async function verifyStaffSession(userId:string){
 const db=runtime().DB,token=(await cookies()).get(COOKIE)?.value;if(!db||!token||! /^[a-f0-9]{64}$/.test(token))return false;
 const now=Date.now();
 const row=await db.prepare('UPDATE staff_sessions SET last_seen=? WHERE id=? AND user_id=? AND revoked=0 AND expires_at>? AND last_seen>? RETURNING user_id').bind(now,await digest(token),userId,now,now-15*60000).first();
 return Boolean(row);
}
export async function revokeStaffSession(){const db=runtime().DB,jar=await cookies(),token=jar.get(COOKIE)?.value;if(db&&token)await db.prepare('UPDATE staff_sessions SET revoked=1 WHERE id=?').bind(await digest(token)).run();jar.set(COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});}

export async function staffSessionDigest(){const token=(await cookies()).get(COOKIE)?.value;return token&&/^[a-f0-9]{64}$/.test(token)?await digest(token):null;}
