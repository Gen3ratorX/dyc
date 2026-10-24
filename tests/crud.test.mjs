// Real route handlers against an isolated in-memory relational database.
// Identity and transport adapters are replaced; validation, permissions, SQL,
// transaction guards, response filtering and CSV exports are production code.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
const encode=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const domainURL=encode(compile('lib/domain.ts'));
const {memberRevision}=await import(domainURL);
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON;');
const migration=readFileSync('supabase/migrations/20261022075106_dyc_camp_schema.sql','utf8');
sqlite.exec(migration.slice(migration.indexOf('CREATE TABLE "warriors"'),migration.indexOf('REVOKE ALL ON ALL TABLES')));
let beforeBatch;
const statements=[];
function prepare(sql){const q={sql,values:[],bind(...values){return {...q,values};},async first(){return sqlite.prepare(sql).get(...this.values)||null;},async all(){return {results:sqlite.prepare(sql).all(...this.values)};},async run(){const r=sqlite.prepare(sql).run(...this.values);return {meta:{changes:Number(r.changes)}};}};return q;}
const db={prepare,async batch(queries){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sqlite.exec('BEGIN');try{for(const q of queries){sqlite.prepare(q.sql).run(...q.values);}sqlite.exec('COMMIT');statements.push(...queries);}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
let actor={email:'owner@example.invalid',role:'medical_lead',groups:[],owner:true,user:{userId:'owner',email:'owner@example.invalid',displayName:'Synthetic owner'}};
const initialActors=[['owner@example.invalid','medical_lead','[]','owner'],['doctor@example.invalid','doctor','["Group A"]','doctor'],['nurse@example.invalid','nurse','["Group A"]','nurse'],['mentor@example.invalid','mentor','["Group A"]','mentor'],['coordinator@example.invalid','coordinator','[]','coordinator'],['analyst@example.invalid','analyst','[]','analyst'],['admin@example.invalid','administrator','[]','admin']];
for(const m of initialActors)sqlite.prepare('INSERT INTO members(email,role,groups_json,active,user_id) VALUES(?,?,?,1,?)').run(...m);
sqlite.prepare("INSERT INTO settings(key,value) VALUES('owner','owner')").run();
const securityURL=encode(`import {ValidationError} from ${JSON.stringify(domainURL)};
export class RequestError extends Error{constructor(m){super(m.replace(/^\\d{3}:/,''));this.status=Number(m.match(/^(\\d{3}):/)?.[1]||400);}}
export const secureHeaders={'Cache-Control':'private, no-store'};
export const runtime=()=>({APP_MODE:'production'});
export const rateLimit=async()=>{};
export function requireSameOrigin(r){if(r.headers.get('origin')!=='https://camp.test')throw new RequestError('403:Wrong origin');}
export const failure=e=>Response.json({error:e.message},{status:e.status||(e instanceof ValidationError?400:503)});`);
const contextURL=encode(`export const context=()=>globalThis.__dycTestContext();`);
globalThis.__dycTestContext=async()=>{const m=sqlite.prepare('SELECT * FROM members WHERE email=?').get(actor.email);if(!m||!m.active)throw new (await import(securityURL)).RequestError('403:Inactive');return {db,...actor,role:m.role,groups:JSON.parse(m.groups_json)};};
async function route(path){return import(encode(compile(path).replaceAll('../../../lib/camp-context',contextURL).replaceAll('../../../lib/server-security',securityURL).replaceAll('../../../lib/domain',domainURL)));}
const command=await route('app/api/command/route.ts'),camp=await route('app/api/camp/route.ts'),exportsRoute=await route('app/api/exports/route.ts');
function as(id){const m=initialActors.find(m=>m[3]===id);actor={email:m[0],role:m[1],groups:JSON.parse(m[2]),owner:id==='owner',user:{userId:id,email:m[0],displayName:'Synthetic '+id}};}
async function send(type,payload,warrior,extra={}){const body={id:crypto.randomUUID(),actor:actor.user.userId,type,payload,warrior,createdAt:new Date().toISOString(),...extra};const r=await command.POST(new Request('https://camp.test/api/command',{method:'POST',headers:{Origin:'https://camp.test','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,data:await r.json(),body};}
const expect=async(promise,status)=>{const r=await promise;assert.equal(r.status,status,JSON.stringify(r.data));return r;};
const created=await expect(send('register',{name:'Synthetic warrior',age:12,group:'Group A',contact:'Synthetic contact',guardian:'Synthetic guardian',allergies:'Synthetic allergy'}),200);
const warrior='W-'+created.body.id;
const at=new Date(Date.now()-60000).toISOString(),day=new Date(Date.parse(at)-21600000).toISOString().slice(0,10);
const reading={value:6.2,unit:'mmol/L',slot:'Waking',method:'Finger-prick glucometer',measuredAt:at,careDay:day};
await expect(send('reading',{...reading,measuredAt:day+'T24:00:00Z'} ,warrior),400);
await expect(send('reading',{...reading,password:'Synthetic secret must never persist'},warrior),400);
const saved=await expect(send('reading',reading,warrior),200);
const retry=await expect(send('reading',reading,warrior,saved.body),200);assert.equal(retry.data.duplicate,true);
await expect(send('reading',{...reading,value:9},warrior,{...saved.body,payload:{...reading,value:9}}),409);
assert.equal(sqlite.prepare('SELECT count(*) n FROM entries').get().n,1);
await expect(send('note',{measuredAt:at,careDay:day,note:'Synthetic care note'},warrior),200);
const reg=await expect(send('regimen',{medicine:'Synthetic medicine',dose:'TEST ONLY',instructions:'No actual treatment',baseVersion:0},warrior),200);
await expect(send('regimen',{medicine:'Synthetic medicine',dose:'TEST',instructions:'Stale',baseVersion:0},warrior),409);
beforeBatch=()=>sqlite.prepare("INSERT INTO regimens VALUES('racing-prescription',?,'Synthetic medicine','TEST','Synthetic','owner@example.invalid',?,2)").run(warrior,at);
await expect(send('regimen',{medicine:'Synthetic medicine',dose:'Stale draft',instructions:'Do not overwrite',baseVersion:1},warrior),409);
await expect(send('administration',{...reading,regimenId:reg.body.id,medicine:'Synthetic medicine',dose:1,doseUnit:'test units'},warrior),409);
const currentReg=sqlite.prepare('SELECT id FROM regimens WHERE warrior_id=? ORDER BY version DESC LIMIT 1').get(warrior).id;
await expect(send('administration',{...reading,regimenId:currentReg,medicine:'Synthetic medicine',dose:1,doseUnit:'test units'},warrior),200);
const review=await expect(send('review',{reason:'Synthetic review'},warrior),200);
await expect(send('transition',{reviewId:review.body.id,version:1,status:'Resolved',outcome:'Invalid skip'},warrior),409);
await expect(send('transition',{reviewId:review.body.id,version:1,status:'Acknowledged'},warrior),200);
await expect(send('transition',{reviewId:review.body.id,version:1,status:'Acknowledged'},warrior),409);
await expect(send('transition',{reviewId:review.body.id,version:2,action:'unknown',status:'Resolved'},warrior),400);
await expect(send('transition',{reviewId:review.body.id,version:2,action:'handover',to:'doctor@example.invalid'},warrior),200);
as('doctor');await expect(send('transition',{reviewId:review.body.id,version:3,action:'accept'},warrior),200);
await expect(send('transition',{reviewId:review.body.id,version:4,status:'Resolved',outcome:'Synthetic resolution'},warrior),200);
assert.equal(sqlite.prepare('SELECT proposed_owner FROM reviews WHERE id=?').get(review.body.id).proposed_owner,null);
await expect(send('transition',{reviewId:review.body.id,version:5,action:'accept'},warrior),409);
as('owner');await expect(send('transition',{reviewId:review.body.id,version:5,action:'handover',to:'doctor@example.invalid'},warrior),409);
await expect(send('transition',{reviewId:review.body.id,version:5,status:'Reopened'},warrior),200);
// A suspension after validation but before the write must roll back the handover.
beforeBatch=()=>sqlite.prepare("UPDATE members SET active=0 WHERE user_id='doctor'").run();
await expect(send('transition',{reviewId:review.body.id,version:6,action:'handover',to:'doctor@example.invalid'},warrior),409);
assert.equal(sqlite.prepare('SELECT proposed_owner FROM reviews WHERE id=?').get(review.body.id).proposed_owner,null);
sqlite.prepare("UPDATE members SET active=1 WHERE user_id='doctor'").run();
// Same race for a warrior moved out of the recorder's assigned group.
as('mentor');beforeBatch=()=>sqlite.prepare("UPDATE warriors SET group_name='Group B',version=version+1 WHERE id=?").run(warrior);
await expect(send('reading',reading,warrior),409);
await expect(send('reading',reading,warrior),403);
as('owner');await expect(send('assignment',{group:'Group A',room:'Test',version:1},warrior),409);
await expect(send('assignment',{group:'Group A',room:'Test',version:2},warrior),200);
as('nurse');await expect(send('exception',{...reading,status:'Not required',note:'Synthetic'},warrior),403);
as('mentor');await expect(send('regimen',{medicine:'Test',dose:'Test',instructions:'Test',baseVersion:1},warrior),403);
await expect(send('reading',reading,warrior),200);
as('owner');
const target=sqlite.prepare("SELECT * FROM members WHERE user_id='mentor'").get();const permission={email:target.email,role:target.role,groups:JSON.parse(target.groups_json),active:false,revision:memberRevision(target)};
sqlite.prepare("INSERT INTO staff_sessions VALUES('test-session','mentor',0,9999999999999,0)").run();
await expect(send('members',permission),200);
assert.equal(sqlite.prepare("SELECT revoked FROM staff_sessions WHERE id='test-session'").get().revoked,1);
await expect(send('members',{...permission,active:true}),409);
const updated=sqlite.prepare("SELECT * FROM members WHERE user_id='mentor'").get();
// Another administrator changes permissions between precheck and transaction.
beforeBatch=()=>sqlite.prepare("UPDATE members SET groups_json='[\"Group B\"]' WHERE user_id='mentor'").run();
await expect(send('members',{...permission,revision:memberRevision(updated),active:true}),409);
assert.equal(sqlite.prepare("SELECT active FROM members WHERE user_id='mentor'").get().active,0);
as('admin');await expect(send('register',{name:'Denied',age:12,group:'Group A'}),403);
const adminCamp=await(await camp.GET()).json();assert.equal(adminCamp.warriors.length,0);assert.ok(adminCamp.members.every(m=>typeof m.revision==='string'));
as('coordinator');const coordinator=await(await camp.GET()).json();assert.equal(coordinator.entries.length,0);assert.equal(coordinator.warriors[0].allergies,undefined);
as('analyst');const analyst=await(await camp.GET()).json();assert.ok(analyst.warriors.every(w=>!w.contact&&!w.guardian));assert.ok(analyst.entries.every(e=>e.kind==='reading'&&!e.author&&!e.payload.note));
const exported=await exportsRoute.POST(new Request('https://camp.test/api/exports',{method:'POST',headers:{Origin:'https://camp.test','Content-Type':'application/json'},body:JSON.stringify({careDay:day,scope:'All groups'})}));assert.equal(exported.status,200);const csv=await exported.text();assert.ok(!csv.includes(warrior)&&!csv.includes('owner@example.invalid'));
assert.equal(sqlite.prepare('SELECT count(*) n FROM export_events').get().n,1);
assert.equal(sqlite.prepare("SELECT count(*) n FROM commands WHERE body LIKE '%Synthetic secret%'").get().n,0);
// EXPLAIN-only production SQL probe: validate generated syntax without executing
// the writes or touching any real camp record.
if(process.env.DYC_CRUD_SQL_OUTPUT){
 const {postgresQuery}=await import(encode(compile('lib/sql-compat.ts')));
 const literal=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
 const queries=statements.map(q=>postgresQuery(q.sql,1).replace(/\$(\d+)/g,(_,n)=>literal(q.values[Number(n)-1])));
 writeFileSync(process.env.DYC_CRUD_SQL_OUTPUT,JSON.stringify(queries));
}
const ui=readFileSync('app/pilot.tsx','utf8');
assert.ok(ui.includes('payload.baseVersion = formVersions.current.regimen'));
assert.ok(ui.includes('payload.version = formVersions.current.warrior'));
assert.ok(ui.includes('const regimen = formRegimen;'));
console.log('CRUD route checks passed: persisted creates/reads, idempotent retries, stale writes, prescription history, administrations, review lifecycle, scoped writes during reassignment, handover suspension race, staff permission CAS, session suspension, field filtering and audited exports.');
delete globalThis.__dycTestContext;sqlite.close();
