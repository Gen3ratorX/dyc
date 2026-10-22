import {context,failure} from '../camp/route';
import {runtime,RequestError,requireSameOrigin,secureHeaders,rateLimit} from '../../../lib/server-security';
import {can,roles,validate, type Role} from '../../../lib/domain';
export async function POST(req:Request){try{
 requireSameOrigin(req);
 const {db,user,role,groups,owner,email}=await context();
 await rateLimit(db,user.userId,'write',90);
 const text=await req.text();if(text.length>24000)throw new RequestError('413:Entry too large.');let c;try{c=JSON.parse(text);}catch{throw new RequestError('400:Invalid JSON request.');}if(!c||typeof c!=='object'||Array.isArray(c))throw new RequestError('400:Invalid command.');const p=c.payload||{};
 if(typeof c.id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(c.id)||c.actor!==user.userId)throw new RequestError('403:Entry author does not match this session.');
 const previous=await db.prepare('SELECT actor,body FROM commands WHERE id=?').bind(c.id).first<{actor:string;body:string}>();
 if(previous){if(previous.actor!==user.userId||previous.body!==text)throw new RequestError('409:This entry ID was already used for different content.');return Response.json({ok:true,duplicate:true},{headers:secureHeaders});}
 if(!can(role as Role,c.type))throw new RequestError('403:Your role cannot perform this action.');validate(c.type,p);
 if(c.type==='seed'&&runtime().APP_MODE!=='demo')throw new RequestError('403:Demo seeding is disabled in production.');
 if(['members','seed'].includes(c.type)&&!owner)throw new RequestError('403:Only the camp owner can manage staff or seed data.');
 if(c.warrior){const w=await db.prepare('SELECT * FROM warriors WHERE id=?').bind(c.warrior).first<any>();if(!w)throw new RequestError('404:Warrior not found.');if(!['medical_lead','coordinator'].includes(role)&&!groups.includes(w.group_name))throw new RequestError('403:This warrior is not assigned to you.');}
 else if(!['register','members','seed'].includes(c.type))throw new RequestError('A warrior is required.');
 if(c.type==='exception'&&p.status==='Not required'){if(!['medical_lead','doctor'].includes(role))throw new RequestError('403:Only a doctor can mark a check not required.');const existing=(await db.prepare('SELECT payload FROM entries WHERE warrior_id=? AND care_day=?').bind(c.warrior,p.careDay).all()).results;if(existing.some((e:any)=>JSON.parse(e.payload).slot===p.slot))throw new RequestError('409:This check already has a record. Add an observation instead of replacing its status.');}
 const now=new Date().toISOString();const queries:any[]=[];
 // Recheck authorisation inside the transaction so a simultaneous suspension or
 // role/group change cannot leave a write authorised by an earlier snapshot.
 queries.push(db.prepare('INSERT INTO atomic_guards (id,value) SELECT ?, CASE WHEN EXISTS (SELECT 1 FROM members WHERE email=? AND user_id=? AND active=1 AND role=? AND groups_json=?) THEN 1 ELSE 0 END').bind(c.id,email,user.userId,role,JSON.stringify(groups)));
 queries.push(db.prepare('DELETE FROM atomic_guards WHERE id=?').bind(c.id));
 if(c.type==='members'&&p.active===false)queries.push(db.prepare('UPDATE staff_sessions SET revoked=1 WHERE user_id=(SELECT user_id FROM members WHERE email=?)').bind(p.email.toLowerCase()));
 const guard=()=>{queries.push(db.prepare('INSERT INTO atomic_guards (id,value) SELECT ?, changes()').bind(c.id));queries.push(db.prepare('DELETE FROM atomic_guards WHERE id=?').bind(c.id));};
 if(['reading','note','exception','administration'].includes(c.type)){
 if(c.type==='administration'){const r=await db.prepare('SELECT * FROM regimens WHERE warrior_id=? ORDER BY version DESC LIMIT 1').bind(c.warrior).first<any>();if(!r||r.id!==p.regimenId)throw new RequestError('409:The regimen changed. Review and reconcile this administration.');if(p.medicine!==r.medicine)throw new RequestError('Medicine does not match the regimen.');}
 let condition='',conditions:unknown[]=[];
 if(c.type==='administration'){
  condition=' WHERE (SELECT id FROM regimens WHERE warrior_id=? ORDER BY version DESC LIMIT 1)=? AND EXISTS (SELECT 1 FROM regimens WHERE id=? AND warrior_id=? AND medicine=?)';
  conditions=[c.warrior,p.regimenId,p.regimenId,c.warrior,p.medicine];
 }
 if(c.type==='exception'&&p.status==='Not required'){
  condition=" WHERE NOT EXISTS (SELECT 1 FROM entries WHERE warrior_id=? AND care_day=? AND json_extract(payload,'$.slot')=?)";
  conditions=[c.warrior,p.careDay,p.slot];
 }
 queries.push(db.prepare('INSERT INTO entries (id,warrior_id,kind,care_day,measured_at,payload,author,author_id,received_at) SELECT ?,?,?,?,?,?,?,?,?'+condition).bind(c.id,c.warrior,c.type,p.careDay,p.measuredAt,JSON.stringify(p),email,user.userId,now,...conditions));
 if(condition)guard();
 if(c.type==='exception'&&p.status==='Declined')queries.push(db.prepare("INSERT INTO reviews (id,warrior_id,reason,status,owner,version,created_at,updated_at,outcome) VALUES (?,?,?,'Open','Medical lead',1,?,?,'')").bind('review-'+c.id,c.warrior,`Declined ${p.slot}: ${p.note}`,now,now));
 }
 if(c.type==='review')queries.push(db.prepare("INSERT INTO reviews (id,warrior_id,reason,status,owner,version,created_at,updated_at,outcome) VALUES (?,?,?,'Open',?,1,?,?,'')").bind(c.id,c.warrior,p.reason,'Medical lead',now,now));
 if(c.type==='transition'){
 const r=await db.prepare('SELECT * FROM reviews WHERE id=? AND warrior_id=?').bind(p.reviewId,c.warrior).first<any>();if(!r||r.version!==p.version)throw new RequestError('409:Review changed. Refresh before updating.');
 const transitions:Record<string,string[]>={Open:['Acknowledged'],Acknowledged:['In progress','Resolved'],'In progress':['Resolved'],Resolved:['Reopened'],Reopened:['Acknowledged']};
 let status=r.status,newOwner=r.owner,proposed=r.proposed_owner;
 if(role!=='medical_lead'&&p.action!=='accept'&&p.status!=='Acknowledged'&&r.owner!==email)throw new RequestError('403:Only the responsible doctor or medical lead can update this review.');
 if(p.action==='handover'){if(!p.to||!String(p.to).includes('@'))throw new RequestError('Choose an incoming doctor.');const incoming=await db.prepare('SELECT * FROM members WHERE email=?').bind(p.to.toLowerCase()).first<any>();if(!incoming||incoming.active!==1||!['medical_lead','doctor'].includes(incoming.role))throw new RequestError('Incoming owner must be a doctor or medical lead.');const w=await db.prepare('SELECT group_name FROM warriors WHERE id=?').bind(c.warrior).first<any>();if(incoming.role!=='medical_lead'&&!JSON.parse(incoming.groups_json).includes(w.group_name))throw new RequestError('Incoming doctor is not assigned to this group.');proposed=p.to.toLowerCase();}
 else if(p.action==='accept'){if(proposed!==email)throw new RequestError('403:Only the incoming doctor can accept this handover.');newOwner=email;proposed=null;}
 else{if(!(transitions[r.status]||[]).includes(p.status))throw new RequestError('409:Invalid review transition.');if(p.status==='Resolved'&&!String(p.outcome||'').trim())throw new RequestError('Enter the clinical outcome.');status=p.status;if(status==='Acknowledged')newOwner=email;}
 queries.push(db.prepare('UPDATE reviews SET status=?,owner=?,proposed_owner=?,outcome=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(status,newOwner,proposed,p.outcome||r.outcome,now,r.id,p.version));guard();
 }
 if(c.type==='regimen'){const current=await db.prepare('SELECT version FROM regimens WHERE warrior_id=? ORDER BY version DESC LIMIT 1').bind(c.warrior).first<any>();if((current?.version||0)!==p.baseVersion)throw new RequestError('409:Regimen changed. Refresh before prescribing.');queries.push(db.prepare('INSERT INTO regimens (id,warrior_id,medicine,dose,instructions,author,at,version) VALUES (?,?,?,?,?,?,?,?)').bind(c.id,c.warrior,p.medicine,p.dose,p.instructions,email,now,p.baseVersion+1));}
 if(c.type==='register')queries.push(db.prepare('INSERT INTO warriors (id,name,age,group_name,room,guardian,contact,allergies,version) VALUES (?,?,?,?,?,?,?,?,1)').bind('W-'+c.id,p.name,p.age,p.group,String(p.room||''),String(p.guardian||''),String(p.contact||''),String(p.allergies||'Unknown')));
 if(c.type==='assignment'){if(!/^Group [A-T]$/.test(p.group))throw new RequestError('Choose a group.');const w=await db.prepare('SELECT version FROM warriors WHERE id=?').bind(c.warrior).first<any>();if(w.version!==p.version)throw new RequestError('409:Assignment changed. Refresh.');queries.push(db.prepare('UPDATE warriors SET group_name=?,room=?,version=version+1 WHERE id=? AND version=?').bind(p.group,String(p.room||''),c.warrior,p.version));guard();}
 if(c.type==='members'){if(!roles.includes(p.role)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)||!Array.isArray(p.groups)||p.groups.some((g:any)=>!/^Group [A-T]$/.test(g)))throw new RequestError('Enter a valid staff email, role and groups.');if(p.email.toLowerCase()===email)throw new RequestError('You cannot change your own role.');queries.push(db.prepare('INSERT INTO members (email,role,groups_json,active) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,groups_json=excluded.groups_json,active=excluded.active').bind(p.email.toLowerCase(),p.role,JSON.stringify([...new Set(p.groups)]),p.active===false?0:1));}
 if(c.type==='seed'){const count=await db.prepare('SELECT count(*) AS n FROM warriors').first<any>();if(count.n)throw new RequestError('409:Demo camp is already populated.');for(let i=0;i<250;i++)queries.push(db.prepare('INSERT INTO warriors (id,name,age,group_name,room,guardian,contact,allergies,version) VALUES (?,?,?,?,?,?,?,?,1)').bind(`DYC-${String(i+1).padStart(3,'0')}`,`Demo Warrior ${String(i+1).padStart(3,'0')}`,8+i%18,`Group ${String.fromCharCode(65+i%20)}`,`${1+Math.floor(i/4)}`,'Demo guardian','Demo contact — no real number','Unknown — verify at arrival'));}
 queries.push(db.prepare('INSERT INTO commands (id,actor,body,at) VALUES (?,?,?,?)').bind(c.id,user.userId,text,now));
 await db.batch(queries);return Response.json({ok:true},{headers:secureHeaders});
 }catch(e){if(e instanceof Error&&/guard_one_change|regimen_version|regimens.warrior_id|commands.id|entries.id|regimens_pkey|commands_pkey|entries_pkey/.test(e.message))return failure(new RequestError('409:Record changed or was submitted concurrently. Refresh and retry.'));return failure(e);}}
