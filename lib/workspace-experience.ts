import type {Role} from './domain';
import type {Destination} from './navigation';
export function workspaceExperience(role:Role,owner=false){
 const admin=owner||role==='administrator';
 const home:Destination=role==='administrator'?'Settings':role==='coordinator'?'Warriors':role==='analyst'?'Reports':'Overview';
 const clinical=['medical_lead','doctor','nurse','mentor'].includes(role);
 const reports=['medical_lead','doctor','nurse','analyst'].includes(role);
 const navigation:Destination[]=role==='administrator'?['Settings','Sync centre']:admin?['Overview','Warriors','Clinical review','Reports','Sync centre','Settings']:role==='analyst'?['Reports','Settings']:role==='coordinator'?['Warriors','Settings']:['Overview','Warriors','Clinical review',...(reports?['Reports'] as Destination[]:[]),'Settings'];
 const titles:Partial<Record<Destination,string>>=admin?{}:{Overview:role==='medical_lead'?'Care overview':'My care group',Warriors:role==='coordinator'?'Camp roster':'My warriors','Clinical review':role==='mentor'?'Review requests':'Clinical reviews',Reports:'Reports',Settings:'My account','Sync centre':'Saved entries'};
 return {admin,home,navigation,titles,clinical,reports};
}
