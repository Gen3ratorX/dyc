export function syncStatus(online:boolean,syncing:boolean,pending:number,failed:number,problem=false){
 if(!online)return {label:'Offline',state:'offline'};
 if(syncing)return {label:'Syncing…',state:'syncing'};
 if(failed>0||problem)return {label:'Needs attention',state:'attention'};
 if(pending>0)return {label:`${pending} pending`,state:'pending'};
 return {label:'Up to date',state:'ready'};
}
