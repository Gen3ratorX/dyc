export const staffRoles=['medical_lead','doctor','nurse','mentor','coordinator','analyst','administrator'] as const;
export class StaffInputError extends Error {}
const invalid=(message:string):never=>{throw new StaffInputError(message);};
export function validatePassword(value:unknown){
 if(typeof value!=='string'||value.trim().length<12)invalid('Use a password of at least 12 characters.');
 if(new TextEncoder().encode(value as string).length>72)invalid('This password is too long. Try a shorter password.');
 return value as string;
}
export function accountInput(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))invalid('Enter staff account details.');
 const input=value as Record<string,unknown>;
 const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))invalid('Enter a valid staff email.');
 const fullName=typeof input.fullName==='string'?input.fullName.trim():'';
 if(!fullName||fullName.length>100)invalid('Enter a staff name of up to 100 characters.');
 if(!staffRoles.includes(input.role as any))invalid('Choose a staff role.');
 if(!Array.isArray(input.groups)||input.groups.some(g=>typeof g!=='string'||!/^Group [A-T]$/.test(g)))invalid('Choose valid camp groups.');
 const groups=[...new Set(input.groups as string[])];
 if(['doctor','nurse','mentor'].includes(String(input.role))&&!groups.length)invalid('Assign at least one group for this role.');
 const password=validatePassword(input.password);
 return {email,fullName,role:input.role as typeof staffRoles[number],groups:['medical_lead','coordinator','analyst','administrator'].includes(String(input.role))?[]:groups,password};
}
export function canManageStaff(actor:{owner?:boolean;role:string}){return actor.owner===true||actor.role==='administrator';}
