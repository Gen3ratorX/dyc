export const slots = ['Waking','Before lunch','Before dinner','Bedtime','3 a.m.'] as const;
export const roles = ['medical_lead','doctor','nurse','mentor','coordinator','analyst','administrator'] as const;
export type Role = typeof roles[number];
export type Warrior = {id:string;name:string;age:number;group_name:string;room:string;guardian?:string;contact?:string;allergies?:string;version:number};
export type Entry = {id:string;warrior_id:string;kind:string;care_day:string;measured_at:string;payload:Record<string,any>;author:string;received_at:string};
export type Review = {id:string;warrior_id:string;reason:string;status:string;owner:string;proposed_owner:string|null;version:number;created_at:string;outcome:string};
export type Regimen = {id:string;warrior_id:string;medicine:string;dose:string;instructions:string;author:string;at:string;version:number};
export type Member = {email:string;role:Role;groups:string[];active?:boolean;isOwner?:boolean;revision?:string};
export type Camp = {mode?:'demo'|'production';offlineExpiresAt?:string;authProvider?:'sites'|'supabase';user:{email:string;name:string;role:Role;groups:string[];owner:boolean;id:string};warriors:Warrior[];entries:Entry[];reviews:Review[];regimens:Regimen[];members:Member[];serverTime:string};
export type Command = {id:string;type:string;warrior?:string;payload:Record<string,any>;createdAt:string;actor:string};
export function careDay(at:string){const d=new Date(new Date(at).getTime()-6*3600000);return d.toISOString().slice(0,10);}
export function can(role:Role, action:string){const map:Record<string,readonly string[]>={reading:['medical_lead','doctor','nurse','mentor'],note:['medical_lead','doctor','nurse','mentor'],review:['medical_lead','doctor','nurse','mentor'],exception:['medical_lead','doctor','nurse'],regimen:['medical_lead','doctor'],administration:['medical_lead','doctor','nurse'],transition:['medical_lead','doctor'],register:['medical_lead','coordinator'],assignment:['medical_lead','coordinator'],members:['medical_lead','administrator'],seed:['medical_lead']};return (map[action]||[]).includes(role);}
export class ValidationError extends Error { constructor(message:string){super(message);this.name='ValidationError';} }
const invalid=(message:string):never=>{throw new ValidationError(message);};
export function validDay(value:unknown):value is string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function bounded(value:unknown,label:string,max:number,required=false){if(value===undefined||value===null){if(required)invalid(label+' is required.');return;}if(typeof value!=='string'||value.length>max||(required&&!value.trim()))invalid(label+' must be '+(required?'non-empty and ':'')+'at most '+max+' characters.');}
function version(value:unknown,label='Version'){if(!Number.isSafeInteger(value)||Number(value)<0)invalid(label+' is invalid. Refresh and try again.');}
export function validate(type:string,p:Record<string,any>){
 if(!p||typeof p!=='object'||Array.isArray(p))invalid('Entry details must be an object.');
 if(!['reading','note','exception','administration','review','transition','regimen','register','assignment','members','seed'].includes(type))invalid('Unknown action.');
 rejectCredentials(p);
 bounded(p.note,'Note',4000);bounded(p.overrideReason,'Care-day explanation',1000);
 if(type==='reading'){
  if(!slots.includes(p.slot)&&p.slot!=='Unscheduled')invalid('Choose a valid check.');
  if(!['Finger-prick glucometer','CGM transcription','Laboratory transcription'].includes(p.method))invalid('Choose a measurement method.');
  if(p.unit!=='mmol/L')invalid('Readings must use mmol/L.');
  if(!['HI','LO'].includes(p.value)&&!(typeof p.value==='number'&&Number.isFinite(p.value)&&p.value>0))invalid('Enter a positive measured value, HI or LO.');
 }
 if(['reading','note','exception','administration'].includes(type)){
  if(typeof p.measuredAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(p.measuredAt)||!Number.isFinite(Date.parse(p.measuredAt))||!validDay(p.measuredAt.slice(0,10))||new Date(p.measuredAt).toISOString().slice(0,19)!==p.measuredAt.slice(0,19))invalid('A valid UTC measurement date and time are required.');
  if(Date.parse(p.measuredAt)>Date.now()+300000)invalid('The observation time is in the future.');
  if(!validDay(p.careDay))invalid('A valid care day is required.');
  if(p.careDay!==careDay(p.measuredAt)&&!String(p.overrideReason||'').trim())invalid('Explain the care-day override.');
 }
 if(type==='exception'){if(!slots.includes(p.slot)||!['Declined','Not required'].includes(p.status))invalid('Choose a valid check and status.');bounded(p.note,'Exception reason',4000,true);}
 if(type==='review')bounded(p.reason,'Review reason',4000,true);
 if(type==='note')bounded(p.note,'Observation',4000,true);
 if(type==='regimen'){bounded(p.medicine,'Medicine',150,true);bounded(p.dose,'Prescribed dose',150,true);bounded(p.instructions,'Instructions',4000,true);version(p.baseVersion);}
 if(type==='administration'){bounded(p.medicine,'Medicine',150,true);bounded(p.doseUnit,'Dose unit',50,true);bounded(p.regimenId,'Prescription',100,true);if(!(typeof p.dose==='number'&&Number.isFinite(p.dose)&&p.dose>0))invalid('Enter the actual positive dose administered.');}
 if(type==='register'){bounded(p.name,'Warrior name',150,true);if(!Number.isInteger(p.age)||p.age<0||p.age>120||!/^Group [A-T]$/.test(p.group))invalid('Choose a valid age and group.');bounded(p.room,'Room',80);bounded(p.guardian,'Guardian name',150);bounded(p.contact,'Contact',100);bounded(p.allergies,'Allergies and conditions',2000);}
 if(type==='assignment'){if(!/^Group [A-T]$/.test(p.group))invalid('Choose a valid group.');bounded(p.room,'Room',80);version(p.version);}
 if(type==='transition'){if(p.action!==undefined&&!['handover','accept'].includes(p.action))invalid('Choose a valid review action.');bounded(p.reviewId,'Review',100,true);version(p.version);if(p.version<1)invalid('Refresh the review first.');bounded(p.outcome,'Clinical outcome',4000);if(p.action==='handover'){bounded(p.to,'Incoming owner',254,true);}else if(p.action!=='accept'&&!['Acknowledged','In progress','Resolved','Reopened'].includes(p.status))invalid('Choose a valid review action.');}
 if(type==='members'){bounded(p.revision,'Staff access revision',2000);if(['doctor','nurse','mentor'].includes(p.role)&&(!Array.isArray(p.groups)||!p.groups.length))invalid('Assign at least one group for this role.');if(p.active!==undefined&&typeof p.active!=='boolean')invalid('Staff status is invalid.');if(typeof p.email!=='string'||p.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)||!roles.includes(p.role)||!Array.isArray(p.groups)||p.groups.length>20||p.groups.some((g:any)=>typeof g!=='string'||!/^Group [A-T]$/.test(g)))invalid('Enter a valid staff email, role and assigned groups.');}
}
// A permission revision is a comparison token, not an authorization credential.
export function memberRevision(member:{role:string;groups_json:string;active:number}){return JSON.stringify([member.role,JSON.parse(member.groups_json),member.active]);}
export function rejectCredentials(value:unknown){
 if(!value||typeof value!=='object')return;
 for(const [key,item] of Object.entries(value)){if(/^(password|currentPassword|newPassword|confirmPassword|confirmNewPassword|access_token|refresh_token|service_role_key)$/i.test(key))invalid('Use the account or password form to manage credentials.');rejectCredentials(item);}
}
export function csv(rows:unknown[][]){return rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[\s]*[=+@\-]|^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
