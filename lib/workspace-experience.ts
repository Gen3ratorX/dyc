import type {Role} from './domain';
import type {Destination} from './navigation';
export function workspaceExperience(role:Role,owner=false){
 const admin=owner||role==='administrator';
 const home:Destination=role==='administrator'?'Settings':['coordinator','checkin'].includes(role)?'Check-in':role==='analyst'?'Reports':role==='doctor'?'Warriors':'Overview';
 const clinical=['medical_lead','doctor','nurse','mentor'].includes(role);
 const reports=['medical_lead','doctor','nurse','analyst'].includes(role);
 const navigation:Destination[]=role==='administrator'?['Check-in','Rooms & teams','Triage','Settings','Sync centre']:admin?['Overview','Check-in','Rooms & teams','Warriors','Clinical review','Triage','Reports','Sync centre','Settings']:role==='analyst'?['Reports','Check-in','Settings']:['coordinator','checkin'].includes(role)?['Check-in',...(role==='coordinator'?['Rooms & teams','Warriors'] as Destination[]:[]),'Settings']:['Overview','Check-in',...(role==='mentor'?['Rooms & teams'] as Destination[]:[]),'Warriors','Clinical review',...(role==='medical_lead'?['Triage'] as Destination[]:[]),...(reports?['Reports'] as Destination[]:[]),'Settings'];
 const titles:Partial<Record<Destination,string>>=admin?{}:{Overview:role==='doctor'?'Glucose overview':role==='medical_lead'?'Care overview':'My care group',Warriors:['coordinator','doctor'].includes(role)?'Camp roster':'My warriors','Clinical review':role==='mentor'?'Review requests':'Clinical reviews',Reports:'Reports',Settings:'My account','Sync centre':'Saved entries'};
 return {admin,home,navigation,titles,clinical,reports};
}
