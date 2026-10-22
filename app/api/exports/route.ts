import {context} from '../../../lib/camp-context';
import {csv,validDay} from '../../../lib/domain';
import {failure,RequestError,requireSameOrigin,secureHeaders,rateLimit} from '../../../lib/server-security';
export async function POST(request:Request){try{
 requireSameOrigin(request);const {db,user,role,groups}=await context();
 if(!['medical_lead','doctor','nurse','analyst'].includes(role))throw new RequestError('403:Your role cannot export clinical records.');
 await rateLimit(db,user.userId,'export',6);
 const text=await request.text();if(text.length>1024)throw new RequestError('413:Request too large.');
 let body;try{body=JSON.parse(text);}catch{throw new RequestError('400:Invalid export request.');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new RequestError('400:Choose a care day and group.');
 if(!validDay(body.careDay)||typeof body.scope!=='string'||(body.scope!=='All groups'&&!/^Group [A-T]$/.test(body.scope)))throw new RequestError('400:Choose a care day and group.');
 const all=['medical_lead','analyst'].includes(role);
 if(!all&&(!groups.length||(body.scope!=='All groups'&&!groups.includes(body.scope))))throw new RequestError('403:This group is not assigned to you.');
 const selected=body.scope==='All groups'?(all?[]:groups):[body.scope];
 const filter=selected.length?' AND w.group_name IN ('+selected.map(()=>'?').join(',')+')':'';
 const entries=(await db.prepare("SELECT e.* FROM entries e JOIN warriors w ON w.id=e.warrior_id WHERE e.kind='reading' AND e.care_day=?"+filter+' ORDER BY e.measured_at,e.id LIMIT 10001').bind(body.careDay,...selected).all()).results as any[];
 if(entries.length>10000)throw new RequestError('413:This export is too large. Select one group at a time.');
 let salt='';if(role==='analyst'){await db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('export_pseudonym_salt',?)").bind(crypto.randomUUID()).run();salt=(await db.prepare("SELECT value FROM settings WHERE key='export_pseudonym_salt'").first<{value:string}>())!.value;}
 const labels=new Map<string,string>();
 const rows:unknown[][]=[['Warrior ID','Care day','Measured at UTC','Check','Value','Unit','Method','Author','Action / note']];
 for(const entry of entries){const p=JSON.parse(entry.payload);let id=entry.warrior_id;if(role==='analyst'){if(!labels.has(id)){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+id));labels.set(id,'Participant-'+Array.from(new Uint8Array(hash)).slice(0,8).map(x=>x.toString(16).padStart(2,'0')).join(''));}id=labels.get(id)!;}rows.push([id,entry.care_day,entry.measured_at,p.slot,p.value,'mmol/L',p.method,role==='analyst'?'':entry.author,role==='analyst'?'':p.note]);}
 await db.prepare('INSERT INTO export_events (id,actor,at,care_day,scope,rows) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,new Date().toISOString(),body.careDay,body.scope,entries.length).run();
 return new Response('\uFEFF'+csv(rows),{headers:{...secureHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="dyc-readings-${body.careDay}.csv"`}});
}catch(error){return failure(error);}}
