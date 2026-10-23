import {accountInput} from './staff-account-input.ts';
export class StaffAccountError extends Error{constructor(readonly status:number,message:string){super(message);}}
type Actor={role:string;active:boolean;owner:boolean;sessionValid:boolean};
export type AccountDependencies={
 actor:()=>Promise<Actor|null>;
 rateLimit:()=>Promise<void>;
 linkedAccount:(email:string)=>Promise<boolean>;
 create:(input:ReturnType<typeof accountInput>)=>Promise<{id?:string;code?:string}>;
 link:(input:Omit<ReturnType<typeof accountInput>,'password'>,id:string)=>Promise<void>;
 removeCreated:(id:string)=>Promise<void>;
};
// Runs inside the adapter's transaction. Never write passwords to membership,
// command or audit tables; they only go to the authentication provider.
export async function provisionStaff(value:unknown,deps:AccountDependencies){
 const actor=await deps.actor();
 if(!actor||!actor.active||!actor.sessionValid)throw new StaffAccountError(401,'Sign in again before creating accounts.');
 if(!actor.owner&&actor.role!=='administrator')throw new StaffAccountError(403,'Only a camp administrator can create staff accounts.');
 await deps.rateLimit();
 const input=accountInput(value);
 if(await deps.linkedAccount(input.email))throw new StaffAccountError(409,'This staff account already exists. Its password and access were not changed.');
 const result=await deps.create(input);
 if(!result.id){
  if(['email_exists','user_already_exists','identity_already_exists'].includes(result.code||''))throw new StaffAccountError(409,'A login already exists for this email. Its password was not changed. Edit the existing staff access instead.');
  if(result.code==='weak_password')throw new StaffAccountError(400,'Choose a stronger password that meets the password requirements.');
  throw new StaffAccountError(503,'The sign-in provider could not create this account. Try again.');
 }
 const {password:secret,...membership}=input;
 try{await deps.link(membership,result.id);}catch{
  // Compensation only targets the principal created by this request.
  await deps.removeCreated(result.id).catch(()=>{});
  throw new StaffAccountError(503,'Account setup did not finish. Contact the administrator before retrying.');
 }
 return {id:result.id,email:input.email,role:input.role,groups:input.groups};
}
