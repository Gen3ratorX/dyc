import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const inputUrl=url(compile('lib/staff-account-input.ts'));
const {accountInput,validatePassword,canManageStaff}=await import(inputUrl);
const {provisionStaff}=await import(url(compile('lib/staff-account-service.ts').replaceAll('./staff-account-input.ts',inputUrl)));
const {changeOwnPassword}=await import(url(compile('lib/password-service.ts').replaceAll('./staff-account-input',inputUrl)));
const secret='Synthetic-Test-'+crypto.randomUUID();
const input={email:' DOCTOR@EXAMPLE.INVALID ',fullName:'Synthetic Doctor',password:secret,role:'doctor',groups:['Group A','Group A']};
assert.deepEqual(accountInput(input).groups,['Group A']);assert.equal(accountInput(input).email,'doctor@example.invalid');
for(const password of ['', 'short', '            ','x'.repeat(73),'😀'.repeat(20)])assert.throws(()=>validatePassword(password));
assert.equal(validatePassword('x'.repeat(72)).length,72);
for(const bad of [{...input,role:'owner'},{...input,groups:[]},{...input,groups:['Group Z']},{...input,fullName:''},{...input,email:'bad'}])assert.throws(()=>accountInput(bad));
assert.equal(canManageStaff({owner:false,role:'doctor'}),false);assert.equal(canManageStaff({role:'administrator'}),true);
let created=0,linked=0,removed=[],membership;
const deps=()=>({actor:async()=>({role:'medical_lead',active:true,owner:true,sessionValid:true}),rateLimit:async()=>{},linkedAccount:async()=>false,create:async()=>{created++;return {id:'new-synthetic-id'};},link:async(data)=>{linked++;membership=data;},removeCreated:async id=>{removed.push(id);}});
for(const actor of [null,{role:'doctor',owner:false,active:true,sessionValid:true},{role:'administrator',owner:false,active:false,sessionValid:true},{role:'administrator',owner:false,active:true,sessionValid:false}]){
 await assert.rejects(()=>provisionStaff(input,{...deps(),actor:async()=>actor}));assert.equal(created,0);
}
const result=await provisionStaff(input,deps());assert.equal(created,1);assert.equal(linked,1);assert.equal('password' in membership,false);assert.equal(JSON.stringify(result).includes(secret),false);
await provisionStaff(input,{...deps(),actor:async()=>({role:'administrator',owner:false,active:true,sessionValid:true})});
await assert.rejects(()=>provisionStaff(input,{...deps(),linkedAccount:async()=>true}),e=>e.status===409);
await assert.rejects(()=>provisionStaff(input,{...deps(),create:async()=>({code:'email_exists'})}),e=>e.status===409);
await assert.rejects(()=>provisionStaff(input,{...deps(),link:async()=>{throw Error('Synthetic DB conflict');}}),e=>e.status===503);assert.deepEqual(removed,['new-synthetic-id']);
let calls=[];
const passwordDeps=()=>({provider:{auth:{signInWithPassword:async data=>{calls.push(['verify',data.email]);return {data:{user:{id:'staff-self'}},error:null};},updateUser:async data=>{calls.push(['update',data.password]);return {error:null};},signOut:async data=>{calls.push(['signout',data.scope]);return {error:null};}}},revokeSessions:async()=>{calls.push(['revoke']);},clearSession:async()=>{calls.push(['clear']);}});
const body={currentPassword:'old-synthetic-password',newPassword:secret,confirmPassword:secret,id:'different-user',email:'other@example.invalid'};
let changed=await changeOwnPassword({id:'staff-self',email:'self@example.invalid'},body,passwordDeps());assert.equal(changed.sessionsClosed,true);assert.equal(calls[0][1],'self@example.invalid');assert.ok(calls.findIndex(c=>c[0]==='revoke')<calls.findIndex(c=>c[0]==='signout'));
calls=[];await assert.rejects(()=>changeOwnPassword({id:'staff-self',email:'self@example.invalid'},{...body,confirmPassword:'no'},passwordDeps()));assert.equal(calls.length,0);
const wrong=passwordDeps();wrong.provider.auth.signInWithPassword=async()=>({data:{user:null},error:{code:'invalid_credentials'}});await assert.rejects(()=>changeOwnPassword({id:'staff-self',email:'self@example.invalid'},body,wrong),/current password is incorrect/);assert.equal(calls.length,0);
calls=[];changed=await changeOwnPassword({id:'staff-self',email:'self@example.invalid'},body,{...passwordDeps(),revokeSessions:async()=>{throw Error('Synthetic outage');}});assert.equal(changed.sessionsClosed,false);assert.ok(calls.some(c=>c[0]==='clear'));
console.log('Staff account checks passed: administrator-only provisioning, roles/groups, duplicate protection, password boundaries, compensation, no password persistence, self-only password changes, current-password verification and session closure.');

// Edge SQL bypasses the app SQL compatibility layer; reserved identifiers must
// already be quoted before reaching Postgres.
const edgeSource=readFileSync('supabase/functions/dyc-staff-accounts/index.ts','utf8');
const bucketQuery=edgeSource.match(/tx\.unsafe\('([^']*INSERT INTO request_buckets[^']*)'/)?.[1];
assert.ok(bucketQuery,'Exercise the actual Edge rate-limit statement');
assert.ok(bucketQuery.includes('(id,requests,"window")'));
assert.ok(!/\(id,requests,window\)/.test(bucketQuery));
